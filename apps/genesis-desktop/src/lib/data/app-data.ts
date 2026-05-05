export type ProjectSummary = {
  id: string;
  title: string;
  synopsis: string;
  status: "Draft" | "In Review" | "Ready";
  lastEdited: string;
  pages: number;
  audience: string;
};

export type AssetSummary = {
  id: string;
  name: string;
  type: "Illustration" | "Character" | "Reference" | "Layout";
  status: "Generated" | "Curated" | "Queued";
  updatedAt: string;
  size: string;
};

export const demoProjects: ProjectSummary[] = [
  {
    id: "project-aurora",
    title: "Aurora Atlas",
    synopsis: "A premium storybook campaign that blends learning prompts with cinematic scene framing.",
    status: "Ready",
    lastEdited: "12 minutes ago",
    pages: 24,
    audience: "Ages 8-12",
  },
  {
    id: "project-midnight",
    title: "Midnight Workshop",
    synopsis: "A monochrome brand narrative with data-led pacing for a high-end annual report.",
    status: "In Review",
    lastEdited: "3 hours ago",
    pages: 18,
    audience: "Investor Relations",
  },
  {
    id: "project-garden",
    title: "Velvet Garden",
    synopsis: "A playful family colouring-book line with reusable character boards and export presets.",
    status: "Draft",
    lastEdited: "Yesterday",
    pages: 12,
    audience: "Family",
  },
];

export const demoAssets: AssetSummary[] = [
  {
    id: "asset-1",
    name: "Gen Hero Pose",
    type: "Character",
    status: "Generated",
    updatedAt: "8 minutes ago",
    size: "4.1 MB",
  },
  {
    id: "asset-2",
    name: "Studio Scene Board",
    type: "Layout",
    status: "Curated",
    updatedAt: "42 minutes ago",
    size: "2.8 MB",
  },
  {
    id: "asset-3",
    name: "Family Outline Ref",
    type: "Reference",
    status: "Queued",
    updatedAt: "Today",
    size: "1.2 MB",
  },
  {
    id: "asset-4",
    name: "Cover Spread V2",
    type: "Illustration",
    status: "Generated",
    updatedAt: "Yesterday",
    size: "6.7 MB",
  },
];

export const dashboardMetrics = [
  { label: "Active Projects", value: "12", caption: "3 ready for export" },
  { label: "Assets Synced", value: "184", caption: "Local cache healthy" },
  { label: "Mastra Runs", value: "28", caption: "Median 22ms tool latency" },
  { label: "Export Queue", value: "2", caption: "PDF and PNG bundles" },
];

export const dailyChallenges = [
  "Ship one polished scene to review.",
  "Refine voiceover pacing for a shared viewer.",
  "Approve the asset batch for the family outline set.",
];

export const exportFormats = [
  { name: "Print PDF", detail: "Press-ready A4 or US Letter bundle" },
  { name: "Web Viewer", detail: "Optimized page images for shared links" },
  { name: "Asset Pack", detail: "Layered PNG, SVG, and prompt manifest" },
];

export const legalDocuments = [
  {
    id: "privacy",
    title: "Privacy",
    summary: "How Genesis stores project metadata, exports, and local AI traces.",
  },
  {
    id: "terms",
    title: "Terms",
    summary: "Usage terms for collaborative publishing, exports, and local tooling.",
  },
  {
    id: "cookies",
    title: "Cookies",
    summary: "Desktop-safe note: the Tauri app persists preferences locally, not via browser cookies.",
  },
];
