<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import {
    Wallet, TrendingUp, TrendingDown, PiggyBank, Home, ShoppingCart, Car, Zap,
    UtensilsCrossed, Tv, ShoppingBag, Activity, BookOpen, Bot, Ellipsis,
    Plus, Trash2, CheckCircle2, Download, AlertCircle,
    Calendar, DollarSign, BarChart3, Target, Receipt, CreditCard, LineChart,
    Landmark, TrendingUp as TrendingUpIcon
  } from 'lucide-svelte';
  import BrandIcon from '$lib/components/icons/BrandIcon.svelte';
  import { fade, fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { getModuleSectionLabel, ensureModuleSection, moduleSectionStore } from '$lib/stores/module-sections.store';
  import ForecastingChart from './ForecastingChart.svelte';
  import * as Table from '$lib/components/ui/table/index.js';
  import { Badge } from '$lib/components/ui/badge/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import {
    Card, CardContent, CardDescription, CardHeader, CardTitle,
  } from '$lib/components/ui/card/index.js';

  let { moduleId = "budget" } = $props<{ moduleId?: string }>();
  $effect(() => { void moduleId; });

  // ── Type definitions matching Rust backend ────────────────────────
  interface BudgetCategory {
    id: string; name: string; groupName: string; icon: string;
    monthlyBudget: number; color: string; spent: number; remaining: number; percentUsed: number;
  }
  interface Transaction {
    id: string; categoryId: string | null; categoryName: string | null;
    amount: number; txType: string; note: string | null;
    dateKey: string; project: string | null; recurring: boolean; createdAt: number;
  }
  interface Bill {
    id: string; name: string; amount: number; dueDay: number;
    categoryId: string | null; categoryName: string | null;
    autoPay: boolean; active: boolean; createdAt: number; paidThisMonth: boolean;
  }
  interface AiCostEntry {
    id: string; provider: string; model: string; cost: number;
    tokensIn: number; tokensOut: number; dateKey: string;
    note: string | null; createdAt: number;
  }
  interface AiCostSummary {
    provider: string; totalCost: number; totalTokensIn: number; totalTokensOut: number; monthCount: number;
  }
  interface MonthlyOverview {
    yearMonth: string; totalIncome: number; totalExpenses: number;
    netSavings: number; savingsRate: number;
    topCategories: Array<{ categoryId: string; categoryName: string; icon: string; color: string; spent: number; budget: number; percentUsed: number }>;
    transactionCount: number;
  }
  interface CashFlowProjection {
    month: string; projectedIncome: number; projectedExpenses: number; projectedBalance: number;
  }
  interface ForecastChartMonth {
    month: string; incomeActual: number; expensesActual: number;
    incomeForecast: number; expensesForecast: number; isForecast: boolean;  }
  // ── Sidebar section state ─────────────────────────────────────────
  const sectionLabels = ['Overview', 'Transactions', 'Budgets', 'Bills', 'AI Costs', 'Forecast', 'Export'] as const;
  let selectedSection = $derived(getModuleSectionLabel($moduleSectionStore, moduleId, sectionLabels));

  $effect(() => {
    ensureModuleSection(moduleId, sectionLabels);
  });

  // ── Data state ────────────────────────────────────────────────────
  let loading = $state(true);
  let error = $state<string | null>(null);

  // Overview
  let overview = $state<MonthlyOverview | null>(null);

  // Transactions
  let transactions = $state<Transaction[]>([]);
  let txMonth = $state(new Date().toISOString().slice(0, 7));

  // Budgets
  let categories = $state<BudgetCategory[]>([]);

  // Bills
  let bills = $state<Bill[]>([]);
  let selectedBill = $state<Bill | null>(null);

  // ── Brand colors + popular services (Subscription Day) ────────────
  const SUB_COLORS: Record<string, string> = {
    'Netflix': '#E50914', 'Spotify': '#1DB954', 'Apple Music': '#FC3C44',
    'YouTube': '#FF0000', 'YouTube Premium': '#FF0000', 'Claude': '#D97706',
    'ChatGPT': '#10A37F', 'Cursor': '#1C1C1C', 'Notion': '#000000',
    'Figma': '#F24E1E', 'Linear': '#5E6AD2', 'GitHub': '#181717',
    'Dropbox': '#0061FF', 'iCloud': '#3693F3', 'iCloud+': '#3693F3',
    'Google One': '#4285F4', 'Microsoft 365': '#D83B01', 'Adobe': '#FF0000',
    'Slack': '#4A154B', 'Zoom': '#2D8CFF', 'Headspace': '#F47D31',
    'Duolingo': '#58CC02', 'LinkedIn': '#0A66C2', 'Twitter': '#1DA1F2',
    'Perplexity': '#1FB8CD', 'Midjourney': '#1D1D1D', 'Grok': '#1D1D1D',
    'Gemini': '#4285F4', 'DeepSeek': '#4D6BFE', 'GitHub Copilot': '#181717',
  };
  const POPULAR_SERVICES = [
    { name: 'Netflix',         color: '#E50914' },
    { name: 'Spotify',         color: '#1DB954' },
    { name: 'YouTube Premium', color: '#FF0000' },
    { name: 'Claude',          color: '#D97706' },
    { name: 'ChatGPT',         color: '#10A37F' },
    { name: 'Cursor',          color: '#6366f1' },
    { name: 'iCloud+',         color: '#3693F3' },
    { name: 'GitHub Copilot',  color: '#181717' },
    { name: 'Notion',          color: '#1C1C1C' },
    { name: 'Figma',           color: '#F24E1E' },
    { name: 'Linear',          color: '#5E6AD2' },
    { name: 'Duolingo',        color: '#58CC02' },
  ];

  // ── Calendar constants (computed once, never change) ─────────────
  const calNow       = new Date();
  const calYear      = calNow.getFullYear();
  const calMonth     = calNow.getMonth();
  const calMonthLabel= calNow.toLocaleString('default', { month: 'long', year: 'numeric' });
  const calDays      = new Date(calYear, calMonth + 1, 0).getDate();
  const calFirstDow  = new Date(calYear, calMonth, 1).getDay();
  const calToday     = calNow.getDate();

  // ── Calendar derived ──────────────────────────────────────────────
  let calMonthlyTotal = $derived(bills.filter(b => b.active).reduce((s, b) => s + b.amount, 0));
  let calPaidCount    = $derived(bills.filter(b => b.paidThisMonth).length);
  let calUnpaidCount  = $derived(bills.filter(b => b.active && !b.paidThisMonth).length);
  let calYearlyTotal  = $derived(calMonthlyTotal * 12);

  // AI Costs
  let aiEntries = $state<AiCostEntry[]>([]);
  let aiSummary = $state<AiCostSummary[]>([]);

  // Forecast
  let cashFlow = $state<CashFlowProjection[]>([]);
  let chartData = $state<ForecastChartMonth[]>([]);
  let forecastMonths = $state(6);


  // ── Form state ─────────────────────────────────────────────────────
  let showAddTx = $state(false);
  let showAddBill = $state(false);
  let showAddAi = $state(false);
  let showEditBudget = $state<string | null>(null);

  // Submit loading (prevents double-submit + gives visual feedback)
  let submittingTx = $state(false);
  let submittingBill = $state(false);
  let submittingAi = $state(false);

  // New transaction form
  let newTx = $state({ categoryId: '', amount: 0, txType: 'expense', note: '', dateKey: new Date().toISOString().slice(0, 10), project: '', recurring: false });
  // New bill form
  let newBill = $state({ name: '', amount: 0, dueDay: 1, categoryId: '', autoPay: false });
  // New AI cost form
  let newAi = $state({ provider: '', model: '', cost: 0, tokensIn: 0, tokensOut: 0, dateKey: new Date().toISOString().slice(0, 10), note: '' });

  // ── Derived ───────────────────────────────────────────────────────
  let thisMonth = $derived(new Date().toISOString().slice(0, 7));

  let categoryGroups = $derived.by(() => {
    const groups = [...new Set(categories.map(c => c.groupName))];
    // Sort groups with a sensible default order
    const order = ['Income', 'Essentials', 'Housing', 'Lifestyle', 'Wellness', 'Savings', 'Personal', 'AI Costs', 'Other'];
    return groups.sort((a, b) => {
      const ai = order.indexOf(a);
      const bi = order.indexOf(b);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
  });

  // ── Load functions ────────────────────────────────────────────────
  async function loadAll() {
    loading = true; error = null;
    try {
      await Promise.all([
        loadOverview().catch(e => { console.error('overview', e); return null; }),
        loadCategories().catch(e => { console.error('categories', e); return null; }),
        loadTransactions().catch(e => { console.error('transactions', e); return null; }),
        loadBills().catch(e => { console.error('bills', e); return null; }),
        loadAiCosts().catch(e => { console.error('aiCosts', e); return null; }),
        loadCashFlow().catch(e => { console.error('cashFlow', e); return null; }),
        loadChartData().catch(e => { console.error('chartData', e); return null; }),
      ]);
    } catch (e) {
      error = String(e);
    }
    loading = false;
  }

  async function loadOverview() {
    overview = await invoke<MonthlyOverview>('budget_monthly_overview', {});
  }
  async function loadCategories() {
    categories = await invoke<BudgetCategory[]>('budget_list_categories', {});
  }
  async function loadTransactions() {
    transactions = await invoke<Transaction[]>('budget_list_transactions', { month: txMonth, limit: 200, offset: 0 });
  }
  async function loadBills() {
    bills = await invoke<Bill[]>('budget_list_bills', {});
  }
  async function loadAiCosts() {
    [aiEntries, aiSummary] = await Promise.all([
      invoke<AiCostEntry[]>('budget_list_ai_costs', { month: thisMonth }),
      invoke<AiCostSummary[]>('budget_ai_cost_summary', {}),
    ]);
  }
  async function loadCashFlow() {
    cashFlow = await invoke<CashFlowProjection[]>('budget_cash_flow_forecast', { months: forecastMonths });
  }

  // ── Actions ───────────────────────────────────────────────────────
  async function addTransaction() {
    submittingTx = true;
    try {
      await invoke('budget_add_transaction', {
        tx: {
          categoryId: newTx.categoryId || null,
          amount: newTx.amount,
          txType: newTx.txType,
          note: newTx.note || null,
          dateKey: newTx.dateKey,
          project: newTx.project || null,
          recurring: newTx.recurring,
        }
      });
      showAddTx = false;
      resetNewTx();
      await Promise.all([loadTransactions(), loadOverview(), loadCategories()]);
    } catch (e) { error = String(e); }
    submittingTx = false;
  }

  async function deleteTransaction(id: string) {
    try { await invoke('budget_delete_transaction', { id }); await Promise.all([loadTransactions(), loadOverview(), loadCategories()]);
    } catch (e) { error = String(e); }
  }

  async function addBill() {
    submittingBill = true;
    try {
      await invoke('budget_add_bill', {
        bill: { name: newBill.name, amount: newBill.amount, dueDay: newBill.dueDay, categoryId: newBill.categoryId || null, autoPay: newBill.autoPay }
      });
      showAddBill = false;
      resetNewBill();
      await loadBills();
    } catch (e) { error = String(e); }
    submittingBill = false;
  }

  async function toggleBillPaid(id: string) {
    try { await invoke('budget_toggle_bill_paid', { billId: id }); await loadBills(); }
    catch (e) { error = String(e); }
  }

  async function deleteBill(id: string) {
    try { await invoke('budget_delete_bill', { id }); await loadBills(); }
    catch (e) { error = String(e); }
  }

  async function addAiCost() {
    submittingAi = true;
    try {
      await invoke('budget_add_ai_cost', {
        entry: {
          provider: newAi.provider, model: newAi.model, cost: newAi.cost,
          tokensIn: newAi.tokensIn, tokensOut: newAi.tokensOut,
          dateKey: newAi.dateKey, note: newAi.note || null,
        }
      });
      showAddAi = false;
      resetNewAi();
      await loadAiCosts();
    } catch (e) { error = String(e); }
    submittingAi = false;
  }

  async function deleteAiCost(id: string) {
    try { await invoke('budget_delete_ai_cost', { id }); await loadAiCosts(); }
    catch (e) { error = String(e); }
  }

  async function setCategoryBudget(id: string, amount: number) {
    try { await invoke('budget_set_category_budget', { categoryId: id, monthlyBudget: amount }); await loadCategories(); }
    catch (e) { error = String(e); }
  }

  async function exportCsv() {
    try {
      const csv = await invoke<string>('budget_export_csv', { month: thisMonth });
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `budget-${thisMonth}.csv`;
      a.click(); URL.revokeObjectURL(url);
    } catch (e) { error = String(e); }
  }

  async function exportPdf() {
    try {
      const result = await (window as any).showSaveFilePicker?.({
        suggestedName: `budget-report-${thisMonth}.pdf`,
        types: [{ description: 'PDF Document', accept: { 'application/pdf': ['.pdf'] } }]
      });
      if (!result) return;
      const path = result.name; // In Tauri, we use the dialog API instead
      // Use Tauri dialog save
      const { save } = await import('@tauri-apps/plugin-dialog');
      const filePath = await save({
        defaultPath: `budget-report-${thisMonth}.pdf`,
        filters: [{ name: 'PDF Document', extensions: ['pdf'] }]
      });
      if (!filePath) return;
      loading = true;
      await invoke('budget_export_pdf', { path: filePath, month: thisMonth });
      loading = false;
    } catch (e) { error = String(e); loading = false; }
  }

  function resetNewTx() { newTx = { categoryId: '', amount: 0, txType: 'expense', note: '', dateKey: new Date().toISOString().slice(0, 10), project: '', recurring: false }; }
  function resetNewBill() { newBill = { name: '', amount: 0, dueDay: 1, categoryId: '', autoPay: false }; }
  function resetNewAi() { newAi = { provider: '', model: '', cost: 0, tokensIn: 0, tokensOut: 0, dateKey: new Date().toISOString().slice(0, 10), note: '' }; }

  async function loadChartData() {
    chartData = await invoke<ForecastChartMonth[]>('budget_forecast_chart_data', { months: forecastMonths });
  }

  async function handleForecastMonthsChange(n: number) {
    forecastMonths = n;
    await Promise.all([loadCashFlow(), loadChartData()]);
  }

  // ── Icon resolver ─────────────────────────────────────────────────
  const iconMap: Record<string, typeof Wallet> = {
    'trending-up': TrendingUp, 'home': Home, 'shopping-cart': ShoppingCart, 'car': Car,
    'zap': Zap, 'utensils-crossed': UtensilsCrossed, 'tv': Tv, 'shopping-bag': ShoppingBag,
    'activity': Activity, 'book-open': BookOpen, 'bot': Bot, 'piggy-bank': PiggyBank,
    'ellipsis': Ellipsis, 'wallet': Wallet,
  };
  function resolveIcon(name: string): typeof Wallet { return iconMap[name] || Wallet; }

  // ── Per-section header copy ───────────────────────────────────────
  const sectionHeaders: Record<string, { eyebrow: string; title: string; subtitle: string }> = {
    'Overview':     { eyebrow: "This month",           title: "Your money, in full view.",                    subtitle: "Income, spending, savings — everything that happened this month, right here." },
    'Transactions': { eyebrow: "Money in, money out",  title: "Every transaction you've made.",              subtitle: "The complete record. Add one, review one, delete one — this is your ledger." },
    'Budgets':      { eyebrow: "Spending limits",      title: "You decide what each category gets.",         subtitle: "Set a ceiling. Track how close you are. Adjust when life changes." },
    'Bills':        { eyebrow: "Recurring commitments",title: "What's due, what's paid, what's next.",       subtitle: "Your fixed obligations, tracked so nothing catches you off guard." },
    'AI Costs':     { eyebrow: "Tool spending",        title: "What your AI tools are actually costing.",    subtitle: "Claude, Cursor, GPT — log every subscription and API charge. Know the number." },
    'Forecast':     { eyebrow: "Looking ahead",        title: "Where your finances are heading.",            subtitle: "Projected income, projected expenses, projected balance — based on how you actually spend." },
    'Export':       { eyebrow: "Take your data",       title: "Download everything, keep it forever.",       subtitle: "CSV for your spreadsheet. PDF for your accountant. It's your data — take it." },
  };
  let currentHeader = $derived(sectionHeaders[selectedSection as string] ?? sectionHeaders['Overview']);

  // ── Modal scrollbar + contain: layout manager ────────────────────
  // When a modal opens we need to:
  //   1. Remove `contain: layout paint` from `.desktop-workspace__main`
  //      (it creates a containing block for `position: fixed` that breaks
  //      the modal's centering — the modal appears "clipped at the scroll
  //      position" because fixed resolves against the scrolled container).
  //   2. Lock the main area scrollbar (overflow: hidden) and compensate
  //      width with padding-right so the layout doesn't shift.
  //
  // We do NOT portal to <body> — the modal stays inside .bg-workspace
  // so CSS variables (`--bg-surface`, `--bg-accent`, etc.) inherit
  // naturally without needing to copy them programmatically.
  //
  // ── Modal scrollbar + contain + focus + a11y manager ────────────
  // When a modal opens we need to:
  //   1. Remove `contain: layout paint` from `.desktop-workspace__main`
  //      (it creates a containing block for `position: fixed` that breaks
  //      the modal's centering).
  //   2. Lock the main area scrollbar (overflow: hidden) + paddingRight
  //      compensation so the layout width doesn't shift.
  //   3. Focus-trap: move focus into the modal (first focusable element)
  //      and restore it on close.
  //   4. Set aria-hidden on the main workspace so screen readers
  //      don't traverse background content.
  //
  function modalLock(node: HTMLElement) {
    // Save the element that had focus before the modal opened
    const prevFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    const main = document.querySelector('.desktop-workspace__main');
    const switcher = document.querySelector('.module-switcher');
    const sidebar = document.querySelector('.desktop-sidebar');
    let origContain = '';
    if (main instanceof HTMLElement) {
      // Use getComputedStyle for the actual CSS cascade value
      origContain = getComputedStyle(main).contain;
      main.style.contain = 'none';
      
      // Lock scrollbar with width compensation
      const scrollbarWidth = main.offsetWidth - main.clientWidth;
      main.style.overflow = 'hidden';
      if (scrollbarWidth > 0) {
        main.style.paddingRight = scrollbarWidth + 'px';
      }

      // Hide background from screen readers
      main.setAttribute('aria-hidden', 'true');
    }
    // Module switcher is outside desktop-workspace__main (fixed position),
    // so we need to hide it separately for a11y completeness
    if (switcher instanceof HTMLElement) {
      switcher.setAttribute('aria-hidden', 'true');
    }
    // Sidebar is also fixed, outside desktop-workspace__main
    if (sidebar instanceof HTMLElement) {
      sidebar.setAttribute('aria-hidden', 'true');
    }

    // Focus-trap: find the first focusable element inside the dialog
    const focusable = node.querySelector<HTMLElement>(
      'input, select, textarea, button, [tabindex]:not([tabindex="-1"])'
    );
    // Use requestAnimationFrame to let Svelte mount the inner elements first
    requestAnimationFrame(() => {
      focusable?.focus();
    });

    
    return {
      destroy() {
        if (main instanceof HTMLElement) {
          // Restore contain using the computed value
          main.style.contain = origContain;
          // Restore scrollbar
          main.style.overflow = '';
          main.style.paddingRight = '';
          // Restore aria-hidden
          main.removeAttribute('aria-hidden');
        }
        if (switcher instanceof HTMLElement) {
          switcher.removeAttribute('aria-hidden');
        }
        if (sidebar instanceof HTMLElement) {
          sidebar.removeAttribute('aria-hidden');
        }
        // Return focus to the trigger element
        if (prevFocused && document.contains(prevFocused)) {
          prevFocused.focus();
        }
      }
    };
  }

  // ── Init ──────────────────────────────────────────────────────────
  $effect(() => { loadAll(); });
  $effect(() => { if (selectedSection === 'Transactions') loadTransactions(); });
  $effect(() => { if (selectedSection === 'Forecast') { loadCashFlow(); loadChartData(); } });
  $effect(() => { if (selectedSection === 'AI Costs') loadAiCosts(); });
  $effect(() => { if (selectedSection === 'Bills') loadBills(); });
</script>

<main class="bg-workspace module-root" data-module="budget">

  {#if error}
    <div class="bg-error-banner">
      <AlertCircle size={16} />
      <span>{error}</span>
      <button class="bg-dismiss-btn" onclick={() => error = null}>×</button>
    </div>
  {/if}

  {#if loading}
    <section class="bg-page bg-loading">
      <div class="bg-loading__orb"></div>
      <span>Loading your financial data…</span>
    </section>

  {:else}
    <!-- ══════════════════════════════════════════════════════════════════
         TAB: OVERVIEW
         ══════════════════════════════════════════════════════════════════ -->
    {#if selectedSection === 'Overview'}
      <section class="bg-page">
        <header class="bg-page__header">
          <div class="bg-page__intro">
            <div class="bg-page__eyebrow"><DollarSign size={13}/><span>Financial Co-Pilot</span><Badge variant="outline">{currentHeader.eyebrow}</Badge></div>
            <h1>{currentHeader.title}</h1>
            <p>{currentHeader.subtitle}</p>
          </div>
          <div class="bg-page__actions">
          </div>
        </header>

        <section class="bg-hero-grid">
          <Card class="bg-score-card">
            <CardHeader><CardTitle>Income</CardTitle><CardDescription>This month's earnings</CardDescription></CardHeader>
            <CardContent class="bg-score-card__content">
              <div class="bg-score-orb bg-orb--income">
                <TrendingDown size={24} />
              </div>
              <div class="bg-score-meta">
                <div><strong>€{overview?.totalIncome.toFixed(2) ?? '0.00'}</strong><span>Total income</span></div>
                <div><span>{overview?.transactionCount ?? 0}</span><span>Transactions</span></div>
              </div>
            </CardContent>
          </Card>

          <Card class="bg-hero-card">
            <CardHeader><CardTitle>Spending snapshot</CardTitle><CardDescription>Core financial metrics</CardDescription></CardHeader>
            <CardContent class="bg-hero-list">
              <article>
                <span>Expenses</span>
                <div class="bg-hero-bar"><i style="--fill:{overview ? Math.min((overview.totalExpenses/(overview.totalIncome||1))*100, 100) : 0}%"></i></div>
                <strong class="bg-expense">€{overview?.totalExpenses.toFixed(2) ?? '0.00'}</strong>
              </article>
              <article>
                <span>Net Savings</span>
                <div class="bg-hero-bar"><i style="--fill:{overview ? Math.min((overview.netSavings/(overview.totalIncome||1))*100, 100) : 0}%"></i></div>
                <strong class="bg-savings">€{overview?.netSavings.toFixed(2) ?? '0.00'}</strong>
              </article>
              <article>
                <span>Savings Rate</span>
                <div class="bg-hero-bar"><i style="--fill:{overview?.savingsRate ?? 0}%"></i></div>
                <strong>{overview?.savingsRate.toFixed(1) ?? '0.0'}%</strong>
              </article>
            </CardContent>
          </Card>
        </section>

        <section class="bg-body">
          <div class="bg-grid bg-grid--2col">
          </div>

          <!-- Top spending categories -->
          {#if overview && overview.topCategories.length > 0}
            <Card class="bg-panel bg-panel--full-row" style="margin-top: 16px;">
              <CardHeader><CardTitle><BarChart3 size={15} /> Top Spending Categories</CardTitle><CardDescription>Where your money went this month</CardDescription></CardHeader>
              <CardContent>
                <div class="bg-top-cats">
                  {#each overview.topCategories.slice(0, 5) as cat}
                    <div class="bg-top-cat-item">
                      <div class="bg-top-cat-left">
                        <span class="bg-cat-dot" style="background: {cat.color}"></span>
                        <span class="bg-cat-name">{cat.categoryName}</span>
                      </div>
                      <div class="bg-top-cat-right">
                        <div class="bg-cat-bar-track">
                          <div class="bg-cat-bar-fill" style="width: {Math.min(cat.percentUsed, 100)}%; background: {cat.color}"></div>
                        </div>
                        <span class="bg-cat-amount">€{cat.spent.toFixed(0)}</span>
                      </div>
                    </div>
                  {/each}
                </div>
              </CardContent>
            </Card>
          {/if}
        </section>
      </section>

    <!-- ══════════════════════════════════════════════════════════════════
         TAB: TRANSACTIONS
         ══════════════════════════════════════════════════════════════════ -->
    {:else if selectedSection === 'Transactions'}
      <section class="bg-page">
        <header class="bg-page__header">
          <div class="bg-page__intro">
            <div class="bg-page__eyebrow"><Receipt size={13}/><span>{currentHeader.eyebrow}</span><Badge variant="outline">{transactions.length} entries</Badge></div>
            <h1>{currentHeader.title}</h1>
            <p>{currentHeader.subtitle}</p>
          </div>
          <div class="bg-page__actions">
            <input type="month" bind:value={txMonth} onchange={() => loadTransactions()} class="bg-month-input" />
            <Button onclick={() => { resetNewTx(); showAddTx = true; }}>
              <Plus size={16} /> Add Transaction
            </Button>
          </div>
        </header>

        <section class="bg-body">
          <Card class="bg-panel bg-panel--full-row">
            <CardContent style="padding: 0;">
              <Table.Root>
                {#if transactions.length === 0}
                  <Table.Caption>No transactions this month.</Table.Caption>
                {:else}
                  <Table.Caption>Transactions for {txMonth}</Table.Caption>
                  <Table.Header>
                    <Table.Row>
                      <Table.Head>Category</Table.Head>
                      <Table.Head>Note</Table.Head>
                      <Table.Head>Date</Table.Head>
                      <Table.Head class="text-end">Amount</Table.Head>
                      <Table.Head><span class="sr-only">Action</span></Table.Head>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {#each transactions as tx}
                      <Table.Row class={tx.txType === 'income' ? 'bg-tx-income-row' : ''}>
                        <Table.Cell>
                          {#if tx.categoryName}
                            <span class="bg-tx-dot" style="background: {categories.find(c => c.id === tx.categoryId)?.color ?? '#6b7280'}"></span>
                          {/if}
                          <span class="font-medium">{tx.categoryName ?? 'Uncategorized'}</span>
                        </Table.Cell>
                        <Table.Cell class="text-[var(--bg-muted)] max-w-[200px] truncate">{tx.note ?? ''}</Table.Cell>
                        <Table.Cell class="text-[var(--bg-muted)]">{tx.dateKey.slice(5)}</Table.Cell>
                        <Table.Cell class="text-end font-semibold {tx.txType === 'expense' ? 'bg-tx-expense' : 'bg-tx-income'}">
                          {tx.txType === 'expense' ? '-' : '+'}€{tx.amount.toFixed(2)}
                        </Table.Cell>
                        <Table.Cell>
                          <button class="bg-icon-btn bg-icon-btn--danger" onclick={() => deleteTransaction(tx.id)}>
                            <Trash2 size={14} />
                          </button>
                        </Table.Cell>
                      </Table.Row>
                    {/each}
                  </Table.Body>
                {/if}
              </Table.Root>
            </CardContent>
          </Card>
        </section>
      </section>

      <!-- Add Transaction Modal -->
      {#if showAddTx}
        <div class="bg-modal-overlay" use:modalLock in:fade={{ duration: 200 }} out:fade={{ duration: 150 }} onclick={() => showAddTx = false} onkeydown={(e) => { if (e.key === 'Escape') showAddTx = false; }}>
          <div class="bg-modal-sheet" in:fly={{ y: 20, duration: 300, opacity: 0, easing: cubicOut }} out:fly={{ y: 20, duration: 200, opacity: 0 }} onclick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="bg-modal-title-tx" tabindex="-1">
            <div class="bg-modal-handle"></div>
            <h3 id="bg-modal-title-tx">New Transaction</h3>
            <div class="bg-modal-form">
              <div class="bg-type-toggle">
                <button class="bg-type-btn" class:bg-type-btn--active={newTx.txType === 'expense'} onclick={() => newTx.txType = 'expense'}>
                  <TrendingUp size={16} /> Expense
                </button>
                <button class="bg-type-btn" class:bg-type-btn--active={newTx.txType === 'income'} onclick={() => newTx.txType = 'income'}>
                  <TrendingDown size={16} /> Income
                </button>
              </div>
              <div class="bg-form-field">
                <label for="tx-amount">Amount (€)</label>
                <input id="tx-amount" type="number" step="0.01" min="0" bind:value={newTx.amount} placeholder="0.00" />
              </div>
              <div class="bg-form-field">
                <label for="tx-category">Category</label>
                <select id="tx-category" bind:value={newTx.categoryId}>
                  <option value="">Select category…</option>
                  {#each categories as cat}
                    <option value={cat.id}>{cat.name}</option>
                  {/each}
                </select>
              </div>
              <div class="bg-form-field">
                <label for="tx-note">Note</label>
                <input id="tx-note" type="text" bind:value={newTx.note} placeholder="What was this for?" />
              </div>
              <div class="bg-form-field">
                <label for="tx-date">Date</label>
                <input id="tx-date" type="date" bind:value={newTx.dateKey} />
              </div>
              <div class="bg-form-field">
                <label for="tx-project">Project <span class="bg-field-hint">(optional)</span></label>
                <input id="tx-project" type="text" bind:value={newTx.project} placeholder="e.g. Bento Development" />
              </div>
              <label class="bg-checkbox-field">
                <input type="checkbox" bind:checked={newTx.recurring} />
                <span>Recurring transaction</span>
              </label>
              <button class="bg-submit-btn" onclick={addTransaction} disabled={submittingTx}>
                {#if submittingTx}
                  <span class="bg-spinner"></span>
                {:else}
                  <CheckCircle2 size={16} />
                {/if}
                Save Transaction
              </button>
            </div>
          </div>
        </div>
      {/if}

    <!-- ══════════════════════════════════════════════════════════════════
         TAB: BUDGETS (Category Allocation)
         ══════════════════════════════════════════════════════════════════ -->
    {:else if selectedSection === 'Budgets'}
      <section class="bg-page">
        <header class="bg-page__header">
          <div class="bg-page__intro">
            <div class="bg-page__eyebrow"><Target size={13}/><span>{currentHeader.eyebrow}</span><Badge variant="outline">{categories.length} {categories.length === 1 ? 'category' : 'categories'}</Badge></div>
            <h1>{currentHeader.title}</h1>
            <p>{currentHeader.subtitle}</p>
          </div>
          <div class="bg-page__actions">
          </div>
        </header>

        <section class="bg-body">
          {#if categories.length === 0}
            <div class="bg-empty-state">
              <Target size={40} />
              <p>No budget categories yet. Start by adding a transaction — categories are created as you go.</p>
            </div>
          {:else}
            {#each categoryGroups as group}
              {const groupCats = categories.filter(c => c.groupName === group)}
              {#if groupCats.length > 0}
                <div class="bg-budget-group">
                  <h3 class="bg-group-title">{group}</h3>
                  <div class="bg-budget-cards">
                    {#each groupCats as cat}
                      {const Icon = resolveIcon(cat.icon)}
                      <Card class="bg-budget-card" style="--bg-cat-color: {cat.color}">
                        <CardContent style="padding: 14px 16px; display: flex; flex-direction: column; gap: 8px;">
                          <div class="bg-budget-card-header">
                            <Icon size={18} />
                            <span class="bg-budget-cat-name">{cat.name}</span>
                            <button class="bg-edit-budget-btn" onclick={() => showEditBudget = showEditBudget === cat.id ? null : cat.id}>
                              <span class="bg-budget-cat-amount">{cat.monthlyBudget > 0 ? '€' + cat.monthlyBudget.toFixed(0) : '–'}</span>
                            </button>
                          </div>
                          <div class="bg-budget-bar-track">
                            <div class="bg-budget-bar-fill" style="width: {Math.min(cat.percentUsed, 100)}%"
                              class:bg-budget-bar--over={cat.percentUsed >= 100}></div>
                          </div>
                          <div class="bg-budget-card-footer">
                            <span>€{cat.spent.toFixed(2)} spent</span>
                            <span class:bg-remaining-pos={cat.remaining >= 0} class:bg-remaining-neg={cat.remaining < 0}>
                              {cat.monthlyBudget > 0 ? '€' + cat.remaining.toFixed(2) + ' left' : ''}
                            </span>
                          </div>
                          {#if showEditBudget === cat.id}
                            <div class="bg-budget-edit">
                              <input type="number" step="50" min="0" value={cat.monthlyBudget}
                                onchange={(e) => {
                                  const val = parseFloat((e.target as HTMLInputElement).value);
                                  if (!isNaN(val)) setCategoryBudget(cat.id, val);
                                }}
                                placeholder="Monthly budget" />
                              <button class="bg-save-mini" onclick={() => showEditBudget = null}>Done</button>
                            </div>
                          {/if}
                        </CardContent>
                      </Card>
                    {/each}
                  </div>
                </div>
              {/if}
            {/each}
          {/if}
        </section>
      </section>
    <!-- ══════════════════════════════════════════════════════════════
         TAB: BILLS — Subscription Day calendar
    ════════════════════════════════════════════════════════════════ -->
    {:else if selectedSection === 'Bills'}
      <section class="bg-page">
        <header class="bg-page__header">
          <div class="bg-page__intro">
            <div class="bg-page__eyebrow"><CreditCard size={13}/><span>{currentHeader.eyebrow}</span><Badge variant="outline">{bills.filter(b => b.active).length} subscriptions</Badge></div>
            <h1>{currentHeader.title}</h1>
            <p>{currentHeader.subtitle}</p>
          </div>
          <div class="bg-page__actions">
          </div>
        </header>

        <section class="bg-body">
          <div class="subs-shell">

            <!-- ── LEFT: Calendar pane ───────────────────────────────── -->
            <div class="subs-cal-pane">

              <!-- Month headline -->
              <div class="subs-month-hd">
                <div class="subs-month-left">
                  <span class="subs-month-name">{calMonthLabel}</span>
                  {#if calUnpaidCount === 0 && bills.length > 0}
                    <span class="subs-badge subs-badge--paid">All paid ✓</span>
                  {:else if calUnpaidCount > 0}
                    <span class="subs-badge subs-badge--unpaid">{calUnpaidCount} upcoming</span>
                  {/if}
                </div>
                <div class="subs-month-total">
                  <span class="subs-total-amt">€{calMonthlyTotal.toFixed(2)}</span>
                  <span class="subs-total-label">/ month</span>
                </div>
              </div>

              <!-- Day-of-week row -->
              <div class="subs-dow">
                {#each ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'] as d}
                  <span>{d}</span>
                {/each}
              </div>

              <!-- Calendar grid — squircle day cells -->
              <div class="subs-grid">
                {#each Array(calFirstDow) as _}
                  <div class="subs-cell subs-cell--empty"></div>
                {/each}

                {#each Array(calDays) as _, i}
                  {const day = i + 1}
                  {const dayBills = bills.filter(b => b.dueDay === day && b.active)}
                  {const isToday = day === calToday}
                  {const hasBill = dayBills.length > 0}
                  <div
                    class="subs-cell"
                    class:subs-cell--today={isToday}
                    class:subs-cell--active={hasBill}
                  >
                    <!-- Day number — squircle if has bills -->
                    <span class="subs-day-num" class:subs-day-num--today={isToday}>{day}</span>

                    {#if hasBill}
                      <div class="subs-badges">
                        {#each dayBills.slice(0, 2) as bill}
                          <button
                            class="subs-sqircle"
                            class:subs-sqircle--paid={bill.paidThisMonth}
                            style="background:{SUB_COLORS[bill.name] ?? '#6b7280'}"
                            onclick={() => selectedBill = selectedBill?.id === bill.id ? null : bill}
                            title="{bill.name} — €{bill.amount.toFixed(2)}"
                          >
                            <BrandIcon name={bill.name} size={11} class="bg-brand-mono" />
                          </button>
                        {/each}
                        {#if dayBills.length > 2}
                          <span class="subs-overflow">+{dayBills.length - 2}</span>
                        {/if}
                      </div>
                    {/if}
                  </div>
                {/each}
              </div>

              <!-- Add subscription -->
              <button class="subs-add-btn" onclick={() => { resetNewBill(); showAddBill = true; }}>
                <Plus size={15} /> Add Subscription
              </button>
            </div>

            <!-- ── RIGHT: Detail + analytics ─────────────────────────── -->
            <div class="subs-side">

              <!-- Detail card — brand-color tinted -->
              {#if selectedBill}
                {const sb = selectedBill}
                {const sbColor = SUB_COLORS[sb.name] ?? '#6b7280'}
                <div class="subs-detail" style="--sb:{sbColor}">
                  <div class="subs-detail-hd">
                    <div class="subs-detail-icon" style="background:{sbColor}18">
                      <BrandIcon name={sb.name} size={18} />
                    </div>
                    <div class="subs-detail-meta">
                      <span class="subs-detail-name">{sb.name}</span>
                      <span class="subs-detail-cycle">Monthly · Day {sb.dueDay}</span>
                    </div>
                    <button class="subs-close" onclick={() => selectedBill = null}>×</button>
                  </div>

                  <div class="subs-detail-rows">
                    <div class="subs-dr"><span>Amount</span><strong>€{sb.amount.toFixed(2)}</strong></div>
                    <div class="subs-dr"><span>Yearly cost</span><strong>€{(sb.amount * 12).toFixed(2)}</strong></div>
                    <div class="subs-dr">
                      <span>Status</span>
                      <span class="subs-status" class:subs-status--paid={sb.paidThisMonth}>
                        {sb.paidThisMonth ? 'Paid this month' : 'Unpaid'}
                      </span>
                    </div>
                    {#if sb.categoryName}<div class="subs-dr"><span>Category</span><strong>{sb.categoryName}</strong></div>{/if}
                    {#if sb.autoPay}<div class="subs-dr"><span>Auto-pay</span><strong>Yes</strong></div>{/if}
                  </div>

                  <div class="subs-detail-actions">
                    <button
                      class="subs-pay-btn"
                      class:subs-pay-btn--paid={sb.paidThisMonth}
                      onclick={() => { toggleBillPaid(sb.id); selectedBill = { ...sb, paidThisMonth: !sb.paidThisMonth }; }}
                    >
                      <CheckCircle2 size={15} />
                      {sb.paidThisMonth ? 'Mark Unpaid' : 'Mark as Paid'}
                    </button>
                    <button class="subs-del-btn" onclick={() => { deleteBill(sb.id); selectedBill = null; }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              {/if}

              <!-- Analytics card -->
              <div class="subs-analytics">
                <p class="subs-analytics-title">
                  {bills.filter(b => b.active).length} active subscription{bills.filter(b => b.active).length !== 1 ? 's' : ''}
                </p>
                <div class="subs-stats">
                  <div class="subs-stat">
                    <span class="subs-stat-lbl">Yearly forecast</span>
                    <span class="subs-stat-val">€{calYearlyTotal.toFixed(0)}</span>
                  </div>
                  <div class="subs-stat">
                    <span class="subs-stat-lbl">Average monthly</span>
                    <span class="subs-stat-val">€{calMonthlyTotal.toFixed(0)}</span>
                  </div>
                  <div class="subs-stat subs-stat--full">
                    <span class="subs-stat-lbl">Paid this month</span>
                    <span class="subs-stat-val">{calPaidCount}/{bills.length}</span>
                  </div>
                </div>

                <!-- Subscription list — sorted by due day -->
                <div class="subs-list">
                  {#each [...bills].sort((a, b) => a.dueDay - b.dueDay) as bill}
                    <button
                      class="subs-row"
                      class:subs-row--paid={bill.paidThisMonth}
                      class:subs-row--sel={selectedBill?.id === bill.id}
                      onclick={() => selectedBill = selectedBill?.id === bill.id ? null : bill}
                    >
                      <div class="subs-row-icon" style="background:{SUB_COLORS[bill.name] ?? '#6b7280'}">
                        <BrandIcon name={bill.name} size={13} class="bg-brand-mono" />
                      </div>
                      <div class="subs-row-info">
                        <span class="subs-row-name">{bill.name}</span>
                        <span class="subs-row-due">Day {bill.dueDay}</span>
                      </div>
                      <div class="subs-row-right">
                        <span class="subs-row-amt">€{bill.amount.toFixed(2)}</span>
                        {#if bill.paidThisMonth}
                          <CheckCircle2 size={12} color="#22c55e" />
                        {/if}
                      </div>
                    </button>
                  {/each}

                  {#if bills.length === 0}
                    <div class="subs-empty">
                      <CreditCard size={28} />
                      <p>No subscriptions yet.</p>
                      <p>Add Netflix, Spotify, Claude…</p>
                    </div>
                  {/if}
                </div>
              </div>
            </div>
          </div>
        </section>
      </section>

      <!-- Add subscription modal — popular services grid -->
      {#if showAddBill}
        <div class="bg-modal-overlay" use:modalLock in:fade={{ duration: 200 }} out:fade={{ duration: 150 }} onclick={() => showAddBill = false} onkeydown={(e) => { if (e.key === 'Escape') showAddBill = false; }}>
          <div class="bg-modal-sheet" in:fly={{ y: 20, duration: 300, opacity: 0, easing: cubicOut }} out:fly={{ y: 20, duration: 200, opacity: 0 }} onclick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="bg-modal-title-bill" tabindex="-1">
            <div class="bg-modal-handle"></div>
            <h3 id="bg-modal-title-bill">Add Subscription</h3>

            <!-- Popular services -->
            <div class="bg-popular-services">
              <span class="bg-popular-label">Popular services</span>
              <div class="bg-popular-grid">
                {#each POPULAR_SERVICES as svc}
                  <button class="bg-popular-btn" onclick={() => { newBill.name = svc.name; }}>
                    <span class="bg-popular-icon" style="background:{svc.color}"><BrandIcon name={svc.name} size={12} class="bg-brand-mono" /></span>
                    <span class="bg-popular-name">{svc.name}</span>
                  </button>
                {/each}
              </div>
            </div>

            <div class="bg-modal-form">
              <div class="bg-form-field">
                <label for="bill-name">Name</label>
                <input id="bill-name" type="text" bind:value={newBill.name} placeholder="e.g. Netflix, Spotify" />
              </div>
              <div class="bg-form-field">
                <label for="bill-amount">Amount (€)</label>
                <input id="bill-amount" type="number" step="0.01" min="0" bind:value={newBill.amount} placeholder="0.00" />
              </div>
              <div class="bg-form-field">
                <label for="bill-due">Billing day (1–31)</label>
                <input id="bill-due" type="number" min="1" max="31" bind:value={newBill.dueDay} />
              </div>
              <div class="bg-form-field">
                <label for="bill-cat">Category</label>
                <select id="bill-cat" bind:value={newBill.categoryId}>
                  <option value="">Uncategorized</option>
                  {#each categories as cat}
                    <option value={cat.id}>{cat.name}</option>
                  {/each}
                </select>
              </div>
              <label class="bg-checkbox-field">
                <input type="checkbox" bind:checked={newBill.autoPay} />
                <span>Auto-pay enabled</span>
              </label>
              <button class="bg-submit-btn" onclick={addBill} disabled={submittingBill}>
                {#if submittingBill}
                  <span class="bg-spinner"></span>
                {:else}
                  <CheckCircle2 size={15} />
                {/if}
                Add Subscription
              </button>
            </div>
          </div>
        </div>
      {/if}

    <!-- ══════════════════════════════════════════════════════════════════
         TAB: AI COSTS
         ══════════════════════════════════════════════════════════════════ -->
    {:else if selectedSection === 'AI Costs'}
      <section class="bg-page">
        <header class="bg-page__header">
          <div class="bg-page__intro">
            <div class="bg-page__eyebrow"><Bot size={13}/><span>{currentHeader.eyebrow}</span><Badge variant="outline">{aiEntries.length} entries</Badge></div>
            <h1>{currentHeader.title}</h1>
            <p>{currentHeader.subtitle}</p>
          </div>
          <div class="bg-page__actions">
            <Button onclick={() => { resetNewAi(); showAddAi = true; }}>
              <Plus size={16} /> Log AI Cost
            </Button>
          </div>
        </header>

        <section class="bg-body">
          {#if aiSummary.length > 0}
            <div class="bg-ai-summary-grid">
              {#each aiSummary as summary}
                <Card class="bg-ai-card">
                  <CardContent style="display: flex; flex-direction: column; gap: 8px;">
                    <div class="bg-ai-provider">
                      <Bot size={18} />
                      <span class="bg-ai-name">{summary.provider}</span>
                    </div>
                    <span class="bg-ai-total">€{summary.totalCost.toFixed(2)}</span>
                    <div class="bg-ai-tokens">
                      <span>Tokens: {(summary.totalTokensIn + summary.totalTokensOut).toLocaleString()}</span>
                      <span class="bg-ai-months">{summary.monthCount} {summary.monthCount === 1 ? 'month' : 'months'}</span>
                    </div>
                  </CardContent>
                </Card>
              {/each}
            </div>
          {:else}
            <div class="bg-empty-state">
              <Bot size={40} />
              <p>No AI costs logged this month. Track Claude, Cursor, OpenAI, Grok, etc.</p>
            </div>
          {/if}

          {#if aiEntries.length > 0}
            <Card class="bg-panel bg-panel--full-row" style="margin-top: 16px;">
              <CardContent style="padding: 0;">
                <Table.Root>
                  <Table.Caption>Recent AI cost entries</Table.Caption>
                  <Table.Header>
                    <Table.Row>
                      <Table.Head>Provider / Model</Table.Head>
                      <Table.Head class="text-right">Cost</Table.Head>
                      <Table.Head class="text-right">Tokens</Table.Head>
                      <Table.Head><span class="sr-only">Action</span></Table.Head>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {#each aiEntries as entry}
                      <Table.Row>
                        <Table.Cell>
                          <div class="flex items-center gap-2">
                            <span class="font-medium">{entry.provider}</span>
                            <span class="text-xs text-[var(--bg-muted)]">{entry.model}</span>
                            {#if entry.note}<span class="text-xs text-[var(--bg-muted)]">— {entry.note}</span>{/if}
                          </div>
                        </Table.Cell>
                        <Table.Cell class="text-right font-mono">€{entry.cost.toFixed(4)}</Table.Cell>
                        <Table.Cell class="text-right text-[var(--bg-muted)]">{(entry.tokensIn + entry.tokensOut).toLocaleString()}</Table.Cell>
                        <Table.Cell>
                          <button class="bg-icon-btn bg-icon-btn--danger" onclick={() => deleteAiCost(entry.id)}>
                            <Trash2 size={12} />
                          </button>
                        </Table.Cell>
                      </Table.Row>
                    {/each}
                  </Table.Body>
                </Table.Root>
              </CardContent>
            </Card>
          {/if}
        </section>
      </section>

      {#if showAddAi}
        <div class="bg-modal-overlay" use:modalLock in:fade={{ duration: 200 }} out:fade={{ duration: 150 }} onclick={() => showAddAi = false} onkeydown={(e) => { if (e.key === 'Escape') showAddAi = false; }}>
          <div class="bg-modal-sheet" in:fly={{ y: 20, duration: 300, opacity: 0, easing: cubicOut }} out:fly={{ y: 20, duration: 200, opacity: 0 }} onclick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="bg-modal-title-ai" tabindex="-1">
            <div class="bg-modal-handle"></div>
            <h3 id="bg-modal-title-ai">Log AI Cost</h3>
            <div class="bg-modal-form">
              <div class="bg-form-field">
                <label for="ai-provider">Provider</label>
                <select id="ai-provider" bind:value={newAi.provider}>
                  <option value="">Select provider…</option>
                  <option value="Claude">Claude (Anthropic)</option>
                  <option value="ChatGPT">ChatGPT (OpenAI)</option>
                  <option value="Cursor">Cursor</option>
                  <option value="Grok">Grok (xAI)</option>
                  <option value="Gemini">Gemini (Google)</option>
                  <option value="DeepSeek">DeepSeek</option>
                  <option value="GitHub Copilot">GitHub Copilot</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div class="bg-form-field">
                <label for="ai-model">Model</label>
                <input id="ai-model" type="text" bind:value={newAi.model} placeholder="e.g. claude-3.5-sonnet, gpt-4o" />
              </div>
              <div class="bg-form-field">
                <label for="ai-cost">Cost (€)</label>
                <input id="ai-cost" type="number" step="0.0001" min="0" bind:value={newAi.cost} placeholder="0.00" />
              </div>
              <div class="bg-form-row">
                <div class="bg-form-field bg-form-field--half">
                  <label for="ai-tokens-in">Tokens In</label>
                  <input id="ai-tokens-in" type="number" min="0" bind:value={newAi.tokensIn} />
                </div>
                <div class="bg-form-field bg-form-field--half">
                  <label for="ai-tokens-out">Tokens Out</label>
                  <input id="ai-tokens-out" type="number" min="0" bind:value={newAi.tokensOut} />
                </div>
              </div>
              <div class="bg-form-field">
                <label for="ai-date">Date</label>
                <input id="ai-date" type="date" bind:value={newAi.dateKey} />
              </div>
              <div class="bg-form-field">
                <label for="ai-note">Note</label>
                <input id="ai-note" type="text" bind:value={newAi.note} placeholder="What was this for?" />
              </div>
              <button class="bg-submit-btn" onclick={addAiCost} disabled={submittingAi}>
                {#if submittingAi}
                  <span class="bg-spinner"></span>
                {:else}
                  <CheckCircle2 size={16} />
                {/if}
                Log Cost
              </button>
            </div>
          </div>
        </div>
      {/if}

    <!-- ══════════════════════════════════════════════════════════════════
         TAB: FORECAST
         ══════════════════════════════════════════════════════════════════ -->
    {:else if selectedSection === 'Forecast'}
      <section class="bg-page">
        <header class="bg-page__header">
          <div class="bg-page__intro">
            <div class="bg-page__eyebrow"><LineChart size={13}/><span>{currentHeader.eyebrow}</span><Badge variant="outline">{forecastMonths} months</Badge></div>
            <h1>{currentHeader.title}</h1>
            <p>{currentHeader.subtitle}</p>
          </div>
          <div class="bg-page__actions">
          </div>
        </header>

        <section class="bg-body">
          {#if chartData.length === 0 && cashFlow.length === 0}
            <Card class="bg-panel">
              <CardContent>
                <div class="bg-empty-state">
                  <LineChart size={40} />
                  <p>Not enough data for forecasting. Add a few months of transactions first.</p>
                </div>
              </CardContent>
            </Card>
          {:else}
            <ForecastingChart
              data={chartData}
              months={forecastMonths}
              onMonthsChange={handleForecastMonthsChange}
            />
            <Card class="bg-panel bg-panel--full-row" style="margin-top: 16px;">
              <CardContent style="padding: 0;">
                <Table.Root>
                  <Table.Caption>Cash flow forecast for the next {forecastMonths} months.</Table.Caption>
                  <Table.Header>
                    <Table.Row>
                      <Table.Head>Month</Table.Head>
                      <Table.Head>Income</Table.Head>
                      <Table.Head>Expenses</Table.Head>
                      <Table.Head class="text-end">Balance</Table.Head>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {#each cashFlow as proj}
                      <Table.Row>
                        <Table.Cell class="font-medium">{proj.month}</Table.Cell>
                        <Table.Cell class="bg-tx-income">€{proj.projectedIncome.toFixed(0)}</Table.Cell>
                        <Table.Cell class="bg-tx-expense">€{proj.projectedExpenses.toFixed(0)}</Table.Cell>
                        <Table.Cell class="text-end font-semibold {proj.projectedBalance >= 0 ? 'bg-tx-income' : ''}">
                          €{proj.projectedBalance.toFixed(0)}
                        </Table.Cell>
                      </Table.Row>
                  {/each}
                  </Table.Body>
                  {#if cashFlow.length > 0}
                    {const last = cashFlow[cashFlow.length - 1]}
                    <Table.Footer>
                      <Table.Row>
                        <Table.Cell colspan={3}>Projected End Balance</Table.Cell>
                        <Table.Cell class="text-end font-bold {last.projectedBalance >= 0 ? 'bg-tx-income' : ''}">
                          €{last.projectedBalance.toFixed(0)}
                        </Table.Cell>
                      </Table.Row>
                    </Table.Footer>
                  {/if}
                </Table.Root>
              </CardContent>
            </Card>
          {/if}
        </section>
      </section>

    <!-- ══════════════════════════════════════════════════════════════════
         TAB: EXPORT
         ══════════════════════════════════════════════════════════════════ -->
    {:else if selectedSection === 'Export'}
      <section class="bg-page">
        <header class="bg-page__header">
          <div class="bg-page__intro">
            <div class="bg-page__eyebrow"><Download size={13}/><span>{currentHeader.eyebrow}</span><Badge variant="outline">CSV / PDF</Badge></div>
            <h1>{currentHeader.title}</h1>
            <p>{currentHeader.subtitle}</p>
          </div>
          <div class="bg-page__actions">
          </div>
        </header>

        <section class="bg-body">
          <div class="bg-grid bg-grid--2col">                <Card class="bg-export-card" role="button" tabindex={0} onclick={exportCsv} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') exportCsv(); }}>
              <CardHeader><CardTitle><Download size={22} /></CardTitle><CardTitle>Export as CSV</CardTitle></CardHeader>
              <CardContent>
                <p>Download all transactions for {thisMonth} as a CSV file. Compatible with Excel, Google Sheets, and accounting software.</p>
                <span class="bg-export-hint">Includes: date, type, amount, category, note, project</span>
              </CardContent>
            </Card>
            <Card class="bg-export-card" role="button" tabindex={0} onclick={exportPdf} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') exportPdf(); }}>
              <CardHeader><CardTitle><BarChart3 size={22} /></CardTitle><CardTitle>Monthly Report (PDF)</CardTitle></CardHeader>
              <CardContent>
                <p>Generate a comprehensive PDF report with charts, category breakdowns, health insights, and more.</p>
                <span class="bg-export-hint">Overview • Categories • Health • Bills • AI Costs • Forecast</span>
              </CardContent>
            </Card>
          </div>
        </section>
      </section>
    {/if}
  {/if}
</main>

<style>
  /* ═══════════════════════════════════════════════════════════════════
     BUDGET WORKSPACE — Health Card System Tokens
     ═══════════════════════════════════════════════════════════════════ */
  :global(.bg-workspace) {
    --bg-accent:             #e05a3a;
    --bg-green:              #22c55e;
    --bg-red:                #ef4444;
    --bg-amber:              #f59e0b;
    --bg-bg:                 var(--background);
    --bg-surface:            color-mix(in srgb, var(--surface) 96%, var(--background));
    --bg-surface-strong:     color-mix(in srgb, var(--surface) 88%, var(--background));
    --bg-border:             color-mix(in srgb, var(--border) 86%, transparent);
    --bg-ink:                var(--foreground);
    --bg-muted:              var(--muted);

    /* Easing curves (Emil: stronger than built-in) */
    --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
    --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);

    /* Typography: no faked weights, font smoothing */
    font-synthesis: none;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;

    height:     100%;
    background: var(--bg-bg);
    color:      var(--bg-ink);
    overflow:   hidden;
    font-family: var(--font-body);
    box-sizing: border-box;
  }

  /* Selection style (better-typography: subtle brand hint) */
  :global(.bg-workspace) ::selection {
    background: color-mix(in srgb, var(--bg-accent) 25%, transparent);
    color: var(--bg-ink);
  }

  /* Interface chrome: user-select none on interactive controls */
  :global(.bg-workspace) button,
  :global(.bg-workspace) [role="button"],
  :global(.bg-workspace) input,
  :global(.bg-workspace) select {
    user-select: none;
  }

  /* ── Page Layout ──────────────────────────────────────────────────── */
  :global(.bg-page) {
    display:             grid;
    grid-template-rows:  auto auto minmax(0, 1fr);
    gap:                 18px;
    height:              100%;
    min-height:          0;
    padding:             28px 30px;
    box-sizing:          border-box;
    overflow:            hidden;
  }

  :global(.bg-page__header) {
    display: flex; justify-content: space-between; align-items: flex-start; gap: 20px;
  }
  :global(.bg-page__intro) { max-width: 56rem; }
  :global(.bg-page__eyebrow) {
    display: flex; align-items: center; gap: 10px; margin-bottom: 12px;
    color: var(--bg-muted); font-size: 0.82rem; letter-spacing: 0.18em; text-transform: uppercase;
  }
  :global(.bg-page__intro) h1 { margin: 0; font-size: clamp(1.7rem, 2.5vw, 2.6rem); line-height: 1.05; letter-spacing: -0.02em; text-wrap: balance; }
  :global(.bg-page__intro) p  { margin: 12px 0 0; max-width: 42rem; color: var(--bg-muted); font-size: 0.97rem; line-height: 1.55; text-wrap: pretty; }
  :global(.bg-page__actions) { display: flex; gap: 12px; flex-shrink: 0; align-items: center; }

  /* ── Hero Grid ──────────────────────────────────────────────────── */
  :global(.bg-hero-grid) {
    display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 16px; min-height: 0;
  }

  :global(.bg-score-card),
  :global(.bg-hero-card),
  :global(.bg-panel) {
    border-color: var(--bg-border);
    background: linear-gradient(180deg,
      color-mix(in srgb, var(--bg-surface) 98%, var(--bg-bg)),
      color-mix(in srgb, var(--bg-surface) 86%, var(--bg-bg)));
  }

  :global(.bg-score-card__content) {
    display: grid; grid-template-columns: auto 1fr; gap: 20px; align-items: center;
  }

  :global(.bg-score-orb) {
    display: grid; place-items: center; width: 80px; aspect-ratio: 1;
    border-radius: 999px; flex-shrink: 0;
    background: color-mix(in srgb, var(--bg-accent) 14%, var(--bg-surface));
    color: var(--bg-accent);
  }
  :global(.bg-orb--income) {
    background: color-mix(in srgb, var(--bg-green) 14%, var(--bg-surface));
    color: var(--bg-green);
  }

  :global(.bg-score-meta) { display: grid; grid-template-columns: repeat(2, 1fr); gap: 9px; }
  :global(.bg-score-meta) > div {
    display: flex; flex-direction: column; gap: 2px; padding: 10px 12px;
    border-radius: 14px; border: 1px solid color-mix(in srgb, var(--bg-border) 80%, transparent);
    background: color-mix(in srgb, var(--bg-surface-strong) 88%, transparent);
  }
  :global(.bg-score-meta) strong { font-size: 0.93rem; font-weight: 600; font-variant-numeric: tabular-nums; }
  :global(.bg-score-meta) span   { color: var(--bg-muted); font-size: 0.72rem; }

  :global(.bg-hero-list) { display: grid; gap: 7px; }
  :global(.bg-hero-list) article {
    padding: 11px 14px; border: 1px solid color-mix(in srgb, var(--bg-border) 88%, transparent);
    border-radius: 13px; background: color-mix(in srgb, var(--bg-surface-strong) 88%, transparent); display: grid; gap: 4px;
  }
  :global(.bg-hero-list) span   { color: var(--bg-muted); font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.1em; }
  :global(.bg-hero-list) strong { font-size: 0.93rem; font-weight: 600; }

  :global(.bg-hero-bar) {
    height: 5px; border-radius: 999px;
    background: color-mix(in srgb, var(--bg-border) 70%, transparent); overflow: hidden;
  }
  :global(.bg-hero-bar) i {
    display: block; width: var(--fill); height: 100%; border-radius: inherit;
    background: linear-gradient(90deg, var(--bg-accent), color-mix(in srgb, var(--accent) 40%, var(--bg-accent)));
  }

  /* ── Body ────────────────────────────────────────────────────────── */
  :global(.bg-body) { min-height: 0; overflow: auto; }
  :global(.bg-grid) { display: grid; gap: 16px; }
  :global(.bg-grid--2col) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  :global(.bg-panel) { display: flex; flex-direction: column; }
  :global(.bg-panel--full-row) { grid-column: 1 / -1; }

  /* ── Utils ───────────────────────────────────────────────────────── */
  :global(.bg-expense) { color: var(--bg-red); }
  :global(.bg-savings) { color: var(--bg-accent); }
  :global(.bg-muted)   { color: var(--bg-muted); font-size: 0.83rem; }

  /* ── Top Categories ────────────────────────────────────────────── */
  :global(.bg-top-cats) { display: flex; flex-direction: column; gap: 10px; }
  :global(.bg-top-cat-item) {
    display: flex; justify-content: space-between; align-items: center; gap: 12px;
  }
  :global(.bg-top-cat-left) { display: flex; align-items: center; gap: 8px; min-width: 120px; }
  :global(.bg-cat-dot) { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  :global(.bg-cat-name) { font-size: 13px; font-weight: 500; }
  :global(.bg-top-cat-right) { display: flex; align-items: center; gap: 12px; flex: 1; }
  :global(.bg-cat-bar-track) {
    flex: 1; height: 6px;
    background: color-mix(in srgb, var(--bg-border) 70%, transparent);
    border-radius: 3px; overflow: hidden;
  }
  :global(.bg-cat-bar-fill) { height: 100%; border-radius: 3px; transition: width 0.6s ease; }
  :global(.bg-cat-amount) { font-size: 13px; font-weight: 600; min-width: 60px; text-align: right; }

  /* ── Month Input ─────────────────────────────────────────────────── */
  :global(.bg-month-input) {
    background: var(--bg-surface);
    border: 1px solid var(--bg-border);
    padding: 8px 12px; border-radius: 10px;
    color: var(--bg-ink); font-size: 13px; font-weight: 500;
  }

  /* ── Transaction table ─────────────────────────────────────────── */
  :global(.bg-tx-dot) { width: 8px; height: 8px; border-radius: 50%; display: inline-block; vertical-align: middle; margin-right: 4px; }
  :global(.bg-tx-income) { color: var(--bg-green); }
  :global(.bg-tx-expense) { color: var(--bg-red); }
  :global(.bg-tx-income-row) { background: color-mix(in srgb, var(--bg-green) 6%, transparent); }
  :global(.bg-icon-btn) {
    background: transparent; border: none; color: var(--bg-muted);
    cursor: pointer; width: 40px; height: 40px; border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    transition: transform 160ms var(--ease-out), background 160ms var(--ease-out), color 160ms var(--ease-out);
    -webkit-tap-highlight-color: transparent;
  }
  @media (hover: hover) and (pointer: fine) {
    :global(.bg-icon-btn:hover) { background: color-mix(in srgb, var(--bg-ink) 8%, var(--bg-surface)); color: var(--bg-ink); }
    :global(.bg-icon-btn--danger:hover) { color: var(--bg-red); background: color-mix(in srgb, var(--bg-red) 12%, transparent); }
  }
  :global(.bg-icon-btn:active) {
    transform: scale(0.96);
  }

  /* ── Budget Groups ──────────────────────────────────────────────── */
  :global(.bg-budget-group) { margin-bottom: 24px; }
  :global(.bg-group-title) {
    font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;
    color: var(--bg-muted); margin: 0 0 10px 4px;
  }
  :global(.bg-budget-cards) { display: flex; flex-direction: column; gap: 8px; }
  :global(.bg-budget-card) {
    border-color: color-mix(in srgb, var(--bg-border) 88%, transparent);
  }
  @media (hover: hover) and (pointer: fine) {
    :global(.bg-budget-card:hover) { border-color: color-mix(in srgb, var(--bg-cat-color) 40%, var(--bg-border)); }
  }
  :global(.bg-budget-card-header) {
    display: flex; align-items: center; gap: 8px;
  }
  :global(.bg-budget-cat-name) { flex: 1; font-size: 14px; font-weight: 600; }
  :global(.bg-budget-cat-amount) { font-size: 13px; font-weight: 700; }
  :global(.bg-edit-budget-btn) {
    background: none; border: none; color: var(--bg-muted); cursor: pointer;
    transition: transform 160ms var(--ease-out), color 160ms var(--ease-out);
    -webkit-tap-highlight-color: transparent;
  }
  @media (hover: hover) and (pointer: fine) {
    :global(.bg-edit-budget-btn:hover) { color: var(--bg-ink); }
  }
  :global(.bg-edit-budget-btn:active) {
    transform: scale(0.96);
  }
  :global(.bg-budget-bar-track) {
    height: 6px;
    background: color-mix(in srgb, var(--bg-border) 70%, transparent);
    border-radius: 3px; overflow: hidden;
  }
  :global(.bg-budget-bar-fill) {
    height: 100%; background: var(--bg-cat-color); border-radius: 3px; transition: width 0.6s ease;
  }
  :global(.bg-budget-bar--over) { background: var(--bg-red); }
  :global(.bg-budget-card-footer) {
    display: flex; justify-content: space-between; font-size: 12px; color: var(--bg-muted);
  }
  :global(.bg-remaining-pos) { color: var(--bg-green); }
  :global(.bg-remaining-neg) { color: var(--bg-red); }
  :global(.bg-budget-edit) {
    display: flex; gap: 8px; padding-top: 10px; border-top: 1px solid var(--bg-border);
  }
  :global(.bg-budget-edit) input {
    flex: 1; background: var(--bg-bg); border: 1px solid var(--bg-border);
    padding: 6px 10px; border-radius: 8px; color: var(--bg-ink); font-size: 13px;
  }
  :global(.bg-save-mini) {
    padding: 8px 16px; height: 40px; border-radius: 10px; border: none;
    background: var(--bg-accent); color: white; font-size: 12px; font-weight: 600; cursor: pointer;
    transition: transform 160ms var(--ease-out), background 160ms var(--ease-out);
    -webkit-tap-highlight-color: transparent;
  }
  :global(.bg-save-mini:active) {
    transform: scale(0.96);
  }

  /* ── Loading & Empty ────────────────────────────────────────────── */
  :global(.bg-loading) {
    display: flex !important; flex-direction: column; align-items: center; justify-content: center; gap: 20px;
  }
  :global(.bg-loading__orb) {
    width: 48px; height: 48px; border-radius: 999px;
    border: 3px solid color-mix(in srgb, var(--bg-accent) 30%, transparent);
    border-top-color: var(--bg-accent);
    animation: bg-spin 0.8s linear infinite;
  }
  :global(.bg-loading) span { color: var(--bg-muted); font-size: 0.9rem; }
  @keyframes bg-spin { to { transform: rotate(360deg); } }
  :global(.bg-empty-state) {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 60px 20px; color: var(--bg-muted); gap: 12px; text-align: center;
  }
  :global(.bg-empty-state svg) { opacity: 0.4; }

  /* ── Error ────────────────────────────────────────────────────────── */
  :global(.bg-error-banner) {
    display: flex; align-items: center; gap: 10px; margin: 12px 30px 0;
    padding: 10px 16px; border-radius: 12px;
    background: color-mix(in srgb, var(--bg-red) 12%, transparent); color: var(--bg-red); font-size: 13px;
  }
  :global(.bg-dismiss-btn) {
    margin-left: auto; background: none; border: none; color: inherit; cursor: pointer; font-size: 18px;
    width: 32px; height: 32px; display: grid; place-items: center;
    transition: transform 160ms var(--ease-out);
    -webkit-tap-highlight-color: transparent;
  }
  :global(.bg-dismiss-btn:active) {
    transform: scale(0.96);
  }

  /* ── AI Costs ──────────────────────────────────────────────────── */
  :global(.bg-ai-summary-grid) {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px;
  }
  :global(.bg-ai-card) {
    border-color: color-mix(in srgb, var(--bg-border) 88%, transparent);
  }
  :global(.bg-ai-provider) { display: flex; align-items: center; gap: 8px; }
  :global(.bg-ai-name) { font-size: 13px; font-weight: 600; }
  :global(.bg-ai-total) { font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums; }
  :global(.bg-ai-tokens) { font-size: 12px; color: var(--bg-muted); display: flex; flex-direction: column; gap: 2px; }
  :global(.bg-ai-months) { font-size: 11px; }

  /* ── Export Cards ──────────────────────────────────────────────── */
  :global(.bg-export-card) {
    cursor: pointer;
    transition: transform 160ms var(--ease-out), border-color 160ms var(--ease-out);
    border-color: var(--bg-border);
    -webkit-tap-highlight-color: transparent;
  }
  @media (hover: hover) and (pointer: fine) {
    :global(.bg-export-card:hover) { border-color: var(--bg-accent); }
  }
  :global(.bg-export-card:active) {
    transform: scale(0.97);
  }
  :global(.bg-export-card) p { margin: 0; font-size: 13px; color: var(--bg-muted); line-height: 1.5; }
  :global(.bg-export-hint) { font-size: 11px; color: var(--bg-muted); font-style: italic; }

  /* ── Modals ─────────────────────────────────────────────────────── */
  :global(.bg-modal-overlay) {
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: color-mix(in srgb, var(--bg-bg) 70%, transparent);
    backdrop-filter: blur(4px); z-index: 100;
    display: flex; align-items: center; justify-content: center;
  }

  :global(.bg-modal-sheet) {
    background: var(--bg-surface); border: 1px solid var(--bg-border);
    width: min(440px, 92vw); max-height: 85vh; overflow-y: auto;
    border-radius: 24px; padding: 24px 28px 32px;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  :global(.bg-modal-sheet)::-webkit-scrollbar {
    width: 0;
    height: 0;
  }

  :global(.bg-modal-handle) {
    width: 40px; height: 4px; background: var(--bg-border); border-radius: 4px; margin: 0 auto 20px;
  }
  :global(.bg-modal-sheet) h3 { margin: 0 0 20px; font-size: 18px; text-align: center; font-weight: 700; }
  :global(.bg-modal-form) { display: flex; flex-direction: column; gap: 14px; }
  :global(.bg-form-field) { display: flex; flex-direction: column; gap: 4px; }
  :global(.bg-form-field) label { font-size: 12px; font-weight: 600; color: var(--bg-muted); }
  :global(.bg-field-hint) { font-weight: 400; opacity: 0.7; }
  :global(.bg-form-field) input, :global(.bg-form-field) select {
    background: var(--bg-bg); border: 1px solid var(--bg-border);
    padding: 10px 14px; border-radius: 10px; color: var(--bg-ink); font-size: 14px;
    outline: none; transition: border-color 0.2s;
  }
  :global(.bg-form-field) input:focus, :global(.bg-form-field) select:focus { border-color: var(--bg-accent); }
  :global(.bg-form-row) { display: flex; gap: 10px; }
  :global(.bg-form-field--half) { flex: 1; }
  :global(.bg-checkbox-field) {
    display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer;
  }
  :global(.bg-checkbox-field) input[type="checkbox"] { accent-color: var(--bg-accent); }
  :global(.bg-type-toggle) { display: flex; gap: 8px; }
  :global(.bg-type-btn) {
    flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
    height: 40px; padding: 0 10px; border-radius: 10px; border: 1px solid var(--bg-border);
    background: transparent; color: var(--bg-muted); font-size: 13px; font-weight: 600;
    cursor: pointer;
    transition: transform 160ms var(--ease-out), background 160ms var(--ease-out), border-color 160ms var(--ease-out);
    -webkit-tap-highlight-color: transparent;
  }
  :global(.bg-type-btn--active) {
    background: var(--bg-accent); color: white; border-color: var(--bg-accent);
  }
  :global(.bg-type-btn:active) {
    transform: scale(0.96);
  }
  :global(.bg-submit-btn) {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    padding: 12px; min-height: 44px; border-radius: 12px; border: none;
    background: var(--bg-accent); color: white; font-size: 14px; font-weight: 700;
    cursor: pointer; margin-top: 4px;
    transition: transform 160ms var(--ease-out), background 160ms var(--ease-out);
    -webkit-tap-highlight-color: transparent;
  }
  @media (hover: hover) and (pointer: fine) {
    :global(.bg-submit-btn:hover) { background: color-mix(in srgb, var(--bg-accent) 85%, #0a0a0a); }
  }
  :global(.bg-submit-btn:active) {
    transform: scale(0.96);
  }
  :global(.bg-submit-btn:disabled) {
    opacity: 0.7;
    cursor: default;
    pointer-events: none;
  }
  :global(.bg-submit-btn:disabled:active) {
    transform: none;
  }

  /* ── Submit spinner ─────────────────────────────────────────────── */
  :global(.bg-spinner) {
    display: inline-block;
    width: 16px;
    height: 16px;
    border-radius: 999px;
    border: 2px solid color-mix(in srgb, white 60%, transparent);
    border-top-color: white;
    animation: bg-spin 0.6s linear infinite;
  }

  /* ── Bills — Subscription Day Calendar ────────────────────────── */
  :global(.subs-shell) {
    display: grid; grid-template-columns: 1fr 320px; gap: 20px; height: 100%;
  }
  :global(.subs-cal-pane) {
    display: flex; flex-direction: column; gap: 12px;
    padding: 20px; border: none; border-radius: 20px;
    background: linear-gradient(180deg, color-mix(in srgb, var(--bg-surface) 98%, var(--bg-bg)), color-mix(in srgb, var(--bg-surface) 86%, var(--bg-bg)));
  }
  :global(.subs-month-hd) {
    display: flex; justify-content: space-between; align-items: center;
  }
  :global(.subs-month-left) { display: flex; align-items: center; gap: 12px; }
  :global(.subs-month-name) { font-size: 17px; font-weight: 700; }
  :global(.subs-badge) {
    font-size: 11px; font-weight: 600; padding: 2px 10px; border-radius: 100px;
  }
  :global(.subs-badge--paid) { background: color-mix(in srgb, var(--bg-green) 15%, transparent); color: var(--bg-green); }
  :global(.subs-badge--unpaid) { background: color-mix(in srgb, var(--bg-amber) 15%, transparent); color: var(--bg-amber); }
  :global(.subs-month-total) { text-align: right; }
  :global(.subs-total-amt) { font-size: 22px; font-weight: 800; font-variant-numeric: tabular-nums; }
  :global(.subs-total-label) { font-size: 11px; color: var(--bg-muted); margin-left: 4px; }
  :global(.subs-dow) {
    display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px;
    text-align: center; font-size: 11px; font-weight: 600; color: var(--bg-muted); text-transform: uppercase;
  }
  :global(.subs-grid) {
    display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px;
  }
  :global(.subs-cell) {
    aspect-ratio: 1; display: flex; flex-direction: column; align-items: center;
    padding: 4px; border-radius: 16px; position: relative; gap: 2px;
  }
  :global(.subs-cell--empty) { opacity: 0; }
  :global(.subs-cell--today) { background: color-mix(in srgb, var(--bg-accent) 12%, transparent); }
  :global(.subs-cell--active) { background: color-mix(in srgb, var(--bg-surface-strong) 88%, transparent); }
  :global(.subs-day-num) {
    font-size: 13px; font-weight: 600; line-height: 1;
  }
  :global(.subs-day-num--today) { color: var(--bg-accent); font-weight: 800; }
  :global(.subs-badges) {
    display: flex; gap: 2px; flex-wrap: wrap; justify-content: center;
  }
  :global(.subs-sqircle) {
    width: 26px; height: 26px; border-radius: 999px; border: none;
    color: white; font-size: 10px; font-weight: 700; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: transform 160ms var(--ease-out), opacity 160ms var(--ease-out);
    -webkit-tap-highlight-color: transparent;
  }
  @media (hover: hover) and (pointer: fine) {
    :global(.subs-sqircle:hover) { transform: scale(1.15); }
  }
  :global(.subs-sqircle--paid) { opacity: 0.4; }
  :global(.subs-sqircle:active) {
    transform: scale(0.96);
  }
  :global(.subs-overflow) { font-size: 9px; color: var(--bg-muted); font-weight: 600; }
  :global(.subs-add-btn) {
    display: flex; align-items: center; gap: 6px; justify-content: center;
    padding: 10px; min-height: 40px; border-radius: 12px; border: 1px dashed var(--bg-border);
    background: transparent; color: var(--bg-muted); font-size: 13px; font-weight: 600;
    cursor: pointer; margin-top: auto;
    transition: transform 160ms var(--ease-out), border-color 160ms var(--ease-out), color 160ms var(--ease-out);
    -webkit-tap-highlight-color: transparent;
  }
  @media (hover: hover) and (pointer: fine) {
    :global(.subs-add-btn:hover) { border-color: var(--bg-accent); color: var(--bg-accent); }
  }
  :global(.subs-add-btn:active) {
    transform: scale(0.96);
  }

  :global(.subs-side) { display: flex; flex-direction: column; gap: 12px; overflow-y: auto; }
  :global(.subs-detail) {
    padding: 18px; border-radius: 20px;
    border: none;
    background: linear-gradient(180deg, color-mix(in srgb, var(--sb) 10%, var(--bg-surface)), color-mix(in srgb, var(--sb) 6%, var(--bg-surface)));
  }
  :global(.subs-detail-hd) { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
  :global(.subs-detail-icon) {
    width: 40px; height: 40px; border-radius: 999px;
    display: flex; align-items: center; justify-content: center;
    font-size: 16px; font-weight: 700;
  }
  :global(.subs-detail-meta) { flex: 1; }
  :global(.subs-detail-name) { font-size: 16px; font-weight: 700; display: block; }
  :global(.subs-detail-cycle) { font-size: 12px; color: var(--bg-muted); }
  :global(.subs-close) {
    width: 36px; height: 36px; border-radius: 999px; border: none;
    background: transparent; color: var(--bg-muted); font-size: 18px;
    cursor: pointer; display: grid; place-items: center;
    transition: transform 160ms var(--ease-out), background 160ms var(--ease-out);
    -webkit-tap-highlight-color: transparent;
  }
  @media (hover: hover) and (pointer: fine) {
    :global(.subs-close:hover) { background: color-mix(in srgb, var(--bg-ink) 8%, transparent); }
  }
  :global(.subs-close:active) {
    transform: scale(0.96);
  }
  :global(.subs-detail-rows) { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
  :global(.subs-dr) {
    display: flex; justify-content: space-between; font-size: 13px;
    padding: 4px 0; border-bottom: 1px solid color-mix(in srgb, var(--bg-border) 60%, transparent);
  }
  :global(.subs-dr) span { color: var(--bg-muted); }
  :global(.subs-status) { font-size: 12px; font-weight: 600; }
  :global(.subs-status--paid) { color: var(--bg-green); }
  :global(.subs-detail-actions) { display: flex; gap: 8px; }
  :global(.subs-pay-btn) {
    flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
    padding: 10px; min-height: 40px; border-radius: 12px; border: 1px solid var(--bg-border);
    background: transparent; color: var(--bg-ink); font-size: 13px; font-weight: 600;
    cursor: pointer;
    transition: transform 160ms var(--ease-out), border-color 160ms var(--ease-out), color 160ms var(--ease-out);
    -webkit-tap-highlight-color: transparent;
  }
  @media (hover: hover) and (pointer: fine) {
    :global(.subs-pay-btn:hover) { border-color: var(--bg-green); color: var(--bg-green); }
  }
  :global(.subs-pay-btn--paid) {
    background: color-mix(in srgb, var(--bg-green) 12%, transparent);
    border-color: var(--bg-green); color: var(--bg-green);
  }
  :global(.subs-pay-btn:active) {
    transform: scale(0.96);
  }
  :global(.subs-del-btn) {
    width: 40px; height: 40px; border-radius: 12px; border: 1px solid var(--bg-border);
    background: transparent; color: var(--bg-muted); cursor: pointer;
    display: grid; place-items: center;
    transition: transform 160ms var(--ease-out), border-color 160ms var(--ease-out), color 160ms var(--ease-out);
    -webkit-tap-highlight-color: transparent;
  }
  @media (hover: hover) and (pointer: fine) {
    :global(.subs-del-btn:hover) { border-color: var(--bg-red); color: var(--bg-red); }
  }
  :global(.subs-del-btn:active) {
    transform: scale(0.96);
  }

  :global(.subs-analytics) {
    padding: 18px; border-radius: 20px;
    border: none;
    background: linear-gradient(180deg, color-mix(in srgb, var(--bg-surface) 98%, var(--bg-bg)), color-mix(in srgb, var(--bg-surface) 86%, var(--bg-bg)));
  }
  :global(.subs-analytics-title) { font-size: 15px; font-weight: 700; margin: 0 0 12px; }
  :global(.subs-stats) { display: grid; gap: 8px; margin-bottom: 16px; }
  :global(.subs-stat) {
    display: flex; justify-content: space-between; align-items: center;
    padding: 8px 12px; border-radius: 12px;
    background: color-mix(in srgb, var(--bg-surface-strong) 88%, transparent);
  }
  :global(.subs-stat--full) { grid-column: 1 / -1; }
  :global(.subs-stat-lbl) { font-size: 12px; color: var(--bg-muted); }
  :global(.subs-stat-val) { font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums; }
  :global(.subs-list) { display: flex; flex-direction: column; gap: 6px; max-height: 280px; overflow-y: auto; }
  :global(.subs-row) {
    display: flex; align-items: center; gap: 10px; width: 100%;
    padding: 10px 12px; border-radius: 12px; border: 1px solid transparent;
    background: color-mix(in srgb, var(--bg-surface-strong) 88%, transparent);
    cursor: pointer; text-align: left; font: inherit;
    transition: transform 160ms var(--ease-out), border-color 160ms var(--ease-out);
    -webkit-tap-highlight-color: transparent;
  }
  @media (hover: hover) and (pointer: fine) {
    :global(.subs-row:hover) { border-color: color-mix(in srgb, var(--bg-border) 88%, transparent); }
  }
  :global(.subs-row--sel) { border-color: var(--bg-accent); }
  :global(.subs-row--paid) { opacity: 0.72; }
  :global(.subs-row:active) {
    transform: scale(0.97);
  }
  :global(.subs-row-icon) {
    width: 28px; height: 28px; border-radius: 999px;
    display: flex; align-items: center; justify-content: center;
    color: white; font-size: 12px; font-weight: 700; flex-shrink: 0;
  }
  :global(.subs-row-info) { flex: 1; }
  :global(.subs-row-name) { font-size: 13px; font-weight: 600; display: block; }
  :global(.subs-row-due) { font-size: 11px; color: var(--bg-muted); }
  :global(.subs-row-right) { display: flex; align-items: center; gap: 6px; }
  :global(.subs-row-amt) { font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums; }
  :global(.subs-empty) {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 8px; padding: 30px 20px; color: var(--bg-muted); text-align: center;
  }

  /* ── Popular Services (Bills) ──────────────────────────────────── */
  :global(.bg-popular-services) { margin-bottom: 16px; }
  :global(.bg-popular-label) {
    font-size: 11px; font-weight: 600; color: var(--bg-muted); text-transform: uppercase;
    letter-spacing: 0.05em; display: block; margin-bottom: 8px;
  }
  :global(.bg-popular-grid) { display: flex; flex-wrap: wrap; gap: 6px; }
  :global(.bg-popular-btn) {
    display: flex; align-items: center; gap: 6px; padding: 6px 12px; min-height: 32px;
    border: 1px solid var(--bg-border); border-radius: 100px;
    background: color-mix(in srgb, var(--bg-surface-strong) 88%, transparent);
    color: var(--bg-ink); font-size: 12px; cursor: pointer;
    transition: transform 160ms var(--ease-out), border-color 160ms var(--ease-out), background 160ms var(--ease-out);
    -webkit-tap-highlight-color: transparent;
  }
  @media (hover: hover) and (pointer: fine) {
    :global(.bg-popular-btn:hover) { border-color: var(--bg-accent); }
  }
  :global(.bg-popular-btn:active) {
    transform: scale(0.96);
  }
  :global(.bg-popular-icon) {
    width: 22px; height: 22px; border-radius: 6px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }

  /* ── Brand SVG mono filter (white on brand-color bg) ──────────── */
  :global(.bg-brand-mono) {
    filter: brightness(0) invert(1);
  }
  :global(.bg-popular-name) { font-weight: 500; }

  /* ── Reduced Motion ────────────────────────────────────────────── */
  @media (prefers-reduced-motion: reduce) {
    :global(.bg-icon-btn),
    :global(.bg-edit-budget-btn),
    :global(.bg-save-mini),
    :global(.bg-type-btn),
    :global(.bg-submit-btn),
    :global(.bg-export-card),
    :global(.bg-dismiss-btn),
    :global(.bg-popular-btn),
    :global(.subs-sqircle),
    :global(.subs-add-btn),
    :global(.subs-close),
    :global(.subs-pay-btn),
    :global(.subs-del-btn),
    :global(.subs-row) {
      transition: none !important;
    }
    :global(.bg-icon-btn:active),
    :global(.bg-edit-budget-btn:active),
    :global(.bg-save-mini:active),
    :global(.bg-type-btn:active),
    :global(.bg-submit-btn:active),
    :global(.bg-export-card:active),
    :global(.bg-dismiss-btn:active),
    :global(.bg-popular-btn:active),
    :global(.subs-sqircle:active),
    :global(.subs-add-btn:active),
    :global(.subs-close:active),
    :global(.subs-pay-btn:active),
    :global(.subs-del-btn:active),
    :global(.subs-row:active) {
      transform: none !important;
    }
    :global(.bg-loading__orb) {
      animation: none;
    }
    :global(.subs-sqircle:hover) {
      transform: none !important;
    }
  }

  /* ── Responsive ────────────────────────────────────────────────── */
  @media (max-width: 768px) {
    :global(.bg-page) { padding: 20px 16px; }
    :global(.bg-hero-grid) { grid-template-columns: 1fr; }
    :global(.bg-grid--2col) { grid-template-columns: 1fr; }
    :global(.bg-ai-summary-grid) { grid-template-columns: 1fr; }
    :global(.bg-score-card__content) { grid-template-columns: 1fr; text-align: center; }
    :global(.bg-score-meta) { grid-template-columns: repeat(2, 1fr); }
  }
</style>
