import type { RouteConfig } from "@mateothegreat/svelte5-router";
import ShellRoute from "$lib/components/ShellRoute.svelte";
import AuthPage from "../../routes/pages/AuthPage.svelte";
import PaymentCallbackPage from "../../routes/pages/PaymentCallbackPage.svelte";
import SharedViewerPage from "../../routes/pages/SharedViewerPage.svelte";

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
  editor: {
    title: "Canvas Editor",
    subtitle: "Compose pages, chapters, and direction without leaving the desktop shell.",
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
    path: "/shared/:shortCode",
    component: SharedViewerPage,
  },
  {
    path: "/",
    component: ShellRoute,
    props: { page: "dashboard" satisfies PageKey },
  },
  {
    path: "/create",
    component: ShellRoute,
    props: { page: "project" satisfies PageKey },
  },
  {
    path: "/project/:projectId",
    component: ShellRoute,
    props: { page: "project" satisfies PageKey },
  },
  {
    path: "/life-in-colour",
    component: ShellRoute,
    props: { page: "lifeInColour" satisfies PageKey },
  },
  {
    path: "/editor",
    component: ShellRoute,
    props: { page: "editor" satisfies PageKey },
  },
  {
    path: "/visual-studio",
    component: ShellRoute,
    props: { page: "visualStudio" satisfies PageKey },
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
    component: ShellRoute,
    props: { page: "dashboard" satisfies PageKey },
  },
] satisfies RouteConfig[];
