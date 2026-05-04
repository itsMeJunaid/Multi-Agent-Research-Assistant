"""
Researcher node — Specialist: Nemotron (tool-calling, query optimization)

Two-phase approach:
  1. Ask Nemotron to reformulate the query into optimised RAG and web
     search strings — dramatically improves retrieval quality.
  2. Execute the actual tools (RAG, URL fetch, web search) with refined
     queries. Each RAG chunk is stored as a numbered source so citations
     [1], [2] … in the final answer can be traced back to exact passages.
"""
import json

from agents.nodes.planner_node import AgentState
from agents.llm_client import chat_json
from agents.tools.web_search import web_search
from agents.tools.url_fetch import url_fetch
from rag.pipeline.rag_pipeline import retrieve, format_context
from backend.app.core.config import settings

_SYSTEM = """\
You are a search-query optimizer for an AI research pipeline.

Think step-by-step:
1. What are the core concepts and technical terms in the question?
2. What specific phrases would appear in authoritative documents on this topic?
3. What current/recent aspects need a live web search?

Return ONLY valid JSON — no prose, no markdown:
{
  "rag_query": "precise semantic query optimised for vector similarity search",
  "web_query": "natural-language query for a web search engine"
}

Guidelines:
- rag_query: expand acronyms, use domain-specific terminology, be precise
             (e.g. "transformer attention mechanism self-attention scaled dot-product")
- web_query: natural phrasing + recency signals when relevant
             (e.g. "latest transformer models 2025 benchmarks")
- Evidence-first: optimise to retrieve factual, verifiable passages
"""


async def researcher_node(state: AgentState) -> AgentState:
    query     = state["query"]
    web_parts: list[str] = []

    # ── Parse planner plan ────────────────────────────────────
    try:
        plan = json.loads(state.get("plan", "{}"))
    except (json.JSONDecodeError, TypeError):
        plan = {"needs_rag": True, "needs_web": False, "urls": []}

    needs_rag = plan.get("needs_rag", True)
    needs_web = plan.get("needs_web", False)
    urls      = plan.get("urls", [])

    # ── Phase 1: LLM query optimisation ──────────────────────
    optimised = await chat_json(
        model=settings.RESEARCHER_MODEL,
        messages=[
            {"role": "system", "content": _SYSTEM},
            {"role": "user",   "content": f"Research question: {query}"},
        ],
        fallback={"rag_query": query, "web_query": query},
        temperature=0.2,
        max_tokens=256,
    )

    rag_q = optimised.get("rag_query", query) or query
    web_q = optimised.get("web_query", query) or query

    # ── Phase 2: Tool execution ───────────────────────────────
    source_filter = state.get("source_filter") or []
    rag_sources:   list[dict] = []

    if needs_rag:
        try:
            results = await retrieve(
                rag_q,
                top_k=6,
                source_filter=source_filter if source_filter else None,
            )
            if results:
                state["rag_context"] = format_context(results)
                # Build per-chunk sources — index N-1 maps to citation [N]
                for r in results:
                    meta = r.get("metadata", {})
                    rag_sources.append({
                        "source_type": meta.get("source_type", "pdf"),
                        "title":       meta.get("source", "Document"),
                        "snippet":     r.get("text", "")[:400],
                        "page":        meta.get("page"),
                        "url":         meta.get("url"),
                        "score":       round(r.get("score", 0), 3),
                    })
            else:
                state["rag_context"] = "No relevant documents found in the knowledge base."
        except Exception as exc:
            state["rag_context"] = f"RAG retrieval failed: {exc}"
    else:
        state["rag_context"] = ""

    for url in urls:
        try:
            web_parts.append(await url_fetch.ainvoke(url))
        except Exception as exc:
            web_parts.append(f"Failed to fetch {url}: {exc}")

    if needs_web:
        try:
            web_parts.append(await web_search.ainvoke(web_q))
        except Exception as exc:
            web_parts.append(f"Web search failed: {exc}")

    state["web_context"]  = "\n\n---\n\n".join(web_parts) if web_parts else ""
    state["rag_sources"]  = rag_sources

    node_outputs = state.get("node_outputs") or {}
    node_outputs["researcher"] = (
        f"RAG query: {rag_q[:80]}" +
        (f" | Web query: {web_q[:80]}" if needs_web else "") +
        f" | {len(rag_sources)} chunks retrieved"
    )
    state["node_outputs"] = node_outputs
    return state
