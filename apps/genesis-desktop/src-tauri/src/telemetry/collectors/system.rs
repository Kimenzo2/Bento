use std::{path::Path, time::Instant};

use sysinfo::{
    Disk, Disks, MemoryRefreshKind, Networks, ProcessRefreshKind, ProcessesToUpdate, RefreshKind,
    System, get_current_pid,
};

use crate::telemetry::SystemSnapshot;

use super::process::ProcessCollector;

pub struct SystemCollector {
    sys: System,
    pid: sysinfo::Pid,
    disks: Disks,
    networks: Networks,
    last_network_update: (Instant, u64, u64),
}

impl SystemCollector {
    pub fn new() -> Result<Self, String> {
        let networks = Networks::new_with_refreshed_list();
        let (initial_rx, initial_tx) = networks
            .iter()
            .fold((0, 0), |(current_rx, current_tx), (_, data)| {
                (
                    current_rx + data.total_received(),
                    current_tx + data.total_transmitted(),
                )
            });

        Ok(Self {
            sys: System::new_all(),
            pid: get_current_pid().map_err(|error| error.to_string())?,
            disks: Disks::new_with_refreshed_list(),
            networks,
            last_network_update: (Instant::now(), initial_rx, initial_tx),
        })
    }

    pub fn collect(&mut self) -> SystemSnapshot {
        self.sys.refresh_specifics(
            RefreshKind::nothing()
                .with_memory(MemoryRefreshKind::everything())
                .with_processes(ProcessRefreshKind::everything()),
        );
        self.sys.refresh_processes(ProcessesToUpdate::All, true);
        self.disks.refresh(true);
        self.networks.refresh(true);

        let process_heap_mb = self
            .sys
            .process(self.pid)
            .map(|process| process.memory() as f32 / 1_048_576.0)
            .unwrap_or(0.0);
        let webview_process_mb = ProcessCollector::collect_webview_mb(&self.sys, self.pid);
        let (network_rx_bytes, network_tx_bytes) = self.calculate_network_stats();
        let (disk_total_bytes, disk_used_bytes, disk_free_bytes) = self.calculate_disk_stats();

        SystemSnapshot {
            timestamp_ms: crate::telemetry::now_ms(),
            total_ram_mb: self.sys.total_memory() as f32 / 1_048_576.0,
            used_ram_mb: self.sys.used_memory() as f32 / 1_048_576.0,
            process_heap_mb,
            webview_process_mb,
            network_rx_bytes,
            network_tx_bytes,
            disk_total_bytes,
            disk_used_bytes,
            disk_free_bytes,
        }
    }

    #[cfg(not(target_os = "windows"))]
    fn filter_disks(disks: &[Disk]) -> impl Iterator<Item = &Disk> {
        disks
            .iter()
            .filter(|disk| disk.mount_point() == Path::new("/"))
    }

    #[cfg(target_os = "windows")]
    fn filter_disks(disks: &[Disk]) -> impl Iterator<Item = &Disk> {
        disks.iter()
    }

    fn calculate_network_stats(&mut self) -> (u64, u64) {
        let (current_rx, current_tx) = self.networks.iter().fold(
            (0, 0),
            |(current_rx, current_tx), (_, data)| {
                (
                    current_rx + data.total_received(),
                    current_tx + data.total_transmitted(),
                )
            },
        );

        let elapsed = self.last_network_update.0.elapsed().as_secs_f64();
        if elapsed <= f64::EPSILON {
            self.last_network_update = (Instant::now(), current_rx, current_tx);
            return (0, 0);
        }

        let rx_rate =
            ((current_rx.saturating_sub(self.last_network_update.1)) as f64 / elapsed) as u64;
        let tx_rate =
            ((current_tx.saturating_sub(self.last_network_update.2)) as f64 / elapsed) as u64;

        self.last_network_update = (Instant::now(), current_rx, current_tx);
        (rx_rate, tx_rate)
    }

    fn calculate_disk_stats(&self) -> (u64, u64, u64) {
        let disks = self.disks.list();
        Self::filter_disks(disks).fold((0, 0, 0), |(total, used, free), disk| {
            (
                total + disk.total_space(),
                used + (disk.total_space() - disk.available_space()),
                free + disk.available_space(),
            )
        })
    }
}
