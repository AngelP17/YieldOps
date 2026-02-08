# Aegis Sentinel - YieldOps Integration Guide

## Full Value Chain Coverage

This document describes how the Aegis Sentinel agents integrate with the YieldOps platform to provide **end-to-end** monitoring from **Fab (Front-End)** to **Packaging (Back-End)**.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         YIELDOPS PLATFORM                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  Dashboard   │  │   Supabase   │  │   API        │  │  Real-time   │    │
│  │  (React)     │  │  (Postgres)  │  │  (Python)    │  │  Updates     │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
└─────────┼────────────────┼────────────────┼────────────────┼──────────────┘
          │                │                │                │
          │    ┌───────────┴────────────────┴────────────────┐│
          │    │           AEGIS SENTINEL (Rust)              ││
          │    │  ┌─────────────┐ ┌─────────────┐ ┌─────────┐ ││
          │    │  │   PRECISION │ │   FACILITY  │ │ ASSEMBLY│ ││
          │    │  │   Sentinel  │ │   Sentinel  │ │ Sentinel│ ││
          │    │  │  (CNC/Fab)  │ │(Environment)│ │(Packaging│ ││
          │    │  └──────┬──────┘ └──────┬──────┘ └────┬────┘ ││
          │    └─────────┼───────────────┼─────────────┼──────┘
          │              │               │             │
          └──────────────┼───────────────┼─────────────┘
                         │               │
                    ┌────┴────┐     ┌────┴────┐
                    │  MQTT   │     │  HTTP   │
                    │  Broker │     │  API    │
                    └────┬────┘     └────┬────┘
                         │               │
    ┌────────────────────┼───────────────┼────────────────────┐
    │                    │               │                    │
┌───┴───┐          ┌─────┴────┐    ┌─────┴────┐          ┌───┴───┐
│ Fab   │          │ Cleanroom│    │ Wire     │          │ Test  │
│ Tools │          │  (FFU)   │    │ Bonders  │          │Equipment
│(Litho)│          │ (HVAC)   │    │(Packaging)│          │       │
└───────┘          └──────────┘    └──────────┘          └───────┘
```

---

## Agent Capabilities

### 1. Precision Sentinel (The "Brain" of CNC)
**File**: `aegis/aegis-sentinel/src/agents/precision.rs`

**Target Equipment**: CNC Mills, Lathes, Machining Centers

**Physics Models**:
- **Chatter Detection**: Regenerative vibration analysis (FFT-based)
- **Thermal Drift Compensation**: ΔL = α·L·ΔT (CTE-based correction)
- **Tool Wear Tracking**: Load signature analysis
- **Bearing Failure**: ISO 10816 vibration thresholds
- **Thermal Runaway**: Rate-of-change detection

**Protocol**: MQTT / Modbus

**Safety Circuit**:
| Threat | Zone | Action |
|--------|------|--------|
| Chatter (Low) | 🟢 Green | Adjust RPM -5% |
| Chatter (High) | 🟡 Yellow | Reduce feed 20% |
| Thermal Drift | 🟢 Green | Apply Z-offset compensation |
| Tool Wear | 🟡 Yellow | Schedule tool change |
| Thermal Runaway | 🔴 Red | Emergency stop |
| Bearing Failure | 🔴 Red | Critical alert |

---

### 2. Facility Sentinel (The "Lungs" of the Fab)
**File**: `aegis/aegis-sentinel/src/agents/facility.rs`

**Target Equipment**: FFU (Fan Filter Units), HVAC, Chemical Delivery

**Physics Models**:
- **Filter Clog Detection**: P/Q impedance (Darcy-Weisbach equation)
- **ISO 14644-1 Compliance**: Cn = 10^N × (0.1/D)^2.08
- **Airflow Monitoring**: Bernoulli's principle
- **Chemical Leak Detection**: ppm threshold monitoring

**Protocol Bridge**: MODBUS/BACnet
```
[MODBUS BRIDGE] Writing Register 4001 (fan_speed): 85%
```

**Safety Circuit**:
| Threat | Zone | Action |
|--------|------|--------|
| Filter Loading | 🟢 Green | Log for maintenance |
| Filter End-of-Life | 🟡 Yellow | Create work order |
| ISO Class Violation | 🔴 Red | Stop wafer loading |
| Chemical Leak | 🔴 Red | Emergency stop |
| Airflow Failure | 🔴 Red | Stop production |

---

### 3. Assembly Sentinel (The "Hands" of Packaging)
**File**: `aegis/aegis-sentinel/src/agents/assembly.rs`

**Target Equipment**: Wire Bonders, Die Attach, Flip Chip

**Physics Models**:
- **NSOP Detection**: Ultrasonic impedance monitoring
  - Low impedance = No bond formed
  - High impedance = Good bond
- **Shear Strength Tracking**: Statistical process control
- **Capillary Thermal Drift**: CTE compensation
- **OEE Calculation**: Availability × Performance × Quality
- **USG Degradation**: Impedance baseline deviation

**Protocol Bridge**: SECS/GEM
```
[SECS/GEM BRIDGE] Sending S2F41 STOP to BOND-01: NSOP Detected
[SECS/GEM BRIDGE] S2F41 Remote Command to BOND-01: bond_force = 105 percent
```

**Safety Circuit**:
| Threat | Zone | Action |
|--------|------|--------|
| Cycle Time Drift | 🟢 Green | Adjust bond force +5% |
| Capillary Drift (Low) | 🟢 Green | Compensate Z-offset |
| Weak Bond | 🟡 Yellow | Inspect capillary |
| USG Degradation | 🟡 Yellow | Schedule maintenance |
| NSOP Detected | 🔴 Red | Feed hold (S2F41 STOP) |
| Thermal Drift (High) | 🟡 Yellow | Check cooling |

---

## Integration Points

### 1. MQTT Communication
- **Telemetry Topic**: `factory/{machine_id}/telemetry`
- **Command Topic**: `factory/{machine_id}/command`
- **Incident Topic**: `aegis/incidents`

### 2. HTTP API Bridge
Environment variables:
```bash
export YIELDOPS_API_URL="https://your-api.com"
export YIELDOPS_API_KEY="your-api-key"
```

Direct API endpoints:
- `POST /api/v1/aegis/incidents` - Report incidents
- `POST /api/v1/aegis/agents/register` - Register agents
- `POST /api/v1/aegis/agents/{id}/heartbeat` - Heartbeat
- `POST /api/v1/aegis/telemetry/analyze` - ML analysis

### 3. Supabase Real-Time Data

**Tables**:
- `aegis_incidents` - All incidents (resolved/pending)
- `aegis_agents` - Agent registry and status
- `sensor_readings` - Raw telemetry data
- `machines` - Equipment master data

---

## Running the System

### 1. Start YieldOps API
```bash
cd apps/api
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### 2. Start MQTT Broker (Mosquitto)
```bash
mosquitto -c mosquitto.conf
```

### 3. Start Aegis Sentinel
```bash
cd aegis/aegis-sentinel
export YIELDOPS_API_URL="http://localhost:8000"
export MQTT_BROKER="localhost"
cargo run
```

### 4. Start Dashboard
```bash
cd apps/dashboard
npm install
npm run dev
```

---

## Interview Talking Points

### The "Fab" Story (Facility Agent)
- **Physics**: Fluid dynamics - detecting clogged filters via pressure/flow impedance
- **Protocol**: "I know facilities use OT protocols like Modbus/BACnet, not SECS/GEM"
- **Criticality**: "If ISO class fails, the whole lot dies"
- **The Win**: Predictive maintenance - changing filters before airflow drops

### The "Packaging" Story (Assembly Agent)
- **Physics**: Ultrasonics - detecting bad bonds via transducer impedance changes
- **Protocol**: "I know wire bonders are high-end tools that need SECS/GEM commands"
- **Criticality**: "If cycle time drifts, we lose 5% capacity (OEE impact)"
- **The Win**: Quality assurance - stopping the line instantaneously on NSOP defects

### The "Integration" Story
- **Decoupling**: "Sentinel acts instantly; YieldOps reports eventually"
- **Protocol Bridge**: "We translate between industrial protocols and REST APIs"
- **Full Coverage**: "From Sand to Package - Fab to Packaging"

---

## Configuration

### Agent Configuration (YAML)
```yaml
agents:
  - machine_id: "LITHO-01"
    agent_type: "precision"
    config:
      vibration_critical: 10.0
      thermal_drift_max: 0.05
      
  - machine_id: "FAC-001"
    agent_type: "facility"
    config:
      iso_class: 5
      min_airflow_velocity: 0.45
      
  - machine_id: "BOND-01"
    agent_type: "assembly"
    config:
      max_bond_time_ms: 20.0
      ultrasonic_impedance_limit: 30.0
```

### Environment Variables
```bash
# MQTT Configuration
MQTT_BROKER=localhost
MQTT_PORT=1883

# YieldOps API
YIELDOPS_API_URL=http://localhost:8000
YIELDOPS_API_KEY=your-secret-key

# Supabase
SUPABASE_URL=your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
```

---

## Testing

### Unit Tests
```bash
cd aegis/aegis-sentinel
cargo test
```

### Integration Test
```bash
# Send test telemetry
mosquitto_pub -t "factory/CNC-001/telemetry" -m '{
  "timestamp": "2026-02-08T10:00:00Z",
  "machine_id": "CNC-001",
  "metrics": {
    "vibration": 0.015,
    "temperature": 85.0,
    "load_percent": 75.0
  },
  "states": {}
}'
```

---

## Monitoring

### Dashboard Views
1. **Overview Tab**: KPIs, machine status, job queue
2. **Machines Tab**: Grid/List/Topology views with real-time data
3. **Jobs Tab**: Job scheduling with priority levels
4. **Sentinel Tab**: Agent status, incidents, knowledge graph

### Alerts
- Critical incidents trigger browser notifications
- Yellow zone actions require operator approval
- Red zone alerts escalate to management

---

## Deployment

### Docker Compose
```yaml
version: '3.8'
services:
  aegis-sentinel:
    build: ./aegis/aegis-sentinel
    environment:
      - MQTT_BROKER=mosquitto
      - YIELDOPS_API_URL=http://api:8000
    depends_on:
      - mosquitto
      - api
```

### Kubernetes
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: aegis-sentinel
spec:
  replicas: 3
  selector:
    matchLabels:
      app: aegis-sentinel
  template:
    spec:
      containers:
      - name: sentinel
        image: aegis-sentinel:latest
        env:
        - name: YIELDOPS_API_URL
          value: "https://api.yieldops.com"
```

---

## Summary

This integration demonstrates:
1. **Domain Authority**: Full understanding of Fab + Packaging
2. **Protocol Knowledge**: Modbus, SECS/GEM, MQTT, REST
3. **Physics-Based Detection**: Real engineering principles
4. **Safety-Critical Design**: 3-tier response circuit
5. **Enterprise Integration**: Supabase, real-time dashboards

**Result**: A "Sand-to-Package" platform that hiring managers at Intel and TSMC look for.
