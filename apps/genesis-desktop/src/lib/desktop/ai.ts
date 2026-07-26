import { Channel, invoke, isTauri } from "@tauri-apps/api/core";

export function streamAiResponse(prompt: string, onToken: (token: string) => void): { promise: Promise<void>; cancel: () => void } {
  let cancelled = false;

  if (!isTauri()) {
    const text = `Bento AI channel is ready. Prompt received: ${prompt}`;
    const words = text.match(/\S+\s*/g) ?? [text];
    let index = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const promise = new Promise<void>((resolve) => {
      function next() {
        if (cancelled || index >= words.length) {
          resolve();
          return;
        }
        onToken(words[index++]);
        timer = setTimeout(next, 8);
      }
      next();
    });

    return {
      promise,
      cancel: () => {
        cancelled = true;
        if (timer) clearTimeout(timer);
      },
    };
  }

  const onTokenChannel = new Channel<string>();
  onTokenChannel.onmessage = (token: string) => {
    if (!cancelled) onToken(token);
  };

  const promise = invoke("ai_stream", { prompt, onToken: onTokenChannel }).then(() => {
    cancelled = true;
  });

  return {
    promise,
    cancel: () => {
      cancelled = true;
    },
  };
}
