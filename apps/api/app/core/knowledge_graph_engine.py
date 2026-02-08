"""
Knowledge Graph Engine - NetworkX-based incident relationship analysis.

Ported from aegis/knowledge-graph/knowledge_graph.py.
Provides concept extraction, relationship building, community detection,
and Cytoscape-format JSON export for frontend visualization.
"""

import re
from collections import defaultdict
from typing import Dict, List, Tuple, Any
import networkx as nx
import logging

logger = logging.getLogger(__name__)


class KnowledgeGraphEngine:
    """Knowledge graph generator for Aegis incident data."""

    # Concept patterns for manufacturing/industrial domain
    CONCEPT_PATTERNS = {
        "cnc_mill": r"\bcnc\s*mill|\bhaas\s*vf|\bmachining\s*center\b",
        "cnc_lathe": r"\bcnc\s*lathe|\bmazak\s*qt|\bokuma\s*lb\b",
        "spindle": r"\bspindle|\bspindle\s*motor\b",
        "coolant_system": r"\bcoolant|\bcoolant\s*pump|\bcoolant\s*flow\b",
        "bearing": r"\bbearing|\bball\s*bearing|\broller\s*bearing\b",
        "hepa_filter": r"\bhepa|\bfilter|\bffu|\bfan\s*filter\b",
        "wire_bonder": r"\bwire\s*bond|\bbonder|\bk&s\b",
        "capillary": r"\bcapillary|\bbonding\s*capillary\b",
        "thermal_runaway": r"\bthermal\s*runaway|\boverheat|\btemp\s*rise\b",
        "bearing_failure": r"\bbearing\s*failure|\bbearing\s*wear|\bbearing\s*defect\b",
        "coolant_leak": r"\bcoolant\s*leak|\bcoolant\s*failure|\bpump\s*failure\b",
        "chatter": r"\bchatter|\bvibration|\bregenerative\s*vibration\b",
        "tool_wear": r"\btool\s*wear|\bcutting\s*tool|\btool\s*life\b",
        "nsop": r"\bnsop|\bnon.stick|\bbond\s*failure\b",
        "contamination": r"\bcontamination|\bparticle|\biso\s*class\b",
        "filter_clog": r"\bfilter\s*clog|\bpressure\s*drop|\bhepa\s*end\s*of\s*life\b",
        "motor": r"\bmotor|\bdrive\s*motor\b",
        "pump": r"\bpump|\bcoolant\s*pump\b",
        "sensor": r"\bsensor|\btemperature\s*sensor|\bvibration\s*sensor\b",
        "controller": r"\bcontroller|\bplc|\bcnc\s*controller\b",
        "emergency_stop": r"\bemergency\s*stop|\be.stop|\bstop\s*machine\b",
        "feed_hold": r"\bfeed\s*hold|\bpause|\bhold\b",
        "speed_reduction": r"\bspeed\s*reduction|\brpm\s*reduction|\bslow\s*down\b",
        "maintenance": r"\bmaintenance|\brepair|\bservice\b",
        "tool_change": r"\btool\s*change|\breplace\s*tool\b",
    }

    COMPONENT_KEYWORDS = {
        "spindle", "bearing", "coolant_system", "motor", "pump",
        "sensor", "controller", "hepa_filter", "capillary",
    }

    FAILURE_KEYWORDS = {
        "thermal_runaway", "bearing_failure", "coolant_leak", "chatter",
        "tool_wear", "nsop", "contamination", "filter_clog",
    }

    ACTION_KEYWORDS = {
        "emergency_stop", "feed_hold", "speed_reduction", "maintenance", "tool_change",
    }

    NODE_COLORS = {
        "machine": "#00F0FF",
        "failure_type": "#FF2E2E",
        "component": "#FFB020",
        "action": "#00FF94",
        "severity": "#9CA3AF",
        "concept": "#3B82F6",
    }

    def __init__(self):
        self.graph = nx.Graph()
        self.concepts = set()
        self.edges = defaultdict(list)

    def reset(self):
        self.graph = nx.Graph()
        self.concepts = set()
        self.edges = defaultdict(list)

    def extract_concepts(self, text: str) -> List[str]:
        text = text.lower()
        found = []
        for concept, pattern in self.CONCEPT_PATTERNS.items():
            if re.search(pattern, text, re.IGNORECASE):
                found.append(concept)
        return found

    def extract_relationships(self, incident: Dict[str, Any]) -> List[Tuple[str, str, str]]:
        triples = []
        machine_id = incident.get("machine_id", "UNKNOWN")
        incident_type = incident.get("incident_type", incident.get("type", "unknown"))
        description = incident.get("message", "")
        action = incident.get("action_taken", incident.get("action", "unknown"))
        severity = incident.get("severity", "low")

        triples.append((machine_id, "has_issue", incident_type))

        concepts = self.extract_concepts(description)
        for concept in concepts:
            if concept in self.COMPONENT_KEYWORDS:
                triples.append((machine_id, "involves", concept))
                triples.append((incident_type, "affects", concept))

        if action and action != "unknown":
            triples.append((action, "resolves", incident_type))

        triples.append((severity, "classifies", incident_type))
        return triples

    def _get_node_type(self, node: str) -> str:
        if any(node.startswith(p) for p in ("CNC-", "FAC-", "BOND-", "LITHO-", "ETCH-", "DEP-", "INSP-", "CLEAN-")):
            return "machine"
        if node in ("critical", "high", "medium", "low"):
            return "severity"
        if node in self.FAILURE_KEYWORDS:
            return "failure_type"
        if node in self.COMPONENT_KEYWORDS:
            return "component"
        if node in self.ACTION_KEYWORDS:
            return "action"
        return "concept"

    def add_incident(self, incident: Dict[str, Any]) -> None:
        triples = self.extract_relationships(incident)
        for source, relation, target in triples:
            self.graph.add_node(source, type=self._get_node_type(source))
            self.graph.add_node(target, type=self._get_node_type(target))
            self.graph.add_edge(source, target, relation=relation, weight=1)
            self.concepts.add(source)
            self.concepts.add(target)
            self.edges[(source, target)].append(relation)

    def build_from_incidents(self, incidents: List[Dict[str, Any]]) -> None:
        self.reset()
        for incident in incidents:
            self.add_incident(incident)
        # Aggregate edge weights
        for u, v, data in self.graph.edges(data=True):
            edge_key = (u, v)
            if edge_key in self.edges:
                data["weight"] = len(self.edges[edge_key])
                data["relations"] = list(set(self.edges[edge_key]))

    def get_central_concepts(self, top_n: int = 10) -> List[Tuple[str, float]]:
        if len(self.graph.nodes()) == 0:
            return []
        centrality = nx.degree_centrality(self.graph)
        return sorted(centrality.items(), key=lambda x: x[1], reverse=True)[:top_n]

    def get_communities(self) -> Dict[int, List[str]]:
        if len(self.graph.nodes()) == 0:
            return {}
        try:
            communities = nx.community.greedy_modularity_communities(self.graph)
            return {i: list(c) for i, c in enumerate(communities)}
        except Exception:
            return {}

    def find_related_concepts(self, concept: str, depth: int = 2) -> List[str]:
        if concept not in self.graph:
            return []
        related = set()
        current_level = {concept}
        for _ in range(depth):
            next_level = set()
            for node in current_level:
                next_level.update(self.graph.neighbors(node))
            related.update(next_level)
            current_level = next_level
        related.discard(concept)
        return list(related)

    def to_cytoscape_json(self) -> Dict[str, Any]:
        nodes = []
        edges = []
        for node, data in self.graph.nodes(data=True):
            node_type = data.get("type", "concept")
            nodes.append({
                "data": {
                    "id": node,
                    "label": node.replace("_", " ").title(),
                    "type": node_type,
                    "color": self.NODE_COLORS.get(node_type, "#3B82F6"),
                }
            })
        for u, v, data in self.graph.edges(data=True):
            edges.append({
                "data": {
                    "id": f"{u}-{v}",
                    "source": u,
                    "target": v,
                    "label": data.get("relation", "relates_to"),
                    "weight": data.get("weight", 1),
                }
            })
        return {
            "nodes": nodes,
            "edges": edges,
            "stats": {
                "node_count": len(nodes),
                "edge_count": len(edges),
                "central_concepts": self.get_central_concepts(5),
            },
        }


# Singleton
kg_engine = KnowledgeGraphEngine()
