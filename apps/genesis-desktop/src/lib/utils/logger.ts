// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

/**
 * Bento Desktop structured logger.
 *
 * Provides consistent log formatting, production-silenceable levels,
 * and a single place to redirect logs (e.g. to telemetry or a file).
 *
 * Usage:
 *   import { logger } from '$lib/utils/logger';
 *   logger.info('Alerts button clicked', { currentPage });
 *   logger.warn('Settings failed to load', error);
 *   logger.error('Theme toggle failed', error);
 */

/* eslint-disable no-console -- this is the single intentional console wrapper */

const PREFIX = "[Bento Desktop]";

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel: LogLevel =
  (import.meta.env.VITE_PUBLIC_LOG_LEVEL as LogLevel | undefined) || "info";

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatMessage(level: LogLevel, message: string): string {
  return `${PREFIX} ${level.toUpperCase()}: ${message}`;
}

function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && "message" in err)
    return String((err as { message: unknown }).message);
  return String(err);
}

/**
 * Strip internal URLs, hostnames, and infrastructure details from error messages
 * before showing them to users. Keeps messages safe and user-friendly.
 *
 * Follows OWASP guidelines: never expose stack traces, database paths, internal
 * hostnames, or infrastructure provider names to end users.
 */
export function sanitizeError(message: string): string {
  return (
    message
      // ── URLs (any protocol) ──────────────────────────────────────────
      .replace(/https?:\/\/[^\s"')]+/gi, "[redacted]")
      .replace(/\bftp:\/\/[^\s"')]+/gi, "[redacted]")
      .replace(/\bwss?:\/\/[^\s"')]+/gi, "[redacted]")
      .replace(/\bfile:\/\/[^\s"')]+/gi, "[redacted]")
      // ── Infrastructure hostnames (cloud providers, PaaS, edge) ──────
      .replace(
        /\b(?:[\w-]+\.)?(?:supabase\.co|supabase|vercel\.app|vercel|netlify\.app|netlify|herokuapp\.com|herokuapp|railway\.app|railway|fly\.dev|cloudflare|deno\.dev|render\.com|turso\.cloud|neon\.tech|planetscale\.com|firebase|googleapis\.com|googleapis|amazonaws\.com|amazonaws|onrender\.com|onrender)\b/gi,
        "[service]",
      )
      // ── IP addresses ────────────────────────────────────────────────
      .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, "[ip]")
      // ── Localhost with port ─────────────────────────────────────────
      .replace(/localhost:\d+/gi, "[local]")
      // ── Trailing port numbers (may remain after URL stripping) ──────
      .replace(/:\d{2,5}\b/g, "")
      // ── Filesystem paths (Unix / Windows) ──────────────────────────
      .replace(/(?:\/[\w.-]+){2,}/g, "[path]")
      .replace(/\b[A-Z]:\\[\w\\.-]+/g, "[path]")
  );
}

export const logger = {
  debug(message: string, ...args: unknown[]) {
    if (!shouldLog("debug")) return;
    console.debug(formatMessage("debug", message), ...args);
  },

  info(message: string, ...args: unknown[]) {
    if (!shouldLog("info")) return;
    console.info(formatMessage("info", message), ...args);
  },

  warn(message: string, error?: unknown) {
    if (!shouldLog("warn")) return;
    if (error !== undefined) {
      console.warn(formatMessage("warn", `${message} — ${formatError(error)}`));
    } else {
      console.warn(formatMessage("warn", message));
    }
  },

  error(message: string, error?: unknown) {
    if (!shouldLog("error")) return;
    if (error !== undefined) {
      console.error(formatMessage("error", `${message} — ${formatError(error)}`));
    } else {
      console.error(formatMessage("error", message));
    }
  },
};
