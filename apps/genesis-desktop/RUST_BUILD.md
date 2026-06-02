# Genesis Desktop Rust Build Notes

## Dev profile

`src-tauri/Cargo.toml` is configured for fast development builds:

```toml
[profile.dev]
codegen-units = 1
opt-level = 0
debug = 1
incremental = true
```

This keeps dev builds unoptimized, incrementally rebuildable, and light enough to fit the current Windows memory budget.

`scripts/tauri.ps1` also caps `CARGO_BUILD_JOBS` to `1` for dev launches so Cargo does not fan out too many concurrent rustc jobs on this machine.

On Windows, the launcher now bootstraps pinned vcpkg SQLCipher automatically unless `GENESIS_DESKTOP_SKIP_VCPKG_BOOTSTRAP=1` is set. If you want to preinstall it manually, run `bun run setup:vcpkg`.

## Release profile

Release builds are kept separate from dev builds:

```toml
[profile.release]
codegen-units = 1
opt-level = 3
debug = false
incremental = false
lto = "thin"
```

## Cargo clean

`cargo clean` must not run during local development. It deletes `src-tauri/target`, which removes the compiled artifact cache and forces the next build to start from scratch.

## Windows linker

The Windows Rust toolchain currently uses the MSVC linker (`link.exe`) through `src-tauri/.cargo/config.toml`. `lld-link` was crashing in this environment during the Tauri link step, so stability takes priority here.

## Sccache

`src-tauri/.cargo/config.toml` now sets `rustc-wrapper = "sccache"` so local `cargo build` and the CI workflow use the same compiler cache path. `sccache.exe` is already available in the current Windows environment via `~/.cargo/bin`, so no extra build-step wrapper is needed.

## Defender exclusions

The Rust build cache should be excluded from Windows Defender real-time scanning:

- `src-tauri/target`
- `%USERPROFILE%\.cargo`
- `%USERPROFILE%\.rustup`

This prevents file-lock contention and repeated rescans while Cargo writes build artifacts.

## Expected build times

With the cache warm, incremental Rust-only rebuilds should usually complete in a few seconds on this machine. Cold builds are still expensive because the backend pulls in the Tauri and Windows stacks, but the low-concurrency profile prevents the launch path from exhausting memory or crashing.

## Sidecar rebuilds

The `scripts/tauri.ps1` launcher uses the cached `genesis-mcp` binary when it already exists so normal desktop launches do not wait on a full sidecar rebuild. Set `GENESIS_DESKTOP_FORCE_MCP_REBUILD=1` to force Cargo to refresh that binary when the sidecar source changes.
