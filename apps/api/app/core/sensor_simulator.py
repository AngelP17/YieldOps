"""
Sensor Data Simulator for YieldOps

Generates realistic sensor readings for machines and automatically
creates Aegis incidents when thresholds are breached.

This bridges the gap between job simulation and Sentinel monitoring.
"""

import asyncio
import random
import logging
from datetime import datetime
from typing import Dict, List, Optional
from dataclasses import dataclass

from app.services.supabase_service import supabase_service

logger = logging.getLogger(__name__)


@dataclass
class SensorReading:
    """A sensor reading for a machine"""
    machine_id: str
    temperature: float
    vibration: float
    pressure: float
    power_consumption: float
    is_anomaly: bool
    recorded_at: datetime


class MachineSensorProfile:
    """Sensor behavior profile for a machine type"""
    
    def __init__(self, machine_type: str):
        self.machine_type = machine_type
        self.base_temp = 60.0
        self.temp_variance = 5.0
        self.base_vibration = 0.005
        self.vibration_variance = 0.003
        
        # Configure based on machine type
        if machine_type == "lithography":
            self.base_temp = 65.0
            self.base_vibration = 0.003
        elif machine_type == "etching":
            self.base_temp = 70.0
            self.base_vibration = 0.008
        elif machine_type == "deposition":
            self.base_temp = 75.0
            self.base_vibration = 0.006
        elif machine_type == "inspection":
            self.base_temp = 55.0
            self.base_vibration = 0.002
        elif machine_type == "cleaning":
            self.base_temp = 50.0
            self.base_vibration = 0.010
    
    def generate_reading(self, status: str, anomaly_chance: float = 0.05) -> Dict:
        """Generate a sensor reading based on machine status"""
        
        # Base values depend on status
        if status == "RUNNING":
            base_temp = self.base_temp + 10.0
            base_vib = self.base_vibration * 2.0
        elif status == "DOWN":
            base_temp = self.base_temp - 15.0
            base_vib = self.base_vibration * 0.3
        else:  # IDLE
            base_temp = self.base_temp
            base_vib = self.base_vibration
        
        # Normal variation
        temp = base_temp + random.gauss(0, self.temp_variance)
        vib = max(0, base_vib + random.gauss(0, self.vibration_variance))
        
        # Check for anomaly
        is_anomaly = random.random() < anomaly_chance
        
        if is_anomaly:
            # Spike the values
            temp += random.uniform(10, 25)
            vib += random.uniform(0.02, 0.05)
        
        return {
            "temperature": round(temp, 2),
            "vibration": round(vib, 5),
            "pressure": round(10.0 + random.uniform(0, 5), 2),
            "power_consumption": round(1000 + random.uniform(0, 500), 2),
            "is_anomaly": is_anomaly,
            "anomaly_score": round(random.uniform(0.7, 0.99), 4) if is_anomaly else None
        }


class SensorSimulator:
    """
    Continuous sensor data simulator for YieldOps.
    
    Runs in background to generate sensor readings that trigger
    Aegis Sentinel incidents when thresholds are breached.
    """
    
    def __init__(self, tick_interval: int = 30):
        self.tick_interval = tick_interval  # Seconds between readings
        self.running = False
        self.profiles: Dict[str, MachineSensorProfile] = {}
        self._task: Optional[asyncio.Task] = None
    
    def _get_profile(self, machine_type: str) -> MachineSensorProfile:
        """Get or create sensor profile for machine type"""
        if machine_type not in self.profiles:
            self.profiles[machine_type] = MachineSensorProfile(machine_type)
        return self.profiles[machine_type]
    
    async def generate_readings_for_all_machines(self) -> Dict:
        """Generate sensor readings for all machines"""
        try:
            # Get all machines
            machines = await supabase_service.get_machines()
            
            readings_generated = 0
            anomalies_created = 0
            
            for machine in machines:
                machine_id = machine["machine_id"]
                machine_type = machine.get("type", "etching")
                status = machine.get("status", "IDLE")
                
                # Generate reading
                profile = self._get_profile(machine_type)
                reading_data = profile.generate_reading(status)
                
                # Insert into database
                await supabase_service.insert_sensor_reading(
                    machine_id=machine_id,
                    temperature=reading_data["temperature"],
                    vibration=reading_data["vibration"],
                    is_anomaly=reading_data["is_anomaly"]
                )
                
                readings_generated += 1
                if reading_data["is_anomaly"]:
                    anomalies_created += 1
            
            result = {
                "readings_generated": readings_generated,
                "anomalies_created": anomalies_created,
                "timestamp": datetime.utcnow().isoformat()
            }
            
            if readings_generated > 0:
                logger.info(f"Sensor simulation: {readings_generated} readings, {anomalies_created} anomalies")
            
            return result
            
        except Exception as e:
            logger.error(f"Sensor simulation error: {e}")
            return {"error": str(e)}
    
    async def _run_loop(self):
        """Main simulation loop"""
        while self.running:
            try:
                await self.generate_readings_for_all_machines()
            except Exception as e:
                logger.error(f"Error in sensor simulation loop: {e}")
            
            # Wait for next tick
            await asyncio.sleep(self.tick_interval)
    
    def start(self):
        """Start the simulator"""
        if not self.running:
            self.running = True
            self._task = asyncio.create_task(self._run_loop())
            logger.info(f"Sensor simulator started (interval: {self.tick_interval}s)")
    
    def stop(self):
        """Stop the simulator"""
        self.running = False
        if self._task:
            self._task.cancel()
            self._task = None
        logger.info("Sensor simulator stopped")
    
    async def run_single_tick(self) -> Dict:
        """Run a single simulation tick (for API endpoint)"""
        return await self.generate_readings_for_all_machines()


# Singleton instance
sensor_simulator = SensorSimulator(tick_interval=30)


async def start_sensor_simulation():
    """Start the background sensor simulation"""
    sensor_simulator.start()


def stop_sensor_simulation():
    """Stop the background sensor simulation"""
    sensor_simulator.stop()
