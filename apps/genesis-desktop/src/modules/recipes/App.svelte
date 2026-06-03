<script lang="ts">
  import "./recipes.css";
  import CameraIcon from "@lucide/svelte/icons/camera";
  import ClockIcon from "@lucide/svelte/icons/clock";
  import HeartIcon from "@lucide/svelte/icons/heart";
  import LinkIcon from "@lucide/svelte/icons/link";
  import PenToolIcon from "@lucide/svelte/icons/pen-tool";
  import PlayIcon from "@lucide/svelte/icons/play";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import SearchIcon from "@lucide/svelte/icons/search";
  import UsersIcon from "@lucide/svelte/icons/users";
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
  import { MiniAppHeader, MiniAppRoot } from "$lib/modules/mini-app/index.js";
  import {
    getModuleSectionLabel,
    moduleSectionStore,
  } from "$lib/stores/module-sections.store";

  let { moduleId = "recipes", settings = {} }: { moduleId?: string; settings?: Record<string, unknown> } =
    $props();

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

  const recipes: Recipe[] = [
    {
      id: "1",
      title: "Pasta Carbonara",
      time: "25m",
      servings: "2",
      image: "https://images.unsplash.com/photo-1612874742237-6526221588e3?w=400",
      favorite: true,
      meal: "Dinner",
    },
    {
      id: "2",
      title: "Avocado Toast",
      time: "10m",
      servings: "1",
      image: "https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?w=400",
      favorite: false,
      meal: "Breakfast",
    },
    {
      id: "3",
      title: "Chicken Curry",
      time: "45m",
      servings: "4",
      image: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400",
      favorite: true,
      meal: "Dinner",
    },
    {
      id: "4",
      title: "Berry Smoothie",
      time: "5m",
      servings: "2",
      image: "https://images.unsplash.com/photo-1553530666-ba11a7ddc1a6?w=400",
      favorite: false,
      meal: "Snacks",
    },
  ];

  const importSources = [
    { label: "Import URL", detail: "Pull ingredients and steps from a link.", icon: LinkIcon },
    { label: "Scan photo", detail: "Capture a cookbook page or card.", icon: CameraIcon },
    { label: "Manual entry", detail: "Build a recipe from scratch.", icon: PenToolIcon },
  ];

  const mealPlan = [
    { day: "Mon", title: "Avocado Toast", note: "Quick breakfast." },
    { day: "Tue", title: "Chicken Curry", note: "Cook once, lunch leftovers." },
    { day: "Wed", title: "Berry Smoothie", note: "Post-workout." },
    { day: "Thu", title: "Pasta Carbonara", note: "Dinner for two." },
  ];

  const shoppingBundles = [
    { title: "Curry night", items: "6 ingredients", note: "Curry paste, coconut milk, rice." },
    { title: "Brunch prep", items: "4 ingredients", note: "Bread, avocado, feta." },
    { title: "Smoothie refill", items: "3 ingredients", note: "Berries, yogurt, oats." },
  ];

  const exportOptions = [
    { label: "Kitchen PDF", detail: "Large type with timers and columns." },
    { label: "Markdown pack", detail: "Portable archive for notes." },
    { label: "Shopping CSV", detail: "Send to grocery lists." },
  ];

  let searchQuery = $state("");
  let activeFilter = $state("All");
  const filters = ["All", "Breakfast", "Lunch", "Dinner", "Snacks", "Favorites"];
  let showFabMenu = $state(false);

  const catalogEntry = $derived(getModuleCatalogEntry(moduleId));
  const sectionLabels = $derived(
    catalogEntry?.sidebar?.items
      ? catalogEntry.sidebar.items.map((item) =>
          typeof item === 'string' ? item : item.label
        )
      : [...fallbackSections]
  );
  const selectedSection = $derived(getModuleSectionLabel($moduleSectionStore, moduleId, sectionLabels));

  const filteredRecipes = $derived(
    recipes.filter((recipe) => {
      if (activeFilter === "Favorites" && !recipe.favorite) return false;
      if (activeFilter !== "All" && activeFilter !== "Favorites" && recipe.meal !== activeFilter) {
        return false;
      }
      if (
        searchQuery &&
        !`${recipe.title} ${recipe.meal}`.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }
      return true;
    }),
  );
</script>

<MiniAppRoot class="recipes-app gap-5 p-4 sm:p-6">
  <MiniAppHeader
    eyebrow="Recipes"
    title="Recipe manager"
    description="Search your library, plan meals, and cook with step-by-step mode."
  >
    {#snippet actions()}
      <Badge variant="outline">{selectedSection}</Badge>
    {/snippet}
  </MiniAppHeader>

  <section class="recipes-toolbar">
    <div class="recipes-search">
      <SearchIcon class="size-[1.125rem] shrink-0" />
      <Input bind:value={searchQuery} placeholder="Search recipes…" class="border-0 bg-transparent shadow-none" />
    </div>
  </section>

  {#if selectedSection === "Recipes"}
    <section class="recipes-filters">
      {#each filters as filter (filter)}
        <button
          type="button"
          class="recipes-chip"
          class:is-active={activeFilter === filter}
          onclick={() => (activeFilter = filter)}
        >
          {filter}
        </button>
      {/each}
    </section>

    <section class="recipes-grid">
      {#each filteredRecipes as recipe (recipe.id)}
        <button type="button" class="recipes-card">
          <span class="recipes-card-image" style="background-image:url({recipe.image})">
            {#if recipe.favorite}
              <span class="recipes-fav"><HeartIcon class="size-4" fill="currentColor" /></span>
            {/if}
          </span>
          <span class="recipes-card-body">
            <span class="block font-semibold">{recipe.title}</span>
            <span class="recipes-meta">
              <span><ClockIcon class="size-3.5" /> {recipe.time}</span>
              <span><UsersIcon class="size-3.5" /> {recipe.servings}</span>
            </span>
          </span>
        </button>
      {/each}
    </section>
  {:else if selectedSection === "Import"}
    <section class="recipes-section-scroll grid gap-4 lg:grid-cols-2">
      <Card class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
        <CardHeader>
          <CardTitle class="font-[var(--font-heading)]">Import</CardTitle>
          <CardDescription>Bring recipes in from a link, photo, or form.</CardDescription>
        </CardHeader>
        <CardContent class="grid gap-2">
          {#each importSources as source (source.label)}
            <article class="mini-app-row">
              <source.icon class="size-[1.125rem] shrink-0 text-[var(--muted)]" />
              <span class="min-w-0">
                <span class="block font-medium">{source.label}</span>
                <span class="block text-sm text-[var(--muted)]">{source.detail}</span>
              </span>
            </article>
          {/each}
        </CardContent>
      </Card>
    </section>
  {:else if selectedSection === "Cook Mode"}
    <section class="recipes-section-scroll grid gap-4 lg:grid-cols-2">
      <Card class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
        <CardHeader>
          <CardTitle class="font-[var(--font-heading)]">Now cooking</CardTitle>
          <CardDescription>Pasta Carbonara — large type for the kitchen.</CardDescription>
        </CardHeader>
        <CardContent class="grid gap-2">
          <article class="recipes-cook-step"><span>01</span><p>Boil pasta in salted water until al dente.</p></article>
          <article class="recipes-cook-step"><span>02</span><p>Whisk eggs, pecorino, and pepper.</p></article>
          <article class="recipes-cook-step"><span>03</span><p>Toss pasta with pancetta, then fold in sauce off heat.</p></article>
        </CardContent>
      </Card>
      <Card class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
        <CardHeader>
          <CardTitle class="font-[var(--font-heading)]">Controls</CardTitle>
        </CardHeader>
        <CardContent class="grid gap-2">
          <Button type="button"><PlayIcon data-icon="inline-start" /> 8 min pasta timer</Button>
          <Button type="button" variant="outline">Scale to 4 servings</Button>
          <Button type="button" variant="outline">Keep screen awake</Button>
        </CardContent>
      </Card>
    </section>
  {:else if selectedSection === "Meal Plan"}
    <section class="recipes-section-scroll">
      <section class="recipes-plan-grid">
        {#each mealPlan as plan (plan.day)}
          <article class="recipes-plan-card">
            <small>{plan.day}</small>
            <strong class="block font-semibold">{plan.title}</strong>
            <p class="mt-1 text-sm text-[var(--muted)]">{plan.note}</p>
          </article>
        {/each}
      </section>
    </section>
  {:else if selectedSection === "Shopping"}
    <section class="recipes-section-scroll grid gap-2">
      {#each shoppingBundles as bundle (bundle.title)}
        <article class="mini-app-row">
          <span class="min-w-0">
            <span class="block font-medium">{bundle.title}</span>
            <span class="block text-sm text-[var(--muted)]">{bundle.note}</span>
          </span>
          <Button type="button" variant="outline" size="sm">{bundle.items}</Button>
        </article>
      {/each}
    </section>
  {:else}
    <section class="recipes-section-scroll grid gap-2">
      {#each exportOptions as option (option.label)}
        <article class="mini-app-row">
          <span class="min-w-0">
            <span class="block font-medium">{option.label}</span>
            <span class="block text-sm text-[var(--muted)]">{option.detail}</span>
          </span>
          <Button type="button" variant="outline" size="sm">Export</Button>
        </article>
      {/each}
    </section>
  {/if}

  {#if selectedSection === "Recipes"}
    <section class="recipes-fab">
      {#if showFabMenu}
        <button type="button" class="recipes-fab-overlay" aria-label="Close menu" onclick={() => (showFabMenu = false)}></button>
        <span class="recipes-fab-menu">
          {#each importSources as source (source.label)}
            <button type="button" class="recipes-fab-option">
              <source.icon class="size-4" />
              {source.label}
            </button>
          {/each}
        </span>
      {/if}
      <Button type="button" size="icon-lg" class="rounded-full" onclick={() => (showFabMenu = !showFabMenu)}>
        <PlusIcon />
      </Button>
    </section>
  {/if}
</MiniAppRoot>
