import { SLEEP_PREMIUM_DIMENSION_KEYS, SLEEP_PREMIUM_PROFILE_NAMES } from "./sleepPremiumInput.js";

const CORE_DIMENSIONS = ["recovery", "sleepOnset", "continuity"];
const DIMENSION_TITLES = Object.freeze({
  recovery: "Osećaj po buđenju",
  sleepOnset: "Period pre sna",
  continuity: "Tok noći",
  rhythm: "Vreme spavanja i buđenja",
  multiple: "Više delova tvoje noći",
  whole: "Tvoj san u celini",
});
const COPY_LIMITS = Object.freeze({
  profileExplanation: 700,
  priorityExplanation: 700,
  connection: 500,
  stableOrTracking: 350,
  planAction: 300,
  planObserve: 250,
  alternative: 350,
  reviewQuestion: 200,
  afterSevenDays: 500,
  closing: 350,
});
const REPORT_KEYS = [
  "version", "profile", "profile_explanation", "priority", "connections", "stable_or_tracking",
  "seven_day_plan", "alternatives", "review_questions", "after_seven_days", "closing",
];

const keysEqual = (value, expected) =>
  Boolean(value && typeof value === "object" && !Array.isArray(value)) &&
  Object.keys(value).length === expected.length &&
  expected.every((key) => Object.prototype.hasOwnProperty.call(value, key));

const safeShape = (value) => {
  if (value === null) return { type: "null" };
  if (Array.isArray(value)) return { type: "array", length: value.length };
  if (typeof value === "string") return { type: "string", length: value.length, blank: value.trim().length === 0 };
  if (typeof value === "number") return { type: Number.isInteger(value) ? "integer" : "number" };
  if (typeof value === "object") return { type: "object", keyCount: Object.keys(value).length };
  return { type: typeof value };
};
const invalid = (field, expected, received, reason) => ({
  valid: false,
  reason,
  diagnostic: { field, expected, received: safeShape(received) },
});
const textSchema = (maxLength) => ({ type: "string", minLength: 1, maxLength, pattern: "\\S" });
const arraySchema = (minItems, maxItems, items) => ({ type: "array", minItems, maxItems, items });
const objectSchema = (properties) => ({
  type: "object",
  additionalProperties: false,
  properties,
  required: Object.keys(properties),
});
const fixedTextSchema = (value) => ({ type: "string", enum: [value] });

export const getSleepPremiumStrengthMode = (input) =>
  SLEEP_PREMIUM_DIMENSION_KEYS.some((key) => input?.dimensions?.[key]?.state === "STABLE")
    ? "stable"
    : "tracking";

export const getSleepPremiumPriority = (input) => {
  const weakCore = CORE_DIMENSIONS.filter((key) => input?.dimensions?.[key]?.state === "WEAK");
  if (weakCore.length === 1) return { key: weakCore[0], title: DIMENSION_TITLES[weakCore[0]] };
  if (weakCore.length > 1) {
    const minScore = Math.min(...weakCore.map((key) => input.dimensions[key].score));
    const lowest = weakCore.filter((key) => input.dimensions[key].score === minScore);
    if (lowest.length === 1) return { key: lowest[0], title: DIMENSION_TITLES[lowest[0]] };
    return { key: "multiple", title: DIMENSION_TITLES.multiple };
  }

  const q6 = input?.answers?.find((answer) => answer.questionId === "Q6")?.mappedValue;
  const q12 = input?.answers?.find((answer) => answer.questionId === "Q12")?.mappedValue;
  if (q6 <= 1) return { key: "sleepOnset", title: DIMENSION_TITLES.sleepOnset };
  if (q12 <= 1) return { key: "continuity", title: DIMENSION_TITLES.continuity };

  const rhythm = input?.dimensions?.rhythm;
  if (
    rhythm && rhythm.state !== "STABLE" &&
    CORE_DIMENSIONS.every((key) => input.dimensions[key].score > rhythm.score)
  ) return { key: "rhythm", title: DIMENSION_TITLES.rhythm };

  return { key: "whole", title: DIMENSION_TITLES.whole };
};

export const getSleepPremiumAreaOverview = (input) => {
  const priorityKey = getSleepPremiumPriority(input).key;
  const labels = Object.freeze({
    sleepOnset: "USPAVLJIVANJE",
    continuity: "TOK NOĆI",
    recovery: "OSEĆAJ UJUTRU",
    rhythm: "RITAM",
  });
  return SLEEP_PREMIUM_DIMENSION_KEYS.map((key) => {
    const state = input.dimensions[key].state;
    return {
      key,
      title: labels[key],
      status: state === "STABLE" ? "Deluje mirnije"
        : key === priorityKey || (priorityKey === "multiple" && state === "WEAK") ? "Ovde se najviše izdvaja"
          : "Vredi pratiti",
    };
  });
};

const customerText = (maxLength, description) => ({ ...textSchema(maxLength), description });

const makeSchema = (input) => {
  const stableMode = getSleepPremiumStrengthMode(input);
  const priority = getSleepPremiumPriority(input);
  return objectSchema({
    version: { type: "integer", enum: [2] },
    profile: { type: "string", enum: [input.profile] },
    profile_explanation: customerText(COPY_LIMITS.profileExplanation, "At most two short personalized Serbian paragraphs about what this deterministic profile means for this person. MUST include at least one complete selected answer copied verbatim, character for character, in Serbian quotation marks. Paraphrased evidence is invalid. Do not repeat generic Free-result profile text."),
    priority: objectSchema({
      title: fixedTextSchema("TVOJ PRIORITET #1"),
      area: { type: "string", enum: [priority.title] },
      explanation: customerText(COPY_LIMITS.priorityExplanation, "Briefly explain why the fixed deterministic priority is the sensible first focus using supplied answers and at least one complete exact answer quote. Do not diagnose or claim a cause."),
    }),
    connections: arraySchema(2, 4, objectSchema({
      questionIds: arraySchema(2, 2, { type: "string", enum: input.answers.map(({ questionId }) => questionId) }),
      text: customerText(COPY_LIMITS.connection, "Write a natural, concise Serbian observation supported by the two selected answers identified by questionIds. Do not include or display question IDs. Do not claim that one answer causes the other."),
    })),
    stable_or_tracking: objectSchema({
      mode: { type: "string", enum: [stableMode] },
      title: fixedTextSchema(stableMode === "stable" ? "ŠTA VREDI DA ZADRŽIŠ" : "ŠTA JOŠ VREDI DA PRATIŠ"),
      items: arraySchema(1, 2, customerText(COPY_LIMITS.stableOrTracking, "When mode is stable, describe only an actually STABLE deterministic area. When mode is tracking, describe an uncertainty to observe, never an invented strength.")),
    }),
    seven_day_plan: arraySchema(7, 7, objectSchema({
      day: { type: "integer", minimum: 1, maximum: 7 },
      action: customerText(COPY_LIMITS.planAction, `One concrete small action that explicitly names the fixed priority “${priority.title}” or clearly describes that exact topic in natural Serbian. Each of the seven actions must independently state the connection; do not rely on the section heading or surrounding days. Progress naturally: day 1 baseline, day 2 introduce one small step, day 3 repeat, day 4 compare, day 5 slight adjustment within this same priority, day 6 repeat a manageable step, day 7 review. No unrelated sleep tips, treatment, or promised outcome.`),
      observe: customerText(COPY_LIMITS.planObserve, `One simple observation that explicitly names the same fixed priority “${priority.title}” or clearly describes that exact topic in natural Serbian, and says what to notice about that day's action. Every observation must independently stay on this priority; never observe a different sleep area.`),
    })),
    alternatives: arraySchema(1, 2, customerText(COPY_LIMITS.alternative, "A practical alternative approach to the same fixed priority, grounded in selected answers, not an unrelated generic tip.")),
    review_questions: arraySchema(3, 3, customerText(COPY_LIMITS.reviewQuestion, "One simple review question relevant to the fixed priority.")),
    after_seven_days: customerText(COPY_LIMITS.afterSevenDays, "Short personalized interpretation of how to review the experiment. No promised outcome."),
    closing: customerText(COPY_LIMITS.closing, "Short calm informational wellness note, not a diagnosis. If persistent difficulty significantly affects daily life, it is reasonable to suggest speaking with a healthcare professional without alarming language."),
  });
};

export const buildSleepPremiumJsonSchema = (input) => ({
  type: "json_schema",
  name: "mindscore_sleep_premium_report_v2",
  strict: true,
  schema: makeSchema(input),
});

// Safety only: ordinary Serbian descriptors/connectors are not classifier metadata.
const INVALID_CUSTOMER_COPY = /\b(?:scoring|scores?|dimension\w*|dimenzij\w*|mapped value|mappedvalue|internalscores|classifier|klasifikator\w*|ai confidence|algorithm|algoritam|schema|sema|json|prompt\w*|tokens?|tokeni|tokena|threshold\w*|sleepOnset|recovery|continuity|rhythm|stable|mixed|weak|nesanic\w*|apnej\w*|depres\w*|anksiozn\w*|hormons\w*|neurolosk\w*|dijagnoz\w*|dijagnost\w*|poremec\w*|bolest\w*|klinick\w*|medikament\w*|lekov\w*|lek|terapij\w*|lecen\w*|uzroku\w+|izaziv\w*|prouzrok\w*|remeti\w*|dovodi\s+do|doprin\w*\s+(?:los\w*|problem\w*|teskoc\w*|nesanic\w*|san\w*|spav\w*)|uzrok\s+(?:tvog|tvoj\w*|problema|teskoc\w*|los\w*\s+sna))\b|\b\d+(?:[.,]\d+)?\s*(?:\/\s*100|%)|\b(?:rezultat|ocena|prag\w*)\s*(?:je\s*)?\d+(?:[.,]\d+)?/iu;
const SENSITIVE_CUSTOMER_COPY = /\S+@\S+|\b(?:cs_|pi_|cus_|sess_|session[_ -]?|assessment[_ -]?|user[_ -]?id[\s:=_-]*|sk[-_]|pk_(?:live|test)_|whsec_)[\w-]+|\b(?:bearer\s+\S+|(?:password|passwd|credential|api[_ -]?key|access[_ -]?token|secret)\s*[:=]\s*\S+)|\b[0-9a-f]{8}-[0-9a-f-]{27,}\b|(?:\+?\d[\s().-]*){7,}/iu;
const GUARANTEE_COPY = /\b(?:sigurn\w*|definitivn\w*|garantovan\w*|poboljs\w*|poprav\w*|izlec\w*|regulis\w*|res\w*|uklon\w*)\b.{0,60}\b(?:san\w*|spav\w*|problem\w*|teskoc\w*)\b|\b(?:san\w*|spav\w*|problem\w*|teskoc\w*)\b.{0,60}\b(?:sigurn\w*|definitivn\w*|garantovan\w*|poboljs\w*|poprav\w*|izlec\w*|regulis\w*|res\w*|uklon\w*)\b/iu;
const normalizeForSafety = (text) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/đ/gu, "d").toLowerCase();
const collectStrings = (report) => [
  { field: "profile_explanation", value: report.profile_explanation },
  { field: "priority.title", value: report.priority.title },
  { field: "priority.area", value: report.priority.area },
  { field: "priority.explanation", value: report.priority.explanation },
  ...report.connections.map((connection, index) => ({ field: `connections[${index}].text`, value: connection.text })),
  { field: "stable_or_tracking.title", value: report.stable_or_tracking.title },
  ...report.stable_or_tracking.items.map((value, index) => ({ field: `stable_or_tracking.items[${index}]`, value })),
  ...report.seven_day_plan.flatMap((day, index) => [
    { field: `seven_day_plan[${index}].action`, value: day.action },
    { field: `seven_day_plan[${index}].observe`, value: day.observe },
  ]),
  ...report.alternatives.map((value, index) => ({ field: `alternatives[${index}]`, value })),
  ...report.review_questions.map((value, index) => ({ field: `review_questions[${index}]`, value })),
  { field: "after_seven_days", value: report.after_seven_days },
  { field: "closing", value: report.closing },
];
const hasText = (value, maxLength) => typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
const removeAnswerQuotes = (text, input) => text.replace(/[„“]([^”“]+)[”“]/gu, (whole, quoted) =>
  input.answers.some((answer) => answer.answer === quoted.trim()) ? " " : whole
);

// Observational only: reuse the runtime regexes and quote exemption without changing validation.
export const diagnoseSleepPremiumCustomerSafety = (field, value, input) => {
  if (typeof value !== "string") return null;
  const unquoted = removeAnswerQuotes(value, input);
  const safeCopy = normalizeForSafety(unquoted);
  const invalidMatch = INVALID_CUSTOMER_COPY.exec(safeCopy);
  const match = invalidMatch || GUARANTEE_COPY.exec(safeCopy);
  if (!match) return null;

  let category = "outcome-promising";
  if (invalidMatch) {
    const token = match[0];
    category = /\d/u.test(token) ? "score"
      : /^(?:nesanic|apnej|depres|anksiozn|hormons|neurolosk|dijagnoz|dijagnost|poremec|bolest|klinick|medikament|lekov|lek\b|terapij|lecen)/u.test(token) ? "medical"
        : /^(?:uzrok|izaziv|prouzrok|dovod|remet|doprin|kriv|posledic|zbog)/u.test(token) ? "causal"
          : /^(?:algorithm|algoritam|schema|sema|json|prompt|token)/u.test(token) ? "technical"
            : /^(?:scor|dimension|dimenzij|mapped|internal|classifier|klasifikator|ai confidence|stable|mixed|weak|threshold|sleeponset|recovery|continuity|rhythm)/u.test(token) ? "internal"
              : "other";
  }

  // Map normalized match offsets back to the original spelling (including diacritics).
  const offsets = [];
  let offset = 0;
  for (const character of unquoted) {
    for (let index = 0; index < normalizeForSafety(character).length; index += 1) {
      offsets.push({ start: offset, end: offset + character.length });
    }
    offset += character.length;
  }
  const rejectedText = unquoted.slice(offsets[match.index].start, offsets[match.index + match[0].length - 1].end);
  // Withhold the whole diagnostic field if likely credentials or identifiers occur.
  // This affects logging only, never the generated report or the validation decision.
  const identifiersDetected = /\S+@\S+|\b(?:cs_|pi_|cus_|sess_|session[_ -]?|assessment[_ -]?|user[_ -]?id[\s:=_-]*|sk[-_]|pk_(?:live|test)_|whsec_)[\w-]+|\b(?:bearer\s+\S+|(?:password|passwd|credential|api[_ -]?key|access[_ -]?token|secret)\s*[:=]\s*\S+)|\b[0-9a-f]{8}-[0-9a-f-]{27,}\b|(?:\+?\d[\s().-]*){7,}|\b[A-Za-z0-9_-]{24,}\b/iu.test(value);
  return {
    field,
    returnedText: identifiersDetected ? "[withheld: possible personal identifier]" : value,
    rejectedText: identifiersDetected ? "[withheld: possible personal identifier]" : rejectedText,
    normalizedMatch: identifiersDetected ? "[withheld: possible personal identifier]" : match[0],
    category,
    rule: invalidMatch ? "INVALID_CUSTOMER_COPY" : "GUARANTEE_COPY",
    regex: (invalidMatch ? INVALID_CUSTOMER_COPY : GUARANTEE_COPY).toString(),
  };
};

export const validateSleepPremiumReport = (candidate, input) => {
  if (!input || !SLEEP_PREMIUM_PROFILE_NAMES.includes(input.profile)) {
    return invalid("input.profile", "configured deterministic profile", input?.profile, "Invalid deterministic Premium input.");
  }
  if (!keysEqual(candidate, REPORT_KEYS)) return invalid("$", "Premium report v2 object with all required properties only", candidate, "Report root shape is invalid.");
  if (candidate.version !== 2) return invalid("version", "integer enum [2]", candidate.version, "Unsupported Premium report version.");
  if (candidate.profile !== input.profile) return invalid("profile", "exact deterministic profile string", candidate.profile, "AI profile does not match deterministic profile.");
  if (!hasText(candidate.profile_explanation, COPY_LIMITS.profileExplanation)) {
    return invalid("profile_explanation", "nonblank string, at most 700 characters", candidate.profile_explanation, "Profile explanation is invalid.");
  }

  const priority = getSleepPremiumPriority(input);
  if (!keysEqual(candidate.priority, ["title", "area", "explanation"])) return invalid("priority", "object with title, deterministic area, and explanation", candidate.priority, "Priority object shape is invalid.");
  if (candidate.priority.title !== "TVOJ PRIORITET #1" || candidate.priority.area !== priority.title) {
    return invalid("priority.area", `deterministic priority area ${priority.title}`, candidate.priority.area, "AI priority does not match the deterministic priority selector.");
  }
  if (!hasText(candidate.priority.explanation, COPY_LIMITS.priorityExplanation)) {
    return invalid("priority.explanation", "nonblank string, at most 700 characters", candidate.priority.explanation, "Priority explanation is blank, overlong, or not a string.");
  }
  if (!Array.isArray(candidate.connections) || candidate.connections.length < 2 || candidate.connections.length > 4) {
    return invalid("connections", "array of 2–4 concise answer-grounded connections", candidate.connections, "Connections must contain two to four items.");
  }
  for (let index = 0; index < candidate.connections.length; index += 1) {
    const connection = candidate.connections[index];
    if (!keysEqual(connection, ["questionIds", "text"])) {
      return invalid(`connections[${index}]`, "object containing questionIds and text only", connection, `Connection ${index + 1} has an invalid structure.`);
    }
    if (!Array.isArray(connection.questionIds) || connection.questionIds.length !== 2) {
      return invalid(`connections[${index}].questionIds`, "exactly two selected question IDs", connection.questionIds, `Connection ${index + 1} must identify two supporting questions.`);
    }
    const knownQuestionIds = new Set(input.answers.map(({ questionId }) => questionId));
    if (connection.questionIds.some((questionId) => typeof questionId !== "string" || !knownQuestionIds.has(questionId))) {
      return invalid(`connections[${index}].questionIds`, "two IDs present in the current answered-question input", connection.questionIds, `Connection ${index + 1} references an unknown question.`);
    }
    if (!hasText(connection.text, COPY_LIMITS.connection)) {
      return invalid(`connections[${index}].text`, "nonblank natural text, at most 500 characters", connection.text, `Connection ${index + 1} text is blank or overlong.`);
    }
    if (/\bQ(?:[1-9]|1[0-2])\b/u.test(connection.text)) {
      return invalid(`connections[${index}].text`, "natural customer-facing text without internal question IDs", connection.text, `Connection ${index + 1} text exposes question metadata.`);
    }
  }

  const stableMode = getSleepPremiumStrengthMode(input);
  if (!keysEqual(candidate.stable_or_tracking, ["mode", "title", "items"]) || candidate.stable_or_tracking.mode !== stableMode) {
    return invalid("stable_or_tracking", `object with deterministic mode ${stableMode}, fixed title, and items`, candidate.stable_or_tracking, "Stable/tracking mode does not match deterministic areas.");
  }
  const expectedStableTitle = stableMode === "stable" ? "ŠTA VREDI DA ZADRŽIŠ" : "ŠTA JOŠ VREDI DA PRATIŠ";
  if (candidate.stable_or_tracking.title !== expectedStableTitle) return invalid("stable_or_tracking.title", expectedStableTitle, candidate.stable_or_tracking.title, "Stable/tracking title is invalid.");
  if (!Array.isArray(candidate.stable_or_tracking.items) || candidate.stable_or_tracking.items.length < 1 || candidate.stable_or_tracking.items.length > 2) {
    return invalid("stable_or_tracking.items", "array of 1–2 concise items", candidate.stable_or_tracking.items, "Stable/tracking section must contain one or two items.");
  }
  for (let index = 0; index < candidate.stable_or_tracking.items.length; index += 1) {
    const item = candidate.stable_or_tracking.items[index];
    if (!hasText(item, COPY_LIMITS.stableOrTracking)) return invalid(`stable_or_tracking.items[${index}]`, "nonblank text, at most 350 characters", item, "Stable/tracking item is invalid.");
  }

  if (!Array.isArray(candidate.seven_day_plan) || candidate.seven_day_plan.length !== 7) return invalid("seven_day_plan", "array of exactly seven plan days", candidate.seven_day_plan, "Seven-day plan must contain exactly seven days.");
  for (let index = 0; index < 7; index += 1) {
    const day = candidate.seven_day_plan[index];
    if (!keysEqual(day, ["day", "action", "observe"]) || day.day !== index + 1 || !hasText(day.action, COPY_LIMITS.planAction) || !hasText(day.observe, COPY_LIMITS.planObserve)) {
      return invalid(`seven_day_plan[${index}]`, `object {day: ${index + 1}, nonblank action <=${COPY_LIMITS.planAction}, nonblank observe <=${COPY_LIMITS.planObserve}}`, day, `Seven-day plan entry ${index + 1} is invalid.`);
    }
  }
  if (!Array.isArray(candidate.alternatives) || candidate.alternatives.length < 1 || candidate.alternatives.length > 2) return invalid("alternatives", "array of 1–2 alternatives for the same priority", candidate.alternatives, "Alternatives must contain one or two items.");
  for (let index = 0; index < candidate.alternatives.length; index += 1) {
    if (!hasText(candidate.alternatives[index], COPY_LIMITS.alternative)) return invalid(`alternatives[${index}]`, "nonblank string, at most 350 characters", candidate.alternatives[index], "Alternative is invalid.");
  }
  if (!Array.isArray(candidate.review_questions) || candidate.review_questions.length !== 3) return invalid("review_questions", "array of exactly three review questions", candidate.review_questions, "Review questions must contain exactly three items.");
  for (let index = 0; index < candidate.review_questions.length; index += 1) {
    const question = candidate.review_questions[index];
    if (!hasText(question, COPY_LIMITS.reviewQuestion)) return invalid(`review_questions[${index}]`, "nonblank string, at most 200 characters", question, "Review question is invalid.");
  }
  if (!hasText(candidate.after_seven_days, COPY_LIMITS.afterSevenDays)) return invalid("after_seven_days", "nonblank string, at most 500 characters", candidate.after_seven_days, "Seven-day review is invalid.");
  if (!hasText(candidate.closing, COPY_LIMITS.closing)) return invalid("closing", "nonblank calm informational note, at most 350 characters", candidate.closing, "Closing note is invalid.");

  const allStrings = collectStrings(candidate);
  for (let index = 0; index < allStrings.length; index += 1) {
    const { field, value } = allStrings[index];
    if (SENSITIVE_CUSTOMER_COPY.test(value)) return invalid(field, "customer-facing text without credentials or personal identifiers", value, "Report contains sensitive customer-facing content.");
    if (/\bQ(?:[1-9]|1[0-2])\b/u.test(value)) return invalid(field, "customer-facing text without internal question IDs", value, "Report contains internal question metadata.");
    const safeCopy = normalizeForSafety(removeAnswerQuotes(value, input));
    if (INVALID_CUSTOMER_COPY.test(safeCopy)) return invalid(field, "customer-safe Serbian without medical, causal, internal, technical, or score claims", value, "Report contains disallowed customer-facing copy.");
    if (GUARANTEE_COPY.test(safeCopy)) return invalid(field, "no claim that an action will improve, fix, cure, regulate, or solve sleep", value, "Report promises a sleep outcome.");
  }

  return { valid: true, report: candidate, reason: "ok" };
};
