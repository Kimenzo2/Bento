# Dashboard Layout Reference Images

## Overview
This document catalogs dashboard design references used for the Genesis Life in Color Pages layout redesign.
All images are stored in `design-references/life-in-color-layout-inspiration/`

---

## Image Catalog

### 1. **Donezo Project Management Dashboard**
- **Type:** Project Management Dashboard
- **Key Features:**
  - Sidebar navigation (fixed left, ~200px)
  - Main content area with grid layout
  - Stat cards (4 columns) showing key metrics
  - Multiple widget sections below stats
  - Project analytics chart
  - Team collaboration section
  - No excessive vertical scroll — content fits viewport with sections
- **Viewport Efficiency:** Excellent — compact stat cards, organized grid layout
- **Application:** Use sidebar navigation pattern + stat cards for Life in Color

---

### 2. **Course Learning Platform Dashboard**
- **Type:** Learning/Onboarding Dashboard
- **Key Features:**
  - Sidebar navigation (left, with icons + labels)
  - Main hero banner (full width, ~120px)
  - 3-column card grid for courses
  - Horizontal scrollable content sections
  - Right sidebar with statistics
  - "Continue Watching" carousel with horizontal scroll
- **Viewport Efficiency:** Good — uses horizontal scrolling to avoid vertical bloat
- **Application:** Horizontal scrolling pattern for saved generations instead of vertical stacking

---

### 3. **Crextio HR Dashboard**
- **Type:** HR/Employee Management Dashboard
- **Key Features:**
  - Centered content with max-width constraint
  - Grid layout: photo card + progress panels + time tracker
  - User profile section (left card, fixed height)
  - Expandable/collapsible left sidebar
  - Dashboard widgets in 2-column grid
  - Bottom sections (calendar, onboarding) don't force scroll
- **Viewport Efficiency:** Very Good — everything fits in one viewport with light scroll
- **Application:** Fixed-height containers, grid-based layout for Life in Color book options

---

### 4. **Workflow Management (Lime/Yellow Accent)**
- **Type:** Enterprise Workflow Dashboard
- **Key Features:**
  - Vertical sidebar (ultra-thin icons, ~60px)
  - Main content area with horizontal tab navigation
  - 3-column widget grid (stat cards, data transfer, promotional banner)
  - Large statistics visualization below
  - Right sidebar with info panels
  - Minimal padding, compact spacing
- **Viewport Efficiency:** Excellent — tight spacing, no wasted vertical real estate
- **Application:** Sidebar pattern for Life in Color; minimal padding for workspace feel

---

### 5. **Codename CRM/Sales Dashboard**
- **Type:** Sales/Analytics Dashboard
- **Key Features:**
  - Nested left sidebar with collapsible sections
  - Main content with report builder
  - Top stat row (Revenue, Best Deal, Sales metrics)
  - Tabular reports below
  - Right sidebar with performance cards
  - Heavy use of cards for data compartmentalization
- **Viewport Efficiency:** Good with horizontal tabs instead of vertical stacking
- **Application:** Compartmentalized card design for book flow options

---

### 6. **Personal Productivity Dashboard (Gradient Cards)**
- **Type:** Personal/Wellness Dashboard
- **Key Features:**
  - Left sidebar (narrow, icon-based)
  - Main content with welcome message
  - Progress cards (Prioritized, Additional tasks) — gradient backgrounds
  - 2-column layout for charts + meetings
  - Right sidebar with upcoming meetings
  - Bottom chart (Focusing analytics) doesn't cause heavy scroll
- **Viewport Efficiency:** Very Good — 2-column desktop layout keeps content bounded
- **Application:** 2-column layout for Life in Color desktop; gradient backgrounds for visual appeal

---

### 7. **Operations Live Tracking Dashboard (Dark)**
- **Type:** Real-time Operations Dashboard
- **Key Features:**
  - Vertical sidebar (icon-based, dark theme)
  - Detailed vehicle/asset tracking panel (left)
  - Large map visualization (center/right)
  - Minimal stat cards on detail panel
  - Heavy use of white space for focus
- **Viewport Efficiency:** Excellent — detail panel doesn't force vertical scroll; map scales responsively
- **Application:** Focus-area design pattern; minimize info density in mobile

---

### 8. **Content Management Dashboard (Dark/Purple)**
- **Type:** Content + Schedule Management
- **Key Features:**
  - Sidebar with search + categories
  - Main hero section (large, centered)
  - Content grid (horizontal scrollable)
  - Right sidebar with quick access items
  - Moments/Events section below
  - Minimal vertical scroll, emphasis on horizontal exploration
- **Viewport Efficiency:** Excellent — horizontal cards replace vertical stacking
- **Application:** Horizontal carousel for saved images/generations

---

### 9. **Workspace Collaboration Dashboard (Green Accent)**
- **Type:** Team Collaboration & Task Management
- **Key Features:**
  - Horizontal schedule bar (top, sticky/semi-fixed)
  - Main workspace with 4-column stat grid
  - Team members grid (horizontal)
  - Your Days Tasks section with task cards in grid
  - Right sidebar with profile/summary panel
  - Minimal vertical scroll despite lots of content
- **Viewport Efficiency:** Excellent — heavy use of grids and cards to compress content
- **Application:** Multi-column grid layout for Life in Color; sticky header pattern

---

### 10. **Image Generator Node-Based Interface (Dark)**
- **Type:** Creative Tool / Wizard Interface
- **Key Features:**
  - Left node-building panel (options/controls)
  - Center flow visualization
  - Right image preview panel
  - Bottom info/export section
  - Modular layout allows independent scrolling of each section
  - No single vertical scroll for entire interface
- **Viewport Efficiency:** Perfect — each section (left, center, right) manages its own height
- **Application:** Ideal pattern for Life in Color! Left panel for options, center for canvas, right for preview

---

## Design Patterns to Apply to Life in Color Pages

| Pattern | Source Images | Implementation |
|---------|---------------|-----------------|
| **Sidebar Navigation** | Donezo, Course, Operations, Content Mgmt | Move book options to fixed/sticky right sidebar |
| **2-Column Layout** | Crextio, Personal Dashboard, Workspace | Photo canvas (left) + Book options (right) |
| **3-Section Layout (Left/Center/Right)** | Image Generator, Workspace | Photo (left/center), Options (left), Preview (right) |
| **Horizontal Scrolling** | Course Platform, Content Mgmt, Workspace | Carousel for saved generations instead of vertical list |
| **Max-Width Constraints** | Crextio, Personal Dashboard | Bounded main content (max-w-6xl) with fixed heights |
| **Fixed-Height Containers** | All dashboards | Constrain photo canvas and option cards to viewport |
| **Tab Navigation** | Codename CRM, Workflow Mgmt | Tabs for "Photo", "Generations", "Book Options", "Preview" |
| **Icon Sidebar** | Operations, Dark Dashboard, Workspace | Ultra-thin left sidebar with icons only |
| **Card-Based Compartmentalization** | All dashboards | Wrap book options in fixed-size cards instead of long form |

---

## Viewport Constraints Recommended for Life in Color

```css
/* Main container */
max-h: 100vh          /* or calc(100vh - header) */
overflow: hidden       /* Prevent outer scroll */

/* Sections with independent scroll */
overflow-y: auto      /* Each section scrolls independently */
max-h: calc(100vh - X) /* Where X = header height */

/* Key dimensions */
Sidebar width:        320px to 360px
Photo canvas:         max-h: 600px to 700px
Book options panel:   max-h: calc(100vh - header - gaps)
```

---

## Next Steps

1. **Implement 2-column layout** for Life in Color Page
   - Left: Photo canvas (constrained height)
   - Right: Book options (sticky, independent scroll)

2. **Use horizontal carousel** for saved generations instead of vertical list

3. **Constrain all sections** to fixed/max heights to prevent long scrollbars

4. **Apply compact spacing** (reduce padding) — follow Donezo & Operations patterns

5. **Add tab navigation** if needed to switch between Photo, Options, and Results states

---

## Files Reference

- Design refs stored in: `/design-references/life-in-color-layout-inspiration/`
- Component to update: `/apps/genesis-app/components/lifeInColour/LifeInColourPageView.tsx`
- Grid wrapper: Update className from `lg:grid-cols-1` to `lg:grid-cols-[1fr_360px]` with `h-screen`
