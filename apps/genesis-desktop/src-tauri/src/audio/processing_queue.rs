// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

// ═══════════════════════════════════════════════════════════════════════
// Processing Queue — Per-note serial job queue
// ═══════════════════════════════════════════════════════════════════════
// Ported from OS June's domain/processing_queue.rs.
//
// Prevents race conditions when multiple recordings finish simultaneously.
// Each note/recording gets its own serial queue — tasks for the same
// recording execute one at a time, preserving context dependencies for
// incremental content generation.
//
// API:
//   enqueue(recording_id)       → (ProcessingTicket, queue_position)
//   queued_behind(recording_id) → number of jobs waiting
//   ProcessingTicket::lock()    → acquire per-recording lock
//   ProcessingTicket (Drop)     → auto-cleanup on completion
// ═══════════════════════════════════════════════════════════════════════

use std::collections::HashMap;
use std::sync::atomic::{AtomicI64, Ordering};
use std::sync::{Arc, Mutex};
use tokio::sync::Mutex as AsyncMutex;

// ─── Queue State ─────────────────────────────────────────────────────

/// Per-recording queue state.
struct NoteQueue {
    /// Async mutex ensuring serial execution for this recording.
    lock: Arc<AsyncMutex<()>>,
    /// Number of pending jobs (actively processing + queued).
    pending: AtomicI64,
}

/// Global queue registry — maps recording_id → queue.
static QUEUES: once_cell::sync::Lazy<Mutex<HashMap<String, Arc<NoteQueue>>>> =
    once_cell::sync::Lazy::new(|| Mutex::new(HashMap::new()));

// ─── Processing Ticket ───────────────────────────────────────────────

/// A handle for a queued processing job.
///
/// Holds the recording's mutex guard scope and auto-cleanup via Drop.
/// Usage:
///   let (ticket, position) = ProcessingQueue::enqueue("rec-123");
///   let _guard = ticket.lock().await;
///   // ... do work ...
///   // guard and ticket drop automatically, cleaning up the queue
pub struct ProcessingTicket {
    recording_id: String,
    /// Reference to the queue for cleanup on drop.
    queue: Option<Arc<NoteQueue>>,
    /// Whether finish() was called explicitly.
    finished: bool,
}

impl ProcessingTicket {
    /// Acquire the per-recording lock, waiting for any previous job to finish.
    /// Returns a guard that releases the lock when dropped.
    pub async fn lock(&self) -> tokio::sync::MutexGuard<'_, ()> {
        // Unwrap safety: lock is always set when queue is Some
        self.queue
            .as_ref()
            .expect("ProcessingTicket has no queue")
            .lock
            .lock()
            .await
    }

    /// Mark this job as complete and decrement the pending counter.
    pub fn finish(&mut self) {
        if self.finished {
            return;
        }
        self.finished = true;
        if let Some(ref queue) = self.queue {
            let prev = queue.pending.fetch_sub(1, Ordering::AcqRel);
            if prev <= 1 {
                // No more pending jobs — remove the queue entry
                if let Ok(mut queues) = QUEUES.lock() {
                    queues.remove(&self.recording_id);
                }
            }
        }
    }
}

impl Drop for ProcessingTicket {
    fn drop(&mut self) {
        self.finish();
    }
}

// ─── Public API ──────────────────────────────────────────────────────

/// Register a processing job for a recording and return a ticket + position.
///
/// Multiple calls for the same recording_id will queue sequentially.
/// The returned ticket:
///   - Provides `.lock()` to acquire the serial execution lock
///   - Auto-decrements pending count and cleans up on Drop
///
/// `position` is 1 for the currently running job, 2+ for queued jobs.
pub fn enqueue(recording_id: &str) -> (ProcessingTicket, i64) {
    let mut queues = QUEUES.lock().unwrap_or_else(|e| e.into_inner());

    let entry = queues.entry(recording_id.to_string()).or_insert_with(|| {
        Arc::new(NoteQueue {
            lock: Arc::new(AsyncMutex::new(())),
            pending: AtomicI64::new(0),
        })
    });

    // Position before incrementing: 0 = new, 1+ = already running/queued
    let position = entry.pending.load(Ordering::Acquire) + 1;
    entry.pending.fetch_add(1, Ordering::Release);

    let ticket = ProcessingTicket {
        recording_id: recording_id.to_string(),
        queue: Some(Arc::clone(entry)),
        finished: false,
    };

    (ticket, position)
}

/// Returns the number of jobs waiting behind the currently running task
/// for the given recording. Returns 0 if no jobs are queued or running.
pub fn queued_behind(recording_id: &str) -> i64 {
    let queues = QUEUES.lock().unwrap_or_else(|e| e.into_inner());
    match queues.get(recording_id) {
        Some(queue) => {
            let pending = queue.pending.load(Ordering::Acquire);
            pending.saturating_sub(1).max(0)
        }
        None => 0,
    }
}

/// Cancel all pending jobs for a recording — removes the queue entry.
/// Any in-flight job will still complete but subsequent enqueue() calls
/// for this recording will start fresh.
pub fn cancel(recording_id: &str) {
    if let Ok(mut queues) = QUEUES.lock() {
        queues.remove(recording_id);
    }
}

// ─── Tests ───────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_enqueue_returns_position_one_for_first_job() {
        let (_ticket, pos) = enqueue("test-rec-1");
        assert_eq!(pos, 1);
        // Cleanup
        cancel("test-rec-1");
    }

    #[test]
    fn test_enqueue_returns_increasing_positions() {
        let recording_id = "test-rec-2";
        let (t1, pos1) = enqueue(recording_id);
        assert_eq!(pos1, 1);

        let (t2, pos2) = enqueue(recording_id);
        assert_eq!(pos2, 2);

        let (t3, pos3) = enqueue(recording_id);
        assert_eq!(pos3, 3);

        // Drop t1 and t2 — should decrement pending
        drop(t1);
        drop(t2);

        // t3 is still alive: pending should be 1 (just t3)
        let behind = queued_behind(recording_id);
        assert_eq!(behind, 0);

        drop(t3);
        // All dropped: queue entry should be cleaned up
        let behind = queued_behind(recording_id);
        assert_eq!(behind, 0);
    }

    #[test]
    fn test_cancel_removes_queue() {
        let recording_id = "test-rec-3";
        let (_ticket, _pos) = enqueue(recording_id);
        assert!(queued_behind(recording_id) >= 0);

        cancel(recording_id);
        assert_eq!(queued_behind(recording_id), 0);
    }

    #[test]
    fn test_drop_cleans_up_queue_when_last_job() {
        let recording_id = "test-rec-4";
        {
            let (_ticket, _pos) = enqueue(recording_id);
            // Exiting scope drops ticket
        }
        assert_eq!(queued_behind(recording_id), 0);
    }

    #[test]
    fn test_finish_marks_complete_and_cleans_up() {
        let recording_id = "test-rec-5";
        let (mut ticket, _pos) = enqueue(recording_id);
        ticket.finish();
        assert_eq!(queued_behind(recording_id), 0);
    }

    #[test]
    fn test_multiple_recordings_independent() {
        let (t1, pos1) = enqueue("rec-a");
        let (t2, pos2) = enqueue("rec-b");
        assert_eq!(pos1, 1);
        assert_eq!(pos2, 1);

        assert_eq!(queued_behind("rec-a"), 0);
        assert_eq!(queued_behind("rec-b"), 0);

        drop(t1);
        drop(t2);
        assert_eq!(queued_behind("rec-a"), 0);
        assert_eq!(queued_behind("rec-b"), 0);
    }
}
