/**
 * k6 Load Test: User Journey Simulation
 *
 * Simulates realistic user behavior through the full app flow:
 * 1. Login
 * 2. Browse library
 * 3. Start book generation
 * 4. Poll for completion
 * 5. View completed book
 *
 * Run with: k6 run loadtest/user-journey.js
 */

import { check, sleep } from 'k6';
import http from 'k6/http';
import { Counter, Rate, Trend } from 'k6/metrics';

// ============================================================================
// CUSTOM METRICS
// ============================================================================

const loginTime = new Trend('login_time');
const libraryLoadTime = new Trend('library_load_time');
const generationQueueTime = new Trend('generation_queue_time');
const generationCompleteTime = new Trend('generation_complete_time');
const errorRate = new Rate('errors');
const completedJourneys = new Counter('completed_journeys');

// ============================================================================
// TEST OPTIONS
// ============================================================================

export const options = {
  stages: [
    { duration: '2m', target: 10 }, // Ramp up to 10 users
    { duration: '5m', target: 10 }, // Stay at 10 users
    { duration: '2m', target: 25 }, // Ramp up to 25 users
    { duration: '5m', target: 25 }, // Stay at 25 users
    { duration: '2m', target: 50 }, // Ramp up to 50 users
    { duration: '5m', target: 50 }, // Stay at 50 users
    { duration: '3m', target: 0 }, // Ramp down
  ],
  thresholds: {
    login_time: ['p(95)<2000'], // Login under 2s
    library_load_time: ['p(95)<3000'], // Library loads under 3s
    generation_queue_time: ['p(95)<1000'], // Queue response under 1s
    errors: ['rate<0.05'], // Error rate <5%
  },
};

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_URL = __ENV.API_URL || 'http://localhost:5173';
const TEST_USER_PREFIX = 'loadtest_user_';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getTestUserCredentials(vuId) {
  return {
    email: `${TEST_USER_PREFIX}${vuId}@test.com`,
    password: 'TestPassword123!',
  };
}

function parseJsonSafe(body) {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

// ============================================================================
// MAIN USER JOURNEY
// ============================================================================

export default function () {
  const credentials = getTestUserCredentials(__VU);
  let token = null;

  // ========================================
  // STEP 1: Login
  // ========================================
  const loginStart = Date.now();

  const loginResponse = http.post(`${API_URL}/api/auth/login`, JSON.stringify(credentials), {
    headers: { 'Content-Type': 'application/json' },
  });

  loginTime.add(Date.now() - loginStart);

  const loginSuccess = check(loginResponse, {
    'login successful': (r) => r.status === 200,
    'has access token': (r) => {
      const body = parseJsonSafe(r.body);
      if (body && body.access_token) {
        token = body.access_token;
        return true;
      }
      return false;
    },
  });

  if (!loginSuccess) {
    errorRate.add(1);
    console.log(`Login failed for ${credentials.email}: ${loginResponse.status}`);
    return; // Exit journey
  }

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // Simulate reading the login response
  sleep(1);

  // ========================================
  // STEP 2: Browse Library
  // ========================================
  const libraryStart = Date.now();

  const libraryResponse = http.get(`${API_URL}/api/books`, { headers: authHeaders });

  libraryLoadTime.add(Date.now() - libraryStart);

  const librarySuccess = check(libraryResponse, {
    'library loads': (r) => r.status === 200,
    'returns book array': (r) => {
      const body = parseJsonSafe(r.body);
      return Array.isArray(body?.books) || Array.isArray(body);
    },
  });

  if (!librarySuccess) {
    errorRate.add(1);
    console.log(`Library load failed: ${libraryResponse.status}`);
  }

  // Simulate browsing
  sleep(Math.random() * 3 + 2); // 2-5 seconds

  // ========================================
  // STEP 3: Start Book Generation
  // ========================================
  const queueStart = Date.now();

  const generateResponse = http.post(
    `${API_URL}/api/books/generate`,
    JSON.stringify({
      title: `Load Test Book ${__VU}-${__ITER}`,
      chapterCount: 3,
      targetAge: 8,
      imageStyle: 'watercolor',
    }),
    { headers: authHeaders }
  );

  generationQueueTime.add(Date.now() - queueStart);

  let jobId = null;
  const queueSuccess = check(generateResponse, {
    'generation queued': (r) => r.status === 200 || r.status === 202,
    'has job ID': (r) => {
      const body = parseJsonSafe(r.body);
      if (body && (body.jobId || body.bookId)) {
        jobId = body.jobId || body.bookId;
        return true;
      }
      return false;
    },
  });

  if (!queueSuccess) {
    errorRate.add(1);
    console.log(`Generation queue failed: ${generateResponse.status}`);
    return;
  }

  // ========================================
  // STEP 4: Poll for Completion
  // ========================================
  const pollStart = Date.now();
  const maxPollTime = 120000; // 2 minutes max
  const pollInterval = 3000; // Poll every 3 seconds

  let completed = false;
  let bookId = null;

  while (Date.now() - pollStart < maxPollTime && !completed) {
    sleep(pollInterval / 1000);

    const pollResponse = http.get(`${API_URL}/api/jobs/${jobId}`, { headers: authHeaders });

    if (pollResponse.status === 200) {
      const body = parseJsonSafe(pollResponse.body);

      if (body?.status === 'completed' || body?.state === 'completed') {
        completed = true;
        bookId = body?.result?.bookId || body?.bookId;
      } else if (body?.status === 'failed' || body?.state === 'failed') {
        console.log(`Generation failed: ${body?.error}`);
        errorRate.add(1);
        break;
      }

      // Log progress
      if (body?.progress) {
        console.log(`Job ${jobId}: ${body.progress}%`);
      }
    }
  }

  generationCompleteTime.add(Date.now() - pollStart);

  if (!completed) {
    console.log(`Generation timeout for job ${jobId}`);
    errorRate.add(1);
    return;
  }

  // ========================================
  // STEP 5: View Completed Book
  // ========================================
  if (bookId) {
    const viewResponse = http.get(`${API_URL}/api/books/${bookId}`, { headers: authHeaders });

    const viewSuccess = check(viewResponse, {
      'book loads': (r) => r.status === 200,
      'has book data': (r) => {
        const body = parseJsonSafe(r.body);
        return body?.title !== undefined;
      },
    });

    if (!viewSuccess) {
      errorRate.add(1);
      console.log(`Book view failed: ${viewResponse.status}`);
    }
  }

  // Journey completed!
  completedJourneys.add(1);

  // Simulate user reading/reviewing the book
  sleep(Math.random() * 10 + 5); // 5-15 seconds
}

// ============================================================================
// SETUP
// ============================================================================

export function setup() {
  console.log('='.repeat(60));
  console.log('User Journey Load Test');
  console.log('='.repeat(60));
  console.log(`API URL: ${API_URL}`);
  console.log('');

  // Check API health
  const healthResponse = http.get(`${API_URL}/health`);
  if (healthResponse.status !== 200) {
    console.warn('⚠️  Health check failed - API may not be running');
  } else {
    console.log('✅ API is healthy');
  }

  console.log('');
  console.log('Starting load test...');
  console.log('');

  return { startTime: Date.now() };
}

// ============================================================================
// TEARDOWN
// ============================================================================

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;

  console.log('');
  console.log('='.repeat(60));
  console.log('Test Summary');
  console.log('='.repeat(60));
  console.log(`Total duration: ${duration.toFixed(2)} seconds`);
  console.log('');
}
