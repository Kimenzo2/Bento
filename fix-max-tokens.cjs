const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join(__dirname, 'services', 'geminiService.ts');
console.log(`Reading file: ${filePath}`);

let content = fs.readFileSync(filePath, 'utf8');

// Find and replace the specific line
const oldLine = '      response_format: { type: "json_object" } // Request JSON mode';
const newLines = `      response_format: { type: "json_object" }, // Request JSON mode
      max_tokens: maxTokens // Pass the token limit to prevent truncation`;

if (content.includes(oldLine)) {
    content = content.replace(oldLine, newLines);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ Successfully added max_tokens parameter to geminiService.ts');
    console.log('\nThe fix has been applied! Now Grok will receive the max_tokens parameter.');
    console.log('This should prevent JSON truncation errors.\n');
} else {
    console.log('❌ Could not find the line to replace. The file may have already been modified.');
    console.log('\nSearching for similar patterns...');
    if (content.includes('response_format')) {
        console.log('✓ Found response_format in the file');
    }
    if (content.includes('max_tokens')) {
        console.log('✓ max_tokens already exists in the file');
    }
}
