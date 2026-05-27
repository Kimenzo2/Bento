#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    bento_desktop_lib::install_panic_bootstrap();
    bento_desktop_lib::run();
}
