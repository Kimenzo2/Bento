import { Channel, invoke, isTauri } from "@tauri-apps/api/core";

/**
 * Stream an AI response token-by-token.
 * Uses the real `ai_stream` Tauri command which reads the active provider
 * and model from DesktopSettings.
 */
export async function streamAiResponse(prompt: string, onToken: (token: string) => void) {
  if (!isTauri()) {
    // Browser dev fallback: simulate streaming for development
    for (const token of `Bento AI channel is ready. Prompt received: ${prompt}`.split(/(\s+)/)) {
      onToken(token);
      await new Promise((resolve) => setTimeout(resolve, 8));
    }
    return;
  }

  const onTokenChannel = new Channel<string>();
  onTokenChannel.onmessage = (token: string) => {
    onToken(token);
  };
  await invoke("ai_stream", { prompt, onToken: onTokenChannel });
}
