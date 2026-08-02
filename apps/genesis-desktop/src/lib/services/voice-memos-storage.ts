// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

export interface VoiceMemoEntry {
  id: string;
  title: string;
  transcript?: string;
  duration: number;
  created: number;
  blobUrl?: string;
  filePath?: string;
  ext?: string;
  source: "dictation" | "voice_note" | "meeting" | "agent_conversation";
}

interface DBMemo {
  id: string;
  title: string;
  transcript?: string;
  duration: number;
  created: number;
  audio?: Blob;
  filePath?: string;
  ext?: string;
  source: "dictation" | "voice_note" | "meeting" | "agent_conversation";
}

const DB_NAME = "BentoVoiceMemos";
const DB_VERSION = 2;

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        reject(new Error("IndexedDB not available"));
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event) => {
        const db = request.result;
        const oldVersion = event.oldVersion;
        if (oldVersion < 1) {
          if (!db.objectStoreNames.contains("memos")) {
            const store = db.createObjectStore("memos", { keyPath: "id" });
            store.createIndex("created", "created", { unique: false });
          }
        }
        if (oldVersion < 2) {
          const store = request.transaction?.objectStore("memos");
          if (store && !store.indexNames.contains("source")) {
            store.createIndex("source", "source", { unique: false });
          }
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        dbPromise = null;
        reject(request.error);
      };
    });
  }
  return dbPromise;
}

export async function saveVoiceMemoEntry(
  entry: VoiceMemoEntry,
  audioBlob?: Blob,
): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("memos", "readwrite");
  const store = tx.objectStore("memos");
  const dbMemo: DBMemo = {
    id: entry.id,
    title: entry.title,
    transcript: entry.transcript,
    duration: entry.duration,
    created: entry.created,
    audio: audioBlob,
    filePath: entry.filePath,
    ext: entry.ext,
    source: entry.source,
  };
  await new Promise<void>((resolve, reject) => {
    const request = store.put(dbMemo);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function listVoiceMemoEntries(): Promise<{ entry: VoiceMemoEntry; blob?: Blob }[]> {
  const db = await getDB();
  const tx = db.transaction("memos", "readonly");
  const store = tx.objectStore("memos");
  const index = store.index("created");
  const records: DBMemo[] = await new Promise((resolve, reject) => {
    const request = index.getAll();
    request.onsuccess = () => resolve(request.result as DBMemo[]);
    request.onerror = () => { tx.abort(); reject(request.error); };
  });
  records.sort((a, b) => b.created - a.created);
  return records.map((r) => ({
    entry: {
      id: r.id,
      title: r.title,
      transcript: r.transcript,
      duration: r.duration,
      created: r.created,
      filePath: r.filePath,
      ext: r.ext,
      source: r.source,
    },
    blob: r.audio,
  }));
}

export async function deleteVoiceMemoEntry(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("memos", "readwrite");
  const store = tx.objectStore("memos");
  await new Promise<void>((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export function createBlobUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}

export function revokeBlobUrl(url: string): void {
  URL.revokeObjectURL(url);
}

export function isIndexedDBAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

export function generateTitle(transcript: string): string {
  const cleaned = transcript.trim();
  if (!cleaned) return "Voice Memo";
  const firstLine = cleaned.split("\n")[0];
  const truncated = firstLine.length > 60 ? firstLine.slice(0, 57) + "..." : firstLine;
  return truncated || "Voice Memo";
}

export function memoEntryFromTranscript(
  transcript: string,
  source: VoiceMemoEntry["source"],
  durationMs: number,
  audioFilePath?: string,
  existingId?: string,
): VoiceMemoEntry {
  const id = existingId ?? `voice-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return {
    id,
    title: generateTitle(transcript),
    transcript,
    duration: Math.round(durationMs / 1000),
    created: Date.now(),
    filePath: audioFilePath,
    ext: audioFilePath ? "wav" : undefined,
    source,
  };
}
