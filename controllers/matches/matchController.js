const Match = require("../../models/Match");



exports.getMatches = async (req, res) => {
  try {
    const matches = await Match.find();
    res.json(matches);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getMatchById = async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) {
      return res.status(404).json({ message: "Match not found" });
    }
    res.json(match);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateMatch = async (req, res) => {
  try {
    const { match, homeTeam, awayTeam, H, D, A, outcome } = req.body;
    const updatedMatch = await Match.findByIdAndUpdate(
      req.params.id,
      { match, homeTeam, awayTeam, H, D, A, outcome },
      { new: true, runValidators: true }
    );

    if (!updatedMatch) {
      return res.status(404).json({ message: "Match not found" });
    }

    res.json(updatedMatch);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteMatch = async (req, res) => {
  try {
    const deletedMatch = await Match.findByIdAndDelete(req.params.id);
    if (!deletedMatch) {
      return res.status(404).json({ message: "Match not found" });
    }
    res.json({ message: "Match deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


