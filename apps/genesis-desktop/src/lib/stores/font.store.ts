// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

import { derived } from "svelte/store";
import { fontPairings, type FontPairing } from "$lib/data/preferences";
import { desktopSettings, updateDesktopSettings } from "$lib/desktop/settings";

export { fontPairings };
export type { FontPairing };

export const fontStore = derived(desktopSettings, ($settings) => {
  return (
    fontPairings.find((entry) => entry.id === $settings.appearance.fontPairingId) ?? fontPairings[0]
  );
});

export function setFontPairing(id: string) {
  void updateDesktopSettings((current) => ({
    ...current,
    appearance: {
      ...current.appearance,
      fontPairingId: fontPairings.find((entry) => entry.id === id)?.id ?? fontPairings[0].id,
    },
  }));
}
