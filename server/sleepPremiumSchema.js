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

const textSchema = { type: "string", minLength: 1, maxLength: 1200 };
const objectSchema = (properties, required = Object.keys(properties)) => ({
  type: "object",
  additionalProperties: false,
  properties,
  required,
});

const stringArraySchema = (minItems, maxItems) => ({
  type: "array",
  minItems,
  maxItems,
  items: textSchema,
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
    version: { type: "integer", const: 1 },
    profile: objectSchema({
      name: { type: "string", enum: [input.profile] },
      summary: textSchema,
    }),
    mainArea: objectSchema({
      title: { type: "string", enum: [getSleepPremiumMainAreaTitle(input)] },
      explanation: textSchema,
    }),
    connections: objectSchema({
      title: { type: "string", const: "Šta se kod tebe povezuje?" },
      items: stringArraySchema(2, 2),
    }),
    positiveOrWatch: objectSchema({
      mode: { type: "string", enum: [strengthMode] },
      title: { type: "string", const: getSleepPremiumPositiveOrWatchTitle(strengthMode) },
      text: textSchema,
    }),
    startingPoint: objectSchema({
      title: { type: "string", const: "Gde ima najviše smisla da počneš?" },
      text: textSchema,
    }),
    tonight: objectSchema({
      title: { type: "string", const: "Šta možeš da uradiš već večeras?" },
      actions: stringArraySchema(3, 3),
    }),
    sevenDayPlan: {
      type: "array",
      minItems: 7,
      maxItems: 7,
      items: objectSchema({
        day: { type: "integer", minimum: 1, maximum: 7 },
        title: textSchema,
        action: textSchema,
      }),
    },
    tracking: objectSchema({
      title: { type: "string", const: "Šta vredi da pratiš?" },
      items: stringArraySchema(2, 4),
    }),
    closing: textSchema,
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
  report.profile.summary,
  report.mainArea.title,
  report.mainArea.explanation,
  report.connections.title,
  ...report.connections.items,
  report.positiveOrWatch.title,
  report.positiveOrWatch.text,
  report.startingPoint.title,
  report.startingPoint.text,
  report.tonight.title,
  ...report.tonight.actions,
  ...report.sevenDayPlan.flatMap(({ title, action }) => [title, action]),
  report.tracking.title,
  ...report.tracking.items,
  report.closing,
];

const hasSuppliedAnswerQuote = (text, input) => {
  const quotes = [...text.matchAll(/[„“]([^”“]+)[”“]/gu)].map((match) => match[1].trim());
  return quotes.some((quoted) => input.answers.some((item) => item.answer === quoted));
};

const hasTextOnly = (value, maxLength = 1200) =>
  typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;

export const validateSleepPremiumReport = (candidate, input) => {
  if (!input || !SLEEP_PREMIUM_PROFILE_NAMES.includes(input.profile)) {
    return { valid: false, reason: "Invalid deterministic Premium input." };
  }
  if (!keysEqual(candidate, ["version", "profile", "mainArea", "connections", "positiveOrWatch", "startingPoint", "tonight", "sevenDayPlan", "tracking", "closing"])) {
    return { valid: false, reason: "Report root has missing or unknown fields." };
  }
  if (candidate.version !== 1) return { valid: false, reason: "Unsupported report version." };
  if (!keysEqual(candidate.profile, ["name", "summary"]) || candidate.profile.name !== input.profile || !hasTextOnly(candidate.profile.summary)) {
    return { valid: false, reason: "Profile name or summary is invalid." };
  }
  if (!keysEqual(candidate.mainArea, ["title", "explanation"]) || candidate.mainArea.title !== getSleepPremiumMainAreaTitle(input) || !hasTextOnly(candidate.mainArea.explanation)) {
    return { valid: false, reason: "Main area does not match deterministic results." };
  }
  if (!hasSuppliedAnswerQuote(candidate.mainArea.explanation, input)) {
    return { valid: false, reason: "Main-area explanation must cite an exact supplied answer." };
  }
  if (!keysEqual(candidate.connections, ["title", "items"]) || candidate.connections.title !== "Šta se kod tebe povezuje?" || !Array.isArray(candidate.connections.items) || candidate.connections.items.length !== 2 || candidate.connections.items.some((item) => !hasTextOnly(item))) {
    return { valid: false, reason: "Connections section is invalid." };
  }
  if (candidate.connections.items.some((item) => !hasSuppliedAnswerQuote(item, input))) {
    return { valid: false, reason: "Each connection must cite an exact supplied answer." };
  }

  const mode = getSleepPremiumStrengthMode(input);
  if (
    !keysEqual(candidate.positiveOrWatch, ["mode", "title", "text"]) ||
    candidate.positiveOrWatch.mode !== mode ||
    candidate.positiveOrWatch.title !== getSleepPremiumPositiveOrWatchTitle(mode) ||
    !hasTextOnly(candidate.positiveOrWatch.text)
  ) return { valid: false, reason: "Strength/watch section violates deterministic state." };

  if (!keysEqual(candidate.startingPoint, ["title", "text"]) || candidate.startingPoint.title !== "Gde ima najviše smisla da počneš?" || !hasTextOnly(candidate.startingPoint.text)) {
    return { valid: false, reason: "Starting point section is invalid." };
  }
  if (!keysEqual(candidate.tonight, ["title", "actions"]) || candidate.tonight.title !== "Šta možeš da uradiš već večeras?" || !Array.isArray(candidate.tonight.actions) || candidate.tonight.actions.length !== 3 || candidate.tonight.actions.some((item) => !hasTextOnly(item, 400))) {
    return { valid: false, reason: "Tonight section must contain exactly three actions." };
  }
  if (!Array.isArray(candidate.sevenDayPlan) || candidate.sevenDayPlan.length !== 7) {
    return { valid: false, reason: "Seven-day plan must contain exactly seven days." };
  }
  for (let index = 0; index < 7; index += 1) {
    const day = candidate.sevenDayPlan[index];
    if (!keysEqual(day, ["day", "title", "action"]) || day.day !== index + 1 || !hasTextOnly(day.title, 100) || !hasTextOnly(day.action, 400)) {
      return { valid: false, reason: `Seven-day plan entry ${index + 1} is invalid.` };
    }
  }
  if (!keysEqual(candidate.tracking, ["title", "items"]) || candidate.tracking.title !== "Šta vredi da pratiš?" || !Array.isArray(candidate.tracking.items) || candidate.tracking.items.length < 2 || candidate.tracking.items.length > 4 || candidate.tracking.items.some((item) => !hasTextOnly(item, 200))) {
    return { valid: false, reason: "Tracking section must contain two to four items." };
  }
  if (!hasTextOnly(candidate.closing, 800)) return { valid: false, reason: "Closing text is empty or too long." };

  const normalizeForSafety = (text) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/đ/gu, "d").toLowerCase();
  const customerStrings = collectReportStrings(candidate);
  const suppliedAnswers = new Set(input.answers.map((item) => item.answer));
  const quotedAnswers = customerStrings.flatMap((text) =>
    [...text.matchAll(/[„“]([^”“]+)[”“]/gu)].map((match) => match[1].trim())
  );
  if (quotedAnswers.some((quoted) => !suppliedAnswers.has(quoted))) {
    return { valid: false, reason: "Report contains quoted answer text not present in the supplied answers." };
  }
  const withoutEvidenceQuotes = (text) => text.replace(/[„“]([^”“]+)[”“]/gu, (whole, quoted) =>
    suppliedAnswers.has(quoted.trim()) ? " " : whole
  );
  const normalizedStrings = customerStrings.map((text) => normalizeForSafety(withoutEvidenceQuotes(text)));
  const unsafeCopyIndex = normalizedStrings.findIndex((text) => INVALID_CUSTOMER_COPY.test(text));
  if (unsafeCopyIndex >= 0) {
    return { valid: false, reason: `Report text item ${unsafeCopyIndex + 1} contains technical, diagnostic, causal, or score copy.` };
  }

  const strengthText = normalizeForSafety(withoutEvidenceQuotes(candidate.positiveOrWatch.text));
  if (mode === "watch" && UNSUPPORTED_STRENGTH_COPY.test(strengthText)) {
    return { valid: false, reason: "Watch mode must not claim an unsupported positive strength." };
  }
  if (mode === "watch" && !OBSERVATION_COPY.test(strengthText)) {
    return { valid: false, reason: "Watch mode must describe something to observe." };
  }
  if (mode === "strength") {
    const supportedStableAreas = SLEEP_PREMIUM_DIMENSION_KEYS.filter((key) => input.dimensions[key].state === "STABLE");
    if (!supportedStableAreas.some((key) => STABLE_EVIDENCE[key].test(strengthText))) {
      return { valid: false, reason: "Strength copy is not tied to any STABLE area." };
    }
  }

  const mainExplanation = normalizeForSafety(candidate.mainArea.explanation);
  const weakCoreAreas = CORE_DIMENSIONS.filter((key) => input.dimensions[key].state === "WEAK");
  if (weakCoreAreas.some((key) => !WEAK_CORE_EVIDENCE[key].test(mainExplanation))) {
    return { valid: false, reason: "Main-area explanation omits a weak core area." };
  }

  return { valid: true, report: candidate, reason: "ok" };
};
