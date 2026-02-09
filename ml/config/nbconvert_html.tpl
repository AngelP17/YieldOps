{%- extends 'full.tpl' -%}

{%- block header -%}
{{ super() }}
<style>
  .report-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 2rem;
    margin: -20px -20px 20px -20px;
    text-align: center;
  }
  .report-header h1 {
    margin: 0;
    font-size: 2.5rem;
  }
  .report-meta {
    margin-top: 1rem;
    opacity: 0.9;
  }
  .output_png {
    text-align: center;
  }
  .dataframe {
    font-size: 0.9rem;
    border-collapse: collapse;
  }
  .dataframe th {
    background-color: #667eea;
    color: white;
    padding: 8px;
  }
  .dataframe td {
    padding: 8px;
    border-bottom: 1px solid #ddd;
  }
  .alert {
    padding: 1rem;
    margin: 1rem 0;
    border-radius: 4px;
  }
  .alert-success {
    background-color: #d4edda;
    border: 1px solid #c3e6cb;
    color: #155724;
  }
  .alert-warning {
    background-color: #fff3cd;
    border: 1px solid #ffeeba;
    color: #856404;
  }
</style>
{%- endblock header -%}

{%- block body -%}
<div class="report-header">
  <h1>YieldOps ML Report</h1>
  <div class="report-meta">
    Generated: {{ resources['metadata']['name'] }} | 
    {{ resources['metadata']['modified_date'] if 'modified_date' in resources['metadata'] else 'N/A' }}
  </div>
</div>
{{ super() }}
{%- endblock body -%}
