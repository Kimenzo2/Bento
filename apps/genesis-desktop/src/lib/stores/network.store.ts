import { writable } from "svelte/store";

export const networkStore = writable({
  online: typeof navigator === "undefined" ? true : navigator.onLine,
});

if (typeof window !== "undefined") {
  const updateNetwork = () => {
    networkStore.set({ online: navigator.onLine });
  };

  window.addEventListener("online", updateNetwork);
  window.addEventListener("offline", updateNetwork);
}
