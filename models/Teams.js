const mongoose = require("mongoose");
const teamSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
    country: {  
    type: String,
    required: false,
    trim: true,
    description: "Country of the team, optional but can be useful for filtering or display purposes",
    },
}, {
  timestamps: true,
});
module.exports = mongoose.model("Team", teamSchema);