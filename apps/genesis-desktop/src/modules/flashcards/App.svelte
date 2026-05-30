<script lang="ts">
  import "./flashcards.css";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import XIcon from "@lucide/svelte/icons/x";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from "$lib/components/ui/card/index.js";
  import { MiniAppHeader, MiniAppRoot, MiniAppStatGrid } from "$lib/modules/mini-app/index.js";

  let { moduleId = "flashcards", settings = {} }: { moduleId?: string; settings?: Record<string, unknown> } =
    $props();

  let currentView = $state<"home" | "review">("home");
  let totalDue = $state(47);

  const decks = [
    { id: 1, name: "Spanish A1", totalCards: 450, dueCount: 24, lastStudied: "2h ago" },
    { id: 2, name: "Anatomy", totalCards: 128, dueCount: 15, lastStudied: "Yesterday" },
    { id: 3, name: "AWS Architect", totalCards: 850, dueCount: 8, lastStudied: "3d ago" },
    { id: 4, name: "JavaScript", totalCards: 65, dueCount: 0, lastStudied: "Today" },
  ];

  let reviewSession = $state({
    total: 47,
    remaining: 47,
    isFlipped: false,
  });

  const mockCard = {
    front: "What is the primary function of the mitochondria?",
    back: "Generates ATP — chemical energy for the cell.",
  };

  function startReview(deckId: number | null = null) {
    if (deckId !== null) {
      const deck = decks.find((d) => d.id === deckId);
      reviewSession.total = deck?.dueCount ?? 0;
    } else {
      reviewSession.total = totalDue;
    }
    reviewSession.remaining = reviewSession.total;

    if (reviewSession.total > 0) {
      reviewSession.isFlipped = false;
      currentView = "review";
    }
  }

  function rateCard() {
    reviewSession.remaining -= 1;
    reviewSession.isFlipped = false;

    if (reviewSession.remaining <= 0) {
      totalDue = Math.max(0, totalDue - reviewSession.total);
      currentView = "home";
    }
  }

  const progressPct = $derived(
    reviewSession.total > 0
      ? ((reviewSession.total - reviewSession.remaining) / reviewSession.total) * 100
      : 0,
  );
</script>

<MiniAppRoot class="flashcards-app gap-5 p-4 sm:p-6">
  {#if currentView === "home"}
    <MiniAppHeader
      eyebrow="Flashcards"
      title="Spaced repetition decks"
      description="Review due cards, track decks, and keep study sessions short."
    >
      {#snippet actions()}
        <Button type="button" variant="outline" size="icon" aria-label="New deck">
          <PlusIcon />
        </Button>
      {/snippet}
    </MiniAppHeader>

    <MiniAppStatGrid
      stats={[
        { label: "Due today", value: String(totalDue), hint: "Across all decks" },
        { label: "Decks", value: String(decks.length), hint: "In your library" },
        { label: "Streak", value: "12 days", hint: "Daily reviews" },
      ]}
    />

    <section class="flashcards-hero">
      <p class="flashcards-due">{totalDue}</p>
      <p class="flashcards-due-label">cards due today</p>
      <Button type="button" disabled={totalDue === 0} onclick={() => startReview()}>
        {totalDue > 0 ? "Start review" : "All caught up"}
      </Button>
    </section>

    <Card class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
      <CardHeader>
        <CardTitle class="font-[var(--font-heading)] text-xl">Your decks</CardTitle>
        <CardDescription>Tap a deck to review its due queue.</CardDescription>
      </CardHeader>
      <CardContent class="grid gap-2">
        {#each decks as deck (deck.id)}
          <button type="button" class="mini-app-row w-full text-left" onclick={() => startReview(deck.id)}>
            <span class="min-w-0">
              <span class="block font-medium text-[var(--foreground)]">{deck.name}</span>
              <span class="mt-1 block text-sm text-[var(--muted)]">
                {deck.totalCards} cards · {deck.lastStudied}
              </span>
            </span>
            <span class="flex shrink-0 items-center gap-2">
              {#if deck.dueCount > 0}
                <Badge>{deck.dueCount}</Badge>
              {/if}
              <ChevronRightIcon class="size-4 text-[var(--muted)]" />
            </span>
          </button>
        {/each}
      </CardContent>
    </Card>
  {:else}
    <header class="flex items-center justify-between gap-4">
      <Button type="button" variant="ghost" size="sm" onclick={() => (currentView = "home")}>
        <XIcon data-icon="inline-start" />
        End session
      </Button>
      <span class="grid gap-1 text-right">
        <span class="text-xs font-medium text-[var(--muted)]">
          {reviewSession.total - reviewSession.remaining + 1} / {reviewSession.total}
        </span>
        <span class="flashcards-review-bar">
          <span class="flashcards-review-fill" style="width:{progressPct}%"></span>
        </span>
      </span>
    </header>

    <section class="flashcards-scene">
      <button
        type="button"
        class="flashcards-card"
        class:is-flipped={reviewSession.isFlipped}
        onclick={() => (reviewSession.isFlipped = true)}
        aria-label="Flip card"
      >
        <span class="flashcards-face">
          <p class="text-lg font-medium text-[var(--foreground)]">{mockCard.front}</p>
          {#if !reviewSession.isFlipped}
            <span class="mt-6 text-xs font-medium tracking-wide text-[var(--muted)] uppercase">
              Tap to reveal
            </span>
          {/if}
        </span>
        <span class="flashcards-face flashcards-face--back">
          <p class="text-base leading-relaxed text-[var(--foreground)]">{mockCard.back}</p>
        </span>
      </button>
    </section>

    <section class="flashcards-rating" class:is-visible={reviewSession.isFlipped}>
      <button type="button" class="flashcards-rate flashcards-rate--again" onclick={rateCard}>
        <span>Again</span>
        <span class="flashcards-rate-time">&lt;1m</span>
      </button>
      <button type="button" class="flashcards-rate flashcards-rate--hard" onclick={rateCard}>
        <span>Hard</span>
        <span class="flashcards-rate-time">2d</span>
      </button>
      <button type="button" class="flashcards-rate flashcards-rate--good" onclick={rateCard}>
        <span>Good</span>
        <span class="flashcards-rate-time">4d</span>
      </button>
      <button type="button" class="flashcards-rate flashcards-rate--easy" onclick={rateCard}>
        <span>Easy</span>
        <span class="flashcards-rate-time">8d</span>
      </button>
    </section>
  {/if}
</MiniAppRoot>
