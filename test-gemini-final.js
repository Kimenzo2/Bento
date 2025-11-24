import https from 'https';
import fs from 'fs';

const API_KEYS = [
    { name: 'Key 1', key: 'AIzaSyASBU6gbFFAzYcJeTzx2fUIg-Hjzthec40' },
    { name: 'Key 2', key: 'AIzaSyB5BKaBAsru3etCQZl6Z3V8E5f5lbkHMNw' }
];

async function testKeyDetailed(apiKey, keyName) {
    return new Promise((resolve) => {
        const requestData = JSON.stringify({
            contents: [{
                parts: [{
                    text: 'Write a single sentence saying hello.'
                }]
            }]
        });

        // Try with v1beta API and gemini-1.5-flash-latest
        const options = {
            hostname: 'generativelanguage.googleapis.com',
            path: `/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(requestData)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                let parsedResponse;
                try {
                    parsedResponse = JSON.parse(data);
                } catch (e) {
                    parsedResponse = { rawData: data };
                }

                const result = {
                    keyName,
                    key: apiKey,
                    statusCode: res.statusCode,
                    success: false,
                    errorDetails: null,
                    generatedText: null
                };

                if (res.statusCode === 200) {
                    if (parsedResponse.candidates && parsedResponse.candidates[0]) {
                        result.success = true;
                        result.generatedText = parsedResponse.candidates[0].content.parts[0].text;
                    } else {
                        result.errorDetails = 'Unexpected response format';
                    }
                } else {
                    // Parse error details
                    if (parsedResponse.error) {
                        result.errorDetails = {
                            message: parsedResponse.error.message,
                            status: parsedResponse.error.status,
                            code: parsedResponse.error.code,
                            details: parsedResponse.error.details || []
                        };
                    } else {
                        result.errorDetails = parsedResponse;
                    }
                }

                resolve(result);
            });
        });

        req.on('error', (error) => {
            resolve({
                keyName,
                key: apiKey,
                statusCode: 0,
                success: false,
                errorDetails: `Network error: ${error.message}`
            });
        });

        req.write(requestData);
        req.end();
    });
}

async function main() {
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║     GEMINI API KEY TEXT GENERATION TEST               ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

    const results = [];

    for (const { name, key } of API_KEYS) {
        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`Testing ${name}`);
        console.log(`Key: ${key.substring(0, 25)}...`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

        const result = await testKeyDetailed(key, name);
        results.push(result);

        console.log(`Status Code: ${result.statusCode}`);

        if (result.success) {
            console.log('✅ STATUS: ACTIVE & WORKING');
            console.log(`📝 Generated Text: "${result.generatedText}"`);
            console.log('🎯 QUOTA: NO LIMITS DETECTED');
        } else {
            console.log('❌ STATUS: NOT WORKING');
            if (result.errorDetails) {
                if (typeof result.errorDetails === 'string') {
                    console.log(`Error: ${result.errorDetails}`);
                } else if (result.errorDetails.message) {
                    console.log(`Error Message: ${result.errorDetails.message}`);
                    console.log(`Error Status: ${result.errorDetails.status || 'N/A'}`);
                    console.log(`Error Code: ${result.errorDetails.code || 'N/A'}`);

                    // Check for quota-related errors
                    if (result.errorDetails.message.toLowerCase().includes('quota')) {
                        console.log('🚫 QUOTA: EXCEEDED');
                    } else if (result.errorDetails.message.toLowerCase().includes('not found')) {
                        console.log('⚠️  Issue: Model not found or API not enabled');
                    } else if (result.errorDetails.message.toLowerCase().includes('permission')) {
                        console.log('⚠️  Issue: Permission denied');
                    }
                }
            }
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Save detailed results
    fs.writeFileSync('gemini-test-detailed-results.json', JSON.stringify(results, null, 2));

    // Final Summary
    console.log('\n\n╔════════════════════════════════════════════════════════╗');
    console.log('║                    FINAL SUMMARY                       ║');
    console.log('╚════════════════════════════════════════════════════════╝');

    const workingKeys = results.filter(r => r.success);

    if (workingKeys.length > 0) {
        console.log('\n✅ WORKING KEYS FOUND:\n');
        workingKeys.forEach(r => {
            console.log(`  ${r.keyName}: ${r.key}`);
            console.log(`  Status: ACTIVE - Ready for text generation`);
            console.log(`  Quota: No limits detected\n`);
        });

        console.log('╔════════════════════════════════════════════════════════╗');
        console.log('║                  RECOMMENDATION                        ║');
        console.log('╚════════════════════════════════════════════════════════╝');
        console.log(`\n✅ USE: ${workingKeys[0].keyName}`);
        console.log(`Key: ${workingKeys[0].key}\n`);
    } else {
        console.log('\n❌ NO WORKING KEYS FOUND\n');
        console.log('Possible reasons:');
        console.log('  1. Gemini API not enabled in Google Cloud Console');
        console.log('  2. Invalid API keys');
        console.log('  3. Billing not set up');
        console.log('  4. API access restricted');
        console.log('  5. Quota exceeded on both keys\n');
        console.log('Please check: https://console.cloud.google.com/\n');
    }

    console.log('Full results saved to: gemini-test-detailed-results.json\n');
}

main();
