<script lang="ts">
  import { 
    Heart, Camera, BookOpen, Sparkles, Download, Plus, X, ChevronLeft, ChevronRight
  } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import {
    getModuleSectionLabel,
    setModuleSection,
    ensureModuleSection,
    moduleSectionStore,
  } from '$lib/stores/module-sections.store';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
  
  export let moduleId: string = 'journal';
  export let settings: any = {};
  void settings;

  const sectionLabels = ["Today", "Timeline", "Mood", "Photos", "Recap", "Export"] as const;
  $: selectedSection = getModuleSectionLabel($moduleSectionStore, moduleId, sectionLabels);

  onMount(() => {
    ensureModuleSection(moduleId, sectionLabels);
  });

  // Today's entry
  let todayDate = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric' 
  });

  const moods = [
    { id: 'awful', emoji: '😞', label: 'Awful', color: 'var(--destructive)' },
    { id: 'bad', emoji: '😕', label: 'Bad', color: 'color-mix(in srgb, var(--destructive) 82%, var(--foreground))' },
    { id: 'okay', emoji: '😐', label: 'Okay', color: 'var(--muted)' },
    { id: 'good', emoji: '🙂', label: 'Good', color: 'var(--primary)' },
    { id: 'great', emoji: '😊', label: 'Great', color: 'var(--accent)' }
  ];

  let selectedMood = 'good';
  let todayNote = 'Had a productive morning, great focus session. Met with the team about upcoming project. Evening was relaxing with a good book.';
  let isSaving = false;

  // Timeline (past entries)
  let entries = [
    { date: 'May 13, 2026', mood: 'great', preview: 'Productive day, great focus...', activities: ['Work', 'Exercise'] },
    { date: 'May 12, 2026', mood: 'good', preview: 'Normal day, got things done...', activities: ['Work', 'Friends'] },
    { date: 'May 11, 2026', mood: 'okay', preview: 'Busy day, lots meetings...', activities: ['Work'] },
    { date: 'May 10, 2026', mood: 'great', preview: 'Excellent progress on project...', activities: ['Work', 'Creative'] },
    { date: 'May 9, 2026', mood: 'good', preview: 'Good workout session...', activities: ['Exercise', 'Sleep'] },
  ];

  // Mood calendar (year in pixels)
  let moodStats = {
    great: 12,
    good: 15,
    okay: 8,
    bad: 2,
    awful: 0
  };
  let moodStreak = 8;

  // Photo gallery
  let photos = [
    { date: 'May 13', title: 'Morning coffee', size: '2.4 MB' },
    { date: 'May 12', title: 'Workspace setup', size: '3.1 MB' },
    { date: 'May 11', title: 'Sunset from office', size: '2.8 MB' },
    { date: 'May 10', title: 'Team lunch', size: '3.5 MB' },
    { date: 'May 9', title: 'Evening run', size: '2.1 MB' },
    { date: 'May 8', title: 'Project whiteboard', size: '2.9 MB' }
  ];

  // AI Recap
  let recap = {
    summary: 'This week you had predominantly positive days with 5 great or good mood entries. Your most frequent activities were work (100% of days) and exercise (40% of days). Photos captured 6 moments, suggesting an active documentation habit.',
    patterns: [
      'You tend to feel great on days with morning workouts',
      'Creative activities correlate with higher mood',
      'Evening reading sessions precede better sleep'
    ],
    insights: [
      'Your exercise consistency is excellent—keep this up',
      'Consider scheduling more creative time in mornings',
      'Try capturing one photo daily for better memory retention'
    ]
  };

  function navigateToSection(section: string) {
    setModuleSection(moduleId, section, sectionLabels);
  }

  function saveToday() {
    isSaving = true;
    setTimeout(() => {
      isSaving = false;
    }, 800);
  }
</script>

<main class="journal-workspace module-root">
  <div class="journal-header-top">    <h1>Journal</h1>
    <p>Reflection and mood tracking</p>
  </div>

  {#if selectedSection === 'Today'}
    <div class="journal-content">
      <Card class="entry-card">
        <CardHeader>
          <CardTitle>{todayDate}</CardTitle>
          <CardDescription>How was your day?</CardDescription>
        </CardHeader>
        <CardContent class="entry-content">
          
          <div class="mood-section">
            <label class="mood-label">Today's Mood</label>
            <div class="mood-picker">
              {#each moods as mood}
                <button 
                  class="mood-option {selectedMood === mood.id ? 'active' : ''}"
                  on:click={() => selectedMood = mood.id}
                  title={mood.label}
                >
                  <span class="mood-emoji">{mood.emoji}</span>
                  <span class="mood-name">{mood.label}</span>
                </button>
              {/each}
            </div>
          </div>

          <div class="note-section">
            <label class="note-label">Reflections</label>
            <textarea
              bind:value={todayNote}
              placeholder="What happened today? How did you feel?"
              class="journal-textarea"
            ></textarea>
            <span class="char-count">{todayNote.length} / 2000</span>
          </div>

          <div class="entry-actions">
            <Button 
              onclick={saveToday}
              disabled={isSaving}
              class="save-btn"
            >
              {isSaving ? 'Saving...' : 'Save Entry'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>

  {:else if selectedSection === 'Timeline'}
    <div class="journal-content">
      <Card class="full-width">
        <CardHeader>
          <CardTitle>Your Journey</CardTitle>
          <CardDescription>Recent entries and reflections</CardDescription>
        </CardHeader>
        <CardContent class="timeline-list">
          {#each entries as entry}
            <div class="timeline-item">
              <div class="timeline-dot" style={`background: ${moods.find(m => m.id === entry.mood)?.color || 'var(--muted)'}`}></div>
              <div class="timeline-content">
                <div class="timeline-header">
                  <span class="timeline-date">{entry.date}</span>
                  <span class="timeline-mood">{moods.find(m => m.id === entry.mood)?.emoji} {moods.find(m => m.id === entry.mood)?.label}</span>
                </div>
                <p class="timeline-preview">{entry.preview}</p>
                <div class="timeline-activities">
                  {#each entry.activities as activity}
                    <span class="activity-tag">{activity}</span>
                  {/each}
                </div>
              </div>
            </div>
          {/each}
        </CardContent>
      </Card>
    </div>

  {:else if selectedSection === 'Mood'}
    <div class="journal-content">
      <div class="mood-stats-grid">
        <Card class="stat-card">
          <CardContent>
            <span class="stat-label">Current Streak</span>
            <span class="stat-value">{moodStreak} days</span>
            <span class="stat-detail">Keep the momentum going!</span>
          </CardContent>
        </Card>
        {#each Object.entries(moodStats) as [moodId, count]}
          {@const mood = moods.find(m => m.id === moodId)}
          {#if mood}
            <Card class="stat-card">
              <CardContent>
                <span class="stat-label">{mood.label}</span>
                <span class="stat-value" style={`color: ${mood.color}`}>{count}</span>
                <span class="stat-detail">This month</span>
              </CardContent>
            </Card>
          {/if}
        {/each}
      </div>

      <Card class="full-width">
        <CardHeader>
          <CardTitle>Mood Calendar</CardTitle>
          <CardDescription>May 2026 in a glance</CardDescription>
        </CardHeader>
        <CardContent class="mood-calendar">
          <div class="calendar-grid">
            {#each Array(31) as _, day}
              {@const dayNum = day + 1}
              {@const dayMood = day < 15 ? moods[Math.floor(Math.random() * moods.length)] : null}
              <div 
                class="calendar-day {dayNum === 13 ? 'today' : ''}"
                style={dayMood ? `background: ${dayMood.color}` : 'background: var(--muted-surface)'}
              >
                <span class="day-num">{dayNum}</span>
                {#if dayMood && dayNum < 14}
                  <span class="day-emoji">{dayMood.emoji}</span>
                {/if}
              </div>
            {/each}
          </div>
        </CardContent>
      </Card>
    </div>

  {:else if selectedSection === 'Photos'}
    <div class="journal-content">
      <Card class="full-width">
        <CardHeader>
          <CardTitle>Photo Gallery</CardTitle>
          <CardDescription>Moments captured with your journal</CardDescription>
        </CardHeader>
        <CardContent class="photo-gallery">
          <div class="gallery-grid">
            {#each photos as photo}
              <div class="photo-item">
                <div class="photo-placeholder">
                  <Camera size={32} style="opacity: 0.4" />
                </div>
                <div class="photo-info">
                  <span class="photo-title">{photo.title}</span>
                  <span class="photo-meta">{photo.date} · {photo.size}</span>
                </div>
              </div>
            {/each}
            <button class="upload-button">
              <Plus size={32} />
              <span>Add Photo</span>
            </button>
          </div>
        </CardContent>
      </Card>
    </div>

  {:else if selectedSection === 'Recap'}
    <div class="journal-content">
      <Card class="recap-card">
        <CardHeader>
          <CardTitle>Weekly Recap</CardTitle>
          <CardDescription>AI-generated insights from your entries</CardDescription>
        </CardHeader>
        <CardContent class="recap-content">
          <div class="recap-summary">
            <Sparkles size={16} style="opacity: 0.6" />
            <p>{recap.summary}</p>
          </div>

          <div class="recap-section">
            <h4 class="recap-title">Patterns Detected</h4>
            <ul class="recap-list">
              {#each recap.patterns as pattern}
                <li>{pattern}</li>
              {/each}
            </ul>
          </div>

          <div class="recap-section">
            <h4 class="recap-title">Suggestions</h4>
            <ul class="recap-list">
              {#each recap.insights as insight}
                <li>{insight}</li>
              {/each}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>

  {:else if selectedSection === 'Export'}
    <div class="journal-content">
      <Card class="full-width">
        <CardHeader>
          <CardTitle>Export Your Journal</CardTitle>
          <CardDescription>Download your entries in various formats</CardDescription>
        </CardHeader>
        <CardContent class="export-section">
          <div class="export-options">
            <button class="export-card">
              <BookOpen size={24} />
              <span class="export-title">PDF Report</span>
              <span class="export-desc">Beautiful formatted journal with photos</span>
            </button>
            <button class="export-card">
              <Download size={24} />
              <span class="export-title">JSON Backup</span>
              <span class="export-desc">Full data export for backup or import</span>
            </button>
            <button class="export-card">
              <Heart size={24} />
              <span class="export-title">Mood Data CSV</span>
              <span class="export-desc">Spreadsheet of mood entries</span>
            </button>
          </div>
          
          <Card class="privacy-notice">
            <CardContent>
              <p class="privacy-text">Your journal data is encrypted and stored locally only. Exports are for your personal use and are not sent anywhere.</p>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  {/if}
</main>
<style>
.journal-app-container {
  height: 100%;
  padding: 32px 40px;
  position: relative;
  color: var(--text-primary, #F9FAFB);
  overflow-y: auto;
  overflow-x: hidden;
}

.fade-in {
  animation: fadeIn 0.3s ease;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.journal-header {
  text-align: center;
  margin-bottom: 40px;
}
.journal-header h1 {
  font-size: 24px;
  font-weight: 600;
  margin: 0 0 8px;
}
.journal-date {
  font-size: 15px;
  color: var(--text-secondary, #9CA3AF);
  margin: 0;
}

/* Mood Picker */
.mood-picker {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 48px;
  padding: 0 16px;
}

.mood-btn {
  background: transparent;
  border: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  opacity: 0.6;
}

.mood-emoji {
  font-size: 40px;
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.mood-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary, #9CA3AF);
  transition: color 0.2s;
}

.mood-btn:hover {
  opacity: 0.8;
  transform: scale(1.1);
}

.mood-btn.active {
  opacity: 1;
}
.mood-btn.active .mood-emoji {
  font-size: 56px;
  width: 80px;
  height: 80px;
  box-shadow: 0 0 0 4px var(--mood-color), 0 8px 24px rgba(0,0,0,0.2);
  background: rgba(255,255,255,0.05); /* Slight fill so it pops against shadow */
}
.mood-btn.active .mood-label {
  color: var(--mood-color);
  font-weight: 700;
}

/* Activities Grid */
.section-title {
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 700;
  color: var(--text-secondary, #9CA3AF);
  margin-bottom: 16px;
}

.activities-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 12px;
  margin-bottom: 40px;
}

.activity-tile {
  background: var(--bg-elevated, rgba(255, 255, 255, 0.03));
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.05));
  border-radius: 16px;
  height: 80px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-secondary, #9CA3AF);
  cursor: pointer;
  transition: all 0.2s;
}

.activity-tile span {
  font-size: 12px;
  font-weight: 500;
}

.activity-tile:hover {
  background: var(--bg-hover, rgba(255, 255, 255, 0.06));
  color: var(--text-primary, white);
}

.activity-tile.selected {
  background: #818CF8; /* Journal accent from registry */
  border-color: #818CF8;
  color: white;
  transform: scale(0.95); /* Little pop effect */
  box-shadow: 0 4px 12px rgba(129, 140, 248, 0.3);
}

.custom-tile {
  border-style: dashed;
}

/* Notes Field */
.note-section {
  margin-bottom: 120px;
}

.journal-note-input {
  width: 100%;
  min-height: 80px;
  max-height: 160px;
  background: var(--bg-elevated, rgba(255, 255, 255, 0.03));
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.05));
  border-radius: 16px;
  padding: 16px;
  color: var(--text-primary, white);
  font-size: 15px;
  font-family: inherit;
  resize: vertical;
  transition: border-color 0.2s;
}
.journal-note-input:focus {
  outline: none;
  border-color: #818CF8;
}

/* Save Button */
.journal-save-btn {
  position: absolute;
  bottom: 40px;
  left: 40px;
  right: 40px;
  height: 56px;
  background: var(--bg-surface, rgba(255, 255, 255, 0.1));
  color: rgba(255, 255, 255, 0.4);
  border: none;
  border-radius: 28px;
  font-size: 16px;
  font-weight: 600;
  cursor: not-allowed;
  transition: all 0.3s;
}

.journal-save-btn.ready {
  background: #818CF8;
  color: white;
  cursor: pointer;
  box-shadow: 0 8px 24px rgba(129, 140, 248, 0.4);
}
.journal-save-btn.ready:hover {
  background: #6366F1;
  transform: translateY(-2px);
}

/* Calendar View */
.calendar-view {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.calendar-header {
  display: flex;
  justify-content: space-between;
  width: 100%;
  align-items: center;
}

.back-btn {
  background: transparent;
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.2));
  color: var(--text-secondary, #9CA3AF);
  padding: 8px 16px;
  border-radius: 99px;
  cursor: pointer;
  font-size: 14px;
}
.back-btn:hover {
  color: white;
  border-color: white;
}

.pixel-calendar-container {
  width: 100%;
  max-width: 400px;
  margin: 20px auto 40px;
}

.month-pixels {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
}

.pixel-day {
  aspect-ratio: 1;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: transform 0.2s;
  cursor: pointer;
}
.pixel-day:hover {
  transform: scale(1.1);
  z-index: 10;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}

.pixel-day-num {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  opacity: 0;
  transition: opacity 0.2s;
}
.pixel-day:hover .pixel-day-num {
  opacity: 1;
  color: white;
  mix-blend-mode: overlay;
  font-weight: bold;
}

.pixel-day.is-today {
  border: 2px solid white;
}

.mood-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  justify-content: center;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-secondary, #9CA3AF);
}
.legend-color {
  width: 12px;
  height: 12px;
  border-radius: 4px;
}

/* Current journal layout */
.journal-workspace {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  width: 100%;
  padding: 32px 32px 40px;
  gap: 24px;
  overflow-y: auto;
  overflow-x: hidden;
  box-sizing: border-box;
  scrollbar-width: thin;
  scrollbar-color: var(--shell-scrollbar-thumb) var(--shell-scrollbar-track);
}

.journal-workspace::-webkit-scrollbar {
  width: var(--shell-scrollbar-size);
}

.journal-workspace::-webkit-scrollbar-track {
  background: var(--shell-scrollbar-track);
}

.journal-workspace::-webkit-scrollbar-thumb {
  border: 0.08rem solid transparent;
  border-radius: 999px;
  background-clip: padding-box;
  background: var(--shell-scrollbar-thumb);
}

.journal-workspace::-webkit-scrollbar-thumb:hover {
  background: var(--shell-scrollbar-thumb-hover);
  background-clip: padding-box;
}

.journal-header-top {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--border);
}

.journal-header-top h1 {
  margin: 0;
  font-size: clamp(2rem, 2.8vw, 2.9rem);
  line-height: 1.05;
  letter-spacing: -0.04em;
}

.journal-subtitle {
  margin: 0;
  color: var(--muted);
  font-size: 1rem;
}

.journal-content {
  display: grid;
  gap: 24px;
}

.journal-content .full-width,
.journal-content .entry-card,
.journal-content .recap-card {
  border-color: var(--border);
  border-radius: 24px;
  background: color-mix(in srgb, var(--surface) 96%, var(--background));
}

.entry-content,
.recap-content,
.export-section,
.timeline-list,
.photo-gallery,
.mood-calendar {
  display: grid;
  gap: 20px;
}

.entry-content {
  padding-top: 0;
}

.mood-section,
.note-section {
  display: grid;
  gap: 12px;
}

.mood-label,
.note-label {
  color: var(--muted);
  font-size: 0.9rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.mood-picker {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}

.mood-option {
  display: grid;
  justify-items: center;
  gap: 10px;
  padding: 16px 12px;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: var(--surface);
  color: var(--foreground);
  cursor: pointer;
  transition: transform 0.18s ease, border-color 0.18s ease, background 0.18s ease;
}

.mood-option:hover {
  transform: translateY(-1px);
  border-color: var(--primary);
}

.mood-option.active {
  border-color: var(--primary);
  background: color-mix(in srgb, var(--primary) 10%, var(--surface));
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.08);
}

.mood-option.active .mood-name {
  color: var(--foreground);
}

.mood-emoji {
  font-size: 2rem;
  line-height: 1;
}

.mood-name {
  font-size: 0.92rem;
  color: var(--muted);
  font-weight: 600;
}

.journal-textarea {
  width: 100%;
  min-height: 180px;
  resize: vertical;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: var(--surface);
  color: var(--foreground);
  padding: 18px 20px;
  font: inherit;
  line-height: 1.6;
}

.journal-textarea:focus {
  outline: 2px solid color-mix(in srgb, var(--primary) 45%, transparent);
  outline-offset: 2px;
}

.char-count {
  justify-self: end;
  color: var(--muted);
  font-size: 0.85rem;
}

.entry-actions {
  display: flex;
  justify-content: flex-end;
}

.save-btn {
  min-width: 160px;
}

.timeline-list {
  gap: 16px;
}

.timeline-item {
  display: grid;
  grid-template-columns: 12px minmax(0, 1fr);
  gap: 16px;
  align-items: start;
  padding: 18px 20px;
  border: 1px solid var(--border);
  border-radius: 20px;
  background: var(--surface);
}

.timeline-dot {
  width: 12px;
  height: 12px;
  margin-top: 6px;
  border-radius: 999px;
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--foreground) 6%, transparent);
}

.timeline-content {
  display: grid;
  gap: 10px;
}

.timeline-header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px;
}

.timeline-date,
.timeline-mood,
.timeline-preview,
.photo-meta,
.recap-list,
.privacy-text {
  color: var(--muted);
}

.timeline-mood {
  font-weight: 600;
}

.timeline-preview {
  margin: 0;
  line-height: 1.6;
}

.timeline-activities,
.export-options,
.gallery-grid,
.mood-stats-grid {
  display: grid;
  gap: 14px;
}

.timeline-activities {
  grid-template-columns: repeat(auto-fit, minmax(96px, max-content));
}

.activity-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--muted-surface) 72%, var(--surface));
  color: var(--foreground);
  font-size: 0.85rem;
}

.mood-stats-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.stat-card {
  border-color: var(--border);
  border-radius: 20px;
  background: var(--surface);
}

.stat-card :global(.card-content) {
  display: grid;
  gap: 8px;
}

.stat-label {
  color: var(--muted);
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.stat-value {
  font-size: 1.8rem;
  font-weight: 700;
  line-height: 1;
}

.stat-detail {
  color: var(--muted);
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 12px;
}

.calendar-day {
  position: relative;
  display: grid;
  place-items: start;
  min-height: 104px;
  padding: 14px;
  border-radius: 18px;
  color: var(--foreground);
  overflow: hidden;
}

.calendar-day.today {
  outline: 2px solid var(--foreground);
  outline-offset: -2px;
}

.day-num {
  position: relative;
  z-index: 1;
  font-size: 0.85rem;
  font-weight: 700;
}

.day-emoji {
  position: absolute;
  right: 12px;
  bottom: 12px;
  z-index: 1;
  font-size: 1.05rem;
}

.photo-gallery {
  gap: 16px;
}

.gallery-grid {
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

.photo-item,
.upload-button,
.export-card,
.privacy-notice {
  border: 1px solid var(--border);
  border-radius: 20px;
  background: var(--surface);
}

.photo-item {
  display: grid;
  gap: 12px;
  padding: 14px;
}

.photo-placeholder {
  min-height: 120px;
  display: grid;
  place-items: center;
  border-radius: 16px;
  background: var(--muted-surface);
  color: var(--muted);
}

.photo-info {
  display: grid;
  gap: 4px;
}

.photo-title,
.export-title {
  font-weight: 700;
}

.upload-button {
  display: grid;
  place-items: center;
  gap: 10px;
  min-height: 100%;
  padding: 18px;
  color: var(--foreground);
  cursor: pointer;
}

.recap-summary {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 16px 18px;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: var(--surface);
}

.recap-section {
  display: grid;
  gap: 10px;
}

.recap-title {
  margin: 0;
  font-size: 0.95rem;
}

.recap-list {
  margin: 0;
  padding-left: 18px;
  line-height: 1.7;
}

.export-options {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.export-card {
  display: grid;
  gap: 10px;
  padding: 20px;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.export-desc {
  color: var(--muted);
  font-size: 0.92rem;
}

.privacy-notice {
  border-style: dashed;
}

.privacy-notice :global(.card-content) {
  padding: 0;
}

@media (max-width: 1100px) {
  .mood-stats-grid,
  .export-options {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .calendar-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .journal-workspace {
    padding: 24px 18px 32px;
  }

  .mood-picker,
  .mood-stats-grid,
  .export-options,
  .calendar-grid,
  .gallery-grid {
    grid-template-columns: 1fr;
  }

  .timeline-header {
    flex-direction: column;
  }
}
</style>


