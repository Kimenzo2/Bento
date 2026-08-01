<!-- ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER. -->

<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { fly, fade } from "svelte/transition";
  import { isTauri } from "@tauri-apps/api/core";
  import { listen } from "@tauri-apps/api/event";

  import KeyIcon from "@lucide/svelte/icons/key";
  import PlugIcon from "@lucide/svelte/icons/plug";
  import PlugZapIcon from "@lucide/svelte/icons/plug-zap";
  import UnplugIcon from "@lucide/svelte/icons/unplug";
  import Loader2Icon from "@lucide/svelte/icons/loader-2";
  import CheckCircle2Icon from "@lucide/svelte/icons/check-circle-2";
  import AlertCircleIcon from "@lucide/svelte/icons/alert-circle";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import SearchIcon from "@lucide/svelte/icons/search";
  import XIcon from "@lucide/svelte/icons/x";
  import CogIcon from "@lucide/svelte/icons/cog";
  import CheckIcon from "@lucide/svelte/icons/check";

  import {
    apps,
    categories,
    apiKeyStatus,
    selectedCategory,
    loading,
    error,
    connectedAppKeys,
    loadAll,
    loadApps,
    saveComposioApiKey,
    deleteComposioApiKey,
    testComposioConnection,
    connectApp,
    disconnectApp,
    cancelIntegrationFlow,
    listAppActions,
    executeAppAction,
    type IntegrationAppEntry,
    type IntegrationTool,
  } from "$lib/stores/integrations.store";

  import { createTranslator } from "$lib/i18n";
  import { activeBundle } from "$lib/i18n";

  let _t = $derived.by(() => createTranslator($activeBundle));

  let { surface = "panel" }: { surface?: "panel" | "page" } = $props();

  // ── Local state ──
  let selectedApp = $state<IntegrationAppEntry | null>(null);
  let modalConnecting = $state(false);
  let activeTab = $state<"browse" | "skills">("browse");
  let unlisteners: (() => void)[] = [];

  // ── Skills tab state ──
  let skillsSelectedApp = $state<string | null>(null);
  let skillsTools = $state<IntegrationTool[]>([]);
  let skillsLoadingTools = $state(false);
  let skillsRunningSlug = $state<string | null>(null);
  let skillsRunOutput = $state<string | null>(null);
  let skillsRunError = $state<string | null>(null);
  let skillsSearch = $state("");

  const connectedApps = $derived.by(() => {
    const set = $connectedAppKeys;
    return $apps.filter((a) => set.has(a.app.key));
  });

  const filteredSkillsTools = $derived.by(() => {
    if (!skillsSearch.trim()) return skillsTools;
    const q = skillsSearch.toLowerCase();
    return skillsTools.filter(
      (t) =>
        (t.name ?? "").toLowerCase().includes(q) ||
        (t.description ?? "").toLowerCase().includes(q) ||
        t.slug.toLowerCase().includes(q),
    );
  });

  const skillsToolNames = $derived.by(() => {
    const m = new Map<string, IntegrationTool>();
    for (const t of skillsTools) m.set(t.slug, t);
    return m;
  });

  // ── Skill input forms (args per tool, editable JSON) ──
  let skillsInputs = $state<Record<string, string>>({});

  async function handleSelectSkillsApp(appKey: string) {
    if (skillsSelectedApp === appKey) {
      skillsSelectedApp = null;
      skillsTools = [];
      return;
    }
    skillsSelectedApp = appKey;
    skillsLoadingTools = true;
    skillsRunOutput = null;
    skillsRunError = null;
    try {
      const tools = await listAppActions(appKey);
      skillsTools = tools;
      skillsInputs = Object.fromEntries(tools.map((t) => [t.slug, ""]));
    } catch (e) {
      error.set(typeof e === "string" ? e : `Failed to load tools for ${appKey}`);
    } finally {
      skillsLoadingTools = false;
    }
  }

  function formatToolName(name: string | null | undefined, slug: string): string {
    if (name && name.trim()) return name;
    return slug
      .toLowerCase()
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  async function handleRunSkill(slug: string) {
    if (!skillsSelectedApp) return;
    skillsRunningSlug = slug;
    skillsRunOutput = null;
    skillsRunError = null;
    let input: Record<string, unknown> = {};
    const raw = skillsInputs[slug]?.trim();
    if (raw) {
      try {
        input = JSON.parse(raw);
      } catch {
        skillsRunError = "Invalid JSON arguments. Use valid JSON like {\"key\": \"value\"}";
        skillsRunningSlug = null;
        return;
      }
    }
    try {
      const result = await executeAppAction(skillsSelectedApp, slug, input);
      skillsRunOutput = typeof result === "string" ? result : JSON.stringify(result, null, 2);
    } catch (e) {
      skillsRunError = typeof e === "string" ? e : String(e);
    } finally {
      skillsRunningSlug = null;
    }
  }

  // ── Developer Settings (collapsed by default) ──
  let devSettingsOpen = $state(false);
  let devKeyInput = $state("");
  let devSaving = $state(false);
  let devKeyError = $state<string | null>(null);
  let devKeySuccess = $state<string | null>(null);
  let devTesting = $state(false);
  let devTestResult = $state<boolean | null>(null);
  let devDeleteConfirm = $state(false);

  // ── Modal credential inputs ──
  let modalApiKey = $state("");
  let modalClientId = $state("");
  let modalClientSecret = $state("");
  let modalToken = $state("");
  let modalUsername = $state("");
  let modalPassword = $state("");
  let modalError = $state<string | null>(null);

  // ── Disconnect confirmation ──
  let disconnectConfirm = $state<string | null>(null);

  // ── Password visibility toggles ──
  let showApiKey = $state(false);
  let showClientSecret = $state(false);
  let showToken = $state(false);
  let showPassword = $state(false);

  // ── Auto-focus action ──
  function autofocus(node: HTMLElement) {
    node.focus();
  }

  // ── Cancel active flow ──
  async function handleCancelConnect() {
    await cancelIntegrationFlow();
    modalConnecting = false;
  }

  // ── Close modal (also cancels any in-flight OAuth flow) ──
  function closeModal() {
    if (modalConnecting) {
      cancelIntegrationFlow();
      modalConnecting = false;
    }
    selectedApp = null;
    disconnectConfirm = null;
  }

  // ── Debounced search ──
  let searchInput = $state("");
  let searchQuery = $state("");
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  function handleSearchInput() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => (searchQuery = searchInput), 200);
  }

  const connectedSet = $derived($connectedAppKeys);

  const filteredApps = $derived.by(() => {
    let list = $apps;
    const cat = $selectedCategory;
    if (cat) {
      list = list.filter((a) => {
        const catLower = a.app.category.toLowerCase();
        const selLower = cat.toLowerCase();
        return catLower === selLower || catLower.replace(/\s+/g, "") === selLower.replace(/\s+/g, "");
      });
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((a) => a.app.name.toLowerCase().includes(q) || a.app.description.toLowerCase().includes(q));
    }
    return list;
  });

  const groupedApps = $derived.by(() => {
    const groups = new Map<string, IntegrationAppEntry[]>();
    for (const entry of filteredApps) {
      const cat = entry.app.category;
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push(entry);
    }
    return groups;
  });

  const filterMatchCount = $derived(filteredApps.length);

  // Category id (lowercase) → human label, e.g. "calendar" → "Calendar & Time".
  const categoryLabelMap = $derived.by(() => {
    const m = new Map<string, string>();
    for (const c of $categories) m.set(c.id.toLowerCase(), c.label);
    return m;
  });

  onMount(async () => {
    await loadAll();
    if (isTauri()) {
      const u1 = await listen("integrations:connected", () => {
        selectedApp = null;
        modalConnecting = false;
        loadAll();
      });
      const u2 = await listen("integrations:error", (e: { payload: { message: string } }) => {
        modalConnecting = false;
        error.set(e.payload?.message ?? "Connection failed");
      });
      const u3 = await listen("integrations:flow-timeout", () => {
        modalConnecting = false;
        error.set("Connection timed out. Try again.");
      });
      unlisteners = [u1, u2, u3];
    }
  });

  onDestroy(() => unlisteners.forEach((fn) => fn()));

  function handleModalKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && selectedApp) {
      closeModal();
    }
  }

  async function handleDevSaveKey() {
    if (!devKeyInput.trim()) return;
    devSaving = true;
    devKeyError = null;
    devKeySuccess = null;
    try {
      await saveComposioApiKey(devKeyInput.trim());
      devKeySuccess = "API key saved";
      devKeyInput = "";
      setTimeout(() => (devKeySuccess = null), 3000);
    } catch (e) {
      devKeyError = typeof e === "string" ? e : "Failed to save key";
    } finally {
      devSaving = false;
    }
  }

  async function handleDevDeleteKey() {
    try {
      await deleteComposioApiKey();
      devDeleteConfirm = false;
      devKeySuccess = "API key removed";
      setTimeout(() => (devKeySuccess = null), 3000);
    } catch (e) {
      devKeyError = typeof e === "string" ? e : "Failed to remove key";
    }
  }

  async function handleDevTestKey() {
    devTesting = true;
    devTestResult = null;
    try {
      devTestResult = await testComposioConnection();
    } catch {
      devTestResult = false;
    } finally {
      devTesting = false;
    }
  }

  async function handleConnect(appKey: string, creds?: { apiKey?: string; clientId?: string; clientSecret?: string; token?: string; username?: string; password?: string }) {
    modalConnecting = true;
    modalError = null;
    try {
      await connectApp(appKey, creds);
      selectedApp = null;
    } catch (e) {
      modalError = typeof e === "string" ? e : "Connection failed";
    } finally {
      modalConnecting = false;
    }
  }

  function promptDisconnect(appKey: string) {
    disconnectConfirm = appKey;
  }

  async function handleConfirmDisconnect(appKey: string) {
    disconnectConfirm = null;
    try {
      await disconnectApp(appKey);
      selectedApp = null;
    } catch (e) {
      error.set(typeof e === "string" ? e : "Failed to disconnect");
    }
  }

  function cancelDisconnect() {
    disconnectConfirm = null;
  }

  function selectCategory(cat: string | null) {
    selectedCategory.set(cat);
    loadApps(cat);
  }

  function iconUrl(iconKey: string) {
    return `https://cdn.simpleicons.org/${iconKey}`;
  }

  function iconError(e: Event) {
    const img = e.target as HTMLImageElement;
    img.style.display = "none";
    if (img.nextElementSibling) {
      (img.nextElementSibling as HTMLElement).style.display = "flex";
    }
  }

  function authBadgeLabel(authType: string): string {
    switch (authType) {
      case "managed_oauth": return "OAuth";
      case "api_key": return "API";
      case "custom_oauth": return "Custom";
      case "mixed": return "OAuth+API";
      case "no_auth": return "Open";
      case "native": return "Local";
      case "unavailable": return "Unavailable";
      default: return "";
    }
  }

  function authBadgeClass(authType: string): string {
    switch (authType) {
      case "api_key": return "intg-auth-badge--api";
      case "custom_oauth": return "intg-auth-badge--custom";
      case "no_auth": return "intg-auth-badge--open";
      case "mixed": return "intg-auth-badge--mixed";
      case "native": return "intg-auth-badge--native";
      case "unavailable": return "intg-auth-badge--unavailable";
      default: return "";
    }
  }
</script>

<svelte:window onkeydown={handleModalKeydown} />

<div class="intg">
  <div class="intg-header">
    <h2 class="intg-title">Integrations</h2>
    <p class="intg-subtitle">Teach Cortana new tricks — plug in the tools you already use.</p>
  </div>

  <div class="intg-toolbar">
    <div class="intg-tabs">
      <button class="intg-tab" class:intg-tab--active={activeTab === "browse"} onclick={() => (activeTab = "browse")}>Browse</button>
      <button class="intg-tab" class:intg-tab--active={activeTab === "skills"} onclick={() => (activeTab = "skills")}>Skills</button>
    </div>
    <div class="intg-search">
      <SearchIcon size={14} />
      <input type="text" placeholder="Search integrations" bind:value={searchInput} oninput={handleSearchInput} />
    </div>
  </div>

  {#if $error}
    <div class="intg-alert intg-alert--error" transition:fade>
      <AlertCircleIcon size={14} />
      <span>{$error}</span>
      <button class="intg-alert-close" onclick={() => error.set(null)}><XIcon size={12} /></button>
    </div>
  {/if}

  {#if activeTab === "browse"}
    <!-- ── Category Chips ── -->
    <div class="intg-chips">
      <button class="intg-chip" class:intg-chip--active={$selectedCategory === null} onclick={() => selectCategory(null)}>All</button>
      {#each $categories as cat}
        <button class="intg-chip" class:intg-chip--active={$selectedCategory === cat.id} onclick={() => selectCategory(cat.id)}>
          {cat.label} <span class="intg-chip-count">{cat.count}</span>
        </button>
      {/each}
    </div>

    <!-- ── Apps Grid ── -->
    {#if $loading}
      <div class="intg-loading"><Loader2Icon size={20} class="intg-spin" /></div>
    {:else if filterMatchCount === 0 && searchQuery.trim()}
      <div class="intg-empty"><SearchIcon size={24} /><p>No integrations match "{searchQuery}"</p></div>
    {:else if groupedApps.size === 0}
      <div class="intg-empty"><PlugIcon size={24} /><p>No integrations found</p></div>
    {:else}
      {#each [...groupedApps.entries()] as [category, categoryApps]}
        <div class="intg-category">
          <h3 class="intg-category-label">{categoryLabelMap.get(category.toLowerCase()) ?? category}</h3>
          <div class="intg-grid">
            {#each categoryApps as entry (entry.app.key)}
              <button
                class="intg-app"
                class:intg-app--connected={connectedSet.has(entry.app.key)}
                class:intg-app--unavailable={entry.app.auth_type === "unavailable"}
                onclick={() => (selectedApp = entry)}
              >
                <div class="intg-app-icon-wrap">
                  <img
                    class="intg-app-icon"
                    src={iconUrl(entry.app.icon_key)}
                    alt={entry.app.name}
                    loading="lazy"
                    onerror={iconError}
                  />
                  <div class="intg-app-icon-fallback" style="display:none">{entry.app.name.charAt(0).toUpperCase()}</div>
                </div>
                <div class="intg-app-info">
                  <div class="intg-app-name">
                    {entry.app.name}
                    {#if connectedSet.has(entry.app.key)}<CheckCircle2Icon size={12} class="intg-verified" />{/if}
                  </div>
                  <div class="intg-app-desc">{entry.app.description}</div>
                  <div class="intg-app-row">
                    {#if authBadgeLabel(entry.app.auth_type)}
                      <span class="intg-auth-badge {authBadgeClass(entry.app.auth_type)}">{authBadgeLabel(entry.app.auth_type)}</span>
                    {/if}
                  </div>
                </div>
                <ChevronRightIcon size={16} class="intg-app-chevron" />
              </button>
            {/each}
          </div>
        </div>
      {/each}
    {/if}

    <!-- ── Developer Settings (collapsed) ── -->
    <div class="intg-dev">
      <button class="intg-dev-toggle" onclick={() => (devSettingsOpen = !devSettingsOpen)}>
        <CogIcon size={13} />
        <span>Developer Settings</span>
        <span class="intg-dev-chevron" class:open={devSettingsOpen}><ChevronDownIcon size={14} /></span>
      </button>

      {#if devSettingsOpen}
        <div class="intg-dev-body" transition:fly={{ y: -4, duration: 150 }}>
          <p class="intg-dev-hint">
            Composio API key is managed by the developer. Override below only if needed.
          </p>

          {#if $apiKeyStatus.has_key}
            <!-- Key is active -->
            <div class="intg-dev-row">
              <div class="intg-dev-label">
                <KeyIcon size={13} />
                <span>Active key</span>
                {#if $apiKeyStatus.key_preview}
                  <span class="intg-dev-preview">{$apiKeyStatus.key_preview}</span>
                {/if}
              </div>
              <div class="intg-dev-actions">
                <button class="intg-btn intg-btn--subtle" onclick={handleDevTestKey} disabled={devTesting}>
                  {#if devTesting}
                    <Loader2Icon size={11} class="intg-spin" />
                  {:else if devTestResult === true}
                    <CheckIcon size={11} />
                  {:else if devTestResult === false}
                    <AlertCircleIcon size={11} />
                  {/if}
                  Test
                </button>
                <button class="intg-btn intg-btn--subtle intg-btn--danger" onclick={() => (devDeleteConfirm = true)}>
                  Remove
                </button>
              </div>
            </div>

            {#if devTestResult !== null}
              <div class="intg-dev-status" class:intg-dev-status--ok={devTestResult} class:intg-dev-status--err={!devTestResult}>
                {devTestResult ? "Connection OK" : "Connection failed"}
              </div>
            {/if}

            {#if devDeleteConfirm}
              <div class="intg-dev-row" transition:fade>
                <span class="intg-dev-confirm-text">Remove the API key?</span>
                <div class="intg-dev-actions">
                  <button class="intg-btn intg-btn--subtle" onclick={() => (devDeleteConfirm = false)}>Cancel</button>
                  <button class="intg-btn intg-btn--subtle intg-btn--danger" onclick={handleDevDeleteKey}>Remove</button>
                </div>
              </div>
            {/if}
          {:else}
            <!-- No key — show input -->
            <div class="intg-dev-row">
              <input
                type="password"
                class="intg-dev-input"
                placeholder="Composio API key (starts with ak_)"
                bind:value={devKeyInput}
                use:autofocus
                onkeydown={(e) => e.key === "Enter" && handleDevSaveKey()}
              />
              <button class="intg-btn" onclick={handleDevSaveKey} disabled={devSaving || !devKeyInput.trim()}>
                {#if devSaving}<Loader2Icon size={11} class="intg-spin" />{/if}
                Save
              </button>
            </div>
          {/if}

          {#if devKeyError}
            <div class="intg-dev-status intg-dev-status--err" transition:fade={{ duration: 200 }}>{devKeyError}</div>
          {/if}
          {#if devKeySuccess}
            <div class="intg-dev-status intg-dev-status--ok" transition:fade={{ duration: 200 }}>{devKeySuccess}</div>
          {/if}
        </div>
      {/if}
    </div>
  {:else}
    <!-- ── Skills tab ── -->
    {#if connectedApps.length === 0}
      <div class="intg-empty">
        <PlugIcon size={24} />
        <p>No connected integrations yet. Connect an app in the Browse tab, then run its skills here.</p>
      </div>
    {:else}
      <div class="skills-layout">
        <div class="skills-sidebar">
          <h3 class="skills-sidebar-label">Connected apps</h3>
          <div class="skills-app-list">
            {#each connectedApps as entry (entry.app.key)}
              <button
                class="skills-app"
                class:skills-app--active={skillsSelectedApp === entry.app.key}
                onclick={() => handleSelectSkillsApp(entry.app.key)}
              >
                <img class="skills-app-icon" src={iconUrl(entry.app.icon_key)} alt={entry.app.name} loading="lazy" onerror={iconError} />
                <span class="skills-app-name">{entry.app.name}</span>
              </button>
            {/each}
          </div>
        </div>

        <div class="skills-main">
          {#if skillsLoadingTools}
            <div class="intg-loading"><Loader2Icon size={20} class="intg-spin" /></div>
          {:else if !skillsSelectedApp}
            <div class="intg-empty"><PlugZapIcon size={24} /><p>Select a connected app to see its skills.</p></div>
          {:else if skillsTools.length === 0}
            <div class="intg-empty"><CogIcon size={24} /><p>No curated skills available for this app.</p></div>
          {:else}
            <div class="skills-toolbar">
              <h3 class="skills-main-title">{formatToolName(skillsSelectedApp, skillsSelectedApp)} skills</h3>
              <div class="intg-search skills-search">
                <SearchIcon size={14} />
                <input type="text" placeholder="Search skills" bind:value={skillsSearch} />
              </div>
            </div>

            {#if skillsRunOutput !== null}
              <div class="skills-output">
                <div class="skills-output-head">
                  <span>Output</span>
                  <button class="skills-output-close" onclick={() => (skillsRunOutput = null)}><XIcon size={12} /></button>
                </div>
                <pre>{skillsRunOutput}</pre>
              </div>
            {/if}
            {#if skillsRunError}
              <div class="intg-alert intg-alert--error" transition:fade>
                <AlertCircleIcon size={14} />
                <span>{skillsRunError}</span>
                <button class="intg-alert-close" onclick={() => (skillsRunError = null)}><XIcon size={12} /></button>
              </div>
            {/if}

            <div class="skills-list">
              {#each filteredSkillsTools as tool (tool.slug)}
                <div class="skills-tool">
                  <div class="skills-tool-head">
                    <div class="skills-tool-title">
                      <span class="skills-tool-name">{formatToolName(tool.name, tool.slug)}</span>
                      <code class="skills-tool-slug">{tool.slug}</code>
                    </div>
                    <button
                      class="skills-run-btn"
                      disabled={skillsRunningSlug !== null}
                      onclick={() => handleRunSkill(tool.slug)}
                    >
                      {#if skillsRunningSlug === tool.slug}
                        <Loader2Icon size={12} class="intg-spin" /> Running...
                      {:else}
                        <PlugZapIcon size={12} /> Run
                      {/if}
                    </button>
                  </div>
                  {#if tool.description}
                    <p class="skills-tool-desc">{tool.description}</p>
                  {/if}
                  <div class="skills-tool-args">
                    <div class="skills-arg-wrap">
                      <input
                        class="skills-arg-input"
                        type="text"
                        placeholder={'Arguments (JSON) — e.g. {"subject": "Hi"}'}
                        bind:value={skillsInputs[tool.slug]}
                      />
                    </div>
                  </div>
                </div>
              {/each}
            </div>
            {#if filteredSkillsTools.length === 0}
              <div class="intg-empty"><SearchIcon size={24} /><p>No skills match "{skillsSearch}"</p></div>
            {/if}
          {/if}
        </div>
      </div>
    {/if}
  {/if}
</div>

<!-- ── App Detail Modal ── -->
{#if selectedApp}
  <div class="intg-modal-overlay" transition:fade={{ duration: 150 }} onclick={closeModal}>
    <button class="intg-modal-close" onclick={closeModal}><XIcon size={16} /></button>
    <div class="intg-modal" transition:fly={{ y: 8, duration: 200 }} onclick={(e) => e.stopPropagation()}>
      <div class="intg-modal-icon-wrap">
        <img
          class="intg-modal-icon"
          src={iconUrl(selectedApp.app.icon_key)}
          alt={selectedApp.app.name}
          onerror={iconError}
        />
        <div class="intg-modal-icon-fallback" style="display:none">{selectedApp.app.name.charAt(0).toUpperCase()}</div>
      </div>
      <h3 class="intg-modal-name">
        {selectedApp.app.name}
        {#if selectedApp.connected}<CheckCircle2Icon size={14} class="intg-verified" />{/if}
      </h3>
      {#if selectedApp.app.auth_type !== "unavailable" && selectedApp.app.auth_type !== "native"}
        <p class="intg-modal-byline">by Composio</p>
      {/if}
      <p class="intg-modal-desc">{selectedApp.app.description}</p>
      <div class="intg-modal-badges">
        <span class="intg-modal-badge"><PlugIcon size={12} /> {selectedApp.connected ? "Connected" : "Available"}</span>
        {#if selectedApp.app.auth_type === "unavailable"}
          <span class="intg-modal-badge intg-modal-badge--unavailable"><AlertCircleIcon size={12} /> Unavailable</span>
        {:else if selectedApp.app.auth_type === "native"}
          <span class="intg-modal-badge intg-modal-badge--native"><PlugIcon size={12} /> Runs Locally</span>
        {:else if selectedApp.app.auth_type === "managed_oauth"}
          <span class="intg-modal-badge"><KeyIcon size={12} /> OAuth</span>
        {:else if selectedApp.app.auth_type === "api_key"}
          <span class="intg-modal-badge intg-modal-badge--warn"><KeyIcon size={12} /> API Key Required</span>
        {:else if selectedApp.app.auth_type === "custom_oauth"}
          <span class="intg-modal-badge intg-modal-badge--warn"><KeyIcon size={12} /> Custom OAuth</span>
        {:else if selectedApp.app.auth_type === "mixed"}
          <span class="intg-modal-badge"><KeyIcon size={12} /> OAuth + API Key</span>
        {:else if selectedApp.app.auth_type === "no_auth"}
          <span class="intg-modal-badge intg-modal-badge--open"><KeyIcon size={12} /> No Auth Needed</span>
        {/if}
      </div>

      {#if selectedApp.connected}
        {#if disconnectConfirm === selectedApp.app.key}
          <div class="intg-modal-confirm">
            <p class="intg-modal-confirm-text">Disconnect {selectedApp.app.name}?</p>
            <div class="intg-modal-confirm-actions">
              <button class="intg-modal-action intg-modal-action--subtle" onclick={cancelDisconnect}>Cancel</button>
              <button class="intg-modal-action intg-modal-action--disconnect" onclick={() => handleConfirmDisconnect(selectedApp!.app.key)}>
                <UnplugIcon size={14} /> Disconnect
              </button>
            </div>
          </div>
        {:else}
          <button class="intg-modal-action intg-modal-action--disconnect" onclick={() => promptDisconnect(selectedApp!.app.key)}>
            <UnplugIcon size={14} /> Disconnect
          </button>
          <p class="intg-modal-note">You can reconnect at any time.</p>
        {/if}

      {:else if selectedApp.app.auth_type === "managed_oauth" || selectedApp.app.auth_type === "mixed"}
        {#if modalConnecting}
          <button class="intg-modal-action intg-modal-action--subtle" onclick={handleCancelConnect}>
            Cancel
          </button>
          <p class="intg-modal-note">Opening browser for authentication...</p>
        {:else}
          <button class="intg-modal-action intg-modal-action--connect" onclick={() => handleConnect(selectedApp!.app.key)}>
            <PlugZapIcon size={14} /> Connect
          </button>
          <p class="intg-modal-note">You'll sign in via Composio's secure auth page.</p>
        {/if}

      {:else if selectedApp.app.auth_type === "api_key"}
        <div class="intg-modal-field">
          <label class="intg-modal-label" for="modal-api-key">API Key</label>
          <div class="intg-modal-input-wrap">
            <input
              id="modal-api-key"
              class="intg-modal-input"
              type={showApiKey ? "text" : "password"}
              placeholder="Enter your API key"
              bind:value={modalApiKey}
              use:autofocus
              onkeydown={(e) => e.key === "Enter" && handleConnect(selectedApp!.app.key, { apiKey: modalApiKey })}
            />
            <button class="intg-modal-toggle" onclick={() => (showApiKey = !showApiKey)} aria-label={showApiKey ? "Hide" : "Show"}>
              <KeyIcon size={14} />
            </button>
          </div>
        </div>
        {#if modalError}<p class="intg-modal-error">{modalError}</p>{/if}
        <button class="intg-modal-action intg-modal-action--connect" onclick={() => handleConnect(selectedApp!.app.key, { apiKey: modalApiKey })} disabled={!modalApiKey || modalConnecting}>
          {#if modalConnecting}<Loader2Icon size={14} class="intg-spin" /> Saving...{:else}<PlugZapIcon size={14} /> Save & Connect{/if}
        </button>
        <p class="intg-modal-note">Your key is stored locally in your OS keyring.</p>

      {:else if selectedApp.app.auth_type === "custom_oauth"}
        <div class="intg-modal-field">
          <label class="intg-modal-label" for="modal-client-id">Client ID</label>
          <input
            id="modal-client-id"
            class="intg-modal-input"
            type="text"
            placeholder="OAuth client ID"
            bind:value={modalClientId}
            use:autofocus
            onkeydown={(e) => e.key === "Enter" && modalClientId && modalClientSecret && handleConnect(selectedApp!.app.key, { clientId: modalClientId, clientSecret: modalClientSecret })}
          />
        </div>
        <div class="intg-modal-field">
          <label class="intg-modal-label" for="modal-client-secret">Client Secret</label>
          <div class="intg-modal-input-wrap">
            <input
              id="modal-client-secret"
              class="intg-modal-input"
              type={showClientSecret ? "text" : "password"}
              placeholder="OAuth client secret"
              bind:value={modalClientSecret}
              onkeydown={(e) => e.key === "Enter" && modalClientId && modalClientSecret && handleConnect(selectedApp!.app.key, { clientId: modalClientId, clientSecret: modalClientSecret })}
            />
            <button class="intg-modal-toggle" onclick={() => (showClientSecret = !showClientSecret)} aria-label={showClientSecret ? "Hide" : "Show"}>
              <KeyIcon size={14} />
            </button>
          </div>
        </div>
        {#if modalError}<p class="intg-modal-error">{modalError}</p>{/if}
        <button class="intg-modal-action intg-modal-action--connect" onclick={() => handleConnect(selectedApp!.app.key, { clientId: modalClientId, clientSecret: modalClientSecret })} disabled={!modalClientId || !modalClientSecret || modalConnecting}>
          {#if modalConnecting}<Loader2Icon size={14} class="intg-spin" /> Saving...{:else}<PlugZapIcon size={14} /> Save & Connect{/if}
        </button>
        <p class="intg-modal-note">Register an OAuth app at {selectedApp.app.name}'s developer portal, then enter your credentials here.</p>

      {:else if selectedApp.app.auth_type === "no_auth"}
        <div class="intg-modal-notice">
          {selectedApp.app.name} uses a public API — no credentials needed.
        </div>
        <button class="intg-modal-action intg-modal-action--connect" onclick={() => handleConnect(selectedApp!.app.key)} disabled={modalConnecting}>
          {#if modalConnecting}<Loader2Icon size={14} class="intg-spin" />{/if} OK
        </button>

      {:else if selectedApp.app.auth_type === "native"}
        {#if selectedApp.app.native_flow === "api_key"}
          <div class="intg-modal-field">
            <label class="intg-modal-label" for="modal-api-key">API Key</label>
            <div class="intg-modal-input-wrap">
              <input
                id="modal-api-key"
                class="intg-modal-input"
                type={showApiKey ? "text" : "password"}
                placeholder="Enter your API key"
                bind:value={modalApiKey}
                use:autofocus
                onkeydown={(e) => e.key === "Enter" && handleConnect(selectedApp!.app.key, { apiKey: modalApiKey })}
              />
              <button class="intg-modal-toggle" onclick={() => (showApiKey = !showApiKey)} aria-label={showApiKey ? "Hide" : "Show"}>
                <KeyIcon size={14} />
              </button>
            </div>
          </div>
          {#if modalError}<p class="intg-modal-error">{modalError}</p>{/if}
          <button class="intg-modal-action intg-modal-action--connect" onclick={() => handleConnect(selectedApp!.app.key, { apiKey: modalApiKey })} disabled={!modalApiKey || modalConnecting}>
            {#if modalConnecting}<Loader2Icon size={14} class="intg-spin" /> Saving...{:else}<PlugZapIcon size={14} /> Save & Connect{/if}
          </button>
          <p class="intg-modal-note">Your key is stored locally in your OS keyring.</p>

        {:else if selectedApp.app.native_flow === "token"}
          <div class="intg-modal-field">
            <label class="intg-modal-label" for="modal-token">Access Token</label>
            <div class="intg-modal-input-wrap">
              <input
                id="modal-token"
                class="intg-modal-input"
                type={showToken ? "text" : "password"}
                placeholder="Paste your access token"
                bind:value={modalToken}
                use:autofocus
                onkeydown={(e) => e.key === "Enter" && handleConnect(selectedApp!.app.key, { token: modalToken })}
              />
              <button class="intg-modal-toggle" onclick={() => (showToken = !showToken)} aria-label={showToken ? "Hide" : "Show"}>
                <KeyIcon size={14} />
              </button>
            </div>
          </div>
          {#if modalError}<p class="intg-modal-error">{modalError}</p>{/if}
          <button class="intg-modal-action intg-modal-action--connect" onclick={() => handleConnect(selectedApp!.app.key, { token: modalToken })} disabled={!modalToken || modalConnecting}>
            {#if modalConnecting}<Loader2Icon size={14} class="intg-spin" /> Saving...{:else}<PlugZapIcon size={14} /> Save & Connect{/if}
          </button>
          <p class="intg-modal-note">Your token is stored locally in your OS keyring.</p>

        {:else if selectedApp.app.native_flow === "basic"}
          <div class="intg-modal-field">
            <label class="intg-modal-label" for="modal-username">Username / Account SID</label>
            <input
              id="modal-username"
              class="intg-modal-input"
              type="text"
              placeholder="e.g. ACxxxxxxxxxxxxxxxx"
              bind:value={modalUsername}
              use:autofocus
              onkeydown={(e) => e.key === "Enter" && modalUsername && modalPassword && handleConnect(selectedApp!.app.key, { username: modalUsername, password: modalPassword })}
            />
          </div>
          <div class="intg-modal-field">
            <label class="intg-modal-label" for="modal-password">Password / Auth Token</label>
            <div class="intg-modal-input-wrap">
              <input
                id="modal-password"
                class="intg-modal-input"
                type={showPassword ? "text" : "password"}
                placeholder="Auth token"
                bind:value={modalPassword}
                onkeydown={(e) => e.key === "Enter" && modalUsername && modalPassword && handleConnect(selectedApp!.app.key, { username: modalUsername, password: modalPassword })}
              />
              <button class="intg-modal-toggle" onclick={() => (showPassword = !showPassword)} aria-label={showPassword ? "Hide" : "Show"}>
                <KeyIcon size={14} />
              </button>
            </div>
          </div>
          {#if modalError}<p class="intg-modal-error">{modalError}</p>{/if}
          <button class="intg-modal-action intg-modal-action--connect" onclick={() => handleConnect(selectedApp!.app.key, { username: modalUsername, password: modalPassword })} disabled={!modalUsername || !modalPassword || modalConnecting}>
            {#if modalConnecting}<Loader2Icon size={14} class="intg-spin" /> Saving...{:else}<PlugZapIcon size={14} /> Save & Connect{/if}
          </button>
          <p class="intg-modal-note">Your credentials are stored locally in your OS keyring.</p>

        {:else}
          {#if modalConnecting}
            <button class="intg-modal-action intg-modal-action--subtle" onclick={handleCancelConnect}>
              Cancel
            </button>
            <p class="intg-modal-note">Opening browser for authentication...</p>
          {:else}
            <button class="intg-modal-action intg-modal-action--connect" onclick={() => handleConnect(selectedApp!.app.key)}>
              <PlugZapIcon size={14} /> Connect
            </button>
            <p class="intg-modal-note">You'll authorize {selectedApp.app.name} in your browser. Tokens stay on this device.</p>
          {/if}
        {/if}

      {:else if selectedApp.app.auth_type === "unavailable"}
        <div class="intg-modal-notice">
          {selectedApp.app.name} isn't available through Composio yet. We'll let you know when it arrives.
        </div>
      {:else}
        <button class="intg-modal-action intg-modal-action--connect" onclick={() => handleConnect(selectedApp!.app.key)} disabled={modalConnecting}>
          {#if modalConnecting}<Loader2Icon size={14} class="intg-spin" /> Connecting...{:else}<PlugZapIcon size={14} /> Connect{/if}
        </button>
        <p class="intg-modal-note">Connect via Composio's secure auth page.</p>
      {/if}
    </div>
  </div>
{/if}

<style>
  /* ═══════════════════════════════════════════════════════════════════
     INTEGRATIONS
     ═══════════════════════════════════════════════════════════════════ */

  /* ── Shared button/badge ── */
  .intg-btn {
    display:inline-flex; align-items:center; justify-content:center; gap:0.35rem;
    border:1px solid color-mix(in srgb, var(--foreground) 8%, transparent);
    border-radius:8px; font-family:inherit; font-weight:550; cursor:pointer;
    transition:all 0.12s ease; white-space:nowrap; background:transparent; color:var(--foreground);
    padding:0.4rem 0.75rem; font-size:0.78rem;
  }
  .intg-btn:hover:not(:disabled) { background:color-mix(in srgb, var(--foreground) 6%, transparent); }
  .intg-btn--subtle { border-color:transparent; background:transparent; color:var(--muted); }
  .intg-btn--subtle:hover:not(:disabled) { color:var(--foreground); background:color-mix(in srgb, var(--foreground) 6%, transparent); }
  .intg-btn--danger { color:var(--destructive); }
  .intg-btn--danger:hover:not(:disabled) { background:color-mix(in srgb, var(--destructive) 8%, transparent); }
  .intg-btn:disabled { opacity:0.4; cursor:not-allowed; }

  :global(.intg-spin) { animation:intg-spin 0.8s linear infinite; }
  @keyframes intg-spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }

  /* ── Layout ── */
  .intg { display:flex; flex-direction:column; gap:1.25rem; }
  .intg-header { margin-bottom:0.25rem; }
  .intg-title { font-size:1.5rem; font-weight:600; color:var(--foreground); margin:0; line-height:1.2; }
  .intg-subtitle { font-size:0.875rem; color:var(--muted); margin:0.25rem 0 0; }

  .intg-toolbar { display:flex; align-items:center; justify-content:space-between; gap:1rem; }
  .intg-tabs { display:flex; gap:2px; padding:3px; background:color-mix(in srgb, var(--foreground) 6%, var(--background)); border-radius:10px; }
  .intg-tab { padding:6px 16px; border-radius:8px; border:none; background:transparent; color:var(--muted); font-size:0.82rem; font-weight:500; cursor:pointer; transition:background 0.12s, color 0.12s; }
  .intg-tab--active { background:var(--background); color:var(--foreground); }
  .intg-search { display:flex; align-items:center; gap:8px; padding:7px 14px; border-radius:10px; border:1px solid color-mix(in srgb, var(--foreground) 10%, transparent); background:transparent; color:var(--muted); min-width:220px; transition:border-color 0.12s; }
  .intg-search:focus-within { border-color:color-mix(in srgb, var(--primary) 40%, transparent); }
  .intg-search input { border:none; background:none; outline:none; color:var(--foreground); font-size:0.82rem; flex:1; min-width:0; }
  .intg-search input::placeholder { color:var(--muted); }

  /* ── Alerts ── */
  .intg-alert { display:flex; align-items:center; gap:8px; padding:8px 12px; border-radius:10px; font-size:0.82rem; }
  .intg-alert--error { background:color-mix(in srgb, var(--destructive) 10%, transparent); color:var(--destructive); }
  .intg-alert-close { margin-left:auto; background:none; border:none; cursor:pointer; color:inherit; padding:2px; display:flex; border-radius:4px; }
  .intg-alert-close:hover { background:color-mix(in srgb, currentColor 10%, transparent); }

  /* ── Category Chips ── */
  .intg-chips { display:flex; flex-wrap:wrap; gap:6px; }
  .intg-chip { display:inline-flex; align-items:center; gap:4px; padding:5px 12px; border-radius:999px; border:1px solid color-mix(in srgb, var(--foreground) 10%, transparent); background:transparent; color:var(--muted); font-size:0.78rem; font-weight:500; cursor:pointer; white-space:nowrap; transition:background 0.12s, color 0.12s, border-color 0.12s; }
  .intg-chip:hover { background:color-mix(in srgb, var(--foreground) 6%, var(--background)); }
  .intg-chip--active { background:var(--foreground); color:var(--background); border-color:var(--foreground); }
  .intg-chip--active:hover { opacity:0.9; }
  .intg-chip-count { opacity:0.5; font-size:0.72rem; }

  /* ── Loading / Empty ── */
  .intg-loading, .intg-empty { display:flex; flex-direction:column; align-items:center; gap:8px; padding:48px 24px; color:var(--muted); }
  .intg-empty p { font-size:0.875rem; margin:0; }

  /* ── Category ── */
  .intg-category { margin-bottom:0.5rem; }
  .intg-category-label { font-size:0.82rem; font-weight:600; color:var(--muted); margin:0 0 0.75rem; padding-left:2px; }

  /* ── Two-Column Grid ── */
  .intg-grid { display:grid; grid-template-columns:repeat(2, 1fr); gap:8px; }

  /* ═══════════════════════════════════════════════════════════════════
     APP CARD — NO border. Background contrast only.
     ═══════════════════════════════════════════════════════════════════ */
  .intg-app {
    display:flex; align-items:center; gap:12px; padding:14px;
    border-radius:12px; border:none; background:transparent;
    cursor:pointer; transition:background 0.12s; text-align:left;
    width:100%; color:var(--foreground);
  }
  .intg-app:hover { background:color-mix(in srgb, var(--foreground) 6%, var(--background)); }
  .intg-app--connected { background:color-mix(in srgb, var(--primary) 6%, var(--background)); }
  .intg-app--connected:hover { background:color-mix(in srgb, var(--primary) 10%, var(--background)); }
  .intg-app-icon-wrap { position:relative; width:40px; height:40px; flex-shrink:0; }
  .intg-app-icon { width:40px; height:40px; border-radius:10px; object-fit:contain; outline:1px solid color-mix(in srgb, var(--foreground) 8%, transparent); outline-offset:-1px; }
  .intg-app-icon-fallback {
    position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
    border-radius:10px; background:color-mix(in srgb, var(--foreground) 8%, var(--background));
    font-size:1rem; font-weight:700; color:var(--muted); outline:1px solid color-mix(in srgb, var(--foreground) 8%, transparent);
  }
  .intg-app-info { flex:1; min-width:0; }
  .intg-app-name { display:flex; align-items:center; gap:4px; font-size:0.875rem; font-weight:600; color:var(--foreground); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .intg-app-desc { font-size:0.75rem; color:var(--muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:1px; }
  .intg-app-row { display:flex; align-items:center; gap:4px; margin-top:3px; }
  .intg-app-chevron { flex-shrink:0; color:var(--muted); opacity:0; transition:opacity 0.12s; }
  .intg-app:hover .intg-app-chevron { opacity:1; }
  :global(.intg-verified) { color:var(--primary); flex-shrink:0; }
  .intg-auth-badge {
    font-size:9px; font-weight:600; letter-spacing:0.03em;
    padding:1px 5px; border-radius:4px;
    flex-shrink:0;
  }
  .intg-auth-badge--api { background:color-mix(in srgb, var(--muted) 12%, var(--background)); color:var(--muted); }
  .intg-auth-badge--custom { background:color-mix(in srgb, #f59e0b 12%, var(--background)); color:#f59e0b; }
  .intg-auth-badge--open { background:color-mix(in srgb, var(--primary) 12%, var(--background)); color:var(--primary); }
  .intg-auth-badge--mixed { background:color-mix(in srgb, var(--foreground) 6%, var(--background)); color:var(--muted); }
  .intg-auth-badge--native { background:color-mix(in srgb, #22c55e 12%, var(--background)); color:#22c55e; }
  .intg-auth-badge--unavailable { background:color-mix(in srgb, var(--destructive) 10%, var(--background)); color:var(--destructive); }

  /* ═══════════════════════════════════════════════════════════════════
     DEVELOPER SETTINGS — collapsed section at bottom
     ═══════════════════════════════════════════════════════════════════ */
  .intg-dev { border-top:1px solid color-mix(in srgb, var(--foreground) 6%, transparent); padding-top:0.75rem; }
  .intg-dev-toggle {
    display:flex; align-items:center; gap:6px; padding:6px 10px; border-radius:8px;
    border:none; background:transparent; color:var(--muted); font-size:0.78rem;
    cursor:pointer; transition:background 0.12s, color 0.12s; width:100%; text-align:left;
  }
  .intg-dev-toggle:hover { background:color-mix(in srgb, var(--foreground) 5%, var(--background)); color:var(--foreground); }
  .intg-dev-toggle span { flex:1; }
  .intg-dev-chevron { display:inline-flex; transition:transform 0.15s ease; }
  .intg-dev-chevron.open { transform:rotate(180deg); }

  .intg-dev-body { padding:0.75rem 10px 0; display:flex; flex-direction:column; gap:0.5rem; }
  .intg-dev-hint { font-size:0.72rem; color:var(--muted); margin:0; line-height:1.4; }

  .intg-dev-row { display:flex; align-items:center; gap:0.5rem; }
  .intg-dev-label { display:flex; align-items:center; gap:6px; font-size:0.78rem; color:var(--muted); flex:1; min-width:0; }
  .intg-dev-label svg { flex-shrink:0; }
  .intg-dev-preview { font-family:monospace; font-size:0.72rem; color:color-mix(in srgb, var(--foreground) 40%, var(--background)); }
  .intg-dev-actions { display:flex; gap:4px; flex-shrink:0; }

  .intg-dev-input {
    flex:1; border:1px solid color-mix(in srgb, var(--foreground) 10%, transparent);
    border-radius:8px; background:transparent; padding:0.4rem 0.65rem;
    color:var(--foreground); font-size:0.78rem; outline:none;
  }
  .intg-dev-input:focus { border-color:color-mix(in srgb, var(--primary) 40%, transparent); }
  .intg-dev-input::placeholder { color:var(--muted); }

  .intg-dev-status { font-size:0.72rem; padding:4px 8px; border-radius:6px; }
  .intg-dev-status--ok { color:var(--primary); background:color-mix(in srgb, var(--primary) 8%, transparent); }
  .intg-dev-status--err { color:var(--destructive); background:color-mix(in srgb, var(--destructive) 8%, transparent); }
  .intg-dev-confirm-text { font-size:0.78rem; color:var(--muted); flex:1; }

  /* ── Modal ── */
  .intg-modal-overlay { position:fixed; inset:0; z-index:9999; display:flex; align-items:center; justify-content:center; background:color-mix(in srgb, var(--background) 60%, transparent); backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); }
  .intg-modal-close { position:fixed; top:20px; right:20px; z-index:10000; width:32px; height:32px; display:flex; align-items:center; justify-content:center; border-radius:8px; border:1px solid color-mix(in srgb, var(--foreground) 10%, transparent); background:color-mix(in srgb, var(--foreground) 6%, var(--background)); color:var(--muted); cursor:pointer; transition:background 0.12s, color 0.12s; }
  .intg-modal-close:hover { background:var(--background); color:var(--foreground); }
  .intg-modal { position:relative; width:360px; max-width:90vw; padding:32px 28px 24px; border-radius:18px; background:color-mix(in srgb, var(--foreground) 4%, var(--background)); display:flex; flex-direction:column; align-items:center; text-align:center; gap:8px; }
  .intg-modal-icon-wrap { position:relative; width:64px; height:64px; margin-bottom:4px; }
  .intg-modal-icon { width:64px; height:64px; border-radius:14px; object-fit:contain; outline:1px solid color-mix(in srgb, var(--foreground) 8%, transparent); outline-offset:-1px; }
  .intg-modal-icon-fallback {
    position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
    border-radius:14px; background:color-mix(in srgb, var(--foreground) 8%, var(--background));
    font-size:1.5rem; font-weight:700; color:var(--muted); outline:1px solid color-mix(in srgb, var(--foreground) 8%, transparent);
  }
  .intg-modal-name { font-size:1.125rem; font-weight:600; color:var(--foreground); margin:0; display:flex; align-items:center; gap:6px; }
  .intg-modal-byline { font-size:0.78rem; color:var(--muted); margin:0; }
  .intg-modal-desc { font-size:0.82rem; color:var(--muted); margin:8px 0 0; line-height:1.5; max-width:300px; }
  .intg-modal-badges { display:flex; gap:8px; margin:12px 0; flex-wrap:wrap; }
  .intg-modal-badge { display:inline-flex; align-items:center; gap:4px; padding:4px 10px; border-radius:999px; font-size:0.72rem; font-weight:500; background:color-mix(in srgb, var(--foreground) 6%, var(--background)); color:var(--muted); }
  .intg-modal-badge--warn { background:color-mix(in srgb, var(--destructive) 12%, var(--background)); color:var(--destructive); }
  .intg-modal-badge--open { background:color-mix(in srgb, var(--primary) 12%, var(--background)); color:var(--primary); }
  .intg-modal-badge--native { background:color-mix(in srgb, #22c55e 12%, var(--background)); color:#22c55e; }
  .intg-modal-badge--unavailable { background:color-mix(in srgb, var(--destructive) 12%, var(--background)); color:var(--destructive); }
  .intg-modal-notice { margin-top:12px; padding:10px 12px; border-radius:8px; font-size:0.78rem; line-height:1.5; background:color-mix(in srgb, var(--muted) 10%, var(--background)); color:var(--muted); }
  .intg-modal-field { margin-top:10px; }
  .intg-modal-label { display:block; font-size:0.72rem; font-weight:600; color:var(--muted); margin-bottom:4px; }
  .intg-modal-input-wrap { display:flex; align-items:center; border-radius:8px; border:1px solid color-mix(in srgb, var(--foreground) 10%, var(--background)); background:var(--background); transition:border-color 0.12s; }
  .intg-modal-input-wrap:focus-within { border-color:var(--primary); }
  .intg-modal-input {
    flex:1; padding:8px 10px; border:none; background:transparent; color:var(--foreground);
    font-size:0.82rem; font-family:inherit; outline:none; min-width:0;
  }
  .intg-modal-input::placeholder { color:var(--muted); opacity:0.5; }
  .intg-modal-toggle {
    display:flex; align-items:center; justify-content:center; width:30px; height:30px; margin-right:4px;
    border:none; border-radius:6px; background:transparent; color:var(--muted); cursor:pointer; flex-shrink:0;
    transition:color 0.12s, background 0.12s;
  }
  .intg-modal-toggle:hover { color:var(--foreground); background:color-mix(in srgb, var(--foreground) 6%, transparent); }
  .intg-modal-error { margin-top:8px; font-size:0.75rem; color:var(--destructive); }
  .intg-modal-action { display:flex; align-items:center; justify-content:center; gap:8px; padding:12px; border-radius:12px; border:none; font-size:0.875rem; font-weight:600; cursor:pointer; transition:opacity 0.12s; margin-top:8px; }
  .intg-modal-action--connect { width:100%; background:var(--foreground); color:var(--background); }
  .intg-modal-action--connect:hover { opacity:0.9; }
  .intg-modal-action--disconnect { background:color-mix(in srgb, var(--destructive) 12%, transparent); color:var(--destructive); }
  .intg-modal-action--disconnect:hover { background:color-mix(in srgb, var(--destructive) 18%, transparent); }
  .intg-modal-action--subtle { background:transparent; color:var(--muted); border:1px solid color-mix(in srgb, var(--foreground) 10%, transparent); flex:1; }
  .intg-modal-action--subtle:hover { background:color-mix(in srgb, var(--foreground) 6%, transparent); }
  .intg-modal-confirm { width:100%; margin-top:8px; }
  .intg-modal-confirm-text { font-size:0.82rem; color:var(--foreground); margin:0 0 12px; text-align:center; }
  .intg-modal-confirm-actions { display:flex; gap:8px; }
  .intg-modal-note { font-size:0.72rem; color:var(--muted); margin:8px 0 0; }

  /* ═══════════════════════════════════════════════════════════════════
     SKILLS TAB
     ═══════════════════════════════════════════════════════════════════ */
  .skills-layout { display:flex; gap:1.25rem; align-items:flex-start; }
  .skills-sidebar { width:220px; flex-shrink:0; display:flex; flex-direction:column; gap:0.5rem; }
  .skills-sidebar-label { font-size:0.72rem; font-weight:600; color:var(--muted); margin:0; text-transform:uppercase; letter-spacing:0.04em; }
  .skills-app-list { display:flex; flex-direction:column; gap:2px; }
  .skills-app {
    display:flex; align-items:center; gap:10px; padding:8px 10px;
    border:none; border-radius:10px; background:transparent; cursor:pointer;
    color:var(--foreground); text-align:left; transition:background 0.12s;
    font-family:inherit; font-size:0.82rem;
  }
  .skills-app:hover { background:color-mix(in srgb, var(--foreground) 6%, var(--background)); }
  .skills-app--active { background:color-mix(in srgb, var(--primary) 10%, var(--background)); }
  .skills-app-icon { width:24px; height:24px; border-radius:6px; object-fit:contain; flex-shrink:0; }
  .skills-app-name { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

  .skills-main { flex:1; min-width:0; display:flex; flex-direction:column; gap:0.75rem; }
  .skills-toolbar { display:flex; align-items:center; justify-content:space-between; gap:1rem; }
  .skills-main-title { font-size:0.95rem; font-weight:600; color:var(--foreground); margin:0; }
  .skills-search { min-width:200px; }

  .skills-list { display:flex; flex-direction:column; gap:0.5rem; }
  .skills-tool {
    display:flex; flex-direction:column; gap:0.4rem;
    padding:12px 14px; border-radius:12px;
    background:color-mix(in srgb, var(--foreground) 4%, var(--background));
  }
  .skills-tool-head { display:flex; align-items:center; justify-content:space-between; gap:1rem; }
  .skills-tool-title { display:flex; flex-direction:column; gap:2px; min-width:0; }
  .skills-tool-name { font-size:0.85rem; font-weight:600; color:var(--foreground); }
  .skills-tool-slug { font-size:0.7rem; color:var(--muted); font-family:ui-monospace, monospace; }
  .skills-tool-desc { font-size:0.78rem; color:var(--muted); margin:0; line-height:1.45; }
  .skills-run-btn {
    display:inline-flex; align-items:center; gap:6px; flex-shrink:0;
    padding:6px 12px; border:none; border-radius:8px; cursor:pointer;
    background:var(--foreground); color:var(--background);
    font-family:inherit; font-size:0.78rem; font-weight:600;
    transition:opacity 0.12s;
  }
  .skills-run-btn:hover:not(:disabled) { opacity:0.9; }
  .skills-run-btn:disabled { opacity:0.4; cursor:not-allowed; }
  .skills-tool-args { display:flex; }
  .skills-arg-wrap { flex:1; display:flex; border-radius:8px; border:1px solid color-mix(in srgb, var(--foreground) 10%, var(--background)); background:var(--background); transition:border-color 0.12s; }
  .skills-arg-wrap:focus-within { border-color:color-mix(in srgb, var(--primary) 40%, transparent); }
  .skills-arg-input {
    flex:1; padding:7px 10px; border:none; background:transparent; outline:none;
    color:var(--foreground); font-size:0.76rem; font-family:ui-monospace, monospace;
  }
  .skills-arg-input::placeholder { color:var(--muted); opacity:0.6; font-family:inherit; }

  .skills-output {
    border:1px solid color-mix(in srgb, var(--primary) 25%, transparent);
    border-radius:10px; background:color-mix(in srgb, var(--primary) 5%, var(--background));
    overflow:hidden;
  }
  .skills-output-head {
    display:flex; align-items:center; justify-content:space-between;
    padding:6px 10px; font-size:0.7rem; font-weight:600; color:var(--primary);
    background:color-mix(in srgb, var(--primary) 8%, transparent);
  }
  .skills-output-close {
    border:none; background:transparent; color:var(--primary); cursor:pointer;
    display:flex; padding:2px; border-radius:4px;
  }
  .skills-output-close:hover { background:color-mix(in srgb, var(--primary) 15%, transparent); }
  .skills-output pre {
    margin:0; padding:10px 12px; max-height:220px; overflow:auto;
    font-size:0.72rem; font-family:ui-monospace, monospace; color:var(--foreground);
    white-space:pre-wrap; word-break:break-word;
  }

  @media (max-width: 768px) {
    .skills-layout { flex-direction:column; }
    .skills-sidebar { width:100%; }
    .skills-toolbar { flex-direction:column; align-items:stretch; }
  }

  @media (max-width: 640px) {
    .intg-grid { grid-template-columns:1fr; }
    .intg-toolbar { flex-direction:column; align-items:stretch; }
    .intg-search { min-width:0; }
  }
</style>
