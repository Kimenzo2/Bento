const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function verifyGreenRoom() {
    console.log('=== GREEN ROOM API DIAGNOSTIC TOOL ===');
    console.log('Time:', new Date().toISOString());

    // 1. Load Environment Variables
    const envVars = {};
    const loadEnv = (filename) => {
        const filePath = path.resolve(process.cwd(), filename);
        if (fs.existsSync(filePath)) {
            console.log(`\n📄 Loading ${filename}...`);
            const content = fs.readFileSync(filePath, 'utf8');
            content.split('\n').forEach(line => {
                const match = line.match(/^([^=]+)=(.*)$/);
                if (match) {
                    const key = match[1].trim();
                    let value = match[2].trim();
                    value = value.replace(/^['"](.*)['"]$/, '$1'); // Remove quotes
                    if (key.startsWith('VITE_GREEN_ROOM_API_KEY')) {
                        console.log(`   Found ${key}: ${value.substring(0, 5)}...${value.substring(value.length - 4)} (Length: ${value.length})`);
                    }
                    envVars[key] = value;
                }
            });
        } else {
            console.log(`\n❌ ${filename} not found.`);
        }
    };

    loadEnv('.env');
    loadEnv('.env.local');

    // 2. Identify Green Room Keys
    const keys = [];
    for (let i = 1; i <= 20; i++) {
        const keyName = `VITE_GREEN_ROOM_API_KEY_${i}`;
        if (envVars[keyName] && envVars[keyName].length > 20) {
            keys.push({ name: keyName, value: envVars[keyName] });
        }
    }

    console.log(`\n🔑 Total Valid-Looking Keys Found: ${keys.length}`);

    if (keys.length === 0) {
        console.error('❌ FATAL: No VITE_GREEN_ROOM_API_KEY_# variables found.');
        return;
    }

    // 3. Connectivity Check (Optional but helpful)
    console.log('\n🌐 Checking Connectivity to Google Generative AI API...');
    try {
        // Simple fetch to the base endpoint (might 404 but proves connectivity)
        const resp = await fetch('https://generativelanguage.googleapis.com', { method: 'HEAD' }).catch(e => e);
        if (resp instanceof Error) {
            console.log(`   ⚠️ Direct fetch warning: ${resp.message}`);
        } else {
            console.log(`   ✅ API Endpoint Reachable (Status: ${resp.status})`);
        }
    } catch (e) {
        console.log(`   ⚠️ Connectivity check failed: ${e.message}`);
    }

    // 4. Test Keys
    console.log('\n🧪 Testing Keys (Sequence)...');

    let successCount = 0;
    let failureCount = 0;

    for (const key of keys) {
        console.log(`\n   [${key.name}] Testing...`);
        try {
            const genAI = new GoogleGenerativeAI(key.value);
            // Use a lightweight model for testing
            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

            // Timeout promise to prevent hanging
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout after 10s')), 10000));

            console.log('      Sending request to gemini-1.5-flash...');
            const result = await Promise.race([
                model.generateContent("Reply with 'OK'."),
                timeoutPromise
            ]);

            const response = await result.response;
            const text = response.text();

            if (text) {
                console.log(`   ✅ SUCCESS! Response: "${text.trim()}"`);
                successCount++;
            } else {
                console.log(`   ⚠️ Empty response received.`);
            }

        } catch (error) {
            failureCount++;
            console.error(`   ❌ FAILED.`);
            console.error(`      Error Name: ${error.name}`);
            console.error(`      Error Message: ${error.message}`);
            if (error.cause) console.error(`      Cause: ${JSON.stringify(error.cause, null, 2)}`);
        }
    }

    console.log('\n=== SUMMARY ===');
    console.log(`Total Keys: ${keys.length}`);
    console.log(`Working:    ${successCount}`);
    console.log(`Failed:     ${failureCount}`);

    if (successCount > 0) {
        console.log('\n✅ At least one key is working. The backend integration seems fine.');
    } else {
        console.log('\n❌ All keys failed. This indicates a systemic issue (network, all keys invalid, or region block).');
    }
}

verifyGreenRoom();
