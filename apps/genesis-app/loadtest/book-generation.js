/**
 * k6 Load Test: Book Generation API
 *
 * Tests the book generation endpoint under load.
 *
 * Run with: k6 run loadtest/book-generation.js
 *
 * Options:
 *   --env API_URL=https://your-api.com
 *   --env API_TOKEN=your-token
 */

import { check, sleep } from 'k6';
import http from 'k6/http';
import { Counter, Rate, Trend } from 'k6/metrics';

// ============================================================================
// CUSTOM METRICS
// ============================================================================

const errorRate = new Rate('errors');
const bookGenerationTime = new Trend('book_generation_time');
const successfulGenerations = new Counter('successful_generations');
const failedGenerations = new Counter('failed_generations');

// ============================================================================
// TEST OPTIONS
// ============================================================================

export const options = {
  stages: [
    { duration: '1m', target: 5 }, // Ramp up to 5 users
    { duration: '3m', target: 5 }, // Stay at 5 users
    { duration: '1m', target: 10 }, // Ramp up to 10 users
    { duration: '3m', target: 10 }, // Stay at 10 users
    { duration: '1m', target: 20 }, // Ramp up to 20 users
    { duration: '3m', target: 20 }, // Stay at 20 users
    { duration: '2m', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<30000'], // 95% of requests under 30s (book gen is slow)
    errors: ['rate<0.1'], // Error rate <10%
    book_generation_time: ['p(95)<60000'], // 95% under 60s
  },
};

// ============================================================================
// TEST DATA
// ============================================================================

const bookTitles = [
  'The Amazing Adventures of Space Cat',
  'Learning Numbers with Dinosaurs',
  'The Magic Forest Mystery',
  'Ocean Friends Go to School',
  'The Brave Little Robot',
];

const imageStyles = ['watercolor', 'cartoon', 'storybook', 'digital_art', 'pencil_sketch'];

const ageGroups = [4, 6, 8, 10, 12];

function getRandomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ============================================================================
// MAIN TEST
// ============================================================================

export default function () {
  const apiUrl = __ENV.API_URL || 'http://localhost:5173';
  const apiToken = __ENV.API_TOKEN || 'test-token';

  // Generate random book parameters
  const payload = JSON.stringify({
    title: `${getRandomElement(bookTitles)} ${__VU}-${__ITER}`,
    chapterCount: Math.floor(Math.random() * 3) + 3, // 3-5 chapters
    targetAge: getRandomElement(ageGroups),
    imageStyle: getRandomElement(imageStyles),
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiToken}`,
    },
    timeout: '120s', // Book generation can take a while
  };

  // Start timer
  const startTime = Date.now();

  // Make request
  const response = http.post(`${apiUrl}/api/books/generate`, payload, params);

  // Calculate duration
  const duration = Date.now() - startTime;
  bookGenerationTime.add(duration);

  // Check response
  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'has bookId': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.bookId !== undefined || body.jobId !== undefined;
      } catch {
        return false;
      }
    },
    'response time OK': (r) => r.timings.duration < 30000,
  });

  // Record metrics
  if (success) {
    successfulGenerations.add(1);
  } else {
    failedGenerations.add(1);
  }
  errorRate.add(!success);

  // Log failures
  if (!success) {
    console.log(`Failed request: ${response.status} - ${response.body}`);
  }

  // Think time between requests (simulate real user behavior)
  sleep(Math.random() * 10 + 5); // 5-15 seconds
}

// ============================================================================
// SETUP (Optional - runs once before tests)
// ============================================================================

export function setup() {
  console.log('Starting book generation load test...');
  console.log(`API URL: ${__ENV.API_URL || 'http://localhost:5173'}`);

  // Verify API is accessible
  const response = http.get(`${__ENV.API_URL || 'http://localhost:5173'}/health`);
  if (response.status !== 200) {
    console.warn('Health check failed - API may not be running');
  }

  return { startTime: Date.now() };
}

// ============================================================================
// TEARDOWN (Optional - runs once after tests)
// ============================================================================

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`Test completed in ${duration.toFixed(2)} seconds`);
}
