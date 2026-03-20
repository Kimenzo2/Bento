/**
 * Braintrust Integration - LLM observability and tracing
 *
 * Uses server-side environment variables only:
 * - BRAINTRUST_API_KEY
 * - BRAINTRUST_PROJECT_ID
 */

export interface BraintrustConfig {
  apiKey: string;
  projectId: string;
  appUrl?: string;
  orgName?: string;
  enabled?: boolean;
}

export interface BraintrustLogPayload {
  event?: string;
  input?: unknown;
  output?: unknown;
  metadata?: Record<string, unknown>;
  tags?: string[];
  scores?: Record<string, number>;
}

type BraintrustModule = {
  initLogger: (options: {
    projectId?: string;
    apiKey?: string;
    appUrl?: string;
    orgName?: string;
    asyncFlush?: boolean;
  }) => unknown;
  log: (payload: Record<string, unknown>) => unknown;
  flush: () => Promise<void>;
};

class BraintrustService {
  private initialized = false;
  private config: BraintrustConfig | null = null;
  private braintrust: BraintrustModule | null = null;

  async initialize(config?: Partial<BraintrustConfig>): Promise<void> {
    if (typeof window !== 'undefined') {
      this.initialized = false;
      return;
    }

    const apiKey = config?.apiKey ?? process.env.BRAINTRUST_API_KEY;
    const projectId = config?.projectId ?? process.env.BRAINTRUST_PROJECT_ID;
    const appUrl = config?.appUrl ?? process.env.BRAINTRUST_APP_URL;
    const orgName = config?.orgName ?? process.env.BRAINTRUST_ORG_NAME;
    const enabled = config?.enabled ?? true;

    if (!enabled || !apiKey || !projectId) {
      this.initialized = false;
      this.config = null;
      return;
    }

    const sdk = (await import('braintrust')) as unknown as BraintrustModule;

    sdk.initLogger({
      apiKey,
      projectId,
      appUrl,
      orgName,
      asyncFlush: true,
    });

    this.braintrust = sdk;
    this.config = {
      apiKey,
      projectId,
      appUrl,
      orgName,
      enabled,
    };
    this.initialized = true;
  }

  async log(payload: BraintrustLogPayload): Promise<void> {
    if (!this.initialized || !this.braintrust) return;

    this.braintrust.log({
      event: payload.event,
      input: payload.input,
      output: payload.output,
      metadata: payload.metadata,
      tags: payload.tags,
      scores: payload.scores,
    });
  }

  async flush(): Promise<void> {
    if (!this.initialized || !this.braintrust) return;
    await this.braintrust.flush();
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getConfig(): BraintrustConfig | null {
    return this.config;
  }
}

export const braintrust = new BraintrustService();

export async function initializeBraintrust(config?: Partial<BraintrustConfig>): Promise<void> {
  await braintrust.initialize(config);
}
