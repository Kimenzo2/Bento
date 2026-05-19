<script lang="ts">
  import { Plus, Activity, Utensils, Scale, Droplet } from "lucide-svelte";
  // State
  let name = "Emilie";
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  
  let showBottomSheet = false;

  type LogEntry = {
    id: string;
    type: "workout" | "meal" | "weight" | "water";
    title: string;
    value: string;
    time: string;
    icon: any;
  };

  let activityLog: LogEntry[] = [
    { id: "1", type: "workout", title: "Morning Run", value: "340 kcal", time: "7:00 AM", icon: Activity },
    { id: "2", type: "meal", title: "Oatmeal Bowl", value: "450 kcal", time: "8:30 AM", icon: Utensils },
    { id: "3", type: "water", title: "Glass of water", value: "0.5 L", time: "11:00 AM", icon: Droplet },
  ];

  let activeTab = "Today";
</script>

<div class="health-app-container module-root">
  <!-- Top navigation -->
  <nav class="health-nav">
    <button class:active={activeTab === 'Today'} on:click={() => activeTab = 'Today'}>Today</button>
    <button class:active={activeTab === 'Progress'} on:click={() => activeTab = 'Progress'}>Progress</button>
    <button class:active={activeTab === 'Goals'} on:click={() => activeTab = 'Goals'}>Goals</button>
  </nav>

  <!-- Only Today tab is implemented here per instructions -->
  {#if activeTab === 'Today'}
    <header class="health-header">
      <h1>Hello <span>{name}</span></h1>
      <p class="health-date">{today}</p>
    </header>

    <!-- 3 Rings: Calories, Steps, Water -->
    <div class="health-rings-container">
      <div class="health-ring-item">
        <svg viewBox="0 0 100 100" class="health-ring-svg">
          <circle class="health-ring-bg" cx="50" cy="50" r="40" />
          <circle class="health-ring-progress health-ring-green" cx="50" cy="50" r="40" stroke-dasharray="251.2" stroke-dashoffset="60" />
        </svg>
        <div class="health-ring-content">1,200</div>
        <p class="health-ring-label">Calories left</p>
      </div>

      <div class="health-ring-item">
        <svg viewBox="0 0 100 100" class="health-ring-svg">
          <circle class="health-ring-bg" cx="50" cy="50" r="40" />
          <circle class="health-ring-progress health-ring-blue" cx="50" cy="50" r="40" stroke-dasharray="251.2" stroke-dashoffset="100" />
        </svg>
        <div class="health-ring-content">4,500</div>
        <p class="health-ring-label">Steps today</p>
      </div>

      <div class="health-ring-item">
        <svg viewBox="0 0 100 100" class="health-ring-svg">
          <circle class="health-ring-bg" cx="50" cy="50" r="40" />
          <circle class="health-ring-progress health-ring-cyan" cx="50" cy="50" r="40" stroke-dasharray="251.2" stroke-dashoffset="150" />
        </svg>
        <div class="health-ring-content">1.5L</div>
        <p class="health-ring-label">Water</p>
      </div>
    </div>

    <!-- Activity Log -->
    <div class="health-log-section">
      <div class="health-log-header">
        <h2>Today's Activity</h2>
      </div>

      {#if activityLog.length > 0}
        <ul class="health-log-list">
          {#each activityLog as entry (entry.id)}
            <li class="health-log-item">
              <div class="health-log-icon health-icon-{entry.type}">
                <!-- svelte-ignore a11y-missing-attribute -->
                <svelte:component this={entry.icon} size={20} />
              </div>
              <div class="health-log-details">
                <span class="health-log-title">{entry.title}</span>
                <span class="health-log-time">{entry.time}</span>
              </div>
              <div class="health-log-value">{entry.value}</div>
            </li>
          {/each}
        </ul>
      {:else}
        <div class="health-empty-state">
          <div class="health-empty-icon">🤷</div>
          <p>Nothing logged yet today</p>
          <button class="health-start-btn" on:click={() => showBottomSheet = true}>Start Logging</button>
        </div>
      {/if}
    </div>

    <!-- Floating Action Button -->
    <button class="health-fab" on:click={() => showBottomSheet = true}>
      <Plus size={32} color="#111318" />
    </button>
  {:else}
    <div class="health-empty-state" style="margin-top: 100px;">
      <p>This tab is hidden in the home layout.</p>
    </div>
  {/if}

  <!-- Bottom Sheet for logging -->
  {#if showBottomSheet}
    <!-- svelte-ignore a11y-click-events-have-key-events - already handled by keydown -->
    <div class="health-overlay" on:click={() => showBottomSheet = false} tabindex="0" role="button" on:keydown={(e) => e.key === 'Escape' && (showBottomSheet = false)}></div>
    <div class="health-sheet">
      <div class="health-sheet-handle"></div>
      <div class="health-sheet-grid">
        <button class="health-tile">
          <div class="health-tile-icon health-icon-workout"><Activity size={28} /></div>
          <span>Log Workout</span>
        </button>
        <button class="health-tile">
          <div class="health-tile-icon health-icon-weight"><Scale size={28} /></div>
          <span>Log Weight</span>
        </button>
        <button class="health-tile">
          <div class="health-tile-icon health-icon-water"><Droplet size={28} /></div>
          <span>Log Water</span>
        </button>
        <button class="health-tile">
          <div class="health-tile-icon health-icon-meal"><Utensils size={28} /></div>
          <span>Log Meal</span>
        </button>
      </div>
    </div>
  {/if}
</div>
<style>
/* Base container - using transparent background to utilize global theme */
.health-app-container {
  height: 100%;
  padding: 32px 40px;
  position: relative;
  animation: health-fade-in 0.3s ease;
  color: var(--text-primary, #F9FAFB);
}

@keyframes health-fade-in {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Typography styles */
.health-app-container h1 {
  font-size: 32px;
  font-weight: 400;
  margin: 0 0 8px 0;
  color: var(--text-secondary, #9CA3AF);
}
.health-app-container h1 span {
  font-weight: 700;
  color: var(--text-primary, #F9FAFB);
}
.health-date {
  font-size: 15px;
  color: var(--text-secondary, #9CA3AF);
  margin: 0;
}
.health-header {
  margin-bottom: 40px;
}

/* Navigation tabs */
.health-nav {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-bottom: 32px;
}
.health-nav button {
  background: transparent;
  border: none;
  font-size: 15px;
  font-weight: 500;
  color: var(--text-secondary, #9CA3AF);
  padding: 8px 24px;
  border-radius: 99px;
  cursor: pointer;
  transition: all 0.2s ease;
}
.health-nav button:hover {
  background: var(--bg-hover, rgba(255, 255, 255, 0.05));
  color: var(--text-primary, #F9FAFB);
}
.health-nav button.active {
  background: var(--bg-active, rgba(255, 255, 255, 0.1));
  color: var(--text-primary, #F9FAFB);
}

/* Three Rings Container */
.health-rings-container {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
  margin-bottom: 40px;
}
.health-ring-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.health-ring-svg {
  width: 110px;
  height: 110px;
  transform: rotate(-90deg);
  margin-bottom: 16px;
}
.health-ring-bg {
  fill: none;
  stroke: var(--bg-elevated, rgba(255, 255, 255, 0.05));
  stroke-width: 8;
}
.health-ring-progress {
  fill: none;
  stroke-width: 8;
  stroke-linecap: round;
  transition: stroke-dashoffset 1s ease-out;
}
.health-ring-green { stroke: #22C55E; }
.health-ring-blue { stroke: #3B82F6; }
.health-ring-cyan { stroke: #06B6D4; }

.health-ring-content {
  position: absolute;
  top: 45px;
  left: 0;
  width: 100%;
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary, #F9FAFB);
}
.health-ring-label {
  font-size: 14px;
  color: var(--text-secondary, #9CA3AF);
  margin: 0;
}

/* Activity Log Section */
.health-log-section {
  padding: 0 16px;
}
.health-log-header h2 {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 20px 0;
  color: var(--text-primary, #F9FAFB);
}
.health-log-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.health-log-item {
  display: flex;
  align-items: center;
  padding: 16px;
  background: var(--bg-elevated, rgba(255, 255, 255, 0.03));
  border-radius: 16px;
}
.health-log-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 16px;
  color: white;
}
.health-icon-workout { background: rgba(34, 197, 94, 0.2); color: #22C55E; }
.health-icon-meal { background: rgba(245, 158, 11, 0.2); color: #F59E0B; }
.health-icon-weight { background: rgba(168, 85, 247, 0.2); color: #A855F7; }
.health-icon-water { background: rgba(6, 182, 212, 0.2); color: #06B6D4; }

.health-log-details {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
}
.health-log-title {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 4px;
}
.health-log-time {
  font-size: 13px;
  color: var(--text-secondary, #9CA3AF);
}
.health-log-value {
  font-size: 16px;
  font-weight: 600;
}

/* Empty State */
.health-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
  text-align: center;
}
.health-empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}
.health-empty-state p {
  color: var(--text-secondary, #9CA3AF);
  margin-bottom: 24px;
}
.health-start-btn {
  background: #C8F535;
  color: #111318;
  border: none;
  padding: 12px 24px;
  border-radius: 99px;
  font-weight: 600;
  cursor: pointer;
}

/* Floating Action Button */
.health-fab {
  position: absolute;
  bottom: 40px;
  right: 40px;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: #C8F535;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 20px rgba(200, 245, 53, 0.3);
  transition: transform 0.2s ease;
  z-index: 10;
}
.health-fab:hover {
  transform: scale(1.05);
}

/* Bottom Sheet */
.health-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 100;
  backdrop-filter: blur(4px);
  animation: health-fade-in 0.2s ease;
}
.health-sheet {
  position: fixed;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  width: calc(100% - 48px);
  max-width: 600px;
  background: var(--bg-surface, #1C2128);
  border-radius: 32px;
  padding: 24px 32px 40px;
  z-index: 101;
  box-shadow: 0 10px 40px rgba(0,0,0,0.5);
  animation: health-slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.05));
}
@keyframes health-slide-up {
  from { transform: translate(-50%, 100%); }
  to { transform: translate(-50%, 0); }
}

.health-sheet-handle {
  width: 48px;
  height: 6px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.2);
  margin: 0 auto 32px;
}
.health-sheet-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}
.health-tile {
  background: var(--bg-elevated, rgba(255, 255, 255, 0.03));
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.05));
  border-radius: 20px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}
.health-tile:hover {
  background: var(--bg-hover, rgba(255, 255, 255, 0.08));
  transform: translateY(-2px);
}
.health-tile-icon {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}
.health-tile span {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-primary, white);
}
</style>


