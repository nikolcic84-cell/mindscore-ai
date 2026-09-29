import { makeParseableTextFormat } from "openai/lib/parser.js";

const NARRATIVE_VERSION = "sleep-profile-ai-v3";
const MODEL = "gpt-5-mini";
const TIMEOUT_MS = 20_000;
const MAX_OUTPUT_TOKENS = 5000;

const DIMENSION_KEYS = [
  "sleepRecovery",
  "sleepContinuity",
  "cognitiveWindDown",
  "daytimeClarity",
  "sleepConsistency",
];

const DIMENSION_NAMES = {
  sleepRecovery: "Sleep Recovery",
  sleepContinuity: "Sleep Continuity",
  cognitiveWindDown: "Cognitive Wind-Down",
  daytimeClarity: "Daytime Clarity",
  sleepConsistency: "Sleep Consistency",
};

const NARRATIVE_FIELDS = [
  "scoreSuggests",
  "whyThisMatters",
  "mayBeHelping",
  "mayBeGettingInWay",
  "inRealLife",
  "oneThingToTry",
  "whatToNotice",
  "nextStep",
];

const DIMENSION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: Object.fromEntries(NARRATIVE_FIELDS.map((field) => [field, { type: "string" }])),
  required: NARRATIVE_FIELDS,
};

const FULL_REPORT_SCHEMA = {
  type: "json_schema",
  name: "sleep_premium_dimension_narrative",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      dimensions: {
        type: "object",
        additionalProperties: false,
        properties: Object.fromEntries(DIMENSION_KEYS.map((key) => [key, DIMENSION_SCHEMA])),
        required: DIMENSION_KEYS,
      },
      sleepProfile: {
        type: "object",
        additionalProperties: false,
        properties: {
          profileSummary: { type: "string" },
          whatsWorking: { type: "string" },
          mainFocus: { type: "string" },
          whereToStart: { type: "string" },
          puttingItTogether: { type: "string" },
        },
        required: ["profileSummary", "whatsWorking", "mainFocus", "whereToStart", "puttingItTogether"],
      },
    },
    required: ["dimensions", "sleepProfile"],
  },
};

const FIELD_LIMITS = {
  profileSummary: 320,
  whatsWorking: 180,
  mainFocus: 180,
  whereToStart: 180,
  puttingItTogether: 320,
  scoreSuggests: 300,
  whyThisMatters: 300,
  mayBeHelping: 260,
  mayBeGettingInWay: 260,
  inRealLife: 300,
  oneThingToTry: 220,
  whatToNotice: 260,
  nextStep: 220,
};

const UNSAFE_PATTERN = /\b(insomnia|sleep apnea|depression|anxiety disorder|diagnosed|diagnosis|medication|medicine|prescription|cure|guarantee|clinical disorder)\b/i;
const UNRELATED_PATTERN = /\b(recipe|investment|crypto|vacation|workout plan|diet plan)\b/i;
const INTERNAL_KEY_PATTERN = /\b(sleepRecovery|sleepContinuity|cognitiveWindDown|daytimeClarity|sleepConsistency)\b/i;

const DIMENSION_SIGNAL_KEYS = {
  sleepRecovery: ["morningRestoration", "stressSleepRecovery", "confidenceInRecovery"],
  sleepContinuity: ["fallsBackAsleep", "earlyWaking", "nextDayEventDisruption"],
  cognitiveWindDown: ["racingThoughtsAtBedtime", "nextDayEventDisruption"],
  daytimeClarity: ["daytimeFatigue", "morningClarity", "caffeineReliance", "quietActivitySleepiness"],
  sleepConsistency: ["scheduleRecovery"],
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const safeText = (value) => (typeof value === "string" ? value.trim() : "");

const answerLevel = (points, positive = true) => {
  const score = clamp(Number(points) || 3, 1, 5);
  const strength = positive ? score : 6 - score;
  if (strength >= 4) return "supportive";
  if (strength <= 2) return "challenging";
  return "mixed";
};

export const buildSleepAnswerSignals = (answers = []) => ({
  morningRestoration: answerLevel(answers[0], true),
  fallsBackAsleep: answerLevel(answers[1], true),
  stressSleepRecovery: answerLevel(answers[2], true),
  racingThoughtsAtBedtime: answerLevel(answers[3], false),
  daytimeFatigue: answerLevel(answers[4], false),
  nextDayEventDisruption: answerLevel(answers[5], false),
  earlyWaking: answerLevel(answers[6], false),
  morningClarity: answerLevel(answers[7], true),
  caffeineReliance: answerLevel(answers[8], false),
  scheduleRecovery: answerLevel(answers[9], true),
  quietActivitySleepiness: answerLevel(answers[10], false),
  confidenceInRecovery: answerLevel(answers[11], true),
});

export const buildSleepProfilePayload = ({ assessment = {}, dimensions = [], overallScore = 0 }) => {
  const rankedHigh = [...dimensions].sort((a, b) => b.score - a.score);
  const rankedLow = [...dimensions].sort((a, b) => a.score - b.score);
  const strongest = rankedHigh[0] || null;
  const weakest = rankedLow[0] || null;
  const answerSignals = buildSleepAnswerSignals(assessment.answers || []);
  const keyedDimensions = Object.fromEntries(
    DIMENSION_KEYS.map((key) => {
      const source = dimensions.find((dimension) => dimension.name === DIMENSION_NAMES[key]) || {};
      const relevantSignals = Object.fromEntries(
        DIMENSION_SIGNAL_KEYS[key].map((signalKey) => [signalKey, answerSignals[signalKey]])
      );
      return [key, { score: Number(source.score) || 0, relevantSignals }];
    })
  );

  return {
    overallScore: Number(overallScore) || 0,
    dimensions: keyedDimensions,
    strongestDimension: strongest?.name || "",
    priorityDimension: weakest?.name || "",
    profileSpread: strongest && weakest ? strongest.score - weakest.score : 0,
  };
};

export const buildSleepReportPayload = (input) => buildSleepProfilePayload(input);

const validateText = (value, limit, allowedScores, signals) => {
  const text = safeText(value);
  const mentionedScores = [...text.matchAll(/\b(\d{1,3})\s*\/\s*100\b/g)].map((match) => match[1]);
  const unsupportedScreenClaim = /\b(screen|phone|mobile|tablet|scrolling)\b/i.test(text) && !Object.prototype.hasOwnProperty.call(signals, "screenUse");
  const unsupportedCaffeineClaim = /\b(caffeine|stimulant)/i.test(text) && !Object.prototype.hasOwnProperty.call(signals, "caffeineReliance");
  if (
    !text ||
    text.length > limit ||
    UNSAFE_PATTERN.test(text) ||
    UNRELATED_PATTERN.test(text) ||
    INTERNAL_KEY_PATTERN.test(text) ||
    mentionedScores.some((score) => !allowedScores.has(score)) ||
    unsupportedScreenClaim ||
    unsupportedCaffeineClaim
  ) return "invalid";
  return text;
};

export const validateSleepReportNarrative = (candidate, payload) => {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return { valid: false, fields: {}, reason: "Narrative is not an object." };
  }

  const allowedScores = new Set([
    String(payload.overallScore),
    ...Object.values(payload.dimensions || {}).map((dimension) => String(dimension.score)),
  ]);
  const invalid = [];
  const check = (path, value, limit, signals = {}) => {
    if (validateText(value, limit, allowedScores, signals) === "invalid") invalid.push(path);
  };

  const profile = candidate.sleepProfile || {};
  check("sleepProfile.profileSummary", profile.profileSummary, FIELD_LIMITS.profileSummary);
  check("sleepProfile.whatsWorking", profile.whatsWorking, FIELD_LIMITS.whatsWorking);
  check("sleepProfile.mainFocus", profile.mainFocus, FIELD_LIMITS.mainFocus);
  check("sleepProfile.whereToStart", profile.whereToStart, FIELD_LIMITS.whereToStart);
  check("sleepProfile.puttingItTogether", profile.puttingItTogether, FIELD_LIMITS.puttingItTogether);

  const dimensions = candidate.dimensions || {};
  DIMENSION_KEYS.forEach((key) => {
    const dimension = dimensions[key] || {};
    const signals = payload.dimensions?.[key]?.relevantSignals || {};
    NARRATIVE_FIELDS.forEach((field) => check(`dimensions.${key}.${field}`, dimension[field], FIELD_LIMITS[field], signals));
  });

  if (invalid.length) return { valid: false, fields: {}, reason: `Invalid fields: ${invalid.slice(0, 8).join(", ")}` };
  return { valid: true, fields: candidate, reason: "ok" };
};

const withTimeout = async (requestFactory, timeoutMs = TIMEOUT_MS) => {
  const controller = new AbortController();
  let timerId;
  try {
    return await new Promise((resolve, reject) => {
      timerId = setTimeout(() => {
        controller.abort();
        reject(new Error("AI narrative request timed out."));
      }, timeoutMs);
      requestFactory(controller.signal).then(resolve, reject);
    });
  } finally {
    clearTimeout(timerId);
  }
};

export const generateSleepProfileNarrative = async ({ openaiClient, payload, apiKeyAvailable = false }) => {
  if (!apiKeyAvailable || !openaiClient) {
    return { status: "fallback", fields: {}, reason: "OPENAI_API_KEY is missing." };
  }

  let response;
  try {
    response = await withTimeout((signal) =>
      openaiClient.responses.parse(
        {
          model: MODEL,
          max_output_tokens: MAX_OUTPUT_TOKENS,
          text: { format: makeParseableTextFormat(FULL_REPORT_SCHEMA, JSON.parse) },
          input: [
            "Generate only the five dimension narratives and sleep profile fields in the exact supplied JSON schema. Do not generate an action plan, scores, charts, disclaimers, or payment content.",
            "For every dimension, tie the explanation to its supplied score and relevantSignals. Explain concrete relationships between the signals and that dimension. Two users with the same score but different signals must receive different explanations when the evidence differs.",
            "Use human-readable dimension names in prose. Never expose internal identifiers such as sleepRecovery, sleepContinuity, cognitiveWindDown, daytimeClarity, or sleepConsistency.",
            "Use plain, natural, professional English and cautious language. Never diagnose, recommend medication, invent facts/statistics, alter scores, or infer behaviors that are not represented in the supplied relevantSignals.",
            "Keep every field concise enough for the existing PDF layout. Avoid generic filler such as 'try one small experiment' without naming the concrete signal or behavior supported by the input.",
            `Structured assessment data: ${JSON.stringify(payload)}`,
          ].join("\n"),
        },
        { signal }
      )
    );
  } catch (error) {
    return { status: "fallback", fields: {}, reason: error.message };
  }

  try {
    if (response.incomplete_details) return { status: "fallback", fields: {}, reason: `AI response incomplete: ${response.incomplete_details.reason || "unknown"}.` };
    if (response.status !== "completed") return { status: "fallback", fields: {}, reason: `AI response status: ${response.status || "unknown"}.` };
    if (!response.output_parsed) return { status: "fallback", fields: {}, reason: "AI response did not contain parsed JSON." };

    const validation = validateSleepReportNarrative(response.output_parsed, payload);
    return validation.valid
      ? { status: "ok", fields: validation.fields, reason: "ok" }
      : { status: "fallback", fields: {}, reason: validation.reason };
  } catch (error) {
    return { status: "fallback", fields: {}, reason: error.message };
  }
};

export { NARRATIVE_VERSION as SLEEP_PROFILE_NARRATIVE_VERSION, MODEL as SLEEP_PROFILE_NARRATIVE_MODEL };
