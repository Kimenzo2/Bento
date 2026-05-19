<script lang="ts">
  import { Plus, Bell, Calendar as CalendarIcon, Clock, ChevronDown } from 'lucide-svelte';

  export let moduleId: string;
  export let settings: any = {};
  void moduleId;
  void settings;

  let events = [
    { 
      id: 1, 
      name: "Hawaii Trip", 
      date: new Date(Date.now() + 17 * 24 * 60 * 60 * 1000), 
      category: "Trip",
      cover: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=800",
      color: "var(--primary)"
    },
    { 
      id: 2, 
      name: "Product Launch", 
      date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), 
      category: "Deadline",
      color: "#f59e0b"
    },
    { 
      id: 3, 
      name: "Mom's Birthday", 
      date: new Date(Date.now() + 42 * 24 * 60 * 60 * 1000), 
      category: "Birthday",
      color: "#ec4899"
    },
    { 
      id: 4, 
      name: "Project Presentation", 
      date: new Date(), // today
      category: "Work",
      color: "#10b981"
    }
  ];

  // Helper to format date
  function formatDate(d: Date) {
    return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(d);
  }

  // Calculate days away
  function getDaysAway(d: Date) {
    const diff = d.getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  // Sort events
  $: upcomingEvents = events
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map(e => ({...e, daysAway: getDaysAway(e.date)}));

  $: heroEvent = upcomingEvents.find(e => e.daysAway > 0) || upcomingEvents[0];
  $: timelineEvents = upcomingEvents.filter(e => e.id !== heroEvent?.id);
</script>

<main class="countdown-app module-root">
  <div class="countdown-container">
    {#if heroEvent}
      <!-- HERO CARD -->
      <section class="hero-card">
        <div class="hero-bg"
             style="background-image: url({heroEvent.cover || ''}); background-color: {heroEvent.cover ? 'transparent' : 'var(--surface)'};">
        </div>
        <div class="hero-overlay"></div>
        
        <header class="top-nav">
          <h2 class="app-title">Countdowns</h2>
          <button class="add-btn">
            <Plus size={24} />
          </button>
        </header>

        <div class="hero-content">
          <div class="category-pill">{heroEvent.category}</div>
          <h1 class="hero-days">{heroEvent.daysAway} days</h1>
          <h2 class="hero-name">{heroEvent.name}</h2>
          <p class="hero-date">{formatDate(heroEvent.date)}</p>
        </div>
      </section>
    {/if}

    <!-- EVENT LIST -->
    <section class="event-list">
      {#each timelineEvents as event (event.id)}
        <div class="event-row">
          <div class="event-indicator" aria-hidden="true">
            <div class="dot" style="background: {event.color}">
              {#if event.daysAway === 0}
                <div class="pulse-ring" style="border-color: {event.color}"></div>
              {/if}
            </div>
            <div class="line"></div>
          </div>
          
          <div class="event-card">
            <div class="event-details">
              <h3>{event.name}</h3>
              <p>{formatDate(event.date)}</p>
            </div>
            <div class="event-days">
              {#if event.daysAway === 0}
                <span class="today-text" style="color: {event.color}">Today</span>
              {:else}
                <span class="days-num">{event.daysAway}</span>
                <span class="days-label">days</span>
              {/if}
            </div>
          </div>
        </div>
      {/each}

      <button class="expand-past-btn">
        <span>View Past Events</span>
        <ChevronDown size={16} />
      </button>
    </section>
  </div>
</main>

<style>
.countdown-app {
  min-height: 100vh;
  background: var(--background);
  color: var(--foreground);
  font-family: inherit;
  display: flex;
  justify-content: center;
}
.countdown-container {
  width: 100%;
  max-width: 480px;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* HERO CARD */
.hero-card {
  position: relative;
  height: 45vh;
  min-height: 350px;
  display: flex;
  flex-direction: column;
  color: #fff;
  overflow: hidden;
  border-bottom-left-radius: 32px;
  border-bottom-right-radius: 32px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.3);
  margin-bottom: 24px;
}
.hero-bg {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background-size: cover;
  background-position: center;
}
.hero-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.8) 100%);
  backdrop-filter: blur(2px);
}
.top-nav {
  position: relative;
  z-index: 10;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
}
.app-title {
  font-size: 18px;
  font-weight: 700;
  margin: 0;
  letter-spacing: 0.5px;
}
.add-btn {
  background: rgba(255,255,255,0.2);
  border: none;
  color: white;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  backdrop-filter: blur(4px);
  transition: background 0.2s;
}
.add-btn:hover { background: rgba(255,255,255,0.3); }

.hero-content {
  position: relative;
  z-index: 10;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 32px 24px;
  align-items: center;
  text-align: center;
}
.category-pill {
  background: rgba(255,255,255,0.2);
  padding: 4px 12px;
  border-radius: 100px;
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 16px;
  backdrop-filter: blur(4px);
}
.hero-days {
  font-size: 72px;
  font-weight: 800;
  margin: 0;
  line-height: 1;
  letter-spacing: -2px;
}
.hero-name {
  font-size: 28px;
  font-weight: 700;
  margin: 8px 0 4px;
}
.hero-date {
  font-size: 16px;
  color: rgba(255,255,255,0.7);
  margin: 0;
  font-weight: 500;
}

/* EVENT LIST */
.event-list {
  flex: 1;
  padding: 0 24px 40px;
  display: flex;
  flex-direction: column;
}
.event-row {
  display: flex;
  margin-bottom: 16px;
}
.event-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 24px;
  margin-right: 16px;
}
.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  margin-top: 24px; /* Align with card title */
  position: relative;
}
.pulse-ring {
  position: absolute;
  top: -4px; right: -4px; bottom: -4px; left: -4px;
  border: 2px solid;
  border-radius: 50%;
  animation: pulse 2s infinite;
  opacity: 0.5;
}
@keyframes pulse {
  0% { transform: scale(1); opacity: 0.8; }
  100% { transform: scale(2); opacity: 0; }
}
.line {
  flex: 1;
  width: 2px;
  background: var(--border);
  margin-top: 8px;
  min-height: 20px;
}
.event-row:last-child .line { display: none; }

.event-card {
  flex: 1;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 16px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: transform 0.2s;
  cursor: pointer;
}
.event-card:hover { border-color: var(--muted); transform: translateY(-2px); }

.event-details h3 {
  font-size: 18px;
  font-weight: 700;
  margin: 0 0 4px;
  color: var(--foreground);
}
.event-details p {
  font-size: 14px;
  margin: 0;
  color: var(--muted);
}
.event-days {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}
.days-num {
  font-size: 28px;
  font-weight: 800;
  line-height: 1;
  color: var(--foreground);
}
.days-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.today-text {
  font-size: 18px;
  font-weight: 800;
  text-transform: uppercase;
}

.expand-past-btn {
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 100px;
  padding: 12px 20px;
  color: var(--muted);
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 16px;
  cursor: pointer;
  transition: color 0.2s;
}
.expand-past-btn:hover {
  color: var(--foreground);
  background: var(--surface);
}
</style>


