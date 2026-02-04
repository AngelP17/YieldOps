//! Constraint-Based Scheduler Optimizer
//!
//! Optimizes job-to-machine assignments using constraint satisfaction
//! and multi-objective scoring.

use pyo3::prelude::*;
use std::collections::{HashMap, HashSet};

/// Job for scheduling
#[pyclass]
#[derive(Clone, Debug)]
pub struct SchedulerJob {
    #[pyo3(get, set)]
    pub job_id: String,
    #[pyo3(get, set)]
    pub job_name: String,
    #[pyo3(get, set)]
    pub priority_level: i32, // 1=highest, 5=lowest
    #[pyo3(get, set)]
    pub wafer_count: i32,
    #[pyo3(get, set)]
    pub is_hot_lot: bool,
    #[pyo3(get, set)]
    pub recipe_type: String, // lithography, etching, deposition, etc.
    #[pyo3(get, set)]
    pub deadline_hours: Option<f64>, // hours until deadline, None = no deadline
}

#[pymethods]
impl SchedulerJob {
    #[new]
    #[pyo3(signature = (job_id, job_name, priority_level, wafer_count, is_hot_lot, recipe_type, deadline_hours=None))]
    pub fn new(
        job_id: String,
        job_name: String,
        priority_level: i32,
        wafer_count: i32,
        is_hot_lot: bool,
        recipe_type: String,
        deadline_hours: Option<f64>,
    ) -> Self {
        Self {
            job_id,
            job_name,
            priority_level,
            wafer_count,
            is_hot_lot,
            recipe_type,
            deadline_hours,
        }
    }
}

/// Machine for scheduling
#[pyclass]
#[derive(Clone, Debug)]
pub struct SchedulerMachine {
    #[pyo3(get, set)]
    pub machine_id: String,
    #[pyo3(get, set)]
    pub name: String,
    #[pyo3(get, set)]
    pub machine_type: String, // lithography, etching, deposition, etc.
    #[pyo3(get, set)]
    pub status: String, // IDLE, RUNNING, DOWN, MAINTENANCE
    #[pyo3(get, set)]
    pub efficiency_rating: f64,
    #[pyo3(get, set)]
    pub current_queue_depth: i32,
    #[pyo3(get, set)]
    pub estimated_available_hours: f64, // when machine will be free
}

#[pymethods]
impl SchedulerMachine {
    #[new]
    #[pyo3(signature = (machine_id, name, machine_type, status, efficiency_rating, current_queue_depth=0, estimated_available_hours=0.0))]
    pub fn new(
        machine_id: String,
        name: String,
        machine_type: String,
        status: String,
        efficiency_rating: f64,
        current_queue_depth: i32,
        estimated_available_hours: f64,
    ) -> Self {
        Self {
            machine_id,
            name,
            machine_type,
            status,
            efficiency_rating,
            current_queue_depth,
            estimated_available_hours,
        }
    }

    fn is_available(&self) -> bool {
        self.status == "IDLE" || self.status == "RUNNING"
    }
}

/// Assignment result for a single job-machine pair
#[pyclass]
#[derive(Clone, Debug)]
pub struct Assignment {
    #[pyo3(get)]
    pub job_id: String,
    #[pyo3(get)]
    pub job_name: String,
    #[pyo3(get)]
    pub machine_id: String,
    #[pyo3(get)]
    pub machine_name: String,
    #[pyo3(get)]
    pub score: f64,
    #[pyo3(get)]
    pub reason: String,
    #[pyo3(get)]
    pub estimated_start_hours: f64,
    #[pyo3(get)]
    pub constraint_violations: Vec<String>,
}

#[pymethods]
impl Assignment {
    fn __repr__(&self) -> String {
        format!(
            "Assignment({} -> {}, score={:.2})",
            self.job_name, self.machine_name, self.score
        )
    }
}

/// Overall optimization result
#[pyclass]
#[derive(Clone, Debug)]
pub struct OptimizationResult {
    #[pyo3(get)]
    pub assignments: Vec<Assignment>,
    #[pyo3(get)]
    pub total_score: f64,
    #[pyo3(get)]
    pub unassigned_jobs: Vec<String>,
    #[pyo3(get)]
    pub optimization_time_ms: f64,
}

#[pymethods]
impl OptimizationResult {
    fn __repr__(&self) -> String {
        format!(
            "OptimizationResult({} assignments, score={:.2}, {} unassigned)",
            self.assignments.len(),
            self.total_score,
            self.unassigned_jobs.len()
        )
    }
}

/// Constraint configuration
#[pyclass]
#[derive(Clone, Debug)]
pub struct ConstraintConfig {
    #[pyo3(get, set)]
    pub enforce_recipe_match: bool,
    #[pyo3(get, set)]
    pub enforce_deadlines: bool,
    #[pyo3(get, set)]
    pub priority_weight: f64,
    #[pyo3(get, set)]
    pub efficiency_weight: f64,
    #[pyo3(get, set)]
    pub deadline_weight: f64,
    #[pyo3(get, set)]
    pub queue_depth_weight: f64,
}

#[pymethods]
impl ConstraintConfig {
    #[new]
    #[pyo3(signature = (
        enforce_recipe_match=true,
        enforce_deadlines=false,
        priority_weight=0.3,
        efficiency_weight=0.3,
        deadline_weight=0.2,
        queue_depth_weight=0.2
    ))]
    pub fn new(
        enforce_recipe_match: bool,
        enforce_deadlines: bool,
        priority_weight: f64,
        efficiency_weight: f64,
        deadline_weight: f64,
        queue_depth_weight: f64,
    ) -> Self {
        Self {
            enforce_recipe_match,
            enforce_deadlines,
            priority_weight,
            efficiency_weight,
            deadline_weight,
            queue_depth_weight,
        }
    }
}

impl Default for ConstraintConfig {
    fn default() -> Self {
        Self::new(true, false, 0.3, 0.3, 0.2, 0.2)
    }
}

/// Recipe to machine type mapping
fn get_compatible_machine_types(recipe_type: &str) -> Vec<&'static str> {
    match recipe_type.to_lowercase().as_str() {
        "lithography" | "euv" | "duv" => vec!["lithography"],
        "etching" | "plasma_etch" | "etch" => vec!["etching"],
        "deposition" | "cvd" | "pvd" | "dep" => vec!["deposition"],
        "inspection" | "metrology" => vec!["inspection"],
        "cleaning" | "wet_clean" | "dry_clean" => vec!["cleaning"],
        _ => vec![
            "lithography",
            "etching",
            "deposition",
            "inspection",
            "cleaning",
        ], // any
    }
}

/// Main Scheduler Optimizer
#[pyclass]
pub struct SchedulerOptimizer {
    config: ConstraintConfig,
}

#[pymethods]
impl SchedulerOptimizer {
    #[new]
    #[pyo3(signature = (config=None))]
    pub fn new(config: Option<ConstraintConfig>) -> Self {
        Self {
            config: config.unwrap_or_default(),
        }
    }

    /// Optimize job assignments to machines
    ///
    /// # Arguments
    /// * `jobs` - Jobs to schedule
    /// * `machines` - Available machines
    /// * `max_assignments` - Maximum number of assignments to make
    #[pyo3(signature = (jobs, machines, max_assignments=10))]
    pub fn optimize(
        &self,
        jobs: Vec<SchedulerJob>,
        machines: Vec<SchedulerMachine>,
        max_assignments: usize,
    ) -> PyResult<OptimizationResult> {
        let start = std::time::Instant::now();

        // Sort jobs by priority (hot lots first, then by priority level)
        let mut sorted_jobs = jobs.clone();
        sorted_jobs.sort_by(|a, b| {
            // Hot lots first
            match (a.is_hot_lot, b.is_hot_lot) {
                (true, false) => std::cmp::Ordering::Less,
                (false, true) => std::cmp::Ordering::Greater,
                _ => a.priority_level.cmp(&b.priority_level),
            }
        });

        let mut assignments = Vec::new();
        let mut unassigned_jobs = Vec::new();
        let mut assigned_machines: HashSet<String> = HashSet::new();
        let mut machine_added_queue: HashMap<String, i32> = HashMap::new();

        for job in sorted_jobs
            .iter()
            .take(max_assignments + unassigned_jobs.len())
        {
            if assignments.len() >= max_assignments {
                break;
            }

            // Find best machine for this job
            let best_assignment =
                self.find_best_machine(&job, &machines, &assigned_machines, &machine_added_queue);

            match best_assignment {
                Some(assignment) => {
                    assigned_machines.insert(assignment.machine_id.clone());
                    *machine_added_queue
                        .entry(assignment.machine_id.clone())
                        .or_insert(0) += 1;
                    assignments.push(assignment);
                }
                None => {
                    unassigned_jobs.push(job.job_id.clone());
                }
            }
        }

        // Calculate total score
        let total_score: f64 = assignments.iter().map(|a| a.score).sum();

        let elapsed_ms = start.elapsed().as_secs_f64() * 1000.0;

        Ok(OptimizationResult {
            assignments,
            total_score,
            unassigned_jobs,
            optimization_time_ms: elapsed_ms,
        })
    }

    /// Get the current constraint configuration
    pub fn get_config(&self) -> ConstraintConfig {
        self.config.clone()
    }
}

impl SchedulerOptimizer {
    fn find_best_machine(
        &self,
        job: &SchedulerJob,
        machines: &[SchedulerMachine],
        assigned: &HashSet<String>,
        queue_additions: &HashMap<String, i32>,
    ) -> Option<Assignment> {
        let compatible_types = get_compatible_machine_types(&job.recipe_type);

        let mut best_score = f64::NEG_INFINITY;
        let mut best_machine: Option<&SchedulerMachine> = None;
        let mut best_violations: Vec<String> = Vec::new();

        for machine in machines {
            // Skip unavailable machines
            if !machine.is_available() {
                continue;
            }

            // Skip already assigned machines (for this batch)
            if assigned.contains(&machine.machine_id) {
                continue;
            }

            let mut violations = Vec::new();

            // Check recipe compatibility
            let type_matches = compatible_types
                .iter()
                .any(|t| machine.machine_type.to_lowercase().contains(t));

            if self.config.enforce_recipe_match && !type_matches {
                violations.push(format!(
                    "Recipe {} incompatible with {}",
                    job.recipe_type, machine.machine_type
                ));
                if self.config.enforce_recipe_match {
                    continue; // Hard constraint
                }
            }

            // Calculate score
            let score = self.calculate_score(job, machine, queue_additions);

            // Check deadline constraint
            if let Some(deadline) = job.deadline_hours {
                let additional_queue = queue_additions.get(&machine.machine_id).unwrap_or(&0);
                let estimated_start =
                    machine.estimated_available_hours + (*additional_queue as f64 * 2.0);
                if estimated_start > deadline {
                    violations.push(format!(
                        "Would miss deadline by {:.1}h",
                        estimated_start - deadline
                    ));
                    if self.config.enforce_deadlines {
                        continue; // Hard constraint
                    }
                }
            }

            if score > best_score {
                best_score = score;
                best_machine = Some(machine);
                best_violations = violations;
            }
        }

        best_machine.map(|machine| {
            let additional_queue = queue_additions.get(&machine.machine_id).unwrap_or(&0);
            let estimated_start =
                machine.estimated_available_hours + (*additional_queue as f64 * 2.0);

            let mut reason_parts = vec![
                format!("Optimizer v1.0"),
                format!("Score: {:.2}", best_score),
                format!("Efficiency: {:.0}%", machine.efficiency_rating * 100.0),
            ];
            if job.is_hot_lot {
                reason_parts.insert(1, "HOT LOT".to_string());
            }

            Assignment {
                job_id: job.job_id.clone(),
                job_name: job.job_name.clone(),
                machine_id: machine.machine_id.clone(),
                machine_name: machine.name.clone(),
                score: best_score,
                reason: reason_parts.join(" | "),
                estimated_start_hours: estimated_start,
                constraint_violations: best_violations,
            }
        })
    }

    fn calculate_score(
        &self,
        job: &SchedulerJob,
        machine: &SchedulerMachine,
        queue_additions: &HashMap<String, i32>,
    ) -> f64 {
        let mut score = 0.0;

        // Priority score (higher priority = higher score)
        // Priority 1 (hot) = 1.0, Priority 5 = 0.2
        let priority_score = if job.is_hot_lot {
            1.0
        } else {
            1.0 - ((job.priority_level - 1) as f64 * 0.2)
        };
        score += priority_score * self.config.priority_weight;

        // Efficiency score
        score += machine.efficiency_rating * self.config.efficiency_weight;

        // Deadline urgency score
        if let Some(deadline) = job.deadline_hours {
            // More urgent = higher score
            let urgency = (24.0 - deadline.min(24.0)) / 24.0;
            score += urgency * self.config.deadline_weight;
        }

        // Queue depth score (lower queue = higher score)
        let additional = queue_additions.get(&machine.machine_id).unwrap_or(&0);
        let total_queue = machine.current_queue_depth + additional;
        let queue_score = 1.0 / (1.0 + total_queue as f64 * 0.2);
        score += queue_score * self.config.queue_depth_weight;

        // Status bonus
        if machine.status == "IDLE" {
            score += 0.1;
        }

        score
    }
}

/// Python module initialization
#[pymodule]
fn yieldops_scheduler(m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add_class::<SchedulerJob>()?;
    m.add_class::<SchedulerMachine>()?;
    m.add_class::<Assignment>()?;
    m.add_class::<OptimizationResult>()?;
    m.add_class::<ConstraintConfig>()?;
    m.add_class::<SchedulerOptimizer>()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_jobs() -> Vec<SchedulerJob> {
        vec![
            SchedulerJob::new(
                "j1".into(),
                "HOT-LOT-001".into(),
                1,
                25,
                true,
                "lithography".into(),
                Some(4.0),
            ),
            SchedulerJob::new(
                "j2".into(),
                "WAFER-103".into(),
                2,
                50,
                false,
                "etching".into(),
                None,
            ),
            SchedulerJob::new(
                "j3".into(),
                "WAFER-104".into(),
                3,
                30,
                false,
                "deposition".into(),
                Some(12.0),
            ),
        ]
    }

    fn sample_machines() -> Vec<SchedulerMachine> {
        vec![
            SchedulerMachine::new(
                "m1".into(),
                "LITHO-01".into(),
                "lithography".into(),
                "IDLE".into(),
                0.95,
                0,
                0.0,
            ),
            SchedulerMachine::new(
                "m2".into(),
                "ETCH-01".into(),
                "etching".into(),
                "RUNNING".into(),
                0.88,
                1,
                2.0,
            ),
            SchedulerMachine::new(
                "m3".into(),
                "DEP-01".into(),
                "deposition".into(),
                "IDLE".into(),
                0.92,
                0,
                0.0,
            ),
            SchedulerMachine::new(
                "m4".into(),
                "LITHO-02".into(),
                "lithography".into(),
                "DOWN".into(),
                0.90,
                0,
                0.0,
            ),
        ]
    }

    #[test]
    fn test_optimize_assigns_jobs() {
        let optimizer = SchedulerOptimizer::new(None);
        let result = optimizer
            .optimize(sample_jobs(), sample_machines(), 10)
            .unwrap();

        assert!(!result.assignments.is_empty());
        assert!(result.total_score > 0.0);
    }

    #[test]
    fn test_hot_lot_prioritized() {
        let optimizer = SchedulerOptimizer::new(None);
        let result = optimizer
            .optimize(sample_jobs(), sample_machines(), 10)
            .unwrap();

        // First assignment should be the hot lot
        assert!(result.assignments[0].job_name.contains("HOT"));
    }

    #[test]
    fn test_respects_machine_type() {
        let optimizer =
            SchedulerOptimizer::new(Some(ConstraintConfig::new(true, false, 0.3, 0.3, 0.2, 0.2)));
        let result = optimizer
            .optimize(sample_jobs(), sample_machines(), 10)
            .unwrap();

        // Hot lot (lithography) should be assigned to LITHO-01 (not DOWN LITHO-02)
        let hot_lot_assignment = result
            .assignments
            .iter()
            .find(|a| a.job_name.contains("HOT"))
            .unwrap();
        assert_eq!(hot_lot_assignment.machine_name, "LITHO-01");
    }

    #[test]
    fn test_skips_down_machines() {
        let optimizer = SchedulerOptimizer::new(None);
        let result = optimizer
            .optimize(sample_jobs(), sample_machines(), 10)
            .unwrap();

        // No assignments should be to LITHO-02 (DOWN)
        for assignment in &result.assignments {
            assert_ne!(assignment.machine_name, "LITHO-02");
        }
    }
}
