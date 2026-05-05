<script lang="ts">
  import { goto } from "@mateothegreat/svelte5-router";
  import SparklesIcon from "@lucide/svelte/icons/sparkles";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
</script>

<section class="desktop-gate">
  <Card class="desktop-gate__card">
    <CardHeader class="gap-4">
      <div class="flex items-center gap-3">
        <div class="desktop-gate__mark">
          <SparklesIcon />
        </div>
        <div>
          <CardTitle class="font-[var(--font-heading)] text-3xl text-[var(--foreground)]">
            Welcome back to Genesis
          </CardTitle>
          <CardDescription class="mt-2 text-[var(--muted)]">
            Desktop auth entrypoint for returning creators and payment callbacks.
          </CardDescription>
        </div>
      </div>
    </CardHeader>
    <CardContent class="grid gap-5">
      <div class="grid gap-2">
        <Label for="email">Email</Label>
        <Input id="email" placeholder="team@genesis.local" />
      </div>
      <div class="grid gap-2">
        <Label for="password">Password</Label>
        <Input id="password" type="password" placeholder="••••••••" />
      </div>
      <div class="flex flex-wrap gap-3">
        <Button class="rounded-full px-5" onclick={() => goto("/")}>Continue to desktop</Button>
        <Button class="rounded-full px-5" variant="outline" onclick={() => goto("/pricing")}>
          View plans
        </Button>
      </div>
    </CardContent>
  </Card>
</section>
