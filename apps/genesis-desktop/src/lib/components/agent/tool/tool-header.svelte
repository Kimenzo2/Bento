<!-- ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER. -->

<script lang="ts">
  import { CollapsibleTrigger } from "$lib/components/ui/collapsible/index.js";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { cn } from "$lib/utils";

  import CheckCircleIcon from "@lucide/svelte/icons/check-circle";
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import CircleIcon from "@lucide/svelte/icons/circle";
  import ClockIcon from "@lucide/svelte/icons/clock";
  import WrenchIcon from "@lucide/svelte/icons/wrench";
  import XCircleIcon from "@lucide/svelte/icons/x-circle";

  type ToolUIPartType = string;
  type ToolUIPartState =
    | "input-streaming"
    | "input-available"
    | "output-available"
    | "output-error";

  interface ToolHeaderProps {
    type: ToolUIPartType;
    state: ToolUIPartState;
    class?: string;
    [key: string]: any;
  }

  let { type, state, class: className = "", ...restProps }: ToolHeaderProps = $props();

  let getStatusBadge = $derived.by(() => {
    let labels = {
      "input-streaming": "Pending",
      "input-available": "Running",
      "output-available": "Completed",
      "output-error": "Error",
    } as const;

    let icons = {
      "input-streaming": CircleIcon,
      "input-available": ClockIcon,
      "output-available": CheckCircleIcon,
      "output-error": XCircleIcon,
    } as const;

    let IconComponent = icons[state];
    let label = labels[state];

    return { IconComponent, label };
  });
  let IconComponent = $derived(getStatusBadge.IconComponent);
</script>

<CollapsibleTrigger
  class={cn("flex w-full items-center justify-between gap-4 p-3", className)}
  {...restProps}
>
  <div class="flex items-center gap-2">
    <WrenchIcon class="text-muted-foreground size-4" />
    <span class="text-sm font-medium">{type}</span>
    <Badge class="gap-1.5 rounded-full text-xs" variant={state === "output-error" ? "destructive" : "secondary"}>
      <IconComponent
        class={cn(
          "size-4",
          state === "input-available" && "animate-pulse",
          state === "output-available" && "text-green-600 dark:text-green-400",
          state === "output-error" && "text-red-600 dark:text-red-400"
        )}
      />
      {getStatusBadge.label}
    </Badge>
  </div>
  <ChevronDownIcon
    class="text-muted-foreground size-4 transition-transform group-data-[state=open]:rotate-180"
  />
</CollapsibleTrigger>
