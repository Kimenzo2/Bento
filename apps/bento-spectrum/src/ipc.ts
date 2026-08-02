// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

type OutgoingMessage =
  | { type: "config"; enabled: boolean; projectId?: string; projectSecret?: string; platforms: Record<string, unknown> }
  | { type: "ready"; platforms: string[] }
  | { type: "chat"; id: string; messages: { role: string; content: string }[]; platform: string; userId: string; spaceId: string }
  | { type: "token"; id: string; content: string }
  | { type: "done"; id: string; content: string }
  | { type: "error"; id: string; message: string };

type IncomingMessage =
  | { type: "chat"; id: string; messages: { role: string; content: string }[]; platform: string; userId: string; spaceId: string }
  | { type: "config"; enabled: boolean; projectId?: string; projectSecret?: string; platforms: Record<string, unknown> }
  | { type: "ping" }
  | { type: "error"; id: string; message: string };

export function createIpcClient() {
  const pending = new Map<
    string,
    {
      resolve: (value: { content: string }) => void;
      reject: (err: Error) => void;
      buffer: string[];
    }
  >();
  let configResolve: ((config: unknown) => void) | null = null;

  const readStdin = (async () => {
    const stdin = process.stdin;
    stdin.setEncoding("utf-8");

    let buffer = "";
    for await (const chunk of stdin) {
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const msg: IncomingMessage = JSON.parse(trimmed);

          switch (msg.type) {
            case "config": {
              if (configResolve) {
                configResolve(msg);
                configResolve = null;
              }
              break;
            }
            case "token": {
              const p = pending.get(msg.id);
              if (p) p.buffer.push(msg.content);
              break;
            }
            case "done": {
              const p = pending.get(msg.id);
              if (p) {
                p.resolve({ content: p.buffer.join("") + msg.content });
                pending.delete(msg.id);
              }
              break;
            }
            case "error": {
              const p = pending.get(msg.id);
              if (p) {
                p.reject(new Error(msg.message));
                pending.delete(msg.id);
              }
              break;
            }
          }
        } catch {
          /* skip unparseable */
        }
      }
    }
  })();

  function send(msg: OutgoingMessage) {
    process.stdout.write(JSON.stringify(msg) + "\n");
  }

  return {
    send,

    waitForConfig<T>(): Promise<T> {
      return new Promise((resolve, reject) => {
        configResolve = resolve as (config: unknown) => void;
        setTimeout(() => {
          if (configResolve) {
            configResolve = null;
            reject(new Error("Config timeout"));
          }
        }, 10_000);
      });
    },

    chat(params: {
      messages: { role: string; content: string }[];
      platform: string;
      userId: string;
      spaceId: string;
    }): Promise<{ content: string }> {
      const id = crypto.randomUUID();

      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject, buffer: [] });

        send({
          type: "chat",
          id,
          messages: params.messages,
          platform: params.platform,
          userId: params.userId,
          spaceId: params.spaceId,
        });

        setTimeout(() => {
          const p = pending.get(id);
          if (p) {
            pending.delete(id);
            reject(new Error("Chat timeout"));
          }
        }, 60_000);
      });
    },
  };
}
