# Genesis Local Packages (Deprecated)

**STATUS: These local packages are deprecated.**

Genesis now uses published npm packages from the `gen-engine` monorepo:

- `@lorenzootieno/gen-bridge` - Public SDK for Gen integration
- `@lorenzootieno/gen-renderer` - Rendering engine (OffscreenCanvas + Web Worker)
- `@lorenzootieno/gen-brain` - AI intelligence layer
- `@lorenzootieno/gen-voice` - Voice synthesis with lip sync

## Why These Files Exist

These were placeholder implementations during initial development.
The production code lives in the separate `gen-engine` repository.

## Safe to Delete

These directories can be safely deleted:

- `packages/brain/`
- `packages/bridge/`
- `packages/renderer/`
- `packages/voice/`

The npm packages are the source of truth and are imported via `package.json`.
