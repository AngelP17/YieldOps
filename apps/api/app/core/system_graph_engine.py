"""
System Knowledge Graph Engine - NetworkX-based system topology analysis.

Visualizes the overall fab system relationships including machines, zones,
jobs, and operational status for the Overview tab.
"""

from typing import Dict, List, Any, Tuple
import networkx as nx
import logging

logger = logging.getLogger(__name__)


class SystemGraphEngine:
    """Knowledge graph generator for system-wide fab topology."""

    NODE_COLORS = {
        "machine_running": "#10B981",    # Emerald
        "machine_idle": "#F59E0B",       # Amber
        "machine_down": "#EF4444",       # Red
        "machine_maintenance": "#6B7280", # Gray
        "zone": "#3B82F6",               # Blue
        "machine_type": "#8B5CF6",       # Purple
        "job_running": "#00F0FF",        # Cyan
        "job_queued": "#F97316",         # Orange
        "job_pending": "#FBBF24",        # Yellow
        "efficiency_high": "#10B981",    # Emerald (>80%)
        "efficiency_medium": "#F59E0B",  # Amber (50-80%)
        "efficiency_low": "#EF4444",     # Red (<50%)
    }

    MACHINE_TYPE_COLORS = {
        "lithography": "#8B5CF6",  # Purple
        "etching": "#EF4444",      # Red
        "deposition": "#10B981",   # Emerald
        "inspection": "#3B82F6",   # Blue
        "cleaning": "#06B6D4",     # Cyan
    }

    def __init__(self):
        self.graph = nx.Graph()
        self.edges = []

    def reset(self):
        self.graph = nx.Graph()
        self.edges = []

    def _get_machine_color(self, machine: Dict[str, Any]) -> Tuple[str, str]:
        """Get node color and type based on machine status."""
        status = machine.get("status", "IDLE")
        efficiency = machine.get("efficiency_rating", 0.8)
        
        if status == "RUNNING":
            return self.NODE_COLORS["machine_running"], "machine_running"
        elif status == "DOWN":
            return self.NODE_COLORS["machine_down"], "machine_down"
        elif status == "MAINTENANCE":
            return self.NODE_COLORS["machine_maintenance"], "machine_maintenance"
        else:  # IDLE
            return self.NODE_COLORS["machine_idle"], "machine_idle"

    def _get_efficiency_node(self, efficiency: float) -> Tuple[str, str]:
        """Get efficiency category node."""
        if efficiency >= 0.8:
            return "EFFICIENCY-HIGH", self.NODE_COLORS["efficiency_high"]
        elif efficiency >= 0.5:
            return "EFFICIENCY-MEDIUM", self.NODE_COLORS["efficiency_medium"]
        else:
            return "EFFICIENCY-LOW", self.NODE_COLORS["efficiency_low"]

    def build_from_system(
        self,
        machines: List[Dict[str, Any]],
        jobs: List[Dict[str, Any]] = None
    ) -> None:
        """Build system knowledge graph from machines and jobs."""
        self.reset()
        jobs = jobs or []

        # Track zones, types, and efficiencies
        zones = set()
        machine_types = set()
        
        # Create job lookup by assigned machine
        machine_jobs = {}
        for job in jobs:
            machine_id = job.get("assigned_machine_id")
            if machine_id:
                if machine_id not in machine_jobs:
                    machine_jobs[machine_id] = []
                machine_jobs[machine_id].append(job)

        for machine in machines:
            machine_id = machine.get("machine_id")
            machine_name = machine.get("name", machine_id)
            machine_type = machine.get("type", "unknown")
            zone = machine.get("location_zone", "Unknown")
            status = machine.get("status", "IDLE")
            efficiency = machine.get("efficiency_rating", 0.8)
            
            color, node_type = self._get_machine_color(machine)
            
            # Add machine node
            self.graph.add_node(
                machine_id,
                type=node_type,
                label=machine_name,
                color=color,
                data=machine
            )

            # Machine -> Zone relationship
            zone_node = f"ZONE-{zone}"
            if zone_node not in self.graph:
                self.graph.add_node(
                    zone_node,
                    type="zone",
                    label=f"Zone {zone}",
                    color=self.NODE_COLORS["zone"]
                )
                zones.add(zone)
            self.graph.add_edge(machine_id, zone_node, relation="located_in", weight=2)

            # Machine -> Type relationship
            type_node = f"TYPE-{machine_type.upper()}"
            if type_node not in self.graph:
                self.graph.add_node(
                    type_node,
                    type="machine_type",
                    label=machine_type.title(),
                    color=self.MACHINE_TYPE_COLORS.get(machine_type, "#6B7280")
                )
                machine_types.add(machine_type)
            self.graph.add_edge(machine_id, type_node, relation="is_type", weight=1)

            # Machine -> Efficiency relationship
            eff_node, eff_color = self._get_efficiency_node(efficiency)
            if eff_node not in self.graph:
                self.graph.add_node(
                    eff_node,
                    type="efficiency",
                    label=eff_node.split("-")[1].title(),
                    color=eff_color
                )
            self.graph.add_edge(machine_id, eff_node, relation="has_efficiency", weight=1)

            # Machine -> Job relationships
            if machine_id in machine_jobs:
                for job in machine_jobs[machine_id]:
                    job_id = job.get("job_id", f"JOB-{id(job)}")
                    job_status = job.get("status", "PENDING")
                    is_hot_lot = job.get("is_hot_lot", False)
                    
                    # Determine job node properties
                    if job_status == "RUNNING":
                        job_color = self.NODE_COLORS["job_running"]
                        job_type = "job_running"
                    elif job_status == "QUEUED":
                        job_color = self.NODE_COLORS["job_queued"]
                        job_type = "job_queued"
                    else:
                        job_color = self.NODE_COLORS["job_pending"]
                        job_type = "job_pending"
                    
                    job_label = job.get("job_name", job_id)
                    if is_hot_lot:
                        job_label = "🔥 " + job_label
                    
                    if job_id not in self.graph:
                        self.graph.add_node(
                            job_id,
                            type=job_type,
                            label=job_label,
                            color=job_color,
                            data=job
                        )
                    
                    edge_weight = 3 if job_status == "RUNNING" else 2
                    self.graph.add_edge(
                        machine_id, job_id,
                        relation="processing" if job_status == "RUNNING" else "assigned",
                        weight=edge_weight
                    )

            # Connect machines in same zone (weak connection)
            for other_machine in machines:
                other_id = other_machine.get("machine_id")
                other_zone = other_machine.get("location_zone")
                if (other_id != machine_id and 
                    other_zone == zone and 
                    not self.graph.has_edge(machine_id, other_id)):
                    # Add weak edge between machines in same zone
                    self.graph.add_edge(
                        machine_id, other_id,
                        relation="same_zone",
                        weight=0.5
                    )

        # Add system-level summary nodes
        self._add_summary_nodes(machines, jobs)

    def _add_summary_nodes(self, machines: List[Dict], jobs: List[Dict]) -> None:
        """Add system summary hub nodes."""
        # Calculate stats
        total_machines = len(machines)
        running = sum(1 for m in machines if m.get("status") == "RUNNING")
        idle = sum(1 for m in machines if m.get("status") == "IDLE")
        down = sum(1 for m in machines if m.get("status") == "DOWN")
        maintenance = sum(1 for m in machines if m.get("status") == "MAINTENANCE")
        
        running_jobs = sum(1 for j in jobs if j.get("status") == "RUNNING")
        hot_lots = sum(1 for j in jobs if j.get("is_hot_lot") and j.get("status") in ("PENDING", "QUEUED", "RUNNING"))

        # Add system hub
        hub_id = "SYSTEM-HUB"
        self.graph.add_node(
            hub_id,
            type="system_hub",
            label="Fab System",
            color="#1E293B"
        )

        # Connect status summaries
        if running > 0:
            running_node = "SUMMARY-RUNNING"
            if running_node not in self.graph:
                self.graph.add_node(
                    running_node,
                    type="summary",
                    label=f"Running ({running})",
                    color=self.NODE_COLORS["machine_running"]
                )
            self.graph.add_edge(hub_id, running_node, relation="has_running", weight=1)

        if down > 0:
            down_node = "SUMMARY-DOWN"
            if down_node not in self.graph:
                self.graph.add_node(
                    down_node,
                    type="summary",
                    label=f"Down ({down})",
                    color=self.NODE_COLORS["machine_down"]
                )
            self.graph.add_edge(hub_id, down_node, relation="has_down", weight=2)

        if running_jobs > 0:
            jobs_node = "SUMMARY-JOBS"
            if jobs_node not in self.graph:
                self.graph.add_node(
                    jobs_node,
                    type="summary",
                    label=f"Active Jobs ({running_jobs})",
                    color=self.NODE_COLORS["job_running"]
                )
            self.graph.add_edge(hub_id, jobs_node, relation="active_jobs", weight=1)

        if hot_lots > 0:
            hot_node = "SUMMARY-HOTLOTS"
            if hot_node not in self.graph:
                self.graph.add_node(
                    hot_node,
                    type="summary",
                    label=f"Hot Lots ({hot_lots})",
                    color="#F43F5E"
                )
            self.graph.add_edge(hub_id, hot_node, relation="hot_lots", weight=3)

    def get_central_concepts(self, top_n: int = 10) -> List[Tuple[str, float]]:
        """Get most central nodes by degree centrality."""
        if len(self.graph.nodes()) == 0:
            return []
        centrality = nx.degree_centrality(self.graph)
        # Filter out summary nodes
        filtered = {k: v for k, v in centrality.items() 
                   if not k.startswith(("SUMMARY-", "SYSTEM-"))}
        return sorted(filtered.items(), key=lambda x: x[1], reverse=True)[:top_n]

    def get_zone_summary(self) -> Dict[str, Dict[str, Any]]:
        """Get summary stats by zone."""
        zones = {}
        for node, data in self.graph.nodes(data=True):
            if data.get("type") == "zone":
                zone_name = data.get("label", node)
                neighbors = list(self.graph.neighbors(node))
                machines = [n for n in neighbors if not n.startswith(("ZONE-", "TYPE-", "EFFICIENCY-", "SYSTEM-", "SUMMARY-"))]
                
                running = sum(1 for m in machines 
                            if self.graph.nodes[m].get("type") == "machine_running")
                
                zones[zone_name] = {
                    "machine_count": len(machines),
                    "running": running,
                    "utilization": running / len(machines) if machines else 0
                }
        return zones

    def get_type_summary(self) -> Dict[str, int]:
        """Get machine count by type."""
        types = {}
        for node, data in self.graph.nodes(data=True):
            if data.get("type") == "machine_type":
                type_name = data.get("label", node)
                count = len(list(self.graph.neighbors(node)))
                types[type_name] = count
        return types

    def get_bottlenecks(self) -> List[Dict[str, Any]]:
        """Identify potential bottleneck machines (high betweenness)."""
        if len(self.graph.nodes()) < 3:
            return []
        
        try:
            betweenness = nx.betweenness_centrality(self.graph, weight="weight")
            # Filter to machine nodes only
            machines = {k: v for k, v in betweenness.items() 
                       if k.startswith(("LITHO-", "ETCH-", "DEP-", "INSP-", "CLEAN-"))}
            
            sorted_machines = sorted(machines.items(), key=lambda x: x[1], reverse=True)
            return [
                {"machine_id": m[0], "centrality": m[1], "label": self.graph.nodes[m[0]].get("label", m[0])}
                for m in sorted_machines[:5]
            ]
        except Exception as e:
            logger.error(f"Error calculating betweenness: {e}")
            return []

    def to_cytoscape_json(self) -> Dict[str, Any]:
        """Export graph to Cytoscape-compatible JSON."""
        nodes = []
        edges = []
        
        for node, data in self.graph.nodes(data=True):
            node_type = data.get("type", "machine")
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
                "zone_summary": self.get_zone_summary(),
                "type_summary": self.get_type_summary(),
                "bottlenecks": self.get_bottlenecks(),
            },
        }


# Singleton
system_graph_engine = SystemGraphEngine()
