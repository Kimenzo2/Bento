// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

import { Spectrum } from "spectrum-ts";
import { telegram } from "spectrum-ts/providers/telegram";
import { slack } from "spectrum-ts/providers/slack";
import { imessage } from "spectrum-ts/providers/imessage";
import { whatsappBusiness } from "spectrum-ts/providers/whatsapp-business";
import { createIpcClient } from "./ipc";

interface PlatformConfig {
  enabled: boolean;
  token?: string;
  botUsername?: string;
  additionalConfig?: Record<string, string>;
  connectedAt?: string;
}

interface SocialAgentsConfig {
  enabled: boolean;
  projectId?: string;
  projectSecret?: string;
  platforms: Record<string, PlatformConfig>;
}

const ipc = createIpcClient();

async function main() {
  ipc.send({ type: "ping" });

  const config = await ipc.waitForConfig<SocialAgentsConfig>();

  const platformKeys = Object.keys(config?.platforms ?? {});
  const tokenStatus = Object.values(config?.platforms ?? {}).map((p: any) => p?.enabled ? (p?.token ? "has-token" : "no-token") : "disabled");
  ipc.send({ type: "error", id: "debug-config", message: `enabled=${config?.enabled} projectId=${config?.projectId ? "set" : "unset"} platforms=[${platformKeys.join(",")}] tokens=[${tokenStatus.join(",")}]` });

  if (!config?.enabled) {
    ipc.send({
      type: "error",
      id: "init",
      message: "Social agents disabled in config",
    });
    process.exit(0);
  }

  const providers: any[] = [];

  for (const [name, platform] of Object.entries(config.platforms)) {
    if (!platform.enabled) continue;

    switch (name) {
      case "telegram": {
        if (platform.token) {
          providers.push(telegram.config({ botToken: platform.token }));
        }
        break;
      }
      case "slack": {
        if (platform.token) {
          const teamId = platform.additionalConfig?.teamId ?? "TEAM";
          providers.push(
            slack.config({
              tokens: { [teamId]: platform.token },
              teams: {
                [teamId]: {
                  appId: platform.additionalConfig?.appId ?? "",
                  botUserId: platform.additionalConfig?.botUserId ?? "",
                  grantedScopes: ["chat:write", "channels:history", "im:history"],
                  teamName: platform.botUsername ?? "Bento",
                },
              },
            })
          );
        }
        break;
      }
      case "imessage": {
        providers.push(imessage.config({}));
        break;
      }
      case "whatsapp": {
        if (platform.token) {
          providers.push(whatsappBusiness.config({
            phoneNumberId: platform.token,
            accessToken: platform.additionalConfig?.accessToken ?? "",
            businessAccountId: platform.additionalConfig?.businessAccountId ?? "",
          }));
        }
        break;
      }
    }
  }

  if (providers.length === 0) {
    ipc.send({
      type: "error",
      id: "init",
      message: "No enabled platforms with valid tokens",
    });
    process.exit(0);
  }

  if (!config.projectId || !config.projectSecret) {
    ipc.send({
      type: "error",
      id: "init",
      message: "Spectrum Cloud projectId and projectSecret are required",
    });
    process.exit(0);
  }

  const app = await Spectrum({
    projectId: config.projectId,
    projectSecret: config.projectSecret,
    providers,
  });

  ipc.send({ type: "ready", platforms: Object.keys(config.platforms).filter((n) => config.platforms[n]?.enabled) });

  for await (const [space, message] of app.messages) {
    if (message.direction === "outbound") continue;
    if (message.content.type !== "text") continue;

    const senderId = message.sender?.id ?? "unknown";
    const text = message.content.text;

    const response = await ipc.chat({
      messages: [{ role: "user", content: text }],
      platform: message.platform,
      userId: senderId,
      spaceId: space.id,
    });

    if (response?.content) {
      await space.responding(async () => {
        await message.reply(response.content);
      });
    }
  }
}

main().catch((err) => {
  ipc.send({
    type: "error",
    id: "fatal",
    message: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
