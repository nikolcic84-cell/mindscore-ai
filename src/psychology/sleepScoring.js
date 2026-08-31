// Reusable scoring engine for the Sleep Quality Assessment.
// Each question is answered on the same 5-point scale (0 = "This describes
// me very well" ... 4 = "Not true for me"). Positive statements score
// normally (0-4 -> 4-0 is reversed below); negative statements are reverse
// scored so that a higher raw agreement always lowers the sleep score.

export const MAX_POINTS_PER_QUESTION = 4;

// One entry per question, aligned by index with tests.sleep.questions.
export const SLEEP_QUESTION_DIRECTIONS = [
  "positive", // I usually wake up feeling refreshed...
  "positive", // If I wake up during the night, I usually fall back asleep easily.
  "positive", // After an emotionally difficult day, I am still able to sleep well.
  "negative", // My thoughts keep running when I am trying to fall asleep.
  "negative", // During the day, I often feel mentally tired...
  "negative", // An important event the next morning significantly affects my sleep.
  "negative", // I often wake up before my alarm and cannot fall asleep again.
  "positive", // My mind becomes clear and focused quickly after I wake up.
  "negative", // I rely on caffeine or other stimulants...
  "positive", // My body recovers quickly after my sleep schedule changes...
  "negative", // I often feel sleepy during quiet activities...
  "positive", // I am confident that my current sleep allows recovery.
];

/** Clamp any numeric score into the 0-100 range. */
export function clampScore(value) {
  const numeric = Number(value) || 0;
  return Math.min(100, Math.max(0, numeric));
}

/**
 * Converts a single answer into points (0-4) based on question direction.
 * `answerIndex` is 0-4, where 0 = "This describes me very well" and
 * 4 = "Not true for me".
 */
export function pointsForAnswer(answerIndex, direction) {
  const index = Math.min(Math.max(Number(answerIndex) || 0, 0), MAX_POINTS_PER_QUESTION);
  return direction === "negative" ? index : MAX_POINTS_PER_QUESTION - index;
}

/**
 * Computes the final 0-100 Sleep Score from an array of answer indexes
 * (0-4 per question, in question order). Returns 0 if answers are incomplete.
 */
export function calculateSleepScore(answerIndexes, directions = SLEEP_QUESTION_DIRECTIONS) {
  if (!Array.isArray(answerIndexes) || answerIndexes.length === 0) return 0;

  const total = directions.reduce((sum, direction, index) => {
    return sum + pointsForAnswer(answerIndexes[index], direction);
  }, 0);

  const maxTotal = directions.length * MAX_POINTS_PER_QUESTION;
  const percentage = maxTotal > 0 ? (total / maxTotal) * 100 : 0;

  return clampScore(Math.round(percentage));
}

// Ordered highest-to-lowest; first matching { min, max } wins. Kept as a
// standalone table so AI Subtypes can later branch off the same ranges.
export const SLEEP_PROFILE_RANGES = [
  { min: 95, max: 100, profile: "Elite Sleeper" },
  { min: 90, max: 94, profile: "Peak Recovery" },
  { min: 80, max: 89, profile: "Strong Sleeper" },
  { min: 70, max: 79, profile: "Balanced Sleeper" },
  { min: 60, max: 69, profile: "Light Recovery" },
  { min: 50, max: 59, profile: "Recovery Under Pressure" },
  { min: 40, max: 49, profile: "Sleep Struggler" },
  { min: 30, max: 39, profile: "Recovery Deficit" },
  { min: 20, max: 29, profile: "High Sleep Risk" },
  { min: 0, max: 19, profile: "Critical Recovery" },
];

/** Maps a 0-100 Sleep Score to exactly one AI Sleep Profile name. */
export function getSleepProfile(score) {
  const clamped = clampScore(score);
  const match = SLEEP_PROFILE_RANGES.find((range) => clamped >= range.min && clamped <= range.max);
  return match ? match.profile : SLEEP_PROFILE_RANGES[SLEEP_PROFILE_RANGES.length - 1].profile;
}

/** Returns the final score paired with its AI Sleep Profile, e.g. { score: 78, profile: "Balanced Sleeper" }. */
export function calculateSleepProfile(score) {
  const clamped = clampScore(score);
  return { score: clamped, profile: getSleepProfile(clamped) };
}

// --- AI Sleep Subtype engine -------------------------------------------
// Each subtype is defined as a list of signals: which question (by index,
// aligned with tests.sleep.questions) drives it, how strongly (weight),
// and whether the subtype is triggered by agreement with the statement
// (invert: false) or by disagreement with it (invert: true). This keeps
// the subtype derived purely from the answer pattern, not randomness.
export const SLEEP_SUBTYPE_RULES = {
  "Overthinker": [
    { questionIndex: 3, weight: 3 }, // racing thoughts at bedtime
    { questionIndex: 5, weight: 2 }, // next-day events disrupt sleep
    { questionIndex: 2, weight: 1, invert: true }, // struggles to sleep after emotional days
  ],
  "Night Owl": [
    { questionIndex: 7, weight: 3, invert: true }, // slow to feel clear/focused after waking
    { questionIndex: 0, weight: 1, invert: true }, // doesn't wake up feeling refreshed
  ],
  "Early Waker": [
    { questionIndex: 6, weight: 4 }, // wakes before the alarm and can't fall back asleep
  ],
  "Restless Sleeper": [
    { questionIndex: 1, weight: 3, invert: true }, // struggles to fall back asleep after waking
    { questionIndex: 10, weight: 1 }, // sleepy during quiet daytime activities
  ],
  "Light Sleeper": [
    { questionIndex: 10, weight: 3 }, // sleepy during quiet daytime activities
    { questionIndex: 1, weight: 2, invert: true }, // easily disturbed during the night
  ],
  "Deep Sleeper": [
    { questionIndex: 0, weight: 3 }, // wakes up refreshed
    { questionIndex: 7, weight: 2 }, // clear and focused quickly after waking
    { questionIndex: 11, weight: 1 }, // confident sleep supports recovery
  ],
  "Stress Responder": [
    { questionIndex: 2, weight: 3, invert: true }, // emotional stress disrupts that night's sleep
    { questionIndex: 5, weight: 2 }, // next-day events affect sleep
  ],
  "Recovery Optimizer": [
    { questionIndex: 4, weight: 3 }, // daytime fatigue despite enough sleep
    { questionIndex: 8, weight: 2 }, // relies on caffeine/stimulants
  ],
  "Consistent Sleeper": [
    { questionIndex: 9, weight: 3 }, // recovers quickly after schedule changes
    { questionIndex: 11, weight: 1 }, // confident sleep supports recovery
    { questionIndex: 0, weight: 1 }, // wakes up refreshed
  ],
  "Weekend Catch-Up": [
    { questionIndex: 9, weight: 3, invert: true }, // slow to recover after schedule changes
    { questionIndex: 4, weight: 2 }, // accumulated daytime fatigue
  ],
};

const NEUTRAL_ANSWER_INDEX = 2; // "Sometimes true" - used when an answer is missing/invalid

/** Converts a single answer index (0-4) into a 0-4 signal strength for a rule. */
function ruleSignalStrength(answerIndexes, { questionIndex, invert }) {
  const raw = answerIndexes[questionIndex];
  const index = Math.min(Math.max(Number.isFinite(Number(raw)) ? Number(raw) : NEUTRAL_ANSWER_INDEX, 0), MAX_POINTS_PER_QUESTION);
  return invert ? index : MAX_POINTS_PER_QUESTION - index;
}

/** Weighted match ratio (0-1) between a subtype's rules and the given answers. */
function scoreSubtype(rules, answerIndexes) {
  let weightedTotal = 0;
  let maxPossible = 0;

  rules.forEach((rule) => {
    weightedTotal += ruleSignalStrength(answerIndexes, rule) * rule.weight;
    maxPossible += MAX_POINTS_PER_QUESTION * rule.weight;
  });

  return maxPossible > 0 ? weightedTotal / maxPossible : 0;
}

/**
 * Determines the single strongest AI Sleep Subtype from the answer pattern,
 * together with an AI Confidence percentage (how strongly the answers match
 * that subtype's rules, 0-100). `answerIndexes` are 0-4 per question, in
 * question order. Always returns exactly one subtype (ties broken by
 * declaration order above).
 */
export function getSleepSubtypeMatch(answerIndexes, rules = SLEEP_SUBTYPE_RULES) {
  const answers = Array.isArray(answerIndexes) ? answerIndexes : [];

  let bestSubtype = null;
  let bestRatio = -Infinity;

  Object.entries(rules).forEach(([subtype, subtypeRules]) => {
    const ratio = scoreSubtype(subtypeRules, answers);
    if (ratio > bestRatio) {
      bestRatio = ratio;
      bestSubtype = subtype;
    }
  });

  return {
    subtype: bestSubtype,
    confidence: clampScore(Math.round((bestRatio === -Infinity ? 0 : bestRatio) * 100)),
  };
}

/** Determines the single strongest AI Sleep Subtype from the answer pattern. */
export function getSleepSubtype(answerIndexes, rules = SLEEP_SUBTYPE_RULES) {
  return getSleepSubtypeMatch(answerIndexes, rules).subtype;
}

/**
 * Full reusable result for the Sleep Assessment: final score, AI Sleep
 * Profile, AI Sleep Subtype, and AI Confidence, derived entirely from the
 * answer pattern.
 * e.g. { score: 78, profile: "Balanced Sleeper", subtype: "Overthinker", confidence: 92 }
 */
export function calculateSleepResult(answerIndexes) {
  const score = calculateSleepScore(answerIndexes);
  const { subtype, confidence } = getSleepSubtypeMatch(answerIndexes);
  return {
    score,
    profile: getSleepProfile(score),
    subtype,
    confidence,
  };
}
