<script lang="ts">
  import { browser } from "$app/environment";
  import { onMount } from "svelte";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import SparklesIcon from "@lucide/svelte/icons/sparkles";
  import SearchIcon from "@lucide/svelte/icons/search";
  import CheckCircle2Icon from "@lucide/svelte/icons/check-circle-2";
  import CircleIcon from "@lucide/svelte/icons/circle";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import MicIcon from "@lucide/svelte/icons/mic";
  import ScanLineIcon from "@lucide/svelte/icons/scan-line";
  import ShoppingCartIcon from "@lucide/svelte/icons/shopping-cart";
  import RefrigeratorIcon from "@lucide/svelte/icons/refrigerator";
  import AlertTriangleIcon from "@lucide/svelte/icons/alert-triangle";
  import CalendarIcon from "@lucide/svelte/icons/calendar";
  import WalletIcon from "@lucide/svelte/icons/wallet";
  import TrendingDownIcon from "@lucide/svelte/icons/trending-down";
  import TagIcon from "@lucide/svelte/icons/tag";
  import DownloadIcon from "@lucide/svelte/icons/download";
  import SettingsIcon from "@lucide/svelte/icons/settings";
  import UtensilsIcon from "@lucide/svelte/icons/utensils";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from "$lib/components/ui/card/index.js";
  import { activeBundle, createTranslator } from "$lib/i18n";
  import { time } from "$lib/utils/time";
  import PremiumRing from "$lib/components/charts/PremiumRing.svelte";
  import {
    deleteFromIndex,
    indexContent,
    searchInModule,
    type SearchDocument,
  } from "$lib/services/search";
  import {
    ensureModuleSection,
    getModuleSectionLabel,
    moduleSectionStore,
    setModuleSection,
  } from "$lib/stores/module-sections.store";

  const moduleId = "grocery";
  const sectionLabels = ["Shop", "Pantry", "Meal Plan", "Budget", "History", "Settings"] as const;

  let _t = $derived.by(() => createTranslator($activeBundle));

  let selectedSection = $derived(getModuleSectionLabel($moduleSectionStore, moduleId, sectionLabels) as typeof sectionLabels[number]);

  let displaySection = $derived.by(() => {
    const map: Record<string, string> = {
      "Shop": _t('moduleGrocerySectionShop'),
      "Pantry": _t('moduleGrocerySectionPantry'),
      "Meal Plan": _t('moduleGrocerySectionMealPlan'),
      "Budget": _t('moduleGrocerySectionBudget'),
      "History": _t('moduleGrocerySectionHistory'),
      "Settings": _t('moduleGrocerySectionSettings'),
    };
    return map[selectedSection] ?? selectedSection;
  });

  onMount(() => {
    ensureModuleSection(moduleId, sectionLabels);
    void syncGroceryIndex(items);
  });

  $effect(() => {
    const query = searchQuery.trim();
    if (!query) {
      searchMatchedItemIds = null;
      return;
    }

    const ticket = ++searchTicket;
    void (async () => {
      const hits = await searchInModule(moduleId, {
        query,
        limit: 100,
        fuzzy: true,
      });
      if (ticket !== searchTicket) return;
      searchMatchedItemIds = new Set(hits.map(({ document }) => document.id));
    })();
  });

  function navigateToSection(section: typeof sectionLabels[number]) {
    setModuleSection(moduleId, section, sectionLabels);
  }

  function grocerySearchDocument(item: GroceryItem): SearchDocument {
    return {
      moduleId,
      id: item.id,
      title: item.name,
      body: [
        item.name,
        item.quantity,
        item.unit,
        item.category,
        item.notes,
        item.priority,
        item.checked ? "checked" : "unchecked",
        activeListName,
      ]
        .filter(Boolean)
        .join(" "),
      tags: [item.category, item.priority],
      projects: [activeListName],
      kind: "shopping-item",
      createdAt: null,
      updatedAt: null,
      sourceRef: item.id,
      extra: {
        quantity: item.quantity,
        unit: item.unit,
        category: item.category,
        checked: item.checked,
        priority: item.priority,
        notes: item.notes,
        list: activeListName,
      },
    };
  }

  async function syncGroceryIndex(nextItems: GroceryItem[] = items) {
    if (!browser) return;
    const nextIds = new Set(nextItems.map((item) => item.id));
    const staleIds = [...indexedItemIds].filter((id) => !nextIds.has(id));
    await Promise.all([
      ...nextItems.map((item) => indexContent(grocerySearchDocument(item))),
      ...staleIds.map((id) => deleteFromIndex(moduleId, id)),
    ]);
    indexedItemIds = nextIds;
  }

  function setItems(nextItems: GroceryItem[]) {
    items = nextItems;
    void syncGroceryIndex(nextItems);
  }

  // ── Types ────────────────────────────────────────────────────────
  type GroceryItem = {
    id: string;
    name: string;
    quantity: string;
    unit: string;
    category: string;
    checked: boolean;
    priority: "high" | "normal" | "low";
    notes: string;
  };

  type PantryItem = {
    id: string;
    name: string;
    quantity: string;
    location: "fridge" | "freezer" | "pantry";
    expiryDays: number;
    category: string;
  };

  type MealDay = {
    day: string;
    breakfast: string;
    lunch: string;
    dinner: string;
    pantryMatch: number;
  };

  // ── Shopping List State ──────────────────────────────────────────
  let newItemName = $state("");
  let newItemQty = $state("1");
  let newItemUnit = $state("pc");
  let newItemCategory = $state("PRODUCE");
  let searchQuery = $state("");
  let activeListName = "Weekly Shop";
  let searchMatchedItemIds = $state<Set<string> | null>(null);
  let searchTicket = 0;
  let indexedItemIds = new Set<string>();

  let items: GroceryItem[] = $state([
    { id: "1", name: "Oat Milk", quantity: "2", unit: "liters", category: "DAIRY", checked: false, priority: "normal", notes: "" },
    { id: "2", name: "Bananas", quantity: "1", unit: "bunch", category: "PRODUCE", checked: false, priority: "high", notes: "Ripe ones" },
    { id: "3", name: "Sourdough Bread", quantity: "1", unit: "loaf", category: "BAKERY", checked: false, priority: "normal", notes: "" },
    { id: "4", name: "Chicken Breast", quantity: "1", unit: "kg", category: "MEAT", checked: true, priority: "normal", notes: "" },
    { id: "5", name: "Frozen Peas", quantity: "2", unit: "bags", category: "FROZEN", checked: true, priority: "low", notes: "" },
    { id: "6", name: "Greek Yogurt", quantity: "500", unit: "g", category: "DAIRY", checked: false, priority: "high", notes: "Full fat" },
    { id: "7", name: "Olive Oil", quantity: "1", unit: "bottle", category: "PANTRY", checked: false, priority: "normal", notes: "" },
  ]);

  const categories = ["PRODUCE", "DAIRY", "MEAT", "BAKERY", "FROZEN", "PANTRY", "BEVERAGES", "SNACKS", "OTHER"];

  let filteredItems = $derived.by(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return items;
    if (searchMatchedItemIds) {
      const matchedIds = searchMatchedItemIds;
      return items.filter((item) => matchedIds.has(item.id));
    }
    return items.filter((item) =>
      item.name.toLowerCase().includes(query)
      || item.quantity.toLowerCase().includes(query)
      || item.unit.toLowerCase().includes(query)
      || item.category.toLowerCase().includes(query)
      || item.notes.toLowerCase().includes(query));
  });
  let uncheckedItems = $derived(filteredItems.filter(i => !i.checked));
  let checkedItems = $derived(filteredItems.filter(i => i.checked));
  let checkedCount = $derived(items.filter(i => i.checked).length);
  let totalItems = $derived(items.length);
  let progress = $derived(totalItems > 0 ? Math.round((checkedCount / totalItems) * 100) : 0);

  // Group unchecked by category
  let groupedUnchecked = $derived(categories.reduce((acc, cat) => {
    const catItems = uncheckedItems.filter(i => i.category === cat);
    if (catItems.length > 0) acc[cat] = catItems;
    return acc;
  }, {} as Record<string, GroceryItem[]>));

  function toggleItem(id: string) {
    setItems(items.map((item) => item.id === id ? { ...item, checked: !item.checked } : item));
  }

  function deleteItem(id: string) {
    setItems(items.filter((item) => item.id !== id));
  }

  function clearChecked() {
    setItems(items.filter((i) => !i.checked));
  }

  function addItem(e: Event) {
    e.preventDefault();
    if (!newItemName.trim()) return;
    setItems([
      {
        id: time.now().toString(),
        name: newItemName.trim(),
        quantity: newItemQty,
        unit: newItemUnit,
        category: newItemCategory,
        checked: false,
        priority: "normal",
        notes: "",
      },
      ...items,
    ]);
    newItemName = "";
    newItemQty = "1";
    newItemUnit = "pc";
    newItemCategory = "PRODUCE";
  }

  // ── Pantry State ─────────────────────────────────────────────────
  let pantryItems: PantryItem[] = [
    { id: "p1", name: "Whole Milk", quantity: "1L", location: "fridge", expiryDays: 2, category: "DAIRY" },
    { id: "p2", name: "Cheddar Cheese", quantity: "200g", location: "fridge", expiryDays: 7, category: "DAIRY" },
    { id: "p3", name: "Spinach", quantity: "150g", location: "fridge", expiryDays: 1, category: "PRODUCE" },
    { id: "p4", name: "Chicken Thighs", quantity: "500g", location: "freezer", expiryDays: 45, category: "MEAT" },
    { id: "p5", name: "Pasta", quantity: "500g", location: "pantry", expiryDays: 180, category: "PANTRY" },
    { id: "p6", name: "Tomato Sauce", quantity: "1 jar", location: "pantry", expiryDays: 60, category: "PANTRY" },
    { id: "p7", name: "Rice", quantity: "2kg", location: "pantry", expiryDays: 365, category: "PANTRY" },
    { id: "p8", name: "Frozen Berries", quantity: "400g", location: "freezer", expiryDays: 90, category: "FROZEN" },
  ];

  let expiringItems = $derived(pantryItems.filter(p => p.expiryDays <= 3).sort((a, b) => a.expiryDays - b.expiryDays));
  let fridgeItems = $derived(pantryItems.filter(p => p.location === "fridge"));
  let freezerItems = $derived(pantryItems.filter(p => p.location === "freezer"));
  let pantryShelfItems = $derived(pantryItems.filter(p => p.location === "pantry"));

  function expiryLabel(days: number): string {
    if (days <= 0) return _t('moduleGroceryExpired');
    if (days === 1) return _t('moduleGroceryExpiresTomorrow');
    if (days <= 3) return _t('moduleGroceryExpiresInDays', { days: String(days) });
    return _t('moduleGroceryDaysLeft', { days: String(days) });
  }

  function expiryBadge(days: number): "destructive" | "secondary" | "outline" {
    if (days <= 1) return "destructive";
    if (days <= 3) return "secondary";
    return "outline";
  }

  // ── Meal Plan State ──────────────────────────────────────────────
  let mealPlan: MealDay[] = [
    { day: "Mon", breakfast: "Oats & Berries", lunch: "Chicken Salad", dinner: "Pasta Bolognese", pantryMatch: 4 },
    { day: "Tue", breakfast: "Greek Yogurt", lunch: "Soup & Bread", dinner: "Stir Fry", pantryMatch: 3 },
    { day: "Wed", breakfast: "Avocado Toast", lunch: "Leftovers", dinner: "Grilled Salmon", pantryMatch: 2 },
    { day: "Thu", breakfast: "Oats & Banana", lunch: "Tuna Wrap", dinner: "Chicken Curry", pantryMatch: 5 },
    { day: "Fri", breakfast: "Eggs & Toast", lunch: "Caesar Salad", dinner: "Pizza Night", pantryMatch: 1 },
    { day: "Sat", breakfast: "Pancakes", lunch: "Sandwiches", dinner: "Beef Stew", pantryMatch: 3 },
    { day: "Sun", breakfast: "Full English", lunch: "Roast Dinner", dinner: "Light Salad", pantryMatch: 4 },
  ];

  let selectedMealDay = $state("Mon");

  let selectedDayPlan = $derived(mealPlan.find(m => m.day === selectedMealDay) ?? mealPlan.find(m => m.day === "Mon") ?? mealPlan[0]);

  // ── Budget State ─────────────────────────────────────────────────
  let budgetWeekly = 120;
  let spentThisWeek = 84;
  let budgetRemaining = $derived(Math.max(budgetWeekly - spentThisWeek, 0));
  let budgetPercent = $derived(Math.min(Math.round((spentThisWeek / budgetWeekly) * 100), 100));

  const spendingHistory = [
    { week: "Wk 1", spent: 98 },
    { week: "Wk 2", spent: 112 },
    { week: "Wk 3", spent: 76 },
    { week: "Wk 4", spent: 84 },
  ];

  const categorySpend = [
    { cat: "Produce", amount: 22 },
    { cat: "Dairy", amount: 18 },
    { cat: "Meat", amount: 28 },
    { cat: "Bakery", amount: 8 },
    { cat: "Other", amount: 8 },
  ];

  // ── History State ────────────────────────────────────────────────
  const purchaseHistory = [
    { date: "May 19", store: "Whole Foods", total: 48.50, items: 12 },
    { date: "May 14", store: "Trader Joe's", total: 35.20, items: 9 },
    { date: "May 7", store: "Costco", total: 92.80, items: 18 },
    { date: "Apr 30", store: "Whole Foods", total: 41.00, items: 10 },
    { date: "Apr 23", store: "Trader Joe's", total: 29.60, items: 7 },
  ];

  const frequentItems = [
    { name: "Oat Milk", count: 8, category: "DAIRY" },
    { name: "Bananas", count: 12, category: "PRODUCE" },
    { name: "Sourdough", count: 6, category: "BAKERY" },
    { name: "Chicken Breast", count: 9, category: "MEAT" },
    { name: "Greek Yogurt", count: 7, category: "DAIRY" },
    { name: "Olive Oil", count: 4, category: "PANTRY" },
  ];

  // ── Settings State ───────────────────────────────────────────────
  const dietaryProfiles = ["None", "Vegan", "Vegetarian", "Keto", "Gluten-Free", "Halal", "Kosher"];
  let activeDiet = $state("None");
  let notifyExpiry = $state(true);
  let notifyRestock = $state(true);
  let defaultStore = $state("Whole Foods");
  const stores = ["Whole Foods", "Trader Joe's", "Costco", "Walmart", "Target", "Aldi"];
</script>

<main class="grocery-workspace module-root" data-module="grocery">
  <section class="grocery-shell">

    <!-- ── Header ──────────────────────────────────────────────── -->
    <header class="grocery-shell__header">
      <div class="grocery-shell__intro">
        <div class="grocery-shell__eyebrow">
          <span>{_t('moduleGroceryTitle')}</span>
          <Badge variant="outline">{displaySection}</Badge>
        </div>
        <h1>{_t('moduleGroceryDesc')}</h1>
        <p>{_t('moduleGrocerySubtitle')}</p>
      </div>
      <div class="grocery-shell__actions">
        <Button variant="outline" onclick={() => navigateToSection("Pantry")}>
          <RefrigeratorIcon data-icon="inline-start" />
          {_t('moduleGrocerySectionPantry')}
        </Button>
        <Button onclick={() => navigateToSection("Meal Plan")}>
          <SparklesIcon data-icon="inline-start" />
          {_t('moduleGrocerySectionMealPlan')}
        </Button>
      </div>
    </header>

    <!-- ── Hero Stats Grid ──────────────────────────────────────── -->
    <section class="grocery-hero-grid">
      <Card class="grocery-stat-card">
        <CardHeader>
          <CardTitle>{_t('moduleGroceryThisWeek')}</CardTitle>
          <CardDescription>{_t('moduleGroceryShoppingProgress')}</CardDescription>
        </CardHeader>
        <CardContent class="grocery-stat-card__content">
          <div class="grocery-progress-ring">
            <PremiumRing
              size={148}
              thickness={12}
              segments={[{ value: progress, color: "var(--mod-accent)", label: "Checked" }]}
              centerLabel={_t('moduleGroceryThisWeek')}
              centerValue={`${progress}%`}
              centerNote={`${checkedCount}/${totalItems}`}
            />
          </div>
          <div class="grocery-stat-card__meta">
            <article><strong>{checkedCount}</strong><span>{_t('moduleGroceryChecked')}</span></article>
            <article><strong>{totalItems - checkedCount}</strong><span>{_t('moduleGroceryRemaining')}</span></article>
          </div>
        </CardContent>
      </Card>

      <Card class="grocery-hero-card grocery-hero-card--warn">
        <CardHeader>
          <CardTitle>{_t('moduleGroceryExpiringSoon')}</CardTitle>
          <CardDescription>{_t('moduleGroceryExpiringDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <strong>{expiringItems.length}</strong>
          <span>{_t('moduleGroceryInPantry')}</span>
        </CardContent>
      </Card>

      <Card class="grocery-hero-card grocery-hero-card--budget">
        <CardHeader>
          <CardTitle>{_t('moduleGroceryBudgetLeft')}</CardTitle>
          <CardDescription>{_t('moduleGroceryBudgetDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <strong>${budgetRemaining}</strong>
          <span>{_t('moduleGroceryOf')} ${budgetWeekly}</span>
        </CardContent>
      </Card>

      <Card class="grocery-hero-card grocery-hero-card--pantry">
        <CardHeader>
          <CardTitle>{_t('moduleGroceryPantryItems')}</CardTitle>
          <CardDescription>{_t('moduleGroceryPantryDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <strong>{pantryItems.length}</strong>
          <span>{_t('moduleGroceryItemsStored')}</span>
        </CardContent>
      </Card>
    </section>

    <!-- ── Section Body ─────────────────────────────────────────── -->
    <section class="grocery-shell__body">

      <!-- ════════════════ SHOP ════════════════ -->
      {#if selectedSection === "Shop"}
        <div class="grocery-two-col">

          <!-- Add Item Panel -->
          <Card class="grocery-panel">
            <CardHeader>
              <CardTitle>{_t('moduleGroceryAddToList')}</CardTitle>
              <CardDescription>{_t('moduleGroceryAddToListDesc')}</CardDescription>
            </CardHeader>
            <CardContent class="grocery-add-form">
              <form onsubmit={addItem} class="grocery-add-form__fields">
                <div class="grocery-add-form__row grocery-add-form__row--main">
                  <Input
                    bind:value={newItemName}
                    placeholder={_t('moduleGroceryItemPlaceholder')}
                    class="grocery-input--name"
                  />
                  <button type="button" class="grocery-icon-btn" title={_t('moduleGroceryVoiceAdd')}>
                    <MicIcon size={18} />
                  </button>
                  <button type="button" class="grocery-icon-btn" title={_t('moduleGroceryBarcodeScan')}>
                    <ScanLineIcon size={18} />
                  </button>
                </div>
                <div class="grocery-add-form__row">
                  <Input bind:value={newItemQty} placeholder={_t('moduleGroceryQtyPlaceholder')} class="grocery-input--qty" />
                  <select bind:value={newItemUnit} class="grocery-select">
                    {#each ["pc", "g", "kg", "ml", "L", "bag", "box", "bunch", "bottle", "loaf", "can"] as u}
                      <option value={u}>{u}</option>
                    {/each}
                  </select>
                  <select bind:value={newItemCategory} class="grocery-select grocery-select--cat">
                    {#each categories as cat}
                      <option value={cat}>{cat}</option>
                    {/each}
                  </select>
                </div>
                <Button type="submit" class="grocery-add-btn">
                  <PlusIcon data-icon="inline-start" />
                  {_t('moduleGroceryAddItem')}
                </Button>
              </form>

              <!-- Frequent items quick-add -->
              <div class="grocery-quick-add">
                <span class="grocery-quick-add__label">{_t('moduleGroceryFrequent')}</span>
                <div class="grocery-quick-add__chips">
                  {#each frequentItems.slice(0, 4) as fi}
                    <button
                      type="button"
                      class="grocery-chip"
                      onclick={() => { newItemName = fi.name; }}
                    >
                      + {fi.name}
                    </button>
                  {/each}
                </div>
              </div>
            </CardContent>
          </Card>

          <!-- Search Panel -->
          <Card class="grocery-panel">
            <CardHeader>
              <CardTitle>{activeListName}</CardTitle>
              <CardDescription>{uncheckedItems.length} {_t('moduleGroceryRemaining')} · {checkedCount} {_t('moduleGroceryCheckedOff')}</CardDescription>
            </CardHeader>
            <CardContent class="grocery-list-panel">
              <div class="grocery-search-row">
                <SearchIcon size={16} class="grocery-search-icon" />
                <Input
                  bind:value={searchQuery}
                  placeholder={_t('moduleGrocerySearchPlaceholder')}
                  class="grocery-search-input"
                />
              </div>

              <div class="grocery-list-scroll">
                <!-- Grouped by category -->
                {#each Object.entries(groupedUnchecked) as [cat, catItems]}
                  <div class="grocery-category-group">
                    <span class="grocery-category-label">{cat}</span>
                    {#each catItems as item (item.id)}
                      <div
                        class="grocery-item"
                        class:grocery-item--high={item.priority === "high"}
                        role="button"
                        tabindex="0"
                        onclick={() => toggleItem(item.id)}
                        onkeydown={(e) => e.key === "Enter" && toggleItem(item.id)}
                      >
                        <CircleIcon size={20} class="grocery-item__check-idle" />
                        <div class="grocery-item__body">
                          <span class="grocery-item__name">{item.name}</span>
                          {#if item.notes}
                            <span class="grocery-item__note">{item.notes}</span>
                          {/if}
                        </div>
                        <span class="grocery-item__qty">{item.quantity} {item.unit}</span>
                        <button
                          type="button"
                          class="grocery-item__delete"
                          onclick={(e) => { e.stopPropagation(); deleteItem(item.id); }}
                        >
                          <Trash2Icon size={14} />
                        </button>
                      </div>
                    {/each}
                  </div>
                {/each}

                {#if uncheckedItems.length === 0 && !searchQuery}
                  <div class="grocery-empty">
                    <ShoppingCartIcon size={40} />
                    <p>{_t('moduleGroceryListEmpty')}</p>
                  </div>
                {/if}

                <!-- Checked section -->
                {#if checkedItems.length > 0}
                  <div class="grocery-checked-section">
                    <div class="grocery-checked-header">
                      <span>{_t('moduleGroceryCheckedCount', { count: String(checkedCount) })}</span>
                      <button type="button" class="grocery-text-btn" onclick={clearChecked}>
                        <Trash2Icon size={14} /> {_t('moduleGroceryClearAll')}
                      </button>
                    </div>
                    {#each checkedItems as item (item.id)}
                      <div
                        class="grocery-item grocery-item--checked"
                        role="button"
                        tabindex="0"
                        onclick={() => toggleItem(item.id)}
                        onkeydown={(e) => e.key === "Enter" && toggleItem(item.id)}
                      >
                        <CheckCircle2Icon size={20} class="grocery-item__check-done" />
                        <div class="grocery-item__body">
                          <span class="grocery-item__name">{item.name}</span>
                        </div>
                        <span class="grocery-item__qty">{item.quantity} {item.unit}</span>
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
            </CardContent>
          </Card>
        </div>

      <!-- ════════════════ PANTRY ════════════════ -->
      {:else if selectedSection === "Pantry"}
        <div class="grocery-two-col">

          <!-- Expiring alerts -->
          <Card class="grocery-panel">
            <CardHeader>
              <CardTitle>{_t('moduleGroceryExpiringSoon')}</CardTitle>
              <CardDescription>{_t('moduleGroceryExpiringThisWeek')}</CardDescription>
            </CardHeader>
            <CardContent class="grocery-pantry-list">
              {#if expiringItems.length === 0}
                <div class="grocery-empty"><p>{_t('moduleGroceryNoExpiring')}</p></div>
              {/if}
              {#each expiringItems as item}
                <article class="grocery-pantry-item">
                  <AlertTriangleIcon size={16} />
                  <div>
                    <strong>{item.name}</strong>
                    <p>{item.quantity} · {item.location}</p>
                  </div>
                  <Badge variant={expiryBadge(item.expiryDays)}>{expiryLabel(item.expiryDays)}</Badge>
                </article>
              {/each}
            </CardContent>
          </Card>

          <!-- Pantry locations -->
          <Card class="grocery-panel">
            <CardHeader>
              <CardTitle>{_t('moduleGroceryInventory')}</CardTitle>
              <CardDescription>{_t('moduleGroceryInventoryDesc')}</CardDescription>
            </CardHeader>
            <CardContent class="grocery-pantry-locations">

              <div class="grocery-location-group">
                <span class="grocery-location-label">🧊 {_t('moduleGroceryFridge')} ({fridgeItems.length})</span>
                {#each fridgeItems as item}
                  <article class="grocery-pantry-item grocery-pantry-item--compact">
                    <div>
                      <strong>{item.name}</strong>
                      <p>{item.quantity}</p>
                    </div>
                    <Badge variant={expiryBadge(item.expiryDays)}>{item.expiryDays}{_t('moduleGroceryDaysAbbr')}</Badge>
                  </article>
                {/each}
              </div>

              <div class="grocery-location-group">
                <span class="grocery-location-label">❄️ {_t('moduleGroceryFreezer')} ({freezerItems.length})</span>
                {#each freezerItems as item}
                  <article class="grocery-pantry-item grocery-pantry-item--compact">
                    <div>
                      <strong>{item.name}</strong>
                      <p>{item.quantity}</p>
                    </div>
                    <Badge variant="outline">{item.expiryDays}{_t('moduleGroceryDaysAbbr')}</Badge>
                  </article>
                {/each}
              </div>

              <div class="grocery-location-group">
                <span class="grocery-location-label">🗄️ {_t('moduleGroceryShelf')} ({pantryShelfItems.length})</span>
                {#each pantryShelfItems as item}
                  <article class="grocery-pantry-item grocery-pantry-item--compact">
                    <div>
                      <strong>{item.name}</strong>
                      <p>{item.quantity}</p>
                    </div>
                    <Badge variant="outline">{item.expiryDays}d</Badge>
                  </article>
                {/each}
              </div>

            </CardContent>
          </Card>
        </div>

      <!-- ════════════════ MEAL PLAN ════════════════ -->
      {:else if selectedSection === "Meal Plan"}
        <div class="grocery-meal-layout">

          <!-- Day selector -->
          <Card class="grocery-panel grocery-panel--full">
            <CardHeader>
              <CardTitle>{_t('moduleGroceryWeeklyMealPlan')}</CardTitle>
              <CardDescription>{_t('moduleGroceryMealPlanDesc')}</CardDescription>
            </CardHeader>
            <CardContent class="grocery-meal-content">

              <div class="grocery-day-tabs">
                {#each mealPlan as day}
                  <button
                    type="button"
                    class="grocery-day-tab"
                    class:grocery-day-tab--active={selectedMealDay === day.day}
                    onclick={() => selectedMealDay = day.day}
                  >
                    <span>{day.day}</span>
                    <small>{day.pantryMatch} {_t('moduleGroceryMatches')}</small>
                  </button>
                {/each}
              </div>

              <div class="grocery-meal-detail">
                <article class="grocery-meal-slot">
                  <UtensilsIcon size={16} />
                  <div>
                    <strong>{_t('moduleGroceryBreakfast')}</strong>
                    <p>{selectedDayPlan.breakfast}</p>
                  </div>
                  <Badge variant="outline">{selectedDayPlan.pantryMatch} {_t('moduleGroceryPantryItems2')}</Badge>
                </article>
                <article class="grocery-meal-slot">
                  <UtensilsIcon size={16} />
                  <div>
                    <strong>{_t('moduleGroceryLunch')}</strong>
                    <p>{selectedDayPlan.lunch}</p>
                  </div>
                  <Badge variant="outline">–</Badge>
                </article>
                <article class="grocery-meal-slot">
                  <UtensilsIcon size={16} />
                  <div>
                    <strong>{_t('moduleGroceryDinner')}</strong>
                    <p>{selectedDayPlan.dinner}</p>
                  </div>
                  <Badge variant="secondary">{_t('moduleGroceryMissingItems')}</Badge>
                </article>
                <article class="grocery-meal-slot grocery-meal-slot--action">
                  <div>
                    <strong>{_t('moduleGroceryAddMissing')}</strong>
                    <p>{_t('moduleGroceryAddMissingDesc')}</p>
                  </div>
                  <Button variant="outline" onclick={() => navigateToSection("Shop")}>
                    <PlusIcon data-icon="inline-start" />
                    {_t('moduleGroceryAddToShop')}
                  </Button>
                </article>
              </div>

            </CardContent>
          </Card>
        </div>

      <!-- ════════════════ BUDGET ════════════════ -->
      {:else if selectedSection === "Budget"}
        <div class="grocery-two-col">

          <Card class="grocery-panel">
            <CardHeader>
              <CardTitle>{_t('moduleGroceryWeeklyBudget')}</CardTitle>
              <CardDescription>{_t('moduleGroceryWeeklyBudgetDesc')}</CardDescription>
            </CardHeader>
            <CardContent class="grocery-budget-content">
              <div class="grocery-budget-numbers">
                <div>
                  <strong>${spentThisWeek}</strong>
                  <span>{_t('moduleGrocerySpent')}</span>
                </div>
                <div>
                  <strong>${budgetRemaining}</strong>
                  <span>{_t('moduleGroceryRemaining')}</span>
                </div>
                <div>
                  <strong>{budgetPercent}%</strong>
                  <span>{_t('moduleGroceryOfBudget')}</span>
                </div>
              </div>
              <div class="grocery-budget-bar">
                <div class="grocery-budget-bar__fill" style={`--fill:${budgetPercent}%`}></div>
              </div>
              <div class="grocery-category-spend">
                {#each categorySpend as row}
                  <article class="grocery-spend-row">
                    <span>{row.cat}</span>
                    <div class="grocery-spend-bar">
                      <div style={`width:${Math.min((row.amount / spentThisWeek) * 100, 100)}%`}></div>
                    </div>
                    <strong>${row.amount}</strong>
                  </article>
                {/each}
              </div>
            </CardContent>
          </Card>

          <Card class="grocery-panel">
            <CardHeader>
              <CardTitle>{_t('moduleGrocerySpendingHistory')}</CardTitle>
              <CardDescription>{_t('moduleGrocerySpendingHistoryDesc')}</CardDescription>
            </CardHeader>
            <CardContent class="grocery-history-content">
              <div class="grocery-spend-chart">
                {#each spendingHistory as row}
                  <article>
                    <span>{row.week}</span>
                    <i style={`--bar:${Math.max((row.spent / 130) * 100, 12)}px`}></i>
                    <strong>${row.spent}</strong>
                  </article>
                {/each}
              </div>
              <div class="grocery-trip-list">
                {#each purchaseHistory.slice(0, 4) as trip}
                  <article class="grocery-trip-row">
                    <div>
                      <strong>{trip.store}</strong>
                      <p>{trip.date} · {trip.items} {_t('moduleGroceryItems')}</p>
                    </div>
                    <strong>${trip.total.toFixed(2)}</strong>
                  </article>
                {/each}
              </div>
            </CardContent>
          </Card>
        </div>

      <!-- ════════════════ HISTORY ════════════════ -->
      {:else if selectedSection === "History"}
        <div class="grocery-two-col">

          <Card class="grocery-panel">
            <CardHeader>
              <CardTitle>{_t('moduleGroceryPurchaseHistory')}</CardTitle>
              <CardDescription>{_t('moduleGroceryPurchaseHistoryDesc')}</CardDescription>
            </CardHeader>
            <CardContent class="grocery-history-trips">
              {#each purchaseHistory as trip}
                <article class="grocery-trip-row grocery-trip-row--full">
                  <TagIcon size={16} />
                  <div>
                    <strong>{trip.store}</strong>
                    <p>{trip.date} · {trip.items} {_t('moduleGroceryItems')}</p>
                  </div>
                  <strong>${trip.total.toFixed(2)}</strong>
                </article>
              {/each}
              <article class="grocery-trip-row grocery-trip-row--export">
                <div>
                  <strong>{_t('moduleGroceryExportHistory')}</strong>
                  <p>{_t('moduleGroceryExportHistoryDesc')}</p>
                </div>
                <Button variant="outline">
                  <DownloadIcon data-icon="inline-start" />
                  {_t('moduleGroceryExport')}
                </Button>
              </article>
            </CardContent>
          </Card>

          <Card class="grocery-panel">
            <CardHeader>
              <CardTitle>{_t('moduleGroceryMostBought')}</CardTitle>
              <CardDescription>{_t('moduleGroceryMostBoughtDesc')}</CardDescription>
            </CardHeader>
            <CardContent class="grocery-frequent-list">
              {#each frequentItems as fi}
                <article class="grocery-frequent-item">
                  <div>
                    <strong>{fi.name}</strong>
                    <p>{fi.count}× {_t('moduleGroceryPurchased')} · {fi.category}</p>
                  </div>
                  <Button
                    variant="outline"
                    onclick={() => {
                      setItems([{ id: time.now().toString(), name: fi.name, quantity: "1", unit: "pc", category: fi.category, checked: false, priority: "normal", notes: "" }, ...items]);
                      navigateToSection("Shop");
                    }}
                  >
                    <PlusIcon size={14} />
                  </Button>
                </article>
              {/each}
            </CardContent>
          </Card>
        </div>

      <!-- ════════════════ SETTINGS ════════════════ -->
      {:else if selectedSection === "Settings"}
        <div class="grocery-two-col">

          <Card class="grocery-panel">
            <CardHeader>
              <CardTitle>{_t('moduleGroceryPreferences')}</CardTitle>
              <CardDescription>{_t('moduleGroceryPreferencesDesc')}</CardDescription>
            </CardHeader>
            <CardContent class="grocery-settings-list">

              <article class="grocery-setting-row">
                <div>
                  <strong>{_t('moduleGroceryDietaryProfile')}</strong>
                  <p>{_t('moduleGroceryDietaryProfileDesc')}</p>
                </div>
                <select bind:value={activeDiet} class="grocery-select">
                  {#each dietaryProfiles as d}
                    <option value={d}>{d}</option>
                  {/each}
                </select>
              </article>

              <article class="grocery-setting-row">
                <div>
                  <strong>{_t('moduleGroceryDefaultStore')}</strong>
                  <p>{_t('moduleGroceryDefaultStoreDesc')}</p>
                </div>
                <select bind:value={defaultStore} class="grocery-select">
                  {#each stores as s}
                    <option value={s}>{s}</option>
                  {/each}
                </select>
              </article>

              <article class="grocery-setting-row">
                <div>
                  <strong>{_t('moduleGroceryExpiryAlerts')}</strong>
                  <p>{_t('moduleGroceryExpiryAlertsDesc')}</p>
                </div>
                <button
                  type="button"
                  class="grocery-toggle"
                  class:grocery-toggle--on={notifyExpiry}
                  onclick={() => notifyExpiry = !notifyExpiry}
                >
                  <span></span>
                </button>
              </article>

              <article class="grocery-setting-row">
                <div>
                  <strong>{_t('moduleGroceryRestockReminders')}</strong>
                  <p>{_t('moduleGroceryRestockRemindersDesc')}</p>
                </div>
                <button
                  type="button"
                  class="grocery-toggle"
                  class:grocery-toggle--on={notifyRestock}
                  onclick={() => notifyRestock = !notifyRestock}
                >
                  <span></span>
                </button>
              </article>

            </CardContent>
          </Card>

          <Card class="grocery-panel">
            <CardHeader>
              <CardTitle>{_t('moduleGroceryListsData')}</CardTitle>
              <CardDescription>{_t('moduleGroceryListsDataDesc')}</CardDescription>
            </CardHeader>
            <CardContent class="grocery-settings-list">
              <article class="grocery-setting-row">
                <div>
                  <strong>{activeListName}</strong>
                  <p>{_t('moduleGroceryActiveItems', { count: String(items.length) })}</p>
                </div>
                <Badge variant="secondary">{_t('moduleGroceryDefault')}</Badge>
              </article>
              <article class="grocery-setting-row">
                <div>
                  <strong>{_t('moduleGroceryPartySupplies')}</strong>
                  <p>{_t('moduleGroceryInactiveItems')}</p>
                </div>
                <Badge variant="outline">{_t('moduleGroceryIdle')}</Badge>
              </article>
              <article class="grocery-setting-row grocery-setting-row--action">
                <div>
                  <strong>{_t('moduleGroceryExportAll')}</strong>
                  <p>{_t('moduleGroceryExportAllDesc')}</p>
                </div>
                <Button variant="outline">
                  <DownloadIcon data-icon="inline-start" />
                  {_t('moduleGroceryExport')}
                </Button>
              </article>
            </CardContent>
          </Card>

        </div>
      {/if}

    </section>
  </section>
</main>

<style>
/* ═══════════════════════════════════════════════════════════════════
   GROCERY CSS — exact card-system pattern (Focus/Habits/Health)
   ═══════════════════════════════════════════════════════════════════ */

.grocery-workspace {
  --mod-accent: #3A7D44;
  --grocery-muted: var(--muted-foreground, var(--muted));
  --grocery-border: var(--border);
  min-height: 100%;
  padding: 32px;
  background: var(--mod-bg, var(--background));
  color: var(--foreground);
  font-family: var(--font-body);
  animation: grocery-in .35s ease;
}
@keyframes grocery-in {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: none; }
}

.grocery-shell {
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 1400px;
}

.grocery-shell__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 24px;
}

.grocery-shell__eyebrow {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: .16em;
  text-transform: uppercase;
  color: var(--grocery-muted);
  margin-bottom: 10px;
}

.grocery-shell__intro h1 {
  margin: 0 0 8px;
  font-size: clamp(1.7rem, 2.6vw, 2.4rem);
  line-height: 1.08;
  font-weight: 700;
}

.grocery-shell__intro p {
  margin: 0;
  font-size: 13px;
  color: var(--grocery-muted);
  max-width: 500px;
}

.grocery-shell__actions {
  display: flex;
  gap: 10px;
  flex-shrink: 0;
}

.grocery-hero-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.grocery-stat-card,
.grocery-hero-card {
  background: var(--card) !important;
  border: none !important;
  box-shadow: none !important;
  border-radius: 20px !important;
}

.grocery-stat-card__content {
  display: flex;
  align-items: center;
  gap: 20px;
}

.grocery-stat-card__meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.grocery-stat-card__meta article {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}
.grocery-stat-card__meta article strong {
  font-size: 20px;
  font-weight: 800;
  line-height: 1;
}
.grocery-stat-card__meta article span {
  font-size: 12px;
  color: var(--grocery-muted);
}

.grocery-hero-card :global(.card-content) {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.grocery-hero-card strong {
  font-size: 28px;
  font-weight: 800;
  line-height: 1;
}
.grocery-hero-card span {
  font-size: 12px;
  color: var(--grocery-muted);
}

.grocery-progress-ring {
  position: relative;
  width: 100px;
  height: 100px;
  flex-shrink: 0;
}
.grocery-progress-ring svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}
.grocery-ring__bg {
  fill: none;
  stroke: color-mix(in srgb, var(--foreground) 10%, transparent);
  stroke-width: 8;
}
.grocery-ring__progress {
  fill: none;
  stroke: var(--mod-accent);
  stroke-width: 8;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.6s ease;
}
.grocery-progress-ring strong {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 800;
  color: var(--mod-accent);
}

.grocery-shell__body {
  display: flex;
  flex-direction: column;
}

.grocery-two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.grocery-panel {
  background: var(--card) !important;
  border: none !important;
  box-shadow: none !important;
  border-radius: 20px !important;
}
.grocery-panel--full {
  grid-column: 1 / -1;
}

.grocery-add-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.grocery-add-form__fields {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.grocery-add-form__row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.grocery-add-form__row--main {
  display: flex;
  align-items: center;
  gap: 8px;
}
.grocery-add-form__row--main .grocery-input--name {
  flex: 1;
}
.grocery-input--name,
.grocery-input--qty {
  flex: 1;
}
.grocery-input--qty {
  max-width: 80px;
}

.grocery-icon-btn {
  width: 38px;
  height: 38px;
  border-radius: 999px;
  border: 1px solid var(--grocery-border);
  background: transparent;
  color: var(--grocery-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color .15s, border-color .15s;
  flex-shrink: 0;
}
.grocery-icon-btn:hover {
  color: var(--foreground);
  border-color: var(--foreground);
}

.grocery-select {
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid var(--grocery-border);
  background: color-mix(in srgb, var(--foreground) 4%, transparent);
  color: var(--foreground);
  font-size: 13px;
  font-family: inherit;
  outline: none;
  cursor: pointer;
  flex-shrink: 1;
}
.grocery-select--cat {
  flex: 1;
}
.grocery-select:focus {
  border-color: var(--mod-accent);
}

.grocery-add-btn {
  align-self: flex-start;
}

.grocery-quick-add {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.grocery-quick-add__label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: var(--grocery-muted);
}
.grocery-quick-add__chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.grocery-chip {
  padding: 4px 12px;
  border-radius: 999px;
  border: 1px solid var(--grocery-border);
  background: transparent;
  color: var(--grocery-muted);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all .15s;
}
.grocery-chip:hover {
  color: var(--foreground);
  border-color: var(--foreground);
}

.grocery-list-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.grocery-search-row {
  display: flex;
  align-items: center;
  gap: 8px;
  position: sticky;
  top: 0;
  z-index: 1;
}
.grocery-search-icon {
  flex-shrink: 0;
  color: var(--grocery-muted);
}
.grocery-search-input {
  flex: 1;
}

.grocery-list-scroll {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 480px;
  overflow-y: auto;
}

.grocery-category-group {
  display: flex;
  flex-direction: column;
}
.grocery-category-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .08em;
  color: var(--grocery-muted);
  padding: 12px 0 6px;
  border-bottom: 1px solid color-mix(in srgb, var(--grocery-border) 60%, transparent);
  margin-bottom: 2px;
}

.grocery-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px dotted color-mix(in srgb, var(--grocery-border) 60%, transparent);
  cursor: pointer;
  transition: opacity .15s;
}
.grocery-item:last-child {
  border-bottom: none;
}
.grocery-item:hover {
  opacity: .8;
}
.grocery-item--high {
  background: color-mix(in srgb, var(--mod-accent) 4%, transparent);
  margin: 0 -6px;
  padding: 10px 6px;
  border-radius: 10px;
}
.grocery-item__check-idle {
  flex-shrink: 0;
  color: var(--grocery-border);
}
.grocery-item__check-done {
  flex-shrink: 0;
  color: var(--mod-accent);
}
.grocery-item__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.grocery-item__name {
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.grocery-item__note {
  font-size: 11px;
  color: var(--grocery-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.grocery-item__qty {
  font-size: 13px;
  color: var(--grocery-muted);
  white-space: nowrap;
  flex-shrink: 0;
}
.grocery-item__delete {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  border: none;
  background: transparent;
  color: var(--grocery-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity .15s, color .15s;
  flex-shrink: 0;
}
.grocery-item:hover .grocery-item__delete {
  opacity: 1;
}
.grocery-item__delete:hover {
  color: var(--destructive, #dc2626);
}

.grocery-item--checked {
  opacity: .5;
}
.grocery-item--checked .grocery-item__name {
  text-decoration: line-through;
}

.grocery-text-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  color: var(--grocery-muted);
  cursor: pointer;
  font-size: 13px;
  padding: 4px 8px;
  border-radius: 8px;
  transition: color .15s, background .15s;
}
.grocery-text-btn:hover {
  color: var(--foreground);
  background: color-mix(in srgb, var(--foreground) 6%, transparent);
}

.grocery-checked-section {
  display: flex;
  flex-direction: column;
  margin-top: 8px;
  border-top: 1px solid var(--grocery-border);
  padding-top: 8px;
}
.grocery-checked-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  font-size: 12px;
  color: var(--grocery-muted);
}

.grocery-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px 0;
  color: var(--grocery-muted);
}
.grocery-empty p {
  margin: 0;
  font-size: 14px;
}

.grocery-pantry-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.grocery-pantry-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px dotted color-mix(in srgb, var(--grocery-border) 60%, transparent);
}
.grocery-pantry-item:last-child {
  border-bottom: none;
}
.grocery-pantry-item > div {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.grocery-pantry-item strong {
  font-size: 14px;
  font-weight: 600;
}
.grocery-pantry-item p {
  margin: 0;
  font-size: 12px;
  color: var(--grocery-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.grocery-pantry-item--compact {
  padding: 8px 0;
}

.grocery-pantry-locations {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.grocery-location-group {
  display: flex;
  flex-direction: column;
}
.grocery-location-label {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: var(--grocery-muted);
  padding-bottom: 6px;
  border-bottom: 1px solid color-mix(in srgb, var(--grocery-border) 60%, transparent);
  margin-bottom: 2px;
}

.grocery-meal-layout {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.grocery-meal-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.grocery-day-tabs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.grocery-day-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 16px;
  border-radius: 12px;
  border: 1px solid var(--grocery-border);
  background: transparent;
  color: var(--grocery-muted);
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all .15s;
  min-width: 72px;
}
.grocery-day-tab small {
  font-size: 10px;
  font-weight: 500;
  color: var(--grocery-muted);
}
.grocery-day-tab:hover {
  border-color: var(--foreground);
  color: var(--foreground);
}
.grocery-day-tab--active {
  background: color-mix(in srgb, var(--mod-accent) 14%, transparent);
  border-color: var(--mod-accent);
  color: var(--foreground);
}
.grocery-day-tab--active small {
  color: var(--mod-accent);
}

.grocery-meal-detail {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.grocery-meal-slot {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px dotted color-mix(in srgb, var(--grocery-border) 60%, transparent);
}
.grocery-meal-slot:last-child {
  border-bottom: none;
}
.grocery-meal-slot > div {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.grocery-meal-slot strong {
  font-size: 14px;
  font-weight: 600;
}
.grocery-meal-slot p {
  margin: 0;
  font-size: 13px;
  color: var(--grocery-muted);
}
.grocery-meal-slot--action {
  background: color-mix(in srgb, var(--mod-accent) 4%, transparent);
  padding: 16px;
  border-radius: 14px;
  border-bottom: none;
  margin-top: 8px;
}

.grocery-budget-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.grocery-budget-numbers {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  text-align: center;
}
.grocery-budget-numbers > div {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.grocery-budget-numbers strong {
  font-size: 26px;
  font-weight: 800;
  line-height: 1;
  color: var(--mod-accent);
}
.grocery-budget-numbers span {
  font-size: 11px;
  color: var(--grocery-muted);
  text-transform: uppercase;
  letter-spacing: .04em;
  font-weight: 600;
}

.grocery-budget-bar {
  height: 8px;
  background: color-mix(in srgb, var(--foreground) 8%, transparent);
  border-radius: 999px;
  overflow: hidden;
}
.grocery-budget-bar__fill {
  height: 100%;
  width: var(--fill, 0%);
  background: var(--mod-accent);
  border-radius: 999px;
  transition: width .4s ease;
}

.grocery-category-spend {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.grocery-spend-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
}
.grocery-spend-row span {
  width: 60px;
  font-weight: 500;
  flex-shrink: 0;
}
.grocery-spend-row strong {
  width: 48px;
  text-align: right;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.grocery-spend-bar {
  flex: 1;
  height: 6px;
  background: color-mix(in srgb, var(--foreground) 6%, transparent);
  border-radius: 999px;
  overflow: hidden;
}
.grocery-spend-bar div {
  height: 100%;
  background: var(--mod-accent);
  border-radius: 999px;
  transition: width .4s ease;
}

.grocery-history-content,
.grocery-history-trips {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.grocery-spend-chart {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  padding: 20px 0;
}
.grocery-spend-chart article {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.grocery-spend-chart span {
  font-size: 12px;
  color: var(--grocery-muted);
  font-weight: 600;
}
.grocery-spend-chart i {
  display: block;
  width: 100%;
  height: var(--bar, 40px);
  background: color-mix(in srgb, var(--mod-accent) 50%, transparent);
  border-radius: 6px 6px 0 0;
  transition: height .4s ease;
}
.grocery-spend-chart strong {
  font-size: 13px;
  font-weight: 700;
}

.grocery-trip-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.grocery-trip-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px dotted color-mix(in srgb, var(--grocery-border) 60%, transparent);
}
.grocery-trip-row:last-child {
  border-bottom: none;
}
.grocery-trip-row > div {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.grocery-trip-row strong {
  font-size: 14px;
  font-weight: 600;
}
.grocery-trip-row p {
  margin: 0;
  font-size: 12px;
  color: var(--grocery-muted);
}

.grocery-trip-row--full {
  padding: 12px 0;
}
.grocery-trip-row--export > div p {
  font-size: 12px;
}

.grocery-frequent-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.grocery-frequent-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px dotted color-mix(in srgb, var(--grocery-border) 60%, transparent);
}
.grocery-frequent-item:last-child {
  border-bottom: none;
}
.grocery-frequent-item > div {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.grocery-frequent-item strong {
  font-size: 14px;
  font-weight: 600;
}
.grocery-frequent-item p {
  margin: 0;
  font-size: 12px;
  color: var(--grocery-muted);
}

.grocery-settings-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.grocery-setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 0;
  border-bottom: 1px dotted color-mix(in srgb, var(--grocery-border) 60%, transparent);
}
.grocery-setting-row:last-child {
  border-bottom: none;
}
.grocery-setting-row > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.grocery-setting-row strong {
  font-size: 14px;
  font-weight: 600;
}
.grocery-setting-row p {
  margin: 0;
  font-size: 12px;
  color: var(--grocery-muted);
}
.grocery-setting-row--action {
  background: color-mix(in srgb, var(--mod-accent) 4%, transparent);
  padding: 16px;
  border-radius: 14px;
  border-bottom: none;
  margin-top: 8px;
}

.grocery-toggle {
  width: 44px;
  height: 24px;
  border-radius: 999px;
  border: none;
  background: color-mix(in srgb, var(--foreground) 16%, transparent);
  cursor: pointer;
  position: relative;
  transition: background .2s;
  flex-shrink: 0;
}
.grocery-toggle--on {
  background: var(--mod-accent);
}
.grocery-toggle span {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--foreground);
  transition: transform .2s ease;
}
.grocery-toggle--on span {
  transform: translateX(20px);
  background: #fff;
}

@media (max-width: 900px) {
  .grocery-workspace {
    padding: 20px;
  }
  .grocery-hero-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .grocery-two-col {
    grid-template-columns: 1fr;
  }
  .grocery-shell__header {
    flex-direction: column;
  }
  .grocery-budget-numbers {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 600px) {
  .grocery-hero-grid {
    grid-template-columns: 1fr;
  }
  .grocery-add-form__row {
    flex-wrap: wrap;
  }
}
</style>
