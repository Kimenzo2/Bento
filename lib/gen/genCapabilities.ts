/**
 * Gen Rendering Capabilities Detection
 *
 * Detects what rendering features are available for Gen.
 * This is useful for:
 * - Logging/debugging rendering mode
 * - Showing appropriate UI for different capability levels
 * - Feature detection before mounting
 */

export interface GenCapabilities {
  /** OffscreenCanvas is supported (rendering can move to worker) */
  offscreenCanvas: boolean;
  /** SharedArrayBuffer is available (cross-origin isolated, 344Hz lip sync) */
  sharedArrayBuffer: boolean;
  /** Web Workers are supported */
  webWorkers: boolean;
  /** WebGPU is supported (future: high-quality rendering) */
  webGPU: boolean;
  /** The rendering mode that will be used */
  renderMode: 'worker' | 'main-thread';
  /** The data transfer mode for lip sync */
  lipSyncMode: 'shared-memory' | 'postmessage';
}

/**
 * Detect Gen rendering capabilities.
 * Call this before mounting to understand what mode will be used.
 */
export function detectGenCapabilities(): GenCapabilities {
  const offscreenCanvas = detectOffscreenCanvas();
  const sharedArrayBuffer = detectSharedArrayBuffer();
  const webWorkers = typeof Worker !== 'undefined';
  const webGPU = detectWebGPU();

  // Rendering mode: worker if OffscreenCanvas + Workers available
  const renderMode = offscreenCanvas && webWorkers ? 'worker' : 'main-thread';

  // Lip sync mode: shared memory if SharedArrayBuffer available (requires COOP/COEP)
  const lipSyncMode = sharedArrayBuffer ? 'shared-memory' : 'postmessage';

  return {
    offscreenCanvas,
    sharedArrayBuffer,
    webWorkers,
    webGPU,
    renderMode,
    lipSyncMode,
  };
}

/**
 * Check if OffscreenCanvas with transferControlToOffscreen is available.
 */
function detectOffscreenCanvas(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof OffscreenCanvas === 'undefined') return false;

  try {
    const testCanvas = document.createElement('canvas');
    return 'transferControlToOffscreen' in testCanvas;
  } catch {
    return false;
  }
}

/**
 * Check if SharedArrayBuffer is available.
 * Requires cross-origin isolation (COOP/COEP headers).
 */
function detectSharedArrayBuffer(): boolean {
  if (typeof SharedArrayBuffer === 'undefined') return false;
  return typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated;
}

/**
 * Check if WebGPU is available.
 */
function detectWebGPU(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

/**
 * Log Gen capabilities to console (development only).
 */
export function logGenCapabilities(capabilities: GenCapabilities): void {
  if (import.meta.env.PROD) return;

  const modeEmoji = capabilities.renderMode === 'worker' ? '🚀' : '🐢';
  const lipSyncEmoji = capabilities.lipSyncMode === 'shared-memory' ? '⚡' : '📨';

  console.group('[Gen] Rendering Capabilities');
  console.log(`${modeEmoji} Render Mode: ${capabilities.renderMode}`);
  console.log(`${lipSyncEmoji} Lip Sync: ${capabilities.lipSyncMode}`);
  console.log(`  • OffscreenCanvas: ${capabilities.offscreenCanvas ? '✅' : '❌'}`);
  console.log(`  • SharedArrayBuffer: ${capabilities.sharedArrayBuffer ? '✅' : '❌'}`);
  console.log(`  • Web Workers: ${capabilities.webWorkers ? '✅' : '❌'}`);
  console.log(`  • WebGPU: ${capabilities.webGPU ? '✅' : '❌'}`);

  if (!capabilities.sharedArrayBuffer) {
    console.log(
      '%c⚠️ SharedArrayBuffer not available. Check COOP/COEP headers for 344Hz lip sync.',
      'color: orange'
    );
  }

  console.groupEnd();
}
