#!/usr/bin/env python3
"""
SECS/GEM Bridge - Sidecar Pattern for Aegis Sentinel

This Python bridge handles the complex SECS/GEM binary protocol and translates
between MQTT (Rust Agent) and SECS-II messages (Manufacturing Equipment).

Architecture:
    [Rust Agent] <--(MQTT)--> [Python Bridge] <--(SECS/GEM)--> [Wire Bonder]

SECS/GEM Message Types Handled:
    - S1F1: Are You There (Equipment Status)
    - S2F41: Host Command Send (Remote Commands)
    - S6F11: Event Report Send (Equipment Events)
    - S5F1: Alarm Report Send (Equipment Alarms)

Author: Angel L. Pinzon
"""

import json
import os
import sys
import time
import signal
from dataclasses import dataclass, asdict
from typing import Optional, Dict, Any, Callable
from datetime import datetime

# SECS/GEM Library
try:
    import secsgem.gem
    import secsgem.hsms
    from secsgem.secs.functions import SecsS02F41, SecsS02F42
except ImportError:
    print("[ERROR] secsgem not installed. Run: pip install secsgem")
    sys.exit(1)

# MQTT Client
try:
    import paho.mqtt.client as mqtt
except ImportError:
    print("[ERROR] paho-mqtt not installed. Run: pip install paho-mqtt")
    sys.exit(1)


@dataclass
class SECSCommand:
    """SECS/GEM command from Rust Agent"""
    action: str
    machine_id: str
    reason: Optional[str] = None
    parameter_name: Optional[str] = None
    new_value: Optional[float] = None
    unit: Optional[str] = None


@dataclass
class SECSAck:
    """SECS/GEM command acknowledgment back to Rust Agent"""
    cmd: str
    status: str
    machine_id: str
    timestamp: str
    secs_stream: int
    secs_function: int


class SentinelGEMHandler(secsgem.gem.GemEquipmentHandler):
    """
    GEM Equipment Handler for Wire Bonders (K&S, ASM, etc.)
    
    Implements SECS-II message handling for semiconductor packaging equipment.
    """
    
    def __init__(self, address: str, port: int, active: bool = True, 
                 machine_id: str = "BOND-01"):
        self.machine_id = machine_id
        self.command_handlers: Dict[str, Callable] = {}
        self.mqtt_client: Optional[mqtt.Client] = None
        
        # Initialize GEM handler
        super().__init__(address=address, port=port, active=active)
        
        # Register command handlers
        self._register_commands()
    
    def _register_commands(self):
        """Register remote command handlers (S2F41)"""
        self.command_handlers = {
            "STOP": self._handle_stop,
            "PAUSE": self._handle_pause,
            "RESUME": self._handle_resume,
            "ABORT": self._handle_abort,
            "BOND_FORCE_ADJ": self._handle_bond_force_adjust,
        }
    
    def set_mqtt_client(self, client: mqtt.Client):
        """Set MQTT client for communicating with Rust Agent"""
        self.mqtt_client = client
    
    def on_remote_command(self, rcmd: str, params: list) -> bool:
        """
        Handle S2F41 (Host Command Send)
        
        This is the main entry point for remote commands from the host.
        The Rust Agent sends commands via MQTT, which get translated to SECS.
        """
        print(f"[SECS/GEM][{self.machine_id}] Received S2F41 RCMD: {rcmd}")
        print(f"[SECS/GEM][{self.machine_id}] Params: {params}")
        
        # Log the command
        self._log_command(rcmd, params)
        
        # Execute command handler
        handler = self.command_handlers.get(rcmd, self._handle_unknown)
        success = handler(params)
        
        # Send acknowledgment via MQTT to Rust Agent
        self._acknowledge_to_rust(rcmd, "EXECUTED" if success else "FAILED")
        
        return success
    
    def _handle_stop(self, params: list) -> bool:
        """Handle STOP command - Emergency feed hold"""
        print(f"[SECS/GEM][{self.machine_id}] Executing STOP (Feed Hold)")
        # In real implementation, this would send the actual stop signal
        # to the wire bonder via SECS S2F41 acknowledgment
        return True
    
    def _handle_pause(self, params: list) -> bool:
        """Handle PAUSE command - Temporary stop"""
        print(f"[SECS/GEM][{self.machine_id}] Executing PAUSE")
        return True
    
    def _handle_resume(self, params: list) -> bool:
        """Handle RESUME command - Resume operation"""
        print(f"[SECS/GEM][{self.machine_id}] Executing RESUME")
        return True
    
    def _handle_abort(self, params: list) -> bool:
        """Handle ABORT command - Abort current lot"""
        print(f"[SECS/GEM][{self.machine_id}] Executing ABORT")
        return True
    
    def _handle_bond_force_adjust(self, params: list) -> bool:
        """Handle bond force adjustment (Green Zone optimization)"""
        print(f"[SECS/GEM][{self.machine_id}] Adjusting Bond Force")
        # Parse parameters for force value
        for param in params:
            if hasattr(param, 'CPNAME') and param.CPNAME == 'FORCE_PCT':
                print(f"[SECS/GEM][{self.machine_id}] New force: {param.CPVAL}%")
        return True
    
    def _handle_unknown(self, params: list) -> bool:
        """Handle unknown commands"""
        print(f"[SECS/GEM][{self.machine_id}] Unknown command received")
        return False
    
    def _log_command(self, rcmd: str, params: list):
        """Log command for audit trail"""
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "machine_id": self.machine_id,
            "command": rcmd,
            "params": str(params),
            "protocol": "SECS-II",
            "stream": 2,
            "function": 41
        }
        print(f"[AUDIT] {json.dumps(log_entry)}")
    
    def _acknowledge_to_rust(self, rcmd: str, status: str):
        """Send acknowledgment back to Rust Agent via MQTT"""
        if self.mqtt_client and self.mqtt_client.is_connected():
            ack = SECSAck(
                cmd=rcmd,
                status=status,
                machine_id=self.machine_id,
                timestamp=datetime.utcnow().isoformat(),
                secs_stream=2,
                secs_function=42  # S2F42 is the acknowledgment
            )
            payload = json.dumps(asdict(ack))
            self.mqtt_client.publish("sentinel/bridge/ack", payload)
            print(f"[MQTT] Sent acknowledgment to Rust: {status}")


class SECSGEMBridge:
    """
    Main bridge class that coordinates MQTT and SECS/GEM connections.
    
    This implements the sidecar pattern - the Rust Agent doesn't need to
    understand SECS/GEM protocol details; it just sends high-level commands
    via MQTT.
    """
    
    def __init__(self):
        self.gem_handler: Optional[SentinelGEMHandler] = None
        self.mqtt_client: Optional[mqtt.Client] = None
        self.running = False
        
        # Configuration from environment
        self.mqtt_broker = os.getenv("MQTT_BROKER", "localhost")
        self.mqtt_port = int(os.getenv("MQTT_PORT", "1883"))
        self.gem_host = os.getenv("GEM_HOST", "127.0.0.1")
        self.gem_port = int(os.getenv("GEM_PORT", "5000"))
        self.machine_id = os.getenv("MACHINE_ID", "BOND-01")
        
        # Setup signal handlers
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
    
    def _signal_handler(self, signum, frame):
        """Handle shutdown signals gracefully"""
        print(f"\n[BRIDGE] Received signal {signum}, shutting down...")
        self.running = False
    
    def _on_mqtt_connect(self, client, userdata, flags, rc):
        """Callback when MQTT connects"""
        print(f"[MQTT] Connected to broker at {self.mqtt_broker}:{self.mqtt_port}")
        # Subscribe to command topic from Rust Agent
        client.subscribe("sentinel/bridge/command")
        client.subscribe(f"sentinel/bridge/command/{self.machine_id}")
        print(f"[MQTT] Subscribed to command topics")
    
    def _on_mqtt_message(self, client, userdata, msg):
        """Handle incoming MQTT messages from Rust Agent"""
        try:
            payload = json.loads(msg.payload.decode('utf-8'))
            print(f"[MQTT] Received from Rust: {payload}")
            
            # Parse command
            cmd = SECSCommand(
                action=payload.get('action', ''),
                machine_id=payload.get('machine_id', self.machine_id),
                reason=payload.get('reason'),
                parameter_name=payload.get('parameter_name'),
                new_value=payload.get('new_value'),
                unit=payload.get('unit')
            )
            
            # Execute SECS/GEM command
            self._execute_secs_command(cmd)
            
        except json.JSONDecodeError as e:
            print(f"[ERROR] Invalid JSON: {e}")
        except Exception as e:
            print(f"[ERROR] Failed to process command: {e}")
    
    def _execute_secs_command(self, cmd: SECSCommand):
        """
        Translate high-level command to SECS/GEM message.
        
        This is where the magic happens - Rust says "STOP", we translate to S2F41.
        """
        if not self.gem_handler:
            print("[ERROR] GEM handler not initialized")
            return
        
        print(f"[BRIDGE] Translating {cmd.action} to SECS/GEM")
        
        # Map high-level actions to SECS remote commands
        secs_rcmd = self._map_action_to_rcmd(cmd.action)
        
        # Build parameters list if needed
        params = []
        if cmd.parameter_name and cmd.new_value is not None:
            params.append({
                'CPNAME': cmd.parameter_name.upper(),
                'CPVAL': cmd.new_value
            })
        
        # Send SECS-II message
        try:
            success = self.gem_handler.send_remote_command(secs_rcmd, params)
            print(f"[SECS/GEM] Command {secs_rcmd} sent: {'OK' if success else 'FAIL'}")
        except Exception as e:
            print(f"[ERROR] SECS/GEM communication failed: {e}")
    
    def _map_action_to_rcmd(self, action: str) -> str:
        """Map high-level actions to SECS remote command names"""
        mapping = {
            "STOP": "STOP",
            "FEED_HOLD": "STOP",
            "PAUSE": "PAUSE",
            "RESUME": "RESUME",
            "ABORT": "ABORT",
            "ADJUST_PARAMETER": "BOND_FORCE_ADJ",
        }
        return mapping.get(action.upper(), action.upper())
    
    def start(self):
        """Start the bridge"""
        print("=" * 60)
        print("SECS/GEM Bridge for Aegis Sentinel")
        print("=" * 60)
        print(f"Machine ID: {self.machine_id}")
        print(f"MQTT Broker: {self.mqtt_broker}:{self.mqtt_port}")
        print(f"GEM Host: {self.gem_host}:{self.gem_port}")
        print("=" * 60)
        
        # Initialize MQTT client
        self.mqtt_client = mqtt.Client(client_id=f"gem-bridge-{self.machine_id}")
        self.mqtt_client.on_connect = self._on_mqtt_connect
        self.mqtt_client.on_message = self._on_mqtt_message
        
        try:
            self.mqtt_client.connect(self.mqtt_broker, self.mqtt_port, 60)
            print("[MQTT] Connected successfully")
        except Exception as e:
            print(f"[ERROR] MQTT connection failed: {e}")
            return
        
        # Initialize SECS/GEM handler
        self.gem_handler = SentinelGEMHandler(
            address=self.gem_host,
            port=self.gem_port,
            active=True,
            machine_id=self.machine_id
        )
        self.gem_handler.set_mqtt_client(self.mqtt_client)
        
        try:
            self.gem_handler.enable()
            print("[SECS/GEM] Handler enabled")
        except Exception as e:
            print(f"[ERROR] GEM handler failed: {e}")
            return
        
        # Start MQTT loop
        self.mqtt_client.loop_start()
        
        self.running = True
        print("\n[BRIDGE] Running. Press Ctrl+C to exit.")
        
        # Keep running
        try:
            while self.running:
                time.sleep(1)
                # Heartbeat
                if self.mqtt_client.is_connected():
                    self.mqtt_client.publish(
                        "sentinel/bridge/heartbeat", 
                        json.dumps({
                            "machine_id": self.machine_id,
                            "timestamp": datetime.utcnow().isoformat(),
                            "status": "alive"
                        })
                    )
        except KeyboardInterrupt:
            pass
        finally:
            self.stop()
    
    def stop(self):
        """Stop the bridge gracefully"""
        print("\n[BRIDGE] Stopping...")
        
        if self.mqtt_client:
            self.mqtt_client.loop_stop()
            self.mqtt_client.disconnect()
            print("[MQTT] Disconnected")
        
        if self.gem_handler:
            self.gem_handler.disable()
            print("[SECS/GEM] Handler disabled")
        
        print("[BRIDGE] Stopped")


def main():
    """Main entry point"""
    bridge = SECSGEMBridge()
    bridge.start()


if __name__ == "__main__":
    main()
