<script lang="ts">
  import { Search, Plus, Filter, Link, Camera, PenTool, CheckCircle2, Play, Heart, Clock, Users } from 'lucide-svelte';
  

  type Recipe = {
    id: string;
    title: string;
    time: string;
    servings: string;
    image: string;
    favorite: boolean;
  };

  let recipes: Recipe[] = [
    { id: "1", title: "Pasta Carbonara", time: "25m", servings: "2", image: "https://images.unsplash.com/photo-1612874742237-6526221588e3?w=400", favorite: true },
    { id: "2", title: "Avocado Toast", time: "10m", servings: "1", image: "https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?w=400", favorite: false },
    { id: "3", title: "Chicken Curry", time: "45m", servings: "4", image: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400", favorite: true },
    { id: "4", title: "Berry Smoothie", time: "5m", servings: "2", image: "https://images.unsplash.com/photo-1553530666-ba11a7ddc1a6?w=400", favorite: false }
  ];

  let searchQuery = "";
  let activeFilter = "All";
  let filters = ["All", "Breakfast", "Lunch", "Dinner", "Snacks", "Favorites"];
  
  let showFabMenu = false;

  $: filteredRecipes = recipes.filter(r => {
    if (activeFilter === "Favorites" && !r.favorite) return false;
    if (searchQuery && !r.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });
</script>

<div class="recipes-app module-root">
  <div class="search-container">
    <div class="search-bar">
      <Search size={20} style="color: var(--recipes-muted)" />
      <input bind:value={searchQuery} placeholder="Search recipes or ingredients..." class="search-input" />
    </div>
  </div>

  <div class="filter-chips">
    {#each filters as filter}
      <button 
        type="button"
        class="chip {activeFilter === filter ? 'active' : ''}"
        on:click={() => activeFilter = filter}
      >
        {filter}
      </button>
    {/each}
  </div>

  <div class="recipe-grid">
    {#each filteredRecipes as recipe (recipe.id)}
      <div class="recipe-card">
        <div class="card-image" style="background-image: url({recipe.image})">
          {#if recipe.favorite}
            <div class="fav-badge"><Heart size={16} fill="currentColor" /></div>
          {/if}
        </div>
        <div class="card-content">
          <h3 class="recipe-title">{recipe.title}</h3>
          <div class="recipe-meta">
            <span class="meta-item"><Clock size={14} /> {recipe.time}</span>
            <span class="meta-item"><Users size={14} /> {recipe.servings}</span>
          </div>
        </div>
      </div>
    {/each}
  </div>

  <!-- FAB -->
  <div class="fab-container" class:open={showFabMenu}>
    {#if showFabMenu}
      <div class="fab-menu">
        <button type="button" class="fab-option"><Link size={20} /> Import URL</button>
        <button type="button" class="fab-option"><Camera size={20} /> Take Photo</button>
        <button type="button" class="fab-option"><PenTool size={20} /> Manual Entry</button>
      </div>
      <button type="button" class="fab-overlay" aria-label="Close recipe actions" on:click={() => showFabMenu = false}></button>
    {/if}
    <button type="button" class="fab primary" on:click={() => showFabMenu = !showFabMenu}>
      <Plus size={32} />
    </button>
  </div>
</div>


<style>
.recipes-app {
  --recipes-bg: var(--background);
  --recipes-surface: color-mix(in srgb, var(--surface) 94%, var(--background));
  --recipes-surface-strong: color-mix(in srgb, var(--surface) 82%, var(--background));
  --recipes-ink: var(--foreground);
  --recipes-muted: var(--muted);
  --recipes-border: var(--border);
  --recipes-accent: var(--primary);
  --recipes-overlay: color-mix(in srgb, var(--background) 72%, transparent);
  display: flex;
  flex-direction: column;
  height: 100vh;
  box-sizing: border-box;
  background: var(--recipes-bg);
  color: var(--recipes-ink);
  font-family: var(--font-sans);
  position: relative;
}

.search-container {
  padding: 24px 24px 16px;
}

.search-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--recipes-surface);
  border: 1px solid var(--recipes-border);
  padding: 16px;
  border-radius: 8px;
}

.search-input {
  flex: 1;
  background: transparent;
  border: none;
  font-size: 18px;
  color: var(--recipes-ink);
}

.search-input:focus {
  outline: none;
}

.filter-chips {
  display: flex;
  gap: 12px;
  padding: 0 24px 16px;
  overflow-x: auto;
  scrollbar-width: none;
}

.filter-chips::-webkit-scrollbar {
  display: none;
}

.chip {
  background: transparent;
  border: 1px solid var(--recipes-border);
  color: var(--recipes-muted);
  padding: 8px 16px;
  border-radius: 24px;
  font-size: 14px;
  font-weight: 500;
  cursor: default;
  white-space: nowrap;
}

.chip.active {
  background: var(--recipes-accent);
  color: var(--recipes-bg);
  border-color: var(--recipes-accent);
}

.recipe-grid {
  flex: 1;
  overflow-y: auto;
  padding: 16px 24px 120px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.recipe-card {
  background: var(--recipes-surface);
  border: 1px solid var(--recipes-border);
  border-radius: 12px;
  overflow: hidden;
  cursor: default;
  display: flex;
  flex-direction: column;
}

.recipe-card:hover {
  border-color: var(--recipes-accent);
}

.card-image {
  width: 100%;
  height: 140px;
  background-size: cover;
  background-position: center;
  position: relative;
}

.fav-badge {
  position: absolute;
  top: 12px;
  right: 12px;
  background: color-mix(in srgb, var(--recipes-bg) 72%, transparent);
  color: var(--recipes-ink);
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-content {
  padding: 16px;
}

.recipe-title {
  margin: 0 0 12px 0;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--recipes-ink);
}

.recipe-meta {
  display: flex;
  gap: 16px;
  color: var(--recipes-muted);
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

/* FAB Styling */
.fab-container {
  position: absolute;
  bottom: 32px;
  right: 32px;
  z-index: 100;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.fab.primary {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--recipes-accent);
  color: var(--recipes-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  cursor: default;
  z-index: 101;
}

.fab-menu {
  position: absolute;
  bottom: 80px;
  right: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  z-index: 101;
}

.fab-option {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--recipes-surface);
  border: 1px solid var(--recipes-border);
  color: var(--recipes-ink);
  padding: 12px 20px;
  border-radius: 32px;
  font-size: 15px;
  font-weight: 500;
  cursor: default;
  white-space: nowrap;
}

.fab-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--recipes-overlay);
  border: none;
  z-index: 99;
}

</style>


