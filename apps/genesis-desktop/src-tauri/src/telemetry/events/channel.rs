use std::sync::Arc;

use tauri::ipc::Channel;
use tokio::sync::RwLock;

use crate::telemetry::BrainEvent;

#[derive(Clone, Default)]
pub struct BrainEventChannel {
    subscribers: Arc<RwLock<Vec<Channel<BrainEvent>>>>,
}

impl BrainEventChannel {
    pub async fn add_subscriber(&self, channel: Channel<BrainEvent>) {
        self.subscribers.write().await.push(channel);
    }

    pub async fn broadcast(&self, event: BrainEvent) {
        let subscribers = self.subscribers.read().await;
        for channel in subscribers.iter() {
            let _ = channel.send(event.clone());
        }
    }
}
