<script lang="ts">
  import { Check, Flame, Droplets, Book, Dumbbell, Code, Brain } from "lucide-svelte";
  import { slide } from "svelte/transition";

  type Habit = {
    id: string;
    name: string;
    icon: any;
    color: string;
    streak: number;
    completedToday: boolean;
  };

  let habits: Habit[] = [
    { id: "1", name: "Read 10 pages", icon: Book, color: "#6366F1", streak: 14, completedToday: false },
    { id: "2", name: "Workout", icon: Dumbbell, color: "#EF4444", streak: 3, completedToday: true },
    { id: "3", name: "Drink Water", icon: Droplets, color: "#06B6D4", streak: 21, completedToday: false },
    { id: "4", name: "Write Code", icon: Code, color: "#10B981", streak: 5, completedToday: false },
    { id: "5", name: "Meditate", icon: Brain, color: "#8B5CF6", streak: 0, completedToday: false },
  ];

  $: completedCount = habits.filter(h => h.completedToday).length;

  function toggleHabit(id: string) {
    habits = habits.map(h => {
      if (h.id === id) {
        const completed = !h.completedToday;
        return {
          ...h,
          completedToday: completed,
          streak: completed ? h.streak + 1 : Math.max(0, h.streak - 1)
        };
      }
      return h;
    });
  }
</script>

<main class="habits-app-v2 module-root">
  <div class="ha-container">
    <header class="ha-header">
      <h1 class="ha-title">Monday</h1>
      <span class="ha-summary">{completedCount} / {habits.length} done</span>
    </header>

    <div class="ha-grid">
      {#each habits as habit (habit.id)}
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div class="ha-tile {habit.completedToday ? 'completed' : ''}" 
          style="--habit-color: {habit.color};"
          on:click={() => toggleHabit(habit.id)}
        >
          <div class="ha-icon-wrapper">
            <svelte:component this={habit.icon} size={36} />
            {#if habit.completedToday}
              <div class="ha-check-overlay" transition:slide={{duration: 200}}>
                <Check size={48} strokeWidth={3} />
              </div>
            {/if}
          </div>
          <span class="ha-name">{habit.name}</span>
          <div class="ha-streak">
            <span>🔥 {habit.streak}</span>
          </div>
        </div>
      {/each}
    </div>

    <footer class="ha-footer">
      <button class="ha-add-btn">+ Add Habit</button>
    </footer>
  </div>
</main>


<style>
.habits-app { min-height: 100%; padding: 36px; background: #111318; color: #f6f7f2; font-family: "Space Grotesk", sans-serif; animation: habits-in .35s ease; }
.habits-app nav { display: flex; align-items: center; gap: 24px; margin-bottom: 58px; }
.habits-app nav strong { margin-right: auto; }
.habits-app nav span, .habits-app nav label { padding: 12px 22px; border-radius: 999px; background: #24272c; color: #b8beb2; }
.habits-app h1 { font-size: 48px; font-weight: 500; }.habits-app h1 b { color: #c8f535; }
.habits-grid { display: grid; grid-template-columns: 1fr 1fr .65fr 1.35fr; gap: 16px; }
.habits-grid article { border-radius: 28px; background: #1c2128; padding: 28px; transition: transform .2s ease; }
.habits-grid article:hover { transform: translateY(-3px); }
.habits-streak div { display: flex; gap: 10px; margin: 32px 0; }.habits-streak p { display: grid; gap: 10px; text-align: center; }.habits-streak i { width: 22px; height: 116px; border-radius: 999px; background: #373b40; }.habits-streak .habits-done { background: linear-gradient(#5147a2, #c8f535); }
.habits-streak footer, .habits-ring footer { display: flex; justify-content: space-between; color: #a6aa9f; }.habits-streak strong { color: #fff; font-size: 36px; }
.habits-ring div { display: grid; place-items: center; width: 180px; height: 180px; margin: 18px auto; border-radius: 50%; background: conic-gradient(#c8f535 68%, #32373a 0); box-shadow: inset 0 0 0 36px #1c2128; }.habits-ring span { font-size: 36px; }
.habits-add { display: grid; background: linear-gradient(160deg, #20253a, #6559df) !important; }.habits-add button, .habits-schedule button { place-self: end; width: 58px; height: 58px; border: 0; border-radius: 50%; background: #c8f535; font-size: 32px; cursor: default; }
.habits-goals { grid-column: span 1; }.habits-goals p { display: grid; grid-template-columns: 34px 1fr auto; gap: 14px; align-items: center; padding: 12px 0; border-bottom: 1px solid #303633; color: #d6dacd; }.habits-goals p span { width: 34px; height: 34px; border-radius: 50%; background: #586152; }.habits-finished { text-decoration: line-through; color: #73796e !important; }.habits-finished b { color: #c8f535; text-decoration: none; }
.habits-goals footer { display: grid; grid-template-columns: 1fr auto; gap: 18px; align-items: center; margin-top: 26px; }.habits-goals footer i { height: 18px; border-radius: 999px; background: linear-gradient(90deg, #c8f535 40%, #fff 0); }
.habits-schedule { grid-column: 1 / 4; min-height: 190px; background: linear-gradient(140deg, #202326, #31401f) !important; }.habits-schedule span, .habits-schedule b { display: inline-block; margin-right: 22px; padding: 10px 18px; border-radius: 999px; background: #2c3032; }.habits-schedule p { margin: 28px 0 0 160px; padding: 14px 20px; border-radius: 18px; background: #161819; width: fit-content; }
@keyframes habits-in { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }

</style>


