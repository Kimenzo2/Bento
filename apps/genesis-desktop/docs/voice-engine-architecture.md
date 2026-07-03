# Bento Voice Engine — Architecture & Design

> **Status:** Design Proposal · **Date:** July 3, 2026  
> **Inspired by:** June (os-june), Minutes, OpenWhispr  
> **Constraint:** Must integrate with Bento's existing Agent Dock, Dynamic Island, Notes, and AI Agent — no new floating windows

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [System Architecture](#2-system-architecture)
3. [Audio Processing Pipeline](#3-audio-processing-pipeline)
4. [State Management](#4-state-management)
5. [Voice Engine Store](#5-voice-engine-store)
6. [Agent Dock Integration](#6-agent-dock-integration)
7. [Dynamic Island Integration](#7-dynamic-island-integration)
8. [Voice Modes — User Journeys](#8-voice-modes--user-journeys)
9. [Backend Services & Desktop Integrations](#9-backend-services--desktop-integrations)
10. [Privacy Model](#10-privacy-model)
11. [Cross-Platform Strategy](#11-cross-platform-strategy)
12. [Risks & Edge Cases](#12-risks--edge-cases)
13. [Phased Implementation Roadmap](#13-phased-implementation-roadmap)

---

## 1. Design Philosophy

### Core Principles

**Calmness first.** Voice should feel like a natural extension of Bento, not an interruption. No flashing indicators, no aggressive animations, no competing windows. The UI communicates through subtle ambient cues — a gentle pulse, a quiet timer, a soft glow.

**One pipeline, many modes.** Every voice capability (dictation, notes, meetings, agent conversation) reuses the same recording, transcription, and processing pipeline. Zero duplicate logic.

**The Dock is the workspace.** The Agent Dock becomes the primary voice interface. It expands when voice is active, collapses when finished. No floating recording windows — ever.

**The Island is the indicator.** The Dynamic Island communicates state at a glance — recording, listening, processing, done. Never an editor, never a control panel.

**Enhance, don't replace.** Voice integrates into Bento's existing workflows. It doesn't create new ones. Users can still type, click, and navigate exactly as before.

### What We Learned from Each Reference

| Project | Key Insight | Bento Adaptation |
|---------|-------------|-----------------|
| **June** | RecorderBar + GlobalRecorderPill: recording lives in a compact bar, not a modal | Dock expands inline; Island shows status pill |
| **June** | Waveform visualization via rAF + CSS variables — performant, minimal | Borrow same technique for live audio feedback |
| **June** | DictationHistoryView with search, grouping, per-mode settings | Apply to voice notes + meeting history |
| **Minutes** | "Chat with audio" — meetings become searchable memory | Store transcripts + summaries in Bento notes engine; enable semantic search |
| **Minutes** | Structured meeting output: transcript → summary → decisions → action items | Auto-create tasks and decisions from meetings |
| **OpenWhispr** | Privacy-first, local Whisper via BYOK, global hotkeys | Use existing moonshine (local Whisper) + allow cloud provider fallback |
| **OpenWhispr** | Auto-paste dictation at cursor, global hotkey | Global push-to-talk hotkey, auto-insert into focused text field |

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Svelte)                        │
│                                                                 │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────┐ │
│  │ VoiceEngine  │  │  Agent Dock  │  │    Dynamic Island       │ │
│  │  Store       │◄─┤  (expanded   │  │  (compact status)       │ │
│  │  (state)     │──►│   workspace)│  │  - recording timer      │ │
│  │              │   │             │  │  - state indicator      │ │
│  │  - mode      │   │ - waveform  │  │  - pulsing dot          │ │
│  │  - status    │   │ - controls  │  │  - live preview text    │ │
│  │  - audioLevel│   │ - transcript│  │                         │ │
│  │  - transcript│   │ - quick acts│  └─────────────────────────┘ │
│  │  - session   │   └──────────────┘                             │
│  └──────┬──────┘                                                  │
│         │ IPC (invoke + events)                                   │
├─────────┼───────────────────────────────────────────────────────┤
│         │              RUST BACKEND (Tauri)                      │
│  ┌──────▼──────────────────────────────────────────────────────┐ │
│  │                   VoiceEngine (Rust)                         │ │
│  │                                                              │ │
│  │  ┌────────────┐  ┌───────────┐  ┌─────────────────────────┐ │ │
│  │  │ Recording   │  │ Playback  │  │   Processing Router     │ │ │
│  │  │  (cpal)     │  │  (rodio)  │  │                         │ │ │
│  │  │             │  │           │  │  ┌───────────────────┐  │ │ │
│  │  │ - capture   │  │ - play    │  │  │ DictationHandler  │  │ │ │
│  │  │ - pause/    │  │ - pause   │  │  └───────────────────┘  │ │ │
│  │  │   resume    │  │ - resume  │  │  ┌───────────────────┐  │ │ │
│  │  │ - cancel    │  │ - stop    │  │  │ VoiceNoteHandler  │  │ │ │
│  │  │ - VAD       │  │           │  │  └───────────────────┘  │ │ │
│  │  │ - levels    │  │           │  │  ┌───────────────────┐  │ │ │
│  │  └─────┬───────┘  └───────────┘  │  │ MeetingHandler    │  │ │ │
│  │        │                         │  └───────────────────┘  │ │ │
│  │        │                         │  ┌───────────────────┐  │ │ │
│  │        │                         │  │ AgentVoiceHandler │  │ │ │
│  │        │                         │  └───────────────────┘  │ │ │
│  │        ▼                         └──────────┬──────────────┘ │ │
│  │  ┌──────────────┐                            │               │ │
│  │  │  Moonshine    │◄── audio buffer ──────────┘               │ │
│  │  │  (local       │                                           │ │
│  │  │   Whisper)    │── transcript ──► Intent Classifier        │ │
│  │  └──────────────┘                                           │ │
│  │                                                              │ │
│  │  ┌──────────────────────────────────────────────────────────┐│ │
│  │  │             SQLite (recording_metadata + transcripts)    ││ │
│  │  └──────────────────────────────────────────────────────────┘│ │
│  └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Recording backend | **Rust (cpal)** — already exists in `audio/mod.rs` | Cross-platform, low-latency, no browser API limitations |
| Transcription | **Moonshine (local Whisper)** — already exists | Privacy-first, no cloud dependency, works offline |
| Real-time STT | **Web Speech API** (browser) for dictation mode; **Moonshine** for post-hoc transcription | Web Speech gives streaming interim results; Moonshine gives higher accuracy for long recordings |
| Voice Activity Detection | **Rust VAD** (separate module) using Silero-VAD or simple energy-based | Needed for meeting mode to split speakers/turns |
| State | **Svelte $state store** (`voice-engine.store.svelte.ts`) — reactive, no extra libs | Matches existing island.store pattern |
| IPC | **Tauri invoke + events** — already established pattern | Frontend calls Rust via invoke; Rust emits events for streaming |
| Audio format | **WAV 16-bit mono 16kHz** — matches Whisper requirements | Already used by existing recording engine |
| Processing | **Background thread** — non-blocking | Audio capture, transcription, and AI processing run on separate threads |

---

## 3. Audio Processing Pipeline

### Pipeline Flow (Unified)

```
Microphone
    │
    ▼
┌────────────────┐
│  Audio Capture  │  cpal stream → 16-bit PCM buffer
│  (cpal)         │  Ring buffer (last 30s kept for pre-roll)
└───────┬────────┘
        │
        ▼
┌────────────────┐
│  VAD (optional) │  Silero-VAD or energy-based
│  Voice Activity │  Detects speech segments, silence, turns
│  Detection      │  Produces segments list
└───────┬────────┘
        │ audio buffer
        ▼
┌────────────────────┐
│  Downmix + Resample │  16-bit PCM → mono f32 → 16kHz
│  (already exists)   │  Used by Moonshine
└───────┬────────────┘
        │
        ▼
┌────────────────────┐
│  Transcription      │  Moonshine (local Whisper)
│  (Moonshine)        │  Or cloud provider fallback
│                     │  Returns text with timestamps
└───────┬────────────┘
        │
        ▼
┌────────────────────┐
│  Intent Classifier  │  Classifies input as:
│                     │  - dictation → insert at cursor
│  (Rust or AI-based) │  - voice_note → save + title
│                     │  - meeting → transcribe + summarize
│                     │  - agent → route to AI agent
└───────┬────────────┘
        │
        ▼
┌────────────────────┐
│  Mode Handler       │  Routes to correct processing
│  (via Processing    │  path based on intent
│   Router)           │
└────────────────────┘
```

### Real-time vs Post-hoc

| Aspect | Real-time (Web Speech) | Post-hoc (Moonshine) |
|--------|----------------------|---------------------|
| Latency | ~200ms (streaming) | ~1-5s (after stop) |
| Accuracy | Moderate | High |
| Privacy | Browser-processed | Fully local |
| Use case | Dictation, agent chat | Voice notes, meetings |
| Interim results | Yes (word-by-word) | No |

**Strategy:** Use **Web Speech API** for streaming dictation and agent conversation (needs immediacy). Use **Moonshine** for voice notes and meetings (needs accuracy). The system auto-selects based on mode, but users can override in settings.

### Waveform Data

Audio levels (RMS) are computed every 50ms in the capture thread and emitted as Tauri events to the frontend:

```
Event: "voice:audio-level"
Payload: { level: 0.0–1.0, rms: 0.0–1.0, peak: 0.0–1.0 }
```

The frontend renders these using a rAF loop updating CSS `--level` variables on bar elements (same technique as June's Waveform component).

---

## 4. State Management

### VoiceEngine Store (`voice-engine.store.svelte.ts`)

```typescript
type VoiceMode = "idle" | "dictation" | "voice_note" | "meeting" | "agent_conversation";

type VoiceStatus = 
  | "inactive"
  | "initializing"
  | "listening"      // mic open, capturing
  | "recording"      // actively recording (notes/meetings)
  | "paused"         // recording paused
  | "processing"     // transcribing / classifying
  | "summarizing"    // AI generating summary
  | "completed"      // done, showing result
  | "error";

interface VoiceSession {
  id: string;
  mode: VoiceMode;
  status: VoiceStatus;
  startTime: number;       // epoch ms
  elapsedMs: number;        // updated every 200ms
  audioLevel: number;       // 0.0–1.0 for waveform
  interimText: string;      // streaming transcript
  finalText: string;        // completed transcript
  recordingId: string | null; // references Rust recording session
  filePath: string | null;
  summary: string | null;   // for meetings / notes
  actions: ActionItem[];    // extracted action items
  error: string | null;
}

// The store singleton
class VoiceEngineStore {
  mode = $state<VoiceMode>("idle");
  status = $state<VoiceStatus>("inactive");
  session = $state<VoiceSession | null>(null);
  
  // Derived
  isActive = $derived(this.status !== "inactive");
  isRecording = $derived(this.status === "recording" || this.status === "listening");
  elapsedFormatted = $derived(formatClock(this.session?.elapsedMs ?? 0));

  // Methods
  start(mode: VoiceMode): Promise<void>;
  stop(): Promise<VoiceResult>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  cancel(): Promise<void>;
  setAudioLevel(level: number): void;
  updateInterimText(text: string): void;
}
```

### State Transitions

```
idle ──start(dictation)──► listening ──stop──► processing ──► completed ──► idle
idle ──start(voice_note)──► recording ──stop──► processing ──► summarizing ──► completed ──► idle
idle ──start(meeting)──► recording ──stop──► processing ──► summarizing ──► completed ──► idle
idle ──start(agent)──► listening ──stop──► processing ──► (stream AI) ──► completed ──► idle
                          │
                          ├── pause ──► paused ──resume──► recording
                          │
                          └── cancel ──► idle
```

### Events Emitted by Rust Backend

| Event | Payload | When |
|-------|---------|------|
| `voice:session-started` | `{ sessionId, mode }` | Recording begins |
| `voice:audio-level` | `{ level, rms, peak }` | Every 50ms during capture |
| `voice:interim-transcript` | `{ text, isFinal }` | Web Speech interim results |
| `voice:transcript-complete` | `{ text, duration }` | Transcription finished |
| `voice:summary-complete` | `{ summary, actions }` | AI summary generated |
| `voice:session-completed` | `{ sessionId, result }` | Full session done |
| `voice:error` | `{ code, message }` | Any error |
| `voice:sleep-detected` | `{ driftMs }` | Machine slept mid-recording |

---

## 5. Voice Engine Store (Implementation Plan)

New file: `src/lib/stores/voice-engine.store.svelte.ts`

```typescript
// Proposed structure — mirrors island.store.svelte.ts pattern

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export type VoiceMode = "idle" | "dictation" | "voice_note" | "meeting" | "agent_conversation";
export type VoiceStatus = "inactive" | "initializing" | "listening" | "recording" | "paused" | "processing" | "summarizing" | "completed" | "error";

export interface VoiceSession {
  id: string;
  mode: VoiceMode;
  status: VoiceStatus;
  startTime: number;
  elapsedMs: number;
  audioLevel: number;
  interimText: string;
  finalText: string;
  recordingId: string | null;
  filePath: string | null;
  summary: string | null;
  actions: { text: string; done: boolean }[];
  error: string | null;
}

class VoiceEngineStore {
  mode = $state<VoiceMode>("idle");
  status = $state<VoiceStatus>("inactive");
  session = $state<VoiceSession | null>(null);
  
  isActive = $derived(this.status !== "inactive");
  isRecording = $derived(this.status === "recording" || this.status === "listening");
  
  // ... methods, event listeners, derived state
}

export const voiceEngine = new VoiceEngineStore();
```

**Event listeners registered in store constructor:**
- `voice:audio-level` → update `session.audioLevel`
- `voice:interim-transcript` → update `session.interimText`
- `voice:transcript-complete` → set `session.finalText`, move to processing
- `voice:summary-complete` → set `session.summary`, `session.actions`
- `voice:error` → set `session.error`, move to error status
- `voice:sleep-detected` → surface warning in UI

**Key design choice:** The Store is the single source of truth. Both Agent Dock and Dynamic Island read from it reactively. No direct IPC calls from UI components — only through the store.

---

## 6. Agent Dock Integration

### Current State

The Agent Dock (AgentDock.svelte) already has:
- Voice button with Web Speech API toggle
- `listening` mode with transcript display
- Chat messages + streaming AI responses
- Expand/collapse animation

### Required Changes

**No structural changes** — the Dock already has the right bones. Voice integration is additive:

```
┌─────────────────────────────────────────────┐
│  Dock Bar (always visible)                    │
│  ┌──────┐  ┌──────────────────┐  ┌────────┐ │
│  │Avatar│  │ Status: Listening │  │ 🎤 ⬜ │ │
│  └──────┘  └──────────────────┘  └────────┘ │
├─────────────────────────────────────────────┤
│  Waveform Visualization (when recording)      │
│  ▄▄▄▄▃▃▃▂▂▂▂▃▃▄▄▄▄▃▃▂▂▁▂▃▃▄▄               │
├─────────────────────────────────────────────┤
│  Live Transcript (interim)                    │
│  "The quarterly review shows we need to..."   │
├─────────────────────────────────────────────┤
│  Recording Timer                     2:34    │
│                                              │
│  [Pause]  [Resume]  [Done]  [Cancel]         │
├─────────────────────────────────────────────┤
│  Chat Messages (if agent mode)               │
│  ┌──────────────────────┐  ┌──────────────┐ │
│  │ User: "...question"  │  │ AI: "answer"  │ │
│  └──────────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────┘
```

### Voice Controls (within Dock)

| Control | Action | Behavior |
|---------|--------|----------|
| 🎤 Mic button | Tap to record / Hold for push-to-talk | Starts Web Speech for dictation/agent; starts Rust recording for notes/meetings |
| ⏸ Pause | Pause recording | Pauses cpal stream, shows paused state in Island |
| ▶ Resume | Resume recording | Resumes cpal stream |
| ⏹ Done | Finish + process | Stops capture, triggers transcription → classification → mode handler |
| ✕ Cancel | Discard recording | Stops capture, deletes temp file, resets state |

### Auto-detection Logic

When voice input completes, the system classifies intent (in Rust or via a lightweight AI call):

```rust
enum VoiceIntent {
    Dictation,        // Short, natural text → insert at cursor
    VoiceNote,        // Medium-length, narrative → save as note
    Meeting,          // Long, multi-speaker → transcribe + summarize + extract actions
    AgentQuery,       // Question/instruction → route to AI agent
}
```

Heuristic (fast, no AI call needed):
- **< 30s duration + no pause > 3s** → Dictation
- **30s–3min + single speaker** → Voice Note
- **> 3min OR detected multiple turns** → Meeting
- **Ends with "?" or starts with "hey Bento"/"ask Bento"** → Agent Query

The user can override this classification via buttons in the Dock's result view.

### Dock Mode Transitions (Updated)

| Event | Current Mode | New Mode | Effect |
|-------|-------------|----------|--------|
| Tap mic | idle | listening | Web Speech starts, Dock expands slightly |
| Hold mic (PTT) | idle | listening | Records while held, releases on release |
| Release PTT | listening | processing | Transcribe + classify + route |
| Tap mic (notes) | idle | recording | Rust capture starts, Dock expands fully |
| Agent responds | working | idle | Stream AI response, then reset |

---

## 7. Dynamic Island Integration

### Current State

The Island (Island.svelte) already supports:
- Compact mode with activeModule display
- Recording timer with pulsing red dot
- Expand/collapse animations
- `activityType: "recording"` for live status

### Required Changes

The Island becomes the **ambient voice status indicator**. It never becomes a full editor or control panel.

#### Compact State — Voice Variants

```
┌──────────────────────────────┐
│  🎤  Voice     ·  Listening   │  (listening state)
└──────────────────────────────┘

┌──────────────────────────────┐
│  🎤  Voice     ·  2:34 ●     │  (recording state with timer)
└──────────────────────────────┘

┌──────────────────────────────┐
│  ⏳  Voice     ·  Processing  │  (transcribing/summarizing)
└──────────────────────────────┘

┌──────────────────────────────┐
│  ✓  Voice     ·  Done        │  (completed — brief, auto-dismiss)
└──────────────────────────────┘
```

#### Island Voice Module Activation

When voice is active, the Island shows a virtual `voice` module:

```typescript
// In VoiceEngineStore.start():
islandStore.activateModule({
  id: "voice",
  label: "Voice",
  icon: "mic",        // from island-icons.ts
  status: "Listening",
  activityType: "recording",  // shows timer + pulsing dot
});
```

When voice completes:

```typescript
islandStore.activateModule({
  id: "voice",
  label: "Voice",
  icon: "check",
  status: "Done",
  activityType: "active",  // brief checkmark, then auto-collapse to default
});
```

After 3 seconds in "Done" state, the Island reverts to its default compact dot.

### What the Island Does NOT Do

- ❌ Show full transcript
- ❌ Provide playback controls
- ❌ Serve as a text editor
- ❌ Show AI response content
- ❌ Display waveform

All of these belong in the Agent Dock (expanded workspace).

---

## 8. Voice Modes — User Journeys

### 8.1 Dictation Mode

**Trigger:** Tap mic in any text field → system auto-classifies as dictation

```
User taps mic in Notes text field
    │
    ▼
Dock expands: shows waveform + live transcription
Island shows: 🎤 Voice · Listening
    │
    ▼
User speaks naturally for ~15 seconds
System streams interim text via Web Speech API
    │
    ▼
User taps Done (or pauses for 5+ seconds)
    │
    ▼
System processes:
  1. Transcribe final (Moonshine for accuracy)
  2. Classify as dictation
  3. Insert polished text at cursor position
    │
    ▼
Dock collapses back to idle
Island shows: ✓ Voice · Done (for 3s, then reverts)
    │
    ▼
Result: Clean text in the original text field
```

**Key details:**
- Punctuation is inferred from prosody (Web Speech does this naturally)
- The transcribed text appears inline, not in a separate window
- User can edit the result normally — it's just text in their field

### 8.2 Voice Note Mode

**Trigger:** Tap "Voice Note" button in Dock or long-press mic → auto-classified as note

```
User taps "Voice Note" in Dock
    │
    ▼
Dock expands fully: shows waveform, timer, controls
Island shows: 🎤 Voice · 0:00 ● (recording timer starts)
    │
    ▼
User records for 2 minutes about an idea
    │
    ▼
User taps Done
    │
    ▼
System processes:
  1. Transcribe full audio (Moonshine)
  2. AI generates title from content
  3. Save as note in Notes engine
  4. Optionally generate summary
    │
    ▼
Dock shows result preview:
  ┌─────────────────────────────────────┐
  │  📝 "My Product Idea"              │
  │  ────────────────────────────────  │
  │  The core concept is a platform... │
  │                                    │
  │  [Open Note]  [Share]  [Discard]   │
  └─────────────────────────────────────┘
    │
    ▼
User taps "Open Note" → navigates to the note
Island reverts to default
```

### 8.3 Meeting Mode

**Trigger:** Explicit "Meeting" button in Dock or auto-detected from duration/speaker turns

```
User taps "Meeting" in Dock
    │
    ▼
Dock shows: waveform, timer, controls
Island shows: 🎤 Meeting · 0:00 ●
    │
    ▼
User records a 15-minute meeting
System detects speaker turns via VAD
    │
    ▼
User taps Done
    │
    ▼
System processes:
  1. Transcribe full audio (Moonshine)
  2. AI generates:
     - Summary (2-3 paragraphs)
     - Key decisions (bulleted)
     - Action items (with assignees)
     - Follow-ups
  3. Save meeting record in SQLite
  4. Create tasks for action items
  5. Link to calendar entry if available
    │
    ▼
Dock shows structured result:
  ┌─────────────────────────────────────┐
  │  📋 "Sprint Planning — July 5"     │
  │  ────────────────────────────────  │
  │  Summary: ...                      │
  │  Decisions: • ...  • ...           │
  │  Actions:   ☐ ...  ☐ ...           │
  │                                    │
  │  [Open Full]  [Copy]  [Discard]    │
  └─────────────────────────────────────┘
    │
    ▼
User can "Chat with this meeting" later via the Notes engine
(searchable in semantic search — Minutes-inspired)
```

### 8.4 Agent Conversation Mode

**Trigger:** Tap mic in Agent Dock → system classifies as agent query

```
User taps mic in Agent Dock
    │
    ▼
Dock shows listening state
Island shows: 🎤 Agent · Listening
    │
    ▼
User speaks: "What tasks are overdue today?"
    │
    ▼
System processes:
  1. Transcribe (Web Speech for speed)
  2. Classify as agent query
  3. Route to AI agent with transcribed text
  4. Stream response back through Dock
    │
    ▼
Dock shows AI response (as streaming markdown)
Island shows: 🤖 Agent · Working
    │
    ▼
User can follow up by voice or text (conversation continues)
When done, user taps outside Dock or says "thanks, that's all"
    │
    ▼
Dock collapses, conversation history preserved
```

**Continuous conversation:** Unlike dictation mode which auto-closes, agent conversation mode stays open. The user can speak multiple turns. Each turn is transcribed and sent to the AI. The conversation history persists in the Dock's chat messages.

---

## 9. Backend Services & Desktop Integrations

### Rust Backend (New Modules)

| Module | File | Responsibility |
|--------|------|---------------|
| `audio::vad` | `src-tauri/src/audio/vad.rs` | Voice Activity Detection (Silero-VAD or energy-based) |
| `audio::classifier` | `src-tauri/src/audio/classifier.rs` | Intent classification (heuristic + optional ML) |
| `audio::turns` | `src-tauri/src/audio/turns.rs` | Speaker turn detection for meetings |
| `commands::voice` | `src-tauri/src/commands/voice.rs` | Tauri commands for voice operations |
| `commands::transcription` | `src-tauri/src/commands/transcription.rs` | Tauri commands for transcription + AI processing |

### New Tauri Commands

```rust
// Voice session management
#[tauri::command] async fn voice_start(mode: String) -> Result<VoiceSession, String>;
#[tauri::command] async fn voice_stop() -> Result<VoiceResult, String>;
#[tauri::command] async fn voice_pause() -> Result<(), String>;
#[tauri::command] async fn voice_resume() -> Result<(), String>;
#[tauri::command] async fn voice_cancel() -> Result<(), String>;

// Classification + processing
#[tauri::command] async fn classify_audio(audio_path: String) -> Result<VoiceIntent, String>;
#[tauri::command] async fn process_voice_note(audio_path: String) -> Result<NoteResult, String>;
#[tauri::command] async fn process_meeting(audio_path: String) -> Result<MeetingResult, String>;

// Settings
#[tauri::command] async fn get_voice_settings() -> Result<VoiceSettings, String>;
#[tauri::command] async fn save_voice_settings(settings: VoiceSettings) -> Result<(), String>;
```

### Desktop Integrations

| Integration | Purpose | Implementation |
|-------------|---------|---------------|
| **Global hotkey** | Push-to-talk from anywhere | Tauri global shortcut plugin (`Ctrl+Shift+M` or user-configurable) |
| **System audio capture** | Meeting mode (capture computer audio) | Platform-specific: `system_macos.rs` (already in June), `windows::wasapi`, `linux::pipewire` |
| **Auto-paste** | Dictation mode | Tauri clipboard + keyboard simulation (or platform-specific paste) |
| **Menu bar icon** | Quick status indicator | Already partially exists in tray.ts |
| **Calendar integration** | Meeting detection | Check calendar events for scheduled meetings; prompt to record |

### Processing Pipeline (AI Flow)

For voice notes and meetings, after transcription:

```
Transcript text
    │
    ▼
┌──────────────────────┐
│  AI Processing        │  Uses existing Bento AI infrastructure
│  (via Bento Agent)     │  (streamAiResponse / invoke("stream_ai_response"))
│                       │
│  For voice notes:     │
│  - "Generate a title" │
│  - "Summarize this"   │
│                       │
│  For meetings:        │
│  - "Extract decisions"│
│  - "List action items"│
│  - "Create follow-ups"│
└──────────────────────┘
    │
    ▼
┌──────────────────────┐
│  Apply to Bento       │
│  - Save as note       │
│  - Create tasks       │
│  - Link to calendar   │
│  - Index for search   │
└──────────────────────┘
```

**Key insight:** Reuse Bento's existing AI streaming pipeline (`streamAiResponse`). The voice engine just provides the transcript as input to the same AI that powers the Agent. No new AI infrastructure needed.

---

## 10. Privacy Model

### Local-First Approach

| Data | Storage | Processing | Default |
|------|---------|------------|---------|
| Raw audio | Local filesystem (recordings/) | Local (Moonshine) | **Never leaves device** |
| Transcripts | Local SQLite | Local or cloud | Local by default |
| AI summaries | Local SQLite | Bento AI (configurable) | Uses configured provider |
| Audio levels | In-memory only | N/A | Ephemeral |

### User Controls

- **Settings panel** under Voice section:
  - Transcription provider: Local (Moonshine) / Cloud (user's AI provider)
  - Audio retention: Keep / Delete after transcription / Ask each time
  - Raw audio access: View / Delete individual recordings
  - Processing location: Local only / Use cloud AI
  - Push-to-talk keybinding

### Data Flow Diagram

```
User speaks → Mic → Rust capture → WAV file (local)
                                    │
                              ┌─────▼─────┐
                              │  Local?    │
                              └──┬────┬───┘
                            Yes │    │ No
                                ▼    ▼
                        ┌─────────┐  ┌──────────┐
                        │Moonshine│  │ Cloud API │
                        │(local)  │  │ (BYOK)    │
                        └────┬────┘  └────┬─────┘
                             │            │
                             ▼            ▼
                        ┌─────────────────────┐
                        │   SQLite (local)     │
                        │   recordings_meta    │
                        │   transcripts        │
                        │   summaries          │
                        └─────────────────────┘
                                    │
                         (optional) │
                                    ▼
                          ┌─────────────────┐
                          │ Delete raw audio │
                          │ Keep transcript  │
                          └─────────────────┘
```

---

## 11. Cross-Platform Strategy

### Platform-Specific Implementation

| Feature | Windows | macOS | Linux |
|---------|---------|-------|-------|
| **Mic capture** | cpal (works) | cpal (works) | cpal (works) |
| **System audio** | WASAPI loopback | CoreAudio aggregate | PipeWire loopback |
| **VAD** | Silero-VAD (ONNX) | Silero-VAD (ONNX) | Silero-VAD (ONNX) |
| **Transcription** | Moonshine (same) | Moonshine (same) | Moonshine (same) |
| **Global hotkey** | `tauri-plugin-global-shortcut` | `tauri-plugin-global-shortcut` | `tauri-plugin-global-shortcut` |
| **Auto-paste** | `tauri-plugin-clipboard` + `SendInput` | `tauri-plugin-clipboard` + CGEvent | `tauri-plugin-clipboard` + `xdotool` |
| **Menu bar** | System tray | Menu bar app | System tray (libappindicator) |

### Behavior Guarantees

All platforms provide identical user experience:
- Same hotkey to toggle recording
- Same Dock + Island layout
- Same transcription quality (Moonshine is cross-platform)
- Same privacy defaults
- Same AI processing pipeline

---

## 12. Risks & Edge Cases

### Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Web Speech API not available** | Low (Chrome-based Tauri) | High | Fall back to Moonshine-only; show voice unavailable gracefully |
| **Microphone permission denied** | Medium | Medium | Clear permission prompt; show settings link; degrade gracefully |
| **Long recording memory pressure** | Low (large files) | Medium | Stream to disk; warn at 30min; auto-split at 1hr |
| **Sleep during recording** | Medium | High | Already handled (sleep detection exists); warn user on resume |
| **Ambient noise / poor accuracy** | Medium | Medium | Show confidence score; offer re-record; allow manual editing |
| **Multi-speaker confusion** | High (meetings) | Medium | Use VAD for turn detection; label as Speaker A/B/C by default |
| **Accidental recording** | Medium | Medium | Require explicit start; show prominent indicator; easy cancel |
| **AI processing cost** | Low (if using local) | Low | Default to local; cloud is opt-in with provider's own cost |
| **Audio file cleanup** | Medium | Low | Auto-delete raw audio after configurable retention period |
| **Platform-specific audio routing** | Medium (system audio) | Medium | Implement per platform; fall back to mic-only with clear label |

### Edge Case Handling

| Edge Case | Behavior |
|-----------|----------|
| User starts recording, then types in Dock | Voice takes priority; typing disabled during recording (clear hint shown) |
| User clicks outside Dock during recording | Dock stays expanded but dim; Island shows active recording — click Island to return |
| Recording longer than 1 hour | Auto-split into 1hr segments; warn user at 45min |
| Microphone disconnected mid-recording | Detect via cpal error; pause recording; show "Mic disconnected — reconnect or cancel" |
| Multiple voice sessions | Only one active session; start new = offer to save or discard current |
| Transcription fails | Return partial transcript if available; show error with retry |
| AI summary fails | Return raw transcript instead; show "Summary unavailable" gracefully |
| Application quit during recording | Prompt "Recording in progress — save or discard?" before allowing quit |

---

## 13. Phased Implementation Roadmap

### Phase 1 — Foundation (Week 1-2)

**Goal:** Single voice input → transcription → route to Agent (most impactful starting point)

| Task | Files | Dependencies |
|------|-------|-------------|
| Create `voice-engine.store.svelte.ts` | `src/lib/stores/` | None |
| Add `VoiceMode`, `VoiceStatus`, `VoiceSession` types | Store file | None |
| Register Tauri event listeners for audio events | Store file | Rust events |
| Create `commands::voice` Rust module with basic start/stop/cancel | `src-tauri/src/commands/voice.rs` | Existing audio engine |
| Wire Dock voice button to new store (instead of direct Web Speech) | `AgentDock.svelte` | Store |
| Add interim transcript display from store | `AgentDock.svelte` | Store |
| Add waveform visualization to Dock | `AgentDock.svelte` | Audio level events |

**Deliverable:** User can tap mic, speak, see live transcript + waveform, stop, and see result in Dock.

### Phase 2 — Dictation + Voice Notes (Week 3-4)

**Goal:** Transcribed text lands in text fields; notes are created from voice

| Task | Files | Dependencies |
|------|-------|-------------|
| Implement intent classifier (heuristic) | `src-tauri/src/audio/classifier.rs` | Phase 1 |
| Implement dictation mode: auto-paste at cursor | `src-tauri/src/commands/transcription.rs` | Classifier |
| Implement voice note mode: save as note + AI title | `commands/voice.rs` + store | Notes engine, AI pipeline |
| Add "Done" result view in Dock with actions | `AgentDock.svelte` | Phase 1 |
| Add voice settings panel | Settings component | Settings store |

**Deliverable:** Voice dictation inserts text into any field. Voice notes create searchable notes with AI titles.

### Phase 3 — Meetings (Week 5-6)

**Goal:** Full meeting recording → transcription → summary → task creation

| Task | Files | Dependencies |
|------|-------|-------------|
| Add VAD module (Silero-VAD or simple energy) | `src-tauri/src/audio/vad.rs` | Phase 1 |
| Implement turn detection for multi-speaker | `src-tauri/src/audio/turns.rs` | VAD |
| Implement meeting processing: summary + decisions + actions | `commands/voice.rs` + AI pipeline | Phase 2 |
| Add system audio capture (platform-specific) | `audio/system_macos.rs`, `windows.rs`, `linux.rs` | Phase 1 |
| Integrate with task creation | `commands/tasks.rs` | Phase 2 |
| Add meeting result view in Dock | `AgentDock.svelte` | Phase 2 |

**Deliverable:** Meetings produce structured output with transcripts, summaries, decisions, and auto-created tasks.

### Phase 4 — Agent Conversation (Week 7-8)

**Goal:** Continuous spoken conversation with Bento AI via Dock

| Task | Files | Dependencies |
|------|-------|-------------|
| Support continuous conversation flow in store | `voice-engine.store.svelte.ts` | Phase 2 |
| Route agent-classified voice to existing AI stream | `AgentDock.svelte` | Phase 2, existing streamAiResponse |
| Add "conversation mode" visual state in Dock | `AgentDock.svelte` | Phase 1 |
| Support voice follow-ups in existing conversation | `AgentDock.svelte` | Phase 2 |
| Add push-to-talk global hotkey | `src-tauri/src/` | Tauri plugin |

**Deliverable:** User can hold a natural spoken conversation with Bento's AI, seeing responses stream in the Dock.

### Phase 5 — Polish + Island Integration (Week 9-10)

**Goal:** Voice feels like a first-class part of Bento

| Task | Files | Dependencies |
|------|-------|-------------|
| Finalize Island voice state integration | `Island.svelte`, `IslandLayout.svelte` | Phase 1-4 |
| Add "Done" auto-dismiss animation in Island | `Island.svelte` | Phase 1 |
| Add voice section to settings (provider, hotkey, retention) | Settings components | Phase 2 |
| Implement audio retention / cleanup policies | `audio/mod.rs` | Phase 1 |
| Add meeting history view (searchable, Minutes-inspired) | Meeting UI component | Phase 3 |
| Cross-platform testing + edge case hardening | All | Phase 1-4 |
| Performance profiling + optimization | All | Phase 1-4 |

**Deliverable:** Voice is fully integrated. All four modes work. Island shows ambient state. Settings are configurable. Edge cases are handled.

---

## Appendix A: File Manifest

### New Files to Create

```
src/lib/stores/
  voice-engine.store.svelte.ts       # Voice state management

src-tauri/src/
  audio/
    vad.rs                           # Voice Activity Detection
    classifier.rs                    # Intent classification
    turns.rs                         # Speaker turn detection
  commands/
    voice.rs                         # Voice Tauri commands
    transcription.rs                 # Transcription + AI processing

src/lib/components/voice/
  (all UI lives in existing Agent Dock / Island — no new top-level components)
```

### Files to Modify

```
src/lib/components/agent/AgentDock.svelte     # Add waveform, voice controls, result views
src/lib/components/island/Island.svelte        # Add voice states to activeModule
src/lib/stores/island.store.svelte.ts          # No changes needed (already supports activityType)
src-tauri/src/audio/mod.rs                     # Add VAD, classifier, turns sub-modules
src-tauri/src/commands/mod.rs                  # Register voice + transcription commands
src-tauri/src/lib.rs                           # Register new modules
src-tauri/src/main.rs                          # Register new commands
src/lib/desktop/settings.ts                    # Add voice settings schema
```

### No New Files Needed

- ❌ `VoiceInput.svelte` — voice lives in Agent Dock
- ❌ `VoiceController.ts` — state managed by store
- ❌ `AudioManager.ts` — Rust already handles capture
- ❌ `SpeechRecognitionService.ts` — Web Speech API is used directly
- ❌ Separate floating window — explicitly prohibited by design

---

## Appendix B: Key Design Decisions Summary

| Decision | Choice | Alternative Considered | Why |
|----------|--------|----------------------|-----|
| Where voice UI lives | Agent Dock | Separate voice window | No competing windows; reuse existing workspace |
| Recording engine | Rust (cpal) — existing | Web API (MediaRecorder) | Cross-platform, lower latency, already built |
| Real-time STT | Web Speech API | Cloud streaming API | Works offline, no cost, good enough for short input |
| Post-hoc STT | Moonshine (local Whisper) | Cloud transcription | Privacy-first, already integrated |
| Waveform rendering | rAF + CSS variables (like June) | Canvas/SVG | Better performance, simpler code |
| State management | Svelte $state store | Zustand, Pinia | Matches existing pattern, no new dependency |
| Intent classification | Heuristic first, AI optional | AI-only | Low latency, works offline, no cost |
| Meeting memory | Bento Notes engine (semantic search) | Separate meeting store | Reuse existing search, no new storage |
| AI summarization | Bento's existing AI pipeline | Separate model | No new infrastructure, consistent quality |
| Push-to-talk | Tauri global shortcut | OS-level hook | Cross-platform plugin, already available |
