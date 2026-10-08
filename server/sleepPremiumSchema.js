import { SLEEP_PREMIUM_DIMENSION_KEYS, SLEEP_PREMIUM_PROFILE_NAMES } from "./sleepPremiumInput.js";

const CORE_DIMENSIONS = ["recovery", "sleepOnset", "continuity"];
const AREA_TITLES = Object.freeze({
  recovery: "Oporavak nakon sna",
  sleepOnset: "Uspavljivanje",
  continuity: "Tok noći",
});

const keysEqual = (value, expected) =>
  Boolean(value && typeof value === "object" && !Array.isArray(value)) &&
  Object.keys(value).length === expected.length &&
  expected.every((key) => Object.prototype.hasOwnProperty.call(value, key));

const textSchema = (maxLength = 1200) => ({ type: "string", minLength: 1, maxLength, pattern: "\\S" });
const fixedStringSchema = (value) => ({ type: "string", enum: [value] });
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
const objectSchema = (properties, required = Object.keys(properties)) => ({
  type: "object",
  additionalProperties: false,
  properties,
  required,
});

const stringArraySchema = (minItems, maxItems, itemMaxLength = 1200) => ({
  type: "array",
  minItems,
  maxItems,
  items: textSchema(itemMaxLength),
});

export const getSleepPremiumStrengthMode = (input) =>
  SLEEP_PREMIUM_DIMENSION_KEYS.some((key) => input?.dimensions?.[key]?.state === "STABLE")
    ? "strength"
    : "watch";

export const getSleepPremiumPositiveOrWatchTitle = (mode) =>
  mode === "strength" ? "Šta ti već ide dobro?" : "Šta još vredi da pratiš?";

export const getSleepPremiumMainAreaTitle = (input) => {
  const weakCore = CORE_DIMENSIONS.filter((key) => input?.dimensions?.[key]?.state === "WEAK");
  if (weakCore.length >= 2) return "Više delova sna";
  if (weakCore.length === 1) return AREA_TITLES[weakCore[0]];

  const q6 = input?.answers?.find((answer) => answer.questionId === "Q6")?.mappedValue;
  const q12 = input?.answers?.find((answer) => answer.questionId === "Q12")?.mappedValue;
  if (q6 <= 1 && q12 <= 1) return "Večernje smirivanje i tok noći";
  if (q6 <= 1) return "Večernje smirivanje";
  if (q12 <= 1) return "Tok noći";

  const rhythm = input?.dimensions?.rhythm;
  if (
    rhythm && rhythm.state !== "STABLE" &&
    CORE_DIMENSIONS.every((key) => input.dimensions[key].score > rhythm.score)
  ) return "Ritam spavanja kao dodatna tema";

  return "Tvoja ukupna slika sna";
};

const makeProperties = (input) => {
  const strengthMode = getSleepPremiumStrengthMode(input);
  return objectSchema({
    version: { type: "integer", enum: [1] },
    profile: objectSchema({
      name: { type: "string", enum: [input.profile] },
      summary: textSchema(),
    }),
    mainArea: objectSchema({
      title: { type: "string", enum: [getSleepPremiumMainAreaTitle(input)] },
      explanation: textSchema(),
    }),
    connections: objectSchema({
      title: fixedStringSchema("Šta se kod tebe povezuje?"),
      items: stringArraySchema(2, 2),
    }),
    positiveOrWatch: objectSchema({
      mode: { type: "string", enum: [strengthMode] },
      title: fixedStringSchema(getSleepPremiumPositiveOrWatchTitle(strengthMode)),
      text: textSchema(),
    }),
    startingPoint: objectSchema({
      title: fixedStringSchema("Gde ima najviše smisla da počneš?"),
      text: textSchema(),
    }),
    tonight: objectSchema({
      title: fixedStringSchema("Šta možeš da uradiš već večeras?"),
      actions: stringArraySchema(3, 3, 400),
    }),
    sevenDayPlan: {
      type: "array",
      minItems: 7,
      maxItems: 7,
      items: objectSchema({
        day: { type: "integer", minimum: 1, maximum: 7 },
        title: textSchema(100),
        action: textSchema(400),
      }),
    },
    tracking: objectSchema({
      title: fixedStringSchema("Šta vredi da pratiš?"),
      items: stringArraySchema(2, 4, 200),
    }),
    closing: textSchema(800),
  });
};

export const buildSleepPremiumJsonSchema = (input) => ({
  type: "json_schema",
  name: "mindscore_sleep_premium_report_v1",
  strict: true,
  schema: makeProperties(input),
});

const INVALID_CUSTOMER_COPY = /\b(?:scoring|dimension|mapped value|classifier|ai confidence|faktor\w*|signal\w*|obrazac\w*|obrasc\w*|stable|mixed|weak|stabil\w*|mesovit\w*|slab\w*|nesanic\w*|apnej\w*|depres\w*|anksiozn\w*|hormons\w*|neurolosk\w*|dijagnoz\w*|dijagnost\w*|poremec\w*|bolest\w*|klinick\w*|medikament\w*|lekov\w*|\blek\b|terapij\w*|lecen\w*|uzrok\w*|izaziv\w*|prouzrok\w*|dovod\w*|remet\w*|doprin\w*|kriv\w*|posledic\w*|\bzbog\b)\b|\b\d+(?:[.,]\d+)?\s*(?:\/\s*100|%)/iu;
const UNSUPPORTED_STRENGTH_COPY = /\b(?:dobr\w*|odlicn\w*|funkcionis\w*|snag\w*|jak\w*|uspesn\w*|zadrz\w*|oslonc\w*|prednost\w*|pomaz\w*|podrz\w*)\b/u;
const OBSERVATION_COPY = /\b(?:prat\w*|obrati\w*|posmatr\w*|bele[zž]\w*|primet\w*|naredn\w*)\b/u;
const STABLE_EVIDENCE = Object.freeze({
  recovery: /\b(?:oporav\w*|jutarn\w*|buden\w*|energij\w*|odmor\w*|ustajan\w*)\b/u,
  sleepOnset: /\b(?:uspav\w*|zaspi\w*|misl\w*|vecern\w*|pre sna)\b/u,
  continuity: /\b(?:tok noci|noc\w*|probud\w*|buđen\w*)\b/u,
  rhythm: /\b(?:ritm\w*|raspored\w*|vreme\w*|duzin\w* sna)\b/u,
});
const WEAK_CORE_EVIDENCE = Object.freeze({
  recovery: /\b(?:oporav\w*|jutarn\w*|buden\w*|energij\w*|odmor\w*|umor\w*|ustajan\w*)\b/u,
  sleepOnset: /\b(?:uspav\w*|zaspi\w*|misl\w*|vecern\w*|pre sna)\b/u,
  continuity: /\b(?:tok noci|noc\w*|probud\w*|buđen\w*)\b/u,
});

const collectReportStrings = (report) => [
  { field: "profile.summary", value: report.profile.summary },
  { field: "mainArea.title", value: report.mainArea.title },
  { field: "mainArea.explanation", value: report.mainArea.explanation },
  { field: "connections.title", value: report.connections.title },
  ...report.connections.items.map((value, index) => ({ field: `connections.items[${index}]`, value })),
  { field: "positiveOrWatch.title", value: report.positiveOrWatch.title },
  { field: "positiveOrWatch.text", value: report.positiveOrWatch.text },
  { field: "startingPoint.title", value: report.startingPoint.title },
  { field: "startingPoint.text", value: report.startingPoint.text },
  { field: "tonight.title", value: report.tonight.title },
  ...report.tonight.actions.map((value, index) => ({ field: `tonight.actions[${index}]`, value })),
  ...report.sevenDayPlan.flatMap(({ title, action }, index) => [
    { field: `sevenDayPlan[${index}].title`, value: title },
    { field: `sevenDayPlan[${index}].action`, value: action },
  ]),
  { field: "tracking.title", value: report.tracking.title },
  ...report.tracking.items.map((value, index) => ({ field: `tracking.items[${index}]`, value })),
  { field: "closing", value: report.closing },
];

const hasSuppliedAnswerQuote = (text, input) => {
  const quotes = [...text.matchAll(/[„“]([^”“]+)[”“]/gu)].map((match) => match[1].trim());
  return quotes.some((quoted) => input.answers.some((item) => item.answer === quoted));
};

const hasTextOnly = (value, maxLength = 1200) =>
  typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;

export const validateSleepPremiumReport = (candidate, input) => {
  if (!input || !SLEEP_PREMIUM_PROFILE_NAMES.includes(input.profile)) {
    return invalid("input.profile", "one of the configured deterministic profiles", input?.profile, "Invalid deterministic Premium input.");
  }
  const rootFields = ["version", "profile", "mainArea", "connections", "positiveOrWatch", "startingPoint", "tonight", "sevenDayPlan", "tracking", "closing"];
  if (!keysEqual(candidate, rootFields)) {
    const missingFields = rootFields.filter((key) => !Object.prototype.hasOwnProperty.call(candidate || {}, key));
    const unexpectedFieldCount = candidate && typeof candidate === "object" && !Array.isArray(candidate)
      ? Object.keys(candidate).filter((key) => !rootFields.includes(key)).length
      : 0;
    const field = missingFields[0] || (unexpectedFieldCount ? "$additionalProperties" : "$");
    return {
      ...invalid(field, missingFields.length ? "required report field must be present" : "no additional properties", candidate, "Report root has missing or unknown fields."),
      diagnostic: {
        field,
        expected: missingFields.length ? "all 10 required report fields; no additional properties" : "no additional properties",
        received: { ...safeShape(candidate), missingFields, unexpectedFieldCount },
      },
    };
  }
  if (candidate.version !== 1) return invalid("version", "integer enum [1]", candidate.version, "Unsupported report version.");
  if (!keysEqual(candidate.profile, ["name", "summary"])) {
    return invalid("profile", "object with exactly name and summary", candidate.profile, "Profile object shape is invalid.");
  }
  if (candidate.profile.name !== input.profile) {
    return invalid("profile.name", "exact deterministic profile string", candidate.profile.name, "Profile name does not match deterministic input.");
  }
  if (!hasTextOnly(candidate.profile.summary)) {
    return invalid("profile.summary", "nonblank string, 1–1200 characters", candidate.profile.summary, "Profile summary is invalid.");
  }
  if (!keysEqual(candidate.mainArea, ["title", "explanation"])) {
    return invalid("mainArea", "object with exactly title and explanation", candidate.mainArea, "Main-area object shape is invalid.");
  }
  if (candidate.mainArea.title !== getSleepPremiumMainAreaTitle(input)) {
    return invalid("mainArea.title", "exact title selected by deterministic input", candidate.mainArea.title, "Main-area title does not match deterministic results.");
  }
  if (!hasTextOnly(candidate.mainArea.explanation)) {
    return invalid("mainArea.explanation", "nonblank string, 1–1200 characters", candidate.mainArea.explanation, "Main-area explanation is invalid.");
  }
  if (!hasSuppliedAnswerQuote(candidate.mainArea.explanation, input)) {
    return invalid("mainArea.explanation", "include at least one exact supplied answer in Serbian quotation marks", candidate.mainArea.explanation, "Main-area explanation must cite an exact supplied answer.");
  }
  if (!keysEqual(candidate.connections, ["title", "items"])) {
    return invalid("connections", "object with exactly title and items", candidate.connections, "Connections object shape is invalid.");
  }
  if (candidate.connections.title !== "Šta se kod tebe povezuje?") {
    return invalid("connections.title", "fixed section title", candidate.connections.title, "Connections title is invalid.");
  }
  if (!Array.isArray(candidate.connections.items) || candidate.connections.items.length !== 2) {
    return invalid("connections.items", "array of exactly 2 nonblank strings (1–1200 characters each)", candidate.connections.items, "Connections must contain exactly two items.");
  }
  if (candidate.connections.items.some((item) => !hasTextOnly(item))) {
    const index = candidate.connections.items.findIndex((item) => !hasTextOnly(item));
    return invalid(`connections.items[${index}]`, "nonblank string, 1–1200 characters", candidate.connections.items[index], "Connection item is invalid.");
  }
  const unsupportedConnectionIndex = candidate.connections.items.findIndex((item) => !hasSuppliedAnswerQuote(item, input));
  if (unsupportedConnectionIndex >= 0) {
    return invalid(`connections.items[${unsupportedConnectionIndex}]`, "include at least one exact supplied answer in Serbian quotation marks", candidate.connections.items[unsupportedConnectionIndex], "Each connection must cite an exact supplied answer.");
  }

  const mode = getSleepPremiumStrengthMode(input);
  if (
    !keysEqual(candidate.positiveOrWatch, ["mode", "title", "text"]) ||
    candidate.positiveOrWatch.mode !== mode ||
    candidate.positiveOrWatch.title !== getSleepPremiumPositiveOrWatchTitle(mode) ||
    !hasTextOnly(candidate.positiveOrWatch.text)
  ) return invalid("positiveOrWatch", `object with mode ${mode}, its fixed title, and nonblank text (1–1200 characters)`, candidate.positiveOrWatch, "Strength/watch section violates deterministic state.");

  if (!keysEqual(candidate.startingPoint, ["title", "text"])) {
    return invalid("startingPoint", "object with exactly title and text", candidate.startingPoint, "Starting-point object shape is invalid.");
  }
  if (candidate.startingPoint.title !== "Gde ima najviše smisla da počneš?") {
    return invalid("startingPoint.title", "fixed section title", candidate.startingPoint.title, "Starting-point title is invalid.");
  }
  if (!hasTextOnly(candidate.startingPoint.text)) {
    return invalid("startingPoint.text", "nonblank string, 1–1200 characters", candidate.startingPoint.text, "Starting-point text is invalid.");
  }
  if (!keysEqual(candidate.tonight, ["title", "actions"])) {
    return invalid("tonight", "object with exactly title and actions", candidate.tonight, "Tonight object shape is invalid.");
  }
  if (candidate.tonight.title !== "Šta možeš da uradiš već večeras?") {
    return invalid("tonight.title", "fixed section title", candidate.tonight.title, "Tonight title is invalid.");
  }
  if (!Array.isArray(candidate.tonight.actions) || candidate.tonight.actions.length !== 3) {
    return invalid("tonight.actions", "array of exactly 3 nonblank strings, each 1–400 characters", candidate.tonight.actions, "Tonight section must contain exactly three actions.");
  }
  const invalidActionIndex = candidate.tonight.actions.findIndex((item) => !hasTextOnly(item, 400));
  if (invalidActionIndex >= 0) {
    return invalid(`tonight.actions[${invalidActionIndex}]`, "nonblank string, 1–400 characters", candidate.tonight.actions[invalidActionIndex], "Tonight action is invalid.");
  }
  if (!Array.isArray(candidate.sevenDayPlan) || candidate.sevenDayPlan.length !== 7) {
    return invalid("sevenDayPlan", "array of exactly 7 day objects", candidate.sevenDayPlan, "Seven-day plan must contain exactly seven days.");
  }
  for (let index = 0; index < 7; index += 1) {
    const day = candidate.sevenDayPlan[index];
    if (!keysEqual(day, ["day", "title", "action"]) || day.day !== index + 1 || !hasTextOnly(day.title, 100) || !hasTextOnly(day.action, 400)) {
      return invalid(`sevenDayPlan[${index}]`, `object {day: ${index + 1}, title: nonblank string 1–100 chars, action: nonblank string 1–400 chars}`, day, `Seven-day plan entry ${index + 1} is invalid.`);
    }
  }
  if (!keysEqual(candidate.tracking, ["title", "items"])) {
    return invalid("tracking", "object with exactly title and items", candidate.tracking, "Tracking object shape is invalid.");
  }
  if (candidate.tracking.title !== "Šta vredi da pratiš?") {
    return invalid("tracking.title", "fixed section title", candidate.tracking.title, "Tracking title is invalid.");
  }
  if (!Array.isArray(candidate.tracking.items) || candidate.tracking.items.length < 2 || candidate.tracking.items.length > 4) {
    return invalid("tracking.items", "array of 2–4 nonblank strings, each 1–200 characters", candidate.tracking.items, "Tracking section must contain two to four items.");
  }
  const invalidTrackingIndex = candidate.tracking.items.findIndex((item) => !hasTextOnly(item, 200));
  if (invalidTrackingIndex >= 0) {
    return invalid(`tracking.items[${invalidTrackingIndex}]`, "nonblank string, 1–200 characters", candidate.tracking.items[invalidTrackingIndex], "Tracking item is invalid.");
  }
  if (!hasTextOnly(candidate.closing, 800)) {
    return invalid("closing", "nonblank string, 1–800 characters", candidate.closing, "Closing text is empty or too long.");
  }

  const normalizeForSafety = (text) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/đ/gu, "d").toLowerCase();
  const customerStrings = collectReportStrings(candidate);
  const suppliedAnswers = new Set(input.answers.map((item) => item.answer));
  const quotedAnswers = customerStrings.flatMap(({ value, field }) =>
    [...value.matchAll(/[„“]([^”“]+)[”“]/gu)].map((match) => ({ quoted: match[1].trim(), field }))
  );
  const unsupportedQuote = quotedAnswers.find(({ quoted }) => !suppliedAnswers.has(quoted));
  if (unsupportedQuote) {
    return invalid(unsupportedQuote.field, "any quoted text must exactly match a supplied answer; do not expose quoted text in logs", { type: "string", length: unsupportedQuote.quoted.length }, "Report contains quoted answer text not present in the supplied answers.");
  }
  const withoutEvidenceQuotes = (text) => text.replace(/[„“]([^”“]+)[”“]/gu, (whole, quoted) =>
    suppliedAnswers.has(quoted.trim()) ? " " : whole
  );
  const normalizedStrings = customerStrings.map(({ value }) => normalizeForSafety(withoutEvidenceQuotes(value)));
  const unsafeCopyIndex = normalizedStrings.findIndex((text) => INVALID_CUSTOMER_COPY.test(text));
  if (unsafeCopyIndex >= 0) {
    return invalid(customerStrings[unsafeCopyIndex].field, "customer-safe prose without technical, diagnostic, causal, or score claims", customerStrings[unsafeCopyIndex].value, "Report text contains disallowed technical, diagnostic, causal, or score copy.");
  }

  const strengthText = normalizeForSafety(withoutEvidenceQuotes(candidate.positiveOrWatch.text));
  if (mode === "watch" && UNSUPPORTED_STRENGTH_COPY.test(strengthText)) {
    return invalid("positiveOrWatch.text", "observation-focused wording without unsupported positive-strength claims", candidate.positiveOrWatch.text, "Watch mode must not claim an unsupported positive strength.");
  }
  if (mode === "watch" && !OBSERVATION_COPY.test(strengthText)) {
    return invalid("positiveOrWatch.text", "include a permitted observation cue", candidate.positiveOrWatch.text, "Watch mode must describe something to observe.");
  }
  if (mode === "strength") {
    const supportedStableAreas = SLEEP_PREMIUM_DIMENSION_KEYS.filter((key) => input.dimensions[key].state === "STABLE");
    if (!supportedStableAreas.some((key) => STABLE_EVIDENCE[key].test(strengthText))) {
      return invalid("positiveOrWatch.text", "strength wording must refer to a deterministic STABLE area", candidate.positiveOrWatch.text, "Strength copy is not tied to any STABLE area.");
    }
  }

  const mainExplanation = normalizeForSafety(candidate.mainArea.explanation);
  const weakCoreAreas = CORE_DIMENSIONS.filter((key) => input.dimensions[key].state === "WEAK");
  if (weakCoreAreas.some((key) => !WEAK_CORE_EVIDENCE[key].test(mainExplanation))) {
    return invalid("mainArea.explanation", "mention each deterministic weak core area", candidate.mainArea.explanation, "Main-area explanation omits a weak core area.");
  }

  return { valid: true, report: candidate, reason: "ok" };
};
