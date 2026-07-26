<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import type { UiVocabulary } from "$lib/ai/client";
  import SummaryCard from "./SummaryCard.svelte";
  import TaskListCard from "./TaskListCard.svelte";

  let { ui }: { ui: UiVocabulary } = $props();

  type ConfirmState = "idle" | "confirming" | "confirmed" | "cancelled" | "error";
  let confirmState = $state<ConfirmState>("idle");
  let confirmError = $state<string | null>(null);

  async function handleConfirm(id: string) {
    confirmState = "confirming";
    confirmError = null;
    try {
      await invoke("confirm_agent_action", { actionId: id });
      confirmState = "confirmed";
    } catch (err) {
      confirmState = "error";
      confirmError = String(err);
    }
  }

  async function handleCancel(id: string) {
    confirmState = "confirming";
    confirmError = null;
    try {
      await invoke("cancel_agent_action", { actionId: id });
      confirmState = "cancelled";
    } catch (err) {
      confirmState = "error";
      confirmError = String(err);
    }
  }
</script>

{#if ui.type === "summary_card"}
  <SummaryCard title={ui.title} description={ui.description} content={ui.content} icon={ui.icon} />
{:else if ui.type === "task_list"}
  <TaskListCard items={ui.items} />
{:else if ui.type === "confirmation_card"}
  <div class="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
    <p class="text-sm font-medium">{ui.title}</p>
    {#if ui.description}
      <p class="mt-1 text-xs text-[var(--muted-foreground)]">{ui.description}</p>
    {/if}
    {#if confirmState === "idle"}
      <div class="mt-3 flex gap-2">
        <button
          class="inline-flex items-center justify-center rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-[var(--primary-foreground)] transition-colors hover:bg-[var(--primary)]/90 disabled:opacity-50"
          onclick={() => handleConfirm(ui.id)}
        >
          Confirm
        </button>
        <button
          class="inline-flex items-center justify-center rounded-lg border border-[var(--border)] bg-transparent px-3 py-1.5 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]/50"
          onclick={() => handleCancel(ui.id)}
        >
          Cancel
        </button>
      </div>
    {:else if confirmState === "confirming"}
      <p class="mt-2 text-xs text-[var(--muted-foreground)]">Processing...</p>
    {:else if confirmState === "confirmed"}
      <p class="mt-2 text-xs text-green-500">Confirmed</p>
    {:else if confirmState === "cancelled"}
      <p class="mt-2 text-xs text-[var(--muted-foreground)]">Cancelled</p>
    {:else if confirmState === "error"}
      <p class="mt-2 text-xs text-red-500">{confirmError}</p>
    {/if}
  </div>
{:else if ui.type === "note_draft"}
  <div class="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
    <p class="text-sm font-medium">{ui.title ?? "Note Draft"}</p>
    <p class="mt-1 text-xs text-[var(--muted-foreground)]">{ui.blocks?.length ?? 0} block(s)</p>
  </div>
{:else if ui.type === "chart"}
  <div class="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
    <p class="text-sm font-medium">Chart: {ui.variant}</p>
    <p class="mt-1 text-xs text-[var(--muted-foreground)]">{ui.data?.length ?? 0} data point(s)</p>
  </div>
{:else}
  <div class="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
    <p class="text-xs text-[var(--muted-foreground)]">Unsupported UI type: {(ui as { type: string }).type}</p>
  </div>
{/if}
