const { Sequelize } = require("sequelize");

const sequelize = new Sequelize(
  process.env.DB_NAME || process.env.database,
  process.env.DB_USER || process.env.user,
  process.env.DB_PASSWORD || process.env.password,
  {
    host: process.env.DB_HOST || process.env.db_host || "localhost",
    dialect: "postgres",
    port: process.env.DB_PORT || process.env.port || 5432,
    logging: false,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    }
  }
);

module.exports = sequelize;
