import { browser } from '$app/environment';
import { get, writable } from 'svelte/store';

import { activeModule } from '$lib/desktop/modules';
import {
  pickTranscriptionModel,
  startRecording,
  stopRecording,
  transcribeRecording,
} from '$lib/services/audio-recording';

const MODEL_PATH_KEY = 'bento:voice-dictation:model-path';
const LANGUAGE_KEY = 'bento:voice-dictation:language';

function createStoredStringStore(key: string, fallback = '') {
  const initial = browser ? (localStorage.getItem(key) ?? fallback) : fallback;
  const store = writable(initial);

  store.subscribe((value) => {
    if (!browser) return;
    if (!value) {
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(key, value);
  });

  return store;
}

export type DictationStatus = 'idle' | 'recording' | 'transcribing' | 'ready' | 'error';

export const transcriptionModelPath = createStoredStringStore(MODEL_PATH_KEY);
export const transcriptionLanguage = createStoredStringStore(LANGUAGE_KEY, 'en');
export const dictationStatus = writable<DictationStatus>('idle');
export const dictationTranscript = writable('');
export const voiceDockOpen = writable(false);
export const dictationError = writable('');

export function openVoiceDock(): void {
  voiceDockOpen.set(true);
}

export function toggleVoiceDock(): void {
  voiceDockOpen.update((value) => !value);
}

export async function chooseLocalTranscriptionModel(): Promise<string | null> {
  const path = await pickTranscriptionModel();
  if (path) {
    transcriptionModelPath.set(path);
  }
  return path;
}

export async function startDictation(): Promise<void> {
  const moduleId = get(activeModule) || 'dashboard';
  dictationError.set('');
  dictationTranscript.set('');
  dictationStatus.set('recording');
  await startRecording(moduleId);
}

export async function stopDictation(): Promise<string> {
  dictationError.set('');
  dictationStatus.set('transcribing');

  const session = await stopRecording();
  const modelPath = get(transcriptionModelPath).trim();
  if (!modelPath) {
    dictationStatus.set('ready');
    throw new Error('Choose a local Whisper model first.');
  }

  const language = get(transcriptionLanguage).trim() || undefined;
  const transcript = await transcribeRecording(session.id, modelPath, language);
  dictationTranscript.set(transcript);
  dictationStatus.set('ready');
  return transcript;
}

export async function toggleDictation(): Promise<void> {
  const current = get(dictationStatus);
  if (current === 'recording') {
    await stopDictation();
    return;
  }
  await startDictation();
}

export async function insertTranscriptIntoFocusedElement(text: string): Promise<boolean> {
  if (!browser || !text.trim()) return false;

  const active = document.activeElement as HTMLElement | null;
  if (!active) return false;

  if (active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement) {
    const value = active.value;
    const start = active.selectionStart ?? value.length;
    const end = active.selectionEnd ?? value.length;
    const next = `${value.slice(0, start)}${text}${value.slice(end)}`;
    active.value = next;
    const caret = start + text.length;
    active.setSelectionRange(caret, caret);
    active.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, data: text, inputType: 'insertText' }));
    return true;
  }

  if (active.isContentEditable) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      active.textContent = `${active.textContent ?? ''}${text}`;
      active.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, data: text, inputType: 'insertText' }));
      return true;
    }

    const range = selection.getRangeAt(0);
    range.deleteContents();
    const node = document.createTextNode(text);
    range.insertNode(node);
    range.setStartAfter(node);
    range.setEndAfter(node);
    selection.removeAllRanges();
    selection.addRange(range);
    active.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, data: text, inputType: 'insertText' }));
    return true;
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  return false;
}
