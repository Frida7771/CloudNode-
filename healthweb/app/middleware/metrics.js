const StatsD = require('node-statsd');
const AWS = require('aws-sdk');
const logger = require('../utils/logger');

// Initialize AWS CloudWatch
const cloudwatch = new AWS.CloudWatch({ 
  region: process.env.AWS_REGION || 'us-east-1' 
});

// Configure StatsD client
const statsd = new StatsD({
  host: process.env.STATSD_HOST || 'localhost',
  port: process.env.STATSD_PORT || 8125,
  prefix: 'healthweb.'
});

// Middleware to log API call count and response time
const apiMetricsMiddleware = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;

    // Send metrics to StatsD
    statsd.increment('requests.total');
    statsd.increment(`requests.${req.method.toLowerCase()}`);
    statsd.timing('response_time', duration);
    statsd.timing(`response_time.${req.method.toLowerCase()}`, duration);
    statsd.increment(`status.${res.statusCode}`);

    // Send metrics to CloudWatch
    cloudwatch.putMetricData({
      Namespace: 'Webapp/API',
      MetricData: [
        {
          MetricName: `${req.method}_${req.path}_count`,
          Dimensions: [
            { Name: 'API', Value: `${req.method}_${req.path}` }
          ],
          Value: 1,
          Unit: 'Count'
        },
        {
          MetricName: `${req.method}_${req.path}_response_time`,
          Dimensions: [
            { Name: 'API', Value: `${req.method}_${req.path}` }
          ],
          Value: duration,
          Unit: 'Milliseconds'
        }
      ]
    }).promise()
      .catch(err => logger.error("Error sending metrics to CloudWatch", err));

    // Log slow requests
    if (duration > 1000) {
      logger.warn(`Slow request detected: ${req.method} ${req.path} took ${duration}ms`);
    }
  });

  next();
};

// Middleware for database timing
const timeDatabaseQuery = (req, res, next) => {
  req.timeDatabase = async (queryFunc) => {
    const start = Date.now();
    try {
      const result = await queryFunc();
      const duration = Date.now() - start;

      // Send to StatsD
      statsd.timing('database.query_time', duration);

      // Send to CloudWatch
      cloudwatch.putMetricData({
        Namespace: 'Webapp/Database',
        MetricData: [
          {
            MetricName: 'query_response_time',
            Value: duration,
            Unit: 'Milliseconds'
          }
        ]
      }).promise()
        .catch(err => logger.error("Error sending database metrics", err));

      return result;
    } catch (error) {
      logger.error("Database query error:", error);
      throw error;
    }
  };
  next();
};

// Middleware for S3 timing
const timeS3Operation = (req, res, next) => {
  req.timeS3 = async (operation) => {
    const start = Date.now();
    try {
      const result = await operation;
      const duration = Date.now() - start;

      // Send to StatsD
      statsd.timing('s3.operation_time', duration);

      // Send to CloudWatch
      cloudwatch.putMetricData({
        Namespace: 'Webapp/S3',
        MetricData: [
          {
            MetricName: 's3_operation_response_time',
            Value: duration,
            Unit: 'Milliseconds'
          }
        ]
      }).promise()
        .catch(err => logger.error("Error sending S3 metrics", err));

      return result;
    } catch (error) {
      logger.error("S3 operation error:", error);
      throw error;
    }
  };
  next();
};

// Legacy metrics middleware for backward compatibility
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

module.exports = {
  apiMetricsMiddleware,
  timeDatabaseQuery,
  timeS3Operation,
  metrics // Legacy support
};
