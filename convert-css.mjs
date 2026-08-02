// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

// Batch convert all hardcoded colors in app.css and enterprise.css to OKLCH
import fs from 'fs';

function hexToRgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  return [r, g, b];
}

function srgbToLinear(c) {
  if (c <= 0.04045) return c / 12.92;
  return Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearToOklab(r, g, b) {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const b_ = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;
  return [L, a, b_];
}

function oklabToOklch(L, a, b) {
  const C = Math.sqrt(a * a + b * b);
  let H = Math.atan2(b, a) * (180 / Math.PI);
  if (H < 0) H += 360;
  return [L, C, H];
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
  const [Lc, C, H] = oklabToOklch(L, a, b_);
  return `oklch(${fmt(Lc.toFixed(3))} ${fmt(C.toFixed(3))} ${fmt(H.toFixed(3))})`;
}

function oklchColor(L, C, H) {
  return `oklch(${fmt(L.toFixed(3))} ${fmt(C.toFixed(3))} ${fmt(H.toFixed(3))})`;
}

// Build replacement map
const hexMap = {
  '#111': '#111111',
  '#fff': '#ffffff',
};

// Convert all unique hex values
const hexValues = [
  '#111111', '#111513', '#141414', '#181818', '#22c55e', '#3b82f6', '#5b6df5',
  '#6366f1', '#66d3d8', '#6b7280', '#a855f7', '#e11d48', '#e53e3e', '#eef0ff',
  '#ef4444', '#f59e0b', '#f8fafc', '#ffffff'
];

const oklchRepl = {};
for (const h of hexValues) {
  oklchRepl[h] = hexToOklch(h);
  console.log(`${h} → ${oklchRepl[h]}`);
}

// Black/white with alpha
function oklchBlack(alpha) { return `oklch(0 0 0 / ${alpha})`; }
function oklchWhite(alpha) { return `oklch(1 0 89.876 / ${alpha})`; }

// Build full replacements
const replacements = {
  // Hex
  '#111513': oklchRepl['#111513'],
  '#141414': oklchRepl['#141414'],
  '#181818': oklchRepl['#181818'],
  '#22c55e': oklchRepl['#22c55e'],
  '#3b82f6': oklchRepl['#3b82f6'],
  '#5b6df5': oklchRepl['#5b6df5'],
  '#6366f1': oklchRepl['#6366f1'],
  '#66d3d8': oklchRepl['#66d3d8'],
  '#6b7280': oklchRepl['#6b7280'],
  '#a855f7': oklchRepl['#a855f7'],
  '#e11d48': oklchRepl['#e11d48'],
  '#e53e3e': oklchRepl['#e53e3e'],
  '#eef0ff': oklchRepl['#eef0ff'],
  '#ef4444': oklchRepl['#ef4444'],
  '#f59e0b': oklchRepl['#f59e0b'],
  '#f8fafc': oklchRepl['#f8fafc'],
  '#ffffff': oklchRepl['#ffffff'],
  // Shorthand
  '#111': oklchRepl['#111111'],
  '#fff': oklchRepl['#ffffff'],
  // RGBA
  'rgba(0, 0, 0, 0.18)': oklchBlack(0.18),
  'rgba(0, 0, 0, 0.42)': oklchBlack(0.42),
  'rgba(0, 0, 0, 0.28)': oklchBlack(0.28),
  'rgba(0, 0, 0, 0.65)': oklchBlack(0.65),
  'rgba(0, 0, 0, 0.85)': oklchBlack(0.85),
  'rgba(255, 255, 255, 0.08)': oklchWhite(0.08),
  'rgba(255, 255, 255, 0.12)': oklchWhite(0.12),
  'rgba(255, 255, 255, 0.045)': oklchWhite(0.045),
  'rgba(255, 255, 255, 0.5)': oklchWhite(0.5),
  'rgba(255, 255, 255, 0.75)': oklchWhite(0.75),
  'rgba(255, 255, 255, 0.82)': oklchWhite(0.82),
  'rgba(255, 255, 255, 0.28)': oklchWhite(0.28),
  'rgba(255, 255, 255, 0.38)': oklchWhite(0.38),
  'rgba(255, 255, 255, 0.05)': oklchWhite(0.05),
  'rgba(255, 255, 255, 0.16)': oklchWhite(0.16),
  'rgba(99, 102, 241, 0.3)': `oklch(${fmt((0.556).toFixed(3))} ${fmt((0.132).toFixed(3))} ${fmt((273.795).toFixed(3))} / 0.3)`,
  'rgba(20, 20, 20, 0.56)': `oklch(${fmt((0.156).toFixed(3))} 0 89.876 / 0.56)`,
};

// Process a file
function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;
  
  const sorted = Object.entries(replacements).sort((a, b) => b[0].length - a[0].length);
  for (const [oldStr, newStr] of sorted) {
    content = content.replaceAll(oldStr, newStr);
  }
  
  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`\n✓ ${filePath} updated`);
  } else {
    console.log(`\n- ${filePath} no changes`);
  }
}

processFile('C:\\Users\\admin\\Downloads\\Genesis\\apps\\genesis-desktop\\src\\app.css');
processFile('C:\\Users\\admin\\Downloads\\Genesis\\apps\\genesis-desktop\\src\\lib\\styles\\enterprise.css');
processFile('C:\\Users\\admin\\Downloads\\Genesis\\apps\\genesis-desktop\\src\\lib\\card-system.css');
