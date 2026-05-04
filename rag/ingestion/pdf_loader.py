from pathlib import Path
from pypdf import PdfReader


def load_pdf(file_path: str) -> list[dict]:
    """Load a PDF and return list of page dicts with text + metadata."""
    reader = PdfReader(file_path)
    pages = []
    for i, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        text = text.strip()
        if text:
            pages.append({
                "text": text,
                "metadata": {
                    "source": Path(file_path).name,
                    "page": i + 1,
                    "source_type": "pdf",
                },
            })
    return pages
