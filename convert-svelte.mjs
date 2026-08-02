// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

// Batch convert hardcoded colors in Svelte files to OKLCH
// Skips: brand data colors, mood/highlight palette colors, HTML export templates
import fs from 'fs';
import path from 'path';

function hexToRgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
  return [parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255];
}

function srgbToLinear(c) { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }

function linearToOklab(r, g, b) {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
  return [
    0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
  ];
}

function fmt(s) {
  let r = s.replace(/0+$/, '');
  if (r.endsWith('.')) r = r.slice(0, -1);
  if (r === '-0' || r === '-0.0') r = '0';
  return r;
}

function hexToOklch(hex) {
  const [r, g, b] = hexToRgb(hex);
  const [lr, lg, lb] = [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)];
  const [L, a, b_] = linearToOklab(lr, lg, lb);
  const C = Math.sqrt(a * a + b_ * b_);
  let H = Math.atan2(b_, a) * (180 / Math.PI);
  if (H < 0) H += 360;
  return `oklch(${fmt(L.toFixed(3))} ${fmt(C.toFixed(3))} ${fmt(H.toFixed(3))})`;
}

function oklchBlack(a) { return `oklch(0 0 0 / ${a})`; }
function oklchWhite(a) { return `oklch(1 0 89.876 / ${a})`; }

// Build all conversions
const hexConversions = {};
const allHex = [
  '#000000', '#08090b', '#0b0b0b', '#0d0d0d', '#0f1115', '#111111', '#141414',
  '#1a1a2e', '#222222', '#3a3a3c', '#4285f4', '#5f61ed', '#60a5fa', '#6366f1',
  '#6b7aff', '#6b7280', '#6c8cf7', '#737373', '#774fc4', '#787873',
  '#818cf8', '#888888', '#8b5cf6', '#8b8df0', '#93bbfd', '#9a9ca3', '#9e9e9e',
  '#a3a3a3', '#a855f7', '#d97706', '#dfe0e3', '#e05a3a', '#e05c5c',
  '#e11d48', '#e2b631', '#e74c3c', '#e8e8e8', '#e9e9eb',
  '#ef4444', '#f0b429', '#f0f0f0', '#f59e0b', '#f7f7f8', '#f87171',
  '#f97316', '#fff', '#ffffff', '#ff453a',
  '#10a37f', '#10b981', '#16a34a', '#1aa6a6', '#1b5e3b',
  '#22c55e', '#2e7d32', '#34a853', '#3730a3', '#38bdf8',
  '#3b82f6', '#4285f4', '#4c0519', '#4d6bfe', '#52b788',
  '#58cc02', '#5e6ad2', '#5f1231', '#6b1f0a', '#6c5ce7',
  '#774fc4', '#7c3aed', '#7a6200', '#818cf8', '#831843',
  '#8b5cf6', '#8cc8ff', '#9eff57', '#a855f7', '#c8f535',
  '#ccff00', '#d4a574', '#d92b67', '#e05a3a', '#e11d48',
  '#e5e7eb', '#e8e8e8', '#ea4335', '#ec4899',
  '#f24e1e', '#f47d31', '#f5c400', '#f8fafc', '#fbc04d',
  '#fbcb05', '#fc3c44', '#ff6b35', '#fffff0',
  '#08090b', '#0a0a0a', '#0a66c2', '#0c2340', '#0d0d0d',
  '#0d1500', '#0d2800', '#101624', '#111111', '#111513',
  '#12005e', '#141414', '#14b8a6', '#171717', '#181717', '#181818',
  '#1a237e', '#1a2800', '#1aa6a6', '#1b5e20', '#1b5e3b', '#1c1c1c',
  '#1c1e22', '#1d1d1d', '#1da1f2', '#1e1b4b', '#1fb8cd',
  '#222222', '#242424', '#252525', '#28462c', '#2d8cff', '#2e1065',
  '#361f84', '#3693f3', '#3730a3', '#38bdf8', '#3b82f6',
  '#4285f4', '#4527a0', '#4a154b', '#4c0519', '#4d6bfe',
  '#52b788', '#561890', '#58cc02', '#5c6bc0', '#5e6ad2',
  '#5f1231', '#5f61ed', '#6366f1', '#6a1fa8', '#6b1f0a',
  '#6b7280', '#6c5ce7', '#6c8cf7', '#774fc4', '#7a6200',
  '#7c3aed', '#818cf8', '#831843', '#8b5cf6', '#8cc8ff',
  '#938ba3', '#9b59b6', '#9eff57', '#a855f7', '#abdbe3',
  '#c8f535', '#ccff00', '#d4a574', '#d92b67', '#d97706',
  '#e05a3a', '#e11d48', '#e2b631', '#e5e7eb', '#e8e8e8',
  '#ea4335', '#ec4899', '#ef4444', '#f0b429', '#f24e1e',
  '#f47d31', '#f5c400', '#f59e0b', '#f7f7f8', '#f87171',
  '#f8fafc', '#f97316', '#fa8072', '#fbc04d', '#fbcb05',
  '#fc3c44', '#ff453a', '#ff6b35', '#fff', '#ffffff',
  '#fffff0', '#e50914', '#1db954', '#ff0000', '#181717',
  '#0061ff', '#d83b01', '#0a66c2', '#1da1f2', '#00bcd4',
];
for (const h of [...new Set(allHex)]) {
  try {
    hexConversions[h] = hexToOklch(h);
  } catch(e) {}
}

// Common replacements for all CSS color contexts
const replacements = {
  '#fff': hexConversions['#ffffff'],
  '#ffffff': hexConversions['#ffffff'],
  '#000000': hexConversions['#000000'],
};

// Add all hex conversions
for (const [hex, oklch] of Object.entries(hexConversions)) {
  if (hex === '#fff' || hex === '#ffffff' || hex === '#000000') continue;
  replacements[hex] = oklch;
}

// Common rgba replacements 
const rgbaReplacements = {
  'rgba(0, 0, 0, 0.06)': oklchBlack(0.06),
  'rgba(0, 0, 0, 0.08)': oklchBlack(0.08),
  'rgba(0, 0, 0, 0.1)': oklchBlack(0.1),
  'rgba(0, 0, 0, 0.12)': oklchBlack(0.12),
  'rgba(0, 0, 0, 0.15)': oklchBlack(0.15),
  'rgba(0, 0, 0, 0.16)': oklchBlack(0.16),
  'rgba(0, 0, 0, 0.18)': oklchBlack(0.18),
  'rgba(0, 0, 0, 0.2)': oklchBlack(0.2),
  'rgba(0, 0, 0, 0.25)': oklchBlack(0.25),
  'rgba(0, 0, 0, 0.28)': oklchBlack(0.28),
  'rgba(0, 0, 0, 0.3)': oklchBlack(0.3),
  'rgba(0, 0, 0, 0.32)': oklchBlack(0.32),
  'rgba(0, 0, 0, 0.35)': oklchBlack(0.35),
  'rgba(0, 0, 0, 0.42)': oklchBlack(0.42),
  'rgba(0, 0, 0, 0.45)': oklchBlack(0.45),
  'rgba(0, 0, 0, 0.5)': oklchBlack(0.5),
  'rgba(0, 0, 0, 0.55)': oklchBlack(0.55),
  'rgba(0, 0, 0, 0.6)': oklchBlack(0.6),
  'rgba(0, 0, 0, 0.65)': oklchBlack(0.65),
  'rgba(0, 0, 0, 0.7)': oklchBlack(0.7),
  'rgba(0, 0, 0, 0.75)': oklchBlack(0.75),
  'rgba(0, 0, 0, 0.8)': oklchBlack(0.8),
  'rgba(0, 0, 0, 0.85)': oklchBlack(0.85),
  'rgba(0, 0, 0, 0.9)': oklchBlack(0.9),
  // White with alpha
  'rgba(255, 255, 255, 0.03)': oklchWhite(0.03),
  'rgba(255, 255, 255, 0.04)': oklchWhite(0.04),
  'rgba(255, 255, 255, 0.045)': oklchWhite(0.045),
  'rgba(255, 255, 255, 0.05)': oklchWhite(0.05),
  'rgba(255, 255, 255, 0.06)': oklchWhite(0.06),
  'rgba(255, 255, 255, 0.08)': oklchWhite(0.08),
  'rgba(255, 255, 255, 0.1)': oklchWhite(0.1),
  'rgba(255, 255, 255, 0.12)': oklchWhite(0.12),
  'rgba(255, 255, 255, 0.14)': oklchWhite(0.14),
  'rgba(255, 255, 255, 0.15)': oklchWhite(0.15),
  'rgba(255, 255, 255, 0.2)': oklchWhite(0.2),
  'rgba(255, 255, 255, 0.25)': oklchWhite(0.25),
  'rgba(255, 255, 255, 0.3)': oklchWhite(0.3),
  'rgba(255, 255, 255, 0.35)': oklchWhite(0.35),
  'rgba(255, 255, 255, 0.38)': oklchWhite(0.38),
  'rgba(255, 255, 255, 0.4)': oklchWhite(0.4),
  'rgba(255, 255, 255, 0.45)': oklchWhite(0.45),
  'rgba(255, 255, 255, 0.5)': oklchWhite(0.5),
  'rgba(255, 255, 255, 0.55)': oklchWhite(0.55),
  'rgba(255, 255, 255, 0.6)': oklchWhite(0.6),
  'rgba(255, 255, 255, 0.7)': oklchWhite(0.7),
  'rgba(255, 255, 255, 0.75)': oklchWhite(0.75),
  'rgba(255, 255, 255, 0.8)': oklchWhite(0.8),
  'rgba(255, 255, 255, 0.82)': oklchWhite(0.82),
  'rgba(255, 255, 255, 0.84)': oklchWhite(0.84),
  'rgba(255, 255, 255, 0.85)': oklchWhite(0.85),
  'rgba(255, 255, 255, 0.9)': oklchWhite(0.9),
  // Other rgba
  'rgba(0,0,0,0.06)': oklchBlack(0.06),
  'rgba(0,0,0,0.08)': oklchBlack(0.08),
  'rgba(0,0,0,0.1)': oklchBlack(0.1),
  'rgba(0,0,0,0.12)': oklchBlack(0.12),
  'rgba(0,0,0,0.15)': oklchBlack(0.15),
  'rgba(0,0,0,0.16)': oklchBlack(0.16),
  'rgba(0,0,0,0.18)': oklchBlack(0.18),
  'rgba(0,0,0,0.2)': oklchBlack(0.2),
  'rgba(0,0,0,0.25)': oklchBlack(0.25),
  'rgba(0,0,0,0.28)': oklchBlack(0.28),
  'rgba(0,0,0,0.3)': oklchBlack(0.3),
  'rgba(0,0,0,0.32)': oklchBlack(0.32),
  'rgba(0,0,0,0.35)': oklchBlack(0.35),
  'rgba(0,0,0,0.42)': oklchBlack(0.42),
  'rgba(0,0,0,0.45)': oklchBlack(0.45),
  'rgba(0,0,0,0.5)': oklchBlack(0.5),
  'rgba(0,0,0,0.55)': oklchBlack(0.55),
  'rgba(0,0,0,0.6)': oklchBlack(0.6),
  'rgba(0,0,0,0.65)': oklchBlack(0.65),
  'rgba(0,0,0,0.7)': oklchBlack(0.7),
  'rgba(0,0,0,0.8)': oklchBlack(0.8),
  'rgba(0,0,0,0.85)': oklchBlack(0.85),
  'rgba(0,0,0,0.9)': oklchBlack(0.9),
  'rgba(0,0,0,.08)': oklchBlack(0.08),
  'rgba(0,0,0,.12)': oklchBlack(0.12),
  'rgba(0,0,0,.15)': oklchBlack(0.15),
  'rgba(0,0,0,.18)': oklchBlack(0.18),
  'rgba(0,0,0,.2)': oklchBlack(0.2),
  'rgba(0,0,0,.25)': oklchBlack(0.25),
  'rgba(0,0,0,.3)': oklchBlack(0.3),
  'rgba(0,0,0,.32)': oklchBlack(0.32),
  // White no-space
  'rgba(255,255,255,0.03)': oklchWhite(0.03),
  'rgba(255,255,255,0.04)': oklchWhite(0.04),
  'rgba(255,255,255,0.05)': oklchWhite(0.05),
  'rgba(255,255,255,0.06)': oklchWhite(0.06),
  'rgba(255,255,255,0.08)': oklchWhite(0.08),
  'rgba(255,255,255,0.1)': oklchWhite(0.1),
  'rgba(255,255,255,0.12)': oklchWhite(0.12),
  'rgba(255,255,255,0.14)': oklchWhite(0.14),
  'rgba(255,255,255,0.15)': oklchWhite(0.15),
  'rgba(255,255,255,0.2)': oklchWhite(0.2),
  'rgba(255,255,255,0.25)': oklchWhite(0.25),
  'rgba(255,255,255,0.3)': oklchWhite(0.3),
  'rgba(255,255,255,0.35)': oklchWhite(0.35),
  'rgba(255,255,255,0.38)': oklchWhite(0.38),
  'rgba(255,255,255,0.4)': oklchWhite(0.4),
  'rgba(255,255,255,0.45)': oklchWhite(0.45),
  'rgba(255,255,255,0.5)': oklchWhite(0.5),
  'rgba(255,255,255,0.55)': oklchWhite(0.55),
  'rgba(255,255,255,0.6)': oklchWhite(0.6),
  'rgba(255,255,255,0.7)': oklchWhite(0.7),
  'rgba(255,255,255,0.75)': oklchWhite(0.75),
  'rgba(255,255,255,0.8)': oklchWhite(0.8),
  'rgba(255,255,255,0.82)': oklchWhite(0.82),
  'rgba(255,255,255,0.84)': oklchWhite(0.84),
  'rgba(255,255,255,0.85)': oklchWhite(0.85),
  'rgba(255,255,255,0.9)': oklchWhite(0.9),
  // rgb(0 0 0 format)
  'rgb(0 0 0 / 0.08)': oklchBlack(0.08),
};

// Color-specific rgba (non-black/white)
const colorSpecificRgba = {
  'rgba(239, 68, 68, 0.04)': `oklch(0.637 0.208 25.331 / 0.04)`,
  'rgba(239, 68, 68, 0.06)': `oklch(0.637 0.208 25.331 / 0.06)`,
  'rgba(239, 68, 68, 0.08)': `oklch(0.637 0.208 25.331 / 0.08)`,
  'rgba(239, 68, 68, 0.1)': `oklch(0.637 0.208 25.331 / 0.1)`,
  'rgba(239, 68, 68, 0.12)': `oklch(0.637 0.208 25.331 / 0.12)`,
  'rgba(239, 68, 68, 0.15)': `oklch(0.637 0.208 25.331 / 0.15)`,
  'rgba(239, 68, 68, 0.2)': `oklch(0.637 0.208 25.331 / 0.2)`,
  'rgba(239, 68, 68, 0.25)': `oklch(0.637 0.208 25.331 / 0.25)`,
  'rgba(239, 68, 68, 0.3)': `oklch(0.637 0.208 25.331 / 0.3)`,
  'rgba(239, 68, 68, 0.5)': `oklch(0.637 0.208 25.331 / 0.5)`,
  'rgba(239, 68, 68, 0.6)': `oklch(0.637 0.208 25.331 / 0.6)`,
  'rgba(239, 68, 68, 0.8)': `oklch(0.637 0.208 25.331 / 0.8)`,
  'rgba(59, 130, 246, 0.08)': `oklch(0.623 0.188 259.815 / 0.08)`,
  'rgba(59, 130, 246, 0.1)': `oklch(0.623 0.188 259.815 / 0.1)`,
  'rgba(59, 130, 246, 0.12)': `oklch(0.623 0.188 259.815 / 0.12)`,
  'rgba(59, 130, 246, 0.15)': `oklch(0.623 0.188 259.815 / 0.15)`,
  'rgba(59, 130, 246, 0.2)': `oklch(0.623 0.188 259.815 / 0.2)`,
  'rgba(59, 130, 246, 0.25)': `oklch(0.623 0.188 259.815 / 0.25)`,
  'rgba(59, 130, 246, 0.3)': `oklch(0.623 0.188 259.815 / 0.3)`,
  'rgba(95, 97, 237, 0.06)': `oklch(0.574 0.196 271.147 / 0.06)`,
  'rgba(95, 97, 237, 0.12)': `oklch(0.574 0.196 271.147 / 0.12)`,
  'rgba(95, 97, 237, 0.15)': `oklch(0.574 0.196 271.147 / 0.15)`,
  'rgba(95, 97, 237, 0.2)': `oklch(0.574 0.196 271.147 / 0.2)`,
  'rgba(95, 97, 237, 0.3)': `oklch(0.574 0.196 271.147 / 0.3)`,
  'rgba(95, 97, 237, 0.5)': `oklch(0.574 0.196 271.147 / 0.5)`,
  'rgba(95, 97, 237, 0.7)': `oklch(0.574 0.196 271.147 / 0.7)`,
  'rgba(255, 69, 58, 0.04)': `oklch(0.637 0.208 25.331 / 0.04)`,
  'rgba(255, 69, 58, 0.06)': `oklch(0.637 0.208 25.331 / 0.06)`,
  'rgba(255, 69, 58, 0.1)': `oklch(0.637 0.208 25.331 / 0.1)`,
  'rgba(255, 69, 58, 0.15)': `oklch(0.637 0.208 25.331 / 0.15)`,
  'rgba(255, 69, 58, 0.2)': `oklch(0.637 0.208 25.331 / 0.2)`,
  'rgba(255, 69, 58, 0.6)': `oklch(0.637 0.208 25.331 / 0.6)`,
  'rgba(20, 20, 20, 0.56)': `oklch(0.191 0 89.876 / 0.56)`,
  'rgba(20, 20, 22, 0.85)': `oklch(0.191 0.002 264.364 / 0.85)`,
  'rgba(66, 133, 244, 0.1)': `oklch(0.492 0.14 249.078 / 0.1)`,
  'rgba(66, 133, 244, 0.15)': `oklch(0.492 0.14 249.078 / 0.15)`,
  'rgba(66, 133, 244, 0.25)': `oklch(0.492 0.14 249.078 / 0.25)`,
  'rgba(66, 133, 244, 0.3)': `oklch(0.492 0.14 249.078 / 0.3)`,
  'rgba(8, 9, 11, 0.22)': `oklch(0.149 0.001 247.858 / 0.22)`,
  'rgba(99, 102, 241, 0.3)': `oklch(0.585 0.204 277.117 / 0.3)`,
  // No-space versions
  'rgba(239,68,68,0.04)': `oklch(0.637 0.208 25.331 / 0.04)`,
  'rgba(239,68,68,0.06)': `oklch(0.637 0.208 25.331 / 0.06)`,
  'rgba(239,68,68,0.08)': `oklch(0.637 0.208 25.331 / 0.08)`,
  'rgba(239,68,68,0.1)': `oklch(0.637 0.208 25.331 / 0.1)`,
  'rgba(239,68,68,0.12)': `oklch(0.637 0.208 25.331 / 0.12)`,
  'rgba(239,68,68,0.15)': `oklch(0.637 0.208 25.331 / 0.15)`,
  'rgba(239,68,68,0.2)': `oklch(0.637 0.208 25.331 / 0.2)`,
  'rgba(239,68,68,0.25)': `oklch(0.637 0.208 25.331 / 0.25)`,
  'rgba(239,68,68,0.3)': `oklch(0.637 0.208 25.331 / 0.3)`,
  'rgba(239,68,68,0.5)': `oklch(0.637 0.208 25.331 / 0.5)`,
  'rgba(239,68,68,0.6)': `oklch(0.637 0.208 25.331 / 0.6)`,
  'rgba(239,68,68,0.8)': `oklch(0.637 0.208 25.331 / 0.8)`,
  'rgba(59,130,246,0.08)': `oklch(0.623 0.188 259.815 / 0.08)`,
  'rgba(59,130,246,0.1)': `oklch(0.623 0.188 259.815 / 0.1)`,
  'rgba(59,130,246,0.12)': `oklch(0.623 0.188 259.815 / 0.12)`,
  'rgba(59,130,246,0.15)': `oklch(0.623 0.188 259.815 / 0.15)`,
  'rgba(59,130,246,0.2)': `oklch(0.623 0.188 259.815 / 0.2)`,
  'rgba(59,130,246,0.25)': `oklch(0.623 0.188 259.815 / 0.25)`,
  'rgba(59,130,246,0.3)': `oklch(0.623 0.188 259.815 / 0.3)`,
  'rgba(255,255,255,0.06)': `oklch(1 0 89.876 / 0.06)`,
  'rgba(255,255,255,0.08)': `oklch(1 0 89.876 / 0.08)`,
  'rgba(255,255,255,0.1)': `oklch(1 0 89.876 / 0.1)`,
  'rgba(255,255,255,0.12)': `oklch(1 0 89.876 / 0.12)`,
  'rgba(255,255,255,0.15)': `oklch(1 0 89.876 / 0.15)`,
  'rgba(255,255,255,0.2)': `oklch(1 0 89.876 / 0.2)`,
  'rgba(255,255,255,0.25)': `oklch(1 0 89.876 / 0.25)`,
  'rgba(255,255,255,0.3)': `oklch(1 0 89.876 / 0.3)`,
  'rgba(255,255,255,0.35)': `oklch(1 0 89.876 / 0.35)`,
  'rgba(255,255,255,0.4)': `oklch(1 0 89.876 / 0.4)`,
  'rgba(255,255,255,0.45)': `oklch(1 0 89.876 / 0.45)`,
  'rgba(255,255,255,0.5)': `oklch(1 0 89.876 / 0.5)`,
  'rgba(255,255,255,0.55)': `oklch(1 0 89.876 / 0.55)`,
  'rgba(255,255,255,0.6)': `oklch(1 0 89.876 / 0.6)`,
  'rgba(255,255,255,0.7)': `oklch(1 0 89.876 / 0.7)`,
  'rgba(255,255,255,0.75)': `oklch(1 0 89.876 / 0.75)`,
  'rgba(255,255,255,0.8)': `oklch(1 0 89.876 / 0.8)`,
  'rgba(255,255,255,0.82)': `oklch(1 0 89.876 / 0.82)`,
  'rgba(255,255,255,0.84)': `oklch(1 0 89.876 / 0.84)`,
  'rgba(255,255,255,0.85)': `oklch(1 0 89.876 / 0.85)`,
  'rgba(255,255,255,0.9)': `oklch(1 0 89.876 / 0.9)`,
};

Object.assign(replacements, colorSpecificRgba);

const allReplacements = { ...replacements, ...rgbaReplacements };
const sorted = Object.entries(allReplacements).sort((a, b) => b[0].length - a[0].length);

// Files to process
const srcDir = 'C:\\Users\\admin\\Downloads\\Genesis\\apps\\genesis-desktop\\src';
const filesToProcess = [
  // Agent
  'lib/components/agent/AgentDock.svelte',
  'lib/components/agent/AgentPanel.svelte',
  'lib/components/agent/ChatGptAuthTab.svelte',
  'lib/components/agent/DockButton.svelte',
  'lib/components/agent/code/code.svelte',
  // Island
  'lib/components/island/Island.svelte',
  'lib/components/island/ModuleActive.svelte',
  'lib/components/island/widgets/WidgetWrapper.svelte',
  'lib/components/island/widgets/TimerWidget.svelte',
  'lib/components/island/widgets/SessionWidget.svelte',
  'lib/components/island/widgets/TaskWidget.svelte',
  'lib/components/island/widgets/NotesWidget.svelte',
  'lib/components/island/widgets/MediaPlayerWidget.svelte',
  // Components
  'lib/components/EditableBlock.svelte',
  'lib/components/FindInPage.svelte',
  'lib/components/GlobalSettings.svelte',
  'lib/components/TagManagementPane.svelte',
  'lib/components/ActivityTimeline.svelte',
  'lib/components/AllDocsView.svelte',
  'lib/components/CalendarPalette.svelte',
  'lib/components/SettingsPanel.svelte',
  'lib/components/CommandPalette.svelte',
  'lib/components/UpdateNotification.svelte',
  'modules/notes/App.svelte',
  'modules/notes/Editor.svelte',
  'modules/notes/components/blocks/BlockActionMenu.svelte',
  'modules/notes/components/blocks/BlockText.svelte',
  'modules/notes/components/blocks/BlockBookmark.svelte',
  'modules/notes/components/blocks/BlockEmbed.svelte',
  'modules/notes/components/blocks/BlockTable.svelte',
  'modules/notes/components/blocks/BlockTodoList.svelte',
  'lib/components/BacklinksPanel.svelte',
  'lib/components/ShareSheet.svelte',
  'lib/components/charts/PremiumRing.svelte',
  'lib/components/tasks/TasksActivityPanel.svelte',
  'lib/components/tasks/TasksTagsPanel.svelte',
  'lib/components/tasks/TasksSearchPanel.svelte',
  // Settings
  'lib/components/settings/ChatGptAuth.svelte',
  'lib/components/settings/ByokSettings.svelte',
  // Routes
  'routes/+layout.svelte',
  'routes/agent/+page.svelte',
  'routes/pages/AuthPage.svelte',
  'routes/pages/LoginPage.svelte',
  'routes/pages/DashboardPage.svelte',
  'routes/pages/PricingPage.svelte',
  'routes/pages/PaymentCallbackPage.svelte',
  'routes/pages/AccountPage.svelte',
  // Modules
  'modules/water/App.svelte',
  'modules/nutrition/App.svelte',
  'modules/journal/App.svelte',
  'modules/journal/JournalEditor.svelte',
  'modules/focus/App.svelte',
  'modules/sleep/App.svelte',
  'modules/clipboard/App.svelte',
  'modules/habits/App.svelte',
  'modules/countdown/App.svelte',
  'modules/mood/App.svelte',
  'modules/budget/App.svelte',
  'modules/budget/ForecastingChart.svelte',
  'modules/goals/App.svelte',
  'modules/tasks/App.svelte',
  'modules/health/App.svelte',
];

let totalChanges = 0;
let changedFiles = 0;

for (const relPath of filesToProcess) {
  const fullPath = path.join(srcDir, relPath);
  if (!fs.existsSync(fullPath)) {
    console.log(`  SKIP (not found): ${relPath}`);
    continue;
  }
  
  let content = fs.readFileSync(fullPath, 'utf-8');
  let modified = content;
  
  for (const [oldStr, newStr] of sorted) {
    modified = modified.replaceAll(oldStr, newStr);
  }
  
  if (modified !== content) {
    fs.writeFileSync(fullPath, modified, 'utf-8');
    const changes = [...content.matchAll(new RegExp(Object.keys(allReplacements).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g'))].length;
    totalChanges += changes;
    changedFiles++;
    console.log(`  ✓ ${relPath} (${changes} changes)`);
  }
}

console.log(`\nDone! ${changedFiles} files updated with ~${totalChanges} total changes.`);
