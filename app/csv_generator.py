import csv
import io
from datetime import datetime

def generate_akinai_csv(items: list[dict], customer_code: str = "9999") -> bytes:
    """
    Generate a Shift-JIS (cp932) encoded CSV file for OBC Akinai Bugyo import.
    Handles encoding exceptions by replacing unsupported characters (errors='replace').
    
    Expected format of items: list of dict, where each dict has:
    - scanned_code (or expected_name)
    - scanned_qty (or expected_qty)
    """
    output = io.StringIO()
    # Standard CSV writer with Windows style line endings CRLF (\r\n)
    writer = csv.writer(output, lineterminator='\r\n')
    
    # Standard columns for Akinai Bugyo sales slip import (伝票日付, 得意先コード, 商品コード, 数量)
    writer.writerow(["伝票日付", "得意先コード", "商品コード", "数量"])
    
    today = datetime.now().strftime("%Y/%m/%d")
    for item in items:
        # We prefer the scanned code (physical check) or fallback to expected name
        code = item.get("scanned_code") or item.get("expected_name") or ""
        qty = item.get("scanned_qty")
        if qty is None:
            qty = item.get("expected_qty") or 0
            
        # Ensure we write a clean row
        writer.writerow([
            today,
            customer_code,
            str(code).strip(),
            int(qty)
        ])
        
    csv_str = output.getvalue()
    
    # Robust Shift-JIS encoding with fallback exception handling
    try:
        return csv_str.encode("cp932", errors="replace")
    except Exception as e:
        # Extra fallback to ignore characters that cause issues if replace somehow fails
        print(f"cp932 encode failed with replace, falling back to ignore. Error: {e}")
        return csv_str.encode("cp932", errors="ignore")
