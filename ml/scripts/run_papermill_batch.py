#!/usr/bin/env python3
"""
Batch execution script for Papermill parameterized notebooks.

This script demonstrates how to run multiple scenarios programmatically
using the papermill Python API.
"""

import papermill as pm
import os
from datetime import datetime
import json
from pathlib import Path


def ensure_dir(path):
    """Create directory if it doesn't exist."""
    Path(path).mkdir(parents=True, exist_ok=True)


def run_single_scenario(template_path, output_path, params):
    """Execute a single notebook with given parameters."""
    print(f"\n{'='*60}")
    print(f"Running: {params.get('FABRICATION_LINE', 'Unknown')}")
    print(f"Output: {output_path}")
    print(f"{'='*60}")
    
    try:
        pm.execute_notebook(
            template_path,
            output_path,
            parameters=params,
            progress_bar=True,
            report_mode=True  # Skip error cells on failure
        )
        print(f"✓ Success: {output_path}")
        return True
    except Exception as e:
        print(f"✗ Failed: {e}")
        return False


def run_batch_from_config(config_file):
    """Run scenarios defined in a JSON config file."""
    with open(config_file, 'r') as f:
        config = json.load(f)
    
    template = config.get('template', 'notebooks/template_capacity_report.ipynb')
    output_dir = config.get('output_dir', 'reports/executed')
    scenarios = config.get('scenarios', [])
    
    ensure_dir(output_dir)
    
    results = []
    for scenario in scenarios:
        name = scenario.get('name', 'unnamed')
        params = scenario.get('params', {})
        output_path = os.path.join(output_dir, f"{name}_{datetime.now().strftime('%Y%m%d')}.ipynb")
        
        success = run_single_scenario(template, output_path, params)
        results.append({'name': name, 'success': success, 'output': output_path})
    
    return results


def run_parallel_scenarios(template_path, base_params, variations, output_dir='reports/executed'):
    """Run multiple scenarios in parallel with different parameter variations."""
    from concurrent.futures import ProcessPoolExecutor, as_completed
    
    ensure_dir(output_dir)
    
    def run_one(variation):
        name, param_changes = variation
        params = {**base_params, **param_changes}
        output_path = os.path.join(output_dir, f"{name}_{datetime.now().strftime('%Y%m%d')}.ipynb")
        success = run_single_scenario(template_path, output_path, params)
        return {'name': name, 'success': success, 'output': output_path}
    
    # Sequential execution (parallel with papermill can be tricky due to cell execution)
    results = []
    for variation in variations:
        results.append(run_one(variation))
    
    return results


def main():
    """Main execution with example scenarios."""
    
    # Define base parameters
    base_params = {
        'TIME_HORIZON_DAYS': 30,
        'N_SIMULATIONS': 5000,
        'RANDOM_SEED': 42,
        'BASE_THROUGHPUT': 100,
        'EFFICIENCY_MEAN': 0.90,
        'DOWNTIME_PROB': 0.03,
        'TARGET_OUTPUT': 50000,
        'SAVE_PLOTS': True
    }
    
    # Define scenario variations
    scenarios = [
        ('line_a_base', {
            'FABRICATION_LINE': 'Line-A',
            'REPORT_TITLE': 'Line A - Baseline Analysis'
        }),
        ('line_a_optimized', {
            'FABRICATION_LINE': 'Line-A-Optimized',
            'EFFICIENCY_MEAN': 0.94,
            'DOWNTIME_PROB': 0.02,
            'TARGET_OUTPUT': 60000,
            'REPORT_TITLE': 'Line A - Optimized Analysis'
        }),
        ('line_b_conservative', {
            'FABRICATION_LINE': 'Line-B',
            'EFFICIENCY_MEAN': 0.85,
            'DOWNTIME_PROB': 0.05,
            'TARGET_OUTPUT': 40000,
            'REPORT_TITLE': 'Line B - Conservative Analysis'
        }),
        ('line_c_extended', {
            'FABRICATION_LINE': 'Line-C',
            'TIME_HORIZON_DAYS': 60,
            'N_SIMULATIONS': 10000,
            'TARGET_OUTPUT': 100000,
            'REPORT_TITLE': 'Line C - Extended Horizon Analysis'
        })
    ]
    
    template_path = 'notebooks/template_capacity_report.ipynb'
    output_dir = 'reports/executed'
    
    print("Starting batch execution...")
    print(f"Template: {template_path}")
    print(f"Output directory: {output_dir}")
    print(f"Scenarios: {len(scenarios)}")
    
    # Run all scenarios
    results = run_parallel_scenarios(template_path, base_params, scenarios, output_dir)
    
    # Print summary
    print(f"\n{'='*60}")
    print("BATCH EXECUTION SUMMARY")
    print(f"{'='*60}")
    
    successful = sum(1 for r in results if r['success'])
    failed = len(results) - successful
    
    for r in results:
        status = "✓" if r['success'] else "✗"
        print(f"{status} {r['name']}: {r['output']}")
    
    print(f"\nTotal: {len(results)} | Successful: {successful} | Failed: {failed}")
    
    return results


def export_to_html(notebook_path, output_dir='reports/html'):
    """Convert executed notebook to HTML."""
    import subprocess
    
    ensure_dir(output_dir)
    
    cmd = [
        'jupyter', 'nbconvert',
        '--to', 'html',
        '--no-input',
        '--output-dir', output_dir,
        notebook_path
    ]
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    if result.returncode == 0:
        print(f"✓ Exported to HTML: {output_dir}")
    else:
        print(f"✗ Export failed: {result.stderr}")
    
    return result.returncode == 0


if __name__ == '__main__':
    # Change to ml directory
    os.chdir(Path(__file__).parent.parent)
    
    # Run batch
    results = main()
    
    # Optionally export successful runs to HTML
    export_html = input("\nExport successful notebooks to HTML? (y/n): ").lower().strip() == 'y'
    
    if export_html:
        for r in results:
            if r['success']:
                export_to_html(r['output'])
