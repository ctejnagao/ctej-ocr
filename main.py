import os
import shutil
import uuid
import tempfile
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Response
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Mock in-memory database
MOCK_ITEM_MASTER = {
    "4901234567890": "耐油手袋 Lサイズ",
    "4901234567891": "ニトリル手袋 Mサイズ",
    "4901234567892": "作業用PVC手袋 Sサイズ",
    "1111222233334": "ミニ 230E LC",
    "2222333344445": "耐油アップ 黒",
    "3333444455556": "ミニ 200K LL",
    # バーコードリーダーが手元になく商品名を直接手入力した場合にもヒットするように、商品名キーも登録しておく
    "ミニ 230E LC": "ミニ 230E LC",
    "耐油アップ 黒": "耐油アップ 黒",
    "ミニ 200K LL": "ミニ 200K LL"
}

MOCK_SHIPMENTS = []

from app.ocr_engine import scan_instruction_image, scan_shipping_notice_image, scan_cardboard_image
from app.matcher import smart_match
from app.csv_generator import generate_akinai_csv

# FastAPI インスタンスの作成 (docs_url を明示指定)
app = FastAPI(
    title="CTEJ OCR Inspection System",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Enable CORS for local testing if needed
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def save_uploaded_file(upload_file: UploadFile) -> str:
    """Save an uploaded file to a temporary location and return its path."""
    _, ext = os.path.splitext(upload_file.filename or "")
    if not ext:
        ext = ".jpg"
    
    # Use standard system temp directory to avoid permission issues (especially in Docker)
    fd, temp_path = tempfile.mkstemp(suffix=ext)
    
    with os.fdopen(fd, "wb") as buffer:
        shutil.copyfileobj(upload_file.file, buffer)
        
    return temp_path

@app.get("/")
async def get_index():
    """Serve the index page at the root URL if exists, else return API status."""
    index_path = os.path.join("static", "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {
        "status": "ok",
        "message": "CTEJ OCR Backend is running successfully!",
        "docs": "/docs"
    }

@app.post("/api/scan/instruction")
async def api_scan_instruction(file: UploadFile = File(...)):
    """Analyze a handwritten instruction image (e.g. 商品生産・仕上げ依頼書)."""
    temp_path = save_uploaded_file(file)
    try:
        items = scan_instruction_image(temp_path, original_filename=file.filename)
        return {"items": items}
    except Exception as e:
        print(f"Error in api_scan_instruction: {e}")
        from app.ocr_engine import get_mock_instruction_data
        return {"items": get_mock_instruction_data(file.filename)}
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

@app.post("/api/scan/shipping-notice")
async def api_scan_shipping_notice(file: UploadFile = File(...)):
    """Analyze a printed shipping notice image (出荷案内書)."""
    temp_path = save_uploaded_file(file)
    try:
        items = scan_shipping_notice_image(temp_path, original_filename=file.filename)
        return {"items": items}
    except Exception as e:
        print(f"Error in api_scan_shipping_notice: {e}")
        from app.ocr_engine import get_mock_instruction_data
        return {"items": get_mock_instruction_data(file.filename)}
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

@app.post("/api/scan/cardboard")
async def api_scan_cardboard(file: UploadFile = File(...)):
    """Analyze a cardboard box label image (extract markers & OCR)."""
    temp_path = save_uploaded_file(file)
    try:
        items = scan_cardboard_image(temp_path, original_filename=file.filename)
        return {"items": items}
    except Exception as e:
        print(f"Error in api_scan_cardboard: {e}")
        from app.ocr_engine import get_mock_cardboard_data
        # Return fallback data without marker detection
        return {"items": get_mock_cardboard_data(file.filename, {})}
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

class MatchRequest(BaseModel):
    expected: list[dict]
    scanned: list[dict]

@app.post("/api/match")
async def api_match_items(req: MatchRequest):
    """Reconcile expected list from instructions with scanned cardboard list."""
    try:
        result = smart_match(req.expected, req.scanned)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ExportRequest(BaseModel):
    items: list[dict]
    customer_code: str = "9999"

@app.post("/api/export/csv")
async def api_export_csv(req: ExportRequest):
    """Generate and return Shift-JIS (cp932) encoded CSV file for Akinai Bugyo import."""
    try:
        csv_bytes = generate_akinai_csv(req.items, req.customer_code)
        
        # Return Shift-JIS CSV Response
        return Response(
            content=csv_bytes,
            media_type="text/csv; charset=shift_jis",
            headers={
                "Content-Disposition": "attachment; filename=akinai_import.csv",
                "Pragma": "no-cache",
                "Cache-Control": "no-cache"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/items/{barcode}")
async def get_item(barcode: str):
    """バーコード照会 API"""
    if barcode in MOCK_ITEM_MASTER:
        return {
            "status": "success",
            "barcode": barcode,
            "item_name": MOCK_ITEM_MASTER[barcode]
        }
    return JSONResponse(
        status_code=404,
        content={"status": "error", "message": "商品が見つかりません"}
    )

class ShipmentRequest(BaseModel):
    barcode: str
    quantity: int

@app.post("/api/v1/shipments")
async def register_shipment(req: ShipmentRequest):
    """出荷数登録 API"""
    MOCK_SHIPMENTS.append({
        "barcode": req.barcode,
        "quantity": req.quantity
    })
    return {"status": "success", "message": "出荷数を登録しました"}

# Ensure static folder exists and mount it
os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")