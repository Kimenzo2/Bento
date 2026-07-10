import { registerWidget } from "./widget-registry.svelte";
import NotesWidget from "./NotesWidget.svelte";
import SessionWidget from "./SessionWidget.svelte";
import TimerWidget from "./TimerWidget.svelte";
import MediaPlayerWidget from "./MediaPlayerWidget.svelte";
import TaskWidget from "./TaskWidget.svelte";

export function loadBuiltinWidgets(): void {
  registerWidget({
    id: "tasks",
    name: "Tasks",
    description: "Today's pending tasks",
    icon: "clipboard-list",
    ExpandedComponent: TaskWidget,
    defaultEnabled: true,
    category: "productivity",
    minWidth: 260,
    hasCompactMode: false,
  });

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

  registerWidget({
    id: "media-player",
    name: "Media",
    description: "Now playing media controls",
    icon: "activity",
    ExpandedComponent: MediaPlayerWidget,
    defaultEnabled: true,
    category: "media",
    minWidth: 260,
    hasCompactMode: false,
  });
}
