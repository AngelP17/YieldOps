from supabase import create_client, Client
from typing import List, Optional, Dict, Any
from app.config import settings


class SupabaseService:
    def __init__(self):
        self.client: Client = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_SERVICE_KEY
        )
    
    # Machine operations
    async def get_machines(self, status: Optional[str] = None) -> List[Dict]:
        """Get all machines, optionally filtered by status."""
        query = self.client.table("machines").select("*")
        if status:
            query = query.eq("status", status)
        response = query.order("name").execute()
        return response.data or []
    
    async def get_machine(self, machine_id: str) -> Optional[Dict]:
        """Get a specific machine by ID."""
        response = self.client.table("machines").select("*").eq("machine_id", machine_id).single().execute()
        return response.data
    
    async def update_machine_status(self, machine_id: str, status: str) -> Dict:
        """Update machine status."""
        response = self.client.table("machines").update({"status": status}).eq("machine_id", machine_id).execute()
        return response.data
    
    async def update_machine_efficiency(self, machine_id: str, efficiency: float) -> Dict:
        """Update machine efficiency rating."""
        response = self.client.table("machines").update({"efficiency_rating": efficiency}).eq("machine_id", machine_id).execute()
        return response.data
    
    async def get_machine_queue_depths(self) -> Dict[str, int]:
        """Get queue depth for each machine."""
        response = self.client.table("production_jobs").select("assigned_machine_id") \
            .eq("status", "RUNNING") \
            .execute()

        depths: Dict[str, int] = {}
        for item in (response.data or []):
            mid = item.get("assigned_machine_id")
            if mid:
                depths[mid] = depths.get(mid, 0) + 1
        return depths
    
    async def get_machine_sensor_readings(self, machine_id: str, limit: int = 100) -> List[Dict]:
        """Get recent sensor readings for a machine."""
        response = self.client.table("sensor_readings") \
            .select("*") \
            .eq("machine_id", machine_id) \
            .order("recorded_at", desc=True) \
            .limit(limit) \
            .execute()
        return response.data or []
    
    async def get_machine_utilization(self, machine_id: str, hours: int = 24) -> float:
        """Get machine utilization percentage."""
        # Use the database function
        response = self.client.rpc("get_machine_utilization", {
            "p_machine_id": machine_id,
            "p_hours": hours
        }).execute()
        return response.data or 0.0
    
    # Job operations
    async def get_jobs(self, status: Optional[str] = None, priority: Optional[int] = None, limit: int = 100) -> List[Dict]:
        """Get jobs with optional filters."""
        query = self.client.table("production_jobs").select("*")
        
        if status:
            query = query.eq("status", status)
        if priority:
            query = query.eq("priority_level", priority)
        
        response = query.order("priority_level").order("created_at").limit(limit).execute()
        return response.data or []
    
    async def get_pending_jobs(self, priority_filter: Optional[int] = None, limit: int = 50) -> List[Dict]:
        """Get pending jobs sorted by priority."""
        query = self.client.table("production_jobs").select("*").eq("status", "PENDING")
        
        if priority_filter:
            query = query.eq("priority_level", priority_filter)
        
        response = query.order("priority_level").order("created_at").limit(limit).execute()
        return response.data or []
    
    async def get_job(self, job_id: str) -> Optional[Dict]:
        """Get a specific job by ID."""
        response = self.client.table("production_jobs").select("*").eq("job_id", job_id).single().execute()
        return response.data
    
    async def create_job(self, job_data: Dict) -> Dict:
        """Create a new production job."""
        response = self.client.table("production_jobs").insert(job_data).execute()
        return response.data[0] if response.data else {}
    
    async def assign_job(self, job_id: str, machine_id: str) -> Dict:
        """Assign a job to a machine."""
        response = self.client.table("production_jobs").update({
            "assigned_machine_id": machine_id,
            "status": "QUEUED"
        }).eq("job_id", job_id).execute()
        return response.data
    
    async def update_job_status(self, job_id: str, status: str) -> Dict:
        """Update job status."""
        response = self.client.table("production_jobs").update({"status": status}).eq("job_id", job_id).execute()
        return response.data
    
    async def reassign_jobs_from_machine(self, machine_id: str) -> None:
        """Reassign jobs from a machine back to pending."""
        self.client.table("production_jobs").update({
            "assigned_machine_id": None,
            "status": "PENDING"
        }).eq("assigned_machine_id", machine_id).eq("status", "RUNNING").execute()
    
    # Dispatch operations
    async def log_dispatch_decision(self, job_id: str, machine_id: str, reason: str) -> str:
        """Log a dispatch decision."""
        response = self.client.table("dispatch_decisions").insert({
            "job_id": job_id,
            "machine_id": machine_id,
            "decision_reason": reason
        }).execute()
        return response.data[0]["decision_id"] if response.data else ""
    
    async def get_dispatch_history(self, limit: int = 50) -> List[Dict]:
        """Get recent dispatch decisions."""
        response = self.client.table("dispatch_decisions") \
            .select("*, machines(name), production_jobs(job_name)") \
            .order("dispatched_at", desc=True) \
            .limit(limit) \
            .execute()
        return response.data or []
    
    # Sensor operations
    async def insert_sensor_reading(self, machine_id: str, temperature: float, vibration: float, is_anomaly: bool = False) -> Dict:
        """Insert a sensor reading."""
        response = self.client.table("sensor_readings").insert({
            "machine_id": machine_id,
            "temperature": temperature,
            "vibration": vibration,
            "is_anomaly": is_anomaly
        }).execute()
        return response.data[0] if response.data else {}
    
    # Analytics
    async def get_throughput_analytics(self, days: int = 7) -> List[Dict]:
        """Get throughput analytics."""
        response = self.client.table("production_jobs") \
            .select("status") \
            .execute()

        counts: Dict[str, int] = {}
        for item in (response.data or []):
            status = item.get("status", "UNKNOWN")
            counts[status] = counts.get(status, 0) + 1
        return [{"status": k, "count": v} for k, v in counts.items()]
    
    async def get_machine_statistics(self) -> Dict:
        """Get overall machine statistics."""
        machines = await self.get_machines()
        
        if not machines:
            return {
                "total_machines": 0,
                "running": 0,
                "idle": 0,
                "down": 0,
                "maintenance": 0,
                "avg_efficiency": 0
            }
        
        total = len(machines)
        running = sum(1 for m in machines if m.get("status") == "RUNNING")
        idle = sum(1 for m in machines if m.get("status") == "IDLE")
        down = sum(1 for m in machines if m.get("status") == "DOWN")
        maintenance = sum(1 for m in machines if m.get("status") == "MAINTENANCE")
        avg_efficiency = sum(m.get("efficiency_rating", 0) for m in machines) / total
        
        return {
            "total_machines": total,
            "running": running,
            "idle": idle,
            "down": down,
            "maintenance": maintenance,
            "avg_efficiency": round(avg_efficiency, 4)
        }
    
    async def get_anomaly_stats(self, days: int = 7) -> Dict:
        """Get anomaly detection statistics."""
        response = self.client.table("sensor_readings") \
            .select("is_anomaly") \
            .execute()

        data = response.data or []
        total = len(data)
        anomalies = sum(1 for item in data if item.get("is_anomaly"))
        
        return {
            "total_readings": total,
            "anomalies_detected": anomalies,
            "anomaly_rate": round(anomalies / total, 4) if total > 0 else 0
        }
    
    # Virtual Metrology operations
    async def get_sensor_readings(self, machine_id: str, hours: int = 24, include_predictions: bool = False) -> List[Dict]:
        """Get sensor readings for a machine within time window."""
        from datetime import datetime, timedelta
        
        cutoff_time = (datetime.utcnow() - timedelta(hours=hours)).isoformat()
        
        query = self.client.table("sensor_readings") \
            .select("*") \
            .eq("machine_id", machine_id) \
            .gte("recorded_at", cutoff_time) \
            .order("recorded_at", desc=True)
        
        response = query.execute()
        return response.data or []
    
    async def get_latest_sensor_reading(self, machine_id: str) -> Optional[Dict]:
        """Get the most recent sensor reading for a machine."""
        response = self.client.table("sensor_readings") \
            .select("*") \
            .eq("machine_id", machine_id) \
            .order("recorded_at", desc=True) \
            .limit(1) \
            .execute()
        
        return response.data[0] if response.data else None
    
    async def get_training_data(self) -> List[Dict]:
        """Get joined sensor readings and metrology results for VM training."""
        # This query joins sensor_readings with metrology_results on machine_id and time window
        # For now, return sensor readings with all available features
        response = self.client.table("sensor_readings") \
            .select("temperature, pressure, power_consumption, machine_id, recorded_at") \
            .not_.is_("temperature", "null") \
            .not_.is_("pressure", "null") \
            .not_.is_("power_consumption", "null") \
            .limit(1000) \
            .execute()
        
        # Add mock thickness values for training if no metrology_results table exists
        data = response.data or []
        for item in data:
            # Mock thickness calculation for demo purposes
            # In production, this would come from actual metrology_results
            temp_factor = item.get("temperature", 65) / 65.0
            pressure_factor = item.get("pressure", 10) / 10.0
            power_factor = item.get("power_consumption", 1000) / 1000.0
            item["thickness_nm"] = 500 * temp_factor * 0.3 + 500 * pressure_factor * 0.2 + 500 * power_factor * 0.5
        
        return data


    # Aegis Sentinel operations
    async def create_aegis_incident(self, incident_data: Dict) -> Dict:
        """Create a new Aegis incident."""
        response = self.client.table("aegis_incidents").insert(incident_data).execute()
        return response.data[0] if response.data else {}
    
    async def get_aegis_incidents(self, machine_id: Optional[str] = None, 
                                   limit: int = 50,
                                   resolved: Optional[bool] = None) -> List[Dict]:
        """Get Aegis incidents with optional filters."""
        query = self.client.table("aegis_incidents").select("*")
        
        if machine_id:
            query = query.eq("machine_id", machine_id)
        if resolved is not None:
            query = query.eq("resolved", resolved)
            
        response = query.order("created_at", desc=True).limit(limit).execute()
        return response.data or []
    
    async def update_aegis_incident(self, incident_id: str, update_data: Dict) -> Dict:
        """Update an Aegis incident."""
        response = self.client.table("aegis_incidents") \
            .update(update_data) \
            .eq("incident_id", incident_id) \
            .execute()
        return response.data[0] if response.data else {}


# Singleton instance
supabase_service = SupabaseService()
