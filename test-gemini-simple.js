import https from 'https';
import fs from 'fs';

const API_KEYS = [
    { name: 'Key 1', key: 'AIzaSyASBU6gbFFAzYcJeTzx2fUIg-Hjzthec40' },
    { name: 'Key 2', key: 'AIzaSyB5BKaBAsru3etCQZl6Z3V8E5f5lbkHMNw' }
];

async function testKey(apiKey, keyName) {
    return new Promise((resolve) => {
        const requestData = JSON.stringify({
            contents: [{ parts: [{ text: 'Say hello in one sentence.' }] }]
        });

        const options = {
            hostname: 'generativelanguage.googleapis.com',
            path: `/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
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
                            status: 'ACTIVE',
                            text: response.candidates[0].content.parts[0].text
                        });
                    } else {
                        resolve({
                            keyName,
                            key: apiKey,
                            status: 'FAILED',
                            statusCode: res.statusCode,
                            error: response.error?.message || 'Unknown error'
                        });
                    }
                } catch (e) {
                    resolve({ keyName, key: apiKey, status: 'ERROR', error: e.message });
                }
            });
        });

        req.on('error', (error) => {
            resolve({ keyName, key: apiKey, status: 'ERROR', error: error.message });
        });

        req.write(requestData);
        req.end();
    });
}

async function runTests() {
    const results = [];

    for (const { name, key } of API_KEYS) {
        const result = await testKey(key, name);
        results.push(result);
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Write to file
    fs.writeFileSync('gemini-test-results.json', JSON.stringify(results, null, 2));

    // Print results
    console.log('\n========== GEMINI API KEY TEST RESULTS ==========\n');
    results.forEach(r => {
        console.log(`${r.keyName}:`);
        console.log(`  Key: ${r.key}`);
        console.log(`  Status: ${r.status}`);
        if (r.status === 'ACTIVE') {
            console.log(`  Result: ${r.text}`);
            console.log(`  ✅ WORKING - NO QUOTA LIMITS`);
        } else {
            console.log(`  Error: ${r.error}`);
            console.log(`  ❌ NOT WORKING`);
        }
        console.log('');
    });

    const working = results.find(r => r.status === 'ACTIVE');
    console.log('========== RECOMMENDATION ==========');
    if (working) {
        console.log(`✅ USE ${working.keyName}: ${working.key}`);
    } else {
        console.log('❌ No working keys found');
    }
}

runTests();
