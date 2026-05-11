<script lang="ts">
  import { Plus, ChevronRight, X } from 'lucide-svelte';

  export let moduleId: string;
  export let settings: any = {};

  let currentView = 'home'; // 'home' or 'review'
  
  let totalDue = 47;
  
  let decks = [
    { id: 1, name: 'Spanish A1', totalCards: 450, dueCount: 24, lastStudied: '2 hours ago' },
    { id: 2, name: 'Anatomy: Muscular System', totalCards: 128, dueCount: 15, lastStudied: 'Yesterday' },
    { id: 3, name: 'AWS Certified Solutions Architect', totalCards: 850, dueCount: 8, lastStudied: '3 days ago' },
    { id: 4, name: 'JavaScript Algorithms', totalCards: 65, dueCount: 0, lastStudied: 'Just now' }
  ];

  let reviewSession = {
    total: 47,
    remaining: 47,
    currentIndex: 0,
    isFlipped: false
  };

  const mockCard = {
    front: "What is the primary function of the mitochondria?",
    back: "Generates most of the chemical energy needed to power the cell's biochemical reactions (ATP production)."
  };

  function startReview(deckId: number | null = null) {
    if (deckId !== null) {
      const deck = decks.find(d => d.id === deckId);
      reviewSession.total = deck ? deck.dueCount : 0;
      reviewSession.remaining = reviewSession.total;
    } else {
      reviewSession.total = totalDue;
      reviewSession.remaining = totalDue;
    }
    
    if (reviewSession.total > 0) {
      reviewSession.currentIndex = 0;
      reviewSession.isFlipped = false;
      currentView = 'review';
    }
  }

  function handleFlip() {
    reviewSession.isFlipped = true;
  }

  function rateCard(rating: string) {
    // rating: 'again', 'hard', 'good', 'easy'
    reviewSession.remaining -= 1;
    reviewSession.isFlipped = false;
    
    if (reviewSession.remaining <= 0) {
      // Simulate ending session and updating stats
      totalDue = Math.max(0, totalDue - reviewSession.total);
      decks = decks.map(d => ({ ...d, dueCount: Math.max(0, d.dueCount - Math.floor(Math.random() * d.dueCount)) }));
      currentView = 'home';
    }
  }
</script>

<div class="flashcards-app-container module-root">
  {#if currentView === 'home'}
    <div class="home-view fade-in">
      <div class="fh-top-bar">
        <span class="fh-title">Flashcards</span>
        <button class="icon-btn"><Plus size={24} /></button>
      </div>

      <div class="hero-section">
        <div class="due-number">{totalDue}</div>
        <div class="due-label">cards due today</div>
        <button 
          class="start-review-btn {totalDue > 0 ? '' : 'disabled'}" 
          on:click={() => startReview()}
          disabled={totalDue === 0}
        >
          {totalDue > 0 ? 'Start Review →' : 'All caught up!'}
        </button>
      </div>

      <div class="deck-list-container">
        <div class="section-label">Your Decks</div>
        <div class="deck-list">
          {#each decks as deck}
            <button class="deck-row" on:click={() => startReview(deck.id)}>
              <div class="deck-info">
                <div class="deck-name">{deck.name}</div>
                <div class="deck-stats">
                  {deck.totalCards} cards • <span class="last-studied">{deck.lastStudied}</span>
                </div>
              </div>
              <div class="deck-right">
                {#if deck.dueCount > 0}
                  <span class="due-badge">{deck.dueCount}</span>
                {/if}
                <ChevronRight size={18} class="chevron" />
              </div>
            </button>
          {/each}
        </div>
      </div>
    </div>
  {:else}
    <div class="review-view fade-in">
      <div class="review-top-bar">
        <button class="end-session-btn" on:click={() => currentView = 'home'}>
          <X size={16} /> End Session
        </button>
        <div class="review-progress-container">
          <div class="review-progress-text">{reviewSession.total - reviewSession.remaining + 1} / {reviewSession.total}</div>
          <div class="review-progress-bar">
            <div class="review-progress-fill" 
              style="width: {((reviewSession.total - reviewSession.remaining) / reviewSession.total) * 100}%">
            </div>
          </div>
        </div>
      </div>

      <div class="card-scene">
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div class="flashcard {reviewSession.isFlipped ? 'is-flipped' : ''}" on:click={handleFlip}>
          <div class="card-face card-front">
            <div class="card-content">
              <h3>{mockCard.front}</h3>
            </div>
            {#if !reviewSession.isFlipped}
              <div class="tap-hint">Tap to reveal</div>
            {/if}
          </div>
          <div class="card-face card-back">
            <div class="card-content">
              <p>{mockCard.back}</p>
            </div>
          </div>
        </div>
      </div>

      <div class="rating-controls {reviewSession.isFlipped ? 'visible' : ''}">
        <button class="rate-btn btn-again" on:click={() => rateCard('again')}>
          <span class="rate-label">Again</span>
          <span class="rate-time">&lt;1m</span>
        </button>
        <button class="rate-btn btn-hard" on:click={() => rateCard('hard')}>
          <span class="rate-label">Hard</span>
          <span class="rate-time">2d</span>
        </button>
        <button class="rate-btn btn-good" on:click={() => rateCard('good')}>
          <span class="rate-label">Good</span>
          <span class="rate-time">4d</span>
        </button>
        <button class="rate-btn btn-easy" on:click={() => rateCard('easy')}>
          <span class="rate-label">Easy</span>
          <span class="rate-time">8d</span>
        </button>
      </div>
    </div>
  {/if}
</div>
<style>
.flashcards-app-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
  color: var(--text-primary, #F9FAFB);
}

.fade-in {
  animation: fadeIn 0.3s ease;
  height: 100%;
  display: flex;
  flex-direction: column;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* HOME VIEW */
.fh-top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 32px 16px;
}

.fh-title {
  font-size: 20px;
  font-weight: 600;
}

.icon-btn {
  background: transparent;
  border: none;
  color: var(--text-primary, white);
  cursor: pointer;
  padding: 8px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}
.icon-btn:hover {
  background: var(--bg-hover, rgba(255, 255, 255, 0.05));
}

.hero-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 32px 56px;
}

.due-number {
  font-size: 80px;
  font-weight: 800;
  line-height: 1;
  color: var(--text-primary, white);
  margin-bottom: 8px;
}

.due-label {
  font-size: 18px;
  color: var(--text-secondary, #9CA3AF);
  margin-bottom: 32px;
}

.start-review-btn {
  background: #6D5CE7; /* Flashcards registry accent */
  color: white;
  border: none;
  padding: 18px 40px;
  border-radius: 99px;
  font-size: 18px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 8px 24px rgba(109, 92, 231, 0.4);
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.start-review-btn:hover {
  transform: translateY(-2px);
  background: #5B4BC4;
}
.start-review-btn.disabled {
  background: var(--bg-elevated, rgba(255, 255, 255, 0.05));
  color: var(--text-secondary, rgba(255, 255, 255, 0.3));
  box-shadow: none;
  cursor: default;
  transform: none;
}

.deck-list-container {
  flex-grow: 1;
  background: var(--bg-elevated, rgba(255, 255, 255, 0.02));
  border-top: 1px solid var(--border-color, rgba(255, 255, 255, 0.05));
  padding: 24px 32px;
  overflow-y: auto;
}

.section-label {
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 600;
  color: var(--text-secondary, #9CA3AF);
  margin-bottom: 16px;
}

.deck-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.deck-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--bg-surface, rgba(255, 255, 255, 0.03));
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.05));
  padding: 16px 20px;
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}
.deck-row:hover {
  background: var(--bg-hover, rgba(255, 255, 255, 0.06));
}

.deck-name {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 4px;
}

.deck-stats {
  font-size: 13px;
  color: var(--text-secondary, #9CA3AF);
}

.deck-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.due-badge {
  background: #6D5CE7;
  color: white;
  padding: 4px 10px;
  border-radius: 99px;
  font-size: 13px;
  font-weight: 600;
}

.chevron {
  color: var(--text-secondary, #9CA3AF);
}

/* REVIEW VIEW */
.review-top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 32px;
}

.end-session-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: none;
  color: var(--text-secondary, #9CA3AF);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  padding: 8px 12px;
  margin-left: -12px;
  border-radius: 8px;
  transition: background 0.2s;
}
.end-session-btn:hover {
  background: var(--bg-hover, rgba(255, 255, 255, 0.05));
  color: white;
}

.review-progress-container {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  width: 120px;
}

.review-progress-text {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary, #9CA3AF);
}

.review-progress-bar {
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
}

.review-progress-fill {
  height: 100%;
  background: #6D5CE7;
  transition: width 0.3s ease;
}

/* 3D Card Scene */
.card-scene {
  flex-grow: 1;
  perspective: 1000px;
  padding: 0 32px 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.flashcard {
  width: 100%;
  max-width: 600px;
  height: 60vh;
  position: relative;
  transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
  transform-style: preserve-3d;
  cursor: pointer;
}

.flashcard.is-flipped {
  transform: rotateY(180deg);
}

.card-face {
  position: absolute;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  background: var(--bg-surface, #1C2128);
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
  border-radius: 24px;
  padding: 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.card-back {
  transform: rotateY(180deg);
  background: var(--bg-elevated, #242B35);
}

.card-content h3 {
  font-size: 24px;
  font-weight: 500;
  line-height: 1.5;
  margin: 0;
  color: var(--text-primary, white);
}

.card-content p {
  font-size: 20px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.9);
  margin: 0;
}

.tap-hint {
  position: absolute;
  bottom: 24px;
  font-size: 13px;
  color: var(--text-secondary, #9CA3AF);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 500;
}

/* Rating Controls */
.rating-controls {
  padding: 0 32px 40px;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  opacity: 0;
  transform: translateY(20px);
  pointer-events: none;
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.rating-controls.visible {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

.rate-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 64px;
  border-radius: 16px;
  border: 1px solid transparent;
  cursor: pointer;
  background: var(--bg-elevated, rgba(255, 255, 255, 0.05));
  transition: all 0.2s;
}

.btn-again { color: #EF4444; border-color: rgba(239, 68, 68, 0.2); }
.btn-hard { color: #F97316; border-color: rgba(249, 115, 22, 0.2); }
.btn-good { color: #4ADE80; border-color: rgba(74, 222, 128, 0.2); }
.btn-easy { color: #3B82F6; border-color: rgba(59, 130, 246, 0.2); }

.rate-btn:hover { background: rgba(255, 255, 255, 0.1); transform: translateY(-2px); }
.btn-again:hover { background: rgba(239, 68, 68, 0.1); }
.btn-hard:hover { background: rgba(249, 115, 22, 0.1); }
.btn-good:hover { background: rgba(74, 222, 128, 0.1); }
.btn-easy:hover { background: rgba(59, 130, 246, 0.1); }

.rate-label { font-weight: 600; font-size: 14px; }
.rate-time { font-size: 12px; opacity: 0.7; }
</style>


