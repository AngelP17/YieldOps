//! Statistical detection algorithms for Aegis Sentinel
//!
//! Implements Z-score analysis, rate-of-change detection, and other
//! statistical methods for anomaly detection.

use std::collections::VecDeque;

/// Statistical analyzer using Z-score and rate-of-change
pub struct StatisticalAnalyzer {
    window_size: usize,
    history: VecDeque<f64>,
}

impl StatisticalAnalyzer {
    pub fn new(window_size: usize) -> Self {
        Self {
            window_size,
            history: VecDeque::with_capacity(window_size),
        }
    }
    
    /// Add a new value and calculate statistics
    pub fn update(&mut self, value: f64) -> Statistics {
        self.history.push_back(value);
        if self.history.len() > self.window_size {
            self.history.pop_front();
        }
        
        Statistics::from_data(&self.history)
    }
    
    /// Calculate Z-score for a value
    pub fn z_score(&self, value: f64) -> Option<f64> {
        let stats = Statistics::from_data(&self.history);
        if stats.std_dev == 0.0 {
            return Some(0.0);
        }
        Some((value - stats.mean) / stats.std_dev)
    }
    
    /// Detect if value is anomalous based on Z-score
    pub fn is_anomaly(&self, value: f64, threshold: f64) -> bool {
        match self.z_score(value) {
            Some(z) => z.abs() > threshold,
            None => false,
        }
    }
}

/// Statistical summary of a data set
#[derive(Debug, Clone, Copy)]
pub struct Statistics {
    pub mean: f64,
    pub std_dev: f64,
    pub min: f64,
    pub max: f64,
    pub count: usize,
}

impl Statistics {
    pub fn from_data(data: &VecDeque<f64>) -> Self {
        if data.is_empty() {
            return Self {
                mean: 0.0,
                std_dev: 0.0,
                min: 0.0,
                max: 0.0,
                count: 0,
            };
        }
        
        let count = data.len();
        let sum: f64 = data.iter().sum();
        let mean = sum / count as f64;
        
        let variance: f64 = data.iter()
            .map(|x| (x - mean).powi(2))
            .sum::<f64>() / count as f64;
        let std_dev = variance.sqrt();
        
        let min = *data.iter().min_by(|a, b| a.partial_cmp(b).unwrap()).unwrap();
        let max = *data.iter().max_by(|a, b| a.partial_cmp(b).unwrap()).unwrap();
        
        Self {
            mean,
            std_dev,
            min,
            max,
            count,
        }
    }
}

/// Rate of change detector
pub struct RateOfChangeDetector {
    last_value: Option<f64>,
    last_time: Option<std::time::Instant>,
}

impl RateOfChangeDetector {
    pub fn new() -> Self {
        Self {
            last_value: None,
            last_time: None,
        }
    }
    
    /// Calculate rate of change per minute
    pub fn update(&mut self, value: f64) -> Option<f64> {
        let now = std::time::Instant::now();
        
        let roc = if let (Some(last_val), Some(last_time)) = (self.last_value, self.last_time) {
            let time_delta = now.duration_since(last_time).as_secs_f64();
            if time_delta > 0.0 {
                let value_delta = value - last_val;
                Some(value_delta / time_delta * 60.0) // per minute
            } else {
                None
            }
        } else {
            None
        };
        
        self.last_value = Some(value);
        self.last_time = Some(now);
        
        roc
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_statistical_analyzer() {
        let mut analyzer = StatisticalAnalyzer::new(10);
        
        // Add normal values
        for i in 0..10 {
            analyzer.update(10.0 + i as f64 * 0.1);
        }
        
        // Normal value should not be anomaly
        assert!(!analyzer.is_anomaly(11.0, 3.0));
        
        // Extreme value should be anomaly
        assert!(analyzer.is_anomaly(100.0, 3.0));
    }
    
    #[test]
    fn test_rate_of_change() {
        let mut detector = RateOfChangeDetector::new();
        
        detector.update(10.0);
        std::thread::sleep(std::time::Duration::from_millis(100));
        let roc = detector.update(11.0);
        
        assert!(roc.is_some());
        // ROC should be approximately 600 per minute (1 degree per 0.1 second)
        assert!(roc.unwrap() > 500.0);
    }
}
