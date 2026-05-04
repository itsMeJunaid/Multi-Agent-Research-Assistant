"""
Generator node — Specialist: Llama-3.3 70B (best answer quality)

Receives the synthesised context from DeepSeek-R1 and produces the
final, well-cited answer for the user. Falls back to FALLBACK_MODEL
on rate-limit or model errors.
"""
import httpx

from agents.nodes.planner_node import AgentState
from agents.llm_client import chat
from backend.app.core.config import settings

_MAX_CONTEXT_CHARS = 12_000

_SYSTEM = """\
You are an expert AI research assistant with strict factual grounding.

═══ ABSOLUTE HALLUCINATION-PREVENTION RULES ═══
1. Base EVERY factual claim on the provided context. Do NOT add outside knowledge silently.
2. Cite every fact inline as [1], [2], [3]… matching the numbered sources in the context.
3. If the context does not cover part of the question, write:
   "⚠ The available sources do not address [topic]. The following is general knowledge: …"
4. NEVER fabricate citations — only use [N] numbers that appear in the context.
5. If sources conflict, acknowledge it: "Source [1] states X, while source [2] states Y."
6. Hedging is required when evidence is weak: use "according to [1]", "source [2] suggests", not "it is known that".
7. Do not speculate, predict, or extrapolate beyond what sources explicitly state.

═══ CHAIN-OF-THOUGHT BEFORE ANSWERING ═══
Internally (not shown to user):
• Which sources are most relevant to each part of the question?
• What does the evidence directly support vs. require inference?
• Are there information gaps that must be disclosed?

═══ OUTPUT FORMATTING ═══
- Cite every claim: [1], [2], [3]…
- **Bold** key terms and findings
- ## Headings for multi-section answers
- Keep answers complete but concise — no padding, no repetition
- End with a "**Sources**" summary line if multiple sources were used
"""


async def generator_node(state: AgentState) -> AgentState:
    context = state.get("merged_context", "")[:_MAX_CONTEXT_CHARS]
    prompt  = (
        f"Context:\n{context}\n\n"
        f"Question: {state['query']}\n\n"
        "Answer (with inline citations):"
    )
    messages = [
        {"role": "system", "content": _SYSTEM},
        {"role": "user",   "content": prompt},
    ]

    # ── Primary: Generator specialist model ──────────────────
    try:
        answer = await chat(
            model=settings.GENERATOR_MODEL,
            messages=messages,
            temperature=0.4,
            max_tokens=2048,
        )
        state["answer"] = answer
        return state
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code not in {429, 503}:
            state["answer"] = _http_error_msg(exc.response.status_code)
            return state
        # Fall through to fallback on rate-limit / service unavailable
    except Exception:
        pass  # Network error — try fallback

    # ── Fallback: smaller, faster model ──────────────────────
    try:
        answer = await chat(
            model=settings.FALLBACK_MODEL,
            messages=messages,
            temperature=0.4,
            max_tokens=2048,
        )
        state["answer"] = f"*(answered via fallback model)*\n\n{answer}"
        return state
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code in {429, 503}:
            state["answer"] = (
                "All AI models are currently rate-limited (free tier quota exhausted). "
                "Please wait 30-60 seconds and try again."
            )
        else:
            state["answer"] = _http_error_msg(exc.response.status_code)
    except Exception as exc:
        state["answer"] = _generic_error_msg(exc)

    return state


# ── Helpers ───────────────────────────────────────────────────────────────────
def _http_error_msg(code: int) -> str:
    if code == 429:
        return (
            "The AI provider is rate-limiting requests (HTTP 429). "
            "Please wait a moment and try again, or check your OpenRouter free-tier quota."
        )
    if code == 400:
        return (
            "Bad request to AI provider (HTTP 400). "
            "Check that GENERATOR_MODEL is a valid OpenRouter model name."
        )
    return f"LLM request failed (HTTP {code})."


def _generic_error_msg(exc: Exception) -> str:
    return f"Generation failed ({type(exc).__name__}): {exc}"
