<script lang="ts">
  import { onMount } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import WidgetWrapper from "./WidgetWrapper.svelte";
  import { getIcon } from "../island-icons";

  let isEditing = $state(false);
  let notesHeaderIcon = $derived(getIcon(isEditing ? "check" : "edit"));
  let notes = $state("");
  let textareaEl = $state<HTMLTextAreaElement | null>(null);

  let noteId = $state<string | null>(null);
  let titleBlockId = $state<string | null>(null);
  let saving = $state(false);

  async function invokeTauri<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
    try {
      return await invoke<T>(cmd, args);
    } catch {
      return null;
    }
  }

  onMount(async () => {
    try {
      const saved = localStorage.getItem("bento:widget:notes");
      if (saved) notes = saved;
      const savedId = localStorage.getItem("bento:widget:notes:id");
      if (savedId) noteId = savedId;
    } catch { /* localStorage unavailable */ }

    if (noteId) {
      const result = await invokeTauri<{ blocks: { id: string; type: string; text: string }[] }>("notes_object_full", { objectId: noteId });
      if (result?.blocks?.length) {
        titleBlockId = result.blocks[0].id;
        notes = result.blocks.map((b: { text: string }) => b.text).join("\n");
      }
    }
  });

  function splitTitleBody(text: string): [string, string] {
    const idx = text.indexOf("\n");
    if (idx === -1) return [text.trim().slice(0, 60) || "Quick Note", ""];
    return [text.slice(0, idx).trim().slice(0, 60) || "Quick Note", text.slice(idx + 1).trim()];
  }

  async function save() {
    saving = true;
    const [title, body] = splitTitleBody(notes);
    try {
      if (noteId && titleBlockId) {
        await invokeTauri("notes_set_text_content", { noteId, blockId: titleBlockId, text: title, marks: [] });
        await invokeTauri("notes_object_update", { params: { id: noteId, title } });
        if (body) {
          const existing = await invokeTauri<{ blocks: { id: string; type: string; text: string }[] }>("notes_object_full", { objectId: noteId });
          const bodyBlock = existing?.blocks?.find((b) => b.type === "text" && b.id !== titleBlockId);
          if (bodyBlock) {
            await invokeTauri("notes_set_text_content", { noteId, blockId: bodyBlock.id, text: body, marks: [] });
          } else {
            await invokeTauri("notes_block_create", {
              params: { noteId, parentId: null, targetId: titleBlockId, blockType: "text", content: { text: body, style: "Paragraph", marks: [], checked: false, color: "", iconEmoji: "", iconImage: "" }, position: 1, align: 0, bgColor: null },
            });
          }
        }
      } else {
        const created = await invokeTauri<{ note: { id: string }; blocks: { id: string }[] }>("notes_object_create", {
          params: { title, icon: null, tags: [], pinned: false },
        });
        if (created) {
          noteId = created.note.id;
          titleBlockId = created.blocks[0]?.id ?? null;
          if (titleBlockId) {
            await invokeTauri("notes_set_text_content", { noteId: created.note.id, blockId: titleBlockId, text: title, marks: [] });
          }
          if (body && titleBlockId) {
            await invokeTauri("notes_block_create", {
              params: { noteId, parentId: null, targetId: titleBlockId, blockType: "text", content: { text: body, style: "Paragraph", marks: [], checked: false, color: "", iconEmoji: "", iconImage: "" }, position: 1, align: 0, bgColor: null },
            });
          }
          try { localStorage.setItem("bento:widget:notes:id", noteId); } catch {}
        }
      }
    } catch { /* tauri unavailable */ }
    try { localStorage.setItem("bento:widget:notes", notes); } catch {}
    saving = false;
    isEditing = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      save();
    }
    if (e.key === "Escape" && isEditing) {
      isEditing = false;
    }
  }
</script>

<WidgetWrapper title="Notes">
  {#snippet headerActions()}
    <button
      onclick={() => {
      if (isEditing) save();
      else {
        isEditing = true;
        requestAnimationFrame(() => textareaEl?.focus());
      }
    }}
    aria-label={isEditing ? "Save notes" : "Edit notes"}
    >
      <notesHeaderIcon size={14} strokeWidth={1.8}></notesHeaderIcon>
    </button>
  {/snippet}

  <div class="notes-body">
    {#if isEditing}
      <textarea
        class="notes-textarea"
        bind:value={notes}
        onkeydown={handleKeydown}
        placeholder="Type your notes here..."
        aria-label="Notes editor"
        bind:this={textareaEl}
      ></textarea>
    {:else}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="notes-preview" onclick={() => isEditing = true}>
        {#if notes.trim()}
          <div class="notes-content">{notes}</div>
        {:else}
          <div class="notes-empty">Click to add notes</div>
        {/if}
      </div>
    {/if}
  </div>
</WidgetWrapper>

<style>
  .notes-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .notes-textarea {
    flex: 1;
    resize: none;
    background: rgba(255, 255, 255, 0.03);
    border: 0.5px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    color: rgba(255, 255, 255, 0.85);
    font-family: 'SF Mono', 'Consolas', monospace;
    font-size: 12px;
    padding: 10px;
    outline: none;
    line-height: 1.6;
  }

  .notes-textarea:focus {
    border-color: rgba(255, 255, 255, 0.15);
  }

  .notes-textarea::placeholder {
    color: rgba(255, 255, 255, 0.2);
  }

  .notes-preview {
    flex: 1;
    overflow-y: auto;
    cursor: text;
    padding: 4px 0;
  }

  .notes-content {
    font-size: 12px;
    line-height: 1.6;
    color: rgba(255, 255, 255, 0.75);
    white-space: pre-wrap;
  }

  .notes-empty {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-style: italic;
    color: rgba(255, 255, 255, 0.15);
  }
</style>
