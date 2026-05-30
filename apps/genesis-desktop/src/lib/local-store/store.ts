import { writable, derived, readable } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import type { Block, ContentText, TextStyle, Mark, TextRange } from './block';
import { BlockType as BT, TextStyle as TS, MarkType, isTextBlock } from './block';

type EditorStore = {
  blocks: Map<string, Block>; rootChildren: string[]; focusedId: string | null;
  titleBlockId: string | null; descriptionBlockId: string | null;
  objectId: string | null; loaded: boolean; loading: boolean;
};
type TypeDef = { id: string; name: string; layout: string; icon: string; description: string; };
type RelationDef = { id: string; key: string; name: string; type: number; format: string; };
interface BlockRow { id: string; objectId: string; parentId?: string | null; type: string; content: string; fields: string; align: number; bgColor: string; position: number; createdAt: number; updatedAt: number; }
interface NoteWithBlocks { note: { id: string; title: string; icon?: string | null; cover?: string | null; layout: string; pinned: boolean; tags: string[]; isArchived: boolean; details: unknown; createdAt: number; updatedAt: number; }; blocks: BlockRow[]; }

const SYSTEM_TYPES: TypeDef[] = [
  { id: 'type-note', name: 'Note', layout: 'note', icon: '??', description: 'Rich text document' },
  { id: 'type-task', name: 'Task', layout: 'task', icon: '?', description: 'Task' },
  { id: 'type-journal', name: 'Journal', layout: 'journal', icon: '??', description: 'Daily journal' },
  { id: 'type-set', name: 'Set', layout: 'set', icon: '??', description: 'Collection' },
  { id: 'type-bookmark', name: 'Bookmark', layout: 'bookmark', icon: '??', description: 'Saved link' },
];
const SYSTEM_RELATIONS: RelationDef[] = [
  { id: 'rel-tags', key: 'tags', name: 'Tags', type: 11, format: 'multiSelect' },
  { id: 'rel-priority', key: 'priority', name: 'Priority', type: 3, format: 'select' },
  { id: 'rel-dueDate', key: 'dueDate', name: 'Due Date', type: 4, format: 'date' },
  { id: 'rel-status', key: 'status', name: 'Status', type: 3, format: 'select' },
  { id: 'rel-assignee', key: 'assignee', name: 'Assignee', type: 5, format: 'object' },
];

function parseContentText(s: string): ContentText {
  try {
    const p = JSON.parse(s);
    return { text: p.text ?? '', style: normStyle(p.style), marks: p.marks ?? [], checked: p.checked ?? false, color: p.color ?? '', iconEmoji: p.iconEmoji ?? '', iconImage: p.iconImage ?? '' };
  } catch { return { text: '', style: TS.Paragraph, marks: [], checked: false, color: '', iconEmoji: '', iconImage: '' }; }
}
function normStyle(style: unknown): TextStyle {
  if (typeof style === 'number') return style as TextStyle;
  if (typeof style === 'string') {
    const n = Number(style); if (Number.isFinite(n)) return n as TextStyle;
    const m: Record<string,TextStyle> = { paragraph:TS.Paragraph,header1:TS.Header1,h1:TS.Header1,header2:TS.Header2,h2:TS.Header2,header3:TS.Header3,h3:TS.Header3,header4:TS.Header4,h4:TS.Header4,quote:TS.Quote,code:TS.Code,title:TS.Title,checkbox:TS.Checkbox,todo:TS.Checkbox,bulleted:TS.Bulleted,bullet:TS.Bulleted,numbered:TS.Numbered,toggle:TS.Toggle,description:TS.Description,callout:TS.Callout,toggleheader1:TS.ToggleHeader1,toggleheader2:TS.ToggleHeader2,toggleheader3:TS.ToggleHeader3 };
    return m[style.toLowerCase()] ?? TS.Paragraph;
  }
  return TS.Paragraph;
}
function rowToBlock(row: BlockRow): Block {
  return { id: row.id, type: row.type as any, parentId: row.parentId ?? undefined, content: parseContentText(row.content), childrenIds: [], bgColor: row.bgColor || undefined, fields: row.fields ? tryJson(row.fields) : undefined };
}
function tryJson(s: string): any { try { return JSON.parse(s); } catch { return {}; } }
function mkContent(text: string, style: TextStyle, marks?: Mark[], checked?: boolean) {
  return { text, style, marks: marks ?? [], checked: checked ?? false, color: '', iconEmoji: '', iconImage: '' };
}

const toggleRevision = writable(0);

function createEditorStore() {
  const { subscribe, update, set } = writable<EditorStore>({ blocks: new Map(), rootChildren: [], focusedId: null, titleBlockId: null, descriptionBlockId: null, objectId: null, loaded: false, loading: false });

  // SINGLE declaration of toggleOpenState � kept outside writable to avoid cascade re-renders
  const toggleOpenState = new Map<string, boolean>();

  // Write-through text cache: typing never touches the writable store
  const liveText = new Map<string, { text: string; marks: Mark[] }>();
  const pendingSaves = new Map<string, { text: string; marks?: Mark[]; noteId: string }>();
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let flushingSaves: Promise<void> | null = null;
  let pendingInitId: string | null = null;

  function oid(): string { let r = ''; const u = subscribe((s) => { r = s.objectId ?? ''; }); u(); return r; }

  async function flushSaves() {
    if (flushingSaves) return flushingSaves;
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    if (pendingSaves.size === 0) return;

    const entries = [...pendingSaves.entries()];
    pendingSaves.clear();

    flushingSaves = Promise.all(entries.map(([blockId, { text, marks, noteId }]) =>
      invoke('notes_set_text_content', { noteId, blockId, text, marks: marks ?? [] })
        .catch((e) => console.error('[store] flush failed', e))
    )).then(() => {
      flushingSaves = null;
    });

    return flushingSaves;
  }
  function scheduleSave(blockId: string, text: string, marks: Mark[] | undefined, noteId: string) {
    pendingSaves.set(blockId, { text, marks, noteId });
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { void flushSaves(); }, 250);
  }

  function applyRows(objectId: string, rows: BlockRow[]) {
    const blocks = new Map<string, Block>(); const rootChildren: string[] = [];
    const byParent = new Map<string, string[]>(); let titleBlockId: string | null = null; let descriptionBlockId: string | null = null;
    const posMap = new Map<string, number>();
    for (const row of rows) {
      posMap.set(row.id, row.position); const b = rowToBlock(row); blocks.set(b.id!, b);
      if (!row.parentId) rootChildren.push(b.id!);
      else { if (!byParent.has(row.parentId)) byParent.set(row.parentId, []); byParent.get(row.parentId)!.push(b.id!); }
      if (b.content && 'style' in b.content) { const ct = b.content as ContentText; if (ct.style === TS.Title && !titleBlockId) titleBlockId = b.id!; else if (ct.style === TS.Description && !descriptionBlockId) descriptionBlockId = b.id!; }
    }
    for (const [pid, cids] of byParent) { const p = blocks.get(pid); if (p) { cids.sort((a,b) => (posMap.get(a)??0)-(posMap.get(b)??0)); blocks.set(pid, { ...p, childrenIds: cids }); } }
    rootChildren.sort((a,b) => (posMap.get(a)??0)-(posMap.get(b)??0));
    update((s) => ({ ...s, blocks, rootChildren, titleBlockId, descriptionBlockId, objectId }));
  }

  async function initEmpty(objectId: string) {
    // Pure local fallback — never writes to DB.
    // Called only when the backend is unreachable (offline) or returns zero blocks.
    // Ghost blocks created by the old invoke path caused duplicate DB rows and
    // the "note gone after switching" bug.
    const tid: string = crypto.randomUUID();
    const fid: string = crypto.randomUUID();
    const blocks = new Map<string, Block>();
    blocks.set(tid, { id: tid, type: BT.Text, childrenIds: [], content: mkContent('', TS.Title) as ContentText });
    blocks.set(fid, { id: fid, type: BT.Text, childrenIds: [], content: mkContent('', TS.Paragraph) as ContentText });
    update((s) => ({ ...s, blocks, rootChildren: [tid, fid], titleBlockId: tid, descriptionBlockId: null, objectId }));
  }

  async function init(objectId: string, source: 'notes'|'journal' = 'notes') {
    pendingInitId = objectId; const cur = () => pendingInitId === objectId;
    await flushSaves(); liveText.clear(); if (!cur()) return;
    set({ blocks: new Map(), rootChildren: [], focusedId: null, titleBlockId: null, descriptionBlockId: null, objectId, loaded: false, loading: true });
    if (!cur()) return;
    try {
      if (source === 'journal') {
        const res = await invoke<{blocks:string}|null>('get_journal_entry', { date: objectId }); if (!cur()) return;
        if (res?.blocks) { try { const p: any[] = JSON.parse(res.blocks); if (Array.isArray(p) && p.length > 0) { const fakeRows: BlockRow[] = p.map((b,i) => ({ id: b.id ?? crypto.randomUUID(), objectId, parentId: null, type: b.type ?? 'text', content: typeof b.content === 'string' ? b.content : JSON.stringify(b.content ?? {text:'',style:0,marks:[],checked:false}), fields: '{}', align: 0, bgColor: '', position: i, createdAt: 0, updatedAt: 0 })); if (!cur()) return; applyRows(objectId, fakeRows); if (!cur()) return; update((s) => ({...s,loading:false,loaded:true})); return; } } catch {} }
        if (!cur()) return; await initEmpty(objectId); if (!cur()) return; update((s) => ({...s,loading:false,loaded:true})); return;
      }
      const full = await invoke<NoteWithBlocks>('notes_object_full', { noteId: objectId }); if (!cur()) return;
      // Only call initEmpty for notes the Rust backend created with zero blocks
      // (should never happen — create_note_object always writes title+para stubs).
      // If blocks arrive empty it means a genuine DB issue, not a new note —
      // show one local empty paragraph without writing anything to the DB.
      if (full.blocks.length === 0) {
        // Local-only fallback — do NOT invoke notes_block_create here.
        const tid = crypto.randomUUID(); const fid = crypto.randomUUID();
        const blocks = new Map<string,Block>();
        blocks.set(tid, { id: tid, type: BT.Text, childrenIds: [], content: mkContent('', TS.Title) as ContentText });
        blocks.set(fid, { id: fid, type: BT.Text, childrenIds: [], content: mkContent('', TS.Paragraph) as ContentText });
        if (!cur()) return;
        update((s) => ({...s, blocks, rootChildren:[tid,fid], titleBlockId:tid, descriptionBlockId:null, objectId}));
      } else {
        applyRows(objectId, full.blocks);
      }
      if (!cur()) return; update((s) => ({...s,loading:false,loaded:true}));
    } catch (e) { if (!cur()) return; console.error('[store] init failed:', e); await initEmpty(objectId); if (!cur()) return; update((s) => ({...s,loading:false,loaded:true})); }
  }

  function focusBlock(id: string) { update((s) => ({...s,focusedId:id})); }
  function blurBlock() { update((s) => ({...s,focusedId:null})); }

  // -- Text write-through cache (NO store update on keystrokes) ----------
  async function persistBlockText(blockId: string, text: string, marks?: Mark[]) {
    liveText.set(blockId, { text, marks: marks ?? [] });
    scheduleSave(blockId, text, marks, oid());
  }
  function syncBlockTextToStore(blockId: string) {
    const live = liveText.get(blockId); if (!live) return;
    let block: Block | undefined; const u = subscribe((s) => { block = s.blocks.get(blockId); }); u();
    if (!block || !isTextBlock(block)) return;
    const ct = block.content as ContentText;
    if (ct.text === live.text) return;
    update((s) => { const nb = new Map(s.blocks); nb.set(blockId, { ...block!, content: { ...ct, text: live.text, marks: live.marks } }); return {...s,blocks:nb}; });
  }
  async function setBlockText(id: string, text: string, marks?: Mark[]) { await persistBlockText(id, text, marks); }
  async function flushPendingSaves() { await flushSaves(); }

  async function toggleMark(blockId: string, markType: MarkType, range: TextRange, param?: string) {
    let block: Block | undefined; const u = subscribe((s) => { block = s.blocks.get(blockId); }); u();
    if (!block || !isTextBlock(block)) return;
    const ct = block.content as ContentText; let marks = [...(ct.marks ?? [])];
    const ei = marks.findIndex((m) => m.type === markType && m.range.from === range.from && m.range.to === range.to);
    if (ei >= 0) marks.splice(ei, 1);
    else { marks = marks.filter((m) => m.type !== markType || !(m.range.from < range.to && m.range.to > range.from)); marks.push({ type: markType, range, param }); }
    marks.sort((a,b) => a.range.from - b.range.from);
    update((s) => { const nb = new Map(s.blocks); nb.set(blockId, {...block!,content:{...ct,marks}}); return {...s,blocks:nb}; });
    try { await invoke('notes_set_text_content', { noteId: oid(), blockId, text: ct.text, marks }); } catch (e) { console.error('[store] toggleMark', e); }
  }
  async function applyMarkToSelection(blockId: string, markType: MarkType) {
    const sel = window.getSelection(); if (!sel || sel.isCollapsed || !sel.rangeCount) return;
    const el = document.querySelector(`[data-block-id="${blockId}"] .editable`); if (!el) return;
    const r = sel.getRangeAt(0); const pre = document.createRange(); pre.selectNodeContents(el); pre.setEnd(r.startContainer, r.startOffset);
    const from = pre.toString().length; const to = from + r.toString().length; if (from === to) return;
    await toggleMark(blockId, markType, { from, to });
  }
  function hasMarkAtSelection(blockId: string, markType: MarkType): boolean {
    const sel = window.getSelection(); if (!sel || !sel.rangeCount) return false;
    const el = document.querySelector(`[data-block-id="${blockId}"] .editable`); if (!el) return false;
    const r = sel.getRangeAt(0); const pre = document.createRange(); pre.selectNodeContents(el); pre.setEnd(r.startContainer, r.startOffset);
    const from = pre.toString().length; const to = from + r.toString().length; if (from === to) return false;
    let block: Block | undefined; const u = subscribe((s) => { block = s.blocks.get(blockId); }); u();
    if (!block || !isTextBlock(block)) return false;
    return ((block.content as ContentText).marks ?? []).some((m) => m.type === markType && m.range.from <= from && m.range.to >= to);
  }

  async function setBlockChecked(blockId: string, checked: boolean) {
    let b: Block | undefined; const u = subscribe((s) => { b = s.blocks.get(blockId); }); u();
    if (!b || !isTextBlock(b)) return; const ct = b.content as ContentText;
    update((s) => { const nb = new Map(s.blocks); nb.set(blockId, {...b!,content:{...ct,checked}}); return {...s,blocks:nb}; });
    try { await invoke('notes_set_text_checked', { noteId: oid(), blockId, checked }); } catch (e) { console.error('[store] setBlockChecked', e); }
  }
  async function convertBlockStyle(blockId: string, newStyle: TextStyle) {
    let b: Block | undefined; const u = subscribe((s) => { b = s.blocks.get(blockId); }); u();
    if (!b || !isTextBlock(b)) return; const ct = b.content as ContentText;
    update((s) => { const nb = new Map(s.blocks); nb.set(blockId, {...b!,content:{...ct,style:newStyle}}); return {...s,blocks:nb}; });
    try { await invoke('notes_set_text_style', { noteId: oid(), blockIds: [blockId], style: String(newStyle) }); } catch (e) { console.error('[store] convertBlockStyle', e); }
  }

  async function addBlock(afterId?: string, text = '', style: TextStyle = TS.Paragraph): Promise<string> {
    let state: EditorStore | undefined; const u = subscribe((s) => { state = s; }); u();
    const objectId = state?.objectId; if (!objectId) return '';
    const children = state?.rootChildren ?? []; let position = children.length;
    if (afterId) { const idx = children.indexOf(afterId); if (idx !== -1) position = idx + 1; }
    try {
      const result: BlockRow = await invoke('notes_block_create', { params: { noteId: objectId, parentId: null, targetId: afterId ?? null, blockType: 'text', content: mkContent(text, style), position, align: 0, bgColor: null } });
      const newBlock = rowToBlock(result); const newId = newBlock.id!;
      update((s) => { const nb = new Map(s.blocks); nb.set(newId, newBlock); const nc = [...s.rootChildren]; if (afterId) { const idx = nc.indexOf(afterId); if (idx !== -1) nc.splice(idx+1,0,newId); else nc.push(newId); } else nc.push(newId); return {...s,blocks:nb,rootChildren:nc}; });
      return newId;
    } catch (e) { console.error('[store] addBlock', e); return ''; }
  }
  async function deleteBlock(blockId: string) {
    let state: EditorStore | undefined; const u = subscribe((s) => { state = s; }); u();
    if (state?.titleBlockId === blockId || state?.descriptionBlockId === blockId) return;
    const objectId = state?.objectId; if (!objectId) return;
    const childIds = state?.blocks.get(blockId)?.childrenIds ?? [];
    update((s) => { if (s.titleBlockId===blockId||s.descriptionBlockId===blockId) return s; const nb = new Map(s.blocks); nb.delete(blockId); for (const c of childIds) nb.delete(c); return {...s,blocks:nb,rootChildren:s.rootChildren.filter((id)=>id!==blockId&&!childIds.includes(id)),focusedId:s.focusedId===blockId?null:s.focusedId}; });
    try { await invoke('notes_block_unlink', { noteId: objectId, blockIds: [blockId,...childIds] }); } catch (e) { console.error('[store] deleteBlock', e); }
  }
  async function moveBlock(blockId: string, newIndex: number) {
    let state: EditorStore | undefined; const u = subscribe((s) => { state = s; }); u();
    const objectId = state?.objectId; if (!objectId) return;
    const idx = state?.rootChildren.indexOf(blockId) ?? -1; if (idx === -1) return;
    update((s) => { const c = [...s.rootChildren]; c.splice(idx,1); c.splice(Math.min(newIndex,c.length),0,blockId); return {...s,rootChildren:c}; });
    try { await invoke('notes_block_move', { params: { noteId: objectId, blockIds: [blockId], targetParentId: null, position: newIndex } }); } catch (e) { console.error('[store] moveBlock', e); }
  }
  async function duplicateBlock(blockId: string): Promise<string> {
    let state: EditorStore | undefined; const u = subscribe((s) => { state = s; }); u();
    const objectId = state?.objectId; if (!objectId||!state?.blocks.get(blockId)) return '';
    try {
      const rows = await invoke<BlockRow[]>('notes_block_duplicate', { params: { noteId: objectId, blockIds: [blockId], targetId: blockId } });
      const first = rows[0]; if (!first) return '';
      const nb2 = rowToBlock(first);
      update((s) => { const nb = new Map(s.blocks); nb.set(nb2.id!, nb2); const c = [...s.rootChildren]; const idx = c.indexOf(blockId); if (idx>=0) c.splice(idx+1,0,nb2.id!); else c.push(nb2.id!); return {...s,blocks:nb,rootChildren:c}; });
      return nb2.id!;
    } catch (e) { console.error('[store] duplicateBlock', e); return ''; }
  }
  async function addChildBlock(parentId: string, text = '', style: TextStyle = TS.Paragraph): Promise<string> {
    let state: EditorStore | undefined; const u = subscribe((s) => { state = s; }); u();
    const objectId = state?.objectId; if (!objectId) return '';
    const position = (state?.blocks.get(parentId)?.childrenIds ?? []).length;
    try {
      const result: BlockRow = await invoke('notes_block_create', { params: { noteId: objectId, parentId, targetId: null, blockType: 'text', content: mkContent(text, style), position, align: 0, bgColor: null } });
      const nb2 = rowToBlock(result); const newId = nb2.id!;
      update((s) => { const nb = new Map(s.blocks); nb.set(newId, nb2); const ep = nb.get(parentId); if (ep) nb.set(parentId, {...ep,childrenIds:[...(ep.childrenIds??[]),newId]}); return {...s,blocks:nb}; });
      return newId;
    } catch (e) { console.error('[store] addChildBlock', e); return ''; }
  }
  async function setBlockColor(blockId: string, color: string) {
    let b: Block | undefined; const u = subscribe((s) => { b = s.blocks.get(blockId); }); u();
    if (!b||!isTextBlock(b)) return; const ct = b.content as ContentText;
    update((s) => { const nb = new Map(s.blocks); nb.set(blockId, {...b!,content:{...ct,color}}); return {...s,blocks:nb}; });
    // Rust: notes_set_text_color(note_id, block_ids: Vec<String>, color)
    try { await invoke('notes_set_text_color', { noteId: oid(), blockIds: [blockId], color }); } catch (e) { console.error('[store] setBlockColor', e); }
  }
  async function setBlockBgColor(blockId: string, bgColor: string) {
    let state: EditorStore | undefined; const u = subscribe((s) => { state = s; }); u();
    const objectId = state?.objectId; const b = state?.blocks.get(blockId); if (!objectId||!b) return;
    update((s) => { const nb = new Map(s.blocks); nb.set(blockId, {...b!,bgColor:bgColor==='default'?undefined:bgColor}); return {...s,blocks:nb}; });
    try { await invoke('notes_set_background_color', { noteId: objectId, blockIds: [blockId], color: bgColor }); } catch (e) { console.error('[store] setBlockBgColor', e); }
  }
  async function setBlockAlign(blockId: string, align: string) {
    const aMap: Record<string,number> = {left:0,center:1,right:2,justify:3};
    let state: EditorStore | undefined; const u = subscribe((s) => { state = s; }); u();
    const objectId = state?.objectId; if (!objectId) return;
    const b = state?.blocks.get(blockId);
    if (b) update((s) => { const nb = new Map(s.blocks); nb.set(blockId, {...b,fields:{...(b.fields??{}),hAlign:align}}); return {...s,blocks:nb}; });
    try { await invoke('notes_set_align', { noteId: objectId, blockIds: [blockId], align: aMap[align]??0 }); } catch (e) { console.error('[store] setBlockAlign', e); }
  }
  async function clearBlockStyle(blockId: string) {
    let b: Block | undefined; const u = subscribe((s) => { b = s.blocks.get(blockId); }); u();
    if (!b||!isTextBlock(b)) return; const ct = b.content as ContentText;
    update((s) => { const nb = new Map(s.blocks); nb.set(blockId, {...b!,content:{...ct,marks:[],color:''}}); return {...s,blocks:nb}; });
    try { await invoke('notes_clear_text_style', { noteId: oid(), blockIds: [blockId] }); } catch (e) { console.error('[store] clearBlockStyle', e); }
  }

  function getBlock(id: string): Block|undefined { let r: Block|undefined; const u = subscribe((s)=>{r=s.blocks.get(id);}); u(); return r; }
  function getChildren(): Block[] { let r: Block[]=[]; const u = subscribe((s)=>{r=s.rootChildren.map((id)=>s.blocks.get(id)).filter((b):b is Block=>!!b);}); u(); return r; }
  function getBlockChildren(pid: string): Block[] { let r: Block[]=[]; const u = subscribe((s)=>{const p=s.blocks.get(pid);if(!p)return;r=(p.childrenIds??[]).map((id)=>s.blocks.get(id)).filter((b):b is Block=>!!b);}); u(); return r; }

  function isToggleOpen(id: string): boolean { return toggleOpenState.get(id)??false; }
  function setToggleOpen(id: string, open: boolean) { if (toggleOpenState.get(id)===open) return; toggleOpenState.set(id,open); toggleRevision.update((n) => n + 1); }

  function getSystemTypes() { return SYSTEM_TYPES; }
  function getSystemRelations() { return SYSTEM_RELATIONS; }
  function getTypeById(id: string) { return SYSTEM_TYPES.find((t)=>t.id===id); }

  return {
    subscribe, init, focusBlock, blurBlock,
    setBlockText, setBlockChecked, convertBlockStyle,
    toggleMark, applyMarkToSelection, hasMarkAtSelection,
    addBlock, deleteBlock, moveBlock, duplicateBlock, addChildBlock,
    setBlockColor, setBlockBgColor, setBlockAlign, clearBlockStyle,
    persistBlockText, syncBlockTextToStore,
    flushPendingSaves,
    getBlock, getChildren, getBlockChildren,
    isToggleOpen, setToggleOpen,
    getSystemTypes, getSystemRelations, getTypeById,
    clearBlocks(): void {
      const pid = crypto.randomUUID();
      update((s) => ({ ...s, blocks: new Map([[pid, { id: pid, type: BT.Text, childrenIds: [], content: mkContent('', TS.Paragraph) as ContentText }]]), rootChildren: [pid], focusedId: null }));
    },
  };
}

export const editorStore = createEditorStore();
export function blockById(id: string) {
  return readable<Block | null>(null, (set) => {
    let last: Block | null = null;
    return editorStore.subscribe(($s) => {
      const next = $s.blocks.get(id) ?? null;
      if (next !== last) {
        last = next;
        set(next);
      }
    });
  });
}
export const toggleStateVersion = derived(toggleRevision, ($n) => $n);
export const rootBlocks    = derived(editorStore, ($s) => $s.rootChildren.map((id)=>$s.blocks.get(id)).filter((b):b is Block=>!!b));
export const titleBlock    = derived(editorStore, ($s) => $s.titleBlockId ? ($s.blocks.get($s.titleBlockId)??null) : null);
export const focusedBlock  = derived(editorStore, ($s) => $s.focusedId   ? ($s.blocks.get($s.focusedId)??null)   : null);
export const isEditorLoading = derived(editorStore, ($s) => $s.loading);
export const isEditorLoaded  = derived(editorStore, ($s) => $s.loaded);
