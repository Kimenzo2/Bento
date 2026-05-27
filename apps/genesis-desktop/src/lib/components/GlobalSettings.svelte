<script lang="ts">
  import { onMount } from "svelte";
  import { fade, fly } from "svelte/transition";
  import { goto } from "@mateothegreat/svelte5-router";
  import BellIcon from "@lucide/svelte/icons/bell";
  import CheckIcon from "@lucide/svelte/icons/check";
  import CommandIcon from "@lucide/svelte/icons/command";
  import EyeIcon from "@lucide/svelte/icons/eye";
  import GlobeIcon from "@lucide/svelte/icons/globe";
  import Grid2x2Icon from "@lucide/svelte/icons/grid-2x2";
  import InfoIcon from "@lucide/svelte/icons/info";
  import KeyboardIcon from "@lucide/svelte/icons/keyboard";
  import MessageSquarePlusIcon from "@lucide/svelte/icons/message-square-plus";
  import MonitorCogIcon from "@lucide/svelte/icons/monitor-cog";
  import PaintbrushIcon from "@lucide/svelte/icons/paintbrush";
  import ShieldIcon from "@lucide/svelte/icons/shield";
  import SmartphoneIcon from "@lucide/svelte/icons/smartphone";
  import TypeIcon from "@lucide/svelte/icons/type";
  import UserIcon from "@lucide/svelte/icons/user";
  import XIcon from "@lucide/svelte/icons/x";

  import { desktopSettings, updateDesktopSettings } from "$lib/desktop/settings";
  import { openExternal } from "$lib/desktop/open-external";
  import { activeModule, modules, switchModule } from "$lib/desktop/modules";
  import { fetchModuleRegistry, type ModuleRegistryEntry } from "$lib/desktop/installer";
  import { billingProfile } from "$lib/stores/billing.store";
  import { availableThemes, setMode, setTheme } from "$lib/stores/theme.store";
  import { authStore, setAuthLoginRequired } from "$lib/stores/auth.store";
  import { clearBillingProfile } from "$lib/stores/billing.store";
  import { fontStore, setFontPairing } from "$lib/stores/font.store";
  import { languageStore, setLanguage } from "$lib/stores/language.store";
  import { activeBundle, createTranslator, INTERFACE_LANGUAGES, DATE_FORMATS, TIME_FORMATS, FIRST_DAY_OPTIONS } from "$lib/i18n";
  import { toast } from "svelte-sonner";
  import { invoke } from "@tauri-apps/api/core";
  import { browser } from "$app/environment";  import { needsSetup,
    setupMasterPassword,
    changeMasterPassword,
    lockDatabase,
    createBackup,
    validatePassword,
  } from "$lib/stores/crypto.store";

  import ByokSettings from "$lib/components/settings/ByokSettings.svelte";
  import FeedbackPage from "$lib/components/settings/FeedbackPage.svelte";

  // ── i18n ──────────────────────────────────────────────────────────────────
  let _t = $derived.by(() => createTranslator($activeBundle));

  async function handleManageBilling() {
    try {
      await openExternal("https://iamazeyou.me/account/billing");
    } catch (error) {
      console.error("Billing portal failed:", error);
    }
  }

  // ── Sections ──────────────────────────────────────────────────────────────
  type SectionId =
    | "account" | "appearance" | "typography" | "modules" | "sync"
    | "credentials" | "notifications" | "shortcuts" | "privacy" | "system"
    | "accessibility" | "language" | "updates" | "about" | "feedback";

  interface Section { id: SectionId; label: string; tKey: string; icon: typeof UserIcon; }

  const sections: Section[] = [
    { id: "account",       label: "Account",           tKey: "settingsSectionAccount",       icon: UserIcon },
    { id: "appearance",    label: "Appearance",        tKey: "settingsSectionAppearance",    icon: PaintbrushIcon },
    { id: "typography",    label: "Typography",        tKey: "settingsSectionTypography",    icon: TypeIcon },
    { id: "modules",       label: "Modules & Apps",    tKey: "settingsSectionModules",       icon: Grid2x2Icon },
    { id: "sync",          label: "Sync & Storage",    tKey: "settingsSectionSync",          icon: SmartphoneIcon },
    { id: "credentials",   label: "Credentials",       tKey: "settingsSectionCredentials", icon: ShieldIcon },
    { id: "notifications", label: "Notifications",     tKey: "settingsSectionNotifications", icon: BellIcon },
    { id: "shortcuts",     label: "Shortcuts",         tKey: "settingsSectionShortcuts",     icon: KeyboardIcon },
    { id: "privacy",       label: "Privacy & Security",tKey: "settingsSectionPrivacy",       icon: ShieldIcon },
    { id: "system",        label: "System & Startup",  tKey: "settingsSectionSystem",        icon: MonitorCogIcon },
    { id: "accessibility", label: "Accessibility",     tKey: "settingsSectionAccessibility", icon: EyeIcon },
    { id: "language",      label: "Language & Region", tKey: "settingsSectionLanguage",      icon: GlobeIcon },
    { id: "updates",       label: "Updates",           tKey: "settingsSectionUpdates",       icon: CommandIcon },
    { id: "about",         label: "About",             tKey: "settingsSectionAbout",         icon: InfoIcon },
    { id: "feedback",      label: "Feedback",           tKey: "Feedback",                      icon: MessageSquarePlusIcon },
  ];

  let { surface = "modal" }: { surface?: "modal" | "page" } = $props();

  let open = $state(false);
  let activeSection = $state<SectionId>("account");
  let registry = $state<ModuleRegistryEntry[]>([]);
  let loadingRegistry = $state(false);
  let canUseTauri = $derived(browser && "__TAURI_INTERNALS__" in window);

  // Language picker
  let langSearch = $state("");

  // Encryption panel
  let encSetupPw = $state("");
  let encSetupConfirm = $state("");
  let encChangeCurrent = $state("");
  let encChangeNew = $state("");
  let encChangeConfirm = $state("");
  let encLoading = $state(false);
  let encError = $state<string | null>(null);
  let encSuccess = $state<string | null>(null);

  async function handleSetupEncryption() {
    encError = null; encSuccess = null;
    const err = validatePassword(encSetupPw);
    if (err) { encError = err; return; }
    if (encSetupPw !== encSetupConfirm) { encError = "Passwords do not match."; return; }
    encLoading = true;
    try {
      await setupMasterPassword(encSetupPw);
      encSuccess = "Encryption enabled. All local data is now AES-256 encrypted.";
      encSetupPw = ""; encSetupConfirm = "";
    } catch (e) { encError = String(e); }
    finally { encLoading = false; }
  }

  async function handleChangeMasterPassword() {
    encError = null; encSuccess = null;
    const err = validatePassword(encChangeNew);
    if (err) { encError = err; return; }
    if (encChangeNew !== encChangeConfirm) { encError = "New passwords do not match."; return; }
    encLoading = true;
    try {
      const backup = await changeMasterPassword(encChangeCurrent, encChangeNew);
      encSuccess = `Password changed. Backup at: ${backup.path}`;
      encChangeCurrent = ""; encChangeNew = ""; encChangeConfirm = "";
    } catch (e) { encError = String(e); }
    finally { encLoading = false; }
  }

  function show() { open = true; void loadRegistry(); }
  function hide() { open = false; }

  async function loadRegistry() {
    if (loadingRegistry || registry.length > 0) return;
    loadingRegistry = true;
    try { registry = await fetchModuleRegistry(); }
    catch (e) { console.warn("[Bento] Registry load failed", e); }
    finally { loadingRegistry = false; }
  }

  async function selectBuiltin(moduleId: string) {
    const target = modules.find((m) => m.id === moduleId);
    if (!target) { toast.info("Module not available."); return; }
    await switchModule(target.id);
    hide();
  }

  async function handleSignOut() {
    try {
      if (canUseTauri) await invoke("sign_out");
      clearBillingProfile();
      setAuthLoginRequired();
      hide();
    } catch (e) { toast.error("Sign out failed: " + String(e)); }
  }

  async function handleDeleteAccount() {
    if (prompt("Type DELETE to confirm") !== "DELETE") return;
    try {
      if (canUseTauri) await invoke("delete_account");
      clearBillingProfile();
      setAuthLoginRequired();
      hide();
    } catch (e) { toast.error("Delete account failed: " + String(e)); }
  }

  function handleKeydown(event: KeyboardEvent) {
    const shortcut = (event.metaKey || event.ctrlKey) && event.key === ",";
    if (!shortcut) return;
    event.preventDefault();
    open = !open;
    if (open) void loadRegistry();
  }

  onMount(() => {
    if (surface === "page") return;
    window.addEventListener("keydown", handleKeydown);
    const openSettings = () => show();
    const closeSettings = () => hide();
    window.addEventListener("bento:open-global-settings", openSettings);
    window.addEventListener("bento:close-global-settings", closeSettings);
    return () => {
      window.removeEventListener("keydown", handleKeydown);
      window.removeEventListener("bento:open-global-settings", openSettings);
      window.removeEventListener("bento:close-global-settings", closeSettings);
    };
  });
</script>

{#if surface === "page" || open}
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="global-settings"
  class:global-settings--page={surface === "page"}
  transition:fade={{ duration: 120 }}
  onkeydown={(e) => e.key === "Escape" && hide()}
>
  {#if surface !== "page"}
    <button class="global-settings__scrim" aria-label="Close settings" type="button" onclick={hide}></button>
  {/if}

  <section
    class="global-settings__panel"
    class:global-settings__panel--page={surface === "page"}
    aria-label="Bento settings"
    transition:fly={{ y: 12, duration: 200 }}
  >
    <header class="global-settings__header">
      <div>
        <p class="global-settings__eyebrow">Bento Shell</p>
        <h2>{_t('settingsTitle')}</h2>
      </div>
      {#if surface !== "page"}
        <button class="global-settings__close" type="button" aria-label="Close settings" onclick={hide}>
          <XIcon size={16} />
        </button>
      {/if}
    </header>

    <div class="global-settings__body">
      <!-- ── Sidebar Nav ─────────────────────────────── -->
      <nav class="global-settings__nav" aria-label="Settings sections">
        {#each sections as section}
          {@const Icon = section.icon}
          <button
            type="button"
            class:global-settings__nav-active={activeSection === section.id}
            onclick={() => { activeSection = section.id; if (section.id === "modules") void loadRegistry(); }}
          >
            <Icon size={16} /><span>{_t(section.tKey, section.label)}</span>
          </button>
        {/each}
      </nav>

      <!-- ── Content ────────────────────────────────── -->
      <div class="global-settings__content">

        {#if activeSection === "account"}
          <div class="global-settings__section">
            <div class="global-settings__section-heading">
              <h3>{_t('settingsAccountTitle')}</h3>
              <p>{_t('settingsAccountSubtitle')}</p>
            </div>
            {#if $authStore.status === "restored" && $authStore.user}
              <div class="global-settings__info-card">
                <div class="gs-profile">
                  {#if $authStore.user.avatarUrl}
                    <img src={$authStore.user.avatarUrl} alt={$authStore.user.name} class="gs-avatar" />
                  {:else}
                    <div class="gs-avatar gs-avatar--fb">{$authStore.user.name?.charAt(0).toUpperCase()}</div>
                  {/if}
                  <div><strong>{$authStore.user.name}</strong><span>{$authStore.user.email}</span></div>
                </div>
              </div>
            {:else}
              <div class="global-settings__info-card"><p class="global-settings__muted">{_t('settingsAccountSignedOut')}</p></div>
            {/if}
            <div class="global-settings__info-card">
              <div class="gs-row">
                <span><strong>{_t('settingsAccountSubscription')}</strong><small>{_t('settingsAccountFreePlan')}</small></span>
                <div class="gs-actions">
                  <button class="gs-text-btn" onclick={() => void goto("/pricing")}>{_t('settingsAccountPricing')}</button>
                  <button class="gs-text-btn" onclick={() => void handleManageBilling()}>{_t('settingsAccountManage')}</button>
                </div>
              </div>
            </div>
            <div class="global-settings__danger-zone">
              <h4>{_t('settingsAccountDangerZone')}</h4>
              <button type="button" class="global-settings__danger-btn" onclick={() => void handleSignOut()}>{_t('commonSignOut')}</button>
              <button type="button" class="global-settings__danger-btn" onclick={() => void handleDeleteAccount()}>{_t('settingsAccountDeleteAccount')}</button>
            </div>
          </div>

        {:else if activeSection === "appearance"}
          <div class="global-settings__section">
            <div class="global-settings__section-heading">
              <h3>{_t('settingsAppearanceTitle')}</h3>
              <p>{_t('settingsAppearanceSubtitle')}</p>
            </div>
            <div class="global-settings__label">{_t('settingsAppearanceModeLabel')}</div>
            <div class="global-settings__segmented">
              <button type="button" class:global-settings__segment-active={$desktopSettings.appearance.mode === "light"} onclick={() => void setMode("light")}>{_t('commonLight')}</button>
              <button type="button" class:global-settings__segment-active={$desktopSettings.appearance.mode === "dark"} onclick={() => void setMode("dark")}>{_t('commonDark')}</button>
            </div>
            <div class="global-settings__label">{_t('settingsAppearanceThemeLabel')}</div>
            <div class="global-settings__theme-grid">
              {#each availableThemes as theme}
                <button type="button" class:global-settings__theme-active={$desktopSettings.appearance.themeId === theme.id} onclick={() => void setTheme(theme.id)}>
                  <span>{theme.name}</span>
                  {#if $desktopSettings.appearance.themeId === theme.id}<CheckIcon size={15} />{/if}
                </button>
              {/each}
            </div>
            <label class="global-settings__toggle">
              <span><strong>{_t('settingsAppearanceSidebarLabels')}</strong><small>{_t('settingsAppearanceSidebarLabelsHint')}</small></span>
              <input type="checkbox" checked={!$desktopSettings.workspace.sidebarCollapsed} onchange={() => void updateDesktopSettings((c) => ({ ...c, workspace: { ...c.workspace, sidebarCollapsed: !c.workspace.sidebarCollapsed } })) } />
            </label>
          </div>

        {:else if activeSection === "typography"}
          <div class="global-settings__section">
            <div class="global-settings__section-heading">
              <h3>{_t('settingsTypographyTitle')}</h3>
              <p>{_t('settingsTypographySubtitle')}</p>
            </div>
            <div class="global-settings__label">{_t('settingsTypographyFontPairing')}</div>
            <div class="global-settings__pill-group">
              {#each ["playful-classic", "editorial-focus", "bilingual-modern"] as id}
                <button type="button" class:global-settings__pill-active={$fontStore.id === id} onclick={() => setFontPairing(id)}>
                  {id === "playful-classic" ? _t('settingsTypographyPairingPlayfulClassic') : id === "editorial-focus" ? _t('settingsTypographyPairingEditorialFocus') : _t('settingsTypographyPairingBilingualModern')}
                </button>
              {/each}
            </div>
            <div class="global-settings__preview-card">
              <p class="global-settings__preview-text">The quick brown fox jumps over the lazy dog</p>
              <p class="global-settings__muted">{_t('settingsTypographyPreview')}</p>
            </div>
          </div>

        {:else if activeSection === "modules"}
          <div class="global-settings__section">
            <div class="global-settings__section-heading">
              <h3>{_t('settingsModulesTitle')}</h3>
              <p>{_t('settingsModulesSubtitle')}</p>
            </div>
            {#if loadingRegistry}
              <p class="global-settings__muted">{_t('settingsModulesLoading')}</p>
            {:else}
              <div class="global-settings__apps">
                {#each registry as app}
                  <button type="button" class="global-settings__app-card" onclick={() => void selectBuiltin(app.id)}>
                    <span class="global-settings__app-accent" style={`--app-accent: ${app.accent}`}></span>
                    <span><strong>{app.name}</strong><small>{app.description}</small></span>
                    <em>{app.installed ? (app.id === $activeModule ? _t('settingsModulesOpen') : _t('settingsModulesLaunch')) : _t('settingsModulesLocked')}</em>
                  </button>
                {/each}
              </div>
            {/if}
          </div>

        {:else if activeSection === "sync"}
          <div class="global-settings__section">
            <div class="global-settings__section-heading"><h3>{_t('settingsSyncTitle')}</h3><p>{_t('settingsSyncSubtitle')}</p></div>
            <div class="global-settings__info-card"><strong>{_t('settingsSyncStatus')}</strong><span>{$authStore.status === "restored" ? _t('settingsSyncSignedIn') : _t('settingsSyncSignedOut')}</span></div>
          </div>

        {:else if activeSection === "credentials"}
          <div class="global-settings__section">
            <div class="global-settings__section-heading"><h3>Credentials</h3><p>Manage locally stored provider keys and encrypted access tokens.</p></div>
            <ByokSettings surface="panel" />
          </div>

        {:else if activeSection === "notifications"}
          <div class="global-settings__section">
            <div class="global-settings__section-heading"><h3>{_t('settingsNotificationsTitle')}</h3><p>{_t('settingsNotificationsSubtitle')}</p></div>
            <label class="global-settings__toggle">
              <span><strong>{_t('settingsNotificationsBackgroundAlerts')}</strong><small>{_t('settingsNotificationsBackgroundAlertsHint')}</small></span>
              <input type="checkbox" checked={$desktopSettings.notifications.backgroundAlerts} onchange={(e) => void updateDesktopSettings((c) => ({ ...c, notifications: { ...c.notifications, backgroundAlerts: e.currentTarget.checked } })) } />
            </label>
          </div>

        {:else if activeSection === "shortcuts"}
          <div class="global-settings__section">
            <div class="global-settings__section-heading"><h3>{_t('settingsShortcutsTitle')}</h3><p>{_t('settingsShortcutsSubtitle')}</p></div>
            <div class="global-settings__info-card"><strong>{_t('settingsShortcutsOpenSettings')}</strong><span>{_t('settingsShortcutsToggleSettings')}</span></div>
          </div>

        {:else if activeSection === "privacy"}
          <div class="global-settings__section">
            <div class="global-settings__section-heading">
              <h3>{_t('settingsPrivacyTitle')}</h3>
              <p>{_t('settingsPrivacySubtitle')}</p>
            </div>

            <div class="global-settings__info-card">
              <strong>{_t('settingsPrivacyTelemetry')}</strong>
              <span>{$desktopSettings.telemetry.consented ? _t('commonEnabled') : _t('commonOff')}</span>
            </div>

            <!-- Database Encryption -->
            <div class="global-settings__label" style="margin-top:1.5rem">Database Encryption</div>

            {#if encError}<p class="gs-enc-error" role="alert">{encError}</p>{/if}
            {#if encSuccess}<p class="gs-enc-success" role="status">{encSuccess}</p>{/if}

            {#if $needsSetup}
              <div class="gs-enc-card">
                <p class="global-settings__muted" style="margin:0 0 0.75rem">
                  Encrypt all local databases with AES-256 SQLCipher. Your master password is never stored — only derived keys exist in memory during your session.
                </p>
                <input type="password" class="gs-enc-input" placeholder="Choose a master password (min 8 chars)…" bind:value={encSetupPw} autocomplete="new-password" />
                <input type="password" class="gs-enc-input" placeholder="Confirm password…" bind:value={encSetupConfirm} autocomplete="new-password" />
                <button type="button" class="gs-enc-btn" disabled={encLoading || encSetupPw.length < 8} onclick={() => void handleSetupEncryption()}>
                  {encLoading ? "Encrypting…" : "Enable Encryption"}
                </button>
              </div>
            {:else}
              <div class="gs-enc-card">
                <div class="gs-enc-status">
                  <ShieldIcon size={15} />
                  <span>AES-256 SQLCipher — Active</span>
                  <span class="gs-enc-badge">✓ Encrypted</span>
                </div>
                <input type="password" class="gs-enc-input" placeholder="Current password…" bind:value={encChangeCurrent} autocomplete="current-password" />
                <input type="password" class="gs-enc-input" placeholder="New password…" bind:value={encChangeNew} autocomplete="new-password" />
                <input type="password" class="gs-enc-input" placeholder="Confirm new password…" bind:value={encChangeConfirm} autocomplete="new-password" />
                <div class="gs-enc-actions">
                  <button type="button" class="gs-enc-btn" disabled={encLoading || !encChangeCurrent || encChangeNew.length < 8} onclick={() => void handleChangeMasterPassword()}>
                    {encLoading ? "Updating…" : "Change Password"}
                  </button>
                  <button type="button" class="gs-enc-btn gs-enc-btn--sec" onclick={() => void lockDatabase()}>Lock Now</button>
                  <button type="button" class="gs-enc-btn gs-enc-btn--sec" onclick={() => void createBackup().then(b => { encSuccess = `Backup: ${b.path}`; })}>Backup</button>
                </div>
              </div>
            {/if}
          </div>

        {:else if activeSection === "system"}
          <div class="global-settings__section">
            <div class="global-settings__section-heading"><h3>{_t('settingsSystemTitle')}</h3><p>{_t('settingsSystemSubtitle')}</p></div>
            <label class="global-settings__toggle">
              <span><strong>{_t('settingsSystemRestoreWindow')}</strong><small>{_t('settingsSystemRestoreWindowHint')}</small></span>
              <input type="checkbox" checked={$desktopSettings.window.restoreOnLaunch} onchange={() => void updateDesktopSettings((c) => ({ ...c, window: { ...c.window, restoreOnLaunch: !c.window.restoreOnLaunch } }))} />
            </label>
            <label class="global-settings__toggle">
              <span><strong>{_t('settingsSystemStartHidden')}</strong><small>{_t('settingsSystemStartHiddenHint')}</small></span>
              <input type="checkbox" checked={$desktopSettings.window.startHidden} onchange={() => void updateDesktopSettings((c) => ({ ...c, window: { ...c.window, startHidden: !c.window.startHidden } }))} />
            </label>
          </div>

        {:else if activeSection === "accessibility"}
          <div class="global-settings__section">
            <div class="global-settings__section-heading"><h3>{_t('settingsA11yTitle')}</h3><p>{_t('settingsA11ySubtitle')}</p></div>
            <div class="global-settings__info-card"><strong>{_t('settingsA11yScreenReaderLabel')}</strong><span>{_t('settingsA11yScreenReaderValue')}</span></div>
          </div>

        {:else if activeSection === "language"}
          <div class="global-settings__section">
            <div class="global-settings__section-heading">
              <h3>{_t('settingsLanguageTitle')}</h3>
              <p>{_t('settingsLanguageSubtitle')}</p>
            </div>
            <div class="global-settings__label">{_t('settingsLanguageSectionInterface')}</div>
            <div class="global-settings__lang-search">
              <input type="search" placeholder={_t('settingsLanguageSearchPlaceholder')} class="global-settings__lang-input" bind:value={langSearch} autocomplete="off" spellcheck="false" />
            </div>
            <div class="global-settings__lang-list" role="listbox" aria-label="Interface language">
              {#each INTERFACE_LANGUAGES.filter(l => l.label.toLowerCase().includes(langSearch.toLowerCase()) || l.code.toLowerCase().includes(langSearch.toLowerCase())) as lang}
                <button type="button" role="option" aria-selected={$languageStore.code === lang.code} class="global-settings__lang-item" class:global-settings__lang-item--active={$languageStore.code === lang.code} onclick={() => { void setLanguage(lang.code); langSearch = ""; }}>
                  <span class="global-settings__lang-label">{lang.label}</span>
                  <span class="global-settings__lang-code">{lang.code}</span>
                  {#if lang.direction === 'rtl'}<span class="global-settings__lang-rtl">RTL</span>{/if}
                  {#if $languageStore.code === lang.code}<CheckIcon size={14} />{/if}
                </button>
              {/each}
            </div>

            <div class="global-settings__label" style="margin-top:1.5rem">{_t('settingsLanguageDateFormat')}</div>
            <div class="global-settings__pill-group">
              {#each DATE_FORMATS as fmt}
                <button type="button" class:global-settings__pill-active={$desktopSettings.language.dateFormat === fmt.id} onclick={() => void updateDesktopSettings((c) => ({ ...c, language: { ...c.language, dateFormat: fmt.id } }))}>{fmt.label}</button>
              {/each}
            </div>

            <div class="global-settings__label" style="margin-top:1rem">{_t('settingsLanguageTimeFormat')}</div>
            <div class="global-settings__segmented">
              {#each TIME_FORMATS as fmt}
                <button type="button" class:global-settings__segment-active={$desktopSettings.language.timeFormat === fmt.id} onclick={() => void updateDesktopSettings((c) => ({ ...c, language: { ...c.language, timeFormat: fmt.id } }))}>{fmt.label}</button>
              {/each}
            </div>

            <div class="global-settings__label" style="margin-top:1rem">{_t('settingsLanguageFirstDay')}</div>
            <div class="global-settings__segmented">
              {#each FIRST_DAY_OPTIONS as day}
                <button type="button" class:global-settings__segment-active={$desktopSettings.language.firstDay === day.id} onclick={() => void updateDesktopSettings((c) => ({ ...c, language: { ...c.language, firstDay: day.id } }))}>{day.label}</button>
              {/each}
            </div>
          </div>

        {:else if activeSection === "updates"}
          <div class="global-settings__section">
            <div class="global-settings__section-heading"><h3>{_t('settingsUpdatesTitle')}</h3><p>{_t('settingsUpdatesSubtitle')}</p></div>
            <div class="global-settings__info-card"><strong>{_t('settingsUpdatesCurrentVersion')}</strong><span>1.0.0</span></div>
          </div>

        {:else if activeSection === "about"}
          <div class="global-settings__section">
            <div class="global-settings__section-heading"><h3>{_t('settingsAboutTitle')}</h3><p>{_t('settingsAboutSubtitle')}</p></div>
            <div class="global-settings__about-card">
              <h4>Bento Desktop</h4>
              <p class="global-settings__muted">{_t('commonVersion')} 1.0.0</p>
              <p class="global-settings__muted">{_t('settingsAboutTagline')}</p>
            </div>
          </div>

        {:else if activeSection === "feedback"}
          <FeedbackPage />
        {/if}

      </div>
    </div>
  </section>
</div>
{/if}

<style>
  /* ── Layout ──────────────────────────────────────────────────────────────── */
  .global-settings--page { position:relative; inset:auto; display:block; width:100%; background:transparent; }
  .global-settings--page .global-settings__scrim,
  .global-settings--page .global-settings__close,
  .global-settings--page .global-settings__header { display:none; }
  .global-settings--page .global-settings__panel {
    position:static; inset:auto; width:100%; max-width:none; height:auto;
    min-height:0; max-height:none; margin:0; border:none; border-radius:0;
    background:transparent; box-shadow:none; overflow:visible; padding:0;
  }
  .global-settings--page .global-settings__body { grid-template-columns: minmax(14rem,16rem) minmax(0,1fr); gap:1.5rem; align-items:start; }
  .global-settings--page .global-settings__content { overflow:visible; padding:0.75rem 0 3rem; }
  .global-settings--page .global-settings__nav { position:sticky; top:0.25rem; align-self:start; max-height:none; overflow:visible; padding-top:0.5rem; }

  /* ── Profile ─────────────────────────────────────────────────────────────── */
  .gs-profile { display:flex; align-items:center; gap:0.85rem; }
  .gs-avatar { width:2.75rem; height:2.75rem; border-radius:9999px; object-fit:cover; }
  .gs-avatar--fb { display:grid; place-items:center; background:var(--primary); color:var(--primary-foreground); font-weight:700; font-size:1.1rem; }
  .gs-row { display:flex; align-items:center; justify-content:space-between; gap:1rem; }
  .gs-row > span { display:grid; gap:0.15rem; min-width:0; }
  .gs-row small { color:var(--muted-foreground); font-size:0.85rem; }
  .gs-actions { display:inline-flex; align-items:center; gap:0.75rem; }
  .gs-text-btn { appearance:none; border:none; background:transparent; color:var(--foreground); font-size:0.9rem; font-weight:600; cursor:pointer; opacity:0.82; }
  .gs-text-btn:hover { opacity:1; }

  /* ── Encryption ──────────────────────────────────────────────────────────── */
  .gs-enc-card { border:1px solid var(--border); border-radius:14px; padding:1rem; display:flex; flex-direction:column; gap:0.6rem; background:color-mix(in srgb,var(--foreground) 3%,var(--background)); }
  .gs-enc-status { display:flex; align-items:center; gap:0.5rem; font-size:0.88rem; font-weight:600; }
  .gs-enc-badge { font-size:0.72rem; font-weight:800; border-radius:999px; padding:0.15rem 0.5rem; background:color-mix(in srgb,#10b981 15%,var(--background)); color:#10b981; letter-spacing:0.06em; }
  .gs-enc-input { width:100%; border:1px solid var(--border); border-radius:10px; background:color-mix(in srgb,var(--foreground) 5%,var(--background)); padding:0.6rem 0.85rem; color:var(--foreground); font-size:0.9rem; outline:none; box-sizing:border-box; }
  .gs-enc-input:focus { border-color:var(--primary); }
  .gs-enc-btn { border:none; border-radius:10px; background:var(--primary); color:var(--primary-foreground); padding:0.6rem 1rem; font-size:0.88rem; font-weight:700; cursor:pointer; white-space:nowrap; }
  .gs-enc-btn:disabled { opacity:0.45; cursor:not-allowed; }
  .gs-enc-btn--sec { background:color-mix(in srgb,var(--foreground) 8%,var(--background)); color:var(--foreground); border:1px solid var(--border); }
  .gs-enc-actions { display:flex; flex-wrap:wrap; gap:0.5rem; margin-top:0.25rem; }
  .gs-enc-error { font-size:0.85rem; color:var(--destructive); background:color-mix(in srgb,var(--destructive) 8%,var(--background)); border-radius:8px; padding:0.5rem 0.75rem; margin:0; }
  .gs-enc-success { font-size:0.85rem; color:#10b981; background:color-mix(in srgb,#10b981 10%,var(--background)); border-radius:8px; padding:0.5rem 0.75rem; margin:0; }

  /* ── Language picker ─────────────────────────────────────────────────────── */
  .global-settings__lang-search { margin-bottom:0.5rem; }
  .global-settings__lang-input { width:100%; border:1px solid var(--border); border-radius:10px; background:color-mix(in srgb,var(--foreground) 4%,var(--background)); padding:0.55rem 0.85rem; color:var(--foreground); font-size:0.9rem; outline:none; box-sizing:border-box; }
  .global-settings__lang-input:focus { border-color:var(--primary); }
  .global-settings__lang-list { display:flex; flex-direction:column; gap:0.15rem; max-height:14rem; overflow-y:auto; border:1px solid var(--border); border-radius:12px; padding:0.35rem; }
  .global-settings__lang-item { display:flex; align-items:center; gap:0.55rem; border:none; border-radius:8px; background:transparent; padding:0.5rem 0.65rem; color:var(--foreground); font-size:0.88rem; text-align:left; cursor:default; transition:background 80ms ease; }
  .global-settings__lang-item:hover { background:color-mix(in srgb,var(--foreground) 7%,var(--background)); }
  .global-settings__lang-item--active { background:color-mix(in srgb,var(--primary) 10%,var(--background)) !important; color:var(--primary); font-weight:700; }
  .global-settings__lang-label { flex:1; min-width:0; }
  .global-settings__lang-code { font-size:0.75rem; font-weight:600; color:var(--muted-foreground); opacity:0.7; font-family:var(--font-mono,monospace); }
  .global-settings__lang-rtl { font-size:0.68rem; font-weight:800; letter-spacing:0.06em; border:1px solid currentColor; border-radius:4px; padding:0.05rem 0.3rem; opacity:0.65; }

  /* ── Misc ────────────────────────────────────────────────────────────────── */
  .global-settings__danger-zone { margin-top:1rem; border:none; border-radius:20px; background:color-mix(in srgb,var(--destructive) 8%,var(--background)); padding:1rem; display:grid; gap:0.65rem; }
  .global-settings__danger-zone h4 { margin:0; color:var(--destructive); font-size:0.82rem; text-transform:uppercase; letter-spacing:0.12em; }
  .global-settings__danger-btn { border:none; border-radius:20px; background:color-mix(in srgb,var(--destructive) 10%,var(--background)); padding:0.65rem 1rem; color:var(--destructive); font-weight:700; font-size:0.85rem; text-align:left; cursor:default; }
  .global-settings__danger-btn:hover { background:color-mix(in srgb,var(--destructive) 18%,var(--background)); }
  .global-settings__about-card { display:grid; place-items:center; gap:0.5rem; border-radius:20px; background:color-mix(in srgb,var(--foreground) 5%,var(--background)); padding:2rem; text-align:center; }
  .global-settings__about-card h4 { margin:0; font-family:var(--font-heading); font-size:1.15rem; color:var(--foreground); }
  .global-settings__preview-card { border-radius:20px; background:color-mix(in srgb,var(--foreground) 5%,var(--background)); padding:1.25rem; }
  .global-settings__preview-text { font-family:var(--font-heading); font-size:1.35rem; color:var(--foreground); letter-spacing:-0.02em; }
  .global-settings__pill-group { display:flex; flex-wrap:wrap; gap:0.5rem; }
  .global-settings__pill-group button { display:inline-flex; align-items:center; justify-content:center; min-height:2.4rem; border:none; border-radius:999px; background:color-mix(in srgb,var(--foreground) 6%,var(--background)); padding:0 1rem; color:var(--foreground); font-weight:700; font-size:0.82rem; cursor:default; }
  .global-settings__pill-active { background:var(--foreground) !important; color:var(--background) !important; }
  .global-settings__theme-grid { display:flex; flex-wrap:wrap; gap:0.5rem; }
  .global-settings__theme-grid button { display:inline-flex; align-items:center; gap:0.4rem; border:1px solid var(--border); border-radius:10px; background:color-mix(in srgb,var(--foreground) 4%,var(--background)); padding:0.55rem 0.85rem; color:var(--foreground); font-weight:600; font-size:0.85rem; cursor:default; }
  .global-settings__theme-active { border-color:var(--primary) !important; color:var(--primary) !important; }
  .global-settings__apps { display:flex; flex-direction:column; gap:0.5rem; }
  .global-settings__app-card { display:flex; align-items:center; gap:0.75rem; border:1px solid var(--border); border-radius:12px; background:color-mix(in srgb,var(--foreground) 3%,var(--background)); padding:0.75rem 1rem; text-align:left; cursor:default; }
  .global-settings__app-accent { width:0.35rem; height:2rem; border-radius:999px; background:var(--app-accent,var(--primary)); flex-shrink:0; }
  .global-settings__app-card > span { flex:1; min-width:0; display:grid; gap:0.1rem; }
  .global-settings__app-card strong { font-size:0.9rem; color:var(--foreground); }
  .global-settings__app-card small { font-size:0.78rem; color:var(--muted-foreground); }
  .global-settings__app-card em { font-style:normal; font-size:0.78rem; font-weight:700; color:var(--primary); }
</style>
