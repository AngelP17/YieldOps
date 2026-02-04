"""
Virtual Metrology Engine

Ridge regression model for predicting film thickness from process parameters
(temperature, pressure, power_consumption). Includes EWMA-based Run-to-Run
(R2R) correction for closed-loop process control.
"""

import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import cross_val_score
import joblib
import os
from typing import Dict, List, Optional
import logging

logger = logging.getLogger(__name__)


class VirtualMetrologyEngine:
    """
    Predicts film thickness from process parameters using Ridge regression.
    Uses EWMA-based R2R correction for systematic drift compensation.
    """

    FEATURES = ['temperature', 'pressure', 'power_consumption']
    TARGET = 'thickness_nm'

    def __init__(self, model_path: str = None):
        self.model: Optional[Ridge] = None
        self.scaler: Optional[StandardScaler] = None
        self.model_path = model_path or "models/vm_ridge.pkl"
        self.scaler_path = self.model_path.replace(".pkl", "_scaler.pkl")
        self.is_trained = False
        self.feature_names: List[str] = []
        # EWMA state for R2R correction (keyed by tool_id)
        self.ewma_error: Dict[str, float] = {}
        self.ewma_lambda = 0.3  # smoothing factor

    def load_model(self) -> bool:
        """Load pre-trained model from disk."""
        try:
            if os.path.exists(self.model_path):
                self.model = joblib.load(self.model_path)
                self.scaler = joblib.load(self.scaler_path)
                self.is_trained = True
                logger.info("VM model loaded successfully")
                return True
            return False
        except Exception as e:
            logger.error(f"Failed to load VM model: {e}")
            return False

    def train(self, data: List[Dict]) -> Dict:
        """
        Train Ridge regression on joined sensor_readings + metrology_results.

        Args:
            data: List of dicts with feature columns and 'thickness_nm' target.

        Returns:
            Training metrics including R² scores.
        """
        if len(data) < 20:
            raise ValueError(f"Need at least 20 samples for training, got {len(data)}")

        df = pd.DataFrame(data)

        # Use available features from the expected set
        available_features = [f for f in self.FEATURES if f in df.columns]
        if len(available_features) < 1:
            raise ValueError(f"No usable features found. Expected: {self.FEATURES}")

        if self.TARGET not in df.columns:
            raise ValueError(f"Target column '{self.TARGET}' not found in data")

        X = df[available_features].fillna(df[available_features].mean())
        y = df[self.TARGET]

        # Scale features
        self.scaler = StandardScaler()
        X_scaled = self.scaler.fit_transform(X)

        # Train Ridge regression
        self.model = Ridge(alpha=1.0)
        self.model.fit(X_scaled, y)
        self.is_trained = True
        self.feature_names = available_features

        # Cross-validation (min 2 folds)
        n_folds = min(5, max(2, len(data) // 10))
        cv_scores = cross_val_score(self.model, X_scaled, y, cv=n_folds, scoring='r2')

        # Save model
        os.makedirs(os.path.dirname(self.model_path) or '.', exist_ok=True)
        joblib.dump(self.model, self.model_path)
        joblib.dump(self.scaler, self.scaler_path)

        logger.info(
            f"VM model trained on {len(data)} samples, "
            f"R²={np.mean(cv_scores):.3f}±{np.std(cv_scores):.3f}"
        )

        return {
            "trained": True,
            "samples": len(data),
            "features": available_features,
            "r2_mean": round(float(np.mean(cv_scores)), 4),
            "r2_std": round(float(np.std(cv_scores)), 4),
            "coefficients": {
                f: round(float(c), 6)
                for f, c in zip(available_features, self.model.coef_)
            },
        }

    def predict(self, features: Dict) -> Dict:
        """
        Predict film thickness from process parameters.

        Args:
            features: Dict with temperature, pressure, power_consumption, and optionally tool_id.

        Returns:
            Dict with predicted_thickness_nm, confidence_score, r2r_correction.
        """
        if not self.is_trained:
            if not self.load_model():
                return {
                    "error": "Model not trained",
                    "predicted_thickness_nm": None,
                    "confidence_score": 0.0,
                    "r2r_correction": 0.0,
                }

        # Build feature vector using trained feature order
        used_features = self.feature_names if self.feature_names else [
            f for f in self.FEATURES if f in features
        ]
        X = np.array([[features.get(f, 0) for f in used_features]])
        X_scaled = self.scaler.transform(X)

        prediction = float(self.model.predict(X_scaled)[0])

        # Apply R2R correction if EWMA error exists for this tool
        tool_id = features.get('tool_id')
        correction = 0.0
        if tool_id and tool_id in self.ewma_error:
            correction = self.ewma_error[tool_id]
            prediction -= correction

        # Confidence: based on how far features are from training distribution center
        feature_distance = float(np.mean(np.abs(X_scaled[0])))
        confidence = max(0.50, min(0.99, 1.0 - feature_distance * 0.15))

        return {
            "predicted_thickness_nm": round(prediction, 2),
            "confidence_score": round(confidence, 4),
            "r2r_correction": round(correction, 4),
        }

    def update_ewma(self, tool_id: str, actual: float, predicted: float) -> Dict:
        """
        Update EWMA error tracker after actual metrology measurement.
        Returns recommended recipe adjustment if drift exceeds threshold.

        EWMA formula: E_t = λ * error_t + (1-λ) * E_{t-1}
        """
        error = predicted - actual
        prev_ewma = self.ewma_error.get(tool_id, 0.0)
        new_ewma = self.ewma_lambda * error + (1 - self.ewma_lambda) * prev_ewma
        self.ewma_error[tool_id] = new_ewma

        adjustment = None
        # Trigger recipe adjustment if systematic drift > 1nm
        if abs(new_ewma) > 1.0:
            # Use model coefficient for temperature to calculate correction
            temp_coeff = 0.5  # default
            if self.is_trained and self.feature_names:
                temp_idx = next(
                    (i for i, f in enumerate(self.feature_names) if f == 'temperature'),
                    None,
                )
                if temp_idx is not None:
                    temp_coeff = float(self.model.coef_[temp_idx]) or 0.5

            temp_adjustment = -new_ewma / temp_coeff if temp_coeff != 0 else 0
            adjustment = {
                "parameter_name": "temperature",
                "adjustment_value": round(temp_adjustment, 4),
                "reason": f"EWMA drift correction: {new_ewma:.2f}nm systematic error",
            }

        return {
            "ewma_error": round(new_ewma, 4),
            "previous_ewma": round(prev_ewma, 4),
            "current_error": round(error, 4),
            "recipe_adjustment": adjustment,
        }

    def get_model_info(self) -> Dict:
        """Return current model state information."""
        return {
            "is_trained": self.is_trained,
            "features": self.feature_names,
            "ewma_tracked_tools": len(self.ewma_error),
            "model_path": self.model_path,
        }


# Singleton instance
vm_engine = VirtualMetrologyEngine()
