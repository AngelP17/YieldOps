# YieldOps ML - Enhanced Jupyter Notebooks

This directory contains machine learning notebooks with enhanced features for semiconductor fab capacity planning and anomaly detection.

## 🚀 Features

| Feature | Purpose | Tool |
|---------|---------|------|
| **Interactive Widgets** | Real-time parameter adjustment with sliders, buttons | `ipywidgets` |
| **Parameterized Execution** | Run same notebook with different inputs | `papermill` |
| **Export to HTML/PDF** | Generate static reports for sharing | `nbconvert` |
| **Notebook Sync** | Version control notebooks as Python scripts | `jupytext` |

---

## 📦 Installation

```bash
# Install all dependencies
make install

# Or manually:
pip install -r requirements.txt
jupyter nbextension enable --py widgetsnbextension
```

---

## 🎛️ 1. Interactive Widgets (`ipywidgets`)

### What it does
Add interactive sliders, buttons, dropdowns to your notebooks for real-time exploration.

### Example Notebooks
- `interactive_capacity_planning.ipynb` - Interactive Monte Carlo simulation

### Quick Example
```python
from ipywidgets import interact, widgets

@interact(days=(7, 90, 7), n_sims=(1000, 20000, 1000))
def run_analysis(days=30, n_sims=5000):
    results = monte_carlo_sim(days, n_sims)
    plot_results(results)
```

### Key Widgets Available
| Widget | Use Case |
|--------|----------|
| `IntSlider` / `FloatSlider` | Numeric parameters (throughput, efficiency) |
| `Dropdown` | Select analysis type, machine, etc. |
| `SelectMultiple` | Choose multiple machines |
| `ToggleButton` | Boolean flags (show/hide confidence bands) |
| `DatePicker` | Select date ranges |
| `Button` | Trigger complex calculations |
| `IntProgress` | Show progress bars |

### Running Interactive Notebooks
```bash
jupyter lab notebooks/interactive_capacity_planning.ipynb
```

---

## 📝 2. Parameterized Notebooks (`papermill`)

### What it does
Execute the same notebook template with different parameters - perfect for generating reports for different scenarios.

### Template Notebook
- `template_capacity_report.ipynb` - Parameterized capacity planning report

### Usage Examples

#### Command Line
```bash
# Run with custom parameters
papermill notebooks/template_capacity_report.ipynb \
    reports/executed/my_report.ipynb \
    -p TIME_HORIZON_DAYS 60 \
    -p N_SIMULATIONS 10000 \
    -p FABRICATION_LINE "Line-A" \
    -p TARGET_OUTPUT 75000
```

#### Using Makefile (easier)
```bash
# Predefined scenarios
make report-scenario-a   # High throughput scenario
make report-scenario-b   # Conservative scenario

# Run batch for multiple lines
make report-batch

# Custom parameters from JSON file
make report-from-params
```

#### Parameters Available
| Parameter | Default | Description |
|-----------|---------|-------------|
| `TIME_HORIZON_DAYS` | 30 | Simulation period |
| `N_SIMULATIONS` | 5000 | Monte Carlo runs |
| `BASE_THROUGHPUT` | 100 | Wafers/hour base rate |
| `EFFICIENCY_MEAN` | 0.90 | Average efficiency |
| `DOWNTIME_PROB` | 0.03 | Daily downtime probability |
| `TARGET_OUTPUT` | 50000 | Target wafers |
| `FABRICATION_LINE` | "Line-A" | Line identifier |
| `RANDOM_SEED` | 42 | Reproducibility |

#### Parameters from JSON File
Create `params.json`:
```json
{
  "TIME_HORIZON_DAYS": 45,
  "N_SIMULATIONS": 15000,
  "EFFICIENCY_MEAN": 0.92,
  "TARGET_OUTPUT": 80000
}
```

Then run:
```bash
papermill template.ipynb output.ipynb -f params.json
```

#### Python API
```python
import papermill as pm

pm.execute_notebook(
    'notebooks/template_capacity_report.ipynb',
    'reports/executed/output.ipynb',
    parameters={
        'TIME_HORIZON_DAYS': 60,
        'N_SIMULATIONS': 10000,
        'TARGET_OUTPUT': 100000
    }
)
```

---

## 📊 3. Export to HTML/PDF (`nbconvert`)

### What it does
Convert notebooks to static formats for sharing, documentation, or archiving.

### Supported Formats
| Format | Command | Use Case |
|--------|---------|----------|
| HTML | `make export-html` | Share reports via web |
| PDF | `make export-pdf` | Print or formal documents |
| Python | `make export-script` | Extract code only |
| Slides | `make export-slides` | Presentations |
| Markdown | `jupyter nbconvert --to markdown` | Documentation |

### Usage Examples

#### Export to HTML (with custom template)
```bash
make export-html
```

This creates styled HTML reports in `reports/html/` with:
- Custom header with gradient
- Styled tables
- Centered plots

#### Export to PDF
```bash
# Requires TeX installation (MacTeX, MiKTeX, or texlive)
make export-pdf
```

#### Export Individual Notebook
```bash
jupyter nbconvert --to html notebooks/capacity_planning.ipynb \
    --no-input \
    --output reports/capacity_report.html
```

#### Export with Full Output
```bash
jupyter nbconvert --to html notebooks/template_capacity_report.ipynb \
    --execute \
    --output reports/executed_report.html
```

---

## 🔄 4. Notebook Sync with Python (`jupytext`)

### What it does
Sync `.ipynb` files with `.py` scripts - enabling proper version control and code review.

### Why Use It?
- **Git-friendly**: Python diffs instead of JSON diffs
- **IDE support**: Edit in VS Code, PyCharm with full intellisense
- **Reviewable**: Code review notebooks as Python scripts
- **Importable**: Import notebook code as modules

### Directory Structure
```
ml/
├── notebooks/              # .ipynb files (primary)
├── notebooks_py/           # .py files (synced)
└── config/jupytext.toml    # Configuration
```

### Workflow

#### 1. Initial Setup (Pair Existing Notebooks)
```bash
# Pair all existing notebooks
jupytext --set-formats ipynb,notebooks_py//py:percent notebooks/*.ipynb

# Or use Makefile
make sync-to-py
```

#### 2. Daily Development
```bash
# Edit in Jupyter → sync to Python
jupytext --sync notebooks/my_notebook.ipynb

# Or sync all
make sync

# Edit Python in IDE → sync to notebook
jupytext --sync notebooks_py/my_notebook.py
```

#### 3. Git Workflow
```bash
# Commit both (or just Python files)
git add notebooks/my_notebook.ipynb notebooks_py/my_notebook.py

# On clone, recreate notebooks from Python
git clone <repo>
jupytext --sync notebooks_py/*.py
```

### Format Options
| Format | Extension | Best For |
|--------|-----------|----------|
| `py:percent` | `.py` | VS Code, PyCharm, Spyder |
| `py:light` | `.py` | Minimal diff |
| `md` | `.md` | Markdown editing |
| `Rmd` | `.Rmd` | RStudio |

### Example Python Output (py:percent)
```python
# %% [markdown]
# # Capacity Planning
# Monte Carlo simulation for fab capacity.

# %% [markdown]
# ## Parameters

# %%
TIME_HORIZON_DAYS = 30
N_SIMULATIONS = 5000

# %% [markdown]
# ## Simulation

# %%
def run_simulation():
    results = []
    # ... code ...
    return results
```

---

## 📋 Command Reference

### Makefile Commands
```bash
make help              # Show all commands

# Setup
make install           # Install dependencies

# Jupytext
make sync              # Bidirectional sync
make sync-to-py        # Notebooks → Python
make sync-to-ipynb     # Python → Notebooks

# nbconvert
make export-html       # Export to HTML
make export-pdf        # Export to PDF
make export-script     # Export to Python
make export-slides     # Export to slides

# Papermill
make report            # Generate default report
make report-scenario-a # Scenario A parameters
make report-scenario-b # Scenario B parameters
make report-batch      # Batch for multiple lines

# Jupyter
make jupyter           # Start Jupyter Lab

# Maintenance
make clean             # Remove generated files
make clean-outputs     # Clear notebook outputs
make verify            # Check notebook integrity
```

---

## 🏗️ Project Structure

```
ml/
├── notebooks/                    # Jupyter notebooks
│   ├── capacity_planning.ipynb   # Original capacity notebook
│   ├── anomaly_detection.ipynb   # Original anomaly notebook
│   ├── interactive_capacity_planning.ipynb  # With ipywidgets
│   └── template_capacity_report.ipynb       # Papermill template
│
├── notebooks_py/                 # Synced Python scripts (jupytext)
├── scripts/                      # Regular Python scripts
├── models/                       # Trained model files
├── data/                         # Data files
├── reports/                      # Generated reports
│   ├── html/                     # HTML exports
│   ├── pdf/                      # PDF exports
│   └── executed/                 # Papermill outputs
├── config/                       # Configuration files
│   ├── jupytext.toml            # Jupytext config
│   └── nbconvert_html.tpl       # HTML export template
├── Makefile                      # Convenience commands
└── requirements.txt              # Python dependencies
```

---

## 🎯 Common Workflows

### 1. Interactive Analysis
```bash
jupyter lab notebooks/interactive_capacity_planning.ipynb
# Adjust sliders, explore scenarios visually
```

### 2. Generate Weekly Report
```bash
# Run parameterized notebook with this week's data
papermill notebooks/template_capacity_report.ipynb \
    reports/weekly_report_$(date +%Y%m%d).ipynb \
    -p TIME_HORIZON_DAYS 7 \
    -p N_SIMULATIONS 10000

# Export to HTML for sharing
jupyter nbconvert --to html reports/weekly_report_*.ipynb \
    --output reports/html/weekly_report.html
```

### 3. Compare Multiple Scenarios
```bash
# Run 3 scenarios
make report-scenario-a
make report-scenario-b

# Convert all to HTML
make export-html
```

### 4. Version Control Workflow
```bash
# After editing notebook in Jupyter
make sync                    # Sync to Python

# Review changes
 git diff notebooks_py/my_notebook.py

# Commit
 git add notebooks/ notebooks_py/
```

---

## 📚 Additional Resources

- **ipywidgets**: https://ipywidgets.readthedocs.io/
- **papermill**: https://papermill.readthedocs.io/
- **nbconvert**: https://nbconvert.readthedocs.io/
- **jupytext**: https://jupytext.readthedocs.io/

---

## 💡 Tips

1. **Clear outputs before committing** (unless using jupytext):
   ```bash
   make clean-outputs
   ```

2. **Use random seeds** in papermill templates for reproducibility

3. **Tag parameter cells** with `parameters` for papermill to recognize them

4. **Test papermill templates** manually before batch execution

5. **Keep interactive and template notebooks separate** for clarity
