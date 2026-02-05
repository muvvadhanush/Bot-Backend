const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Idea = sequelize.define("Idea", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    ideaId: {
        type: DataTypes.STRING
        // unique: true -- Disable to prevent ER_TOO_MANY_KEYS loop
    },
    connectionId: {
        type: DataTypes.STRING,
        allowNull: false
    },
    userId: {
        type: DataTypes.STRING,
        allowNull: true
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    impactedUsers: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    status: {
        type: DataTypes.STRING,
        defaultValue: "New"
    },
    // Phase 3: Idempotency & Audit
    idempotencyKey: {
        type: DataTypes.STRING,
        // unique: true -- Disable to prevent ER_TOO_MANY_KEYS loop
        allowNull: true
    },
    source: {
        type: DataTypes.STRING,
        defaultValue: "CHATBOT"
    },
    submittedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
});

module.exports = Idea;
