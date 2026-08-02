// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

import type { RouteConfig } from "@mateothegreat/svelte5-router";
import ShellRoute from "$lib/components/ShellRoute.svelte";
import AuthPage from "../../routes/pages/AuthPage.svelte";
import PaymentCallbackPage from "../../routes/pages/PaymentCallbackPage.svelte";
import SharedViewerPage from "../../routes/pages/SharedViewerPage.svelte";
import { routePatterns } from "$lib/router/route-patterns";

export const pageMeta = {
  dashboard: {
    title: "Dashboard",
    subtitle: "Recent work, quick actions, and app health.",
  },
  project: {
    title: "Project View",
    subtitle: "Scene lists, metadata, and workflow state for the active project.",
  },
  lifeInColour: {
    title: "Life in Colour",
    subtitle: "Turn photo-driven inputs into soft line-art stories and colouring flows.",
  },
  visualStudio: {
    title: "Visual Studio",
    subtitle: "Control prompts, references, and composition boards for generated assets.",
  },
  export: {
    title: "Export",
    subtitle: "Prepare print, viewer, and asset-pack exports with filesystem-aware presets.",
  },
  settings: {
    title: "Settings",
    subtitle: "Theme, language, update, and local preferences.",
  },
  pricing: {
    title: "Pricing",
    subtitle: "Plan tiers and production capacity for creative teams.",
  },
  gamification: {
    title: "Gamification",
    subtitle: "Progress, streaks, rewards, and current challenges.",
  },
  account: {
    title: "Account",
    subtitle: "Profile, security, storage, and desktop identity controls.",
  },
  infographics: {
    title: "Infographics",
    subtitle: "Data storytelling layouts, metric blocks, and packaged exports.",
  },
  legal: {
    title: "Legal",
    subtitle: "Desktop-local policy surfaces and product terms.",
  },
  viewer: {
    title: "Viewer",
    subtitle: "Immersive playback and shared-reader previews.",
  },
  starterApp: {
    title: "Bento Apps",
    subtitle: "Focused offline-first personal tools inside the desktop app.",
  },
  notes: {
    title: "Notes",
    subtitle: "Capture everything in a standalone local notes app with rich blocks.",
  },
} as const;

export type PageKey = keyof typeof pageMeta;

export const appRoutes = [
  {
    path: "/auth",
    component: AuthPage,
  },
  {
    path: "/payment-callback",
    component: PaymentCallbackPage,
  },
  {
    path: routePatterns.shared,
    component: SharedViewerPage,
  },
  {
    path: "/life-in-colour",
    component: ShellRoute,
    props: { page: "lifeInColour" satisfies PageKey },
  },
  {
    path: "/notes",
    component: ShellRoute,
    props: { page: "notes" satisfies PageKey },
  },
  {
    path: "/export",
    component: ShellRoute,
    props: { page: "export" satisfies PageKey },
  },
  {
    path: "/settings",
    component: ShellRoute,
    props: { page: "settings" satisfies PageKey },
  },
  {
    path: "/pricing",
    component: ShellRoute,
    props: { page: "pricing" satisfies PageKey },
  },
  {
    path: "/gamification",
    component: ShellRoute,
    props: { page: "gamification" satisfies PageKey },
  },
  {
    path: "/account",
    component: ShellRoute,
    props: { page: "account" satisfies PageKey },
  },
  {
    path: "/infographics",
    component: ShellRoute,
    props: { page: "infographics" satisfies PageKey },
  },
  {
    path: "/legal",
    component: ShellRoute,
    props: { page: "legal" satisfies PageKey },
  },
  {
    path: "/viewer",
    component: ShellRoute,
    props: { page: "viewer" satisfies PageKey },
  },
  {
    path: routePatterns.starterApp,
    component: ShellRoute,
    props: { page: "starterApp" satisfies PageKey },
  },
  {
    path: "/",
    component: ShellRoute,
    props: { page: "dashboard" satisfies PageKey },
  },
  {
    component: ShellRoute,
    props: { page: "dashboard" satisfies PageKey },
  },
] satisfies RouteConfig[];
