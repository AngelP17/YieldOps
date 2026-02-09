import { useEffect, useRef, useCallback, useState } from 'react';
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
  
  // Track simulated jobs separately so they can be merged with real data
  const [simulatedJobs, setSimulatedJobs] = useState<ProductionJob[]>([]);
  
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
  
  // Ref to track simulated jobs to avoid dependency cycles
  const simulatedJobsRef = useRef<ProductionJob[]>([]);
  simulatedJobsRef.current = simulatedJobs;

  /**
   * Simulate job progression - CRITICAL FIX
   * - Simulated jobs flow: PENDING -> QUEUED -> RUNNING -> COMPLETED
   * - This runs on SIMULATED jobs regardless of isUsingMockData
   * - Real Supabase jobs are left alone (backend handles them)
   */
  const simulateJobProgression = useCallback(() => {
    const { isUsingMockData, jobs, machines, updateJob, updateMachine } = stateRef.current;
    const currentSimulated = simulatedJobsRef.current;
    
    // Get only simulated jobs that need progression
    const simulatedJobIds = new Set(currentSimulated.map(j => j.job_id));
    
    // Process RUNNING simulated jobs - chance to complete
    jobs.forEach(job => {
      if (job.status === 'RUNNING' && job.assigned_machine_id && simulatedJobIds.has(job.job_id)) {
        // 2% chance to complete per cycle - keeps jobs running for ~50 cycles
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
          
          // Also update in simulatedJobs tracking
          setSimulatedJobs(prev => prev.map(j => 
            j.job_id === job.job_id 
              ? { ...j, status: 'COMPLETED' as const, actual_end_time: new Date().toISOString() }
              : j
          ));
        }
      }
    });
    
    // Process QUEUED simulated jobs - start them if machine is available
    let startedCount = 0;
    const maxToStart = 2;
    
    jobs.forEach(job => {
      if (startedCount >= maxToStart) return;
      
      if (job.status === 'QUEUED' && job.assigned_machine_id && simulatedJobIds.has(job.job_id)) {
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
          
          // Also update in simulatedJobs tracking
          setSimulatedJobs(prev => prev.map(j => 
            j.job_id === job.job_id 
              ? { ...j, status: 'RUNNING' as const, actual_start_time: new Date().toISOString() }
              : j
          ));
        }
      }
    });
    
    // Auto-dispatch: Move PENDING simulated jobs to QUEUED when machines are available
    const pendingSimulatedJobs = jobs
      .filter(j => j.status === 'PENDING' && simulatedJobIds.has(j.job_id))
      .sort((a, b) => {
        if (a.is_hot_lot !== b.is_hot_lot) return a.is_hot_lot ? -1 : 1;
        return a.priority_level - b.priority_level;
      });

    const idleMachines = machines.filter(m => m.status === 'IDLE');

    // Dispatch simulated jobs to keep the system flowing
    // Never drain below 5 simulated pending jobs
    if (pendingSimulatedJobs.length > 5 && idleMachines.length > 0) {
      const machine = idleMachines[0];
      const jobToDispatch = pendingSimulatedJobs[0];
      
      updateJob(jobToDispatch.job_id, {
        status: 'QUEUED',
        assigned_machine_id: machine.machine_id,
      });
      
      // Also update in simulatedJobs tracking
      setSimulatedJobs(prev => prev.map(j => 
        j.job_id === jobToDispatch.job_id 
          ? { ...j, status: 'QUEUED' as const, assigned_machine_id: machine.machine_id }
          : j
      ));
    }
    
    // In mock mode, also process non-simulated jobs for full demo experience
    if (isUsingMockData) {
      // Process non-simulated RUNNING jobs
      jobs.forEach(job => {
        if (job.status === 'RUNNING' && job.assigned_machine_id && !simulatedJobIds.has(job.job_id)) {
          if (Math.random() > 0.98) {
            updateJob(job.job_id, { 
              status: 'COMPLETED',
              actual_end_time: new Date().toISOString(),
            });
            
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
      
      // Process non-simulated QUEUED jobs
      let mockStartedCount = 0;
      jobs.forEach(job => {
        if (mockStartedCount >= maxToStart) return;
        
        if (job.status === 'QUEUED' && job.assigned_machine_id && !simulatedJobIds.has(job.job_id)) {
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
            mockStartedCount++;
          }
        }
      });
      
      // Auto-dispatch from mock PENDING jobs
      const pendingMockJobs = jobs
        .filter(j => j.status === 'PENDING' && !simulatedJobIds.has(j.job_id))
        .sort((a, b) => {
          if (a.is_hot_lot !== b.is_hot_lot) return a.is_hot_lot ? -1 : 1;
          return a.priority_level - b.priority_level;
        });

      if (pendingMockJobs.length > 3 && idleMachines.length > mockStartedCount) {
        const machine = idleMachines[mockStartedCount];
        if (machine) {
          updateJob(pendingMockJobs[0].job_id, {
            status: 'QUEUED',
            assigned_machine_id: machine.machine_id,
          });
        }
      }
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
   * Ensure minimum jobs in each category - CRITICAL FIX
   * This now works in BOTH mock and Supabase modes
   * Simulated jobs are tracked separately and merged with real data
   * 
   * NOTE: Uses refs to avoid dependency cycles
   */
  const ensureMinimumJobs = useCallback(() => {
    const { jobs, isUsingMockData, addJob } = stateRef.current;
    const currentSimulated = simulatedJobsRef.current;

    // Count all pending jobs (both real and simulated)
    const allPendingJobs = jobs.filter(j => j.status === 'PENDING');
    const pendingSimulatedCount = currentSimulated.filter(j => j.status === 'PENDING').length;
    const realPendingCount = allPendingJobs.length - pendingSimulatedCount;
    
    // We want at least 8 pending jobs total
    // If we have real pending jobs from Supabase, respect those
    // Only add simulated jobs if real pending jobs are insufficient
    const deficit = Math.max(0, 8 - realPendingCount);
    const toAdd = Math.min(deficit, 2); // Add up to 2 per cycle
    
    if (toAdd > 0) {
      const newSimulatedJobs: ProductionJob[] = [];
      
      for (let i = 0; i < toAdd; i++) {
        const newJob = generateNewJob(jobs.length + currentSimulated.length + Date.now() + i);
        newJob.status = 'PENDING';
        newJob.priority_level = Math.floor(Math.random() * 3) + 2;
        newJob.is_hot_lot = false;
        newJob._isSimulated = true; // Mark as simulated
        newSimulatedJobs.push(newJob);
        
        // Also add via addJob for immediate UI feedback in mock mode
        if (isUsingMockData) {
          addJob(newJob);
        }
      }
      
      setSimulatedJobs(prev => [...prev, ...newSimulatedJobs].slice(-50)); // Keep last 50
    }

    // Ensure at least 2 hot lots in pending/queued/running
    const hotLots = jobs.filter(j => j.is_hot_lot && j.status !== 'COMPLETED' && j.status !== 'CANCELLED');
    const simulatedHotLots = currentSimulated.filter(j => j.is_hot_lot && j.status !== 'COMPLETED' && j.status !== 'CANCELLED');
    
    if (hotLots.length - simulatedHotLots.length < 2 && Math.random() > 0.7) {
      const newJob = generateNewJob(jobs.length + currentSimulated.length + Date.now() + 99);
      newJob.status = 'PENDING';
      newJob.priority_level = 1;
      newJob.is_hot_lot = true;
      newJob._isSimulated = true;
      
      setSimulatedJobs(prev => [...prev, newJob].slice(-50));
      
      if (isUsingMockData) {
        addJob(newJob);
      }
    }
  }, []); // No dependencies - uses refs instead

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

  // CRITICAL FIX: Job generation runs ALWAYS (not just when enabled)
  // This ensures pending jobs exist even when simulation is "paused"
  useEffect(() => {
    // Small delay to ensure initial render is complete
    const initialTimeout = setTimeout(() => {
      ensureMinimumJobs();
    }, 100);
    
    // Set up interval for job generation regardless of enabled state
    newJobIntervalRef.current = setInterval(ensureMinimumJobs, newJobInterval);
    
    return () => {
      clearTimeout(initialTimeout);
      if (newJobIntervalRef.current) clearInterval(newJobIntervalRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newJobInterval]); // Only re-run when interval changes

  // Job progression runs ALWAYS for simulated jobs (not just when enabled)
  // This ensures the system looks alive even when "paused"
  useEffect(() => {
    // Run immediately
    simulateJobProgression();
    
    // Start interval - slower when "paused" (10s vs 5s)
    const interval = enabled ? jobProgressionInterval : jobProgressionInterval * 2;
    jobIntervalRef.current = setInterval(simulateJobProgression, interval);
    
    return () => {
      if (jobIntervalRef.current) clearInterval(jobIntervalRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, jobProgressionInterval]);
  
  // Machine events and sensor data only run when enabled AND in mock mode
  useEffect(() => {
    if (!enabled || !isUsingMockData) {
      if (machineIntervalRef.current) clearInterval(machineIntervalRef.current);
      if (sensorIntervalRef.current) clearInterval(sensorIntervalRef.current);
      return;
    }
    
    simulateMachineEvents();
    generateSensorDataForMachines();
    
    machineIntervalRef.current = setInterval(simulateMachineEvents, machineEventInterval);
    sensorIntervalRef.current = setInterval(generateSensorDataForMachines, sensorDataInterval);
    
    return () => {
      if (machineIntervalRef.current) clearInterval(machineIntervalRef.current);
      if (sensorIntervalRef.current) clearInterval(sensorIntervalRef.current);
    };
  }, [
    enabled, 
    isUsingMockData, 
    machineEventInterval,
    sensorDataInterval,
    simulateMachineEvents,
    generateSensorDataForMachines
  ]);

  return { getSensorData, simulatedJobs };
}

export default useAutonomousSimulation;
