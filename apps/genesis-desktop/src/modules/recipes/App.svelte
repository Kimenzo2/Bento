<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { activeBundle, createTranslator } from "$lib/i18n";
  import BookOpen from "@lucide/svelte/icons/book-open";
  import Camera from "@lucide/svelte/icons/camera";
  import Check from "@lucide/svelte/icons/check";
  import ChefHat from "@lucide/svelte/icons/chef-hat";
  import ChevronLeft from "@lucide/svelte/icons/chevron-left";
  import Clock from "@lucide/svelte/icons/clock";
  import Download from "@lucide/svelte/icons/download";
  import Flame from "@lucide/svelte/icons/flame";
  import Heart from "@lucide/svelte/icons/heart";
  import Link from "@lucide/svelte/icons/link";
  import Mic from "@lucide/svelte/icons/mic";
  import MicOff from "@lucide/svelte/icons/mic-off";
  import Minus from "@lucide/svelte/icons/minus";
  import PenTool from "@lucide/svelte/icons/pen-tool";
  import Plus from "@lucide/svelte/icons/plus";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import Search from "@lucide/svelte/icons/search";
  import ShoppingCart from "@lucide/svelte/icons/shopping-cart";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import Star from "@lucide/svelte/icons/star";
  import Timer from "@lucide/svelte/icons/timer";
  import Users from "@lucide/svelte/icons/users";
  import X from "@lucide/svelte/icons/x";
  import Zap from "@lucide/svelte/icons/zap";

  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
  } from "$lib/components/ui/card/index.js";
  import { getModuleCatalogEntry } from "$lib/data/module-catalog";
  import { indexContent, searchInModule } from "$lib/services/search";
  import {
    getModuleSectionLabel,
    moduleSectionStore,
    setModuleSection,
  } from "$lib/stores/module-sections.store";

  let { moduleId = "recipes", settings = {} }: { moduleId?: string; settings?: Record<string, unknown> } = $props();
  $effect(() => { void settings; });

  // ── _t helper ─────────────────────────────────────────────────────
  let _t = $derived.by(() => createTranslator($activeBundle));

  // ── Types matching Rust camelCase structs ────────────────────────
  type RawRecipe = {
    id: string; title: string; timeLabel: string; cookTimeMin: number;
    servings: number; calories: number; protein: number; carbs: number; fat: number;
    imageUrl: string; favorite: boolean; meal: string; difficulty: string;
    tags: string[]; dietTags: string[]; allergens: string[];
    rating: number; cookedCount: number; lastCooked: string | null;
    collectionIds: string[]; notes: string;
    ingredients: RawIngredient[]; steps: RawStep[];
    createdAt: number; updatedAt: number;
  };
  type RawIngredient = {
    id: string; recipeId: string; name: string; amount: string;
    amountImperial: string | null; substitutes: string[];
    checked: boolean; position: number;
  };
  type RawStep = {
    id: string; recipeId: string; stepOrder: number; instruction: string;
    durationMin: number | null; videoUrl: string | null; completed: boolean;
  };
  type RawPantry   = { id: string; name: string; category: string; inStock: boolean; lowStock: boolean; updatedAt: number };
  type RawShopping = { id: string; name: string; amount: string; category: string; checked: boolean; fromRecipe: string; createdAt: number };
  type RawMealPlan = { id: string; dayIndex: number; mealType: string; recipeId: string | null; recipeLabel: string; weekKey: string };
  type RawHistory  = { id: string; recipeId: string; recipeTitle: string; cookedAt: number; dateKey: string };
  type RawCollection = { id: string; name: string; emoji: string; color: string; createdAt: number };
  type RawDietProfile = { diets: string[]; allergens: string[]; unit: string };

  // ── Frontend types (unchanged — UI depends on these) ─────────────
  type Ingredient = { id: string; name: string; amount: string; checked: boolean; substitutes?: string[]; amountImperial?: string };
  type Step = { id: string; stepOrder: number; instruction: string; duration?: number; completed: boolean; videoUrl?: string };
  type Recipe = {
    id: string; title: string; time: string; cookTime: number;
    servings: number; calories: number; protein: number; carbs: number; fat: number;
    image: string; favorite: boolean; meal: string;
    difficulty: "Easy" | "Medium" | "Hard";
    tags: string[]; dietTags: string[]; allergens: string[];
    rating: number; cookedCount: number; lastCooked?: string;
    collectionIds: string[]; ingredients: Ingredient[]; steps: Step[]; notes: string;
  };

  // ── Adapter: Rust → Frontend ──────────────────────────────────────
  function mapRecipe(r: RawRecipe): Recipe {
    return {
      id: r.id, title: r.title, time: r.timeLabel, cookTime: r.cookTimeMin,
      servings: r.servings, calories: r.calories, protein: r.protein,
      carbs: r.carbs, fat: r.fat, image: r.imageUrl, favorite: r.favorite,
      meal: r.meal, difficulty: r.difficulty as Recipe["difficulty"],
      tags: r.tags, dietTags: r.dietTags, allergens: r.allergens,
      rating: r.rating, cookedCount: r.cookedCount,
      lastCooked: r.lastCooked ?? undefined, collectionIds: r.collectionIds,
      notes: r.notes,
      ingredients: r.ingredients.map(i => ({
        id: i.id, name: i.name, amount: i.amount, checked: i.checked,
        substitutes: i.substitutes.length ? i.substitutes : undefined,
        amountImperial: i.amountImperial ?? undefined,
      })),
      steps: r.steps.map(s => ({
        id: s.id, stepOrder: s.stepOrder, instruction: s.instruction,
        duration: s.durationMin ?? undefined, completed: false,
        videoUrl: s.videoUrl ?? undefined,
      })),
    };
  }

  function recipeSearchDocument(recipe: Recipe) {
    return {
      moduleId: "recipes",
      id: recipe.id,
      title: recipe.title,
      body: [
        recipe.title,
        recipe.time,
        recipe.meal,
        recipe.difficulty,
        recipe.notes,
        recipe.ingredients.map((item) => `${item.name} ${item.amount}`).join(" "),
        recipe.steps.map((step) => step.instruction).join(" "),
      ]
        .filter((part) => part.trim().length > 0)
        .join("\n"),
      tags: [...recipe.tags, ...recipe.dietTags, ...recipe.allergens].map((value) => value.toLowerCase()),
      projects: recipe.collectionIds.map((value) => value.toLowerCase()),
      kind: recipe.meal,
      createdAt: undefined,
      updatedAt: undefined,
      sourceRef: recipe.id,
      extra: {
        favorite: recipe.favorite,
        rating: recipe.rating,
        cookedCount: recipe.cookedCount,
        servings: recipe.servings,
        calories: recipe.calories,
        protein: recipe.protein,
        carbs: recipe.carbs,
        fat: recipe.fat,
      },
    };
  }

  async function syncRecipeIndex(recipe: Recipe) {
    try {
      await indexContent(recipeSearchDocument(recipe));
    } catch {
      // search should never block core recipes usage
    }
  }

  async function syncAllRecipeIndexes(nextRecipes: Recipe[]) {
    await Promise.all(nextRecipes.map((recipe) => syncRecipeIndex(recipe)));
  }

  // ── Types ─────────────────────────────────────────────────────────
  type Collection = { id: string; name: string; emoji: string; color: string };
  type DietProfile = { diets: string[]; allergens: string[]; unit: "metric" | "imperial"; showAllergenWarnings: boolean };
  type PantryItem = { id: string; name: string; category: string; inStock: boolean; lowStock?: boolean };
  type ShoppingItem = { id: string; name: string; amount: string; category: string; checked: boolean; fromRecipe: string };
  type CookHistoryEntry = { id: string; recipeId: string; recipeTitle: string; date: string };
  type MealSlot = { recipeId: string | null; label: string };
  type DayPlan = { day: string; short: string; dayIndex: number; slots: { breakfast: MealSlot; lunch: MealSlot; dinner: MealSlot } };

  const allDiets     = ["Vegetarian","Vegan","Gluten-Free","Dairy-Free","Keto","Paleo","Halal","Kosher"];
  const allAllergens = ["Gluten","Dairy","Eggs","Nuts","Fish","Shellfish","Soy","Sesame"];

  const DAY_NAMES = [
    { day: "Monday",    short: "Mon" }, { day: "Tuesday",   short: "Tue" },
    { day: "Wednesday", short: "Wed" }, { day: "Thursday",  short: "Thu" },
    { day: "Friday",    short: "Fri" }, { day: "Saturday",  short: "Sat" },
    { day: "Sunday",    short: "Sun" },
  ];

  // ── Loading state ─────────────────────────────────────────────────
  let loading = $state(true);
  let dbError = $state("");

  // ── Live data ─────────────────────────────────────────────────────
  let recipes       = $state<Recipe[]>([]);
  let collections   = $state<Collection[]>([]);
  let activeCollectionId = $state<string | null>(null);
  let pantryItems   = $state<PantryItem[]>([]);
  let shoppingItems = $state<ShoppingItem[]>([]);
  let cookHistory   = $state<CookHistoryEntry[]>([]);
  let mealPlan      = $state<DayPlan[]>(DAY_NAMES.map((d, i) => ({
    ...d, dayIndex: i,
    slots: {
      breakfast: { recipeId: null, label: "" },
      lunch:     { recipeId: null, label: "" },
      dinner:    { recipeId: null, label: "" },
    },
  })));

  // ── Dietary profile ───────────────────────────────────────────────
  let dietProfile = $state<DietProfile>({ diets: [], allergens: [], unit: "metric", showAllergenWarnings: true });
  let showProfilePanel = $state(false);

  async function toggleDiet(d: string) {
    const next = dietProfile.diets.includes(d)
      ? dietProfile.diets.filter(x => x !== d)
      : [...dietProfile.diets, d];
    dietProfile = { ...dietProfile, diets: next };
    await invoke("diet_profile_save", { diets: dietProfile.diets, allergens: dietProfile.allergens, unit: dietProfile.unit }).catch(() => {});
  }

  async function toggleAllergen(a: string) {
    const next = dietProfile.allergens.includes(a)
      ? dietProfile.allergens.filter(x => x !== a)
      : [...dietProfile.allergens, a];
    dietProfile = { ...dietProfile, allergens: next };
    await invoke("diet_profile_save", { diets: dietProfile.diets, allergens: dietProfile.allergens, unit: dietProfile.unit }).catch(() => {});
  }

  function recipeAllergenWarning(r: Recipe): string[] {
    return r.allergens.filter(a => dietProfile.allergens.includes(a));
  }

  // ── Unit conversion ────────────────────────────────────────────────
  let useImperial = $derived(dietProfile.unit === "imperial");
  function getIngAmount(ing: Ingredient): string {
    return useImperial && ing.amountImperial ? ing.amountImperial : ing.amount;
  }

  function applyMealPlanRows(rows: RawMealPlan[]) {
    mealPlan = DAY_NAMES.map((d, i) => {
      const find = (type: string) => rows.find(r => r.dayIndex === i && r.mealType === type);
      const bf = find("breakfast"); const lu = find("lunch"); const di = find("dinner");
      return {
        ...d, dayIndex: i,
        slots: {
          breakfast: { recipeId: bf?.recipeId ?? null, label: bf?.recipeLabel ?? "" },
          lunch:     { recipeId: lu?.recipeId ?? null, label: lu?.recipeLabel ?? "" },
          dinner:    { recipeId: di?.recipeId ?? null, label: di?.recipeLabel ?? "" },
        },
      };
    });
  }

  // ── Recommendation engine (client-side scoring) ────────────────────
  function scoreRecipe(r: Recipe): number {
    const pantryNames = pantryItems.filter(p => p.inStock).map(p => p.name.toLowerCase());
    const needed  = r.ingredients.map(i => i.name.toLowerCase());
    const matched = needed.filter(n => pantryNames.some(p => n.includes(p) || p.includes(n))).length;
    const pantryBonus  = Math.round((matched / Math.max(needed.length, 1)) * 10);
    const allergenHit  = recipeAllergenWarning(r).length > 0 ? -50 : 0;
    const dietBonus    = dietProfile.diets.length === 0 ? 5 : (dietProfile.diets.every(d => r.dietTags.includes(d)) ? 10 : 0);
    const favBonus     = r.favorite ? 15 : 0;
    const recencyMalus = r.lastCooked === new Date().toISOString().slice(0,10) ? -5 : 0;
    return (r.rating * 20) + (r.cookedCount * 3) + pantryBonus + allergenHit + dietBonus + favBonus + recencyMalus;
  }
  let recommendedRecipes = $derived.by(() => [...recipes].filter(r => recipeAllergenWarning(r).length === 0)
    .sort((a, b) => scoreRecipe(b) - scoreRecipe(a)).slice(0, 4));

  // ── "Can make now" ─────────────────────────────────────────────────
  let canMakeRecipes = $derived.by(() => recipes.filter(r => {
    const pantryNames = pantryItems.filter(p => p.inStock && !p.lowStock).map(p => p.name.toLowerCase());
    const missing = r.ingredients.map(i => i.name.toLowerCase())
      .filter(n => !pantryNames.some(p => n.includes(p) || p.includes(n)));
    return missing.length <= 2;
  }));

  // ── DB load ────────────────────────────────────────────────────────
  async function loadAll() {
    loading = true; dbError = "";
    try {
      // 15 second timeout guard — if Tauri bridge isn't ready, fail gracefully
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Tauri IPC timeout — please restart the app")), 15000)
      );

      await Promise.race([invoke("recipes_seed_if_empty"), timeout]);

      const [rawRecipes, rawCollections, rawPantry, rawShopping, rawHistory, rawMeal, rawProfile] =
        await Promise.race([
          Promise.all([
            invoke<RawRecipe[]>("recipes_list"),
            invoke<RawCollection[]>("collections_list"),
            invoke<RawPantry[]>("pantry_list"),
            invoke<RawShopping[]>("shopping_list"),
            invoke<RawHistory[]>("cook_history_list"),
            invoke<RawMealPlan[]>("meal_plan_get"),
            invoke<RawDietProfile>("diet_profile_get"),
          ]),
          timeout,
        ]);

      recipes       = rawRecipes.map(mapRecipe);
      void syncAllRecipeIndexes(recipes);
      collections   = rawCollections;
      pantryItems   = rawPantry.map(p => ({ id: p.id, name: p.name, category: p.category, inStock: p.inStock, lowStock: p.lowStock }));
      shoppingItems = rawShopping.map(s => ({ id: s.id, name: s.name, amount: s.amount, category: s.category, checked: s.checked, fromRecipe: s.fromRecipe }));
      cookHistory   = rawHistory.map(h => ({ id: h.id, recipeId: h.recipeId, recipeTitle: h.recipeTitle, date: h.dateKey }));
      applyMealPlanRows(rawMeal);
      dietProfile   = { diets: rawProfile.diets, allergens: rawProfile.allergens, unit: rawProfile.unit as "metric"|"imperial", showAllergenWarnings: true };
    } catch (e) {
      dbError = String(e);
    } finally {
      loading = false;
    }
  }

  // ── DB action helpers (all buttons call these) ─────────────────────
  async function dbToggleFavorite(recipeId: string) {
    const newVal = await invoke<boolean>("recipe_toggle_favorite", { recipeId }).catch(() => null);
    if (newVal !== null) recipes = recipes.map(r => r.id === recipeId ? { ...r, favorite: newVal } : r);
  }

  async function dbDeleteRecipe(recipeId: string) {
    await invoke("recipe_delete", { recipeId }).catch(() => {});
    recipes = recipes.filter(r => r.id !== recipeId);
    if (selectedRecipeId === recipeId) { selectedRecipeId = null; servingScale = 1; }
  }

  async function dbRateRecipe(recipeId: string, rating: number) {
    await invoke("recipe_rate", { recipeId, rating }).catch(() => {});
    recipes = recipes.map(r => r.id === recipeId ? { ...r, rating } : r);
  }

  async function dbToggleIngredient(ingredientId: string, recipeId: string) {
    const newVal = await invoke<boolean>("recipe_toggle_ingredient", { ingredientId }).catch(() => null);
    if (newVal !== null) {
      recipes = recipes.map(r => r.id !== recipeId ? r : {
        ...r,
        ingredients: r.ingredients.map(i => i.id === ingredientId ? { ...i, checked: newVal } : i),
      });
    }
  }

  async function dbCreateCollection(name: string, emoji: string) {
    const col = await invoke<RawCollection>("collection_create", { name, emoji }).catch(() => null);
    if (col) collections = [...collections, col];
  }

  async function dbDeleteCollection(collectionId: string) {
    await invoke("collection_delete", { collectionId }).catch(() => {});
    collections = collections.filter(c => c.id !== collectionId);
  }

  async function dbTogglePantry(itemId: string) {
    const updated = await invoke<RawPantry>("pantry_toggle", { itemId }).catch(() => null);
    if (updated) pantryItems = pantryItems.map(p => p.id === itemId ? { ...p, inStock: updated.inStock, lowStock: updated.lowStock } : p);
  }

  async function dbToggleShopping(itemId: string) {
    const newVal = await invoke<boolean>("shopping_toggle", { itemId }).catch(() => null);
    if (newVal !== null) shoppingItems = shoppingItems.map(i => i.id === itemId ? { ...i, checked: newVal } : i);
  }

  async function dbDeleteShopping(itemId: string) {
    await invoke("shopping_delete", { itemId }).catch(() => {});
    shoppingItems = shoppingItems.filter(i => i.id !== itemId);
  }

  async function dbClearChecked() {
    await invoke("shopping_clear_checked").catch(() => {});
    shoppingItems = shoppingItems.filter(i => !i.checked);
  }

  async function dbAddToShoppingFromRecipe(recipeId: string) {
    const added = await invoke<RawShopping[]>("shopping_add_from_recipe", { recipeId }).catch(() => [] as RawShopping[]);
    shoppingItems = [...shoppingItems, ...added.map(s => ({ id: s.id, name: s.name, amount: s.amount, category: s.category, checked: s.checked, fromRecipe: s.fromRecipe }))];
  }

  async function dbSetMealSlot(dayIndex: number, mealType: string, recipeId: string | null, recipeLabel: string) {
    if (!recipeId) {
      await invoke("meal_plan_clear_slot", { dayIndex, mealType }).catch(() => {});
    } else {
      await invoke("meal_plan_set", { dayIndex, mealType, recipeId, recipeLabel }).catch(() => {});
    }
    const rows = await invoke<RawMealPlan[]>("meal_plan_get").catch(() => [] as RawMealPlan[]);
    applyMealPlanRows(rows);
  }

  async function dbAutoGenerateMealPlan() {
    const meals = ["breakfast", "lunch", "dinner"];
    const breakfastRecipes = recipes.filter(r => r.meal === "Breakfast");
    const lunchRecipes     = recipes.filter(r => r.meal === "Lunch" || r.meal === "Snack");
    const dinnerRecipes    = recipes.filter(r => r.meal === "Dinner");
    for (let day = 0; day < 7; day++) {
      for (const meal of meals) {
        const pool = meal === "breakfast" ? breakfastRecipes : meal === "lunch" ? lunchRecipes : dinnerRecipes;
        if (!pool.length) continue;
        const pick = pool[Math.floor(Math.random() * pool.length)];
        await invoke("meal_plan_set", { dayIndex: day, mealType: meal, recipeId: pick.id, recipeLabel: pick.title }).catch(() => {});
      }
    }
    const rows = await invoke<RawMealPlan[]>("meal_plan_get").catch(() => [] as RawMealPlan[]);
    applyMealPlanRows(rows);
  }

  async function dbCookAgain(entry: CookHistoryEntry) {
    const r = recipes.find(x => x.id === entry.recipeId);
    if (!r) return;
    const added = await invoke<RawShopping[]>("shopping_add_from_recipe", { recipeId: r.id }).catch(() => [] as RawShopping[]);
    shoppingItems = [...shoppingItems, ...added.map(s => ({ id: s.id, name: s.name, amount: s.amount, category: s.category, checked: s.checked, fromRecipe: s.fromRecipe }))];
  }

  async function dbMarkCooked(recipeId: string, recipeTitle: string) {
    const entry = await invoke<RawHistory>("cook_history_add", { recipeId, recipeTitle }).catch(() => null);
    if (entry) {
      cookHistory = [{ id: entry.id, recipeId: entry.recipeId, recipeTitle: entry.recipeTitle, date: entry.dateKey }, ...cookHistory];
      recipes = recipes.map(r => r.id === recipeId ? { ...r, cookedCount: r.cookedCount + 1, lastCooked: entry.dateKey } : r);
    }
  }

  async function dbSaveRecipeFromManual() {
    if (!manualTitle.trim()) return;
    const ingredientLines = manualIngredients.split("\n").filter(l => l.trim()).map(l => ({
      name: l.trim(), amount: "", amountImperial: null, substitutes: []
    }));
    const stepLines = manualSteps.split("\n").filter(l => l.trim()).map(l => ({
      instruction: l.replace(/^\d+\.\s*/, "").trim(), durationMin: null, videoUrl: null,
    }));
    const raw = await invoke<RawRecipe>("recipe_save", {
      payload: {
        title: manualTitle.trim(), timeLabel: manualTime || "?", cookTimeMin: 0,
        servings: parseInt(manualServings) || 2, calories: 0, protein: 0, carbs: 0, fat: 0,
        imageUrl: "", meal: "Dinner", difficulty: "Easy",
        tags: [], dietTags: [], allergens: [], notes: "",
        ingredients: ingredientLines, steps: stepLines,
      }
    }).catch(() => null);
    if (raw) {
      recipes = [mapRecipe(raw), ...recipes];
      manualTitle = ""; manualTime = ""; manualServings = ""; manualIngredients = ""; manualSteps = "";
      importPhase = "done";
    }
  }

  async function dbToggleUnit() {
    const newUnit = useImperial ? "metric" : "imperial";
    dietProfile = { ...dietProfile, unit: newUnit };
    await invoke("diet_profile_save", { diets: dietProfile.diets, allergens: dietProfile.allergens, unit: newUnit }).catch(() => {});
  }

  async function dbExportAll() {
    const data = JSON.stringify({ recipes, collections, pantryItems, shoppingItems, cookHistory }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `recipes-export-${new Date().toISOString().slice(0,10)}.json`;
    a.click(); URL.revokeObjectURL(url);
  }

  // ── Sidebar wiring ───────────────────────────────────────────────
  const fallbackSections = ["Recipes", "Import", "Cook Mode", "Meal Plan", "Shopping", "Export"] as const;
  let catalogEntry = $derived(getModuleCatalogEntry(moduleId));
  let sectionLabels = $derived(catalogEntry?.sidebar?.items ?? fallbackSections);
  let selectedSection = $derived(getModuleSectionLabel($moduleSectionStore, moduleId, sectionLabels));

  // ── Cook history ──────────────────────────────────────────────────
  async function cookAgain(entry: CookHistoryEntry) {
    await dbCookAgain(entry);
  }

  // ── Voice control ─────────────────────────────────────────────────
  let voiceActive  = $state(false);
  let voiceStatus  = $state("");
  let recognition: any = null;

  function startVoice() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { voiceStatus = "Voice not supported in this browser"; return; }
    recognition = new SpeechRecognition();
    recognition.continuous   = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (e: any) => {
      const cmd = e.results[e.results.length - 1][0].transcript.trim().toLowerCase();
      voiceStatus = `Heard: "${cmd}"`;
      if (cmd.includes("next") || cmd.includes("next step"))      { if (currentStepIndex < cookSteps.length - 1) { markStepDone(currentStepIndex); } }
      else if (cmd.includes("repeat") || cmd.includes("again"))   { voiceStatus = `Step ${currentStepIndex + 1}: ${cookSteps[currentStepIndex]?.instruction}`; }
      else if (cmd.includes("start timer"))                        { startTimer(cookSteps[currentStepIndex]?.duration ?? 5); }
      else if (cmd.includes("pause timer") || cmd.includes("stop timer")) { pauseTimer(); }
      else if (cmd.includes("reset timer"))                        { resetTimer(); }
      else if (cmd.match(/timer (\d+)/)) {
        const min = parseInt(cmd.match(/timer (\d+)/)![1]);
        startTimer(min);
      }
    };
    recognition.onerror = () => { voiceActive = false; voiceStatus = "Mic error — check permissions"; };
    recognition.onend   = () => { voiceActive = false; };
    recognition.start();
    voiceActive = true;
    voiceStatus = _t('moduleRecipesSentinel');
  }

  function stopVoice() {
    recognition?.stop();
    voiceActive = false;
    voiceStatus = "";
  }

  // ── Persistence (localStorage) ─────────────────────────────────────
  const STORAGE_KEY = "bento_recipes_v1";

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        recipes, pantryItems, dietProfile, shoppingItems, cookHistory, collections, mealPlan
      }));
    } catch { /* storage full — fail silently */ }
  }

  function hydrate() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.recipes)      recipes      = d.recipes;
      if (d.pantryItems)  pantryItems  = d.pantryItems;
      if (d.dietProfile)  dietProfile  = d.dietProfile;
      if (d.shoppingItems) shoppingItems = d.shoppingItems;
      if (d.cookHistory)  cookHistory  = d.cookHistory;
      if (d.collections)  collections  = d.collections;
      if (d.mealPlan)     mealPlan     = d.mealPlan;
    } catch { /* corrupted — ignore */ }
  }

  onMount(() => { loadAll(); });
  onDestroy(() => { if (timerInterval) clearInterval(timerInterval); stopVoice(); });

  // ── UI State ─────────────────────────────────────────────────────
  let searchQuery = $state("");
  let searchMatchedIds = $state<string[] | null>(null);
  let activeFilter = $state("All");
  let filters = ["All", "Breakfast", "Lunch", "Dinner", "Snack", "Favorites"];
  let showFabMenu = false;

  // Recipe Detail State
  let selectedRecipeId: string | null = null;
  let selectedRecipe = $derived(recipes.find(r => r.id === selectedRecipeId) ?? null);
  let servingScale = $state(1);
  let showSubstitute: string | null = $state(null);

  function toggleIngredient(recipeId: string, ingId: string) {
    dbToggleIngredient(ingId, recipeId);
  }

  // Cook Mode State
  let cookModeRecipeId = $state("");
  let cookModeRecipe = $derived(recipes.find(r => r.id === cookModeRecipeId) ?? recipes[0]);
  let cookSteps: Step[] = $state([]);
  let currentStepIndex = $state(0);
  let timerSeconds = 0;
  let timerRunning = $state(false);
  let timerInterval: ReturnType<typeof setInterval> | null = null;
  let screenAwake = $state(true);
  let cookServings = $state(2);

  $effect(() => {
    if (cookModeRecipe) {
      cookSteps = cookModeRecipe.steps.map(s => ({ ...s, completed: false }));
      currentStepIndex = 0;
      timerSeconds = 0;
      timerRunning = false;
    }
  });

  function startTimer(minutes: number) {
    if (timerInterval) clearInterval(timerInterval);
    timerSeconds = minutes * 60;
    timerRunning = true;
    timerInterval = setInterval(() => {
      if (timerSeconds > 0) {
        timerSeconds -= 1;
      } else {
        timerRunning = false;
        if (timerInterval) clearInterval(timerInterval);
      }
    }, 1000);
  }

  function pauseTimer() {
    timerRunning = false;
    if (timerInterval) clearInterval(timerInterval);
  }

  function resetTimer() {
    timerRunning = false;
    timerSeconds = 0;
    if (timerInterval) clearInterval(timerInterval);
  }

  let timerDisplay = $derived(`${Math.floor(timerSeconds / 60).toString().padStart(2, "0")}:${(timerSeconds % 60).toString().padStart(2, "0")}`);

  function markStepDone(index: number) {
    cookSteps = cookSteps.map((s, i) => i === index ? { ...s, completed: true } : s);
    if (index < cookSteps.length - 1) currentStepIndex = index + 1;
  }

  // Import state
  let importUrl = $state("");
  let importPhase: "idle" | "parsing" | "done" = $state("idle");
  let importMethod: "url" | "photo" | "manual" = $state("url");

  // Manual entry state
  let manualTitle = $state("");
  let manualTime = $state("");
  let manualServings = $state("");
  let manualIngredients = $state("");
  let manualSteps = $state("");

  function fakeImport() {
    importPhase = "parsing";
    setTimeout(() => { importPhase = "done"; }, 1800);
  }

  // Shopping helpers
  let shoppingFilter: "all" | "pending" | "checked" = $state("all");
  let shoppingGroupBy: "category" | "recipe" = $state("category");

  let groupedShopping = $derived.by(() => {
    const filtered = shoppingItems.filter(i => {
      if (shoppingFilter === "pending") return !i.checked;
      if (shoppingFilter === "checked") return i.checked;
      return true;
    });
    const key = shoppingGroupBy === "category" ? "category" : "fromRecipe";
    const groups: Record<string, ShoppingItem[]> = {};
    for (const item of filtered) {
      const g = item[key];
      if (!groups[g]) groups[g] = [];
      groups[g].push(item);
    }
    return groups;
  });

  let pendingCount = $derived(shoppingItems.filter(i => !i.checked).length);

  function matchesRecipeFilters(recipe: Recipe) {
    if (activeFilter === "Favorites" && !recipe.favorite) return false;
    if (activeFilter !== "All" && activeFilter !== "Favorites" && recipe.meal !== activeFilter) return false;
    return true;
  }

  // Filtered recipe list
  let filteredRecipes = $derived.by(() => {
    const base = recipes.filter((recipe) => matchesRecipeFilters(recipe));
    if (!searchQuery.trim() || !searchMatchedIds) return base;
    const order = new Map(searchMatchedIds.map((id, index) => [id, index]));
    return base
      .filter((recipe) => order.has(recipe.id))
      .sort((left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0));
  });

  $effect(() => {
    const query = searchQuery.trim();
    if (!query) {
      searchMatchedIds = null;
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const hits = await searchInModule("recipes", {
          query,
          limit: 100,
          fuzzy: true,
        });
        if (cancelled) return;
        searchMatchedIds = hits.map((hit) => hit.document.id);
      } catch {
        if (!cancelled) searchMatchedIds = [];
      }
    }, 120);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  });

  // Nutrition stats for selected recipe (scaled)
  let scaledNutrition = $derived(selectedRecipe ? {
    calories: Math.round(selectedRecipe.calories * servingScale),
    protein: Math.round(selectedRecipe.protein * servingScale),
    carbs: Math.round(selectedRecipe.carbs * servingScale),
    fat: Math.round(selectedRecipe.fat * servingScale),
  } : null);

  function toggleFavorite(id: string) {
    dbToggleFavorite(id);
  }

  function toggleShoppingItem(itemId: string) {
    dbToggleShopping(itemId);
  }

  function getDifficultyColor(d: string) {
    if (d === "Easy") return "var(--recipes-easy)";
    if (d === "Medium") return "var(--recipes-medium)";
    return "var(--recipes-hard)";
  }

  // ── Add Recipe modal ───────────────────────────────────────────────
  let showAddModal = $state(false);

  function openAddRecipe() {
    showAddModal = true;
    importMethod = "manual";
    manualTitle = ""; manualTime = ""; manualServings = "";
    manualIngredients = ""; manualSteps = "";
    importPhase = "idle";
  }

  async function submitManualRecipe() {
    if (!manualTitle.trim()) return;
    await dbSaveRecipeFromManual();
    showAddModal = false;
  }

  const importInbox = [
    { title: "Spicy Lentil Stew", source: "Saved browser tab", status: "Ingredients parsed" },
    { title: "Mom's Banana Loaf", source: "Camera scan", status: "OCR ready for cleanup" },
    { title: "Thai Green Curry", source: "URL import", status: "Steps need review" },
  ];

  // ── Translated display labels ──────────────────────────────────────
  let dietLabels = $derived.by(() => allDiets.map(d => _t('moduleRecipesDiet' + d.replace(/[-\s]/g, ''))));
  let allergenLabels = $derived.by(() => allAllergens.map(a => _t('moduleRecipesAllergen' + a)));
  let filterLabels = $derived.by(() => filters.map(f => _t('moduleRecipes' + (f === 'All' ? 'AllLabel' : f))));
  let importMethods = $derived.by(() => [
    { key: "url" as const,    icon: Link,    label: _t('moduleRecipesFromURL'),     detail: _t('moduleRecipesFromURLDetail') },
    { key: "photo" as const,  icon: Camera,  label: _t('moduleRecipesPhotoScan'),   detail: _t('moduleRecipesPhotoScanDetail') },
    { key: "manual" as const, icon: PenTool, label: _t('moduleRecipesBuildManual'), detail: _t('moduleRecipesBuildManualDetail') },
  ]);
</script>

<main class="recipes-workspace module-root" data-module="recipes">
  <section class="recipes-shell">

    <!-- ── LOADING STATE ── -->
    {#if loading}
      <div class="recipes-loading">
        <div class="recipes-loading-spinner"></div>
        <p>Loading your cookbook…</p>
      </div>

    <!-- ── ERROR STATE ── -->
    {:else if dbError}
      <div class="recipes-db-error">
        <div class="recipes-db-error__icon">⚠️</div>
        <div class="recipes-db-error__body">
          <strong>Could not load recipes</strong>
          <p>{dbError}</p>
          <p class="recipes-db-error__hint">
            {#if dbError.includes("timeout")}
              The app needs to be restarted after a code update. Please close and reopen Bento, or run <code>npm run tauri dev</code> again.
            {:else}
              Check the Tauri dev console for the full error. Then click Retry.
            {/if}
          </p>
          <Button onclick={() => loadAll()}>↺ Retry</Button>
        </div>
      </div>

    {:else}

    <!-- ── HEADER — same eyebrow / h1 / actions pattern as focus & nutrition ── -->
    <header class="recipes-shell__header">
      <div class="recipes-shell__intro">
        <div class="recipes-shell__eyebrow">
          <span>{_t('moduleRecipesEyebrow')}</span>
          <Badge variant="outline">{selectedSection}</Badge>
        </div>
        <h1>
          {#if selectedSection === "Recipes"}
            {#if selectedRecipe}{_t('moduleRecipesDescDetail')}{:else}{_t('moduleRecipesDescRecipes')}{/if}
          {:else if selectedSection === "Import"}{_t('moduleRecipesDescImport')}
          {:else if selectedSection === "Cook Mode"}{_t('moduleRecipesDescCookMode')}
          {:else if selectedSection === "Meal Plan"}{_t('moduleRecipesDescMealPlan')}
          {:else if selectedSection === "Shopping"}{_t('moduleRecipesDescShopping')}
          {:else}{_t('moduleRecipesDescExport')}{/if}
        </h1>
      </div>

      <div class="recipes-shell__actions">
        {#if selectedSection === "Recipes" && !selectedRecipe}
          <Button variant="outline" onclick={() => (showProfilePanel = !showProfilePanel)}>
            <Sparkles size={16} />
            {dietProfile.diets.length > 0 || dietProfile.allergens.length > 0 ? _t('moduleRecipesProfileCount').replace('{count}', String(dietProfile.diets.length + dietProfile.allergens.length)) : _t('moduleRecipesMyProfile')}
          </Button>
          <Button variant="outline" onclick={() => {
            dietProfile = { ...dietProfile, unit: useImperial ? "metric" : "imperial" };
          }}>
            {useImperial ? _t('moduleRecipesMetric') : _t('moduleRecipesImperial')}
          </Button>
          <Button variant="outline" onclick={openAddRecipe}>
            <Plus size={16} />
            Add recipe
          </Button>
        {:else if selectedRecipe}
          <Button variant="outline" onclick={() => { selectedRecipeId = null; servingScale = 1; }}>
            <ChevronLeft size={16} />
            {_t('moduleRecipesAllRecipes')}
          </Button>
          <Button onclick={() => toggleFavorite(selectedRecipe.id)}>
            <Heart size={16} fill={selectedRecipe.favorite ? "currentColor" : "none"} />
            {selectedRecipe.favorite ? _t('moduleRecipesSaved') : _t('moduleRecipesSave')}
          </Button>
        {:else if selectedSection === "Import"}
          <Button variant="outline">
            <RefreshCw size={16} />
            {_t('moduleRecipesRefreshInbox')}
          </Button>
        {:else if selectedSection === "Cook Mode"}
          <Button variant="outline" onclick={voiceActive ? stopVoice : startVoice}>
            {#if voiceActive}<MicOff size={16}/> {_t('moduleRecipesStopVoice')}{:else}<Mic size={16}/> {_t('moduleRecipesVoiceControl')}{/if}
          </Button>
          <Button variant="outline" onclick={() => {
            dietProfile = { ...dietProfile, unit: useImperial ? "metric" : "imperial" };
          }}>
            {useImperial ? _t('moduleRecipesSwitchToMetric') : _t('moduleRecipesSwitchToImperial')}
          </Button>
        {:else if selectedSection === "Shopping"}
          <Button variant="outline">
            <ShoppingCart size={16} />
            {_t('moduleRecipesSendToGrocery')}
          </Button>
        {:else if selectedSection === "Export"}
          <Button variant="outline">
            <Download size={16} />
            {_t('moduleRecipesExportAll')}
          </Button>
        {/if}
      </div>
    </header>

    <!-- ═══════════════════════════════════════════════════════════════
         RECIPES SECTION
    ════════════════════════════════════════════════════════════════ -->
    {#if selectedSection === "Recipes"}

      {#if selectedRecipe}
        <!-- ── RECIPE DETAIL VIEW ── -->
        <section class="recipes-detail-grid">
          <!-- Left: hero image + meta + nutrition -->
          <div class="recipes-detail-left">
            <Card class="recipes-card recipes-card--hero">
              <div
                class="recipes-detail-image"
                style="background-image: url({selectedRecipe.image})"
              >
                <div class="recipes-detail-image__overlay">
                  <span class="recipes-detail-title">{selectedRecipe.title}</span>
                  <div class="recipes-detail-badges">
                    <Badge variant="outline">{selectedRecipe.meal}</Badge>
                    <Badge variant="outline" style="color:{getDifficultyColor(selectedRecipe.difficulty)}">{selectedRecipe.difficulty}</Badge>
                    {#each selectedRecipe.tags as tag}
                      <Badge variant="secondary">{tag}</Badge>
                    {/each}
                  </div>
                </div>
              </div>
              <CardContent class="recipes-detail-meta-row">
                <div class="recipes-meta-stat">
                  <Clock size={15} /><span>{selectedRecipe.time}</span>
                </div>
                <div class="recipes-meta-stat">
                  <Users size={15} />
                  <span>
                    <button class="recipes-scale-btn" type="button" onclick={() => servingScale = Math.max(0.5, servingScale - 0.5)}><Minus size={12}/></button>
                    {_t('moduleRecipesServingsFormat').replace('{count}', String(Math.round(selectedRecipe.servings * servingScale)))}
                    <button class="recipes-scale-btn" type="button" onclick={() => servingScale = servingScale + 0.5}><Plus size={12}/></button>
                  </span>
                </div>
                <div class="recipes-meta-stat">
                  <Flame size={15} /><span>{scaledNutrition?.calories} {_t('moduleRecipesKcal')}</span>
                </div>
                <div class="recipes-meta-stat">
                  <Star size={15} fill="currentColor" style="color:var(--recipes-star)" />
                  <span>{_t('moduleRecipesRatingFormat').replace('{rating}', String(selectedRecipe.rating)).replace('{count}', String(selectedRecipe.cookedCount))}</span>
                </div>
              </CardContent>
            </Card>

            <!-- Allergen warning -->
            {#if recipeAllergenWarning(selectedRecipe).length > 0}
              <div class="recipes-allergen-warning">
                {_t('moduleRecipesAllergenWarning').replace('{items}', recipeAllergenWarning(selectedRecipe).join(", "))}
              </div>
            {/if}

            <!-- Nutrition card -->
            <Card class="recipes-card">
              <CardHeader>
                <CardTitle>{_t('moduleRecipesNutritionPerServing')}</CardTitle>
                <CardDescription>{_t('moduleRecipesNutritionScaled').replace('{count}', String(Math.round(selectedRecipe.servings * servingScale))).replace('{s}', Math.round(selectedRecipe.servings * servingScale) !== 1 ? 's' : '')}</CardDescription>
              </CardHeader>
              <CardContent class="recipes-nutrition-grid">
                <div class="recipes-nutrition-tile recipes-nutrition-tile--calories">
                  <strong>{scaledNutrition?.calories}</strong><span>{_t('moduleRecipesKcal')}</span>
                </div>
                <div class="recipes-nutrition-tile">
                  <strong>{scaledNutrition?.protein}g</strong><span>{_t('moduleRecipesProtein')}</span>
                </div>
                <div class="recipes-nutrition-tile">
                  <strong>{scaledNutrition?.carbs}g</strong><span>{_t('moduleRecipesCarbs')}</span>
                </div>
                <div class="recipes-nutrition-tile">
                  <strong>{scaledNutrition?.fat}g</strong><span>{_t('moduleRecipesFat')}</span>
                </div>
              </CardContent>
            </Card>

            <!-- Notes -->
            {#if selectedRecipe.notes}
              <Card class="recipes-card recipes-card--note">
                <CardContent>
                  <p class="recipes-note-text">💡 {selectedRecipe.notes}</p>
                </CardContent>
              </Card>
            {/if}
          </div>

          <!-- Right: ingredients + steps -->
          <div class="recipes-detail-right">
            <!-- Ingredients -->
            <Card class="recipes-card">
              <CardHeader>
                <CardTitle>{_t('moduleRecipesIngredients')}</CardTitle>
                <CardDescription>{_t('moduleRecipesIngredientsDesc')}</CardDescription>
              </CardHeader>
              <CardContent class="recipes-ingredient-list">
                {#each selectedRecipe.ingredients as ing}
                  <article
                    class="recipes-ingredient-row {ing.checked ? 'checked' : ''}"
                    role="button"
                    tabindex="0"
                    onclick={() => toggleIngredient(selectedRecipe.id, ing.name)}
                    onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleIngredient(selectedRecipe.id, ing.name); }}
                  >
                    <div class="recipes-ing-check">{#if ing.checked}<Check size={13}/>{/if}</div>
                    <div class="recipes-ing-copy">
                      <span class="recipes-ing-name">{ing.name}</span>
                      {#if ing.substitutes}
                        <button
                          class="recipes-sub-toggle"
                          type="button"
                          onclick={(e) => { e.stopPropagation(); showSubstitute = showSubstitute === ing.name ? null : ing.name; }}
                        >{_t('moduleRecipesSwap')}</button>
                        {#if showSubstitute === ing.name}
                          <p class="recipes-substitute">↳ {ing.substitutes.join(" · ")}</p>
                        {/if}
                      {/if}
                    </div>
                    <span class="recipes-ing-amount">{getIngAmount(ing)}</span>
                  </article>
                {/each}
              </CardContent>
            </Card>

            <!-- Steps -->
            <Card class="recipes-card">
              <CardHeader>
                <CardTitle>{_t('moduleRecipesSteps')}</CardTitle>
                <CardDescription>{_t('moduleRecipesStepsFormat').replace('{count}', String(selectedRecipe.steps.length)).replace('{time}', selectedRecipe.time)}</CardDescription>
              </CardHeader>
              <CardContent class="recipes-step-list">
                {#each selectedRecipe.steps as step}
                  <article class="recipes-step-row">
                    <div class="recipes-step-number"><span>{step.id}</span></div>
                    <div class="recipes-step-copy">
                      <p>{step.instruction}</p>
                      {#if step.duration && step.duration > 0}
                        <div class="recipes-step-timer-hint">
                          <Timer size={13} />
                          <span>{step.duration} {_t('moduleRecipesMin')}</span>
                        </div>
                      {/if}
                    </div>
                  </article>
                {/each}
              </CardContent>
            </Card>
          </div>
        </section>

      {:else}
        <!-- ── DIETARY PROFILE PANEL (slide-in card) ── -->
        {#if showProfilePanel}
          <Card class="recipes-card recipes-profile-panel">
            <CardHeader>
              <CardTitle>{_t('moduleRecipesYourProfile')}</CardTitle>
              <CardDescription>{_t('moduleRecipesProfileDesc')}</CardDescription>
            </CardHeader>
            <CardContent class="recipes-profile-body">
              <div class="recipes-profile-section">
                <div class="recipes-profile-label">{_t('moduleRecipesDietPreferences')}</div>
                <div class="recipes-chips">
                  {#each allDiets as d, i}
                    <button type="button" class="recipes-chip {dietProfile.diets.includes(d) ? 'active' : ''}" onclick={() => toggleDiet(d)}>{dietLabels[i]}</button>
                  {/each}
                </div>
              </div>
              <div class="recipes-profile-section">
                <div class="recipes-profile-label">{_t('moduleRecipesAllergensToAvoid')}</div>
                <div class="recipes-chips">
                  {#each allAllergens as a, i}
                    <button type="button" class="recipes-chip recipes-chip--danger {dietProfile.allergens.includes(a) ? 'active' : ''}" onclick={() => toggleAllergen(a)}>{allergenLabels[i]}</button>
                  {/each}
                </div>
              </div>
              <div class="recipes-profile-section">
                <div class="recipes-profile-label">{_t('moduleRecipesMeasurementUnits')}</div>
                <div class="recipes-chips">
                  <button type="button" class="recipes-chip {!useImperial ? 'active' : ''}" onclick={() => { dietProfile = { ...dietProfile, unit: 'metric' }; }}>{_t('moduleRecipesUnitMetric')}</button>
                  <button type="button" class="recipes-chip {useImperial ? 'active' : ''}" onclick={() => { dietProfile = { ...dietProfile, unit: 'imperial' }; }}>{_t('moduleRecipesUnitImperial')}</button>
                </div>
              </div>
            </CardContent>
          </Card>
        {/if}

        <!-- ── RECIPE LIBRARY VIEW ── -->
        <section class="recipes-hero-grid">
          <!-- Search + filter card -->
          <Card class="recipes-card recipes-search-card">
            <CardContent class="recipes-search-inner">
              <div class="recipes-searchbar">
                <Search size={16} />
                <input
                  class="recipes-search-input"
                  bind:value={searchQuery}
                  placeholder={_t('moduleRecipesSearchPlaceholder')}
                />
                {#if searchQuery}
                  <button type="button" class="recipes-clear-btn" onclick={() => (searchQuery = "")}>
                    <X size={14}/>
                  </button>
                {/if}
              </div>
              <div class="recipes-chips">
                {#each filters as f, i}
                  <button
                    type="button"
                    class="recipes-chip {activeFilter === f ? 'active' : ''}"
                    onclick={() => (activeFilter = f)}
                  >{filterLabels[i]}</button>
                {/each}
              </div>
              <!-- Collections -->
              <div class="recipes-chips">
                <button type="button" class="recipes-chip {activeCollectionId === null ? 'active' : ''}" onclick={() => (activeCollectionId = null)}>{_t('moduleRecipesAllCollections')}</button>
                {#each collections as col}
                  <button type="button" class="recipes-chip {activeCollectionId === col.id ? 'active' : ''}" onclick={() => (activeCollectionId = activeCollectionId === col.id ? null : col.id)}>
                    {col.emoji} {col.name}
                  </button>
                {/each}
              </div>
            </CardContent>
          </Card>

          <!-- "For You" recommendations card -->
          <Card class="recipes-card">
            <CardHeader>
              <CardTitle><Sparkles size={15}/> {_t('moduleRecipesForYou')}</CardTitle>
              <CardDescription>{_t('moduleRecipesForYouDesc')}</CardDescription>
            </CardHeader>
            <CardContent class="recipes-can-make-list">
              {#each recommendedRecipes as r}
                <button type="button" class="recipes-can-make-pill" onclick={() => { selectedRecipeId = r.id; servingScale = 1; }}>
                  ⭐ {r.title}
                </button>
              {/each}
            </CardContent>
          </Card>
        </section>

        <!-- Recipe grid -->
        <section class="recipes-shell__body">
          {#if filteredRecipes.length === 0}
            <div class="recipes-empty">
              <ChefHat size={40} />
              <p>{_t('moduleRecipesNoMatches').replace('{q}', searchQuery)}</p>
            </div>
          {:else}
            <div class="recipes-grid">
              {#each filteredRecipes.filter(r => activeCollectionId === null || r.collectionIds.includes(activeCollectionId)) as recipe (recipe.id)}
                <button
                  type="button"
                  class="recipes-card recipes-recipe-card"
                  onclick={() => { selectedRecipeId = recipe.id; servingScale = 1; showSubstitute = null; }}
                >
                  <div class="recipes-card-image" style="background-image:url({recipe.image})">
                    <div class="recipes-card-image__top">
                      <span class="recipes-difficulty-dot" style="background:{getDifficultyColor(recipe.difficulty)}"></span>
                      <span class="recipes-difficulty-label">{recipe.difficulty}</span>
                    </div>
                    {#if recipe.favorite}
                      <div class="recipes-fav-badge"><Heart size={14} fill="currentColor"/></div>
                    {/if}
                    {#if recipeAllergenWarning(recipe).length > 0}
                      <div class="recipes-allergen-badge">⚠️</div>
                    {/if}
                  </div>
                  <div class="recipes-card-body">
                    <div class="recipes-card-title-row">
                      <h3 class="recipes-card-title">{recipe.title}</h3>
                      <div class="recipes-card-rating">
                        <Star size={12} fill="currentColor" style="color:var(--recipes-star)"/>
                        <span>{recipe.rating}</span>
                      </div>
                    </div>
                    <div class="recipes-card-meta">
                      <span><Clock size={13}/>{recipe.time}</span>
                      <span><Users size={13}/>{recipe.servings}</span>
                      <span><Flame size={13}/>{recipe.calories} {_t('moduleRecipesKcal')}</span>
                    </div>
                    <div class="recipes-card-tags">
                      {#each recipe.tags.slice(0,2) as tag}
                        <span class="recipes-tag">{tag}</span>
                      {/each}
                      {#each recipe.dietTags.slice(0,1) as dt}
                        <span class="recipes-tag recipes-tag--diet">{dt}</span>
                      {/each}
                    </div>
                  </div>
                </button>
              {/each}
            </div>
          {/if}
        </section>
      {/if}

    <!-- ═══════════════════════════════════════════════════════════════
         IMPORT SECTION
    ════════════════════════════════════════════════════════════════ -->
    {:else if selectedSection === "Import"}
      <section class="recipes-hero-grid">
        <!-- Method selector -->
        <Card class="recipes-card">
          <CardHeader>
            <CardTitle>{_t('moduleRecipesImportMethod')}</CardTitle>
            <CardDescription>{_t('moduleRecipesImportMethodDesc')}</CardDescription>
          </CardHeader>
          <CardContent class="recipes-import-methods">
            {#each importMethods as method}
              <button
                type="button"
                class="recipes-import-method-btn {importMethod === method.key ? 'active' : ''}"
                onclick={() => (importMethod = method.key)}
              >
                <div class="recipes-import-icon"><svelte:component this={method.icon} size={18}/></div>
                <div>
                  <strong>{method.label}</strong>
                  <p>{method.detail}</p>
                </div>
              </button>
            {/each}
          </CardContent>
        </Card>

        <!-- Input panel -->
        <Card class="recipes-card">
          <CardHeader>
            <CardTitle>
              {#if importMethod === "url"}{_t('moduleRecipesPasteURL')}
              {:else if importMethod === "photo"}{_t('moduleRecipesUploadScan')}
              {:else}{_t('moduleRecipesNewRecipe')}{/if}
            </CardTitle>
            <CardDescription>
              {#if importMethod === "url"}{_t('moduleRecipesPasteURLDesc')}
              {:else if importMethod === "photo"}{_t('moduleRecipesUploadScanDesc')}
              {:else}{_t('moduleRecipesNewRecipeDesc')}{/if}
            </CardDescription>
          </CardHeader>
          <CardContent class="recipes-import-input-panel">
            {#if importMethod === "url"}
              <div class="recipes-url-row">
                <input
                  class="recipes-url-input"
                  bind:value={importUrl}
                  placeholder="https://www.seriouseats.com/…"
                />
                <Button onclick={fakeImport} disabled={!importUrl || importPhase === "parsing"}>
                  {#if importPhase === "parsing"}<RefreshCw size={15} class="spin"/>{_t('moduleRecipesImportParsing')}
                  {:else if importPhase === "done"}<Check size={15}/>{_t('moduleRecipesImportDone')}
                  {:else}{_t('moduleRecipesImportBtn')}{/if}
                </Button>
              </div>
              {#if importPhase === "done"}
                <div class="recipes-import-preview">
                  <div class="recipes-import-preview__img" style="background-image:url(https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=200)"></div>
                  <div>
                    <strong>Chicken Tikka Masala</strong>
                    <p>12 ingredients · 6 steps · 55 min · Dinner</p>
                    <Button variant="outline">{_t('moduleRecipesSaveToLibrary')}</Button>
                  </div>
                </div>
              {/if}
            {:else if importMethod === "photo"}
              <div class="recipes-photo-drop">
                <Camera size={32}/>
                <p>{_t('moduleRecipesDropImage')}</p>
                <Button variant="outline">{_t('moduleRecipesBrowseFiles')}</Button>
              </div>
            {:else}
              <div class="recipes-manual-form">
                <input class="recipes-manual-input" bind:value={manualTitle} placeholder={_t('moduleRecipesManualTitlePlaceholder')} />
                <div class="recipes-manual-row">
                  <input class="recipes-manual-input" bind:value={manualTime} placeholder={_t('moduleRecipesManualTimePlaceholder')} />
                  <input class="recipes-manual-input" bind:value={manualServings} placeholder={_t('moduleRecipesManualServingsPlaceholder')} />
                </div>
                <textarea class="recipes-manual-textarea" bind:value={manualIngredients} placeholder={_t('moduleRecipesManualIngredientsPlaceholder')} rows="4"></textarea>
                <textarea class="recipes-manual-textarea" bind:value={manualSteps} placeholder={_t('moduleRecipesManualStepsPlaceholder')} rows="4"></textarea>
                <Button disabled={!manualTitle}>{_t('moduleRecipesSaveRecipe')}</Button>
              </div>
            {/if}
          </CardContent>
        </Card>
      </section>

      <section class="recipes-shell__body">
        <Card class="recipes-card recipes-panel--full">
          <CardHeader>
            <CardTitle>{_t('moduleRecipesImportInbox')}</CardTitle>
            <CardDescription>{_t('moduleRecipesImportInboxDesc')}</CardDescription>
          </CardHeader>
          <CardContent class="recipes-import-inbox">
            {#each importInbox as item}
              <article class="recipes-inbox-row">
                <div class="recipes-inbox-dot"></div>
                <div class="recipes-inbox-copy">
                  <strong>{item.title}</strong>
                  <p>{item.source} · {item.status}</p>
                </div>
                <div class="recipes-inbox-actions">
                  <Button variant="outline">{_t('moduleRecipesEdit')}</Button>
                  <Button>{_t('moduleRecipesApprove')}</Button>
                </div>
              </article>
            {/each}
          </CardContent>
        </Card>
      </section>

    <!-- ═══════════════════════════════════════════════════════════════
         COOK MODE SECTION
    ════════════════════════════════════════════════════════════════ -->
    {:else if selectedSection === "Cook Mode"}
      <section class="recipes-hero-grid recipes-hero-grid--cook">
        <!-- Recipe picker -->
        <Card class="recipes-card">
          <CardHeader>
            <CardTitle>{_t('moduleRecipesCooking')}</CardTitle>
            <CardDescription>{_t('moduleRecipesCookingDesc')}</CardDescription>
          </CardHeader>
          <CardContent class="recipes-cook-picker">
            {#each recipes as r}
              <button
                type="button"
                class="recipes-cook-pick-btn {cookModeRecipeId === r.id ? 'active' : ''}"
                onclick={() => (cookModeRecipeId = r.id)}
              >
                <div class="recipes-cook-pick-img" style="background-image:url({r.image})"></div>
                <span>{r.title}</span>
              </button>
            {/each}
          </CardContent>
        </Card>

        <!-- Controls: servings + timer -->
        <Card class="recipes-card">
          <CardHeader>
            <CardTitle>{_t('moduleRecipesKitchenControls')}</CardTitle>
            <CardDescription>{_t('moduleRecipesKitchenControlsDesc').replace('{title}', cookModeRecipe.title).replace('{count}', String(cookServings))}</CardDescription>
          </CardHeader>
          <CardContent class="recipes-cook-controls">
            <!-- Serving scaler -->
            <div class="recipes-cook-control-row">
              <span class="recipes-cook-label">{_t('moduleRecipesServingsLabel')}</span>
              <div class="recipes-cook-stepper">
                <button type="button" onclick={() => cookServings = Math.max(1, cookServings - 1)}><Minus size={14}/></button>
                <strong>{cookServings}</strong>
                <button type="button" onclick={() => cookServings++}><Plus size={14}/></button>
              </div>
            </div>

            <!-- Timer -->
            <div class="recipes-cook-timer-block">
              <div class="recipes-cook-timer-display">{timerDisplay}</div>
              <div class="recipes-cook-timer-actions">
                {#if timerRunning}
                  <Button variant="outline" onclick={pauseTimer}>{_t('moduleRecipesPause')}</Button>
                {:else}
                  <Button onclick={() => startTimer(cookSteps[currentStepIndex]?.duration ?? 5)}>
                    <Timer size={14}/>
                    {_t('moduleRecipesStartTimer')}
                  </Button>
                {/if}
                <Button variant="outline" onclick={resetTimer}>{_t('moduleRecipesReset')}</Button>
              </div>
              <div class="recipes-cook-quick-timers">
                {#each [1, 3, 5, 8, 10, 15] as min}
                  <button type="button" class="recipes-quick-timer-btn" onclick={() => startTimer(min)}>{min}m</button>
                {/each}
              </div>
            </div>

            <div class="recipes-cook-awake-row">
              <span class="recipes-cook-label">{_t('moduleRecipesScreenAwake')}</span>
              <button
                type="button"
                class="recipes-awake-toggle {screenAwake ? 'active' : ''}"
                onclick={() => (screenAwake = !screenAwake)}
              >{screenAwake ? _t('moduleRecipesOn') : _t('moduleRecipesOff')}</button>
            </div>

            <!-- Voice status -->
            {#if voiceStatus}
              {#if voiceStatus}
              <div class="recipes-voice-status {voiceActive ? 'listening' : ''}">
                {#if voiceActive}<Mic size={13}/>{/if}
                <span>{voiceStatus}</span>
              </div>
              {/if}
            {/if}

            <!-- Cook history -->
            <div class="recipes-cook-history-label">{_t('moduleRecipesCookHistory')}</div>
            <div class="recipes-cook-history">
              {#each cookHistory.slice(0, 4) as entry}
                <article class="recipes-cook-history-row">
                  <div class="recipes-cook-history-copy">
                    <strong>{entry.recipeTitle}</strong>
                    <p>{entry.date}</p>
                  </div>
                  <Button variant="outline" onclick={() => cookAgain(entry)}>{_t('moduleRecipesCookAgain')}</Button>
                </article>
              {/each}
            </div>
          </CardContent>
        </Card>
      </section>

      <!-- Steps — full-width cook view -->
      <section class="recipes-shell__body">
        <Card class="recipes-card recipes-panel--full">
          <CardHeader>
            <CardTitle>{_t('moduleRecipesStepsLabel').replace('{title}', cookModeRecipe.title)}</CardTitle>
            <CardDescription>{_t('moduleRecipesStepsDesc')}</CardDescription>
          </CardHeader>
          <CardContent class="recipes-cook-steps">
            {#each cookSteps as step, i}
              <article
                class="recipes-cook-step {step.completed ? 'completed' : ''} {i === currentStepIndex ? 'active' : ''}"
                role="button"
                tabindex="0"
                onclick={() => markStepDone(i)}
                onkeydown={() => {}}
              >
                <div class="recipes-cook-step-num">
                  {#if step.completed}<Check size={16}/>{:else}{step.id}{/if}
                </div>
                <div class="recipes-cook-step-body">
                  <p>{step.instruction}</p>
                  {#if step.duration && step.duration > 0 && !step.completed}
                    <button
                      type="button"
                      class="recipes-cook-step-timer-btn"
                      onclick={(e) => { e.stopPropagation(); startTimer(step.duration ?? 0); }}
                    >
                      <Timer size={13}/> {_t('moduleRecipesStartDuration').replace('{min}', String(step.duration ?? 0))}
                    </button>
                  {/if}
                </div>
                {#if step.completed}
                  <span class="recipes-cook-step-done">{_t('moduleRecipesDone')}</span>
                {/if}
              </article>
            {/each}
          </CardContent>
        </Card>
      </section>

    <!-- ═══════════════════════════════════════════════════════════════
         MEAL PLAN SECTION
    ════════════════════════════════════════════════════════════════ -->
    {:else if selectedSection === "Meal Plan"}
      <!-- Stats row -->
      <section class="recipes-hero-grid recipes-hero-grid--plan">
        <Card class="recipes-card">
          <CardHeader>
            <CardTitle>{_t('moduleRecipesThisWeek')}</CardTitle>
            <CardDescription>{_t('moduleRecipesThisWeekDesc')}</CardDescription>
          </CardHeader>
          <CardContent class="recipes-plan-stats">
            <article><span>{_t('moduleRecipesMealsPlanned')}</span><strong>{mealPlan.reduce((acc, d) => acc + [d.slots.breakfast, d.slots.lunch, d.slots.dinner].filter(s => s.recipeId).length, 0)}</strong></article>
            <article><span>{_t('moduleRecipesDaysCovered')}</span><strong>{mealPlan.filter(d => d.slots.breakfast.recipeId || d.slots.lunch.recipeId || d.slots.dinner.recipeId).length} / 7</strong></article>
            <article><span>{_t('moduleRecipesAvgCookTime')}</span><strong>28 {_t('moduleRecipesMin')}</strong></article>
          </CardContent>
        </Card>
        <Card class="recipes-card">
          <CardHeader>
            <CardTitle>{_t('moduleRecipesAutoGenerate')}</CardTitle>
            <CardDescription>{_t('moduleRecipesAutoGenerateDesc')}</CardDescription>
          </CardHeader>
          <CardContent class="recipes-plan-generate">
            <p>{_t('moduleRecipesAutoGenerateBody')}</p>
            <Button>{_t('moduleRecipesGenerateWeekPlan')}</Button>
          </CardContent>
        </Card>
      </section>

      <section class="recipes-shell__body">
        <Card class="recipes-card recipes-panel--full">
          <CardHeader>
            <CardTitle>{_t('moduleRecipesWeekPlanner')}</CardTitle>
            <CardDescription>{_t('moduleRecipesWeekPlannerDesc')}</CardDescription>
          </CardHeader>
          <CardContent class="recipes-week-grid">
            {#each mealPlan as day}
              <div class="recipes-day-col">
                <div class="recipes-day-header">{day.short}</div>
                {#each [
                  { label: _t('moduleRecipesBreakfast'), slot: day.slots.breakfast },
                  { label: _t('moduleRecipesLunch'),     slot: day.slots.lunch     },
                  { label: _t('moduleRecipesDinner'),    slot: day.slots.dinner    }
                ] as mealRow}
                  <div class="recipes-meal-slot {mealRow.slot.recipeId ? 'filled' : 'empty'}">
                    {#if mealRow.slot.recipeId}
                      <span class="recipes-slot-meal-label">{mealRow.label}</span>
                      <span class="recipes-slot-title">{mealRow.slot.label}</span>
                    {:else}
                      <span class="recipes-slot-empty-label">{mealRow.label}</span>
                      <Plus size={12}/>
                    {/if}
                  </div>
                {/each}
              </div>
            {/each}
          </CardContent>
        </Card>
      </section>

    <!-- ═══════════════════════════════════════════════════════════════
         SHOPPING SECTION
    ════════════════════════════════════════════════════════════════ -->
    {:else if selectedSection === "Shopping"}
      <section class="recipes-hero-grid">
        <Card class="recipes-card">
          <CardHeader>
            <CardTitle>Shopping list</CardTitle>
            <CardDescription>{pendingCount} item{pendingCount !== 1 ? "s" : ""} still needed</CardDescription>
          </CardHeader>
          <CardContent class="recipes-shopping-controls">
            <div class="recipes-chips">
              {#each [["all" as const,"All"],["pending" as const,"Needed"],["checked" as const,"In basket"]] as [val, label]}
                <button
                  type="button"
                  class="recipes-chip {shoppingFilter === val ? 'active' : ''}"
                  onclick={() => (shoppingFilter = val as "all" | "checked" | "pending")}
                >{label}</button>
              {/each}
            </div>
            <div class="recipes-chips">
              <button type="button" class="recipes-chip {shoppingGroupBy === 'category' ? 'active' : ''}" onclick={() => (shoppingGroupBy = "category")}>By aisle</button>
              <button type="button" class="recipes-chip {shoppingGroupBy === 'recipe' ? 'active' : ''}" onclick={() => (shoppingGroupBy = "recipe")}>By recipe</button>
            </div>
          </CardContent>
        </Card>

        <Card class="recipes-card">
          <CardHeader>
            <CardTitle>Pantry status</CardTitle>
            <CardDescription>Items flagged low or out of stock</CardDescription>
          </CardHeader>
          <CardContent class="recipes-pantry-status">
            {#each pantryItems.filter(p => !p.inStock || p.lowStock) as item}
              <article class="recipes-pantry-row">
                <div class="recipes-pantry-dot {item.inStock ? 'low' : 'out'}"></div>
                <span>{item.name}</span>
                <Badge variant="secondary">{item.inStock ? "Low" : "Out"}</Badge>
              </article>
            {/each}
          </CardContent>
        </Card>
      </section>

      <section class="recipes-shell__body">
        <Card class="recipes-card recipes-panel--full">
          <CardHeader>
            <CardTitle>Shopping list</CardTitle>
            <CardDescription>Generated from your meal plan · tap to check off</CardDescription>
          </CardHeader>
          <CardContent class="recipes-shopping-list">
            {#each Object.entries(groupedShopping) as [group, items]}
              <div class="recipes-shopping-group">
                <div class="recipes-shopping-group-label">{group}</div>
                {#each items as item}
                  <button
                    type="button"
                    class="recipes-shopping-item {item.checked ? 'checked' : ''}"
                    onclick={() => toggleShoppingItem(item.name)}
                  >
                    <div class="recipes-shopping-check">{#if item.checked}<Check size={13}/>{/if}</div>
                    <div class="recipes-shopping-copy">
                      <span>{item.name}</span>
                      <p>{item.fromRecipe}</p>
                    </div>
                    <span class="recipes-shopping-amount">{item.amount}</span>
                  </button>
                {/each}
              </div>
            {/each}
          </CardContent>
        </Card>
      </section>

    <!-- ═══════════════════════════════════════════════════════════════
         EXPORT SECTION
    ════════════════════════════════════════════════════════════════ -->
    {:else}
      <section class="recipes-hero-grid">
        <Card class="recipes-card">
          <CardHeader>
            <CardTitle>Library snapshot</CardTitle>
            <CardDescription>Everything available to export right now</CardDescription>
          </CardHeader>
          <CardContent class="recipes-plan-stats">
            <article><span>Total recipes</span><strong>{recipes.length}</strong></article>
            <article><span>Favourites</span><strong>{recipes.filter(r => r.favorite).length}</strong></article>
            <article><span>Meal plan coverage</span><strong>4 / 7 days</strong></article>
          </CardContent>
        </Card>
        <Card class="recipes-card">
          <CardHeader>
            <CardTitle>Quick export</CardTitle>
            <CardDescription>One-click bundles for common use cases</CardDescription>
          </CardHeader>
          <CardContent class="recipes-plan-generate">
            <p>Export your full cookbook, favourites only, or just this week's shopping list — all in one pass.</p>
            <Button><Download size={14}/> Export full cookbook</Button>
          </CardContent>
        </Card>
      </section>

      <section class="recipes-shell__body">
        <Card class="recipes-card recipes-panel--full">
          <CardHeader>
            <CardTitle>Export formats</CardTitle>
            <CardDescription>Kitchen-ready, shareable, or data-portable — your choice</CardDescription>
          </CardHeader>
          <CardContent class="recipes-export-list">
            {#each [
              { icon: BookOpen, label: "Kitchen PDF",        detail: "Large type, step-by-step layout, timers included. Designed for printing and tablet use.",       badge: "Print-ready" },
              { icon: Download, label: "Markdown recipe pack", detail: "Portable archive — paste into Obsidian, Notion, or any notes app. Each recipe is one file.",   badge: "Universal" },
              { icon: ShoppingCart, label: "Shopping CSV",   detail: "This week's ingredients merged and grouped — ready for price tracking or a shared spreadsheet.", badge: "Grocery-ready" },
              { icon: Star, label: "Favourites only",        detail: "Export just your starred recipes as a clean PDF cookbook.",                                       badge: "Curated" },
              { icon: Mic, label: "Voice-ready steps",       detail: "Export step text as a numbered plain-text script for read-aloud use.",                           badge: "Accessibility" },
            ] as fmt}
              <article class="recipes-export-row">
                <div class="recipes-export-icon"><svelte:component this={fmt.icon} size={18}/></div>
                <div class="recipes-export-copy">
                  <strong>{fmt.label}</strong>
                  <p>{fmt.detail}</p>
                </div>
                <Badge variant="secondary">{fmt.badge}</Badge>
                <Button variant="outline"><Download size={14}/> Export</Button>
              </article>
            {/each}
          </CardContent>
        </Card>
      </section>
    {/if}

    {/if}

    <!-- ── ADD RECIPE MODAL ── -->
    {#if showAddModal}
      <div class="recipes-modal-backdrop" role="dialog" aria-modal="true">
        <div class="recipes-modal">
          <div class="recipes-modal__header">
            <h2>Add a new recipe</h2>
            <button type="button" class="recipes-modal__close" onclick={() => (showAddModal = false)}>
              <X size={18}/>
            </button>
          </div>
          <div class="recipes-modal__body">
            <input class="recipes-manual-input" bind:value={manualTitle} placeholder="Recipe title *" />
            <div class="recipes-manual-row">
              <input class="recipes-manual-input" bind:value={manualTime} placeholder="Cook time (e.g. 30 min)" />
              <input class="recipes-manual-input" bind:value={manualServings} placeholder="Servings (e.g. 2)" />
            </div>
            <textarea
              class="recipes-manual-textarea"
              bind:value={manualIngredients}
              placeholder="Ingredients — one per line&#10;e.g. 200g spaghetti&#10;3 eggs"
              rows={5}
            ></textarea>
            <textarea
              class="recipes-manual-textarea"
              bind:value={manualSteps}
              placeholder="Steps — one per line&#10;1. Boil pasta until al dente&#10;2. Whisk eggs with cheese"
              rows={5}
            ></textarea>
            <div class="recipes-modal__actions">
              <Button variant="outline" onclick={() => (showAddModal = false)}>Cancel</Button>
              <Button onclick={submitManualRecipe} disabled={!manualTitle.trim()}>
                {importPhase === "parsing" ? "Saving…" : "Save recipe"}
              </Button>
            </div>
            {#if importPhase === "done"}
              <p class="recipes-modal__success">✅ Recipe saved to your library!</p>
            {/if}
          </div>
        </div>
      </div>
    {/if}

  </section>
</main>

<style>
  /* ══════════════════════════════════════════════════════
     TOKEN LAYER — all values from shell CSS variables.
     No hardcoded colours, no external fonts.
  ══════════════════════════════════════════════════════ */
  :global(.recipes-workspace) {
    --recipes-bg:             var(--background);
    --recipes-surface:        color-mix(in srgb, var(--surface) 96%, var(--background));
    --recipes-surface-strong: color-mix(in srgb, var(--surface) 88%, var(--background));
    --recipes-border:         color-mix(in srgb, var(--border) 86%, transparent);
    --recipes-ink:            var(--foreground);
    --recipes-muted:          var(--muted);
    --recipes-accent:         var(--primary);
    --recipes-star:           color-mix(in srgb, var(--primary) 80%, #f5a623);
    --recipes-easy:           color-mix(in srgb, var(--primary) 60%, #22c55e);
    --recipes-medium:         color-mix(in srgb, var(--primary) 60%, #f59e0b);
    --recipes-hard:           color-mix(in srgb, var(--primary) 60%, #ef4444);

    height: 100%;
    padding: 28px 30px;
    background: var(--recipes-bg);
    color: var(--recipes-ink);
    overflow: hidden;
    font-family: inherit;
  }

  /* ── Shell grid ─────────────────────────────────────── */
  :global(.recipes-shell) {
    display: grid;
    grid-template-rows: auto auto minmax(0, 1fr);
    gap: 18px;
    height: 100%;
    min-height: 0;
  }

  /* ── Header ─────────────────────────────────────────── */
  :global(.recipes-shell__header) {
    display: flex;
    justify-content: space-between;
    gap: 20px;
    align-items: flex-start;
  }
  :global(.recipes-shell__intro) { max-width: 56rem; }
  :global(.recipes-shell__eyebrow) {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
    color: var(--recipes-muted);
    font-size: 0.82rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }
  :global(.recipes-shell__intro) h1 {
    margin: 0;
    font-size: clamp(1.6rem, 2.6vw, 2.4rem);
    line-height: 1.06;
    font-weight: 600;
  }
  :global(.recipes-shell__actions) { display: flex; gap: 12px; flex-shrink: 0; }

  /* ── Shared hero grid (two columns above body) ──────── */
  :global(.recipes-hero-grid) {
    display: grid;
    grid-template-columns: 1.1fr 0.9fr;
    gap: 16px;
  }
  :global(.recipes-hero-grid--cook) { grid-template-columns: 0.72fr 1.28fr; }
  :global(.recipes-hero-grid--plan) { grid-template-columns: 1fr 1fr; }

  /* ── Shared card skin — matches focus/nutrition exactly ─ */
  :global(.recipes-card) {
    border-color: var(--recipes-border) !important;
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--recipes-surface) 98%, var(--recipes-bg)),
      color-mix(in srgb, var(--recipes-surface) 86%, var(--recipes-bg))
    ) !important;
    border-radius: 20px !important;
    overflow: hidden;
    text-align: left;
    color: inherit;
    width: 100%;
  }

  /* ── Shared article row skin ─────────────────────────── */
  :global(.recipes-workspace) article {
    border: 1px solid color-mix(in srgb, var(--recipes-border) 92%, transparent);
    border-radius: 20px;
    background: color-mix(in srgb, var(--recipes-surface-strong) 92%, transparent);
    padding: 14px 16px;
  }

  /* ── Scrollable body region ──────────────────────────── */
  :global(.recipes-shell__body) { min-height: 0; overflow: hidden; display: flex; flex-direction: column; }
  :global(.recipes-panel--full) { height: 100%; display: flex; flex-direction: column; }

  /* ═══════════════════════════════════════════════════════
     RECIPES — library view
  ═══════════════════════════════════════════════════════ */
  :global(.recipes-search-card) :global(.card-content) { padding: 14px 18px !important; }
  :global(.recipes-search-inner) { display: grid; gap: 12px; }
  :global(.recipes-searchbar) {
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--recipes-surface-strong);
    border: 1px solid var(--recipes-border);
    border-radius: 12px;
    padding: 10px 14px;
    color: var(--recipes-muted);
  }
  :global(.recipes-search-input) {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    font: inherit;
    color: var(--recipes-ink);
    font-size: 0.92rem;
  }
  :global(.recipes-clear-btn) {
    background: none; border: none; color: var(--recipes-muted); display: flex; align-items: center;
  }

  :global(.recipes-chips) { display: flex; gap: 8px; flex-wrap: wrap; }
  :global(.recipes-chip) {
    background: transparent;
    border: 1px solid var(--recipes-border);
    color: var(--recipes-muted);
    padding: 6px 14px;
    border-radius: 999px;
    font-size: 0.82rem;
    font-weight: 500;
    white-space: nowrap;
    font-family: inherit;
  }
  :global(.recipes-chip.active) {
    background: var(--recipes-accent);
    color: var(--recipes-bg);
    border-color: var(--recipes-accent);
  }

  :global(.recipes-can-make-card) :global(.card-content) { display: flex; gap: 10px; flex-wrap: wrap; align-content: flex-start; }
  :global(.recipes-can-make-list) { display: flex; gap: 10px; flex-wrap: wrap; }
  :global(.recipes-can-make-pill) {
    padding: 8px 16px;
    border: 1px solid color-mix(in srgb, var(--recipes-accent) 40%, var(--recipes-border));
    border-radius: 999px;
    background: color-mix(in srgb, var(--recipes-accent) 10%, var(--recipes-surface));
    color: var(--recipes-ink);
    font: inherit;
    font-size: 0.85rem;
  }

  :global(.recipes-grid) {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px;
    padding: 4px 0 16px;
    overflow-y: auto;
    height: 100%;
  }

  :global(.recipes-recipe-card) {
    border: none;
    padding: 0;
    cursor: default;
    display: flex;
    flex-direction: column;
  }
  :global(.recipes-recipe-card):hover {
    border-color: color-mix(in srgb, var(--recipes-accent) 40%, var(--recipes-border)) !important;
  }

  :global(.recipes-card-image) {
    width: 100%;
    height: 148px;
    background-size: cover;
    background-position: center;
    position: relative;
    flex-shrink: 0;
  }
  :global(.recipes-card-image__top) {
    position: absolute;
    top: 10px;
    left: 12px;
    display: flex;
    align-items: center;
    gap: 6px;
    background: color-mix(in srgb, var(--recipes-bg) 70%, transparent);
    border-radius: 999px;
    padding: 4px 10px;
  }
  :global(.recipes-difficulty-dot) {
    width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
  }
  :global(.recipes-difficulty-label) { font-size: 0.74rem; font-weight: 600; }
  :global(.recipes-fav-badge) {
    position: absolute;
    top: 10px; right: 12px;
    width: 30px; height: 30px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--recipes-bg) 72%, transparent);
    display: flex; align-items: center; justify-content: center;
    color: var(--recipes-accent);
  }

  :global(.recipes-card-body) { padding: 14px 16px; display: grid; gap: 10px; }
  :global(.recipes-card-title-row) { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
  :global(.recipes-card-title) { margin: 0; font-size: 0.94rem; font-weight: 600; line-height: 1.35; }
  :global(.recipes-card-rating) { display: flex; align-items: center; gap: 4px; font-size: 0.78rem; color: var(--recipes-muted); flex-shrink: 0; }
  :global(.recipes-card-meta) { display: flex; gap: 12px; color: var(--recipes-muted); flex-wrap: wrap; }
  :global(.recipes-card-meta) span { display: flex; align-items: center; gap: 5px; font-size: 0.8rem; }
  :global(.recipes-card-tags) { display: flex; gap: 6px; flex-wrap: wrap; }
  :global(.recipes-tag) {
    padding: 3px 10px;
    border-radius: 999px;
    font-size: 0.74rem;
    background: color-mix(in srgb, var(--recipes-accent) 10%, var(--recipes-surface));
    color: var(--recipes-muted);
  }

  :global(.recipes-empty) {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    color: var(--recipes-muted);
  }

  /* ═══════════════════════════════════════════════════════
     RECIPE DETAIL
  ═══════════════════════════════════════════════════════ */
  :global(.recipes-detail-grid) {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    min-height: 0;
    overflow: hidden;
  }
  :global(.recipes-detail-left),
  :global(.recipes-detail-right) {
    display: grid;
    gap: 14px;
    align-content: start;
    overflow-y: auto;
    min-height: 0;
  }
  :global(.recipes-detail-image) {
    height: 220px;
    background-size: cover;
    background-position: center;
    position: relative;
    border-radius: 16px 16px 0 0;
  }
  :global(.recipes-detail-image__overlay) {
    position: absolute;
    inset: 0;
    background: linear-gradient(to top, color-mix(in srgb, var(--recipes-bg) 78%, transparent) 40%, transparent);
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    padding: 18px 20px;
    gap: 10px;
    border-radius: inherit;
  }
  :global(.recipes-detail-title) {
    font-family: 'Cormorant Garamond', serif;
    font-size: 2rem;
    font-weight: 300;
    line-height: 1.15;
    letter-spacing: -0.01em;
  }
  :global(.recipes-detail-badges) { display: flex; gap: 8px; flex-wrap: wrap; }
  :global(.recipes-detail-meta-row) {
    display: flex;
    gap: 18px;
    flex-wrap: wrap;
    padding: 14px 18px !important;
    align-items: center;
  }
  :global(.recipes-meta-stat) {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 0.85rem;
    color: var(--recipes-muted);
  }
  :global(.recipes-scale-btn) {
    background: none; border: none; color: var(--recipes-muted);
    display: inline-flex; align-items: center; padding: 2px 5px; border-radius: 4px;
    font-family: inherit;
  }
  :global(.recipes-scale-btn):hover { color: var(--recipes-ink); background: color-mix(in srgb, var(--recipes-border) 60%, transparent); }

  :global(.recipes-nutrition-grid) {
    display: grid;
    grid-template-columns: 1fr repeat(3, 1fr);
    gap: 10px;
  }
  :global(.recipes-nutrition-tile) {
    border: 1px solid var(--recipes-border);
    border-radius: 16px;
    background: var(--recipes-surface-strong);
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  :global(.recipes-nutrition-tile--calories) {
    background: color-mix(in srgb, var(--recipes-accent) 12%, var(--recipes-surface));
    border-color: color-mix(in srgb, var(--recipes-accent) 30%, var(--recipes-border));
  }
  :global(.recipes-nutrition-tile) strong { font-size: 1.35rem; font-weight: 700; }
  :global(.recipes-nutrition-tile) span { font-size: 0.75rem; color: var(--recipes-muted); text-transform: uppercase; letter-spacing: 0.1em; }

  :global(.recipes-card--note) { border-color: color-mix(in srgb, var(--recipes-accent) 28%, var(--recipes-border)) !important; }
  :global(.recipes-note-text) { margin: 0; font-size: 0.87rem; color: var(--recipes-muted); line-height: 1.6; }

  :global(.recipes-ingredient-list) { display: grid; gap: 8px; }
  :global(.recipes-ingredient-row) {
    display: grid;
    grid-template-columns: 28px 1fr auto;
    align-items: start;
    gap: 10px;
    padding: 12px 14px;
    border-radius: 16px;
    border: 1px solid var(--recipes-border);
    background: color-mix(in srgb, var(--recipes-surface-strong) 92%, transparent);
    cursor: default;
    text-align: left;
    color: inherit;
    font: inherit;
  }
  :global(.recipes-ingredient-row.checked) { opacity: 0.45; text-decoration: line-through; }
  :global(.recipes-ingredient-row.checked) :global(.recipes-ing-check) { background: var(--recipes-accent); border-color: var(--recipes-accent); color: var(--recipes-bg); }
  :global(.recipes-ing-check) {
    width: 22px; height: 22px; border-radius: 8px; border: 1.5px solid var(--recipes-border);
    display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px;
  }
  :global(.recipes-ing-copy) { display: grid; gap: 4px; }
  :global(.recipes-ing-name) { font-size: 0.88rem; font-weight: 500; }
  :global(.recipes-sub-toggle) { font-size: 0.74rem; color: var(--recipes-accent); background: none; border: none; padding: 0; font-family: inherit; text-align: left; }
  :global(.recipes-substitute) { margin: 0; font-size: 0.78rem; color: var(--recipes-muted); font-style: italic; }
  :global(.recipes-ing-amount) { font-size: 0.82rem; color: var(--recipes-muted); white-space: nowrap; }

  :global(.recipes-step-list) { display: grid; gap: 10px; }
  :global(.recipes-step-row) {
    display: grid; grid-template-columns: 36px 1fr; gap: 12px; align-items: start;
    padding: 14px 16px; border-radius: 16px;
    border: 1px solid var(--recipes-border);
    background: color-mix(in srgb, var(--recipes-surface-strong) 92%, transparent);
  }
  :global(.recipes-step-number) {
    width: 32px; height: 32px; border-radius: 50%;
    border: 1.5px solid var(--recipes-border);
    display: flex; align-items: center; justify-content: center;
    font-size: 0.78rem; font-weight: 700; color: var(--recipes-muted); flex-shrink: 0;
  }
  :global(.recipes-step-copy) { display: grid; gap: 8px; }
  :global(.recipes-step-copy) p { margin: 0; font-size: 0.88rem; line-height: 1.6; }
  :global(.recipes-step-timer-hint) { display: flex; align-items: center; gap: 6px; font-size: 0.78rem; color: var(--recipes-muted); }

  /* ═══════════════════════════════════════════════════════
     IMPORT
  ═══════════════════════════════════════════════════════ */
  :global(.recipes-import-methods) { display: grid; gap: 10px; }
  :global(.recipes-import-method-btn) {
    display: grid; grid-template-columns: 44px 1fr; gap: 12px; align-items: center;
    padding: 14px 16px; border-radius: 16px; border: 1px solid var(--recipes-border);
    background: color-mix(in srgb, var(--recipes-surface-strong) 92%, transparent);
    text-align: left; color: inherit; font: inherit; cursor: default;
  }
  :global(.recipes-import-method-btn.active) {
    border-color: color-mix(in srgb, var(--recipes-accent) 50%, var(--recipes-border));
    background: color-mix(in srgb, var(--recipes-accent) 10%, var(--recipes-surface));
  }
  :global(.recipes-import-method-btn) strong { font-size: 0.9rem; display: block; }
  :global(.recipes-import-method-btn) p { margin: 4px 0 0; font-size: 0.78rem; color: var(--recipes-muted); }
  :global(.recipes-import-icon) {
    width: 40px; height: 40px; border-radius: 12px;
    border: 1px solid var(--recipes-border);
    background: var(--recipes-surface-strong);
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    color: var(--recipes-accent);
  }

  :global(.recipes-import-input-panel) { display: grid; gap: 14px; }
  :global(.recipes-url-row) { display: flex; gap: 10px; }
  :global(.recipes-url-input) {
    flex: 1; padding: 10px 14px; border-radius: 12px;
    border: 1px solid var(--recipes-border);
    background: var(--recipes-surface-strong);
    color: var(--recipes-ink); font: inherit; font-size: 0.88rem; outline: none;
  }
  :global(.recipes-import-preview) {
    display: flex; gap: 14px; align-items: center;
    border: 1px solid color-mix(in srgb, var(--recipes-accent) 40%, var(--recipes-border));
    border-radius: 16px; padding: 14px 16px;
    background: color-mix(in srgb, var(--recipes-accent) 8%, var(--recipes-surface));
  }
  :global(.recipes-import-preview__img) {
    width: 72px; height: 72px; border-radius: 12px;
    background-size: cover; background-position: center; flex-shrink: 0;
  }
  :global(.recipes-import-preview) strong { display: block; font-size: 0.96rem; }
  :global(.recipes-import-preview) p { margin: 4px 0 10px; font-size: 0.78rem; color: var(--recipes-muted); }

  :global(.recipes-photo-drop) {
    border: 2px dashed var(--recipes-border); border-radius: 16px; padding: 40px 20px;
    display: flex; flex-direction: column; align-items: center; gap: 12px;
    color: var(--recipes-muted); text-align: center;
  }
  :global(.recipes-manual-form) { display: grid; gap: 10px; }
  :global(.recipes-manual-input) {
    padding: 10px 14px; border-radius: 12px; border: 1px solid var(--recipes-border);
    background: var(--recipes-surface-strong); color: var(--recipes-ink); font: inherit; font-size: 0.88rem; outline: none;
  }
  :global(.recipes-manual-row) { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  :global(.recipes-manual-textarea) {
    padding: 10px 14px; border-radius: 12px; border: 1px solid var(--recipes-border);
    background: var(--recipes-surface-strong); color: var(--recipes-ink); font: inherit; font-size: 0.85rem;
    resize: vertical; outline: none; min-height: 80px;
  }

  :global(.recipes-import-inbox) { display: grid; gap: 10px; min-height: 0; overflow: auto; }
  :global(.recipes-inbox-row) {
    display: grid; grid-template-columns: 10px 1fr auto; gap: 14px; align-items: center;
  }
  :global(.recipes-inbox-dot) {
    width: 10px; height: 10px; border-radius: 50%;
    background: color-mix(in srgb, var(--recipes-accent) 70%, var(--recipes-muted));
    flex-shrink: 0;
  }
  :global(.recipes-inbox-copy) strong { display: block; font-size: 0.9rem; }
  :global(.recipes-inbox-copy) p { margin: 3px 0 0; font-size: 0.78rem; color: var(--recipes-muted); }
  :global(.recipes-inbox-actions) { display: flex; gap: 8px; }

  /* ═══════════════════════════════════════════════════════
     COOK MODE
  ═══════════════════════════════════════════════════════ */
  :global(.recipes-cook-picker) {
    display: flex; flex-direction: column; gap: 8px; overflow-y: auto;
  }
  :global(.recipes-cook-pick-btn) {
    display: flex; align-items: center; gap: 12px;
    padding: 10px 12px; border-radius: 14px; border: 1px solid var(--recipes-border);
    background: color-mix(in srgb, var(--recipes-surface-strong) 92%, transparent);
    text-align: left; color: inherit; font: inherit; font-size: 0.88rem;
  }
  :global(.recipes-cook-pick-btn.active) {
    border-color: color-mix(in srgb, var(--recipes-accent) 50%, var(--recipes-border));
    background: color-mix(in srgb, var(--recipes-accent) 10%, var(--recipes-surface));
  }
  :global(.recipes-cook-pick-img) {
    width: 40px; height: 40px; border-radius: 10px; background-size: cover; background-position: center; flex-shrink: 0;
  }

  :global(.recipes-cook-controls) { display: grid; gap: 16px; }
  :global(.recipes-cook-control-row) { display: flex; justify-content: space-between; align-items: center; }
  :global(.recipes-cook-label) { font-size: 0.82rem; color: var(--recipes-muted); text-transform: uppercase; letter-spacing: 0.1em; }
  :global(.recipes-cook-stepper) { display: flex; align-items: center; gap: 14px; }
  :global(.recipes-cook-stepper) button {
    width: 32px; height: 32px; border-radius: 50%; border: 1px solid var(--recipes-border);
    background: var(--recipes-surface-strong); color: inherit; display: flex; align-items: center; justify-content: center;
  }
  :global(.recipes-cook-stepper) strong { font-size: 1.2rem; min-width: 28px; text-align: center; }

  :global(.recipes-cook-timer-block) { display: grid; gap: 12px; }
  :global(.recipes-cook-timer-display) {
    font-size: 3.6rem; font-weight: 700; text-align: center; letter-spacing: -0.04em; line-height: 1;
    font-feature-settings: "tnum";
    padding: 18px 0;
    border: 1px solid var(--recipes-border);
    border-radius: 18px;
    background: color-mix(in srgb, var(--recipes-surface-strong) 80%, transparent);
  }
  :global(.recipes-cook-timer-actions) { display: flex; gap: 10px; }
  :global(.recipes-cook-timer-actions) :global(button) { flex: 1; }
  :global(.recipes-cook-quick-timers) { display: flex; gap: 8px; flex-wrap: wrap; }
  :global(.recipes-quick-timer-btn) {
    padding: 6px 14px; border-radius: 999px; border: 1px solid var(--recipes-border);
    background: color-mix(in srgb, var(--recipes-accent) 8%, var(--recipes-surface));
    color: var(--recipes-ink); font: inherit; font-size: 0.8rem;
  }
  :global(.recipes-awake-toggle) {
    padding: 6px 20px; border-radius: 999px; border: 1px solid var(--recipes-border);
    background: var(--recipes-surface-strong); color: var(--recipes-muted); font: inherit; font-size: 0.82rem;
  }
  :global(.recipes-awake-toggle.active) {
    background: color-mix(in srgb, var(--recipes-accent) 12%, var(--recipes-surface));
    border-color: color-mix(in srgb, var(--recipes-accent) 40%, var(--recipes-border));
    color: var(--recipes-ink);
  }
  :global(.recipes-cook-awake-row) { display: flex; justify-content: space-between; align-items: center; }

  :global(.recipes-cook-steps) { display: grid; gap: 10px; min-height: 0; overflow-y: auto; }
  :global(.recipes-cook-step) {
    display: grid; grid-template-columns: 46px 1fr auto; gap: 14px; align-items: start;
    padding: 18px 20px; border-radius: 18px; border: 1px solid var(--recipes-border);
    background: color-mix(in srgb, var(--recipes-surface-strong) 92%, transparent);
    cursor: default; font: inherit; text-align: left; color: inherit;
  }
  :global(.recipes-cook-step.active) {
    border-color: color-mix(in srgb, var(--recipes-accent) 50%, var(--recipes-border));
    background: color-mix(in srgb, var(--recipes-accent) 8%, var(--recipes-surface));
  }
  :global(.recipes-cook-step.completed) { opacity: 0.45; }
  :global(.recipes-cook-step-num) {
    width: 40px; height: 40px; border-radius: 50%; border: 2px solid var(--recipes-border);
    display: flex; align-items: center; justify-content: center;
    font-size: 0.9rem; font-weight: 700; color: var(--recipes-muted); flex-shrink: 0;
  }
  :global(.recipes-cook-step.active) :global(.recipes-cook-step-num) {
    border-color: var(--recipes-accent); color: var(--recipes-accent);
  }
  :global(.recipes-cook-step.completed) :global(.recipes-cook-step-num) {
    background: var(--recipes-accent); border-color: var(--recipes-accent); color: var(--recipes-bg);
  }
  :global(.recipes-cook-step-body) { display: grid; gap: 10px; }
  :global(.recipes-cook-step-body) p { margin: 0; font-size: 1rem; line-height: 1.65; }
  :global(.recipes-cook-step-timer-btn) {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 6px 14px; border-radius: 999px; border: 1px solid var(--recipes-border);
    background: color-mix(in srgb, var(--recipes-accent) 10%, var(--recipes-surface));
    color: var(--recipes-muted); font: inherit; font-size: 0.8rem;
  }
  :global(.recipes-cook-step-done) { font-size: 0.76rem; color: var(--recipes-muted); align-self: center; }

  /* ═══════════════════════════════════════════════════════
     MEAL PLAN
  ═══════════════════════════════════════════════════════ */
  :global(.recipes-plan-stats) { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  :global(.recipes-plan-stats) article { display: grid; gap: 6px; border-radius: 16px; padding: 16px; }
  :global(.recipes-plan-stats) span { font-size: 0.76rem; color: var(--recipes-muted); text-transform: uppercase; letter-spacing: 0.1em; }
  :global(.recipes-plan-stats) strong { font-size: 1.5rem; font-weight: 700; }

  :global(.recipes-plan-generate) { display: grid; gap: 14px; align-content: start; }
  :global(.recipes-plan-generate) p { margin: 0; font-size: 0.85rem; color: var(--recipes-muted); line-height: 1.6; }

  :global(.recipes-week-grid) {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 10px;
    min-height: 0;
    overflow: auto;
  }
  :global(.recipes-day-col) { display: grid; gap: 8px; align-content: start; }
  :global(.recipes-day-header) {
    text-align: center; font-size: 0.74rem; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.12em; color: var(--recipes-muted);
    padding: 8px 4px;
  }
  :global(.recipes-meal-slot) {
    border: 1px solid var(--recipes-border); border-radius: 14px; padding: 10px 12px;
    background: color-mix(in srgb, var(--recipes-surface-strong) 90%, transparent);
    display: grid; gap: 5px; min-height: 70px; align-content: center;
  }
  :global(.recipes-meal-slot.filled) {
    border-color: color-mix(in srgb, var(--recipes-accent) 36%, var(--recipes-border));
    background: color-mix(in srgb, var(--recipes-accent) 7%, var(--recipes-surface));
  }
  :global(.recipes-meal-slot.empty) { align-items: center; justify-items: center; color: var(--recipes-muted); }
  :global(.recipes-slot-meal-label) { font-size: 0.64rem; color: var(--recipes-muted); text-transform: uppercase; letter-spacing: 0.1em; }
  :global(.recipes-slot-title) { font-size: 0.78rem; font-weight: 600; line-height: 1.35; }
  :global(.recipes-slot-empty-label) { font-size: 0.7rem; color: var(--recipes-muted); text-transform: uppercase; }

  /* ═══════════════════════════════════════════════════════
     SHOPPING
  ═══════════════════════════════════════════════════════ */
  :global(.recipes-shopping-controls) { display: grid; gap: 10px; }
  :global(.recipes-pantry-status) { display: grid; gap: 8px; }
  :global(.recipes-pantry-row) {
    display: flex; align-items: center; gap: 12px;
    border-radius: 14px; padding: 10px 14px;
  }
  :global(.recipes-pantry-dot) {
    width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0;
  }
  :global(.recipes-pantry-dot.low) { background: var(--recipes-medium); }
  :global(.recipes-pantry-dot.out) { background: var(--recipes-hard); }
  :global(.recipes-pantry-row) span { flex: 1; font-size: 0.88rem; }

  :global(.recipes-shopping-list) { display: grid; gap: 18px; min-height: 0; overflow-y: auto; }
  :global(.recipes-shopping-group) { display: grid; gap: 8px; }
  :global(.recipes-shopping-group-label) {
    font-size: 0.72rem; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.14em; color: var(--recipes-muted); padding: 0 4px;
  }
  :global(.recipes-shopping-item) {
    display: grid; grid-template-columns: 30px 1fr auto; gap: 12px; align-items: center;
    padding: 12px 16px; border-radius: 16px; border: 1px solid var(--recipes-border);
    background: color-mix(in srgb, var(--recipes-surface-strong) 92%, transparent);
    text-align: left; color: inherit; font: inherit;
  }
  :global(.recipes-shopping-item.checked) { opacity: 0.42; }
  :global(.recipes-shopping-check) {
    width: 24px; height: 24px; border-radius: 8px; border: 1.5px solid var(--recipes-border);
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  :global(.recipes-shopping-item.checked) :global(.recipes-shopping-check) {
    background: var(--recipes-accent); border-color: var(--recipes-accent); color: var(--recipes-bg);
  }
  :global(.recipes-shopping-copy) span { font-size: 0.9rem; font-weight: 500; display: block; }
  :global(.recipes-shopping-copy) p { margin: 3px 0 0; font-size: 0.76rem; color: var(--recipes-muted); }
  :global(.recipes-shopping-amount) { font-size: 0.82rem; color: var(--recipes-muted); white-space: nowrap; }

  /* ═══════════════════════════════════════════════════════
     EXPORT
  ═══════════════════════════════════════════════════════ */
  :global(.recipes-export-list) { display: grid; gap: 10px; min-height: 0; overflow-y: auto; }
  :global(.recipes-export-row) {
    display: grid; grid-template-columns: 44px 1fr auto auto; gap: 14px; align-items: center;
    padding: 16px 18px;
  }
  :global(.recipes-export-icon) {
    width: 40px; height: 40px; border-radius: 12px;
    background: color-mix(in srgb, var(--recipes-accent) 12%, var(--recipes-surface));
    border: 1px solid color-mix(in srgb, var(--recipes-accent) 24%, var(--recipes-border));
    display: flex; align-items: center; justify-content: center;
    color: var(--recipes-accent); flex-shrink: 0;
  }
  :global(.recipes-export-copy) strong { display: block; font-size: 0.9rem; }
  :global(.recipes-export-copy) p { margin: 4px 0 0; font-size: 0.78rem; color: var(--recipes-muted); }

  /* ═══════════════════════════════════════════════════════
     DIETARY PROFILE PANEL
  ═══════════════════════════════════════════════════════ */
  :global(.recipes-profile-panel) { margin-bottom: 4px; }
  :global(.recipes-profile-body) { display: grid; gap: 16px; }
  :global(.recipes-profile-section) { display: grid; gap: 8px; }
  :global(.recipes-profile-label) {
    font-size: 0.74rem; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.12em; color: var(--recipes-muted);
  }
  :global(.recipes-chip--danger.active) {
    background: color-mix(in srgb, var(--recipes-hard) 18%, var(--recipes-surface));
    border-color: color-mix(in srgb, var(--recipes-hard) 50%, var(--recipes-border));
    color: var(--recipes-hard);
  }

  /* ═══════════════════════════════════════════════════════
     ALLERGEN WARNING
  ═══════════════════════════════════════════════════════ */
  :global(.recipes-allergen-warning) {
    padding: 12px 16px;
    border-radius: 14px;
    border: 1px solid color-mix(in srgb, var(--recipes-hard) 40%, var(--recipes-border));
    background: color-mix(in srgb, var(--recipes-hard) 8%, var(--recipes-surface));
    color: var(--recipes-hard);
    font-size: 0.85rem;
    font-weight: 500;
  }
  :global(.recipes-allergen-badge) {
    position: absolute; bottom: 10px; right: 12px;
    font-size: 1rem; line-height: 1;
  }

  /* ═══════════════════════════════════════════════════════
     DIET TAG VARIANT
  ═══════════════════════════════════════════════════════ */
  :global(.recipes-tag--diet) {
    background: color-mix(in srgb, var(--recipes-easy) 14%, var(--recipes-surface));
    color: var(--recipes-easy);
  }

  /* ═══════════════════════════════════════════════════════
     VOICE STATUS
  ═══════════════════════════════════════════════════════ */
  :global(.recipes-voice-status) {
    display: flex; align-items: center; gap: 8px;
    padding: 10px 14px; border-radius: 12px;
    border: 1px solid var(--recipes-border);
    background: color-mix(in srgb, var(--recipes-surface-strong) 90%, transparent);
    font-size: 0.82rem; color: var(--recipes-muted);
  }
  :global(.recipes-voice-status.listening) {
    border-color: color-mix(in srgb, var(--recipes-accent) 40%, var(--recipes-border));
    background: color-mix(in srgb, var(--recipes-accent) 8%, var(--recipes-surface));
    color: var(--recipes-accent);
  }

  /* ═══════════════════════════════════════════════════════
     COOK HISTORY
  ═══════════════════════════════════════════════════════ */
  :global(.recipes-cook-history-label) {
    font-size: 0.74rem; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.12em; color: var(--recipes-muted); padding: 4px 0;
  }
  :global(.recipes-cook-history) { display: grid; gap: 8px; }
  :global(.recipes-cook-history-row) {
    display: flex; justify-content: space-between; align-items: center; gap: 12px;
    padding: 10px 14px; border-radius: 14px;
    border: 1px solid var(--recipes-border);
    background: color-mix(in srgb, var(--recipes-surface-strong) 90%, transparent);
  }
  :global(.recipes-cook-history-copy) strong { display: block; font-size: 0.88rem; }
  :global(.recipes-cook-history-copy) p { margin: 2px 0 0; font-size: 0.75rem; color: var(--recipes-muted); }

  /* ═══════════════════════════════════════════════════════
     LOADING & ERROR STATES
  ═══════════════════════════════════════════════════════ */
  :global(.recipes-loading) {
    height: 100%; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 16px;
    color: var(--recipes-muted);
  }
  :global(.recipes-loading-spinner) {
    width: 36px; height: 36px; border-radius: 50%;
    border: 3px solid color-mix(in srgb, var(--recipes-accent) 20%, var(--recipes-border));
    border-top-color: var(--recipes-accent);
    animation: recipes-spin 0.8s linear infinite;
  }
  @keyframes recipes-spin { to { transform: rotate(360deg); } }
  :global(.recipes-db-error) {
    height: 100%; display: flex; align-items: center; justify-content: center; gap: 20px;
    padding: 40px;
  }
  :global(.recipes-db-error__icon) { font-size: 2.5rem; }
  :global(.recipes-db-error__body) { display: grid; gap: 10px; max-width: 460px; }
  :global(.recipes-db-error__body) strong { font-size: 1.05rem; }
  :global(.recipes-db-error__body) p { margin: 0; font-size: 0.85rem; color: var(--recipes-muted); font-family: monospace; word-break: break-all; }
  :global(.recipes-db-error__hint) { font-family: inherit !important; color: var(--recipes-muted); }
  :global(.recipes-db-error__hint) code { font-family: monospace; background: color-mix(in srgb, var(--recipes-border) 60%, transparent); padding: 2px 6px; border-radius: 4px; }

  /* ═══════════════════════════════════════════════════════
     ADD RECIPE MODAL
  ═══════════════════════════════════════════════════════ */
  :global(.recipes-modal-backdrop) {
    position: fixed; inset: 0; z-index: 999;
    background: color-mix(in srgb, var(--recipes-bg) 60%, transparent);
    backdrop-filter: blur(6px);
    display: flex; align-items: center; justify-content: center;
    padding: 24px;
  }
  :global(.recipes-modal) {
    width: 100%; max-width: 560px;
    background: var(--recipes-surface);
    border: 1px solid var(--recipes-border);
    border-radius: 24px;
    overflow: hidden;
    box-shadow: 0 24px 64px color-mix(in srgb, var(--recipes-bg) 40%, transparent);
  }
  :global(.recipes-modal__header) {
    display: flex; align-items: center; justify-content: space-between;
    padding: 20px 24px 0; gap: 12px;
  }
  :global(.recipes-modal__header) h2 { margin: 0; font-size: 1.15rem; font-weight: 600; }
  :global(.recipes-modal__close) {
    background: none; border: none; color: var(--recipes-muted);
    display: flex; align-items: center; justify-content: center;
    width: 32px; height: 32px; border-radius: 8px; flex-shrink: 0;
  }
  :global(.recipes-modal__close):hover { background: color-mix(in srgb, var(--recipes-border) 60%, transparent); color: var(--recipes-ink); }
  :global(.recipes-modal__body) { padding: 20px 24px 24px; display: grid; gap: 12px; }
  :global(.recipes-modal__actions) { display: flex; gap: 10px; justify-content: flex-end; margin-top: 4px; }
  :global(.recipes-modal__success) { margin: 0; font-size: 0.85rem; color: var(--recipes-easy); }
</style>
