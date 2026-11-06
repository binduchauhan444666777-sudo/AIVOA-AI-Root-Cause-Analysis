from typing import Any, TypedDict

from langgraph.graph import END, START, StateGraph

from .ai_service import analyze_incident, extract_incident


class RCAState(TypedDict):
    source_text: str
    incident: dict
    method: str
    analysis: dict


def extract_node(state: RCAState) -> dict[str, Any]:
    incident = state.get("incident") or extract_incident(state["source_text"])
    return {"incident": incident}


def analyze_node(state: RCAState) -> dict[str, Any]:
    analysis = analyze_incident(state["incident"], state["method"])
    analysis["method"] = state["method"]
    return {"analysis": analysis}


def build_rca_workflow():
    workflow = StateGraph(RCAState)
    workflow.add_node("extract", extract_node)
    workflow.add_node("analyze", analyze_node)
    workflow.add_edge(START, "extract")
    workflow.add_edge("extract", "analyze")
    workflow.add_edge("analyze", END)
    return workflow.compile()
