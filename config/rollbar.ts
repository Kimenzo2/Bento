/**
 * Rollbar Configuration
 * 
 * Rollbar is an error monitoring service that captures and reports JavaScript errors
 * in real-time. This configuration file sets up Rollbar with best practices for
 * a React/Vite production environment.
 * 
 * @see https://docs.rollbar.com/docs/react
 */

import Rollbar from 'rollbar';

// ============================================================
// ROLLBAR ACCESS TOKEN CONFIGURATION
// ============================================================
// 
// IMPORTANT: Add your Rollbar access token to your .env file:
// 
//   VITE_ROLLBAR_ACCESS_TOKEN=your_post_client_item_token_here
// 
// You can find your access token in the Rollbar dashboard:
// 1. Go to your Rollbar project
// 2. Navigate to Settings → Project Access Tokens
// 3. Copy the "post_client_item" token (NOT the "write" token)
// 
// ============================================================

const rollbarConfig: Rollbar.Configuration = {
    accessToken: import.meta.env.VITE_ROLLBAR_ACCESS_TOKEN || '',

    // Environment identifier - helps filter errors by deployment stage
    environment: import.meta.env.MODE || 'development',

    // Capture unhandled promise rejections
    captureUnhandledRejections: true,

    // Enable source maps for better stack traces
    // Make sure to upload source maps during your build process
    payload: {
        client: {
            javascript: {
                source_map_enabled: true,
                code_version: import.meta.env.VITE_APP_VERSION || '1.0.0',
                guess_uncaught_frames: true,
            },
        },
        // Add custom data to every report
        custom: {
            app_name: 'Genesis',
        },
    },

    // Only send errors in production to avoid noise during development
    // Set to false to enable in development for testing
    enabled: import.meta.env.PROD,

    // Scrub sensitive data from payloads
    scrubFields: [
        'password',
        'passwordConfirm',
        'password_confirmation',
        'oldPassword',
        'newPassword',
        'secret',
        'token',
        'accessToken',
        'refreshToken',
        'credit_card',
        'creditCard',
        'card_number',
        'cardNumber',
        'cvv',
        'ssn',
        'social_security_number',
    ],

    // Filter out noisy or irrelevant errors
    checkIgnore: function (_isUncaught: boolean, _args: Rollbar.LogArgument[], payload: object) {
        // Ignore errors from browser extensions
        const payloadAny = payload as any;
        const filename = payloadAny?.body?.trace?.frames?.[0]?.filename || '';
        if (filename.includes('chrome-extension://') ||
            filename.includes('moz-extension://') ||
            filename.includes('safari-extension://')) {
            return true;
        }

        // Ignore network errors that are likely due to user connectivity issues
        const message = payloadAny?.body?.message?.body || '';
        if (message.includes('Failed to fetch') ||
            message.includes('NetworkError') ||
            message.includes('Load failed')) {
            return true;
        }

        return false;
    },

    // Limit the rate of errors sent (per minute)
    itemsPerMinute: 60,

    // Maximum items to send per page load
    maxItems: 10,

    // Add person information when available (will be set via rollbar.configure())
    ignoredMessages: [
        // Add any messages you want to ignore globally
        'ResizeObserver loop limit exceeded',
        'ResizeObserver loop completed with undelivered notifications',
    ],
};

// Create Rollbar instance
const rollbar = new Rollbar(rollbarConfig);

/**
 * Configure Rollbar with user information
 * Call this after user authentication to track errors by user
 */
export const configureRollbarUser = (user: { id: string; email?: string; username?: string } | null) => {
    if (user) {
        rollbar.configure({
            payload: {
                person: {
                    id: user.id,
                    email: user.email,
                    username: user.username,
                },
            },
        });
    } else {
        rollbar.configure({
            payload: {
                person: undefined,
            },
        });
    }
};

/**
 * Log an error to Rollbar manually
 */
export const logError = (error: Error | string, extra?: object) => {
    rollbar.error(error, extra);
};

/**
 * Log a warning to Rollbar
 */
export const logWarning = (message: string, extra?: object) => {
    rollbar.warning(message, extra);
};

/**
 * Log an info message to Rollbar
 */
export const logInfo = (message: string, extra?: object) => {
    rollbar.info(message, extra);
};

/**
 * Log a debug message to Rollbar (won't appear in production by default)
 */
export const logDebug = (message: string, extra?: object) => {
    rollbar.debug(message, extra);
};

export { rollbarConfig };
export default rollbar;
