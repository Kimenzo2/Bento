<script lang="ts">
  import CheckCircle2Icon from "@lucide/svelte/icons/check-circle-2";
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import MicIcon from "@lucide/svelte/icons/mic";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import Share2Icon from "@lucide/svelte/icons/share-2";
  import ShoppingCartIcon from "@lucide/svelte/icons/shopping-cart";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import { onMount } from "svelte";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import {
    MiniAppHeader,
    MiniAppRoot,
    MiniAppStatGrid,
  } from "$lib/modules/mini-app/index.js";
  import {
    ensureModuleSection,
    getModuleSectionLabel,
    moduleSectionStore,
  } from "$lib/stores/module-sections.store";

  let { moduleId = "grocery", settings = {} }: { moduleId?: string; settings?: Record<string, unknown> } =
    $props();

  const sectionLabels = ["List", "Shared", "Sections", "Recipes", "Prices", "Export"] as const;
  const selectedSection = $derived(getModuleSectionLabel($moduleSectionStore, moduleId, sectionLabels));

  type GroceryItem = {
    id: string;
    name: string;
    quantity: string;
    category: string;
    checked: boolean;
  };

  let currentList = $state("Weekly Shop");
  let newItem = $state("");

  let items = $state<GroceryItem[]>([
    { id: "1", name: "Oat Milk", quantity: "2 liters", category: "DAIRY", checked: false },
    { id: "2", name: "Bananas", quantity: "1 bunch", category: "PRODUCE", checked: false },
    { id: "3", name: "Sourdough Bread", quantity: "1 loaf", category: "BAKERY", checked: false },
    { id: "4", name: "Chicken Breast", quantity: "1 kg", category: "MEAT", checked: true },
    { id: "5", name: "Frozen Peas", quantity: "2 bags", category: "FROZEN", checked: true },
  ]);

  const sharedLists = [
    { id: "s1", name: "Family Costco run", members: 3, items: 18 },
    { id: "s2", name: "Roommate restock", members: 2, items: 9 },
  ];

  const sectionGroups = [
    { category: "PRODUCE", items: ["Bananas", "Spinach", "Avocados"] },
    { category: "DAIRY", items: ["Oat Milk", "Greek yogurt"] },
    { category: "BAKERY", items: ["Sourdough Bread"] },
  ];

  const recipeLinks = [
    { title: "Chicken grain salad", items: "6 ingredients from Recipes" },
    { title: "Sunday meal prep", items: "12 ingredients · 4 recipes" },
  ];

  const priceAlerts = [
    { item: "Oat Milk", store: "Whole Foods", change: "↓ $0.40 this week" },
    { item: "Frozen Peas", store: "Trader Joe's", change: "Stable" },
  ];

  const exportOptions = [
    { label: "Share link", detail: "Read-only list for family" },
    { label: "CSV export", detail: "Categories and quantities for spreadsheets" },
  ];

  onMount(() => {
    ensureModuleSection(moduleId, sectionLabels);
  });

  const uncheckedItems = $derived(items.filter((i) => !i.checked));
  const checkedItems = $derived(items.filter((i) => i.checked));
  const checkedCount = $derived(checkedItems.length);

  function toggleItem(id: string) {
    items = items.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item));
  }

  function addItem(e: SubmitEvent) {
    e.preventDefault();
    if (!newItem.trim()) return;

    items = [
      {
        id: Date.now().toString(),
        name: newItem.trim(),
        quantity: "1",
        category: "OTHER",
        checked: false,
      },
      ...items,
    ];
    newItem = "";
  }

  function clearChecked() {
    items = items.filter((item) => !item.checked);
  }
</script>

<MiniAppRoot class="gap-5 p-4 sm:p-6">
  <MiniAppHeader
    eyebrow="Grocery"
    title="Lists, sections, and shared shopping"
    description="Quick capture, store sections, recipe-to-list, and price tracking — privacy-first, no bank links."
  >
    {#snippet actions()}
      <Badge variant="outline">{selectedSection}</Badge>
      <div class="flex items-center gap-1">
        <Button variant="ghost" size="icon" type="button" aria-label="Share list">
          <Share2Icon class="size-4" />
        </Button>
        <Button variant="ghost" size="icon" type="button" aria-label="New list">
          <PlusIcon class="size-4" />
        </Button>
      </div>
    {/snippet}
  </MiniAppHeader>

  <MiniAppStatGrid
    stats={[
      { label: "Active list", value: currentList, hint: `${uncheckedItems.length} to buy` },
      { label: "Checked", value: String(checkedCount), hint: "Ready to clear" },
      { label: "Shared", value: String(sharedLists.length), hint: "Family lists" },
    ]}
  />

  {#if selectedSection === "Export"}
    <Card class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
      <CardHeader>
        <CardTitle class="font-[var(--font-heading)] text-xl">Export & share</CardTitle>
        <CardDescription>Send lists without exposing purchase history.</CardDescription>
      </CardHeader>
      <CardContent class="grid gap-2">
        {#each exportOptions as option (option.label)}
          <article class="mini-app-row">
            <div class="min-w-0">
              <p class="font-medium text-[var(--foreground)]">{option.label}</p>
              <p class="mt-1 text-sm text-[var(--muted)]">{option.detail}</p>
            </div>
            <Button variant="outline" size="sm" type="button">Export</Button>
          </article>
        {/each}
      </CardContent>
    </Card>
  {:else if selectedSection === "Prices"}
    <Card class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
      <CardHeader>
        <CardTitle class="font-[var(--font-heading)] text-xl">Price tracking</CardTitle>
        <CardDescription>Manual price notes — no store account required.</CardDescription>
      </CardHeader>
      <CardContent class="grid gap-2">
        {#each priceAlerts as alert (alert.item)}
          <article class="mini-app-row">
            <div class="min-w-0">
              <p class="font-medium text-[var(--foreground)]">{alert.item}</p>
              <p class="mt-1 text-sm text-[var(--muted)]">{alert.store}</p>
            </div>
            <span class="text-sm font-medium text-[var(--primary)]">{alert.change}</span>
          </article>
        {/each}
      </CardContent>
    </Card>
  {:else if selectedSection === "Recipes"}
    <Card class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
      <CardHeader>
        <CardTitle class="font-[var(--font-heading)] text-xl">From recipes</CardTitle>
        <CardDescription>Meal-plan bundles ready to merge into your list.</CardDescription>
      </CardHeader>
      <CardContent class="grid gap-2">
        {#each recipeLinks as link (link.title)}
          <article class="mini-app-row">
            <div class="min-w-0">
              <p class="font-medium text-[var(--foreground)]">{link.title}</p>
              <p class="mt-1 text-sm text-[var(--muted)]">{link.items}</p>
            </div>
            <Button variant="outline" size="sm" type="button">Add all</Button>
          </article>
        {/each}
      </CardContent>
    </Card>
  {:else if selectedSection === "Sections"}
    <Card class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
      <CardHeader>
        <CardTitle class="font-[var(--font-heading)] text-xl">Store sections</CardTitle>
        <CardDescription>Grouped by aisle for faster in-store runs.</CardDescription>
      </CardHeader>
      <CardContent class="grid gap-4">
        {#each sectionGroups as group (group.category)}
          <div class="mini-app-board">
            <p class="text-xs font-semibold tracking-[0.14em] text-[var(--muted)] uppercase">{group.category}</p>
            <ul class="mt-3 space-y-2 text-sm text-[var(--foreground)]">
              {#each group.items as name (name)}
                <li class="mini-app-row py-2">{name}</li>
              {/each}
            </ul>
          </div>
        {/each}
      </CardContent>
    </Card>
  {:else if selectedSection === "Shared"}
    <Card class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
      <CardHeader>
        <CardTitle class="font-[var(--font-heading)] text-xl">Shared lists</CardTitle>
        <CardDescription>Family and roommate lists synced via link.</CardDescription>
      </CardHeader>
      <CardContent class="grid gap-2">
        {#each sharedLists as list (list.id)}
          <article class="mini-app-row">
            <div class="min-w-0">
              <p class="font-medium text-[var(--foreground)]">{list.name}</p>
              <p class="mt-1 text-sm text-[var(--muted)]">{list.members} members · {list.items} items</p>
            </div>
            <Button variant="outline" size="sm" type="button">Open</Button>
          </article>
        {/each}
      </CardContent>
    </Card>
  {:else}
    <Card class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
      <CardHeader class="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <div>
          <CardTitle class="flex items-center gap-2 font-[var(--font-heading)] text-xl">
            {currentList}
            <ChevronDownIcon class="size-5 text-[var(--muted)]" />
          </CardTitle>
          <CardDescription>Add items by typing or voice — checked items move below.</CardDescription>
        </div>
      </CardHeader>
      <CardContent class="grid gap-4">
        <form class="flex gap-2" onsubmit={addItem}>
          <Input bind:value={newItem} placeholder="Add item…" class="flex-1" />
          <Button variant="outline" type="button" aria-label="Voice add">
            <MicIcon class="size-4" />
          </Button>
          <Button type="submit">Add</Button>
        </form>

        {#if uncheckedItems.length === 0}
          <div class="flex flex-col items-center gap-3 py-12 text-[var(--muted)]">
            <ShoppingCartIcon class="size-12 opacity-60" />
            <p>Your list is empty.</p>
          </div>
        {:else}
          <div class="grid gap-2">
            {#each uncheckedItems as item (item.id)}
              <button type="button" class="mini-app-row w-full text-left" onclick={() => toggleItem(item.id)}>
                <span
                  class="flex size-10 shrink-0 items-center justify-center rounded-md border border-[var(--border)]"
                  aria-hidden="true"
                ></span>
                <div class="min-w-0 flex-1">
                  <p class="font-medium text-[var(--foreground)]">{item.name}</p>
                  <p class="text-xs font-semibold tracking-wide text-[var(--muted)] uppercase">{item.category}</p>
                </div>
                <span class="shrink-0 text-sm text-[var(--muted)]">{item.quantity}</span>
              </button>
            {/each}
          </div>
        {/if}

        {#if checkedCount > 0}
          <div class="border-t border-[color:color-mix(in_srgb,var(--border)_86%,transparent)] pt-4">
            <div class="mb-3 flex items-center justify-between">
              <h3 class="text-sm font-semibold tracking-wide text-[var(--muted)] uppercase">Checked ({checkedCount})</h3>
              <Button variant="ghost" size="sm" type="button" onclick={clearChecked}>
                <Trash2Icon data-icon="inline-start" />
                Clear
              </Button>
            </div>
            <div class="grid gap-2 opacity-70">
              {#each checkedItems as item (item.id)}
                <button type="button" class="mini-app-row w-full text-left" onclick={() => toggleItem(item.id)}>
                  <CheckCircle2Icon class="size-6 shrink-0 text-[var(--primary)]" />
                  <div class="min-w-0 flex-1">
                    <p class="font-medium text-[var(--foreground)] line-through">{item.name}</p>
                    <p class="text-xs text-[var(--muted)] uppercase">{item.category}</p>
                  </div>
                  <span class="shrink-0 text-sm text-[var(--muted)]">{item.quantity}</span>
                </button>
              {/each}
            </div>
          </div>
        {/if}
      </CardContent>
    </Card>
  {/if}
</MiniAppRoot>
