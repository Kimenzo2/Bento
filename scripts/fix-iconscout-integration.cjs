/**
 * fix-iconscout-integration.cjs
 *
 * Targeted repairs for the integration script's regex gap (missed `<Icon\n` patterns)
 * and other edge cases:
 *   1. Replace remaining `<LucideIcon\n` / `<LucideIcon\t` / value references
 *   2. Fix MobileBottomNav size/strokeWidth → width/height
 *   3. Restore ImageIcon to lucide-react imports where it was accidentally dropped
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const ICON_MAP = {
  Wand2:    'IcoWand',
  BookOpen: 'IcoBook',
  Star:     'IcoStar',
  Palette:  'IcoPalette',
  Bell:     'IcoBell',
  Crown:    'IcoCrown',
  Award:    'IcoAward',
  Zap:      'IcoZap',
  PenTool:  'IcoPen',
  Send:     'IcoSend',
  Library:  'IcoLibrary',
};

// ── 1. Fix missed multi-line JSX tag replacements ────────────────────────────
// Re-run with a broader pattern that includes whitespace (not just space)
const filesToRescan = [
  'components/BookSuccessView.tsx',
  'components/collaboration/InsightsDashboard.tsx',
  'components/GenerationTheater.tsx',
  'components/StorybookViewer.tsx',
  'components/tiers/interactive/FeatureExplorer.tsx',
  'components/settings/LibraryPanel.tsx',
];

for (const rel of filesToRescan) {
  const filePath = path.join(ROOT, rel);
  let src = fs.readFileSync(filePath, 'utf8');
  const original = src;

  // For each icon that might still be referenced (as JSX or as value)
  for (const [lucide, ico] of Object.entries(ICON_MAP)) {
    // ── A. Multi-line JSX opening tags: <Award\n, <Award\t ──────────────────
    src = src.replace(new RegExp(`<${lucide}([\\s/>])`, 'g'), `<${ico}$1`);
    src = src.replace(new RegExp(`</${lucide}>`, 'g'), `</${ico}>`);

    // ── B. Icon used as VALUE in object/array: icon: Award, icon={Award} ────
    // Only if IcoXxx is already imported (meaning we already removed the lucide import)
    if (src.includes(ico) && src.includes(`${lucide}`) ) {
      // Check the icon still appears (wasn't fully replaced by JSX pass)
      const valuePatterns = [
        [new RegExp(`\\bicon:\\s*${lucide}\\b`, 'g'), `icon: ${ico}`],
        [new RegExp(`\\bicon=\\{${lucide}\\}`, 'g'), `icon={${ico}}`],
        [new RegExp(`\\bIcon:\\s*${lucide}\\b`, 'g'), `Icon: ${ico}`],
        [new RegExp(`\\bcomponent:\\s*${lucide}\\b`, 'g'), `component: ${ico}`],
        [new RegExp(`\\bchildren=\\{${lucide}\\}`, 'g'), `children={${ico}}`],
      ];
      for (const [pat, rep] of valuePatterns) {
        src = src.replace(pat, rep);
      }
    }
  }

  if (src !== original) {
    fs.writeFileSync(filePath, src, 'utf8');
    console.log(`✓ Repaired: ${rel}`);
  } else {
    console.log(`  (no change): ${rel}`);
  }
}

// ── 2. Fix MobileBottomNav: size/strokeWidth → width/height ─────────────────
{
  const fp = path.join(ROOT, 'components/MobileBottomNav.tsx');
  let src = fs.readFileSync(fp, 'utf8');
  const orig = src;

  // Replace <IcoWand size={N} strokeWidth={N} /> with <IcoWand width={N} height={N} />
  src = src.replace(
    /<IcoWand\s+size=\{(\d+)\}\s+strokeWidth=\{[\d.]+\}/g,
    '<IcoWand width={$1} height={$1}'
  );
  // Also handle any remaining size prop on other Ico* components
  src = src.replace(/<(Ico\w+)\s+size=\{(\d+)\}/g, '<$1 width={$2} height={$2}');

  if (src !== orig) {
    fs.writeFileSync(fp, src, 'utf8');
    console.log('✓ MobileBottomNav: size→width/height');
  }
}

// ── 3. Restore ImageIcon to lucide-react imports ─────────────────────────────
const imageIconFiles = [
  'components/Navigation.tsx',
  'components/settings/LibraryPanel.tsx',
  'components/SettingsPanel.tsx',
  'components/SmartEditor.tsx',
];

for (const rel of imageIconFiles) {
  const fp = path.join(ROOT, rel);
  let src = fs.readFileSync(fp, 'utf8');
  const orig = src;

  // Only process if ImageIcon is referenced but not imported
  if (!src.includes('ImageIcon')) continue;

  const lucideImportMatch = src.match(/import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"]/);
  if (!lucideImportMatch) {
    // No lucide import at all — add one
    src = src.replace(/^(import .+;\n)/, `$1import { ImageIcon } from 'lucide-react';\n`);
  } else {
    const existingNames = lucideImportMatch[1]
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    if (!existingNames.includes('ImageIcon')) {
      const allNames = [...existingNames, 'ImageIcon'].sort();
      src = src.replace(
        /import\s*\{[^}]+\}\s*from\s*['"]lucide-react['"]/,
        `import { ${allNames.join(', ')} } from 'lucide-react'`
      );
    }
  }

  if (src !== orig) {
    fs.writeFileSync(fp, src, 'utf8');
    console.log(`✓ Restored ImageIcon in: ${rel}`);
  }
}

console.log('\nDone.\n');
