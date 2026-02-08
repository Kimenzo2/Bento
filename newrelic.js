/**
 * New Relic Agent Configuration
 * Genesis Application Performance Monitoring
 *
 * All configuration options: https://docs.newrelic.com/docs/apm/agents/nodejs-agent/installation-configuration/nodejs-agent-configuration/
 */

exports.config = {
  /**
   * Application name shown in New Relic dashboard
   */
  app_name: [process.env.NEW_RELIC_APP_NAME || 'Genesis'],

  /**
   * License key from New Relic account
   */
  license_key: process.env.NEW_RELIC_LICENSE_KEY || 'license_key_here',

  /**
   * Logging configuration
   */
  logging: {
    level: process.env.NEW_RELIC_LOG_LEVEL || 'info',
    filepath: 'stdout',
    enabled: true,
  },

  /**
   * Distributed tracing for microservices
   */
  distributed_tracing: {
    enabled: process.env.NEW_RELIC_DISTRIBUTED_TRACING_ENABLED === 'true',
  },

  /**
   * AI Monitoring (for LLM/AI integrations)
   */
  ai_monitoring: {
    enabled: process.env.NEW_RELIC_AI_MONITORING_ENABLED === 'true',
    streaming: {
      enabled: true,
    },
  },

  /**
   * Transaction tracing
   */
  transaction_tracer: {
    enabled: true,
    transaction_threshold: 'apdex_f',
    record_sql: 'obfuscated',
    explain_threshold: 500,
  },

  /**
   * Error collection
   */
  error_collector: {
    enabled: true,
    ignore_status_codes: [404],
    capture_events: true,
    max_event_samples_stored: 100,
  },

  /**
   * Span events for distributed tracing
   */
  span_events: {
    enabled: true,
    max_samples_stored: Number.parseInt(
      process.env.NEW_RELIC_SPAN_EVENTS_MAX_SAMPLES_STORED || '10000',
      10
    ),
  },

  /**
   * Custom events/insights
   */
  custom_insights_events: {
    enabled: true,
    max_samples_stored: Number.parseInt(
      process.env.NEW_RELIC_CUSTOM_INSIGHTS_EVENTS_MAX_SAMPLES_STORED || '100000',
      10
    ),
  },

  /**
   * Browser monitoring (Real User Monitoring)
   */
  browser_monitoring: {
    enable: true,
    debug: false,
  },

  /**
   * Application logging
   */
  application_logging: {
    enabled: true,
    forwarding: {
      enabled: true,
      max_samples_stored: 10000,
    },
    metrics: {
      enabled: true,
    },
    local_decorating: {
      enabled: false,
    },
  },

  /**
   * Slow SQL tracking
   */
  slow_sql: {
    enabled: true,
    max_samples: 10,
  },

  /**
   * Security settings
   */
  security: {
    enabled: false, // Enable for IAST (Interactive Application Security Testing)
  },

  /**
   * Attributes to include/exclude
   */
  attributes: {
    enabled: true,
    include: [
      'request.headers.host',
      'request.headers.user-agent',
      'request.method',
      'request.uri',
      'response.status',
    ],
    exclude: [
      'request.headers.cookie',
      'request.headers.authorization',
      'request.headers.x-api-key',
    ],
  },

  /**
   * Rules for ignoring/grouping transactions
   */
  rules: {
    ignore: ['^/health$', '^/favicon.ico$', '^/_next/static/', '^/assets/'],
    name: [],
  },

  /**
   * EU datacenter (based on license key prefix 'eu01')
   */
  host: 'collector.eu01.nr-data.net',
};
