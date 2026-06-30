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
