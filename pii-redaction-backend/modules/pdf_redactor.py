import io
import fitz  # PyMuPDF
from typing import List, Dict, Optional, Tuple

def _make_label_text(type_name: str, idx: int, style: str, custom_label: Optional[str]) -> Optional[str]:
    """Return the label text (or None for blackbox style)."""
    if style == "typed":
        return f"[{type_name}_{idx}]"
    if style == "custom" and custom_label:
        return custom_label
    if style == "blackbox":
        return None
    return "[REDACTED]"

def _normalize_for_search(s: str) -> str:
    """Normalize whitespace for more robust matching when searching in PDFs."""
    return " ".join(s.split())

def create_redacted_pdf_bytes(
    input_pdf_bytes: bytes,
    entities: List[Dict],
    label_style: str = "typed",
    custom_label: Optional[str] = None,
) -> bytes:
    """
    Create a redacted PDF (bytes) from input PDF bytes.

    - entities: list of dicts { type, start, end, text, ... }
      We search for entity['text'] on each page and redact all found rectangles.
    - label_style: "typed" | "blackbox" | "custom"
      * "typed" => replaces area with black box and writes white label like [EMAIL_1]
      * "blackbox" => solid black rectangle only
      * "custom" => uses `custom_label` text as label (if provided)
    Returns:
      bytes of the redacted PDF
    Notes:
      - search_for works only when the PDF contains extractable text (not scanned images).
      - OCRed/scanned PDFs require a different workflow (OCR + coordinate mapping).
    """
    # open PDF from bytes
    try:
        doc = fitz.open(stream=input_pdf_bytes, filetype="pdf")
    except Exception as e:
        raise RuntimeError(f"Unable to open PDF bytes with PyMuPDF: {e}")

    # prepare counters and label text for each entity
    counters = {}
    for ent in entities:
        t = ent.get("type", "PII")
        counters[t] = counters.get(t, 0) + 1
        ent["_label_text"] = _make_label_text(t, counters[t], label_style, custom_label)

    # iterate pages and search for entity text
    for page_idx in range(doc.page_count):
        page = doc.load_page(page_idx)

        # small optimization: get page text to skip searching for long texts that aren't present
        try:
            page_text = page.get_text("text") or ""
        except Exception:
            page_text = ""
        page_text_norm = _normalize_for_search(page_text).lower()

        for ent in entities:
            raw_search = ent.get("text", "")
            if not raw_search or not raw_search.strip():
                continue

            # normalize search string
            search_text = _normalize_for_search(raw_search).strip()
            if not search_text:
                continue

            rects = []
            # Try direct search first (exact)
            try:
                rects = page.search_for(search_text, hit_max=256)
            except Exception:
                rects = []

            # If not found, try a case-insensitive attempt by searching for lower-cased tokens
            if not rects:
                # only attempt if the page text contains the lowercase variant
                if search_text.lower() in page_text_norm:
                    try:
                        rects = page.search_for(search_text.lower(), hit_max=256)
                    except Exception:
                        rects = []

            # last attempt: split into tokens and search each token (helpful for long multi-word names)
            if not rects and len(search_text.split()) > 1:
                tokens = search_text.split()
                for tok in tokens:
                    if len(tok) < 3:
                        continue
                    try:
                        found = page.search_for(tok, hit_max=64)
                        if found:
                            rects.extend(found)
                    except Exception:
                        continue

            if not rects:
                # nothing found on this page for this entity
                continue

            # draw redaction rectangles and optionally insert labels
            for r in rects:
                try:
                    # expand the rectangle slightly to better cover glyph ink (tweak if needed)
                    pad_x = max(1.0, r.width * 0.02)
                    pad_y = max(1.0, r.height * 0.06)
                    rr = fitz.Rect(r.x0 - pad_x, r.y0 - pad_y, r.x1 + pad_x, r.y1 + pad_y)

                    # draw filled black rectangle (mask)
                    page.draw_rect(rr, color=(0, 0, 0), fill=(0, 0, 0))

                    # If style requires a label, draw centered white text inside the black box
                    label = ent.get("_label_text")
                    if label:
                        # Estimate font size to fit inside rect height
                        # Use about 60% of rect height for font size (adjustable)
                        font_size = max(6, int(rr.height * 0.6))
                        # Use a textbox to center the label and wrap if it's long
                        text_box_rect = fitz.Rect(rr.x0 + 2, rr.y0 + 2, rr.x1 - 2, rr.y1 - 2)

                        # insert_textbox will scale/clip text to box; align center (1=center)
                        page.insert_textbox(
                            text_box_rect,
                            label,
                            fontsize=font_size,
                            fontname="helv",  # standard font available in PyMuPDF
                            color=(1, 1, 1),
                            align=1,  # center
                        )
                except Exception as ex:
                    # don't stop processing entire doc for one rect; log and continue
                    print(f"[pdf_redactor] warning: failed to redact rect on page {page_idx}: {ex}")
                    continue

    # Save redacted PDF to bytes
    out = io.BytesIO()
    try:
        doc.save(out)
    except Exception as e:
        doc.close()
        raise RuntimeError(f"Failed to save redacted PDF: {e}")
    doc.close()
    out.seek(0)
    return out.read()
