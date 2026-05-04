from rag.embeddings.embedder import embed_query
from rag.vectorstore.qdrant_client import search


async def retrieve(
    query: str,
    top_k: int = 5,
    source_filter: list[str] | None = None,
) -> list[dict]:
    """Embed query and retrieve top-k relevant chunks, optionally filtered by source."""
    query_vector = embed_query(query)
    results = search(query_vector, top_k=top_k, source_filter=source_filter or None)
    return results


def format_context(results: list[dict]) -> str:
    """Format retrieved chunks into a numbered context string."""
    parts = []
    for i, r in enumerate(results, 1):
        source = r["metadata"].get("source", "unknown")
        parts.append(f"[{i}] Source: {source}\n{r['text']}")
    return "\n\n".join(parts)
