"""
Isolation Forest Anomaly Detection for IIoT Sensor Data

Trains on historical sensor readings to detect:
- Temperature spikes (overheating)
- Excessive vibration (mechanical issues)
- Unusual patterns indicating imminent failure
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
import joblib
import os
from typing import List, Dict
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class AnomalyDetector:
    """
    ML-based anomaly detection using Isolation Forest.
    
    Features:
    - temperature
    - vibration
    - pressure (if available)
    """
    
    def __init__(self, model_path: str = None):
        self.model: IsolationForest = None
        self.scaler: StandardScaler = None
        self.model_path = model_path or "models/isolation_forest.pkl"
        self.scaler_path = model_path.replace(".pkl", "_scaler.pkl") if model_path else "models/scaler.pkl"
        self.is_trained = False
        
    def load_model(self) -> bool:
        """Load pre-trained model from disk."""
        try:
            if os.path.exists(self.model_path):
                self.model = joblib.load(self.model_path)
                self.scaler = joblib.load(self.scaler_path)
                self.is_trained = True
                logger.info("Anomaly detection model loaded successfully")
                return True
            return False
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            return False
    
    def train(self, readings: List[Dict]) -> Dict:
        """
        Train Isolation Forest on sensor readings.
        
        Args:
            readings: List of dicts with 'temperature', 'vibration', 'pressure'
        
        Returns:
            Training metrics
        """
        if len(readings) < 100:
            raise ValueError("Need at least 100 readings for training")
        
        # Prepare data
        df = pd.DataFrame(readings)
        features = ['temperature', 'vibration']
        if 'pressure' in df.columns:
            features.append('pressure')
        
        X = df[features].fillna(df[features].mean())
        
        # Scale
        self.scaler = StandardScaler()
        X_scaled = self.scaler.fit_transform(X)
        
        # Train Isolation Forest
        # contamination=0.05 assumes 5% of data is anomalous
        self.model = IsolationForest(
            n_estimators=100,
            contamination=0.05,
            random_state=42,
            max_samples='auto'
        )
        self.model.fit(X_scaled)
        self.is_trained = True
        
        # Save model
        os.makedirs(os.path.dirname(self.model_path), exist_ok=True)
        joblib.dump(self.model, self.model_path)
        joblib.dump(self.scaler, self.scaler_path)
        
        # Training metrics
        predictions = self.model.predict(X_scaled)
        anomaly_count = (predictions == -1).sum()
        
        logger.info(f"Model trained. Detected {anomaly_count} anomalies in training data")
        
        return {
            "trained": True,
            "samples": len(readings),
            "features": features,
            "anomalies_detected": int(anomaly_count),
            "anomaly_ratio": float(anomaly_count / len(readings))
        }
    
    def predict(self, reading: Dict) -> Dict:
        """
        Predict if a sensor reading is anomalous.
        
        Returns:
            {
                "is_anomaly": bool,
                "anomaly_score": float (0-1, higher = more anomalous),
                "confidence": str ("low", "medium", "high")
            }
        """
        if not self.is_trained:
            if not self.load_model():
                return {
                    "is_anomaly": False,
                    "anomaly_score": 0.0,
                    "confidence": "none",
                    "error": "Model not trained"
                }
        
        features = ['temperature', 'vibration']
        if 'pressure' in reading:
            features.append('pressure')
        
        X = np.array([[reading.get(f, 0) for f in features]])
        X_scaled = self.scaler.transform(X)
        
        # Predict: -1 = anomaly, 1 = normal
        prediction = self.model.predict(X_scaled)[0]
        
        # Anomaly score (distance from decision boundary)
        score = self.model.score_samples(X_scaled)[0]
        # Normalize to 0-1 (higher = more anomalous)
        anomaly_score = 1 - (1 / (1 + np.exp(-score)))
        
        # Confidence based on distance from boundary
        if abs(score) < 0.3:
            confidence = "low"
        elif abs(score) < 0.6:
            confidence = "medium"
        else:
            confidence = "high"
        
        return {
            "is_anomaly": prediction == -1,
            "anomaly_score": round(float(anomaly_score), 4),
            "confidence": confidence,
            "raw_score": round(float(score), 4)
        }
    
    def batch_predict(self, readings: List[Dict]) -> List[Dict]:
        """Predict anomalies for multiple readings."""
        return [self.predict(r) for r in readings]


# Singleton instance
anomaly_detector = AnomalyDetector()
