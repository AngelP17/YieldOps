"""
Notebook Management API

Provides endpoints for executing, exporting, and syncing Jupyter notebooks
using Papermill, nbconvert, and Jupytext.
"""

import os
import subprocess
import json
import sys
import html
from importlib.util import find_spec
from pathlib import Path
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, BackgroundTasks, Request
from pydantic import BaseModel
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

# Configuration - use environment variable or default to project root
PROJECT_ROOT = Path(os.getenv("PROJECT_ROOT", Path(__file__).parent.parent.parent.parent.parent))
NOTEBOOKS_DIR = PROJECT_ROOT / "ml" / "notebooks"
REPORTS_DIR = PROJECT_ROOT / "ml" / "reports"
SCRIPTS_DIR = PROJECT_ROOT / "ml" / "scripts"

# Ensure directories exist (only if writable)
try:
    NOTEBOOKS_DIR.mkdir(parents=True, exist_ok=True)
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    SCRIPTS_DIR.mkdir(parents=True, exist_ok=True)
except PermissionError:
    # Running in read-only environment (e.g., Koyeb) - use temp directories
    import tempfile
    TEMP_ROOT = Path(tempfile.gettempdir()) / "yieldops"
    NOTEBOOKS_DIR = TEMP_ROOT / "notebooks"
    REPORTS_DIR = TEMP_ROOT / "reports"
    SCRIPTS_DIR = TEMP_ROOT / "scripts"
    NOTEBOOKS_DIR.mkdir(parents=True, exist_ok=True)
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    SCRIPTS_DIR.mkdir(parents=True, exist_ok=True)
    logger.warning(f"Using temp directories: {TEMP_ROOT}")

# Create default notebook if none exist
def create_default_notebook():
    """Create a sample analysis notebook if notebooks directory is empty"""
    if list(NOTEBOOKS_DIR.glob("*.ipynb")):
        return
    
    default_notebook = {
        "cells": [
            {
                "cell_type": "markdown",
                "metadata": {},
                "source": ["# YieldOps Fab Analysis\n", "\n", "This notebook analyzes fab production metrics."]
            },
            {
                "cell_type": "code",
                "execution_count": None,
                "metadata": {},
                "outputs": [],
                "source": [
                    "import pandas as pd\n",
                    "import matplotlib.pyplot as plt\n",
                    "\n",
                    "# Parameters (injected by Papermill)\n",
                    "demand_growth = 1.05\n",
                    "efficiency_improvement = 1.02\n",
                    "yield_target = 0.95\n",
                    "planning_horizon_months = 12\n",
                    "capacity_buffer = 0.15"
                ]
            },
            {
                "cell_type": "code",
                "execution_count": None,
                "metadata": {},
                "outputs": [],
                "source": [
                    "# Calculate projected throughput\n",
                    "base_throughput = 1000  # wafers/month\n",
                    "projected = base_throughput * (demand_growth ** (planning_horizon_months/12))\n",
                    "print(f'Projected throughput: {projected:.0f} wafers/month')\n",
                    "print(f'Yield target: {yield_target:.0%}')\n",
                    "print(f'Capacity buffer: {capacity_buffer:.0%}')"
                ]
            }
        ],
        "metadata": {
            "kernelspec": {
                "display_name": "Python 3",
                "language": "python",
                "name": "python3"
            },
            "language_info": {
                "name": "python",
                "version": "3.11"
            }
        },
        "nbformat": 4,
        "nbformat_minor": 4
    }
    
    try:
        notebook_path = NOTEBOOKS_DIR / "fab_analysis.ipynb"
        with open(notebook_path, 'w') as f:
            json.dump(default_notebook, f, indent=2)
        logger.info(f"Created default notebook: {notebook_path}")
    except Exception as e:
        logger.warning(f"Could not create default notebook: {e}")

# Create default notebook on module load
create_default_notebook()

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


def display_path(path: Path) -> str:
    """Return a stable display path even when working from temp dirs."""
    try:
        return str(path.relative_to(PROJECT_ROOT))
    except ValueError:
        return str(path)


def module_missing(*modules: str) -> List[str]:
    return [module for module in modules if find_spec(module) is None]


def python_module_cmd(module: str, args: List[str]) -> List[str]:
    """Use the current interpreter to avoid calling a different python binary."""
    return [sys.executable, "-m", module, *args]


def notebook_to_script(notebook_path: Path, script_path: Path) -> None:
    """Fallback conversion from .ipynb to .py when jupytext is unavailable."""
    with open(notebook_path, "r", encoding="utf-8") as f:
        notebook = json.load(f)
    lines = [
        "# Auto-generated from notebook",
        "",
    ]
    for cell in notebook.get("cells", []):
        if cell.get("cell_type") != "code":
            continue
        source = cell.get("source", [])
        if isinstance(source, list):
            lines.extend([str(s).rstrip("\n") for s in source])
        else:
            lines.append(str(source).rstrip("\n"))
        lines.append("")
    script_path.parent.mkdir(parents=True, exist_ok=True)
    with open(script_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines).rstrip() + "\n")


def script_to_notebook(script_path: Path, notebook_path: Path) -> None:
    """Fallback conversion from .py to one-cell .ipynb."""
    with open(script_path, "r", encoding="utf-8") as f:
        code = f.read()
    notebook = {
        "cells": [
            {
                "cell_type": "code",
                "execution_count": None,
                "metadata": {},
                "outputs": [],
                "source": code.splitlines(keepends=True),
            }
        ],
        "metadata": {
            "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
            "language_info": {"name": "python", "version": "3.11"},
        },
        "nbformat": 4,
        "nbformat_minor": 4,
    }
    notebook_path.parent.mkdir(parents=True, exist_ok=True)
    with open(notebook_path, "w", encoding="utf-8") as f:
        json.dump(notebook, f, indent=2)


def notebook_to_basic_html(notebook_path: Path, html_path: Path) -> None:
    """Fallback HTML export when nbconvert is unavailable."""
    with open(notebook_path, "r", encoding="utf-8") as f:
        notebook = json.load(f)

    parts = [
        "<!doctype html>",
        "<html><head><meta charset='utf-8'><title>Notebook Export</title></head><body>",
        f"<h1>{html.escape(notebook_path.stem)}</h1>",
    ]
    for cell in notebook.get("cells", []):
        source = cell.get("source", [])
        if isinstance(source, list):
            text = "".join(source)
        else:
            text = str(source)
        if cell.get("cell_type") == "markdown":
            parts.append(f"<section><pre>{html.escape(text)}</pre></section>")
        else:
            parts.append(f"<section><h3>Code</h3><pre>{html.escape(text)}</pre></section>")
    parts.append("</body></html>")

    html_path.parent.mkdir(parents=True, exist_ok=True)
    with open(html_path, "w", encoding="utf-8") as f:
        f.write("\n".join(parts))


def find_notebooks() -> List[NotebookInfo]:
    """Find all notebooks in the notebooks directory"""
    from datetime import datetime
    notebooks = []
    if NOTEBOOKS_DIR.exists():
        for notebook_file in sorted(NOTEBOOKS_DIR.glob("*.ipynb")):
            stat = notebook_file.stat()
            # Convert timestamp to ISO format string
            last_modified_str = datetime.fromtimestamp(stat.st_mtime).isoformat()
            notebooks.append(NotebookInfo(
                name=notebook_file.stem,
                path=display_path(notebook_file),
                description=get_notebook_description(notebook_file),
                last_modified=last_modified_str
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
    from datetime import datetime
    reports = []
    if REPORTS_DIR.exists():
        for report_file in sorted(REPORTS_DIR.iterdir(), key=lambda x: x.stat().st_mtime, reverse=True):
            if report_file.is_file():
                stat = report_file.stat()
                # Convert timestamp to ISO format string
                created_at_str = datetime.fromtimestamp(stat.st_mtime).isoformat()
                reports.append(ReportInfo(
                    name=report_file.name,
                    path=display_path(report_file),
                    created_at=created_at_str,
                    size_bytes=stat.st_size,
                    format=report_file.suffix.lstrip('.')
                ))
    return reports


@router.get("/list")
async def list_notebooks():
    """List all available notebooks"""
    try:
        return find_notebooks()
    except Exception as e:
        logger.error(f"Error listing notebooks: {e}")
        return []


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
        missing = module_missing("papermill")
        if missing:
            return NotebookExecutionResponse(
                success=False,
                message=f"Notebook execution unavailable on server. Missing Python module(s): {', '.join(missing)}",
                output_path=None
            )

        # Build papermill command
        cmd = python_module_cmd("papermill", [
            str(notebook_path),
            str(output_path),
            "--parameters_file", "-"
        ])
        
        # Run papermill with parameters
        params_json = json.dumps(params)
        result = subprocess.run(
            cmd,
            input=params_json,
            capture_output=True,
            text=True,
            timeout=300,  # 5 minute timeout
            cwd=str(PROJECT_ROOT)
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
        if module_missing("jupyter"):
            notebook_to_basic_html(output_path, html_output)
        else:
            export_cmd = python_module_cmd("jupyter", [
                "nbconvert",
                "--to", "html",
                "--output", str(html_output),
                str(output_path)
            ])
            subprocess.run(export_cmd, capture_output=True, timeout=60)
        
        return NotebookExecutionResponse(
            success=True,
            message=f"Notebook executed successfully with {request.scenario} scenario",
            output_path=display_path(output_path),
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
        if request.format == "script":
            notebook_to_script(notebook_path, output_path)
            return NotebookExecutionResponse(
                success=True,
                message="Notebook exported to PY",
                output_path=display_path(output_path),
                report_url=None
            )

        if request.format == "html" and module_missing("jupyter"):
            notebook_to_basic_html(notebook_path, output_path)
            return NotebookExecutionResponse(
                success=True,
                message="Notebook exported to HTML (basic renderer)",
                output_path=display_path(output_path),
                report_url=None
            )

        missing = module_missing("jupyter")
        if missing:
            return NotebookExecutionResponse(
                success=False,
                message=f"Export unavailable on server for format '{request.format}'. Missing Python module(s): {', '.join(missing)}",
                output_path=None
            )

        cmd = python_module_cmd("jupyter", [
            "nbconvert",
            "--to", request.format,
            "--output", str(output_path),
            str(notebook_path)
        ])
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=60,
            cwd=str(PROJECT_ROOT)
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
            output_path=display_path(output_path),
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
        jupytext_missing = module_missing("jupytext")

        if request.direction in ["both", "to_scripts"]:
            # Sync notebooks to scripts
            for notebook_file in NOTEBOOKS_DIR.glob("*.ipynb"):
                script_path = SCRIPTS_DIR / f"{notebook_file.stem}.py"
                if jupytext_missing:
                    notebook_to_script(notebook_file, script_path)
                else:
                    cmd = python_module_cmd("jupytext", [
                        "--to", "py:percent",
                        "--output", str(script_path),
                        str(notebook_file)
                    ])
                    subprocess.run(cmd, capture_output=True, timeout=30)
        
        if request.direction in ["both", "to_notebooks"]:
            # Sync scripts to notebooks
            for script_file in SCRIPTS_DIR.glob("*.py"):
                notebook_path = NOTEBOOKS_DIR / f"{script_file.stem}.ipynb"
                if jupytext_missing:
                    script_to_notebook(script_file, notebook_path)
                else:
                    cmd = python_module_cmd("jupytext", [
                        "--to", "notebook",
                        "--output", str(notebook_path),
                        str(script_file)
                    ])
                    subprocess.run(cmd, capture_output=True, timeout=30)
        
        direction_msg = {
            "both": "Bidirectional sync completed",
            "to_scripts": "Notebooks synced to scripts",
            "to_notebooks": "Scripts synced to notebooks"
        }
        
        return NotebookExecutionResponse(
            success=True,
            message=(
                f"{direction_msg.get(request.direction, 'Sync completed')} "
                "(using fallback converter)" if jupytext_missing else direction_msg.get(request.direction, "Sync completed")
            ),
            output_path=display_path(SCRIPTS_DIR)
        )
        
    except Exception as e:
        logger.error(f"Error syncing notebooks: {e}")
        return NotebookExecutionResponse(
            success=False,
            message=f"Error: {str(e)}",
            output_path=None
        )


@router.post("/launch-jupyter")
async def launch_jupyter(request: Request):
    """
    Launch Jupyter Lab.
    Returns the URL where Jupyter is accessible.
    """
    try:
        if request.url.hostname not in ("localhost", "127.0.0.1"):
            return {
                "success": False,
                "message": "Jupyter Lab launch is only supported in local development. Use execute/export from this tab in production."
            }

        missing = module_missing("jupyter")
        if missing:
            return {
                "success": False,
                "message": f"Jupyter Lab is unavailable. Missing Python module(s): {', '.join(missing)}"
            }

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
            python_module_cmd("jupyter", [
                "lab",
                f"--notebook-dir={PROJECT_ROOT / 'ml'}",
                "--no-browser",
                "--port=8888",
                "--ip=0.0.0.0",
                "--allow-root"
            ]),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            cwd=str(PROJECT_ROOT)
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
