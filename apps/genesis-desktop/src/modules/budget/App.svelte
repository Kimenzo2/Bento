<script lang="ts">
  import { Wallet, ChevronLeft, ChevronRight, Settings, Plus, PiggyBank, Coffee, Home, Car, ChevronDown } from 'lucide-svelte';
  import { activeBundle, createTranslator } from "$lib/i18n";

  let { moduleId = "budget" } = $props<{ moduleId?: string }>();
  $effect(() => { void moduleId; });

  let _t = $derived.by(() => createTranslator($activeBundle));

  let currentMonth = 'May 2026';
  let toAssign = 340.00;
  
  let categories = [
    {
      group: 'ESSENTIALS',
      items: [
        { name: 'Rent', left: 1200, spent: 0, total: 1200, icon: Home },
        { name: 'Groceries', left: 240, spent: 360, total: 600, icon: Coffee },
        { name: 'Transport', left: 45, spent: 105, total: 150, icon: Car }
      ]
    },
    {
      group: 'LIFESTYLE',
      items: [
        { name: 'Dining Out', left: -45, spent: 245, total: 200, icon: Coffee },
        { name: 'Entertainment', left: 120, spent: 80, total: 200, icon: Wallet }
      ]
    },
    {
      group: 'SAVINGS',
      items: [
        { name: 'Emergency Fund', left: 500, spent: 0, total: 500, icon: PiggyBank }
      ]
    }
  ];

  let showTransactionForm = $state(false);
  let txAmount = $state('');
  let txCategory = $state('');
  let txNote = $state('');
  const txCategoryId = "budget-tx-category";
  const txNoteId = "budget-tx-note";
  const txDateId = "budget-tx-date";
</script>

<div class="budget-app-container module-root" data-module="budget">
  <div class="budget-header">
    <div class="month-selector">
      <button class="icon-btn"><ChevronLeft size={20} /></button>
      <h2>{currentMonth}</h2>
      <button class="icon-btn"><ChevronRight size={20} /></button>
    </div>
    <button class="icon-btn"><Settings size={20} /></button>
  </div>

  <div class="assign-banner {toAssign > 0 ? 'needs-assignment' : 'all-assigned'}">
    <span class="banner-icon">💰</span>
    <span class="banner-text">€{toAssign.toFixed(2)} to assign</span>
    <ChevronRight size={16} />
  </div>

  <div class="budget-content">
    {#each categories as group}
      <div class="category-group">
        <h3 class="group-header">{group.group}</h3>
        
        <div class="category-list">
          {#each group.items as item}
            {@const ItemIcon = item.icon}
            <div class="category-card">
              <div class="category-info">
                <div class="category-name">
                  <ItemIcon size={16} />
                  <span>{item.name}</span>
                </div>
                <div class="category-amount {item.left < 0 ? 'negative' : 'positive'}">
                  €{item.left.toFixed(2)} left
                </div>
              </div>
              
              <div class="progress-bar-container">
                <div class="progress-fill {item.left < 0 ? 'overspent' : ''}" 
                  style="width: {Math.min(100, Math.max(0, (item.spent / item.total) * 100))}%">
                </div>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/each}
  </div>

  <div class="budget-summary">
    <div class="summary-col">
      <span class="summary-label">{_t('moduleBudgetAssigned')}</span>
      <span class="summary-value">€2,850</span>
    </div>
    <div class="summary-col">
      <span class="summary-label">{_t('moduleBudgetSpent')}</span>
      <span class="summary-value">€790</span>
    </div>
    <div class="summary-col">
      <span class="summary-label">{_t('moduleBudgetRemaining')}</span>
      <span class="summary-value">€2,060</span>
    </div>
  </div>

  <button class="budget-fab" onclick={() => showTransactionForm = true}>
    <Plus size={24} />
  </button>

  {#if showTransactionForm}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="transaction-overlay" onclick={() => showTransactionForm = false}>
      <div class="transaction-sheet" onclick={(e) => e.stopPropagation()}>
        <div class="sheet-handle"></div>
        <h3>{_t('moduleBudgetLogTransaction')}</h3>
        
        <div class="form-group amount-group">
          <span class="currency-symbol">€</span>
          <input type="number" bind:value={txAmount} placeholder="0.00" class="amount-input" />
        </div>
        
        <div class="form-group">
          <label for={txCategoryId}>{_t('commonCategory')}</label>
          <div class="select-wrapper">
            <select id={txCategoryId} bind:value={txCategory}>
              <option value="" disabled selected>Select category...</option>
              {#each categories as group}
                <optgroup label={group.group}>
                  {#each group.items as item}
                    <option value={item.name}>{item.name}</option>
                  {/each}
                </optgroup>
              {/each}
            </select>
            <span class="select-icon"><ChevronDown size={16} /></span>
          </div>
        </div>
        
        <div class="form-group">
          <label for={txNoteId}>{_t('moduleBudgetNoteOptional')}</label>
          <input id={txNoteId} type="text" bind:value={txNote} placeholder="What was this for?" />
        </div>
        
        <div class="form-group">
          <label for={txDateId}>{_t('commonDate')}</label>
          <input id={txDateId} type="date" value="2026-05-11" />
        </div>
        
        <button class="save-tx-btn" onclick={() => showTransactionForm = false}>{_t('moduleBudgetSaveTransaction')}</button>
      </div>
    </div>
  {/if}
</div>
<style>
.budget-app-container {
  --budget-surface: var(--card);
  --budget-surface-soft: color-mix(in srgb, var(--surface) 94%, var(--background));
  --budget-surface-hover: color-mix(in srgb, var(--foreground) 8%, var(--card));
  --budget-border: color-mix(in srgb, var(--border) 86%, transparent);
  --budget-ink: var(--foreground);
  --budget-muted: var(--muted);
  --budget-accent: var(--primary);
  --budget-accent-foreground: var(--primary-foreground, var(--background));
  --budget-success: var(--success, var(--primary));
  --budget-warning: var(--warning, var(--primary));
  --budget-danger: var(--destructive, var(--primary));
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
  color: var(--budget-ink);
  animation: fade-in 0.3s ease;
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.budget-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 32px 16px;
}

.month-selector {
  display: flex;
  align-items: center;
  gap: 16px;
}

.month-selector h2 {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.icon-btn {
  background: transparent;
  border: none;
  color: var(--budget-muted);
  cursor: pointer;
  padding: 8px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.icon-btn:hover {
  background: var(--budget-surface-hover);
  color: var(--budget-ink);
}

.assign-banner {
  margin: 0 32px 24px;
  padding: 16px 20px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  cursor: pointer;
  transition: transform 0.2s;
}
.assign-banner:hover {
  transform: translateY(-2px);
}
.needs-assignment {
  background: color-mix(in srgb, var(--budget-warning) 12%, var(--budget-surface));
  border: 1px solid color-mix(in srgb, var(--budget-warning) 34%, var(--budget-border));
  color: var(--budget-warning);
}
.all-assigned {
  background: color-mix(in srgb, var(--budget-success) 12%, var(--budget-surface));
  border: 1px solid color-mix(in srgb, var(--budget-success) 34%, var(--budget-border));
  color: var(--budget-success);
}

.banner-icon { font-size: 20px; margin-right: 12px; }
.banner-text { flex-grow: 1; font-weight: 600; font-size: 16px; }

.budget-content {
  flex-grow: 1;
  overflow-y: auto;
  padding: 0 32px 100px;
}

.category-group { margin-bottom: 32px; }
.group-header {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: var(--budget-muted);
  margin: 0 0 16px 8px;
}

.category-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.category-card {
  background: var(--budget-surface);
  border: 1px solid var(--budget-border);
  border-radius: 20px;
  padding: 16px;
  cursor: pointer;
  transition: background 0.2s;
  box-shadow: none;
}
.category-card:hover {
  background: var(--budget-surface-hover);
}

.category-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.category-name {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
  font-size: 15px;
}

.category-amount {
  font-weight: 600;
  font-size: 15px;
}
.category-amount.positive { color: var(--budget-success); }
.category-amount.negative { color: var(--budget-danger); }

.progress-bar-container {
  height: 6px;
  background: var(--budget-surface-soft);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--budget-success);
  border-radius: 3px;
}
.progress-fill.overspent {
  background: var(--budget-danger);
}

.budget-summary {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--budget-surface);
  border-top: 1px solid var(--budget-border);
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  padding: 16px 32px;
}

.summary-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.summary-label {
  font-size: 12px;
  color: var(--budget-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.summary-value {
  font-size: 15px;
  font-weight: 600;
}

.budget-fab {
  position: absolute;
  bottom: 80px;
  right: 32px;
  width: 56px;
  height: 56px;
  border-radius: 28px;
  background: var(--budget-accent);
  color: var(--budget-accent-foreground);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: none;
  z-index: 10;
  transition: transform 0.2s;
}
.budget-fab:hover {
  transform: scale(1.05);
}

.transaction-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: color-mix(in srgb, var(--background) 72%, transparent);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fade-in 0.2s;
}

.transaction-sheet {
  background: var(--budget-surface);
  width: min(440px, 90vw);
  max-height: 80vh;
  border-radius: 24px;
  padding: 24px 32px 40px;
  border: 1px solid var(--budget-border);
  box-shadow: none;
}



.sheet-handle {
  width: 40px; height: 5px;
  background: var(--budget-border);
  border-radius: 3px;
  margin: 0 auto 24px;
}

.transaction-sheet h3 {
  margin: 0 0 24px;
  font-size: 20px;
  text-align: center;
}

.form-group {
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-size: 14px;
  color: var(--budget-muted);
  font-weight: 500;
}

.form-group input, .form-group select {
  background: var(--budget-surface-soft);
  border: 1px solid var(--budget-border);
  padding: 12px 16px;
  border-radius: 12px;
  color: var(--budget-ink);
  font-size: 15px;
  width: 100%;
  outline: none;
}
.form-group input:focus, .form-group select:focus {
  border-color: var(--budget-accent);
}

.amount-group {
  position: relative;
  margin-bottom: 32px;
}
.currency-symbol {
  position: absolute;
  top: 50%;
  left: 20px;
  transform: translateY(-50%);
  font-size: 32px;
  font-weight: bold;
  color: var(--budget-muted);
  z-index: 10;
}
.amount-group .amount-input {
  padding: 16px 16px 16px 60px;
  font-size: 40px;
  font-weight: bold;
  border-radius: 16px;
  height: 80px;
}

.select-wrapper {
  position: relative;
}
.select-icon {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  color: var(--budget-muted);
}
select {
  appearance: none;
}

.save-tx-btn {
  width: 100%;
  background: var(--budget-accent);
  color: var(--budget-accent-foreground);
  border: none;
  padding: 16px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 16px;
  cursor: pointer;
  margin-top: 16px;
  transition: background 0.2s;
}
.save-tx-btn:hover {
  background: color-mix(in srgb, var(--budget-accent) 86%, var(--foreground));
}
</style>


