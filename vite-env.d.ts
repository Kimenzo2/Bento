/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/**
 * Type declarations for environment variables.
 * All VITE_ prefixed env vars are exposed to the client.
 */
interface ImportMetaEnv {
    readonly VITE_GEMINI_API_KEY: string;
    readonly VITE_PAYSTACK_PUBLIC_KEY: string;
    readonly PAYSTACK_PUBLIC_KEY: string;
    readonly VITE_SUPABASE_URL?: string;
    readonly VITE_SUPABASE_ANON_KEY?: string;
    readonly VITE_GROK_API_KEY_1?: string;
    readonly VITE_GROK_API_KEY_2?: string;
    readonly VITE_GROK_API_KEY_3?: string;
    readonly VITE_BYTEZ_API_KEY_1?: string;
    readonly VITE_BYTEZ_API_KEY_2?: string;
    readonly VITE_BYTEZ_API_KEY_3?: string;
    readonly MODE: string;
    readonly DEV: boolean;
    readonly PROD: boolean;
    readonly SSR: boolean;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

// Declare module for Paystack InlineJS
declare module '@paystack/inline-js' {
    export default class Paystack {
        constructor();
        newTransaction(options: PaystackOptions): void;
        checkout(options: PaystackOptions): Promise<void>;
        resumeTransaction(accessCode: string): void;
        cancelTransaction(id: string): void;
        preloadTransaction(options: PaystackOptions): void;
        paymentRequest(options: PaystackOptions): void;
    }

    interface PaystackOptions {
        key: string;
        email: string;
        amount: number;
        currency?: string;
        ref?: string;
        firstName?: string;
        lastName?: string;
        phone?: string;
        metadata?: Record<string, any>;
        channels?: string[];
        onSuccess?: (transaction: PaystackTransaction) => void;
        onLoad?: (response: any) => void;
        onCancel?: () => void;
        onError?: (error: PaystackError) => void;
    }

    interface PaystackTransaction {
        reference: string;
        status: string;
        trans: string;
        transaction: string;
        message: string;
        trxref: string;
    }

    interface PaystackError {
        message: string;
    }
}
