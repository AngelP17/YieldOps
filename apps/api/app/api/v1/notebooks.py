"""
Notebook Management API

Provides endpoints for executing, exporting, and syncing Jupyter notebooks
using Papermill, nbconvert, and Jupytext.
"""

import os
import subprocess
import json
from pathlib import Path
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

# Configuration
NOTEBOOKS_DIR = Path("/Users/angell_pt/Desktop/YieldOps/ml/notebooks")
REPORTS_DIR = Path("/Users/angell_pt/Desktop/YieldOps/ml/reports")
SCRIPTS_DIR = Path("/Users/angell_pt/Desktop/YieldOps/ml/scripts")

# Ensure directories exist
NOTEBOOKS_DIR.mkdir(parents=True, exist_ok=True)
REPORTS_DIR.mkdir(parents=True, exist_ok=True)
SCRIPTS_DIR.mkdir(parents=True, exist_ok=True)

# Predefined scenarios
PREDEFINED_SCENARIOS = {
    "base": {
        "name": "Base Case",
        "description": "Standard operating parameters",
        "params": {
            "demand_growth": 1.05,
            "efficiency_improvement": 1.02,
            "yield_target": 0.95,
            "planning_horizon_months": 12,
            "capacity_buffer": 0.15
        }
    },
    "scenario_a": {
        "name": "Scenario A - High Demand",
        "description": "Aggressive demand growth scenario",
        "params": {
            "demand_growth": 1.15,
            "efficiency_improvement": 1.03,
            "yield_target": 0.96,
            "planning_horizon_months": 12,
            "capacity_buffer": 0.10
        }
    },
    "scenario_b": {
        "name": "Scenario B - Conservative",
        "description": "Conservative growth with focus on yield",
        "params": {
            "demand_growth": 1.03,
            "efficiency_improvement": 1.01,
            "yield_target": 0.98,
            "planning_horizon_months": 18,
            "capacity_buffer": 0.20
        }
    },
    "conservative": {
        "name": "Conservative",
        "description": "Minimal risk approach",
        "params": {
            "demand_growth": 1.02,
            "efficiency_improvement": 1.01,
            "yield_target": 0.97,
            "planning_horizon_months": 24,
            "capacity_buffer": 0.25
        }
    },
    "optimistic": {
        "name": "Optimistic",
        "description": "Aggressive growth with high efficiency",
        "params": {
            "demand_growth": 1.20,
            "efficiency_improvement": 1.05,
            "yield_target": 0.95,
            "planning_horizon_months": 12,
            "capacity_buffer": 0.10
        }
    }
}


class NotebookInfo(BaseModel):
    """Notebook metadata"""
    name: str
    path: str
    description: Optional[str] = None
    last_modified: Optional[str] = None


class ExecuteNotebookRequest(BaseModel):
    """Request to execute a notebook"""
    notebook_name: str
    scenario: str = "base"
    custom_params: Optional[Dict[str, Any]] = None
    output_name: Optional[str] = None


class ExportNotebookRequest(BaseModel):
    """Request to export a notebook"""
    notebook_name: str
    format: str  # html, pdf, script, slides
    output_name: Optional[str] = None


class SyncNotebooksRequest(BaseModel):
    """Request to sync notebooks with scripts"""
    direction: str = "both"  # both, to_scripts, to_notebooks


class NotebookExecutionResponse(BaseModel):
    """Response from notebook execution"""
    success: bool
    message: str
    output_path: Optional[str] = None
    report_url: Optional[str] = None


class ReportInfo(BaseModel):
    """Generated report metadata"""
    name: str
    path: str
    created_at: str
    size_bytes: int
    format: str


def find_notebooks() -> List[NotebookInfo]:
    """Find all notebooks in the notebooks directory"""
    notebooks = []
    if NOTEBOOKS_DIR.exists():
        for notebook_file in sorted(NOTEBOOKS_DIR.glob("*.ipynb")):
            stat = notebook_file.stat()
            notebooks.append(NotebookInfo(
                name=notebook_file.stem,
                path=str(notebook_file.relative_to(Path("/Users/angell_pt/Desktop/YieldOps"))),
                description=get_notebook_description(notebook_file),
                last_modified=stat.st_mtime
            ))
    return notebooks


def get_notebook_description(notebook_path: Path) -> Optional[str]:
    """Extract description from notebook metadata"""
    try:
        with open(notebook_path, 'r') as f:
            nb = json.load(f)
            # Try to get first markdown cell as description
            for cell in nb.get('cells', []):
                if cell.get('cell_type') == 'markdown':
                    source = ''.join(cell.get('source', []))
                    if source.strip():
                        return source.strip()[:100] + "..." if len(source) > 100 else source.strip()
    except Exception:
        pass
    return None


def find_reports() -> List[ReportInfo]:
    """Find all generated reports"""
    reports = []
    if REPORTS_DIR.exists():
        for report_file in sorted(REPORTS_DIR.iterdir(), key=lambda x: x.stat().st_mtime, reverse=True):
            if report_file.is_file():
                stat = report_file.stat()
                reports.append(ReportInfo(
                    name=report_file.name,
                    path=str(report_file.relative_to(Path("/Users/angell_pt/Desktop/YieldOps"))),
                    created_at=stat.st_mtime,
                    size_bytes=stat.st_size,
                    format=report_file.suffix.lstrip('.')
                ))
    return reports


@router.get("/list", response_model=List[NotebookInfo])
async def list_notebooks():
    """List all available notebooks"""
    return find_notebooks()


@router.get("/scenarios")
async def get_scenarios():
    """Get predefined parameter scenarios"""
    return PREDEFINED_SCENARIOS


@router.post("/execute", response_model=NotebookExecutionResponse)
async def execute_notebook(
    request: ExecuteNotebookRequest,
    background_tasks: BackgroundTasks
):
    """
    Execute a notebook with Papermill using predefined or custom parameters.
    Equivalent to: make report-scenario-a, make report-scenario-b
    """
    notebook_path = NOTEBOOKS_DIR / f"{request.notebook_name}.ipynb"
    
    if not notebook_path.exists():
        raise HTTPException(status_code=404, detail=f"Notebook {request.notebook_name} not found")
    
    # Get parameters
    if request.scenario in PREDEFINED_SCENARIOS:
        params = PREDEFINED_SCENARIOS[request.scenario]["params"].copy()
    else:
        params = {}
    
    # Override with custom params
    if request.custom_params:
        params.update(request.custom_params)
    
    # Generate output name
    timestamp = int(os.path.getmtime(notebook_path))
    if request.output_name:
        output_name = f"{request.output_name}_{request.scenario}_{timestamp}"
    else:
        output_name = f"{request.notebook_name}_{request.scenario}_{timestamp}"
    
    output_path = REPORTS_DIR / f"{output_name}.ipynb"
    
    try:
        # Build papermill command
        cmd = [
            "python", "-m", "papermill",
            str(notebook_path),
            str(output_path),
            "--parameters_file", "-"
        ]
        
        # Run papermill with parameters
        params_json = json.dumps(params)
        result = subprocess.run(
            cmd,
            input=params_json,
            capture_output=True,
            text=True,
            timeout=300,  # 5 minute timeout
            cwd="/Users/angell_pt/Desktop/YieldOps"
        )
        
        if result.returncode != 0:
            logger.error(f"Papermill error: {result.stderr}")
            return NotebookExecutionResponse(
                success=False,
                message=f"Execution failed: {result.stderr}",
                output_path=None
            )
        
        # Also export to HTML
        html_output = REPORTS_DIR / f"{output_name}.html"
        export_cmd = [
            "python", "-m", "jupyter", "nbconvert",
            "--to", "html",
            "--output", str(html_output),
            str(output_path)
        ]
        
        subprocess.run(export_cmd, capture_output=True, timeout=60)
        
        return NotebookExecutionResponse(
            success=True,
            message=f"Notebook executed successfully with {request.scenario} scenario",
            output_path=str(output_path.relative_to(Path("/Users/angell_pt/Desktop/YieldOps"))),
            report_url=f"/api/v1/notebooks/reports/{output_name}.html"
        )
        
    except subprocess.TimeoutExpired:
        return NotebookExecutionResponse(
            success=False,
            message="Execution timed out after 5 minutes",
            output_path=None
        )
    except Exception as e:
        logger.error(f"Error executing notebook: {e}")
        return NotebookExecutionResponse(
            success=False,
            message=f"Error: {str(e)}",
            output_path=None
        )


@router.post("/export", response_model=NotebookExecutionResponse)
async def export_notebook(request: ExportNotebookRequest):
    """
    Export a notebook to various formats.
    Equivalent to: make export-html
    """
    notebook_path = NOTEBOOKS_DIR / f"{request.notebook_name}.ipynb"
    
    if not notebook_path.exists():
        raise HTTPException(status_code=404, detail=f"Notebook {request.notebook_name} not found")
    
    valid_formats = ["html", "pdf", "script", "slides", "markdown"]
    if request.format not in valid_formats:
        raise HTTPException(status_code=400, detail=f"Invalid format. Must be one of: {valid_formats}")
    
    # Generate output name
    timestamp = int(os.path.getmtime(notebook_path))
    if request.output_name:
        output_name = f"{request.output_name}_{timestamp}"
    else:
        output_name = f"{request.notebook_name}_{timestamp}"
    
    output_path = REPORTS_DIR / f"{output_name}.{request.format if request.format != 'script' else 'py'}"
    
    try:
        cmd = [
            "python", "-m", "jupyter", "nbconvert",
            "--to", request.format,
            "--output", str(output_path),
            str(notebook_path)
        ]
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=60,
            cwd="/Users/angell_pt/Desktop/YieldOps"
        )
        
        if result.returncode != 0:
            return NotebookExecutionResponse(
                success=False,
                message=f"Export failed: {result.stderr}",
                output_path=None
            )
        
        return NotebookExecutionResponse(
            success=True,
            message=f"Notebook exported to {request.format.upper()}",
            output_path=str(output_path.relative_to(Path("/Users/angell_pt/Desktop/YieldOps"))),
            report_url=None
        )
        
    except Exception as e:
        logger.error(f"Error exporting notebook: {e}")
        return NotebookExecutionResponse(
            success=False,
            message=f"Error: {str(e)}",
            output_path=None
        )


@router.post("/sync", response_model=NotebookExecutionResponse)
async def sync_notebooks(request: SyncNotebooksRequest):
    """
    Sync notebooks with Python scripts using Jupytext.
    Equivalent to: make sync
    """
    try:
        if request.direction in ["both", "to_scripts"]:
            # Sync notebooks to scripts
            for notebook_file in NOTEBOOKS_DIR.glob("*.ipynb"):
                script_path = SCRIPTS_DIR / f"{notebook_file.stem}.py"
                cmd = [
                    "python", "-m", "jupytext",
                    "--to", "py:percent",
                    "--output", str(script_path),
                    str(notebook_file)
                ]
                subprocess.run(cmd, capture_output=True, timeout=30)
        
        if request.direction in ["both", "to_notebooks"]:
            # Sync scripts to notebooks
            for script_file in SCRIPTS_DIR.glob("*.py"):
                notebook_path = NOTEBOOKS_DIR / f"{script_file.stem}.ipynb"
                cmd = [
                    "python", "-m", "jupytext",
                    "--to", "notebook",
                    "--output", str(notebook_path),
                    str(script_file)
                ]
                subprocess.run(cmd, capture_output=True, timeout=30)
        
        direction_msg = {
            "both": "Bidirectional sync completed",
            "to_scripts": "Notebooks synced to scripts",
            "to_notebooks": "Scripts synced to notebooks"
        }
        
        return NotebookExecutionResponse(
            success=True,
            message=direction_msg.get(request.direction, "Sync completed"),
            output_path=str(SCRIPTS_DIR.relative_to(Path("/Users/angell_pt/Desktop/YieldOps")))
        )
        
    except Exception as e:
        logger.error(f"Error syncing notebooks: {e}")
        return NotebookExecutionResponse(
            success=False,
            message=f"Error: {str(e)}",
            output_path=None
        )


@router.post("/launch-jupyter")
async def launch_jupyter():
    """
    Launch Jupyter Lab.
    Returns the URL where Jupyter is accessible.
    """
    try:
        # Check if Jupyter is already running
        cmd = ["pgrep", "-f", "jupyter-lab"]
        result = subprocess.run(cmd, capture_output=True)
        
        if result.returncode == 0:
            return {
                "success": True,
                "message": "Jupyter Lab is already running",
                "url": "http://localhost:8888"
            }
        
        # Start Jupyter Lab in background
        subprocess.Popen(
            [
                "python", "-m", "jupyter", "lab",
                "--notebook-dir=/Users/angell_pt/Desktop/YieldOps/ml",
                "--no-browser",
                "--port=8888",
                "--ip=0.0.0.0",
                "--allow-root"
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            cwd="/Users/angell_pt/Desktop/YieldOps"
        )
        
        return {
            "success": True,
            "message": "Jupyter Lab starting...",
            "url": "http://localhost:8888"
        }
        
    except Exception as e:
        logger.error(f"Error launching Jupyter: {e}")
        return {
            "success": False,
            "message": f"Error: {str(e)}"
        }


@router.get("/reports", response_model=List[ReportInfo])
async def list_reports():
    """List all generated reports"""
    return find_reports()


@router.get("/reports/{report_name}")
async def get_report(report_name: str):
    """Get a specific report file"""
    report_path = REPORTS_DIR / report_name
    
    if not report_path.exists():
        raise HTTPException(status_code=404, detail="Report not found")
    
    from fastapi.responses import FileResponse
    return FileResponse(
        report_path,
        filename=report_name,
        media_type="application/octet-stream"
    )
