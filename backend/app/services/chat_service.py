import json
from typing import AsyncIterator

from agents.graph import agent_graph

_NODE_ORDER = {"planner", "researcher", "reasoning_step", "generator"}


async def stream_chat(
    message: str,
    source_filter: list[str] | None = None,
) -> AsyncIterator[str]:
    """
    Stream agent execution as Server-Sent Events.

    Uses LangGraph's astream so each node emits a 'done' event the moment it
    finishes, giving the frontend real per-node progress rather than a single
    batch of status events after the whole pipeline completes.
    """
    initial_state = {
        "query":          message,
        "plan":           "",
        "rag_context":    "",
        "web_context":    "",
        "merged_context": "",
        "answer":         "",
        "sources":        [],
        "source_filter":  source_filter or [],
        "rag_sources":    [],
        "node_outputs":   {},
    }

    # Emit planner as "running" before the first astream chunk arrives
    yield _sse("status", {"node": "planner", "status": "running"})

    try:
        async for chunk in agent_graph.astream(initial_state):
            for node_name, state in chunk.items():
                if node_name not in _NODE_ORDER:
                    continue

                yield _sse("status", {"node": node_name, "status": "done"})

                # Emit transparency: what this node produced
                node_outputs = state.get("node_outputs") or {}
                if node_name in node_outputs:
                    yield _sse("node_output", {
                        "node":   node_name,
                        "detail": node_outputs[node_name],
                    })

                # Emit plan details after planner
                if node_name == "planner" and state.get("plan"):
                    try:
                        import json
                        plan = json.loads(state["plan"])
                        yield _sse("node_output", {
                            "node":   "planner",
                            "detail": plan.get("reasoning_hint", ""),
                            "plan":   plan,
                        })
                    except Exception:
                        pass

                # Emit reasoning synthesis preview after reasoning step
                if node_name == "reasoning_step":
                    synthesis = state.get("merged_context", "")
                    yield _sse("node_output", {
                        "node":    "reasoning_step",
                        "detail":  synthesis[:300] + ("…" if len(synthesis) > 300 else ""),
                        "full":    synthesis,
                    })

                # Emit answer when generator finishes
                if node_name == "generator":
                    yield _sse("answer", {
                        "text":    state.get("answer", ""),
                        "sources": state.get("sources", []),
                    })
    except Exception as exc:
        yield _sse("answer", {
            "text": f"Agent pipeline error: {exc}",
            "sources": [],
        })

    yield _sse("done", {})


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"
