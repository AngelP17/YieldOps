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

  /**
   * Simulate job progression
   * - QUEUED jobs with assigned machines -> RUNNING
   * - RUNNING jobs progress wafer count -> COMPLETED when done
   */
  const simulateJobProgression = useCallback(() => {
    if (!isUsingMockData) return;
    
    // Process RUNNING jobs - increment wafer progress
    jobs.forEach(job => {
      if (job.status === 'RUNNING' && job.assigned_machine_id) {
        // Randomly complete jobs
        if (Math.random() > 0.95) {
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
    jobs.forEach(job => {
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
        }
      }
    });
  }, [jobs, machines, updateJob, updateMachine, isUsingMockData]);

  /**
   * Simulate machine events
   * - Efficiency fluctuations
   * - Occasional failures (rare)
   * - Recovery from DOWN/MAINTENANCE
   */
  const simulateMachineEvents = useCallback(() => {
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
  }, [machines, updateMachine, isUsingMockData]);

  /**
   * Generate new jobs periodically
   */
  const generateNewJobs = useCallback(() => {
    if (!isUsingMockData) return;
    
    // Only add new jobs if we have less than 20 pending/queued
    const activeJobCount = jobs.filter(j => j.status === 'PENDING' || j.status === 'QUEUED').length;
    if (activeJobCount < 20 && Math.random() > 0.3) {
      const newJob = generateNewJob(jobs.length + 1);
      addJob(newJob);
    }
  }, [jobs, addJob, isUsingMockData]);

  /**
   * Generate sensor data for VM
   */
  const generateSensorDataForMachines = useCallback(() => {
    if (!isUsingMockData) return;
    
    machines.forEach(machine => {
      if (machine.status === 'RUNNING') {
        sensorDataRef.current[machine.machine_id] = generateSensorData(machine);
      }
    });
  }, [machines, isUsingMockData]);

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
    
    // Start intervals
    jobIntervalRef.current = setInterval(simulateJobProgression, jobProgressionInterval);
    machineIntervalRef.current = setInterval(simulateMachineEvents, machineEventInterval);
    newJobIntervalRef.current = setInterval(generateNewJobs, newJobInterval);
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
    generateNewJobs,
    generateSensorDataForMachines
  ]);

  return { getSensorData };
}

export default useAutonomousSimulation;
