# Sentinel Ghost CNC Simulator Dockerfile
# Physics-based virtual CNC machine for testing

FROM python:3.11-slim

WORKDIR /app

# Install dependencies
RUN pip install --no-cache-dir paho-mqtt

# Copy simulator code
COPY ghost_cnc.py .

# Environment variables with defaults
ENV MACHINE_ID=GHOST-001
ENV MQTT_BROKER=mosquitto
ENV INITIAL_RPM=4500
ENV INITIAL_LOAD=0.65

# Run the simulator
CMD python ghost_cnc.py
