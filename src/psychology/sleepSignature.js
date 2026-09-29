// Internal, deterministic sleep-signature classification. The answer indexes
// are the selected option positions (0-4), aligned with sleepAnswerOptions.
// All scoring is kept out of the presentation layer.

export const SLEEP_SIGNATURE_SCORING_MAP = Object.freeze([
  Object.freeze({ question: 1, dimension: "recovery", valuesByAnswerIndex: [4, 3, 2, 1, 0] }),
  Object.freeze({ question: 2, dimension: "sleepOnset", valuesByAnswerIndex: [4, 3, 2, 1, 0] }),
  Object.freeze({ question: 3, dimension: "continuity", valuesByAnswerIndex: [4, 3, 2, 1, 0] }),
  Object.freeze({ question: 4, dimension: "recovery", valuesByAnswerIndex: [4, 3, 2, 1, 0] }),
  // Duration choices are deliberately non-positional: 7-9 hours is optimal;
  // >9 hours with poor refreshment is still unfavorable, but not as low as <5.
  Object.freeze({ question: 5, dimension: "rhythm", valuesByAnswerIndex: [4, 3, 2, 0, 1] }),
  Object.freeze({ question: 6, dimension: null, signal: "supportingHabit", valuesByAnswerIndex: [4, 3, 2, 1, 0] }),
  Object.freeze({ question: 7, dimension: "sleepOnset", valuesByAnswerIndex: [4, 3, 2, 1, 0] }),
  Object.freeze({ question: 8, dimension: "recovery", valuesByAnswerIndex: [4, 3, 2, 1, 0] }),
  Object.freeze({ question: 9, dimension: "rhythm", valuesByAnswerIndex: [4, 3, 2, 1, 0] }),
  Object.freeze({ question: 10, dimension: "rhythm", valuesByAnswerIndex: [4, 3, 2, 1, 0] }),
  Object.freeze({ question: 11, dimension: "recovery", valuesByAnswerIndex: [4, 3, 2, 1, 0] }),
  Object.freeze({ question: 12, dimension: null, signal: "overallConsistency", valuesByAnswerIndex: [4, 3, 2, 1, 0] }),
]);

export const SLEEP_SIGNATURE_THRESHOLDS = Object.freeze({
  stable: 0.70,
  mixed: 0.45,
  weakBelow: 0.45,
  DOMINANCE_GAP: 0.12,
  stableMaximumDimensionSpread: 0.35,
});

export const DOMINANCE_GAP = SLEEP_SIGNATURE_THRESHOLDS.DOMINANCE_GAP;

const DIMENSION_ORDER = ["recovery", "sleepOnset", "continuity", "rhythm"];
const DIMENSION_NAMES = Object.freeze({
  recovery: "Oporavak",
  sleepOnset: "Uspavljivanje",
  continuity: "Kontinuitet sna",
  rhythm: "Ritam sna",
});

const SIGNATURES = Object.freeze({
  tired_waking: {
    signature: "UMORNO BUĐENJE",
    shortText: "San ti ne donosi dovoljno osećaja oporavka pri buđenju.",
  },
  awake_mind: {
    signature: "BUDAN UM",
    shortText: "Umirivanje misli i uspavljivanje trenutno se najviše izdvajaju.",
  },
  fragmented_night: {
    signature: "ISPREKIDANA NOĆ",
    shortText: "Kontinuitet sna trenutno se najviše izdvaja kao oblast za pažnju.",
  },
  irregular_rhythm: {
    signature: "PROMENLJIV RITAM",
    shortText: "Doslednost vremena spavanja i buđenja trenutno je najveći izazov.",
  },
  empty_battery: {
    signature: "PRAZNA BATERIJA",
    shortText: "Prekinut ili slabiji san ide zajedno sa slabijim osećajem oporavka.",
  },
  sleep_under_pressure: {
    signature: "SAN POD PRITISKOM",
    shortText: "Nekoliko aspekata sna istovremeno deluje opterećeno.",
  },
  calm_night: {
    signature: "MIRNA NOĆ",
    shortText: "Odgovori ukazuju na relativno stabilan obrazac sna bez izražene slabe oblasti.",
  },
});

const SIGNATURE_KEYS = Object.freeze({
  tired_waking: "tired_waking",
  awake_mind: "awake_mind",
  fragmented_night: "fragmented_night",
  irregular_rhythm: "irregular_rhythm",
  empty_battery: "empty_battery",
  sleep_under_pressure: "sleep_under_pressure",
  calm_night: "calm_night",
});

const DIMENSION_LABELS = Object.freeze({
  recovery: "oporavak",
  sleepOnset: "uspavljivanje",
  continuity: "kontinuitet sna",
  rhythm: "ritam sna",
});

function isDevelopmentBuild() {
  return Boolean(import.meta.env?.DEV);
}

function normalized(value) {
  return Number((value / 4).toFixed(3));
}

function getOrderedDimensions(scores) {
  return DIMENSION_ORDER.map((key, index) => ({
    key,
    score: scores[key],
    index,
  })).sort((a, b) => a.score - b.score || a.index - b.index);
}

export function getSleepDimensionSeverity(score) {
  if (score >= SLEEP_SIGNATURE_THRESHOLDS.stable) return "stable";
  if (score >= SLEEP_SIGNATURE_THRESHOLDS.mixed) return "mixed";
  return "weak";
}

export function classifySleepDimensions(scores, supportingSignals = {}) {
  const thresholds = SLEEP_SIGNATURE_THRESHOLDS;
  const ordered = getOrderedDimensions(scores);
  const weakDimensions = ordered.filter(({ score }) => getSleepDimensionSeverity(score) === "weak");
  const weakest = ordered[0];
  const secondWeakest = ordered[1];
  const strongest = [...ordered].sort((a, b) => b.score - a.score || a.index - b.index)[0];
  const spread = ordered[3].score - weakest.score;
  const stableDimensions = weakDimensions.length === 0 && spread <= thresholds.stableMaximumDimensionSpread;

  let signatureKey;
  let triggeredRule;

  if (stableDimensions) {
    signatureKey = SIGNATURE_KEYS.calm_night;
    triggeredRule = "no_weak_dimensions_and_reasonably_stable_pattern";
  } else if (scores.recovery < thresholds.weakBelow && scores.continuity < thresholds.weakBelow) {
    signatureKey = SIGNATURE_KEYS.empty_battery;
    triggeredRule = "recovery_and_continuity_both_weak";
  } else if (weakDimensions.length >= 3) {
    signatureKey = SIGNATURE_KEYS.sleep_under_pressure;
    triggeredRule = "three_or_more_dimensions_weak";
  } else {
    const dominanceGap = Number((secondWeakest.score - weakest.score).toFixed(3));
    const clearlyWeakest = dominanceGap >= DOMINANCE_GAP;

    if (clearlyWeakest) {
      const signatureByDimension = {
        recovery: SIGNATURE_KEYS.tired_waking,
        sleepOnset: SIGNATURE_KEYS.awake_mind,
        continuity: SIGNATURE_KEYS.fragmented_night,
        rhythm: SIGNATURE_KEYS.irregular_rhythm,
      };
      signatureKey = signatureByDimension[weakest.key];
      triggeredRule = `single_clear_weakness_${weakest.key}`;
      if (weakest.key === "sleepOnset" && supportingSignals.mentalWindDownScore <= 1) {
        triggeredRule += "_with_difficulty_winding_down";
      }
    } else {
      signatureKey = SIGNATURE_KEYS.sleep_under_pressure;
      triggeredRule = weakDimensions.length >= 2
        ? "two_or_more_weak_dimensions_without_dominance"
        : "no_meaningful_dominance_gap";
    }
  }

  return {
    signatureKey,
    strongestArea: DIMENSION_NAMES[strongest.key],
    mainArea: signatureKey === SIGNATURE_KEYS.calm_night
      ? "Nijedna oblast se ne izdvaja kao jasan problem."
      : signatureKey === SIGNATURE_KEYS.sleep_under_pressure
      ? "Kombinacija više faktora"
      : DIMENSION_NAMES[weakest.key],
    internalScores: scores,
    triggeredRule,
  };
}

/**
 * Classify exactly 12 selected answer indexes (0-4, selected option order).
 * Returns null for incomplete/invalid input. Scores are normalized internally
 * to 0-1; Q6 and Q12 remain supporting signals and are excluded from dimensions.
 */
export function calculateSleepSignature(answerIndexes, answerTexts = []) {
  if (
    !Array.isArray(answerIndexes) ||
    answerIndexes.length !== SLEEP_SIGNATURE_SCORING_MAP.length ||
    answerIndexes.some((value) => !Number.isInteger(value) || value < 0 || value > 4)
  ) {
    return null;
  }

  const questionScores = SLEEP_SIGNATURE_SCORING_MAP.map(({ valuesByAnswerIndex }, questionIndex) =>
    valuesByAnswerIndex[answerIndexes[questionIndex]]
  );
  const dimensionTotals = Object.fromEntries(DIMENSION_ORDER.map((key) => [key, { total: 0, count: 0 }]));

  SLEEP_SIGNATURE_SCORING_MAP.forEach(({ dimension }, index) => {
    if (!dimension) return;
    dimensionTotals[dimension].total += questionScores[index];
    dimensionTotals[dimension].count += 1;
  });

  const internalScores = Object.fromEntries(
    DIMENSION_ORDER.map((key) => [
      key,
      normalized(dimensionTotals[key].total / dimensionTotals[key].count),
    ])
  );
  const supportingSignals = {
    supportingHabit: {
      question: 6,
      response: answerTexts[5] || null,
      score: questionScores[5],
    },
    overallConsistency: {
      question: 12,
      response: answerTexts[11] || null,
      score: questionScores[11],
    },
    mentalWindDown: {
      question: 7,
      response: answerTexts[6] || null,
      score: questionScores[6],
    },
  };
  const classified = classifySleepDimensions(internalScores, {
    mentalWindDownScore: supportingSignals.mentalWindDown.score,
    overallConsistencyScore: supportingSignals.overallConsistency.score,
  });
  const signature = SIGNATURES[classified.signatureKey];

  if (isDevelopmentBuild()) {
    console.debug("[sleep-signature] Selected answers", answerIndexes.map((answerIndex, index) => ({
      question: index + 1,
      answerIndex,
      answer: answerTexts[index] || null,
    })));
    console.debug("[sleep-signature] Question scores (internal 0-4)", questionScores);
    console.debug("[sleep-signature] Dimension scores (normalized 0-1)", internalScores);
    console.debug("[sleep-signature] Triggered rule", classified.triggeredRule);
    console.debug("[sleep-signature] Final signature", signature.signature);
  }

  return {
    signature: signature.signature,
    signatureKey: classified.signatureKey,
    shortText: signature.shortText,
    strongestArea: classified.strongestArea,
    mainArea: classified.mainArea,
    supportingSignals: [
      {
        key: "supporting_habit",
        question: supportingSignals.supportingHabit.question,
        response: supportingSignals.supportingHabit.response,
        internalScore: supportingSignals.supportingHabit.score,
      },
      {
        key: "overall_consistency_control",
        question: supportingSignals.overallConsistency.question,
        response: supportingSignals.overallConsistency.response,
        internalScore: supportingSignals.overallConsistency.score,
      },
    ],
    internalScores: classified.internalScores,
    triggeredRule: classified.triggeredRule,
  };
}

export const SLEEP_SIGNATURE_DIMENSION_NAMES = DIMENSION_NAMES;
export const SLEEP_SIGNATURE_DIMENSION_LABELS = DIMENSION_LABELS;
