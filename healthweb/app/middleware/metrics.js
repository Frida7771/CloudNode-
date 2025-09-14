const StatsD = require('node-statsd');
const logger = require('../utils/logger');

// Configure StatsD client
const statsd = new StatsD({
  host: process.env.STATSD_HOST || 'localhost',
  port: process.env.STATSD_PORT || 8125,
  prefix: 'healthweb.'
});

const metrics = (req, res, next) => {
  const startTime = Date.now();

  // Increment request counter
  statsd.increment('requests.total');
  statsd.increment(`requests.${req.method.toLowerCase()}`);

  // Override res.end to capture response time
  const originalEnd = res.end;
  res.end = function(...args) {
    const duration = Date.now() - startTime;
    
    // Send timing metrics
    statsd.timing('response_time', duration);
    statsd.timing(`response_time.${req.method.toLowerCase()}`, duration);
    
    // Send status code metrics
    statsd.increment(`status.${res.statusCode}`);
    
    // Log slow requests
    if (duration > 1000) {
      logger.warn(`Slow request detected: ${req.method} ${req.path} took ${duration}ms`);
    }

    // Call original end method
    originalEnd.apply(this, args);
  };

  next();
};

module.exports = metrics;
