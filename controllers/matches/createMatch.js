const Match = require("../../models/Match");
const Team = require("../../models/Teams");
const { randomUUID } = require("crypto");
const { predictBatch } = require("./virtualPredictor");
const { enhancePredictions } = require("./predictb");
const { predictBatchMomentum } = require("./predictc");
const { predictBatchWithHistory } = require("./predicthhh");

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
            return res.status(400).json({
                message: "Request body must contain one or more matches",
            });
        }

        // Get the latest matchday and increment it
        const lastMatch = await Match.findOne()
            .sort({ matchday: -1 })
            .limit(1);

        const currentMatchday = lastMatch ? lastMatch.matchday : 0;
        const newMatchday = currentMatchday + 1;

        // Transform incoming fixtures
        const simplified = fixtures[0].data.map((fixture) => ({
            match: fixture.parentMatchId,
            matchday: newMatchday,
            homeTeam: fixture.homeTeam,
            awayTeam: fixture.awayTeam,
            H: fixture.markets?.[0]?.outcomes?.find(
                (o) => o.outcomeKey === "1"
            )?.oddValue,
            D: fixture.markets?.[0]?.outcomes?.find(
                (o) => o.outcomeKey === "X"
            )?.oddValue,
            A: fixture.markets?.[0]?.outcomes?.find(
                (o) => o.outcomeKey === "2"
            )?.oddValue,
            homeRating: fixture.homeRating,
            awayRating: fixture.awayRating,
        }));

        // Ensure teams exist
        for (const matchData of simplified) {
            await addTeamIfNotExists(matchData.homeTeam);
            await addTeamIfNotExists(matchData.awayTeam);
        }

        // Prepare prediction input
        const predictionInput = simplified.map((match) => ({
            ...match,
            predictionId: randomUUID(),
        }));

        // Save matches
        const matches = await Match.insertMany(simplified);

        // Generate predictions
        const predictions = predictBatch(predictionInput);

        const simplifiedPrediction = predictions.map((prediction, index) => ({
            [`match${index + 1}`]: prediction.outcome,
        }));

        const enhancedResults = enhancePredictions(
            simplifiedPrediction,
            predictionInput
        );

        const momentumResults =
            predictBatchMomentum(predictionInput);

        const momentumHistoryResults =
            await predictBatchWithHistory(predictionInput);

        // Format response
        const teams = simplified.map((match, index) => ({
            match: index + 1,
            matchId: match.match,
            fixture: `${match.homeTeam} vs ${match.awayTeam}`,
            homeTeam: match.homeTeam,
            awayTeam: match.awayTeam,
            odds: {
                home: match.H,
                draw: match.D,
                away: match.A,
            },
            predictions: {
                prediction1: predictions[index]?.outcome ?? null,
                prediction2:
                    enhancedResults[`match${index + 1}`] ?? null,
                prediction3:
                    momentumResults[index]?.outcome ?? null,
                prediction4:
                    momentumHistoryResults[index]?.outcome ?? null,
            },
        }));

        return res.status(201).json({
            totalFixtures: matches.length,
            matchday: newMatchday,
            teams,
        });
    } catch (error) {
        return res.status(400).json({
            message: error.message,
        });
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
        const { data } = req.body;
        const results = data.data.results.English;

        if (!Array.isArray(results) || results.length === 0) {
            return res.status(400).json({ message: "results must be a non-empty array" });
        }

        const updated = [];
        const failed = [];

        for (const resMatch of results) {
            const { parentMatchId,  result, resultDetails } = resMatch;

            if (!parentMatchId || !result) {
                failed.push({ parentMatchId, reason: "Missing parentId or outcome" });
                continue;
            }


            try {
                const updatePayload = {  result };
                updatePayload.outcome = result.split("-")[0].trim() > result.split("-")[1].trim() ? "H" : result.split("-")[0].trim() < result.split("-")[1].trim() ? "A" : "D";
                updatePayload.homeScore = result.split("-")[0].trim();
                updatePayload.awayScore = result.split("-")[1].trim();
                updatePayload.resultDetails = result;

                const updatedMatch = await Match.findOneAndUpdate(
                    { match: parentMatchId },
                    updatePayload,
                    { new: true, runValidators: true }
                );

                if (updatedMatch) {
                    updated.push(updatedMatch);
                } else {
                    failed.push({ parentMatchId, reason: "Match not found" });
                }
            } catch (err) {
                failed.push({ parentMatchId, reason: err.message });
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


