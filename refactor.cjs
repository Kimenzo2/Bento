const fs = require('fs');
const file = 'c:/Users/admin/Downloads/Genesis/components/CreationCanvas.tsx';
let code = fs.readFileSync(file, 'utf8');

const qscIndex = code.indexOf('// Quick Start Card Component with Vercel-style cursor glow effect');
const qscEndStr = '  const handleQuickStartClick';
const qscEndIndex = code.indexOf(qscEndStr, qscIndex);

if (qscIndex !== -1 && qscEndIndex !== -1) {
    const qscBlock = code.substring(qscIndex, qscEndIndex);
    
    // Remove the block from the original location
    code = code.substring(0, qscIndex) + code.substring(qscEndIndex);
    
    // Insert it right before the CreationCanvas component declaration
    const canvasKeyword = 'const CreationCanvas: React.FC<CreationCanvasProps> =';
    code = code.replace(canvasKeyword, qscBlock + '\n\n' + canvasKeyword);
    
    fs.writeFileSync(file, code, 'utf8');
    console.log('Successfully refactored QuickStartCard out of CreationCanvas.');
} else {
    console.log('Could not find QuickStartCard block bounds.');
}
