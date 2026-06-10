const fs = require('fs');

const DEFAULT_SETTINGS = {
  homeAdvantage: 0.08,
  ratingWeight: 0.12,
  drawTendency: 0.03,
  randomness: 0.08,
  simulationRuns: 500,
};

function safeNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function impliedProbabilities({ H, D, A }) {
  const h = safeNumber(H, 1);
  const d = safeNumber(D, 1);
  const a = safeNumber(A, 1);
  const raw = [1 / h, 1 / d, 1 / a];
  const sum = raw.reduce((total, x) => total + x, 0);
  return raw.map((x) => (sum > 0 ? x / sum : 1 / 3));
}

function applyRatingAdjustment(baseProbs, { homeRating = 50, awayRating = 50 }, settings) {
  const ratingDelta = safeNumber(homeRating, 50) - safeNumber(awayRating, 50);
  const ratingFactor = Math.tanh(ratingDelta / 100) * settings.ratingWeight;

  const adjustment = [1 + ratingFactor, 1 + settings.drawTendency, 1 - ratingFactor];
  const boosted = baseProbs.map((prob, idx) => prob * adjustment[idx]);
  const sum = boosted.reduce((total, x) => total + x, 0);
  return boosted.map((value) => value / sum);
}

function applyHomeAdvantage(probs, settings) {
  const advantage = settings.homeAdvantage;
  const boosted = [probs[0] + advantage, probs[1], Math.max(probs[2] - advantage / 2, 0.01)];
  const sum = boosted.reduce((total, x) => total + x, 0);
  return boosted.map((value) => value / sum);
}

function addRandomness(probs, settings) {
  const noise = probs.map(() => (Math.random() - 0.5) * settings.randomness);
  const mixed = probs.map((prob, idx) => Math.max(prob + noise[idx], 0.001));
  const sum = mixed.reduce((total, x) => total + x, 0);
  return mixed.map((value) => value / sum);
}

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

function predictVirtualGame(match, options = {}) {
  const settings = { ...DEFAULT_SETTINGS, ...options.settings };
  const baseProbs = impliedProbabilities(match);
  const ratingProbs = applyRatingAdjustment(baseProbs, match, settings);
  const advantageProbs = applyHomeAdvantage(ratingProbs, settings);
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

function predictBatch(matches, options = {}) {
  return matches.map((match) => predictVirtualGame(match, options));
}

function prettyPrintPrediction(result) {
  const { match, outcome, probabilities } = result;
  console.log(`\n${match.homeTeam} vs ${match.awayTeam}`);
  console.log(`Odds: H=${match.odds.H} D=${match.odds.D} A=${match.odds.A}`);
  console.log(`Ratings: home=${match.homeRating} away=${match.awayRating}`);
  console.log(`Prediction: ${outcome}`);
  console.log(`Probabilities: home=${(probabilities.home * 100).toFixed(1)}% draw=${(probabilities.draw * 100).toFixed(1)}% away=${(probabilities.away * 100).toFixed(1)}%`);
}

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
