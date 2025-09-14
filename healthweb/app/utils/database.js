const { Sequelize } = require("sequelize");
const logger = require("./logger");

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

// Test database connection
sequelize.authenticate()
  .then(() => {
    logger.info("Database connection established successfully");
  })
  .catch((error) => {
    logger.error("Unable to connect to database:", error);
  });

module.exports = sequelize;
