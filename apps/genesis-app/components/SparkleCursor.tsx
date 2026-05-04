import type React from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { useTheme } from '../hooks/useTheme';
import type { Theme } from '../types/theme';

/**
 * SparkleCursor — lightweight mouse sparkle effect.
 *
 * Performance notes:
 * - Uses refs instead of state to avoid React re-renders
 * - Throttled to requestAnimationFrame (1 paint per frame, not 60+ state updates/sec)
 * - Canvas-based rendering instead of DOM elements
 * - Respects prefers-reduced-motion
 * - Does not run on touch-only devices
 */

interface Sparkle {
  x: number;
  y: number;
  size: number;
  color: string;
  life: number; // 0-1, decreases each frame
  vy: number; // vertical velocity (gravity)
}

const MAX_SPARKLES = 20;
const SPAWN_CHANCE = 0.2;

function resolveSparkleColor(theme: Theme, isDarkMode: boolean) {
  if (typeof document === 'undefined') {
    return isDarkMode && theme.darkColors ? theme.darkColors.primary[0] : theme.colors.primary[0];
  }

  const activeVariables =
    isDarkMode && theme.darkCssVariables ? theme.darkCssVariables : theme.cssVariables;
  const rootStyles = window.getComputedStyle(document.documentElement);
  const direct = rootStyles.getPropertyValue('--primary').trim() || activeVariables['--primary'];
  if (direct) return direct;

  const legacy =
    rootStyles.getPropertyValue('--color-primary-start').trim() ||
    activeVariables['--color-primary-start'];
  if (legacy) return legacy;

  return isDarkMode && theme.darkColors ? theme.darkColors.primary[0] : theme.colors.primary[0];
}

const SparkleCursor: React.FC = () => {
  const { currentTheme, isDarkMode } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sparklesRef = useRef<Sparkle[]>([]);
  const rafRef = useRef<number>(0);
  const mouseRef = useRef({ x: 0, y: 0, active: false });
  const sparkleColorRef = useRef(resolveSparkleColor(currentTheme, isDarkMode));

  const syncSparkleColor = useCallback(() => {
    sparkleColorRef.current = resolveSparkleColor(currentTheme, isDarkMode);
  }, [currentTheme, isDarkMode]);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize canvas to match viewport if needed
    if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Update and draw sparkles
    const alive: Sparkle[] = [];
    for (const s of sparklesRef.current) {
      s.life -= 0.03;
      s.y += s.vy;
      s.vy += 0.08; // gravity

      if (s.life > 0) {
        alive.push(s);
        const currentSize = s.size * s.life;
        const alpha = s.life;

        ctx.globalAlpha = alpha;
        ctx.fillStyle = s.color;
        ctx.shadowBlur = currentSize * 2;
        ctx.shadowColor = s.color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, currentSize, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    sparklesRef.current = alive;

    rafRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    syncSparkleColor();

    // Skip on touch-only devices or reduced motion preference
    const isTouch =
      window.matchMedia('(pointer: coarse)').matches &&
      !window.matchMedia('(pointer: fine)').matches;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isTouch || reducedMotion) return;

    const handleThemeChanged = () => {
      syncSparkleColor();
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
      mouseRef.current.active = true;

      if (Math.random() < SPAWN_CHANCE && sparklesRef.current.length < MAX_SPARKLES) {
        sparklesRef.current.push({
          x: e.clientX,
          y: e.clientY,
          size: Math.random() * 4 + 2,
          color: sparkleColorRef.current,
          life: 1,
          vy: -(Math.random() * 1.5 + 0.5), // slight upward initial velocity
        });
      }
    };

    window.addEventListener('themeChanged', handleThemeChanged);
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('themeChanged', handleThemeChanged);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(rafRef.current);
    };
  }, [animate, syncSparkleColor]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0"
      style={{ zIndex: 9999 }}
      aria-hidden="true"
    />
  );
};

export default SparkleCursor;
