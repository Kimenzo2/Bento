/**
 * @deprecated DO NOT import from this file.
 *
 * This file previously re-exported server-side Mastra code, which caused
 * 187KB of server code to leak into the client bundle.
 *
 * For client-side Mastra operations, use:
 *   import { mastra } from '../services/mastraClient';
 *
 * The mastraClient is a thin HTTP client that calls the Mastra server.
 * All @mastra/core code stays on the server where it belongs.
 */

// Intentionally empty - prevents server code from leaking into client bundle
export {};
