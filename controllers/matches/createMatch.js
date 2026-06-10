const Match = require("../../models/Match");
const Team = require("../../models/Teams");
const { predictBatch } = require("./virtualPredictor");
const { enhancePredictions } = require("./predictb");
const { predictBatchMomentum } = require("./predictc");

const addTeamIfNotExists = async (teamName) => {
    let teamDoc = await Team.findOne({ name: teamName });
    if (!teamDoc) {
        teamDoc = new Team({ name: teamName });
        await teamDoc.save();
    }
    return teamDoc._id; // Return the team ID
};

exports.createMatch = async (req, res) => {
    try {
        const payload = req.body;
        const fixtures = Array.isArray(payload) ? payload : [payload];

        if (fixtures.length === 0) {
            return res.status(400).json({ message: "Request body must contain one or more matches" });
        }

        const simplified = fixtures[0].data.map((fixture, index) => ({
            match: fixture.parentMatchId,
            homeTeam: fixture.homeTeam,
            awayTeam: fixture.awayTeam,
            H: fixture.markets?.[0]?.outcomes?.find(o => o.outcomeKey === "1")?.oddValue,
            D: fixture.markets?.[0]?.outcomes?.find(o => o.outcomeKey === "X")?.oddValue,
            A: fixture.markets?.[0]?.outcomes?.find(o => o.outcomeKey === "2")?.oddValue,
            homeRating: fixture.homeRating,
            awayRating: fixture.awayRating,
        }));


        // Check if team exists and create if not
        for (const matchData of simplified) {
            const { homeTeam, awayTeam } = matchData;
            matchData.homeTeam = await addTeamIfNotExists(homeTeam);
            matchData.awayTeam = await addTeamIfNotExists(awayTeam);
        }


        const predictionInput = simplified.map(match => ({
            ...match,
            homeTeam: fixtures[0].data[match.match - 1].homeTeam,
            awayTeam: fixtures[0].data[match.match - 1].awayTeam,
        }));

        const matches = await Match.insertMany(simplified);
        const predictions = predictBatch(predictionInput);
        const simplifiedprediction = predictions.map((prediction, index) => ({
            [`match${index + 1}`]: prediction.outcome,
        }));
        const enhancedResults = enhancePredictions(simplifiedprediction, predictionInput);
        const momentumResults = predictBatchMomentum(predictionInput);

        return res.status(201).json({
            matches: matches.length,
            simplifiedprediction,
            predictions: {
                virtualPredictor: predictions,
                enhanced: enhancedResults,
                momentum: momentumResults,
            },
        });
     
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.updateMatchResult = async (req, res) => {
    try {
        const { parentId, outcome, homeScore, awayScore, resultDetails } = req.body;

        if (!parentId) {
            return res.status(400).json({ message: "parentId is required" });
        }

        if (!outcome || !["H", "D", "A"].includes(outcome)) {
            return res.status(400).json({ message: "outcome must be H (home), D (draw), or A (away)" });
        }

        const updatePayload = { outcome };
        if (homeScore !== undefined) updatePayload.homeScore = homeScore;
        if (awayScore !== undefined) updatePayload.awayScore = awayScore;
        if (resultDetails) updatePayload.resultDetails = resultDetails;

        const updatedMatch = await Match.findOneAndUpdate(
            { match: parentId },
            updatePayload,
            { new: true, runValidators: true }
        );

        if (!updatedMatch) {
            return res.status(404).json({ message: `Match with parentId ${parentId} not found` });
        }

        return res.status(200).json({
            message: "Match result updated successfully",
            match: updatedMatch,
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.updateMatchResultBatch = async (req, res) => {
    try {
        const { results } = req.body;

        if (!Array.isArray(results) || results.length === 0) {
            return res.status(400).json({ message: "results must be a non-empty array" });
        }

        const updated = [];
        const failed = [];

        for (const result of results) {
            const { parentId, outcome, homeScore, awayScore, resultDetails } = result;

            if (!parentId || !outcome) {
                failed.push({ parentId, reason: "Missing parentId or outcome" });
                continue;
            }

            try {
                const updatePayload = { outcome };
                if (homeScore !== undefined) updatePayload.homeScore = homeScore;
                if (awayScore !== undefined) updatePayload.awayScore = awayScore;
                if (resultDetails) updatePayload.resultDetails = resultDetails;

                const updatedMatch = await Match.findOneAndUpdate(
                    { match: parentId },
                    updatePayload,
                    { new: true, runValidators: true }
                );

                if (updatedMatch) {
                    updated.push(updatedMatch);
                } else {
                    failed.push({ parentId, reason: "Match not found" });
                }
            } catch (err) {
                failed.push({ parentId, reason: err.message });
            }
        }

        return res.status(200).json({
            updated: updated.length,
            failed: failed.length,
            updatedMatches: updated,
            failedResults: failed,
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};


