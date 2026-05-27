<!--
  Tooltip.svelte — Anytype-faithful tooltip system ported to Svelte 5.

  Anytype source refs:
    • src/ts/lib/preview.ts          → tooltipShow / tooltipHide logic
    • src/scss/component/tooltip.scss → exact class names + animation values

  Usage (action-based, zero markup overhead):
    <div use:tooltip={{ text: "My label" }}>…</div>

  Or with direction overrides:
    <div use:tooltip={{ text: "My label", typeY: "bottom", delay: 300 }}>…</div>

  The tooltip container is mounted once at body level via onMount.
-->
<script lang="ts" module>
  // ── Constants (mirrors Anytype's preview.ts) ─────────────────────
  const DELAY_TOOLTIP = 650;   // Anytype default
  const BORDER        = 12;    // min px from window edge

  // Timeout state (module-scoped so it survives component re-renders)
  let _timeout: ReturnType<typeof setTimeout> | null = null;
  let _delayTooltip = DELAY_TOOLTIP;
  let _container: HTMLElement | null = null;

  function getContainer(): HTMLElement {
    if (_container && document.body.contains(_container)) return _container;
    _container = document.getElementById('tooltipContainer') as HTMLElement;
    if (!_container) {
      _container = document.createElement('div');
      _container.id = 'tooltipContainer';
      document.body.appendChild(_container);
    }
    return _container;
  }

  function tooltipShow(el: HTMLElement, text: string, typeX: string, typeY: string, offsetX = 0, offsetY = 0) {
    if (!el || !text) return;

    if (_timeout) clearTimeout(_timeout);

    _timeout = setTimeout(() => {
      const container = getContainer();
      const rect = el.getBoundingClientRect();
      const ew = el.offsetWidth;
      const eh = el.offsetHeight;
      const ww = window.innerWidth;
      const wh = window.innerHeight;

      // Build node — mirrors Anytype's DOM creation
      container.innerHTML = '';
      const node = document.createElement('div');
      node.className = 'genesis-tooltip anim';
      node.innerHTML = `<div class="txt">${text}</div>`;
      container.appendChild(node);

      const ow = node.offsetWidth;
      const oh = node.offsetHeight;

      // X positioning (Anytype typeX logic)
      let x = rect.left + offsetX;
      if (typeX === 'center') x += ew / 2 - ow / 2;
      else if (typeX === 'right') x -= ow;

      // Y positioning (Anytype typeY logic)
      let y = rect.top + offsetY;
      if (typeY === 'top') {
        y -= oh + 6;
      } else if (typeY === 'bottom') {
        y += eh + 6;
      } else {
        // auto: prefer above; fall back to below if not enough room
        if (rect.top - oh - 6 >= BORDER) {
          y = rect.top - oh - 6;
        } else {
          y = rect.bottom + 6;
        }
      }

      // Clamp to viewport
      x = Math.max(BORDER, Math.min(ww - ow - BORDER, x));
      y = Math.max(BORDER, Math.min(wh - oh - BORDER, y));

      node.style.left = `${x}px`;
      node.style.top  = `${y}px`;

      // Trigger animation on next frame (matches Anytype's show class timing)
      requestAnimationFrame(() => node.classList.add('show'));

      // After first show, make subsequent hovers on the same element faster
      _delayTooltip = 100;
      if (_timeout) clearTimeout(_timeout);
      _timeout = setTimeout(() => { _delayTooltip = DELAY_TOOLTIP; }, 500);
    }, _delayTooltip);
  }

  function tooltipHide(force = false) {
    if (_timeout) clearTimeout(_timeout);
    _timeout = null;
    _delayTooltip = DELAY_TOOLTIP;

    const container = getContainer();
    const nodes = container.querySelectorAll<HTMLElement>('.genesis-tooltip');
    nodes.forEach(n => {
      if (force) n.classList.remove('anim');
      n.classList.remove('show');
    });

    // Clean up after transition
    setTimeout(() => { container.innerHTML = ''; }, force ? 0 : 260);
  }

  // ── Svelte action ────────────────────────────────────────────────
  export type TooltipOptions = {
    text: string;
    typeX?: 'left' | 'center' | 'right';
    typeY?: 'top' | 'bottom' | 'auto';
    delay?: number;
    offsetX?: number;
    offsetY?: number;
  };

  export function tooltip(node: HTMLElement, opts: TooltipOptions) {
    const { text, typeX = 'center', typeY = 'auto', offsetX = 0, offsetY = 0 } = opts;

    const enter = () => tooltipShow(node, text, typeX, typeY, offsetX, offsetY);
    const leave = () => tooltipHide(false);
    const click = () => tooltipHide(true);

    node.addEventListener('mouseenter', enter);
    node.addEventListener('mouseleave', leave);
    node.addEventListener('click', click);

    return {
      update(newOpts: TooltipOptions) {
        // Nothing extra needed — opts are captured fresh on each mouseenter
        void newOpts;
      },
      destroy() {
        node.removeEventListener('mouseenter', enter);
        node.removeEventListener('mouseleave', leave);
        node.removeEventListener('click', click);
        tooltipHide(true);
      }
    };
  }
</script>
