<script lang="ts">
  import {
    Camera,
    Clock,
    Heart,
    Link,
    PenTool,
    Play,
    Plus,
    Search,
    Users,
  } from "lucide-svelte";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from "$lib/components/ui/card/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { getModuleCatalogEntry } from "$lib/data/module-catalog";
  import {
    getModuleSectionLabel,
    moduleSectionStore,
  } from "$lib/stores/module-sections.store";

  export let moduleId = "recipes";
  export let settings: Record<string, unknown> = {};
  $: settings;

  type Recipe = {
    id: string;
    title: string;
    time: string;
    servings: string;
    image: string;
    favorite: boolean;
    meal: string;
  };

  const fallbackSections = ["Recipes", "Import", "Cook Mode", "Meal Plan", "Shopping", "Export"] as const;

  let recipes: Recipe[] = [
    { id: "1", title: "Pasta Carbonara", time: "25m", servings: "2", image: "https://images.unsplash.com/photo-1612874742237-6526221588e3?w=400", favorite: true, meal: "Dinner" },
    { id: "2", title: "Avocado Toast", time: "10m", servings: "1", image: "https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?w=400", favorite: false, meal: "Breakfast" },
    { id: "3", title: "Chicken Curry", time: "45m", servings: "4", image: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400", favorite: true, meal: "Dinner" },
    { id: "4", title: "Berry Smoothie", time: "5m", servings: "2", image: "https://images.unsplash.com/photo-1553530666-ba11a7ddc1a6?w=400", favorite: false, meal: "Snacks" },
  ];

  const importSources = [
    { label: "Import URL", detail: "Pull ingredients, steps, and image in one pass.", icon: Link },
    { label: "Take Photo", detail: "Scan a handwritten recipe card or cookbook page.", icon: Camera },
    { label: "Manual Entry", detail: "Build a clean recipe from scratch.", icon: PenTool },
  ];

  const mealPlan = [
    { day: "Mon", title: "Avocado Toast", note: "Quick breakfast before standup." },
    { day: "Tue", title: "Chicken Curry", note: "Cook once, leftovers for lunch." },
    { day: "Wed", title: "Berry Smoothie", note: "Post-workout blend." },
    { day: "Thu", title: "Pasta Carbonara", note: "Dinner for two." },
  ];

  const shoppingBundles = [
    { title: "Curry night", items: "6 ingredients", note: "Basil, curry paste, coconut milk, rice." },
    { title: "Brunch prep", items: "4 ingredients", note: "Bread, avocado, feta, chili flakes." },
    { title: "Smoothie refill", items: "3 ingredients", note: "Frozen berries, yogurt, oats." },
  ];

  const exportOptions = [
    { label: "Kitchen PDF", detail: "Large type, timers, and ingredient columns." },
    { label: "Markdown recipe pack", detail: "Portable archive for notes or git." },
    { label: "Shopping CSV", detail: "Ready for grocery price tracking." },
  ];

  let searchQuery = "";
  let activeFilter = "All";
  let filters = ["All", "Breakfast", "Lunch", "Dinner", "Snacks", "Favorites"];
  let showFabMenu = false;

  $: catalogEntry = getModuleCatalogEntry(moduleId);
  $: sectionLabels = catalogEntry?.sidebar?.items ?? fallbackSections;
  $: selectedSection = getModuleSectionLabel($moduleSectionStore, moduleId, sectionLabels);
  $: filteredRecipes = recipes.filter((recipe) => {
    if (activeFilter === "Favorites" && !recipe.favorite) return false;
    if (activeFilter !== "All" && activeFilter !== "Favorites" && recipe.meal !== activeFilter) return false;
    if (searchQuery && !`${recipe.title} ${recipe.meal}`.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });
</script>

<div class="recipes-app module-root">
  <div class="search-container">
    <div class="search-copy">
      <div class="search-copy__eyebrow">
        <span>Recipes</span>
        <Badge variant="outline">{selectedSection}</Badge>
      </div>
      <p>Import, cook, plan, and export without leaving the shell’s section contract.</p>
    </div>

    <div class="search-bar">
      <Search size={18} />
      <Input bind:value={searchQuery} placeholder="Search recipes or ingredients..." class="search-input" />
    </div>
  </div>

  {#if selectedSection === "Recipes"}
    <div class="filter-chips">
      {#each filters as filter}
        <button
          type="button"
          class="chip {activeFilter === filter ? 'active' : ''}"
          on:click={() => (activeFilter = filter)}
        >
          {filter}
        </button>
      {/each}
    </div>

    <div class="recipe-grid">
      {#each filteredRecipes as recipe (recipe.id)}
        <button class="recipe-card" type="button">
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
        </button>
      {/each}
    </div>
  {:else if selectedSection === "Import"}
    <div class="section-body">
      <div class="section-grid">
        <Card class="section-card">
          <CardHeader>
            <CardTitle>Import methods</CardTitle>
            <CardDescription>Choose the fastest intake path for the recipe you found.</CardDescription>
          </CardHeader>
          <CardContent class="stack-list">
            {#each importSources as source}
              <article class="stack-row">
                <div class="stack-row__icon">
                  <svelte:component this={source.icon} size={18} />
                </div>
                <div class="stack-row__copy">
                  <strong>{source.label}</strong>
                  <p>{source.detail}</p>
                </div>
              </article>
            {/each}
          </CardContent>
        </Card>

        <Card class="section-card">
          <CardHeader>
            <CardTitle>Import inbox</CardTitle>
            <CardDescription>Recently captured recipe drafts waiting for cleanup.</CardDescription>
          </CardHeader>
          <CardContent class="stack-list">
            <article class="stack-row"><div class="stack-row__copy"><strong>Spicy lentil stew</strong><p>From saved browser article · ingredients parsed.</p></div></article>
            <article class="stack-row"><div class="stack-row__copy"><strong>Mom’s banana loaf</strong><p>Photo OCR ready for step cleanup.</p></div></article>
          </CardContent>
        </Card>
      </div>
    </div>
  {:else if selectedSection === "Cook Mode"}
    <div class="section-body">
      <div class="section-grid section-grid--cook">
        <Card class="section-card">
          <CardHeader>
            <CardTitle>Now cooking</CardTitle>
            <CardDescription>Pasta Carbonara keeps timers and steps large enough for kitchen use.</CardDescription>
          </CardHeader>
          <CardContent class="cook-steps">
            <article class="cook-step"><span>01</span><p>Boil the pasta in salted water until al dente.</p></article>
            <article class="cook-step"><span>02</span><p>Whisk eggs, pecorino, and black pepper in a bowl.</p></article>
            <article class="cook-step"><span>03</span><p>Render pancetta, toss with pasta, then fold in sauce off the heat.</p></article>
          </CardContent>
        </Card>

        <Card class="section-card">
          <CardHeader>
            <CardTitle>Kitchen controls</CardTitle>
            <CardDescription>Timers, servings, and keep-awake actions stay visible in one panel.</CardDescription>
          </CardHeader>
          <CardContent class="actions-column">
            <Button><Play size={16} /> Start 8 minute pasta timer</Button>
            <Button variant="outline">Scale to 4 servings</Button>
            <Button variant="outline">Keep screen awake</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  {:else if selectedSection === "Meal Plan"}
    <div class="section-body">
      <Card class="section-card section-card--full">
        <CardHeader>
          <CardTitle>Week planner</CardTitle>
          <CardDescription>Meal planning feeds recipes and grocery without a local tab bar.</CardDescription>
        </CardHeader>
        <CardContent class="plan-grid">
          {#each mealPlan as plan}
            <article class="plan-card">
              <small>{plan.day}</small>
              <strong>{plan.title}</strong>
              <p>{plan.note}</p>
            </article>
          {/each}
        </CardContent>
      </Card>
    </div>
  {:else if selectedSection === "Shopping"}
    <div class="section-body">
      <Card class="section-card section-card--full">
        <CardHeader>
          <CardTitle>Shopping bundles</CardTitle>
          <CardDescription>Recipe-generated lists that can drop straight into the grocery module.</CardDescription>
        </CardHeader>
        <CardContent class="stack-list">
          {#each shoppingBundles as bundle}
            <article class="stack-row">
              <div class="stack-row__copy">
                <strong>{bundle.title}</strong>
                <p>{bundle.note}</p>
              </div>
              <Button variant="outline">{bundle.items}</Button>
            </article>
          {/each}
        </CardContent>
      </Card>
    </div>
  {:else}
    <div class="section-body">
      <Card class="section-card section-card--full">
        <CardHeader>
          <CardTitle>Export formats</CardTitle>
          <CardDescription>Kitchen-ready, markdown-friendly, or grocery-linked outputs from the same canvas.</CardDescription>
        </CardHeader>
        <CardContent class="stack-list">
          {#each exportOptions as option}
            <article class="stack-row">
              <div class="stack-row__copy">
                <strong>{option.label}</strong>
                <p>{option.detail}</p>
              </div>
              <Button variant="outline">Export</Button>
            </article>
          {/each}
        </CardContent>
      </Card>
    </div>
  {/if}

  {#if selectedSection === "Recipes"}
    <div class="fab-container" class:open={showFabMenu}>
      {#if showFabMenu}
        <div class="fab-menu">
          {#each importSources as source}
            <button type="button" class="fab-option">
              <svelte:component this={source.icon} size={18} />
              {source.label}
            </button>
          {/each}
        </div>
        <button type="button" class="fab-overlay" aria-label="Close recipe actions" on:click={() => (showFabMenu = false)}></button>
      {/if}
      <button type="button" class="fab primary" on:click={() => (showFabMenu = !showFabMenu)}>
        <Plus size={28} />
      </button>
    </div>
  {/if}
</div>

<style>
  :global(.recipes-app) {
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
    height: 100%;
    min-height: 0;
    box-sizing: border-box;
    overflow: hidden;
    background: var(--recipes-bg);
    color: var(--recipes-ink);
    font-family: inherit;
    position: relative;
  }

  :global(.search-container) {
    padding: 24px 24px 16px;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(280px, 0.85fr);
    gap: 16px;
    align-items: center;
    flex-shrink: 0;
  }

  :global(.search-copy) {
    display: grid;
    gap: 8px;
  }

  :global(.search-copy__eyebrow) {
    display: flex;
    align-items: center;
    gap: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 12px;
    font-weight: 700;
  }

  :global(.search-copy) p {
    margin: 0;
    color: var(--recipes-muted);
    line-height: 1.5;
  }

  :global(.search-bar) {
    display: flex;
    align-items: center;
    gap: 12px;
    background: var(--recipes-surface);
    border: 1px solid var(--recipes-border);
    padding: 12px 14px;
    border-radius: 14px;
    color: var(--recipes-muted);
  }

  :global(.search-bar) :global(input) {
    border: none;
    background: transparent;
    padding: 0;
  }

  :global(.filter-chips) {
    display: flex;
    gap: 12px;
    padding: 0 24px 16px;
    overflow-x: auto;
    flex-shrink: 0;
  }

  :global(.chip) {
    background: transparent;
    border: 1px solid var(--recipes-border);
    color: var(--recipes-muted);
    padding: 8px 16px;
    border-radius: 24px;
    font-size: 14px;
    font-weight: 500;
    white-space: nowrap;
  }

  :global(.chip).active {
    background: var(--recipes-accent);
    color: var(--recipes-bg);
    border-color: var(--recipes-accent);
  }

  :global(.recipe-grid),
  :global(.section-body) {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  :global(.recipe-grid) {
    padding: 16px 24px 120px;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
  }

  :global(.recipe-card) {
    background: var(--recipes-surface);
    border: 1px solid var(--recipes-border);
    border-radius: 12px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    text-align: left;
    color: inherit;
  }

  :global(.recipe-card):hover {
    border-color: color-mix(in srgb, var(--recipes-accent) 42%, var(--recipes-border));
  }

  :global(.card-image) {
    width: 100%;
    height: 140px;
    background-size: cover;
    background-position: center;
    position: relative;
  }

  :global(.fav-badge) {
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

  :global(.card-content) {
    padding: 16px;
  }

  :global(.recipe-title) {
    margin: 0 0 12px 0;
    font-size: 15px;
    font-weight: 600;
    line-height: 1.4;
  }

  :global(.recipe-meta) {
    display: flex;
    gap: 16px;
    color: var(--recipes-muted);
  }

  :global(.meta-item),
  :global(.stack-row),
  :global(.stack-row__icon),
  :global(.cook-step),
  :global(.plan-card) {
    display: flex;
    align-items: center;
  }

  :global(.meta-item) {
    gap: 6px;
    font-size: 13px;
  }

  :global(.section-body) {
    padding: 8px 24px 24px;
  }

  :global(.section-grid) {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 0.85fr);
    gap: 16px;
    height: 100%;
  }

  :global(.section-grid--cook) {
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
  }

  :global(.section-card--full) {
    min-height: 100%;
  }

  :global(.stack-list),
  :global(.actions-column),
  :global(.cook-steps),
  :global(.plan-grid) {
    display: grid;
    gap: 12px;
  }

  :global(.stack-row),
  :global(.cook-step),
  :global(.plan-card) {
    padding: 14px 16px;
    border: 1px solid var(--recipes-border);
    border-radius: 16px;
    background: var(--recipes-surface);
  }

  :global(.stack-row) {
    justify-content: space-between;
    gap: 14px;
  }

  :global(.stack-row__icon) {
    width: 40px;
    height: 40px;
    justify-content: center;
    border: 1px solid var(--recipes-border);
    border-radius: 12px;
    background: var(--recipes-surface-strong);
    flex-shrink: 0;
  }

  :global(.stack-row__copy) {
    display: grid;
    gap: 4px;
    flex: 1;
  }

  :global(.stack-row__copy) p,
  :global(.cook-step) p,
  :global(.plan-card) p {
    margin: 0;
    color: var(--recipes-muted);
    line-height: 1.5;
  }

  :global(.cook-step) {
    align-items: flex-start;
    gap: 14px;
  }

  :global(.cook-step) span {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--recipes-muted);
  }

  :global(.actions-column) {
    grid-auto-rows: min-content;
  }

  :global(.plan-grid) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  :global(.plan-card) {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  :global(.plan-card) small {
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--recipes-muted);
  }

  :global(.fab-container) {
    position: absolute;
    bottom: 32px;
    right: 32px;
    z-index: 100;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }

  :global(.fab).primary {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: var(--recipes-accent);
    color: var(--recipes-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    z-index: 101;
  }

  :global(.fab-menu) {
    display: grid;
    gap: 10px;
    margin-bottom: 12px;
    position: relative;
    z-index: 101;
  }

  :global(.fab-option) {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border-radius: 14px;
    border: 1px solid var(--recipes-border);
    background: var(--recipes-surface);
    color: inherit;
  }

  :global(.fab-overlay) {
    position: fixed;
    inset: 0;
    background: var(--recipes-overlay);
    border: none;
    z-index: 100;
  }
</style>
