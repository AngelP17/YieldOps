-- =====================================================
-- MIGRATION: Aegis Sentinel Sand-to-Package Support
-- Adds tables for Facility (Front-End) and Assembly (Back-End) agents
-- =====================================================

-- =====================================================
-- TABLE: aegis_incidents
-- Purpose: Sentinel-detected threats and autonomous responses
-- Coverage: Facility (Fab), Assembly (Packaging), Precision (Machining)
-- =====================================================
CREATE TABLE aegis_incidents (
    incident_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    machine_id VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    incident_type VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    detected_value DECIMAL(12,4) NOT NULL,
    threshold_value DECIMAL(12,4) NOT NULL,
    action_taken VARCHAR(200) NOT NULL,
    action_status VARCHAR(50) NOT NULL CHECK (action_status IN ('auto_executed', 'pending_approval', 'approved', 'rejected', 'alert_only')),
    action_zone VARCHAR(20) NOT NULL CHECK (action_zone IN ('green', 'yellow', 'red')),
    agent_type VARCHAR(50) CHECK (agent_type IN ('facility', 'assembly', 'precision', 'fab_equipment', 'unknown')),
    z_score DECIMAL(8,4),
    rate_of_change DECIMAL(12,6),
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    operator_notes TEXT
);

-- Indexes for incident queries
CREATE INDEX idx_aegis_incidents_machine_time 
    ON aegis_incidents(machine_id, timestamp DESC);

CREATE INDEX idx_aegis_incidents_unresolved 
    ON aegis_incidents(resolved, timestamp DESC) 
    WHERE resolved = FALSE;

CREATE INDEX idx_aegis_incidents_severity 
    ON aegis_incidents(severity, timestamp DESC);

CREATE INDEX idx_aegis_incidents_agent_type 
    ON aegis_incidents(agent_type, timestamp DESC);

COMMENT ON TABLE aegis_incidents IS 'Aegis Sentinel autonomous defense detections';
COMMENT ON COLUMN aegis_incidents.action_zone IS 'Green=Auto, Yellow=Pending, Red=Human Required';
COMMENT ON COLUMN aegis_incidents.agent_type IS 'facility=Front-End Fab, assembly=Back-End Packaging';

-- =====================================================
-- TABLE: aegis_agents
-- Purpose: Sentinel agent registry and status
-- =====================================================
CREATE TABLE aegis_agents (
    agent_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_type VARCHAR(50) NOT NULL CHECK (agent_type IN ('facility', 'assembly', 'precision')),
    machine_id VARCHAR(100) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),
    last_heartbeat TIMESTAMP WITH TIME ZONE,
    detections_24h INTEGER DEFAULT 0,
    uptime_hours DECIMAL(8,2) DEFAULT 0,
    capabilities TEXT[],
    protocol VARCHAR(50), -- Modbus, SECS/GEM, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_aegis_agents_status ON aegis_agents(status);
CREATE INDEX idx_aegis_agents_type ON aegis_agents(agent_type);

COMMENT ON TABLE aegis_agents IS 'Aegis Sentinel agent registry';
COMMENT ON COLUMN aegis_agents.protocol IS 'Modbus/BACnet for Facility, SECS/GEM for Assembly';

-- =====================================================
-- EXTEND: sensor_readings
-- Add fields for Facility and Assembly agents
-- =====================================================

-- Facility (Front-End Fab) fields
ALTER TABLE sensor_readings ADD COLUMN IF NOT EXISTS airflow_mps DECIMAL(6,3);
ALTER TABLE sensor_readings ADD COLUMN IF NOT EXISTS particles_0_5um DECIMAL(12,2);
ALTER TABLE sensor_readings ADD COLUMN IF NOT EXISTS pressure_diff_pa DECIMAL(8,2);
ALTER TABLE sensor_readings ADD COLUMN IF NOT EXISTS chemical_ppm DECIMAL(8,4);

-- Assembly (Back-End Packaging) fields  
ALTER TABLE sensor_readings ADD COLUMN IF NOT EXISTS usg_impedance DECIMAL(6,2);
ALTER TABLE sensor_readings ADD COLUMN IF NOT EXISTS bond_time_ms DECIMAL(6,2);
ALTER TABLE sensor_readings ADD COLUMN IF NOT EXISTS shear_strength_g DECIMAL(6,2);
ALTER TABLE sensor_readings ADD COLUMN IF NOT EXISTS capillary_temp DECIMAL(6,2);

-- Agent type tracking
ALTER TABLE sensor_readings ADD COLUMN IF NOT EXISTS agent_type VARCHAR(50) 
    CHECK (agent_type IN ('facility', 'assembly', 'precision', 'fab_equipment', 'unknown'))
    DEFAULT 'fab_equipment';

-- Index for agent-specific queries
CREATE INDEX idx_sensor_readings_agent_type 
    ON sensor_readings(agent_type, recorded_at DESC);

CREATE INDEX idx_sensor_readings_facility 
    ON sensor_readings(pressure_diff_pa, particles_0_5um, recorded_at DESC) 
    WHERE agent_type = 'facility';

CREATE INDEX idx_sensor_readings_assembly 
    ON sensor_readings(usg_impedance, bond_time_ms, recorded_at DESC) 
    WHERE agent_type = 'assembly';

COMMENT ON COLUMN sensor_readings.airflow_mps IS 'FFU airflow velocity (Facility Agent)';
COMMENT ON COLUMN sensor_readings.particles_0_5um IS 'ISO 14644 particle count (Facility Agent)';
COMMENT ON COLUMN sensor_readings.pressure_diff_pa IS 'HEPA filter pressure drop (Facility Agent)';
COMMENT ON COLUMN sensor_readings.usg_impedance IS 'Ultrasonic generator impedance (Assembly Agent)';
COMMENT ON COLUMN sensor_readings.bond_time_ms IS 'Wire bond cycle time (Assembly Agent)';
COMMENT ON COLUMN sensor_readings.agent_type IS 'Source agent: facility=Fab, assembly=Packaging';

-- =====================================================
-- TABLE: facility_ffu_status
-- Purpose: FFU (Fan Filter Unit) detailed status for Facility Agent
-- =====================================================
CREATE TABLE facility_ffu_status (
    ffu_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    machine_id VARCHAR(100) NOT NULL REFERENCES machines(name),
    zone_id VARCHAR(20) NOT NULL,
    airflow_velocity_mps DECIMAL(5,2) NOT NULL,
    pressure_drop_pa DECIMAL(8,2) NOT NULL,
    motor_rpm INTEGER,
    motor_current_a DECIMAL(5,2),
    filter_life_percent DECIMAL(5,2),
    iso_class INTEGER CHECK (iso_class BETWEEN 1 AND 9),
    particle_count_0_5um DECIMAL(12,2),
    status VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (status IN ('normal', 'warning', 'critical')),
    last_maintenance DATE,
    next_scheduled_maintenance DATE,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_facility_ffu_zone ON facility_ffu_status(zone_id, recorded_at DESC);
CREATE INDEX idx_facility_ffu_status ON facility_ffu_status(status) WHERE status != 'normal';

COMMENT ON TABLE facility_ffu_status IS 'FFU (Fan Filter Unit) detailed monitoring for cleanroom compliance';

-- =====================================================
-- TABLE: assembly_bonder_status
-- Purpose: Wire bonder detailed status for Assembly Agent
-- =====================================================
CREATE TABLE assembly_bonder_status (
    bonder_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    machine_id VARCHAR(100) NOT NULL REFERENCES machines(name),
    usg_frequency_khz DECIMAL(6,2),
    usg_impedance_ohms DECIMAL(6,2),
    bond_force_grams DECIMAL(6,2),
    bond_time_ms DECIMAL(6,2),
    capillary_temp_c DECIMAL(5,2),
    shear_strength_g DECIMAL(6,2),
    nsop_count_24h INTEGER DEFAULT 0,
    oee_percent DECIMAL(5,2),
    cycle_time_ms DECIMAL(6,2),
    units_bonded_24h INTEGER,
    status VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (status IN ('normal', 'warning', 'critical')),
    last_wire_change TIMESTAMP WITH TIME ZONE,
    last_capillary_change TIMESTAMP WITH TIME ZONE,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_assembly_bonder_status ON assembly_bonder_status(status) WHERE status != 'normal';
CREATE INDEX idx_assembly_bonder_oee ON assembly_bonder_status(machine_id, oee_percent, recorded_at DESC);

COMMENT ON TABLE assembly_bonder_status IS 'Wire bonder detailed monitoring for packaging quality';
COMMENT ON COLUMN assembly_bonder_status.nsop_count_24h IS 'Non-Stick on Pad defects (critical quality metric)';
COMMENT ON COLUMN assembly_bonder_status.oee_percent IS 'Overall Equipment Effectiveness';

-- =====================================================
-- FUNCTIONS: Sentinel Analytics
-- =====================================================

-- Function to get safety circuit status
CREATE OR REPLACE FUNCTION get_safety_circuit_status()
RETURNS TABLE (
    green_actions_24h BIGINT,
    yellow_pending BIGINT,
    red_alerts_24h BIGINT,
    agents_active BIGINT,
    agents_total BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*) FROM aegis_incidents 
         WHERE action_zone = 'green' 
         AND timestamp >= NOW() - INTERVAL '24 hours')::BIGINT as green_actions_24h,
        (SELECT COUNT(*) FROM aegis_incidents 
         WHERE action_zone = 'yellow' 
         AND action_status = 'pending_approval'
         AND resolved = FALSE)::BIGINT as yellow_pending,
        (SELECT COUNT(*) FROM aegis_incidents 
         WHERE action_zone = 'red' 
         AND timestamp >= NOW() - INTERVAL '24 hours')::BIGINT as red_alerts_24h,
        (SELECT COUNT(*) FROM aegis_agents WHERE status = 'active')::BIGINT as agents_active,
        (SELECT COUNT(*) FROM aegis_agents)::BIGINT as agents_total;
END;
$$ LANGUAGE plpgsql;

-- Function to get Facility Agent summary (Front-End)
CREATE OR REPLACE FUNCTION get_facility_summary()
RETURNS TABLE (
    total_ffus BIGINT,
    critical_ffus BIGINT,
    avg_pressure_drop_pa DECIMAL(8,2),
    max_particle_count DECIMAL(12,2),
    iso_compliant_zones BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*) FROM facility_ffu_status 
         WHERE recorded_at >= NOW() - INTERVAL '1 hour')::BIGINT as total_ffus,
        (SELECT COUNT(*) FROM facility_ffu_status 
         WHERE status = 'critical' 
         AND recorded_at >= NOW() - INTERVAL '1 hour')::BIGINT as critical_ffus,
        (SELECT AVG(pressure_drop_pa) FROM facility_ffu_status 
         WHERE recorded_at >= NOW() - INTERVAL '1 hour')::DECIMAL(8,2) as avg_pressure_drop_pa,
        (SELECT MAX(particle_count_0_5um) FROM facility_ffu_status 
         WHERE recorded_at >= NOW() - INTERVAL '1 hour'))::DECIMAL(12,2) as max_particle_count,
        (SELECT COUNT(DISTINCT zone_id) FROM facility_ffu_status 
         WHERE iso_class <= 5 
         AND particle_count_0_5um < 3520 
         AND recorded_at >= NOW() - INTERVAL '1 hour')::BIGINT as iso_compliant_zones;
END;
$$ LANGUAGE plpgsql;

-- Function to get Assembly Agent summary (Back-End)
CREATE OR REPLACE FUNCTION get_assembly_summary()
RETURNS TABLE (
    total_bonders BIGINT,
    warning_bonders BIGINT,
    avg_oee_percent DECIMAL(5,2),
    total_nsop_24h BIGINT,
    avg_bond_time_ms DECIMAL(6,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*) FROM assembly_bonder_status 
         WHERE recorded_at >= NOW() - INTERVAL '1 hour')::BIGINT as total_bonders,
        (SELECT COUNT(*) FROM assembly_bonder_status 
         WHERE status = 'warning' 
         AND recorded_at >= NOW() - INTERVAL '1 hour')::BIGINT as warning_bonders,
        (SELECT AVG(oee_percent) FROM assembly_bonder_status 
         WHERE recorded_at >= NOW() - INTERVAL '1 hour')::DECIMAL(5,2) as avg_oee_percent,
        (SELECT SUM(nsop_count_24h) FROM assembly_bonder_status 
         WHERE recorded_at >= NOW() - INTERVAL '24 hours')::BIGINT as total_nsop_24h,
        (SELECT AVG(bond_time_ms) FROM assembly_bonder_status 
         WHERE recorded_at >= NOW() - INTERVAL '1 hour')::DECIMAL(6,2) as avg_bond_time_ms;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- RLS POLICIES
-- =====================================================

ALTER TABLE aegis_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE aegis_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE facility_ffu_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE assembly_bonder_status ENABLE ROW LEVEL SECURITY;

-- Read access for all authenticated users
CREATE POLICY "Allow read access" ON aegis_incidents FOR SELECT USING (true);
CREATE POLICY "Allow read access" ON aegis_agents FOR SELECT USING (true);
CREATE POLICY "Allow read access" ON facility_ffu_status FOR SELECT USING (true);
CREATE POLICY "Allow read access" ON assembly_bonder_status FOR SELECT USING (true);

-- Service role can insert/update
CREATE POLICY "Allow service insert" ON aegis_incidents FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow service update" ON aegis_incidents FOR UPDATE USING (true);
CREATE POLICY "Allow service insert" ON aegis_agents FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow service update" ON aegis_agents FOR UPDATE USING (true);
CREATE POLICY "Allow service insert" ON facility_ffu_status FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow service insert" ON assembly_bonder_status FOR INSERT WITH CHECK (true);

-- =====================================================
-- REALTIME SUBSCRIPTIONS
-- =====================================================

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE aegis_incidents;
ALTER PUBLICATION supabase_realtime ADD TABLE aegis_agents;
ALTER PUBLICATION supabase_realtime ADD TABLE facility_ffu_status;
ALTER PUBLICATION supabase_realtime ADD TABLE assembly_bonder_status;

-- Add comment for documentation
COMMENT ON DATABASE current_database() IS 'YieldOps Smart Fab - Sand-to-Package Platform with Aegis Sentinel';
