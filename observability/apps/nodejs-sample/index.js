const express = require('express');
const { trace, context, metrics, SpanStatusCode } = require('@opentelemetry/api');
const { logs } = require('@opentelemetry/api-logs');
const pino = require('pino');

const app = express();
const port = process.env.PORT || 3000;

// Get OpenTelemetry logger
const otelLogger = logs.getLogger('nodejs-sample-app', '1.0.0');

// Create a custom Pino transport that also sends to OpenTelemetry
const pinoOtelTransport = {
  write: function transportWrite(msg) {
    try {
      const log = JSON.parse(msg);
      const severityMap = {
        10: 'TRACE',
        20: 'DEBUG', 
        30: 'INFO',
        40: 'WARN',
        50: 'ERROR',
        60: 'FATAL'
      };
      
      // Extract relevant attributes, exclude noisy fields
      const attributes = {
        'log.source': 'nodejs-app',
        'log.level': log.level
      };
      
      // Add optional structured fields if present
      if (log.method) attributes['http.method'] = log.method;
      if (log.path) attributes['http.path'] = log.path;
      if (log.status) attributes['http.status_code'] = log.status;
      if (log.duration) attributes['http.duration'] = log.duration;
      if (log.ip) attributes['client.ip'] = log.ip;
      if (log.error) attributes['error.message'] = log.error;
      
      otelLogger.emit({
        severityText: severityMap[log.level] || 'INFO',
        severityNumber: log.level,
        body: log.msg || JSON.stringify(log),
        attributes: attributes
      });
    } catch (e) {
      // If parsing fails, just send the raw message
      otelLogger.emit({
        severityText: 'INFO',
        body: msg,
        attributes: { 'log.source': 'nodejs-app' }
      });
    }
    // Also write to stdout for docker logs
    process.stdout.write(msg);
  }
};

// Create a logger
const logger = pino({
  level: 'info',
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
}, pinoOtelTransport);

// Get tracer and meter
const tracer = trace.getTracer('nodejs-sample-app', '1.0.0');
const meter = metrics.getMeter('nodejs-sample-app', '1.0.0');

// Create custom metrics
const requestCounter = meter.createCounter('http_requests_total', {
  description: 'Total number of HTTP requests',
});

const requestDuration = meter.createHistogram('http_request_duration_seconds', {
  description: 'HTTP request duration in seconds',
});

const activeRequests = meter.createUpDownCounter('http_requests_active', {
  description: 'Number of active HTTP requests',
});

// Middleware to log requests and add tracing context
app.use((req, res, next) => {
  const startTime = Date.now();
  activeRequests.add(1, { method: req.method, route: req.path });

  logger.info({
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  }, 'Incoming request');

  res.on('finish', () => {
    const duration = (Date.now() - startTime) / 1000;
    
    requestCounter.add(1, {
      method: req.method,
      route: req.path,
      status: res.statusCode,
    });

    requestDuration.record(duration, {
      method: req.method,
      route: req.path,
      status: res.statusCode,
    });

    activeRequests.add(-1, { method: req.method, route: req.path });

    logger.info({
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: duration,
    }, 'Request completed');
  });

  next();
});

// Routes
app.get('/', (req, res) => {
  const span = trace.getActiveSpan();
  if (span) {
    span.setAttribute('custom.attribute', 'home-page');
    span.addEvent('Processing home page request');
  }
  
  logger.info('Home page accessed');
  res.json({
    message: 'Welcome to Node.js OpenTelemetry Sample App',
    version: '1.0.0',
    endpoints: [
      'GET /',
      'GET /api/users',
      'GET /api/products',
      'GET /api/slow',
      'GET /api/error',
      'GET /health',
    ],
  });
});

app.get('/api/users', async (req, res) => {
  const span = tracer.startSpan('fetch-users');
  
  try {
    // Simulate async operation
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 100));
    
    const users = [
      { id: 1, name: 'Alice Johnson', email: 'alice@example.com' },
      { id: 2, name: 'Bob Smith', email: 'bob@example.com' },
      { id: 3, name: 'Charlie Davis', email: 'charlie@example.com' },
    ];

    span.setStatus({ code: SpanStatusCode.OK });
    span.setAttribute('users.count', users.length);
    span.addEvent('Users fetched successfully', { count: users.length });
    
    logger.info({ count: users.length }, 'Users fetched');
    res.json(users);
  } catch (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });
    span.recordException(error);
    logger.error({ error: error.message }, 'Error fetching users');
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    span.end();
  }
});

app.get('/api/products', async (req, res) => {
  const span = tracer.startSpan('fetch-products');
  
  try {
    // Simulate database query
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 150));
    
    const products = [
      { id: 1, name: 'Laptop', price: 999.99, stock: 15 },
      { id: 2, name: 'Mouse', price: 29.99, stock: 150 },
      { id: 3, name: 'Keyboard', price: 79.99, stock: 75 },
      { id: 4, name: 'Monitor', price: 299.99, stock: 25 },
    ];

    span.setAttribute('products.count', products.length);
    span.addEvent('Products fetched', { count: products.length });
    
    logger.info({ count: products.length }, 'Products fetched');
    res.json(products);
  } finally {
    span.end();
  }
});

app.get('/api/slow', async (req, res) => {
  const span = tracer.startSpan('slow-operation');
  span.setAttribute('operation.type', 'slow');
  
  logger.warn('Slow endpoint called');
  
  // Simulate slow operation
  await new Promise((resolve) => setTimeout(resolve, 2000 + Math.random() * 1000));
  
  span.addEvent('Slow operation completed');
  span.end();
  
  res.json({ message: 'This was a slow operation', duration: '2-3 seconds' });
});

app.get('/api/error', (req, res) => {
  const span = trace.getActiveSpan();
  
  const error = new Error('This is an intentional error for testing');
  
  if (span) {
    span.recordException(error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });
  }
  
  logger.error({ error: error.message, stack: error.stack }, 'Intentional error occurred');
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: error.message,
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((req, res) => {
  logger.warn({ path: req.path }, 'Route not found');
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  const span = trace.getActiveSpan();
  if (span) {
    span.recordException(err);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: err.message,
    });
  }
  
  logger.error({ error: err.message, stack: err.stack }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
  logger.info({ port }, 'Server started');
  console.log(`Node.js sample app listening on port ${port}`);
});
