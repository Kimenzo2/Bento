/**
 * Mars-Class Infrastructure - K6 Chaos Engineering & Load Testing
 *
 * Test scripts designed to break the system in controlled ways.
 *
 * THE PROBLEM:
 * - "Zero bugs" at 10 users means nothing at 1M users
 * - Bugs are statistical certainties at scale
 * - Must test failure, not just success
 *
 * CHAOS ENGINEERING PRINCIPLES:
 * 1. Hypothesize about steady state
 * 2. Introduce realistic failures
 * 3. Minimize blast radius
 * 4. Run experiments in production (carefully)
 *
 * TEST SCENARIOS:
 * 1. Thundering Herd: 50k logins at 9:00 AM
 * 2. Dependency Failure: Redis latency spike
 * 3. WebSocket Storm: 100k Realtime connections
 * 4. Database Saturation: Connection pool exhaustion
 * 5. AI Rate Limiting: text quota exceeded
 */

// ============================================================================
// K6 TEST CONFIGURATION
// ============================================================================

export const K6_CONFIG = {
  // Base URL for tests
  baseUrl: '__ENV.BASE_URL || "http://localhost:5173"',

  // Default thresholds
  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
    http_req_failed: ['rate<0.05'],
    http_reqs: ['rate>100'],
  },

  // Scenarios
  scenarios: {
    thundering_herd: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 1000 }, // Ramp up
        { duration: '30s', target: 50000 }, // Thundering herd
        { duration: '1m', target: 50000 }, // Sustained load
        { duration: '30s', target: 0 }, // Ramp down
      ],
      gracefulRampDown: '30s',
    },

    steady_state: {
      executor: 'constant-vus',
      vus: 1000,
      duration: '5m',
    },

    spike_test: {
      executor: 'ramping-vus',
      startVUs: 100,
      stages: [
        { duration: '1m', target: 100 }, // Normal load
        { duration: '10s', target: 10000 }, // Spike!
        { duration: '2m', target: 10000 }, // Sustained spike
        { duration: '10s', target: 100 }, // Back to normal
        { duration: '2m', target: 100 }, // Recovery observation
      ],
    },

    stress_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 10000 },
        { duration: '5m', target: 10000 },
        { duration: '2m', target: 20000 },
        { duration: '5m', target: 20000 },
        { duration: '2m', target: 50000 },
        { duration: '5m', target: 50000 },
        { duration: '10m', target: 0 },
      ],
    },

    soak_test: {
      executor: 'constant-vus',
      vus: 5000,
      duration: '2h',
    },
  },
};

// ============================================================================
// K6 TEST SCRIPTS (as strings to be written to files)
// ============================================================================

export const K6_SCRIPTS = {
  /**
   * Thundering Herd Test
   * Simulates 50,000 users logging in at exactly 9:00 AM (school day start)
   */
  thunderingHerd: `
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics
const loginSuccess = new Rate('login_success');
const loginDuration = new Trend('login_duration');
const dbConnectionErrors = new Counter('db_connection_errors');
const poolExhaustedErrors = new Counter('pool_exhausted_errors');

export const options = {
  scenarios: {
    thundering_herd: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 1000 },
        { duration: '30s', target: 50000 },
        { duration: '1m', target: 50000 },
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<3000'],
    'login_success': ['rate>0.95'],
    'pool_exhausted_errors': ['count<100'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5173';

export default function() {
  // Simulate login attempt
  const startTime = Date.now();
  
  const payload = JSON.stringify({
    email: \`user\${__VU}_\${__ITER}@test.com\`,
    password: 'testpassword123',
  });
  
  const params = {
    headers: { 'Content-Type': 'application/json' },
    timeout: '10s',
  };
  
  const res = http.post(\`\${BASE_URL}/api/auth/login\`, payload, params);
  
  const duration = Date.now() - startTime;
  loginDuration.add(duration);
  
  // Check response
  const success = check(res, {
    'status is 200': (r) => r.status === 200,
    'response has token': (r) => {
      try {
        return JSON.parse(r.body).token !== undefined;
      } catch {
        return false;
      }
    },
  });
  
  loginSuccess.add(success);
  
  // Track specific errors
  if (res.status === 503 || res.body?.includes('connection pool')) {
    poolExhaustedErrors.add(1);
  }
  
  if (res.body?.includes('remaining connection slots')) {
    dbConnectionErrors.add(1);
  }
  
  sleep(Math.random() * 2);
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    './results/thundering_herd.json': JSON.stringify(data, null, 2),
  };
}
`,

  /**
   * WebSocket Storm Test
   * Simulates 100,000 simultaneous Realtime connections for Green Room
   */
  websocketStorm: `
import { WebSocket } from 'k6/experimental/websockets';
import { check } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics
const wsConnections = new Counter('ws_connections');
const wsConnectionErrors = new Counter('ws_connection_errors');
const wsMessageLatency = new Trend('ws_message_latency');
const wsConnectionSuccess = new Rate('ws_connection_success');

export const options = {
  scenarios: {
    websocket_storm: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 10000 },
        { duration: '2m', target: 50000 },
        { duration: '5m', target: 100000 },
        { duration: '5m', target: 100000 },
        { duration: '2m', target: 0 },
      ],
    },
  },
  thresholds: {
    'ws_connection_success': ['rate>0.95'],
    'ws_message_latency': ['p(95)<500'],
  },
};

const WS_URL = __ENV.WS_URL || 'wss://yourproject.supabase.co/realtime/v1/websocket';

export default function() {
  const roomId = \`room_\${Math.floor(__VU / 100)}\`; // 100 users per room
  const userId = \`user_\${__VU}\`;
  
  const url = \`\${WS_URL}?room=\${roomId}&user=\${userId}\`;
  
  const ws = new WebSocket(url);
  
  ws.onopen = () => {
    wsConnections.add(1);
    wsConnectionSuccess.add(1);
    
    // Join room
    ws.send(JSON.stringify({
      type: 'join',
      room: roomId,
      user: userId,
    }));
    
    // Send periodic heartbeat
    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        const start = Date.now();
        ws.send(JSON.stringify({ type: 'heartbeat', ts: start }));
      }
    }, 5000);
    
    // Stay connected for a while
    setTimeout(() => {
      clearInterval(heartbeat);
      ws.close();
    }, 60000);
  };
  
  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === 'heartbeat_ack' && msg.originalTs) {
        const latency = Date.now() - msg.originalTs;
        wsMessageLatency.add(latency);
      }
    } catch {}
  };
  
  ws.onerror = () => {
    wsConnectionErrors.add(1);
    wsConnectionSuccess.add(0);
  };
  
  ws.onclose = () => {
    wsConnections.add(-1);
  };
}
`,

  /**
   * Book Generation Load Test
   * Tests async job queue under heavy load
   */
  bookGeneration: `
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics
const jobSubmitSuccess = new Rate('job_submit_success');
const jobSubmitDuration = new Trend('job_submit_duration');
const queueDepth = new Trend('queue_depth');
const jobsSubmitted = new Counter('jobs_submitted');

export const options = {
  scenarios: {
    sustained_generation: {
      executor: 'constant-arrival-rate',
      rate: 100,              // 100 requests per second
      timeUnit: '1s',
      duration: '10m',
      preAllocatedVUs: 200,
      maxVUs: 500,
    },
  },
  thresholds: {
    'job_submit_success': ['rate>0.99'],
    'job_submit_duration': ['p(95)<500'],
    'queue_depth': ['value<10000'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5173';

const TOPICS = [
  'A robot learning to paint',
  'A dragon who is afraid of fire',
  'A magical library in space',
  'Adventures of a time-traveling cat',
  'The friendly monster under the bed',
];

export default function() {
  const payload = JSON.stringify({
    topic: TOPICS[Math.floor(Math.random() * TOPICS.length)],
    ageRange: '6-8',
    artStyle: 'Pixar 3D',
    pageCount: 10,
  });
  
  const params = {
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token',
    },
    timeout: '5s',
  };
  
  const start = Date.now();
  const res = http.post(\`\${BASE_URL}/api/jobs/submit\`, payload, params);
  const duration = Date.now() - start;
  
  jobSubmitDuration.add(duration);
  
  const success = check(res, {
    'status is 202': (r) => r.status === 202,
    'has jobId': (r) => {
      try {
        return JSON.parse(r.body).jobId !== undefined;
      } catch {
        return false;
      }
    },
  });
  
  jobSubmitSuccess.add(success);
  
  if (success) {
    jobsSubmitted.add(1);
    
    try {
      const body = JSON.parse(res.body);
      if (body.position !== undefined) {
        queueDepth.add(body.position);
      }
    } catch {}
  }
  
  // Throttle to avoid overwhelming during ramp-up
  sleep(0.1);
}
`,

  /**
   * Semantic Cache Test
   * Tests cache hit rate under realistic query patterns
   */
  semanticCache: `
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics
const cacheHitRate = new Rate('cache_hit_rate');
const cacheHitLatency = new Trend('cache_hit_latency');
const cacheMissLatency = new Trend('cache_miss_latency');
const aiCostSaved = new Counter('ai_cost_saved_cents');

export const options = {
  scenarios: {
    realistic_queries: {
      executor: 'ramping-vus',
      startVUs: 10,
      stages: [
        { duration: '1m', target: 100 },
        { duration: '5m', target: 1000 },
        { duration: '5m', target: 1000 },
        { duration: '1m', target: 0 },
      ],
    },
  },
  thresholds: {
    'cache_hit_rate': ['rate>0.40'],  // Expect 40%+ cache hits
    'cache_hit_latency': ['p(95)<100'],
    'cache_miss_latency': ['p(95)<3000'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5173';

// Common educational questions (should hit cache frequently)
const COMMON_QUESTIONS = [
  'How does photosynthesis work?',
  'What is the water cycle?',
  'Why is the sky blue?',
  'How do fractions work?',
  'What causes earthquakes?',
  'How does gravity work?',
  'What are the planets in our solar system?',
  'How do plants grow?',
  'What is electricity?',
  'How do magnets work?',
];

// Unique questions (will be cache misses)
const UNIQUE_PREFIXES = [
  'Tell me about',
  'Explain to me',
  'What is the story of',
  'How can I learn about',
];

export default function() {
  // 70% common questions, 30% unique
  const useCommonQuestion = Math.random() < 0.7;
  
  let question;
  if (useCommonQuestion) {
    // Add slight variation to test semantic matching
    question = COMMON_QUESTIONS[Math.floor(Math.random() * COMMON_QUESTIONS.length)];
    if (Math.random() < 0.3) {
      question = question.toLowerCase();
    }
    if (Math.random() < 0.2) {
      question = 'Can you tell me ' + question.replace('?', '');
    }
  } else {
    const prefix = UNIQUE_PREFIXES[Math.floor(Math.random() * UNIQUE_PREFIXES.length)];
    question = \`\${prefix} topic_\${__VU}_\${__ITER}?\`;
  }
  
  const payload = JSON.stringify({
    query: question,
    context: {
      subject: 'science',
      gradeLevel: 'elementary',
    },
  });
  
  const params = {
    headers: { 'Content-Type': 'application/json' },
    timeout: '10s',
  };
  
  const start = Date.now();
  const res = http.post(\`\${BASE_URL}/api/ai/query\`, payload, params);
  const latency = Date.now() - start;
  
  const success = check(res, {
    'status is 200': (r) => r.status === 200,
    'has response': (r) => {
      try {
        return JSON.parse(r.body).response !== undefined;
      } catch {
        return false;
      }
    },
  });
  
  if (success) {
    try {
      const body = JSON.parse(res.body);
      const isHit = body.cacheHit === true;
      
      cacheHitRate.add(isHit);
      
      if (isHit) {
        cacheHitLatency.add(latency);
        aiCostSaved.add(1); // ~1 cent saved per cache hit
      } else {
        cacheMissLatency.add(latency);
      }
    } catch {}
  }
  
  sleep(Math.random() * 0.5);
}
`,

  /**
   * Database Connection Pool Test
   * Verifies Supavisor handles connection saturation gracefully
   */
  connectionPool: `
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics
const querySuccess = new Rate('query_success');
const queryLatency = new Trend('query_latency');
const connectionPooled = new Counter('connection_pooled');
const connectionRejected = new Counter('connection_rejected');
const gracefulDegradation = new Rate('graceful_degradation');

export const options = {
  scenarios: {
    connection_exhaustion: {
      executor: 'ramping-vus',
      startVUs: 10,
      stages: [
        { duration: '30s', target: 500 },    // Normal load
        { duration: '30s', target: 2000 },   // High load
        { duration: '1m', target: 5000 },    // Extreme load
        { duration: '1m', target: 10000 },   // Saturation
        { duration: '30s', target: 500 },    // Recovery
        { duration: '30s', target: 100 },    // Observation
      ],
    },
  },
  thresholds: {
    'query_success': ['rate>0.90'],  // 90% should succeed even under saturation
    'graceful_degradation': ['rate>0.95'], // Should degrade gracefully
    'query_latency': ['p(99)<10000'], // Latency may spike but shouldn't timeout
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5173';

export default function() {
  // Simulate various database operations
  const operations = [
    { path: '/api/profile', method: 'GET' },
    { path: '/api/books', method: 'GET' },
    { path: '/api/books/random', method: 'GET' },
    { path: '/api/gamification/stats', method: 'GET' },
  ];
  
  const op = operations[Math.floor(Math.random() * operations.length)];
  
  const params = {
    headers: { 
      'Authorization': 'Bearer test-token',
    },
    timeout: '30s',
  };
  
  const start = Date.now();
  let res;
  
  if (op.method === 'GET') {
    res = http.get(\`\${BASE_URL}\${op.path}\`, params);
  }
  
  const latency = Date.now() - start;
  queryLatency.add(latency);
  
  // Check for success or graceful degradation
  const isSuccess = res.status === 200;
  const isGraceful = res.status === 200 || res.status === 429 || res.status === 503;
  
  querySuccess.add(isSuccess);
  gracefulDegradation.add(isGraceful);
  
  // Track connection pool behavior
  if (res.headers['X-Connection-Pooled'] === 'true') {
    connectionPooled.add(1);
  }
  
  if (res.status === 503 && res.body?.includes('connection')) {
    connectionRejected.add(1);
  }
  
  // Random think time
  sleep(Math.random() * 0.2);
}
`,
};

// ============================================================================
// TEST RUNNER UTILITIES
// ============================================================================

export interface TestResult {
  testName: string;
  passed: boolean;
  metrics: Record<string, number>;
  thresholdViolations: string[];
  duration: number;
  vusMax: number;
  requestsTotal: number;
  errorsTotal: number;
}

export interface ChaosExperiment {
  name: string;
  description: string;
  hypothesis: string;
  script: string;
  blastRadius: 'low' | 'medium' | 'high';
  rollbackProcedure: string;
}

export const CHAOS_EXPERIMENTS: ChaosExperiment[] = [
  {
    name: 'thundering_herd',
    description: 'Simulate 50,000 users logging in at exactly 9:00 AM',
    hypothesis: 'Supavisor connection pooling should queue connections, not crash',
    script: K6_SCRIPTS.thunderingHerd,
    blastRadius: 'medium',
    rollbackProcedure: 'Stop test immediately, connections will drain naturally',
  },
  {
    name: 'websocket_storm',
    description: 'Simulate 100,000 simultaneous WebSocket connections',
    hypothesis: 'Realtime gateway should handle fan-out without CPU starvation',
    script: K6_SCRIPTS.websocketStorm,
    blastRadius: 'high',
    rollbackProcedure: 'Kill k6 process, WebSocket server will close idle connections',
  },
  {
    name: 'book_generation_flood',
    description: 'Submit 100 book generation jobs per second for 10 minutes',
    hypothesis: 'BullMQ should queue jobs and rate-limit API calls',
    script: K6_SCRIPTS.bookGeneration,
    blastRadius: 'medium',
    rollbackProcedure: 'Stop test, clear Redis queue if needed',
  },
  {
    name: 'semantic_cache_validation',
    description: 'Verify semantic cache achieves 40%+ hit rate',
    hypothesis: 'Similar educational questions should hit cache',
    script: K6_SCRIPTS.semanticCache,
    blastRadius: 'low',
    rollbackProcedure: 'Stop test, no cleanup needed',
  },
  {
    name: 'connection_pool_saturation',
    description: 'Push connection pool to limits',
    hypothesis: 'System should degrade gracefully with 503 errors, not crash',
    script: K6_SCRIPTS.connectionPool,
    blastRadius: 'high',
    rollbackProcedure: 'Stop test immediately, monitor DB recovery',
  },
];

// ============================================================================
// HELPER TO WRITE K6 SCRIPTS TO FILES
// ============================================================================

export function getK6ScriptContent(experimentName: string): string | null {
  const experiment = CHAOS_EXPERIMENTS.find((e) => e.name === experimentName);
  return experiment?.script ?? null;
}

export function getAllK6Scripts(): Record<string, string> {
  return Object.fromEntries(CHAOS_EXPERIMENTS.map((e) => [e.name, e.script]));
}
