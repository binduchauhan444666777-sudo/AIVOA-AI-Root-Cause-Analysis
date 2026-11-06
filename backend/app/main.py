from datetime import datetime
import io
import json
import re
from typing import Optional
import zipfile
import xml.etree.ElementTree as ET
import pymupdf as fitz
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from .config import DATABASE_URL
from .database import Base, engine, get_db
from . import models
from .schemas import AnalyzeRequest, SaveRequest
from .ai_service import extract_incident, analyze_incident, chat_incident
from .langgraph_workflow import build_rca_workflow

MAX_UPLOAD_BYTES = 20 * 1024 * 1024  # 20 MB

app = FastAPI(title="AIVOA RCA API", version="1.0.0")
rca_workflow = build_rca_workflow()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://127.0.0.1:5174"],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

def extract_file_text(filename: str, raw: bytes) -> str:
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "File exceeds 20 MB limit. Please upload a document under 20 MB.")

    ext = filename.lower().split(".")[-1] if "." in filename else ""

    if ext == "pdf":
        try:
            doc = fitz.open(stream=raw, filetype="pdf")
            return "\n\n".join(p.get_text() for p in doc).strip()
        except Exception as exc:
            raise HTTPException(400, f"Could not read PDF document: {exc}")

    elif ext == "docx":
        try:
            with zipfile.ZipFile(io.BytesIO(raw)) as z:
                xml_content = z.read("word/document.xml")
                tree = ET.fromstring(xml_content)
                paragraphs = []
                for p in tree.iter():
                    if p.tag.endswith("}p"):
                        p_text = "".join(node.text for node in p.iter() if node.tag.endswith("}t") and node.text)
                        if p_text.strip():
                            paragraphs.append(p_text.strip())
                return "\n\n".join(paragraphs)
        except Exception as exc:
            raise HTTPException(400, f"Could not read DOCX document: {exc}")

    elif ext in ["txt", "log", "md", "csv", "json"]:
        for enc in ["utf-8", "utf-8-sig", "latin-1", "cp1252", "utf-16"]:
            try:
                return raw.decode(enc).strip()
            except UnicodeDecodeError:
                continue
        return raw.decode("utf-8", errors="ignore").strip()

    elif ext == "doc":
        try:
            text_blocks = re.findall(rb'[\x20-\x7E\r\n\t]{4,}', raw)
            extracted = "\n".join(b.decode('latin-1', errors='ignore') for b in text_blocks)
            if extracted.strip():
                return extracted.strip()
        except Exception:
            pass
        return raw.decode("latin-1", errors="ignore").strip()

    else:
        raise HTTPException(
            400,
            f"Unsupported file format (.{ext}). Supported formats: PDF, DOC, DOCX, TXT, LOG, MD, CSV (max 20 MB)."
        )

@app.on_event("startup")
def startup():
    if engine is not None:
        Base.metadata.create_all(bind=engine)

@app.get("/api/health")
def health():
    return {"status": "ok", "database_configured": bool(DATABASE_URL)}

@app.post("/api/extract")
async def extract(
    text: str = Form(""),
    incident: str = Form("{}"),
    history: str = Form("[]"),
    file: Optional[UploadFile] = File(None)
):
    source = text.strip()
    if file:
        raw = await file.read()
        file_text = extract_file_text(file.filename, raw)
        source = (source + "\n\n" + file_text).strip() if source else file_text

    if not source:
        raise HTTPException(400, "Please provide incident text or upload a document (PDF, Word, Text, etc.).")

    try:
        current_inc = json.loads(incident) if incident else {}
    except Exception:
        current_inc = {}

    try:
        history_list = json.loads(history) if history else []
    except Exception:
        history_list = []

    try:
        today_str = datetime.now().strftime("%Y-%m-%d")
        if current_inc and (current_inc.get("incident_description") or current_inc.get("title")):
            res = chat_incident(
                user_message=source,
                current_incident=current_inc,
                chat_history=history_list,
                today_date=today_str,
            )
            return {
                "incident": res.get("incident", current_inc),
                "source_text": source[:18000],
                "reply": res.get("reply", "Updated investigation parameters."),
                "ai_used": True,
                "message": "Review all extracted values before proceeding."
            }
        else:
            return {
                "incident": extract_incident(source),
                "source_text": source[:18000],
                "ai_used": True,
                "message": "Review all extracted values before proceeding."
            }
    except Exception as exc:
        raise HTTPException(502, str(exc))

@app.post("/api/chat")
async def chat(
    message: str = Form(""),
    incident: str = Form("{}"),
    history: str = Form("[]"),
    file: Optional[UploadFile] = File(None)
):
    source = message.strip()
    if file:
        raw = await file.read()
        file_text = extract_file_text(file.filename, raw)
        source = (source + "\n\n" + file_text).strip() if source else file_text

    if not source:
        raise HTTPException(400, "Please provide a message or attach a document.")

    try:
        current_inc = json.loads(incident) if incident else {}
    except Exception:
        current_inc = {}

    try:
        history_list = json.loads(history) if history else []
    except Exception:
        history_list = []

    today_str = datetime.now().strftime("%Y-%m-%d")

    try:
        res = chat_incident(
            user_message=source,
            current_incident=current_inc,
            chat_history=history_list,
            today_date=today_str,
        )
        return {
            "incident": res.get("incident", current_inc),
            "reply": res.get("reply", "Updated investigation parameters."),
        }
    except Exception as exc:
        raise HTTPException(502, str(exc))

@app.post("/api/analyze")
def analyze(payload: AnalyzeRequest):
    try:
        state = {
            "source_text": "",
            "incident": payload.incident.model_dump(),
            "method": payload.method,
            "analysis": {},
        }
        result = rca_workflow.invoke(state)
        analysis = result.get("analysis") or {}
        analysis["method"] = payload.method
        return analysis
    except Exception as exc:
        raise HTTPException(502, str(exc))

@app.post("/api/investigations")
def save(payload: SaveRequest, db: Session = Depends(get_db)):
    if db is None:
        raise HTTPException(503, "PostgreSQL is not configured. Add DATABASE_URL to backend/.env.")
    row = models.Investigation(**payload.incident.model_dump(), analysis=payload.analysis,
                               created_at=datetime.utcnow(), updated_at=datetime.utcnow())
    db.add(row); db.commit(); db.refresh(row)
    return {"id": row.id, "message": "Investigation saved successfully."}

def serialize(row):
    return {
        "id": row.id, "title": row.title, "batch_number": row.batch_number,
        "product_name": row.product_name, "incident_date": row.incident_date,
        "department": row.department, "severity": row.severity, "status": row.status,
        "incident_description": row.incident_description,
        "containment_action": row.containment_action,
        "investigation_method": row.investigation_method, "analysis": row.analysis or {},
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }

@app.get("/api/investigations")
def list_investigations(db: Session = Depends(get_db)):
    if db is None:
        return []
    rows = db.query(models.Investigation).order_by(models.Investigation.created_at.desc()).limit(100).all()
    return [serialize(row) for row in rows]

@app.get("/api/investigations/{record_id}")
def get_investigation(record_id: int, db: Session = Depends(get_db)):
    if db is None:
        raise HTTPException(503, "PostgreSQL is not configured.")
    row = db.get(models.Investigation, record_id)
    if not row:
        raise HTTPException(404, "Investigation not found.")
    return serialize(row)
