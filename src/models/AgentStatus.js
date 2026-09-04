const mongoose = require("mongoose");

const agentStatusSchema = new mongoose.Schema(
  {
    agentId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    status: {
      type: String,
      enum: ["online", "offline"],
      default: "offline"
    },

    lastSeen: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

const AgentStatus = mongoose.model(
  "AgentStatus",
  agentStatusSchema
);

module.exports = AgentStatus;