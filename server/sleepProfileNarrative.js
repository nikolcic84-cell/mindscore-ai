const NARRATIVE_VERSION = "sleep-profile-ai-v1";
const MODEL = "gpt-5-mini";
const TIMEOUT_MS = 12_000;

const REQUIRED_FIELDS = ["profileSummary", "whatsWorking", "mainFocus", "whereToStart", "puttingItTogether"];
const FIELD_LIMITS = {
  profileSummary: 520,
  whatsWorking: 300,
  mainFocus: 300,
  whereToStart: 300,
  puttingItTogether: 520,
};
const UNSAFE_PATTERN = /\b(insomnia|sleep apnea|depression|anxiety disorder|diagnosed|diagnosis|medication|medicine|prescription|cure|guarantee|clinical disorder)\b/i;
const UNRELATED_PATTERN = /\b(recipe|investment|crypto|vacation|workout plan|diet plan)\b/i;

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
  const secondStrongest = rankedHigh[1] || strongest;
  const weakest = rankedLow[0] || null;
  const secondWeakest = rankedLow[1] || weakest;

  return {
    assessmentType: "Sleep Quality",
    overallScore,
    dimensions: dimensions.map((dimension) => ({ name: dimension.name, score: dimension.score })),
    profile: {
      strongest,
      secondStrongest,
      weakest,
      secondWeakest,
      spread: strongest && weakest ? strongest.score - weakest.score : 0,
      priorityDimension: weakest?.name || "",
    },
    answerSignals: buildSleepAnswerSignals(assessment.answers || []),
  };
};

const parseJson = (text) => {
  const raw = safeText(text);
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("AI response did not contain JSON.");
  return JSON.parse(match[0]);
};

export const validateSleepProfileNarrative = (candidate, payload) => {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return { valid: false, fields: {}, reason: "Narrative is not an object." };
  }

  const fields = {};
  const invalid = [];
  const allowedScores = new Set([
    String(payload.overallScore),
    ...payload.dimensions.map((dimension) => String(dimension.score)),
  ]);
  REQUIRED_FIELDS.forEach((field) => {
    const value = safeText(candidate[field]);
    const mentionedScores = [...value.matchAll(/\b(\d{1,3})\s*\/\s*100\b/g)].map((match) => match[1]);
    const mentionsWrongScore = mentionedScores.some((score) => !allowedScores.has(score));
    if (!value || value.length > FIELD_LIMITS[field] || UNSAFE_PATTERN.test(value) || UNRELATED_PATTERN.test(value) || mentionsWrongScore) {
      invalid.push(field);
      return;
    }
    fields[field] = value;
  });

  return {
    valid: invalid.length === 0,
    fields,
    reason: invalid.length ? `Invalid fields: ${invalid.join(", ")}` : "ok",
  };
};

const withTimeout = async (promise, timeoutMs = TIMEOUT_MS) => {
  let timerId;
  const timeout = new Promise((_, reject) => {
    timerId = setTimeout(() => reject(new Error("AI narrative request timed out.")), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timerId);
  }
};

export const generateSleepProfileNarrative = async ({ openaiClient, payload, apiKeyAvailable = false }) => {
  if (!apiKeyAvailable || !openaiClient) {
    return { status: "fallback", fields: {}, reason: "OPENAI_API_KEY is missing." };
  }

  const response = await withTimeout(
    openaiClient.responses.create({
      model: MODEL,
      max_output_tokens: 1200,
      input: [
        "You generate ONLY concise JSON for a consumer sleep self-assessment report.",
        "Use only the supplied scores and answer signals. Do not diagnose, recommend medication, invent statistics, or change scores.",
        "Use plain English. Prefer phrases such as 'your results suggest' and 'may be worth observing'.",
        "Return exactly this JSON shape with string values: {\"profileSummary\":\"...\",\"whatsWorking\":\"...\",\"mainFocus\":\"...\",\"whereToStart\":\"...\",\"puttingItTogether\":\"...\"}.",
        `Assessment data: ${JSON.stringify(payload)}`,
      ].join("\n"),
    })
  );

  try {
    const parsed = parseJson(response.output_text || "");
    const validation = validateSleepProfileNarrative(parsed, payload);
    return validation.valid
      ? { status: "ok", fields: validation.fields, reason: "ok" }
      : { status: "fallback", fields: validation.fields, reason: validation.reason };
  } catch (error) {
    return { status: "fallback", fields: {}, reason: error.message };
  }
};

export { NARRATIVE_VERSION as SLEEP_PROFILE_NARRATIVE_VERSION, MODEL as SLEEP_PROFILE_NARRATIVE_MODEL };