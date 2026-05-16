import { Channel, invoke, isTauri } from '@tauri-apps/api/core';

export async function streamAiResponse(prompt: string, onToken: (token: string) => void) {
  if (!isTauri()) {
    for (const token of `Genesis AI channel is ready. Prompt received: ${prompt}`.split(/(\s+)/)) {
      onToken(token);
      await new Promise((resolve) => setTimeout(resolve, 8));
    }
    return;
  }

  const onTokenChannel = new Channel<string>();
  onTokenChannel.onmessage = onToken;
  await invoke('stream_ai_response', { prompt, onToken: onTokenChannel });
}
