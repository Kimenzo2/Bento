/**
 * Sound system performance benchmarks.
 * Run from browser DevTools:  import { runAll } from "$lib/services/sounds.bench"; runAll();
 *
 * Measures:
 *   - AudioContext creation + resume time
 *   - Preload + decode time (single + all sounds)
 *   - Ambient start latency (from call to buffer source start)
 *   - Alarm sound play latency
 *   - Crossfade stop delay accuracy
 *   - Decoded buffer memory estimate
 */

const sounds = {
  tiny: ["correct"] as const,
  ambient: ["gentle-rain", "ocean-waves", "river-flow", "fire-crackling", "forest-wind", "guitar-loop"] as const,
  alarm: ["alarm", "ringtone"] as const,
};

// ── Helpers ──────────────────────────────────────────────────────────

function elapsed(start: number): string {
  const ms = performance.now() - start;
  return ms < 1 ? `${(ms * 1000).toFixed(0)} µs` : `${ms.toFixed(2)} ms`;
}

function avg(arr: number[]): string {
  if (arr.length === 0) return "N/A";
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return `${mean.toFixed(2)} ms`;
}

function p95(arr: number[]): string {
  if (arr.length === 0) return "N/A";
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil(sorted.length * 0.95) - 1;
  return `${sorted[Math.min(idx, sorted.length - 1)].toFixed(2)} ms`;
}

function divider(title: string) {
  const line = "─".repeat(60);
  console.log(`\n${line}`);
  console.log(`  ${title}`);
  console.log(line);
}

// ── Benchmark 1: AudioContext creation ───────────────────────────────

async function benchAudioContext() {
  divider("1. AudioContext creation + resume");

  const times: number[] = [];
  for (let i = 0; i < 5; i++) {
    // Close any existing context from previous runs
    const existing = (window as any).__benchCtx;
    if (existing) await existing.close();

    const t0 = performance.now();
    const ctx = new AudioContext();
    const t1 = performance.now();
    await ctx.resume();
    const t2 = performance.now();
    times.push(t2 - t0);
    (window as any).__benchCtx = ctx;

    console.log(
      `  Run ${i + 1}:  new AudioContext() → ${(t1 - t0).toFixed(2)} ms, resume() → ${(t2 - t1).toFixed(2)} ms`
    );
  }

  if ((window as any).__benchCtx) await (window as any).__benchCtx.close();
  console.log(`  ─────────────────────────────────────`);
  console.log(`  Avg total: ${avg(times)}  |  P95: ${p95(times)}`);
}

// ── Benchmark 2: Preload + decode ────────────────────────────────────

async function benchPreload() {
  divider("2. Preload + decode (fetch + decodeAudioData)");

  const { preloadSounds, isSoundLoaded } = await import("./sounds");

  // Single sound (small — correct.mp3 ~41 KB)
  {
    const t0 = performance.now();
    const buffers = await preloadSounds(sounds.tiny as any);
    const t1 = performance.now();
    const buf = buffers[0];
    console.log(
      `  Single (correct.mp3):  ${(t1 - t0).toFixed(2)} ms  |  ` +
        `${buf.duration.toFixed(1)}s @ ${buf.sampleRate}Hz  |  ${(buf.length * 4 / 1024).toFixed(0)} KB`
    );
  }

  // All ambient sounds (6 files)
  {
    const t0 = performance.now();
    const buffers = await preloadSounds(sounds.ambient as any);
    const t1 = performance.now();
    let totalSamples = 0;
    let totalDuration = 0;
    for (const b of buffers) {
      totalSamples += b.length;
      totalDuration += b.duration;
    }
    const memKB = (totalSamples * 4 / 1024).toFixed(0);
    console.log(
      `  All ambient (6 files):  ${(t1 - t0).toFixed(2)} ms  |  ` +
        `${totalDuration.toFixed(0)}s total  |  ~${memKB} KB decoded`
    );
  }

  // Verify cache hit (should be instant)
  {
    const t0 = performance.now();
    await preloadSounds(sounds.ambient as any);
    const t1 = performance.now();
    console.log(
      `  Cache hit (6 files, 2nd call):  ${(t1 - t0).toFixed(3)} ms  |  ${isSoundLoaded("gentle-rain") ? "✓" : "✗"}`
    );
  }
}

// ── Benchmark 3: Ambient start latency ───────────────────────────────

async function benchAmbientStart() {
  divider("3. Ambient start latency (startAmbient → source.start())");

  const { startAmbient, stopAmbientImmediate } = await import("./sounds");

  // Ensure preloaded from prev benchmark
  const { preloadSounds } = await import("./sounds");
  await preloadSounds(sounds.ambient as any);

  const times: number[] = [];
  for (const name of sounds.ambient) {
    const t0 = performance.now();
    const player = await startAmbient(name as any, { volume: 0.2, fadeInMs: 0 });
    const t1 = performance.now();
    times.push(t1 - t0);
    console.log(`  ${name.padEnd(16)}  ${(t1 - t0).toFixed(2)} ms`);
    stopAmbientImmediate();
    // Small pause between plays
    await new Promise((r) => setTimeout(r, 50));
  }

  console.log(`  ─────────────────────────────────────`);
  console.log(`  Avg: ${avg(times)}  |  P95: ${p95(times)}`);
}

// ── Benchmark 4: Alarm play latency ──────────────────────────────────

async function benchAlarmPlay() {
  divider("4. Alarm sound play latency (playAlarmSound)");
  const { playAlarmSound, stopAlarmSound } = await import("./sounds");

  const times: number[] = [];
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    const audio = playAlarmSound("alarm", { loop: false, volume: 0.1 });
    if (audio) {
      // Measure when playback actually starts
      const onPlay = () => {
        const t1 = performance.now();
        times.push(t1 - t0);
        console.log(`  Run ${i + 1}:  ${(t1 - t0).toFixed(2)} ms`);
        audio.removeEventListener("play", onPlay);
        setTimeout(() => stopAlarmSound(audio), 100);
      };
      audio.addEventListener("play", onPlay);
    }
    // Wait before next
    await new Promise((r) => setTimeout(r, 200));
  }

  // Wait for last play event
  await new Promise((r) => setTimeout(r, 500));
  console.log(`  ─────────────────────────────────────`);
  console.log(`  Avg: ${avg(times)}  |  P95: ${p95(times)}`);
}

// ── Benchmark 5: Crossfade stop accuracy ────────────────────────────

async function benchCrossfade() {
  divider("5. Crossfade stop timing accuracy");

  const { startAmbient, stopAmbientImmediate } = await import("./sounds");
  const { preloadSounds } = await import("./sounds");
  await preloadSounds(sounds.ambient as any);

  // Start a sound, then stop it with a 200ms ramp, measure actual stop time
  const rampMs = 200;
  const player = await startAmbient("gentle-rain" as any, { volume: 0.2, fadeInMs: 0 });

  await new Promise((r) => setTimeout(r, 100));

  const t0 = performance.now();
  await player.stop(rampMs);
  const t1 = performance.now();

  const actual = t1 - t0;
  const drift = actual - rampMs;
  console.log(`  Requested ramp: ${rampMs} ms`);
  console.log(`  Actual stop:    ${actual.toFixed(2)} ms`);
  console.log(`  Drift:          ${drift > 0 ? "+" : ""}${drift.toFixed(2)} ms  ${Math.abs(drift) < 20 ? "✓ Good" : "⚠ Needs tuning"}`);
}

// ── Benchmark 6: Memory estimate ─────────────────────────────────────

async function benchMemory() {
  divider("6. Decoded buffer memory estimate");

  const { preloadSounds, isSoundLoaded } = await import("./sounds");

  // Ensure everything is loaded
  const allSounds = [...sounds.tiny, ...sounds.ambient, ...sounds.alarm];
  const buffers = await preloadSounds(allSounds as any);

  let totalSamples = 0;
  let totalBytes = 0;
  for (const b of buffers) {
    totalSamples += b.length;
    // Each float sample = 4 bytes, times number of channels
    totalBytes += b.length * 4 * b.numberOfChannels;
  }

  console.log(`  Files decoded:     ${buffers.length}`);
  console.log(`  Total samples:     ${totalSamples.toLocaleString()}`);
  console.log(`  Estimated memory:  ${(totalBytes / 1024 / 1024).toFixed(2)} MB (float32, all channels)`);
  console.log(`  Longest sound:     ${Math.max(...buffers.map((b) => b.duration)).toFixed(1)}s`);
  console.log(`  Shortest sound:    ${Math.min(...buffers.map((b) => b.duration)).toFixed(1)}s`);
}

// ── Run all ──────────────────────────────────────────────────────────

export async function runAll() {
  console.clear();
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║         🔊 Sound System Performance Benchmarks      ║");
  console.log("╚══════════════════════════════════════════════════════╝");
  console.log(`  Timestamp: ${new Date().toISOString()}`);
  console.log(`  User Agent: ${navigator.userAgent}`);
  console.log(`  AudioContext: ${"AudioContext" in window ? "✓ supported" : "✗ not supported"}`);

  await benchAudioContext();
  await benchPreload();
  await benchAmbientStart();
  await benchAlarmPlay();
  await benchCrossfade();
  await benchMemory();

  divider("DONE");
  console.log("  Results above. Run `runAll()` again to re-test.\n");
}

// Auto-run on hot module reload in dev
if (import.meta.hot) {
  import.meta.hot.accept(() => {});
}
