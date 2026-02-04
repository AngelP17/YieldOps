import { useEffect, useState, useCallback } from 'react';
import { supabase, DatabaseMachine, DatabaseSensorReading, DatabaseProductionJob } from '../services/supabaseClient';

export interface RealtimeConfig {
  table: string;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  filter?: string;
}

export function useRealtime<T>(config: RealtimeConfig) {
  const [data, setData] = useState<T[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const subscribe = useCallback(() => {
    const channel = supabase
      .channel(`${config.table}-changes`)
      .on(
        'postgres_changes',
        {
          event: config.event || '*',
          schema: 'public',
          table: config.table,
          filter: config.filter,
        },
        (payload) => {
          console.log('Realtime update:', payload);
          
          setData((prev) => {
            if (payload.eventType === 'INSERT') {
              return [...prev, payload.new as T];
            }
            if (payload.eventType === 'UPDATE') {
              return prev.map((item: any) =>
                item.machine_id === payload.new.machine_id ||
                item.job_id === payload.new.job_id ||
                item.reading_id === payload.new.reading_id
                  ? (payload.new as T)
                  : item
              );
            }
            if (payload.eventType === 'DELETE') {
              return prev.filter((item: any) =>
                item.machine_id !== payload.old.machine_id &&
                item.job_id !== payload.old.job_id &&
                item.reading_id !== payload.old.reading_id
              );
            }
            return prev;
          });
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
        if (status === 'CHANNEL_ERROR') {
          setError(new Error('Realtime channel error'));
        }
      });

    return channel;
  }, [config.table, config.event, config.filter]);

  useEffect(() => {
    const channel = subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [subscribe]);

  return { data, isConnected, error, setData };
}

// Specialized hook for machines
export function useRealtimeMachines() {
  const { data, isConnected, error, setData } = useRealtime<DatabaseMachine>({
    table: 'machines',
    event: '*',
  });

  const refresh = useCallback(async () => {
    const { data: machines, error } = await supabase
      .from('machines')
      .select('*')
      .order('name');
    
    if (error) {
      console.error('Error fetching machines:', error);
      return;
    }
    
    setData(machines || []);
  }, [setData]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { machines: data, isConnected, error, refresh };
}

// Specialized hook for sensor readings
export function useRealtimeSensorReadings(machineId?: string) {
  const config: RealtimeConfig = {
    table: 'sensor_readings',
    event: 'INSERT',
  };
  
  if (machineId) {
    config.filter = `machine_id=eq.${machineId}`;
  }

  const { data, isConnected, error, setData } = useRealtime<DatabaseSensorReading>(config);

  useEffect(() => {
    // Initial fetch
    const fetchReadings = async () => {
      let query = supabase
        .from('sensor_readings')
        .select('*')
        .order('recorded_at', { ascending: false })
        .limit(100);
      
      if (machineId) {
        query = query.eq('machine_id', machineId);
      }
      
      const { data: readings, error } = await query;
      
      if (error) {
        console.error('Error fetching sensor readings:', error);
        return;
      }
      
      setData(readings || []);
    };

    fetchReadings();
  }, [machineId, setData]);

  return { readings: data, isConnected, error };
}

// Specialized hook for production jobs
export function useRealtimeJobs(status?: string) {
  const config: RealtimeConfig = {
    table: 'production_jobs',
    event: '*',
  };
  
  if (status) {
    config.filter = `status=eq.${status}`;
  }

  const { data, isConnected, error, setData } = useRealtime<DatabaseProductionJob>(config);

  const refresh = useCallback(async () => {
    let query = supabase
      .from('production_jobs')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (status) {
      query = query.eq('status', status);
    }
    
    const { data: jobs, error } = await query;
    
    if (error) {
      console.error('Error fetching jobs:', error);
      return;
    }
    
    setData(jobs || []);
  }, [status, setData]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { jobs: data, isConnected, error, refresh };
}

// Hook for fetching latest sensor data for all machines
export function useLatestSensorData() {
  const [sensorData, setSensorData] = useState<Record<string, { temperature?: number; vibration?: number }>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLatestReadings = async () => {
      setIsLoading(true);
      
      // Get the latest reading for each machine
      const { data: readings, error } = await supabase
        .from('sensor_readings')
        .select('machine_id, temperature, vibration, recorded_at')
        .order('recorded_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching sensor data:', error);
        setIsLoading(false);
        return;
      }

      // Get the latest reading per machine
      const latestByMachine: Record<string, { temperature?: number; vibration?: number }> = {};
      
      readings?.forEach((reading) => {
        if (!latestByMachine[reading.machine_id]) {
          latestByMachine[reading.machine_id] = {
            temperature: reading.temperature,
            vibration: reading.vibration,
          };
        }
      });

      setSensorData(latestByMachine);
      setIsLoading(false);
    };

    fetchLatestReadings();

    // Subscribe to new sensor readings
    const channel = supabase
      .channel('sensor-readings-latest')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sensor_readings',
        },
        (payload) => {
          const newReading = payload.new as DatabaseSensorReading;
          setSensorData((prev) => ({
            ...prev,
            [newReading.machine_id]: {
              temperature: newReading.temperature,
              vibration: newReading.vibration,
            },
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    
    const { data: readings, error } = await supabase
      .from('sensor_readings')
      .select('machine_id, temperature, vibration, recorded_at')
      .order('recorded_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching sensor data:', error);
      setIsLoading(false);
      return;
    }

    const latestByMachine: Record<string, { temperature?: number; vibration?: number }> = {};
    
    readings?.forEach((reading) => {
      if (!latestByMachine[reading.machine_id]) {
        latestByMachine[reading.machine_id] = {
          temperature: reading.temperature,
          vibration: reading.vibration,
        };
      }
    });

    setSensorData(latestByMachine);
    setIsLoading(false);
  }, []);

  return { sensorData, isLoading, refresh };
}
