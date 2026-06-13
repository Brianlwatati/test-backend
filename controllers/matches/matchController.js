const Match = require("../../models/Match");



exports.getMatches = async (req, res) => {
  try {
    const matches = await Match.find();
    res.json(matches);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getMatchTable = async (req, res) => {
  try {
    const matches = await Match.find()
    // Analyze the matches to create a table of teams with their recent form and momentum
    // This is a placeholder for the actual analysis logic
    const teamStats = {};
    matches.forEach(match => {
      const { homeTeam, awayTeam, outcome } = match;
      if (!teamStats[homeTeam]) teamStats[homeTeam] = { recentForm: [], momentum: 0 };
      if (!teamStats[awayTeam]) teamStats[awayTeam] = { recentForm: [], momentum: 0 };    
    });
    res.json(teamStats);
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

exports.getTeamMatchResultsByMatchday = async (req, res) => {
  try {
    // Get all unique teams from matches
    const allMatches = await Match.find().sort({ matchday: 1 });

    if (allMatches.length === 0) {
      return res.status(404).json({ message: "No matches found" });
    }

    // Extract unique team names
    const teamsSet = new Set();
    allMatches.forEach(match => {
      teamsSet.add(match.homeTeam);
      teamsSet.add(match.awayTeam);
    });
    const teams = Array.from(teamsSet).sort();

    // Get max matchday
    const maxMatchday = Math.max(...allMatches.map(m => m.matchday));
    
    // Calculate the range for last 5 matchdays
    const minMatchday = Math.max(1, maxMatchday - 4);

    // Build results for each team
    const teamResults = [];

    for (const teamName of teams) {
      const teamMatches = allMatches.filter(match =>
        (match.homeTeam === teamName || match.awayTeam === teamName) &&
        match.matchday >= minMatchday
      );

      if (teamMatches.length === 0) continue;

      // Group by matchday
      const matchesByMatchday = {};
      for (let i = minMatchday; i <= maxMatchday; i++) {
        matchesByMatchday[i] = [];
      }

      teamMatches.forEach(match => {
        if (!matchesByMatchday[match.matchday]) {
          matchesByMatchday[match.matchday] = [];
        }
        matchesByMatchday[match.matchday].push(match);
      });

      // Format results
      const results = {};
      Object.keys(matchesByMatchday).forEach(matchday => {
        const matchdayResults = [];
        matchesByMatchday[matchday].forEach(match => {
          let result = "";
          
          if (match.homeTeam === teamName) {
            if (match.outcome === "H") {
              result = `Win: ${match.homeScore} - ${match.awayScore}`;
            } else if (match.outcome === "A") {
              result = `Lost: ${match.homeScore} - ${match.awayScore}`;
            } else if (match.outcome === "D") {
              result = `Draw: ${match.homeScore} - ${match.awayScore}`;
            }
          } else {
            if (match.outcome === "A") {
              result = `Win: ${match.awayScore} - ${match.homeScore}`;
            } else if (match.outcome === "H") {
              result = `Lost: ${match.awayScore} - ${match.homeScore}`;
            } else if (match.outcome === "D") {
              result = `Draw: ${match.awayScore} - ${match.homeScore}`;
            }
          }

          if (result) {
            matchdayResults.push(result);
          }
        });
        if (matchdayResults.length > 0) {
          results[`Matchday ${matchday}`] = matchdayResults;
        }
      });

      teamResults.push({
        team: teamName,
        results,
        totalMatches: teamMatches.length
      });
    }

    res.json({
      totalTeams: teamResults.length,
      matchdayRange: `${minMatchday} - ${maxMatchday}`,
      teams: teamResults
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


