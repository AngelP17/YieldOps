-- =====================================================
-- TSMC SMART FACTORY - DATABASE SCHEMA
-- PostgreSQL 15+ | Supabase Compatible
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABLE: machines
-- Purpose: Store fabrication equipment metadata and status
-- =====================================================
CREATE TABLE machines (
    machine_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('lithography', 'etching', 'deposition', 'inspection', 'cleaning')),
    status VARCHAR(20) NOT NULL DEFAULT 'IDLE' CHECK (status IN ('IDLE', 'RUNNING', 'DOWN', 'MAINTENANCE')),
    efficiency_rating DECIMAL(4,2) NOT NULL CHECK (efficiency_rating >= 0.00 AND efficiency_rating <= 1.00),
    location_zone VARCHAR(20) NOT NULL,
    max_temperature DECIMAL(6,2) DEFAULT 85.00,
    max_vibration DECIMAL(6,2) DEFAULT 5.00,
    current_wafer_count INTEGER DEFAULT 0,
    total_wafers_processed INTEGER DEFAULT 0,
    last_maintenance TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE machines IS 'Semiconductor fabrication equipment registry';
COMMENT ON COLUMN machines.efficiency_rating IS 'Throughput efficiency (0.00-1.00). Higher = faster processing';

-- =====================================================
-- TABLE: sensor_readings
-- Purpose: Real-time IoT sensor data from machines
-- =====================================================
CREATE TABLE sensor_readings (
    reading_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    machine_id UUID NOT NULL REFERENCES machines(machine_id) ON DELETE CASCADE,
    temperature DECIMAL(6,2) NOT NULL CHECK (temperature >= -50 AND temperature <= 200),
    vibration DECIMAL(6,3) NOT NULL CHECK (vibration >= 0),
    pressure DECIMAL(8,2),
    humidity DECIMAL(5,2),
    power_consumption DECIMAL(8,2),
    is_anomaly BOOLEAN DEFAULT FALSE,
    anomaly_score DECIMAL(5,4),
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for time-series queries
CREATE INDEX idx_sensor_readings_machine_time 
    ON sensor_readings(machine_id, recorded_at DESC);

-- Index for anomaly detection queries
CREATE INDEX idx_sensor_readings_anomaly 
    ON sensor_readings(is_anomaly, recorded_at DESC) 
    WHERE is_anomaly = TRUE;

COMMENT ON TABLE sensor_readings IS 'Real-time sensor telemetry from IIoT devices';

-- =====================================================
-- TABLE: production_jobs
-- Purpose: Wafer processing jobs with priority levels
-- =====================================================
CREATE TABLE production_jobs (
    job_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_name VARCHAR(100) NOT NULL,
    wafer_count INTEGER NOT NULL CHECK (wafer_count > 0),
    priority_level INTEGER NOT NULL CHECK (priority_level BETWEEN 1 AND 5),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' 
        CHECK (status IN ('PENDING', 'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED')),
    recipe_type VARCHAR(50) NOT NULL,
    assigned_machine_id UUID REFERENCES machines(machine_id),
    estimated_duration_minutes INTEGER,
    actual_start_time TIMESTAMP WITH TIME ZONE,
    actual_end_time TIMESTAMP WITH TIME ZONE,
    deadline TIMESTAMP WITH TIME ZONE,
    customer_tag VARCHAR(50),
    is_hot_lot BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for dispatch queries (priority-based)
CREATE INDEX idx_production_jobs_dispatch 
    ON production_jobs(status, priority_level DESC, created_at ASC) 
    WHERE status = 'PENDING';

-- Index for hot lots
CREATE INDEX idx_production_jobs_hot_lot 
    ON production_jobs(is_hot_lot, priority_level DESC) 
    WHERE is_hot_lot = TRUE;

COMMENT ON TABLE production_jobs IS 'Wafer processing jobs with Theory of Constraints priority';
COMMENT ON COLUMN production_jobs.priority_level IS '1=Highest (Hot Lots), 5=Lowest (Standard)';
COMMENT ON COLUMN production_jobs.is_hot_lot IS 'VIP customer jobs that bypass normal queue';

-- =====================================================
-- TABLE: dispatch_decisions
-- Purpose: Audit log for ToC dispatch algorithm decisions
-- =====================================================
CREATE TABLE dispatch_decisions (
    decision_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES production_jobs(job_id),
    machine_id UUID NOT NULL REFERENCES machines(machine_id),
    decision_reason TEXT NOT NULL,
    algorithm_version VARCHAR(20) DEFAULT '1.0.0',
    efficiency_at_dispatch DECIMAL(4,2),
    queue_depth_at_dispatch INTEGER,
    estimated_completion TIMESTAMP WITH TIME ZONE,
    dispatched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for analytics
CREATE INDEX idx_dispatch_decisions_time 
    ON dispatch_decisions(dispatched_at DESC);

COMMENT ON TABLE dispatch_decisions IS 'Audit trail for Theory of Constraints dispatch decisions';

-- =====================================================
-- TABLE: maintenance_logs
-- Purpose: Track machine maintenance history
-- =====================================================
CREATE TABLE maintenance_logs (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    machine_id UUID NOT NULL REFERENCES machines(machine_id),
    maintenance_type VARCHAR(50) NOT NULL,
    description TEXT,
    technician_id VARCHAR(50),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    downtime_minutes INTEGER,
    parts_replaced TEXT[]
);

-- =====================================================
-- TABLE: capacity_simulations
-- Purpose: Store Monte Carlo simulation results
-- =====================================================
CREATE TABLE capacity_simulations (
    simulation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    simulation_name VARCHAR(100) NOT NULL,
    scenario_params JSONB NOT NULL,
    iterations INTEGER NOT NULL,
    mean_throughput DECIMAL(10,2),
    p95_throughput DECIMAL(10,2),
    p99_throughput DECIMAL(10,2),
    confidence_interval JSONB,
    results_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TABLE: anomaly_alerts
-- Purpose: ML-detected anomaly notifications
-- =====================================================
CREATE TABLE anomaly_alerts (
    alert_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    machine_id UUID NOT NULL REFERENCES machines(machine_id),
    reading_id UUID REFERENCES sensor_readings(reading_id),
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    description TEXT,
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by VARCHAR(50),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_machines_updated_at
    BEFORE UPDATE ON machines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_production_jobs_updated_at
    BEFORE UPDATE ON production_jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate machine utilization
CREATE OR REPLACE FUNCTION get_machine_utilization(
    p_machine_id UUID,
    p_hours INTEGER DEFAULT 24
)
RETURNS DECIMAL(5,2) AS $$
DECLARE
    v_total_time INTERVAL;
    v_running_time INTERVAL;
    v_utilization DECIMAL(5,2);
BEGIN
    SELECT 
        COALESCE(SUM(actual_end_time - actual_start_time), INTERVAL '0')
    INTO v_running_time
    FROM production_jobs
    WHERE assigned_machine_id = p_machine_id
      AND actual_start_time >= NOW() - (p_hours || ' hours')::INTERVAL
      AND status = 'COMPLETED';
    
    v_total_time := (p_hours || ' hours')::INTERVAL;
    v_utilization := LEAST(100.00, ROUND(
        (EXTRACT(EPOCH FROM v_running_time) / EXTRACT(EPOCH FROM v_total_time)) * 100, 2
    ));
    
    RETURN v_utilization;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE sensor_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_decisions ENABLE ROW LEVEL SECURITY;

-- Allow read access to all authenticated users
CREATE POLICY "Allow read access" ON machines FOR SELECT USING (true);
CREATE POLICY "Allow read access" ON sensor_readings FOR SELECT USING (true);
CREATE POLICY "Allow read access" ON production_jobs FOR SELECT USING (true);
CREATE POLICY "Allow read access" ON dispatch_decisions FOR SELECT USING (true);

-- Allow insert/update for service role only
CREATE POLICY "Allow service insert" ON machines FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow service update" ON machines FOR UPDATE USING (true);
CREATE POLICY "Allow service insert" ON sensor_readings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow service insert" ON production_jobs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow service update" ON production_jobs FOR UPDATE USING (true);
CREATE POLICY "Allow service insert" ON dispatch_decisions FOR INSERT WITH CHECK (true);
