<script lang="ts">
  import { Wallet, ChevronLeft, ChevronRight, Settings, Plus, PiggyBank, Coffee, Home, Car, ChevronDown } from 'lucide-svelte';
  
  export let moduleId: string;
  void moduleId;

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

  let showTransactionForm = false;
  let txAmount = '';
  let txCategory = '';
  let txNote = '';
  const txCategoryId = "budget-tx-category";
  const txNoteId = "budget-tx-note";
  const txDateId = "budget-tx-date";
</script>

<div class="budget-app-container module-root">
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
            <div class="category-card">
              <div class="category-info">
                <div class="category-name">
                  <svelte:component this={item.icon} size={16} />
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
      <span class="summary-label">Assigned</span>
      <span class="summary-value">€2,850</span>
    </div>
    <div class="summary-col">
      <span class="summary-label">Spent</span>
      <span class="summary-value">€790</span>
    </div>
    <div class="summary-col">
      <span class="summary-label">Remaining</span>
      <span class="summary-value">€2,060</span>
    </div>
  </div>

  <button class="budget-fab" on:click={() => showTransactionForm = true}>
    <Plus size={24} />
  </button>

  {#if showTransactionForm}
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="transaction-overlay" on:click={() => showTransactionForm = false}>
      <div class="transaction-sheet" on:click|stopPropagation>
        <div class="sheet-handle"></div>
        <h3>Log Transaction</h3>
        
        <div class="form-group amount-group">
          <span class="currency-symbol">€</span>
          <input type="number" bind:value={txAmount} placeholder="0.00" class="amount-input" />
        </div>
        
        <div class="form-group">
          <label for={txCategoryId}>Category</label>
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
          <label for={txNoteId}>Note (Optional)</label>
          <input id={txNoteId} type="text" bind:value={txNote} placeholder="What was this for?" />
        </div>
        
        <div class="form-group">
          <label for={txDateId}>Date</label>
          <input id={txDateId} type="date" value="2026-05-11" />
        </div>
        
        <button class="save-tx-btn" on:click={() => showTransactionForm = false}>Save Transaction</button>
      </div>
    </div>
  {/if}
</div>
<style>
.budget-app-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
  color: var(--text-primary, #F9FAFB);
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
  color: var(--text-secondary, #9CA3AF);
  cursor: pointer;
  padding: 8px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.icon-btn:hover {
  background: var(--bg-hover, rgba(255, 255, 255, 0.05));
  color: var(--text-primary, #F9FAFB);
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
  background: rgba(245, 158, 11, 0.15);
  border: 1px solid rgba(245, 158, 11, 0.3);
  color: #FCD34D;
}
.all-assigned {
  background: rgba(34, 197, 94, 0.15);
  border: 1px solid rgba(34, 197, 94, 0.3);
  color: #86EFAC;
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
  color: var(--text-secondary, #9CA3AF);
  margin: 0 0 16px 8px;
}

.category-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.category-card {
  background: var(--bg-elevated, rgba(255, 255, 255, 0.03));
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  transition: background 0.2s;
}
.category-card:hover {
  background: var(--bg-hover, rgba(255, 255, 255, 0.06));
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
.category-amount.positive { color: #4ADE80; }
.category-amount.negative { color: #F87171; }

.progress-bar-container {
  height: 6px;
  background: var(--bg-surface, rgba(255, 255, 255, 0.1));
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #22C55E;
  border-radius: 3px;
}
.progress-fill.overspent {
  background: #EF4444;
}

.budget-summary {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--bg-overlay, rgba(20, 20, 20, 0.8));
  backdrop-filter: blur(12px);
  border-top: 1px solid var(--border-color, rgba(255, 255, 255, 0.05));
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
  color: var(--text-secondary, #9CA3AF);
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
  background: #E05A3A;
  color: white;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(224, 90, 58, 0.4);
  z-index: 10;
  transition: transform 0.2s;
}
.budget-fab:hover {
  transform: scale(1.05);
}

.transaction-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  z-index: 100;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  animation: fade-in 0.2s;
}

.transaction-sheet {
  background: var(--bg-surface, #1C2128);
  width: 100%;
  max-width: 500px;
  border-radius: 24px 24px 0 0;
  padding: 24px 32px 40px;
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.05));
  box-shadow: 0 -10px 40px rgba(0,0,0,0.5);
  animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes slide-up {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

.sheet-handle {
  width: 40px; height: 5px;
  background: rgba(255, 255, 255, 0.2);
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
  color: var(--text-secondary, #9CA3AF);
  font-weight: 500;
}

.form-group input, .form-group select {
  background: var(--bg-elevated, rgba(255, 255, 255, 0.05));
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
  padding: 12px 16px;
  border-radius: 12px;
  color: white;
  font-size: 15px;
  width: 100%;
  outline: none;
}
.form-group input:focus, .form-group select:focus {
  border-color: #E05A3A;
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
  color: var(--text-secondary, #9CA3AF);
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
  color: var(--text-secondary, #9CA3AF);
}
select {
  appearance: none;
}

.save-tx-btn {
  width: 100%;
  background: #E05A3A;
  color: white;
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
  background: #CD5134;
}
</style>


