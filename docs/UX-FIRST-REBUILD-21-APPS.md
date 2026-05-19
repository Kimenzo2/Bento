# UX-FIRST REBUILD: ALL 21 APPS

## Research-Backed. Zero Decoration. Pure UX Value.

---

## THE RULE THAT GOVERNS ALL 21 APPS

Before writing a single component, understand this:

Every successful productivity app in the App Store is built on ONE truth:
**Users open the app to DO something, not to SEE something.**

The first screen is never a dashboard full of stats.
The first screen is the thing the user came to do.
Stats, charts, and analytics are secondary screens — rewards for people who stay.

The primary action must be reachable in zero taps from launch.
Meaning: the input field, the button, the check — it is already there when the app opens.

This is why Todoist opens on Today's tasks.
This is why Streaks opens on the habits circle grid.
This is why Daylio opens directly on the mood picker.
This is why YNAB opens on your budget categories.

None of them open on a dashboard. Dashboards are for managers. Your users are people.

---

## APP 1: TASKS

**UX Truth (from Todoist/TickTick research):**
Users open this app because they need to remember something or check what's due today.
The #1 loved feature across all task apps: natural language input.
Type "dentist Friday 3pm" and it creates the task with date and time automatically.
90% of daily use is: add task, check off task, view today.
Nobody is browsing "Total Projects: 24" stats on a Monday morning.

**First Screen Must Show:**

- Today's tasks listed immediately, nothing else above the fold
- A single large input bar at the top: "What needs to be done?" with cursor blinking
- Each task has a circle checkbox left, task name, optional due time right
- Overdue tasks appear at top in red
- Completed tasks collapse to bottom with strikethrough

**Primary Action:** Type a task and press Enter. Done in 2 seconds.

**Secondary Screens (reachable from sidebar):**

- Upcoming (next 7 days)
- All Projects
- Filters & Labels
- Analytics (only here, not on home)

**AGENT PROMPT — APP 1: TASKS**

```
Rebuild the Tasks app first screen from scratch with this exact UX:

FIRST SCREEN LAYOUT:
- Full white (#FFFFFF) or dark (#0f0f0f) background — no shell chrome visible
- Top: Date label "Monday, May 11" left, "12 tasks today" right in gray
- Immediately below: Large input bar full width, placeholder "Add a task...",
  natural language hint below it "Try: 'call mom tomorrow 3pm'"
- Below input: Today's task list
  - Each row: 24px circle checkbox left (green stroke, fills on check),
    task title, optional time badge right (pill shape)
  - Overdue tasks: red left border, red time badge
  - Completed: strikethrough, 50% opacity, moved to bottom
- Sidebar (left, 220px): Today (active), Upcoming, Inbox, Projects list,
  Labels, Settings at bottom — clean, no icons needed, just text + count badge
- NO stat cards. NO project analytics. NO team collaboration section.
  Those belong in a separate Analytics screen accessible from sidebar.
- Color: Green accent #22C55E for checkboxes and active states only
- Typography: Inter or DM Sans, task titles 15px regular, section headers 11px
  uppercase gray tracking-widest
- When user checks a task: circle fills green, title strikes through,
  row slides down to completed section — CSS transition 200ms ease
```

---

## APP 2: NOTES

**UX Truth (from Apple Notes/Bear/Obsidian research):**
Users open Notes because they have something to capture RIGHT NOW.
Every second between opening the app and having a blank page to type is a second
they might forget what they were thinking.
The fastest notes apps win. Apple Notes dominates because it opens instantly to a blank note.
Bear dominates premium because markdown is instant and beautiful.
90% of daily use: write a new note or find an old one.
Nobody is looking at a kanban board of their notes.

**First Screen Must Show:**

- Note list on the left (30% width), blank/last note open on right (70% width)
- Search bar at top of note list — always visible, always focused on Cmd+F
- New note button (+) — large, obvious, top right of note list
- The writing area: pure white or pure dark, one font, cursor blinking, ready to type
- No formatting toolbar visible until user selects text (then it appears above selection)

**Primary Action:** Cmd+N → blank note → type. Nothing in the way.

**AGENT PROMPT — APP 2: NOTES**

```
Rebuild Notes app with this exact UX:

LAYOUT: Two-panel split — left 280px note list, right fills remaining width editor

LEFT PANEL:
- Search bar top, always visible, "Search notes..." placeholder
- "+ New Note" button below search, full width, green or accent fill
- Note list below: each item shows title (bold, 14px), preview text (gray, 12px,
  1 line), date right-aligned (gray, 11px)
- Active note has left accent border + light bg tint
- Folders section below list: collapsible, All Notes, Favorites, Trash

RIGHT PANEL (editor):
- Pure background — no toolbar, no chrome
- Title field top: 28px bold, placeholder "Title"
- Body field below: 15px, line-height 1.7, placeholder "Start writing..."
- Toolbar ONLY appears on text selection, floating above selection:
  Bold, Italic, Link, H1, H2, Code, Highlight — 7 buttons, pill shape
- Bottom bar (fixed): word count left, last saved right, nothing else
- Cmd+K = insert link, Cmd+B = bold — keyboard shortcuts work
- No sidebar sections about tags, backlinks, graph view on first screen
  Those are advanced — put them behind a "..." menu in the note header
```

---

## APP 3: HABITS

**UX Truth (from Streaks Apple Design Award research):**
Streaks won Apple's Design Award specifically for this: habits are displayed as BIG CIRCLES.
One circle per habit. Tap and hold to mark done. That is the entire interaction.
Users open this app once per day, usually morning or evening.
They scan which circles are empty and fill them.
The streak number is the most motivating element — do not hide it.
The GitHub-style contribution heatmap (year in pixels) is what users love to look at
after 30 days. It's the reward for consistency.

**First Screen Must Show:**

- Grid of habit circles — 2 or 3 per row, large (100px minimum)
- Each circle: habit icon center, habit name below, streak number small bottom-right
- Completed today: filled with accent color
- Not done: empty ring, white or dark fill
- Tap to mark done — circle fills with satisfying animation (this is the ONE animation allowed)
- Today's date and completion count at very top: "3 of 6 done today"

**Primary Action:** Tap a circle. Done.

**AGENT PROMPT — APP 3: HABITS**

```
Rebuild Habits app with this exact UX. This is the most important app to get right visually.

FIRST SCREEN:
- Background: dark #111318 or light #F9FAFB — user's theme choice
- Top: "Monday" large left, "3 / 6 done" right in muted color
- Main area: CSS Grid, 2 columns, large habit circles
- Each habit tile (160px × 160px, rounded 24px):
  - Center: Lucide icon at 36px (user-chosen per habit)
  - Below icon: habit name 13px semibold
  - Bottom right corner: streak number + flame emoji "🔥 14"
  - State INCOMPLETE: border 2px solid #333, background transparent
  - State COMPLETE: background filled with habit's accent color (each habit
    has its own color set on creation), icon turns white, checkmark overlay
  - Tap: instant fill — no delay, no loading. CSS transition 300ms spring.
- Bottom bar: "+ Add Habit" button, centered, pill shape
- NO calendar grid on home screen. NO stats. NO analytics charts.
  These live in a "Stats" tab reachable from top nav tabs:
  [Today] [Stats] [Settings]
- Stats tab shows: streak calendar heatmap (year in pixels style),
  completion rate chart per habit, longest streak record
```

---

## APP 4: FOCUS TIMER

**UX Truth (from Forest/Focus@Will research):**
The Forest app has 10M+ downloads. Why? One screen. Start a timer. A tree grows.
Users open focus apps because they are ABOUT to work and need to commit.
The timer must be the hero — full screen, large, impossible to miss.
Secondary: ambient sounds (huge feature — Forest, Brain.fm, and Endel all prove this)
The session log (history) is what users check at end of day to feel proud.

**First Screen Must Show:**

- Large circular timer in center — takes up 40% of screen height
- Current mode label: "Focus" or "Break" above it
- Time remaining: huge digits, 72px minimum
- Start/Pause button below — large, can't miss it
- Session type selector above timer: 25min / 45min / 60min / Custom (pill tabs)
- Ambient sound row below button: Rain, Cafe, Forest, Fire, Space — icon pills

**Primary Action:** Hit Start. Everything else is secondary.

**AGENT PROMPT — APP 4: FOCUS TIMER**

```
Rebuild Focus Timer with this exact UX:

FIRST SCREEN — the timer IS the app:
- Background: deep dark #0A0A0F — this app should feel calm and serious
- Center: Large circular progress ring (300px diameter)
  - Track: 2px stroke, #1a1a2e
  - Progress: 4px stroke, white or soft blue #818CF8, animates as time passes
  - Center text: time remaining "24:35" in 64px monospace font (JetBrains Mono)
  - Below time: mode label "FOCUS SESSION" 11px uppercase tracking-widest gray
- Above ring: session length pill tabs — [25 min] [45 min] [60 min] [Custom]
  Active tab: white bg, dark text. Inactive: transparent, gray text.
- Below ring: Start button — large pill 200px wide, white bg, dark text "Start Focus"
  When running: shows Pause | Stop as two pills
- Below button: ambient sounds row — horizontal scroll
  Each sound: circle icon (Rain 🌧, Café ☕, Forest 🌲, Fire 🔥, Space 🌌)
  Tap to activate, tap active to stop — no volume slider on home screen
- Top right corner: streak "🔥 5 days" small badge — that is all
- Session history accessible via top-left back/history icon — NOT on home screen
- NO bar charts on home screen. NO weekly stats. NO task list.
  This app does ONE thing: run a focus session. Everything else is a distraction.
```

---

## APP 5: HEALTH TRACKER

**UX Truth (from MyFitnessPal/Samsung Health research):**
Users open health apps primarily to LOG something — a workout, their weight, calories.
The second reason: check today's progress against goal.
MyFitnessPal's most opened screen is the food diary — not the dashboard.
The dashboard exists to give a daily summary. But the ENTRY point is logging.
Quick log must be one tap from the home screen.

**First Screen Must Show:**

- Today's summary ring or bar at top (calories, steps, water — 3 rings)
- Below: today's log — meals and workouts listed chronologically
- Large "+ Log" FAB button bottom right — always visible
- Tapping + shows: Log Workout, Log Weight, Log Water, Log Meal (4 large tiles)

**AGENT PROMPT — APP 5: HEALTH TRACKER**

```
Rebuild Health Tracker first screen:

LAYOUT:
- Background: dark #111318, cards #1C2128
- Top: "Hello [Name]" + today's date
- Three progress rings side by side (each 90px):
  Calories remaining (green), Steps today (blue), Water (cyan)
  Under each ring: number + label
- Below rings: Today's Activity Log — chronological list
  Each entry: category icon left (workout/meal/weight), entry name,
  value right (calories/kg/L), time stamp small gray
- If log is empty: illustrated empty state "Nothing logged yet today"
  with "Start Logging" button — not just gray placeholder text
- Bottom right: FAB "+" lime green circle, always floating
  Tap → bottom sheet rises with 4 large tiles:
  [🏃 Workout] [🍎 Meal] [💧 Water] [⚖️ Weight]
  Each tile: icon + label, accent color bg, taps open that specific log form
- NO complex dashboard stats on home. Weekly/monthly charts live in
  "Progress" tab (top nav tab alongside "Today" and "Goals")
```

---

## APP 6: BUDGET

**UX Truth (from YNAB research — 205,000 subreddit members, 4.8 App Store):**
YNAB's core philosophy: give every dollar a job.
Users open it to log a transaction or check how much is left in a category.
The first screen must answer: "Can I afford this?"
Category list with remaining amounts is the most important screen in any budget app.
92% of YNAB users report less financial stress — because they SEE their categories.

**First Screen Must Show:**

- Budget categories in a list: Rent, Food, Transport, Entertainment, etc.
- Each category: name left, "€124 left" right, thin progress bar below
- Categories grouped: Essentials / Lifestyle / Savings
- Top: "Ready to assign: €340" — money not yet assigned to a category
- Quick "+" to log a transaction always visible

**AGENT PROMPT — APP 6: BUDGET**

```
Rebuild Budget app first screen:

LAYOUT: Clean white #FFFFFF or dark #0f0f0f. Minimal. Money is serious.
- Top bar: Current month "May 2026" center, prev/next arrows, settings right
- Banner below top bar: "💰 €340 to assign" — amber bg if money waiting,
  green if fully assigned. Tappable — opens assignment screen.
- Category list (main content, scrollable):
  Group headers: ESSENTIALS / LIFESTYLE / SAVINGS / DEBT
  Each category row:
  - Category name left (bold 15px)
  - Remaining amount right (green if positive, red if overspent)
  - Thin progress bar full width below name: green fill = spent, gray = remaining
  - Tapping a category opens transaction list for that category
- Bottom: total summary bar — Assigned / Spent / Remaining in 3 columns
- FAB bottom right: "Log Transaction" — always visible
  Opens form: Amount (large number input), Category (picker), Note (optional),
  Date (defaults to today) — 4 fields, nothing else
- NO revenue charts. NO venn diagrams. NO complex analytics on home.
  Analytics in a separate "Reports" tab showing: spending by category pie,
  monthly comparison line, net worth over time
```

---

## APP 7: JOURNAL / DIARY

**UX Truth (from Daylio 50M+ downloads research):**
Daylio is the most successful journal app on mobile. Why? 2 taps to log your day.
Tap 1: pick your mood (5 emoji options, large, visual)
Tap 2: tap activities you did (icons: Exercise, Work, Friends, Food, etc.)
Optional: add a note
Done in under 30 seconds.
The "Year in Pixels" mood calendar is the feature users screenshot and share.
Heavy writing journal apps have high churn. Quick capture journals have high retention.

**First Screen Must Show:**

- Today's date + greeting top
- Large mood picker: 5 faces from Very Bad to Very Good — the whole center of screen
- Activity icon grid below: 12-16 icons in a grid, tap to select multiple
- Note field below activities: "Add a note... (optional)"
- Save button at bottom

**AGENT PROMPT — APP 7: JOURNAL**

```
Rebuild Journal app. Daylio-inspired. Speed of entry is the ONLY metric.

FIRST SCREEN — daily entry form, always:
- Background: soft off-white #FAFAF8 or dark #0e0e14
- Top: "How was your day?" 22px, today's date below in gray
- MOOD PICKER — hero element, full width:
  5 large emoji circles in a row (60px each), evenly spaced:
  😞 😕 😐 🙂 😊 (or custom illustrated faces)
  Selected mood: scales up to 80px, colored ring appears around it
  Labels below each: "Awful / Bad / Okay / Good / Great"
- ACTIVITIES grid below mood (3 columns):
  Each activity: icon (Lucide) + label below, 70px tile
  Tap to select (fills with accent color), tap again to deselect
  Default activities: Work, Exercise, Friends, Family, Food, Reading,
  Gaming, Sleep, Outdoors, Creative, Shopping, Travel
  "+ Custom" tile at end of grid
- NOTE field below grid:
  Multiline text input, placeholder "Anything else? (optional)"
  Grows as user types, never taller than 120px (scrollable inside)
- SAVE button: full width, accent color, "Save Entry" text, bottom of screen
- After saving: transitions to CALENDAR view showing month grid
  Each day colored by mood — the Year in Pixels view
  This is the reward. User sees their month fill up with colors.
- Past entries tab: list of past entries, date + mood icon + note preview
- Stats tab: mood trend line chart, most common activities when in good mood (correlation)
```

---

## APP 8: FLASHCARDS / STUDY

**UX Truth (from Anki 20M+ users, Quizlet research):**
Anki's retention is legendary because of spaced repetition algorithm.
Users open study apps with one intent: review cards due today.
The number "47 cards due" is the most motivating or anxiety-inducing thing in the app.
The card flip is the core interaction — front shows question, tap/click to reveal answer,
then user rates: Again / Hard / Good / Easy.
Quizlet wins casual users because it's fast to create cards.
Anki wins serious users because the algorithm is superior.

**First Screen Must Show:**

- "X cards due today" — large, bold, front and center
- Start Review button — large, impossible to miss
- Deck list below (scrollable) showing each deck with due count

**AGENT PROMPT — APP 8: FLASHCARDS**

```
Rebuild Flashcards app:

FIRST SCREEN:
- Background: white or dark
- Hero section (top 40% of screen):
  Large number: "47" (cards due) in 72px bold
  Label below: "cards due today" in 18px gray
  Below that: "Start Review →" large CTA button, accent color
- Deck list below (remaining 60%):
  Each deck row: deck name, card count, due count badge (colored pill),
  last studied "2 days ago" gray small
  Tap deck → opens deck, shows only that deck's due cards
- Top right: "+" to create new deck or new card

REVIEW SCREEN (when user starts):
- Full screen card, centered
- Front: Question text, 22px, centered, line-height 1.6
  If has image: image above text
- "Tap to reveal" hint at bottom, gray small
- Tap anywhere → card flips (CSS 3D transform, 400ms)
- After flip: Answer revealed + 4 rating buttons appear at bottom:
  [Again] [Hard] [Good] [Easy]
  Colors: red / orange / green / blue
  Tapping a rating: card slides away left, next card appears from right
- Progress bar at very top: cards remaining in session
- "End Session" small link top-left only
```

---

## APP 9: READING TRACKER

**UX Truth (from Goodreads/StoryGraph research):**
Users open reading apps to: log pages just read, or update % complete.
The reading challenge ("Read 24 books this year") is the #1 engagement driver.
Finding next book to read (Want to Read shelf) is heavily used.
Stats people love: books read this year, pages per day average, reading streak.

**First Screen Must Show:**

- Currently reading book (cover + title + author + progress bar + "Update progress")
- Reading challenge: "8 of 24 books — 33%" progress ring
- Recently finished: last 3 book covers in a row

**AGENT PROMPT — APP 9: READING TRACKER**

```
Rebuild Reading Tracker:

FIRST SCREEN:
- Background: warm off-white #FAF8F5 (feels like paper) or dark #0f0d0b
- CURRENTLY READING section (hero):
  Book cover image left (80×120px, rounded 8px shadow)
  Right of cover: Title bold, Author gray, Genre tag pill
  Progress bar below: "Page 184 of 412" — 44%
  Below bar: "Update Progress" button + "Finished" link
  If multiple books: horizontal scroll of current reads
- READING CHALLENGE below:
  "2026 Reading Challenge" label
  Circular progress: "8 / 24" books large center
  "4 books ahead of schedule" green label OR "2 behind" red
- WANT TO READ below:
  Horizontal scroll of book covers, "View All (34)" link right
- Stats strip bottom: "14 day streak 🔥" | "8 books this year" | "284 pages/week"
- Bottom nav: [Reading] [Discover] [Stats] [Search]
- Search: type book title → shows results with "Add to Reading" / "Want to Read" / "Finished"
```

---

## APP 10: GOALS

**UX Truth (from Strides/Coach.me research):**
Goals apps succeed when they make progress visible and milestones feel real.
The failure of most goal apps: they're basically task managers with extra steps.
What works: the goal has a target, a deadline, and a progress log.
Weekly check-in is the sticky ritual — "How much progress did you make this week?"
The most loved feature: streaks and milestone celebrations.

**AGENT PROMPT — APP 10: GOALS**

```
Rebuild Goals app:

FIRST SCREEN:
- Background: off-white #F5F4F0 or dark
- "Your Goals" heading + "Week 19 of 52" small subtext
- Goal cards — each card (full width, 100px tall, rounded 16px):
  Goal title bold left, category icon right
  Progress bar full width: current / target with % label
  Below bar: "Last logged 2 days ago" gray OR "Updated today ✓" green
  Deadline: "47 days left" right-aligned small
- Cards sorted: overdue (red left border) first, then active, then completed
- FAB bottom right: "+" → opens New Goal form
  Form fields: Goal name, Target (number + unit), Deadline, Category, Icon
- Weekly Check-in prompt (shows Monday morning):
  Modal/card: "Time for your weekly check-in"
  For each active goal: "How much progress did you make?" + number input
  This is the most important UX moment — make it prominent, not buried
- Stats tab: goal completion rate, longest streak, year overview calendar
```

---

## APP 11: TIME TRACKER

**UX Truth (from Toggl 5M+ users research):**
Toggl's success = one-tap timer start. Description optional, added after.
Users open time tracker to start tracking RIGHT NOW — they're about to work.
The timer must be running within one tap of opening the app.
The weekly total (how many hours worked) is the most-checked stat.
Clients/projects are secondary — most users just track time, sort later.

**AGENT PROMPT — APP 11: TIME TRACKER**

```
Rebuild Time Tracker:

FIRST SCREEN:
- Background: clean white or dark
- TOP HERO: Current timer or "No active timer"
  If no timer: Large play button ▶ center top, "Start Timer" text
  Below: Text input "What are you working on?" — optional, can start without
  If timer running: elapsed time "01:24:38" large center (monospace 56px),
  task name below, Stop ■ and + Add button
- Today's time entries below (scrollable list):
  Each row: colored project dot, task name, duration right, time range small gray
  Daily total at top of list: "Today: 4h 32m"
- This week strip: Mon Tue Wed Thu Fri Sat Sun
  Each day: bar height proportional to hours, duration label on hover
  Current day highlighted
- Project list accessible from sidebar: each project with today's time + weekly total
- NO invoice features on home. NO team tracking. NO complex reports.
  Reports tab: weekly/monthly breakdown by project, client, tag
```

---

## APP 12: CALENDAR / PLANNER

**UX Truth (from Fantastical/Google Calendar research):**
Fantastical won App of Year for natural language event creation.
"Lunch with Sarah Thursday 1pm at Cafe Rouge" → creates event automatically.
Users check calendar for: what's next, what's today, what's this week.
The Week view is the most used view — not month, not day.
Quick add must be one tap + type.

**AGENT PROMPT — APP 12: CALENDAR**

```
Rebuild Calendar:

FIRST SCREEN — Week view by default:
- Top: Month + Year header, today's date highlighted
- Week strip below header: 7 columns (Mon-Sun), dates
  Today's column: accent color background pill
- Time grid below: hourly rows from 7am to 10pm
  Events as colored blocks in their time slot
  Event block: title + time range, truncated if small
- Floating "+" button bottom right — always visible
  Opens natural language input bar (full width, bottom of screen):
  "Lunch with Sarah Thursday 1pm Cafe Rouge"
  Parses → shows preview card → user confirms → added
- View switcher top right: [Day] [Week] [Month] toggle pills
- Event tap → bottom sheet slides up:
  Event title large, time, location, notes — edit icon top right
  No full-screen navigation for event detail
- Reminders section: small strip above the grid showing today's reminders
  (not calendar events — just reminder pills)
```

---

## APP 13: PASSWORD VAULT

**UX Truth (from 1Password/Bitwarden 10M+ users research):**
Users open password apps for ONE reason: they need a password right now.
Speed of finding and copying is the ONLY UX metric that matters.
Search must be instant and visible immediately on open.
The "copy password" action must be one tap from search result.
Biometric unlock (fingerprint/face) is non-negotiable — users won't type a master password every time.

**AGENT PROMPT — APP 13: PASSWORDS**

```
Rebuild Password Vault:

FIRST SCREEN — after biometric unlock:
- Background: deep dark #0D1117 — security should feel serious
- TOP: Large search bar, full width, focused automatically on open
  "Search passwords..." placeholder
  As user types: instant filtered results below (no submit needed)
- Below search (when empty): Recently used passwords — last 5 accessed
  Each row: site favicon (16px circle), site name bold, username gray,
  Copy icon button right (copies password to clipboard instantly)
  Tap row → opens detail
- Category pills: All / Login / Cards / Notes / Identity
  Horizontal scroll, below search when results not showing
- Full vault list below pills:
  Alphabetical, A-Z section headers
  Each entry: favicon, site name, username, copy icon
- Add button: "+" top right (not FAB — password apps are precise)
- Entry detail (tap any entry):
  Site name header, username (tap to copy), password (masked, tap to reveal then copy),
  URL (tap to open), Notes, Last modified
  Edit button top right
- NO complex dashboard. NO breach score on home screen.
  Security audit (weak/reused/breached passwords) in a "Security" tab
```

---

## APP 14: CLIPBOARD MANAGER

**UX Truth (from Raycast/Pasta clipboard manager research):**
Users open clipboard to find something they copied earlier.
Search is the #1 action — "I copied that thing 20 minutes ago, where is it?"
The list must be in reverse chronological order — most recent first.
One-click copy is mandatory. Pinning favorites is heavily used.
Privacy: sensitive items (passwords copied from vault) should auto-expire.

**AGENT PROMPT — APP 14: CLIPBOARD**

```
Rebuild Clipboard Manager:

FIRST SCREEN:
- Background: white #FAFAFA or dark
- Search bar top, full width, auto-focused on open, "Search clipboard..."
- Clip list below (main content):
  Reverse chronological — most recent first
  Each clip row (56px height):
  - Left: type icon (text/image/link/code) in colored 32px circle
  - Center: preview of content (text truncated to 1 line, image thumbnail, URL)
  - Right: time ago ("2m ago"), copy icon button, pin icon button
  - Pinned items: gold pin icon, always at top of list above timeline
  - Tapping anywhere on row: copies to clipboard immediately
    + shows green "Copied!" toast bottom center (500ms, then gone)
- Filter pills below search: [All] [Text] [Images] [Links] [Code] [Pinned]
- Empty state (new users): illustrated state, "Copy anything to get started"
- Settings (gear icon top right):
  History limit (100/500/1000 items), Auto-expire sensitive (toggle),
  Exclude apps list (e.g. password managers)
- NO analytics. NO source breakdown charts. NO usage stats on home.
  This is a utility app. Speed and findability are everything.
```

---

## APP 15: VOICE MEMOS

**UX Truth (from Apple Voice Memos 100M+ users research):**
Apple Voice Memos is the benchmark. Users open it to record something RIGHT NOW.
The record button must be the first thing they see and it must be large.
After recording: AI transcription (the #1 requested feature in 2024-2025).
Users search their recordings by content (transcription text), not just name.
The most loved feature nobody knows about: silence trimming.

**AGENT PROMPT — APP 15: VOICE MEMOS**

```
Rebuild Voice Memos:

FIRST SCREEN:
- Background: dark #0A0A0F — recording feels intimate and private
- CENTER HERO: Large record button
  Circle, 100px diameter, red fill when idle (ready to record)
  Tap → turns to pulsing red + shows waveform visualization
  Recording state: live waveform animation center screen, timer top center "00:42"
  Tap again → stops, shows save prompt
- Below record button: "New Recording" label (idle) or "Recording..." (active)
- Recent recordings list below:
  Each row: waveform thumbnail left, auto-title (date/time or AI-generated),
  duration right, play ▶ button, transcription preview small gray text below title
- Search bar above list: searches transcription content
  "Find anything you've said..."
- Recording detail (tap any recording):
  Full waveform view with playhead
  Transcription text below (auto-generated, editable)
  Speaker labels if multiple people: "Speaker 1:", "Speaker 2:"
  Export: Share as audio or as text transcript
```

---

## APP 16: MOOD TRACKER

**UX Truth:** (Daylio-proven — same as Journal but mood-focused, no writing)
The minimum viable mood log is: one tap. Pick a face. Done.
Everything beyond that is optional depth.
The value users get is retrospective: seeing patterns after 30 days.
"I see that I feel worse on Sundays" — this insight is why people keep using it.

**AGENT PROMPT — APP 16: MOOD**

```
Rebuild Mood Tracker — pure emotional tracking, no writing required:

FIRST SCREEN:
- Background: soft gradient — changes with selected mood:
  😞 → deep blue  😕 → slate  😐 → neutral gray
  🙂 → soft green  😊 → warm gold
  Gradient is subtle — doesn't overpower
- "How are you feeling?" 20px center top
- Time of day context: "Good morning" / "Good afternoon" / "Good evening"
- 5 large mood buttons in a row (64px circles, center of screen):
  Each: emoji + mood name below
  Tap → button scales up, gradient shifts, activities appear below
- Activities (appear after mood selection):
  Horizontal scroll of icon pills: Work, Exercise, Social, Food, Sleep,
  Creative, Outdoors, Sick, Stressed, Relaxed, Entertainment, Travel
  Tap to toggle selected (filled accent vs outlined)
- Note: single line text input, optional, below activities
- "Log Mood" button — large, full width, bottom
- After logging: immediate transition to Calendar view
  Month grid with each day colored by that day's mood
  This is the payoff. Show it every time.
- Stats tab: mood line chart over time, activity correlation
  ("You feel 40% better on days you exercise")
```

---

## APP 17: GROCERY / SHOPPING

**UX Truth (from OurGroceries/AnyList 5M+ users research):**
Users open grocery apps in the STORE — one hand on cart, phone in other hand.
The UI must work one-handed. Large touch targets.
The check-off interaction is the core: tap item → strikethrough → moves to bottom.
Voice add is critical: "Add milk" while pushing cart.
Sharing with family (partner adds items remotely) is the #1 paid feature.

**AGENT PROMPT — APP 17: GROCERY**

```
Rebuild Grocery app — designed for one-handed use while shopping:

FIRST SCREEN:
- Background: white — bright, readable under store fluorescent lights
- Top: List selector dropdown "Weekly Shop ▾" + "+" new list button
- Add item bar (TOP, not bottom — always visible while scrolling list):
  Large text input "Add item..." + microphone icon right (voice add)
  User types "milk" + Enter → item appears instantly at top of unchecked list
  Voice: tap mic → say "Add 2 liters of oat milk" → appears with quantity
- Shopping list (main content):
  Category sections: PRODUCE / DAIRY / BAKERY / MEAT / FROZEN / OTHER
  Each item: large checkbox left (44px touch target), item name (18px),
  quantity right, category icon small
  CHECKED items: strikethrough, gray, move to bottom "Checked (5)" collapsed section
- Checked section: collapsed by default, expandable — keeps visual focus on remaining items
- Bottom: "Clear Checked" button appears once items are checked
- Share button top right: sends list link to family member (they see live updates)
- Item tap → edit: quantity, category, note — bottom sheet, not new screen
```

---

## APP 18: RECIPE MANAGER

**UX Truth (from Paprika app 3M+ users research):**
Users add recipes from: websites (import URL), photos, or manual entry.
URL import is the most beloved feature — paste a link, get a clean recipe.
Cooking mode: screen stays on, large text, step by step — this is CRITICAL.
Meal planning: drag recipes to days of week → generates shopping list.
Most used: search recipes by ingredient ("what can I make with chicken and pasta?")

**AGENT PROMPT — APP 18: RECIPES**

```
Rebuild Recipe Manager:

FIRST SCREEN — recipe library:
- Background: warm white #FDFCF8
- Top: Search bar full width "Search recipes or ingredients..."
  Below search: filter chips [All] [Breakfast] [Lunch] [Dinner] [Snacks] [Favorites]
- Recipe grid (2 columns):
  Each card: cover photo (full card width, 140px height, rounded 12px),
  recipe name below (bold 14px), cook time + serving size row below
  Tapping card → recipe detail
- FAB bottom right: "+" with 3 options on tap:
  [Import from URL] [Take Photo] [Manual Entry]
  URL import: paste link → scraper pulls ingredients + steps → shows preview → save

RECIPE DETAIL:
- Header: full-width photo, title overlay bottom
- Tabs: [Ingredients] [Steps] [Notes]
- Ingredients tab: each line as a checkbox (cross off as you use them)
- Steps tab: numbered, large text (18px) — readable from counter distance
- "Start Cooking" button → Cooking Mode:
  Full screen, single step at a time, giant text, screen locked on
  Swipe left/right to navigate steps
  Timer button if step mentions time ("Bake for 25 minutes" → auto-timer)
```

---

## APP 19: WATER TRACKER

**UX Truth (from WaterMinder/Daily Water research):**
The simplest app in the suite. Users open it to tap a glass of water.
The interaction is: open → tap your drink size → done. Under 3 seconds.
Reminder notifications are the main engagement driver — app reminds you, you tap.
Progress ring or bar is the motivating visual.
Daily streak is highly motivating.

**AGENT PROMPT — APP 19: WATER**

```
Rebuild Water Tracker — world's simplest UX:

ENTIRE APP = ONE SCREEN:
- Background: deep blue #0A1628 to light blue gradient top to bottom
  OR white with blue accents — water should feel refreshing
- CENTER HERO: Large circular progress ring (260px)
  Fill: animated water-like wave animation inside ring (CSS only, no libraries)
  Center: "1.2 L" current intake, large white text
  Below center: "/ 2.5 L goal" smaller gray
  Ring stroke: cyan #22D3EE fills as intake increases
- Below ring: quick-add drink buttons in a row:
  [☕ 150ml] [🥛 200ml] [🍶 350ml] [🍼 500ml] [Custom]
  Large touch targets (56px height), rounded pills
  Tap → ring animates up, intake number counts up, satisfying "drip" sound (optional)
- Below buttons: today's log
  Each log entry: time + amount + icon (glass/bottle/coffee)
  Undo button on swipe left
- Bottom: streak badge "🔥 12 days" | "next reminder 3:00pm" (tappable to edit)
- Settings icon top right:
  Daily goal, reminder times, cup sizes — that is all
```

---

## APP 20: COUNTDOWN / EVENTS

**UX Truth (from Days Matter/Countdown+ research):**
Users add birthdays, anniversaries, trips, deadlines.
The home screen scrolls through upcoming events in order.
The hero event (next upcoming) is shown large.
Sharing a countdown ("17 days until my wedding! 💍") is a viral loop.
Cover photos per event make it feel personal, not clinical.

**AGENT PROMPT — APP 20: COUNTDOWN**

```
Rebuild Countdown Events:

FIRST SCREEN:
- Background: dark #0A0A0F — countdowns feel dramatic in dark
- HERO CARD (top 45% of screen):
  Next upcoming event displayed large
  Cover photo as background (blurred dark overlay)
  Event name: 28px bold white
  Countdown: "17 days" in huge 64px bold white center
  Sub-label: "Wednesday, May 28" small gray below
  Category tag pill: Birthday / Anniversary / Trip / Deadline
- EVENT LIST below hero:
  Each item: event color accent left border, event name bold, days away right
  "Today" events: pulsing green dot left
  Past events section: collapsed, expandable
- "+" button top right:
  New event form: Name, Date, Category, Cover Photo (camera/library/unsplash keyword),
  Color, Notify me (toggle + when: 1 week / 1 day / morning of)
- Tap any event → full screen countdown with cover photo background
  Large countdown center, share button top right
  Share generates: image card with event name + countdown + cover photo
  (This is the viral moment)
```

---

## APP 21: TELEMETRY / SYSTEM HEALTH

**UX Truth:** This is an internal tool for the power user.
Unlike the other 20 apps, the user here wants INFORMATION, not quick action.
The home screen IS a dashboard because the job is monitoring, not doing.
But the information must be clear, not cluttered.
One glance should answer: "Is my app healthy right now?"

**AGENT PROMPT — APP 21: TELEMETRY**

```
Rebuild System Health / Telemetry:

FIRST SCREEN:
- Background: very dark #080B10 — monitoring feels serious
- TOP STATUS BANNER (full width, 56px):
  If healthy: green banner "All systems healthy ✓"
  If warning: amber banner "1 issue detected — tap to view"
  If critical: red banner "Critical: Memory spike in Notes module"
  This banner is the first thing user sees. It answers the question instantly.
- 4 metric cards in a 2×2 grid below banner:
  [Memory] current MB, sparkline mini chart, green/amber/red indicator dot
  [IPC Speed] avg ms, sparkline, indicator
  [DB Health] status text, last vacuum time, indicator
  [Active Module] which module running, how long, memory delta
  Each card: 48px tall, minimal — number + label + dot + sparkline only
- ANOMALY LOG below grid (scrollable):
  Each row: timestamp, module, what happened, severity dot, "AI Fixed" or "Unresolved" badge
  Most recent first
  Tap row → detail: what happened, what AI diagnosed, what action was taken
- Live sparkline charts (bottom, collapsible panel):
  Memory over time (last 30 min), IPC latency, DB query time
  Real recharts LineChart, dark themed, thin lines
- NO complex AI chat interface on home. AI agent actions shown as log entries only.
  Users read what happened — they don't talk to the AI through this screen.
```

---

## FINAL INSTRUCTION TO AGENT

Every single one of these 21 apps must feel like a different application.
Not because the colors are different.
Because the LAYOUT is different.
Because the PRIMARY INTERACTION is different.
Because the information hierarchy is different.

App 1 (Tasks) opens on a list.
App 3 (Habits) opens on a circle grid.
App 4 (Focus) opens on a giant timer.
App 7 (Journal) opens on a mood picker.
App 14 (Clipboard) opens on a search bar with instant results.
App 19 (Water) opens on a ring and quick-add buttons.

These are not the same layout with different colors.
They are six completely different ways to present six completely different user needs.

Build each one from that user need outward.
Not from a design template inward.

That is the difference between UX and decoration.
