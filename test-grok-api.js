const apiKey = "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";

async function testGrokAPI() {
    console.log("🔍 Testing Grok API key...\n");

    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "x-ai/grok-4.1-fast:free",
                messages: [
                    { role: "user", content: "Say hello in JSON format with a greeting field" }
                ],
                response_format: { type: "json_object" },
                max_tokens: 100
            })
        });

        console.log(`📡 Response Status: ${response.status} ${response.statusText}\n`);

        if (!response.ok) {
            const errorText = await response.text();
            console.error("❌ API Error:");
            console.error(errorText);
            return;
        }

        const data = await response.json();
        console.log("✅ API Response:");
        console.log(JSON.stringify(data, null, 2));

        if (data.choices && data.choices[0]) {
            console.log("\n✅ Generated Content:");
            console.log(data.choices[0].message.content);
        }
    } catch (error) {
        console.error("❌ Test Failed:");
        console.error(error.message);
    }
}

testGrokAPI();
