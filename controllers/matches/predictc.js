const DEFAULT_OPTIONS = {
  momentumWeight: 0.12,
  consistencyReward: 0.06,
  volatilityDampen: 0.05,
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

  return values.map((value) =>
    sum > 0 ? value / sum : 1 / values.length
  );
}

function getMomentumScore(rating) {
  const normalizedRating = safeNumber(rating, 50);
  return (normalizedRating - 50) / 100;
}

function predictWithMomentum(match, options = {}) {
  const settings = { ...DEFAULT_OPTIONS, ...options };

  const baseProbs = impliedProbability(match);

  const homeMomentum = getMomentumScore(match.homeRating);
  const awayMomentum = getMomentumScore(match.awayRating);

  const momentumDiff = homeMomentum - awayMomentum;

  const adjustments = [
    baseProbs[0] +
      momentumDiff * settings.momentumWeight,

    baseProbs[1] +
      settings.consistencyReward,

    baseProbs[2] -
      momentumDiff * settings.momentumWeight,
  ];

  const adjusted = normalize(
    adjustments.map((prob) =>
      Math.max(prob, 0.01)
    )
  );

  const dampenedProbs = [
    adjusted[0] *
      (1 - settings.volatilityDampen),

    adjusted[1] *
      (1 -
        settings.volatilityDampen * 0.5),

    adjusted[2] *
      (1 - settings.volatilityDampen),
  ];

  const finalProbs = normalize(
    dampenedProbs
  );

  const outcomeIndex = finalProbs.indexOf(
    Math.max(...finalProbs)
  );

  // Standardized outcome labels
  const outcomeMap = ["H", "D", "A"];

  return {
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    algorithm: "MomentumForm",

    outcome: outcomeMap[outcomeIndex],

    probabilities: {
      home: Number(
        finalProbs[0].toFixed(4)
      ),
      draw: Number(
        finalProbs[1].toFixed(4)
      ),
      away: Number(
        finalProbs[2].toFixed(4)
      ),
    },

    confidence: Number(
      finalProbs[outcomeIndex].toFixed(4)
    ),

    momentumAnalysis: {
      homeMomentum: Number(
        homeMomentum.toFixed(3)
      ),

      awayMomentum: Number(
        awayMomentum.toFixed(3)
      ),

      momentumDifference: Number(
        momentumDiff.toFixed(3)
      ),
    },

    reason: `Momentum-based: home rating ${match.homeRating} vs away rating ${match.awayRating}`,
  };
}

function predictBatchMomentum(
  matches,
  options = {}
) {
  return matches.map((match) =>
    predictWithMomentum(match, options)
  );
}

module.exports = {
  predictMomentum: predictWithMomentum,
  predictBatchMomentum,
};
