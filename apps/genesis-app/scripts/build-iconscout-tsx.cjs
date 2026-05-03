const fs = require('fs');
const path = require('path');

const icons = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'downloaded-icons-full.json'), 'utf8')
);

let output = `import type React from 'react';

// Real IconScout SVG icons — free tier, downloaded via API
// Each component accepts standard SVG props (className, width, height, etc.)
// Usage: <IcoWand className="w-5 h-5 text-gold-sunshine" />

type SvgProps = React.SVGProps<SVGSVGElement>;

`;

for (const icon of icons) {
  // Clean the SVG
  let svg = icon.svg
    .replace(/<\?xml[^>]*\?>/g, '')
    .replace(/<!DOCTYPE[^>]*>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/[\n\r]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Force fill=currentColor on root svg so Tailwind text-* classes control color
  if (!svg.includes('fill=')) {
    svg = svg.replace('<svg ', '<svg fill="currentColor" ');
  } else {
    svg = svg.replace(/fill="[^"]*"/, 'fill="currentColor"');
  }

  // Remove hardcoded width/height so Tailwind w-*/h-* sizing works
  svg = svg.replace(/ width="[^"]*"/g, '').replace(/ height="[^"]*"/g, '');

  // Inject {...props} spread into root <svg ...>
  svg = svg.replace(/(<svg[^>]*)(>)/, '$1 {...props}$2');

  const exportName = icon.export;
  const label = icon.iname || exportName;

  output += `// ${label}
export const ${exportName} = (props: SvgProps) => (
  ${svg}
);

`;
}

const outPath = path.join(__dirname, '..', 'components', 'IconscoutIcons.tsx');
fs.writeFileSync(outPath, output, 'utf8');
console.log(`Written IconscoutIcons.tsx with ${icons.length} icons:`);
icons.forEach((i) => console.log(`  ${i.export}  —  ${i.iname}`));
