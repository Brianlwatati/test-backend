// Default configuration options for prediction enhancement
const DEFAULT_OPTIONS = {
  ratingWeight: 0.1,      // Weight factor for team rating differences
  drawBias: 0.04,         // Bias towards draw outcomes
  randomBoost: 0.08,      // Boost factor for randomness in predictions
};

// Safely convert a value to a positive number or return fallback
// @param {any} value - The value to convert
// @param {number} fallback - Default value if conversion fails (default: 1)
// @returns {number} A valid positive number
function safeNumber(value, fallback = 1) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : fallback;
}

// Calculate implied probabilities from betting odds (Home, Draw, Away)
// Uses the formula: probability = 1/odds, then normalizes the result
// @param {Object} odds - Object with H (home), D (draw), A (away) odds
// @returns {Array} Array of normalized probabilities [home, draw, away]
function impliedProbability(odds) {
  const h = safeNumber(odds.H, 1);
  const d = safeNumber(odds.D, 1);
  const a = safeNumber(odds.A, 1);

  // Calculate raw probabilities using inverse odds formula
  const raw = [1 / h, 1 / d, 1 / a];
  const sum = raw.reduce((total, value) => total + value, 0);

  // Normalize to ensure probabilities sum to 1
  return raw.map((value) => value / sum);
}

// Normalize an array of values so they sum to 1 (convert to probabilities)
// @param {Array} values - Array of numeric values to normalize
// @returns {Array} Array of normalized probabilities
function normalize(values) {
  const sum = values.reduce((total, value) => total + value, 0);

  // Divide each value by the sum, or distribute equally if sum is 0
  return values.map((value) =>
    sum > 0 ? value / sum : 1 / values.length
  );
}

// Convert outcome code to human-readable label
// @param {string} outcome - Outcome code (H=home, D=draw, A=away)
// @returns {string} Human-readable outcome label
function getOutcomeLabel(outcome) {
  if (outcome === "H") return "home";
  if (outcome === "D") return "draw";
  if (outcome === "A") return "away";

  return "unknown";
}

// Enhance a simple prediction with detailed probabilities and analysis
// Adjusts base odds probabilities based on team ratings and adds confidence metrics
// @param {string} simplePrediction - Base prediction outcome (H/D/A)
// @param {Object} match - Match object with ratings and odds
// @param {Object} options - Optional settings to override defaults
// @returns {Object} Enhanced prediction with probabilities and confidence
function enhanceMatchPrediction(
  simplePrediction,
  match,
  options = {}
) {
  // Merge provided options with defaults
  const settings = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  // Extract implied probabilities from match odds
  const probabilities =
    impliedProbability(match);

  // Calculate rating difference (positive favors home team)
  const ratingDelta =
    safeNumber(match.homeRating, 50) -
    safeNumber(match.awayRating, 50);

  // Adjustments to apply based on rating differences [home, draw, away]
  const ratingAdjust = [0, 0, 0];

  // Apply rating-based adjustments: boost favored team, reduce underdog
  if (ratingDelta > 0) {
    // Home team is stronger: boost home, reduce away slightly
    ratingAdjust[0] = Math.min(
      ratingDelta / 200,
      0.08
    );

    ratingAdjust[2] = -Math.min(
      ratingDelta / 300,
      0.04
    );
  } else if (ratingDelta < 0) {
    // Away team is stronger: boost away, reduce home slightly
    ratingAdjust[2] = Math.min(
      -ratingDelta / 200,
      0.08
    );

    ratingAdjust[0] = -Math.min(
      -ratingDelta / 300,
      0.04
    );
  }

  // Apply adjustments to base probabilities and normalize
  const adjusted = normalize([
    probabilities[0] +
      ratingAdjust[0],

    probabilities[1] +
      settings.drawBias,  // Slightly increase draw probability

    probabilities[2] +
      ratingAdjust[2],
  ]);

  // Map outcome codes to probability array indices
  const outcomeIndex = {
    H: 0,
    D: 1,
    A: 2,
  };

  // Get the index of the predicted outcome
  const selectedIndex =
    outcomeIndex[simplePrediction] ?? 0;

  // Boost the predicted outcome and reduce alternatives to reflect confidence
  const boosted = adjusted.map(
    (prob, idx) => {
      if (idx === selectedIndex) {
        // Boost the selected prediction
        return (
          prob +
          settings.randomBoost * 0.5
        );
      }

      // Reduce alternative outcomes but maintain minimum probability
      return Math.max(
        prob -
          settings.randomBoost * 0.25,
        0.01
      );
    }
  );

  // Final normalization after boosting
  const finalProbabilities =
    normalize(boosted);

  // Create human-readable probability object rounded to 4 decimal places
  const labeled = {
    home: Number(
      finalProbabilities[0].toFixed(4)
    ),

    draw: Number(
      finalProbabilities[1].toFixed(4)
    ),

    away: Number(
      finalProbabilities[2].toFixed(4)
    ),
  };

  // Return comprehensive prediction object with all details
  return {
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,

    outcome: simplePrediction,

    probabilities: labeled,

    // Confidence is the probability of predicted outcome (minimum 0.12)
    confidence: Number(
      Math.max(
        labeled[
          getOutcomeLabel(
            simplePrediction
          )
        ] || 0,
        0.12
      ).toFixed(4)
    ),

    ratingDelta: Number(
      ratingDelta.toFixed(2)
    ),

    // Original match odds
    odds: {
      H: match.H,
      D: match.D,
      A: match.A,
    },

    // Explanation of prediction rationale
    reason: `Base odds + rating delta ${ratingDelta.toFixed(
      1
    )}`,
  };
}

// Process multiple predictions, matching them with match data and enhancing them
// @param {Array} simplifiedPrediction - Array of prediction objects with match keys
// @param {Array} matches - Array of match objects with odds and ratings
// @param {Object} options - Optional settings to pass to enhancement function
// @returns {Object} Object mapping match keys to enhanced predictions
function enrichPredictionList(
  simplifiedPrediction,
  matches,
  options = {}
) {
  // Validate that both inputs are arrays
  if (
    !Array.isArray(
      simplifiedPrediction
    ) ||
    !Array.isArray(matches)
  ) {
    throw new Error(
      "simplifiedPrediction and matches must be arrays"
    );
  }

  // Process each prediction and enhance it with match data
  return simplifiedPrediction.reduce(
    (acc, item, index) => {
      // Extract the match key and prediction value from item
      const key = Object.keys(item)[0];
      const value = item[key];

      // Parse match index from key name (e.g., "match1" -> index 0)
      const matchIndex =
        Number(
          key.replace(/match/i, "")
        ) - 1;

      // Get match data, fallback to array index if key-based lookup fails
      const match =
        matches[matchIndex] ??
        matches[index];

      // Skip if match data not found
      if (!match) {
        return acc;
      }

      // Enhance prediction with detailed probabilities and confidence
      const enhanced =
        enhanceMatchPrediction(
          value,
          match,
          options
        );

      // Store the outcome in accumulator
      acc[key] = enhanced.outcome;

      return acc;
    },
    {}
  );
}

// Export functions for use in other modules
module.exports = {
  // Batch prediction enhancement function
  enhancePredictions:
    enrichPredictionList,

  // Single match prediction enhancement function
  enhanceMatchPrediction,
};
