/**
 * TypeScript client for the Rust-native AI backend.
 *
 * All AI operations go through Tauri `invoke()` commands instead of
 * SvelteKit API endpoints. This file provides typed wrappers around
 * each Tauri command.
 *
 * Usage:
 * ```ts
 * import { chatStream, chatComplete, conversations } from "$lib/ai/client";
 *
 * // Stream a chat response
 * for await (const event of chatStream({ messages: [...] })) {
 *   if (event.type === "token") console.log(event.content);
 * }
 *
 * // Non-streaming
 * const text = await chatComplete({ messages: [...] });
 *
 * // Conversation memory
 * const list = await conversations.list();
 * ```
 */

import { Channel, invoke } from "@tauri-apps/api/core";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: string;
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export type ChatEvent =
  | { type: "token"; content: string }
  | {
      type: "tool_call";
      id: string;
      name: string;
      args: Record<string, unknown>;
      autoExecute: boolean;
    }
  | { type: "tool_result"; id: string; name: string; result: unknown; isError: boolean }
  | { type: "error"; message: string }
  | { type: "done"; finishReason?: string; usage?: { inputTokens?: number; outputTokens?: number } }
  | { type: "ui_update"; ui: UiVocabulary };

export type UiVocabulary =
  | { type: "summary_card"; title: string; description?: string; content?: string; icon?: string }
  | { type: "task_list"; items: TaskDraft[] }
  | {
      type: "confirmation_card";
      id: string;
      title: string;
      description?: string;
      actions: ActionDef[];
    }
  | { type: "note_draft"; title?: string; blocks: unknown[] }
  | {
      type: "chart";
      variant: string;
      config: Record<string, unknown>;
      data: Record<string, unknown>[];
    };

export interface TaskDraft {
  id: string;
  title: string;
  done: boolean;
  priority?: string;
  dueAt?: number;
  project?: string;
  tags?: string[];
}

export interface ActionDef {
  label: string;
  variant?: string;
}

export interface ChatParams {
  messages: ChatMessage[];
  system?: string;
  model?: string;
  provider?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  stopSequences?: string[];
  enableTools?: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  autoExecute: boolean;
}

export interface ConversationSummary {
  id: string;
  title: string;
  messageCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface ProviderStatus {
  provider: string;
  displayName: string;
  isConfigured: boolean;
  requiresKey: boolean;
  hasKey: boolean;
  isActive: boolean;
  defaultBaseUrl: string;
}

// ── Chat commands ─────────────────────────────────────────────────────────────

/**
 * Stream a multi-turn chat response with tool calling support.
 *
 * Returns an async generator of ChatEvent objects.
 * The Rust backend automatically executes tools and continues the
 * conversation loop.
 *
 * @example
 * ```ts
 * for await (const event of chatStream({ messages: [{ role: "user", content: "What tasks do I have?" }] })) {
 *   if (event.type === "token") process.stdout.write(event.content);
 *   if (event.type === "tool_call") console.log("Calling tool:", event.name);
 *   if (event.type === "tool_result") console.log("Tool result:", event.result);
 * }
 * ```
 */
export function chatStream(params: ChatParams): {
  stream: AsyncGenerator<ChatEvent>;
  cancel: () => void;
} {
  const {
    messages,
    system,
    model,
    provider,
    temperature,
    maxTokens,
    topP,
    topK,
    presencePenalty,
    frequencyPenalty,
    stopSequences,
    enableTools,
  } = params;

  const channel = new Channel<ChatEvent>();
  const buffer: ChatEvent[] = [];
  let resolveNext: ((event: IteratorResult<ChatEvent>) => void) | null = null;
  let invokeError: unknown = null;
  let done = false;
  let cancelled = false;

  channel.onmessage = (event: ChatEvent) => {
    if (cancelled) return;
    if (resolveNext) {
      const r = resolveNext;
      resolveNext = null;
      r({ value: event, done: false });
    } else {
      buffer.push(event);
    }
    if (event.type === "done" || event.type === "error") {
      done = true;
    }
  };

  const promise = invoke("ai_chat_stream", {
    messages,
    system: system ?? null,
    model: model ?? null,
    provider: provider ?? null,
    temperature: temperature ?? null,
    maxTokens: maxTokens ?? null,
    topP: topP ?? null,
    topK: topK ?? null,
    presencePenalty: presencePenalty ?? null,
    frequencyPenalty: frequencyPenalty ?? null,
    stopSequences: stopSequences ?? null,
    enableTools: enableTools ?? null,
    onEvent: channel,
  }).catch((err) => {
    invokeError = err;
    done = true;
    if (resolveNext) {
      const r = resolveNext;
      resolveNext = null;
      r({ value: { type: "error" as const, message: String(err) }, done: false });
    }
  });

  async function* stream(): AsyncGenerator<ChatEvent> {
    try {
      while (!done) {
        if (buffer.length > 0) {
          yield buffer.shift()!;
          continue;
        }
        if (invokeError) {
          throw invokeError;
        }
        const event = await new Promise<IteratorResult<ChatEvent>>((resolve) => {
          resolveNext = resolve;
        });
        yield event.value;
      }
      // Flush remaining buffered events
      while (buffer.length > 0) {
        yield buffer.shift()!;
      }
    } finally {
      await promise.catch(() => {});
    }
  }

  return {
    stream: stream(),
    cancel: () => {
      cancelled = true;
      done = true;
      if (resolveNext) {
        const r = resolveNext;
        resolveNext = null;
        r({ value: { type: "done" as const, finishReason: "cancelled" }, done: false });
      }
    },
  };
}

/**
 * Perform a non-streaming multi-turn chat completion.
 *
 * Returns just the text response.
 */
export async function chatComplete(params: ChatParams): Promise<string> {
  const {
    messages,
    system,
    model,
    provider,
    temperature,
    maxTokens,
    topP,
    topK,
    presencePenalty,
    frequencyPenalty,
    stopSequences,
    enableTools,
  } = params;

  return invoke<string>("ai_chat_complete", {
    messages,
    system: system ?? null,
    model: model ?? null,
    provider: provider ?? null,
    temperature: temperature ?? null,
    maxTokens: maxTokens ?? null,
    topP: topP ?? null,
    topK: topK ?? null,
    presencePenalty: presencePenalty ?? null,
    frequencyPenalty: frequencyPenalty ?? null,
    stopSequences: stopSequences ?? null,
    enableTools: enableTools ?? null,
  });
}

// ── Tool commands ─────────────────────────────────────────────────────────────

/** List available tool definitions for the agent. */
export async function listTools(): Promise<ToolDefinition[]> {
  return invoke<ToolDefinition[]>("ai_tools_list");
}

// ── Conversation memory commands ──────────────────────────────────────────────

export const conversations = {
  /** List saved conversations, most recent first. */
  list: (limit = 50, offset = 0): Promise<ConversationSummary[]> =>
    invoke("ai_conversation_list", { limit, offset }),

  /** Get a single conversation with all messages. */
  get: (id: string): Promise<Conversation | null> => invoke("ai_conversation_get", { id }),

  /** Delete a conversation and all its messages. */
  delete: (id: string): Promise<void> => invoke("ai_conversation_delete", { id }),

  /** Save messages to a conversation (creates or updates). */
  save: (id: string, messages: ChatMessage[]): Promise<void> =>
    invoke("ai_conversation_save", { id, messages }),

  /** Update a conversation's title. */
  rename: (id: string, title: string): Promise<void> =>
    invoke("ai_conversation_rename", { id, title }),

  /** Search conversations by title or message content. */
  search: (query: string, limit = 20): Promise<ConversationSummary[]> =>
    invoke("ai_conversation_search", { query, limit }),
};

// ── Provider commands ─────────────────────────────────────────────────────────

/** Get the status of all AI providers. */
export async function getProviderStatus(): Promise<ProviderStatus[]> {
  return invoke<ProviderStatus[]>("get_ai_provider_status");
}

/** List available models for a given provider. */
export async function listModels(providerName: string): Promise<string[]> {
  return invoke<string[]>("list_ai_models", { providerName });
}
