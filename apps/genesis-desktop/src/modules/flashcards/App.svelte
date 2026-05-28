<script lang="ts">
  import { browser } from "$app/environment";
  import { onMount } from "svelte";
  import Search from "@lucide/svelte/icons/search";
  import { activeBundle, createTranslator, defaultBundle } from "$lib/i18n";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Card } from "$lib/components/ui/card/index.js";
  import * as Select from "$lib/components/ui/select/index.js";
  import {
    deleteFromIndex,
    indexContent,
    searchInModule,
    type SearchDocument,
  } from "$lib/services/search";
  import { time } from "$lib/utils/time";
  import {
    ensureModuleSection,
    getModuleSectionLabel,
    moduleSectionStore,
    setModuleSection,
  } from "$lib/stores/module-sections.store";

  const moduleId = "flashcards";
  const sectionLabels = ["Decks", "Due Today", "Learn", "Cram", "Generate", "Progress"] as const;
  type SectionLabel = (typeof sectionLabels)[number];

  type RecallContext = "Focus" | "Health" | "Recipes" | "Life";
  type ReviewGrade = "again" | "hard" | "good" | "easy";

  type RecallCard = {
    id: string;
    deckId: string;
    context: RecallContext;
    cue: string;
    anchor: string;
    createdAt: number;
    dueAt: number;
    reviewedAt: number | null;
    intervalDays: number;
    ease: number;
    streak: number;
    mastery: number;
    pinned: boolean;
    archived: boolean;
    source?: string;
  };

  type RecallDeck = {
    id: string;
    title: string;
    context: RecallContext;
    note: string;
    createdAt: number;
    archived: boolean;
    cards: RecallCard[];
  };

  type PersistedState = {
    version: 1;
    activeDeckId: string | null;
    decks: RecallDeck[];
  };

  const STORAGE_KEY = "bento_recall_state_v1";
  const LEGACY_KEY = "bento_flashcards";
  const DAY_MS = 86_400_000;
  const now = () => time.now();
  const contextOrder: RecallContext[] = ["Focus", "Health", "Recipes", "Life"];

  const contextMeta: Record<RecallContext, { accent: string; title: string; blurb: string; glyph: string }> = {
    Focus: {
      accent: "#f5c400",
      title: "Focus",
      blurb: "Rituals, blocks, and the cues that protect attention.",
      glyph: "focus",
    },
    Health: {
      accent: "#c8f535",
      title: "Health",
      blurb: "Recovery cues, body checks, and the habits that keep you steady.",
      glyph: "heart",
    },
    Recipes: {
      accent: "#d4a017",
      title: "Recipes",
      blurb: "Kitchen memory for techniques, timing, and taste decisions.",
      glyph: "chef",
    },
    Life: {
      accent: "#8b5cf6",
      title: "Life",
      blurb: "Useful rules, identity prompts, and the things Bento should remember.",
      glyph: "spark",
    },
  };

  let loading = $state(true);
  let error = $state("");
  let decks: RecallDeck[] = $state([]);
  let activeDeckId: string | null = $state(null);
  let captureDeckId: string | null = $state(null);
  let reviewIndex = $state(0);
  let revealAnswer = $state(false);
  let search = $state("");
  let sectionFilter: RecallContext | "All" = $state("All");
  let flashMessage = $state("");
  let searchMatchedDeckIds = $state<Set<string> | null>(null);
  let searchTicket = 0;
  let indexedDeckIds = new Set<string>();

  let newDeckTitle = $state("");
  let newDeckContext: RecallContext = $state("Focus");
  let newDeckNote = $state("");
  let newCue = $state("");
  let newAnchor = $state("");
  let newCueContext: RecallContext = $state("Focus");

  let lastSectionDeckId: string | null = null;

  function uid(prefix: string) {
    return `${prefix}-${Math.random().toString(36).slice(2, 8)}-${time.now().toString(36)}`;
  }

  function dayOffset(days: number) {
    return now() + days * DAY_MS;
  }

  function sameDay(a: number | null) {
    if (a == null) return false;
    const left = new Date(a);
    const right = new Date();
    return left.getFullYear() === right.getFullYear()
      && left.getMonth() === right.getMonth()
      && left.getDate() === right.getDate();
  }

  function formatDue(target: number) {
    const _b = $activeBundle ?? defaultBundle;
    const delta = Math.round((target - now()) / DAY_MS);
    if (delta <= -1) return `${Math.abs(delta)}d ${_b["moduleFlashcardsOverdue"] ?? "overdue"}`;
    if (delta === 0) return _b["moduleFlashcardsDueToday"] ?? "Due today";
    if (delta === 1) return _b["moduleFlashcardsDueTomorrow"] ?? "Due tomorrow";
    return `${_b["moduleFlashcardsDueIn"] ?? "Due in"} ${delta}d`;
  }

  function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
  }

  function progressLabel(value: number) {
    return `${Math.round(value)}%`;
  }

  function iconGlyph(kind: string) {
    switch (kind) {
      case "focus":
        return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.8"/>
          <path d="M12 5v4M12 15v4M5 12h4M15 12h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        </svg>`;
      case "heart":
        return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 20s-7-4.4-9.3-8.1C.9 8.6 2.2 5.3 5.4 4.5c1.9-.5 3.9.2 5.2 1.7 1.3-1.5 3.3-2.2 5.2-1.7 3.2.8 4.5 4.1 2.7 7.4C19 15.6 12 20 12 20Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
        </svg>`;
      case "chef":
        return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M8 19h8m-7 0V9.8a4 4 0 0 1 8 0V19" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          <path d="M7 10.4a3.2 3.2 0 0 1-1.2-6.2A3.2 3.2 0 0 1 9.3 5.5a3.2 3.2 0 0 1 5.4 0 3.2 3.2 0 0 1 3.5-1.3 3.2 3.2 0 0 1 0 6.2" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
        </svg>`;
      case "spark":
      default:
        return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 3.8 13.9 9l5.2 1.9-5.2 1.9L12 18l-1.9-5.2L4.9 10.9 10.1 9 12 3.8Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
          <path d="M19.5 15.2 20.3 17.5 22.6 18.3 20.3 19.1 19.5 21.4 18.7 19.1 16.4 18.3 18.7 17.5 19.5 15.2Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
        </svg>`;
    }
  }

  function buttonIcon(kind: string) {
    switch (kind) {
      case "plus":
        return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>
        </svg>`;
      case "shuffle":
        return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 7h3.2c2.3 0 3.7 1.1 5 2.7l1 1.2c1.2 1.5 2.6 2.6 4.8 2.6H20" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          <path d="m16 5 4 4-4 4M16 15l4 4-4 4M4 17h3.2c2.3 0 3.7-1.1 5-2.7l1-1.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
      case "archive":
        return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v1A1.5 1.5 0 0 1 18.5 9h-13A1.5 1.5 0 0 1 4 7.5v-1Z" stroke="currentColor" stroke-width="1.8"/>
          <path d="M8 13h8M8 13l4 4 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
      case "repeat":
        return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M7 7h10.2a3.8 3.8 0 0 1 3.8 3.8V13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          <path d="M16 4.8 19.2 8 16 11.2M17 17H6.8A3.8 3.8 0 0 1 3 13.2V11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          <path d="M8 20 4.8 16.8 8 13.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
      case "clock":
        return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="7.8" stroke="currentColor" stroke-width="1.8"/>
          <path d="M12 7.7V12l3 1.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
      case "check":
        return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5 12.4 9.2 16.5 19 7.5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
      case "brain":
        return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M8.2 6.3a3.5 3.5 0 0 1 6.1 1.8 3 3 0 0 1 2.8 5.1 3.1 3.1 0 0 1-2.1 5.3H8.8a3.4 3.4 0 0 1-2.9-5.2 3 3 0 0 1 1.1-5.8 3.2 3.2 0 0 1 1.2-1.2Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
        </svg>`;
      default:
        return buttonIcon("plus");
    }
  }

  function contextIcon(context: RecallContext) {
    return iconGlyph(contextMeta[context].glyph);
  }

  function isDue(card: RecallCard) {
    return !card.archived && card.dueAt <= now();
  }

  function formatQueueTime(card: RecallCard) {
    const _b = $activeBundle ?? defaultBundle;
    const relative = formatDue(card.dueAt);
    return card.pinned ? `${_b["moduleFlashcardsPinned"] ?? "Pinned"} · ${relative}` : relative;
  }

  function createDeckSeed(
    title: string,
    context: RecallContext,
    note: string,
    cards: Array<Pick<RecallCard, "cue" | "anchor" | "dueAt" | "intervalDays" | "ease" | "streak" | "mastery" | "pinned">>,
  ): RecallDeck {
    const deckId = uid("deck");
    return {
      id: deckId,
      title,
      context,
      note,
      createdAt: now(),
      archived: false,
      cards: cards.map((card, index) => ({
        id: uid("card"),
        deckId,
        context,
        cue: card.cue,
        anchor: card.anchor,
        createdAt: now() - index * 3_600_000,
        dueAt: card.dueAt,
        reviewedAt: null,
        intervalDays: card.intervalDays,
        ease: card.ease,
        streak: card.streak,
        mastery: card.mastery,
        pinned: card.pinned,
        archived: false,
        source: title,
      })),
    };
  }

  function seedState(): PersistedState {
    const decksSeed = [
      createDeckSeed(
        "Focus Rituals",
        "Focus",
        "Remember the moves that make attention feel native.",
        [
          {
            cue: "What opens the first work block?",
            anchor: "A single timer, no inbox, and one visible goal.",
            dueAt: dayOffset(-1),
            intervalDays: 1,
            ease: 2.2,
            streak: 2,
            mastery: 64,
            pinned: true,
          },
          {
            cue: "What do I check after a block ends?",
            anchor: "Energy, clarity, and whether the next cue is still clean.",
            dueAt: dayOffset(0),
            intervalDays: 2,
            ease: 2.0,
            streak: 1,
            mastery: 58,
            pinned: false,
          },
          {
            cue: "What protects the next block?",
            anchor: "A short reset, not a long detour.",
            dueAt: dayOffset(2),
            intervalDays: 3,
            ease: 2.1,
            streak: 1,
            mastery: 52,
            pinned: false,
          },
          {
            cue: "What should stay invisible during deep work?",
            anchor: "Noise, tabs, and anything that asks for decision-making.",
            dueAt: dayOffset(1),
            intervalDays: 2,
            ease: 1.9,
            streak: 0,
            mastery: 47,
            pinned: false,
          },
        ],
      ),
      createDeckSeed(
        "Kitchen Memory",
        "Recipes",
        "Technique cues for cooking with calm, not guesswork.",
        [
          {
            cue: "How do I keep carbonara glossy?",
            anchor: "Heat off before the eggs hit; loosen with pasta water.",
            dueAt: dayOffset(0),
            intervalDays: 1,
            ease: 2.3,
            streak: 3,
            mastery: 71,
            pinned: true,
          },
          {
            cue: "What makes a curry feel balanced?",
            anchor: "Aromatic base, enough salt, and a final acid check.",
            dueAt: dayOffset(1),
            intervalDays: 2,
            ease: 2.0,
            streak: 1,
            mastery: 56,
            pinned: false,
          },
          {
            cue: "What is the smooth-soup move?",
            anchor: "Blend in stages, then season after the texture settles.",
            dueAt: dayOffset(3),
            intervalDays: 4,
            ease: 2.1,
            streak: 0,
            mastery: 41,
            pinned: false,
          },
          {
            cue: "What should never be rushed?",
            anchor: "A rested dough and a proper reduction.",
            dueAt: dayOffset(-1),
            intervalDays: 1,
            ease: 2.1,
            streak: 2,
            mastery: 62,
            pinned: false,
          },
        ],
      ),
      createDeckSeed(
        "Body Check",
        "Health",
        "Small cues that keep the daily signal legible.",
        [
          {
            cue: "What is the first recovery cue?",
            anchor: "Water, light movement, and one honest energy check.",
            dueAt: dayOffset(0),
            intervalDays: 1,
            ease: 2.0,
            streak: 2,
            mastery: 61,
            pinned: true,
          },
          {
            cue: "What makes the week easier to read?",
            anchor: "Logging sleep, water, and symptoms before the day gets noisy.",
            dueAt: dayOffset(2),
            intervalDays: 3,
            ease: 2.1,
            streak: 1,
            mastery: 53,
            pinned: false,
          },
          {
            cue: "What should stay visible during check-in?",
            anchor: "Mood, energy, and the one thing that felt off.",
            dueAt: dayOffset(-1),
            intervalDays: 1,
            ease: 1.9,
            streak: 0,
            mastery: 44,
            pinned: false,
          },
        ],
      ),
      createDeckSeed(
        "Life Rules",
        "Life",
        "Useful reminders for how Bento should behave when it matters.",
        [
          {
            cue: "What does a good system preserve?",
            anchor: "Clarity, reversibility, and the ability to continue without panic.",
            dueAt: dayOffset(1),
            intervalDays: 2,
            ease: 2.2,
            streak: 1,
            mastery: 54,
            pinned: true,
          },
          {
            cue: "What should happen after sign-in?",
            anchor: "The real shell should restore, not the tiny auth frame.",
            dueAt: dayOffset(0),
            intervalDays: 1,
            ease: 2.1,
            streak: 2,
            mastery: 69,
            pinned: false,
          },
          {
            cue: "What does the user need more than polish?",
            anchor: "Immediate state, honest feedback, and no hidden dead ends.",
            dueAt: dayOffset(2),
            intervalDays: 3,
            ease: 2.0,
            streak: 1,
            mastery: 57,
            pinned: false,
          },
        ],
      ),
    ];

    return {
      version: 1,
      activeDeckId: decksSeed[0]?.id ?? null,
      decks: decksSeed,
    };
  }

  function legacyContextFromTitle(title: string): RecallContext {
    const normalized = title.toLowerCase();
    if (normalized.includes("focus")) return "Focus";
    if (normalized.includes("health") || normalized.includes("body")) return "Health";
    if (normalized.includes("recipe") || normalized.includes("cook") || normalized.includes("kitchen")) return "Recipes";
    return "Life";
  }

  function migrateLegacyState(raw: unknown): PersistedState {
    const payload = Array.isArray(raw) ? raw : (raw && typeof raw === "object" ? (raw as { decks?: unknown }).decks : []);
    const legacyDecks = Array.isArray(payload) ? payload : [];
    if (!legacyDecks.length) {
      return seedState();
    }

    const convertedDecks: RecallDeck[] = legacyDecks.map((legacy: any, index: number) => {
      const context = legacyContextFromTitle(String(legacy?.name ?? legacy?.title ?? `Deck ${index + 1}`));
      const deckId = uid("deck");
      const cards = Array.isArray(legacy?.cards)
        ? legacy.cards.map((card: any, cardIndex: number) => ({
            id: uid("card"),
            deckId,
            context,
            cue: String(card?.front ?? card?.cue ?? "Untitled cue"),
            anchor: String(card?.back ?? card?.anchor ?? ""),
            createdAt: typeof card?.created === "number" ? card.created : now() - cardIndex * 3_600_000,
            dueAt: dayOffset(cardIndex % 2 === 0 ? 0 : 2),
            reviewedAt: null,
            intervalDays: 1,
            ease: 2,
            streak: 0,
            mastery: 50,
            pinned: false,
            archived: false,
            source: String(legacy?.name ?? legacy?.title ?? "Legacy deck"),
          }))
        : [];

      return {
        id: deckId,
        title: String(legacy?.name ?? legacy?.title ?? `Deck ${index + 1}`),
        context,
        note: "Migrated from the previous flashcard set.",
        createdAt: typeof legacy?.created === "number" ? legacy.created : now() - index * 86_400_000,
        archived: false,
        cards,
      };
    });

    return {
      version: 1,
      activeDeckId: convertedDecks[0]?.id ?? null,
      decks: convertedDecks,
    };
  }

  function persistState() {
    if (!browser) return;
    const state: PersistedState = {
      version: 1,
      activeDeckId,
      decks,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    void syncFlashcardsIndex(decks);
  }

  function loadState() {
    error = "";
    try {
      const raw = browser ? localStorage.getItem(STORAGE_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw) as PersistedState;
        decks = Array.isArray(parsed.decks) && parsed.decks.length ? parsed.decks : seedState().decks;
        activeDeckId = parsed.activeDeckId ?? decks[0]?.id ?? null;
        captureDeckId = activeDeckId;
      } else {
        const legacyRaw = browser ? localStorage.getItem(LEGACY_KEY) : null;
        if (legacyRaw) {
          const legacy = JSON.parse(legacyRaw);
          const migrated = migrateLegacyState(legacy);
          decks = migrated.decks;
          activeDeckId = migrated.activeDeckId;
          captureDeckId = activeDeckId;
          persistState();
        } else {
          const seeded = seedState();
          decks = seeded.decks;
          activeDeckId = seeded.activeDeckId;
          captureDeckId = activeDeckId;
          persistState();
        }
      }
    } catch (err) {
      error = "Failed to load recall cards.";
      const seeded = seedState();
      decks = seeded.decks;
      activeDeckId = seeded.activeDeckId;
      captureDeckId = activeDeckId;
    } finally {
      loading = false;
    }
  }

  function setSection(section: SectionLabel) {
    setModuleSection(moduleId, section, sectionLabels);
    flashMessage = section;
  }

  function resolveDeck(id: string | null) {
    return id ? decks.find((deck) => deck.id === id) ?? null : null;
  }

  function selectDeck(id: string) {
    activeDeckId = id;
    captureDeckId = id;
    reviewIndex = 0;
    revealAnswer = false;
    persistState();
  }

  function openDeck(id: string, section: SectionLabel = "Decks") {
    selectDeck(id);
    setSection(section);
  }

  function createDeck() {
    const title = newDeckTitle.trim();
    if (!title) return;

    const context = newDeckContext;
    const deck: RecallDeck = {
      id: uid("deck"),
      title,
      context,
      note: newDeckNote.trim() || contextMeta[context].blurb,
      createdAt: now(),
      archived: false,
      cards: [],
    };

    decks = [deck, ...decks];
    activeDeckId = deck.id;
    captureDeckId = deck.id;
    newDeckTitle = "";
    newDeckNote = "";
    reviewIndex = 0;
    revealAnswer = false;
    flashMessage = `Created ${deck.title}`;
    persistState();
    setSection("Generate");
  }

  function addCue() {
    const cue = newCue.trim();
    const anchor = newAnchor.trim();
    if (!cue || !anchor) return;

    const targetDeck = resolveDeck(captureDeckId ?? activeDeckId ?? decks[0]?.id ?? null);
    if (!targetDeck) return;

    const card: RecallCard = {
      id: uid("card"),
      deckId: targetDeck.id,
      context: newCueContext,
      cue,
      anchor,
      createdAt: now(),
      dueAt: dayOffset(0),
      reviewedAt: null,
      intervalDays: 1,
      ease: 2,
      streak: 0,
      mastery: 45,
      pinned: false,
      archived: false,
      source: targetDeck.title,
    };

    decks = decks.map((deck) => deck.id === targetDeck.id ? { ...deck, cards: [card, ...deck.cards] } : deck);
    activeDeckId = targetDeck.id;
    captureDeckId = targetDeck.id;
    newCue = "";
    newAnchor = "";
    flashMessage = `Added cue to ${targetDeck.title}`;
    persistState();
  }

  function seedExamples() {
    const seeded = seedState();
    const existing = new Set(decks.map((deck) => deck.title));
    const extras = seeded.decks.filter((deck) => !existing.has(deck.title));
    decks = [...extras, ...decks];
    if (!activeDeckId) {
      activeDeckId = decks[0]?.id ?? null;
      captureDeckId = activeDeckId;
    }
    flashMessage = extras.length ? `Installed ${extras.length} example sets` : "Example sets already present";
    persistState();
  }

  function togglePin(cardId: string) {
    decks = decks.map((deck) => ({
      ...deck,
      cards: deck.cards.map((card) => card.id === cardId ? { ...card, pinned: !card.pinned } : card),
    }));
    persistState();
  }

  function archiveCard(cardId: string) {
    decks = decks.map((deck) => ({
      ...deck,
      cards: deck.cards.map((card) => card.id === cardId ? { ...card, archived: true } : card),
    }));
    flashMessage = "Card archived";
    persistState();
  }

  function restoreCard(cardId: string) {
    decks = decks.map((deck) => ({
      ...deck,
      cards: deck.cards.map((card) => card.id === cardId ? { ...card, archived: false } : card),
    }));
    flashMessage = "Card restored";
    persistState();
  }

  function reviewQueueFor(deck: RecallDeck | null) {
    const cards = deck ? deck.cards : decks.flatMap((item) => item.cards);
    return cards
      .filter((card) => isDue(card))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.dueAt - b.dueAt || b.mastery - a.mastery);
  }

  function gradeCard(grade: ReviewGrade) {
    if (!currentReviewCard) return;

    const updatedAt = now();
    decks = decks.map((deck) => ({
      ...deck,
      cards: deck.cards.map((card) => {
        if (card.id !== currentReviewCard.id) return card;

        let intervalDays = card.intervalDays || 1;
        let ease = card.ease || 2;
        let streak = card.streak || 0;
        let mastery = card.mastery || 0;

        if (grade === "again") {
          intervalDays = 1;
          ease = Math.max(1.3, ease - 0.18);
          streak = 0;
          mastery = Math.max(0, mastery - 9);
        } else if (grade === "hard") {
          intervalDays = Math.max(1, Math.round(intervalDays * 1.2));
          ease = Math.max(1.4, ease - 0.08);
          mastery = clamp(mastery + 4, 0, 100);
        } else if (grade === "good") {
          intervalDays = Math.max(1, Math.round(intervalDays * ease));
          ease = Math.min(2.8, ease + 0.02);
          streak += 1;
          mastery = clamp(mastery + 8, 0, 100);
        } else {
          intervalDays = Math.max(2, Math.round(intervalDays * (ease + 0.75)));
          ease = Math.min(2.8, ease + 0.08);
          streak += 2;
          mastery = clamp(mastery + 12, 0, 100);
        }

        return {
          ...card,
          reviewedAt: updatedAt,
          dueAt: updatedAt + intervalDays * DAY_MS,
          intervalDays,
          ease,
          streak,
          mastery,
        };
      }),
    }));

    reviewIndex = 0;
    revealAnswer = false;
    flashMessage = `Marked ${grade}`;
    persistState();
  }

  function openCurrentDeck(section: SectionLabel = "Learn") {
    const target = activeDeck ?? decks[0] ?? null;
    if (!target) return;
    selectDeck(target.id);
    setSection(section);
  }

  function dueLabel(card: RecallCard) {
    const _b = $activeBundle ?? defaultBundle;
    return card.pinned ? `${_b["moduleFlashcardsPinned"] ?? "Pinned"} · ${formatDue(card.dueAt)}` : formatDue(card.dueAt);
  }

  function contextCards(context: RecallContext) {
    return decks.flatMap((deck) => deck.cards.filter((card) => card.context === context && !card.archived));
  }

  function flashcardSearchDocument(deck: RecallDeck): SearchDocument {
    return {
      moduleId,
      id: deck.id,
      title: deck.title,
      body: [
        deck.title,
        deck.note,
        deck.context,
        deck.cards.map((card) => `${card.cue} ${card.anchor} ${card.source ?? ""}`).join(" "),
      ]
        .filter(Boolean)
        .join(" "),
      tags: [deck.context],
      projects: [deck.context],
      kind: "deck",
      createdAt: deck.createdAt,
      updatedAt: deck.cards.reduce((max, card) => Math.max(max, card.reviewedAt ?? card.createdAt), deck.createdAt),
      sourceRef: deck.id,
      extra: {
        context: deck.context,
        cards: deck.cards.length,
        archived: deck.archived,
      },
    };
  }

  async function syncFlashcardsIndex(nextDecks: RecallDeck[] = decks) {
    if (!browser) return;
    const nextIds = new Set(nextDecks.map((deck) => deck.id));
    const staleIds = [...indexedDeckIds].filter((id) => !nextIds.has(id));
    await Promise.all([
      ...nextDecks.map((deck) => indexContent(flashcardSearchDocument(deck))),
      ...staleIds.map((id) => deleteFromIndex(moduleId, id)),
    ]);
    indexedDeckIds = nextIds;
  }

  const _t = $derived.by(() => createTranslator($activeBundle));

  onMount(() => {
    ensureModuleSection(moduleId, sectionLabels);
    loadState();
    void syncFlashcardsIndex(decks);
  });

  $effect(() => {
    const query = search.trim();
    if (!query) {
      searchMatchedDeckIds = null;
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
      searchMatchedDeckIds = new Set(hits.map(({ document }) => document.id));
    })();
  });

  let selectedSection = $derived(getModuleSectionLabel($moduleSectionStore, moduleId, sectionLabels));
  let activeDeck = $derived(resolveDeck(activeDeckId) ?? decks[0] ?? null);

  let visibleDecks = $derived.by(() => {
    const query = search.trim().toLowerCase();
    return decks.filter((deck) => {
      const matchesSearch = !query
        || (searchMatchedDeckIds
          ? searchMatchedDeckIds.has(deck.id)
          : deck.title.toLowerCase().includes(query)
            || deck.note.toLowerCase().includes(query)
            || deck.cards.some((card) => card.cue.toLowerCase().includes(query) || card.anchor.toLowerCase().includes(query)));
      const matchesContext = sectionFilter === "All" || deck.context === sectionFilter;
      return matchesSearch && matchesContext && !deck.archived;
    });
  });

  let nonArchivedCards = $derived(decks.flatMap((deck) => deck.cards.filter((card) => !card.archived)));
  let dueCards = $derived(nonArchivedCards.filter(isDue).sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.dueAt - b.dueAt));
  let archivedCards = $derived(decks.flatMap((deck) => deck.cards.filter((card) => card.archived)));
  let reviewedTodayCount = $derived(nonArchivedCards.filter((card) => sameDay(card.reviewedAt)).length);
  let masteredCount = $derived(nonArchivedCards.filter((card) => card.mastery >= 80).length);
  let avgMastery = $derived(nonArchivedCards.length
    ? nonArchivedCards.reduce((sum, card) => sum + card.mastery, 0) / nonArchivedCards.length
    : 0);
  let bestStreak = $derived(nonArchivedCards.length ? Math.max(...nonArchivedCards.map((card) => card.streak), 0) : 0);
  let reviewQueue = $derived(reviewQueueFor(activeDeck));
  let currentReviewCard = $derived(reviewQueue.length ? reviewQueue[reviewIndex % reviewQueue.length] : null);

  // Side effects (kept as variable assignments to trigger reactive updates)
  $effect(() => {
    if (reviewQueue.length === 0 && reviewIndex !== 0) {
      reviewIndex = 0;
    }
  });
  $effect(() => {
    if (reviewQueue.length > 0 && reviewIndex >= reviewQueue.length) {
      reviewIndex = 0;
    }
  });
  $effect(() => {
    if (activeDeckId !== lastSectionDeckId) {
      lastSectionDeckId = activeDeckId;
      reviewIndex = 0;
      revealAnswer = false;
    }
  });

  let contextLane = $derived.by(() => contextOrder.map((context) => {
    const items = contextCards(context);
    return {
      context,
      count: items.length,
      due: items.filter(isDue).length,
      mastery: items.length ? Math.round(items.reduce((sum, card) => sum + card.mastery, 0) / items.length) : 0,
    };
  }));
</script>

<main class="recall-workspace module-root" data-module="flashcards">
  <section class="recall-shell">
    <header class="recall-shell__header">
      <div class="recall-shell__intro">
        <div class="recall-shell__eyebrow">              <span>{_t('moduleFlashcardsTitle')}</span>
              <Badge variant="outline">{dueCards.length} {_t('moduleFlashcardsDueShort')} · {decks.length} {_t('moduleFlashcardsDecks')}</Badge>
            </div>
            <h1>{_t('moduleFlashcardsSubhead')}</h1>
            <p>{_t('moduleFlashcardsDesc')}</p>
      </div>

      <div class="recall-shell__actions">
        <button class="recall-btn recall-btn--ghost" type="button" onclick={() => setSection("Generate")}>
          <span class="recall-btn__icon" aria-hidden="true">{@html buttonIcon("plus")}</span>
          {_t('moduleFlashcardsAddCue')}
        </button>
        <button class="recall-btn" type="button" onclick={() => openCurrentDeck("Learn")}>
          <span class="recall-btn__icon" aria-hidden="true">{@html buttonIcon("repeat")}</span>
          {_t('moduleFlashcardsReviewNow')}
        </button>
      </div>
    </header>

    <div class="recall-shell__body">
      {#if loading}
        <div class="recall-loading">
          <div class="recall-loading__orb"></div>
          <p>{_t('moduleFlashcardsLoading')}</p>
        </div>
      {:else if error}
        <Card class="card-surface recall-card recall-card--state">
          <div class="recall-card__inner recall-card__inner--state">
            <p class="recall-state__title">{_t('moduleFlashcardsUnableLoad')}</p>
            <p class="recall-state__text">{error}</p>
            <button class="recall-btn" type="button" onclick={loadState}>{_t('moduleFlashcardsRetry')}</button>
          </div>
        </Card>
      {:else if selectedSection === "Decks"}
        <div class="recall-layout recall-layout--overview">
          <div class="recall-stack">
            <Card class="card-accent recall-card recall-hero" style={`--mod-accent:${activeDeck ? contextMeta[activeDeck.context].accent : contextMeta.Focus.accent};`}>
              <div class="recall-card__inner recall-card__inner--hero">
                <div class="recall-hero__top">
                  <Badge variant="outline">{dueCards.length} {_t('moduleFlashcardsDueNow')}</Badge>
                  <span class="recall-hero__message">{flashMessage || _t('moduleFlashcardsBentoRecall')}</span>
                </div>
                <h2>{_t('moduleFlashcardsSubhead')}</h2>
                <p>{_t('moduleFlashcardsDesc')}</p>
                <div class="recall-hero__actions">
                  <button class="recall-btn recall-btn--soft" type="button" onclick={() => openCurrentDeck("Learn")}>
                    <span class="recall-btn__icon" aria-hidden="true">{@html buttonIcon("clock")}</span>
                    {_t('moduleFlashcardsOpenReview')}
                  </button>
                  <button class="recall-btn recall-btn--ghost recall-btn--light" type="button" onclick={() => setSection("Generate")}>
                    <span class="recall-btn__icon" aria-hidden="true">{@html buttonIcon("plus")}</span>
                    {_t('moduleFlashcardsNewCue')}
                  </button>
                </div>
                <div class="recall-hero__metrics">
                  <article><span>{_t('moduleFlashcardsActiveDeck')}</span><strong>{activeDeck?.title ?? _t('moduleFlashcardsNoDeck')}</strong></article>
                  <article><span>{_t('moduleFlashcardsReviewedToday')}</span><strong>{reviewedTodayCount}</strong></article>
                  <article><span>{_t('moduleFlashcardsAvgMastery')}</span><strong>{progressLabel(avgMastery)}</strong></article>
                </div>
              </div>
            </Card>

            <div class="recall-stat-grid">
              <Card class="card-surface recall-card">
                <div class="recall-card__inner recall-card__inner--stat">
                  <span class="recall-stat__label">{_t('moduleFlashcardsDueNowStat')}</span>
                  <strong class="recall-stat__value">{dueCards.length}</strong>
                  <p class="recall-stat__note">{_t('moduleFlashcardsCuesWaiting')}</p>
                </div>
              </Card>
              <Card class="card-surface recall-card">
                <div class="recall-card__inner recall-card__inner--stat">
                  <span class="recall-stat__label">{_t('moduleFlashcardsDecksStat')}</span>
                  <strong class="recall-stat__value">{decks.length}</strong>
                  <p class="recall-stat__note">{_t('moduleFlashcardsContextsSpread')}</p>
                </div>
              </Card>
              <Card class="card-surface recall-card">
                <div class="recall-card__inner recall-card__inner--stat">
                  <span class="recall-stat__label">{_t('moduleFlashcardsMasteredStat')}</span>
                  <strong class="recall-stat__value">{masteredCount}</strong>
                  <p class="recall-stat__note">{_t('moduleFlashcardsAbove80')}</p>
                </div>
              </Card>
              <Card class="card-surface recall-card">
                <div class="recall-card__inner recall-card__inner--stat">
                  <span class="recall-stat__label">{_t('moduleFlashcardsBestStreakStat')}</span>
                  <strong class="recall-stat__value">{bestStreak}</strong>
                  <p class="recall-stat__note">{_t('moduleFlashcardsStrongestSeq')}</p>
                </div>
              </Card>
            </div>

            <Card class="card-surface recall-card">
              <div class="recall-card__inner">
                <div class="recall-section-head">
                  <div>
                    <span class="recall-section-head__eyebrow">{_t('moduleFlashcardsDecksLabel')}</span>
                    <h3>{_t('moduleFlashcardsLanes')}</h3>
                  </div>
                  <div class="recall-deck-tools">
                    <div class="recall-search-row">
                      <Search size={16} />
                      <input
                        class="recall-search-input"
                        type="text"
                        bind:value={search}
                        placeholder="Search decks, cues, and anchors"
                      />
                    </div>
                    <div class="recall-filter-row">
                      {#each ["All", ...contextOrder] as filter}
                        <button
                          type="button"
                          class:active={sectionFilter === filter}
                          class="recall-filter"
                          onclick={() => (sectionFilter = filter as RecallContext | "All")}
                        >
                          {filter}
                        </button>
                      {/each}
                    </div>
                  </div>
                </div>

                <div class="recall-deck-grid">
                  {#each visibleDecks as deck (deck.id)}
                    <article class="recall-deck" style={`--deck-accent:${contextMeta[deck.context].accent};`}>
                      <div class="recall-deck__top">
                        <div class="recall-deck__icon" aria-hidden="true">
                          {@html contextIcon(deck.context)}
                        </div>
                        <Badge variant="outline">{deck.context}</Badge>
                      </div>
                      <h4>{deck.title}</h4>
                      <p>{deck.note}</p>
                      <div class="recall-deck__stats">
                        <span>{deck.cards.length} {_t('moduleFlashcardsCards')}</span>
                        <span>{deck.cards.filter(isDue).length} {_t('moduleFlashcardsDueLabel')}</span>
                        <span>{Math.round(deck.cards.reduce((sum, card) => sum + card.mastery, 0) / Math.max(deck.cards.length, 1))}% {_t('moduleFlashcardsMasteryLabel')}</span>
                      </div>
                      <div class="recall-progress">
                        <i style={`--fill:${Math.round(deck.cards.reduce((sum, card) => sum + card.mastery, 0) / Math.max(deck.cards.length, 1))}%`}></i>
                      </div>
                      <div class="recall-deck__actions">
                        <button class="recall-btn recall-btn--soft recall-btn--wide" type="button" onclick={() => openDeck(deck.id, "Learn")}>{_t('moduleFlashcardsReview')}</button>
                        <button class="recall-btn recall-btn--ghost recall-btn--wide" type="button" onclick={() => openDeck(deck.id, "Generate")}>{_t('moduleFlashcardsAddToDeck')}</button>
                      </div>
                    </article>
                  {/each}
                </div>
              </div>
            </Card>
          </div>

          <div class="recall-side">
            <Card class="card-dark recall-card">
              <div class="recall-card__inner">
                <div class="recall-section-head">
                  <div>
                    <span class="recall-section-head__eyebrow">{_t('moduleFlashcardsToday')}</span>
                    <h3>{_t('moduleFlashcardsQueuePressure')}</h3>
                  </div>
                  <Badge variant="outline">{dueCards.length}</Badge>
                </div>
                <div class="recall-orb">
                  <strong>{dueCards.length}</strong>
                  <small>{_t('moduleFlashcardsDueShort')}</small>
                </div>
                <div class="recall-mini-list">
                  {#each dueCards.slice(0, 5) as card (card.id)}
                    <article>
                      <div>
                        <strong>{card.cue}</strong>
                        <p>{resolveDeck(card.deckId)?.title ?? card.source ?? "Recall"}</p>
                      </div>
                      <span>{formatDue(card.dueAt)}</span>
                    </article>
                  {/each}
                </div>
              </div>
            </Card>

            <Card class="card-surface recall-card">
              <div class="recall-card__inner">
                <div class="recall-section-head">
                  <div>
                    <span class="recall-section-head__eyebrow">{_t('moduleFlashcardsContexts')}</span>
                    <h3>{_t('moduleFlashcardsWhereMemoryLives')}</h3>
                  </div>
                </div>
                <div class="recall-context-list">
                  {#each contextLane as lane}
                    <article class="recall-context-row">
                      <div class="recall-context-row__top">
                        <span>{lane.context}</span>
                        <Badge variant="outline">{lane.count}</Badge>
                      </div>
                      <div class="recall-progress">
                        <i style={`--fill:${lane.mastery}%`}></i>
                      </div>
                      <small>{lane.due} {_t('moduleFlashcardsDueLabel')} · {lane.mastery}% {_t('moduleFlashcardsMasteryLabel')}</small>
                    </article>
                  {/each}
                </div>
              </div>
            </Card>
          </div>
        </div>

      {:else if selectedSection === "Due Today"}
        <div class="recall-layout recall-layout--two">
          <Card class="card-dark recall-card">
            <div class="recall-card__inner">
              <div class="recall-section-head">
                <div>
                  <span class="recall-section-head__eyebrow">{_t('moduleFlashcardsDueToday')}</span>
                  <h3>{_t('moduleFlashcardsExactCues')}</h3>
                </div>
                <Badge variant="outline">{dueCards.length}</Badge>
              </div>
              <div class="recall-due-list">
                {#each dueCards as card (card.id)}
                  <article class="recall-due-item">
                    <div class="recall-due-item__icon" aria-hidden="true">
                      {@html iconGlyph(contextMeta[card.context].glyph)}
                    </div>
                    <div class="recall-due-item__copy">
                      <div class="recall-due-item__top">
                        <strong>{card.cue}</strong>
                        <Badge variant="outline">{card.context}</Badge>
                      </div>
                      <p>{card.anchor}</p>
                    </div>
                    <div class="recall-due-item__meta">
                      <span>{formatDue(card.dueAt)}</span>
                      <button class="recall-link" type="button" onclick={() => openDeck(card.deckId, "Learn")}>{_t('moduleFlashcardsReview')}</button>
                    </div>
                  </article>
                {/each}
                {#if dueCards.length === 0}
                  <div class="recall-empty">
                    <strong>{_t('moduleFlashcardsNoCardsDue')}</strong>
                    <p>{_t('moduleFlashcardsNoCardsDueDesc')}</p>
                  </div>
                {/if}
              </div>
            </div>
          </Card>

          <Card class="card-surface recall-card">
            <div class="recall-card__inner">
              <div class="recall-section-head">
                <div>
                  <span class="recall-section-head__eyebrow">{_t('moduleFlashcardsPinnedLanes')}</span>
                  <h3>{_t('moduleFlashcardsCardsFirst')}</h3>
                </div>
                <Badge variant="outline">{nonArchivedCards.filter((card) => card.pinned).length}</Badge>
              </div>
              <div class="recall-pin-grid">
                {#each decks as deck (deck.id)}
                  <article class="recall-pin-card" style={`--deck-accent:${contextMeta[deck.context].accent};`}>
                    <div class="recall-pin-card__top">
                      <span>{deck.title}</span>
                      <Badge variant="outline">{deck.context}</Badge>
                    </div>
                    <p>{deck.cards.filter((card) => card.pinned).length} {_t('moduleFlashcardsPinnedCards')} · {deck.cards.filter(isDue).length} {_t('moduleFlashcardsDueLabel')}</p>
                    <button class="recall-btn recall-btn--ghost recall-btn--wide" type="button" onclick={() => openDeck(deck.id, "Learn")}>{_t('moduleFlashcardsOpenDeck')}</button>
                  </article>
                {/each}
              </div>
            </div>
          </Card>
        </div>

      {:else if selectedSection === "Learn"}
        <div class="recall-layout recall-layout--two">
          <Card class="card-accent recall-card recall-learn" style={`--mod-accent:${activeDeck ? contextMeta[activeDeck.context].accent : contextMeta.Focus.accent};`}>
            <div class="recall-card__inner recall-card__inner--learn">
              <div class="recall-section-head recall-section-head--light">
                <div>
                  <span class="recall-section-head__eyebrow">{_t('moduleFlashcardsLearn')}</span>
                  <h3>{activeDeck?.title ?? _t('moduleFlashcardsPickDeck')}</h3>
                </div>
                <Badge variant="outline">{reviewQueue.length ? `${reviewIndex + 1}/${reviewQueue.length}` : _t('moduleFlashcardsNoQueue')}</Badge>
              </div>

              {#if currentReviewCard}
                <button
                  type="button"
                  class="recall-flip"
                  class:reveal={revealAnswer}
                  onclick={() => (revealAnswer = !revealAnswer)}
                >
                  <div class="recall-flip__inner">
                    <div class="recall-flip__face recall-flip__face--front">
                      <span class="recall-flip__label">{_t('moduleFlashcardsCueLabel')}</span>
                      <p>{currentReviewCard.cue}</p>
                      <small>{_t('moduleFlashcardsTapReveal')}</small>
                    </div>
                    <div class="recall-flip__face recall-flip__face--back">
                      <span class="recall-flip__label">{_t('moduleFlashcardsAnchorLabel')}</span>
                      <p>{currentReviewCard.anchor}</p>
                      <small>{currentReviewCard.source ?? activeDeck?.title ?? "Recall"}</small>
                    </div>
                  </div>
                </button>

                <div class="recall-grade-row">
                  <button class="recall-btn recall-btn--ghost recall-btn--light" type="button" onclick={() => gradeCard("again")}>{_t('moduleFlashcardsAgain')}</button>
                  <button class="recall-btn recall-btn--ghost recall-btn--light" type="button" onclick={() => gradeCard("hard")}>{_t('moduleFlashcardsHard')}</button>
                  <button class="recall-btn recall-btn--soft recall-btn--light" type="button" onclick={() => gradeCard("good")}>{_t('moduleFlashcardsGood')}</button>
                  <button class="recall-btn recall-btn--light" type="button" onclick={() => gradeCard("easy")}>{_t('moduleFlashcardsEasy')}</button>
                </div>
              {:else}
                <div class="recall-empty recall-empty--light">
                  <strong>{_t('moduleFlashcardsNothingDue')}</strong>
                  <p>{_t('moduleFlashcardsNothingDueDesc')}</p>
                  <div class="recall-empty__actions">
                    <button class="recall-btn recall-btn--ghost recall-btn--light" type="button" onclick={() => setSection("Decks")}>{_t('moduleFlashcardsChangeDeck')}</button>
                    <button class="recall-btn recall-btn--soft recall-btn--light" type="button" onclick={() => setSection("Generate")}>{_t('moduleFlashcardsAddCueShort')}</button>
                  </div>
                </div>
              {/if}
            </div>
          </Card>

          <Card class="card-surface recall-card">
            <div class="recall-card__inner">
              <div class="recall-section-head">
                <div>
                  <span class="recall-section-head__eyebrow">{_t('moduleFlashcardsQueueLabel')}</span>
                  <h3>{_t('moduleFlashcardsSequence')}</h3>
                </div>
                <button class="recall-btn recall-btn--ghost" type="button" onclick={() => { reviewIndex = 0; revealAnswer = false; }}>
                  <span class="recall-btn__icon" aria-hidden="true">{@html buttonIcon("shuffle")}</span>
                  {_t('moduleFlashcardsResetLabel')}
                </button>
              </div>
              <div class="recall-queue-list">
                {#each reviewQueue.slice(0, 6) as card, index (card.id)}
                  <article class:active={card.id === currentReviewCard?.id} class="recall-queue-item">
                    <div>
                      <strong>{index + 1}. {card.cue}</strong>
                      <p>{dueLabel(card)}</p>
                    </div>
                    <Badge variant="outline">{card.mastery}%</Badge>
                  </article>
                {/each}
              </div>
            </div>
          </Card>
        </div>

      {:else if selectedSection === "Cram"}
        <div class="recall-layout recall-layout--two">
          <Card class="card-surface recall-card">
            <div class="recall-card__inner">
              <div class="recall-section-head">
                <div>
                  <span class="recall-section-head__eyebrow">{_t('moduleFlashcardsCram')}</span>
                  <h3>{_t('moduleFlashcardsFastLane')}</h3>
                </div>
                <Badge variant="outline">{dueCards.length} {_t('moduleFlashcardsInTheSprint')}</Badge>
              </div>
              <div class="recall-sprint">
                <div class="recall-sprint__meter">
                  <strong>10 min</strong>
                  <span>{_t('moduleFlashcardsShortPass')}</span>
                </div>
                <div class="recall-sprint__controls">
                  <button class="recall-btn" type="button" onclick={() => openCurrentDeck("Learn")}>{_t('moduleFlashcardsStartSprint')}</button>
                  <button class="recall-btn recall-btn--ghost" type="button" onclick={() => setSection("Due Today")}>{_t('moduleFlashcardsLoadDueQueue')}</button>
                </div>
              </div>
              <div class="recall-cram-list">
                {#each dueCards.slice(0, 8) as card (card.id)}
                  <article class="recall-cram-item">
                    <div>
                      <strong>{card.cue}</strong>
                      <p>{resolveDeck(card.deckId)?.title ?? "Recall"}</p>
                    </div>
                    <Badge variant="outline">{card.context}</Badge>
                  </article>
                {/each}
              </div>
            </div>
          </Card>

          <Card class="card-dark recall-card">
            <div class="recall-card__inner">
              <div class="recall-section-head">
                <div>
                  <span class="recall-section-head__eyebrow">{_t('moduleFlashcardsSpeedCues')}</span>
                  <h3>{_t('moduleFlashcardsStickFriction')}</h3>
                </div>
              </div>
              <div class="recall-speed-grid">
                <article>
                  <span>Focus</span>
                  <strong>Timers and resets</strong>
                  <p>Only the cue that opens the block and the reset that closes it.</p>
                </article>
                <article>
                  <span>Recipes</span>
                  <strong>Heat, acid, texture</strong>
                  <p>Technique decisions stay memorable when the line is short.</p>
                </article>
                <article>
                  <span>Health</span>
                  <strong>Sleep, water, energy</strong>
                  <p>The smallest signals are usually the useful ones.</p>
                </article>
              </div>
            </div>
          </Card>
        </div>

      {:else if selectedSection === "Generate"}
        <div class="recall-layout recall-layout--two">
          <Card class="card-surface recall-card">
            <div class="recall-card__inner">
              <div class="recall-section-head">
                <div>
                  <span class="recall-section-head__eyebrow">{_t('moduleFlashcardsGenerate')}</span>
                  <h3>{_t('moduleFlashcardsAddCueDeck')}</h3>
                </div>
                <button class="recall-btn recall-btn--ghost" type="button" onclick={seedExamples}>
                  <span class="recall-btn__icon" aria-hidden="true">{@html buttonIcon("spark")}</span>
                  {_t('moduleFlashcardsAddExamplePacks')}
                </button>
              </div>

              <div class="recall-form-grid">
                <label class="recall-field">
                  <span>{_t('moduleFlashcardsDeckTitle')}</span>
                  <input bind:value={newDeckTitle} placeholder={_t('moduleFlashcardsDeckNamePlaceholder')} />
                </label>
<label class="recall-field">
            <span>{_t('moduleFlashcardsContextLabel')}</span>
            <Select.Root type="single" bind:value={newDeckContext}>
              <Select.Trigger class="recall-select-trigger">
                <span>{newDeckContext}</span>
              </Select.Trigger>
              <Select.Content>
                {#each contextOrder as context}
                  <Select.Item value={context}>{context}</Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
          </label>
                <label class="recall-field recall-field--full">
                  <span>{_t('moduleFlashcardsDeckNote')}</span>
                  <input bind:value={newDeckNote} placeholder={_t('moduleFlashcardsDeckNotePlaceholder')} />
                </label>
              </div>

              <button class="recall-btn" type="button" onclick={createDeck}>
                <span class="recall-btn__icon" aria-hidden="true">{@html buttonIcon("plus")}</span>
                {_t('moduleFlashcardsCreateDeckBtn')}
              </button>
            </div>
          </Card>

          <Card class="card-dark recall-card">
            <div class="recall-card__inner">
              <div class="recall-section-head">
                <div>
                  <span class="recall-section-head__eyebrow">{_t('moduleFlashcardsNewCue')}</span>
                  <h3>{_t('moduleFlashcardsAddCueCurrent')}</h3>
                </div>
                <Badge variant="outline">{resolveDeck(captureDeckId ?? activeDeckId)?.title ?? "No deck selected"}</Badge>
              </div>

              <div class="recall-form-grid">
                <label class="recall-field recall-field--full">
                  <span>{_t('moduleFlashcardsCueLabel')}</span>
                  <textarea bind:value={newCue} rows="3" placeholder={_t('moduleFlashcardsCuePlaceholder')}></textarea>
                </label>
                <label class="recall-field recall-field--full">
                  <span>{_t('moduleFlashcardsAnchorLabel')}</span>
                  <textarea bind:value={newAnchor} rows="3" placeholder={_t('moduleFlashcardsAnchorPlaceholder')}></textarea>
                </label>
                <label class="recall-field">
                  <span>{_t('moduleFlashcardsContextLabel')}</span>
                  <Select.Root type="single" bind:value={newCueContext}>
                    <Select.Trigger class="recall-select-trigger">
                      <span>{newCueContext}</span>
                    </Select.Trigger>
                    <Select.Content>
                      {#each contextOrder as context}
                        <Select.Item value={context}>{context}</Select.Item>
                      {/each}
                    </Select.Content>
                  </Select.Root>
                </label>
                <label class="recall-field">
                  <span>{_t('moduleFlashcardsDeckSelect')}</span>
                  <Select.Root type="single" bind:value={captureDeckId}>
                    <Select.Trigger class="recall-select-trigger">
                      <span>{decks.find(d => d.id === captureDeckId)?.title ?? 'Select deck...'}</span>
                    </Select.Trigger>
                    <Select.Content>
                      {#each decks as deck (deck.id)}
                        <Select.Item value={deck.id}>{deck.title}</Select.Item>
                      {/each}
                    </Select.Content>
                  </Select.Root>
                </label>
              </div>

              <button class="recall-btn" type="button" onclick={addCue}>
                <span class="recall-btn__icon" aria-hidden="true">{@html buttonIcon("plus")}</span>
                {_t('moduleFlashcardsAddCueShort')}
              </button>
            </div>
          </Card>
        </div>

      {:else}
        <div class="recall-layout recall-layout--progress">
          <Card class="card-surface recall-card">
            <div class="recall-card__inner">
              <div class="recall-section-head">
                <div>
                  <span class="recall-section-head__eyebrow">{_t('moduleFlashcardsProgress')}</span>
                  <h3>{_t('moduleFlashcardsRecallSystem')}</h3>
                </div>
              </div>
              <div class="recall-progress-grid">
                <article>
                  <span>{_t('moduleFlashcardsAvgMasteryLabel')}</span>
                  <strong>{progressLabel(avgMastery)}</strong>
                  <div class="recall-progress">
                    <i style={`--fill:${avgMastery}%`}></i>
                  </div>
                </article>
                <article>
                  <span>{_t('moduleFlashcardsReviewedToday')}</span>
                  <strong>{reviewedTodayCount}</strong>
                  <p>{_t('moduleFlashcardsReviewedDesc')}</p>
                </article>
                <article>
                  <span>{_t('moduleFlashcardsPendingArchive')}</span>
                  <strong>{archivedCards.length}</strong>
                  <p>{_t('moduleFlashcardsArchiveDesc')}</p>
                </article>
                <article>
                  <span>{_t('moduleFlashcardsStrongestStreak')}</span>
                  <strong>{bestStreak}</strong>
                  <p>{_t('moduleFlashcardsStreakDesc')}</p>
                </article>
              </div>
            </div>
          </Card>

          <Card class="card-dark recall-card">
            <div class="recall-card__inner">
              <div class="recall-section-head">
                <div>
                  <span class="recall-section-head__eyebrow">{_t('moduleFlashcardsContextMap')}</span>
                  <h3>{_t('moduleFlashcardsConcentrated')}</h3>
                </div>
              </div>
              <div class="recall-context-map">
                {#each contextLane as lane}
                  <article>
                    <div class="recall-context-map__row">
                      <span>{lane.context}</span>
                      <Badge variant="outline">{lane.count}</Badge>
                    </div>
                    <div class="recall-progress">
                      <i style={`--fill:${lane.mastery}%`}></i>
                    </div>
                    <small>{lane.due} {_t('moduleFlashcardsDueLabel')} · {lane.mastery}% {_t('moduleFlashcardsMasteryLabel')}</small>
                  </article>
                {/each}
              </div>
            </div>
          </Card>

          <Card class="card-surface recall-card recall-card--wide">
            <div class="recall-card__inner">
              <div class="recall-section-head">
                <div>
                  <span class="recall-section-head__eyebrow">{_t('moduleFlashcardsArchiveSection')}</span>
                  <h3>{_t('moduleFlashcardsHiddenCues')}</h3>
                </div>
                <Badge variant="outline">{archivedCards.length}</Badge>
              </div>
              <div class="recall-archive-list">
                {#each archivedCards as card (card.id)}
                  <article class="recall-archive-item">
                    <div>
                      <strong>{card.cue}</strong>
                      <p>{resolveDeck(card.deckId)?.title ?? card.source ?? "Recall"}</p>
                    </div>
                    <button class="recall-link" type="button" onclick={() => restoreCard(card.id)}>{_t('moduleFlashcardsRestore')}</button>
                  </article>
                {/each}
                {#if archivedCards.length === 0}
                  <div class="recall-empty">
                    <strong>{_t('moduleFlashcardsNoArchive')}</strong>
                    <p>{_t('moduleFlashcardsNoArchiveDesc')}</p>
                  </div>
                {/if}
              </div>
            </div>
          </Card>
        </div>
      {/if}
    </div>
  </section>
</main>

<style>
  :global(.recall-workspace) {
    --recall-bg: var(--background);
    --recall-surface: color-mix(in srgb, var(--surface) 96%, var(--background));
    --recall-surface-strong: color-mix(in srgb, var(--surface) 88%, var(--background));
    --recall-border: color-mix(in srgb, var(--border) 86%, transparent);
    --recall-ink: var(--foreground);
    --recall-muted: var(--muted);
    --recall-accent: var(--primary);
    height: 100%;
    padding: 28px 30px;
    background: var(--recall-bg);
    color: var(--recall-ink);
    overflow: hidden;
    font-family: var(--font-body);
    box-sizing: border-box;
  }

  :global(.recall-shell) {
    display: grid;
    grid-template-rows: auto auto minmax(0, 1fr);
    gap: 18px;
    height: 100%;
    min-height: 0;
  }

  :global(.recall-shell__header) {
    display: flex;
    justify-content: space-between;
    gap: 20px;
    align-items: flex-start;
  }

  :global(.recall-shell__intro) {
    max-width: 58rem;
    display: grid;
    gap: 12px;
  }

  :global(.recall-shell__eyebrow) {
    display: flex;
    gap: 12px;
    align-items: center;
    color: var(--recall-muted);
    font-size: 0.82rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }

  :global(.recall-shell__intro) h1 {
    margin: 0;
    font-size: clamp(1.9rem, 3vw, 3.2rem);
    line-height: 1.02;
  }

  :global(.recall-shell__intro) p {
    margin: 0;
    max-width: 42rem;
    color: var(--recall-muted);
    font-size: 0.98rem;
    line-height: 1.55;
  }

  :global(.recall-shell__actions) {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  :global(.recall-shell__body) {
    min-height: 0;
    overflow: auto;
    padding-right: 8px;
    padding-bottom: 32px;
  }

  :global(.recall-loading) {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 18px;
    min-height: 100%;
  }

  :global(.recall-loading__orb) {
    width: 48px;
    height: 48px;
    border-radius: 999px;
    border: 3px solid color-mix(in srgb, var(--recall-accent) 30%, transparent);
    border-top-color: var(--recall-accent);
    animation: recall-spin 0.8s linear infinite;
  }

  @keyframes recall-spin {
    to { transform: rotate(360deg); }
  }

  :global(.recall-layout) {
    display: grid;
    gap: 16px;
    min-height: 0;
  }

  :global(.recall-layout--overview) {
    grid-template-columns: minmax(0, 1.35fr) minmax(330px, 0.65fr);
  }

  :global(.recall-layout--two) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  :global(.recall-layout--progress) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  :global(.recall-stack) {
    display: grid;
    gap: 16px;
    min-height: 0;
  }

  :global(.recall-side) {
    display: grid;
    gap: 16px;
    min-height: 0;
  }

  :global(.recall-card[data-slot="card"]) {
    padding: 0 !important;
    overflow: hidden;
  }

  :global(.recall-card__inner) {
    display: grid;
    gap: 16px;
    padding: 24px;
    min-height: 100%;
    box-sizing: border-box;
  }

  :global(.recall-card__inner--hero) {
    color: #fff;
  }

  :global(.recall-card__inner--stat) {
    gap: 10px;
  }

  :global(.recall-card__inner--learn) {
    color: #fff;
  }

  :global(.recall-card__inner--state) {
    justify-items: center;
    align-content: center;
    min-height: 280px;
  }

  :global(.recall-hero h2) {
    margin: 0;
    font-size: clamp(2rem, 3.4vw, 3.4rem);
    line-height: 0.98;
    letter-spacing: -0.05em;
    max-width: 12ch;
  }

  :global(.recall-hero p) {
    margin: 0;
    max-width: 44rem;
    font-size: 0.98rem;
    line-height: 1.6;
    color: rgba(255, 255, 255, 0.78);
  }

  :global(.recall-hero__top) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }

  :global(.recall-hero__message) {
    font-size: 0.8rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.72);
  }

  :global(.recall-hero__actions) {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  :global(.recall-hero__metrics) {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }

  :global(.recall-hero__metrics) article,
  :global(.recall-context-row),
  :global(.recall-due-item),
  :global(.recall-cram-item),
  :global(.recall-archive-item),
  :global(.recall-pin-card),
  :global(.recall-mini-list) article,
  :global(.recall-speed-grid) article,
  :global(.recall-progress-grid) article {
    border-radius: 18px;
    background: color-mix(in srgb, var(--recall-surface-strong) 88%, transparent);
  }

  :global(.recall-hero__metrics) article {
    padding: 14px 16px;
    display: grid;
    gap: 4px;
  }

  :global(.recall-hero__metrics) span,
  :global(.recall-stat__label),
  :global(.recall-section-head__eyebrow),
  :global(.recall-context-map__row span),
  :global(.recall-context-row small),
  :global(.recall-mini-list p),
  :global(.recall-due-item__meta span),
  :global(.recall-cram-item p),
  :global(.recall-speed-grid p),
  :global(.recall-progress-grid p),
  :global(.recall-archive-item p),
  :global(.recall-pin-card p),
  :global(.recall-empty p) {
    color: var(--recall-muted);
  }

  :global(.recall-hero__metrics) strong,
  :global(.recall-stat__value) {
    font-size: 1.35rem;
    line-height: 1;
  }

  :global(.recall-hero__metrics) span {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  :global(.recall-stat-grid) {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
  }

  :global(.recall-stat__note) {
    margin: 0;
    color: var(--recall-muted);
    font-size: 0.82rem;
    line-height: 1.4;
  }

  :global(.recall-section-head) {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
  }

  :global(.recall-section-head--light) {
    color: #fff;
  }

  :global(.recall-section-head h3) {
    margin: 4px 0 0;
    font-size: 1.15rem;
    line-height: 1.15;
  }

  :global(.recall-deck-grid) {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 12px;
  }

  :global(.recall-filter-row) {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  :global(.recall-deck-tools) {
    display: grid;
    gap: 10px;
    min-width: 0;
  }

  :global(.recall-search-row) {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--recall-surface-strong) 84%, transparent);
    border: 1px solid color-mix(in srgb, var(--recall-border) 65%, transparent);
    min-width: min(100%, 320px);
  }

  :global(.recall-search-row svg) {
    flex: 0 0 auto;
    color: var(--recall-muted);
  }

  :global(.recall-search-input) {
    flex: 1;
    min-width: 0;
    border: 0;
    outline: 0;
    background: transparent;
    color: var(--recall-text);
    font: inherit;
    font-size: 0.92rem;
  }

  :global(.recall-search-input::placeholder) {
    color: var(--recall-muted);
  }

  :global(.recall-filter) {
    padding: 8px 12px;
    border-radius: 999px;
    border: 1px solid transparent;
    background: color-mix(in srgb, var(--recall-surface-strong) 84%, transparent);
    color: var(--recall-muted);
    font: inherit;
    font-size: 0.8rem;
    cursor: pointer;
  }

  :global(.recall-filter.active) {
    background: var(--foreground);
    color: var(--background);
  }

  :global(.recall-deck) {
    display: grid;
    gap: 12px;
    padding: 18px;
    border-radius: 22px;
    background: color-mix(in srgb, var(--recall-surface-strong) 90%, transparent);
    min-height: 100%;
    box-sizing: border-box;
  }

  :global(.recall-deck__top) {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
  }

  :global(.recall-deck__icon),
  :global(.recall-due-item__icon) {
    width: 42px;
    height: 42px;
    border-radius: 14px;
    background: color-mix(in srgb, var(--deck-accent, var(--recall-accent)) 18%, transparent);
    color: var(--deck-accent, var(--recall-accent));
    display: grid;
    place-items: center;
  }

  :global(.recall-deck__icon svg),
  :global(.recall-due-item__icon svg) {
    width: 21px;
    height: 21px;
  }

  :global(.recall-deck h4) {
    margin: 0;
    font-size: 1.05rem;
  }

  :global(.recall-deck p),
  :global(.recall-mini-list p),
  :global(.recall-due-item__copy p) {
    margin: 0;
    font-size: 0.85rem;
    line-height: 1.5;
  }

  :global(.recall-deck__stats) {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 12px;
    font-size: 0.76rem;
    color: var(--recall-muted);
  }

  :global(.recall-progress) {
    height: 8px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--recall-border) 76%, transparent);
    overflow: hidden;
  }

  :global(.recall-progress) i {
    display: block;
    width: var(--fill);
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, var(--deck-accent, var(--recall-accent)), color-mix(in srgb, var(--deck-accent, var(--recall-accent)) 55%, white));
  }

  :global(.recall-deck__actions) {
    display: grid;
    gap: 8px;
  }

  :global(.recall-btn) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: auto;
    border: none;
    border-radius: 999px;
    padding: 12px 18px;
    background: var(--foreground);
    color: var(--background);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
    text-align: center;
    transition: transform 0.16s ease, opacity 0.16s ease, background 0.16s ease;
  }

  :global(.recall-btn:hover) {
    transform: translateY(-1px);
  }

  :global(.recall-btn--wide) {
    width: 100%;
  }

  :global(.recall-btn--ghost) {
    background: transparent;
    color: var(--foreground);
    border: 1px solid color-mix(in srgb, var(--foreground) 12%, var(--recall-border));
  }

  :global(.recall-btn--soft) {
    background: color-mix(in srgb, var(--foreground) 10%, var(--background));
    color: var(--foreground);
  }

  :global(.recall-btn--light) {
    color: #fff;
  }

  :global(.recall-btn__icon) {
    width: 18px;
    height: 18px;
    display: inline-flex;
  }

  :global(.recall-btn__icon svg) {
    width: 18px;
    height: 18px;
  }

  :global(.recall-side),
  :global(.recall-layout--two),
  :global(.recall-layout--progress) {
    min-height: 0;
  }

  :global(.recall-orb) {
    display: grid;
    place-items: center;
    width: 110px;
    aspect-ratio: 1;
    border-radius: 999px;
    background: conic-gradient(var(--recall-accent) 72%, color-mix(in srgb, var(--recall-border) 80%, transparent) 0);
  }

  :global(.recall-orb) strong {
    font-size: 2rem;
    line-height: 1;
  }

  :global(.recall-orb) small {
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--recall-muted);
  }

  :global(.recall-mini-list),
  :global(.recall-context-list),
  :global(.recall-due-list),
  :global(.recall-cram-list),
  :global(.recall-queue-list),
  :global(.recall-archive-list) {
    display: grid;
    gap: 10px;
    min-height: 0;
  }

  :global(.recall-mini-list) article,
  :global(.recall-due-item),
  :global(.recall-cram-item),
  :global(.recall-archive-item),
  :global(.recall-pin-card) {
    padding: 14px 16px;
  }

  :global(.recall-mini-list) article,
  :global(.recall-due-item),
  :global(.recall-cram-item),
  :global(.recall-archive-item) {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 14px;
  }

  :global(.recall-mini-list) article strong,
  :global(.recall-due-item__copy strong),
  :global(.recall-cram-item strong),
  :global(.recall-archive-item strong),
  :global(.recall-pin-card strong) {
    display: block;
    font-size: 0.9rem;
  }

  :global(.recall-mini-list) article p,
  :global(.recall-due-item__copy p),
  :global(.recall-cram-item p),
  :global(.recall-archive-item p),
  :global(.recall-pin-card p) {
    margin-top: 4px;
  }

  :global(.recall-due-item__meta) {
    display: grid;
    justify-items: end;
    gap: 6px;
  }

  :global(.recall-link) {
    padding: 0;
    border: none;
    background: transparent;
    color: var(--recall-ink);
    font: inherit;
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  :global(.recall-empty) {
    display: grid;
    gap: 8px;
    padding: 18px;
    border-radius: 18px;
    background: color-mix(in srgb, var(--recall-surface-strong) 88%, transparent);
  }

  :global(.recall-empty--light) {
    color: #fff;
  }

  :global(.recall-empty__actions) {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  :global(.recall-context-row) {
    display: grid;
    gap: 10px;
    padding: 16px;
  }

  :global(.recall-context-row__top),
  :global(.recall-context-map__row) {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }

  :global(.recall-context-map) {
    display: grid;
    gap: 10px;
  }

  :global(.recall-context-map) article {
    display: grid;
    gap: 8px;
    padding: 14px 16px;
    border-radius: 18px;
    background: color-mix(in srgb, var(--recall-surface-strong) 88%, transparent);
  }

  :global(.recall-context-map) strong {
    font-size: 0.96rem;
  }

  :global(.recall-field) {
    display: grid;
    gap: 8px;
  }

  :global(.recall-field) span {
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--recall-muted);
  }

  :global(.recall-field) input,
  :global(.recall-field) textarea,
  :global(.recall-field) select {
    width: 100%;
    border: 1px solid var(--recall-border);
    border-radius: 16px;
    background: color-mix(in srgb, var(--recall-surface-strong) 92%, transparent);
    color: var(--recall-ink);
    padding: 12px 14px;
    font: inherit;
    outline: none;
    box-sizing: border-box;
  }

  :global(.recall-field) textarea {
    resize: vertical;
    min-height: 88px;
  }

  :global(.recall-field--full) {
    grid-column: 1 / -1;
  }

  :global(.recall-form-grid) {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  :global(.recall-flip) {
    position: relative;
    border: none;
    width: 100%;
    min-height: 360px;
    border-radius: 28px;
    background: transparent;
    perspective: 900px;
    color: inherit;
    cursor: pointer;
    padding: 0;
    text-align: left;
  }

  :global(.recall-flip__inner) {
    position: relative;
    width: 100%;
    min-height: 360px;
    transition: transform 0.48s ease;
    transform-style: preserve-3d;
  }

  :global(.recall-flip.reveal .recall-flip__inner) {
    transform: rotateY(180deg);
  }

  :global(.recall-flip__face) {
    position: absolute;
    inset: 0;
    display: grid;
    align-content: center;
    justify-items: center;
    gap: 14px;
    padding: 34px;
    text-align: center;
    border-radius: 28px;
    backface-visibility: hidden;
    background: color-mix(in srgb, var(--recall-surface-strong) 10%, rgba(255,255,255,0.05));
  }

  :global(.recall-flip__face--back) {
    transform: rotateY(180deg);
  }

  :global(.recall-flip__label) {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: rgba(255,255,255,0.68);
  }

  :global(.recall-flip__face) p {
    margin: 0;
    max-width: 24rem;
    font-size: clamp(1.4rem, 2vw, 2rem);
    line-height: 1.2;
    letter-spacing: -0.04em;
  }

  :global(.recall-flip__face) small {
    color: rgba(255,255,255,0.68);
  }

  :global(.recall-grade-row) {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
  }

  :global(.recall-queue-item) {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 12px;
    align-items: center;
    padding: 14px 16px;
    border-radius: 18px;
    background: color-mix(in srgb, var(--recall-surface-strong) 88%, transparent);
  }

  :global(.recall-queue-item.active) {
    background: color-mix(in srgb, var(--recall-accent) 12%, var(--recall-surface-strong));
  }

  :global(.recall-sprint) {
    display: grid;
    gap: 14px;
    padding: 18px;
    border-radius: 22px;
    background: color-mix(in srgb, var(--recall-surface-strong) 88%, transparent);
  }

  :global(.recall-sprint__meter) {
    display: grid;
    gap: 6px;
  }

  :global(.recall-sprint__meter strong) {
    font-size: 2rem;
    line-height: 1;
  }

  :global(.recall-sprint__meter span) {
    color: var(--recall-muted);
  }

  :global(.recall-sprint__controls) {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  :global(.recall-speed-grid),
  :global(.recall-progress-grid) {
    display: grid;
    gap: 12px;
  }

  :global(.recall-speed-grid) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  :global(.recall-progress-grid) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  :global(.recall-speed-grid) article,
  :global(.recall-progress-grid) article {
    padding: 16px;
    display: grid;
    gap: 8px;
  }

  :global(.recall-speed-grid) span,
  :global(.recall-progress-grid) span {
    font-size: 0.76rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--recall-muted);
  }

  :global(.recall-speed-grid) strong,
  :global(.recall-progress-grid) strong {
    font-size: 1.1rem;
  }

  :global(.recall-pin-grid) {
    display: grid;
    gap: 10px;
  }

  :global(.recall-pin-card) {
    display: grid;
    gap: 8px;
  }

  :global(.recall-pin-card__top) {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }

  :global(.recall-archive-item) {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 12px;
    align-items: center;
  }

  :global(.recall-archive-list) {
    max-height: 420px;
    overflow: auto;
    padding-right: 4px;
  }

  :global(.recall-card--wide) {
    grid-column: 1 / -1;
  }

  :global(.recall-state__title) {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 600;
  }

  :global(.recall-state__text) {
    margin: 0;
    color: var(--recall-muted);
  }

  @media (max-width: 1200px) {
    :global(.recall-layout--overview),
    :global(.recall-layout--two),
    :global(.recall-layout--progress) {
      grid-template-columns: 1fr;
    }

    :global(.recall-stat-grid),
    :global(.recall-hero__metrics),
    :global(.recall-speed-grid),
    :global(.recall-progress-grid) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 760px) {
    :global(.recall-workspace) {
      padding: 22px 18px;
    }

    :global(.recall-shell__header) {
      flex-direction: column;
    }

    :global(.recall-shell__actions) {
      justify-content: flex-start;
    }

    :global(.recall-stat-grid),
    :global(.recall-hero__metrics),
    :global(.recall-speed-grid),
    :global(.recall-progress-grid),
    :global(.recall-form-grid),
    :global(.recall-grade-row) {
      grid-template-columns: 1fr;
    }

    :global(.recall-section-head) {
      flex-direction: column;
    }

    :global(.recall-filter-row) {
      justify-content: flex-start;
    }

    :global(.recall-flip__face) {
      padding: 26px 18px;
    }
  }
</style>
