const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const ChatSession = sequelize.define("ChatSession", {
  sessionId: {
    type: DataTypes.STRING,
    allowNull: false
  },

  connectionId: {
    type: DataTypes.STRING,
    allowNull: false
  },

  messages: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: []
  },

  // State Machine Tracking
  currentStep: {
    type: DataTypes.ENUM('NONE', 'TITLE', 'DESCRIPTION', 'IMPACT', 'CONFIRM', 'SUBMITTED'),
    allowNull: false,
    defaultValue: 'NONE'
  },

  tempData: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {}
  },

  mode: {
    type: DataTypes.ENUM('FREE_CHAT', 'GUIDED_FLOW'),
    defaultValue: 'FREE_CHAT'
  }
});

module.exports = ChatSession;
