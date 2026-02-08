# Aegis Knowledge Graph Service
# Based on rahulnyk/knowledge_graph - adapted for Aegis Industrial Defense

FROM python:3.11-slim

WORKDIR /app

# Install dependencies
RUN pip install --no-cache-dir \
    fastapi \
    uvicorn \
    networkx \
    pyvis \
    pydantic

# Copy application code
COPY knowledge_graph.py .
COPY api.py .

# Expose port
EXPOSE 8000

# Run the API server
CMD ["python", "api.py"]
