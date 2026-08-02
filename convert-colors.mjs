// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

// Hex → OKLCH converter (1:1 exact conversion)
// Based on the CSS Color Level 4 specification

function hexToRgb(hex) {
  hex = hex.replace('#', '');
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

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

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

function formatOklch(L, C, H) {
  // Format: L to 3 decimal places, C to 3 decimal places, H to 3 decimal places
  // Drop trailing zeros
  const lStr = L.toFixed(3);
  const cStr = C.toFixed(3);
  const hStr = H.toFixed(3);
  
  const fmt = (s) => {
    // Remove trailing zeros but keep at least 1 decimal
    let result = s.replace(/0+$/, '');
    if (result.endsWith('.')) result = result.slice(0, -1);
    // Format -0 as 0
    if (result === '-0' || result === '-0.0' || result === '-0.00') result = '0';
    return result;
  };

  return `oklch(${fmt(lStr)} ${fmt(cStr)} ${fmt(hStr)})`;
}

function hexToOklch(hex) {
  const [r, g, b] = hexToRgb(hex);
  const [lr, lg, lb] = [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)];
  const [L, a, b_] = linearToOklab(lr, lg, lb);
  const [Lc, C, H] = oklabToOklch(L, a, b_);
  return formatOklch(Lc, C, H);
}

// Read themes.ts
import fs from 'fs';
const content = fs.readFileSync('C:\\Users\\admin\\Downloads\\Genesis\\apps\\genesis-desktop\\src\\lib\\data\\themes.ts', 'utf-8');

// Find all hex colors
const hexRegex = /#([0-9a-fA-F]{6})\b/g;
const matches = content.matchAll(hexRegex);

const replacements = {};
for (const match of matches) {
  const hex = match[0];
  const oklch = hexToOklch(hex);
  replacements[hex] = oklch;
}

// Print all conversions as a table
console.log('| Before | After |');
console.log('| ------ | ----- |');
for (const [hex, oklch] of Object.entries(replacements).sort()) {
  console.log(`| \`${hex}\` | \`${oklch}\` |`);
}

// Count unique colors
console.log(`\nTotal unique hex colors: ${Object.keys(replacements).length}`);
