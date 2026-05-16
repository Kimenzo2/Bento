use std::collections::HashMap;

use crate::telemetry::{humanize_identifier, module_display_name, InsightRecord};

const MIN_SAMPLES: usize = 100;
const STRONG_CORRELATION: f32 = 0.7;

#[derive(Clone, Debug, Default)]
pub struct CorrelationPair {
    pub action: String,
    pub metric: String,
    pub samples: Vec<(f32, f32)>,
    pub pearson: f32,
    pub last_emitted_sample_len: usize,
}

#[derive(Default)]
pub struct CorrelationEngine {
    pairs: HashMap<(String, String), CorrelationPair>,
}

impl CorrelationEngine {
    pub fn observe(
        &mut self,
        module_id: &str,
        action: &str,
        metric: &str,
        action_frequency: f32,
        metric_delta: f32,
        now_ms: i64,
    ) -> Option<InsightRecord> {
        let key = (format!("{module_id}:{action}"), metric.to_string());
        let module_name = module_display_name(module_id);
        let action_name = humanize_identifier(action);
        let metric_name = humanize_identifier(metric);
        let display_action = format!("{module_name} {action_name}");
        let pair = self.pairs.entry(key.clone()).or_insert(CorrelationPair {
            action: display_action.clone(),
            metric: key.1.clone(),
            samples: Vec::with_capacity(128),
            pearson: 0.0,
            last_emitted_sample_len: 0,
        });
        pair.action = display_action.clone();
        pair.metric = metric_name.clone();

        pair.samples.push((action_frequency, metric_delta));
        if pair.samples.len() > 512 {
            let overflow = pair.samples.len() - 512;
            pair.samples.drain(0..overflow);
        }

        pair.pearson = pearson(&pair.samples);
        if pair.samples.len() < MIN_SAMPLES || pair.pearson.abs() < STRONG_CORRELATION {
            return None;
        }

        if pair.last_emitted_sample_len == pair.samples.len() {
            return None;
        }

        pair.last_emitted_sample_len = pair.samples.len();
        Some(InsightRecord {
            id: 0,
            discovered_at: now_ms,
            action: pair.action.clone(),
            metric: pair.metric.clone(),
            pearson: pair.pearson,
            n_samples: pair.samples.len() as i64,
            description: format!(
                "{} consistently shifts {} by {:.1}. Observed {} times.",
                pair.action,
                pair.metric,
                metric_delta,
                pair.samples.len()
            ),
        })
    }
}

fn pearson(samples: &[(f32, f32)]) -> f32 {
    if samples.len() < 2 {
        return 0.0;
    }

    let count = samples.len() as f32;
    let mean_x = samples.iter().map(|(x, _)| *x).sum::<f32>() / count;
    let mean_y = samples.iter().map(|(_, y)| *y).sum::<f32>() / count;

    let mut numerator = 0.0;
    let mut denominator_x = 0.0;
    let mut denominator_y = 0.0;

    for (x, y) in samples {
        let dx = *x - mean_x;
        let dy = *y - mean_y;
        numerator += dx * dy;
        denominator_x += dx * dx;
        denominator_y += dy * dy;
    }

    if denominator_x == 0.0 || denominator_y == 0.0 {
        return 0.0;
    }

    numerator / (denominator_x.sqrt() * denominator_y.sqrt())
}
