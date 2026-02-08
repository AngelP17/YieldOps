# Sentinel Agent Dockerfile
# Autonomous defense agent for manufacturing equipment

FROM python:3.11-slim

WORKDIR /app

# Install dependencies
RUN pip install --no-cache-dir paho-mqtt

# Copy agent code
COPY sentinel_agent.py .

# Environment variables
ENV MQTT_BROKER=mosquitto
ENV RUST_LOG=info

# Run the agent
CMD python sentinel_agent.py
