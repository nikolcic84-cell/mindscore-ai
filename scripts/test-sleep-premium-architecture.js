import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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
  assert.equal(report.connections.every(({ questionIds, text }) =>
    questionIds.length === 2 &&
    questionIds[0] !== questionIds[1] &&
    questionIds.every((questionId) => profileInput.answers.some((answer) => answer.questionId === questionId)) &&
    typeof text === "string" && text.trim().length > 0 && text.length <= 500
  ), true);
  assert.equal(report.connections.every(({ text }) => !/\bQ(?:[1-9]|1[0-2])\b/.test(text)), true);
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
assert.match(prompt, /TAČNO sedam objekata redom sa day vrednostima 1–7/);
assert.match(prompt, /SVAKI dan, i action i observe/);
assert.match(schema.schema.properties.seven_day_plan.items.properties.action.description, /explicitly names the fixed priority.*Each of the seven actions must independently state the connection/i);
assert.match(schema.schema.properties.seven_day_plan.items.properties.observe.description, /explicitly names the same fixed priority.*Never observe a different sleep area/i);
assert.match(prompt, /ne izvodi ocene/);
assert.equal(prompt.includes("mappedValue"), false);
assert.equal(prompt.includes("internalScores"), false);
assert.equal(schema.schema.properties.connections.items.type, "object");
assert.equal(schema.schema.properties.connections.items.properties.questionIds.minItems, 2);
assert.equal(schema.schema.properties.connections.items.properties.questionIds.maxItems, 2);
assert.deepEqual(schema.schema.properties.connections.items.properties.questionIds.items.enum, input.answers.map(({ questionId }) => questionId));
assert.equal(schema.schema.properties.connections.items.properties.text.maxLength, 500);
assert.match(schema.schema.properties.connections.items.properties.text.description, /natural.*Serbian.*Do not include or display question IDs/i);
assert.match(schema.schema.properties.profile_explanation.description, /MUST include at least one complete selected answer copied verbatim/i);
assert.match(prompt, /tačno dva različita ID-ja iz questionId polja ulaznih odgovora/);
assert.match(prompt, /ne mora da ponavlja ili citira tekst odgovora/);
assert.match(prompt, /OBAVEZNO uključi najmanje jedan ceo answer.*kopiran VERBATIM/s);
assert.match(prompt, /Nemoj parafrazirati citirani odgovor/);
assert.ok(prompt.includes(`Tvoj odgovor „${input.answers[0].answer}“ daje konkretan lični oslonac`), "profile explanation example uses a complete selected answer from the current input");
assert.match(prompt, /KADA JE POTREBAN DOKAZ, KOPIRAJ selected answer TAČNO/);
assert.match(prompt, /Ne prevodi, ne skraćuj, ne normalizuj, ne sažimaj i ne parafraziraj/);
assert.match(prompt, /priority: title mora biti tačno/);
assert.match(prompt, /Explanation mora jasno obrazložiti ZAŠTO JE UPRAVO OVAJ FIKSNI PRIORITET/);
assert.match(prompt, /Obavezno uključi najmanje jedan relevantan odabrani odgovor iz pitanja koja se odnose na ovaj prioritet, kopiran VERBATIM/);
assert.match(prompt, /KADA JE POTREBAN DOKAZ, KOPIRAJ selected answer TAČNO/);
assert.match(prompt, /Ne prevodi, ne skraćuj, ne normalizuj, ne sažimaj i ne parafraziraj citirani odgovor/);
assert.ok(prompt.includes(`Tema ${getSleepPremiumPriority(input).title} je smislen prvi fokus za razmatranje. Tvoj odgovor „${input.answers[0].answer}“`), "priority example has a verbatim answer and preserves the fixed priority");
assert.ok(prompt.includes(JSON.stringify({ questionIds: input.answers.slice(0, 2).map(({ questionId }) => questionId), text: "Odgovori na ova dva pitanja daju različite poglede koje vredi sagledati zajedno, bez zaključka da jedno objašnjava drugo." })), "prompt includes a valid connection object example with actual available question IDs");

const onsetInput = buildSleepPremiumInput(personas[2]);
const onsetPriority = getSleepPremiumPriority(onsetInput);
assert.equal(onsetPriority.title, "Period pre sna");
const onsetPrompt = buildSleepPremiumPrompt(onsetInput, {
  profile: onsetInput.profile,
  priorityArea: onsetPriority.title,
  mode: getSleepPremiumStrengthMode(onsetInput),
  stableTitle: schema.schema.properties.stable_or_tracking.properties.title.enum[0],
  stableAreas: getSleepPremiumAreaOverview(onsetInput).filter(({ status }) => status === "Deluje mirnije").map(({ title }) => title),
  profileExplanationMaxLength: schema.schema.properties.profile_explanation.maxLength,
});
assert.match(onsetPrompt, /SVAKI dan, i action i observe moraju izričito da uključe naziv fiksnog prioriteta/);
assert.match(onsetPrompt, /U svih 14 tekstova koristi jednostavan svakodnevni srpski/);
assert.match(onsetPrompt, /dijagnoza.*uzročnih tvrdnji.*WEAK.*MIXED.*obećanja/s);
assert.match(onsetPrompt, /probaj.*obrati pažnju.*zabeleži.*vidi kako ti odgovara.*uporedi kako se osećaš/s);
assert.ok(onsetPrompt.includes("„Period pre sna“"), "plan instructions and example are bound to the deterministic sleep-onset priority");
assert.ok(onsetPrompt.includes('"day":7') && onsetPrompt.includes('"action":"Za prioritet'));

const appSource = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
const previewHtml = await readFile(new URL("../server/dev/premium-ai-preview.html", import.meta.url), "utf8");
assert.ok(appSource.includes("report.connections.map((connection, index) => <li key={index}>{connection.text}</li>)"));
assert.ok(appSource.includes("report.connections.map((connection, index) => <li key={`connection-${index}`}>{connection.text}</li>)"));
assert.ok(previewHtml.includes("report.connections.map((connection) => connection.text)"));

const expectInvalid = (candidate, field, validationInput = input) => {
  const result = validateSleepPremiumReport(candidate, validationInput);
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
const onsetPlanFallback = buildSleepPremiumFallback(onsetInput);
assert.equal(validateSleepPremiumReport(onsetPlanFallback, onsetInput).valid, true, "complete seven-day plan tied to the fixed sleep-onset priority is accepted");
const onsetPriorityFallback = structuredClone(onsetPlanFallback);
const exactOnsetAnswer = onsetInput.answers.find(({ questionId }) => questionId === "Q2").answer;
onsetPriorityFallback.priority.explanation = `U okviru teme Period pre sna, tvoj odgovor „${exactOnsetAnswer}“ daje konkretan lični kontekst za ovaj prioritet.`;
assert.equal(validateSleepPremiumReport(onsetPriorityFallback, onsetInput).valid, true, "priority explanation with exact selected answer and fixed priority passes");
const missingPriorityAnswer = structuredClone(onsetPriorityFallback);
missingPriorityAnswer.priority.explanation = "U okviru teme Period pre sna, ovo je koristan prvi fokus koji vredi pratiti.";
expectInvalid(missingPriorityAnswer, "priority.explanation", onsetInput);
const missingPriorityEvidence = structuredClone(onsetPriorityFallback);
missingPriorityEvidence.priority.explanation = "Period pre sna je smislen prvi fokus koji možeš da razmotriš. Obrati pažnju šta ti odgovara.";
expectInvalid(missingPriorityEvidence, "priority.explanation", onsetInput);
const paraphrasedPriorityAnswer = structuredClone(onsetPriorityFallback);
paraphrasedPriorityAnswer.priority.explanation = `U okviru teme Period pre sna, tvoj odgovor „${exactOnsetAnswer.slice(0, -1)}.“ daje konkretan lični kontekst za ovaj prioritet.`;
expectInvalid(paraphrasedPriorityAnswer, "priority.explanation", onsetInput);
const unrelatedPriorityEvidence = structuredClone(onsetPriorityFallback);
unrelatedPriorityEvidence.priority.explanation = `U okviru teme Tok noći, tvoj odgovor „${exactOnsetAnswer}“ daje konkretan lični kontekst za ovaj prioritet.`;
expectInvalid(unrelatedPriorityEvidence, "priority.explanation", onsetInput);
assert.deepEqual(onsetPlanFallback.seven_day_plan.map(({ day }) => day), [1, 2, 3, 4, 5, 6, 7]);
assert.equal(onsetPlanFallback.seven_day_plan.every(({ action, observe }) =>
  action.toLowerCase().includes("period pre sna") && observe.toLowerCase().includes("period pre sna")
), true, "every action and observation explicitly stays on the fixed priority");
const safeExploratoryPlan = structuredClone(onsetPlanFallback);
const safeExploratoryActions = [
  "Za period pre sna, zabeleži početni utisak bez menjanja rutine.",
  "Za period pre sna, probaj jedan mali, rahatan korak.",
  "Za period pre sna, ponovi korak koji si izabrao/la.",
  "Za period pre sna, uporedi kako se osećaš sa početnim utiskom.",
  "Za period pre sna, probaj malu izmenu unutar iste teme.",
  "Za period pre sna, vidi kako ti odgovara najjednostavniji korak.",
  "Za period pre sna, pregledaj svoja zapažanja iz proteklih dana.",
];
const safeExploratoryObservations = [
  "Za period pre sna, obrati pažnju na svoj uobičajeni utisak.",
  "Za period pre sna, zabeleži šta primećuješ tokom ovog koraka.",
  "Za period pre sna, vidi kako ti odgovara ponavljanje koraka.",
  "Za period pre sna, uporedi kako se osećaš danas.",
  "Za period pre sna, obrati pažnju na svoj utisak posle izmene.",
  "Za period pre sna, zabeleži šta ti je bilo najjednostavnije.",
  "Za period pre sna, uporedi svoja zapažanja kroz dane.",
];
safeExploratoryPlan.seven_day_plan.forEach((day, index) => {
  day.action = safeExploratoryActions[index];
  day.observe = safeExploratoryObservations[index];
});
assert.equal(validateSleepPremiumReport(safeExploratoryPlan, onsetInput).valid, true, "every safe everyday action and observation passes when anchored to the fixed priority");
const unsafePlanPhrases = [
  "kasni sati uzrokuju loš san",
  "ovo dokazuje da imaš nesanicu",
  "započni terapiju ovim korakom",
  "tvoja WEAK dimension prema classifier scoring-u",
  "tvoj rezultat je 42/100, ispod praga",
  "ovo će sigurno poboljšati san",
  "ovo će rešiti i regulisati tvoj san",
];
for (let index = 0; index < onsetPlanFallback.seven_day_plan.length; index += 1) {
  const unsafeActionPlan = structuredClone(onsetPlanFallback);
  unsafeActionPlan.seven_day_plan[index].action = `Za period pre sna: ${unsafePlanPhrases[index]}.`;
  expectInvalid(unsafeActionPlan, `seven_day_plan[${index}].action`, onsetInput);

  const unsafeObservationPlan = structuredClone(onsetPlanFallback);
  unsafeObservationPlan.seven_day_plan[index].observe = `Za period pre sna: ${unsafePlanPhrases[index]}.`;
  expectInvalid(unsafeObservationPlan, `seven_day_plan[${index}].observe`, onsetInput);
}
const driftingActionPlan = structuredClone(onsetPlanFallback);
driftingActionPlan.seven_day_plan[1].action = "Prošetaj tokom dana i primeti dnevnu energiju.";
expectInvalid(driftingActionPlan, "seven_day_plan[1]", onsetInput);
const driftingObservationPlan = structuredClone(onsetPlanFallback);
driftingObservationPlan.seven_day_plan[1].observe = "Prati dnevnu energiju i koncentraciju.";
expectInvalid(driftingObservationPlan, "seven_day_plan[1]", onsetInput);
const unsafeMedicalCopy = structuredClone(fallback);
unsafeMedicalCopy.profile_explanation = "Tvoji odgovori potvrđuju da imaš nesanicu.";
expectInvalid(unsafeMedicalCopy, "profile_explanation");
const noAnswerProfileExplanation = structuredClone(fallback);
noAnswerProfileExplanation.profile_explanation = "Tvoji odgovori pružaju nekoliko korisnih pogleda na tvoju noć i ono što želiš da pratiš.";
expectInvalid(noAnswerProfileExplanation, "profile_explanation");
const paraphrasedProfileEvidence = structuredClone(fallback);
paraphrasedProfileEvidence.profile_explanation = `Tvoj odgovor „${input.answers[0].answer.slice(0, -1)}.“ daje konkretan lični oslonac za tumačenje profila.`;
expectInvalid(paraphrasedProfileEvidence, "profile_explanation");
const exactProfileEvidence = structuredClone(fallback);
exactProfileEvidence.profile_explanation = `Tvoj odgovor „${input.answers[0].answer}“ daje konkretan lični oslonac za tumačenje profila.`;
assert.equal(validateSleepPremiumReport(exactProfileEvidence, input).valid, true, "one complete exact selected answer satisfies profile explanation evidence");
const unsafeCause = structuredClone(fallback);
unsafeCause.priority.explanation = `Odgovor „${input.answers[0].answer}“ je uzrok tvog problema sa snom.`;
expectInvalid(unsafeCause, "priority.explanation");
const unsafeGuarantee = structuredClone(fallback);
unsafeGuarantee.seven_day_plan[0].action = "Za tvoj san: ovaj korak će sigurno poboljšati san.";
expectInvalid(unsafeGuarantee, "seven_day_plan[0].action");
const makeConnectionReport = (connection) => {
  const report = structuredClone(fallback);
  report.connections[0] = connection;
  return report;
};
const validConnection = {
  questionIds: [input.answers[1].questionId, input.answers[5].questionId],
  text: "Odgovori o uspavljivanju i vremenu pre spavanja daju dva pogleda koja vredi sagledati zajedno.",
};
assert.equal(validateSleepPremiumReport(makeConnectionReport(validConnection), input).valid, true, "two distinct known question IDs and natural non-quoted text pass");
expectInvalid(makeConnectionReport({ ...validConnection, questionIds: ["Q2", "Q2"] }), "connections[0].questionIds");
expectInvalid(makeConnectionReport({ ...validConnection, questionIds: ["Q2", "Q13"] }), "connections[0].questionIds");
expectInvalid(makeConnectionReport({ ...validConnection, questionIds: ["Q2"] }), "connections[0].questionIds");
expectInvalid(makeConnectionReport({ ...validConnection, text: "   " }), "connections[0].text");
expectInvalid(makeConnectionReport({ ...validConnection, text: "x".repeat(501) }), "connections[0].text");
expectInvalid(makeConnectionReport({ ...validConnection, text: "Q2 i Q6 daju dva pogleda koja vredi sagledati zajedno." }), "connections[0].text");

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
invalidConnectionAi.connections[1] = { ...invalidConnectionAi.connections[1], questionIds: ["Q2", "Q2"] };
const rejectedConnectionAi = await generateSleepPremiumReport({
  input,
  openaiClient: mockClient({ status: "completed", output_text: JSON.stringify(invalidConnectionAi) }),
  apiKeyAvailable: true,
  includeFailureDiagnostics: true,
});
assert.equal(rejectedConnectionAi.source, "fallback");
assert.equal(rejectedConnectionAi.failureType, "schema_validation_failure");
assert.equal(rejectedConnectionAi.failureDiagnostic.field, "connections[1].questionIds");
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
