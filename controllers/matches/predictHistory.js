const Match = require("../../models/Match");

const DEFAULT_HISTORY_OPTIONS = {
  formWindow: 8,
  maxHistoryMatches: 12,
  minHistoryMatches: 3,
  historyWeight: 0.45,
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
  return values.map((value) => (sum > 0 ? value / sum : 1 / values.length));
}

function getMomentumScore(rating) {
  const normalizedRating = safeNumber(rating, 50);
  return (normalizedRating - 50) / 100;
}

function getMatchResultPoints(match, teamName) {
  const outcome = match.outcome;
  if (!outcome) return null;

  const isHomeTeam = match.homeTeam === teamName;
  const isAwayTeam = match.awayTeam === teamName;
  if (!isHomeTeam && !isAwayTeam) return null;

  if (outcome === 'D') return 1;
  if ((outcome === 'H' && isHomeTeam) || (outcome === 'A' && isAwayTeam)) return 3;
  return 0;
}

function computeHistoryMomentum(matches, teamName) {
  if (!Array.isArray(matches) || matches.length === 0) return null;

  let weightedPoints = 0;
  let weightedMax = 0;

  matches.forEach((match, index) => {
    const points = getMatchResultPoints(match, teamName);
    if (points === null) return;

    const recencyFactor = 1 - index / matches.length;
    const weight = 0.6 + 0.4 * recencyFactor;

    weightedPoints += points * weight;
    weightedMax += 3 * weight;
  });

  if (weightedMax === 0) return null;

  const averagePoints = (weightedPoints * 3) / weightedMax;
  return (averagePoints - 1.5) / 1.5;
}

async function fetchRecentHistory(teamName, options = {}) {
  const { maxHistoryMatches } = options;

  return Match.find({
    $or: [{ homeTeam: teamName }, { awayTeam: teamName }],
    outcome: { $in: ['H', 'D', 'A'] },
  })
    .sort({ updatedAt: -1, createdAt: -1 })
    .limit(maxHistoryMatches)
    .lean();
}

async function getTeamHistoryMomentum(teamName, options = {}) {
  if (!teamName) return null;

  const history = await fetchRecentHistory(teamName, options);
  if (history.length < (options.minHistoryMatches || DEFAULT_HISTORY_OPTIONS.minHistoryMatches)) {
    return null;
  }

  return computeHistoryMomentum(history, teamName);
}

function blendMomentum(ratingMomentum, historyMomentum, options = {}) {
  if (historyMomentum === null) {
    return ratingMomentum;
  }

  const historyShare = options.historyWeight ?? DEFAULT_HISTORY_OPTIONS.historyWeight;
  return ratingMomentum * (1 - historyShare) + historyMomentum * historyShare;
}

async function predictWithHistory(match, options = {}, cache = new Map()) {
  const settings = { ...DEFAULT_HISTORY_OPTIONS, ...options };
  const baseProbs = impliedProbability(match);

  const homeRatingMomentum = getMomentumScore(match.homeRating);
  const awayRatingMomentum = getMomentumScore(match.awayRating);

  const homeHistoryPromise = cache.has(match.homeTeam)
    ? cache.get(match.homeTeam)
    : (cache.set(match.homeTeam, getTeamHistoryMomentum(match.homeTeam, settings)), cache.get(match.homeTeam));

  const awayHistoryPromise = cache.has(match.awayTeam)
    ? cache.get(match.awayTeam)
    : (cache.set(match.awayTeam, getTeamHistoryMomentum(match.awayTeam, settings)), cache.get(match.awayTeam));

  const [homeHistoryMomentum, awayHistoryMomentum] = await Promise.all([homeHistoryPromise, awayHistoryPromise]);

  const homeMomentum = blendMomentum(homeRatingMomentum, homeHistoryMomentum, settings);
  const awayMomentum = blendMomentum(awayRatingMomentum, awayHistoryMomentum, settings);
  const momentumDiff = homeMomentum - awayMomentum;

  const adjustments = [
    baseProbs[0] + momentumDiff * settings.momentumWeight,
    baseProbs[1] + settings.consistencyReward,
    baseProbs[2] - momentumDiff * settings.momentumWeight,
  ];

  const adjusted = normalize(adjustments.map((prob) => Math.max(prob, 0.01)));
  const dampenedProbs = [
    adjusted[0] * (1 - settings.volatilityDampen),
    adjusted[1] * (1 - settings.volatilityDampen * 0.5),
    adjusted[2] * (1 - settings.volatilityDampen),
  ];
  const finalProbs = normalize(dampenedProbs);

  const outcomeIndex = finalProbs.indexOf(Math.max(...finalProbs));
  const outcomeMap = ['1', 'X', '2'];

  return {
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    algorithm: 'MomentumFormWithHistory',
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
      homeHistoryMomentum: homeHistoryMomentum !== null ? homeHistoryMomentum.toFixed(3) : null,
      awayHistoryMomentum: awayHistoryMomentum !== null ? awayHistoryMomentum.toFixed(3) : null,
      momentumDifference: momentumDiff.toFixed(3),
    },
    reason: `Historical form + rating applied for ${match.homeTeam} vs ${match.awayTeam}`,
  };
}

async function predictBatchWithHistory(matches, options = {}) {
  const cache = new Map();
  return Promise.all(matches.map((match) => predictWithHistory(match, options, cache)));
}

module.exports = {
  predictBatchWithHistory,
};
