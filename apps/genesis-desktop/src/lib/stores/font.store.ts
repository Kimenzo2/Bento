import { writable } from "svelte/store";

export type FontPairing = {
  id: string;
  name: string;
  heading: string;
  body: string;
};

const FONT_KEY = "genesis_desktop_fonts";

export const fontPairings: FontPairing[] = [
  {
    id: "playful-classic",
    name: "Playful Classic",
    heading: "Fredoka",
    body: "Manrope",
  },
  {
    id: "editorial-focus",
    name: "Editorial Focus",
    heading: "Manrope",
    body: "Manrope",
  },
  {
    id: "bilingual-modern",
    name: "Bilingual Modern",
    heading: "Manrope",
    body: "Noto Sans Arabic Variable",
  },
];

const initialPairing =
  typeof window !== "undefined"
    ? fontPairings.find((entry) => entry.id === window.localStorage.getItem(FONT_KEY)) ?? fontPairings[0]
    : fontPairings[0];

export const fontStore = writable(initialPairing);

fontStore.subscribe((value) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(FONT_KEY, value.id);
});

export function setFontPairing(id: string) {
  const nextPairing = fontPairings.find((entry) => entry.id === id);
  if (nextPairing) {
    fontStore.set(nextPairing);
  }
}
