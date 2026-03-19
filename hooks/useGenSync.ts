/**
 * useGenSync
 *
 * STUBBED VERSION - gen-engine packages temporarily removed for deployment.
 *
 * Reads Genesis state (realm, tier, generation status)
 * and publishes it to Gen on every change.
 *
 * Call this hook once at the top of the main layout component.
 *
 * TODO: Restore full functionality when gen-engine packages are published to npm.
 */

// Stub type matching @gen-engine/bridge
type Realm = 'kingdom' | 'cosmos' | 'cell';

// Map Genesis theme to Gen realm (kept for future use)
// Genesis themes: 'genesis' | 'aurora' | 'ocean' | 'forest' | 'nebula' | 'sunset'
// Gen realms: 'kingdom' | 'cosmos' | 'cell'
export function _themeToRealm(themeId: string): Realm {
  switch (themeId) {
    case 'nebula':
    case 'ocean':
      return 'cosmos';
    case 'forest':
      return 'cell';
    case 'genesis':
    case 'aurora':
    case 'sunset':
    default:
      return 'kingdom';
  }
}

export function useGenSync() {
  // No-op stub: gen-engine not available
  // The hook is called but does nothing until gen-engine is integrated
}
