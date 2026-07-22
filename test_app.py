import os
import sys
import json
from app.ocr_engine import detect_marker_y_ranges, scan_cardboard_image, scan_instruction_image, scan_shipping_notice_image
from app.matcher import smart_match
from app.csv_generator import generate_akinai_csv
import cv2

# Load from .env file manually if it exists
if os.path.exists(".env"):
    try:
        with open(".env", "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ[k.strip()] = v.strip().strip("'\"")
    except Exception as e:
        print(f"Warning: Failed to read .env file in test script: {e}")

api_key = os.getenv("OPENAI_API_KEY")
if not api_key or api_key.startswith("dummy"):
    print("WARNING: OPENAI_API_KEY is not set or is dummy. API calls will fail.")
else:
    print(f"OPENAI_API_KEY is configured (starts with: {api_key[:8]}...)")

def test_opencv_marker_detection():
    print("\n--- 1. Testing OpenCV Marker Detection ---")
    
    # Test Green Marker Box
    green_box_path = "test_images/cardboard_green.jpg"
    img_green = cv2.imread(green_box_path)
    if img_green is None:
        print(f"FAIL: Could not load {green_box_path}")
        return False
        
    green_ranges = detect_marker_y_ranges(img_green)
    print(f"Green cardboard ({green_box_path}):")
    print(f"  Detected Green Y-ranges: {green_ranges.get('green')}")
    print(f"  Detected Red Y-ranges: {green_ranges.get('red')}")
    
    # Test Red Marker Box
    red_box_path = "test_images/cardboard_red.jpg"
    img_red = cv2.imread(red_box_path)
    if img_red is None:
        print(f"FAIL: Could not load {red_box_path}")
        return False
        
    red_ranges = detect_marker_y_ranges(img_red)
    print(f"Red cardboard ({red_box_path}):")
    print(f"  Detected Green Y-ranges: {red_ranges.get('green')}")
    print(f"  Detected Red Y-ranges: {red_ranges.get('red')}")
    
    if not green_ranges.get("green") and not red_ranges.get("red"):
        print("FAIL: No markers detected in test images.")
        return False
        
    print("SUCCESS: OpenCV marker detection completed.")
    return True

def test_cardboard_scan_ocr():
    print("\n--- 2. Testing Cardboard OCR Scan ---")
    if not api_key:
        print("SKIPPED: OPENAI_API_KEY is not set.")
        return None, None
        
    # Scan Green Box
    print("Scanning green cardboard image...")
    green_results = scan_cardboard_image("test_images/cardboard_green.jpg")
    print("Green Scan Results:")
    print(json.dumps(green_results, indent=2, ensure_ascii=False))
    
    # Scan Red Box
    print("Scanning red cardboard image...")
    red_results = scan_cardboard_image("test_images/cardboard_red.jpg")
    print("Red Scan Results:")
    print(json.dumps(red_results, indent=2, ensure_ascii=False))
    
    return green_results, red_results

def test_instruction_scan_ocr():
    print("\n--- 3. Testing Instruction & Shipping Notice OCR Scan ---")
    if not api_key:
        print("SKIPPED: OPENAI_API_KEY is not set.")
        return True, True
        
    # Scan Handwritten Instruction
    print("Scanning handwritten instruction (商品生産・仕上げ依頼書)...")
    hw_results = scan_instruction_image("test_images/handwritten_instruction.jpg")
    print("Handwritten Scan Results:")
    print(json.dumps(hw_results, indent=2, ensure_ascii=False))
    
    # Scan Shipping Notice
    print("Scanning printed shipping notice (出荷案内書)...")
    sn_results = scan_shipping_notice_image("test_images/shipping_notice.jpg")
    print("Shipping Notice Scan Results:")
    print(json.dumps(sn_results, indent=2, ensure_ascii=False))
    
    return hw_results, sn_results

def test_matcher_and_csv_generation(expected, scanned):
    print("\n--- 4. Testing Matcher and CSV Generation ---")
    
    # Run Matcher
    match_result = smart_match(expected, scanned)
    print("Matcher Results:")
    print(json.dumps(match_result, indent=2, ensure_ascii=False))
    
    # Generate CSV
    csv_bytes = generate_akinai_csv(match_result["matches"], customer_code="12345")
    print(f"Generated CSV bytes: {len(csv_bytes)} bytes")
    
    # Try decoding Shift-JIS
    try:
        csv_text = csv_bytes.decode("cp932")
        print("Successfully decoded CSV as cp932 (Shift-JIS):")
        print(csv_text)
    except Exception as e:
        print(f"FAIL: Failed to decode CSV as cp932: {e}")
        return False
        
    # Test cp932 encoding error handler replacement
    print("Testing cp932 encoding exception fallback (with special character '①')...")
    mock_special_items = [
        {"expected_name": "特殊①", "expected_qty": 5, "scanned_code": "特殊①", "scanned_qty": 5, "status": "MATCHED"}
    ]
    try:
        special_csv_bytes = generate_akinai_csv(mock_special_items, customer_code="9999")
        decoded_special = special_csv_bytes.decode("cp932")
        print("Decoded Special CSV:")
        print(decoded_special)
    except Exception as e:
        print(f"FAIL: Failed special characters test: {e}")
        return False
        
    print("SUCCESS: Matcher & CSV generation verified.")
    return True

if __name__ == "__main__":
    # 1. OpenCV marker detection
    opencv_ok = test_opencv_marker_detection()
    
    # 2. OCR cardboard scan
    green_scanned, red_scanned = test_cardboard_scan_ocr()
    
    # 3. OCR instruction scan
    hw_expected, sn_expected = test_instruction_scan_ocr()
    
    # 4. Reconcile and export (Run simulation matching green cardboard scan with shipping notice)
    # Let's verify using the shipping notice expected items vs the cardboard scans
    # In shipping_notice, we expect: TK01 竹糸 アームカバー 20 黒 (Qty: 10)
    # We can run test on dummy items as well. Let's do a simulation
    simulation_expected = [
        {"item_name": "R-20", "quantity": 80},
        {"item_name": "フレッシュ抗菌", "quantity": 600}
    ]
    simulation_scanned = []
    if isinstance(green_scanned, list):
        simulation_scanned.extend(green_scanned)
    if isinstance(red_scanned, list):
        simulation_scanned.extend(red_scanned)
        
    # Fallback dummy data if API key wasn't present
    if not api_key:
        simulation_expected = [{"item_name": "R-20", "quantity": 80}, {"item_name": "フレッシュ抗菌", "quantity": 600}]
        simulation_scanned = [
            {"item_code": "R-20", "quantity": 80, "color": "green", "index": 0},
            {"item_code": "フレッシュ抗菌", "quantity": 600, "color": "red", "index": 0}
        ]
        
    test_matcher_and_csv_generation(simulation_expected, simulation_scanned)
