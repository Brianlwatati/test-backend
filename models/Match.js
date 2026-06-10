const mongoose = require("mongoose");

const matchSchema = new mongoose.Schema({
  match: {
    type: Number,
    required: true,
  },
  homeTeam: {
    type: String,
    required: true,
    trim: true,
  },
  awayTeam: {
    type: String,
    required: true,
    trim: true,
  },
  H: {
    type: Number,
    required: true,
  },
  D: {
    type: Number,
    required: true,
  },
  A: {
    type: Number,
    required: true,
  },
  outcome: {
    type: String,
    enum: ["H", "D", "A"],
    default: null,
    description: "Predicted or actual match outcome: H = home win, D = draw, A = away win",
  },
  homeScore: {
    type: Number,
    default: null,
    description: "Home team's final score",
  },
  awayScore: {
    type: Number,
    default: null,
    description: "Away team's final score",
  },
  resultDetails: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
    description: "Additional match result details (penalties, injury time, etc.)",
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model("Match", matchSchema);
