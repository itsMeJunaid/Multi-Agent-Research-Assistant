"""
Qdrant vector store wrapper.

QDRANT_MODE controls the backend:
  memory  — in-process, no persistence, zero setup
  local   — local Qdrant server (Docker or native binary)
  cloud   — Qdrant Cloud cluster
"""
import uuid
from qdrant_client import QdrantClient as _QdrantClient
from qdrant_client.models import (
    Distance, VectorParams, PointStruct, Filter,
    FieldCondition, MatchText, MatchValue, MatchAny, SearchRequest,
)

from backend.app.core.config import settings

VECTOR_SIZE = 384  # all-MiniLM-L6-v2


def _build_client() -> _QdrantClient:
    mode = settings.QDRANT_MODE
    if mode == "memory":
        return _QdrantClient(":memory:")
    if mode == "cloud":
        return _QdrantClient(url=settings.QDRANT_CLOUD_URL, api_key=settings.QDRANT_API_KEY)
    return _QdrantClient(url=settings.QDRANT_URL)


_client: _QdrantClient | None = None


def get_client() -> _QdrantClient:
    global _client
    if _client is None:
        _client = _build_client()
        _ensure_collection(_client)
    return _client


def _ensure_collection(client: _QdrantClient) -> None:
    existing = [c.name for c in client.get_collections().collections]
    if settings.QDRANT_COLLECTION not in existing:
        client.create_collection(
            collection_name=settings.QDRANT_COLLECTION,
            vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
        )


def upsert_chunks(chunks: list[dict], vectors: list[list[float]]) -> int:
    client = get_client()
    points = [
        PointStruct(
            id=str(uuid.uuid4()),
            vector=vec,
            payload={"text": chunk["text"], **chunk["metadata"]},
        )
        for chunk, vec in zip(chunks, vectors)
    ]
    client.upsert(collection_name=settings.QDRANT_COLLECTION, points=points)
    return len(points)


def search(
    query_vector: list[float],
    top_k: int = 5,
    source_filter: list[str] | None = None,
) -> list[dict]:
    client = get_client()

    qfilter = None
    if source_filter:
        qfilter = Filter(
            must=[FieldCondition(key="source", match=MatchAny(any=source_filter))]
        )

    results = client.search(
        collection_name=settings.QDRANT_COLLECTION,
        query_vector=query_vector,
        limit=top_k,
        with_payload=True,
        query_filter=qfilter,
    )
    return [
        {
            "text": r.payload.get("text", ""),
            "score": r.score,
            "metadata": {k: v for k, v in r.payload.items() if k != "text"},
        }
        for r in results
    ]


def list_sources() -> list[dict]:
    """Return all unique sources stored in the collection."""
    client = get_client()
    seen: dict[str, dict] = {}
    offset = None

    while True:
        results, next_offset = client.scroll(
            collection_name=settings.QDRANT_COLLECTION,
            limit=500,
            offset=offset,
            with_payload=True,
            with_vectors=False,
        )
        for point in results:
            name = point.payload.get("source")
            if not name or name in seen:
                if name:
                    seen[name]["count"] += 1
                continue
            seen[name] = {
                "name":        name,
                "source_type": point.payload.get("source_type", "unknown"),
                "url":         point.payload.get("url"),
                "count":       1,
            }
        if next_offset is None:
            break
        offset = next_offset

    return list(seen.values())


def get_chunks_by_source(source_name: str) -> list[dict]:
    """Return all text chunks for a given source name."""
    client = get_client()
    results, _ = client.scroll(
        collection_name=settings.QDRANT_COLLECTION,
        scroll_filter=Filter(
            must=[FieldCondition(key="source", match=MatchValue(value=source_name))]
        ),
        limit=200,
        with_payload=True,
        with_vectors=False,
    )
    chunks = [
        {
            "text": p.payload.get("text", ""),
            "page": p.payload.get("page"),
            "chunk": p.payload.get("chunk", 0),
        }
        for p in results
    ]
    return sorted(chunks, key=lambda c: (c["page"] or 0, c["chunk"]))
