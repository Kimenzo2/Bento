<!-- ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER. -->

<script lang="ts">
  import ActivityIcon from "@lucide/svelte/icons/activity";
  import BookHeartIcon from "@lucide/svelte/icons/book-heart";
  import BotIcon from "@lucide/svelte/icons/bot";
  import BrainIcon from "@lucide/svelte/icons/brain";
  import CalendarDaysIcon from "@lucide/svelte/icons/calendar-days";
  import ClipboardListIcon from "@lucide/svelte/icons/clipboard-list";
  import Clock4Icon from "@lucide/svelte/icons/clock-4";
  import DropletsIcon from "@lucide/svelte/icons/droplets";
  import FileTextIcon from "@lucide/svelte/icons/file-text";
  import GaugeIcon from "@lucide/svelte/icons/gauge";
  import HourglassIcon from "@lucide/svelte/icons/hourglass";
  import LayoutDashboardIcon from "@lucide/svelte/icons/layout-dashboard";
  import LayoutGridIcon from "@lucide/svelte/icons/layout-grid";
  import LibraryIcon from "@lucide/svelte/icons/library";
  import MicIcon from "@lucide/svelte/icons/mic";
  import MoonIcon from "@lucide/svelte/icons/moon";
  import SettingsIcon from "@lucide/svelte/icons/settings";
  import ShieldCheckIcon from "@lucide/svelte/icons/shield-check";
  import ShoppingCartIcon from "@lucide/svelte/icons/shopping-cart";
  import SmilePlusIcon from "@lucide/svelte/icons/smile-plus";
  import TargetIcon from "@lucide/svelte/icons/target";
  import TimerIcon from "@lucide/svelte/icons/timer";
  import TrophyIcon from "@lucide/svelte/icons/trophy";
  import UtensilsCrossedIcon from "@lucide/svelte/icons/utensils-crossed";
  import WalletIcon from "@lucide/svelte/icons/wallet";
  import WindIcon from "@lucide/svelte/icons/wind";
  import type { AppLaunchIconName } from "$lib/data/module-catalog";

  let {
    name,
    size = 24,
    strokeWidth = 1.8,
    color,
  }: {
    name: AppLaunchIconName;
    size?: number;
    strokeWidth?: number;
    color?: string;
  } = $props();

  const iconMap = {
    activity: ActivityIcon,
    "book-heart": BookHeartIcon,
    bot: BotIcon,
    brain: BrainIcon,
    "calendar-days": CalendarDaysIcon,
    "clipboard-list": ClipboardListIcon,
    "clock-4": Clock4Icon,
    droplets: DropletsIcon,
    "file-text": FileTextIcon,
    gauge: GaugeIcon,
    hourglass: HourglassIcon,
    "layout-dashboard": LayoutDashboardIcon,
    "layout-grid": LayoutGridIcon,
    library: LibraryIcon,
    mic: MicIcon,
    moon: MoonIcon,
    settings: SettingsIcon,
    "shield-check": ShieldCheckIcon,
    "shopping-cart": ShoppingCartIcon,
    "smile-plus": SmilePlusIcon,
    target: TargetIcon,
    timer: TimerIcon,
    trophy: TrophyIcon,
    "utensils-crossed": UtensilsCrossedIcon,
    wallet: WalletIcon,
    wind: WindIcon,
  };

  const Icon = $derived(iconMap[name] ?? LayoutGridIcon);
</script>

<Icon {size} {strokeWidth} {color} aria-hidden="true" />
