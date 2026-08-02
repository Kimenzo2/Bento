// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

// Convert remaining module CSS files
import fs from 'fs';

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

const newColors = {
  '#000': '#000000',
  '#333': '#333333',
  '#fff': '#ffffff',
};
const hexes = [
  '#000000', '#ffffff', '#333333', '#111318', '#1565c0', '#181717', '#211922',
  '#22c55e', '#313832', '#3b82f6', '#4caf50', '#5f61ed', '#62625b', '#6c5ce7',
  '#787873', '#06b6d4', '#0a66c2', '#8b5cf6', '#9ca3af', '#a855f7', '#c8f535',
  '#dc2626', '#f59e0b', '#f9fafb', '#ff0000', '#ff0076', '#ff4500', '#fff',
  '#111', '#ef4444',
];

const replacements = {};
for (const h of hexes) {
  const key = h.length <= 4 ? newColors[h] || h : h;
  replacements[h] = hexToOklch(key);
  console.log(`${h} → ${replacements[h]}`);
}

// Add rgba
function oklchBlack(a) { return `oklch(0 0 0 / ${a})`; }
function oklchWhite(a) { return `oklch(1 0 89.876 / ${a})`; }

const moreReplacements = {
  'rgba(0, 0, 0, 0.32)': oklchBlack(0.32),
  'rgba(0,0,0,0.08)': oklchBlack(0.08),
  'rgba(0,0,0,0.2)': oklchBlack(0.2),
  'rgba(0, 0, 0, 0.6)': oklchBlack(0.6),
  'rgba(0, 0, 0, 0.65)': oklchBlack(0.65),
  'rgba(0, 0, 0, 0.8)': oklchBlack(0.8),
  'rgba(0, 0, 0, 0.85)': oklchBlack(0.85),
  'rgba(255, 255, 255, 0.05)': oklchWhite(0.05),
  'rgba(255, 255, 255, 0.1)': oklchWhite(0.1),
  'rgba(255, 255, 255, 0.12)': oklchWhite(0.12),
  'rgba(255, 255, 255, 0.2)': oklchWhite(0.2),
  'rgba(255, 255, 255, 0.5)': oklchWhite(0.5),
  'rgba(34, 197, 94, 0.2)': 'oklch(0.723 0.192 149.579 / 0.2)',
  'rgba(245, 158, 11, 0.2)': 'oklch(0.769 0.165 70.08 / 0.2)',
  'rgba(168, 85, 247, 0.2)': 'oklch(0.627 0.233 303.9 / 0.2)',
  'rgba(6, 182, 212, 0.2)': 'oklch(0.727 0.119 213.679 / 0.2)',
  'rgba(220, 38, 38, 0.8)': 'oklch(0.586 0.222 17.585 / 0.8)',
  'rgba(34, 197, 94, 0.8)': 'oklch(0.723 0.192 149.579 / 0.8)',
};

Object.assign(replacements, moreReplacements);

const sorted = Object.entries(replacements).sort((a, b) => b[0].length - a[0].length);

const files = [
  'C:\\Users\\admin\\Downloads\\Genesis\\apps\\genesis-desktop\\src\\modules\\tasks\\tasks.css',
  'C:\\Users\\admin\\Downloads\\Genesis\\apps\\genesis-desktop\\src\\modules\\goals\\goals.css',
  'C:\\Users\\admin\\Downloads\\Genesis\\apps\\genesis-desktop\\src\\modules\\nutrition\\nutrition.css',
  'C:\\Users\\admin\\Downloads\\Genesis\\apps\\genesis-desktop\\src\\modules\\clipboard\\clipboard.css',
  'C:\\Users\\admin\\Downloads\\Genesis\\apps\\genesis-desktop\\src\\modules\\health\\health.css',
];

for (const fPath of files) {
  let content = fs.readFileSync(fPath, 'utf-8');
  let modified = content;
  for (const [oldStr, newStr] of sorted) {
    modified = modified.replaceAll(oldStr, newStr);
  }
  if (modified !== content) {
    fs.writeFileSync(fPath, modified, 'utf-8');
    const changes = [...content.matchAll(new RegExp(Object.keys(replacements).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g'))].length;
    console.log(`\n✓ ${fPath.split('\\').slice(-2).join('/')} (${changes} changes)`);
  } else {
    console.log(`\n- ${fPath.split('\\').slice(-2).join('/')} (no changes)`);
  }
}
