-- Aegis Sentinel Tables for YieldOps
-- Adds incident tracking, agent registry, and knowledge graph persistence

-- Sentinel Incidents
CREATE TABLE IF NOT EXISTS aegis_incidents (
    incident_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    machine_id TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    incident_type TEXT NOT NULL,
    message TEXT,
    detected_value DOUBLE PRECISION,
    threshold_value DOUBLE PRECISION,
    action_taken TEXT,
    action_status TEXT CHECK (action_status IN ('auto_executed', 'pending_approval', 'approved', 'rejected', 'alert_only')),
    action_zone TEXT CHECK (action_zone IN ('green', 'yellow', 'red')),
    agent_type TEXT,
    z_score DOUBLE PRECISION,
    rate_of_change DOUBLE PRECISION,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    operator_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aegis_incidents_machine ON aegis_incidents(machine_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aegis_incidents_severity ON aegis_incidents(severity, resolved);
CREATE INDEX IF NOT EXISTS idx_aegis_incidents_zone ON aegis_incidents(action_zone, action_status);

-- Sentinel Agents Registry
CREATE TABLE IF NOT EXISTS aegis_agents (
    agent_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_type TEXT NOT NULL CHECK (agent_type IN ('precision', 'facility', 'assembly')),
    machine_id TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    capabilities TEXT[],
    protocol TEXT DEFAULT 'mqtt',
    last_heartbeat TIMESTAMPTZ,
    detections_24h INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Knowledge Graph Nodes
CREATE TABLE IF NOT EXISTS kg_nodes (
    node_id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    node_type TEXT NOT NULL,
    color TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Knowledge Graph Edges
CREATE TABLE IF NOT EXISTS kg_edges (
    edge_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id TEXT NOT NULL REFERENCES kg_nodes(node_id),
    target_id TEXT NOT NULL REFERENCES kg_nodes(node_id),
    relation TEXT NOT NULL,
    weight INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kg_edges_source ON kg_edges(source_id);
CREATE INDEX IF NOT EXISTS idx_kg_edges_target ON kg_edges(target_id);
