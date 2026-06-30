import { openExternal } from "$lib/desktop/open-external";

export function initEnterprisePolish() {
  // ── 16. RIGHT-CLICK CONTEXT MENU ──────────────
  // Disable browser default. Enterprise apps have their own or none.
  document.addEventListener("contextmenu", (e) => {
    e.preventDefault();
  });

  // ── 17. BROWSER ZOOM PREVENTION ───────────────
  // Ctrl+scroll, Ctrl++, Ctrl+-, Ctrl+0
  document.addEventListener(
    "wheel",
    (e) => {
      if (e.ctrlKey) e.preventDefault();
    },
    { passive: false },
  );

  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && ["+", "-", "=", "0"].includes(e.key)) {
      e.preventDefault();
    }
  });

  // ── 18. DEVTOOLS PREVENTION (production only) ──
  if (!import.meta.env.DEV) {
    document.addEventListener("keydown", (e) => {
      if (
        e.key === "F12" ||
        (e.ctrlKey && e.shiftKey && e.key === "I") ||
        (e.ctrlKey && e.shiftKey && e.key === "J") ||
        (e.ctrlKey && e.key === "U")
      ) {
        e.preventDefault();
      }
    });
  }

  // ── 19. BROWSER RELOAD PREVENTION ─────────────
  if (!import.meta.env.DEV) {
    document.addEventListener("keydown", (e) => {
      if (e.key === "F5" || (e.ctrlKey && e.key === "r")) {
        e.preventDefault();
      }
    });
  }

  // ── 20. IMAGE DRAG PREVENTION ─────────────────
  document.addEventListener("dragstart", (e) => {
    if ((e.target as HTMLElement).tagName === "IMG") {
      e.preventDefault();
    }
  });

  // ── 21. macOS KEYBOARD BEEP PREVENTION ────────
  document.addEventListener("keydown", (e) => {
    const tag = (e.target as HTMLElement).tagName.toLowerCase();
    const isInput =
      ["input", "textarea"].includes(tag) || (e.target as HTMLElement).isContentEditable;
    if (!isInput && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const allowedKeys = [
        "Tab",
        "Escape",
        "Enter",
        " ",
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
      ];
      if (!allowedKeys.includes(e.key)) {
        e.preventDefault();
      }
    }
  });

  // ── 22. LINK HANDLING ─────────────────────────
  // All <a href> clicks open in system browser, not in WebView
  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const link = target.closest("a[href]") as HTMLAnchorElement | null;
    if (link && link.href && !link.href.startsWith("javascript:")) {
      const url = link.href;
      if (url.startsWith("http://") || url.startsWith("https://")) {
        e.preventDefault();
        void openExternal(url).catch((error) => {
          console.warn("[Enterprise] Failed to open external link:", error);
        });
      }
    }
  });
}
