<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import {
    Wallet, TrendingUp, TrendingDown, PiggyBank, Home, ShoppingCart, Car, Zap,
    UtensilsCrossed, Tv, ShoppingBag, Activity, BookOpen, Bot, Ellipsis,
    Plus, Trash2, CheckCircle2, Download, Sparkles, ArrowRight, AlertCircle,
    Calendar, DollarSign, BarChart3, Target, Receipt, CreditCard, LineChart,
    Landmark, TrendingUp as TrendingUpIcon
  } from 'lucide-svelte';
  import { getModuleSectionLabel, ensureModuleSection, moduleSectionStore } from '$lib/stores/module-sections.store';
  import ForecastingChart from './ForecastingChart.svelte';
  import * as Table from '$lib/components/ui/table/index.js';

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
  interface FinancialHealth {
    score: number; savingsRateGrade: string; budgetAdherence: string;
    billPaymentRate: string; debtIncomeRatio: string; insights: string[];
  }
  interface SuggestedBudget {
    categoryId: string; categoryName: string; groupName: string;
    icon: string; color: string;
    averageSpent: number; suggestedBudget: number;
    currentBudget: number; monthsOfData: number;
  }
  interface CashFlowProjection {
    month: string; projectedIncome: number; projectedExpenses: number; projectedBalance: number;
  }
  interface ForecastChartMonth {
    month: string; incomeActual: number; expensesActual: number;
    incomeForecast: number; expensesForecast: number; isForecast: boolean;
  }
  interface CrossModuleSpending {
    grocerySpending: number; readingSpending: number; aiCostTotal: number; totalCrossModule: number;
  }

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
  let health = $state<FinancialHealth | null>(null);
  let crossModule = $state<CrossModuleSpending | null>(null);

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
    { name: 'Netflix',         color: '#E50914', icon: '🎬' },
    { name: 'Spotify',         color: '#1DB954', icon: '🎵' },
    { name: 'YouTube Premium', color: '#FF0000', icon: '▶️' },
    { name: 'Claude',          color: '#D97706', icon: '🤖' },
    { name: 'ChatGPT',         color: '#10A37F', icon: '💬' },
    { name: 'Cursor',          color: '#6366f1', icon: '⌨️' },
    { name: 'iCloud+',         color: '#3693F3', icon: '☁️' },
    { name: 'GitHub Copilot',  color: '#181717', icon: '🐙' },
    { name: 'Notion',          color: '#000000', icon: '📝' },
    { name: 'Figma',           color: '#F24E1E', icon: '🎨' },
    { name: 'Linear',          color: '#5E6AD2', icon: '📋' },
    { name: 'Duolingo',        color: '#58CC02', icon: '🦉' },
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

  // ── Suggestions state ─────────────────────────────────────────────────
  let suggestedLimits = $state<SuggestedBudget[]>([]);
  let showSuggestions = $state(false);
  let loadingSuggestions = $state(false);

  // ── Form state ─────────────────────────────────────────────────────
  let showAddTx = $state(false);
  let showAddBill = $state(false);
  let showAddAi = $state(false);
  let showEditBudget = $state<string | null>(null);

  // New transaction form
  let newTx = $state({ categoryId: '', amount: 0, txType: 'expense', note: '', dateKey: new Date().toISOString().slice(0, 10), project: '', recurring: false });
  // New bill form
  let newBill = $state({ name: '', amount: 0, dueDay: 1, categoryId: '', autoPay: false });
  // New AI cost form
  let newAi = $state({ provider: '', model: '', cost: 0, tokensIn: 0, tokensOut: 0, dateKey: new Date().toISOString().slice(0, 10), note: '' });

  // ── Derived ───────────────────────────────────────────────────────
  let thisMonth = $derived(new Date().toISOString().slice(0, 7));

  let healthColor = $derived.by(() => {
    if (!health) return '#6b7280';
    if (health.score >= 80) return '#22c55e';
    if (health.score >= 60) return '#f59e0b';
    if (health.score >= 40) return '#f97316';
    return '#ef4444';
  });

  let isEditorial = $derived(health && health.score >= 60 ? 'positive' : 'needs-attention');

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
        loadHealth().catch(e => { console.error('health', e); return null; }),
        loadCategories().catch(e => { console.error('categories', e); return null; }),
        loadCrossModule().catch(e => { console.error('crossModule', e); return null; }),
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
  async function loadHealth() {
    health = await invoke<FinancialHealth>('budget_financial_health', {});
  }
  async function loadCategories() {
    categories = await invoke<BudgetCategory[]>('budget_list_categories', {});
  }
  async function loadCrossModule() {
    crossModule = await invoke<CrossModuleSpending>('budget_cross_module_spending', {});
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
      await Promise.all([loadTransactions(), loadOverview(), loadCategories(), loadHealth(), loadCrossModule()]);
    } catch (e) { error = String(e); }
  }

  async function deleteTransaction(id: string) {
    try { await invoke('budget_delete_transaction', { id }); await Promise.all([loadTransactions(), loadOverview(), loadCategories(), loadHealth()]);
    } catch (e) { error = String(e); }
  }

  async function addBill() {
    try {
      await invoke('budget_add_bill', {
        bill: { name: newBill.name, amount: newBill.amount, dueDay: newBill.dueDay, categoryId: newBill.categoryId || null, autoPay: newBill.autoPay }
      });
      showAddBill = false;
      resetNewBill();
      await loadBills();
    } catch (e) { error = String(e); }
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
      await Promise.all([loadAiCosts(), loadCrossModule()]);
    } catch (e) { error = String(e); }
  }

  async function deleteAiCost(id: string) {
    try { await invoke('budget_delete_ai_cost', { id }); await loadAiCosts(); }
    catch (e) { error = String(e); }
  }

  async function setCategoryBudget(id: string, amount: number) {
    try { await invoke('budget_set_category_budget', { categoryId: id, monthlyBudget: amount }); await loadCategories(); }
    catch (e) { error = String(e); }
  }

  async function loadSuggestions() {
    loadingSuggestions = true;
    try {
      suggestedLimits = await invoke<SuggestedBudget[]>('budget_suggest_limits', {});
      showSuggestions = true;
    } catch (e) {
      error = String(e);
    }
    loadingSuggestions = false;
  }

  async function applySuggestion(catId: string, budget: number) {
    try {
      await invoke('budget_set_category_budget', { categoryId: catId, monthlyBudget: budget });
      await loadCategories();
      // Update the suggestion to reflect current budget
      const idx = suggestedLimits.findIndex(s => s.categoryId === catId);
      if (idx >= 0) {
        suggestedLimits[idx].currentBudget = budget;
      }
    } catch (e) { error = String(e); }
  }

  async function applyAllSuggestions() {
    try {
      for (const s of suggestedLimits) {
        if (s.suggestedBudget > 0) {
          await invoke('budget_set_category_budget', { categoryId: s.categoryId, monthlyBudget: s.suggestedBudget });
        }
      }
      await loadCategories();
      // Mark all as applied
      suggestedLimits = suggestedLimits.map(s => ({ ...s, currentBudget: s.suggestedBudget }));
    } catch (e) { error = String(e); }
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

  // ── Init ──────────────────────────────────────────────────────────
  $effect(() => { loadAll(); });
  $effect(() => { if (selectedSection === 'Transactions') loadTransactions(); });
  $effect(() => { if (selectedSection === 'Forecast') { loadCashFlow(); loadChartData(); } });
  $effect(() => { if (selectedSection === 'AI Costs') loadAiCosts(); });
  $effect(() => { if (selectedSection === 'Bills') loadBills(); });
</script>

<div class="budget-shell">
  <!-- ── Header ──────────────────────────────────────────────────── -->
  <header class="budget-header">
    <div class="header-left">
      <span class="header-badge">Financial Co-Pilot</span>
      <h1 class="header-title">Intelligent Budget</h1>
    </div>
    {#if health}
      <div class="health-pill" style="--health-color: {healthColor}">
        <span class="health-score">{health.score}</span>
        <span class="health-label">Health</span>
      </div>
    {/if}
  </header>

  <!-- ── Section label (the sidebar handles navigation) ─────────── -->

  <!-- ── Error Banner ────────────────────────────────────────────── -->
  {#if error}
    <div class="error-banner">
      <AlertCircle size={16} />
      <span>{error}</span>
      <button class="dismiss-btn" onclick={() => error = null}>×</button>
    </div>
  {/if}

  <!-- ── Loading ──────────────────────────────────────────────────── -->
  {#if loading}
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <span>Loading your financial data…</span>
    </div>
  {:else}
    <!-- ══════════════════════════════════════════════════════════════════
         TAB: OVERVIEW
         ══════════════════════════════════════════════════════════════════ -->
    {#if selectedSection === 'Overview'}
      <div class="tab-content overview-tab">
        <!-- Hero metrics -->
        <div class="metrics-grid">
          <div class="metric-card income">
            <div class="metric-icon">
              <TrendingDown size={20} />
            </div>
            <span class="metric-label">Income</span>
            <span class="metric-value">€{overview?.totalIncome.toFixed(2) ?? '0.00'}</span>
          </div>
          <div class="metric-card expense">
            <div class="metric-icon">
              <TrendingUp size={20} />
            </div>
            <span class="metric-label">Expenses</span>
            <span class="metric-value">€{overview?.totalExpenses.toFixed(2) ?? '0.00'}</span>
          </div>
          <div class="metric-card savings">
            <div class="metric-icon">
              <PiggyBank size={20} />
            </div>
            <span class="metric-label">Net Savings</span>
            <span class="metric-value">€{overview?.netSavings.toFixed(2) ?? '0.00'}</span>
          </div>
          <div class="metric-card rate">
            <div class="metric-icon">
              <BarChart3 size={20} />
            </div>
            <span class="metric-label">Savings Rate</span>
            <span class="metric-value">{overview?.savingsRate.toFixed(1) ?? '0.0'}%</span>
          </div>
        </div>

        <!-- Cross-module spending -->
        {#if crossModule}
          <div class="section-card">
            <div class="section-header">
              <Sparkles size={18} />
              <h2>Cross-Module Intelligence</h2>
            </div>
            <div class="cross-module-grid">
              <div class="cm-item">
                <span class="cm-label">🍽️ Groceries</span>
                <span class="cm-value">€{crossModule.grocerySpending.toFixed(2)}</span>
              </div>
              <div class="cm-item">
                <span class="cm-label">📚 Reading</span>
                <span class="cm-value">€{crossModule.readingSpending.toFixed(2)}</span>
              </div>
              <div class="cm-item">
                <span class="cm-label">🤖 AI Costs</span>
                <span class="cm-value">€{crossModule.aiCostTotal.toFixed(2)}</span>
              </div>
              <div class="cm-item total">
                <span class="cm-label">Total Cross-Module</span>
                <span class="cm-value">€{crossModule.totalCrossModule.toFixed(2)}</span>
              </div>
            </div>
          </div>
        {/if}

        <!-- Financial Health -->
        {#if health}
          <div class="section-card health-section" style="--health-color: {healthColor}">
            <div class="section-header">
              <Target size={18} />
              <h2>Financial Health Score</h2>
            </div>
            <div class="health-ring">
              <svg viewBox="0 0 120 120" class="health-ring-svg">
                <circle cx="60" cy="60" r="52" fill="none" stroke="var(--border)" stroke-width="8" />
                <circle cx="60" cy="60" r="52" fill="none" stroke="var(--health-color)" stroke-width="8"
                  stroke-dasharray="326.73" stroke-dashoffset={326.73 - (326.73 * health.score / 100)}
                  stroke-linecap="round" transform="rotate(-90 60 60)"
                  style="transition: stroke-dashoffset 1s cubic-bezier(0.32, 0.72, 0, 1);" />
                <text x="60" y="52" text-anchor="middle" class="health-ring-score" fill="currentColor">{health.score}</text>
                <text x="60" y="72" text-anchor="middle" class="health-ring-label" fill="var(--muted)">/ 100</text>
              </svg>
            </div>
            <div class="health-grades">
              <div class="grade-item"><span>Savings</span><span class="grade-badge" class:good={health.savingsRateGrade === 'Excellent' || health.savingsRateGrade === 'Good'}>{health.savingsRateGrade}</span></div>
              <div class="grade-item"><span>Budget</span><span class="grade-badge" class:good={health.budgetAdherence === 'Excellent' || health.budgetAdherence === 'Good'}>{health.budgetAdherence}</span></div>
              <div class="grade-item"><span>Bills</span><span class="grade-badge" class:good={health.billPaymentRate === 'Excellent' || health.billPaymentRate === 'Good'}>{health.billPaymentRate}</span></div>
            </div>
            <div class="insights-list">
              {#each health.insights as insight}
                <div class="insight-item">
                  <Sparkles size={14} />
                  <span>{insight}</span>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Top spending categories -->
        {#if overview && overview.topCategories.length > 0}
          <div class="section-card">
            <div class="section-header">
              <BarChart3 size={18} />
              <h2>Top Spending Categories</h2>
            </div>
            <div class="top-cats-list">
              {#each overview.topCategories.slice(0, 5) as cat}
                <div class="top-cat-item">
                  <div class="top-cat-left">
                    <span class="cat-dot" style="background: {cat.color}"></span>
                    <span class="cat-name">{cat.categoryName}</span>
                  </div>
                  <div class="top-cat-right">
                    <div class="cat-bar-track">
                      <div class="cat-bar-fill" style="width: {Math.min(cat.percentUsed, 100)}%; background: {cat.color}"></div>
                    </div>
                    <span class="cat-amount">€{cat.spent.toFixed(0)}</span>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>

    <!-- ══════════════════════════════════════════════════════════════════
         TAB: TRANSACTIONS
         ══════════════════════════════════════════════════════════════════ -->
    {:else if selectedSection === 'Transactions'}
      <div class="tab-content">
        <div class="tab-actions">
          <div class="month-filter">
            <input type="month" bind:value={txMonth} onchange={() => loadTransactions()} class="month-input" />
          </div>
          <button class="action-btn primary" onclick={() => { resetNewTx(); showAddTx = true; }}>
            <Plus size={16} />
            <span>Add Transaction</span>
          </button>
        </div>

        <Table.Root>
          {#if transactions.length === 0}
            <Table.Caption>No transactions this month. Add one to get started.</Table.Caption>
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
                <Table.Row class={tx.txType === 'income' ? 'tx-row-income' : ''}>
                  <Table.Cell>
                    {#if tx.categoryName}
                      <span class="tx-cat-dot" style="background: {categories.find(c => c.id === tx.categoryId)?.color ?? '#6b7280'}"></span>
                    {/if}
                    <span class="font-medium">{tx.categoryName ?? 'Uncategorized'}</span>
                  </Table.Cell>
                  <Table.Cell class="text-[var(--muted-foreground)] max-w-[200px] truncate">{tx.note ?? ''}</Table.Cell>
                  <Table.Cell class="text-[var(--muted-foreground)]">{tx.dateKey.slice(5)}</Table.Cell>
                  <Table.Cell class="text-end font-semibold {tx.txType === 'expense' ? 'text-budget-expense' : 'text-budget-income'}">
                    {tx.txType === 'expense' ? '-' : '+'}€{tx.amount.toFixed(2)}
                  </Table.Cell>
                  <Table.Cell>
                    <button class="icon-btn danger" onclick={() => deleteTransaction(tx.id)}>
                      <Trash2 size={14} />
                    </button>
                  </Table.Cell>
                </Table.Row>
              {/each}
            </Table.Body>
          {/if}
        </Table.Root>
      </div>

      <!-- Add Transaction Modal -->
      {#if showAddTx}
        <div class="modal-overlay" onclick={() => showAddTx = false} onkeydown={(e) => { if (e.key === 'Escape') showAddTx = false; }}>
          <div class="modal-sheet" onclick={(e) => e.stopPropagation()} role="dialog" tabindex="-1">
            <div class="modal-handle"></div>
            <h3>New Transaction</h3>
            <div class="modal-form">
              <div class="type-toggle">
                <button class="type-btn" class:active={newTx.txType === 'expense'} onclick={() => newTx.txType = 'expense'}>
                  <TrendingUp size={16} /> Expense
                </button>
                <button class="type-btn" class:active={newTx.txType === 'income'} onclick={() => newTx.txType = 'income'}>
                  <TrendingDown size={16} /> Income
                </button>
              </div>
              <div class="form-field">
                <label for="tx-amount">Amount (€)</label>
                <input id="tx-amount" type="number" step="0.01" min="0" bind:value={newTx.amount} placeholder="0.00" />
              </div>
              <div class="form-field">
                <label for="tx-category">Category</label>
                <select id="tx-category" bind:value={newTx.categoryId}>
                  <option value="">Select category…</option>
                  {#each categories as cat}
                    <option value={cat.id}>{cat.name}</option>
                  {/each}
                </select>
              </div>
              <div class="form-field">
                <label for="tx-note">Note</label>
                <input id="tx-note" type="text" bind:value={newTx.note} placeholder="What was this for?" />
              </div>
              <div class="form-field">
                <label for="tx-date">Date</label>
                <input id="tx-date" type="date" bind:value={newTx.dateKey} />
              </div>
              <div class="form-field">
                <label for="tx-project">Project <span class="field-hint">(optional)</span></label>
                <input id="tx-project" type="text" bind:value={newTx.project} placeholder="e.g. Bento Development" />
              </div>
              <label class="checkbox-field">
                <input type="checkbox" bind:checked={newTx.recurring} />
                <span>Recurring transaction</span>
              </label>
              <button class="submit-btn" onclick={addTransaction}>
                <CheckCircle2 size={16} /> Save Transaction
              </button>
            </div>
          </div>
        </div>
      {/if}

    <!-- ══════════════════════════════════════════════════════════════════
         TAB: BUDGETS (Category Allocation)
         ══════════════════════════════════════════════════════════════════ -->
    {:else if selectedSection === 'Budgets'}
      <div class="tab-content">
        <div class="tab-actions">
          <span class="tab-subtitle">{categories.length} {categories.length === 1 ? 'category' : 'categories'} tracked</span>
          <button class="action-btn secondary" onclick={loadSuggestions} disabled={loadingSuggestions}>
            <Sparkles size={16} />
            <span>{loadingSuggestions ? 'Analyzing…' : 'Suggest Budgets'}</span>
          </button>
        </div>

        {#if categories.length === 0}
          <div class="empty-state">
            <Target size={40} class="empty-icon" />
            <p>No budget categories yet. Start by adding a transaction — categories are created as you go.</p>
          </div>
        {:else}
          {#each categoryGroups as group}
            {@const groupCats = categories.filter(c => c.groupName === group)}
            {#if groupCats.length > 0}
              <div class="budget-group">
                <h3 class="group-title">{group}</h3>
                <div class="budget-cards">
                  {#each groupCats as cat}
                    {@const Icon = resolveIcon(cat.icon)}
                    <div class="budget-card" style="--cat-color: {cat.color}">
                      <div class="budget-card-header">
                        <Icon size={18} />
                        <span class="budget-cat-name">{cat.name}</span>
                        <button class="edit-budget-btn" onclick={() => showEditBudget = showEditBudget === cat.id ? null : cat.id}>
                          <span class="budget-cat-amount">{cat.monthlyBudget > 0 ? '€' + cat.monthlyBudget.toFixed(0) : '–'}</span>
                        </button>
                      </div>
                      <div class="budget-bar-track">
                        <div class="budget-bar-fill" style="width: {Math.min(cat.percentUsed, 100)}%"
                          class:over={cat.percentUsed >= 100}></div>
                      </div>
                      <div class="budget-card-footer">
                        <span>€{cat.spent.toFixed(2)} spent</span>
                        <span class:remaining-positive={cat.remaining >= 0} class:remaining-negative={cat.remaining < 0}>
                          {cat.monthlyBudget > 0 ? '€' + cat.remaining.toFixed(2) + ' left' : ''}
                        </span>
                      </div>
                      {#if showEditBudget === cat.id}
                        <div class="budget-edit-inline">
                          <input type="number" step="50" min="0" value={cat.monthlyBudget}
                            onchange={(e) => {
                              const val = parseFloat((e.target as HTMLInputElement).value);
                              if (!isNaN(val)) setCategoryBudget(cat.id, val);
                            }}
                            placeholder="Monthly budget" />
                          <button class="save-mini" onclick={() => showEditBudget = null}>Done</button>
                        </div>
                      {/if}
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
          {/each}
        {/if}
      </div>

      <!-- Suggest Budgets Modal -->
      {#if showSuggestions}
        <div class="modal-overlay" onclick={() => showSuggestions = false} onkeydown={(e) => { if (e.key === 'Escape') showSuggestions = false; }}>
          <div class="modal-sheet suggestion-sheet" onclick={(e) => e.stopPropagation()} role="dialog" tabindex="-1">
            <div class="modal-handle"></div>
            <div class="suggestion-header">
              <Sparkles size={20} />
              <h3>Smart Budget Suggestions</h3>
              <p class="suggestion-subtitle">Based on your average spending over the last {suggestedLimits[0]?.monthsOfData ?? 3} months, with a 20% buffer.</p>
            </div>

            <div class="suggestion-list">
              {#each suggestedLimits as s}
                <div class="suggestion-row" style="--sug-color: {s.color}">
                  <div class="suggestion-info">
                    <span class="suggestion-cat-name">{s.categoryName}</span>
                    <span class="suggestion-group">{s.groupName}</span>
                  </div>
                  <div class="suggestion-details">
                    <div class="suggestion-avg">
                      <span class="sug-label">Avg/mo</span>
                      <span class="sug-value">€{s.averageSpent.toFixed(0)}</span>
                    </div>
                    <ArrowRight size={14} class="suggestion-arrow" />
                    <div class="suggestion-budget">
                      <span class="sug-label">Suggested</span>
                      <span class="sug-value suggested">€{s.suggestedBudget.toFixed(0)}</span>
                    </div>
                    <button class="apply-btn"
                      onclick={() => applySuggestion(s.categoryId, s.suggestedBudget)}
                      disabled={s.suggestedBudget <= 0 || s.currentBudget === s.suggestedBudget}>
                      <CheckCircle2 size={14} />
                      <span>{s.currentBudget === s.suggestedBudget && s.suggestedBudget > 0 ? 'Applied' : 'Apply'}</span>
                    </button>
                  </div>
                </div>
              {/each}
            </div>

            {#if suggestedLimits.length > 0}
              <div class="suggestion-footer">
                <button class="action-btn primary apply-all" onclick={applyAllSuggestions}>
                  <CheckCircle2 size={16} />
                  <span>Apply All Suggestions</span>
                </button>
                <button class="action-btn ghost" onclick={() => showSuggestions = false}>
                  Dismiss
                </button>
              </div>
            {:else}
              <div class="empty-state">
                <Sparkles size={40} class="empty-icon" />
                <p>No spending data yet. Add transactions over a few months to get budget suggestions.</p>
              </div>
            {/if}
          </div>
        </div>
      {/if}

    <!-- ══════════════════════════════════════════════════════════════
         TAB: BILLS — Subscription Day calendar
    ════════════════════════════════════════════════════════════════ -->
    {:else if selectedSection === 'Bills'}
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
              {@const day = i + 1}
              {@const dayBills = bills.filter(b => b.dueDay === day && b.active)}
              {@const isToday = day === calToday}
              {@const hasBill = dayBills.length > 0}
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
                        {bill.name.charAt(0).toUpperCase()}
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
            {@const sb = selectedBill}
            {@const sbColor = SUB_COLORS[sb.name] ?? '#6b7280'}
            <div class="subs-detail" style="--sb:{sbColor}">
              <div class="subs-detail-hd">
                <div class="subs-detail-icon" style="background:{sbColor}">
                  {sb.name.charAt(0).toUpperCase()}
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
                    {bill.name.charAt(0).toUpperCase()}
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

      <!-- Add subscription modal — popular services grid -->
      {#if showAddBill}
        <div class="modal-overlay" onclick={() => showAddBill = false} onkeydown={(e) => { if (e.key === 'Escape') showAddBill = false; }}>
          <div class="modal-sheet" onclick={(e) => e.stopPropagation()} role="dialog" tabindex="-1">
            <div class="modal-handle"></div>
            <h3>Add Subscription</h3>

            <!-- Popular services -->
            <div class="popular-services">
              <span class="popular-label">Popular services</span>
              <div class="popular-grid">
                {#each POPULAR_SERVICES as svc}
                  <button class="popular-btn" onclick={() => { newBill.name = svc.name; }}>
                    <span class="popular-icon" style="background:{svc.color}">{svc.icon}</span>
                    <span class="popular-name">{svc.name}</span>
                  </button>
                {/each}
              </div>
            </div>

            <div class="modal-form">
              <div class="form-field">
                <label for="bill-name">Name</label>
                <input id="bill-name" type="text" bind:value={newBill.name} placeholder="e.g. Netflix, Spotify" />
              </div>
              <div class="form-field">
                <label for="bill-amount">Amount (€)</label>
                <input id="bill-amount" type="number" step="0.01" min="0" bind:value={newBill.amount} placeholder="0.00" />
              </div>
              <div class="form-field">
                <label for="bill-due">Billing day (1–31)</label>
                <input id="bill-due" type="number" min="1" max="31" bind:value={newBill.dueDay} />
              </div>
              <div class="form-field">
                <label for="bill-cat">Category</label>
                <select id="bill-cat" bind:value={newBill.categoryId}>
                  <option value="">Uncategorized</option>
                  {#each categories as cat}
                    <option value={cat.id}>{cat.name}</option>
                  {/each}
                </select>
              </div>
              <label class="checkbox-field">
                <input type="checkbox" bind:checked={newBill.autoPay} />
                <span>Auto-pay enabled</span>
              </label>
              <button class="submit-btn" onclick={addBill}>
                <CheckCircle2 size={15} /> Add Subscription
              </button>
            </div>
          </div>
        </div>
      {/if}

    <!-- ══════════════════════════════════════════════════════════════════
         TAB: AI COSTS
         ══════════════════════════════════════════════════════════════════ -->
    {:else if selectedSection === 'AI Costs'}
      <div class="tab-content">
        <div class="tab-actions">
          <button class="action-btn primary" onclick={() => { resetNewAi(); showAddAi = true; }}>
            <Plus size={16} /> <span>Log AI Cost</span>
          </button>
        </div>

        {#if aiSummary.length > 0}
          <div class="ai-summary-grid">
            {#each aiSummary as summary}
              <div class="ai-summary-card">
                <div class="ai-provider-header">
                  <Bot size={18} />
                  <span class="ai-provider-name">{summary.provider}</span>
                </div>
                <span class="ai-total-cost">€{summary.totalCost.toFixed(2)}</span>
                <div class="ai-tokens">
                  <span>Tokens: {(summary.totalTokensIn + summary.totalTokensOut).toLocaleString()}</span>
                  <span class="ai-months">{summary.monthCount} {summary.monthCount === 1 ? 'month' : 'months'}</span>
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <div class="empty-state">
            <Bot size={40} class="empty-icon" />
            <p>No AI costs logged this month. Track Claude, Cursor, OpenAI, Grok, etc.</p>
          </div>
        {/if}

        {#if aiEntries.length > 0}
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
                      <span class="text-xs text-[var(--muted-foreground)]">{entry.model}</span>
                      {#if entry.note}<span class="text-xs text-[var(--muted-foreground)]">— {entry.note}</span>{/if}
                    </div>
                  </Table.Cell>
                  <Table.Cell class="text-right font-mono">€{entry.cost.toFixed(4)}</Table.Cell>
                  <Table.Cell class="text-right text-[var(--muted-foreground)]">{(entry.tokensIn + entry.tokensOut).toLocaleString()}</Table.Cell>
                  <Table.Cell>
                    <button class="icon-btn danger" onclick={() => deleteAiCost(entry.id)}>
                      <Trash2 size={12} />
                    </button>
                  </Table.Cell>
                </Table.Row>
              {/each}
            </Table.Body>
          </Table.Root>
        {/if}
      </div>

      {#if showAddAi}
        <div class="modal-overlay" onclick={() => showAddAi = false} onkeydown={(e) => { if (e.key === 'Escape') showAddAi = false; }}>
          <div class="modal-sheet" onclick={(e) => e.stopPropagation()} role="dialog" tabindex="-1">
            <div class="modal-handle"></div>
            <h3>Log AI Cost</h3>
            <div class="modal-form">
              <div class="form-field">
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
              <div class="form-field">
                <label for="ai-model">Model</label>
                <input id="ai-model" type="text" bind:value={newAi.model} placeholder="e.g. claude-3.5-sonnet, gpt-4o" />
              </div>
              <div class="form-field">
                <label for="ai-cost">Cost (€)</label>
                <input id="ai-cost" type="number" step="0.0001" min="0" bind:value={newAi.cost} placeholder="0.00" />
              </div>
              <div class="form-row">
                <div class="form-field half">
                  <label for="ai-tokens-in">Tokens In</label>
                  <input id="ai-tokens-in" type="number" min="0" bind:value={newAi.tokensIn} />
                </div>
                <div class="form-field half">
                  <label for="ai-tokens-out">Tokens Out</label>
                  <input id="ai-tokens-out" type="number" min="0" bind:value={newAi.tokensOut} />
                </div>
              </div>
              <div class="form-field">
                <label for="ai-date">Date</label>
                <input id="ai-date" type="date" bind:value={newAi.dateKey} />
              </div>
              <div class="form-field">
                <label for="ai-note">Note</label>
                <input id="ai-note" type="text" bind:value={newAi.note} placeholder="What was this for?" />
              </div>
              <button class="submit-btn" onclick={addAiCost}><CheckCircle2 size={16} /> Log Cost</button>
            </div>
          </div>
        </div>
      {/if}

    <!-- ══════════════════════════════════════════════════════════════════
         TAB: FORECAST
         ══════════════════════════════════════════════════════════════════ -->
    {:else if selectedSection === 'Forecast'}
      <div class="tab-content">
        {#if chartData.length === 0 && cashFlow.length === 0}
          <div class="empty-state">
            <LineChart size={40} class="empty-icon" />
            <p>Not enough data for forecasting. Add a few months of transactions first.</p>
          </div>
        {:else}
          <ForecastingChart
            data={chartData}
            months={forecastMonths}
            onMonthsChange={handleForecastMonthsChange}
          />
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
                  <Table.Cell class="text-budget-income">€{proj.projectedIncome.toFixed(0)}</Table.Cell>
                  <Table.Cell class="text-budget-expense">€{proj.projectedExpenses.toFixed(0)}</Table.Cell>
                  <Table.Cell class="text-end font-semibold {proj.projectedBalance >= 0 ? 'positive' : ''}">
                    €{proj.projectedBalance.toFixed(0)}
                  </Table.Cell>
                </Table.Row>
            {/each}
            </Table.Body>
            {#if cashFlow.length > 0}
              {@const last = cashFlow[cashFlow.length - 1]}
              <Table.Footer>
                <Table.Row>
                  <Table.Cell colspan={3}>Projected End Balance</Table.Cell>
                  <Table.Cell class="text-end font-bold {last.projectedBalance >= 0 ? 'positive' : ''}">
                    €{last.projectedBalance.toFixed(0)}
                  </Table.Cell>
                </Table.Row>
              </Table.Footer>
            {/if}
          </Table.Root>
        {/if}
      </div>

    <!-- ══════════════════════════════════════════════════════════════════
         TAB: EXPORT
         ══════════════════════════════════════════════════════════════════ -->
    {:else if selectedSection === 'Export'}
      <div class="tab-content">
        <div class="export-cards">
          <button class="export-card" onclick={exportCsv} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') exportCsv(); }}>
            <Download size={28} />
            <h3>Export as CSV</h3>
            <p>Download all transactions for {thisMonth} as a CSV file. Compatible with Excel, Google Sheets, and accounting software.</p>
            <span class="export-hint">Includes: date, type, amount, category, note, project</span>
          </button>
          <button class="export-card" onclick={exportPdf} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') exportPdf(); }}>
            <BarChart3 size={28} />
            <h3>Monthly Report (PDF)</h3>
            <p>Generate a comprehensive PDF report with charts, category breakdowns, health insights, and more.</p>
            <span class="export-hint">Overview • Categories • Health • Bills • AI Costs • Forecast</span>
          </button>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  /* ── Shell ──────────────────────────────────────────────────────── */
  .budget-shell {
    height: 100%;
    display: flex;
    flex-direction: column;
    color: var(--foreground);
    --budget-accent: #e05a3a;
    --budget-green: #22c55e;
    --budget-red: #ef4444;
    --budget-amber: #f59e0b;
    --budget-surface: var(--card);
    --budget-surface-hover: color-mix(in srgb, var(--foreground) 8%, var(--card));
    --budget-border: color-mix(in srgb, var(--border) 80%, transparent);
  }

  /* ── Header ──────────────────────────────────────────────────────── */
  .budget-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 24px 28px 8px;
  }
  .header-left { display: flex; flex-direction: column; gap: 4px; }
  .header-badge {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: var(--budget-accent);
  }
  .header-title {
    font-size: 22px;
    font-weight: 700;
    margin: 0;
    letter-spacing: -0.01em;
  }
  .health-pill {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 16px 6px 12px;
    border-radius: 100px;
    background: color-mix(in srgb, var(--health-color) 15%, var(--budget-surface));
    border: 1px solid color-mix(in srgb, var(--health-color) 30%, transparent);
    color: var(--health-color);
  }
  .health-score { font-size: 20px; font-weight: 800; }
  .health-label { font-size: 11px; font-weight: 500; opacity: 0.8; }

  /* ── Tab Navigation ────────────────────────────────────────────── */
  .tab-nav {
    display: flex;
    gap: 4px;
    padding: 8px 28px;
    overflow-x: auto;
    scrollbar-width: none;
    border-bottom: 1px solid var(--budget-border);
  }
  .tab-nav::-webkit-scrollbar { display: none; }
  .tab-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 10px;
    border: none;
    background: transparent;
    color: var(--muted);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }
  .tab-btn:hover { background: var(--budget-surface-hover); color: var(--foreground); }
  .tab-btn.active {
    background: var(--budget-accent);
    color: white;
  }

  /* ── Tab Content ────────────────────────────────────────────────── */
  .tab-content {
    flex: 1;
    overflow-y: auto;
    padding: 20px 28px 100px;
  }
  .tab-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    gap: 12px;
  }
  .tab-subtitle { font-size: 13px; color: var(--muted); }
  .action-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 18px;
    border-radius: 10px;
    border: none;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  .action-btn.primary {
    background: var(--budget-accent);
    color: white;
  }
  .action-btn.primary:hover {
    background: color-mix(in srgb, var(--budget-accent) 85%, black);
    transform: translateY(-1px);
  }
  .icon-btn {
    background: transparent;
    border: none;
    color: var(--muted);
    cursor: pointer;
    padding: 6px;
    border-radius: 8px;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .icon-btn:hover { background: var(--budget-surface-hover); color: var(--foreground); }
  .icon-btn.danger:hover { color: var(--budget-red); background: color-mix(in srgb, var(--budget-red) 12%, transparent); }

  /* ── Loading & Empty ──────────────────────────────────────────── */
  .loading-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    color: var(--muted);
    font-size: 14px;
  }
  .loading-spinner {
    width: 32px; height: 32px;
    border: 3px solid var(--budget-border);
    border-top-color: var(--budget-accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    color: var(--muted);
    gap: 12px;
    text-align: center;
  }
  .empty-icon { opacity: 0.4; }
  .error-banner {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0 28px 12px;
    padding: 10px 16px;
    border-radius: 12px;
    background: color-mix(in srgb, var(--budget-red) 12%, transparent);
    color: var(--budget-red);
    font-size: 13px;
  }
  .dismiss-btn {
    margin-left: auto;
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    font-size: 18px;
    padding: 0 4px;
  }

  /* ── Metrics Grid ──────────────────────────────────────────────── */
  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    margin-bottom: 20px;
  }
  .metric-card {
    background: var(--budget-surface);
    border: 1px solid var(--budget-border);
    border-radius: 16px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    transition: all 0.2s;
  }
  .metric-card:hover { transform: translateY(-2px); }
  .metric-icon { opacity: 0.7; }
  .metric-card.income .metric-icon { color: var(--budget-green); }
  .metric-card.expense .metric-icon { color: var(--budget-red); }
  .metric-card.savings .metric-icon { color: var(--budget-accent); }
  .metric-card.rate .metric-icon { color: var(--budget-amber); }
  .metric-label { font-size: 12px; color: var(--muted); font-weight: 500; text-transform: uppercase; letter-spacing: 0.03em; }
  .metric-value { font-size: 20px; font-weight: 700; }

  /* ── Section Cards ────────────────────────────────────────────── */
  .section-card {
    background: var(--budget-surface);
    border: 1px solid var(--budget-border);
    border-radius: 20px;
    padding: 20px;
    margin-bottom: 16px;
  }
  .section-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 16px;
  }
  .section-header h2 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
  }

  /* ── Cross Module ────────────────────────────────────────────── */
  .cross-module-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
  }
  .cm-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 12px;
    border-radius: 12px;
    background: color-mix(in srgb, var(--background) 50%, transparent);
  }
  .cm-item.total { background: color-mix(in srgb, var(--budget-accent) 10%, transparent); }
  .cm-label { font-size: 12px; color: var(--muted); }
  .cm-value { font-size: 18px; font-weight: 700; }

  /* ── Health Ring ──────────────────────────────────────────────── */
  .health-section { text-align: center; }
  .health-ring {
    width: 120px;
    margin: 0 auto 16px;
  }
  .health-ring-svg { width: 120px; height: 120px; }
  :global(.health-ring-score) { font-size: 28px; font-weight: 800; }
  :global(.health-ring-label) { font-size: 10px; font-weight: 500; }
  .health-grades {
    display: flex;
    justify-content: center;
    gap: 16px;
    margin-bottom: 16px;
  }
  .grade-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: var(--muted);
  }
  .grade-badge {
    padding: 2px 10px;
    border-radius: 100px;
    font-size: 11px;
    font-weight: 600;
    background: color-mix(in srgb, var(--budget-red) 15%, transparent);
    color: var(--budget-red);
  }
  .grade-badge.good {
    background: color-mix(in srgb, var(--budget-green) 15%, transparent);
    color: var(--budget-green);
  }
  .insights-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    text-align: left;
  }
  .insight-item {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 13px;
    line-height: 1.5;
    color: var(--muted);
  }
  .insight-item :global(svg) { margin-top: 2px; flex-shrink: 0; color: var(--budget-accent); }

  /* ── Top Categories ──────────────────────────────────────────── */
  .top-cats-list { display: flex; flex-direction: column; gap: 10px; }
  .top-cat-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }
  .top-cat-left { display: flex; align-items: center; gap: 8px; min-width: 120px; }
  .cat-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  .cat-name { font-size: 13px; font-weight: 500; }
  .top-cat-right { display: flex; align-items: center; gap: 12px; flex: 1; }
  .cat-bar-track {
    flex: 1;
    height: 6px;
    background: var(--budget-border);
    border-radius: 3px;
    overflow: hidden;
  }
  .cat-bar-fill { height: 100%; border-radius: 3px; transition: width 0.6s ease; }
  .cat-amount { font-size: 13px; font-weight: 600; min-width: 60px; text-align: right; }

  /* ── Transactions ────────────────────────────────────────────── */
  .month-input {
    background: var(--budget-surface);
    border: 1px solid var(--budget-border);
    padding: 8px 12px;
    border-radius: 10px;
    color: var(--foreground);
    font-size: 13px;
    font-weight: 500;
  }
  .tx-cat-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; display: inline-block; vertical-align: middle; margin-right: 4px; }
  :global(.tx-row-income) { background: color-mix(in srgb, var(--budget-green) 6%, transparent); }

  /* ── Budget Groups ────────────────────────────────────────────── */
  .budget-group { margin-bottom: 24px; }
  .group-title {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--muted);
    margin: 0 0 10px 4px;
  }
  .budget-cards { display: flex; flex-direction: column; gap: 8px; }
  .budget-card {
    background: var(--budget-surface);
    border: 1px solid var(--budget-border);
    border-radius: 16px;
    padding: 14px 16px;
    transition: all 0.2s;
  }
  .budget-card:hover { border-color: color-mix(in srgb, var(--cat-color) 40%, var(--budget-border)); }
  .budget-card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }
  .budget-cat-name { flex: 1; font-size: 14px; font-weight: 600; }
  .budget-cat-amount { font-size: 13px; font-weight: 700; min-width: 60px; text-align: right; }
  .edit-budget-btn {
    background: none;
    border: none;
    color: var(--muted);
    cursor: pointer;
    transition: color 0.2s;
  }
  .edit-budget-btn:hover { color: var(--foreground); }
  .budget-bar-track {
    height: 6px;
    background: var(--budget-border);
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: 6px;
  }
  .budget-bar-fill {
    height: 100%;
    background: var(--cat-color);
    border-radius: 3px;
    transition: width 0.6s ease;
  }
  .budget-bar-fill.over { background: var(--budget-red); }
  .budget-card-footer {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: var(--muted);
  }
  .remaining-positive { color: var(--budget-green); }
  .remaining-negative { color: var(--budget-red); }
  .budget-edit-inline {
    display: flex;
    gap: 8px;
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid var(--budget-border);
  }
  .budget-edit-inline input {
    flex: 1;
    background: var(--background);
    border: 1px solid var(--budget-border);
    padding: 6px 10px;
    border-radius: 8px;
    color: var(--foreground);
    font-size: 13px;
  }
  .save-mini {
    padding: 6px 14px;
    border-radius: 8px;
    border: none;
    background: var(--budget-accent);
    color: white;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }

  /* ── Bills ──────────────────────────────────────────────────────── */
  .bills-grid { display: grid; gap: 10px; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
  .bill-card {
    background: var(--budget-surface);
    border: 1px solid var(--budget-border);
    border-radius: 16px;
    padding: 16px;
    transition: all 0.2s;
  }
  .bill-card.paid { border-color: color-mix(in srgb, var(--budget-green) 30%, transparent); }
  .bill-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 14px;
  }
  .bill-info { display: flex; flex-direction: column; gap: 2px; }
  .bill-name { font-size: 15px; font-weight: 600; }
  .bill-due { font-size: 12px; color: var(--muted); }
  .bill-amount { font-size: 18px; font-weight: 700; }
  .bill-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .pay-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 8px;
    border: 1px solid var(--budget-border);
    background: transparent;
    color: var(--muted);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  .pay-btn:hover { border-color: var(--budget-green); color: var(--budget-green); }
  .pay-btn.paid {
    background: color-mix(in srgb, var(--budget-green) 12%, transparent);
    border-color: var(--budget-green);
    color: var(--budget-green);
  }

  /* ── AI Costs ────────────────────────────────────────────────── */
  .ai-summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 12px;
    margin-bottom: 20px;
  }
  .ai-summary-card {
    background: var(--budget-surface);
    border: 1px solid var(--budget-border);
    border-radius: 16px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .ai-provider-header { display: flex; align-items: center; gap: 8px; }
  .ai-provider-name { font-size: 13px; font-weight: 600; }
  .ai-total-cost { font-size: 22px; font-weight: 700; }
  .ai-tokens { font-size: 12px; color: var(--muted); display: flex; flex-direction: column; gap: 2px; }
  .ai-months { font-size: 11px; }
  .list-subtitle { font-size: 13px; font-weight: 600; margin: 0 0 8px; color: var(--muted); }

  /* ── Forecast Table ──────────────────────────────────────────────── */
  :global(.text-budget-income) { color: var(--budget-green); }
  :global(.text-budget-expense) { color: var(--budget-red); }
  :global(.positive) { color: var(--budget-green) !important; }

  /* ── Export ────────────────────────────────────────────────── */
  .export-cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
  }
  .export-card {
    background: var(--budget-surface);
    border: 1px solid var(--budget-border);
    border-radius: 20px;
    padding: 24px;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .export-card:hover:not(.disabled) { border-color: var(--budget-accent); transform: translateY(-2px); }
  .export-card.disabled { opacity: 0.5; cursor: default; }
  .export-card h3 { margin: 0; font-size: 16px; font-weight: 600; }
  .export-card p { margin: 0; font-size: 13px; color: var(--muted); line-height: 1.5; }
  .export-hint { font-size: 11px; color: var(--muted); font-style: italic; }

  /* ── Modals ──────────────────────────────────────────────────── */
  .modal-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: color-mix(in srgb, var(--background) 70%, transparent);
    backdrop-filter: blur(4px);
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fadeIn 0.2s ease;
  }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  .modal-sheet {
    background: var(--budget-surface);
    border: 1px solid var(--budget-border);
    width: min(440px, 92vw);
    max-height: 85vh;
    overflow-y: auto;
    border-radius: 24px;
    padding: 24px 28px 32px;
    animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }
  @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  .modal-handle {
    width: 40px; height: 4px;
    background: var(--budget-border);
    border-radius: 4px;
    margin: 0 auto 20px;
  }
  .modal-sheet h3 { margin: 0 0 20px; font-size: 18px; text-align: center; font-weight: 700; }
  .modal-form { display: flex; flex-direction: column; gap: 14px; }
  .form-field { display: flex; flex-direction: column; gap: 4px; }
  .form-field label { font-size: 12px; font-weight: 600; color: var(--muted); }
  .field-hint { font-weight: 400; opacity: 0.7; }
  .form-field input, .form-field select {
    background: var(--background);
    border: 1px solid var(--budget-border);
    padding: 10px 14px;
    border-radius: 10px;
    color: var(--foreground);
    font-size: 14px;
    outline: none;
    transition: border-color 0.2s;
  }
  .form-field input:focus, .form-field select:focus { border-color: var(--budget-accent); }
  .form-row { display: flex; gap: 10px; }
  .form-field.half { flex: 1; }
  .checkbox-field {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    cursor: pointer;
  }
  .checkbox-field input[type="checkbox"] { accent-color: var(--budget-accent); }
  .type-toggle {
    display: flex;
    gap: 8px;
  }
  .type-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 10px;
    border-radius: 10px;
    border: 1px solid var(--budget-border);
    background: transparent;
    color: var(--muted);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  .type-btn.active {
    background: var(--budget-accent);
    color: white;
    border-color: var(--budget-accent);
  }
  .submit-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px;
    border-radius: 12px;
    border: none;
    background: var(--budget-accent);
    color: white;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    margin-top: 4px;
    transition: background 0.2s;
  }
  .submit-btn:hover { background: color-mix(in srgb, var(--budget-accent) 85%, black); }

  /* ── Suggest Budgets Modal ─────────────────────────────────────── */
  .suggestion-sheet {
    width: min(520px, 94vw);
    max-height: 80vh;
  }
  .suggestion-header {
    text-align: center;
    margin-bottom: 4px;
  }
  .suggestion-header :global(svg) {
    color: var(--budget-accent);
    margin-bottom: 4px;
  }
  .suggestion-header h3 { margin: 0 0 6px; font-size: 18px; font-weight: 700; }
  .suggestion-subtitle {
    margin: 0 0 16px;
    font-size: 13px;
    color: var(--muted);
    line-height: 1.4;
  }
  .suggestion-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 400px;
    overflow-y: auto;
    margin: 0 -8px;
    padding: 0 8px;
  }
  .suggestion-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 14px;
    border-radius: 12px;
    background: color-mix(in srgb, var(--background) 50%, transparent);
    border-left: 3px solid var(--sug-color);
    transition: background 0.2s;
    gap: 12px;
  }
  .suggestion-row:hover { background: var(--budget-surface-hover); }
  .suggestion-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 100px;
  }
  .suggestion-cat-name { font-size: 14px; font-weight: 600; }
  .suggestion-group { font-size: 11px; color: var(--muted); }
  .suggestion-details {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
    justify-content: flex-end;
  }
  .suggestion-avg, .suggestion-budget {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
  }
  .sug-label { font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.03em; }
  .sug-value { font-size: 15px; font-weight: 700; }
  .sug-value.suggested { color: var(--budget-accent); }
  .suggestion-arrow { color: var(--muted); opacity: 0.5; flex-shrink: 0; }
  .apply-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 12px;
    border-radius: 8px;
    border: 1px solid var(--sug-color);
    background: color-mix(in srgb, var(--sug-color) 12%, transparent);
    color: var(--sug-color);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    flex-shrink: 0;
  }
  .apply-btn:hover:not(:disabled) {
    background: color-mix(in srgb, var(--sug-color) 25%, transparent);
  }
  .apply-btn:disabled {
    opacity: 0.5;
    cursor: default;
    background: color-mix(in srgb, var(--budget-green) 12%, transparent);
    border-color: var(--budget-green);
    color: var(--budget-green);
  }
  .suggestion-footer {
    display: flex;
    gap: 10px;
    margin-top: 16px;
    justify-content: center;
  }
  .action-btn.secondary {
    background: color-mix(in srgb, var(--budget-accent) 12%, transparent);
    color: var(--budget-accent);
    border: 1px solid color-mix(in srgb, var(--budget-accent) 25%, transparent);
  }
  .action-btn.secondary:hover:not(:disabled) {
    background: color-mix(in srgb, var(--budget-accent) 22%, transparent);
  }
  .action-btn.secondary:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .action-btn.ghost {
    background: transparent;
    color: var(--muted);
    border: 1px solid var(--budget-border);
  }
  .action-btn.ghost:hover { background: var(--budget-surface-hover); color: var(--foreground); }
  .apply-all { min-width: 200px; justify-content: center; }

  /* ── Responsive ────────────────────────────────────────────────── */
  @media (max-width: 768px) {
    .budget-header { padding: 20px 16px 8px; }
    .tab-nav { padding: 8px 16px; }
    .tab-content { padding: 16px 16px 100px; }
    .metrics-grid { grid-template-columns: repeat(2, 1fr); }
    .cross-module-grid { grid-template-columns: repeat(2, 1fr); }
    .health-grades { flex-wrap: wrap; }
    .ai-summary-grid { grid-template-columns: 1fr; }
    .export-cards { grid-template-columns: 1fr; }
    .bills-grid { grid-template-columns: 1fr; }
  }
</style>
