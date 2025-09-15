const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const EmailLog = sequelize.define("EmailLog", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    token: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    email_sent_time: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    email_verified_time: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: "email_logs",
    timestamps: false, // CloudNode uses email_sent_time and email_verified_time instead
  });

  return EmailLog;
};
