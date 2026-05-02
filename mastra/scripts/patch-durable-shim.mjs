import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const isOutputScript = basename(scriptDir) === 'output' && basename(dirname(scriptDir)) === '.mastra';
const outputRoot = isOutputScript ? scriptDir : resolve(scriptDir, '../../.mastra/output');
const sourcePath = fileURLToPath(import.meta.url);
const outputScriptPath = resolve(outputRoot, 'patch-durable-shim.mjs');
const outputPackageJsonPath = resolve(outputRoot, 'package.json');
const bundleEntry = resolve(outputRoot, 'index.mjs');
const agentDir = resolve(outputRoot, 'node_modules/@mastra/core/dist/agent');
const agentIndexJs = resolve(agentDir, 'index.js');
const agentIndexCjs = resolve(agentDir, 'index.cjs');
const agentIndexDts = resolve(agentDir, 'index.d.ts');
const durableDir = resolve(outputRoot, 'node_modules/@mastra/core/dist/agent/durable');
const durableJs = resolve(durableDir, 'index.js');
const durableCjs = resolve(durableDir, 'index.cjs');
const durableDts = resolve(durableDir, 'index.d.ts');
const streamDir = resolve(outputRoot, 'node_modules/@mastra/core/dist/stream');
const streamIndexJs = resolve(streamDir, 'index.js');
const streamIndexCjs = resolve(streamDir, 'index.cjs');
const streamIndexDts = resolve(streamDir, 'index.d.ts');
const observabilityDir = resolve(outputRoot, 'node_modules/@mastra/core/dist/observability');
const observabilityIndexJs = resolve(observabilityDir, 'index.js');
const observabilityIndexCjs = resolve(observabilityDir, 'index.cjs');
const observabilityIndexDts = resolve(observabilityDir, 'index.d.ts');
const storageIndexJs = resolve(outputRoot, 'node_modules/@mastra/core/dist/storage/index.js');
const storageIndexCjs = resolve(outputRoot, 'node_modules/@mastra/core/dist/storage/index.cjs');
const storageIndexDts = resolve(outputRoot, 'node_modules/@mastra/core/dist/storage/index.d.ts');
const requestContextIndexJs = resolve(outputRoot, 'node_modules/@mastra/core/dist/request-context/index.js');
const requestContextIndexCjs = resolve(outputRoot, 'node_modules/@mastra/core/dist/request-context/index.cjs');
const requestContextIndexDts = resolve(outputRoot, 'node_modules/@mastra/core/dist/request-context/index.d.ts');
const diIndexJs = resolve(outputRoot, 'node_modules/@mastra/core/dist/di/index.js');
const diIndexCjs = resolve(outputRoot, 'node_modules/@mastra/core/dist/di/index.cjs');
const diIndexDts = resolve(outputRoot, 'node_modules/@mastra/core/dist/di/index.d.ts');

const jsSource = [
  "export const AGENT_STREAM_TOPIC = (runId) => `workflow.events.v2.${runId}`;",
  'export default AGENT_STREAM_TOPIC;',
  '',
].join('\n');

const cjsSource = [
  '"use strict";',
  'const AGENT_STREAM_TOPIC = (runId) => `workflow.events.v2.${runId}`;',
  'exports.AGENT_STREAM_TOPIC = AGENT_STREAM_TOPIC;',
  'exports.default = AGENT_STREAM_TOPIC;',
  '',
].join('\n');

const dtsSource = [
  'export declare const AGENT_STREAM_TOPIC: (runId: string) => string;',
  'export default AGENT_STREAM_TOPIC;',
  '',
].join('\n');

const agentJsSource = [
  "export { Agent, TripWire, isSupportedLanguageModel, resolveThreadIdFromArgs, supportedLanguageModelSpecifications, tryGenerateWithJsonFallback, tryStreamWithJsonFallback } from '../chunk-GYS4EMOL.js';",
  "export { MessageList, TypeDetector, aiV5ModelMessageToV2PromptMessage, convertMessages } from '../chunk-XMF2ZGOE.js';",
  '',
  'export function isDurableAgentLike(agent) {',
  "  return !!agent && typeof agent === 'object' && 'pubsub' in agent && agent.pubsub != null;",
  '}',
  '',
].join('\n');

const agentCjsSource = [
  "'use strict';",
  '',
  "var chunkEPX67KDK_cjs = require('../chunk-EPX67KDK.cjs');",
  "var chunkVNHOOCJB_cjs = require('../chunk-VNHOOCJB.cjs');",
  '',
  '',
  '',
  'Object.defineProperty(exports, "Agent", {',
  '  enumerable: true,',
  '  get: function () { return chunkEPX67KDK_cjs.Agent; }',
  '});',
  'Object.defineProperty(exports, "TripWire", {',
  '  enumerable: true,',
  '  get: function () { return chunkEPX67KDK_cjs.TripWire; }',
  '});',
  'Object.defineProperty(exports, "isSupportedLanguageModel", {',
  '  enumerable: true,',
  '  get: function () { return chunkEPX67KDK_cjs.isSupportedLanguageModel; }',
  '});',
  'Object.defineProperty(exports, "resolveThreadIdFromArgs", {',
  '  enumerable: true,',
  '  get: function () { return chunkEPX67KDK_cjs.resolveThreadIdFromArgs; }',
  '});',
  'Object.defineProperty(exports, "supportedLanguageModelSpecifications", {',
  '  enumerable: true,',
  '  get: function () { return chunkEPX67KDK_cjs.supportedLanguageModelSpecifications; }',
  '});',
  'Object.defineProperty(exports, "tryGenerateWithJsonFallback", {',
  '  enumerable: true,',
  '  get: function () { return chunkEPX67KDK_cjs.tryGenerateWithJsonFallback; }',
  '});',
  'Object.defineProperty(exports, "tryStreamWithJsonFallback", {',
  '  enumerable: true,',
  '  get: function () { return chunkEPX67KDK_cjs.tryStreamWithJsonFallback; }',
  '});',
  'Object.defineProperty(exports, "MessageList", {',
  '  enumerable: true,',
  '  get: function () { return chunkVNHOOCJB_cjs.MessageList; }',
  '});',
  'Object.defineProperty(exports, "TypeDetector", {',
  '  enumerable: true,',
  '  get: function () { return chunkVNHOOCJB_cjs.TypeDetector; }',
  '});',
  'Object.defineProperty(exports, "aiV5ModelMessageToV2PromptMessage", {',
  '  enumerable: true,',
  '  get: function () { return chunkVNHOOCJB_cjs.aiV5ModelMessageToV2PromptMessage; }',
  '});',
  'Object.defineProperty(exports, "convertMessages", {',
  '  enumerable: true,',
  '  get: function () { return chunkVNHOOCJB_cjs.convertMessages; }',
  '});',
  '',
  'function isDurableAgentLike(agent) {',
  "  return !!agent && typeof agent === 'object' && 'pubsub' in agent && agent.pubsub != null;",
  '}',
  '',
  'exports.isDurableAgentLike = isDurableAgentLike;',
  '',
].join('\n');

const agentDtsSource = [
  "export { TripWire } from './trip-wire.js';",
  "export { MessageList, convertMessages, aiV5ModelMessageToV2PromptMessage, TypeDetector } from './message-list/index.js';",
  "export type { OutputFormat } from './message-list/index.js';",
  "export * from './types.js';",
  "export * from './agent.js';",
  "export * from './utils.js';",
  "export type { AgentExecutionOptions, AgentExecutionOptionsBase, InnerAgentExecutionOptions, MultiPrimitiveExecutionOptions, DelegationStartContext, DelegationStartResult, OnDelegationStartHandler, DelegationCompleteContext, DelegationCompleteResult, OnDelegationCompleteHandler, DelegationConfig, MessageFilterContext,",
  "/** @deprecated Use MessageFilterContext instead */",
  "MessageFilterContext as ContextFilterContext, IterationCompleteContext, IterationCompleteResult, OnIterationCompleteHandler, StreamIsTaskCompleteConfig, IsTaskCompleteConfig, IsTaskCompleteRunResult, CompletionConfig, CompletionRunResult, NetworkOptions, NetworkRoutingConfig, } from './agent.types.js';",
  "export type { MastraLanguageModel, MastraLegacyLanguageModel } from '../llm/model/shared.types.js';",
  'export declare function isDurableAgentLike(agent: unknown): agent is { pubsub: unknown };',
  '',
].join('\n');

const diJsSource = [
  "export { MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY, RequestContext } from '../chunk-JGOH7RWL.js';",
  '',
  'function isPlainObject(value) {',
  "  return !!value && typeof value === 'object' && !Array.isArray(value);",
  '}',
  '',
  'export function mergeVersionOverrides(existing, versions) {',
  '  if (!versions) {',
  '    return existing;',
  '  }',
  '',
  '  if (!isPlainObject(existing) || !isPlainObject(versions)) {',
  '    return versions;',
  '  }',
  '',
  '  const merged = { ...existing };',
  '',
  '  for (const [key, value] of Object.entries(versions)) {',
  '    const current = existing[key];',
  '    if (isPlainObject(current) && isPlainObject(value)) {',
  '      merged[key] = mergeVersionOverrides(current, value);',
  '    } else {',
  '      merged[key] = value;',
  '    }',
  '  }',
  '',
  '  return merged;',
  '}',
  '',
].join('\n');

const diCjsSource = [
  "'use strict';",
  '',
  "var chunk5WBEMKE2_cjs = require('../chunk-5WBEMKE2.cjs');",
  '',
  '',
  '',
  'Object.defineProperty(exports, "MASTRA_RESOURCE_ID_KEY", {',
  '  enumerable: true,',
  '  get: function () { return chunk5WBEMKE2_cjs.MASTRA_RESOURCE_ID_KEY; }',
  '});',
  'Object.defineProperty(exports, "MASTRA_THREAD_ID_KEY", {',
  '  enumerable: true,',
  '  get: function () { return chunk5WBEMKE2_cjs.MASTRA_THREAD_ID_KEY; }',
  '});',
  'Object.defineProperty(exports, "RequestContext", {',
  '  enumerable: true,',
  '  get: function () { return chunk5WBEMKE2_cjs.RequestContext; }',
  '});',
  '',
  'function isPlainObject(value) {',
  "  return !!value && typeof value === 'object' && !Array.isArray(value);",
  '}',
  '',
  'function mergeVersionOverrides(existing, versions) {',
  '  if (!versions) {',
  '    return existing;',
  '  }',
  '',
  '  if (!isPlainObject(existing) || !isPlainObject(versions)) {',
  '    return versions;',
  '  }',
  '',
  '  const merged = { ...existing };',
  '',
  '  for (const [key, value] of Object.entries(versions)) {',
  '    const current = existing[key];',
  '    if (isPlainObject(current) && isPlainObject(value)) {',
  '      merged[key] = mergeVersionOverrides(current, value);',
  '    } else {',
  '      merged[key] = value;',
  '    }',
  '  }',
  '',
  '  return merged;',
  '}',
  '',
  'exports.mergeVersionOverrides = mergeVersionOverrides;',
  '',
].join('\n');

const diDtsSource = [
  "export { RequestContext, MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY } from '../request-context/index.js';",
  'export declare function mergeVersionOverrides(existing: Record<string, unknown> | undefined, versions: Record<string, unknown> | undefined): Record<string, unknown> | undefined;',
  '',
].join('\n');

const streamJsSource = [
  "export { ChunkFrom, MastraAgentNetworkStream, MastraModelOutput, WorkflowRunOutput, convertFullStreamChunkToMastra, convertFullStreamChunkToUIMessageStream, convertMastraChunkToAISDKv5 } from '../chunk-GYS4EMOL.js';",
  "export { DefaultGeneratedFile, DefaultGeneratedFileWithType } from '../chunk-XMF2ZGOE.js';",
  '',
  'export function createCachingTransformStream({ cache, cacheKey }) {',
  '  const TransformStreamCtor = globalThis.TransformStream;',
  '',
  '  if (!TransformStreamCtor) {',
  "    throw new Error('TransformStream is not available in this runtime');",
  '  }',
  '',
  '  const transform = new TransformStreamCtor({',
  '    async transform(chunk, controller) {',
  '      try {',
  '        await cache?.listPush?.(cacheKey, chunk);',
  '      } catch {',
  '        // Cache failures should not break live streaming.',
  '      }',
  '',
  '      controller.enqueue(chunk);',
  '    },',
  '  });',
  '',
  '  return { transform };',
  '}',
  '',
  'export function createReplayStream({ history = [], liveSource }) {',
  '  const ReadableStreamCtor = globalThis.ReadableStream;',
  '',
  '  if (!ReadableStreamCtor) {',
  "    throw new Error('ReadableStream is not available in this runtime');",
  '  }',
  '',
  '  return new ReadableStreamCtor({',
  '    async start(controller) {',
  '      try {',
  '        for (const chunk of history ?? []) {',
  '          controller.enqueue(chunk);',
  '        }',
  '',
  '        if (!liveSource) {',
  '          controller.close();',
  '          return;',
  '        }',
  '',
  '        const reader = liveSource.getReader();',
  '',
  '        try {',
  '          while (true) {',
  '            const { done, value } = await reader.read();',
  '            if (done) break;',
  '            controller.enqueue(value);',
  '          }',
  '        } finally {',
  '          reader.releaseLock();',
  '        }',
  '',
  '        controller.close();',
  '      } catch (error) {',
  '        controller.error(error);',
  '      }',
  '    },',
  '    cancel(reason) {',
  "      if (typeof liveSource?.cancel === 'function') {",
  '        return liveSource.cancel(reason);',
  '      }',
  '',
  '      return void reason;',
  '    },',
  '  });',
  '}',
  '',
].join('\n');

const streamCjsSource = [
  "'use strict';",
  '',
  "var chunkEPX67KDK_cjs = require('../chunk-EPX67KDK.cjs');",
  "var chunkVNHOOCJB_cjs = require('../chunk-VNHOOCJB.cjs');",
  '',
  '',
  '',
  'Object.defineProperty(exports, "ChunkFrom", {',
  '  enumerable: true,',
  '  get: function () { return chunkEPX67KDK_cjs.ChunkFrom; }',
  '});',
  'Object.defineProperty(exports, "MastraAgentNetworkStream", {',
  '  enumerable: true,',
  '  get: function () { return chunkEPX67KDK_cjs.MastraAgentNetworkStream; }',
  '});',
  'Object.defineProperty(exports, "MastraModelOutput", {',
  '  enumerable: true,',
  '  get: function () { return chunkEPX67KDK_cjs.MastraModelOutput; }',
  '});',
  'Object.defineProperty(exports, "WorkflowRunOutput", {',
  '  enumerable: true,',
  '  get: function () { return chunkEPX67KDK_cjs.WorkflowRunOutput; }',
  '});',
  'Object.defineProperty(exports, "convertFullStreamChunkToMastra", {',
  '  enumerable: true,',
  '  get: function () { return chunkEPX67KDK_cjs.convertFullStreamChunkToMastra; }',
  '});',
  'Object.defineProperty(exports, "convertFullStreamChunkToUIMessageStream", {',
  '  enumerable: true,',
  '  get: function () { return chunkEPX67KDK_cjs.convertFullStreamChunkToUIMessageStream; }',
  '});',
  'Object.defineProperty(exports, "convertMastraChunkToAISDKv5", {',
  '  enumerable: true,',
  '  get: function () { return chunkEPX67KDK_cjs.convertMastraChunkToAISDKv5; }',
  '});',
  'Object.defineProperty(exports, "DefaultGeneratedFile", {',
  '  enumerable: true,',
  '  get: function () { return chunkVNHOOCJB_cjs.DefaultGeneratedFile; }',
  '});',
  'Object.defineProperty(exports, "DefaultGeneratedFileWithType", {',
  '  enumerable: true,',
  '  get: function () { return chunkVNHOOCJB_cjs.DefaultGeneratedFileWithType; }',
  '});',
  '',
  'function createCachingTransformStream({ cache, cacheKey }) {',
  '  const TransformStreamCtor = globalThis.TransformStream;',
  '',
  '  if (!TransformStreamCtor) {',
  "    throw new Error('TransformStream is not available in this runtime');",
  '  }',
  '',
  '  const transform = new TransformStreamCtor({',
  '    async transform(chunk, controller) {',
  '      try {',
  '        if (cache?.listPush) {',
  '          await cache.listPush(cacheKey, chunk);',
  '        }',
  '      } catch {',
  '        // Cache failures should not break live streaming.',
  '      }',
  '',
  '      controller.enqueue(chunk);',
  '    },',
  '  });',
  '',
  '  return { transform };',
  '}',
  '',
  'function createReplayStream({ history = [], liveSource }) {',
  '  const ReadableStreamCtor = globalThis.ReadableStream;',
  '',
  '  if (!ReadableStreamCtor) {',
  "    throw new Error('ReadableStream is not available in this runtime');",
  '  }',
  '',
  '  return new ReadableStreamCtor({',
  '    async start(controller) {',
  '      try {',
  '        for (const chunk of history ?? []) {',
  '          controller.enqueue(chunk);',
  '        }',
  '',
  '        if (!liveSource) {',
  '          controller.close();',
  '          return;',
  '        }',
  '',
  '        const reader = liveSource.getReader();',
  '',
  '        try {',
  '          while (true) {',
  '            const { done, value } = await reader.read();',
  '            if (done) break;',
  '            controller.enqueue(value);',
  '          }',
  '        } finally {',
  '          reader.releaseLock();',
  '        }',
  '',
  '        controller.close();',
  '      } catch (error) {',
  '        controller.error(error);',
  '      }',
  '    },',
  '    cancel(reason) {',
  "      if (typeof liveSource?.cancel === 'function') {",
  '        return liveSource.cancel(reason);',
  '      }',
  '',
  '      return void reason;',
  '    },',
  '  });',
  '}',
  '',
  'exports.createCachingTransformStream = createCachingTransformStream;',
  'exports.createReplayStream = createReplayStream;',
  '',
].join('\n');

const streamDtsSource = [
  "export type { ChunkType, TypedChunkType, MastraFinishReason, ProviderMetadata, StreamTransport, LanguageModelUsage, AgentChunkType, DataChunkType, NetworkChunkType, WorkflowStreamEvent, FileChunk, ReasoningChunk, SourceChunk, ToolCallChunk, ToolResultChunk, LLMStepResult, StepFinishPayload, StepStartPayload, DynamicToolCallPayload, DynamicToolResultPayload, ToolCallPayload, ToolResultPayload, ReasoningDeltaPayload, ReasoningStartPayload, TextDeltaPayload, TextStartPayload, FilePayload, SourcePayload, JSONArray, JSONObject, JSONValue, ReadonlyJSONArray, ReadonlyJSONObject, ReadonlyJSONValue, } from './types.js';",
  '/**',
  ' * @deprecated Use StandardSchemaWithJSON from \'../schema/index.js\' instead',
  ' */',
  "export type { OutputSchema, PartialSchemaOutput } from './base/schema.js';",
  "export type { FullOutput } from './base/output.js';",
  "export { ChunkFrom } from './types.js';",
  "export { MastraAgentNetworkStream } from './MastraAgentNetworkStream.js';",
  "export { MastraModelOutput } from './base/output.js';",
  "export { WorkflowRunOutput } from './RunOutput.js';",
  "export { DefaultGeneratedFile, DefaultGeneratedFileWithType } from './aisdk/v5/file.js';",
  "export { convertFullStreamChunkToMastra, convertMastraChunkToAISDKv5 } from './aisdk/v5/transform.js';",
  "export { convertFullStreamChunkToUIMessageStream } from './aisdk/v5/compat/index.js';",
  'export declare function createCachingTransformStream(options: {',
  '    cache: {',
  '        listPush(key: string, value: unknown): Promise<void> | void;',
  '    };',
  '    cacheKey: string;',
  '}): {',
  '    transform: TransformStream<unknown, unknown>;',
  '};',
  'export declare function createReplayStream(options: {',
  '    history?: unknown[];',
  '    liveSource?: ReadableStream<unknown> | null;',
  '}): ReadableStream<unknown>;',
  '',
].join('\n');

const observabilityJsSource = `import { randomUUID } from 'node:crypto';

export { DEFAULT_BLOCKED_LABELS, NoOpObservability, SamplingStrategyType, createObservabilityContext, noOpLoggerContext, noOpMetricsContext, noOpTracingContext, resolveObservabilityContext, startRagIngestion, withRagIngestion, wrapMastra } from '../chunk-YG5H577B.js';
export { executeWithContext, executeWithContextSync, getEntityTypeForSpan, getOrCreateSpan, getRootExportSpan, resolveCurrentSpan, setCurrentSpanResolver, setExecuteWithContext, setExecuteWithContextSync } from '../chunk-Y2H3UDHU.js';
export { EntityType, InternalSpans, SpanType, TracingEventType } from '../chunk-OSVQQ7QZ.js';

export function generateSignalId() {
  return randomUUID().replace(/-/g, '');
}
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map
`;

const observabilityCjsSource = `'use strict';

var crypto = require('node:crypto');
var chunkONTZK64Y_cjs = require('../chunk-ONTZK64Y.cjs');
var chunkS6FUGBT3_cjs = require('../chunk-S6FUGBT3.cjs');
var chunkFG2B2AIP_cjs = require('../chunk-FG2B2AIP.cjs');



Object.defineProperty(exports, "DEFAULT_BLOCKED_LABELS", {
  enumerable: true,
  get: function () { return chunkONTZK64Y_cjs.DEFAULT_BLOCKED_LABELS; }
});
Object.defineProperty(exports, "NoOpObservability", {
  enumerable: true,
  get: function () { return chunkONTZK64Y_cjs.NoOpObservability; }
});
Object.defineProperty(exports, "SamplingStrategyType", {
  enumerable: true,
  get: function () { return chunkONTZK64Y_cjs.SamplingStrategyType; }
});
Object.defineProperty(exports, "createObservabilityContext", {
  enumerable: true,
  get: function () { return chunkONTZK64Y_cjs.createObservabilityContext; }
});
Object.defineProperty(exports, "noOpLoggerContext", {
  enumerable: true,
  get: function () { return chunkONTZK64Y_cjs.noOpLoggerContext; }
});
Object.defineProperty(exports, "noOpMetricsContext", {
  enumerable: true,
  get: function () { return chunkONTZK64Y_cjs.noOpMetricsContext; }
});
Object.defineProperty(exports, "noOpTracingContext", {
  enumerable: true,
  get: function () { return chunkONTZK64Y_cjs.noOpTracingContext; }
});
Object.defineProperty(exports, "resolveObservabilityContext", {
  enumerable: true,
  get: function () { return chunkONTZK64Y_cjs.resolveObservabilityContext; }
});
Object.defineProperty(exports, "startRagIngestion", {
  enumerable: true,
  get: function () { return chunkONTZK64Y_cjs.startRagIngestion; }
});
Object.defineProperty(exports, "withRagIngestion", {
  enumerable: true,
  get: function () { return chunkONTZK64Y_cjs.withRagIngestion; }
});
Object.defineProperty(exports, "wrapMastra", {
  enumerable: true,
  get: function () { return chunkONTZK64Y_cjs.wrapMastra; }
});
Object.defineProperty(exports, "executeWithContext", {
  enumerable: true,
  get: function () { return chunkS6FUGBT3_cjs.executeWithContext; }
});
Object.defineProperty(exports, "executeWithContextSync", {
  enumerable: true,
  get: function () { return chunkS6FUGBT3_cjs.executeWithContextSync; }
});
Object.defineProperty(exports, "getEntityTypeForSpan", {
  enumerable: true,
  get: function () { return chunkS6FUGBT3_cjs.getEntityTypeForSpan; }
});
Object.defineProperty(exports, "getOrCreateSpan", {
  enumerable: true,
  get: function () { return chunkS6FUGBT3_cjs.getOrCreateSpan; }
});
Object.defineProperty(exports, "getRootExportSpan", {
  enumerable: true,
  get: function () { return chunkS6FUGBT3_cjs.getRootExportSpan; }
});
Object.defineProperty(exports, "resolveCurrentSpan", {
  enumerable: true,
  get: function () { return chunkS6FUGBT3_cjs.resolveCurrentSpan; }
});
Object.defineProperty(exports, "setCurrentSpanResolver", {
  enumerable: true,
  get: function () { return chunkS6FUGBT3_cjs.setCurrentSpanResolver; }
});
Object.defineProperty(exports, "setExecuteWithContext", {
  enumerable: true,
  get: function () { return chunkS6FUGBT3_cjs.setExecuteWithContext; }
});
Object.defineProperty(exports, "setExecuteWithContextSync", {
  enumerable: true,
  get: function () { return chunkS6FUGBT3_cjs.setExecuteWithContextSync; }
});
Object.defineProperty(exports, "EntityType", {
  enumerable: true,
  get: function () { return chunkFG2B2AIP_cjs.EntityType; }
});
Object.defineProperty(exports, "InternalSpans", {
  enumerable: true,
  get: function () { return chunkFG2B2AIP_cjs.InternalSpans; }
});
Object.defineProperty(exports, "SpanType", {
  enumerable: true,
  get: function () { return chunkFG2B2AIP_cjs.SpanType; }
});
Object.defineProperty(exports, "TracingEventType", {
  enumerable: true,
  get: function () { return chunkFG2B2AIP_cjs.TracingEventType; }
});

function generateSignalId() {
  return crypto.randomUUID().replace(/-/g, '');
}

exports.generateSignalId = generateSignalId;
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map
`;

const observabilityDtsSource = `/**
 * Mastra Observability
 *
 * Core observability utilities and types. To use observability, install
 * @mastra/observability and pass an Observability instance to Mastra constructor.
 */
export * from './types/index.js';
export * from './no-op.js';
export * from './utils.js';
export { wrapMastra } from './context.js';
export { createObservabilityContext, resolveObservabilityContext } from './context-factory.js';
export { startRagIngestion, withRagIngestion } from './rag-ingestion.js';
export type { StartRagIngestionOptions, StartRagIngestionResult } from './rag-ingestion.js';
export declare function generateSignalId(): string;
//# sourceMappingURL=index.d.ts.map
`;

const postinstallSourceCjs = [
  "const fs=require('node:fs');",
  "const path=require('node:path');",
  'const root=process.cwd();',
  "const write=(file,content)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,content,'utf8');};",
  "const replace=(file,pattern,replacement)=>{const current=fs.readFileSync(file,'utf8').replace(/\\r\\n/g,'\\n');const next=current.replace(pattern,replacement);if(next!==current)fs.writeFileSync(file,next,'utf8');};",
  `write(path.join(root,'node_modules/@mastra/core/dist/agent/durable/index.js'), ${JSON.stringify(jsSource)});`,
  `write(path.join(root,'node_modules/@mastra/core/dist/agent/durable/index.cjs'), ${JSON.stringify(cjsSource)});`,
  `write(path.join(root,'node_modules/@mastra/core/dist/agent/durable/index.d.ts'), ${JSON.stringify(dtsSource)});`,
  `write(path.join(root,'node_modules/@mastra/core/dist/agent/index.js'), ${JSON.stringify(agentJsSource)});`,
  `write(path.join(root,'node_modules/@mastra/core/dist/agent/index.cjs'), ${JSON.stringify(agentCjsSource)});`,
  `write(path.join(root,'node_modules/@mastra/core/dist/agent/index.d.ts'), ${JSON.stringify(agentDtsSource)});`,
  `write(path.join(root,'node_modules/@mastra/core/dist/di/index.js'), ${JSON.stringify(diJsSource)});`,
  `write(path.join(root,'node_modules/@mastra/core/dist/di/index.cjs'), ${JSON.stringify(diCjsSource)});`,
  `write(path.join(root,'node_modules/@mastra/core/dist/di/index.d.ts'), ${JSON.stringify(diDtsSource)});`,
  `write(path.join(root,'node_modules/@mastra/core/dist/stream/index.js'), ${JSON.stringify(streamJsSource)});`,
  `write(path.join(root,'node_modules/@mastra/core/dist/stream/index.cjs'), ${JSON.stringify(streamCjsSource)});`,
  `write(path.join(root,'node_modules/@mastra/core/dist/stream/index.d.ts'), ${JSON.stringify(streamDtsSource)});`,
  `write(path.join(root,'node_modules/@mastra/core/dist/observability/index.js'), ${JSON.stringify(observabilityJsSource)});`,
  `write(path.join(root,'node_modules/@mastra/core/dist/observability/index.cjs'), ${JSON.stringify(observabilityCjsSource)});`,
  `write(path.join(root,'node_modules/@mastra/core/dist/observability/index.d.ts'), ${JSON.stringify(observabilityDtsSource)});`,
  `replace(path.join(root,'node_modules/@mastra/core/dist/request-context/index.js'), /export \\{ MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY(?:, MASTRA_VERSIONS_KEY)?, RequestContext \\} from '\\.\\.\\/chunk-JGOH7RWL\\.js';/g, "export { MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY, MASTRA_VERSIONS_KEY, RequestContext } from '../chunk-JGOH7RWL.js';");`,
  `replace(path.join(root,'node_modules/@mastra/core/dist/request-context/index.cjs'), /Object\\.defineProperty\\(exports, "MASTRA_THREAD_ID_KEY", \\{\\n  enumerable: true,\\n  get: function \\(\\) \\{ return chunk5WBEMKE2_cjs\\.MASTRA_THREAD_ID_KEY; \\}\\n\\}\\);(?:\\nObject\\.defineProperty\\(exports, "MASTRA_VERSIONS_KEY", \\{\\n  enumerable: true,\\n  get: function \\(\\) \\{ return chunk5WBEMKE2_cjs\\.MASTRA_VERSIONS_KEY; \\}\\n\\}\\);)*/g, "Object.defineProperty(exports, \\"MASTRA_THREAD_ID_KEY\\", {\\n  enumerable: true,\\n  get: function () { return chunk5WBEMKE2_cjs.MASTRA_THREAD_ID_KEY; }\\n});\\nObject.defineProperty(exports, \\"MASTRA_VERSIONS_KEY\\", {\\n  enumerable: true,\\n  get: function () { return chunk5WBEMKE2_cjs.MASTRA_VERSIONS_KEY; }\\n});");`,
  `replace(path.join(root,'node_modules/@mastra/core/dist/request-context/index.d.ts'), /export declare const MASTRA_THREAD_ID_KEY = "mastra__threadId";(?:\\nexport declare const MASTRA_VERSIONS_KEY = "mastra__versions";)*/g, "export declare const MASTRA_THREAD_ID_KEY = \\"mastra__threadId\\";\\nexport declare const MASTRA_VERSIONS_KEY = \\"mastra__versions\\";");`,
  `replace(path.join(root,'node_modules/@mastra/core/dist/storage/index.js'), /export \\{ EntityType, aggregationIntervalSchema, aggregationTypeSchema, batchCreateFeedbackArgsSchema, batchCreateLogsArgsSchema, batchCreateMetricsArgsSchema, batchCreateScoresArgsSchema, commonFilterFields, comparePeriodSchema, contextFields, createFeedbackArgsSchema, createFeedbackBodySchema, createFeedbackRecordSchema, createFeedbackResponseSchema, createLogRecordSchema, createMetricRecordSchema, createScoreArgsSchema, createScoreBodySchema, createScoreRecordSchema, createScoreResponseSchema, createdAtField, dateRangeSchema, dbTimestamps, entityIdField, entityNameField, entityTypeField, environmentField, executionSourceField, experimentIdField, feedbackFilterSchema, feedbackInputSchema, feedbackOrderByFieldSchema, feedbackOrderBySchema, feedbackRecordSchema, getEntityNamesArgsSchema, getEntityNamesResponseSchema, getEntityTypesArgsSchema, getEntityTypesResponseSchema, getEnvironmentsArgsSchema, getEnvironmentsResponseSchema, getFeedbackAggregateArgsSchema, getFeedbackAggregateResponseSchema, getFeedbackBreakdownArgsSchema, getFeedbackBreakdownResponseSchema, getFeedbackPercentilesArgsSchema, getFeedbackPercentilesResponseSchema, getFeedbackTimeSeriesArgsSchema, getFeedbackTimeSeriesResponseSchema, getMetricAggregateArgsSchema, getMetricAggregateResponseSchema, getMetricBreakdownArgsSchema, getMetricBreakdownResponseSchema, getMetricLabelKeysArgsSchema, getMetricLabelKeysResponseSchema, getMetricLabelValuesArgsSchema, getMetricLabelValuesResponseSchema, getMetricNamesArgsSchema, getMetricNamesResponseSchema, getMetricPercentilesArgsSchema, getMetricPercentilesResponseSchema, getMetricTimeSeriesArgsSchema, getMetricTimeSeriesResponseSchema, getScoreAggregateArgsSchema, getScoreAggregateResponseSchema, getScoreBreakdownArgsSchema, getScoreBreakdownResponseSchema, getScorePercentilesArgsSchema, getScorePercentilesResponseSchema, getScoreTimeSeriesArgsSchema, getScoreTimeSeriesResponseSchema, getServiceNamesArgsSchema, getServiceNamesResponseSchema, getTagsArgsSchema, getTagsResponseSchema, listFeedbackArgsSchema, listFeedbackResponseSchema, listLogsArgsSchema, listLogsResponseSchema, listMetricsArgsSchema, listMetricsResponseSchema, listScoresArgsSchema, listScoresResponseSchema, logLevelSchema, logRecordInputSchema, logRecordSchema, logsFilterSchema, logsOrderByFieldSchema, logsOrderBySchema, metadataField, metricInputSchema, metricRecordSchema, metricTypeSchema, metricsAggregationSchema, metricsFilterSchema, metricsOrderByFieldSchema, metricsOrderBySchema, organizationIdField, paginationArgsSchema, paginationInfoSchema, parentEntityIdField, parentEntityNameField, parentEntityTypeField, requestIdField, resourceIdField, rootEntityIdField, rootEntityNameField, rootEntityTypeField, runIdField, scopeField, scoreInputSchema, scoreRecordSchema, scoresFilterSchema, scoresOrderByFieldSchema, scoresOrderBySchema, serviceNameField, sessionIdField, sortDirectionSchema, sourceField, spanContextFields, spanIdField, tagsField, threadIdField, traceIdField, updatedAtField, userIdField \\} from '\\.\\.\\/chunk-2C4X2QNR\\.js';/g, "export { EntityType, aggregationIntervalSchema, aggregationTypeSchema, batchCreateFeedbackArgsSchema, batchCreateLogsArgsSchema, batchCreateMetricsArgsSchema, batchCreateScoresArgsSchema, commonFilterFields, comparePeriodSchema, contextFields, createFeedbackArgsSchema, createFeedbackBodySchema, createFeedbackRecordSchema, createFeedbackResponseSchema, createLogRecordSchema, createMetricRecordSchema, createScoreArgsSchema, createScoreBodySchema, createScoreRecordSchema, createScoreResponseSchema, createdAtField, dateRangeSchema, dbTimestamps, entityIdField, entityNameField, entityTypeField, environmentField, executionSourceField, experimentIdField, feedbackFilterSchema, feedbackInputSchema, feedbackOrderByFieldSchema, feedbackOrderBySchema, feedbackRecordSchema, getEntityNamesArgsSchema, getEntityNamesResponseSchema, getEntityTypesArgsSchema, getEntityTypesResponseSchema, getEnvironmentsArgsSchema, getEnvironmentsResponseSchema, getFeedbackAggregateArgsSchema, getFeedbackAggregateResponseSchema, getFeedbackBreakdownArgsSchema, getFeedbackBreakdownResponseSchema, getFeedbackPercentilesArgsSchema, getFeedbackPercentilesResponseSchema, getFeedbackTimeSeriesArgsSchema, getFeedbackTimeSeriesResponseSchema, getMetricAggregateArgsSchema, getMetricAggregateResponseSchema, getMetricBreakdownArgsSchema, getMetricBreakdownResponseSchema, getMetricLabelKeysArgsSchema, getMetricLabelKeysResponseSchema, getMetricLabelValuesArgsSchema, getMetricLabelValuesResponseSchema, getMetricNamesArgsSchema, getMetricNamesResponseSchema, getMetricPercentilesArgsSchema, getMetricPercentilesResponseSchema, getMetricTimeSeriesArgsSchema, getMetricTimeSeriesResponseSchema, getScoreAggregateArgsSchema, getScoreAggregateResponseSchema, getScoreBreakdownArgsSchema, getScoreBreakdownResponseSchema, getScorePercentilesArgsSchema, getScorePercentilesResponseSchema, getScoreTimeSeriesArgsSchema, getScoreTimeSeriesResponseSchema, getServiceNamesArgsSchema, getServiceNamesResponseSchema, getTagsArgsSchema, getTagsResponseSchema, listFeedbackArgsSchema, listFeedbackResponseSchema, listLogsArgsSchema, listLogsResponseSchema, listMetricsArgsSchema, listMetricsResponseSchema, listScoresArgsSchema, listScoresResponseSchema, logLevelSchema, logRecordInputSchema, logRecordSchema, logsFilterSchema, logsOrderByFieldSchema, logsOrderBySchema, metadataField, metricInputSchema, metricRecordSchema, metricTypeSchema, metricsAggregationSchema, metricsFilterSchema, metricsOrderByFieldSchema, metricsOrderBySchema, organizationIdField, paginationArgsSchema, paginationInfoSchema, parentEntityIdField, parentEntityNameField, parentEntityTypeField, requestIdField, resourceIdField, rootEntityIdField, rootEntityNameField, rootEntityTypeField, runIdField, scopeField, scoreInputSchema, scoreRecordSchema, scoresFilterSchema, scoresOrderByFieldSchema, scoresOrderBySchema, serviceNameField, sessionIdField, sortDirectionSchema, sourceField, spanContextFields, spanIdField, tagsField, threadIdField, traceIdField, updatedAtField, userIdField } from '../chunk-2C4X2QNR.js';\\nexport { getTraceResponseSchema as getTraceLightResponseSchema } from '../chunk-2C4X2QNR.js';\\n//# sourceMappingURL=index.js.map");`,
  `replace(path.join(root,'node_modules/@mastra/core/dist/storage/index.cjs'), /Object\\.defineProperty\\(exports, "getTraceResponseSchema", \\{\\n  enumerable: true,\\n  get: function \\(\\) \\{ return chunkHCHNDDHM_cjs\\.getTraceResponseSchema; \\}\\n\\}\\);\\nObject\\.defineProperty\\(exports, "listScoresBySpanResponseSchema", \\{/g, "Object.defineProperty(exports, \\"getTraceResponseSchema\\", {\\n  enumerable: true,\\n  get: function () { return chunkHCHNDDHM_cjs.getTraceResponseSchema; }\\n});\\nObject.defineProperty(exports, \\"getTraceLightResponseSchema\\", {\\n  enumerable: true,\\n  get: function () { return chunkHCHNDDHM_cjs.getTraceResponseSchema; }\\n});\\nObject.defineProperty(exports, \\"listScoresBySpanResponseSchema\\", {");`,
  `replace(path.join(root,'node_modules/@mastra/core/dist/storage/index.d.ts'), /export \\* from '\\.\\/domains\\/index\\.js';\\nexport \\* from '\\.\\/utils\\.js';\\n\\/\\/\\# sourceMappingURL=index\\.d\\.ts\\.map/m, "export * from './domains/index.js';\\nexport * from './utils.js';\\nexport { getTraceResponseSchema as getTraceLightResponseSchema } from './domains/observability/tracing.js';\\n//# sourceMappingURL=index.d.ts.map");`,
  `replace(path.join(root,'node_modules/@mastra/core/dist/chunk-JGOH7RWL.js'), /var MASTRA_RESOURCE_ID_KEY = "mastra__resourceId";\\nvar MASTRA_THREAD_ID_KEY = "mastra__threadId";(?:\\nvar MASTRA_VERSIONS_KEY = "mastra__versions";)*/g, "var MASTRA_RESOURCE_ID_KEY = \\"mastra__resourceId\\";\\nvar MASTRA_THREAD_ID_KEY = \\"mastra__threadId\\";\\nvar MASTRA_VERSIONS_KEY = \\"mastra__versions\\";");`,
  `replace(path.join(root,'node_modules/@mastra/core/dist/chunk-5WBEMKE2.cjs'), /var MASTRA_RESOURCE_ID_KEY = "mastra__resourceId";\\nvar MASTRA_THREAD_ID_KEY = "mastra__threadId";(?:\\nvar MASTRA_VERSIONS_KEY = "mastra__versions";)*/g, "var MASTRA_RESOURCE_ID_KEY = \\"mastra__resourceId\\";\\nvar MASTRA_THREAD_ID_KEY = \\"mastra__threadId\\";\\nvar MASTRA_VERSIONS_KEY = \\"mastra__versions\\";");`,
  `replace(path.join(root,'node_modules/@mastra/core/dist/chunk-JGOH7RWL.js'), /export \\{ MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY(?:, MASTRA_VERSIONS_KEY)?, RequestContext \\};/g, "export { MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY, MASTRA_VERSIONS_KEY, RequestContext };");`,
  `replace(path.join(root,'node_modules/@mastra/core/dist/chunk-5WBEMKE2.cjs'), /exports\\.MASTRA_RESOURCE_ID_KEY = MASTRA_RESOURCE_ID_KEY;\\nexports\\.MASTRA_THREAD_ID_KEY = MASTRA_THREAD_ID_KEY;(?:\\nexports\\.MASTRA_VERSIONS_KEY = MASTRA_VERSIONS_KEY;)*\\nexports\\.RequestContext = RequestContext;/g, "exports.MASTRA_RESOURCE_ID_KEY = MASTRA_RESOURCE_ID_KEY;\\nexports.MASTRA_THREAD_ID_KEY = MASTRA_THREAD_ID_KEY;\\nexports.MASTRA_VERSIONS_KEY = MASTRA_VERSIONS_KEY;\\nexports.RequestContext = RequestContext;");`,
  `replace(path.join(root,'node_modules/@mastra/core/dist/request-context/index.d.ts'), /export declare const MASTRA_THREAD_ID_KEY = "mastra__threadId";(?:\\nexport declare const MASTRA_VERSIONS_KEY = "mastra__versions";)*/g, "export declare const MASTRA_THREAD_ID_KEY = \\"mastra__threadId\\";\\nexport declare const MASTRA_VERSIONS_KEY = \\"mastra__versions\\";");`,
].join('\n');

const postinstallCommand = 'node ./patch-durable-shim.mjs';

const REQUEST_CONTEXT_VERSIONS_KEY = 'mastra__versions';

function normalizeEol(value) {
  return value.replace(/\r\n/g, '\n');
}

async function findChunkFile(rootDir, extension, requiredSnippets) {
  let entries;

  try {
    entries = await readdir(rootDir, { withFileTypes: true });
  } catch {
    return null;
  }

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.startsWith('chunk-')) continue;
    if (!entry.name.endsWith(extension)) continue;

    const candidate = resolve(rootDir, entry.name);

    let content;
    try {
      content = normalizeEol(await readFile(candidate, 'utf8'));
    } catch {
      continue;
    }

    if (requiredSnippets.every((snippet) => content.includes(snippet))) {
      return candidate;
    }
  }

  return null;
}

async function transformFile(filePath, transforms) {
  const current = normalizeEol(await readFile(filePath, 'utf8'));
  let next = current;

  for (const { pattern, replacement } of transforms) {
    next = next.replace(pattern, replacement);
  }

  if (next !== current) {
    await writeFile(filePath, next, 'utf8');
  }
}

async function main() {
  await access(bundleEntry);
  await mkdir(agentDir, { recursive: true });
  await mkdir(dirname(diIndexJs), { recursive: true });
  await mkdir(durableDir, { recursive: true });
  await mkdir(streamDir, { recursive: true });
  const coreDistRoot = resolve(outputRoot, 'node_modules/@mastra/core/dist');
  const requestContextEsm = await findChunkFile(coreDistRoot, '.js', [
    'var MASTRA_RESOURCE_ID_KEY = "mastra__resourceId";',
    'var MASTRA_THREAD_ID_KEY = "mastra__threadId";',
    'var MASTRA_AUTH_TOKEN_KEY = "mastra__authToken";',
    'var RequestContext = class {',
  ]);
  const requestContextCjs = await findChunkFile(coreDistRoot, '.cjs', [
    'var MASTRA_RESOURCE_ID_KEY = "mastra__resourceId";',
    'var MASTRA_THREAD_ID_KEY = "mastra__threadId";',
    'var MASTRA_AUTH_TOKEN_KEY = "mastra__authToken";',
    'var RequestContext = class {',
  ]);
  const selfSource = await readFile(sourcePath, 'utf8');
  await writeFile(outputScriptPath, selfSource, 'utf8');
  const outputPackage = JSON.parse(await readFile(outputPackageJsonPath, 'utf8'));
  outputPackage.scripts = {
    ...(outputPackage.scripts || {}),
    postinstall: postinstallCommand,
  };
  outputPackage.mastraDeployCacheBuster = 'trace-light-import-alias-v1';
  await writeFile(outputPackageJsonPath, `${JSON.stringify(outputPackage, null, 2)}\n`, 'utf8');
  await writeFile(agentIndexJs, agentJsSource, 'utf8');
  await writeFile(agentIndexCjs, agentCjsSource, 'utf8');
  await writeFile(agentIndexDts, agentDtsSource, 'utf8');
  await writeFile(diIndexJs, diJsSource, 'utf8');
  await writeFile(diIndexCjs, diCjsSource, 'utf8');
  await writeFile(diIndexDts, diDtsSource, 'utf8');
  await writeFile(durableJs, jsSource, 'utf8');
  await writeFile(durableCjs, cjsSource, 'utf8');
  await writeFile(durableDts, dtsSource, 'utf8');
  await writeFile(streamIndexJs, streamJsSource, 'utf8');
  await writeFile(streamIndexCjs, streamCjsSource, 'utf8');
  await writeFile(streamIndexDts, streamDtsSource, 'utf8');

  await writeFile(observabilityIndexJs, observabilityJsSource, 'utf8');
  await writeFile(observabilityIndexCjs, observabilityCjsSource, 'utf8');
  await writeFile(observabilityIndexDts, observabilityDtsSource, 'utf8');

  await transformFile(bundleEntry, [
    {
      pattern:
        /import \{ tracesFilterSchema, paginationArgsSchema as paginationArgsSchema\$1, tracesOrderBySchema, dateRangeSchema as dateRangeSchema\$1, listTracesResponseSchema, getTraceResponseSchema, getTraceArgsSchema, getTraceLightResponseSchema, getSpanResponseSchema, getSpanArgsSchema, scoreTracesResponseSchema, scoreTracesRequestSchema, spanIdsSchema, InMemoryStore \} from '@mastra\/core\/storage';/,
      replacement:
        "import { tracesFilterSchema, paginationArgsSchema as paginationArgsSchema$1, tracesOrderBySchema, dateRangeSchema as dateRangeSchema$1, listTracesResponseSchema, getTraceResponseSchema, getTraceArgsSchema, getSpanResponseSchema, getSpanArgsSchema, scoreTracesResponseSchema, scoreTracesRequestSchema, spanIdsSchema, InMemoryStore } from '@mastra/core/storage';\nconst getTraceLightResponseSchema = getTraceResponseSchema;",
    },
  ]);

  await transformFile(storageIndexJs, [
    {
      pattern: /\/\/# sourceMappingURL=index\.js\.map/,
      replacement:
        "export { getTraceResponseSchema as getTraceLightResponseSchema } from '../chunk-2C4X2QNR.js';\n//# sourceMappingURL=index.js.map",
    },
  ]);

  await transformFile(storageIndexCjs, [
    {
      pattern:
        /Object\.defineProperty\(exports, "getTraceResponseSchema", \{\n  enumerable: true,\n  get: function \(\) \{ return chunkHCHNDDHM_cjs\.getTraceResponseSchema; \}\n\}\);\nObject\.defineProperty\(exports, "listScoresBySpanResponseSchema", \{/g,
      replacement:
        'Object.defineProperty(exports, "getTraceResponseSchema", {\n  enumerable: true,\n  get: function () { return chunkHCHNDDHM_cjs.getTraceResponseSchema; }\n});\nObject.defineProperty(exports, "getTraceLightResponseSchema", {\n  enumerable: true,\n  get: function () { return chunkHCHNDDHM_cjs.getTraceResponseSchema; }\n});\nObject.defineProperty(exports, "listScoresBySpanResponseSchema", {',
    },
  ]);

  await transformFile(storageIndexDts, [
    {
      pattern:
        /export \* from '\.\/domains\/index\.js';\nexport \* from '\.\/utils\.js';\n\/\/# sourceMappingURL=index\.d\.ts\.map/m,
      replacement:
        "export * from './domains/index.js';\nexport * from './utils.js';\nexport { getTraceResponseSchema as getTraceLightResponseSchema } from './domains/observability/tracing.js';\n//# sourceMappingURL=index.d.ts.map",
    },
  ]);

  if (requestContextEsm) {
    await transformFile(requestContextEsm, [
      {
        pattern:
          /var MASTRA_RESOURCE_ID_KEY = "mastra__resourceId";\nvar MASTRA_THREAD_ID_KEY = "mastra__threadId";(?:\nvar MASTRA_VERSIONS_KEY = "mastra__versions";)*/g,
        replacement: [
          'var MASTRA_RESOURCE_ID_KEY = "mastra__resourceId";',
          'var MASTRA_THREAD_ID_KEY = "mastra__threadId";',
          `var MASTRA_VERSIONS_KEY = "${REQUEST_CONTEXT_VERSIONS_KEY}";`,
        ].join('\n'),
      },
      {
        pattern:
          /export \{ MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY(?:, MASTRA_VERSIONS_KEY)?, RequestContext \};/g,
        replacement: 'export { MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY, MASTRA_VERSIONS_KEY, RequestContext };',
      },
    ]);
  } else {
    console.warn('[patch-durable-shim] request-context ESM chunk not found; skipping chunk patch.');
  }

  if (requestContextCjs) {
    await transformFile(requestContextCjs, [
      {
        pattern:
          /var MASTRA_RESOURCE_ID_KEY = "mastra__resourceId";\nvar MASTRA_THREAD_ID_KEY = "mastra__threadId";(?:\nvar MASTRA_VERSIONS_KEY = "mastra__versions";)*/g,
        replacement: [
          'var MASTRA_RESOURCE_ID_KEY = "mastra__resourceId";',
          'var MASTRA_THREAD_ID_KEY = "mastra__threadId";',
          `var MASTRA_VERSIONS_KEY = "${REQUEST_CONTEXT_VERSIONS_KEY}";`,
        ].join('\n'),
      },
      {
        pattern:
          /exports\.MASTRA_RESOURCE_ID_KEY = MASTRA_RESOURCE_ID_KEY;\nexports\.MASTRA_THREAD_ID_KEY = MASTRA_THREAD_ID_KEY;(?:\nexports\.MASTRA_VERSIONS_KEY = MASTRA_VERSIONS_KEY;)*\nexports\.RequestContext = RequestContext;/g,
        replacement: [
          'exports.MASTRA_RESOURCE_ID_KEY = MASTRA_RESOURCE_ID_KEY;',
          'exports.MASTRA_THREAD_ID_KEY = MASTRA_THREAD_ID_KEY;',
          'exports.MASTRA_VERSIONS_KEY = MASTRA_VERSIONS_KEY;',
          'exports.RequestContext = RequestContext;',
        ].join('\n'),
      },
    ]);
  } else {
    console.warn('[patch-durable-shim] request-context CJS chunk not found; skipping chunk patch.');
  }

  await transformFile(requestContextIndexJs, [
    {
      pattern:
        /export \{ MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY(?:, MASTRA_VERSIONS_KEY)?, RequestContext \} from '\.\.\/(chunk-[^']+\.js)';/g,
      replacement: (_, chunkName) =>
        `export { MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY, MASTRA_VERSIONS_KEY, RequestContext } from '../${chunkName}';`,
    },
  ]);

  await transformFile(requestContextIndexCjs, [
    {
      pattern:
        /Object\.defineProperty\(exports, "MASTRA_THREAD_ID_KEY", \{\n  enumerable: true,\n  get: function \(\) \{ return (chunk[A-Za-z0-9]+_cjs)\.MASTRA_THREAD_ID_KEY; \}\n\}\);(?:\nObject\.defineProperty\(exports, "MASTRA_VERSIONS_KEY", \{\n  enumerable: true,\n  get: function \(\) \{ return \1\.MASTRA_VERSIONS_KEY; \}\n\}\);)?/g,
      replacement: (_, chunkVar) =>
        [
          'Object.defineProperty(exports, "MASTRA_THREAD_ID_KEY", {',
          '  enumerable: true,',
          `  get: function () { return ${chunkVar}.MASTRA_THREAD_ID_KEY; }`,
          '});',
          'Object.defineProperty(exports, "MASTRA_VERSIONS_KEY", {',
          '  enumerable: true,',
          `  get: function () { return ${chunkVar}.MASTRA_VERSIONS_KEY; }`,
          '});',
        ].join('\n'),
    },
  ]);

  await transformFile(requestContextIndexDts, [
    {
      pattern:
        /export declare const MASTRA_THREAD_ID_KEY = "mastra__threadId";(?:\nexport declare const MASTRA_VERSIONS_KEY = "mastra__versions";)*/g,
      replacement: [
        'export declare const MASTRA_THREAD_ID_KEY = "mastra__threadId";',
        `export declare const MASTRA_VERSIONS_KEY = "${REQUEST_CONTEXT_VERSIONS_KEY}";`,
      ].join('\n'),
    },
  ]);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[patch-durable-shim] ${message}`);
  process.exitCode = 1;
});
