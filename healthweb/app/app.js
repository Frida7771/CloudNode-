require("dotenv").config();
const express = require("express");
const app = express();
const port = process.env.PORT || 3000;
const { Sequelize } = require("sequelize");
const userRoutes = require("./routes/user");
const imageRoutes = require("./routes/image");
const AWS = require("aws-sdk");
const { metrics } = require("./middleware/metrics");
const logger = require("./utils/logger");

// AWS Configuration
AWS.config.update({
  region: process.env.AWS_REGION || "us-east-1",
});

const sns = new AWS.SNS();

// Database Configuration
const sequelize = new Sequelize(
  process.env.DB_DATABASE,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: "postgres",
    logging: (msg) => logger.info(msg),
    dialectOptions: {
      ssl: process.env.NODE_ENV === 'production' ? {
        require: true,
        rejectUnauthorized: false,
      } : false,
    },
  }
);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(metrics);

// Sync models
sequelize
  .sync()
  .then(() => {
    console.log("✅ Database synced");
    logger.info("Database synced successfully");
  })
  .catch((error) => {
    console.error("❌ Error syncing database:", error);
    logger.error("Database sync failed:", error);
  });

// Routes
app.get("/", (req, res) => {
  console.log("🎯 Hit / route");
  logger.info("Home route accessed");
  res.status(200).json({
    message: "✅ Hello! Your Node.js app is working!",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

app.get("/health", (req, res) => {
  logger.info("Health check endpoint accessed");
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API Routes
app.use("/api/users", userRoutes(sequelize));
app.use("/api/images", imageRoutes(sequelize));

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error("Unhandled error:", err);
  res.status(500).json({
    error: "Internal Server Error",
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  logger.warn(`404 - Route not found: ${req.method} ${req.path}`);
  res.status(404).json({
    error: "Not Found",
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  logger.info(`Server started on port ${port}`);
});

module.exports = app;
