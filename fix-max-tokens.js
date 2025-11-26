const fs = require('fs');

// Read the file
const filePath = './services/geminiService.ts';
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
}
