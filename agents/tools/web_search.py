import httpx
from langchain.tools import tool
from backend.app.core.config import settings


@tool
async def web_search(query: str) -> str:
    """Search the web using Tavily or Serper for up-to-date information."""
    if settings.TAVILY_API_KEY:
        return await _tavily_search(query)
    if settings.SERPER_API_KEY:
        return await _serper_search(query)
    return "No web search API key configured. Set TAVILY_API_KEY or SERPER_API_KEY in .env"


async def _tavily_search(query: str) -> str:
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            "https://api.tavily.com/search",
            json={"api_key": settings.TAVILY_API_KEY, "query": query, "max_results": 5},
        )
        resp.raise_for_status()
        data = resp.json()

    results = data.get("results", [])
    if not results:
        return "No web results found."

    parts = []
    for i, r in enumerate(results, 1):
        parts.append(f"[{i}] {r.get('title', '')}\n{r.get('url', '')}\n{r.get('content', '')}")
    return "\n\n".join(parts)


async def _serper_search(query: str) -> str:
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            "https://google.serper.dev/search",
            headers={"X-API-KEY": settings.SERPER_API_KEY},
            json={"q": query, "num": 5},
        )
        resp.raise_for_status()
        data = resp.json()

    parts = []
    for i, r in enumerate(data.get("organic", []), 1):
        parts.append(f"[{i}] {r.get('title', '')}\n{r.get('link', '')}\n{r.get('snippet', '')}")
    return "\n\n".join(parts) if parts else "No results."
