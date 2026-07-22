import unicodedata
import re

def normalize_text(text: str) -> str:
    """
    Normalize text: convert full-width alphanumeric to half-width,
    convert to uppercase, and strip whitespaces and common delimiters.
    """
    if not text:
        return ""
    # Normalize unicode (converts full-width to half-width, etc.)
    text = unicodedata.normalize("NFKC", text)
    # Convert to uppercase
    text = text.upper()
    # Remove whitespace, hyphens, brackets, Japanese punctuation, and common suffixes/units
    text = re.sub(r'[\s\-_ー()（）[\]「」{}<>.,，．。、：:]', '', text)
    return text

def smart_match(expected_items: list[dict], scanned_items: list[dict]) -> dict:
    """
    Match expected items (from instructions) with scanned items (from cardboards).
    
    Expected item format: {"item_name": str, "quantity": int}
    Scanned item format: {"item_code": str, "quantity": int, "color": str/None, "index": int}
    
    Returns:
    {
        "status": "OK" or "NG",
        "matches": [
            {
                "expected_name": str or None,
                "expected_qty": int or 0,
                "scanned_code": str or None,
                "scanned_qty": int or 0,
                "status": "MATCHED" | "MISMATCHED" | "MISSING" | "UNEXPECTED",
                "scanned_color": str or None
            }
        ]
    }
    """
    # 1. Normalize and aggregate expected items
    expected_map = {} # norm_name -> {"name": orig, "qty": sum_qty}
    for item in expected_items:
        name = item.get("item_name") or ""
        qty = int(item.get("quantity") or 0)
        norm = normalize_text(name)
        if not norm:
            continue
        if norm in expected_map:
            expected_map[norm]["qty"] += qty
        else:
            expected_map[norm] = {"name": name, "qty": qty}
            
    # 2. Normalize and aggregate scanned items
    scanned_map = {} # norm_code -> {"code": orig, "qty": sum_qty, "colors": list, "scans": list}
    for item in scanned_items:
        code = item.get("item_code") or ""
        qty = int(item.get("quantity") or 0)
        color = item.get("color")
        norm = normalize_text(code)
        if not norm:
            continue
        if norm in scanned_map:
            scanned_map[norm]["qty"] += qty
            if color and color not in scanned_map[norm]["colors"]:
                scanned_map[norm]["colors"].append(color)
            scanned_map[norm]["scans"].append(item)
        else:
            scanned_map[norm] = {
                "code": code,
                "qty": qty,
                "colors": [color] if color else [],
                "scans": [item]
            }

    # 3. Match keys
    matched_pairs = [] # list of matches
    
    unmatched_expected = list(expected_map.keys())
    unmatched_scanned = list(scanned_map.keys())
    
    # 3.a Exact normalized key match
    for norm in list(unmatched_expected):
        if norm in unmatched_scanned:
            e_item = expected_map[norm]
            s_item = scanned_map[norm]
            
            qty_status = "MATCHED" if e_item["qty"] == s_item["qty"] else "MISMATCHED"
            
            matched_pairs.append({
                "expected_name": e_item["name"],
                "expected_qty": e_item["qty"],
                "scanned_code": s_item["code"],
                "scanned_qty": s_item["qty"],
                "status": qty_status,
                "scanned_color": s_item["colors"][0] if s_item["colors"] else None
            })
            
            unmatched_expected.remove(norm)
            unmatched_scanned.remove(norm)
            
    # 3.b Substring / smart matching for remaining items
    for norm_e in list(unmatched_expected):
        best_match_s = None
        for norm_s in unmatched_scanned:
            # Check if one is a substring of another (e.g. "TK01" and "TK01竹糸アームカバー")
            if norm_s in norm_e or norm_e in norm_s:
                best_match_s = norm_s
                break
                
        if best_match_s:
            e_item = expected_map[norm_e]
            s_item = scanned_map[best_match_s]
            
            qty_status = "MATCHED" if e_item["qty"] == s_item["qty"] else "MISMATCHED"
            
            matched_pairs.append({
                "expected_name": e_item["name"],
                "expected_qty": e_item["qty"],
                "scanned_code": s_item["code"],
                "scanned_qty": s_item["qty"],
                "status": qty_status,
                "scanned_color": s_item["colors"][0] if s_item["colors"] else None
            })
            
            unmatched_expected.remove(norm_e)
            unmatched_scanned.remove(best_match_s)
            
    # 3.c Add missing expected items
    for norm_e in unmatched_expected:
        e_item = expected_map[norm_e]
        matched_pairs.append({
            "expected_name": e_item["name"],
            "expected_qty": e_item["qty"],
            "scanned_code": None,
            "scanned_qty": 0,
            "status": "MISSING",
            "scanned_color": None
        })
        
    # 3.d Add unexpected scanned items
    for norm_s in unmatched_scanned:
        s_item = scanned_map[norm_s]
        matched_pairs.append({
            "expected_name": None,
            "expected_qty": 0,
            "scanned_code": s_item["code"],
            "scanned_qty": s_item["qty"],
            "status": "UNEXPECTED",
            "scanned_color": s_item["colors"][0] if s_item["colors"] else None
        })

    # Overall status is OK only if all matches are "MATCHED" and no missing/unexpected/mismatched items exist
    overall_status = "OK"
    for m in matched_pairs:
        if m["status"] != "MATCHED":
            overall_status = "NG"
            break
            
    return {
        "status": overall_status,
        "matches": matched_pairs
    }
