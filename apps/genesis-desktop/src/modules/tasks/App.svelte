<script lang="ts">
  let newTaskInput = "";

  type Task = {
    id: string;
    title: string;
    time?: string;
    completed: boolean;
    overdue?: boolean;
  };

  let tasks: Task[] = [
    { id: "1", title: "Review Q3 marketing plan", time: "10:00 AM", completed: false, overdue: true },
    { id: "2", title: "Dentist appointment", time: "3:00 PM", completed: false },
    { id: "3", title: "Call mom", time: "6:00 PM", completed: false },
    { id: "4", title: "Buy groceries", completed: false },
    { id: "5", title: "Send weekly update to team", time: "9:00 AM", completed: true }
  ];

  $: activeTasks = tasks.filter((task) => !task.completed).sort((a, b) => (a.overdue ? -1 : b.overdue ? 1 : 0));
  $: completedTasks = tasks.filter((task) => task.completed);

  function addTask(event: KeyboardEvent) {
    if (event.key === "Enter" && newTaskInput.trim()) {
      tasks = [
        ...tasks,
        {
          id: crypto.randomUUID(),
          title: newTaskInput.trim(),
          completed: false
        }
      ];
      newTaskInput = "";
    }
  }

  function toggleTask(id: string) {
    tasks = tasks.map((task) => (task.id === id ? { ...task, completed: !task.completed } : task));
  }
</script>

<main class="tasks-app-v2 module-root mini-app-root">
  <section class="tasks-main-v2">
    <header class="tm-header">
      <span class="tm-date">Monday, May 11</span>
      <span class="tm-count">{activeTasks.length} tasks today</span>
    </header>

    <div class="tm-input-area">
      <input
        type="text"
        class="tm-input"
        placeholder="What needs to be done?"
        bind:value={newTaskInput}
        on:keydown={addTask}
      />
      <small class="tm-hint">Try: call mom tomorrow 3pm</small>
    </div>

    <div class="tm-task-list task-list">
      {#each activeTasks as task (task.id)}
        <label class="tm-task-row {task.overdue ? 'overdue' : ''}">
          <input type="checkbox" class="tm-checkbox" checked={task.completed} on:change={() => toggleTask(task.id)} />
          <span class="tm-custom-checkbox"></span>
          <span class="tm-title">{task.title}</span>
          {#if task.time}
            <span class="tm-time {task.overdue ? 'overdue-time' : ''}">{task.time}</span>
          {/if}
        </label>
      {/each}

      {#if completedTasks.length > 0}
        <div class="tm-completed-section">
          {#each completedTasks as task (task.id)}
            <label class="tm-task-row completed">
              <input type="checkbox" class="tm-checkbox" checked={task.completed} on:change={() => toggleTask(task.id)} />
              <span class="tm-custom-checkbox"></span>
              <span class="tm-title">{task.title}</span>
              {#if task.time}
                <span class="tm-time">{task.time}</span>
              {/if}
            </label>
          {/each}
        </div>
      {/if}
    </div>
  </section>
</main>

<style>
  .tasks-app-v2 {
    display: flex;
    min-height: 100%;
    background: var(--background);
    color: var(--foreground);
  }

  .tasks-main-v2 {
    --tasks-surface: color-mix(in srgb, var(--surface) 94%, var(--background));
    --tasks-border: var(--border);
    --tasks-muted: var(--muted);
    --tasks-accent: var(--primary);
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    min-height: 100%;
    gap: 1.5rem;
    padding: 2rem 2.25rem;
  }

  .tm-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
  }

  .tm-date {
    font-size: 1.5rem;
    font-weight: 700;
  }

  .tm-count,
  .tm-hint {
    color: var(--tasks-muted);
  }

  .tm-input-area {
    display: grid;
    gap: 0.5rem;
  }

  .tm-input {
    width: 100%;
    min-height: 3rem;
    padding: 0.875rem 1rem;
    border: 1px solid var(--tasks-border);
    border-radius: 1rem;
    background: var(--tasks-surface);
    color: var(--foreground);
    outline: none;
  }

  .tm-input:focus {
    border-color: var(--tasks-accent);
  }

  .tm-task-list {
    display: grid;
    gap: 0.75rem;
    flex: 1;
    min-height: 0;
    padding-right: 0.125rem;
  }

  .tm-task-row {
    display: grid;
    grid-template-columns: auto auto 1fr auto;
    align-items: center;
    gap: 0.875rem;
    min-height: 4rem;
    padding: 0.875rem 1rem;
    border: 1px solid var(--tasks-border);
    border-radius: 1rem;
    background: var(--tasks-surface);
  }

  .tm-task-row.completed {
    opacity: 0.7;
  }

  .tm-task-row.overdue {
    border-color: color-mix(in srgb, var(--destructive, #ef4444) 55%, var(--tasks-border));
  }

  .tm-checkbox {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .tm-custom-checkbox {
    width: 1.125rem;
    height: 1.125rem;
    border: 1px solid var(--tasks-border);
    border-radius: 999px;
    background: var(--background);
  }

  .tm-checkbox:checked + .tm-custom-checkbox {
    background: var(--tasks-accent);
    border-color: var(--tasks-accent);
  }

  .tm-title {
    min-width: 0;
  }

  .completed .tm-title {
    color: var(--tasks-muted);
    text-decoration: line-through;
  }

  .tm-time {
    color: var(--tasks-muted);
    font-size: 0.875rem;
    white-space: nowrap;
  }

  .overdue-time {
    color: var(--destructive, #ef4444);
  }

  .tm-completed-section {
    display: grid;
    gap: 0.75rem;
    margin-top: 0.5rem;
  }

  @media (max-width: 840px) {
    .tasks-main-v2 {
      padding: 1.25rem;
    }

    .tm-task-row {
      grid-template-columns: auto auto 1fr;
    }

    .tm-time {
      grid-column: 3;
    }
  }
</style>
