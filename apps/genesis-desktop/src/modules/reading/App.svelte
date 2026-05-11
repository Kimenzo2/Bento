<script lang="ts">
  import { Search, Flame, BookText, BarChart2 } from 'lucide-svelte';
  
  export let moduleId: string;
  export let settings: any = {};

  const currentReads = [
    {
      id: 1,
      title: 'Dune',
      author: 'Frank Herbert',
      genre: 'Sci-Fi',
      cover: 'https://images.unsplash.com/photo-1541963463532-d68292c34b19?w=300&q=80',
      currentPage: 342,
      totalPages: 896,
    }
  ];

  const recentlyFinished = [
    { title: 'Project Hail Mary', cover: 'https://images.unsplash.com/photo-1614729939124-032f0b56c9ce?w=300&q=80' },
    { title: 'The Martian', cover: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=300&q=80' },
    { title: 'Foundation', cover: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=300&q=80' }
  ];

  const challenge = {
    read: 8,
    target: 24,
    aheadBy: 4
  };

  const navItems = [
    { icon: BookText, label: 'Reading', active: true },
    { icon: Search, label: 'Discover', active: false },
    { icon: BarChart2, label: 'Stats', active: false }
  ];
</script>

<div class="reading-app-container module-root">
  <div class="reading-scroll-content">
    
    <!-- Hero: Currently Reading -->
    <div class="hero-section">
      {#each currentReads as book}
        <div class="current-book-card">
          <img src={book.cover} alt="Cover for {book.title}" class="book-cover" />
          
          <div class="book-info">
            <h2 class="book-title">{book.title}</h2>
            <p class="book-author">{book.author}</p>
            <span class="genre-pill">{book.genre}</span>
            
            <div class="progress-section">
              <div class="progress-text">
                <span>Page {book.currentPage} of {book.totalPages}</span>
                <span class="progress-pct">{Math.round((book.currentPage / book.totalPages) * 100)}%</span>
              </div>
              <div class="progress-bar-bg">
                <div class="progress-bar-fill" style="width: {(book.currentPage / book.totalPages) * 100}%"></div>
              </div>
            </div>
            
            <div class="book-actions">
              <button class="btn-update">Update Progress</button>
              <button class="btn-finished">Finished</button>
            </div>
          </div>
        </div>
      {/each}
    </div>

    <!-- Reading Challenge -->
    <div class="challenge-section">
      <div class="section-title">2026 Reading Challenge</div>
      <div class="challenge-card">
        <div class="circular-progress">
          <svg viewBox="0 0 100 100">
            <circle class="ring-bg" cx="50" cy="50" r="40"></circle>
            <circle 
              class="ring-fill" 
              cx="50" cy="50" r="40" 
              style="stroke-dasharray: 251.2; stroke-dashoffset: {251.2 - (251.2 * (challenge.read / challenge.target))}">
            </circle>
          </svg>
          <div class="ring-content">
            <span class="ring-number">{challenge.read} / {challenge.target}</span>
            <span class="ring-label">books</span>
          </div>
        </div>
        <div class="challenge-text">
          <span class="status-badge ahead">{challenge.aheadBy} books ahead of schedule</span>
        </div>
      </div>
    </div>

    <!-- Want to Read / Recently Finished -->
    <div class="shelf-section">
      <div class="shelf-header">
        <div class="section-title">Recently Finished</div>
        <button class="view-all-link">View All (34)</button>
      </div>
      <div class="shelf-scroll">
        {#each recentlyFinished as recent}
          <div class="shelf-book">
            <img src={recent.cover} alt={recent.title} />
          </div>
        {/each}
        <div class="shelf-book add-new">
          <Search size={24} />
          <span>Find Next</span>
        </div>
      </div>
    </div>

  </div>

  <!-- Stats Strip -->
  <div class="stats-strip">
    <div class="stat-item">
      <Flame size={16} color="#F97316" />
      <span>14 day streak</span>
    </div>
    <div class="stat-divider"></div>
    <div class="stat-item">
      <span>8 books this year</span>
    </div>
    <div class="stat-divider"></div>
    <div class="stat-item">
      <span>284 pages/week</span>
    </div>
  </div>

  <!-- Bottom Nav -->
  <div class="bottom-nav">
    {#each navItems as item}
      <button class="nav-item {item.active ? 'active' : ''}">
        <svelte:component this={item.icon} size={20} />
        <span>{item.label}</span>
      </button>
    {/each}
  </div>
</div>
<style>
.reading-app-container {
  height: 100%;
  position: relative;
  display: flex;
  flex-direction: column;
  background-color: transparent;
  color: var(--text-primary, #F9FAFB);
}

.reading-scroll-content {
  flex-grow: 1;
  overflow-y: auto;
  padding: 32px 32px 100px; /* Space for strips and nav */
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.section-title {
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 700;
  color: var(--text-secondary, #9CA3AF);
  margin-bottom: 16px;
}

/* Hero Section */
.hero-section {
  margin-bottom: 48px;
}

.current-book-card {
  display: flex;
  gap: 24px;
  background: var(--bg-surface, rgba(255, 255, 255, 0.03));
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.05));
  padding: 24px;
  border-radius: 24px;
}

.book-cover {
  width: 120px;
  height: 180px;
  border-radius: 8px;
  object-fit: cover;
  box-shadow: 0 8px 24px rgba(0,0,0,0.3);
}

.book-info {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
}

.book-title {
  font-size: 22px;
  font-weight: 700;
  margin: 0 0 4px 0;
}

.book-author {
  font-size: 15px;
  color: var(--text-secondary, #9CA3AF);
  margin: 0 0 12px 0;
}

.genre-pill {
  align-self: flex-start;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 99px;
  background: rgba(225, 29, 72, 0.15); /* Reading app accent #E11D48 */
  color: #FDA4AF;
  margin-bottom: 24px;
}

.progress-section {
  margin-bottom: 16px;
}

.progress-text {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: var(--text-secondary, #9CA3AF);
  margin-bottom: 8px;
}

.progress-pct {
  font-weight: 600;
  color: var(--text-primary, white);
}

.progress-bar-bg {
  width: 100%;
  height: 6px;
  background: var(--bg-elevated, rgba(255, 255, 255, 0.1));
  border-radius: 3px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: #E11D48; /* Registry accent */
  border-radius: 3px;
}

.book-actions {
  display: flex;
  gap: 12px;
  margin-top: auto;
}

.btn-update {
  background: #E11D48;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
}
.btn-update:hover { background: #BE123C; }

.btn-finished {
  background: transparent;
  color: var(--text-secondary, #9CA3AF);
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.2));
  padding: 8px 16px;
  border-radius: 8px;
  font-weight: 500;
  font-size: 14px;
  cursor: pointer;
}
.btn-finished:hover {
  color: white;
  border-color: white;
}

/* Challenge Section */
.challenge-section {
  margin-bottom: 48px;
}

.challenge-card {
  display: flex;
  align-items: center;
  gap: 32px;
  background: var(--bg-surface, rgba(255, 255, 255, 0.03));
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.05));
  padding: 24px;
  border-radius: 24px;
}

.circular-progress {
  position: relative;
  width: 100px;
  height: 100px;
}

.circular-progress svg {
  transform: rotate(-90deg);
  width: 100%;
  height: 100%;
}

.ring-bg {
  fill: none;
  stroke: var(--bg-elevated, rgba(255, 255, 255, 0.1));
  stroke-width: 8;
}

.ring-fill {
  fill: none;
  stroke: #E11D48;
  stroke-width: 8;
  stroke-linecap: round;
  transition: stroke-dashoffset 1s ease-out;
}

.ring-content {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.ring-number {
  font-size: 20px;
  font-weight: 700;
}
.ring-label {
  font-size: 12px;
  color: var(--text-secondary, #9CA3AF);
}

.status-badge.ahead {
  color: #4ADE80;
  background: rgba(74, 222, 128, 0.15);
  padding: 6px 12px;
  border-radius: 99px;
  font-size: 14px;
  font-weight: 600;
}

/* Shelf Section */
.shelf-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.view-all-link {
  background: transparent;
  border: none;
  color: #E11D48;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.shelf-scroll {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  padding-bottom: 16px;
  scrollbar-width: none;
}
.shelf-scroll::-webkit-scrollbar { display: none; }

.shelf-book img {
  width: 100px;
  height: 150px;
  border-radius: 8px;
  object-fit: cover;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  transition: transform 0.2s;
  cursor: pointer;
}
.shelf-book img:hover {
  transform: translateY(-4px);
}

.add-new {
  width: 100px;
  height: 150px;
  border-radius: 8px;
  border: 2px dashed var(--border-color, rgba(255, 255, 255, 0.2));
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-secondary, #9CA3AF);
  cursor: pointer;
  transition: all 0.2s;
}
.add-new:hover {
  border-color: white;
  color: white;
  background: rgba(255,255,255,0.03);
}

/* Floating Bottom Areas */
.stats-strip {
  position: absolute;
  bottom: 64px; /* Above nav */
  left: 0; right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 12px 32px;
  background: var(--bg-overlay, rgba(20, 20, 20, 0.9));
  backdrop-filter: blur(12px);
  border-top: 1px solid var(--border-color, rgba(255, 255, 255, 0.05));
  font-size: 13px;
  font-weight: 500;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.stat-divider {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--border-color, rgba(255, 255, 255, 0.2));
}

.bottom-nav {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  display: flex;
  justify-content: space-around;
  padding: 12px 32px 16px;
  background: var(--bg-surface, #1C2128); /* Opaque for bottom nav */
}

.nav-item {
  background: transparent;
  border: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  color: var(--text-secondary, #9CA3AF);
  cursor: pointer;
  transition: color 0.2s;
}

.nav-item.active {
  color: #E11D48; /* Accent color */
}

.nav-item:hover:not(.active) {
  color: white;
}

.nav-item span {
  font-size: 11px;
  font-weight: 500;
}
</style>


