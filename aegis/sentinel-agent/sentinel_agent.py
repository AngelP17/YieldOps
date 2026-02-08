#!/usr/bin/env python3
"""
Sentinel Manufacturing Defense Platform - Autonomous Defense Agent
Monitors machine telemetry, detects anomalies, and executes autonomous responses.

Author: Angel L. Pinzon
License: MIT
"""

import json
import time
import math
import uuid
from dataclasses import dataclass, asdict
from typing import Dict, List, Optional, Callable
from datetime import datetime
from collections import deque
import paho.mqtt.client as mqtt


@dataclass
class Thresholds:
    """Safety thresholds for machine parameters"""
    temp_warning: float = 80.0
    temp_critical: float = 95.0
    temp_emergency: float = 105.0
    vibration_warning: float = 0.02  # mm/s
    vibration_critical: float = 0.05  # mm/s
    vibration_emergency: float = 0.08  # mm/s
    roc_temp_threshold: float = 5.0  # °C per minute


@dataclass
class Detection:
    """Anomaly detection record"""
    timestamp: str
    machine_id: str
    severity: str  # 'critical', 'high', 'medium', 'low'
    detection_type: str
    message: str
    value: float
    threshold: float
    recommended_action: str
    action_zone: str  # 'green', 'yellow', 'red'


class AnomalyDetector:
    """
    Statistical anomaly detection using Z-score and rate-of-change analysis
    """
    
    def __init__(self, window_size: int = 60):
        self.window_size = window_size
        self.history: Dict[str, deque] = {}
        self.last_values: Dict[str, float] = {}
        self.last_time: Dict[str, float] = {}
        
    def update(self, machine_id: str, metric: str, value: float) -> Optional[Dict]:
        """
        Update detector with new value and return anomaly if detected
        
        Returns dict with detection info or None if normal
        """
        key = f"{machine_id}:{metric}"
        now = time.time()
        
        # Initialize history for this metric
        if key not in self.history:
            self.history[key] = deque(maxlen=self.window_size)
            self.last_values[key] = value
            self.last_time[key] = now
            return None
        
        history = self.history[key]
        history.append(value)
        
        # Need minimum samples for statistical analysis
        if len(history) < 10:
            self.last_values[key] = value
            self.last_time[key] = now
            return None
        
        # Calculate statistics
        mean = sum(history) / len(history)
        variance = sum((x - mean) ** 2 for x in history) / len(history)
        std_dev = math.sqrt(variance) if variance > 0 else 0.001
        
        # Z-score analysis
        z_score = (value - mean) / std_dev if std_dev > 0 else 0
        
        # Rate of change analysis
        time_delta = now - self.last_time[key]
        value_delta = value - self.last_values[key]
        roc = (value_delta / time_delta * 60) if time_delta > 0 else 0  # per minute
        
        # Update last values
        self.last_values[key] = value
        self.last_time[key] = now
        
        # Detection logic
        detection = None
        
        if metric == "temperature":
            detection = self._detect_temperature(value, z_score, roc)
        elif metric == "vibration":
            detection = self._detect_vibration(value, z_score, roc)
        
        if detection:
            detection["z_score"] = round(z_score, 2)
            detection["rate_of_change"] = round(roc, 2)
            return detection
        
        return None
    
    def _detect_temperature(self, temp: float, z_score: float, roc: float) -> Optional[Dict]:
        """Detect temperature anomalies"""
        if temp > Thresholds.temp_emergency or z_score > 4:
            return {
                "severity": "critical",
                "type": "thermal_runaway",
                "message": f"EMERGENCY: Temperature {temp:.1f}°C exceeds emergency threshold",
                "threshold": Thresholds.temp_emergency,
                "action": "emergency_stop",
                "zone": "red"
            }
        elif temp > Thresholds.temp_critical or (z_score > 3 and roc > Thresholds.roc_temp_threshold):
            return {
                "severity": "high",
                "type": "thermal_runaway",
                "message": f"CRITICAL: Thermal runaway detected at {temp:.1f}°C (RoC: {roc:.1f}°C/min)",
                "threshold": Thresholds.temp_critical,
                "action": "reduce_thermal_load",
                "zone": "yellow"
            }
        elif temp > Thresholds.temp_warning or z_score > 2.5:
            return {
                "severity": "medium",
                "type": "elevated_temperature",
                "message": f"WARNING: Elevated temperature {temp:.1f}°C",
                "threshold": Thresholds.temp_warning,
                "action": "increase_coolant",
                "zone": "green"
            }
        return None
    
    def _detect_vibration(self, vib: float, z_score: float, roc: float) -> Optional[Dict]:
        """Detect vibration anomalies"""
        if vib > Thresholds.vibration_emergency:
            return {
                "severity": "critical",
                "type": "bearing_failure",
                "message": f"EMERGENCY: Critical vibration {vib:.4f} mm/s - possible bearing failure",
                "threshold": Thresholds.vibration_emergency,
                "action": "emergency_stop",
                "zone": "red"
            }
        elif vib > Thresholds.vibration_critical or z_score > 3.5:
            return {
                "severity": "high",
                "type": "bearing_wear",
                "message": f"HIGH: Abnormal vibration {vib:.4f} mm/s detected",
                "threshold": Thresholds.vibration_critical,
                "action": "alert_maintenance",
                "zone": "red"
            }
        elif vib > Thresholds.vibration_warning or z_score > 2.5:
            return {
                "severity": "medium",
                "type": "increased_vibration",
                "message": f"WARNING: Elevated vibration {vib:.4f} mm/s",
                "threshold": Thresholds.vibration_warning,
                "action": "schedule_inspection",
                "zone": "green"
            }
        return None


class SentinelAgent:
    """
    Autonomous defense agent that monitors machines and executes responses
    Implements 3-tier safety circuit: Green (auto), Yellow (approval), Red (alert)
    """
    
    def __init__(self, broker: str = "localhost"):
        self.broker = broker
        self.detector = AnomalyDetector()
        self.detections: List[Detection] = []
        self.machines: Dict[str, Dict] = {}
        
        # MQTT setup
        self.client = mqtt.Client(client_id="sentinel-agent")
        self.client.on_connect = self._on_connect
        self.client.on_message = self._on_message
        
        # Action handlers
        self.actions: Dict[str, Callable] = {
            "emergency_stop": self._action_emergency_stop,
            "reduce_thermal_load": self._action_reduce_thermal_load,
            "increase_coolant": self._action_increase_coolant,
            "alert_maintenance": self._action_alert_maintenance,
            "schedule_inspection": self._action_schedule_inspection,
        }
        
        print("[AGENT] Sentinel Agent initialized")
        print(f"[AGENT] Safety Circuit: GREEN=auto | YELLOW=approval | RED=alert-only")
    
    def _on_connect(self, client, userdata, flags, rc):
        """MQTT connection callback"""
        if rc == 0:
            print(f"[AGENT] Connected to MQTT broker at {self.broker}")
            # Subscribe to all telemetry topics
            client.subscribe("factory/+/telemetry")
            print("[AGENT] Subscribed to factory/+/telemetry")
        else:
            print(f"[AGENT] Connection failed with code {rc}")
    
    def _on_message(self, client, userdata, msg):
        """Handle incoming telemetry"""
        try:
            payload = json.loads(msg.payload.decode())
            self._process_telemetry(payload)
        except json.JSONDecodeError as e:
            print(f"[ERROR] Invalid JSON: {e}")
        except Exception as e:
            print(f"[ERROR] Processing message: {e}")
    
    def _process_telemetry(self, data: Dict):
        """Process machine telemetry and detect anomalies"""
        machine_id = data.get("machine_id", "UNKNOWN")
        spindle = data.get("spindle", {})
        health = data.get("health", {})
        
        # Track machine state
        self.machines[machine_id] = {
            "last_seen": datetime.utcnow().isoformat(),
            "status": data.get("status", "unknown"),
            "temp": spindle.get("temp", 0),
            "vibration": spindle.get("vibration", 0),
            "rpm": spindle.get("rpm", 0),
        }
        
        # Run anomaly detection
        temp = spindle.get("temp", 0)
        vibration = spindle.get("vibration", 0)
        
        # Check temperature
        temp_detection = self.detector.update(machine_id, "temperature", temp)
        if temp_detection:
            self._handle_detection(machine_id, temp_detection, temp)
        
        # Check vibration
        vib_detection = self.detector.update(machine_id, "vibration", vibration)
        if vib_detection:
            self._handle_detection(machine_id, vib_detection, vibration)
    
    def _handle_detection(self, machine_id: str, detection: Dict, value: float):
        """Handle detected anomaly based on safety zone"""
        incident_id = f"INC-{uuid.uuid4().hex[:8].upper()}"
        
        # Create detection record
        det = Detection(
            timestamp=datetime.utcnow().isoformat() + "Z",
            machine_id=machine_id,
            severity=detection["severity"],
            detection_type=detection["type"],
            message=detection["message"],
            value=value,
            threshold=detection["threshold"],
            recommended_action=detection["action"],
            action_zone=detection["zone"]
        )
        self.detections.append(det)
        
        # Log detection
        zone_color = {"green": "🟢", "yellow": "🟡", "red": "🔴"}
        print(f"\n{zone_color.get(det.action_zone, '⚪')} [DETECTION] {incident_id}")
        print(f"   Machine: {machine_id}")
        print(f"   Type: {detection['type'].upper()}")
        print(f"   Severity: {detection['severity'].upper()}")
        print(f"   Message: {detection['message']}")
        print(f"   Z-Score: {detection.get('z_score', 'N/A')} | RoC: {detection.get('rate_of_change', 'N/A')}")
        print(f"   Safety Zone: {det.action_zone.upper()}")
        
        # Execute action based on safety zone
        if det.action_zone == "green":
            # Auto-execute
            self._execute_action(machine_id, detection["action"], incident_id)
        elif det.action_zone == "yellow":
            # Request approval (simulate - in production, wait for dashboard)
            print(f"   [YELLOW ZONE] Action '{detection['action']}' queued for approval")
            # For demo: auto-approve after 2 seconds
            time.sleep(2)
            print(f"   [AUTO-APPROVED] Executing '{detection['action']}'")
            self._execute_action(machine_id, detection["action"], incident_id)
        else:
            # Red zone - alert only
            print(f"   [RED ZONE] Human intervention required - NO autonomous action taken")
            self._publish_incident(det, incident_id, "alert_only")
    
    def _execute_action(self, machine_id: str, action: str, incident_id: str):
        """Execute autonomous response action"""
        handler = self.actions.get(action)
        if handler:
            print(f"   [ACTION] Executing: {action}")
            handler(machine_id, incident_id)
        else:
            print(f"   [ERROR] Unknown action: {action}")
    
    def _publish_command(self, machine_id: str, command: Dict):
        """Publish command to machine"""
        topic = f"factory/{machine_id}/command"
        try:
            self.client.publish(topic, json.dumps(command), qos=1)
            print(f"   [SENT] Command to {machine_id}: {command}")
        except Exception as e:
            print(f"   [ERROR] Failed to send command: {e}")
    
    def _publish_incident(self, detection: Detection, incident_id: str, status: str):
        """Publish incident to MQTT for dashboard"""
        topic = "sentinel/incidents"
        incident = {
            "incident_id": incident_id,
            "timestamp": detection.timestamp,
            "machine_id": detection.machine_id,
            "severity": detection.severity,
            "type": detection.detection_type,
            "message": detection.message,
            "value": detection.value,
            "threshold": detection.threshold,
            "action": detection.recommended_action,
            "action_status": status,
            "zone": detection.action_zone
        }
        try:
            self.client.publish(topic, json.dumps(incident), qos=1)
        except Exception as e:
            print(f"[ERROR] Failed to publish incident: {e}")
    
    # Action handlers
    def _action_emergency_stop(self, machine_id: str, incident_id: str):
        """Emergency stop the machine"""
        self._publish_command(machine_id, {"action": "emergency_stop"})
        self._publish_incident(self.detections[-1], incident_id, "auto_executed")
    
    def _action_reduce_thermal_load(self, machine_id: str, incident_id: str):
        """Reduce spindle speed and load to lower temperature"""
        self._publish_command(machine_id, {"action": "reduce_thermal_load"})
        self._publish_incident(self.detections[-1], incident_id, "auto_executed")
    
    def _action_increase_coolant(self, machine_id: str, incident_id: str):
        """Increase coolant flow (simulated)"""
        print(f"   [INFO] Coolant flow increased (simulated)")
        self._publish_incident(self.detections[-1], incident_id, "auto_executed")
    
    def _action_alert_maintenance(self, machine_id: str, incident_id: str):
        """Alert maintenance team"""
        print(f"   [ALERT] Maintenance team notified for {machine_id}")
        self._publish_incident(self.detections[-1], incident_id, "alert_only")
    
    def _action_schedule_inspection(self, machine_id: str, incident_id: str):
        """Schedule routine inspection"""
        print(f"   [INFO] Inspection scheduled for {machine_id}")
        self._publish_incident(self.detections[-1], incident_id, "auto_executed")
    
    def run(self):
        """Start the agent"""
        print(f"[AGENT] Connecting to MQTT broker at {self.broker}...")
        try:
            self.client.connect(self.broker, 1883, 60)
            self.client.loop_start()
            
            print("[AGENT] Running - Press Ctrl+C to stop")
            while True:
                time.sleep(1)
                
        except KeyboardInterrupt:
            print("\n[AGENT] Shutting down...")
            self.client.loop_stop()
            self.client.disconnect()
            print("[AGENT] Stopped")
        except Exception as e:
            print(f"[ERROR] {e}")


def main():
    import os
    broker = os.environ.get("MQTT_BROKER", "localhost")
    agent = SentinelAgent(broker=broker)
    agent.run()


if __name__ == "__main__":
    main()
