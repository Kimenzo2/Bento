import { writable } from 'svelte/store';

export type DesktopLifecycleState = 'Backgrounded' | 'Busy' | 'Exiting' | 'Idle';

export const lifecycleStore = writable<DesktopLifecycleState>('Idle');

export function setLifecycleState(state: DesktopLifecycleState) {
  lifecycleStore.set(state);
}
