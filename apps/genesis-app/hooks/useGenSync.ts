/**
 * useGenSync
 *
 * Reads Genesis state (realm, tier, generation status)
 * and publishes it to Gen on every change.
 *
 * Call this hook once at the top of the main layout component.
 */
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';
import { useGen } from '../contexts/GenContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import type { Realm } from '../lib/gen/genPersonality';

// Map Genesis theme to Gen realm
// Genesis themes: 'genesis' | 'aurora' | 'ocean' | 'forest' | 'nebula' | 'sunset'
// Gen realms: 'kingdom' | 'cosmos' | 'cell'
function themeToRealm(themeId: string): Realm {
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
  const { publishContext, fireTrigger, isMounted } = useGen();
  const location = useLocation();
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const hasTriggeredSessionStart = useRef(false);

  // Sync route changes
  useEffect(() => {
    if (!isMounted) return;

    publishContext({
      route: location.pathname,
    });
    fireTrigger('page_change');
  }, [location.pathname, publishContext, fireTrigger, isMounted]);

  // Sync theme/realm changes
  useEffect(() => {
    if (!isMounted) return;

    const realm = themeToRealm(currentTheme.id);
    publishContext({ realm });
  }, [currentTheme.id, publishContext, isMounted]);

  // Session start trigger on first mount with authenticated user
  useEffect(() => {
    if (!isMounted || !user || hasTriggeredSessionStart.current) return;

    hasTriggeredSessionStart.current = true;
    fireTrigger('session_start');
  }, [isMounted, user, fireTrigger]);
}
