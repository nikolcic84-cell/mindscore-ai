import assert from "node:assert/strict";
import { buildSleepPremiumInput } from "../server/sleepPremiumInput.js";
import { buildSleepPremiumFallback } from "../server/sleepPremiumFallback.js";
import {
  buildSleepPremiumJsonSchema,
  getSleepPremiumAreaOverview,
  getSleepPremiumPriority,
  getSleepPremiumStrengthMode,
  validateSleepPremiumReport,
} from "../server/sleepPremiumSchema.js";
import { generateSleepPremiumReport, SLEEP_PREMIUM_AI_TIMEOUT_MS } from "../server/sleepPremiumGenerator.js";
import { generateSleepPremiumPreview, isPremiumAiPreviewEnabled } from "../server/sleepPremiumPreview.js";
import { buildSleepPremiumPrompt } from "../server/sleepPremiumPrompt.js";

const positionsToPoints = (positions) => positions.map((position) => 6 - position);
const personas = [
  positionsToPoints(Array(12).fill(1)),
  positionsToPoints([5, 1, 1, 5, 1, 1, 1, 5, 1, 1, 5, 1]),
  positionsToPoints([1, 5, 1, 1, 1, 5, 5, 1, 1, 1, 1, 1]),
  positionsToPoints([1, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 5]),
  positionsToPoints(Array(12).fill(5)),
  positionsToPoints(Array(12).fill(3)),
];
const mockClient = (response, onRequest = () => {}) => ({
  responses: {
    create: async (request) => {
      onRequest(request);
      return response;
    },
  },
});
const input = buildSleepPremiumInput(personas[0]);
const fallback = buildSleepPremiumFallback(input);
assert.deepEqual(
  new Set(personas.map((points) => buildSleepPremiumInput(points).profile)),
  new Set(["MIRNA NOĆ", "UMORAN SAN", "BUDAN UM", "ISPREKIDAN SAN", "SAN POD PRITISKOM"]),
);

assert.equal(SLEEP_PREMIUM_AI_TIMEOUT_MS, 60_000);
for (const points of personas) {
  const profileInput = buildSleepPremiumInput(points);
  const report = buildSleepPremiumFallback(profileInput);
  assert.equal(validateSleepPremiumReport(report, profileInput).valid, true);
  assert.equal(report.profile, profileInput.profile);
  assert.equal(report.priority.area, getSleepPremiumPriority(profileInput).title);
  assert.equal(report.stable_or_tracking.mode, getSleepPremiumStrengthMode(profileInput));
  assert.equal(report.connections.length >= 2 && report.connections.length <= 4, true);
  assert.equal(report.seven_day_plan.length, 7);
  assert.deepEqual(report.seven_day_plan.map(({ day }) => day), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(report.alternatives.length >= 1 && report.alternatives.length <= 2, true);
  assert.equal(report.review_questions.length, 3);
  assert.equal(new Set(report.review_questions).size, 3);
  assert.equal(report.review_questions.every((question) => question.endsWith("?")), true);
  assert.equal(report.seven_day_plan.some(({ action, observe }) => action.includes("${focus}") || observe.includes("${focus}")), false);
  const overview = getSleepPremiumAreaOverview(profileInput);
  assert.deepEqual(overview.map(({ key }) => key), ["recovery", "sleepOnset", "continuity", "rhythm"]);
  assert.equal(overview.every(({ title, status }) => title && ["Deluje mirnije", "Vredi pratiti", "Ovde se najviše izdvaja"].includes(status)), true);
  assert.equal(JSON.stringify(overview).match(/STABLE|MIXED|WEAK|score|\d/iu), null);
}

const contractKeys = ["version", "profile", "profile_explanation", "priority", "connections", "stable_or_tracking", "seven_day_plan", "alternatives", "review_questions", "after_seven_days", "closing"];
assert.deepEqual(Object.keys(fallback), contractKeys);
const schema = buildSleepPremiumJsonSchema(input);
assert.equal(schema.strict, true);
assert.equal(schema.schema.additionalProperties, false);
assert.deepEqual(schema.schema.required, contractKeys);
assert.deepEqual(schema.schema.properties.profile.enum, [input.profile]);
assert.equal(schema.schema.properties.review_questions.minItems, 3);
assert.equal(schema.schema.properties.review_questions.maxItems, 3);
assert.equal(schema.schema.properties.seven_day_plan.minItems, 7);
assert.equal(schema.schema.properties.seven_day_plan.maxItems, 7);
assert.equal(schema.schema.properties.priority.properties.area.enum[0], getSleepPremiumPriority(input).title);

const priorityFixture = structuredClone(input);
priorityFixture.dimensions = {
  recovery: { score: 50, state: "WEAK" },
  sleepOnset: { score: 45, state: "WEAK" },
  continuity: { score: 55, state: "STABLE" },
  rhythm: { score: 60, state: "STABLE" },
};
assert.equal(getSleepPremiumPriority(priorityFixture).key, "sleepOnset");
priorityFixture.dimensions.recovery.score = 45;
assert.equal(getSleepPremiumPriority(priorityFixture).key, "multiple");
priorityFixture.dimensions = {
  recovery: { score: 80, state: "STABLE" },
  sleepOnset: { score: 70, state: "STABLE" },
  continuity: { score: 65, state: "STABLE" },
  rhythm: { score: 50, state: "MIXED" },
};
priorityFixture.answers.find(({ questionId }) => questionId === "Q6").mappedValue = 3;
priorityFixture.answers.find(({ questionId }) => questionId === "Q12").mappedValue = 3;
assert.equal(getSleepPremiumPriority(priorityFixture).key, "rhythm");
priorityFixture.answers.find(({ questionId }) => questionId === "Q6").mappedValue = 1;
assert.equal(getSleepPremiumPriority(priorityFixture).key, "sleepOnset");
priorityFixture.answers.find(({ questionId }) => questionId === "Q6").mappedValue = 3;
priorityFixture.answers.find(({ questionId }) => questionId === "Q12").mappedValue = 1;
assert.equal(getSleepPremiumPriority(priorityFixture).key, "continuity");

const prompt = buildSleepPremiumPrompt(input, {
  profile: input.profile,
  priorityArea: getSleepPremiumPriority(input).title,
  mode: getSleepPremiumStrengthMode(input),
  stableTitle: schema.schema.properties.stable_or_tracking.properties.title.enum[0],
  stableAreas: getSleepPremiumAreaOverview(input).filter(({ status }) => status === "Deluje mirnije").map(({ title }) => title),
  profileExplanationMaxLength: schema.schema.properties.profile_explanation.maxLength,
});
assert.match(prompt, /review_questions: vrati TAČNO tri/);
assert.match(prompt, /postepen, koherentan mini-eksperiment/);
assert.match(prompt, /ne izvodi ocene/);
assert.equal(prompt.includes("mappedValue"), false);
assert.equal(prompt.includes("internalScores"), false);
assert.match(schema.schema.properties.connections.items.description, /two distinct complete answer texts.*two different questionIds/i);
assert.match(prompt, /SVAKA pojedinačna stavka OBAVEZNO mora sadržati DVA RAZLIČITA/);
assert.ok(prompt.includes(`„${input.answers[0].answer}“ i „${input.answers[1].answer}“`), "prompt example uses two verbatim answers selected in this fixture");

const expectInvalid = (candidate, field) => {
  const result = validateSleepPremiumReport(candidate, input);
  assert.equal(result.valid, false);
  assert.equal(result.diagnostic.field, field);
  assert.equal(Object.hasOwn(result.diagnostic.received, "value"), false);
};

const wrongProfile = structuredClone(fallback);
wrongProfile.profile = "BUDAN UM";
expectInvalid(wrongProfile, "profile");
const wrongPriority = structuredClone(fallback);
wrongPriority.priority.area = "Ritam";
expectInvalid(wrongPriority, "priority.area");
const missingQuestions = structuredClone(fallback);
missingQuestions.review_questions.pop();
expectInvalid(missingQuestions, "review_questions");
const duplicateQuestion = structuredClone(fallback);
duplicateQuestion.review_questions[2] = duplicateQuestion.review_questions[0];
expectInvalid(duplicateQuestion, "review_questions");
const extraRootKey = { ...fallback, debug: true };
expectInvalid(extraRootKey, "$");
const wrongPlanDay = structuredClone(fallback);
wrongPlanDay.seven_day_plan[2].day = 4;
expectInvalid(wrongPlanDay, "seven_day_plan[2]");
const unrelatedAction = structuredClone(fallback);
unrelatedAction.seven_day_plan[0].action = "Probaj da napraviš listu za kupovinu.";
expectInvalid(unrelatedAction, "seven_day_plan[0]");
const unsafeMedicalCopy = structuredClone(fallback);
unsafeMedicalCopy.profile_explanation = "Tvoji odgovori potvrđuju da imaš nesanicu.";
expectInvalid(unsafeMedicalCopy, "profile_explanation");
const unsafeCause = structuredClone(fallback);
unsafeCause.priority.explanation = `Odgovor „${input.answers[0].answer}“ je uzrok tvog problema sa snom.`;
expectInvalid(unsafeCause, "priority.explanation");
const unsafeGuarantee = structuredClone(fallback);
unsafeGuarantee.seven_day_plan[0].action = "Za tvoj san: ovaj korak će sigurno poboljšati san.";
expectInvalid(unsafeGuarantee, "seven_day_plan[0].action");
const alteredQuote = structuredClone(fallback);
alteredQuote.connections[0] = "Odgovori „izmenjen odgovor“ i „drugi odgovor“ daju različite utiske.";
expectInvalid(alteredQuote, "connections[0]");
const singleQuote = structuredClone(fallback);
singleQuote.connections[0] = `Odgovor „${input.answers[0].answer}“ vredi sagledati pažljivo.`;
expectInvalid(singleQuote, "connections[0]");
for (let index = 0; index < fallback.connections.length; index += 1) {
  const oneQuoteAtIndex = structuredClone(fallback);
  oneQuoteAtIndex.connections[index] = `Odgovor „${input.answers[0].answer}“ vredi posmatrati kao jedan deo tvoje priče.`;
  expectInvalid(oneQuoteAtIndex, `connections[${index}]`);
}
const [firstEvidence, secondEvidence] = input.answers.slice(0, 2);
const exactTwoAnswerConnection = `Odgovori „${firstEvidence.answer}“ i „${secondEvidence.answer}“ daju dva odvojena pogleda koja vredi posmatrati zajedno.`;
const exactTwoAnswerReport = structuredClone(fallback);
exactTwoAnswerReport.connections[0] = exactTwoAnswerConnection;
assert.equal(validateSleepPremiumReport(exactTwoAnswerReport, input).valid, true, "two distinct exact selected answers pass connection validation");
const paraphrasedEvidenceReport = structuredClone(fallback);
paraphrasedEvidenceReport.connections[0] = `Odgovori „${firstEvidence.answer} (parafrazirano)“ i „${secondEvidence.answer}“ daju dva odvojena pogleda.`;
expectInvalid(paraphrasedEvidenceReport, "connections[0]");

const aiResult = await generateSleepPremiumReport({
  input,
  openaiClient: mockClient({ status: "completed", output_text: JSON.stringify(fallback) }, (request) => {
    assert.equal(request.text.format.type, "json_schema");
    assert.equal(request.text.format.strict, true);
    assert.equal(request.text.format.name, "mindscore_sleep_premium_report_v2");
    assert.deepEqual(request.text.format.schema, schema.schema);
  }),
  apiKeyAvailable: true,
  fallbackOnError: false,
});
assert.equal(aiResult.source, "ai");
assert.deepEqual(aiResult.report, fallback);
assert.equal(aiResult.report.profile, input.profile, "structured AI output retains the deterministic profile");

const malformedJsonText = '{"profile":"private answer text must not be logged"';
const malformedJson = await generateSleepPremiumReport({
  input,
  openaiClient: mockClient({ status: "completed", output_text: malformedJsonText }),
  apiKeyAvailable: true,
  includeFailureDiagnostics: true,
});
assert.equal(malformedJson.source, "fallback");
assert.equal(malformedJson.failureType, "invalid_json");
assert.deepEqual(malformedJson.jsonDiagnostics, {
  responseStatus: "completed",
  responseLength: malformedJsonText.length,
  contentEmpty: false,
  markdownFencesDetected: false,
  refusalDetected: false,
  parseErrorType: "SyntaxError",
  parseErrorPosition: malformedJsonText.length,
});
assert.equal(JSON.stringify(malformedJson).includes(malformedJsonText), false, "malformed AI content is not returned in diagnostics");
assert.equal(JSON.stringify(malformedJson.jsonDiagnostics).includes("private answer text"), false);
const missingKey = await generateSleepPremiumReport({ input, apiKeyAvailable: false });
assert.equal(missingKey.source, "fallback");
assert.deepEqual(missingKey.report, fallback);
const invalidAi = structuredClone(fallback);
invalidAi.profile = "BUDAN UM";
const rejectedAi = await generateSleepPremiumReport({
  input,
  openaiClient: mockClient({ status: "completed", output_text: JSON.stringify(invalidAi) }),
  apiKeyAvailable: true,
  includeFailureDiagnostics: true,
});
assert.equal(rejectedAi.source, "fallback");
assert.equal(rejectedAi.failureType, "schema_validation_failure");
assert.equal(rejectedAi.failureDiagnostic.field, "profile");
assert.deepEqual(rejectedAi.report, fallback);
const invalidConnectionAi = structuredClone(fallback);
invalidConnectionAi.connections[1] = `Odgovor „${input.answers[0].answer}“ vredi pratiti kroz naredne dane.`;
const rejectedConnectionAi = await generateSleepPremiumReport({
  input,
  openaiClient: mockClient({ status: "completed", output_text: JSON.stringify(invalidConnectionAi) }),
  apiKeyAvailable: true,
  includeFailureDiagnostics: true,
});
assert.equal(rejectedConnectionAi.source, "fallback");
assert.equal(rejectedConnectionAi.failureType, "schema_validation_failure");
assert.equal(rejectedConnectionAi.failureDiagnostic.field, "connections[1]");
assert.deepEqual(rejectedConnectionAi.report, fallback);
const timeout = await generateSleepPremiumReport({
  input,
  openaiClient: { responses: { create: () => new Promise(() => {}) } },
  apiKeyAvailable: true,
  timeoutMs: 1,
  includeFailureDiagnostics: true,
});
assert.equal(timeout.source, "fallback");
assert.equal(timeout.failureType, "timeout");

assert.equal(isPremiumAiPreviewEnabled({ ENABLE_PREMIUM_AI_PREVIEW: "true" }), true);
assert.equal(isPremiumAiPreviewEnabled({ ENABLE_PREMIUM_AI_PREVIEW: "TRUE" }), false);
assert.equal((await generateSleepPremiumPreview({ enabled: false, answers: personas[0] })).status, 404);
const preview = await generateSleepPremiumPreview({
  enabled: true,
  answers: personas[2],
  openaiClient: mockClient({ status: "completed", output_text: JSON.stringify(buildSleepPremiumFallback(buildSleepPremiumInput(personas[2]))) }),
  apiKeyAvailable: true,
});
assert.equal(preview.status, 200);
assert.equal(preview.body.source, "ai");
assert.equal(preview.body.deterministicProfile, "BUDAN UM");
assert.equal(preview.body.report.profile, "BUDAN UM");
assert.equal(preview.body.report.profile, preview.body.deterministicProfile, "valid v2 staging preview profile matches the deterministic profile");
assert.equal(preview.body.report.review_questions.length, 3);
assert.equal(Object.hasOwn(preview.body.report, "source"), false);

const malformedPreview = await generateSleepPremiumPreview({
  enabled: true,
  answers: personas[2],
  openaiClient: mockClient({ status: "completed", output_text: malformedJsonText }),
  apiKeyAvailable: true,
});
assert.equal(malformedPreview.status, 200);
assert.equal(malformedPreview.body.source, "fallback");
assert.equal(malformedPreview.body.fallbackDiagnostic.code, "INVALID_JSON");
assert.deepEqual(malformedPreview.body.fallbackDiagnostic.jsonDiagnostics, malformedJson.jsonDiagnostics);
assert.equal(JSON.stringify(malformedPreview.body).includes("private answer text"), false);

console.log("Premium v2 strict contract, personalized fallback, deterministic selector, safety rules, timeout and staging preview passed.");
