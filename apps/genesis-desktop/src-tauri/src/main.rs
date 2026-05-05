#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    genesis_desktop_lib::install_panic_bootstrap();
    genesis_desktop_lib::run();
}
