declare module 'bytez.js' {
    export default class Bytez {
        constructor(apiKey: string);
        model(modelId: string): {
            run(input: any): Promise<{ error?: any; output?: any }>;
        };
    }
}
