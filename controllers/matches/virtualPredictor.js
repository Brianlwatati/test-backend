const fs = require('fs');

// Default configuration values for the virtual match predictor.
// These values are used when no custom settings are provided.
// - homeAdvantage: how much extra probability the home team receives.
// - ratingWeight: how strongly relative team ratings influence the prediction.
// - drawTendency: how much draws are preserved as a separate outcome.
// - randomness: additional random noise to avoid deterministic outcomes.
// - simulationRuns: default number of Monte Carlo runs for a simulated distribution.
const DEFAULT_SETTINGS = {
  homeAdvantage: 0.08,
  ratingWeight: 0.12,
  drawTendency: 0.03,
  randomness: 0.08,
  simulationRuns: 500,
};

// Convert any input into a finite number, or return a fallback value.
// This avoids NaN or Infinity from invalid data and keeps probability math stable.
function safeNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

// Convert decimal odds into implied probabilities.
// The input object should contain H (home), D (draw), and A (away) odds.
// The inverse of odds gives a raw probability estimate, which is then normalized
// so that the final probabilities sum to 1. If input is invalid, each outcome
// defaults to an equal probability of 1/3.
function impliedProbabilities({ H, D, A }) {
  const h = safeNumber(H, 1);
  const d = safeNumber(D, 1);
  const a = safeNumber(A, 1);

  // Raw probabilities from odds: probability = 1 / odds.
  const raw = [1 / h, 1 / d, 1 / a];
  const sum = raw.reduce((total, x) => total + x, 0);

  // Normalize so the three probabilities add to 1.
  return raw.map((x) => (sum > 0 ? x / sum : 1 / 3));
}

// Adjust the base odds-derived probabilities using relative team ratings.
// If the home team has a higher rating than the away team, the home win
// probability is increased and the away win probability is decreased.
// The draw probability is also nudged upwards by a fixed draw tendency.
function applyRatingAdjustment(baseProbs, { homeRating = 50, awayRating = 50 }, settings) {
  const ratingDelta = safeNumber(homeRating, 50) - safeNumber(awayRating, 50);

  // Use tanh to keep rating impact bounded between -1 and +1.
  // A positive ratingDelta favors the home team.
  const ratingFactor = Math.tanh(ratingDelta / 100) * settings.ratingWeight;

  // Apply adjustments to each outcome:
  // - home wins get boosted by ratingFactor
  // - draw keeps a small fixed bump to preserve its probability
  // - away wins are reduced by ratingFactor
  const adjustment = [1 + ratingFactor, 1 + settings.drawTendency, 1 - ratingFactor];
  const boosted = baseProbs.map((prob, idx) => prob * adjustment[idx]);
  const sum = boosted.reduce((total, x) => total + x, 0);

  // Re-normalize to ensure probabilities still sum to 1 after adjustment.
  return boosted.map((value) => value / sum);
}

// Apply a fixed home advantage boost to the home win probability.
// This function increments the home win probability and removes a smaller
// amount from the away win probability, then normalizes the result.
function applyHomeAdvantage(probs, settings) {
  const advantage = settings.homeAdvantage;

  // Home win probability is increased;
  // away win probability is decreased slightly to preserve normalization.
  // draw probability is left unchanged by this step.
  const boosted = [probs[0] + advantage, probs[1], Math.max(probs[2] - advantage / 2, 0.01)];
  const sum = boosted.reduce((total, x) => total + x, 0);
  return boosted.map((value) => value / sum);
}

// Add controlled randomness to the prediction probabilities.
// This prevents the model from returning identical predictions for every run
// when inputs are the same. It keeps final values positive and normalizes again.
function addRandomness(probs, settings) {
  const noise = probs.map(() => (Math.random() - 0.5) * settings.randomness);

  // Ensure the result remains positive by flooring at a small value.
  const mixed = probs.map((prob, idx) => Math.max(prob + noise[idx], 0.001));
  const sum = mixed.reduce((total, x) => total + x, 0);
  return mixed.map((value) => value / sum);
}

// Determine the predicted outcome from the final probability vector.
// Returns the most likely outcome label plus the probability breakdown.
function getPredictionOutcome(probs) {
  const labels = ['1', 'X', '2'];
  const bestIndex = probs.indexOf(Math.max(...probs));

  return {
    outcome: labels[bestIndex],
    probabilities: {
      home: probs[0],
      draw: probs[1],
      away: probs[2],
    },
  };
}

// Predict a single virtual match using odds and optional settings.
// The match object can include homeTeam, awayTeam, H, D, A, homeRating, and awayRating.
function predictVirtualGame(match, options = {}) {
  const settings = { ...DEFAULT_SETTINGS, ...options.settings };

  // Step 1: convert supplied odds into a starting probability distribution.
  const baseProbs = impliedProbabilities(match);

  // Step 2: apply team rating differences to shift the probabilities.
  const ratingProbs = applyRatingAdjustment(baseProbs, match, settings);

  // Step 3: apply home-field advantage to further favor the home side.
  const advantageProbs = applyHomeAdvantage(ratingProbs, settings);

  // Step 4: add a small amount of randomness for variability.
  const finalProbs = addRandomness(advantageProbs, settings);

  return {
    match: {
      homeTeam: match.homeTeam || 'Home',
      awayTeam: match.awayTeam || 'Away',
      odds: { H: match.H, D: match.D, A: match.A },
      homeRating: safeNumber(match.homeRating, 50),
      awayRating: safeNumber(match.awayRating, 50),
    },
    ...getPredictionOutcome(finalProbs),
  };
}

// Run multiple virtual match predictions and aggregate the outcome distribution.
// This is effectively a Monte Carlo simulation of the match using the same
// predictor repeatedly, which smooths randomness into a percentage distribution.
function simulateVirtualMatch(match, runs = DEFAULT_SETTINGS.simulationRuns, options = {}) {
  const results = { '1': 0, X: 0, '2': 0 };

  for (let i = 0; i < runs; i += 1) {
    const prediction = predictVirtualGame(match, options);
    results[prediction.outcome] += 1;
  }

  return {
    runs,
    distribution: {
      home: results['1'] / runs,
      draw: results['X'] / runs,
      away: results['2'] / runs,
    },
  };
}

// Predict a batch of matches and return an array of prediction objects.
function predictBatch(matches, options = {}) {
  return matches.map((match) => predictVirtualGame(match, options));
}

// Helper for printing prediction results in a readable format.
function prettyPrintPrediction(result) {
  const { match, outcome, probabilities } = result;

  console.log(`\n${match.homeTeam} vs ${match.awayTeam}`);
  console.log(`Odds: H=${match.odds.H} D=${match.odds.D} A=${match.odds.A}`);
  console.log(`Ratings: home=${match.homeRating} away=${match.awayRating}`);
  console.log(`Prediction: ${outcome}`);
  console.log(`Probabilities: home=${(probabilities.home * 100).toFixed(1)}% draw=${(probabilities.draw * 100).toFixed(1)}% away=${(probabilities.away * 100).toFixed(1)}%`);
}

// If this file is executed directly, run a small demo with sample matches.
if (require.main === module) {
  const sampleMatches = [
    { homeTeam: 'Team A', awayTeam: 'Team B', H: 1.90, D: 3.40, A: 4.10, homeRating: 60, awayRating: 45 },
    { homeTeam: 'Team C', awayTeam: 'Team D', H: 2.10, D: 3.20, A: 3.50, homeRating: 55, awayRating: 55 },
    { homeTeam: 'Team E', awayTeam: 'Team F', H: 2.50, D: 3.10, A: 2.80, homeRating: 48, awayRating: 53 },
  ];

  for (const match of sampleMatches) {
    const result = predictVirtualGame(match);
    prettyPrintPrediction(result);
    const sim = simulateVirtualMatch(match, 400);
    console.log(`Simulation: home=${(sim.distribution.home * 100).toFixed(1)}% draw=${(sim.distribution.draw * 100).toFixed(1)}% away=${(sim.distribution.away * 100).toFixed(1)}%`);
  }
}

module.exports = {
  predictVirtualGame,
  simulateVirtualMatch,
  predictBatch,
};
