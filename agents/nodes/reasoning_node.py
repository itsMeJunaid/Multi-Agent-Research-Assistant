"""
Reasoning node — Chain-of-Thought synthesis with strict hallucination control.

Merges RAG chunks and web results into a structured context block.
Each fact is labelled by source so the generator can produce traceable citations.
"""
from agents.nodes.planner_node import AgentState
from agents.llm_client import chat, strip_think_tags
from backend.app.core.config import settings

_NO_RAG          = "No relevant documents found in the knowledge base."
_NO_WEB_PREFIXES = ("No web results", "Web search failed", "No web search API", "Failed to fetch")

_SYSTEM = """\
You are a rigorous research synthesizer. Your task: merge raw retrieval results
into a dense, factual context block that a generator model will use to answer a question.

CHAIN-OF-THOUGHT PROCESS (follow these steps internally):
Step 1 — Source inventory: List what each source says about the question.
Step 2 — Fact extraction: Extract only explicitly stated facts, figures, and findings.
Step 3 — Contradiction check: Note any conflicts between sources.
Step 4 — Gap identification: Note what is NOT addressed by the sources.
Step 5 — Synthesis: Write the final context block.

STRICT HALLUCINATION CONTROL — these rules are absolute:
• Include ONLY information explicitly present in the provided sources
• Never infer, extrapolate, or add outside knowledge
• If sources conflict, write: "Sources disagree: [source A says X, source B says Y]"
• If something is not covered, write: "Not addressed in available sources"
• Label every fact with its source: [DOC-N] for document chunk N, [WEB] for web results

OUTPUT FORMAT (≤ 700 words, no preamble, no sign-off):
Start directly with the synthesized content.
Use [DOC-N] and [WEB] labels inline.
End with a "SOURCE GAPS:" line listing what the sources do NOT cover.
"""


async def reasoning_node(state: AgentState) -> AgentState:
    query       = state["query"]
    rag         = state.get("rag_context", "")
    web         = state.get("web_context", "")
    rag_sources = state.get("rag_sources", [])

    sections: list[str] = []
    web_source_entries:  list[dict] = []

    # ── Collect context sections ─────────────────────────────
    if rag and rag != _NO_RAG:
        sections.append(f"[DOCUMENT SOURCES — numbered as [1],[2]… for citation]\n{rag}")

    if web and not any(web.startswith(p) for p in _NO_WEB_PREFIXES):
        sections.append(f"[WEB / URL SOURCES — label as [WEB]]\n{web}")
        for line in web.splitlines():
            stripped = line.strip()
            if stripped.startswith("http"):
                web_source_entries.append({
                    "source_type": "web",
                    "title":       stripped,
                    "snippet":     "",
                    "url":         stripped,
                    "page":        None,
                })
        if not web_source_entries:
            web_source_entries.append({
                "source_type": "web",
                "title":       "Web Search",
                "snippet":     web[:300],
                "url":         None,
                "page":        None,
            })

    # ── No context — short-circuit ───────────────────────────
    if not sections:
        state["merged_context"] = (
            "No context was retrieved from any source. "
            "The answer will be based on general knowledge only. "
            "Clearly mark any such information as [GENERAL KNOWLEDGE]."
        )
        state["sources"]     = []
        state["rag_sources"] = []

        node_outputs = state.get("node_outputs") or {}
        node_outputs["reasoning_step"] = "No sources retrieved — bypassing synthesis."
        state["node_outputs"] = node_outputs
        return state

    combined = "\n\n".join(sections)

    # ── CoT synthesis ────────────────────────────────────────
    try:
        raw = await chat(
            model=settings.REASONER_MODEL,
            messages=[
                {"role": "system", "content": _SYSTEM},
                {"role": "user",   "content": (
                    f"Research question: {query}\n\n"
                    f"Raw sources:\n\n{combined}"
                )},
            ],
            temperature=0.2,   # lower temp = more factual
            max_tokens=2048,
            timeout=180,
        )
        synthesis = strip_think_tags(raw)
        state["merged_context"] = synthesis if synthesis.strip() else combined
    except Exception:
        state["merged_context"] = combined

    # ── Build final sources list: RAG chunks first, then web ─
    all_sources = list(rag_sources)          # [1], [2], … already indexed
    all_sources.extend(web_source_entries)
    state["sources"] = all_sources

    node_outputs = state.get("node_outputs") or {}
    synthesis_preview = state["merged_context"][:200].replace("\n", " ").strip()
    node_outputs["reasoning_step"] = synthesis_preview + ("…" if len(state["merged_context"]) > 200 else "")
    state["node_outputs"] = node_outputs
    return state
