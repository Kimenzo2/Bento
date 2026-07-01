import { registerWidget } from "./widget-registry.svelte";
import NotesWidget from "./NotesWidget.svelte";
import SessionWidget from "./SessionWidget.svelte";
import TimerWidget from "./TimerWidget.svelte";

export function loadBuiltinWidgets(): void {
  registerWidget({
    id: "notes",
    name: "Notes",
    description: "Markdown notes editor",
    icon: "file-text",
    ExpandedComponent: NotesWidget,
    defaultEnabled: true,
    category: "productivity",
    minWidth: 260,
    hasCompactMode: false,
  });

  registerWidget({
    id: "session",
    name: "Sessions",
    description: "Track work sessions",
    icon: "activity",
    ExpandedComponent: SessionWidget,
    defaultEnabled: false,
    category: "productivity",
    minWidth: 260,
    hasCompactMode: false,
  });

  registerWidget({
    id: "timer",
    name: "Timer",
    description: "Countdown timer with presets",
    icon: "timer",
    ExpandedComponent: TimerWidget,
    defaultEnabled: false,
    category: "productivity",
    minWidth: 260,
    hasCompactMode: false,
  });
}
