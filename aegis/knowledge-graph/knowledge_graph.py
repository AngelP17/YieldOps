#!/usr/bin/env python3
"""
Aegis Knowledge Graph Generator

Generates knowledge graphs from Aegis incident data and machine relationships.
Based on rahulnyk/knowledge_graph - adapted for Aegis Industrial Defense.

This module extracts concepts from incident descriptions and builds a graph
showing relationships between:
- Machines
- Failure types
- Components
- Actions taken
"""

import json
import re
from collections import defaultdict
from typing import Dict, List, Set, Tuple, Any
import networkx as nx
from datetime import datetime

class AegisKnowledgeGraph:
    """Knowledge graph generator for Aegis incident data"""
    
    def __init__(self):
        self.graph = nx.Graph()
        self.concepts = set()
        self.edges = defaultdict(list)
        
    def extract_concepts(self, text: str) -> List[str]:
        """Extract key concepts from incident text"""
        # Clean and normalize text
        text = text.lower()
        
        # Define concept patterns for manufacturing/industrial domain
        concept_patterns = {
            # Equipment types
            'cnc_mill': r'\bcnc\s*mill|\bhaas\s*vf|\bmachining\s*center\b',
            'cnc_lathe': r'\bcnc\s*lathe|\bmazak\s*qt|\bokuma\s*lb\b',
            'spindle': r'\bspindle|\bspindle\s*motor\b',
            'coolant_system': r'\bcoolant|\bcoolant\s*pump|\bcoolant\s*flow\b',
            'bearing': r'\bbearing|\bball\s*bearing|\broller\s*bearing\b',
            'hepa_filter': r'\bhepa|\bfilter|\bffu|\bfan\s*filter\b',
            'wire_bonder': r'\bwire\s*bond|\bbonder|\bk&s\b',
            'capillary': r'\bcapillary|\bbonding\s*capillary\b',
            
            # Failure types
            'thermal_runaway': r'\bthermal\s*runaway|\boverheat|\btemp\s*rise\b',
            'bearing_failure': r'\bbearing\s*failure|\bbearing\s*wear|\bbearing\s*defect\b',
            'coolant_leak': r'\bcoolant\s*leak|\bcoolant\s*failure|\bpump\s*failure\b',
            'chatter': r'\bchatter|\bvibration|\bregenerative\s*vibration\b',
            'tool_wear': r'\btool\s*wear|\bcutting\s*tool|\btool\s*life\b',
            'nsop': r'\bnsop|\bnon.stick|\bbond\s*failure\b',
            'contamination': r'\bcontamination|\bparticle|\biso\s*class\b',
            'filter_clog': r'\bfilter\s*clog|\bpressure\s*drop|\bhepa\s*end\s*of\s*life\b',
            
            # Components
            'motor': r'\bmotor|\bdrive\s*motor\b',
            'pump': r'\bpump|\bcoolant\s*pump\b',
            'sensor': r'\bsensor|\btemperature\s*sensor|\bvibration\s*sensor\b',
            'controller': r'\bcontroller|\bplc|\bcnc\s*controller\b',
            
            # Actions
            'emergency_stop': r'\bemergency\s*stop|\be.stop|\bstop\s*machine\b',
            'feed_hold': r'\bfeed\s*hold|\bpause|\bhold\b',
            'speed_reduction': r'\bspeed\s*reduction|\brpm\s*reduction|\bslow\s*down\b',
            'maintenance': r'\bmaintenance|\brepair|\bservice\b',
            'tool_change': r'\btool\s*change|\breplace\s*tool\b',
        }
        
        found_concepts = []
        for concept, pattern in concept_patterns.items():
            if re.search(pattern, text, re.IGNORECASE):
                found_concepts.append(concept)
        
        return found_concepts
    
    def extract_relationships(self, incident: Dict[str, Any]) -> List[Tuple[str, str, str]]:
        """Extract (source, relation, target) triples from an incident"""
        triples = []
        
        machine_id = incident.get('machine_id', 'UNKNOWN')
        incident_type = incident.get('type', 'unknown')
        description = incident.get('message', '')
        action = incident.get('action', 'unknown')
        
        # Machine -> has_issue -> FailureType
        triples.append((machine_id, 'has_issue', incident_type))
        
        # Extract concepts from description
        concepts = self.extract_concepts(description)
        
        # Machine -> involves -> Component
        for concept in concepts:
            if any(x in concept for x in ['spindle', 'bearing', 'coolant', 'motor', 'pump', 'sensor', 'controller', 'hepa_filter', 'capillary']):
                triples.append((machine_id, 'involves', concept))
        
        # FailureType -> affects -> Component
        for concept in concepts:
            if any(x in concept for x in ['spindle', 'bearing', 'coolant', 'motor', 'pump', 'hepa_filter', 'capillary']):
                triples.append((incident_type, 'affects', concept))
        
        # Action -> resolves -> FailureType
        if action != 'unknown':
            triples.append((action, 'resolves', incident_type))
        
        # Severity -> classifies -> Incident
        severity = incident.get('severity', 'low')
        triples.append((severity, 'classifies', incident_type))
        
        return triples
    
    def add_incident(self, incident: Dict[str, Any]) -> None:
        """Add an incident to the knowledge graph"""
        triples = self.extract_relationships(incident)
        
        for source, relation, target in triples:
            # Add nodes
            self.graph.add_node(source, type=self._get_node_type(source))
            self.graph.add_node(target, type=self._get_node_type(target))
            
            # Add edge with relation
            self.graph.add_edge(source, target, relation=relation, weight=1)
            
            # Track concepts
            self.concepts.add(source)
            self.concepts.add(target)
            self.edges[(source, target)].append(relation)
    
    def _get_node_type(self, node: str) -> str:
        """Determine the type of a node"""
        if node.startswith('CNC-') or node.startswith('FAC-') or node.startswith('BOND-'):
            return 'machine'
        elif node in ['critical', 'high', 'medium', 'low']:
            return 'severity'
        elif any(x in node for x in ['thermal_runaway', 'bearing_failure', 'coolant_leak', 'chatter', 'tool_wear', 'nsop', 'contamination', 'filter_clog']):
            return 'failure_type'
        elif any(x in node for x in ['spindle', 'bearing', 'coolant', 'motor', 'pump', 'sensor', 'controller', 'hepa_filter', 'capillary']):
            return 'component'
        elif any(x in node for x in ['emergency_stop', 'feed_hold', 'speed_reduction', 'maintenance', 'tool_change']):
            return 'action'
        else:
            return 'concept'
    
    def build_from_incidents(self, incidents: List[Dict[str, Any]]) -> None:
        """Build knowledge graph from a list of incidents"""
        for incident in incidents:
            self.add_incident(incident)
        
        # Aggregate edge weights
        for u, v, data in self.graph.edges(data=True):
            edge_key = (u, v)
            if edge_key in self.edges:
                data['weight'] = len(self.edges[edge_key])
                data['relations'] = list(set(self.edges[edge_key]))
    
    def get_central_concepts(self, top_n: int = 10) -> List[Tuple[str, float]]:
        """Get most central concepts using degree centrality"""
        if len(self.graph.nodes()) == 0:
            return []
        
        centrality = nx.degree_centrality(self.graph)
        sorted_concepts = sorted(centrality.items(), key=lambda x: x[1], reverse=True)
        return sorted_concepts[:top_n]
    
    def get_communities(self) -> Dict[int, List[str]]:
        """Detect communities in the graph"""
        if len(self.graph.nodes()) == 0:
            return {}
        
        try:
            communities = nx.community.greedy_modularity_communities(self.graph)
            return {i: list(community) for i, community in enumerate(communities)}
        except:
            return {}
    
    def find_related_concepts(self, concept: str, depth: int = 2) -> List[str]:
        """Find concepts related to a given concept within N hops"""
        if concept not in self.graph:
            return []
        
        related = set()
        current_level = {concept}
        
        for _ in range(depth):
            next_level = set()
            for node in current_level:
                neighbors = self.graph.neighbors(node)
                next_level.update(neighbors)
            related.update(next_level)
            current_level = next_level
        
        related.discard(concept)
        return list(related)
    
    def to_cytoscape_json(self) -> Dict[str, Any]:
        """Export graph to Cytoscape.js JSON format for visualization"""
        nodes = []
        edges = []
        
        # Color scheme for node types
        colors = {
            'machine': '#00F0FF',      # Cyber blue
            'failure_type': '#FF2E2E',  # Red
            'component': '#FFB020',     # Amber
            'action': '#00FF94',        # Green
            'severity': '#9CA3AF',      # Gray
            'concept': '#3B82F6',       # Blue
        }
        
        for node, data in self.graph.nodes(data=True):
            node_type = data.get('type', 'concept')
            nodes.append({
                'data': {
                    'id': node,
                    'label': node.replace('_', ' ').title(),
                    'type': node_type,
                    'color': colors.get(node_type, '#3B82F6'),
                }
            })
        
        for u, v, data in self.graph.edges(data=True):
            edges.append({
                'data': {
                    'id': f'{u}-{v}',
                    'source': u,
                    'target': v,
                    'label': data.get('relation', 'relates_to'),
                    'weight': data.get('weight', 1),
                }
            })
        
        return {
            'nodes': nodes,
            'edges': edges,
            'stats': {
                'node_count': len(nodes),
                'edge_count': len(edges),
                'central_concepts': self.get_central_concepts(5),
            }
        }
    
    def to_pyvis_html(self, output_path: str = 'knowledge_graph.html') -> str:
        """Generate interactive HTML visualization using Pyvis-style output"""
        from pyvis.network import Network
        
        net = Network(height='600px', width='100%', bgcolor='#0F1115', font_color='#E5E7EB')
        
        # Color scheme
        colors = {
            'machine': '#00F0FF',
            'failure_type': '#FF2E2E',
            'component': '#FFB020',
            'action': '#00FF94',
            'severity': '#9CA3AF',
            'concept': '#3B82F6',
        }
        
        # Add nodes
        for node, data in self.graph.nodes(data=True):
            node_type = data.get('type', 'concept')
            color = colors.get(node_type, '#3B82F6')
            size = 20 + self.graph.degree(node) * 5  # Size by connectivity
            
            net.add_node(
                node,
                label=node.replace('_', ' ').title(),
                color=color,
                size=size,
                title=f"Type: {node_type}"
            )
        
        # Add edges
        for u, v, data in self.graph.edges(data=True):
            weight = data.get('weight', 1)
            net.add_edge(
                u, v,
                title=data.get('relation', 'relates_to'),
                width=weight,
                color='#2A303C'
            )
        
        # Physics options for better layout
        net.set_options("""
        {
            "physics": {
                "forceAtlas2Based": {
                    "gravitationalConstant": -50,
                    "centralGravity": 0.01,
                    "springLength": 100,
                    "springConstant": 0.08
                },
                "maxVelocity": 50,
                "solver": "forceAtlas2Based",
                "timestep": 0.35,
                "stabilization": {"iterations": 150}
            },
            "interaction": {
                "hover": true,
                "tooltipDelay": 200
            }
        }
        """)
        
        net.save_graph(output_path)
        return output_path


# Example usage and testing
if __name__ == '__main__':
    # Sample incident data
    sample_incidents = [
        {
            'incident_id': 'INC-001',
            'machine_id': 'CNC-001',
            'type': 'thermal_runaway',
            'message': 'Thermal runaway detected on CNC-001. Temperature rising rapidly due to coolant pump failure.',
            'severity': 'critical',
            'action': 'emergency_stop',
        },
        {
            'incident_id': 'INC-002',
            'machine_id': 'CNC-002',
            'type': 'bearing_failure',
            'message': 'Bearing failure signature detected. Vibration exceeds ISO 10816 threshold.',
            'severity': 'high',
            'action': 'maintenance',
        },
        {
            'incident_id': 'INC-003',
            'machine_id': 'FAC-001',
            'type': 'filter_clog',
            'message': 'HEPA filter pressure drop exceeds limit. Schedule replacement.',
            'severity': 'medium',
            'action': 'maintenance',
        },
        {
            'incident_id': 'INC-004',
            'machine_id': 'BOND-01',
            'type': 'nsop',
            'message': 'NSOP (Non-Stick on Pad) detected via ultrasonic impedance monitoring.',
            'severity': 'critical',
            'action': 'feed_hold',
        },
    ]
    
    # Build knowledge graph
    kg = AegisKnowledgeGraph()
    kg.build_from_incidents(sample_incidents)
    
    # Print statistics
    print(f"Nodes: {len(kg.graph.nodes())}")
    print(f"Edges: {len(kg.graph.edges())}")
    print(f"\nCentral Concepts:")
    for concept, centrality in kg.get_central_concepts(5):
        print(f"  {concept}: {centrality:.3f}")
    
    # Export to JSON
    cyto_json = kg.to_cytoscape_json()
    print(f"\nExported {cyto_json['stats']['node_count']} nodes, {cyto_json['stats']['edge_count']} edges")
