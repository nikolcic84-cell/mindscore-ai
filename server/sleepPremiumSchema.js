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
    profile_explanation: customerText(COPY_LIMITS.profileExplanation, "At most two short personalized Serbian paragraphs about what this deterministic profile means for this person. Cite at least one complete exact selected answer in Serbian quotation marks. Do not repeat generic Free-result profile text."),
    priority: objectSchema({
      title: fixedTextSchema("TVOJ PRIORITET #1"),
      area: { type: "string", enum: [priority.title] },
      explanation: customerText(COPY_LIMITS.priorityExplanation, "Briefly explain why the fixed deterministic priority is the sensible first focus using supplied answers and at least one complete exact answer quote. Do not diagnose or claim a cause."),
    }),
    connections: arraySchema(2, 4, customerText(COPY_LIMITS.connection, "A short non-causal relationship or contrast grounded in at least two exact selected answers. Quote the complete answers verbatim in Serbian quotation marks.")),
    stable_or_tracking: objectSchema({
      mode: { type: "string", enum: [stableMode] },
      title: fixedTextSchema(stableMode === "stable" ? "ŠTA VREDI DA ZADRŽIŠ" : "ŠTA JOŠ VREDI DA PRATIŠ"),
      items: arraySchema(1, 2, customerText(COPY_LIMITS.stableOrTracking, "When mode is stable, describe only an actually STABLE deterministic area. When mode is tracking, describe an uncertainty to observe, never an invented strength.")),
    }),
    seven_day_plan: arraySchema(7, 7, objectSchema({
      day: { type: "integer", minimum: 1, maximum: 7 },
      action: customerText(COPY_LIMITS.planAction, "One small step in a progressive seven-day experiment, all steps related to the fixed priority: day 1 baseline, day 2 introduce, day 3 repeat, day 4 compare, day 5 slight adjustment, day 6 repeat simplest useful step, day 7 review. No treatment or promised outcome."),
      observe: customerText(COPY_LIMITS.planObserve, "One optional simple observation relevant to the same priority. Do not introduce a different sleep intervention."),
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

const INVALID_CUSTOMER_COPY = /\b(?:scoring|dimension|mapped value|classifier|ai confidence|algorithm|algoritam|faktor\w*|signal\w*|obrazac\w*|obrasc\w*|stable|mixed|weak|stabil\w*|mesovit\w*|slab\w*|nesanic\w*|apnej\w*|depres\w*|anksiozn\w*|hormons\w*|neurolosk\w*|dijagnoz\w*|dijagnost\w*|poremec\w*|bolest\w*|klinick\w*|medikament\w*|lekov\w*|\blek\b|terapij\w*|lecen\w*|uzrok\w*|izaziv\w*|prouzrok\w*|dovod\w*|remet\w*|doprin\w*|kriv\w*|posledic\w*|\bzbog\b)\b|\b\d+(?:[.,]\d+)?\s*(?:\/\s*100|%)/iu;
const GUARANTEE_COPY = /\b(?:sigurn\w*|definitivn\w*|garantovan\w*|poboljs\w*|poprav\w*|izlec\w*|regulis\w*|res\w*|uklon\w*)\b.{0,60}\b(?:san\w*|spav\w*|problem\w*|teskoc\w*)\b|\b(?:san\w*|spav\w*|problem\w*|teskoc\w*)\b.{0,60}\b(?:sigurn\w*|definitivn\w*|garantovan\w*|poboljs\w*|poprav\w*|izlec\w*|regulis\w*|res\w*|uklon\w*)\b/iu;
const STABLE_EVIDENCE = Object.freeze({
  recovery: /(?:oporav|jutarn|buden|energij|odmor|ustajan)/u,
  sleepOnset: /(?:uspav|zaspi|misl|vecern|pre sna)/u,
  continuity: /(?:tok noci|noc|probud|buđen)/u,
  rhythm: /(?:ritm|raspored|vreme|duzin.*sna)/u,
});
const AREA_EVIDENCE = Object.freeze({
  recovery: /(?:jutr|buden|ustaj|oporav|energij|odmor)/u,
  sleepOnset: /(?:uspav|pre sna|vecer|vece|misl|telefon|ekran)/u,
  continuity: /(?:tok noc|noc|probud|buđen)/u,
  rhythm: /(?:ritm|raspored|vreme|dužin|duzin)/u,
  multiple: /(?:noc|vecer|jutr|sna)/u,
  whole: /(?:noc|san|spav|odmor)/u,
});
const normalizeForSafety = (text) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/đ/gu, "d").toLowerCase();
const collectStrings = (report) => [
  { field: "profile_explanation", value: report.profile_explanation },
  { field: "priority.title", value: report.priority.title },
  { field: "priority.area", value: report.priority.area },
  { field: "priority.explanation", value: report.priority.explanation },
  ...report.connections.map((value, index) => ({ field: `connections[${index}]`, value })),
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
const getExactAnswerQuotes = (text, input) => [...text.matchAll(/[„“]([^”“]+)[”“]/gu)]
  .map((match) => input.answers.find((answer) => answer.answer === match[1].trim()))
  .filter(Boolean);
const hasExactAnswerQuote = (text, input) => getExactAnswerQuotes(text, input).length > 0;
const removeAnswerQuotes = (text, input) => text.replace(/[„“]([^”“]+)[”“]/gu, (whole, quoted) =>
  input.answers.some((answer) => answer.answer === quoted.trim()) ? " " : whole
);

export const validateSleepPremiumReport = (candidate, input) => {
  if (!input || !SLEEP_PREMIUM_PROFILE_NAMES.includes(input.profile)) {
    return invalid("input.profile", "configured deterministic profile", input?.profile, "Invalid deterministic Premium input.");
  }
  if (!keysEqual(candidate, REPORT_KEYS)) return invalid("$", "Premium report v2 object with all required properties only", candidate, "Report root shape is invalid.");
  if (candidate.version !== 2) return invalid("version", "integer enum [2]", candidate.version, "Unsupported Premium report version.");
  if (candidate.profile !== input.profile) return invalid("profile", "exact deterministic profile string", candidate.profile, "AI profile does not match deterministic profile.");
  if (!hasText(candidate.profile_explanation, COPY_LIMITS.profileExplanation) || /\d/u.test(removeAnswerQuotes(candidate.profile_explanation, input))) {
    return invalid("profile_explanation", "personalized Serbian explanation, at most two short paragraphs, no digits", candidate.profile_explanation, "Profile explanation is invalid.");
  }
  if (!hasExactAnswerQuote(candidate.profile_explanation, input)) return invalid("profile_explanation", "personalized profile explanation citing an exact selected answer", candidate.profile_explanation, "Profile explanation is not grounded in an exact selected answer.");

  const priority = getSleepPremiumPriority(input);
  if (!keysEqual(candidate.priority, ["title", "area", "explanation"])) return invalid("priority", "object with title, deterministic area, and explanation", candidate.priority, "Priority object shape is invalid.");
  if (candidate.priority.title !== "TVOJ PRIORITET #1" || candidate.priority.area !== priority.title) {
    return invalid("priority.area", `deterministic priority area ${priority.title}`, candidate.priority.area, "AI priority does not match the deterministic priority selector.");
  }
  if (!hasText(candidate.priority.explanation, COPY_LIMITS.priorityExplanation) || !AREA_EVIDENCE[priority.key].test(normalizeForSafety(candidate.priority.explanation)) || !hasExactAnswerQuote(candidate.priority.explanation, input)) {
    return invalid("priority.explanation", `nonblank explanation tied to ${priority.title} and citing an exact selected answer`, candidate.priority.explanation, "Priority explanation is empty, unsupported, or unrelated to the deterministic area.");
  }
  if (!Array.isArray(candidate.connections) || candidate.connections.length < 2 || candidate.connections.length > 4) {
    return invalid("connections", "array of 2–4 concise answer-grounded connections", candidate.connections, "Connections must contain two to four items.");
  }
  for (let index = 0; index < candidate.connections.length; index += 1) {
    const answerQuotes = getExactAnswerQuotes(candidate.connections[index], input);
    if (!hasText(candidate.connections[index], COPY_LIMITS.connection) || new Set(answerQuotes.map(({ questionId }) => questionId)).size < 2) {
      return invalid(`connections[${index}]`, "nonblank connection, at most 500 characters, citing two distinct exact selected answers", candidate.connections[index], `Connection ${index + 1} is invalid or not grounded in two exact answers.`);
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
    if (stableMode === "stable") {
      const stableKeys = SLEEP_PREMIUM_DIMENSION_KEYS.filter((key) => input.dimensions[key].state === "STABLE");
      if (!stableKeys.some((key) => STABLE_EVIDENCE[key].test(normalizeForSafety(item)))) {
        return invalid(`stable_or_tracking.items[${index}]`, "item grounded in a genuinely STABLE deterministic area", item, "Stable item is not supported by deterministic evidence.");
      }
    }
  }

  if (!Array.isArray(candidate.seven_day_plan) || candidate.seven_day_plan.length !== 7) return invalid("seven_day_plan", "array of exactly seven plan days", candidate.seven_day_plan, "Seven-day plan must contain exactly seven days.");
  for (let index = 0; index < 7; index += 1) {
    const day = candidate.seven_day_plan[index];
    if (!keysEqual(day, ["day", "action", "observe"]) || day.day !== index + 1 || !hasText(day.action, COPY_LIMITS.planAction) || !hasText(day.observe, COPY_LIMITS.planObserve)) {
      return invalid(`seven_day_plan[${index}]`, `object {day: ${index + 1}, nonblank action <=${COPY_LIMITS.planAction}, nonblank observe <=${COPY_LIMITS.planObserve}}`, day, `Seven-day plan entry ${index + 1} is invalid.`);
    }
    if (!AREA_EVIDENCE[priority.key].test(normalizeForSafety(day.action)) || !AREA_EVIDENCE[priority.key].test(normalizeForSafety(day.observe))) {
      return invalid(`seven_day_plan[${index}]`, `action and observation tied to the fixed priority ${priority.title}`, day, `Seven-day plan entry ${index + 1} is unrelated to the deterministic priority.`);
    }
  }
  if (!Array.isArray(candidate.alternatives) || candidate.alternatives.length < 1 || candidate.alternatives.length > 2) return invalid("alternatives", "array of 1–2 alternatives for the same priority", candidate.alternatives, "Alternatives must contain one or two items.");
  for (let index = 0; index < candidate.alternatives.length; index += 1) {
    if (!hasText(candidate.alternatives[index], COPY_LIMITS.alternative) || !AREA_EVIDENCE[priority.key].test(normalizeForSafety(candidate.alternatives[index]))) return invalid(`alternatives[${index}]`, `nonblank alternative, at most 350 characters, tied to ${priority.title}`, candidate.alternatives[index], "Alternative is invalid or unrelated to the deterministic priority.");
  }
  if (!Array.isArray(candidate.review_questions) || candidate.review_questions.length !== 3) return invalid("review_questions", "array of exactly three review questions", candidate.review_questions, "Review questions must contain exactly three items.");
  for (let index = 0; index < candidate.review_questions.length; index += 1) {
    const question = candidate.review_questions[index];
    if (!hasText(question, COPY_LIMITS.reviewQuestion) || !question.trim().endsWith("?") || !AREA_EVIDENCE[priority.key].test(normalizeForSafety(question))) return invalid(`review_questions[${index}]`, `distinct question, at most 200 characters, tied to ${priority.title}`, question, "Review question is invalid or unrelated to the deterministic priority.");
  }
  if (new Set(candidate.review_questions.map((question) => normalizeForSafety(question.trim()))).size !== 3) return invalid("review_questions", "three distinct review questions", candidate.review_questions, "Review questions must be distinct.");
  if (!hasText(candidate.after_seven_days, COPY_LIMITS.afterSevenDays) || !AREA_EVIDENCE[priority.key].test(normalizeForSafety(candidate.after_seven_days))) return invalid("after_seven_days", `nonblank review tied to ${priority.title}, at most 500 characters`, candidate.after_seven_days, "Seven-day review is invalid or unrelated to the deterministic priority.");
  if (!hasText(candidate.closing, COPY_LIMITS.closing)) return invalid("closing", "nonblank calm informational note, at most 350 characters", candidate.closing, "Closing note is invalid.");

  const allStrings = collectStrings(candidate);
  const suppliedAnswerSet = new Set(input.answers.map(({ answer }) => answer));
  for (let index = 0; index < allStrings.length; index += 1) {
    const { field, value } = allStrings[index];
    const quotes = [...value.matchAll(/[„“]([^”“]+)[”“]/gu)].map((match) => match[1].trim());
    if (quotes.some((quote) => !suppliedAnswerSet.has(quote))) return invalid(field, "quoted text must exactly match a supplied answer", { type: "string", length: value.length }, "Report contains an unsupported quote.");
    const safeCopy = normalizeForSafety(removeAnswerQuotes(value, input));
    if (INVALID_CUSTOMER_COPY.test(safeCopy)) return invalid(field, "customer-safe Serbian without medical, causal, internal, technical, or score claims", value, "Report contains disallowed customer-facing copy.");
    if (GUARANTEE_COPY.test(safeCopy)) return invalid(field, "no claim that an action will improve, fix, cure, regulate, or solve sleep", value, "Report promises a sleep outcome.");
  }

  return { valid: true, report: candidate, reason: "ok" };
};
