<!-- ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER. -->

<script lang="ts">
  import Card from "$lib/components/ui/card/card.svelte";
  import CardHeader from "$lib/components/ui/card/card-header.svelte";
  import CardTitle from "$lib/components/ui/card/card-title.svelte";
  import CardDescription from "$lib/components/ui/card/card-description.svelte";
  import CardContent from "$lib/components/ui/card/card-content.svelte";

  let {
    title,
    description,
    content,
    icon,
  }: {
    title: string;
    description?: string;
    content?: string;
    icon?: string;
  } = $props();
</script>

<Card size="sm">
  <CardHeader>
    <CardTitle>
      {#if icon}{icon} {/if}{title}
    </CardTitle>
    {#if description}
      <CardDescription>{description}</CardDescription>
    {/if}
  </CardHeader>
  {#if content}
    <CardContent>
      <p class="text-muted-foreground text-sm">{content}</p>
    </CardContent>
  {/if}
</Card>
