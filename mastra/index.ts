import { andrewAgent } from './agents/andrew';
import { andrewColoringPageScorer } from './evals/andrewScorer';
import { createAndrewRuntime } from './lib/andrewRuntime';
import { lifeInColourWorkflow } from './workflows/lifeInColourWorkflow';
import { Mastra } from '@mastra/core/mastra';

const runtime = createAndrewRuntime({
  environment: process.env.NODE_ENV,
  libsqlUrl: process.env.MASTRA_LIBSQL_URL,
  clickhouseUrl: process.env.CLICKHOUSE_URL,
  clickhouseUsername: process.env.CLICKHOUSE_USERNAME,
  clickhousePassword: process.env.CLICKHOUSE_PASSWORD,
});

export const mastra = new Mastra({
  agents: {
    andrew: andrewAgent,
  },
  storage: runtime.storage,
  logger: runtime.logger,
  observability: runtime.observability,
  scorers: {
    andrewColoringPage: andrewColoringPageScorer,
  },
  workflows: {
    lifeInColour: lifeInColourWorkflow,
  },
});

export default mastra;
