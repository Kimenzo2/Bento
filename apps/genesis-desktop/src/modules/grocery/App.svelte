<script lang="ts">
  import { Plus, Mic, CheckCircle2, ChevronDown, Share2, Search, Trash2, ShoppingCart } from 'lucide-svelte';
  

  let currentList = "Weekly Shop";
  let newItem = "";
  
  type GroceryItem = {
    id: string;
    name: string;
    quantity: string;
    category: string;
    checked: boolean;
  };

  let items: GroceryItem[] = [
    { id: "1", name: "Oat Milk", quantity: "2 liters", category: "DAIRY", checked: false },
    { id: "2", name: "Bananas", quantity: "1 bunch", category: "PRODUCE", checked: false },
    { id: "3", name: "Sourdough Bread", quantity: "1 loaf", category: "BAKERY", checked: false },
    { id: "4", name: "Chicken Breast", quantity: "1 kg", category: "MEAT", checked: true },
    { id: "5", name: "Frozen Peas", quantity: "2 bags", category: "FROZEN", checked: true }
  ];

  // Svelte 4 reactivity
  $: uncheckedItems = items.filter(i => !i.checked);
  $: checkedItems = items.filter(i => i.checked);
  $: checkedCount = checkedItems.length;

  function toggleItem(id: string) {
    items = items.map(item => item.id === id ? { ...item, checked: !item.checked } : item);
  }

  function addItem(e: Event) {
    e.preventDefault();
    if (!newItem.trim()) return;
    
    items = [
      {
        id: Date.now().toString(),
        name: newItem,
        quantity: "1",
        category: "OTHER",
        checked: false
      },
      ...items
    ];
    newItem = "";
  }
</script>

<div class="grocery-app module-root">
  <div class="header">
    <div class="list-dropdown">
      <h2>{currentList}</h2>
      <ChevronDown size={24} style="color: var(--grocery-muted)" />
    </div>
    <div class="actions">
      <button type="button" class="action-btn" title="Share List"><Share2 size={24}/></button>
      <button type="button" class="action-btn" title="New List"><Plus size={24}/></button>
    </div>
  </div>

  <form class="add-item-bar" on:submit={addItem}>
    <input type="text" bind:value={newItem} placeholder="Add item..." class="item-input" />
    <button type="button" class="voice-btn" title="Voice Add"><Mic size={24} /></button>
  </form>

  <div class="grocery-content">
    <div class="list-section">
      {#if uncheckedItems.length === 0}
        <div class="empty-state">
          <ShoppingCart size={48} style="color: var(--grocery-muted)" />
          <p>Your list is empty.</p>
        </div>
      {/if}
      
      {#each uncheckedItems as item (item.id)}
        <button type="button" class="item-row" on:click={() => toggleItem(item.id)}>
          <div class="check-box"></div>
          <div class="item-info">
            <span class="name">{item.name}</span>
            <span class="category">{item.category}</span>
          </div>
          <span class="quantity">{item.quantity}</span>
        </button>
      {/each}
    </div>

    {#if checkedCount > 0}
      <div class="checked-section">
        <div class="checked-header">
          <h3>Checked ({checkedCount})</h3>
          <button type="button" class="clear-btn"><Trash2 size={18} /> Clear</button>
        </div>
        
        {#each checkedItems as item (item.id)}
          <button type="button" class="item-row checked" on:click={() => toggleItem(item.id)}>
            <div class="check-box active"><CheckCircle2 size={24} /></div>
            <div class="item-info">
              <span class="name">{item.name}</span>
              <span class="category">{item.category}</span>
            </div>
            <span class="quantity">{item.quantity}</span>
          </button>
        {/each}
      </div>
    {/if}
  </div>
</div>


<style>
.grocery-app {
  --grocery-bg: var(--background);
  --grocery-surface: color-mix(in srgb, var(--surface) 94%, var(--background));
  --grocery-surface-strong: color-mix(in srgb, var(--surface) 82%, var(--background));
  --grocery-ink: var(--foreground);
  --grocery-muted: var(--muted);
  --grocery-border: var(--border);
  --grocery-accent: var(--primary);
  --grocery-overlay: color-mix(in srgb, var(--background) 72%, transparent);
  --grocery-soft: color-mix(in srgb, var(--surface) 90%, var(--background));
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--grocery-bg);
  color: var(--grocery-ink);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid var(--grocery-border);
}

.list-dropdown {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.list-dropdown h2 {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
}

.actions {
  display: flex;
  gap: 16px;
}

.action-btn {
  background: none;
  border: none;
  color: var(--grocery-muted);
  cursor: default;
  padding: 4px;
}

.action-btn:hover {
  color: var(--grocery-ink);
}

.add-item-bar {
  display: flex;
  align-items: center;
  padding: 0 16px;
  margin: 16px 0;
  gap: 12px;
}

.item-input {
  flex: 1;
  background: var(--grocery-surface);
  border: 1px solid var(--grocery-border);
  padding: 16px;
  font-size: 18px;
  border-radius: 4px;
  color: var(--grocery-ink);
}

.item-input:focus {
  outline: none;
  border-color: var(--grocery-accent);
}

.voice-btn {
  background: var(--grocery-soft);
  border: 1px solid var(--grocery-border);
  color: var(--grocery-ink);
  padding: 16px;
  border-radius: 4px;
  cursor: default;
  display: flex;
  align-items: center;
  justify-content: center;
}

.voice-btn:hover {
  background: var(--grocery-surface-strong);
}

.grocery-content {
  flex: 1;
  overflow-y: auto;
  padding: 0 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.item-row {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 16px;
  padding: 16px 0;
  border-bottom: 1px solid var(--grocery-border);
  border: none;
  background: transparent;
  cursor: default;
  text-align: left;
}

.item-row:hover {
  background: var(--grocery-surface);
}

.check-box {
  width: 44px;
  height: 44px;
  border: 2px solid var(--grocery-border);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
}

.check-box.active {
  border: none;
  color: var(--grocery-ink);
}

.item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.name {
  font-size: 18px;
  font-weight: 500;
}

.category {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.5px;
  color: var(--grocery-muted);
  text-transform: uppercase;
}

.quantity {
  font-size: 16px;
  color: var(--grocery-muted);
}

.checked-section {
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--grocery-border);
  padding-top: 16px;
}

.checked-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 8px;
}

.checked-header h3 {
  font-size: 14px;
  text-transform: uppercase;
  color: var(--grocery-muted);
  margin: 0;
  letter-spacing: 0.5px;
}

.clear-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  background: none;
  border: none;
  color: var(--grocery-muted);
  cursor: default;
  font-size: 14px;
}

.clear-btn:hover {
  color: var(--grocery-ink);
}

.item-row.checked {
  opacity: 0.5;
}

.item-row.checked .name {
  text-decoration: line-through;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 0;
  color: var(--grocery-muted);
}

.empty-state p {
  margin-top: 16px;
  font-size: 16px;
}

</style>


