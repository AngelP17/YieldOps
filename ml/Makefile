# YieldOps ML - Jupyter Notebook Makefile
# Provides convenient commands for notebook operations

.PHONY: help install sync export report clean

# Default target
help:
	@echo "YieldOps ML - Available Commands"
	@echo "================================"
	@echo ""
	@echo "Setup:"
	@echo "  make install          Install Python dependencies"
	@echo ""
	@echo "Jupytext (Notebook ↔ Python Sync):"
	@echo "  make sync             Sync all notebooks with Python scripts"
	@echo "  make sync-to-py       Convert notebooks to Python scripts"
	@echo "  make sync-to-ipynb    Convert Python scripts back to notebooks"
	@echo ""
	@echo "nbconvert (Export):"
	@echo "  make export-html      Export all notebooks to HTML"
	@echo "  make export-pdf       Export notebooks to PDF (requires TeX)"
	@echo "  make export-script    Export notebooks to Python scripts"
	@echo ""
	@echo "Papermill (Parameterized Execution):"
	@echo "  make report-scenario-a   Generate report with Scenario A params"
	@echo "  make report-scenario-b   Generate report with Scenario B params"
	@echo "  make report-custom       Generate report with custom params"
	@echo ""
	@echo "Jupyter:"
	@echo "  make jupyter          Start Jupyter Lab"
	@echo "  make jupyter-lab      Start Jupyter Lab (alias)"
	@echo ""
	@echo "Maintenance:"
	@echo "  make clean            Remove generated files"
	@echo "  make clean-outputs    Clear notebook outputs"
	@echo ""

# ============================================
# Setup
# ============================================

install:
	pip install -r requirements.txt
	@echo "✓ Dependencies installed"
	@echo "Enable Jupyter extensions:"
	jupyter nbextension enable --py widgetsnbextension

# ============================================
# Jupytext - Notebook Version Control
# ============================================

# Sync all notebooks - bidirectional
sync:
	@echo "Syncing notebooks ↔ Python scripts..."
	jupytext --sync notebooks/*.ipynb
	@echo "✓ Sync complete"

# Convert notebooks to Python scripts (one-way)
sync-to-py:
	@echo "Converting notebooks to Python scripts..."
	jupytext --to py:percent notebooks/*.ipynb --output notebooks_py/
	@echo "✓ Converted to py:percent format in notebooks_py/"

# Convert Python scripts back to notebooks (one-way)
sync-to-ipynb:
	@echo "Converting Python scripts to notebooks..."
	jupytext --to notebook notebooks_py/*.py --output notebooks/
	@echo "✓ Converted to notebooks"

# Pair a new notebook with Python script
pair:
	@read -p "Enter notebook name (without .ipynb): " name; \
	jupytext --set-formats ipynb,notebooks_py//py:percent notebooks/$$name.ipynb

# ============================================
# nbconvert - Export to Various Formats
# ============================================

# Export all notebooks to HTML
export-html:
	@echo "Exporting notebooks to HTML..."
	mkdir -p reports/html
	jupyter nbconvert --to html notebooks/*.ipynb \
		--output-dir reports/html \
		--template-file config/nbconvert_html.tpl \
		--no-input
	@echo "✓ HTML reports saved to reports/html/"

# Export to PDF (requires TeX installation)
export-pdf:
	@echo "Exporting notebooks to PDF..."
	mkdir -p reports/pdf
	jupyter nbconvert --to pdf notebooks/*.ipynb \
		--output-dir reports/pdf \
		--no-input
	@echo "✓ PDF reports saved to reports/pdf/"

# Export as Python scripts
export-script:
	@echo "Exporting notebooks to Python scripts..."
	mkdir -p scripts/notebooks
	jupyter nbconvert --to script notebooks/*.ipynb --output-dir scripts/notebooks
	@echo "✓ Scripts saved to scripts/notebooks/"

# Export as slides
export-slides:
	@echo "Exporting to slides..."
	mkdir -p reports/slides
	jupyter nbconvert --to slides notebooks/*.ipynb \
		--output-dir reports/slides \
		--TemplateExporter.exclude_input=True
	@echo "✓ Slides saved to reports/slides/"

# ============================================
# Papermill - Parameterized Execution
# ============================================

# Run parameterized report with default parameters
report:
	@echo "Generating capacity report..."
	papermill notebooks/template_capacity_report.ipynb \
		reports/executed/capacity_report_$$(date +%Y%m%d_%H%M%S).ipynb \
		-p TIME_HORIZON_DAYS 30 \
		-p N_SIMULATIONS 5000 \
		-p FABRICATION_LINE "Line-A" \
		-p TARGET_OUTPUT 50000
	@echo "✓ Report generated"

# Scenario A: High throughput target
report-scenario-a:
	@echo "Generating Scenario A report (high target)..."
	mkdir -p reports/executed
	papermill notebooks/template_capacity_report.ipynb \
		reports/executed/capacity_scenario_a_$$(date +%Y%m%d).ipynb \
		-p TIME_HORIZON_DAYS 60 \
		-p N_SIMULATIONS 10000 \
		-p BASE_THROUGHPUT 120 \
		-p EFFICIENCY_MEAN 0.92 \
		-p DOWNTIME_PROB 0.02 \
		-p FABRICATION_LINE "Line-A-Optimized" \
		-p TARGET_OUTPUT 100000 \
		-p REPORT_TITLE "High-Throughput Capacity Analysis"
	@echo "✓ Scenario A report generated"

# Scenario B: Conservative estimate
report-scenario-b:
	@echo "Generating Scenario B report (conservative)..."
	mkdir -p reports/executed
	papermill notebooks/template_capacity_report.ipynb \
		reports/executed/capacity_scenario_b_$$(date +%Y%m%d).ipynb \
		-p TIME_HORIZON_DAYS 30 \
		-p N_SIMULATIONS 10000 \
		-p BASE_THROUGHPUT 90 \
		-p EFFICIENCY_MEAN 0.85 \
		-p DOWNTIME_PROB 0.05 \
		-p FABRICATION_LINE "Line-B-Conservative" \
		-p TARGET_OUTPUT 40000 \
		-p REPORT_TITLE "Conservative Capacity Analysis"
	@echo "✓ Scenario B report generated"

# Run with custom parameters file
report-from-params:
	@read -p "Enter params JSON file path: " params_file; \
	read -p "Enter output name: " output_name; \
	papermill notebooks/template_capacity_report.ipynb \
		reports/executed/$$output_name.ipynb \
		-f $$params_file

# Batch run multiple scenarios
report-batch:
	@echo "Running batch reports..."
	mkdir -p reports/executed
	papermill notebooks/template_capacity_report.ipynb \
		reports/executed/batch_line_a.ipynb \
		-p TIME_HORIZON_DAYS 30 -p FABRICATION_LINE "Line-A" -p TARGET_OUTPUT 50000 &
	papermill notebooks/template_capacity_report.ipynb \
		reports/executed/batch_line_b.ipynb \
		-p TIME_HORIZON_DAYS 30 -p FABRICATION_LINE "Line-B" -p TARGET_OUTPUT 60000 &
	papermill notebooks/template_capacity_report.ipynb \
		reports/executed/batch_line_c.ipynb \
		-p TIME_HORIZON_DAYS 30 -p FABRICATION_LINE "Line-C" -p TARGET_OUTPUT 45000 &
	wait
	@echo "✓ Batch reports complete"

# ============================================
# Jupyter
# ============================================

jupyter:
	jupyter lab notebooks/

jupyter-lab: jupyter

jupyter-notebook:
	jupyter notebook notebooks/

# ============================================
# Maintenance
# ============================================

clean:
	@echo "Cleaning generated files..."
	rm -rf reports/executed/*.ipynb
	rm -rf reports/html/*
	rm -rf reports/pdf/*
	rm -rf notebooks_py/*.py
	rm -rf __pycache__
	find . -name "*.pyc" -delete
	find . -name ".ipynb_checkpoints" -type d -exec rm -rf {} + 2>/dev/null || true
	@echo "✓ Cleaned"

# Clear all notebook outputs (good for git)
clean-outputs:
	@echo "Clearing notebook outputs..."
	jupyter nbconvert --clear-output --inplace notebooks/*.ipynb
	@echo "✓ Outputs cleared"

# Verify notebook integrity
verify:
	@echo "Verifying notebooks..."
	jupyter nbconvert --to notebook --inplace notebooks/*.ipynb --output /dev/null 2>&1 && echo "✓ All notebooks valid" || echo "✗ Some notebooks have errors"
