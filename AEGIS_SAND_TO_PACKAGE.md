# Aegis Sentinel: Sand-to-Package Platform

## Overview

The **Aegis Sentinel** transforms YieldOps from a single-point solution into a **"Sand-to-Package" Platform** - covering the full semiconductor manufacturing value chain. This is the specific domain authority that hiring managers at Intel and TSMC look for.

## Architecture: Full Value Chain Coverage

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AEGIS SENTINEL PLATFORM                              │
│                    "CrowdStrike for Physical Infrastructure"                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────┐  │
│  │   FRONT-END (FAB)   │    │   BACK-END (PKG)    │    │    PRECISION    │  │
│  │                     │    │                     │    │                 │  │
│  │  Facility Agent     │◄──►│  Assembly Agent     │    │  Precision Agent│  │
│  │  ─────────────────  │    │  ─────────────────  │    │  ─────────────  │  │
│  │  • FFU/HEPA Filters │    │  • Wire Bonders     │    │  • CNC Mills    │  │
│  │  • HVAC Systems     │    │  • Die Attach       │    │  • CNC Lathes   │  │
│  │  • Chemical Delivery│    │  • Flip Chip        │    │  • Machining    │  │
│  │                     │    │                     │    │                 │  │
│  │  Protocol: Modbus   │    │  Protocol: SECS/GEM │    │  Protocol: MTConnect│
│  │  BACnet             │    │  S2F41 Host Cmd     │    │  OPC-UA         │  │
│  │                     │    │                     │    │                 │  │
│  │  Physics:           │    │  Physics:           │    │  Physics:       │  │
│  │  Bernoulli Flow     │    │  Ultrasonic         │    │  Vibration      │  │
│  │  Darcy-Weisbach     │    │  Impedance          │    │  Chatter        │  │
│  │  ISO 14644-1        │    │  CTE Thermal Drift  │    │  Tool Wear      │  │
│  └─────────────────────┘    └─────────────────────┘    └─────────────────┘  │
│           │                          │                       │               │
│           └──────────────────────────┼───────────────────────┘               │
│                                      │                                       │
│                         ┌────────────▼────────────┐                          │
│                         │   SAFETY CIRCUIT        │                          │
│                         │   ─────────────────     │                          │
│                         │   🟢 GREEN: Auto-exec   │                          │
│                         │   🟡 YELLOW: Pending    │                          │
│                         │   🔴 RED: Human req.    │                          │
│                         └────────────┬────────────┘                          │
│                                      │                                       │
│                         ┌────────────▼────────────┐                          │
│                         │   SUPABASE BRIDGE       │                          │
│                         │   Real-time Ingestion   │                          │
│                         └────────────┬────────────┘                          │
│                                      │                                       │
│                         ┌────────────▼────────────┐                          │
│                         │    YIELDOPS DASHBOARD   │                          │
│                         │    React + Realtime     │                          │
│                         └─────────────────────────┘                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Agent Details

### 1. Facility Agent (The "Lungs" of the Fab)

**File:** `aegis/aegis-sentinel/src/agents/facility.rs`

**Purpose:** Protects the environment where chips are made. If the air fails, the yield hits 0%.

**Key Physics Models:**

| Detection | Physics Model | Formula |
|-----------|---------------|---------|
| HEPA Filter Clogging | Darcy-Weisbach Impedance | `Z = P/Q` (Pressure/Flow) |
| ISO Class Violation | ISO 14644-1 | `Cn = 10^N × (0.1/D)^2.08` |
| Airflow Failure | Bernoulli's Principle | Velocity drop detection |

**Protocol Bridge:**
```rust
// Explicit Modbus register writes show domain knowledge
info!("[MODBUS BRIDGE] Writing Register 4001 ({}): {}", parameter_name, new_value);
```

**Interview Hook:**
> "I normalize pressure drop against airflow (P/Q) to calculate filter impedance, rather than just waiting for a high-pressure alarm. This predicts end-of-life before airflow drops below ISO Class requirements."

---

### 2. Assembly Agent (The "Hands" of Packaging)

**File:** `aegis/aegis-sentinel/src/agents/assembly.rs`

**Purpose:** Protects mechanical throughput at the end of the line.

**Key Physics Models:**

| Detection | Physics Model | Metric |
|-----------|---------------|---------|
| NSOP (Non-Stick on Pad) | Ultrasonic Impedance | < 30Ω indicates no bond |
| Bond Quality | Shear Strength | < 8g indicates weak bond |
| Capillary Drift | CTE Expansion | `ΔL = α × L × ΔT` |
| Throughput | OEE Calculation | Cycle time tracking |

**Protocol Bridge:**
```rust
// SECS/GEM S2F41 Host Command Send
info!("[SECS/GEM BRIDGE] Sending S2F41 STOP to {}: {}", machine_id, reason);
```

**Interview Hook:**
> "I catch Non-Stick defects in milliseconds by monitoring transducer impedance. Low impedance means no bond formed - we stop the line immediately via SECS/GEM S2F41, preventing thousands of bad units from moving down the line."

---

## Protocol Differentiation

| Agent Type | Domain | Protocol | Why It Matters |
|------------|--------|----------|----------------|
| **Facility** | Front-End Fab | Modbus/BACnet | Building automation - knows facilities use OT protocols, not SECS/GEM |
| **Assembly** | Back-End Packaging | SECS/GEM | High-end tools need complex commands - S2F41 Host Cmd |
| **Precision** | Machining | MTConnect/OPC-UA | CNC controllers use manufacturing protocols |

**Interview Talking Point:**
> "I explicitly bridge different protocol stacks because Fab facilities run on Modbus/BACnet, while packaging tools use SECS/GEM. Knowing which protocol to use where shows real-world manufacturing experience."

---

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        DATA PIPELINE                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Machine/Agent Telemetry                                         │
│         │                                                        │
│         ▼                                                        │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐          │
│  │    MQTT     │───►│   BRIDGE    │───►│  SUPABASE   │          │
│  │   Broker    │    │  (Rust)     │    │  Realtime   │          │
│  └─────────────┘    └─────────────┘    └──────┬──────┘          │
│                                                │                 │
│                                                ▼                 │
│                                       ┌─────────────┐            │
│                                       │   REACT     │            │
│                                       │  Dashboard  │            │
│                                       │  (YieldOps) │            │
│                                       └─────────────┘            │
│                                                                  │
│  Decoupling Principle:                                           │
│  • Sentinel acts instantly (safety)                              │
│  • YieldOps reports eventually (analytics)                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Schema (Supabase)

### Core Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `aegis_incidents` | Sentinel detections | severity, action_zone, agent_type |
| `aegis_agents` | Agent registry | agent_type, protocol, capabilities |
| `sensor_readings` | Unified telemetry | agent_type, metrics per domain |
| `facility_ffu_status` | FFU detailed status | pressure_drop_pa, iso_class |
| `assembly_bonder_status` | Wire bonder status | oee_percent, nsop_count_24h |

### Agent Type Differentiation in Schema

```sql
-- Facility (Front-End) fields
ALTER TABLE sensor_readings ADD COLUMN airflow_mps DECIMAL(6,3);
ALTER TABLE sensor_readings ADD COLUMN particles_0_5um DECIMAL(12,2);
ALTER TABLE sensor_readings ADD COLUMN pressure_diff_pa DECIMAL(8,2);

-- Assembly (Back-End) fields
ALTER TABLE sensor_readings ADD COLUMN usg_impedance DECIMAL(6,2);
ALTER TABLE sensor_readings ADD COLUMN bond_time_ms DECIMAL(6,2);
ALTER TABLE sensor_readings ADD COLUMN shear_strength_g DECIMAL(6,2);
```

---

## Interview Summary Table

| Feature | The "Fab" Story | The "Packaging" Story |
|---------|-----------------|----------------------|
| **Physics** | Fluid Dynamics: Detecting clogged filters via pressure/flow impedance | Ultrasonics: Detecting bad bonds via transducer impedance changes |
| **Protocol** | Modbus/BACnet: "I know facilities use OT protocols, not SECS/GEM." | SECS/GEM: "I know wire bonders are high-end tools that need complex commands." |
| **Criticality** | Yield Integrity: "If ISO class fails, the whole lot dies." | Throughput (OEE): "If cycle time drifts, we lose 5% capacity." |
| **The "Win"** | Predictive Maintenance: Changing filters before airflow drops | Quality Assurance: Stopping the line instantaneously on defect |

---

## Deployment

### 1. Start MQTT Broker
```bash
# Using mosquitto or emqx
docker run -d --name mqtt -p 1883:1883 eclipse-mosquitto
```

### 2. Run Supabase Bridge
```bash
cd aegis/supabase-bridge
export SUPABASE_URL="your_supabase_url"
export SUPABASE_SERVICE_KEY="your_service_key"
export MQTT_BROKER="localhost:1883"
cargo run
```

### 3. Run Sentinel Agents
```bash
cd aegis/aegis-sentinel
export MQTT_BROKER="localhost"
cargo run
```

### 4. Configure Frontend
```bash
cd apps/dashboard
export VITE_SUPABASE_URL="your_supabase_url"
export VITE_SUPABASE_ANON_KEY="your_anon_key"
npm run dev
```

---

## Key Files

| Component | File | Purpose |
|-----------|------|---------|
| **Facility Agent** | `aegis/aegis-sentinel/src/agents/facility.rs` | Front-End Fab monitoring |
| **Assembly Agent** | `aegis/aegis-sentinel/src/agents/assembly.rs` | Back-End Packaging monitoring |
| **Supabase Bridge** | `aegis/supabase-bridge/src/main.rs` | MQTT → Supabase ingestion |
| **Database Schema** | `database/migrations/003_aegis_sentinel_sand_to_package.sql` | Migration for new tables |
| **Frontend Hook** | `apps/dashboard/src/hooks/useAegisRealtime.ts` | Real-time data subscription |
| **Coverage Panel** | `apps/dashboard/src/components/aegis/AgentCoveragePanel.tsx` | UI for Sand-to-Package view |

---

## The Complete Story

> "I've built a full-stack semiconductor manufacturing platform called YieldOps that covers the entire value chain from Sand-to-Package. 
>
> **Front-End (Fab):** My Facility Agent monitors FFU units using fluid dynamics - specifically Darcy-Weisbach impedance calculations to predict HEPA filter end-of-life before airflow drops. It uses Modbus/BACnet because that's what building automation systems speak.
>
> **Back-End (Packaging):** My Assembly Agent monitors wire bonders using ultrasonic impedance - if the transducer impedance stays low, it means the wire didn't stick (NSOP). We immediately send a SECS/GEM S2F41 Host Command to stop the machine, preventing thousands of bad units.
>
> **The Safety Circuit:** All agents feed into a 3-tier safety circuit - Green zone actions auto-execute, Yellow zone queues for approval, and Red zone requires human intervention. This decouples safety from reporting.
>
> **Real-time Integration:** Everything flows through Supabase Realtime, so the YieldOps dashboard shows live data from all agents. I've built knowledge graphs for both the Jobs tab and Overview tab to visualize relationships between machines, jobs, and incidents."

---

## Built With

- **Rust** - High-performance edge agents
- **MQTT** - Lightweight telemetry transport
- **Supabase** - Real-time PostgreSQL
- **React + TypeScript** - Dashboard frontend
- **Tailwind CSS** - UI styling
- **Physics** - Real engineering calculations

---

*This is domain expertise that separates a generic developer from a manufacturing systems engineer.*
