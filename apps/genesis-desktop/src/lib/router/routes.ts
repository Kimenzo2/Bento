import type { RouteConfig } from "@mateothegreat/svelte5-router";
import ShellRoute from "$lib/components/ShellRoute.svelte";
import AuthPage from "../../routes/pages/AuthPage.svelte";
import PaymentCallbackPage from "../../routes/pages/PaymentCallbackPage.svelte";
import SharedViewerPage from "../../routes/pages/SharedViewerPage.svelte";
import { routePatterns } from "$lib/router/route-patterns";
import NotesPage from "../../routes/pages/NotesPage.svelte";

export const pageMeta = {
  dashboard: {
    title: "Dashboard",
    subtitle: "Recent work, quick actions, and local orchestration health.",
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
    subtitle: "Theme, language, update, shell, and local-preference controls.",
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
    subtitle: "Focused offline-first personal tools inside the desktop shell.",
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
    component: NotesPage,
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
