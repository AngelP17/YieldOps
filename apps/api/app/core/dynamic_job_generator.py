"""
Dynamic Job Generator Service

Autonomously generates production jobs based on system load and configuration.
Integrates with Supabase Realtime for live job streaming to web/mobile clients.
"""

import asyncio
import random
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from dataclasses import dataclass
from supabase import Client

from app.config import settings

logger = logging.getLogger(__name__)


@dataclass
class JobGenerationConfig:
    """Configuration for autonomous job generation."""
    enabled: bool = True
    generation_interval_seconds: int = 15  # Generate faster
    min_jobs: int = 20  # Maintain more jobs for realistic fab
    max_jobs: int = 100  # Higher maximum
    hot_lot_probability: float = 0.15
    priority_distribution: Dict[str, float] = None
    customer_weights: Dict[str, float] = None
    recipe_types: List[str] = None
    
    def __post_init__(self):
        if self.priority_distribution is None:
            self.priority_distribution = {
                "1": 0.15, "2": 0.25, "3": 0.30, "4": 0.20, "5": 0.10
            }
        if self.customer_weights is None:
            self.customer_weights = {
                "Apple": 1.5, "NVIDIA": 1.4, "AMD": 1.3, "Intel": 1.2, "Qualcomm": 1.2,
                "Samsung": 1.1, "MediaTek": 1.0, "Broadcom": 1.0, "TI": 0.9, "NXP": 0.9,
                "ST": 0.8, "ADI": 0.8, "Maxim": 0.7, "Cirrus": 0.7, "INTERNAL": 0.5
            }
        if self.recipe_types is None:
            self.recipe_types = [
                "N3-ADV", "N5-HOT", "N5-STD", "N7-EXP", "N7-STD",
                "STANDARD_LOGIC", "MEMORY_DRAM", "GPU_DIE", "AI_ACCELERATOR",
                "HPC_CPU", "MOBILE_SOC", "NETWORK_CHIP", "MODEM_5G", "FPGA"
            ]


class DynamicJobGenerator:
    """
    Autonomous job generator that creates production jobs based on system load.
    
    Features:
    - Monitors current job queue depth
    - Generates jobs with weighted probability for customers, priorities, recipes
    - Integrates with Supabase Realtime for instant propagation
    - Configurable generation intervals and limits
    - Supports hot lots and priority-based scheduling
    """
    
    def __init__(self, supabase_client: Client):
        self.client = supabase_client
        self.config: JobGenerationConfig = JobGenerationConfig()
        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._generation_count = 0
        self._last_generation_time: Optional[datetime] = None
        
    async def load_config(self) -> JobGenerationConfig:
        """Load configuration from database."""
        try:
            response = self.client.table("job_generation_config").select("*").limit(1).execute()
            if response.data:
                data = response.data[0]
                self.config = JobGenerationConfig(
                    enabled=data.get("enabled", True),
                    generation_interval_seconds=data.get("generation_interval_seconds", 30),
                    min_jobs=data.get("min_jobs", 10),
                    max_jobs=data.get("max_jobs", 50),
                    hot_lot_probability=data.get("hot_lot_probability", 0.15),
                    priority_distribution=data.get("priority_distribution"),
                    customer_weights=data.get("customer_weights"),
                    recipe_types=data.get("recipe_types")
                )
            return self.config
        except Exception as e:
            logger.error(f"Failed to load job generation config: {e}")
            return self.config
    
    async def save_config(self, config: JobGenerationConfig) -> bool:
        """Save configuration to database."""
        try:
            self.client.table("job_generation_config").update({
                "enabled": config.enabled,
                "generation_interval_seconds": config.generation_interval_seconds,
                "min_jobs": config.min_jobs,
                "max_jobs": config.max_jobs,
                "hot_lot_probability": config.hot_lot_probability,
                "priority_distribution": config.priority_distribution,
                "customer_weights": config.customer_weights,
                "recipe_types": config.recipe_types,
                "updated_at": datetime.utcnow().isoformat()
            }).eq("config_id", self._get_config_id()).execute()
            self.config = config
            return True
        except Exception as e:
            logger.error(f"Failed to save job generation config: {e}")
            return False
    
    def _get_config_id(self) -> str:
        """Get the config_id from database."""
        try:
            response = self.client.table("job_generation_config").select("config_id").limit(1).execute()
            if response.data:
                return response.data[0]["config_id"]
        except Exception:
            pass
        return ""
    
    async def get_current_job_count(self) -> Dict[str, int]:
        """Get count of jobs by status."""
        try:
            response = self.client.table("production_jobs") \
                .select("status") \
                .in_("status", ["PENDING", "QUEUED", "RUNNING"]) \
                .execute()
            
            counts = {"PENDING": 0, "QUEUED": 0, "RUNNING": 0, "TOTAL": 0}
            for item in (response.data or []):
                status = item.get("status", "PENDING")
                counts[status] = counts.get(status, 0) + 1
                counts["TOTAL"] += 1
            return counts
        except Exception as e:
            logger.error(f"Failed to get job count: {e}")
            return {"PENDING": 0, "QUEUED": 0, "RUNNING": 0, "TOTAL": 0}
    
    def _select_customer(self) -> str:
        """Select a customer based on weighted probability."""
        customers = list(self.config.customer_weights.keys())
        weights = list(self.config.customer_weights.values())
        total_weight = sum(weights)
        r = random.uniform(0, total_weight)
        cumulative = 0
        for customer, weight in zip(customers, weights):
            cumulative += weight
            if r <= cumulative:
                return customer
        return customers[-1] if customers else "INTERNAL"
    
    def _select_priority(self, is_hot_lot: bool) -> int:
        """Select priority level based on distribution."""
        if is_hot_lot:
            return 1
        
        dist = self.config.priority_distribution
        r = random.random()
        cumulative = 0
        for priority in ["1", "2", "3", "4", "5"]:
            cumulative += dist.get(priority, 0.1)
            if r <= cumulative:
                return int(priority)
        return 3
    
    def _generate_job_name(self, is_hot_lot: bool) -> str:
        """Generate a unique job name."""
        year = datetime.utcnow().year
        
        # Get next sequence number for today
        try:
            today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
            response = self.client.table("production_jobs") \
                .select("job_name") \
                .like("job_name", f"{'HOT-AUTO' if is_hot_lot else 'AUTO'}-{year}-%") \
                .gte("created_at", today_start) \
                .execute()
            
            sequences = []
            for item in (response.data or []):
                name = item.get("job_name", "")
                parts = name.split("-")
                if len(parts) >= 3:
                    try:
                        sequences.append(int(parts[-1]))
                    except ValueError:
                        pass
            
            next_seq = max(sequences, default=1000) + 1
        except Exception:
            next_seq = random.randint(1001, 9999)
        
        prefix = "HOT-AUTO" if is_hot_lot else "AUTO"
        return f"{prefix}-{year}-{next_seq:04d}"
    
    async def generate_job(self, triggered_by: str = "scheduler") -> Optional[Dict[str, Any]]:
        """Generate a single autonomous job."""
        try:
            # Determine job parameters
            is_hot_lot = random.random() < self.config.hot_lot_probability
            priority = self._select_priority(is_hot_lot)
            customer = self._select_customer()
            recipe = random.choice(self.config.recipe_types)
            
            # Wafer count based on priority
            wafer_count = {
                1: 25,
                2: random.randint(20, 50),
                3: random.randint(50, 100),
                4: random.randint(100, 200),
                5: random.randint(150, 300)
            }.get(priority, 50)
            
            # Deadline based on priority
            days = {
                1: random.uniform(1, 2),
                2: random.uniform(2, 4),
                3: random.uniform(3, 7),
                4: random.uniform(5, 10),
                5: random.uniform(7, 14)
            }.get(priority, 7)
            deadline = datetime.utcnow() + timedelta(days=days)
            
            # Estimated duration
            estimated_minutes = 60 + random.randint(0, 600)
            
            # Create job data
            job_data = {
                "job_name": self._generate_job_name(is_hot_lot),
                "wafer_count": wafer_count,
                "priority_level": priority,
                "status": "PENDING",
                "recipe_type": recipe,
                "is_hot_lot": is_hot_lot,
                "customer_tag": customer,
                "deadline": deadline.isoformat(),
                "estimated_duration_minutes": estimated_minutes,
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            # Insert job
            response = self.client.table("production_jobs").insert(job_data).execute()
            
            if response.data:
                job_id = response.data[0]["job_id"]
                
                # Log the generation
                self.client.table("job_generation_log").insert({
                    "job_id": job_id,
                    "generation_reason": "AUTONOMOUS",
                    "triggered_by": triggered_by,
                    "config_snapshot": {
                        "hot_lot_probability": self.config.hot_lot_probability,
                        "priority_distribution": self.config.priority_distribution
                    }
                }).execute()
                
                self._generation_count += 1
                self._last_generation_time = datetime.utcnow()
                
                logger.info(f"Generated autonomous job: {job_data['job_name']} for {customer}")
                return response.data[0]
            
        except Exception as e:
            logger.error(f"Failed to generate job: {e}")
        
        return None
    
    async def generate_jobs_if_needed(self, batch_size: int = 5) -> int:
        """Generate jobs if current count is below minimum."""
        counts = await self.get_current_job_count()
        current_count = counts.get("TOTAL", 0)
        
        if current_count >= self.config.min_jobs:
            return 0
        
        needed = min(batch_size, self.config.min_jobs - current_count)
        generated = 0
        
        for _ in range(needed):
            job = await self.generate_job()
            if job:
                generated += 1
                # Small delay to prevent overwhelming the database
                await asyncio.sleep(0.1)
        
        return generated
    
    async def _generation_loop(self):
        """Main generation loop."""
        while self._running:
            try:
                # Reload config each iteration to pick up changes
                await self.load_config()
                
                if self.config.enabled:
                    generated = await self.generate_jobs_if_needed()
                    if generated > 0:
                        logger.info(f"Generated {generated} autonomous jobs")
                
                # Wait for next interval
                await asyncio.sleep(self.config.generation_interval_seconds)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in generation loop: {e}")
                await asyncio.sleep(5)  # Short delay on error
    
    def start(self):
        """Start the autonomous job generator."""
        if self._running:
            return
        
        self._running = True
        self._task = asyncio.create_task(self._generation_loop())
        logger.info("Dynamic job generator started")
    
    def stop(self):
        """Stop the autonomous job generator."""
        self._running = False
        if self._task:
            self._task.cancel()
            self._task = None
        logger.info("Dynamic job generator stopped")
    
    def is_running(self) -> bool:
        """Check if generator is running."""
        return self._running
    
    def get_stats(self) -> Dict[str, Any]:
        """Get generator statistics."""
        return {
            "running": self._running,
            "total_generated": self._generation_count,
            "last_generation": self._last_generation_time.isoformat() if self._last_generation_time else None,
            "config": {
                "enabled": self.config.enabled,
                "interval_seconds": self.config.generation_interval_seconds,
                "min_jobs": self.config.min_jobs,
                "max_jobs": self.config.max_jobs,
                "hot_lot_probability": self.config.hot_lot_probability
            }
        }


# Singleton instance
_job_generator: Optional[DynamicJobGenerator] = None


def get_job_generator(supabase_client: Client) -> DynamicJobGenerator:
    """Get or create the singleton job generator instance."""
    global _job_generator
    if _job_generator is None:
        _job_generator = DynamicJobGenerator(supabase_client)
    return _job_generator