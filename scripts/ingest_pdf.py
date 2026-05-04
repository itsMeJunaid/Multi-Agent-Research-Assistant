"""CLI helper: ingest a PDF directly.
Usage: python -m scripts.ingest_pdf path/to/file.pdf
"""
import sys
import asyncio
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from rag.ingestion.pdf_loader import load_pdf
from rag.ingestion.chunking import chunk_documents
from rag.embeddings.embedder import embed_texts
from rag.vectorstore.qdrant_client import upsert_chunks


def main():
    if len(sys.argv) < 2:
        print("Usage: python -m scripts.ingest_pdf <path/to/file.pdf>")
        sys.exit(1)

    path = sys.argv[1]
    print(f"Loading {path}...")
    docs = load_pdf(path)
    print(f"  {len(docs)} pages loaded")

    chunks = chunk_documents(docs)
    print(f"  {len(chunks)} chunks created")

    vectors = embed_texts([c["text"] for c in chunks])
    count = upsert_chunks(chunks, vectors)
    print(f"  {count} chunks upserted to Qdrant ✅")


if __name__ == "__main__":
    main()
