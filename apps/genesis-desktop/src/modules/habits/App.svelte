<script lang="ts">
  import { Check, Flame, Plus, BarChart3, Zap, Download, Settings, TrendingUp } from "lucide-svelte";
  import { onMount } from "svelte";
  import {
    getModuleSectionLabel,
    setModuleSection,
    ensureModuleSection,
    moduleSectionStore,
  } from '$lib/stores/module-sections.store';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';

  type Habit = {
    id: string;
    name: string;
    icon: any;
    color: string;
    streak: number;
    longestStreak: number;
    completedToday: boolean;
    completedDays: number;
  };

  export let moduleId: string = 'habits';
  export let settings: any = {};
  void settings;

  const sectionLabels = ["Today", "Heatmap", "Stacks", "Review", "Widgets", "Export"] as const;
  $: selectedSection = getModuleSectionLabel($moduleSectionStore, moduleId, sectionLabels);

  onMount(() => {
    ensureModuleSection(moduleId, sectionLabels);
  });

  let habits: Habit[] = [
    { id: "1", name: "Read 10 pages", icon: null, color: "#6366F1", streak: 14, longestStreak: 28, completedToday: false, completedDays: 18 },
    { id: "2", name: "Workout", icon: null, color: "#EF4444", streak: 3, longestStreak: 12, completedToday: true, completedDays: 12 },
    { id: "3", name: "Drink Water", icon: null, color: "#06B6D4", streak: 21, longestStreak: 45, completedToday: false, completedDays: 26 },
    { id: "4", name: "Write Code", icon: null, color: "#10B981", streak: 5, longestStreak: 8, completedToday: false, completedDays: 8 },
    { id: "5", name: "Meditate", icon: null, color: "#8B5CF6", streak: 0, longestStreak: 6, completedToday: false, completedDays: 3 }
  ];

  $: completedCount = habits.filter((habit) => habit.completedToday).length;
  $: totalHabits = habits.length;

  function toggleHabit(id: string) {
    habits = habits.map((habit) => {
      if (habit.id === id) {
        const completedToday = !habit.completedToday;
        return {
          ...habit,
          completedToday,
          streak: completedToday ? habit.streak + 1 : Math.max(0, habit.streak - 1),
          completedDays: completedToday ? habit.completedDays + 1 : habit.completedDays,
          longestStreak: Math.max(habit.longestStreak, completedToday ? habit.streak + 1 : habit.streak)
        };
      }
      return habit;
    });
  }

  // Heatmap data (90 days)
  let heatmapDays = Array.from({ length: 90 }, (_, i) => {
    const completed = Math.random() > 0.3;
    return {
      dayNum: i,
      completed,
      date: new Date(Date.now() - (90 - i) * 24 * 60 * 60 * 1000).toLocaleDateString()
    };
  });

  // Stack suggestions
  let stacks = [
    { habit1: "Workout", habit2: "Stretch", reason: "Prevent injury after workouts" },
    { habit1: "Write Code", habit2: "Coffee", reason: "Morning ritual for focus" },
    { habit1: "Read", habit2: "Sleep", reason: "Relaxation before bed" }
  ];

  // Weekly review
  let weekStats = {
    completionRate: 82,
    bestDay: 'Wednesday',
    bestHabit: 'Drink Water',
    thisWeek: 28,
    lastWeek: 24
  };

  function navigateToSection(section: string) {
    setModuleSection(moduleId, section, sectionLabels);
  }
</script>

<main class="habits-workspace module-root">
  <div class="habits-header">
    <h1>Habits</h1>
    <p class="habits-subtitle">Build streaks and track daily progress</p>
  </div>

  {#if selectedSection === 'Today'}
    <div class="habits-content">
      <div class="today-progress">
        <Card class="progress-card">
          <CardContent>
            <div class="progress-circle">
              <svg viewBox="0 0 100 100">
                <circle class="progress-bg" cx="50" cy="50" r="40"></circle>
                <circle 
                  class="progress-fill" 
                  cx="50" 
                  cy="50" 
                  r="40"
                  style={`stroke-dasharray: ${2 * Math.PI * 40}; stroke-dashoffset: ${2 * Math.PI * 40 * (1 - completedCount / totalHabits)};`}
                ></circle>
              </svg>
              <div class="progress-text">
                <span class="progress-num">{completedCount}/{totalHabits}</span>
                <span class="progress-label">Complete</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div class="habits-grid">
        {#each habits as habit (habit.id)}
          <Card 
            class="habit-card {habit.completedToday ? 'completed' : ''}"
            style={`--habit-color: ${habit.color}`}
          >
            <CardContent>
              <div class="habit-header">
                <span class="habit-name">{habit.name}</span>
                <button 
                  class="habit-checkbox"
                  on:click={() => toggleHabit(habit.id)}
                >
                  {#if habit.completedToday}
                    <Check size={20} />
                  {/if}
                </button>
              </div>
              <div class="habit-streak">
                <Flame size={16} />
                <span>{habit.streak}</span>
              </div>
            </CardContent>
          </Card>
        {/each}
      </div>

      <Button class="add-habit-btn">
        <Plus size={16} />
        Add Habit
      </Button>
    </div>

  {:else if selectedSection === 'Heatmap'}
    <div class="habits-content">
      <Card class="full-width">
        <CardHeader>
          <CardTitle>90-Day Activity Heatmap</CardTitle>
          <CardDescription>Completion patterns over time</CardDescription>
        </CardHeader>
        <CardContent class="heatmap-container">
          <div class="heatmap-grid">
            {#each heatmapDays as day}
              <div 
                class="heatmap-cell {day.completed ? 'active' : ''}"
                title={day.date}
              />
            {/each}
          </div>
          <div class="heatmap-legend">
            <span class="legend-text">Less</span>
            <div class="legend-cells">
              <div class="legend-cell" style="opacity: 0.2"></div>
              <div class="legend-cell" style="opacity: 0.4"></div>
              <div class="legend-cell" style="opacity: 0.6"></div>
              <div class="legend-cell" style="opacity: 0.8"></div>
              <div class="legend-cell" style="opacity: 1"></div>
            </div>
            <span class="legend-text">More</span>
          </div>
        </CardContent>
      </Card>

      <Card class="full-width">
        <CardHeader>
          <CardTitle>Habit Performance</CardTitle>
          <CardDescription>Completion rates per habit</CardDescription>
        </CardHeader>
        <CardContent class="performance-list">
          {#each habits as habit}
            <div class="performance-item">
              <div class="perf-info">
                <span class="perf-name">{habit.name}</span>
                <span class="perf-rate">{Math.round((habit.completedDays / 90) * 100)}% completion</span>
              </div>
              <div class="perf-bar">
                <div class="bar-fill" style={`width: ${(habit.completedDays / 90) * 100}%; background: ${habit.color}`}></div>
              </div>
              <span class="perf-count">{habit.completedDays}/90</span>
            </div>
          {/each}
        </CardContent>
      </Card>
    </div>

  {:else if selectedSection === 'Stacks'}
    <div class="habits-content">
      <Card class="full-width">
        <CardHeader>
          <CardTitle>Habit Stacking</CardTitle>
          <CardDescription>Combine habits to build stronger routines</CardDescription>
        </CardHeader>
        <CardContent class="stacks-list">
          {#each stacks as stack}
            <div class="stack-item">
              <div class="stack-habits">
                <div class="stack-habit habit1">{stack.habit1}</div>
                <div class="stack-plus">+</div>
                <div class="stack-habit habit2">{stack.habit2}</div>
              </div>
              <div class="stack-reason">{stack.reason}</div>
            </div>
          {/each}
          <button class="create-stack">
            <Plus size={16} />
            Create Stack
          </button>
        </CardContent>
      </Card>

      <Card class="full-width">
        <CardHeader>
          <CardTitle>Tips for Success</CardTitle>
          <CardDescription>Science-backed habit stacking principles</CardDescription>
        </CardHeader>
        <CardContent class="tips-list">
          <div class="tip-item">
            <span class="tip-num">1</span>
            <p>Attach new habits to existing ones you already do automatically</p>
          </div>
          <div class="tip-item">
            <span class="tip-num">2</span>
            <p>Start small—easier habits make it easier to build bigger streaks</p>
          </div>
          <div class="tip-item">
            <span class="tip-num">3</span>
            <p>Track visually—streaks are more motivating when you can see them grow</p>
          </div>
        </CardContent>
      </Card>
    </div>

  {:else if selectedSection === 'Review'}
    <div class="habits-content">
      <div class="review-stats">
        <Card class="stat-card">
          <CardContent>
            <span class="stat-label">This Week</span>
            <span class="stat-big">{weekStats.completionRate}%</span>
            <span class="stat-detail">Completion rate</span>
          </CardContent>
        </Card>
        <Card class="stat-card">
          <CardContent>
            <span class="stat-label">Completions</span>
            <span class="stat-big">{weekStats.thisWeek}</span>
            <span class="stat-detail">{weekStats.thisWeek - weekStats.lastWeek > 0 ? '+' : ''}{weekStats.thisWeek - weekStats.lastWeek} vs last week</span>
          </CardContent>
        </Card>
        <Card class="stat-card">
          <CardContent>
            <span class="stat-label">Best Day</span>
            <span class="stat-big">{weekStats.bestDay}</span>
            <span class="stat-detail">Most productive</span>
          </CardContent>
        </Card>
      </div>

      <Card class="full-width">
        <CardHeader>
          <CardTitle>Weekly Insights</CardTitle>
          <CardDescription>AI-generated analysis of your habits</CardDescription>
        </CardHeader>
        <CardContent class="insights-content">
          <div class="insight-item">
            <Zap size={16} />
            <p><strong>Your star habit:</strong> {weekStats.bestHabit} had 100% completion this week</p>
          </div>
          <div class="insight-item">
            <TrendingUp size={16} />
            <p><strong>You're on fire:</strong> Your completion rate improved by 8% compared to last week</p>
          </div>
          <div class="insight-item">
            <Flame size={16} />
            <p><strong>Momentum tip:</strong> Try stacking your lower-streak habits with your best ones</p>
          </div>
        </CardContent>
      </Card>

      <Card class="full-width">
        <CardHeader>
          <CardTitle>Next Week's Forecast</CardTitle>
          <CardDescription>Based on your patterns</CardDescription>
        </CardHeader>
        <CardContent class="forecast-content">
          <p>If you maintain your current streak, you'll hit:</p>
          <ul class="forecast-list">
            {#each habits as habit}
              {#if habit.streak > 5}
                <li>🎯 {habit.name}: {habit.streak + 7} day streak!</li>
              {/if}
            {/each}
          </ul>
        </CardContent>
      </Card>
    </div>

  {:else if selectedSection === 'Widgets'}
    <div class="habits-content">
      <Card class="full-width">
        <CardHeader>
          <CardTitle>Desktop Widgets</CardTitle>
          <CardDescription>Quick access to your habits</CardDescription>
        </CardHeader>
        <CardContent class="widgets-grid">
          <div class="widget-preview">
            <span class="widget-label">Daily Progress</span>
            <div class="widget-content">2/5 complete</div>
          </div>
          <div class="widget-preview">
            <span class="widget-label">Top Streak</span>
            <div class="widget-content">🔥 21</div>
          </div>
          <div class="widget-preview">
            <span class="widget-label">This Week</span>
            <div class="widget-content">82% done</div>
          </div>
        </CardContent>
      </Card>

      <Card class="full-width">
        <CardHeader>
          <CardTitle>Widget Settings</CardTitle>
          <CardDescription>Customize how habits appear</CardDescription>
        </CardHeader>
        <CardContent class="settings-list">
          <label class="setting-item">
            <input type="checkbox" checked />
            <span>Show streaks on home screen</span>
          </label>
          <label class="setting-item">
            <input type="checkbox" checked />
            <span>Daily completion notifications</span>
          </label>
          <label class="setting-item">
            <input type="checkbox" />
            <span>Show all habits vs completed only</span>
          </label>
        </CardContent>
      </Card>
    </div>

  {:else if selectedSection === 'Export'}
    <div class="habits-content">
      <Card class="full-width">
        <CardHeader>
          <CardTitle>Export Your Data</CardTitle>
          <CardDescription>Download habits and streaks in various formats</CardDescription>
        </CardHeader>
        <CardContent class="export-grid">
          <button class="export-card">
            <Download size={24} />
            <span class="export-name">Export as CSV</span>
            <span class="export-desc">Spreadsheet with all habit data</span>
          </button>
          <button class="export-card">
            <BarChart3 size={24} />
            <span class="export-name">Export Charts</span>
            <span class="export-desc">PNG images of heatmaps and graphs</span>
          </button>
          <button class="export-card">
            <Plus size={24} />
            <span class="export-name">Export as JSON</span>
            <span class="export-desc">Complete backup of all habits</span>
          </button>
        </CardContent>
      </Card>
    </div>
  {/if}
</main>

<style>
  .habits-app-v2 {
    display: flex;
    justify-content: center;
    min-height: 100%;
    background: var(--background);
    color: var(--foreground);
  }

  .ha-container {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 1.5rem;
    width: 100%;
    max-width: 72rem;
    padding: 2rem;
  }

  .ha-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
  }

  .ha-title {
    margin: 0;
    font-size: 2rem;
  }

  .ha-summary {
    color: var(--muted);
  }

  .ha-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
    gap: 1rem;
  }

  .ha-tile {
    position: relative;
    display: grid;
    gap: 0.875rem;
    min-height: 12rem;
    padding: 1.25rem;
    border: 1px solid var(--border);
    border-radius: 1.25rem;
    background: color-mix(in srgb, var(--surface) 94%, var(--background));
    cursor: pointer;
  }

  .ha-tile.completed {
    border-color: color-mix(in srgb, var(--habit-color) 44%, var(--border));
  }

  .ha-icon-wrapper {
    position: relative;
    display: grid;
    place-items: center;
    width: 4.5rem;
    height: 4.5rem;
    border-radius: 1.25rem;
    background: color-mix(in srgb, var(--habit-color) 20%, var(--surface));
    color: var(--habit-color);
  }

  .ha-check-overlay {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    border-radius: inherit;
    background: color-mix(in srgb, var(--habit-color) 85%, var(--surface));
    color: var(--background);
  }

  .ha-name {
    font-weight: 600;
  }

  .ha-streak {
    margin-top: auto;
    color: var(--muted);
    font-size: 0.875rem;
  }

  .ha-footer {
    display: flex;
    justify-content: flex-end;
  }

  .ha-add-btn {
    min-height: 2.75rem;
    padding: 0 1.125rem;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: color-mix(in srgb, var(--surface) 92%, var(--background));
    color: var(--foreground);
  }
</style>
