from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from typing import Optional, Dict, List, Literal

from modules.pdf_extractor import extract_text_from_bytes
from modules.pii_detector import detect_pii
from modules.redactor import apply_redaction

import fitz
import os
import uuid
import logging

# DATABASE IMPORTS
from database import SessionLocal
from models import RedactionLog

router = APIRouter()

logger = logging.getLogger(__name__)

OUTPUT_DIR = "redacted_pdfs"
os.makedirs(OUTPUT_DIR, exist_ok=True)


# ---------------- DATABASE LOGGER ----------------
def log_redaction(filename: str, entities: str, output_path: str):
    try:
        db = SessionLocal()

        log = RedactionLog(
            filename=filename,
            redacted_entities=entities,
            output_path=output_path
        )

        db.add(log)
        db.commit()
        db.close()

    except Exception as e:
        logger.warning(f"Failed to log redaction: {e}")


def _normalize_for_search(s: str) -> str:
    return " ".join(s.split())


class RedactionItem(BaseModel):
    type: str
    original: str
    label: str
    start: int
    end: int


class RedactionSummary(BaseModel):
    counts: Dict[str, int]
    items: List[RedactionItem]


class RedactionResponse(BaseModel):
    message: Optional[str] = None
    download_url: Optional[str] = None
    original_text: str
    redacted_text: str
    summary: RedactionSummary


class RedactTextRequest(BaseModel):
    text: str = Field("", description="Input text to be redacted")
    redact_emails: bool = True
    redact_phones: bool = True
    redact_names: bool = False
    redact_addresses: bool = False
    label_style: Literal["typed", "blackbox", "custom"] = "typed"
    custom_label: Optional[str] = None


class RedactFromPathRequest(BaseModel):
    path: str
    options: Optional[Dict[str, object]] = None


def _filter_entities(
    entities: List[Dict],
    redact_emails: bool,
    redact_phones: bool,
    redact_names: bool,
    redact_addresses: bool,
) -> List[Dict]:

    allowed = {
        k
        for k, v in {
            "EMAIL": redact_emails,
            "PHONE": redact_phones,
            "NAME": redact_names,
            "ADDRESS": redact_addresses,
        }.items()
        if v
    }

    return [e for e in entities if e["type"] in allowed]


def _build_summary(items: List[Dict]) -> RedactionSummary:
    counts: Dict[str, int] = {}

    for it in items:
        counts[it["type"]] = counts.get(it["type"], 0) + 1

    return RedactionSummary(
        counts=counts,
        items=[RedactionItem(**it) for it in items],
    )


# ---------------- TEXT REDACTION ----------------
@router.post("/redact-text", response_model=RedactionResponse)
async def redact_text(payload: RedactTextRequest):

    text = payload.text or ""

    entities = detect_pii(text)

    entities = _filter_entities(
        entities,
        payload.redact_emails,
        payload.redact_phones,
        payload.redact_names,
        payload.redact_addresses,
    )

    redacted_text, items = apply_redaction(
        text, entities, payload.label_style, payload.custom_label
    )

    summary = _build_summary(items)

    return RedactionResponse(
        message="Text redacted successfully",
        download_url=None,
        original_text=text,
        redacted_text=redacted_text,
        summary=summary,
    )


# ---------------- FILE REDACTION ----------------
@router.post("/redact-file", response_model=RedactionResponse)
async def redact_file(
    file: UploadFile = File(...),
    redact_emails: bool = Form(True),
    redact_phones: bool = Form(True),
    redact_names: bool = Form(False),
    redact_addresses: bool = Form(False),
    label_style: Literal["typed", "blackbox", "custom"] = Form("typed"),
    custom_label: Optional[str] = Form(None),
    return_file: bool = Form(False),
):

    if file.content_type not in ["application/pdf", "image/png", "image/jpeg"]:
        raise HTTPException(415, "Only PDF, PNG or JPEG supported.")

    raw_bytes = await file.read()

    base_input = f"{OUTPUT_DIR}/{uuid.uuid4()}_input"

    ext = "pdf"
    if file.filename and "." in file.filename:
        ext = file.filename.split(".")[-1]

    input_path = f"{base_input}.{ext}"

    with open(input_path, "wb") as f:
        f.write(raw_bytes)

    text = extract_text_from_bytes(
        raw_bytes,
        content_type=file.content_type,
        filename=file.filename,
    )

    entities = detect_pii(text)

    entities = _filter_entities(
        entities,
        redact_emails,
        redact_phones,
        redact_names,
        redact_addresses,
    )

    redacted_text, items = apply_redaction(
        text,
        entities,
        label_style,
        custom_label,
    )

    summary = _build_summary(items)

    doc = fitz.open(input_path)

    for page in doc:

        for item in items:

            original = item["original"]
            label = item["label"]

            rects = page.search_for(original)

            for rect in rects:
                page.add_redact_annot(rect, fill=(0, 0, 0))

                if label:
                    page.insert_text(
                        (rect.x0, rect.y0 - 8),
                        label,
                        color=(1, 1, 1),
                    )

        page.apply_redactions()

    output_path = f"{OUTPUT_DIR}/{uuid.uuid4()}_redacted.pdf"

    doc.save(output_path)
    doc.close()

    download_url = f"/api/download/{os.path.basename(output_path)}"

    # ---------- DATABASE LOG ----------
    entity_types = list(summary.counts.keys())

    log_redaction(
        filename=file.filename or "uploaded_file",
        entities=",".join(entity_types),
        output_path=output_path,
    )

    if return_file:

        return FileResponse(
            output_path,
            media_type="application/pdf",
            filename=os.path.basename(output_path),
        )

    return RedactionResponse(
        message="File redacted successfully",
        download_url=download_url,
        original_text=text,
        redacted_text=redacted_text,
        summary=summary,
    )


# ---------------- SERVER PATH REDACTION ----------------
@router.post("/redact-from-path", response_model=RedactionResponse)
async def redact_from_path(payload: RedactFromPathRequest):

    path = payload.path

    if not os.path.exists(path):
        raise HTTPException(404, "Path not found")

    with open(path, "rb") as f:
        raw_bytes = f.read()

    text = extract_text_from_bytes(raw_bytes)

    entities = detect_pii(text)

    redacted_text, items = apply_redaction(text, entities, "typed", None)

    summary = _build_summary(items)

    output_path = f"{OUTPUT_DIR}/{uuid.uuid4()}_redacted.pdf"

    img_doc = fitz.open()
    img_doc.new_page()
    page = img_doc[0]
    page.insert_image(page.rect, stream=raw_bytes)
    img_doc.save(output_path)
    img_doc.close()

    # ---------- DATABASE LOG ----------
    entity_types = list(summary.counts.keys())

    log_redaction(
        filename=os.path.basename(path),
        entities=",".join(entity_types),
        output_path=output_path,
    )

    download_url = f"/api/download/{os.path.basename(output_path)}"

    return RedactionResponse(
        message="Server-path file redacted",
        download_url=download_url,
        original_text=text,
        redacted_text=redacted_text,
        summary=summary,
    )


# ---------------- FILE DOWNLOAD ----------------
@router.get("/download/{filename}")
async def download_file(filename: str):

    file_path = f"{OUTPUT_DIR}/{filename}"

    if not os.path.exists(file_path):
        raise HTTPException(404, "File not found")

    return FileResponse(
        file_path,
        media_type="application/pdf",
        filename=filename,
    )