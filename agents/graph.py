"""
LangGraph agent orchestrator.

Flow: planner → researcher → reasoning_step → generator → END

Node name "reasoning_step" (not "reasoning") because LangGraph's StateGraph
reserves every key of the AgentState TypedDict, and AgentState previously had
a "reasoning" field that collided with the node name. The field is now called
"merged_context" and the node is called "reasoning_step".
"""
from langgraph.graph import StateGraph, END

from agents.nodes.planner_node import AgentState, planner_node
from agents.nodes.researcher_node import researcher_node
from agents.nodes.reasoning_node import reasoning_node
from agents.nodes.generator_node import generator_node


def build_graph() -> StateGraph:
    graph = StateGraph(AgentState)

    graph.add_node("planner", planner_node)
    graph.add_node("researcher", researcher_node)
    graph.add_node("reasoning_step", reasoning_node)
    graph.add_node("generator", generator_node)

    graph.set_entry_point("planner")
    graph.add_edge("planner", "researcher")
    graph.add_edge("researcher", "reasoning_step")
    graph.add_edge("reasoning_step", "generator")
    graph.add_edge("generator", END)

    return graph.compile()


agent_graph = build_graph()


async def run_agent(query: str) -> dict:
    """Run the full agent pipeline and return the final state dict."""
    initial_state: AgentState = {
        "query": query,
        "plan": "",
        "rag_context": "",
        "web_context": "",
        "merged_context": "",
        "answer": "",
        "sources": [],
    }
    return await agent_graph.ainvoke(initial_state)
