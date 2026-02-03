"""
Train Isolation Forest model for anomaly detection.
"""
import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
import joblib
import os


def train_model():
    # Load data
    df = pd.read_csv('../data/training_data.csv')
    
    X = df[['temperature', 'vibration', 'pressure']]
    y = df['is_anomaly']
    
    # Split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    
    # Scale
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    # Train Isolation Forest
    model = IsolationForest(
        contamination=0.05,
        random_state=42,
        n_estimators=100
    )
    model.fit(X_train_scaled)
    
    # Evaluate
    predictions = model.predict(X_test_scaled)
    predictions = np.where(predictions == -1, 1, 0)  # Convert to 0/1
    
    accuracy = (predictions == y_test).mean()
    print(f"Test Accuracy: {accuracy:.4f}")
    
    # Save model
    os.makedirs('../models', exist_ok=True)
    joblib.dump(model, '../models/isolation_forest.pkl')
    joblib.dump(scaler, '../models/scaler.pkl')
    
    print("Model saved to models/isolation_forest.pkl")


if __name__ == "__main__":
    train_model()
