
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

  return values.map((value) =>
    sum > 0 ? value / sum : 1 / values.length
  );
}

function getMomentumScore(rating) {
  const normalizedRating = safeNumber(rating, 50);
  return (normalizedRating - 50) / 100;
}

function getMatchResultPoints(match, teamName) {
  const outcome =
    match.outcome ||
    match.predictedOutcome ||
    match.result;

  if (!outcome) return null;

  const normalizedOutcome =
    outcome === "1"
      ? "H"
      : outcome === "X"
      ? "D"
      : outcome === "2"
      ? "A"
      : outcome;

  const isHomeTeam = match.homeTeam === teamName;
  const isAwayTeam = match.awayTeam === teamName;

  if (!isHomeTeam && !isAwayTeam) {
    return null;
  }

  if (normalizedOutcome === "D") {
    return 1;
  }

  if (
    (normalizedOutcome === "H" && isHomeTeam) ||
    (normalizedOutcome === "A" && isAwayTeam)
  ) {
    return 3;
  }

  return 0;
}

function computeHistoryMomentum(matches, teamName) {
  if (!Array.isArray(matches) || matches.length === 0) {
    return 0;
  }

  let weightedPoints = 0;
  let weightedMax = 0;

  matches.forEach((match, index) => {
    const points = getMatchResultPoints(match, teamName);

    if (points === null) {
      return;
    }

    const recencyFactor = 1 - index / matches.length;
    const weight = 0.6 + 0.4 * recencyFactor;

    weightedPoints += points * weight;
    weightedMax += 3 * weight;
  });

  if (weightedMax === 0) {
    return 0;
  }

  const averagePoints = (weightedPoints * 3) / weightedMax;

  // Scale to -1 to +1
  return (averagePoints - 1.5) / 1.5;
}

async function fetchRecentHistory(teamName, options = {}) {
  const {
    maxHistoryMatches = DEFAULT_HISTORY_OPTIONS.maxHistoryMatches,
  } = options;

  return Match.find({
    $or: [
      { homeTeam: teamName },
      { awayTeam: teamName },
    ],
  })
    .sort({
      matchday: -1,
      updatedAt: -1,
      createdAt: -1,
    })
    .limit(maxHistoryMatches)
    .lean();
}

async function getTeamHistoryMomentum(
  teamName,
  options = {}
) {
  if (!teamName) {
    return 0;
  }

  const history = await fetchRecentHistory(
    teamName,
    options
  );

  const minimumRequired =
    options.minHistoryMatches ??
    DEFAULT_HISTORY_OPTIONS.minHistoryMatches;

  if (history.length < minimumRequired) {
    return 0;
  }

  return computeHistoryMomentum(history, teamName);
}

function blendMomentum(
  ratingMomentum,
  historyMomentum,
  options = {}
) {
  const historyShare =
    options.historyWeight ??
    DEFAULT_HISTORY_OPTIONS.historyWeight;

  return (
    ratingMomentum * (1 - historyShare) +
    historyMomentum * historyShare
  );
}

async function predictWithHistory(
  match,
  options = {},
  cache = new Map()
) {
  const settings = {
    ...DEFAULT_HISTORY_OPTIONS,
    ...options,
  };

  const baseProbs = impliedProbability(match);

  const homeRatingMomentum = getMomentumScore(
    match.homeRating
  );

  const awayRatingMomentum = getMomentumScore(
    match.awayRating
  );

  const homeHistoryPromise = cache.has(match.homeTeam)
    ? cache.get(match.homeTeam)
    : cache
        .set(
          match.homeTeam,
          getTeamHistoryMomentum(
            match.homeTeam,
            settings
          )
        )
        .get(match.homeTeam);

  const awayHistoryPromise = cache.has(match.awayTeam)
    ? cache.get(match.awayTeam)
    : cache
        .set(
          match.awayTeam,
          getTeamHistoryMomentum(
            match.awayTeam,
            settings
          )
        )
        .get(match.awayTeam);

  const [
    homeHistoryMomentum,
    awayHistoryMomentum,
  ] = await Promise.all([
    homeHistoryPromise,
    awayHistoryPromise,
  ]);

  const homeMomentum = blendMomentum(
    homeRatingMomentum,
    homeHistoryMomentum,
    settings
  );

  const awayMomentum = blendMomentum(
    awayRatingMomentum,
    awayHistoryMomentum,
    settings
  );

  const momentumDiff =
    homeMomentum - awayMomentum;

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

  const outcomeMap = ["H", "D", "A"];

  return {
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    algorithm: "MomentumFormWithHistory",

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

      homeHistoryMomentum: Number(
        homeHistoryMomentum.toFixed(3)
      ),

      awayHistoryMomentum: Number(
        awayHistoryMomentum.toFixed(3)
      ),

      momentumDifference: Number(
        momentumDiff.toFixed(3)
      ),
    },

    reason: `Historical form + ratings applied for ${match.homeTeam} vs ${match.awayTeam}`,
  };
}

async function predictBatchWithHistory(
  matches,
  options = {}
) {
  const cache = new Map();

  return Promise.all(
    matches.map((match) =>
      predictWithHistory(
        match,
        options,
        cache
      )
    )
  );
}

async function getTeamHistoryInfo(
  teamName,
  options = {}
) {
  if (!teamName) {
    return {
      count: 0,
      meetsMin: false,
      history: [],
    };
  }

  const settings = {
    ...DEFAULT_HISTORY_OPTIONS,
    ...options,
  };

  const history =
    await fetchRecentHistory(
      teamName,
      settings
    );

  const count = history.length;

  return {
    teamName,
    count,
    meetsMin:
      count >= settings.minHistoryMatches,
    minRequired:
      settings.minHistoryMatches,

    history: history
      .slice(0, 10)
      .map((match) => ({
        matchday: match.matchday,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        outcome:
          match.outcome ??
          match.predictedOutcome ??
          match.result ??
          null,
      })),
  };
}

module.exports = {
  predictBatchWithHistory,
  getTeamHistoryInfo,
};
