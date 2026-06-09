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
}, {
  timestamps: true,
});

module.exports = mongoose.model("Match", matchSchema);
