-- =====================================================
-- MIGRATION 002: Virtual Metrology Tables
-- Adds tables for VM predictions, metrology results,
-- and Run-to-Run recipe adjustments
-- =====================================================

-- =====================================================
-- TABLE: metrology_results
-- Purpose: Actual inline metrology measurements
-- =====================================================
CREATE TABLE IF NOT EXISTS metrology_results (
    result_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lot_id VARCHAR(50) NOT NULL,
    tool_id UUID NOT NULL REFERENCES machines(machine_id) ON DELETE CASCADE,
    thickness_nm DECIMAL(8,2) NOT NULL,
    uniformity_pct DECIMAL(5,2),
    measured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_metrology_results_tool_time
    ON metrology_results(tool_id, measured_at DESC);

COMMENT ON TABLE metrology_results IS 'Inline metrology measurements (film thickness, uniformity)';

-- =====================================================
-- TABLE: vm_predictions
-- Purpose: Virtual Metrology model predictions
-- =====================================================
CREATE TABLE IF NOT EXISTS vm_predictions (
    prediction_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lot_id VARCHAR(50) NOT NULL,
    tool_id UUID NOT NULL REFERENCES machines(machine_id) ON DELETE CASCADE,
    predicted_thickness_nm DECIMAL(8,2) NOT NULL,
    confidence_score DECIMAL(5,4) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
    model_version VARCHAR(20) DEFAULT '1.0.0',
    features_used JSONB,
    actual_thickness_nm DECIMAL(8,2),
    prediction_error DECIMAL(8,4),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vm_predictions_tool_time
    ON vm_predictions(tool_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vm_predictions_lot
    ON vm_predictions(lot_id);

COMMENT ON TABLE vm_predictions IS 'Virtual Metrology predictions from Ridge regression model';

-- =====================================================
-- TABLE: recipe_adjustments
-- Purpose: Run-to-Run EWMA-based recipe corrections
-- =====================================================
CREATE TABLE IF NOT EXISTS recipe_adjustments (
    adjustment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tool_id UUID NOT NULL REFERENCES machines(machine_id) ON DELETE CASCADE,
    lot_id VARCHAR(50),
    parameter_name VARCHAR(50) NOT NULL,
    current_value DECIMAL(10,4) NOT NULL DEFAULT 0,
    adjustment_value DECIMAL(10,4) NOT NULL,
    new_value DECIMAL(10,4) NOT NULL DEFAULT 0,
    reason TEXT,
    applied BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recipe_adjustments_tool_time
    ON recipe_adjustments(tool_id, created_at DESC);

COMMENT ON TABLE recipe_adjustments IS 'EWMA-based Run-to-Run recipe corrections';

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE metrology_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE vm_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access" ON metrology_results FOR SELECT USING (true);
CREATE POLICY "Allow service insert" ON metrology_results FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow read access" ON vm_predictions FOR SELECT USING (true);
CREATE POLICY "Allow service insert" ON vm_predictions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow service update" ON vm_predictions FOR UPDATE USING (true);

CREATE POLICY "Allow read access" ON recipe_adjustments FOR SELECT USING (true);
CREATE POLICY "Allow service insert" ON recipe_adjustments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow service update" ON recipe_adjustments FOR UPDATE USING (true);
