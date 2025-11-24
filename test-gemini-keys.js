import https from 'https';

// The two API keys to test
const API_KEYS = [
    {
        name: 'Key 1',
        key: 'AIzaSyASBU6gbFFAzYcJeTzx2fUIg-Hjzthec40'
    },
    {
        name: 'Key 2',
        key: 'AIzaSyB5BKaBAsru3etCQZl6Z3V8E5f5lbkHMNw'
    }
];

// Test function for each key
async function testGeminiKey(apiKey, keyName) {
    return new Promise((resolve, reject) => {
        const requestData = JSON.stringify({
            contents: [{
                parts: [{
                    text: 'Say "Hello, this is a test!" in one sentence.'
                }]
            }]
        });

        const options = {
            hostname: 'generativelanguage.googleapis.com',
            path: `/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(requestData)
            }
        };

        console.log(`\n${'='.repeat(60)}`);
        console.log(`Testing ${keyName}: ${apiKey}`);
        console.log(`${'='.repeat(60)}`);

        const req = https.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const response = JSON.parse(data);

                    console.log(`Status Code: ${res.statusCode}`);

                    if (res.statusCode === 200) {
                        if (response.candidates && response.candidates[0]) {
                            const generatedText = response.candidates[0].content.parts[0].text;
                            console.log(`✅ SUCCESS - Key is active and working!`);
                            console.log(`Generated Text: ${generatedText}`);
                            resolve({
                                keyName,
                                apiKey,
                                status: 'ACTIVE',
                                statusCode: res.statusCode,
                                response: generatedText
                            });
                        } else {
                            console.log(`⚠️ UNEXPECTED RESPONSE - Got 200 but no content`);
                            console.log('Response:', JSON.stringify(response, null, 2));
                            resolve({
                                keyName,
                                apiKey,
                                status: 'UNKNOWN',
                                statusCode: res.statusCode,
                                response: response
                            });
                        }
                    } else {
                        console.log(`❌ FAILED - Status ${res.statusCode}`);
                        console.log('Error Response:', JSON.stringify(response, null, 2));

                        let errorType = 'UNKNOWN_ERROR';
                        if (response.error) {
                            if (response.error.message.includes('quota')) {
                                errorType = 'QUOTA_EXCEEDED';
                            } else if (response.error.message.includes('API key')) {
                                errorType = 'INVALID_KEY';
                            } else if (response.error.status === 'PERMISSION_DENIED') {
                                errorType = 'PERMISSION_DENIED';
                            }
                        }

                        resolve({
                            keyName,
                            apiKey,
                            status: errorType,
                            statusCode: res.statusCode,
                            error: response.error
                        });
                    }
                } catch (e) {
                    console.log(`❌ ERROR parsing response:`, e.message);
                    resolve({
                        keyName,
                        apiKey,
                        status: 'PARSE_ERROR',
                        error: e.message
                    });
                }
            });
        });

        req.on('error', (error) => {
            console.log(`❌ REQUEST ERROR:`, error.message);
            reject({
                keyName,
                apiKey,
                status: 'REQUEST_ERROR',
                error: error.message
            });
        });

        req.write(requestData);
        req.end();
    });
}

// Main test function
async function testAllKeys() {
    console.log('\n🚀 Starting Gemini API Key Tests for Text Generation...\n');

    const results = [];

    for (const { name, key } of API_KEYS) {
        try {
            const result = await testGeminiKey(key, name);
            results.push(result);
            // Wait 1 second between tests to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            results.push(error);
        }
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY OF RESULTS');
    console.log('='.repeat(60));

    results.forEach((result, index) => {
        console.log(`\n${result.keyName}:`);
        console.log(`  API Key: ${result.apiKey}`);
        console.log(`  Status: ${result.status}`);
        if (result.status === 'ACTIVE') {
            console.log(`  ✅ This key is WORKING and has NO QUOTA LIMITS!`);
        } else {
            console.log(`  ❌ This key is NOT working`);
            if (result.error) {
                console.log(`  Error: ${result.error.message || JSON.stringify(result.error)}`);
            }
        }
    });

    // Recommend which key to use
    const workingKey = results.find(r => r.status === 'ACTIVE');
    console.log('\n' + '='.repeat(60));
    console.log('💡 RECOMMENDATION');
    console.log('='.repeat(60));
    if (workingKey) {
        console.log(`✅ Use ${workingKey.keyName}: ${workingKey.apiKey}`);
        console.log(`This key is active and working for text generation!`);
    } else {
        console.log(`❌ None of the keys are currently working.`);
        console.log(`Please check the Google Cloud Console for quota limits or API restrictions.`);
    }
    console.log('\n');
}

// Run the tests
testAllKeys();
