-- =====================================================
-- AUTONOMOUS JOB GENERATION SYSTEM
-- Dynamic job creation with real-time streaming support
-- =====================================================

-- Table: Job generation configuration
CREATE TABLE job_generation_config (
    config_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    enabled BOOLEAN DEFAULT true,
    generation_interval_seconds INTEGER DEFAULT 30,
    min_jobs INTEGER DEFAULT 10,
    max_jobs INTEGER DEFAULT 50,
    hot_lot_probability DECIMAL(4,2) DEFAULT 0.15,
    priority_distribution JSONB DEFAULT '{"1": 0.15, "2": 0.25, "3": 0.30, "4": 0.20, "5": 0.10}'::jsonb,
    customer_weights JSONB DEFAULT '{
        "Apple": 1.5, "NVIDIA": 1.4, "AMD": 1.3, "Intel": 1.2, "Qualcomm": 1.2,
        "Samsung": 1.1, "MediaTek": 1.0, "Broadcom": 1.0, "TI": 0.9, "NXP": 0.9,
        "ST": 0.8, "ADI": 0.8, "Maxim": 0.7, "Cirrus": 0.7, "INTERNAL": 0.5
    }'::jsonb,
    recipe_types JSONB DEFAULT '[
        "N3-ADV", "N5-HOT", "N5-STD", "N7-EXP", "N7-STD",
        "STANDARD_LOGIC", "MEMORY_DRAM", "GPU_DIE", "AI_ACCELERATOR",
        "HPC_CPU", "MOBILE_SOC", "NETWORK_CHIP", "MODEM_5G", "FPGA"
    ]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default configuration
INSERT INTO job_generation_config (enabled, generation_interval_seconds, min_jobs, max_jobs)
VALUES (true, 30, 10, 50);

-- Table: Job generation log (track autonomous job creation)
CREATE TABLE job_generation_log (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID REFERENCES production_jobs(job_id) ON DELETE CASCADE,
    generation_reason VARCHAR(50) NOT NULL, -- 'AUTONOMOUS', 'MANUAL', 'API', 'SYSTEM'
    triggered_by VARCHAR(50), -- 'scheduler', 'user_action', 'system_event'
    config_snapshot JSONB, -- Snapshot of config at generation time
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for generation log queries
CREATE INDEX idx_job_generation_log_created_at 
    ON job_generation_log(created_at DESC);

-- Index for finding autonomous jobs
CREATE INDEX idx_job_generation_log_reason 
    ON job_generation_log(generation_reason, created_at DESC);

-- Function: Get current job counts by status
CREATE OR REPLACE FUNCTION get_job_counts_by_status()
RETURNS TABLE (status VARCHAR, count BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pj.status::VARCHAR,
        COUNT(*)::BIGINT
    FROM production_jobs pj
    WHERE pj.status IN ('PENDING', 'QUEUED', 'RUNNING')
    GROUP BY pj.status;
END;
$$ LANGUAGE plpgsql;

-- Function: Check if new jobs should be generated
CREATE OR REPLACE FUNCTION should_generate_jobs(
    p_min_jobs INTEGER DEFAULT 10,
    p_max_jobs INTEGER DEFAULT 50
)
RETURNS BOOLEAN AS $$
DECLARE
    v_current_count INTEGER;
    v_config job_generation_config%ROWTYPE;
BEGIN
    -- Get current config
    SELECT * INTO v_config FROM job_generation_config LIMIT 1;
    
    -- Use provided params or config values
    p_min_jobs := COALESCE(v_config.min_jobs, p_min_jobs);
    p_max_jobs := COALESCE(v_config.max_jobs, p_max_jobs);
    
    -- Count active jobs
    SELECT COUNT(*) INTO v_current_count
    FROM production_jobs
    WHERE status IN ('PENDING', 'QUEUED', 'RUNNING');
    
    -- Generate if below minimum
    RETURN v_current_count < p_min_jobs;
END;
$$ LANGUAGE plpgsql;

-- Function: Generate autonomous job with weighted randomization
CREATE OR REPLACE FUNCTION generate_autonomous_job()
RETURNS UUID AS $$
DECLARE
    v_config job_generation_config%ROWTYPE;
    v_job_id UUID;
    v_is_hot_lot BOOLEAN;
    v_priority INTEGER;
    v_customer VARCHAR(50);
    v_recipe VARCHAR(50);
    v_wafer_count INTEGER;
    v_job_name VARCHAR(100);
    v_deadline TIMESTAMP WITH TIME ZONE;
    v_customers TEXT[];
    v_recipes TEXT[];
    v_weights DECIMAL[];
    v_total_weight DECIMAL;
    v_random DECIMAL;
    v_cumulative DECIMAL;
    v_year INTEGER;
    v_sequence INTEGER;
BEGIN
    -- Get current config
    SELECT * INTO v_config FROM job_generation_config WHERE enabled = true LIMIT 1;
    
    -- If no config or disabled, return null
    IF v_config IS NULL THEN
        RETURN NULL;
    END IF;

    -- Determine if hot lot
    v_is_hot_lot := random() < v_config.hot_lot_probability;
    
    -- Determine priority based on distribution
    v_random := random();
    IF v_random < (v_config.priority_distribution->>'1')::DECIMAL THEN
        v_priority := 1;
    ELSIF v_random < ((v_config.priority_distribution->>'1')::DECIMAL + (v_config.priority_distribution->>'2')::DECIMAL) THEN
        v_priority := 2;
    ELSIF v_random < ((v_config.priority_distribution->>'1')::DECIMAL + (v_config.priority_distribution->>'2')::DECIMAL + (v_config.priority_distribution->>'3')::DECIMAL) THEN
        v_priority := 3;
    ELSIF v_random < ((v_config.priority_distribution->>'1')::DECIMAL + (v_config.priority_distribution->>'2')::DECIMAL + (v_config.priority_distribution->>'3')::DECIMAL + (v_config.priority_distribution->>'4')::DECIMAL) THEN
        v_priority := 4;
    ELSE
        v_priority := 5;
    END IF;
    
    -- Override priority if hot lot
    IF v_is_hot_lot THEN
        v_priority := 1;
    END IF;
    
    -- Select customer based on weights
    v_customers := ARRAY(SELECT jsonb_object_keys(v_config.customer_weights));
    SELECT array_agg((v_config.customer_weights->>k)::DECIMAL) INTO v_weights
    FROM unnest(v_customers) AS k;
    
    SELECT SUM(w) INTO v_total_weight FROM unnest(v_weights) AS w;
    v_random := random() * v_total_weight;
    v_cumulative := 0;
    
    FOR i IN 1..array_length(v_customers, 1) LOOP
        v_cumulative := v_cumulative + v_weights[i];
        IF v_random <= v_cumulative THEN
            v_customer := v_customers[i];
            EXIT;
        END IF;
    END LOOP;
    
    -- Select random recipe
    v_recipes := ARRAY(SELECT jsonb_array_elements_text(v_config.recipe_types));
    v_recipe := v_recipes[1 + floor(random() * array_length(v_recipes, 1))::INTEGER];
    
    -- Generate job parameters
    v_wafer_count := CASE 
        WHEN v_priority = 1 THEN 25  -- Hot lots: 25 wafers
        WHEN v_priority = 2 THEN 20 + floor(random() * 30)::INTEGER  -- 20-50
        WHEN v_priority = 3 THEN 50 + floor(random() * 50)::INTEGER  -- 50-100
        WHEN v_priority = 4 THEN 100 + floor(random() * 100)::INTEGER  -- 100-200
        ELSE 150 + floor(random() * 150)::INTEGER  -- 150-300
    END;
    
    -- Generate job name
    v_year := EXTRACT(YEAR FROM NOW());
    SELECT COALESCE(MAX(CAST(SUBSTRING(job_name FROM '.*-(\d+)$') AS INTEGER)), 1000) + 1
    INTO v_sequence
    FROM production_jobs
    WHERE job_name LIKE 'AUTO-%'
      AND created_at > DATE_TRUNC('day', NOW());
    
    v_job_name := CASE 
        WHEN v_is_hot_lot THEN 'HOT-AUTO-' || v_year || '-' || LPAD(v_sequence::TEXT, 4, '0')
        ELSE 'AUTO-' || v_year || '-' || LPAD(v_sequence::TEXT, 4, '0')
    END;
    
    -- Calculate deadline based on priority
    v_deadline := NOW() + INTERVAL '1 day' * (
        CASE v_priority
            WHEN 1 THEN 1 + random()  -- 1-2 days
            WHEN 2 THEN 2 + random() * 2  -- 2-4 days
            WHEN 3 THEN 3 + random() * 4  -- 3-7 days
            WHEN 4 THEN 5 + random() * 5  -- 5-10 days
            ELSE 7 + random() * 7  -- 7-14 days
        END
    );
    
    -- Insert the job
    INSERT INTO production_jobs (
        job_name, wafer_count, priority_level, status, recipe_type,
        is_hot_lot, customer_tag, deadline, estimated_duration_minutes, created_at, updated_at
    ) VALUES (
        v_job_name, v_wafer_count, v_priority, 'PENDING', v_recipe,
        v_is_hot_lot, v_customer, v_deadline,
        60 + floor(random() * 600)::INTEGER,  -- 1-10 hours
        NOW(), NOW()
    ) RETURNING job_id INTO v_job_id;
    
    -- Log the generation
    INSERT INTO job_generation_log (
        job_id, generation_reason, triggered_by, config_snapshot
    ) VALUES (
        v_job_id, 'AUTONOMOUS', 'scheduler', to_jsonb(v_config)
    );
    
    RETURN v_job_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Batch generate jobs if needed
CREATE OR REPLACE FUNCTION batch_generate_jobs_if_needed(
    p_batch_size INTEGER DEFAULT 5
)
RETURNS INTEGER AS $$
DECLARE
    v_generated INTEGER := 0;
    v_job_id UUID;
BEGIN
    WHILE should_generate_jobs() AND v_generated < p_batch_size LOOP
        v_job_id := generate_autonomous_job();
        IF v_job_id IS NOT NULL THEN
            v_generated := v_generated + 1;
        ELSE
            EXIT;
        END IF;
    END LOOP;
    
    RETURN v_generated;
END;
$$ LANGUAGE plpgsql;

-- RLS for new tables
ALTER TABLE job_generation_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_generation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access" ON job_generation_config FOR SELECT USING (true);
CREATE POLICY "Allow service update" ON job_generation_config FOR UPDATE USING (true);
CREATE POLICY "Allow read access" ON job_generation_log FOR SELECT USING (true);
CREATE POLICY "Allow service insert" ON job_generation_log FOR INSERT WITH CHECK (true);

-- Trigger to auto-update config timestamp
CREATE TRIGGER update_job_generation_config_updated_at
    BEFORE UPDATE ON job_generation_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- REALTIME NOTIFICATIONS SETUP
-- Enable real-time for job changes
-- =====================================================

-- Add realtime publication for production_jobs if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE tablename = 'production_jobs' 
        AND schemaname = 'public'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE production_jobs;
    END IF;
END $$;

-- Add realtime publication for job_generation_log
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE tablename = 'job_generation_log' 
        AND schemaname = 'public'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE job_generation_log;
    END IF;
END $$;