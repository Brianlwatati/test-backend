// Default algorithm settings used when calling the prediction functions.
// These values tune how strongly momentum and consistency affect the final probabilities.
const DEFAULT_OPTIONS = {
  momentumWeight: 0.12,      // how much the relative momentum shifts home/away probabilities
  consistencyReward: 0.06,   // small bonus added to draw probability to reflect stability
  volatilityDampen: 0.05,    // damping factor to reduce overly extreme probability swings
};

// Convert a value into a safe positive number.
// If the input is missing, NaN, zero, negative, or infinite, use the fallback.
function safeNumber(value, fallback = 1) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : fallback;
}

// Convert bookmaker-style odds into implied probabilities.
// The `match` object is expected to contain H, D, and A odds.
// We invert the odds to get raw probabilities, then normalize so they sum to 1.
function impliedProbability(odds) {
  const h = safeNumber(odds.H, 1);
  const d = safeNumber(odds.D, 1);
  const a = safeNumber(odds.A, 1);

  // Raw implied probabilities from decimal odds.
  // 1 / odds is the inverse-odds probability estimate.
  const raw = [1 / h, 1 / d, 1 / a];

  const sum = raw.reduce((total, value) => total + value, 0);

  // Normalize to ensure the three probabilities sum to 1.
  return raw.map((value) => value / sum);
}

// Normalize any set of non-negative values so they sum to 1.
// If the input vector sums to zero, return a uniform distribution.
function normalize(values) {
  const sum = values.reduce((total, value) => total + value, 0);
  return values.map((value) => (sum > 0 ? value / sum : 1 / values.length));
}

// Convert a numerical rating into a momentum score centered around zero.
// A rating of 50 becomes 0. Ratings above 50 produce positive momentum,
// while ratings below 50 produce negative momentum.
function getMomentumScore(rating) {
  const normalizedRating = safeNumber(rating, 50);
  return (normalizedRating - 50) / 100;
}

// Predict match outcome probabilities using an odds-based base model
// and momentum adjustments derived from each team's recent form rating.
function predictWithMomentum(match, options = {}) {
  // Merge default options with any overrides provided by the caller.
  const settings = { ...DEFAULT_OPTIONS, ...options };

  // Start from implied probabilities based on the raw odds.
  const baseProbs = impliedProbability(match);

  // Convert home and away ratings into momentum scores.
  const homeMomentum = getMomentumScore(match.homeRating);
  const awayMomentum = getMomentumScore(match.awayRating);

  // Positive momentumDiff means the home team has better recent form.
  const momentumDiff = homeMomentum - awayMomentum;

  // Adjust the base probabilities using momentum and a small draw reward.
  // Home probability increases when home momentum is stronger;
  // away probability decreases symmetrically.
  const adjustments = [
    baseProbs[0] + momentumDiff * settings.momentumWeight,
    baseProbs[1] + settings.consistencyReward,
    baseProbs[2] - momentumDiff * settings.momentumWeight,
  ];

  // Prevent any probability from collapsing to zero before normalization.
  // This keeps the distribution valid and avoids extreme outcomes.
  const adjusted = normalize(adjustments.map((prob) => Math.max(prob, 0.01)));

  // Apply volatility damping to reduce overly aggressive probability shifts.
  // The draw probability is dampened less strongly because draws are often more stable.
  const dampenedProbs = [
    adjusted[0] * (1 - settings.volatilityDampen),
    adjusted[1] * (1 - settings.volatilityDampen * 0.5),
    adjusted[2] * (1 - settings.volatilityDampen),
  ];

  // Re-normalize after damping so the final probabilities remain a distribution.
  const finalProbs = normalize(dampenedProbs);

  // Choose the most likely outcome label: 1=home win, X=draw, 2=away win.
  const outcomeIndex = finalProbs.indexOf(Math.max(...finalProbs));
  const outcomeMap = ['1', 'X', '2'];

  return {
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    algorithm: 'MomentumForm',
    predictedOutcome: outcomeMap[outcomeIndex],
    probabilities: {
      home: finalProbs[0],
      draw: finalProbs[1],
      away: finalProbs[2],
    },
    confidence: finalProbs[outcomeIndex],
    momentumAnalysis: {
      homeMomentum: homeMomentum.toFixed(3),
      awayMomentum: awayMomentum.toFixed(3),
      momentumDifference: momentumDiff.toFixed(3),
    },
    reason: `Momentum-based: home rating ${match.homeRating} vs away ${match.awayRating}`,
  };
}

// Run the same momentum-based prediction on an array of matches.
function predictBatchMomentum(matches, options = {}) {
  return matches.map((match) => predictWithMomentum(match, options));
}

module.exports = {
  predictMomentum: predictWithMomentum,
  predictBatchMomentum,
};
