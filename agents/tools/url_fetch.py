from langchain.tools import tool
from rag.ingestion.url_loader import load_url
from rag.ingestion.chunking import chunk_documents


@tool
async def url_fetch(url: str) -> str:
    """Fetch and read the content of a specific URL for research."""
    try:
        docs = await load_url(url)
        if not docs:
            return f"Could not extract content from {url}"
        chunks = chunk_documents(docs)
        text = "\n\n".join(c["text"] for c in chunks[:8])
        return f"Content from {url}:\n\n{text}"
    except Exception as e:
        return f"Failed to fetch {url}: {str(e)}"
