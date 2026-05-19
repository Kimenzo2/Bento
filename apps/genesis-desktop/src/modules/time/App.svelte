<script lang="ts">
  import { Play, Square, Tag, Plus, MoreHorizontal, Clock, Calendar, BarChart2 } from 'lucide-svelte';

  export let moduleId: string;
  export let settings: any = {};
  void moduleId;
  void settings;

  let isTracking = false;
  let currentTask = '';
  // Big mono ticker
  let currentTimer = '00:45:12';

  // Week strip (Proportional)
  const weekDays = [
    { day: 'M', hours: 6.5, height: '65%' },
    { day: 'T', hours: 7.2, height: '72%' },
    { day: 'W', hours: 8.0, height: '80%' },
    { day: 'T', hours: 5.4, height: '54%' },
    { day: 'F', hours: 2.1, height: '21%', active: true },
    { day: 'S', hours: 0, height: '0%' },
    { day: 'S', hours: 0, height: '0%' },
  ];

  const recentEntries = [
    { id: 1, task: 'Genesis Architecture Design', project: 'Genesis Desktop', duration: '02:15:00', tag: 'bg-blue-500' },
    { id: 2, task: 'Weekly Sync', project: 'Internal', duration: '00:45:00', tag: 'bg-purple-500' },
    { id: 3, task: 'Email Processing', project: 'Admin', duration: '00:22:30', tag: 'bg-gray-500' },
  ];
</script>

<div class="time-app-container module-root">
  
  <!-- Top Action Bar -->
  <div class="time-header">
    <div class="header-left">
      <h1>Time Tracker</h1>
      <p class="subtitle">Today: 2h 15m</p>
    </div>
    <div class="header-right">
      <button class="nav-icon active"><Clock size={20} /></button>
      <button class="nav-icon"><Calendar size={20} /></button>
      <button class="nav-icon"><BarChart2 size={20} /></button>
    </div>
  </div>

  <!-- Hero Timer Section -->
  <div class="hero-timer-section">
    <div class="hero-solid-panel {isTracking ? 'is-tracking' : ''}">
      <!-- Input -->
      <div class="task-input-wrapper">
        <input 
          type="text" 
          placeholder="What are you working on?" 
          bind:value={currentTask} 
          class="huge-task-input"
        />
        <button class="tag-project-btn">
          <Tag size={16} /> Add Project
        </button>
      </div>

      <!-- Mono Counter -->
      <div class="ticker-display">
        <span class="mono-time">{currentTimer}</span>
      </div>

      <!-- Play/Stop Control -->
      <div class="timer-controls">
        <button 
          class="main-toggle-btn {isTracking ? 'btn-stop' : 'btn-start'}" 
          on:click={() => isTracking = !isTracking}
        >
          {#if isTracking}
            <Square size={28} fill="currentColor" />
          {:else}
            <Play size={28} fill="currentColor" class="ml-1" />
          {/if}
        </button>
      </div>
    </div>
  </div>

  <!-- Proportional Week Strip -->
  <div class="week-strip-section">
    <div class="section-title">
      <h2>This Week</h2>
      <span>Total: 29.2h</span>
    </div>
    <div class="week-chart">
      {#each weekDays as day}
        <div class="day-col">
          <div class="bar-container">
            <div class="bar-fill {day.active ? 'bar-today' : ''}" style="height: {day.height}"></div>
          </div>
          <span class="day-label {day.active ? 'text-white' : ''}">{day.day}</span>
        </div>
      {/each}
    </div>
  </div>

  <!-- Recent Entries -->
  <div class="recent-section">
    <div class="section-title">
      <h2>Recent Time Entries</h2>
      <button class="text-btn">View All</button>
    </div>
    
    <div class="entries-list">
      {#each recentEntries as entry}
        <div class="time-entry-card">
          <div class="entry-left">
            <div class="project-dot {entry.tag}"></div>
            <div class="entry-details">
              <h3>{entry.task}</h3>
              <p>{entry.project}</p>
            </div>
          </div>
          <div class="entry-right">
            <span class="entry-duration">{entry.duration}</span>
            <button class="entry-action"><Play size={18} /></button>
            <button class="entry-action"><MoreHorizontal size={18} /></button>
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
/* time.css - Flat UI (No shadows, no blur, no blobs, no global background) */

.time-app-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  color: var(--text-primary, #ffffff);
  font-family: inherit;
  overflow-y: auto;
  padding-bottom: 60px;
  scrollbar-width: none; 
}
.time-app-container::-webkit-scrollbar { display: none; }

.time-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 32px 32px 24px;
}

.header-left h1 {
  font-size: 28px;
  font-weight: 700;
  margin: 0;
  letter-spacing: -0.02em;
}

.header-left .subtitle {
  margin: 4px 0 0 0;
  color: #a1a1aa;
  font-size: 15px;
}

.header-right {
  display: flex;
  gap: 12px;
  background: #18181b;
  padding: 6px;
  border-radius: 100px;
  border: 1px solid #27272a;
}

.nav-icon {
  width: 40px; height: 40px;
  border-radius: 20px;
  border: none;
  background: transparent;
  color: #a1a1aa;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.nav-icon.active {
  background: #27272a;
  color: #ffffff;
}

/* Hero Section */
.hero-timer-section {
  padding: 0 32px;
  margin-bottom: 40px;
}

.hero-solid-panel {
  position: relative;
  background: #18181b;
  border-radius: 32px;
  padding: 40px;
  border: 1px solid #27272a;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  overflow: hidden;
}

.hero-solid-panel.is-tracking {
  border-color: #10b981;
}

.task-input-wrapper, .ticker-display, .timer-controls {
  position: relative;
  z-index: 10;
  width: 100%;
}

.task-input-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  margin-bottom: 32px;
}

.huge-task-input {
  background: transparent;
  border: none;
  color: #ffffff;
  font-size: 24px;
  font-weight: 500;
  text-align: center;
  width: 100%;
  outline: none;
}
.huge-task-input::placeholder {
  color: #71717a;
}

.tag-project-btn {
  background: #27272a;
  border: 1px solid #3f3f46;
  color: #e4e4e7;
  padding: 8px 16px;
  border-radius: 100px;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.ticker-display {
  margin-bottom: 40px;
}
.mono-time {
  font-family: 'Space Mono', 'SF Mono', monospace;
  font-size: 84px;
  font-weight: 700;
  letter-spacing: -0.05em;
  color: #ffffff;
  line-height: 1;
}

.timer-controls {
  display: flex;
  justify-content: center;
}

.main-toggle-btn {
  width: 80px; height: 80px;
  border-radius: 40px;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.btn-start {
  background: #3b82f6;
}
.btn-stop {
  background: #f43f5e;
}
.ml-1 { margin-left: 4px; }

/* Week Strip */
.week-strip-section {
  padding: 0 32px;
  margin-bottom: 40px;
}

.section-title {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 20px;
}
.section-title h2 {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  color: #e4e4e7;
}
.section-title span {
  font-size: 14px;
  color: #a1a1aa;
}
.text-btn {
  background: transparent;
  border: none;
  color: #3b82f6;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.week-chart {
  display: flex;
  justify-content: space-between;
  height: 120px;
  background: #18181b;
  border: 1px solid #27272a;
  border-radius: 20px;
  padding: 20px 24px;
}

.day-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  height: 100%;
}

.bar-container {
  width: 32px;
  flex-grow: 1;
  background: #27272a;
  border-radius: 16px;
  display: flex;
  align-items: flex-end;
  padding: 4px;
}

.bar-fill {
  width: 100%;
  background: #52525b;
  border-radius: 12px;
}
.bar-today {
  background: #3b82f6;
}

.day-label {
  font-size: 12px;
  font-weight: 600;
  color: #71717a;
}
.text-white { color: #ffffff; }

/* Recent Entries */
.recent-section {
  padding: 0 32px;
}

.entries-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.time-entry-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #18181b;
  border: 1px solid #27272a;
  padding: 16px 20px;
  border-radius: 16px;
}

.entry-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.project-dot {
  width: 12px; height: 12px;
  border-radius: 6px;
}
.bg-blue-500 { background: #3b82f6; }
.bg-purple-500 { background: #a855f7; }
.bg-gray-500 { background: #71717a; }

.entry-details h3 {
  margin: 0 0 4px 0;
  font-size: 15px;
  font-weight: 500;
}
.entry-details p {
  margin: 0;
  font-size: 13px;
  color: #a1a1aa;
}

.entry-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.entry-duration {
  font-family: 'Space Mono', monospace;
  font-size: 15px;
  font-weight: 600;
  color: #e4e4e7;
}

.entry-action {
  background: transparent;
  border: none;
  color: #a1a1aa;
  cursor: pointer;
  display: flex;
  align-items: center;
  padding: 4px;
}
.entry-action:hover {
  color: #ffffff;
}
</style>


