<!-- ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER. -->

<script lang="ts">
  import { cn } from "$lib/utils";
  import * as Code from "$lib/components/agent/code/index.js";

  interface ToolInputProps {
    class?: string;
    input: any;
    [key: string]: any;
  }

  let { class: className = "", input, ...restProps }: ToolInputProps = $props();

  let formattedInput = $derived.by(() => {
    return JSON.stringify(input, null, 2);
  });
</script>

<div class={cn("space-y-2 overflow-hidden p-4", className)} {...restProps}>
  <h4 class="text-muted-foreground text-xs font-medium tracking-wide uppercase">Parameters</h4>
  <div class="bg-muted/50 rounded-md">
    <Code.Root code={formattedInput} lang="json" hideLines>
      <Code.CopyButton />
    </Code.Root>
  </div>
</div>
