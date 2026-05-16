<script lang="ts">
  import {
    Wallet,
    ChevronLeft,
    ChevronRight,
    Settings,
    Plus,
    PiggyBank,
    Coffee,
    Home,
    Car,
    Coins,
  } from "lucide-svelte";
  import type { Component } from "svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Card, CardContent } from "$lib/components/ui/card/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
  } from "$lib/components/ui/dialog/index.js";
  import {
    MiniAppRoot,
    MiniAppHeader,
    MiniAppStatGrid,
  } from "$lib/modules/mini-app/index.js";
  import { cn } from "$lib/utils.js";
  import "./budget.css";

  let { moduleId = "budget", settings = {} }: { moduleId?: string; settings?: Record<string, unknown> } =
    $props();

  type CategoryIcon = typeof Home | typeof Coffee | typeof Car | typeof PiggyBank | typeof Wallet;

  type CategoryItem = {
    name: string;
    left: number;
    spent: number;
    total: number;
    icon: CategoryIcon;
  };

  const currentMonth = "May 2026";
  let toAssign = $state(340);
  let showTransactionForm = $state(false);
  let txAmount = $state("");
  let txCategory = $state("");
  let txNote = $state("");

  const categories: { group: string; items: CategoryItem[] }[] = [
    {
      group: "Essentials",
      items: [
        { name: "Rent", left: 1200, spent: 0, total: 1200, icon: Home },
        { name: "Groceries", left: 240, spent: 360, total: 600, icon: Coffee },
        { name: "Transport", left: 45, spent: 105, total: 150, icon: Car },
      ],
    },
    {
      group: "Lifestyle",
      items: [
        { name: "Dining Out", left: -45, spent: 245, total: 200, icon: Coffee },
        { name: "Entertainment", left: 120, spent: 80, total: 200, icon: Wallet },
      ],
    },
    {
      group: "Savings",
      items: [{ name: "Emergency Fund", left: 500, spent: 0, total: 500, icon: PiggyBank }],
    },
  ];

  function spentPercent(item: CategoryItem) {
    return Math.min(100, Math.max(0, (item.spent / item.total) * 100));
  }
</script>

<MiniAppRoot class="relative gap-5 p-4 pb-28 sm:p-6 sm:pb-32">
  <MiniAppHeader
    eyebrow="Budget"
    title={currentMonth}
    description="Envelope-style categories with amounts left to spend."
  >
    {#snippet actions()}
      <div class="flex items-center gap-1">
        <Button variant="outline" size="icon" type="button" aria-label="Previous month">
          <ChevronLeft class="size-4" />
        </Button>
        <Button variant="outline" size="icon" type="button" aria-label="Next month">
          <ChevronRight class="size-4" />
        </Button>
      </div>
      <Button variant="outline" size="icon" type="button" aria-label="Budget settings">
        <Settings class="size-4" />
      </Button>
    {/snippet}
  </MiniAppHeader>

  <MiniAppStatGrid
    columns={3}
    stats={[
      { label: "Assigned", value: "€2,850", hint: "This month" },
      { label: "Spent", value: "€790", hint: "So far" },
      { label: "Remaining", value: "€2,060", hint: "Across categories" },
    ]}
  />

  <Card
    class={cn(
      "surface-card rounded-2xl border-none bg-transparent shadow-none ring-1",
      toAssign > 0 ? "budget-assign-warn" : "budget-assign-ok",
    )}
  >
    <CardContent class="flex items-center gap-3 p-4 sm:p-5">
      <div
        class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[color:color-mix(in_srgb,var(--primary)_14%,var(--card))] text-[var(--primary)]"
      >
        <Coins class="size-5" />
      </div>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-[var(--foreground)]">
          {toAssign > 0 ? `€${toAssign.toFixed(2)} to assign` : "Every euro is assigned"}
        </p>
        <p class="text-sm text-[var(--muted)]">
          {toAssign > 0 ? "Move unassigned cash into categories." : "Ready for new transactions."}
        </p>
      </div>
      <ChevronRight class="size-4 shrink-0 text-[var(--muted)]" />
    </CardContent>
  </Card>

  <div class="grid gap-6">
    {#each categories as group (group.group)}
      <section class="grid gap-4">
        <h2 class="px-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
          {group.group}
        </h2>
        <div class="grid gap-3">
          {#each group.items as item (item.name)}
            {@const overspent = item.left < 0}
            <Card
              class="surface-card rounded-2xl border-none bg-transparent shadow-none ring-1 ring-[color:color-mix(in_srgb,var(--border)_86%,transparent)]"
            >
              <CardContent class="grid gap-3 p-4">
                <div class="flex items-center justify-between gap-3">
                  <div class="flex min-w-0 items-center gap-2.5">
                    <item.icon class="size-4 shrink-0 text-[var(--muted)]" />
                    <span class="truncate font-medium text-[var(--foreground)]">{item.name}</span>
                  </div>
                  <span
                    class={cn(
                      "shrink-0 text-sm font-semibold tabular-nums",
                      overspent ? "text-[var(--destructive)]" : "text-[var(--primary)]",
                    )}
                  >
                    €{item.left.toFixed(2)} left
                  </span>
                </div>
                <div class="mini-app-progress">
                  <span
                    class={overspent ? "overspent" : ""}
                    style={`width: ${spentPercent(item)}%`}
                  ></span>
                </div>
              </CardContent>
            </Card>
          {/each}
        </div>
      </section>
    {/each}
  </div>

  <Button
    class="fixed right-4 bottom-20 z-10 size-14 rounded-full shadow-lg sm:right-6"
    type="button"
    onclick={() => (showTransactionForm = true)}
    aria-label="Log transaction"
  >
    <Plus class="size-6" />
  </Button>

  <Dialog bind:open={showTransactionForm}>
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Log transaction</DialogTitle>
      </DialogHeader>
      <div class="grid gap-4 py-2">
        <div class="grid gap-2">
          <Label for="budget-tx-amount">Amount</Label>
          <div class="relative">
            <span class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-lg text-[var(--muted)]"
              >€</span
            >
            <Input
              id="budget-tx-amount"
              type="number"
              class="pl-9 text-lg font-semibold"
              bind:value={txAmount}
              placeholder="0.00"
            />
          </div>
        </div>
        <div class="grid gap-2">
          <Label for="budget-tx-category">Category</Label>
          <select
            id="budget-tx-category"
            class="h-10 w-full rounded-md border border-[color:color-mix(in_srgb,var(--border)_86%,transparent)] bg-[var(--card)] px-3 text-sm text-[var(--foreground)]"
            bind:value={txCategory}
          >
            <option value="" disabled selected>Select category…</option>
            {#each categories as group}
              <optgroup label={group.group}>
                {#each group.items as item}
                  <option value={item.name}>{item.name}</option>
                {/each}
              </optgroup>
            {/each}
          </select>
        </div>
        <div class="grid gap-2">
          <Label for="budget-tx-note">Note</Label>
          <Input id="budget-tx-note" bind:value={txNote} placeholder="Optional" />
        </div>
        <div class="grid gap-2">
          <Label for="budget-tx-date">Date</Label>
          <Input id="budget-tx-date" type="date" value="2026-05-11" />
        </div>
      </div>
      <DialogFooter>
        <Button type="button" class="w-full" onclick={() => (showTransactionForm = false)}>
          Save transaction
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</MiniAppRoot>
