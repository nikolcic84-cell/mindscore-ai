import assert from "node:assert/strict";
import { buildSleepPremiumInput } from "../server/sleepPremiumInput.js";
import { buildSleepPremiumFallback } from "../server/sleepPremiumFallback.js";
import {
  buildSleepPremiumJsonSchema,
  getSleepPremiumMainAreaTitle,
  getSleepPremiumPositiveOrWatchTitle,
  getSleepPremiumStrengthMode,
  validateSleepPremiumReport,
} from "../server/sleepPremiumSchema.js";
import { generateSleepPremiumReport } from "../server/sleepPremiumGenerator.js";
import { generateSleepPremiumPreview, isPremiumAiPreviewEnabled } from "../server/sleepPremiumPreview.js";
import { buildSleepPremiumPrompt } from "../server/sleepPremiumPrompt.js";
import { SLEEP_ANSWER_OPTIONS, SLEEP_QUESTIONS } from "../src/psychology/sleepAssessmentContent.js";
import { calculateSleepSignature } from "../src/psychology/sleepSignature.js";

const pointsForPositions = (positions) => positions.map((position) => 6 - position);
const resultFor = (positions) => calculateSleepSignature(positions.map((position) => position - 1));
const personas = {
  "MIRNA NOĆ": pointsForPositions(Array(12).fill(1)),
  "UMORAN SAN": pointsForPositions([5, 1, 1, 5, 1, 1, 1, 5, 1, 1, 5, 1]),
  "BUDAN UM": pointsForPositions([1, 5, 1, 1, 1, 5, 5, 1, 1, 1, 1, 1]),
  "ISPREKIDAN SAN": pointsForPositions([1, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 5]),
  "SAN POD PRITISKOM (dve slabe osnovne oblasti)": pointsForPositions([5, 5, 1, 5, 1, 5, 5, 5, 1, 1, 5, 1]),
  "SAN POD PRITISKOM (tri slabe osnovne oblasti)": pointsForPositions(Array(12).fill(5)),
};

const makeInput = (points) => buildSleepPremiumInput(points);
const makeValidReport = (input) => {
  const mode = getSleepPremiumStrengthMode(input);
  const positiveTitle = getSleepPremiumPositiveOrWatchTitle(mode);
  const mainTitle = getSleepPremiumMainAreaTitle(input);
  return {
    version: 1,
    profile: { name: input.profile, summary: "Tvoji odgovori daju nekoliko korisnih pogleda na tvoju noć." },
    mainArea: { title: mainTitle, explanation: `Ovaj deo tvojih odgovora („${input.answers[0].answer}“) vredi sagledati zajedno sa ostalima.` },
    connections: {
      title: "Šta se kod tebe povezuje?",
      items: [
        `Odgovor o večeri („${input.answers[5].answer}“) može se posmatrati uz jutarnji osećaj.`,
        `Tok noći („${input.answers[2].answer}“) i osećaj po buđenju daju različite delove tvoje priče.`,
      ],
    },
    positiveOrWatch: {
      mode,
      title: positiveTitle,
      text: mode === "strength"
        ? "U odgovorima o jutarnjem osećaju vidi se dobra osnova koju vredi sačuvati."
        : "U narednim danima obrati pažnju na deo sna koji se izdvaja.",
    },
    startingPoint: { title: "Gde ima najviše smisla da počneš?", text: "Izaberi jednu malu naviku koju možeš realno da ponoviš." },
    tonight: {
      title: "Šta možeš da uradiš već večeras?",
      actions: ["Pripremi miran završetak večeri.", "Zabeleži jutarnji osećaj.", "Zadrži jednu naviku koja ti prija."],
    },
    sevenDayPlan: Array.from({ length: 7 }, (_, index) => ({ day: index + 1, title: `Dan ${index + 1}`, action: "Zabeleži šta primećuješ i ponovi jednu malu naviku." })),
    tracking: { title: "Šta vredi da pratiš?", items: ["Približno vreme odlaska na spavanje.", "Kako se osećaš po buđenju."] },
    closing: "Ovo je informativni prikaz tvojih odgovora. Ako teškoće često utiču na svakodnevni život, razgovor sa lekarom može biti koristan.",
  };
};
const mockClient = (response) => ({ responses: { parse: async () => response } });
const withTonightAction = (report, index, action) => {
  const candidate = structuredClone(report);
  candidate.tonight.actions[index] = action;
  return candidate;
};

for (const [label, points] of Object.entries(personas)) {
  const input = makeInput(points);
  const expected = label.startsWith("SAN POD PRITISKOM") ? "SAN POD PRITISKOM" : label;
  assert.equal(input.profile, expected, `${label} input profile`);
  assert.equal(input.answers.length, 12);
  assert.deepEqual(input.answers.map(({ questionId }) => questionId), Array.from({ length: 12 }, (_, i) => `Q${i + 1}`));
  assert.deepEqual(input.answers.map(({ question }) => question), SLEEP_QUESTIONS);
  input.answers.forEach((item, index) => {
    const option = SLEEP_ANSWER_OPTIONS[index].find(({ points: optionPoints }) => optionPoints === points[index]);
    assert.equal(item.answer, option.text);
  });
  assert.ok(Number.isFinite(input.answers[5].mappedValue), "Q6 mapped value is retained");
  assert.ok(Number.isFinite(input.answers[11].mappedValue), "Q12 mapped value is retained");
  assert.ok(Object.values(input.dimensions).every(({ score, state }) => Number.isFinite(score) && ["STABLE", "MIXED", "WEAK"].includes(state)));
  if (label === "MIRNA NOĆ") {
    assert.deepEqual([input.dimensions.recovery.state, input.dimensions.sleepOnset.state, input.dimensions.continuity.state], ["STABLE", "STABLE", "STABLE"]);
  }
  if (label.includes("(dve slabe")) {
    assert.equal([input.dimensions.recovery, input.dimensions.sleepOnset, input.dimensions.continuity].filter(({ state }) => state === "WEAK").length, 2);
  }
  if (label.includes("(tri slabe")) {
    assert.equal([input.dimensions.recovery, input.dimensions.sleepOnset, input.dimensions.continuity].filter(({ state }) => state === "WEAK").length, 3);
  }
  const fallback = buildSleepPremiumFallback(input);
  assert.equal(validateSleepPremiumReport(fallback, input).valid, true, `${label} fallback validates`);
}

const noStableInput = makeInput(pointsForPositions(Array(12).fill(3)));
assert.equal(getSleepPremiumStrengthMode(noStableInput), "watch");
assert.equal(getSleepPremiumPositiveOrWatchTitle("watch"), "Šta još vredi da pratiš?");
const stableInput = makeInput(personas["MIRNA NOĆ"]);
assert.equal(getSleepPremiumStrengthMode(stableInput), "strength");
assert.equal(getSleepPremiumPositiveOrWatchTitle("strength"), "Šta ti već ide dobro?");

const weakPairInput = makeInput(personas["SAN POD PRITISKOM (dve slabe osnovne oblasti)"]);
assert.equal(getSleepPremiumMainAreaTitle(weakPairInput), "Više delova sna");
const threeWeakInput = makeInput(personas["SAN POD PRITISKOM (tri slabe osnovne oblasti)"]);
assert.equal(getSleepPremiumMainAreaTitle(threeWeakInput), "Više delova sna");
const rhythmOnlyInput = makeInput(pointsForPositions([3, 3, 3, 3, 4, 3, 3, 3, 5, 5, 3, 3]));
assert.equal(resultFor([3, 3, 3, 3, 4, 3, 3, 3, 5, 5, 3, 3]).signature, "SAN POD PRITISKOM");
assert.equal(getSleepPremiumMainAreaTitle(rhythmOnlyInput), "Ritam spavanja kao dodatna tema");
const tiedInput = makeInput(pointsForPositions(Array(12).fill(3)));
assert.equal(tiedInput.dimensions.recovery.score, tiedInput.dimensions.sleepOnset.score);
assert.equal(getSleepPremiumMainAreaTitle(tiedInput), "Tvoja ukupna slika sna");

const q6Points = [...personas["MIRNA NOĆ"]];
q6Points[5] = 1;
const q6Input = makeInput(q6Points);
assert.equal(q6Input.answers[5].mappedValue, 0);
assert.ok(buildSleepPremiumFallback(q6Input).mainArea.explanation.includes(q6Input.answers[5].answer));
const q12Points = [...personas["MIRNA NOĆ"]];
q12Points[11] = 1;
const q12Input = makeInput(q12Points);
assert.equal(q12Input.answers[11].mappedValue, 0);
assert.ok(buildSleepPremiumFallback(q12Input).mainArea.explanation.includes(q12Input.answers[11].answer));

const validationInput = makeInput(personas["MIRNA NOĆ"]);
const validReport = makeValidReport(validationInput);
const exactEvidence = validationInput.answers[0].answer;
const explanationWith = (text) => {
  const report = structuredClone(validReport);
  report.mainArea.explanation = text;
  return report;
};
const validReportValidation = validateSleepPremiumReport(validReport, validationInput);
assert.equal(validReportValidation.valid, true, validReportValidation.reason);
assert.equal(isPremiumAiPreviewEnabled({ ENABLE_PREMIUM_AI_PREVIEW: "true" }), true);
assert.equal(isPremiumAiPreviewEnabled({ ENABLE_PREMIUM_AI_PREVIEW: "TRUE" }), false);
assert.equal(isPremiumAiPreviewEnabled({ ENABLE_PREMIUM_AI_PREVIEW: "1" }), false);
assert.equal(isPremiumAiPreviewEnabled({}), false);
let disabledPreviewCalls = 0;
const disabledPreview = await generateSleepPremiumPreview({
  enabled: false,
  answers: personas["BUDAN UM"],
  openaiClient: { responses: { parse: async () => { disabledPreviewCalls += 1; return {}; } } },
  apiKeyAvailable: true,
});
assert.equal(disabledPreview.status, 404);
assert.equal(disabledPreviewCalls, 0);
const invalidAnswersPreview = await generateSleepPremiumPreview({
  enabled: true,
  answers: [1, 2],
  openaiClient: { responses: { parse: async () => { disabledPreviewCalls += 1; return {}; } } },
  apiKeyAvailable: true,
});
assert.equal(invalidAnswersPreview.status, 400);
assert.equal(disabledPreviewCalls, 0);

const awakeInput = makeInput(personas["BUDAN UM"]);
const awakeAiCandidate = buildSleepPremiumFallback(awakeInput);
const previewLogs = [];
let previewAiCalls = 0;
const awakePreview = await generateSleepPremiumPreview({
  enabled: true,
  answers: personas["BUDAN UM"],
  openaiClient: { responses: { parse: async () => { previewAiCalls += 1; return { status: "completed", output_parsed: awakeAiCandidate }; } } },
  apiKeyAvailable: true,
  log: (event, details) => previewLogs.push({ event, details }),
});
assert.equal(awakePreview.status, 200);
assert.equal(awakePreview.body.source, "ai");
assert.equal(awakePreview.body.deterministicProfile, "BUDAN UM");
assert.equal(awakePreview.body.report.profile.name, "BUDAN UM");
assert.equal(previewAiCalls, 1);
assert.equal(Object.hasOwn(awakePreview.body.report.positiveOrWatch, "mode"), false);
assert.equal(previewLogs.some(({ event }) => event === "REAL AI: SUCCESS"), true);
assert.equal(previewLogs.some(({ event }) => event === "SCHEMA: PASS"), true);
assert.equal(previewLogs.some(({ event }) => event === "FALLBACK USED: NO"), true);
assert.equal(previewLogs.some(({ event, details }) => event === "PREMIUM PREVIEW REQUEST" && details.deterministicProfile === "BUDAN UM"), true);

const invalidAwakeAiCandidate = structuredClone(awakeAiCandidate);
invalidAwakeAiCandidate.profile.name = "MIRNA NOĆ";
const invalidPreviewLogs = [];
const invalidAiPreview = await generateSleepPremiumPreview({
  enabled: true,
  answers: personas["BUDAN UM"],
  openaiClient: mockClient({ status: "completed", output_parsed: invalidAwakeAiCandidate }),
  apiKeyAvailable: true,
  log: (event, details) => invalidPreviewLogs.push({ event, details }),
});
assert.equal(invalidAiPreview.status, 200);
assert.equal(invalidAiPreview.body.source, "fallback");
assert.equal(invalidAiPreview.body.deterministicProfile, "BUDAN UM");
assert.equal(invalidAiPreview.body.report.profile.name, "BUDAN UM");
assert.equal(invalidPreviewLogs.some(({ event }) => event === "REAL AI: FAILED"), true);
assert.equal(invalidPreviewLogs.some(({ event }) => event === "SCHEMA: PASS"), true);
assert.equal(invalidPreviewLogs.some(({ event }) => event === "FALLBACK USED: YES"), true);
const naturalMainArea = explanationWith(`Pri buđenju si izabrao/la „${exactEvidence}“. Vredi posmatrati ovaj deo sna zajedno sa ostatkom noći.`);
assert.equal(validateSleepPremiumReport(naturalMainArea, validationInput).valid, true);

const scoredMainArea = explanationWith(`Pri buđenju si izabrao/la „${exactEvidence}“. Rezultat je 75%, iznad praga od 60.`);
const scoredMainAreaValidation = validateSleepPremiumReport(scoredMainArea, validationInput);
assert.equal(scoredMainAreaValidation.valid, false);
assert.equal(scoredMainAreaValidation.diagnostic.field, "mainArea.explanation");

const technicalMainArea = explanationWith(`Odgovor „${exactEvidence}“ odgovara stanju STABLE prema scoring dimenziji.`);
assert.equal(validateSleepPremiumReport(technicalMainArea, validationInput).valid, false);

const medicalMainArea = explanationWith(`Odgovor „${exactEvidence}“ potvrđuje da imaš nesanicu.`);
assert.equal(validateSleepPremiumReport(medicalMainArea, validationInput).valid, false);

const causalMainArea = explanationWith(`Odgovor „${exactEvidence}“ je uzrok tvog problema sa snom.`);
assert.equal(validateSleepPremiumReport(causalMainArea, validationInput).valid, false);

const knownCauseMainArea = explanationWith(`Odgovor „${exactEvidence}“ otkriva da je pravi uzrok problema sa snom poznat.`);
assert.equal(validateSleepPremiumReport(knownCauseMainArea, validationInput).valid, false);

const blankMainArea = explanationWith("   ");
const blankMainAreaValidation = validateSleepPremiumReport(blankMainArea, validationInput);
assert.equal(blankMainAreaValidation.valid, false);
assert.equal(blankMainAreaValidation.diagnostic.field, "mainArea.explanation");

const nonStringMainArea = explanationWith(42);
assert.equal(validateSleepPremiumReport(nonStringMainArea, validationInput).valid, false);

const oversizedMainArea = explanationWith(`„${exactEvidence}“ ${"x".repeat(500)}`);
assert.equal(validateSleepPremiumReport(oversizedMainArea, validationInput).valid, false);

const safeSummary = "Tvoji odgovori opisuju tvoje iskustvo sa snom iz više uglova. Izveštaj povezuje ove utiske u pregled koji možeš pažljivo da razmotriš.";
const safeSummaryReport = structuredClone(validReport);
safeSummaryReport.profile.summary = safeSummary;
assert.equal(validateSleepPremiumReport(safeSummaryReport, validationInput).valid, true);

const unsafeNumericSummary = structuredClone(validReport);
unsafeNumericSummary.profile.summary = "Tvoj profil je STABLE, rezultat je 75/100 i iznad praga od 60.";
const unsafeNumericValidation = validateSleepPremiumReport(unsafeNumericSummary, validationInput);
assert.equal(unsafeNumericValidation.valid, false);
assert.equal(unsafeNumericValidation.diagnostic.field, "profile.summary");
assert.match(unsafeNumericValidation.diagnostic.expected, /no digits, numeric scores, or thresholds/i);
assert.equal(Object.hasOwn(unsafeNumericValidation.diagnostic.received, "value"), false);

const internalStateSummary = structuredClone(validReport);
internalStateSummary.profile.summary = "Tvoje stanje je STABLE.";
assert.equal(validateSleepPremiumReport(internalStateSummary, validationInput).valid, false);

const unsafeMedicalSummary = structuredClone(validReport);
unsafeMedicalSummary.profile.summary = "Tvoji odgovori potvrđuju da imaš nesanicu.";
const unsafeMedicalValidation = validateSleepPremiumReport(unsafeMedicalSummary, validationInput);
assert.equal(unsafeMedicalValidation.valid, false);
assert.equal(unsafeMedicalValidation.diagnostic.field, "profile.summary");

const blankSummary = structuredClone(validReport);
blankSummary.profile.summary = "   ";
const blankSummaryValidation = validateSleepPremiumReport(blankSummary, validationInput);
assert.equal(blankSummaryValidation.valid, false);
assert.equal(blankSummaryValidation.diagnostic.field, "profile.summary");
assert.equal(blankSummaryValidation.diagnostic.received.blank, true);

const schema = buildSleepPremiumJsonSchema(validationInput);
assert.equal(schema.schema.properties.profile.properties.name.enum[0], validationInput.profile);
assert.equal(schema.schema.properties.profile.properties.summary.pattern, "^[^0-9]*\\S[^0-9]*$");
assert.match(schema.schema.properties.profile.properties.summary.description, /digits.*thresholds/i);
assert.equal(schema.schema.properties.mainArea.properties.explanation.maxLength, 500);
assert.equal(schema.schema.properties.mainArea.properties.explanation.pattern, "\\S");
assert.match(schema.schema.properties.mainArea.properties.explanation.description, /medical diagnoses.*unsupported causal claims/i);
const prompt = buildSleepPremiumPrompt(validationInput, {
  profile: validationInput.profile,
  profileSummaryMaxLength: schema.schema.properties.profile.properties.summary.maxLength,
  mainAreaTitle: schema.schema.properties.mainArea.properties.title.enum[0],
  mainAreaExplanationMaxLength: schema.schema.properties.mainArea.properties.explanation.maxLength,
  tonightActionMaxLength: schema.schema.properties.tonight.properties.actions.items.maxLength,
  sevenDayActionMaxLength: schema.schema.properties.sevenDayPlan.items.properties.action.maxLength,
  positiveOrWatchMode: schema.schema.properties.positiveOrWatch.properties.mode.enum[0],
  positiveOrWatchTitle: schema.schema.properties.positiveOrWatch.properties.title.const,
});
assert.equal(prompt.includes("profile.summary je kratak, prirodan tekst za korisnika (1–2 rečenice"), true);
assert.equal(prompt.includes("ne navodi cifre, bodove, procente, pragove"), true);
assert.equal(prompt.includes("mainArea.explanation je kratko, prirodno srpsko obraćanje korisniku od najviše 500 znakova"), true);
assert.equal(prompt.includes("pravi uzrok problema sa snom"), true);
assert.equal(prompt.includes("Pokušaj da poslednjih 30 minuta pre spavanja provedeš bez telefona."), true);
assert.equal(prompt.includes("Lezi približno u isto vreme kao prethodne večeri."), true);
assert.equal(prompt.includes("Ako ti misli ostanu aktivne, zapiši ih kratko pre nego što legneš."), true);
assert.equal(prompt.includes("LOŠI primeri — nikada ne piši ovakve tvrdnje"), true);
assert.equal(prompt.includes("Ne preformuliši ove primere kao preporuke."), true);
assert.equal(prompt.includes("Svaka od svih sedam stavki sevenDayPlan[].action mora biti zaseban"), true);
assert.equal(prompt.includes("Probaj da ujutru zabeležiš kako se osećaš."), true);
assert.equal(prompt.includes("Uporedi kako se osećaš nakon različitih večernjih rutina."), true);
assert.equal(prompt.includes("Ne obećavaj ishod niti tvrdi da je dejstvo izvesno."), true);

const validTonightAction = withTonightAction(validReport, 2, "Ako ti misli ostanu aktivne, zapiši ih kratko pre nego što legneš.");
assert.equal(validateSleepPremiumReport(validTonightAction, validationInput).valid, true);

const unsafeTonightCases = [
  ["diagnostic", "Ova nesanica pokazuje da imaš poremećaj sna."],
  ["causal", "Kasno ležanje izaziva tvoj loš san."],
  ["score/threshold/internal", "Tvoja WEAK oblast ima rezultat 42/100, ispod praga."],
  ["technical", "Optimizuj sleep classifier pre spavanja."],
];
for (const [label, text] of unsafeTonightCases) {
  const candidate = withTonightAction(validReport, 2, text);
  const validation = validateSleepPremiumReport(candidate, validationInput);
  assert.equal(validation.valid, false, `${label} action must fail`);
  assert.equal(validation.diagnostic.field, "tonight.actions[2]");
}

const blankTonightAction = withTonightAction(validReport, 2, "   ");
const blankTonightActionValidation = validateSleepPremiumReport(blankTonightAction, validationInput);
assert.equal(blankTonightActionValidation.valid, false);
assert.equal(blankTonightActionValidation.diagnostic.field, "tonight.actions[2]");
assert.equal(blankTonightActionValidation.diagnostic.received.blank, true);

const nonStringTonightAction = withTonightAction(validReport, 2, null);
const nonStringTonightActionValidation = validateSleepPremiumReport(nonStringTonightAction, validationInput);
assert.equal(nonStringTonightActionValidation.valid, false);
assert.equal(nonStringTonightActionValidation.diagnostic.field, "tonight.actions[2]");
assert.equal(nonStringTonightActionValidation.diagnostic.received.type, "null");

const unsafeSevenDayAction = structuredClone(validReport);
unsafeSevenDayAction.sevenDayPlan[2].action = "Kasno ležanje izaziva tvoj loš san.";
const unsafeSevenDayActionValidation = validateSleepPremiumReport(unsafeSevenDayAction, validationInput);
assert.equal(unsafeSevenDayActionValidation.valid, false);
assert.equal(unsafeSevenDayActionValidation.diagnostic.field, "sevenDayPlan[2].action");

const safeSevenDayActions = [
  "Probaj da ujutru zabeležiš kako se osećaš.",
  "Obrati pažnju na to šta ti prija u večernjoj rutini.",
  "Zapiši približno vreme kada si legao/la.",
  "Pokušaj da ponoviš jednu malu naviku koja ti odgovara.",
  "Uporedi kako se osećaš nakon različitih večernjih rutina.",
  "Zabeleži šta želiš da zadržiš u svojoj rutini.",
  "Probaj da odvojiš nekoliko mirnih minuta pre odlaska u krevet.",
];
const completeSafePlan = structuredClone(validReport);
completeSafePlan.sevenDayPlan.forEach((day, index) => {
  day.action = safeSevenDayActions[index];
});
assert.equal(validateSleepPremiumReport(completeSafePlan, validationInput).valid, true);

for (let index = 0; index < 7; index += 1) {
  const causalPlan = structuredClone(validReport);
  causalPlan.sevenDayPlan[index].action = "Kasno ležanje izaziva tvoj loš san.";
  const causalPlanValidation = validateSleepPremiumReport(causalPlan, validationInput);
  assert.equal(causalPlanValidation.valid, false, `day ${index + 1} causal action must fail`);
  assert.equal(causalPlanValidation.diagnostic.field, `sevenDayPlan[${index}].action`);

  const promisePlan = structuredClone(validReport);
  promisePlan.sevenDayPlan[index].action = "Probaj ovu rutinu; sigurno će poboljšati tvoj san.";
  const promisePlanValidation = validateSleepPremiumReport(promisePlan, validationInput);
  assert.equal(promisePlanValidation.valid, false, `day ${index + 1} guaranteed outcome must fail`);
  assert.equal(promisePlanValidation.diagnostic.field, `sevenDayPlan[${index}].action`);
  assert.match(promisePlanValidation.reason, /promises a sleep outcome/i);
}

await assert.rejects(
  generateSleepPremiumReport({
    input: validationInput,
    openaiClient: mockClient({ status: "completed", output_parsed: unsafeNumericSummary }),
    apiKeyAvailable: true,
    fallbackOnError: false,
  }),
  (error) => error.code === "PREMIUM_SCHEMA_VALIDATION" && error.diagnostic.field === "profile.summary"
    && !Object.hasOwn(error.diagnostic.received, "value")
);

await assert.rejects(
  generateSleepPremiumReport({
    input: validationInput,
    openaiClient: mockClient({ status: "completed", output_parsed: causalMainArea }),
    apiKeyAvailable: true,
    fallbackOnError: false,
  }),
  (error) => error.code === "PREMIUM_SCHEMA_VALIDATION" && error.diagnostic.field === "mainArea.explanation"
    && !Object.hasOwn(error.diagnostic.received, "value")
);

const alteredAnswerQuote = structuredClone(validReport);
alteredAnswerQuote.mainArea.explanation = "Ovaj deo vredi sagledati uz odgovor „izmenjen odgovor“.";
const alteredQuoteValidation = validateSleepPremiumReport(alteredAnswerQuote, validationInput);
assert.equal(alteredQuoteValidation.valid, false);
assert.match(alteredQuoteValidation.reason, /exact supplied answer/i);
assert.equal(alteredQuoteValidation.diagnostic.field, "mainArea.explanation");
assert.equal(alteredQuoteValidation.diagnostic.received.type, "string");
assert.equal(typeof alteredQuoteValidation.diagnostic.received.length, "number");
assert.equal(Object.hasOwn(alteredQuoteValidation.diagnostic.received, "value"), false);
const wrongProfile = structuredClone(validReport);
wrongProfile.profile.name = "BUDAN UM";
assert.equal(validateSleepPremiumReport(wrongProfile, validationInput).valid, false);
const wrongMode = structuredClone(validReport);
wrongMode.positiveOrWatch.mode = "watch";
wrongMode.positiveOrWatch.title = "Šta još vredi da pratiš?";
assert.equal(validateSleepPremiumReport(wrongMode, validationInput).valid, false);
const wrongModeResult = await generateSleepPremiumReport({
  input: validationInput,
  openaiClient: mockClient({ status: "completed", output_parsed: wrongMode }),
  apiKeyAvailable: true,
});
assert.equal(wrongModeResult.source, "fallback");
const wrongMainArea = structuredClone(validReport);
wrongMainArea.mainArea.title = "Ritam spavanja";
assert.equal(validateSleepPremiumReport(wrongMainArea, validationInput).valid, false);
const wrongMainAreaResult = await generateSleepPremiumReport({
  input: validationInput,
  openaiClient: mockClient({ status: "completed", output_parsed: wrongMainArea }),
  apiKeyAvailable: true,
});
assert.equal(wrongMainAreaResult.source, "fallback");
const omittedField = structuredClone(validReport);
delete omittedField.connections;
assert.equal(validateSleepPremiumReport(omittedField, validationInput).valid, false);
const shortPlan = structuredClone(validReport);
shortPlan.sevenDayPlan.pop();
assert.equal(validateSleepPremiumReport(shortPlan, validationInput).valid, false);
const extraField = structuredClone(validReport);
extraField.unexpected = true;
assert.equal(validateSleepPremiumReport(extraField, validationInput).valid, false);
const extraNested = structuredClone(validReport);
extraNested.tonight.unexpected = true;
assert.equal(validateSleepPremiumReport(extraNested, validationInput).valid, false);
const emptyString = structuredClone(validReport);
emptyString.closing = "  ";
assert.equal(validateSleepPremiumReport(emptyString, validationInput).valid, false);
const medicalClaim = structuredClone(validReport);
medicalClaim.closing = "Ovo dokazuje da imaš depresiju zbog svog sna.";
assert.equal(validateSleepPremiumReport(medicalClaim, validationInput).valid, false);
const causalClaim = structuredClone(validReport);
causalClaim.closing = "Nesanica je uzrokovana tvojim hormonima.";
assert.equal(validateSleepPremiumReport(causalClaim, validationInput).valid, false);
const sevenDaysOutOfOrder = structuredClone(validReport);
sevenDaysOutOfOrder.sevenDayPlan[5].day = 7;
assert.equal(validateSleepPremiumReport(sevenDaysOutOfOrder, validationInput).valid, false);
assert.equal(schema.type, "json_schema");
assert.equal(schema.schema.properties.sevenDayPlan.minItems, 7);
assert.equal(schema.schema.properties.sevenDayPlan.maxItems, 7);
assert.equal(schema.schema.properties.version.enum[0], 1);
assert.equal(schema.schema.properties.profile.properties.summary.maxLength, 1200);
assert.equal(schema.schema.properties.tonight.properties.actions.items.maxLength, 400);
assert.match(schema.schema.properties.tonight.properties.actions.items.description, /natural everyday Serbian.*diagnosis.*causal claims/i);
assert.equal(schema.schema.properties.sevenDayPlan.items.properties.title.maxLength, 100);
assert.equal(schema.schema.properties.sevenDayPlan.items.properties.action.maxLength, 400);
assert.match(schema.schema.properties.sevenDayPlan.items.properties.action.description, /everyday Serbian wellness suggestion.*diagnoses.*causal claims/i);
assert.match(schema.schema.properties.sevenDayPlan.items.properties.action.description, /Do not claim or imply the action will definitely improve, fix, cure, regulate, or solve sleep/i);
assert.equal(schema.schema.properties.tracking.properties.items.items.maxLength, 200);
assert.equal(schema.schema.properties.closing.maxLength, 800);
assert.equal(schema.schema.properties.closing.pattern, "\\S");

const overlongAction = structuredClone(validReport);
overlongAction.tonight.actions[0] = "x".repeat(401);
const overlongActionError = await assert.rejects(
  generateSleepPremiumReport({
    input: validationInput,
    openaiClient: mockClient({ status: "completed", output_parsed: overlongAction }),
    apiKeyAvailable: true,
    fallbackOnError: false,
  }),
  (error) => error.code === "PREMIUM_SCHEMA_VALIDATION" && error.diagnostic.field === "tonight.actions[0]"
    && error.diagnostic.expected === "nonblank string, 1–400 characters"
    && error.diagnostic.received.type === "string"
    && error.diagnostic.received.length === 401
    && !Object.hasOwn(error.diagnostic.received, "value")
);
assert.equal(overlongActionError, undefined);

const invalidJsonResult = await generateSleepPremiumReport({
  input: validationInput,
  openaiClient: mockClient({ status: "completed", output_parsed: null }),
  apiKeyAvailable: true,
});
assert.equal(invalidJsonResult.source, "fallback");
assert.equal(validateSleepPremiumReport(invalidJsonResult.report, validationInput).valid, true);
const jsonParseFailure = await generateSleepPremiumReport({
  input: validationInput,
  openaiClient: { responses: { parse: async () => { throw new SyntaxError("Unexpected end of JSON input"); } } },
  apiKeyAvailable: true,
});
assert.equal(jsonParseFailure.source, "fallback");
assert.equal(validateSleepPremiumReport(jsonParseFailure.report, validationInput).valid, true);

const wrongProfileCandidate = makeValidReport(validationInput);
wrongProfileCandidate.profile.name = "UMORAN SAN";
const wrongProfileResult = await generateSleepPremiumReport({
  input: validationInput,
  openaiClient: mockClient({ status: "completed", output_parsed: wrongProfileCandidate }),
  apiKeyAvailable: true,
});
assert.equal(wrongProfileResult.source, "fallback");
assert.equal(wrongProfileResult.report.profile.name, validationInput.profile);

const responseApiShapeResult = await generateSleepPremiumReport({
  input: validationInput,
  openaiClient: mockClient({
    status: "completed",
    output: [{
      type: "message",
      content: [{ type: "output_text", text: JSON.stringify(validReport) }],
    }],
  }),
  apiKeyAvailable: true,
});
assert.equal(responseApiShapeResult.source, "ai");
assert.deepEqual(responseApiShapeResult.report, validReport);

const incompleteResult = await generateSleepPremiumReport({
  input: validationInput,
  openaiClient: mockClient({ status: "completed", output_parsed: { version: 1 } }),
  apiKeyAvailable: true,
});
assert.equal(incompleteResult.source, "fallback");

const shortSevenDayCandidate = makeValidReport(validationInput);
shortSevenDayCandidate.sevenDayPlan.pop();
const shortPlanResult = await generateSleepPremiumReport({
  input: validationInput,
  openaiClient: mockClient({ status: "completed", output_parsed: shortSevenDayCandidate }),
  apiKeyAvailable: true,
});
assert.equal(shortPlanResult.source, "fallback");

const unknownFieldCandidate = makeValidReport(validationInput);
unknownFieldCandidate.additional = "not allowed";
const unknownFieldResult = await generateSleepPremiumReport({
  input: validationInput,
  openaiClient: mockClient({ status: "completed", output_parsed: unknownFieldCandidate }),
  apiKeyAvailable: true,
});
assert.equal(unknownFieldResult.source, "fallback");

const timeoutResult = await generateSleepPremiumReport({
  input: validationInput,
  openaiClient: { responses: { parse: () => new Promise(() => {}) } },
  apiKeyAvailable: true,
  timeoutMs: 10,
});
assert.equal(timeoutResult.source, "fallback");
assert.equal(validateSleepPremiumReport(timeoutResult.report, validationInput).valid, true);
const stagingTimeoutResult = await generateSleepPremiumReport({
  input: validationInput,
  openaiClient: mockClient({ status: "completed", output_parsed: validReport }),
  apiKeyAvailable: true,
  fallbackOnError: false,
  timeoutMs: 60_000,
});
assert.equal(stagingTimeoutResult.source, "ai");
await assert.rejects(
  generateSleepPremiumReport({
    input: validationInput,
    openaiClient: { responses: { parse: () => new Promise(() => {}) } },
    apiKeyAvailable: true,
    fallbackOnError: false,
    timeoutMs: 10,
  }),
  (error) => error.name === "PremiumAITimeoutError"
);

const fallbackResult = await generateSleepPremiumReport({ input: noStableInput, apiKeyAvailable: false });
assert.equal(fallbackResult.source, "fallback");
assert.equal(fallbackResult.report.positiveOrWatch.mode, "watch");
assert.equal(validateSleepPremiumReport(fallbackResult.report, noStableInput).valid, true);

await assert.rejects(
  generateSleepPremiumReport({ input: validationInput, apiKeyAvailable: false, fallbackOnError: false }),
  /unavailable/i
);
await assert.rejects(
  generateSleepPremiumReport({
    input: validationInput,
    openaiClient: { responses: { parse: async () => { throw new Error("simulated provider failure"); } } },
    apiKeyAvailable: true,
    fallbackOnError: false,
  }),
  /simulated provider failure/
);

assert.throws(() => makeInput([5, 5]), /exactly twelve/);
console.log("Premium input, schema, deterministic enforcement, strict validation, and fallback cases passed.");
