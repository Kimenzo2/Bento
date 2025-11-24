import https from 'https';
import fs from 'fs';

const API_KEYS = [
    { name: 'Key 1', key: 'AIzaSyASBU6gbFFAzYcJeTzx2fUIg-Hjzthec40' },
    { name: 'Key 2', key: 'AIzaSyB5BKaBAsru3etCQZl6Z3V8E5f5lbkHMNw' }
];

// Try multiple model versions
const MODELS = [
    'gemini-1.5-flash-latest',
    'gemini-1.5-pro-latest',
    'gemini-pro'
];

async function testKey(apiKey, keyName, model) {
    return new Promise((resolve) => {
        const requestData = JSON.stringify({
            contents: [{ parts: [{ text: 'Say hello in one sentence.' }] }]
        });

        const options = {
            hostname: 'generativelanguage.googleapis.com',
            path: `/v1/models/${model}:generateContent?key=${apiKey}`,
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
                try {
                    const response = JSON.parse(data);
                    if (res.statusCode === 200 && response.candidates) {
                        resolve({
                            keyName,
                            key: apiKey,
                            model,
                            status: 'ACTIVE',
                            text: response.candidates[0].content.parts[0].text
                        });
                    } else {
                        resolve({
                            keyName,
                            key: apiKey,
                            model,
                            status: 'FAILED',
                            statusCode: res.statusCode,
                            error: response.error?.message || 'Unknown error'
                        });
                    }
                } catch (e) {
                    resolve({ keyName, key: apiKey, model, status: 'ERROR', error: e.message });
                }
            });
        });

        req.on('error', (error) => {
            resolve({ keyName, key: apiKey, model, status: 'ERROR', error: error.message });
        });

        req.write(requestData);
        req.end();
    });
}

async function runTests() {
    const allResults = [];

    console.log('Testing Gemini API Keys...\n');

    for (const { name, key } of API_KEYS) {
        console.log(`Testing ${name}: ${key.substring(0, 20)}...`);

        let keyWorking = false;
        for (const model of MODELS) {
            const result = await testKey(key, name, model);
            allResults.push(result);

            if (result.status === 'ACTIVE') {
                console.log(`  ✅ ${model}: WORKING`);
                keyWorking = true;
                break; // Found working model, no need to test others
            } else {
                console.log(`  ❌ ${model}: ${result.error || result.status}`);
            }

            await new Promise(resolve => setTimeout(resolve, 500));
        }

        if (!keyWorking) {
            console.log(`  ⚠️  ${name} not working with any model\n`);
        } else {
            console.log('');
        }
    }

    // Save results
    fs.writeFileSync('gemini-test-results.json', JSON.stringify(allResults, null, 2));

    // Print summary
    console.log('\n========== SUMMARY ==========');
    const workingKeys = allResults.filter(r => r.status === 'ACTIVE');

    if (workingKeys.length > 0) {
        console.log('\n✅ WORKING KEYS:');
        workingKeys.forEach(r => {
            console.log(`\n${r.keyName}:`);
            console.log(`  API Key: ${r.key}`);
            console.log(`  Model: ${r.model}`);
            console.log(`  Response: ${r.text}`);
            console.log(`  Status: ACTIVE - NO QUOTA LIMITS`);
        });

        console.log('\n========== RECOMMENDATION ==========');
        const best = workingKeys[0];
        console.log(`✅ USE ${best.keyName}`);
        console.log(`   Key: ${best.key}`);
        console.log(`   Model: ${best.model}`);
    } else {
        console.log('\n❌ NO WORKING KEYS FOUND');
        console.log('\nPossible issues:');
        console.log('  1. API keys may be invalid');
        console.log('  2. Gemini API may not be enabled');
        console.log('  3. Billing may not be set up');
        console.log('  4. API restrictions may be in place');
    }
}

runTests();
