from agents.graph import run_agent
from backend.app.models.schemas import ChatResponse, Source


async def run_chat(message: str) -> ChatResponse:
    """Run the agent pipeline and map the result to the API response schema."""
    result = await run_agent(message)

    sources: list[Source] = []
    for s in result.get("sources", []):
        source_type = s.get("type", "web")
        label = s.get("label", source_type.title())
        url = s.get("url")
        snippet = s.get("snippet") or (
            "Retrieved from local documents" if source_type == "rag"
            else "Retrieved from web search"
        )
        sources.append(Source(title=label, url=url, snippet=snippet, source_type=source_type))

    return ChatResponse(
        answer=result.get("answer", "No answer generated."),
        sources=sources,
    )
