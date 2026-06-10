const DEFAULT_OPTIONS = {
  ratingWeight: 0.1,
  drawBias: 0.04,
  randomBoost: 0.08,
};

function safeNumber(value, fallback = 1) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : fallback;
}

function impliedProbability(odds) {
  const h = safeNumber(odds.H, 1);
  const d = safeNumber(odds.D, 1);
  const a = safeNumber(odds.A, 1);
  const raw = [1 / h, 1 / d, 1 / a];
  const sum = raw.reduce((total, value) => total + value, 0);
  return raw.map((value) => value / sum);
}

function normalize(values) {
  const sum = values.reduce((total, value) => total + value, 0);
  return values.map((value) => (sum > 0 ? value / sum : 1 / values.length));
}

function getOutcomeLabel(outcome) {
  if (outcome === '1') return 'home';
  if (outcome === 'X') return 'draw';
  if (outcome === '2') return 'away';
  return 'unknown';
}

function enhanceMatchPrediction(simplePrediction, match, options = {}) {
  const settings = { ...DEFAULT_OPTIONS, ...options };
  const probabilities = impliedProbability(match);
  const ratingDelta = safeNumber(match.homeRating, 50) - safeNumber(match.awayRating, 50);

  const ratingAdjust = [0, 0, 0];
  if (ratingDelta > 0) {
    ratingAdjust[0] = Math.min(ratingDelta / 200, 0.08);
    ratingAdjust[2] = -Math.min(ratingDelta / 300, 0.04);
  } else if (ratingDelta < 0) {
    ratingAdjust[2] = Math.min(-ratingDelta / 200, 0.08);
    ratingAdjust[0] = -Math.min(-ratingDelta / 300, 0.04);
  }

  const adjusted = normalize([
    probabilities[0] + ratingAdjust[0],
    probabilities[1] + settings.drawBias,
    probabilities[2] + ratingAdjust[2],
  ]);

  const weakOutcomeIndex = { '1': 0, X: 1, '2': 2 }[simplePrediction] ?? 0;
  const boosted = adjusted.map((prob, idx) => {
    if (idx === weakOutcomeIndex) {
      return prob + settings.randomBoost * 0.5;
    }
    return Math.max(prob - settings.randomBoost * 0.25, 0.01);
  });

  const finalProbabilities = normalize(boosted);
  const labeled = {
    home: finalProbabilities[0],
    draw: finalProbabilities[1],
    away: finalProbabilities[2],
  };

  return {
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    predictedOutcome: simplePrediction,
    probabilities: labeled,
    confidence: Math.max(labeled[getOutcomeLabel(simplePrediction)] || 0, 0.12),
    ratingDelta,
    odds: { H: match.H, D: match.D, A: match.A },
    reason: `Base odds + rating delta ${ratingDelta.toFixed(1)}`,
  };
}

function enrichPredictionList(simplifiedPrediction, matches, options = {}) {
  if (!Array.isArray(simplifiedPrediction) || !Array.isArray(matches)) {
    throw new Error('simplifiedPrediction and matches must be arrays');
  }

  return simplifiedPrediction.map((item, index) => {
    const key = Object.keys(item)[0];
    const value = item[key];
    const matchIndex = Number(key.replace(/match/i, '')) - 1;
    const match = matches[matchIndex] || matches[index];

    return {
      matchKey: key,
      prediction: item[key],
      ...enhanceMatchPrediction(value, match, options),
    };
  });
}

module.exports = {
  enhancePredictions: enrichPredictionList,
};
