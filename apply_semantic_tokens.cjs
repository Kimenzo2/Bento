const fs = require('fs');
const path = require('path');

const files = [
  'components/Navigation.tsx',
  'components/CreationCanvas.tsx',
  'components/SmartEditor.tsx',
  'components/BlueprintReview.tsx',
  'components/StorybookViewer.tsx',
  'components/BookSuccessView.tsx',
  'components/BookViewer.tsx',
  'components/GamificationHub.tsx',
  'components/PricingPage.tsx',
  'components/SettingsPanel.tsx',
  'components/AuthModal.tsx',
  'components/AuthPage.tsx',
  'components/UpgradeModal.tsx',
  'components/VisualStudio.tsx',
  'components/GenerationTheater.tsx',
  'components/SavedBookCard.tsx',
  'components/Toast.tsx',
  'components/SparkleCursor.tsx'
];

function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Remove dark: variants for colors
    content = content.replace(/dark:(bg|text|border|ring|fill|stroke)-[a-z0-9-]+/g, '');
    
    // Replace hardcoded background colors
    content = content.replace(/\bbg-white\b/g, 'bg-surface-base');
    content = content.replace(/\bbg-gray-50\b/g, 'bg-surface-subtle');
    content = content.replace(/\bbg-gray-100\b/g, 'bg-surface-subtle');
    content = content.replace(/\bbg-gray-200\b/g, 'bg-surface-elevated');
    content = content.replace(/\bbg-gray-800\b/g, 'bg-surface-elevated');
    content = content.replace(/\bbg-gray-900\b/g, 'bg-surface-base');
    
    // Replace text colors
    content = content.replace(/\btext-gray-900\b/g, 'text-primary');
    content = content.replace(/\btext-gray-800\b/g, 'text-primary');
    content = content.replace(/\btext-gray-700\b/g, 'text-secondary');
    content = content.replace(/\btext-gray-600\b/g, 'text-secondary');
    content = content.replace(/\btext-gray-500\b/g, 'text-muted');
    content = content.replace(/\btext-gray-400\b/g, 'text-muted');
    content = content.replace(/\btext-white\b/g, 'text-inverse');
    
    // Replace border colors
    content = content.replace(/\bborder-gray-100\b/g, 'border-subtle');
    content = content.replace(/\bborder-gray-200\b/g, 'border-default');
    content = content.replace(/\bborder-gray-300\b/g, 'border-default');
    content = content.replace(/\bborder-gray-700\b/g, 'border-default');
    content = content.replace(/\bborder-gray-800\b/g, 'border-default');
    
    // Clean up multiple spaces that might have been introduced
    content = content.replace(/\s+/g, ' ');
    content = content.replace(/"\s+/g, '"');
    content = content.replace(/\s+"/g, '"');

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Processed ${filePath}`);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error(`Error processing ${filePath}:`, err);
    } else {
      console.log(`File not found: ${filePath}`);
    }
  }
}

files.forEach(processFile);
console.log('Done replacing tokens.');
