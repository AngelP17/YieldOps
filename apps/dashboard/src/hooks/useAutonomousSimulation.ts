import { useEffect, useRef, useCallback } from 'react';
import { useAppConfig } from '../App';
import type { Machine, ProductionJob } from '../types';

/**
 * Autonomous Simulation Hook
 * 
 * Simulates realistic fab behavior in demo mode:
 * - Machines automatically progress jobs (wafer count changes)
 * - Jobs automatically change status (QUEUED -> RUNNING -> COMPLETED)
 * - Random machine events (efficiency fluctuations, occasional failures)
 * - New jobs are auto-generated periodically
 * - Sensor data is generated for VM predictions
 */

interface SimulationConfig {
  enabled: boolean;
  jobProgressionInterval?: number;  // ms between job state updates
  machineEventInterval?: number;    // ms between machine events
  newJobInterval?: number;          // ms between new job generation
  sensorDataInterval?: number;      // ms between sensor updates
}

// Generate random sensor readings for a machine
function generateSensorData(machine: Machine) {
  const baseTemp = machine.max_temperature * 0.7;
  const baseVibration = machine.max_vibration * 0.3;
  
  return {
    temperature: baseTemp + (Math.random() - 0.5) * 10,
    vibration: baseVibration + (Math.random() - 0.5) * 2,
    pressure: 100 + Math.random() * 50,
    power_consumption: 500 + Math.random() * 300,
    recorded_at: new Date().toISOString(),
  };
}

// Generate a new job
function generateNewJob(index: number): ProductionJob {
  const customers = ['Apple', 'NVIDIA', 'AMD', 'Intel', 'Qualcomm', 'Samsung', 'MediaTek', 'Broadcom'];
  const recipes = ['N5-STD', 'N7-EXP', 'N3-ADV', 'N5-HOT', 'N7-STD', 'N3-EXP'];
  const customer = customers[Math.floor(Math.random() * customers.length)];
  const recipe = recipes[Math.floor(Math.random() * recipes.length)];
  const isHot = Math.random() > 0.85;
  
  return {
    job_id: `job-${Date.now()}-${index}`,
    job_name: `WF-${new Date().getFullYear()}-${String(1000 + index).slice(-4)}`,
    wafer_count: 20 + Math.floor(Math.random() * 40),
    priority_level: isHot ? 1 : Math.floor(Math.random() * 3) + 2,
    status: 'PENDING',
    recipe_type: recipe,
    is_hot_lot: isHot,
    customer_tag: customer,
    estimated_duration_minutes: 90 + Math.floor(Math.random() * 120),
    deadline: new Date(Date.now() + 86400000 * (2 + Math.floor(Math.random() * 5))).toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function useAutonomousSimulation(config: SimulationConfig) {
  const { 
    enabled, 
    jobProgressionInterval = 5000, 
    machineEventInterval = 8000, 
    newJobInterval = 15000,
    sensorDataInterval = 3000 
  } = config;
  
  const { machines, jobs, updateMachine, updateJob, addJob, isUsingMockData } = useAppConfig();
  
  // Refs to track intervals
  const jobIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const machineIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const newJobIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const sensorIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Track sensor data for VM
  interface SensorData {
    temperature: number;
    vibration: number;
    pressure: number;
    power_consumption: number;
    recorded_at: string;
  }
  const sensorDataRef = useRef<Record<string, SensorData>>({});

  // Use refs to store latest state and callbacks to avoid stale closures
  const stateRef = useRef({ machines, jobs, updateMachine, updateJob, addJob, isUsingMockData });
  stateRef.current = { machines, jobs, updateMachine, updateJob, addJob, isUsingMockData };

  /**
   * Simulate job progression
   * - QUEUED jobs with assigned machines -> RUNNING
   * - RUNNING jobs progress wafer count -> COMPLETED when done
   */
  const simulateJobProgression = useCallback(() => {
    const { isUsingMockData, jobs, machines, updateJob, updateMachine } = stateRef.current;
    if (!isUsingMockData) return;
    
    // Process RUNNING jobs - increment wafer progress
    jobs.forEach(job => {
      if (job.status === 'RUNNING' && job.assigned_machine_id) {
        // Lower chance to complete so jobs stay running longer
        if (Math.random() > 0.98) {
          updateJob(job.job_id, { 
            status: 'COMPLETED',
            actual_end_time: new Date().toISOString(),
          });
          
          // Free up the machine
          const machine = machines.find(m => m.machine_id === job.assigned_machine_id);
          if (machine) {
            updateMachine(machine.machine_id, { 
              status: 'IDLE',
              current_wafer_count: 0,
            });
          }
        }
      }
    });
    
    // Process QUEUED jobs - start them if machine is available
    // Only start a few at a time to prevent draining the queue too fast
    let startedCount = 0;
    const maxToStart = 2;
    
    jobs.forEach(job => {
      if (startedCount >= maxToStart) return;
      
      if (job.status === 'QUEUED' && job.assigned_machine_id) {
        const machine = machines.find(m => m.machine_id === job.assigned_machine_id);
        if (machine && machine.status === 'IDLE') {
          updateJob(job.job_id, { 
            status: 'RUNNING',
            actual_start_time: new Date().toISOString(),
          });
          updateMachine(machine.machine_id, { 
            status: 'RUNNING',
            current_wafer_count: job.wafer_count,
          });
          startedCount++;
        }
      }
    });
    
    // Auto-dispatch: Move PENDING jobs to QUEUED when machines are available
    // Only dispatch if we have enough pending jobs to keep the queue visible
    const pendingJobs = jobs
      .filter(j => j.status === 'PENDING')
      .sort((a, b) => {
        if (a.is_hot_lot !== b.is_hot_lot) return a.is_hot_lot ? -1 : 1;
        return a.priority_level - b.priority_level;
      });

    const idleMachines = machines.filter(m => m.status === 'IDLE');

    // Never drain pending below 3 — the system must always look alive
    if (pendingJobs.length > 3 && idleMachines.length > 0) {
      const machine = idleMachines[0];
      updateJob(pendingJobs[0].job_id, {
        status: 'QUEUED',
        assigned_machine_id: machine.machine_id,
      });
    }
  }, []);

  /**
   * Simulate machine events
   * - Efficiency fluctuations
   * - Occasional failures (rare)
   * - Recovery from DOWN/MAINTENANCE
   */
  const simulateMachineEvents = useCallback(() => {
    const { isUsingMockData, machines, updateMachine } = stateRef.current;
    if (!isUsingMockData) return;
    
    machines.forEach(machine => {
      // Skip if already in terminal state
      if (machine.status === 'DOWN' || machine.status === 'MAINTENANCE') {
        // Small chance to recover automatically
        if (Math.random() > 0.98) {
          updateMachine(machine.machine_id, { 
            status: 'IDLE', 
            efficiency_rating: 0.85 + Math.random() * 0.1 
          });
        }
        return;
      }
      
      // Small chance of failure (0.5% per cycle)
      if (Math.random() > 0.995) {
        updateMachine(machine.machine_id, { 
          status: 'DOWN', 
          efficiency_rating: 0 
        });
        return;
      }
      
      // Efficiency fluctuation (±2%)
      if (machine.status === 'RUNNING' && Math.random() > 0.7) {
        const fluctuation = (Math.random() - 0.5) * 0.04;
        const newEfficiency = Math.max(0.5, Math.min(1.0, machine.efficiency_rating + fluctuation));
        updateMachine(machine.machine_id, { efficiency_rating: newEfficiency });
      }
      
      // Update wafer count for running machines (simulate processing)
      if (machine.status === 'RUNNING' && machine.current_wafer_count > 0 && Math.random() > 0.8) {
        const newCount = Math.max(0, machine.current_wafer_count - Math.floor(Math.random() * 3));
        updateMachine(machine.machine_id, { current_wafer_count: newCount });
      }
    });
  }, []);

  /**
   * Ensure minimum jobs in each category - always maintain data
   * Adds jobs gradually to simulate realistic fab workflow
   */
  const ensureMinimumJobs = useCallback(() => {
    const { isUsingMockData, jobs, addJob } = stateRef.current;
    if (!isUsingMockData) return;

    const pendingJobs = jobs.filter(j => j.status === 'PENDING');
    const hotLots = jobs.filter(j => j.is_hot_lot && j.status !== 'COMPLETED' && j.status !== 'CANCELLED');

    // Keep pending queue healthy — add up to 2 jobs per cycle until we hit 8
    const deficit = 8 - pendingJobs.length;
    const toAdd = Math.min(deficit, 2);
    for (let i = 0; i < toAdd; i++) {
      const newJob = generateNewJob(jobs.length + Date.now() + i);
      newJob.status = 'PENDING';
      newJob.priority_level = Math.floor(Math.random() * 3) + 2;
      newJob.is_hot_lot = false;
      addJob(newJob);
    }

    // Add hot lots sparingly (max 3)
    if (hotLots.length < 3 && Math.random() > 0.7) {
      const newJob = generateNewJob(jobs.length + Date.now() + 99);
      newJob.status = 'PENDING';
      newJob.priority_level = 1;
      newJob.is_hot_lot = true;
      addJob(newJob);
    }
  }, []);

  /**
   * Generate sensor data for VM
   */
  const generateSensorDataForMachines = useCallback(() => {
    const { isUsingMockData, machines } = stateRef.current;
    if (!isUsingMockData) return;
    
    machines.forEach(machine => {
      if (machine.status === 'RUNNING') {
        sensorDataRef.current[machine.machine_id] = generateSensorData(machine);
      }
    });
  }, []);

  // Get current sensor data
  const getSensorData = useCallback(() => {
    return sensorDataRef.current;
  }, []);

  // Start/stop simulation
  useEffect(() => {
    if (!enabled || !isUsingMockData) {
      // Clear all intervals
      if (jobIntervalRef.current) clearInterval(jobIntervalRef.current);
      if (machineIntervalRef.current) clearInterval(machineIntervalRef.current);
      if (newJobIntervalRef.current) clearInterval(newJobIntervalRef.current);
      if (sensorIntervalRef.current) clearInterval(sensorIntervalRef.current);
      return;
    }
    
    // Run immediately on start
    ensureMinimumJobs();
    simulateJobProgression();
    simulateMachineEvents();
    generateSensorDataForMachines();
    
    // Start intervals
    jobIntervalRef.current = setInterval(simulateJobProgression, jobProgressionInterval);
    machineIntervalRef.current = setInterval(simulateMachineEvents, machineEventInterval);
    newJobIntervalRef.current = setInterval(ensureMinimumJobs, newJobInterval);
    sensorIntervalRef.current = setInterval(generateSensorDataForMachines, sensorDataInterval);
    
    return () => {
      if (jobIntervalRef.current) clearInterval(jobIntervalRef.current);
      if (machineIntervalRef.current) clearInterval(machineIntervalRef.current);
      if (newJobIntervalRef.current) clearInterval(newJobIntervalRef.current);
      if (sensorIntervalRef.current) clearInterval(sensorIntervalRef.current);
    };
  }, [
    enabled, 
    isUsingMockData, 
    jobProgressionInterval, 
    machineEventInterval, 
    newJobInterval,
    sensorDataInterval,
    simulateJobProgression, 
    simulateMachineEvents, 
    ensureMinimumJobs,
    generateSensorDataForMachines
  ]);

  return { getSensorData };
}

export default useAutonomousSimulation;
