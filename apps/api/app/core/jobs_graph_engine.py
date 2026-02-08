"""
Jobs Knowledge Graph Engine - NetworkX-based job relationship analysis.

Visualizes relationships between jobs, machines, customers, recipes,
and other production entities in the fab.
"""

from typing import Dict, List, Any, Tuple
import networkx as nx
import logging

logger = logging.getLogger(__name__)


class JobsGraphEngine:
    """Knowledge graph generator for production jobs data."""

    NODE_COLORS = {
        "job": "#3B82F6",           # Blue
        "job_hot": "#F43F5E",       # Rose (hot lot)
        "machine": "#00F0FF",        # Cyan
        "customer": "#8B5CF6",       # Purple
        "recipe": "#10B981",         # Emerald
        "status": "#F59E0B",         # Amber
        "priority": "#EF4444",       # Red
        "zone": "#6B7280",           # Gray
    }

    STATUS_COLORS = {
        "PENDING": "#F59E0B",
        "QUEUED": "#3B82F6",
        "RUNNING": "#10B981",
        "COMPLETED": "#6B7280",
        "FAILED": "#EF4444",
        "CANCELLED": "#9CA3AF",
    }

    PRIORITY_COLORS = {
        1: "#EF4444",  # Critical - Red
        2: "#F97316",  # High - Orange
        3: "#F59E0B",  # Medium - Amber
        4: "#3B82F6",  # Standard - Blue
        5: "#6B7280",  # Low - Gray
    }

    def __init__(self):
        self.graph = nx.Graph()
        self.edges = []

    def reset(self):
        self.graph = nx.Graph()
        self.edges = []

    def _get_job_node_color(self, job: Dict[str, Any]) -> str:
        """Get color based on job properties."""
        if job.get("is_hot_lot"):
            return self.NODE_COLORS["job_hot"]
        return self.NODE_COLORS["job"]

    def _get_node_type(self, node_id: str) -> str:
        """Determine node type from ID prefix or content."""
        if node_id.startswith("JOB-"):
            return "job"
        if node_id.startswith(("LITHO-", "ETCH-", "DEP-", "INSP-", "CLEAN-")):
            return "machine"
        if node_id.startswith("CUST-"):
            return "customer"
        if node_id.startswith("RECIPE-"):
            return "recipe"
        if node_id.startswith("STATUS-"):
            return "status"
        if node_id.startswith("PRIORITY-"):
            return "priority"
        if node_id.startswith("ZONE-"):
            return "zone"
        return "job"

    def build_from_jobs(
        self,
        jobs: List[Dict[str, Any]],
        machines: List[Dict[str, Any]] = None
    ) -> None:
        """Build knowledge graph from jobs and optional machine data."""
        self.reset()
        
        # Create machine lookup
        machine_map = {}
        if machines:
            machine_map = {m["machine_id"]: m for m in machines}

        for job in jobs:
            job_id = job.get("job_id", f"JOB-{id(job)}")
            job_name = job.get("job_name", "Unknown Job")
            is_hot_lot = job.get("is_hot_lot", False)
            
            # Add job node
            self.graph.add_node(
                job_id,
                type="job_hot" if is_hot_lot else "job",
                label=job_name,
                color=self._get_job_node_color(job),
                data=job
            )

            # Job -> Status relationship
            status = job.get("status", "PENDING")
            status_node = f"STATUS-{status}"
            if status_node not in self.graph:
                self.graph.add_node(
                    status_node,
                    type="status",
                    label=status.title(),
                    color=self.STATUS_COLORS.get(status, "#6B7280")
                )
            self.graph.add_edge(job_id, status_node, relation="has_status", weight=1)

            # Job -> Priority relationship
            priority = job.get("priority_level", 3)
            priority_node = f"PRIORITY-P{priority}"
            if priority_node not in self.graph:
                self.graph.add_node(
                    priority_node,
                    type="priority",
                    label=f"P{priority}",
                    color=self.PRIORITY_COLORS.get(priority, "#6B7280")
                )
            self.graph.add_edge(job_id, priority_node, relation="has_priority", weight=1)

            # Job -> Customer relationship
            customer = job.get("customer_tag")
            if customer:
                customer_node = f"CUST-{customer.upper()}"
                if customer_node not in self.graph:
                    self.graph.add_node(
                        customer_node,
                        type="customer",
                        label=customer,
                        color=self.NODE_COLORS["customer"]
                    )
                self.graph.add_edge(job_id, customer_node, relation="for_customer", weight=2)

            # Job -> Recipe relationship
            recipe = job.get("recipe_type")
            if recipe:
                recipe_node = f"RECIPE-{recipe}"
                if recipe_node not in self.graph:
                    self.graph.add_node(
                        recipe_node,
                        type="recipe",
                        label=recipe.replace("_", " ").title(),
                        color=self.NODE_COLORS["recipe"]
                    )
                self.graph.add_edge(job_id, recipe_node, relation="uses_recipe", weight=1)

            # Job -> Machine relationship
            machine_id = job.get("assigned_machine_id")
            if machine_id and machine_id in machine_map:
                machine = machine_map[machine_id]
                machine_name = machine.get("name", machine_id)
                
                if machine_id not in self.graph:
                    self.graph.add_node(
                        machine_id,
                        type="machine",
                        label=machine_name,
                        color=self.NODE_COLORS["machine"]
                    )
                
                edge_weight = 3 if status == "RUNNING" else 2 if status == "QUEUED" else 1
                self.graph.add_edge(
                    job_id, machine_id,
                    relation="assigned_to",
                    weight=edge_weight
                )

                # Machine -> Zone relationship
                zone = machine.get("location_zone")
                if zone:
                    zone_node = f"ZONE-{zone}"
                    if zone_node not in self.graph:
                        self.graph.add_node(
                            zone_node,
                            type="zone",
                            label=f"Zone {zone}",
                            color=self.NODE_COLORS["zone"]
                        )
                    self.graph.add_edge(machine_id, zone_node, relation="located_in", weight=1)

            # Hot lot connections - connect hot lots to each other
            if is_hot_lot:
                for other_job in jobs:
                    if (other_job.get("job_id") != job_id and 
                        other_job.get("is_hot_lot") and
                        other_job.get("customer_tag") == customer):
                        other_id = other_job.get("job_id", f"JOB-{id(other_job)}")
                        self.graph.add_edge(
                            job_id, other_id,
                            relation="same_customer_hot_lot",
                            weight=1
                        )

    def get_central_concepts(self, top_n: int = 10) -> List[Tuple[str, float]]:
        """Get most central nodes by degree centrality."""
        if len(self.graph.nodes()) == 0:
            return []
        centrality = nx.degree_centrality(self.graph)
        return sorted(centrality.items(), key=lambda x: x[1], reverse=True)[:top_n]

    def get_job_clusters(self) -> Dict[str, List[str]]:
        """Get job clusters by status."""
        clusters = {}
        for node, data in self.graph.nodes(data=True):
            if data.get("type") in ("job", "job_hot"):
                status = None
                for neighbor in self.graph.neighbors(node):
                    neighbor_data = self.graph.nodes[neighbor]
                    if neighbor_data.get("type") == "status":
                        status = neighbor_data.get("label", "Unknown")
                        break
                
                if status:
                    if status not in clusters:
                        clusters[status] = []
                    clusters[status].append(node)
        return clusters

    def get_customer_workload(self) -> Dict[str, int]:
        """Get workload distribution by customer."""
        workload = {}
        for node, data in self.graph.nodes(data=True):
            if data.get("type") == "customer":
                count = len(list(self.graph.neighbors(node)))
                workload[data.get("label", node)] = count
        return workload

    def to_cytoscape_json(self) -> Dict[str, Any]:
        """Export graph to Cytoscape-compatible JSON."""
        nodes = []
        edges = []
        
        for node, data in self.graph.nodes(data=True):
            node_type = data.get("type", "job")
            label = data.get("label", node)
            
            nodes.append({
                "data": {
                    "id": node,
                    "label": label,
                    "type": node_type,
                    "color": data.get("color", "#3B82F6"),
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
                "job_clusters": self.get_job_clusters(),
                "customer_workload": self.get_customer_workload(),
            },
        }


# Singleton
jobs_graph_engine = JobsGraphEngine()
