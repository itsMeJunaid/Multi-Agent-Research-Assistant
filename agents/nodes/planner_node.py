"""
Planner node — Specialist: Qwen (fast, structured JSON output)

Analyzes the user query with chain-of-thought reasoning and returns a
machine-readable JSON plan. Keyword heuristics act as fallback.
"""
import json
import re
from typing import TypedDict

from agents.llm_client import chat_json
from backend.app.core.config import settings

_WEB_RE = re.compile(
    r"\b(latest|recent|new|current|today|now|news|update|trend|trending"
    r"breaking|announcement|release|2024|2025|2026)\b",
    re.IGNORECASE,
)
_URL_RE = re.compile(r"https?://\S+")

_SYSTEM = """\
You are a research planning AI. Think step-by-step before producing a plan.

Step 1 — Intent analysis: What exactly is the user asking? Is this factual, analytical, or opinion-based?
Step 2 — Temporal check: Does the query require live / current / real-time data (news, prices, today's events)?
Step 3 — URL check: Are there explicit HTTP/HTTPS links in the query that must be fetched?
Step 4 — Output: Produce the JSON plan.

Return ONLY valid JSON — no prose, no markdown fences:
{
  "needs_rag":       true,
  "needs_web":       false,
  "urls":            [],
  "reasoning_hint":  "one-sentence explanation of the chosen strategy"
}

Rules:
- needs_rag:      ALWAYS true — local documents are always searched first
- needs_web:      true ONLY for live/current/recent information, breaking news, or today's data
- urls:           any full URLs explicitly written in the query (not inferred)
- reasoning_hint: concise explanation for this specific query
"""


# ── Shared state schema ──────────────────────────────────────────────────────
class AgentState(TypedDict):
    query:          str
    plan:           str          # JSON string produced by this node
    rag_context:    str
    web_context:    str
    merged_context: str          # "reasoning" would collide with a LangGraph node name
    answer:         str
    sources:        list[dict]
    source_filter:  list[str]    # restrict RAG to these source names (empty = all)
    rag_sources:    list[dict]   # per-chunk RAG sources indexed to [1],[2]… citations
    node_outputs:   dict         # transparency: {node_name: summary_text}


# ── Node ─────────────────────────────────────────────────────────────────────
async def planner_node(state: AgentState) -> AgentState:
    query = state["query"]

    default_web  = bool(_WEB_RE.search(query))
    default_urls = _URL_RE.findall(query)

    plan = await chat_json(
        model=settings.PLANNER_MODEL,
        messages=[
            {"role": "system", "content": _SYSTEM},
            {"role": "user",   "content": f"Query: {query}"},
        ],
        fallback={
            "needs_rag":      True,
            "needs_web":      default_web,
            "urls":           default_urls,
            "reasoning_hint": "Keyword-based fallback plan",
        },
        temperature=0.1,
        max_tokens=256,
    )

    plan.setdefault("needs_rag",      True)
    plan.setdefault("needs_web",      default_web)
    plan.setdefault("urls",           default_urls)
    plan.setdefault("reasoning_hint", "")

    state["plan"]         = json.dumps(plan)
    state["rag_sources"]  = []
    state["node_outputs"] = state.get("node_outputs") or {}
    state["node_outputs"]["planner"] = plan.get("reasoning_hint", "")
    return state
