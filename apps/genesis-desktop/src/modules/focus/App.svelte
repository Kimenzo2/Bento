<script lang="ts">
  import { Play, Pause, RotateCcw, Volume2, Settings } from "lucide-svelte";
  // Focus Timer Logic
  let isRunning = false;
  let timeRemaining = 25 * 60; // 25 minutes in seconds
  let currentSession = "Pomodoro";
  let interval: ReturnType<typeof setInterval>;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const toggleTimer = () => {
    if (isRunning) {
      clearInterval(interval);
      isRunning = false;
    } else {
      isRunning = true;
      interval = setInterval(() => {
        if (timeRemaining > 0) {
          timeRemaining -= 1;
        } else {
          clearInterval(interval);
          isRunning = false;
          // Notification or sound here
        }
      }, 1000);
    }
  };

  const resetTimer = () => {
    clearInterval(interval);
    isRunning = false;
    timeRemaining = 25 * 60;
  };
</script>

<div class="focus-app-v2 module-root">
  <div class="fo-topbar">
    <div class="fo-session-badge">{currentSession}</div>
    <div class="fo-controls">
      <button class="fo-icon-btn"><Volume2 size={20} /></button>
      <button class="fo-icon-btn"><Settings size={20} /></button>
    </div>
  </div>

  <div class="fo-main">
    <div class="fo-timer-display">
      <svg class="fo-progress-ring" viewBox="0 0 100 100">
        <circle class="fo-ring-bg" cx="50" cy="50" r="45" />
        <circle 
          class="fo-ring-progress" 
          cx="50" cy="50" r="45" 
          style="stroke-dasharray: {2 * Math.PI * 45}; stroke-dashoffset: {2 * Math.PI * 45 * (1 - timeRemaining / (25 * 60))};" 
        />
      </svg>
      <div class="fo-time">{formatTime(timeRemaining)}</div>
    </div>

    <div class="fo-action-row">
      <button class="fo-btn-reset" on:click={resetTimer}>
        <RotateCcw size={24} />
      </button>
      <button class="fo-btn-play" on:click={toggleTimer}>
        {#if isRunning}
          <Pause size={32} fill="currentColor" />
        {:else}
          <Play size={32} fill="currentColor" />
        {/if}
      </button>
    </div>
  </div>
</div>


<style>
.focus-app { min-height: 100%; padding: 32px; background: #fffff0; color: #171512; font-family: "Nunito", sans-serif; animation: focus-in .35s ease; }
.focus-app nav { display: flex; align-items: center; gap: 18px; margin-bottom: 34px; }.focus-app nav strong { margin-right: auto; padding: 12px 22px; border: 1px solid #222; border-radius: 999px; }.focus-app nav span { padding: 14px 24px; border-radius: 999px; background: #fff; }.focus-app nav span:first-of-type { background: #1a1a1a; color: #fff; }
.focus-app header { display: grid; grid-template-columns: 1fr repeat(3, 160px); align-items: end; gap: 20px; }.focus-app h1 { font-size: 48px; }.focus-app header p { display: grid; margin: 0; }.focus-app header b { font-size: 42px; }
.focus-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 18px; }.focus-grid article { border-radius: 30px; background: #fff; padding: 24px; transition: transform .2s ease; }.focus-grid article:hover { transform: translateY(-3px); }
.focus-timer { position: relative; min-height: 340px; background: #1a1a1a !important; color: #fff; }.focus-timer canvas { height: 220px !important; }.focus-timer > strong { position: absolute; inset: 130px 0 auto; display: grid; text-align: center; font: 800 64px "JetBrains Mono", monospace; }.focus-timer small { font: 500 14px "Nunito"; color: #aaa; }.focus-timer footer { display: flex; justify-content: center; gap: 14px; }.focus-timer button { padding: 12px 22px; border: 0; border-radius: 999px; background: #f5c400; }
.focus-week b { display: block; font-size: 44px; }.focus-week div { display: flex; align-items: end; gap: 16px; height: 190px; }.focus-week span { width: 26px; height: var(--h); border-radius: 999px; background: #1a1a1a; }.focus-week .focus-today { background: #f5c400; }
.focus-log p { display: flex; justify-content: space-between; padding: 18px 0; border-bottom: 1px dotted #ddd; }.focus-log button { border: 0; background: transparent; }
.focus-calendar { grid-column: span 2; }.focus-calendar div { display: grid; grid-template-columns: repeat(6, 1fr); color: #9c9276; }.focus-calendar p { width: fit-content; margin-left: 120px; padding: 16px 24px; border-radius: 18px; background: #222; color: #fff; }
@keyframes focus-in { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }

</style>


