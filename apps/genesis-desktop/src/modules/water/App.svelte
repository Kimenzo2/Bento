<script lang="ts">
  import { Settings, Plus, Droplet, Coffee, Filter, GlassWater } from 'lucide-svelte';

  export let moduleId: string;
  export let settings: any = {};
  void moduleId;
  void settings;

  let intake = 1200;
  let goal = 2500;
  
  $: percentage = Math.min((intake / goal) * 100, 100);

  let logs = [
    { id: 1, time: "09:30 AM", amount: 200, label: "Water", icon: "GlassWater" },
    { id: 2, time: "11:15 AM", amount: 350, label: "Coffee", icon: "Coffee" },
    { id: 3, time: "02:00 PM", amount: 500, label: "Bottle", icon: "Droplet" },
    { id: 4, time: "04:45 PM", amount: 150, label: "Water", icon: "GlassWater" }
  ];

  function addDrink(amount: number) {
    intake += amount;
  }
</script>

<main class="water-app module-root">
  <div class="water-container scrollable-content">
    <header class="water-header">
      <div class="streak-badge">
        <span>🔥 12 days</span>
      </div>
      <button class="icon-btn" aria-label="Settings">
        <Settings size={22} />
      </button>
    </header>

    <div class="ring-container">
      <div class="progress-ring">
        <div class="wave" style="--perc: {percentage}%"></div>
        <div class="ring-content">
          <h1>{intake} <span>ml</span></h1>
          <p>/ {goal} ml goal</p>
        </div>
      </div>
    </div>

    <div class="quick-add">
      <button class="add-btn" on:click={() => addDrink(150)}>
        <Coffee size={24} />
        <span>150ml</span>
      </button>
      <button class="add-btn" on:click={() => addDrink(200)}>
        <GlassWater size={24} />
        <span>200ml</span>
      </button>
      <button class="add-btn" on:click={() => addDrink(350)}>
        <Filter size={24} />
        <span>350ml</span>
      </button>
      <button class="add-btn" on:click={() => addDrink(500)}>
        <Droplet size={24} />
        <span>500ml</span>
      </button>
      <button class="add-btn custom-btn">
        <Plus size={18} />
      </button>
    </div>

    <div class="log-section">
      <h3>Today's Log</h3>
      <div class="logs water-log">
        {#each logs as log (log.id)}
          <div class="log-item">
            <div class="log-icon">
                {#if log.icon === 'GlassWater'}<GlassWater size={20}/>
                {:else if log.icon === 'Coffee'}<Coffee size={20}/>
                {:else if log.icon === 'Droplet'}<Droplet size={20}/>
                {:else}<Droplet size={20}/>{/if}
            </div>
            <div class="log-info">
              <span class="log-label">{log.label}</span>
              <span class="log-time">{log.time}</span>
            </div>
            <div class="log-amount">+{log.amount} ml</div>
          </div>
        {/each}
      </div>
    </div>

    <button class="reminder-bar">
      <span>Next reminder: 3:00pm</span>
    </button>
  </div>
</main>

<style>
.water-app {
  min-height: 100vh;
  background: var(--background);
  color: var(--foreground);
  font-family: inherit;
  display: flex;
  justify-content: center;
}
.water-container {
  width: 100%;
  max-width: 480px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  min-height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
}
.water-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}
.streak-badge {
  background: var(--surface);
  border: 1px solid var(--border);
  padding: 8px 16px;
  border-radius: 99px;
  font-size: 14px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
}
.icon-btn {
  background: transparent;
  border: none;
  color: var(--muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.icon-btn:hover { color: var(--foreground); }
.ring-container {
  display: flex;
  justify-content: center;
  margin: 32px 0 48px;
}
.progress-ring {
  width: 260px;
  height: 260px;
  border-radius: 50%;
  border: 4px solid var(--border);
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}
.wave {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: var(--perc);
  background: var(--primary);
  opacity: 0.15;
  transition: height 0.5s ease-out;
}
.ring-content {
  position: relative;
  z-index: 10;
  text-align: center;
}
.ring-content h1 {
  font-size: 48px;
  font-weight: 800;
  margin: 0;
  letter-spacing: -1px;
  color: var(--foreground);
}
.ring-content h1 span {
  font-size: 20px;
  font-weight: 600;
  color: var(--muted);
}
.ring-content p {
  margin: 8px 0 0;
  font-size: 16px;
  color: var(--muted);
  font-weight: 500;
}
.quick-add {
  display: flex;
  gap: 12px;
  margin-bottom: 40px;
  overflow-x: auto;
  padding-bottom: 8px;
}
.add-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 80px;
  height: 80px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  color: var(--foreground);
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 600;
  flex-shrink: 0;
}
.add-btn:hover { background: var(--border); transform: translateY(-2px); }   
.custom-btn { background: transparent; border: 1px dashed var(--muted); color: var(--muted); }
.custom-btn:hover { background: var(--surface); color: var(--foreground); }  
.log-section { flex: 1; }
.log-section h3 {
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--muted);
  margin: 0 0 16px;
  font-weight: 600;
}
.logs { display: flex; flex-direction: column; gap: 12px; }
.log-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
}
.log-icon { display: flex; align-items: center; justify-content: center; color: var(--muted); }
.log-info { display: flex; flex-direction: column; flex: 1; gap: 4px; }      
.log-label { font-weight: 600; font-size: 15px; color: var(--foreground); }
.log-time { font-size: 13px; color: var(--muted); }
.log-amount { font-weight: 600; color: var(--primary); }
.reminder-bar {
  text-align: center;
  padding: 16px;
  margin-top: 16px;
  font-size: 14px;
  font-weight: 600;
  color: var(--muted);
  cursor: pointer;
  width: 100%;
  border: 1px solid transparent;
  background: transparent;
  border-radius: 12px;
}
.reminder-bar:hover { background: var(--surface); color: var(--foreground); border-color: var(--border); }
</style>

