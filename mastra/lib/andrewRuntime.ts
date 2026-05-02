import { RequestContext } from '@mastra/core/di';
import { MastraCompositeStore } from '@mastra/core/storage';
import { DuckDBStore } from '@mastra/duckdb';
import { ObservabilityStorageClickhouse } from '@mastra/clickhouse';
import { LibSQLStore } from '@mastra/libsql';
import { PinoLogger } from '@mastra/loggers';
import { Observability, SensitiveDataFilter } from '@mastra/observability';
import { z } from 'zod';
import { AndrewOutlineModeSchema, AndrewPromptVersionSchema } from '../schemas';

export const ANDREW_PROMPT_VERSION = 'andrew-v2';
export const ANDREW_SERVICE_NAME = 'andrew-life-in-colour';
export const ANDREW_RUNTIME_STORAGE_ID = 'andrew-runtime-storage';
export const ANDREW_OBSERVABILITY_STORAGE_ID = 'andrew-observability-storage';
export const ANDREW_REQUEST_CONTEXT_KEYS = ['userId', 'generationId', 'outlineMode', 'promptVersion'] as const;

export const AndrewRuntimeRequestContextSchema = z.object({
  userId: z.string().uuid(),
  generationId: z.string().uuid(),
  outlineMode: AndrewOutlineModeSchema,
  promptVersion: AndrewPromptVersionSchema,
});

export type AndrewRuntimeRequestContext = z.infer<typeof AndrewRuntimeRequestContextSchema>;
export type AndrewRuntimeEnvironment = 'development' | 'production';

export interface AndrewRuntimeProfile {
  environment: AndrewRuntimeEnvironment;
  observabilityBackend: 'duckdb' | 'clickhouse';
  serviceName: string;
  loggingLevel: 'debug' | 'info';
  requestContextKeys: readonly string[];
}

export interface AndrewRuntimeOptions {
  environment?: string;
  libsqlUrl?: string;
  clickhouseUrl?: string;
  clickhouseUsername?: string;
  clickhousePassword?: string;
}

function normalizeEnvironment(environment?: string): AndrewRuntimeEnvironment {
  return environment === 'production' ? 'production' : 'development';
}

export function buildAndrewRuntimeProfile(options: { environment?: string } = {}): AndrewRuntimeProfile {
  const environment = normalizeEnvironment(options.environment);

  return {
    environment,
    observabilityBackend: environment === 'production' ? 'clickhouse' : 'duckdb',
    serviceName: ANDREW_SERVICE_NAME,
    loggingLevel: environment === 'production' ? 'info' : 'debug',
    requestContextKeys: ANDREW_REQUEST_CONTEXT_KEYS,
  };
}

export function createAndrewRequestContext(input: AndrewRuntimeRequestContext): RequestContext<AndrewRuntimeRequestContext> {
  return new RequestContext<AndrewRuntimeRequestContext>([
    ['userId', input.userId],
    ['generationId', input.generationId],
    ['outlineMode', input.outlineMode],
    ['promptVersion', input.promptVersion],
  ]);
}

export function summarizeAndrewRequestContext(
  requestContext?: RequestContext<any>
): {
  userId?: string;
  generationId?: string;
  outlineMode?: string;
  promptVersion?: string;
} {
  if (!requestContext) {
    return {};
  }

  return {
    userId: requestContext.get('userId') as string | undefined,
    generationId: requestContext.get('generationId') as string | undefined,
    outlineMode: requestContext.get('outlineMode') as string | undefined,
    promptVersion: requestContext.get('promptVersion') as string | undefined,
  };
}

export function createAndrewLogger(): PinoLogger {
  return new PinoLogger();
}

export function createAndrewStorage(options: AndrewRuntimeOptions = {}): MastraCompositeStore {
  const profile = buildAndrewRuntimeProfile(options);
  const libsqlUrl = options.libsqlUrl ?? process.env.MASTRA_LIBSQL_URL ?? 'file:./.mastra/andrew.db';

  const clickhouseUrl = options.clickhouseUrl ?? process.env.CLICKHOUSE_URL ?? '';
  const clickhouseUsername = options.clickhouseUsername ?? process.env.CLICKHOUSE_USERNAME ?? 'default';
  const clickhousePassword = options.clickhousePassword ?? process.env.CLICKHOUSE_PASSWORD ?? '';

  if (profile.observabilityBackend === 'clickhouse' && !clickhouseUrl) {
    throw new Error('CLICKHOUSE_URL is required when Andrew observability runs in production.');
  }

  const observabilityStore =
    profile.observabilityBackend === 'clickhouse'
      ? new ObservabilityStorageClickhouse({
          url: clickhouseUrl,
          username: clickhouseUsername,
          password: clickhousePassword,
        })
      : new DuckDBStore().observability;

  return new MastraCompositeStore({
    id: ANDREW_RUNTIME_STORAGE_ID,
    default: new LibSQLStore({
      id: 'andrew-libsql',
      url: libsqlUrl,
    }),
    domains: {
      observability: observabilityStore,
    },
  });
}

export function createAndrewObservability(options: AndrewRuntimeOptions = {}): Observability {
  const profile = buildAndrewRuntimeProfile(options);

  return new Observability({
    configs: {
      default: {
        serviceName: profile.serviceName,
        requestContextKeys: [...profile.requestContextKeys],
        logging: {
          enabled: true,
          level: profile.loggingLevel,
        },
        spanOutputProcessors: [new SensitiveDataFilter()],
      },
    },
  });
}

export function createAndrewRuntime(options: AndrewRuntimeOptions = {}) {
  return {
    profile: buildAndrewRuntimeProfile(options),
    logger: createAndrewLogger(),
    storage: createAndrewStorage(options),
    observability: createAndrewObservability(options),
  };
}
