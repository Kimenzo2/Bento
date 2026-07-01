import type { Component } from "svelte";

export interface WidgetManifest {
  id: string;
  name: string;
  description: string;
  icon: string;
  ExpandedComponent: Component;
  CompactComponent?: Component;
  defaultEnabled: boolean;
  category: "productivity" | "media" | "utility";
  minWidth?: number;
  hasCompactMode: boolean;
  compactPriority?: number;
}

export interface WidgetEnabledState {
  [widgetId: string]: boolean;
}
