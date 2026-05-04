import shutil
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse

from backend.app.models.schemas import IngestResponse, SourceItem, SourceChunk
from rag.ingestion.pdf_loader import load_pdf
from rag.ingestion.url_loader import load_url
from rag.ingestion.chunking import chunk_documents
from rag.embeddings.embedder import embed_texts
from rag.vectorstore.qdrant_client import upsert_chunks, list_sources, get_chunks_by_source

router = APIRouter()
RAW_DATA_DIR = Path("data/raw")
RAW_DATA_DIR.mkdir(parents=True, exist_ok=True)

_ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt", ".md"}


@router.post("/upload/pdf", response_model=IngestResponse)
async def upload_pdf(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    suffix = Path(file.filename).suffix.lower()
    if suffix not in _ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"Unsupported file type '{suffix}'. Accepted: {', '.join(_ALLOWED_EXTENSIONS)}")

    dest = RAW_DATA_DIR / file.filename
    with dest.open("wb") as f:
        shutil.copyfileobj(file.file, f)

    background_tasks.add_task(_ingest_file, str(dest), suffix)
    return IngestResponse(status="ingesting", filename=file.filename, chunks=0)


@router.post("/ingest/url", response_model=IngestResponse)
async def ingest_url(payload: dict, background_tasks: BackgroundTasks):
    url = payload.get("url", "").strip()
    if not url.startswith("http"):
        raise HTTPException(400, "Invalid URL.")
    background_tasks.add_task(_ingest_url, url)
    return IngestResponse(status="ingesting", filename=url, chunks=0)


# ── Source library endpoints ───────────────────────────────────────────────────

@router.get("/sources", response_model=list[SourceItem])
async def get_sources():
    """List all unique sources currently stored in the vector database."""
    return list_sources()


@router.get("/sources/{source_name}/chunks", response_model=list[SourceChunk])
async def get_source_chunks(source_name: str):
    """Return all text chunks for a given source (for the in-panel viewer)."""
    chunks = get_chunks_by_source(source_name)
    if not chunks:
        raise HTTPException(404, f"No chunks found for source '{source_name}'.")
    return chunks


# ── File serving (PDF inline viewer) ──────────────────────────────────────────

@router.get("/files/{filename}")
async def serve_file(filename: str):
    """Serve a raw uploaded file (used by the in-panel PDF iframe)."""
    path = (RAW_DATA_DIR / filename).resolve()
    # Security: must stay within RAW_DATA_DIR
    if not path.is_relative_to(RAW_DATA_DIR.resolve()):
        raise HTTPException(403, "Access denied.")
    if not path.exists() or not path.is_file():
        raise HTTPException(404, "File not found.")

    suffix = path.suffix.lower()
    media_types = {
        ".pdf":  "application/pdf",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".txt":  "text/plain",
        ".md":   "text/markdown",
    }
    media_type = media_types.get(suffix, "application/octet-stream")
    return FileResponse(str(path), media_type=media_type)


# ── Internal ingestion helpers ─────────────────────────────────────────────────

async def _ingest_file(path: str, suffix: str) -> None:
    if suffix == ".pdf":
        docs = load_pdf(path)
    else:
        # Fallback: read as plain text
        text = Path(path).read_text(encoding="utf-8", errors="replace")
        docs = [{"text": text, "metadata": {"source": Path(path).name, "source_type": "document"}}]
    _process(docs)


async def _ingest_pdf(path: str) -> None:
    docs = load_pdf(path)
    _process(docs)


async def _ingest_url(url: str) -> None:
    docs = await load_url(url)
    _process(docs)


def _process(docs: list[dict]) -> None:
    chunks = chunk_documents(docs)
    vectors = embed_texts([c["text"] for c in chunks])
    upsert_chunks(chunks, vectors)
