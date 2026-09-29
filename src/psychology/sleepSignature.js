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
  Object.freeze({ question: 6, dimension: "sleepOnset", valuesByAnswerIndex: [4, 3, 2, 1, 0] }),
  Object.freeze({ question: 7, dimension: "sleepOnset", valuesByAnswerIndex: [4, 3, 2, 1, 0] }),
  Object.freeze({ question: 8, dimension: "recovery", valuesByAnswerIndex: [4, 3, 2, 1, 0] }),
  Object.freeze({ question: 9, dimension: "rhythm", valuesByAnswerIndex: [4, 3, 2, 1, 0] }),
  Object.freeze({ question: 10, dimension: "rhythm", valuesByAnswerIndex: [4, 3, 2, 1, 0] }),
  Object.freeze({ question: 11, dimension: "recovery", valuesByAnswerIndex: [4, 3, 2, 1, 0] }),
  Object.freeze({ question: 12, dimension: "continuity", valuesByAnswerIndex: [4, 3, 2, 1, 0] }),
]);

export const SLEEP_SIGNATURE_THRESHOLDS = Object.freeze({
  good: 0.70,
  mixed: 0.45,
  weakBelow: 0.45,
});

const DIMENSION_ORDER = ["recovery", "sleepOnset", "continuity", "rhythm"];
const CORE_DIMENSIONS = ["recovery", "sleepOnset", "continuity"];
const DIMENSION_NAMES = Object.freeze({
  recovery: "Oporavak",
  sleepOnset: "Uspavljivanje",
  continuity: "Kontinuitet sna",
  rhythm: "Ritam sna",
});
const DIMENSION_QUESTION_INDICES = Object.freeze({
  recovery: Object.freeze([0, 3, 7, 10]),
  sleepOnset: Object.freeze([1, 5, 6]),
  continuity: Object.freeze([2, 11]),
  rhythm: Object.freeze([4, 8, 9]),
});

const SIGNATURES = Object.freeze({
  tired_waking: {
    signature: "UMORAN SAN",
    shortText: "Odgovori ukazuju da oporavak tokom sna trenutno ne donosi dovoljno odmora.",
  },
  awake_mind: {
    signature: "BUDAN UM",
    shortText: "Uspavljivanje i smirivanje misli trenutno su oblasti kojima vredi posvetiti pažnju.",
  },
  fragmented_night: {
    signature: "ISPREKIDAN SAN",
    shortText: "Odgovori ukazuju da kontinuitet sna trenutno zaslužuje pažnju.",
  },
  sleep_under_pressure: {
    signature: "SAN POD PRITISKOM",
    shortText: "Tvoji odgovori daju mešovitu sliku kojoj vredi pristupiti korak po korak.",
  },
  calm_night: {
    signature: "MIRNA NOĆ",
    shortText: "Osnovne oblasti sna deluju stabilno; ritam i navike mogu pružiti dodatni kontekst.",
  },
});

const SIGNATURE_KEYS = Object.freeze({
  tired_waking: "tired_waking",
  awake_mind: "awake_mind",
  fragmented_night: "fragmented_night",
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
  return Math.min(1, Math.max(0, value / 4));
}

export function getSleepDimensionSeverity(score) {
  if (score >= SLEEP_SIGNATURE_THRESHOLDS.good) return "stable";
  if (score >= SLEEP_SIGNATURE_THRESHOLDS.mixed) return "mixed";
  return "weak";
}

const hasCalmNightCorePattern = (scores) => {
  const values = CORE_DIMENSIONS.map((key) => scores[key]);
  const goodCount = values.filter((score) => score >= SLEEP_SIGNATURE_THRESHOLDS.good).length;
  const allGood = goodCount === CORE_DIMENSIONS.length;
  const twoGoodAndBalanced =
    goodCount >= 2 &&
    values.every((score) => score >= 0.55) &&
    values.reduce((sum, score) => sum + score, 0) / values.length >= SLEEP_SIGNATURE_THRESHOLDS.good;

  return allGood || twoGoodAndBalanced;
};

const getTiedDimensionKeys = (scores, keys, targetScore) =>
  keys.filter((key) => scores[key] === targetScore);

const formatTiedAreas = (keys) => {
  if (keys.length === 1) return DIMENSION_NAMES[keys[0]];
  return "Više oblasti deli isti rezultat";
};

export function classifySleepDimensions(scores, supportingSignals = {}) {
  const thresholds = SLEEP_SIGNATURE_THRESHOLDS;
  const weakCoreDimensions = CORE_DIMENSIONS.filter((key) => scores[key] < thresholds.weakBelow);
  const strongestScore = Math.max(...DIMENSION_ORDER.map((key) => scores[key]));
  const weakestScore = Math.min(...DIMENSION_ORDER.map((key) => scores[key]));
  const strongestDimensionKeys = getTiedDimensionKeys(scores, DIMENSION_ORDER, strongestScore);
  const weakestDimensionKeys = getTiedDimensionKeys(scores, DIMENSION_ORDER, weakestScore);
  const q6StronglyNegative = supportingSignals.q6Value <= 1;
  const q12StronglyNegative = supportingSignals.q12Value <= 1;
  const calmPattern = hasCalmNightCorePattern(scores);
  const calmVeto = q6StronglyNegative || q12StronglyNegative;

  let signatureKey;
  let triggeredRule;
  let mainAreaType;

  if (calmPattern && !calmVeto) {
    signatureKey = SIGNATURE_KEYS.calm_night;
    triggeredRule = "core_calm_criteria_met_without_q6_q12_veto";
    mainAreaType = "none";
  } else {
    if (weakCoreDimensions.length >= 2) {
      signatureKey = SIGNATURE_KEYS.sleep_under_pressure;
      triggeredRule = "two_or_more_core_dimensions_weak";
      mainAreaType = "multiple_weak";
    } else if (weakCoreDimensions.length === 1) {
      const signatureByDimension = {
        recovery: SIGNATURE_KEYS.tired_waking,
        sleepOnset: SIGNATURE_KEYS.awake_mind,
        continuity: SIGNATURE_KEYS.fragmented_night,
      };
      signatureKey = signatureByDimension[weakCoreDimensions[0]];
      triggeredRule = `exactly_one_weak_core_dimension_${weakCoreDimensions[0]}`;
      mainAreaType = "single_weak_core";
    } else {
      signatureKey = SIGNATURE_KEYS.sleep_under_pressure;
      if (calmVeto) {
        triggeredRule = q6StronglyNegative && q12StronglyNegative
          ? "calm_veto_q6_and_q12_with_no_single_weak_core_area"
          : q6StronglyNegative
          ? "calm_veto_q6_with_no_single_weak_core_area"
          : "calm_veto_q12_with_no_single_weak_core_area";
        mainAreaType = "supporting_warning";
      } else if (scores.rhythm < thresholds.weakBelow) {
        triggeredRule = "core_not_calm_rhythm_weak_no_rhythm_primary_profile";
        mainAreaType = "rhythm_secondary";
      } else {
        triggeredRule = "no_weak_core_but_calm_criteria_not_met";
        mainAreaType = "mixed_pattern";
      }
    }
  }

  const secondaryInsights = [];
  if (scores.rhythm < thresholds.weakBelow) {
    secondaryInsights.push({ key: "rhythm", text: "Tvoj ritam spavanja je promenljiv." });
  }
  if (scores.rhythm >= thresholds.weakBelow && scores.rhythm < thresholds.good) {
    secondaryInsights.push({ key: "rhythm_mixed", text: "Tvoj ritam spavanja se donekle menja." });
  }
  if (q6StronglyNegative) {
    secondaryInsights.push({ key: "evening_habit", text: "Tvoja večernja navika pre spavanja može biti vredna pažnje." });
  }
  if (q12StronglyNegative) {
    secondaryInsights.push({ key: "recent_sleep_signal", text: "Tvoj odgovor o poslednjim noćima pokazuje da ti san trenutno ne prija." });
  }

  const mainArea = signatureKey === SIGNATURE_KEYS.calm_night
    ? "Nijedna oblast se ne izdvaja kao jasna slaba tačka."
    : mainAreaType === "single_weak_core"
    ? DIMENSION_NAMES[weakCoreDimensions[0]]
    : mainAreaType === "multiple_weak"
    ? "Kombinacija više faktora"
    : mainAreaType === "supporting_warning"
    ? "Podržavajući odgovor traži pažnju"
    : mainAreaType === "rhythm_secondary"
    ? "Osnovne oblasti sna su mešovite; ritam se izdvaja kao dodatna tema"
    : "Mešovit obrazac bez jedne jasne oblasti";

  return {
    signatureKey,
    strongestArea: formatTiedAreas(strongestDimensionKeys),
    strongestAreas: strongestDimensionKeys.map((key) => DIMENSION_NAMES[key]),
    weakestArea: formatTiedAreas(weakestDimensionKeys),
    weakestAreas: weakestDimensionKeys.map((key) => DIMENSION_NAMES[key]),
    mainArea,
    mainAreaType,
    weakCoreDimensions,
    q6StronglyNegative,
    q12StronglyNegative,
    secondaryInsights,
    internalScores: scores,
    triggeredRule,
  };
}

/**
 * Classify exactly 12 selected answer indexes (0-4, selected option order).
 * Returns null for incomplete/invalid input. All 12 answers contribute to a
 * clamped 0-1 dimension score; scores are not rounded before classification.
 * Supporting signals are optional for direct dimension-only callers; omitted
 * Q6/Q12 values do not veto MIRNA NOĆ.
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
  const selectedAnswerText = (questionIndex) => answerTexts[questionIndex] || null;
  const classified = classifySleepDimensions(internalScores, {
    q6Value: questionScores[5],
    q12Value: questionScores[11],
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
    strongestAreas: classified.strongestAreas,
    weakestArea: classified.weakestArea,
    weakestAreas: classified.weakestAreas,
    mainArea: classified.mainArea,
    mainAreaType: classified.mainAreaType,
    weakCoreDimensions: classified.weakCoreDimensions,
    q6StronglyNegative: classified.q6StronglyNegative,
    q12StronglyNegative: classified.q12StronglyNegative,
    supportingSignals: [
      {
        key: "supporting_habit",
        question: 6,
        response: selectedAnswerText(5),
        internalScore: questionScores[5],
        alsoContributesTo: "sleepOnset",
        secondaryInsight: classified.secondaryInsights.find((insight) => insight.key === "evening_habit")?.text || null,
      },
      {
        key: "continuity_context",
        question: 12,
        response: selectedAnswerText(11),
        internalScore: questionScores[11],
        alsoContributesTo: "continuity",
        secondaryInsight: classified.secondaryInsights.find((insight) => insight.key === "recent_sleep_signal")?.text || null,
      },
    ],
    secondaryInsights: classified.secondaryInsights,
    questionValues: questionScores,
    dimensionQuestionIndices: DIMENSION_QUESTION_INDICES,
    internalScores: classified.internalScores,
    triggeredRule: classified.triggeredRule,
  };
}

export const SLEEP_SIGNATURE_DIMENSION_NAMES = DIMENSION_NAMES;
export const SLEEP_SIGNATURE_DIMENSION_LABELS = DIMENSION_LABELS;
export const SLEEP_SIGNATURE_DIMENSION_QUESTION_INDICES = DIMENSION_QUESTION_INDICES;
