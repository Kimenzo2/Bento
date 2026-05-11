<script lang="ts">
  import { Plus, Target, CheckCircle2, ChevronRight, TrendingUp, AlertCircle, Dumbbell, Book, CreditCard, ChevronDown, Check } from 'lucide-svelte';

  export let moduleId: string;
  export let settings: any = {};

  const currentWeek = 19;
  const totalWeeks = 52;
  const showWeeklyCheckIn = true; // Monday morning prompt

  const goals = [
    {
      id: 1,
      title: 'Run a Half Marathon',
      category: 'Fitness',
      icon: Dumbbell,
      current: 12,
      target: 21.1,
      unit: 'km',
      lastLogged: '2 days ago',
      deadline: '47 days left',
      status: 'active',
      tint: 'bg-emerald-500' // Using tailwind-style class names or just direct styles
    },
    {
      id: 2,
      title: 'Save Emergency Fund',
      category: 'Finance',
      icon: CreditCard,
      current: 4500,
      target: 10000,
      unit: '$',
      lastLogged: 'Updated today',
      deadline: 'Overdue by 5 days',
      status: 'overdue',
      tint: 'bg-rose-500'
    },
    {
      id: 3,
      title: 'Read 24 Books',
      category: 'Learning',
      icon: Book,
      current: 8,
      target: 24,
      unit: 'books',
      lastLogged: '1 week ago',
      deadline: '228 days left',
      status: 'active',
      tint: 'bg-indigo-500'
    }
  ];

  let showNewGoalForm = false;
</script>

<div class="goals-app-container module-root">
  <!-- Header -->
  <div class="goals-header">
    <div class="header-text">
      <h1>Your Goals</h1>
      <p class="week-subtext">Week {currentWeek} of {totalWeeks}</p>
    </div>
    <div class="header-actions">
      <button class="icon-button glass-btn"><Target size={22} /></button>
    </div>
  </div>

  <!-- Main Scrollable Content -->
  <div class="goals-content">
    
    <!-- Weekly Check-in Prominent Card -->
    {#if showWeeklyCheckIn}
      <div class="weekly-checkin-card">
        <div class="checkin-content">
          <div class="checkin-icon-wrapper">
            <TrendingUp size={28} color="#ffffff" />
          </div>
          <div class="checkin-text">
            <h2>Time for your weekly check-in</h2>
            <p>Log your weekend progress to keep your streaks alive.</p>
          </div>
        </div>
        <button class="checkin-cta">Start Check-in</button>
      </div>
    {/if}

    <!-- Goals List -->
    <div class="goals-list">
      {#each goals.sort((a, b) => (a.status === 'overdue' ? -1 : 1)) as goal}
        <div class="goal-card {goal.status === 'overdue' ? 'status-overdue' : 'status-active'}">
          <!-- Top Row -->
          <div class="goal-top">
            <div class="goal-meta">
              <h3 class="goal-title">{goal.title}</h3>
              <p class="goal-deadline {goal.status === 'overdue' ? 'text-red' : 'text-gray'}">
                {#if goal.status === 'overdue'}
                  <AlertCircle size={14} class="mr-1" />
                {/if}
                {goal.deadline}
              </p>
            </div>
            <div class="goal-icon-box">
              <svelte:component this={goal.icon} size={20} />
            </div>
          </div>

          <!-- Progress Row -->
          <div class="goal-progress-wrapper">
            <div class="progress-labels">
              <span class="progress-current">
                {goal.current} <span class="unit">{goal.unit}</span>
              </span>
              <span class="progress-target">
                {goal.target} {goal.unit} ({Math.round((goal.current / goal.target) * 100)}%)
              </span>
            </div>
            <div class="progress-track">
              <div class="progress-fill {goal.status === 'overdue' ? 'fill-red' : 'fill-primary'}"
                   style="width: {(goal.current / goal.target) * 100}%"></div>
            </div>
          </div>

          <!-- Footer Row -->
          <div class="goal-footer">
            <div class="last-logged">
              {#if goal.lastLogged.includes('Updated today')}
                <CheckCircle2 size={14} class="text-green mr-1" />
                <span class="text-green">{goal.lastLogged}</span>
              {:else}
                {goal.lastLogged}
              {/if}
            </div>
          </div>
        </div>
      {/each}
    </div>
  </div>

  <!-- Floating Action Button -->
  <button class="fab-button" on:click={() => showNewGoalForm = true}>
    <Plus size={28} color="#ffffff" />
  </button>

  <!-- New Goal Modal (Popup) -->
  {#if showNewGoalForm}
    <div class="modal-backdrop">
      <div class="modal-surface panel-glass">
        <div class="modal-header">
          <h2>Create New Goal</h2>
          <button class="close-modal-btn" on:click={() => showNewGoalForm = false}>✕</button>
        </div>
        <div class="modal-body">
          <div class="input-group">
            <label>Goal Name</label>
            <input type="text" placeholder="e.g. Learn Spanish" class="premium-input" />
          </div>
          <div class="input-row">
            <div class="input-group">
              <label>Target Number</label>
              <input type="number" placeholder="0" class="premium-input" />
            </div>
            <div class="input-group">
              <label>Unit</label>
              <input type="text" placeholder="e.g. hours, km" class="premium-input" />
            </div>
          </div>
          <div class="input-group">
            <label>Deadline</label>
            <input type="date" class="premium-input" />
          </div>
          <div class="input-group">
            <label>Category</label>
            <div class="premium-select-wrapper">
              <select class="premium-input select">
                <option>Health & Fitness</option>
                <option>Finance</option>
                <option>Learning & Growth</option>
                <option>Career</option>
              </select>
              <ChevronDown size={18} class="select-indicator" />
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-primary" on:click={() => showNewGoalForm = false}>Save Goal</button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
/* goals.css - Flat UI (No shadows, no blur, no blobs, no global app backgrounds) */

.goals-app-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
  font-family: inherit;
  color: var(--text-primary, #ffffff);
}

.goals-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  padding: 32px 32px 16px;
  position: relative;
  z-index: 10;
}

.header-text h1 {
  font-size: 36px;
  font-weight: 800;
  margin: 0 0 4px 0;
  letter-spacing: -0.02em;
  color: #ffffff;
}

.week-subtext {
  font-size: 15px;
  color: #a1a1aa;
  margin: 0;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.icon-button {
  background: transparent;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #e4e4e7;
}

.glass-btn {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.05); /* Solid transparent, no blur, no shadow */
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.goals-content {
  flex-grow: 1;
  overflow-y: auto;
  padding: 16px 32px 100px;
  scrollbar-width: none; 
}
.goals-content::-webkit-scrollbar { display: none; }

/* Flat Weekly Check-in Card */
.weekly-checkin-card {
  position: relative;
  overflow: hidden;
  border-radius: 24px;
  padding: 32px;
  margin-bottom: 32px;
  background: #1e293b;
  border: 1px solid #334155;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.checkin-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: relative;
  z-index: 1;
}

.checkin-icon-wrapper {
  width: 56px; height: 56px;
  border-radius: 16px;
  background: #6366f1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.checkin-text h2 {
  font-size: 22px;
  font-weight: 700;
  margin: 0 0 8px 0;
}
.checkin-text p {
  color: #e4e4e7;
  margin: 0;
  font-size: 15px;
  line-height: 1.5;
}

.checkin-cta {
  align-self: flex-start;
  position: relative;
  z-index: 1;
  background: #ffffff;
  color: #09090b;
  font-weight: 600;
  font-size: 15px;
  padding: 12px 24px;
  border-radius: 12px;
  border: none;
  cursor: pointer;
}

/* Goals List */
.goals-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.goal-card {
  background: #18181b;
  border-radius: 20px;
  padding: 24px;
  border: 1px solid #27272a;
}

.goal-card.status-overdue {
  border-left: 4px solid #f43f5e;
  background: #1f1115;
}

.goal-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}

.goal-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 6px 0;
}

.goal-deadline {
  font-size: 13px;
  display: flex;
  align-items: center;
  margin: 0;
  font-weight: 500;
}
.text-red { color: #f43f5e; }
.text-gray { color: #a1a1aa; }
.mr-1 { margin-right: 4px; }
.text-green { color: #10b981; }

.goal-icon-box {
  width: 44px; height: 44px;
  border-radius: 12px;
  background: #27272a;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #e4e4e7;
  border: 1px solid #3f3f46;
}

/* Progress */
.goal-progress-wrapper {
  margin-bottom: 20px;
}

.progress-labels {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 10px;
}

.progress-current {
  font-size: 24px;
  font-weight: 700;
}
.progress-current .unit {
  font-size: 14px;
  font-weight: 500;
  color: #a1a1aa;
}

.progress-target {
  font-size: 14px;
  font-weight: 500;
  color: #a1a1aa;
}

.progress-track {
  width: 100%;
  height: 8px;
  background: #27272a;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 4px;
}
.fill-primary {
  background: #3b82f6;
}
.fill-red {
  background: #f43f5e;
}

/* Footer */
.goal-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid #27272a;
  padding-top: 16px;
}

.last-logged {
  font-size: 13px;
  color: #a1a1aa;
  display: flex;
  align-items: center;
}

/* FAB */
.fab-button {
  position: absolute;
  bottom: 40px;
  right: 40px;
  width: 64px;
  height: 64px;
  border-radius: 32px;
  background: #10b981;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 50;
}

/* Modal Surface - No backdrop blur */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.panel-glass {
  width: 100%;
  max-width: 500px;
  background: #18181b;
  border-radius: 28px;
  border: 1px solid #27272a;
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 32px;
  border-bottom: 1px solid #27272a;
}

.modal-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.close-modal-btn {
  background: #27272a;
  border: none;
  width: 32px; height: 32px;
  border-radius: 16px;
  color: #e4e4e7;
  cursor: pointer;
}

.modal-body {
  padding: 32px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.input-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-group label {
  font-size: 13px;
  font-weight: 600;
  color: #a1a1aa;
}

.premium-input {
  width: 100%;
  background: #27272a;
  border: 1px solid #3f3f46;
  border-radius: 12px;
  padding: 14px 16px;
  color: white;
  font-size: 15px;
  font-family: inherit;
  outline: none;
}
.premium-input:focus {
  border-color: #10b981;
}

.premium-select-wrapper {
  position: relative;
}
.select {
  appearance: none;
  cursor: pointer;
}
.select-indicator {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  color: #a1a1aa;
  pointer-events: none;
}

.modal-footer {
  padding: 24px 32px;
  border-top: 1px solid #27272a;
  background: #18181b;
}

.btn-primary {
  width: 100%;
  padding: 16px;
  border-radius: 12px;
  background: #10b981;
  color: white;
  font-weight: 600;
  font-size: 16px;
  border: none;
  cursor: pointer;
}
</style>


