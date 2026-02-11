# Aegis Industrial Defense - Architecture

## System Overview

Aegis is an autonomous defense platform for manufacturing equipment. It monitors machines, detects anomalies using physics-based models, and executes autonomous responses through a 3-tier Safety Circuit.

```mermaid
flowchart TB
    subgraph Edge["Edge Layer - Factory Floor"]
        Machines["Fab Machines
(48 Virtual Machines)"]
        Agent["Aegis Sentinel Agent
(Rust)"]
        
        subgraph Agents["Specialized Agents"]
            Precision["Precision Sentinel
(CNC/Litho)"]
            Facility["Facility Sentinel
(Cleanroom/HVAC)"]
            Assembly["Assembly Sentinel
(Wire Bonding)"]
        end
    end
    
    subgraph MessageBus["Message Bus"]
        MQTT["Eclipse Mosquitto
MQTT Broker"]
    end
    
    subgraph Cloud["Cloud Layer"]
        API["YieldOps API
(FastAPI)"]
        Dashboard["YieldOps Dashboard
(React)"]
        KG["Knowledge Graph Engine
(NetworkX)"]
    end
    
    subgraph Storage["Storage Layer"]
        Supabase[("Supabase
PostgreSQL + Realtime")]
    end
    
    subgraph Integration["Protocol Bridges"]
        Modbus["Modbus/BACnet
(Facility)"]
        SECSGEM["SECS/GEM Bridge
(Assembly)"]
        MTConnect["MTConnect/OPC-UA
(Precision)"]
    end
    
    Machines -->|Telemetry| MQTT
    MQTT -->|Commands| Machines
    Agent -->|Analyze & Respond| MQTT
    MQTT -->|Store via API| Supabase
    MQTT -->|Real-time| Dashboard
    API -->|Query| Supabase
    API -->|Graph Analytics| KG
    Dashboard -->|Visualize| KG
    
    Facility -.->|Protocol| Modbus
    Assembly -.->|Protocol| SECSGEM
    Precision -.->|Protocol| MTConnect
```

---

## Component Architecture

### 1. Aegis Sentinel Agents (Rust)

**Location**: `aegis/aegis-sentinel/`

| Agent | Target | Protocol | Physics | File |
|-------|--------|----------|---------|------|
| **Facility** | FFU/HVAC/Cleanroom | Modbus/BACnet | Bernoulli flow, ISO 14644 particles, P/Q impedance | `src/agents/facility.rs` |
| **Precision** | CNC/Litho/Etching | MTConnect/OPC-UA | ISO 10816 vibration, CTE thermal | `src/agents/precision.rs` |
| **Assembly** | Wire Bonders | SECS/GEM | Ultrasonic impedance, bond quality | `src/agents/assembly.rs` |

**Core Trait** (`src/agents/mod.rs`):
```rust
#[async_trait]
pub trait SentinelAgent: Send + Sync {
    fn analyze(&mut self, telemetry: &Telemetry) -> Vec<Threat>;
    fn safety_circuit(&self, threat: &Threat) -> (ResponseTier, Action);
    async fn execute(&self, action: &Action) -> Result<(), AgentError>;
    fn metadata(&self) -> AgentMetadata;
    fn can_handle(&self, machine_id: &str) -> bool;
}
```

### 2. Message Bus

- **Technology**: Eclipse Mosquitto
- **Ports**: 1883 (MQTT), 9001 (WebSocket)
- **QoS**: At-least-once delivery (QoS 1)
- **Topics**:
  - `factory/+/telemetry` - Machine telemetry from agents
  - `factory/+/command` - Control commands to machines
  - `aegis/incidents` - Incident reports
  - `sentinel/bridge/command` - Protocol bridge commands

### 3. YieldOps API

**Location**: `apps/api/app/api/v1/aegis.py`

**Endpoints**:
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/aegis/incidents` | GET/POST | List/Report incidents |
| `/aegis/agents` | GET/POST | List/Register agents |
| `/aegis/agents/{id}/heartbeat` | POST | Agent heartbeat |
| `/aegis/safety-circuit` | GET | Get safety circuit status |
| `/aegis/summary` | GET | Get dashboard summary |
| `/aegis/knowledge-graph` | GET | Get knowledge graph |
| `/aegis/knowledge-graph/generate` | POST | Generate from incidents |
| `/aegis/telemetry/analyze` | POST | Analyze telemetry |

### 4. Core Engines

**Sentinel Engine** (`apps/api/app/core/sentinel_engine.py`):
- Z-score anomaly detection
- Rate-of-change (RoC) analysis
- Safety circuit state machine
- Supabase integration

**Knowledge Graph Engine** (`apps/api/app/core/knowledge_graph_engine.py`):
- NetworkX graph analytics
- NLP concept extraction
- Community detection
- Cytoscape JSON export

### 5. Database (Supabase)

**Tables**:
| Table | Purpose | Key Fields |
|-------|---------|------------|
| `aegis_incidents` | Sentinel detections | severity, action_zone, agent_type, z_score |
| `aegis_agents` | Agent registry | agent_type, protocol, capabilities, status |
| `sensor_readings` | Unified telemetry | agent_type, domain-specific metrics |
| `facility_ffu_status` | FFU detailed status | pressure_drop_pa, iso_class, airflow_velocity |
| `assembly_bonder_status` | Wire bonder status | usg_impedance, oee_percent, nsop_count |

### 6. Dashboard

**Location**: `apps/dashboard/src/components/tabs/SentinelTab.tsx`

**Components**:
- **AgentCoveragePanel** - Sand-to-Package overview
- **SentinelAgentCard** - Individual agent status
- **SafetyCircuitPanel** - 3-tier zone display
- **IncidentFeed** - Real-time incident stream
- **KnowledgeGraphViz** - Relationship graph
- **AgentTopology** - Network topology view

---

## Data Flow

```mermaid
sequenceDiagram
    participant Machine as Fab Machine
    participant MQTT as MQTT Broker
    participant Agent as Aegis Sentinel
    participant API as YieldOps API
    participant DB as Supabase
    participant Dashboard as Dashboard
    participant KG as Knowledge Graph

    loop Every 1 second
        Machine->>MQTT: Publish telemetry
    end

    MQTT->>Agent: Receive telemetry
    Agent->>Agent: Analyze (Z-score, RoC)
    
    alt Anomaly Detected
        Agent->>Agent: Safety Circuit Decision
        Agent->>MQTT: Publish command (Green zone)
        Agent->>API: POST /aegis/incidents
        API->>DB: Store incident
        DB->>Dashboard: Realtime update
        Dashboard->>KG: Generate graph
    end

    Dashboard->>MQTT: Subscribe telemetry
    MQTT->>Dashboard: Real-time updates
```

---

## Safety Circuit (3-Tier Model)

```mermaid
flowchart TD
    A[Threat Detected] --> B{Z-score + RoC}
    
    B -->|Z < 2.0| C[GREEN ZONE]
    B -->|2.0 ≤ Z < 3.0| D[YELLOW ZONE]
    B -->|Z ≥ 3.0| E[RED ZONE]
    
    C --> C1[Auto-Execute]
    C1 --> C2[Adjust RPM ±10%]
    C1 --> C3[Increase Coolant]
    C1 --> C4[Thermal Compensation]
    
    D --> D1[Queue for Approval]
    D1 --> D2[Reduce Speed >20%]
    D1 --> D3[Schedule Maintenance]
    D1 --> D4[Feed Hold]
    
    E --> E1[Alert Only]
    E1 --> E2[Emergency Stop]
    E1 --> E3[Unknown Failure]
    E1 --> E4[Cascade Event]
```

---

## Integration with YieldOps

### Data Sync

| Aegis Data | YieldOps Endpoint | Purpose |
|------------|-------------------|---------|
| Incidents | `POST /api/v1/aegis/incidents` | Threat detection logging |
| Agent Status | `POST /api/v1/aegis/agents/register` | Agent registry |
| Telemetry | `POST /api/v1/aegis/telemetry/analyze` | ML analysis |
| Heartbeats | `POST /api/v1/aegis/agents/{id}/heartbeat` | Health monitoring |

### Shared Components

```mermaid
flowchart LR
    subgraph Aegis["Aegis Platform"]
        A1[Sentinel Agents]
        A2[Knowledge Graph]
        A3[Physics Models]
    end
    
    subgraph Shared["Shared Infrastructure"]
        DB[("Supabase")]
        MQTT["MQTT Broker"]
    end
    
    subgraph YieldOps["YieldOps Platform"]
        Y1[ToC Dispatch]
        Y2[Virtual Metrology]
        Y3[Monte Carlo Sim]
        Y4[Dashboard]
    end
    
    A1 -->|Incidents| DB
    A2 -->|Concepts| DB
    Y1 -->|Jobs| DB
    Y2 -->|Predictions| DB
    
    Aegis -.->|Edge Intelligence| YieldOps
    YieldOps -.->|Cloud Analytics| Aegis
```

---

## Directory Structure

```
aegis/
├── aegis-sentinel/           # Rust agent implementation
│   ├── src/
│   │   ├── main.rs           # Agent orchestrator
│   │   ├── types.rs          # Core types & traits
│   │   ├── mqtt.rs           # MQTT client
│   │   ├── detection.rs      # Statistical analysis
│   │   ├── safety.rs         # Safety Circuit logic
│   │   ├── api_bridge.rs     # YieldOps API client
│   │   └── agents/
│   │       ├── mod.rs        # SentinelAgent trait
│   │       ├── precision.rs  # CNC machining agent
│   │       ├── facility.rs   # Cleanroom agent
│   │       └── assembly.rs   # Wire bonding agent
│   ├── Cargo.toml
│   └── Dockerfile
│
├── supabase-bridge/          # MQTT to Supabase bridge (Rust)
│   ├── src/
│   │   ├── main.rs
│   │   ├── mqtt.rs
│   │   ├── supabase.rs
│   │   └── types.rs
│   └── Cargo.toml
│
├── knowledge-graph/          # Graph analytics (Python)
│   ├── knowledge_graph.py
│   ├── api.py
│   └── Dockerfile
│
├── simulator/                # Ghost CNC simulator (Python)
│   └── ghost_cnc.py
│
├── gem_adapter.py            # SECS/GEM bridge (Python)
│
├── config/                   # Infrastructure config
│   └── mosquitto.conf        # MQTT broker config
│
├── README.md                 # Main documentation
├── ARCHITECTURE.md           # This file
└── SECS_GEM_INTEGRATION.md   # SECS/GEM docs
```

---

## Deployment

### Local Development

```bash
# Start MQTT broker
brew install mosquitto
brew services start mosquitto

# Start YieldOps API (Terminal 1)
cd apps/api
uvicorn app.main:app --reload

# Start Aegis Sentinel (Terminal 2)
cd aegis/aegis-sentinel
cargo run

# Access points
# Dashboard: http://localhost:5173
# MQTT: localhost:1883
# API: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

### Production (with YieldOps)

```bash
# 1. Deploy Aegis Edge
cd aegis/aegis-sentinel
docker build -t aegis-sentinel .
docker run -d \
  -e YIELDOPS_API_URL=https://api.yieldops.com \
  -e MQTT_BROKER=mqtt.yieldops.com \
  aegis-sentinel

# 2. Configure YieldOps integration (optional live mode)
# Set environment variables in production only if live API/Supabase are enabled
export YIELDOPS_API_URL=https://<your-live-api-domain>
export YIELDOPS_SUPABASE_URL=your_supabase_url
```

---

## Performance Specifications

| Metric | Target | Actual |
|--------|--------|--------|
| Detection Latency | <100ms | ~50ms |
| Response Time | <500ms | ~200ms |
| Agent Memory | <50MB | ~10MB |
| MQTT Throughput | 10K msg/s | 50K msg/s |
| Dashboard Render | <100ms | ~50ms |
| API Response | <100ms | ~30ms |

---

## Security Considerations

1. **MQTT**: Use TLS in production (`mqtts://`)
2. **Database**: Row-level security policies enabled
3. **API**: JWT authentication for agent registration
4. **Network**: VPC isolation for edge devices
5. **Secrets**: Environment variables for API keys

---

## License

MIT License - See [ATTRIBUTION.md](ATTRIBUTION.md) for IP declaration
