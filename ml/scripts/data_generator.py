"""
Synthetic sensor data generator for training ML models.
"""
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import os


def generate_sensor_data(n_samples=10000, anomaly_ratio=0.05):
    """Generate synthetic sensor readings with anomalies."""
    np.random.seed(42)
    
    # Normal operating parameters
    n_normal = int(n_samples * (1 - anomaly_ratio))
    n_anomaly = n_samples - n_normal
    
    # Normal readings
    normal_temp = np.random.normal(65, 5, n_normal)
    normal_vib = np.random.normal(2.0, 0.5, n_normal)
    normal_pressure = np.random.normal(1013, 10, n_normal)
    
    # Anomalous readings
    anomaly_temp = np.random.normal(82, 3, n_anomaly)
    anomaly_vib = np.random.normal(4.5, 0.8, n_anomaly)
    anomaly_pressure = np.random.normal(1050, 15, n_anomaly)
    
    # Combine
    temperatures = np.concatenate([normal_temp, anomaly_temp])
    vibrations = np.concatenate([normal_vib, anomaly_vib])
    pressures = np.concatenate([normal_pressure, anomaly_pressure])
    labels = np.concatenate([np.zeros(n_normal), np.ones(n_anomaly)])
    
    # Create DataFrame
    df = pd.DataFrame({
        'temperature': temperatures,
        'vibration': vibrations,
        'pressure': pressures,
        'is_anomaly': labels.astype(int)
    })
    
    # Shuffle
    df = df.sample(frac=1).reset_index(drop=True)
    
    return df


if __name__ == "__main__":
    df = generate_sensor_data(10000)
    os.makedirs('../data', exist_ok=True)
    df.to_csv('../data/training_data.csv', index=False)
    print(f"Generated {len(df)} samples")
    print(f"Anomalies: {df['is_anomaly'].sum()}")
