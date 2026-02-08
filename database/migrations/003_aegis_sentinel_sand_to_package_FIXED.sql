-- =====================================================
-- MIGRATION: Aegis Sentinel Sand-to-Package Support
-- Adds tables for Facility (Front-End) and Assembly (Back-End) agents
-- =====================================================
-- =====================================================
-- TABLE: aegis_incidents
-- Purpose: Sentinel-detected threats and autonomous responses
-- Coverage: Facility (Fab), Assembly (Packaging), Precision (Machining)
-- =====================================================
CREATE TABLE IF NOT EXISTS aegis_incidents (
    incident_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    machine_id VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (
        severity IN ('low', 'medium', 'high', 'critical')
    ),
    incident_type VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    detected_value DECIMAL(12, 4) NOT NULL,
    threshold_value DECIMAL(12, 4) NOT NULL,
    action_taken VARCHAR(200) NOT NULL,
    action_status VARCHAR(50) NOT NULL CHECK (
        action_status IN (
            'auto_executed',
            'pending_approval',
            'approved',
            'rejected',
            'alert_only'
        )
    ),
    action_zone VARCHAR(20) NOT NULL CHECK (action_zone IN ('green', 'yellow', 'red')),
    agent_type VARCHAR(50) CHECK (
        agent_type IN (
            'facility',
            'assembly',
            'precision',
            'fab_equipment',
            'unknown'
        )
    ),
    z_score DECIMAL(8, 4),
    rate_of_change DECIMAL(12, 6),
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    operator_notes TEXT
);
-- Indexes for incident queries
CREATE INDEX IF NOT EXISTS idx_aegis_incidents_machine_time ON aegis_incidents(machine_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aegis_incidents_unresolved ON aegis_incidents(resolved, created_at DESC)
WHERE resolved = FALSE;
CREATE INDEX IF NOT EXISTS idx_aegis_incidents_severity ON aegis_incidents(severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aegis_incidents_agent_type ON aegis_incidents(agent_type, created_at DESC);
COMMENT ON TABLE aegis_incidents IS 'Aegis Sentinel autonomous defense detections';
COMMENT ON COLUMN aegis_incidents.action_zone IS 'Green=Auto, Yellow=Pending, Red=Human Required';
COMMENT ON COLUMN aegis_incidents.agent_type IS 'facility=Front-End Fab, assembly=Back-End Packaging';
-- =====================================================
-- TABLE: aegis_agents
-- Purpose: Sentinel agent registry and status
-- =====================================================
CREATE TABLE IF NOT EXISTS aegis_agents (
    agent_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_type VARCHAR(50) NOT NULL CHECK (
        agent_type IN ('facility', 'assembly', 'precision')
    ),
    machine_id VARCHAR(100) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),
    last_heartbeat TIMESTAMP WITH TIME ZONE,
    detections_24h INTEGER DEFAULT 0,
    uptime_hours DECIMAL(8, 2) DEFAULT 0,
    capabilities TEXT [],
    protocol VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Add missing columns if table was created in previous migration
ALTER TABLE aegis_agents
ADD COLUMN IF NOT EXISTS uptime_hours DECIMAL(8, 2) DEFAULT 0;
ALTER TABLE aegis_agents
ADD COLUMN IF NOT EXISTS capabilities TEXT [];
ALTER TABLE aegis_agents
ADD COLUMN IF NOT EXISTS protocol VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_aegis_agents_status ON aegis_agents(status);
CREATE INDEX IF NOT EXISTS idx_aegis_agents_type ON aegis_agents(agent_type);
COMMENT ON TABLE aegis_agents IS 'Aegis Sentinel agent registry';
COMMENT ON COLUMN aegis_agents.protocol IS 'Modbus/BACnet for Facility, SECS/GEM for Assembly';
-- =====================================================
-- EXTEND: sensor_readings
-- Add fields for Facility and Assembly agents
-- =====================================================
-- Facility (Front-End Fab) fields
ALTER TABLE sensor_readings
ADD COLUMN IF NOT EXISTS airflow_mps DECIMAL(6, 3);
ALTER TABLE sensor_readings
ADD COLUMN IF NOT EXISTS particles_0_5um DECIMAL(12, 2);
ALTER TABLE sensor_readings
ADD COLUMN IF NOT EXISTS pressure_diff_pa DECIMAL(8, 2);
ALTER TABLE sensor_readings
ADD COLUMN IF NOT EXISTS chemical_ppm DECIMAL(8, 4);
-- Assembly (Back-End Packaging) fields  
ALTER TABLE sensor_readings
ADD COLUMN IF NOT EXISTS usg_impedance DECIMAL(6, 2);
ALTER TABLE sensor_readings
ADD COLUMN IF NOT EXISTS bond_time_ms DECIMAL(6, 2);
ALTER TABLE sensor_readings
ADD COLUMN IF NOT EXISTS shear_strength_g DECIMAL(6, 2);
ALTER TABLE sensor_readings
ADD COLUMN IF NOT EXISTS capillary_temp DECIMAL(6, 2);
-- Agent type tracking
ALTER TABLE sensor_readings
ADD COLUMN IF NOT EXISTS agent_type VARCHAR(50) DEFAULT 'fab_equipment' CHECK (
        agent_type IN (
            'facility',
            'assembly',
            'precision',
            'fab_equipment',
            'unknown'
        )
    );
-- Index for agent-specific queries
CREATE INDEX IF NOT EXISTS idx_sensor_readings_agent_type ON sensor_readings(agent_type, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_sensor_readings_facility ON sensor_readings(
    pressure_diff_pa,
    particles_0_5um,
    recorded_at DESC
)
WHERE agent_type = 'facility';
CREATE INDEX IF NOT EXISTS idx_sensor_readings_assembly ON sensor_readings(usg_impedance, bond_time_ms, recorded_at DESC)
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
CREATE TABLE IF NOT EXISTS facility_ffu_status (
    ffu_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    machine_id VARCHAR(100) NOT NULL,
    zone_id VARCHAR(20) NOT NULL,
    airflow_velocity_mps DECIMAL(5, 2) NOT NULL,
    pressure_drop_pa DECIMAL(8, 2) NOT NULL,
    motor_rpm INTEGER,
    motor_current_a DECIMAL(5, 2),
    filter_life_percent DECIMAL(5, 2),
    iso_class INTEGER CHECK (
        iso_class BETWEEN 1 AND 9
    ),
    particle_count_0_5um DECIMAL(12, 2),
    status VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (status IN ('normal', 'warning', 'critical')),
    last_maintenance DATE,
    next_scheduled_maintenance DATE,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_facility_ffu_zone ON facility_ffu_status(zone_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_facility_ffu_status ON facility_ffu_status(status)
WHERE status != 'normal';
COMMENT ON TABLE facility_ffu_status IS 'FFU (Fan Filter Unit) detailed monitoring for cleanroom compliance';
-- =====================================================
-- TABLE: assembly_bonder_status
-- Purpose: Wire bonder detailed status for Assembly Agent
-- =====================================================
CREATE TABLE IF NOT EXISTS assembly_bonder_status (
    bonder_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    machine_id VARCHAR(100) NOT NULL,
    usg_frequency_khz DECIMAL(6, 2),
    usg_impedance_ohms DECIMAL(6, 2),
    bond_force_grams DECIMAL(6, 2),
    bond_time_ms DECIMAL(6, 2),
    capillary_temp_c DECIMAL(5, 2),
    shear_strength_g DECIMAL(6, 2),
    nsop_count_24h INTEGER DEFAULT 0,
    oee_percent DECIMAL(5, 2),
    cycle_time_ms DECIMAL(6, 2),
    units_bonded_24h INTEGER,
    status VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (status IN ('normal', 'warning', 'critical')),
    last_wire_change TIMESTAMP WITH TIME ZONE,
    last_capillary_change TIMESTAMP WITH TIME ZONE,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_assembly_bonder_status ON assembly_bonder_status(status)
WHERE status != 'normal';
CREATE INDEX IF NOT EXISTS idx_assembly_bonder_oee ON assembly_bonder_status(machine_id, oee_percent, recorded_at DESC);
COMMENT ON TABLE assembly_bonder_status IS 'Wire bonder detailed monitoring for packaging quality';
COMMENT ON COLUMN assembly_bonder_status.nsop_count_24h IS 'Non-Stick on Pad defects (critical quality metric)';
COMMENT ON COLUMN assembly_bonder_status.oee_percent IS 'Overall Equipment Effectiveness';
-- =====================================================
-- ENSURE COLUMNS EXIST (for idempotent migrations)
-- =====================================================
-- Add created_at column if it doesn't exist (handles partial migration runs)
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'aegis_incidents'
        AND column_name = 'created_at'
) THEN
ALTER TABLE aegis_incidents
ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
END IF;
END $$;
-- =====================================================
-- FUNCTIONS: Sentinel Analytics
-- =====================================================
-- Function to get safety circuit status
CREATE OR REPLACE FUNCTION get_safety_circuit_status() RETURNS TABLE (
        green_actions_24h BIGINT,
        yellow_pending BIGINT,
        red_alerts_24h BIGINT,
        agents_active BIGINT,
        agents_total BIGINT
    ) AS $$ BEGIN RETURN QUERY
SELECT COALESCE(
        (
            SELECT COUNT(*)
            FROM aegis_incidents
            WHERE action_zone = 'green'
                AND created_at >= NOW() - INTERVAL '24 hours'
        ),
        0
    )::BIGINT as green_actions_24h,
    COALESCE(
        (
            SELECT COUNT(*)
            FROM aegis_incidents
            WHERE action_zone = 'yellow'
                AND action_status = 'pending_approval'
                AND resolved = FALSE
        ),
        0
    )::BIGINT as yellow_pending,
    COALESCE(
        (
            SELECT COUNT(*)
            FROM aegis_incidents
            WHERE action_zone = 'red'
                AND created_at >= NOW() - INTERVAL '24 hours'
        ),
        0
    )::BIGINT as red_alerts_24h,
    COALESCE(
        (
            SELECT COUNT(*)
            FROM aegis_agents
            WHERE status = 'active'
        ),
        0
    )::BIGINT as agents_active,
    COALESCE(
        (
            SELECT COUNT(*)
            FROM aegis_agents
        ),
        0
    )::BIGINT as agents_total;
END;
$$ LANGUAGE plpgsql;
-- Function to get Facility Agent summary (Front-End)
CREATE OR REPLACE FUNCTION get_facility_summary() RETURNS TABLE (
        total_ffus BIGINT,
        critical_ffus BIGINT,
        avg_pressure_drop_pa DECIMAL(8, 2),
        max_particle_count DECIMAL(12, 2),
        iso_compliant_zones BIGINT
    ) AS $$ BEGIN RETURN QUERY
SELECT COALESCE(
        (
            SELECT COUNT(*)
            FROM facility_ffu_status
            WHERE recorded_at >= NOW() - INTERVAL '1 hour'
        ),
        0
    )::BIGINT as total_ffus,
    COALESCE(
        (
            SELECT COUNT(*)
            FROM facility_ffu_status
            WHERE status = 'critical'
                AND recorded_at >= NOW() - INTERVAL '1 hour'
        ),
        0
    )::BIGINT as critical_ffus,
    COALESCE(
        (
            SELECT AVG(pressure_drop_pa)
            FROM facility_ffu_status
            WHERE recorded_at >= NOW() - INTERVAL '1 hour'
        ),
        0
    )::DECIMAL(8, 2) as avg_pressure_drop_pa,
    COALESCE(
        (
            SELECT MAX(particle_count_0_5um)
            FROM facility_ffu_status
            WHERE recorded_at >= NOW() - INTERVAL '1 hour'
        ),
        0
    )::DECIMAL(12, 2) as max_particle_count,
    COALESCE(
        (
            SELECT COUNT(DISTINCT zone_id)
            FROM facility_ffu_status
            WHERE iso_class <= 5
                AND particle_count_0_5um < 3520
                AND recorded_at >= NOW() - INTERVAL '1 hour'
        ),
        0
    )::BIGINT as iso_compliant_zones;
END;
$$ LANGUAGE plpgsql;
-- Function to get Assembly Agent summary (Back-End)
CREATE OR REPLACE FUNCTION get_assembly_summary() RETURNS TABLE (
        total_bonders BIGINT,
        warning_bonders BIGINT,
        avg_oee_percent DECIMAL(5, 2),
        total_nsop_24h BIGINT,
        avg_bond_time_ms DECIMAL(6, 2)
    ) AS $$ BEGIN RETURN QUERY
SELECT COALESCE(
        (
            SELECT COUNT(*)
            FROM assembly_bonder_status
            WHERE recorded_at >= NOW() - INTERVAL '1 hour'
        ),
        0
    )::BIGINT as total_bonders,
    COALESCE(
        (
            SELECT COUNT(*)
            FROM assembly_bonder_status
            WHERE status = 'warning'
                AND recorded_at >= NOW() - INTERVAL '1 hour'
        ),
        0
    )::BIGINT as warning_bonders,
    COALESCE(
        (
            SELECT AVG(oee_percent)
            FROM assembly_bonder_status
            WHERE recorded_at >= NOW() - INTERVAL '1 hour'
        ),
        0
    )::DECIMAL(5, 2) as avg_oee_percent,
    COALESCE(
        (
            SELECT SUM(nsop_count_24h)
            FROM assembly_bonder_status
            WHERE recorded_at >= NOW() - INTERVAL '24 hours'
        ),
        0
    )::BIGINT as total_nsop_24h,
    COALESCE(
        (
            SELECT AVG(bond_time_ms)
            FROM assembly_bonder_status
            WHERE recorded_at >= NOW() - INTERVAL '1 hour'
        ),
        0
    )::DECIMAL(6, 2) as avg_bond_time_ms;
END;
$$ LANGUAGE plpgsql;
-- =====================================================
-- RLS POLICIES
-- =====================================================
ALTER TABLE IF EXISTS aegis_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS aegis_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS facility_ffu_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS assembly_bonder_status ENABLE ROW LEVEL SECURITY;
-- Drop existing policies first (clean slate)
DROP POLICY IF EXISTS "Allow read access" ON aegis_incidents;
DROP POLICY IF EXISTS "Allow read access" ON aegis_agents;
DROP POLICY IF EXISTS "Allow read access" ON facility_ffu_status;
DROP POLICY IF EXISTS "Allow read access" ON assembly_bonder_status;
DROP POLICY IF EXISTS "Allow service insert" ON aegis_incidents;
DROP POLICY IF EXISTS "Allow service update" ON aegis_incidents;
DROP POLICY IF EXISTS "Allow service insert" ON aegis_agents;
DROP POLICY IF EXISTS "Allow service update" ON aegis_agents;
DROP POLICY IF EXISTS "Allow service insert" ON facility_ffu_status;
DROP POLICY IF EXISTS "Allow service insert" ON assembly_bonder_status;
-- Read access for all authenticated users
CREATE POLICY "Allow read access" ON aegis_incidents FOR
SELECT USING (true);
CREATE POLICY "Allow read access" ON aegis_agents FOR
SELECT USING (true);
CREATE POLICY "Allow read access" ON facility_ffu_status FOR
SELECT USING (true);
CREATE POLICY "Allow read access" ON assembly_bonder_status FOR
SELECT USING (true);
-- Service role can insert/update
CREATE POLICY "Allow service insert" ON aegis_incidents FOR
INSERT WITH CHECK (true);
CREATE POLICY "Allow service update" ON aegis_incidents FOR
UPDATE USING (true);
CREATE POLICY "Allow service insert" ON aegis_agents FOR
INSERT WITH CHECK (true);
CREATE POLICY "Allow service update" ON aegis_agents FOR
UPDATE USING (true);
CREATE POLICY "Allow service insert" ON facility_ffu_status FOR
INSERT WITH CHECK (true);
CREATE POLICY "Allow service insert" ON assembly_bonder_status FOR
INSERT WITH CHECK (true);
-- =====================================================
-- REALTIME SUBSCRIPTIONS
-- =====================================================
-- Enable realtime for new tables
DO $$ BEGIN ALTER PUBLICATION supabase_realtime
ADD TABLE aegis_incidents;
EXCEPTION
WHEN duplicate_object THEN RAISE NOTICE 'aegis_incidents already in publication';
END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime
ADD TABLE aegis_agents;
EXCEPTION
WHEN duplicate_object THEN RAISE NOTICE 'aegis_agents already in publication';
END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime
ADD TABLE facility_ffu_status;
EXCEPTION
WHEN duplicate_object THEN RAISE NOTICE 'facility_ffu_status already in publication';
END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime
ADD TABLE assembly_bonder_status;
EXCEPTION
WHEN duplicate_object THEN RAISE NOTICE 'assembly_bonder_status already in publication';
END $$;
-- =====================================================
-- TRIGGER: Auto-create Sentinel Agents for new machines
-- Every machine in YieldOps gets a Sentinel Agent
-- =====================================================
CREATE OR REPLACE FUNCTION create_sentinel_agent_for_machine() RETURNS TRIGGER AS $$ BEGIN -- Only insert if agent doesn't already exist for this machine
    IF NOT EXISTS (
        SELECT 1
        FROM aegis_agents
        WHERE machine_id = NEW.name
    ) THEN
INSERT INTO aegis_agents (
        agent_id,
        agent_type,
        machine_id,
        status,
        last_heartbeat,
        detections_24h,
        uptime_hours,
        capabilities,
        protocol
    )
VALUES (
        gen_random_uuid(),
        CASE
            NEW.type
            WHEN 'lithography' THEN 'precision'
            WHEN 'etching' THEN 'facility'
            WHEN 'deposition' THEN 'assembly'
            WHEN 'inspection' THEN 'precision'
            ELSE 'facility'
        END::VARCHAR(50),
        NEW.name,
        'active',
        NOW(),
        0,
        0,
        CASE
            NEW.type
            WHEN 'lithography' THEN ARRAY ['z_score_analysis', 'rate_of_change', 'thermal_drift_cte']
            WHEN 'etching' THEN ARRAY ['iso_10816_vibration', 'particle_count', 'cleanroom_monitoring']
            WHEN 'deposition' THEN ARRAY ['ultrasonic_impedance', 'wire_bond_monitoring']
            WHEN 'inspection' THEN ARRAY ['defect_detection', 'cd_measurement']
            ELSE ARRAY ['general_monitoring']
        END::TEXT [],
        CASE
            WHEN NEW.type = 'lithography' THEN 'SECS/GEM'
            WHEN NEW.type IN ('etching', 'deposition') THEN 'Modbus/BACnet'
            ELSE 'MQTT'
        END::VARCHAR(50)
    );
END IF;
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS create_sentinel_agent_trigger ON machines;
-- Create trigger to auto-create agents for new machines
CREATE TRIGGER create_sentinel_agent_trigger
AFTER
INSERT ON machines FOR EACH ROW EXECUTE FUNCTION create_sentinel_agent_for_machine();
-- Create agents for existing machines (if not already exist)
INSERT INTO aegis_agents (
        agent_id,
        agent_type,
        machine_id,
        status,
        last_heartbeat,
        detections_24h,
        uptime_hours,
        capabilities,
        protocol
    )
SELECT gen_random_uuid(),
    CASE
        m.type
        WHEN 'lithography' THEN 'precision'
        WHEN 'etching' THEN 'facility'
        WHEN 'deposition' THEN 'assembly'
        WHEN 'inspection' THEN 'precision'
        ELSE 'facility'
    END::VARCHAR(50),
    m.name,
    CASE
        WHEN m.status IN ('RUNNING', 'IDLE') THEN 'active'
        ELSE 'inactive'
    END::VARCHAR(20),
    NOW(),
    0,
    0,
    CASE
        m.type
        WHEN 'lithography' THEN ARRAY ['z_score_analysis', 'rate_of_change', 'thermal_drift_cte']
        WHEN 'etching' THEN ARRAY ['iso_10816_vibration', 'particle_count', 'cleanroom_monitoring']
        WHEN 'deposition' THEN ARRAY ['ultrasonic_impedance', 'wire_bond_monitoring']
        WHEN 'inspection' THEN ARRAY ['defect_detection', 'cd_measurement']
        ELSE ARRAY ['general_monitoring']
    END::TEXT [],
    CASE
        WHEN m.type = 'lithography' THEN 'SECS/GEM'
        WHEN m.type IN ('etching', 'deposition') THEN 'Modbus/BACnet'
        ELSE 'MQTT'
    END::VARCHAR(50)
FROM machines m
WHERE NOT EXISTS (
        SELECT 1
        FROM aegis_agents
        WHERE machine_id = m.name
    );
-- =====================================================
-- TRIGGER: Auto-create incidents from sensor threshold breaches
-- When sensor readings exceed machine thresholds, create incident
-- =====================================================
CREATE OR REPLACE FUNCTION check_sensor_thresholds() RETURNS TRIGGER AS $$
DECLARE v_machine_name VARCHAR(100);
v_machine_type VARCHAR(50);
v_max_temp DECIMAL(8, 2);
v_max_vib DECIMAL(8, 2);
v_severity VARCHAR(20);
v_incident_type VARCHAR(100);
v_message TEXT;
v_action_taken VARCHAR(200);
v_action_status VARCHAR(50);
v_action_zone VARCHAR(20);
v_agent_type VARCHAR(50);
BEGIN -- Get machine info
SELECT name,
    type,
    max_temperature,
    max_vibration INTO v_machine_name,
    v_machine_type,
    v_max_temp,
    v_max_vib
FROM machines
WHERE machine_id = NEW.machine_id;
IF v_machine_name IS NULL THEN RETURN NEW;
END IF;
-- Determine agent type
v_agent_type := CASE
    v_machine_type
    WHEN 'lithography' THEN 'precision'
    WHEN 'etching' THEN 'facility'
    WHEN 'deposition' THEN 'assembly'
    ELSE 'facility'
END::VARCHAR(50);
-- Check temperature threshold
IF NEW.temperature > v_max_temp * 0.90 THEN -- Determine severity
IF NEW.temperature > v_max_temp THEN v_severity := 'critical';
v_incident_type := 'thermal_runaway';
v_message := 'CRITICAL: Temperature exceeded maximum on ' || v_machine_name || ' (' || NEW.temperature || '°C / ' || v_max_temp || '°C max)';
v_action_taken := 'emergency_stop';
v_action_status := 'alert_only';
v_action_zone := 'red';
ELSIF NEW.temperature > v_max_temp * 0.95 THEN v_severity := 'high';
v_incident_type := 'elevated_temperature';
v_message := 'HIGH: Elevated temperature on ' || v_machine_name || ' (' || NEW.temperature || '°C / ' || v_max_temp || '°C max)';
v_action_taken := 'reduce_thermal_load';
v_action_status := 'pending_approval';
v_action_zone := 'yellow';
ELSE v_severity := 'medium';
v_incident_type := 'temperature_warning';
v_message := 'WARNING: Temperature approaching limit on ' || v_machine_name || ' (' || NEW.temperature || '°C / ' || v_max_temp || '°C max)';
v_action_taken := 'increase_coolant';
v_action_status := 'auto_executed';
v_action_zone := 'green';
END IF;
-- Create incident
INSERT INTO aegis_incidents (
        incident_id,
        created_at,
        machine_id,
        severity,
        incident_type,
        message,
        detected_value,
        threshold_value,
        action_taken,
        action_status,
        action_zone,
        agent_type,
        z_score,
        rate_of_change,
        resolved
    )
VALUES (
        gen_random_uuid(),
        NEW.recorded_at,
        v_machine_name,
        v_severity,
        v_incident_type,
        v_message,
        NEW.temperature,
        v_max_temp,
        v_action_taken,
        v_action_status,
        v_action_zone,
        v_agent_type,
        (NEW.temperature - v_max_temp * 0.8) / 5,
        0,
        FALSE
    );
-- Update agent detection count
UPDATE aegis_agents
SET detections_24h = detections_24h + 1,
    last_heartbeat = NOW()
WHERE machine_id = v_machine_name;
END IF;
-- Check vibration threshold
IF NEW.vibration > v_max_vib THEN
INSERT INTO aegis_incidents (
        incident_id,
        created_at,
        machine_id,
        severity,
        incident_type,
        message,
        detected_value,
        threshold_value,
        action_taken,
        action_status,
        action_zone,
        agent_type,
        z_score,
        rate_of_change,
        resolved
    )
VALUES (
        gen_random_uuid(),
        NEW.recorded_at,
        v_machine_name,
        'high',
        'excessive_vibration',
        'HIGH: Vibration exceeded threshold on ' || v_machine_name || ' (' || NEW.vibration || ' mm/s / ' || v_max_vib || ' mm/s max)',
        NEW.vibration,
        v_max_vib,
        'schedule_maintenance',
        'pending_approval',
        'yellow',
        v_agent_type,
        NEW.vibration / v_max_vib,
        0,
        FALSE
    );
-- Update agent detection count
UPDATE aegis_agents
SET detections_24h = detections_24h + 1,
    last_heartbeat = NOW()
WHERE machine_id = v_machine_name;
END IF;
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS sensor_threshold_check_trigger ON sensor_readings;
-- Create trigger on sensor_readings
CREATE TRIGGER sensor_threshold_check_trigger
AFTER
INSERT ON sensor_readings FOR EACH ROW EXECUTE FUNCTION check_sensor_thresholds();
-- =====================================================
-- FUNCTION: Reset daily detection counts
-- Run this daily to reset the 24h counter
-- =====================================================
CREATE OR REPLACE FUNCTION reset_agent_detection_counts() RETURNS void AS $$ BEGIN
UPDATE aegis_agents
SET detections_24h = 0,
    uptime_hours = uptime_hours + 24;
END;
$$ LANGUAGE plpgsql;
COMMENT ON FUNCTION reset_agent_detection_counts() IS 'Reset daily detection counts. Schedule to run every 24 hours.';
-- =====================================================
-- BACKFILL: Create incidents from existing sensor readings
-- Process last 24h of sensor data that exceeded thresholds
-- =====================================================
DO $$
DECLARE v_count INTEGER := 0;
BEGIN -- Insert temperature incidents from existing sensor readings
INSERT INTO aegis_incidents (
        incident_id,
        created_at,
        machine_id,
        severity,
        incident_type,
        message,
        detected_value,
        threshold_value,
        action_taken,
        action_status,
        action_zone,
        agent_type,
        z_score,
        rate_of_change,
        resolved,
        resolved_at,
        operator_notes
    )
SELECT gen_random_uuid(),
    sr.recorded_at,
    m.name,
    CASE
        WHEN sr.temperature > m.max_temperature THEN 'critical'::VARCHAR(20)
        WHEN sr.temperature > m.max_temperature * 0.95 THEN 'high'::VARCHAR(20)
        ELSE 'medium'::VARCHAR(20)
    END,
    CASE
        WHEN sr.temperature > m.max_temperature THEN 'thermal_runaway'::VARCHAR(100)
        ELSE 'elevated_temperature'::VARCHAR(100)
    END,
    CASE
        WHEN sr.temperature > m.max_temperature THEN 'CRITICAL: Temperature exceeded maximum on ' || m.name || ' (' || sr.temperature || '°C / ' || m.max_temperature || '°C max)'::TEXT
        WHEN sr.temperature > m.max_temperature * 0.95 THEN 'HIGH: Elevated temperature on ' || m.name || ' (' || sr.temperature || '°C / ' || m.max_temperature || '°C max)'::TEXT
        ELSE 'WARNING: Temperature approaching limit on ' || m.name || ' (' || sr.temperature || '°C / ' || m.max_temperature || '°C max)'::TEXT
    END,
    sr.temperature,
    m.max_temperature,
    CASE
        WHEN sr.temperature > m.max_temperature THEN 'emergency_stop'::VARCHAR(200)
        WHEN sr.temperature > m.max_temperature * 0.95 THEN 'reduce_thermal_load'::VARCHAR(200)
        ELSE 'increase_coolant'::VARCHAR(200)
    END,
    CASE
        WHEN sr.temperature > m.max_temperature THEN 'alert_only'::VARCHAR(50)
        WHEN sr.temperature > m.max_temperature * 0.95 THEN 'pending_approval'::VARCHAR(50)
        ELSE 'auto_executed'::VARCHAR(50)
    END,
    CASE
        WHEN sr.temperature > m.max_temperature THEN 'red'::VARCHAR(20)
        WHEN sr.temperature > m.max_temperature * 0.95 THEN 'yellow'::VARCHAR(20)
        ELSE 'green'::VARCHAR(20)
    END,
    CASE
        m.type
        WHEN 'lithography' THEN 'precision'::VARCHAR(50)
        WHEN 'etching' THEN 'facility'::VARCHAR(50)
        WHEN 'deposition' THEN 'assembly'::VARCHAR(50)
        ELSE 'facility'::VARCHAR(50)
    END,
    (sr.temperature - m.max_temperature * 0.8) / 5,
    0,
    TRUE,
    -- Mark as resolved since it's historical
    sr.recorded_at + INTERVAL '30 minutes',
    'Historical incident - auto-resolved on backfill'::TEXT
FROM sensor_readings sr
    JOIN machines m ON sr.machine_id = m.machine_id
WHERE sr.recorded_at >= NOW() - INTERVAL '24 hours'
    AND sr.temperature > m.max_temperature * 0.90;
GET DIAGNOSTICS v_count = ROW_COUNT;
RAISE NOTICE 'Created % temperature incidents from historical data',
v_count;
-- Insert vibration incidents from existing sensor readings
INSERT INTO aegis_incidents (
        incident_id,
        created_at,
        machine_id,
        severity,
        incident_type,
        message,
        detected_value,
        threshold_value,
        action_taken,
        action_status,
        action_zone,
        agent_type,
        z_score,
        rate_of_change,
        resolved,
        resolved_at,
        operator_notes
    )
SELECT gen_random_uuid(),
    sr.recorded_at,
    m.name,
    'high'::VARCHAR(20),
    'excessive_vibration'::VARCHAR(100),
    (
        'HIGH: Vibration exceeded threshold on ' || m.name || ' (' || sr.vibration || ' mm/s / ' || m.max_vibration || ' mm/s max)'
    )::TEXT,
    sr.vibration,
    m.max_vibration,
    'schedule_maintenance'::VARCHAR(200),
    'pending_approval'::VARCHAR(50),
    'yellow'::VARCHAR(20),
    CASE
        m.type
        WHEN 'lithography' THEN 'precision'::VARCHAR(50)
        WHEN 'etching' THEN 'facility'::VARCHAR(50)
        WHEN 'deposition' THEN 'assembly'::VARCHAR(50)
        ELSE 'facility'::VARCHAR(50)
    END,
    sr.vibration / NULLIF(m.max_vibration, 0),
    0,
    TRUE,
    -- Mark as resolved since it's historical
    sr.recorded_at + INTERVAL '30 minutes',
    'Historical incident - auto-resolved on backfill'::TEXT
FROM sensor_readings sr
    JOIN machines m ON sr.machine_id = m.machine_id
WHERE sr.recorded_at >= NOW() - INTERVAL '24 hours'
    AND sr.vibration > m.max_vibration;
GET DIAGNOSTICS v_count = ROW_COUNT;
RAISE NOTICE 'Created % vibration incidents from historical data',
v_count;
END $$;