from langchain.tools import tool
from rag.pipeline.rag_pipeline import retrieve, format_context


@tool
async def rag_tool(query: str) -> str:
    """Search the local document store (PDFs and ingested URLs) for relevant information."""
    results = await retrieve(query, top_k=5)
    if not results:
        return "No relevant documents found in the knowledge base."
    return format_context(results)
