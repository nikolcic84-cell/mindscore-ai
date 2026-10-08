import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildSleepPremiumInput } from "../server/sleepPremiumInput.js";
import { buildSleepPremiumFallback } from "../server/sleepPremiumFallback.js";
import {
  buildSleepPremiumJsonSchema,
  diagnoseSleepPremiumCustomerSafety,
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
assert.match(prompt, /OBAVEZNO uključi najmanje jedan relevantan selected answer iz liste DOKAZI ZA OVAJ PRIORITET/);
assert.match(prompt, /KADA JE POTREBAN DOKAZ, KOPIRAJ selected answer TAČNO/);
assert.match(prompt, /Ne prevodi, ne skraćuj, ne normalizuj, ne sažimaj i ne parafraziraj citirani odgovor/);
assert.match(prompt, /Proveri pre slanja da se ceo tekst između navodnika poklapa znak po znak/);
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
const onsetEvidenceList = onsetInput.answers
  .filter(({ questionId }) => ["Q2", "Q6"].includes(questionId))
  .map(({ questionId, answer }) => ({ questionId, answer }));
assert.ok(onsetPrompt.includes(`DOKAZI ZA OVAJ PRIORITET (kopiraj answer string doslovno): ${JSON.stringify(onsetEvidenceList)}`), "priority prompt gives the model the exact relevant selected answer strings");
assert.ok(onsetPrompt.includes(`Tvoj odgovor „${onsetInput.answers.find(({ questionId }) => questionId === "Q2").answer}“`), "priority example quotes a relevant selected answer verbatim");
assert.ok(onsetPrompt.includes('"day":7') && onsetPrompt.includes('"action":"Za prioritet'));

const appSource = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
const previewHtml = await readFile(new URL("../server/dev/premium-ai-preview.html", import.meta.url), "utf8");
assert.ok(appSource.includes("report.connections.map((connection, index) => <li key={index}>{connection.text}</li>)"));
assert.ok(appSource.includes("report.connections.map((connection, index) => <li key={`connection-${index}`}>{connection.text}</li>)"));
assert.ok(previewHtml.includes("report.connections.map((connection) => connection.text)"));

const expectInvalid = (candidate, field, validationInput = input) => {
  const before = structuredClone(candidate);
  const result = validateSleepPremiumReport(candidate, validationInput);
  assert.equal(result.valid, false);
  assert.equal(result.diagnostic.field, field);
  assert.equal(Object.hasOwn(result.diagnostic.received, "value"), false);
  assert.deepEqual(candidate, before, "rejected reports are not mutated by validation");
};
const expectValid = (candidate, validationInput = input) => {
  const before = structuredClone(candidate);
  const result = validateSleepPremiumReport(candidate, validationInput);
  assert.equal(result.valid, true, result.reason);
  assert.equal(result.report, candidate, "validation returns the original report without sanitization");
  assert.deepEqual(candidate, before, "accepted reports are not mutated by validation");
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
expectValid(duplicateQuestion);
const extraRootKey = { ...fallback, debug: true };
expectInvalid(extraRootKey, "$");
const wrongPlanDay = structuredClone(fallback);
wrongPlanDay.seven_day_plan[2].day = 4;
expectInvalid(wrongPlanDay, "seven_day_plan[2]");
const unrelatedAction = structuredClone(fallback);
unrelatedAction.seven_day_plan[0].action = "Probaj da napraviš listu za kupovinu.";
expectValid(unrelatedAction);
const onsetPlanFallback = buildSleepPremiumFallback(onsetInput);
assert.equal(validateSleepPremiumReport(onsetPlanFallback, onsetInput).valid, true, "complete seven-day plan tied to the fixed sleep-onset priority is accepted");
const exactReviewQuestion = structuredClone(onsetPlanFallback);
exactReviewQuestion.review_questions[0] = "Da li si video/la razliku u osećaju pred spavanje između početka i kraja sedmice?";
expectValid(exactReviewQuestion, onsetInput);
const onsetPriorityFallback = structuredClone(onsetPlanFallback);
const exactOnsetAnswer = onsetInput.answers.find(({ questionId }) => questionId === "Q2").answer;
onsetPriorityFallback.priority.explanation = `U okviru teme Period pre sna, tvoj odgovor „${exactOnsetAnswer}“ daje konkretan lični kontekst za ovaj prioritet.`;
assert.equal(validateSleepPremiumReport(onsetPriorityFallback, onsetInput).valid, true, "priority explanation with exact selected answer and fixed priority passes");
assert.equal(diagnoseSleepPremiumCustomerSafety("priority.explanation", onsetPriorityFallback.priority.explanation, onsetInput), null);
// Synthetic diagnostic fixtures, NOT the unavailable 238-character staging response.
const safetyDiagnosticCases = [
  ["nesanicu", "medical", "INVALID_CUSTOMER_COPY"],
  ["uzrokuje", "causal", "INVALID_CUSTOMER_COPY"],
  ["WEAK", "internal", "INVALID_CUSTOMER_COPY"],
  ["algoritam", "technical", "INVALID_CUSTOMER_COPY"],
  ["42/100", "score", "INVALID_CUSTOMER_COPY"],
  ["poboljšati san", "outcome-promising", "GUARANTEE_COPY"],
];
for (const [phrase, category, rule] of safetyDiagnosticCases) {
  const report = structuredClone(onsetPriorityFallback);
  report.priority.explanation += ` ${phrase}.`;
  const result = validateSleepPremiumReport(report, onsetInput);
  assert.equal(result.valid, false);
  assert.equal(result.diagnostic.field, "priority.explanation");
  const diagnostic = diagnoseSleepPremiumCustomerSafety("priority.explanation", report.priority.explanation, onsetInput);
  assert.equal(diagnostic.returnedText, report.priority.explanation);
  assert.equal(diagnostic.rejectedText, phrase);
  assert.equal(diagnostic.category, category);
  assert.equal(diagnostic.rule, rule);
  assert.ok(new RegExp(diagnostic.regex.slice(1, diagnostic.regex.lastIndexOf("/")), "iu").test(diagnostic.normalizedMatch));
}
const negatedCause = structuredClone(onsetPriorityFallback);
// Customer vocabulary fixtures: the full original Render sentence was not supplied.
const naturalPatternSentences = [
  "Za period pre sna, primeti koji se obrazac ponavlja tokom tvojih večeri.",
  "Za period pre sna, primeti koje obrasce vidiš u svojim beleškama.",
  "Za period pre sna, razmotri da li se slični obrasci ponavljaju kroz dane.",
  "Za period pre sna, uporedi svoje beleške i razmisli o obrascu svoje večeri.",
  "Za period pre sna, pogledaj kako se tvoja zapažanja razlikuju od tog obrasca.",
  "Za period pre sna, razmisli o obrascima koje primećuješ tokom nedelje.",
  "Za period pre sna, uporedi nekoliko obrazaca iz svojih beležaka.",
  "Za period pre sna, OBRASCE iz beležaka posmatraj kao lična zapažanja.",
];
for (const sentence of naturalPatternSentences) {
  const report = structuredClone(onsetPriorityFallback);
  report.after_seven_days = sentence;
  assert.equal(validateSleepPremiumReport(report, onsetInput).valid, true, `normal Serbian recurring-habit copy is accepted: ${sentence}`);
  assert.equal(diagnoseSleepPremiumCustomerSafety("after_seven_days", sentence, onsetInput), null);
  const priorityReport = structuredClone(onsetPriorityFallback);
  priorityReport.priority.explanation += ` ${sentence}`;
  expectValid(priorityReport, onsetInput);
}
const retainedSafetyPhrases = [
  ["scoring", "internal"], ["dimension", "internal"], ["mapped value", "internal"],
  ["classifier", "internal"], ["AI confidence", "internal"], ["WEAK", "internal"],
  ["MIXED", "internal"], ["STABLE", "internal"],
  ["algorithm", "technical"], ["algoritam", "technical"], ["schema", "technical"], ["json", "technical"],
  ["prompt", "technical"], ["tokens", "technical"], ["dimenzija", "internal"], ["threshold", "internal"],
  ["nesanicu", "medical"], ["apneju", "medical"], ["dijagnoza", "medical"], ["terapija", "medical"],
  ["depresija", "medical"], ["anksioznost", "medical"], ["hormonski", "medical"],
  ["neurološki", "medical"], ["poremećaj", "medical"], ["bolest", "medical"],
  ["klinički", "medical"], ["medikament", "medical"], ["lekovi", "medical"], ["lečenje", "medical"],
  ["lek", "medical"], ["uzrokuje", "causal"], ["uzrokuju", "causal"], ["izaziva", "causal"],
  ["prouzrokuje", "causal"], ["remeti", "causal"], ["uzrok tvog problema", "causal"],
  ["telefon dovodi do lošeg sna", "causal"], ["telefon doprinosi problemu sa snom", "causal"],
  ["42/100", "score"], ["72%", "score"], ["42,5 %", "score"],
  ["rezultat 42", "score"], ["ocena je 42", "score"], ["prag 42", "score"],
  ["scoring prag za WEAK dimension", "internal"],
  ["classifier koristi schema, prompt i tokens za AI confidence", "internal"],
  ["algoritam određuje obrasce prema internim pravilima", "technical"],
  ["obrasci potvrđuju dijagnozu", "medical"],
  ["obrasce izaziva tvoja navika", "causal"],
  ["obrazac ima rezultat 42/100", "score"],
  ["ovaj korak će sigurno poboljšati san", "outcome-promising"],
];
for (const [phrase, category] of retainedSafetyPhrases) {
  const report = structuredClone(onsetPriorityFallback);
  report.after_seven_days = `Za period pre sna: ${phrase}.`;
  const result = validateSleepPremiumReport(report, onsetInput);
  assert.equal(result.valid, false, `existing safety rule remains: ${phrase}`);
  assert.equal(result.diagnostic.field, "after_seven_days");
  const diagnostic = diagnoseSleepPremiumCustomerSafety("after_seven_days", report.after_seven_days, onsetInput);
  assert.equal(diagnostic.category, category);
  assert.equal(diagnostic.rule, category === "outcome-promising" ? "GUARANTEE_COPY" : "INVALID_CUSTOMER_COPY");
  for (const quoted of [`„${phrase}“`, `"${phrase}"`]) {
    const noncanonicalQuote = structuredClone(onsetPriorityFallback);
    noncanonicalQuote.after_seven_days = `Lično zapažanje: ${quoted}.`;
    expectInvalid(noncanonicalQuote, "after_seven_days", onsetInput);
    assert.equal(diagnoseSleepPremiumCustomerSafety("after_seven_days", noncanonicalQuote.after_seven_days, onsetInput).category, category,
      "noncanonical quotes cannot exempt actual unsafe copy");
  }
}
for (const sentence of [
  "Stabilan utisak, slabiji dan i mešovit doživljaj mogu biti lična zapažanja.",
  "Faktor i signal su obične reči u ovoj belešci.",
  "Zbog svog rasporeda možeš da izabereš drugi trenutak za belešku.",
  "Uzrok nije predmet ove beleške. Bez tvrdnje o uzroku.",
  "Ovo nije zaključak o uzroku tvoje večeri.",
  "Pregledaj beleške posle 7 dana i izaberi 2 utiska za poređenje.",
]) {
  const report = structuredClone(onsetPriorityFallback);
  report.profile_explanation = sentence;
  report.after_seven_days = sentence;
  expectValid(report, onsetInput);
  assert.equal(diagnoseSleepPremiumCustomerSafety("after_seven_days", sentence, onsetInput), null);
}
negatedCause.priority.explanation += " Bez tvrdnje o uzroku.";
expectValid(negatedCause, onsetInput);
assert.equal(diagnoseSleepPremiumCustomerSafety("priority.explanation", negatedCause.priority.explanation, onsetInput), null);
negatedCause.priority.explanation += " Ovo uzrokuje loš san.";
expectInvalid(negatedCause, "priority.explanation", onsetInput);
assert.equal(diagnoseSleepPremiumCustomerSafety("priority.explanation", negatedCause.priority.explanation, onsetInput).rejectedText, "uzrokuje");
const privateDiagnosticText = `${negatedCause.priority.explanation} example@example.test cs_test_private_identifier`;
const privateDiagnostic = diagnoseSleepPremiumCustomerSafety("priority.explanation", privateDiagnosticText, onsetInput);
assert.equal(privateDiagnostic.returnedText, "[withheld: possible personal identifier]");
assert.equal(JSON.stringify(privateDiagnostic).includes("example@example.test"), false);
assert.equal(JSON.stringify(privateDiagnostic).includes("cs_test_private_identifier"), false);
for (const sensitiveContent of [
  "sk-test-only-placeholder", "sk_test_placeholder", "pk_live_placeholder", "whsec_placeholder",
  "Bearer diagnostic-test-token", "password=diagnostic-test-value", "API_KEY: diagnostic-test-value",
  "user_id=diagnostic-test-id", "12345678-1234-1234-1234-123456789abc", "+381 60 123 4567",
]) {
  const diagnostic = diagnoseSleepPremiumCustomerSafety("priority.explanation", `${negatedCause.priority.explanation} ${sensitiveContent}`, onsetInput);
  assert.equal(diagnostic.returnedText, "[withheld: possible personal identifier]");
  assert.equal(JSON.stringify(diagnostic).includes(sensitiveContent), false, "diagnostic withholds credentials and identifiers");
}
const stableAnswerInput = buildSleepPremiumInput(personas[0]);
const stableAnswer = stableAnswerInput.answers.find(({ questionId }) => questionId === "Q8").answer;
assert.equal(diagnoseSleepPremiumCustomerSafety("priority.explanation", `Tvoj odgovor „${stableAnswer}“ je lični kontekst.`, stableAnswerInput), null, "exact selected answers retain the existing safety exemption");
const missingPriorityAnswer = structuredClone(onsetPriorityFallback);
missingPriorityAnswer.priority.explanation = "U okviru teme Period pre sna, ovo je koristan prvi fokus koji vredi pratiti.";
expectValid(missingPriorityAnswer, onsetInput);
const missingPriorityEvidence = structuredClone(onsetPriorityFallback);
missingPriorityEvidence.priority.explanation = "Period pre sna je smislen prvi fokus koji možeš da razmotriš. Obrati pažnju šta ti odgovara.";
expectValid(missingPriorityEvidence, onsetInput);
const paraphrasedPriorityAnswer = structuredClone(onsetPriorityFallback);
paraphrasedPriorityAnswer.priority.explanation = `U okviru teme Period pre sna, tvoj odgovor „${exactOnsetAnswer.slice(0, -1)}.“ daje konkretan lični kontekst za ovaj prioritet.`;
expectValid(paraphrasedPriorityAnswer, onsetInput);
const unrelatedPriorityEvidence = structuredClone(onsetPriorityFallback);
unrelatedPriorityEvidence.priority.explanation = `U okviru teme Tok noći, tvoj odgovor „${exactOnsetAnswer}“ daje konkretan lični kontekst za ovaj prioritet.`;
expectValid(unrelatedPriorityEvidence, onsetInput);
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
expectValid(driftingActionPlan, onsetInput);
const driftingObservationPlan = structuredClone(onsetPlanFallback);
driftingObservationPlan.seven_day_plan[1].observe = "Prati dnevnu energiju i koncentraciju.";
expectValid(driftingObservationPlan, onsetInput);
const unsafeMedicalCopy = structuredClone(fallback);
unsafeMedicalCopy.profile_explanation = "Tvoji odgovori potvrđuju da imaš nesanicu.";
expectInvalid(unsafeMedicalCopy, "profile_explanation");
const noAnswerProfileExplanation = structuredClone(fallback);
noAnswerProfileExplanation.profile_explanation = "Tvoji odgovori pružaju nekoliko korisnih pogleda na tvoju noć i ono što želiš da pratiš.";
expectValid(noAnswerProfileExplanation);
const paraphrasedProfileEvidence = structuredClone(fallback);
paraphrasedProfileEvidence.profile_explanation = `Tvoj odgovor „${input.answers[0].answer.slice(0, -1)}.“ daje konkretan lični oslonac za tumačenje profila.`;
expectValid(paraphrasedProfileEvidence);
const exactProfileEvidence = structuredClone(fallback);
exactProfileEvidence.profile_explanation = `Tvoj odgovor „${input.answers[0].answer}“ daje konkretan lični oslonac za tumačenje profila.`;
expectValid(exactProfileEvidence);
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
expectValid(makeConnectionReport({ ...validConnection, questionIds: ["Q2", "Q2"] }));
expectInvalid(makeConnectionReport({ ...validConnection, questionIds: ["Q2", "Q13"] }), "connections[0].questionIds");
expectInvalid(makeConnectionReport({ ...validConnection, questionIds: ["Q2"] }), "connections[0].questionIds");
expectInvalid(makeConnectionReport({ ...validConnection, text: "   " }), "connections[0].text");
expectInvalid(makeConnectionReport({ ...validConnection, text: "x".repeat(501) }), "connections[0].text");
expectInvalid(makeConnectionReport({ ...validConnection, text: "Q2 i Q6 daju dva pogleda koja vredi sagledati zajedno." }), "connections[0].text");

// Runtime validates structure and safety, not prompt-only evidence/topic/uniqueness instructions.
const relaxedReport = structuredClone(onsetPlanFallback);
const repeatedObservation = "Primeti kako ti odgovara ovaj mali korak i zabeleži svoj utisak.";
relaxedReport.profile_explanation = "Tvoji odgovori su prilika da pogledaš svoja iskustva kroz lične beleške.";
relaxedReport.priority.explanation = repeatedObservation;
relaxedReport.connections = Array.from({ length: 2 }, () => ({ questionIds: ["Q2", "Q2"], text: repeatedObservation }));
relaxedReport.stable_or_tracking.items = [repeatedObservation, repeatedObservation];
relaxedReport.seven_day_plan.forEach((day) => {
  day.action = "Odvoji trenutak da napišeš kratku belešku.";
  day.observe = repeatedObservation;
});
relaxedReport.alternatives = [repeatedObservation, repeatedObservation];
relaxedReport.review_questions = Array(3).fill("Šta primećuješ u svojim beleškama");
relaxedReport.after_seven_days = repeatedObservation;
relaxedReport.closing = "Ova beleška je informativna i ostavlja prostor za tvoja lična zapažanja.";
const textFields = [
  ["profile_explanation", 700, "profile_explanation"],
  ["priority.explanation", 700, "priority.explanation"],
  ...relaxedReport.connections.map((_, index) => [`connections.${index}.text`, 500, `connections[${index}].text`]),
  ...relaxedReport.stable_or_tracking.items.map((_, index) => [`stable_or_tracking.items.${index}`, 350, `stable_or_tracking.items[${index}]`]),
  ...relaxedReport.seven_day_plan.flatMap((_, index) => [
    [`seven_day_plan.${index}.action`, 300, `seven_day_plan[${index}]`],
    [`seven_day_plan.${index}.observe`, 250, `seven_day_plan[${index}]`],
  ]),
  ...relaxedReport.alternatives.map((_, index) => [`alternatives.${index}`, 350, `alternatives[${index}]`]),
  ...relaxedReport.review_questions.map((_, index) => [`review_questions.${index}`, 200, `review_questions[${index}]`]),
  ["after_seven_days", 500, "after_seven_days"],
  ["closing", 350, "closing"],
];
const setField = (report, path, value, remove = false) => {
  const keys = path.split(".");
  const key = keys.pop();
  const parent = keys.reduce((current, part) => current[part], report);
  if (remove) delete parent[key];
  else parent[key] = value;
};
for (const [path] of textFields) {
  const text = path.split(".").reduce((current, key) => current[key], relaxedReport);
  assert.equal(/[„“"]/.test(text), false, "relaxed report body contains no quotes");
  assert.equal(onsetInput.answers.some(({ answer }) => text.includes(answer)), false, "no selected answer is copied in the relaxed report");
  assert.equal(/period pre sna|budan um|uspavlj|tok noći|osećaj po buđenju|stable|mixed|weak|recovery|sleepOnset|continuity|rhythm/iu.test(text), false,
    "body text needs no deterministic profile/priority/area keywords");
}
expectValid(relaxedReport, onsetInput);
const relaxedBefore = structuredClone(relaxedReport);
const relaxedAi = await generateSleepPremiumReport({
  input: onsetInput,
  openaiClient: mockClient({ status: "completed", output_text: JSON.stringify(relaxedReport) }, (request) => {
    assert.equal(request.input, onsetPrompt, "prompt instructions remain unchanged despite simpler runtime validation");
    assert.deepEqual(request.text.format, buildSleepPremiumJsonSchema(onsetInput));
  }),
  apiKeyAvailable: true,
  fallbackOnError: false,
});
assert.equal(relaxedAi.source, "ai");
assert.deepEqual(relaxedAi.report, relaxedReport);
assert.deepEqual(relaxedReport, relaxedBefore);

// Every customer body field retains nonblank/type/length and global safety/privacy checks.
const safeLengthText = (length) => "Lična beleška. ".repeat(Math.ceil(length / "Lična beleška. ".length)).slice(0, length);
for (const [path, limit, diagnosticField] of textFields) {
  for (const value of [undefined, null, 7, true, {}, [], "", " \n\t ", safeLengthText(limit + 1)]) {
    const report = structuredClone(relaxedReport);
    setField(report, path, value, value === undefined);
    const missingField = !path.includes(".") ? "$"
      : path === "priority.explanation" ? "priority"
        : /^connections\.\d+\.text$/u.test(path) ? path.replace(/\.(\d+)\.text$/u, "[$1]")
          : diagnosticField;
    expectInvalid(report, value === undefined ? missingField : diagnosticField, onsetInput);
  }
  const atLimit = structuredClone(relaxedReport);
  setField(atLimit, path, safeLengthText(limit));
  expectValid(atLimit, onsetInput);
  const safetyField = path.replace(/\.(\d+)/gu, "[$1]");
  for (const unsafe of ["Ovo uzrokuje loš san.", "Ovo potvrđuje nesanicu.", "Ovo će sigurno poboljšati san.", "scoring", "rezultat 42", "prag 42", "Q2"]) {
    const report = structuredClone(relaxedReport);
    setField(report, path, unsafe);
    expectInvalid(report, safetyField, onsetInput);
  }
  for (const sensitive of [
    "example@example.test", "sk-test-only-placeholder", "sk_test_placeholder", "pk_live_placeholder", "pk_test_placeholder", "whsec_placeholder",
    "Bearer diagnostic-test-token", "password=diagnostic-test-value", "API_KEY: diagnostic-test-value", "access_token=diagnostic-test-value", "secret=test-placeholder",
    "cs_test_placeholder", "pi_test_placeholder", "cus_test_placeholder", "sess_test_placeholder", "session_test_placeholder", "assessment_test_placeholder", "user_id=diagnostic-test-id",
    "12345678-1234-1234-1234-123456789abc", "+381 60 123 4567",
  ]) {
    for (const text of [sensitive, `„${sensitive}“`]) {
      const report = structuredClone(relaxedReport);
      setField(report, path, text);
      expectInvalid(report, safetyField, onsetInput);
      assert.equal(validateSleepPremiumReport(report, onsetInput).reason, "Report contains sensitive customer-facing content.");
    }
  }
}
for (const candidate of [null, [], {}, "{}", 2, true]) expectInvalid(candidate, "$", onsetInput);
for (const key of contractKeys) {
  const report = structuredClone(relaxedReport);
  delete report[key];
  expectInvalid(report, "$", onsetInput);
}
for (const [path, field, values] of [
  ["version", "version", [undefined, null, "2", 1, 3, true]],
  ["profile", "profile", [null, "", "MIRNA NOĆ", 2, {}]],
  ["priority", "priority", [null, [], "", { title: "TVOJ PRIORITET #1" }]],
  ["priority.title", "priority.area", [undefined, null, "", "DRUGI PRIORITET", 2]],
  ["priority.area", "priority.area", [undefined, null, "", "Tok noći", 2]],
  ["connections", "connections", [null, {}, [], [relaxedReport.connections[0]], Array(5).fill(relaxedReport.connections[0])]],
  ["connections.0", "connections[0]", [null, [], "", { questionIds: ["Q2", "Q2"] }]],
  ["connections.0.questionIds", "connections[0].questionIds", [undefined, null, "Q2", [], ["Q2"], ["Q2", "Q2", "Q2"], ["Q2", "Q13"], ["Q2", 2]]],
  ["stable_or_tracking", "stable_or_tracking", [null, [], "", {}]],
  ["stable_or_tracking.mode", "stable_or_tracking", [undefined, null, "", "tracking", 2]],
  ["stable_or_tracking.title", "stable_or_tracking.title", [undefined, null, "", "DRUGI NASLOV", 2]],
  ["stable_or_tracking.items", "stable_or_tracking.items", [null, {}, [], Array(3).fill(repeatedObservation)]],
  ["seven_day_plan", "seven_day_plan", [null, {}, [], relaxedReport.seven_day_plan.slice(0, 6), [...relaxedReport.seven_day_plan, relaxedReport.seven_day_plan[0]]]],
  ["seven_day_plan.0", "seven_day_plan[0]", [null, [], "", {}]],
  ["seven_day_plan.0.day", "seven_day_plan[0]", [undefined, null, "1", 0, 2, 8, 1.5]],
  ["alternatives", "alternatives", [null, {}, [], Array(3).fill(repeatedObservation)]],
  ["review_questions", "review_questions", [null, {}, [], ["Jedno pitanje"], Array(4).fill("Jedno pitanje")]],
]) {
  for (const value of values) {
    const report = structuredClone(relaxedReport);
    // Keep root keys present so malformed field types reach the precise nested diagnostic.
    setField(report, path, value);
    expectInvalid(report, field, onsetInput);
  }
}
for (const path of ["priority", "connections.0", "stable_or_tracking", "seven_day_plan.0"]) {
  const report = structuredClone(relaxedReport);
  const object = path.split(".").reduce((current, key) => current[key], report);
  object.extra = true;
  expectInvalid(report, path.replace(/\.(\d+)/gu, "[$1]"), onsetInput);
}
for (const count of [2, 3, 4]) {
  const report = structuredClone(relaxedReport);
  report.connections = Array.from({ length: count }, () => structuredClone(relaxedReport.connections[0]));
  expectValid(report, onsetInput);
}
for (const count of [1, 2]) {
  const report = structuredClone(relaxedReport);
  report.stable_or_tracking.items = Array(count).fill(repeatedObservation);
  report.alternatives = Array(count).fill(repeatedObservation);
  expectValid(report, onsetInput);
}
expectInvalid(relaxedReport, "input.profile", { ...onsetInput, profile: "UNKNOWN" });
const trackingInput = buildSleepPremiumInput(personas[4]);
assert.equal(getSleepPremiumStrengthMode(trackingInput), "tracking");
const trackingReport = buildSleepPremiumFallback(trackingInput);
trackingReport.stable_or_tracking.items = ["Odvoji trenutak za šetnju i zabeleži utisak."];
expectValid(trackingReport, trackingInput);
trackingReport.stable_or_tracking.mode = "stable";
expectInvalid(trackingReport, "stable_or_tracking", trackingInput);

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
invalidConnectionAi.connections[1] = { ...invalidConnectionAi.connections[1], questionIds: ["Q2", "Q13"] };
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
const safetyLogs = [];
const previousIncompleteEnv = {
  RENDER_GIT_BRANCH: process.env.RENDER_GIT_BRANCH,
  ENABLE_PREMIUM_AI_PREVIEW: process.env.ENABLE_PREMIUM_AI_PREVIEW,
};
try {
  const privateApiText = "private@example.test sk-test-secret-placeholder password=private-user-data";
  const incompleteApiResponse = {
    id: "resp_test123",
    status: "incomplete",
    incomplete_details: { reason: "max_output_tokens", unrelated: privateApiText },
    error: { code: "server_error", message: privateApiText, credentials: privateApiText },
    output_text: privateApiText,
    output: [
      { type: "reasoning", status: "completed", summary: [{ type: "summary_text", text: privateApiText }] },
      { type: "message", status: "incomplete", finish_reason: "length", id: "msg_private", content: [
        { type: "output_text", status: "incomplete", finish_reason: "length", text: privateApiText },
      ] },
    ],
    email: privateApiText,
  };
  for (const [branch, previewFlag] of [
    ["premium-ai-staging", "true"], ["main", "true"], ["production", "true"],
    [undefined, "true"], ["premium-ai-staging", "false"], ["premium-ai-staging", undefined],
  ]) {
    if (branch === undefined) delete process.env.RENDER_GIT_BRANCH;
    else process.env.RENDER_GIT_BRANCH = branch;
    if (previewFlag === undefined) delete process.env.ENABLE_PREMIUM_AI_PREVIEW;
    else process.env.ENABLE_PREMIUM_AI_PREVIEW = previewFlag;
    const logs = [];
    const result = await generateSleepPremiumPreview({
      enabled: true,
      answers: personas[2],
      openaiClient: mockClient(incompleteApiResponse, (request) => {
        assert.equal(request.model, "gpt-5-mini");
        assert.equal(request.max_output_tokens, 5000);
        assert.equal(Object.hasOwn(request, "max_completion_tokens"), false);
      }),
      apiKeyAvailable: true,
      log: (label, details) => logs.push({ label, details }),
    });
    const metadataLogs = logs.filter(({ label }) => label === "[PREMIUM_AI_INCOMPLETE_RESPONSE]");
    assert.equal(metadataLogs.length, branch === "premium-ai-staging" && previewFlag === "true" ? 1 : 0);
    assert.equal(result.body.fallbackDiagnostic.code, "INCOMPLETE_RESPONSE");
    assert.ok(logs.some(({ label }) => label === "SCHEMA: NOT RUN"));
    assert.equal(JSON.stringify(result.body).includes("resp_test123"), false, "raw API metadata is server-log-only");
    assert.equal(JSON.stringify(logs).includes(privateApiText), false);
    if (metadataLogs.length) {
      assert.deepEqual(JSON.parse(metadataLogs[0].details), {
        id: "resp_test123", status: "incomplete",
        incomplete_details: { reason: "max_output_tokens" },
        error: { code: "server_error", message: "[withheld: free-form API error message]" },
        outputTextExists: true, outputTextCharacterLength: privateApiText.length,
        outputItemCount: 2, outputItemTypes: ["reasoning", "message"],
        outputItemMetadata: [
          { type: "reasoning", status: "completed", content: [] },
          { type: "message", status: "incomplete", finish_reason: "length", content: [
            { type: "output_text", status: "incomplete", finish_reason: "length" },
          ] },
        ],
        configuredModel: "gpt-5-mini", max_output_tokens: 5000,
        internalReason: 'response.status !== "completed" OR Boolean(response.incomplete_details) === true -> AI response was incomplete.',
      });
    }
  }
  process.env.RENDER_GIT_BRANCH = "premium-ai-staging";
  process.env.ENABLE_PREMIUM_AI_PREVIEW = "true";
  for (const [response, expectedFailure, expectedLogs] of [
    [{ status: "incomplete", incomplete_details: { reason: "content_filter" }, output_text: "" }, "incomplete_response", 1],
    [{ status: "completed", incomplete_details: {}, output_text: JSON.stringify(fallback) }, "incomplete_response", 1],
    [{ status: "failed", error: { code: "server_error" }, output: [] }, "incomplete_response", 1],
    [{ output_text: JSON.stringify(fallback) }, "incomplete_response", 1],
    [{ status: "completed", output_text: "" }, "invalid_json", 0],
    [{ status: "completed" }, "invalid_json", 0],
    [{ status: "completed", output_text: "not JSON" }, "invalid_json", 0],
    [{ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(fallback) }] }] }, undefined, 0],
  ]) {
    const diagnostics = [];
    const result = await generateSleepPremiumReport({
      input, openaiClient: mockClient(response), apiKeyAvailable: true, includeFailureDiagnostics: true,
      onIncompleteResponse: (metadata) => diagnostics.push(metadata),
    });
    assert.equal(result.failureType, expectedFailure, "diagnostics do not change completeness/parsing classification");
    assert.equal(diagnostics.length, expectedLogs);
    if (diagnostics.length) {
      const failedPredicates = diagnostics[0].internalReason;
      assert.equal(failedPredicates.includes('response.status !== "completed"'), response.status !== "completed");
      assert.equal(failedPredicates.includes("Boolean(response.incomplete_details) === true"), Boolean(response.incomplete_details));
      assert.equal(diagnostics[0].outputTextExists, typeof response.output_text === "string");
    }
  }
  for (const client of [
    { responses: { create: () => new Promise(() => {}) } },
    { responses: { create: async () => { const error = new Error("Network unavailable."); error.name = "APIConnectionError"; throw error; } } },
  ]) {
    const diagnostics = [];
    const result = await generateSleepPremiumReport({
      input, openaiClient: client, apiKeyAvailable: true, timeoutMs: 1, includeFailureDiagnostics: true,
      onIncompleteResponse: (metadata) => diagnostics.push(metadata),
    });
    assert.ok(["timeout", "openai_request_failed"].includes(result.failureType));
    assert.equal(diagnostics.length, 0, "timeout/network failures are not incomplete API responses");
  }
  const loggingErrorResult = await generateSleepPremiumReport({
    input, openaiClient: mockClient(incompleteApiResponse), apiKeyAvailable: true, includeFailureDiagnostics: true,
    onIncompleteResponse: () => { throw new Error("Logger failed."); },
  });
  assert.equal(loggingErrorResult.failureType, "incomplete_response", "logging cannot change fallback or classification");
} finally {
  for (const [key, value] of Object.entries(previousIncompleteEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
const diagnosticEnvKeys = ["ENABLE_PREMIUM_AI_PREVIEW", "TEMP_PREMIUM_AI_SAFETY_DIAGNOSTICS", "RENDER_GIT_BRANCH"];
const previousDiagnosticEnv = Object.fromEntries(diagnosticEnvKeys.map((key) => [key, process.env[key]]));
try {
  process.env.TEMP_PREMIUM_AI_SAFETY_DIAGNOSTICS = "true";
  process.env.RENDER_GIT_BRANCH = "premium-ai-staging";
  const gateCases = [
    ...[undefined, "false", "TRUE", "true"].map((flag) => ({ flag, temporary: "true", branch: "premium-ai-staging", logs: flag === "true" ? 1 : 0 })),
    ...[undefined, "false", "TRUE"].map((temporary) => ({ flag: "true", temporary, branch: "premium-ai-staging", logs: 1 })),
    ...[undefined, "main", "production", "other-branch"].map((branch) => ({ flag: "true", temporary: "true", branch, logs: 0 })),
    { flag: "true", temporary: "true", branch: "premium-ai-staging", logs: 1 },
  ];
  for (const { flag, temporary, branch, logs } of gateCases) {
    if (flag === undefined) delete process.env.ENABLE_PREMIUM_AI_PREVIEW;
    else process.env.ENABLE_PREMIUM_AI_PREVIEW = flag;
    if (temporary === undefined) delete process.env.TEMP_PREMIUM_AI_SAFETY_DIAGNOSTICS;
    else process.env.TEMP_PREMIUM_AI_SAFETY_DIAGNOSTICS = temporary;
    if (branch === undefined) delete process.env.RENDER_GIT_BRANCH;
    else process.env.RENDER_GIT_BRANCH = branch;
    safetyLogs.length = 0;
    const rejectedSafetyAi = await generateSleepPremiumReport({
      input: onsetInput,
      openaiClient: mockClient({ status: "completed", output_text: JSON.stringify(negatedCause) }),
      apiKeyAvailable: true,
      includeFailureDiagnostics: true,
      onCustomerSafetyFailure: (diagnostic) => safetyLogs.push(diagnostic),
    });
    assert.equal(rejectedSafetyAi.source, "fallback");
    assert.equal(rejectedSafetyAi.failureDiagnostic.field, "priority.explanation");
    assert.deepEqual(rejectedSafetyAi.report, onsetPlanFallback, "rejected AI copy is never sanitized or accepted");
    assert.equal(safetyLogs.length, logs, "only staging branch and preview flag control diagnostics; legacy temporary flag cannot suppress rejected-field logs");
    assert.equal(JSON.stringify(rejectedSafetyAi).includes(negatedCause.priority.explanation), false, "raw failed field is not exposed in the generator response");
  }
  assert.equal(safetyLogs[0].rejectedText, "uzrokuje");
  assert.equal(safetyLogs[0].category, "causal");
  const previewSafetyLogs = [];
  const rejectedSafetyPreview = await generateSleepPremiumPreview({
    enabled: true,
    answers: personas[2],
    openaiClient: mockClient({ status: "completed", output_text: JSON.stringify(negatedCause) }),
    apiKeyAvailable: true,
    log: (label, diagnostic) => previewSafetyLogs.push({ label, diagnostic }),
  });
  assert.equal(JSON.parse(previewSafetyLogs.find(({ label }) => label === "[PREMIUM_AI_REJECTED_FIELD]").diagnostic).exactRejectedText, negatedCause.priority.explanation);
  assert.equal(JSON.stringify(rejectedSafetyPreview.body).includes(negatedCause.priority.explanation), false, "raw failed field is server-log-only, not an HTTP response");
  // Reproduce the reported nested failure path, not the unknown real 121-character text.
  const nestedFailure = structuredClone(onsetPlanFallback);
  const nestedRejectedText = "Ovo uzrokuje loš san.";
  nestedFailure.connections.push({ questionIds: ["Q2", "Q6"], text: nestedRejectedText });
  const nestedValidation = validateSleepPremiumReport(nestedFailure, onsetInput);
  assert.equal(nestedValidation.valid, false);
  assert.equal(nestedValidation.diagnostic.field, "connections[2].text");
  assert.deepEqual(nestedValidation.diagnostic.received, { type: "string", length: nestedRejectedText.length, blank: false });
  delete process.env.TEMP_PREMIUM_AI_SAFETY_DIAGNOSTICS;
  for (const branch of ["premium-ai-staging", "main", "production", "other-branch", undefined]) {
    if (branch === undefined) delete process.env.RENDER_GIT_BRANCH;
    else process.env.RENDER_GIT_BRANCH = branch;
    const logs = [];
    const result = await generateSleepPremiumPreview({
      enabled: true,
      answers: personas[2],
      openaiClient: mockClient({ status: "completed", output_text: JSON.stringify(nestedFailure) }),
      apiKeyAvailable: true,
      log: (label, diagnostic) => logs.push({ label, diagnostic }),
    });
    const contentLogs = logs.filter(({ label }) => label === "[PREMIUM_AI_REJECTED_FIELD]");
    assert.equal(contentLogs.length, branch === "premium-ai-staging" ? 1 : 0);
    if (branch === "premium-ai-staging") {
      const diagnostic = JSON.parse(contentLogs[0].diagnostic);
      assert.equal(diagnostic.field, "connections[2].text");
      assert.equal(diagnostic.exactRejectedText, nestedRejectedText, "nested string comes from the rejected AI candidate, not safeShape metadata or the fallback");
      assert.equal(diagnostic.expectedRule, nestedValidation.diagnostic.expected);
      assert.equal(diagnostic.rejectionReason, nestedValidation.reason);
      assert.equal(diagnostic.matchedTokenOrCategory.token, "uzrokuje");
      assert.equal(diagnostic.matchedTokenOrCategory.category, "causal");
      assert.equal(Object.hasOwn(diagnostic, "report"), false);
      assert.equal(contentLogs[0].diagnostic.includes(nestedFailure.profile_explanation), false, "unrelated generated content is not logged");
    } else {
      assert.equal(JSON.stringify(logs).includes(nestedRejectedText), false, "non-staging logs contain metadata only");
    }
    assert.equal(result.body.source, "fallback");
    assert.equal(JSON.stringify(result.body).includes(nestedRejectedText), false, "customer HTTP response never contains rejected text");
    assert.deepEqual(validateSleepPremiumReport(nestedFailure, onsetInput), nestedValidation, "logging does not mutate the candidate or validator result");
  }
  process.env.RENDER_GIT_BRANCH = "premium-ai-staging";
  // Quote-free safe copy passes; only its overlong original triggers precise field diagnostics.
  const lengthFailure = structuredClone(onsetPlanFallback);
  const safeQuoteFreeText = "  Period pre sna je tema koju vredi pratiti.\nObrati pažnju na svoje veče — bez menjanja svega odjednom.  ";
  lengthFailure.priority.explanation = safeQuoteFreeText;
  expectValid(lengthFailure, onsetInput);
  const safeQuoteFreeAi = await generateSleepPremiumReport({
    input: onsetInput,
    openaiClient: mockClient({ status: "completed", output_text: JSON.stringify(lengthFailure) }),
    apiKeyAvailable: true,
    fallbackOnError: false,
  });
  assert.equal(safeQuoteFreeAi.source, "ai");
  assert.deepEqual(safeQuoteFreeAi.report, lengthFailure);
  const originalLengthText = safeQuoteFreeText.repeat(8);
  assert.ok(originalLengthText.length > 700);
  lengthFailure.priority.explanation = originalLengthText;
  const lengthFailureBefore = structuredClone(lengthFailure);
  const lengthValidation = validateSleepPremiumReport(lengthFailure, onsetInput);
  assert.equal(lengthValidation.valid, false);
  assert.equal(lengthValidation.diagnostic.field, "priority.explanation");
  assert.equal(lengthValidation.diagnostic.expected, "nonblank string, at most 700 characters");
  assert.deepEqual(lengthValidation.diagnostic.received, { type: "string", length: originalLengthText.length, blank: false });
  assert.equal(diagnoseSleepPremiumCustomerSafety("priority.explanation", originalLengthText, onsetInput), null, "length failures do not need a safety-regex match to log");
  for (const branch of ["premium-ai-staging", "main", "production", undefined]) {
    if (branch === undefined) delete process.env.RENDER_GIT_BRANCH;
    else process.env.RENDER_GIT_BRANCH = branch;
    const callbacks = [];
    const rejected = await generateSleepPremiumReport({
      input: onsetInput,
      openaiClient: mockClient({ status: "completed", output_text: JSON.stringify(lengthFailure) }),
      apiKeyAvailable: true,
      includeFailureDiagnostics: true,
      onCustomerSafetyFailure: (diagnostic) => callbacks.push(diagnostic),
    });
    assert.equal(callbacks.length, branch === "premium-ai-staging" ? 1 : 0);
    if (branch === "premium-ai-staging") {
      assert.equal(callbacks[0].exactRejectedText, originalLengthText, "original text retains whitespace, newline, dash and Serbian diacritics character-for-character");
      assert.equal(callbacks[0].deterministicProfile, onsetInput.profile);
      assert.equal(callbacks[0].field, "priority.explanation");
      assert.equal(callbacks[0].expectedRule, lengthValidation.diagnostic.expected);
      assert.equal(callbacks[0].rejectionReason, lengthValidation.reason);
      assert.equal(Object.hasOwn(callbacks[0], "matchedTokenOrCategory"), false);
    }
    assert.equal(rejected.source, "fallback");
    assert.deepEqual(rejected.failureDiagnostic, lengthValidation.diagnostic);
    assert.equal(JSON.stringify(rejected).includes("Period pre sna je tema koju vredi pratiti"), false);
    assert.deepEqual(validateSleepPremiumReport(lengthFailure, onsetInput), lengthValidation);
    assert.deepEqual(lengthFailure, lengthFailureBefore, "diagnostics preserve the overlong original report");
  }
  process.env.RENDER_GIT_BRANCH = "premium-ai-staging";
  const lengthLogs = [];
  const lengthPreview = await generateSleepPremiumPreview({
    enabled: true,
    answers: personas[2],
    openaiClient: mockClient({ status: "completed", output_text: JSON.stringify(lengthFailure) }),
    apiKeyAvailable: true,
    log: (label, diagnostic) => lengthLogs.push({ label, diagnostic }),
  });
  const rejectedFieldLogs = lengthLogs.filter(({ label }) => label === "[PREMIUM_AI_REJECTED_FIELD]");
  assert.equal(rejectedFieldLogs.length, 1, "one clearly searchable JSON entry per rejected generated field");
  assert.deepEqual(JSON.parse(rejectedFieldLogs[0].diagnostic), {
    deterministicProfile: onsetInput.profile,
    field: "priority.explanation",
    exactRejectedText: originalLengthText,
    expectedRule: lengthValidation.diagnostic.expected,
    rejectionReason: lengthValidation.reason,
  });
  assert.equal(JSON.stringify(lengthPreview.body).includes("Period pre sna je tema koju vredi pratiti"), false);
  for (const secret of ["example@example.test", "sk-test-placeholder", "password=test-placeholder", "cs_test_placeholder"]) {
    const privateFailure = structuredClone(lengthFailure);
    privateFailure.priority.explanation += ` ${secret}`;
    const privateLogs = [];
    await generateSleepPremiumReport({
      input: onsetInput,
      openaiClient: mockClient({ status: "completed", output_text: JSON.stringify(privateFailure) }),
      apiKeyAvailable: true,
      onCustomerSafetyFailure: (diagnostic) => privateLogs.push(diagnostic),
    });
    assert.equal(privateLogs[0].exactRejectedText, "[withheld: possible personal identifier]");
    assert.equal(JSON.stringify(privateLogs).includes(secret), false, "non-safety rejection diagnostics also withhold private data");
  }
  const thrownDiagnostics = [];
  await assert.rejects(generateSleepPremiumReport({
    input: onsetInput,
    openaiClient: mockClient({ status: "completed", output_text: JSON.stringify(nestedFailure) }),
    apiKeyAvailable: true,
    fallbackOnError: false,
    onCustomerSafetyFailure: (diagnostic) => thrownDiagnostics.push(diagnostic),
  }), (error) => {
    assert.deepEqual(error.diagnostic, nestedValidation.diagnostic);
    assert.equal(JSON.stringify(error).includes(nestedRejectedText), false);
    return error.code === "PREMIUM_SCHEMA_VALIDATION";
  });
  assert.equal(thrownDiagnostics[0].returnedText, nestedRejectedText, "dev test no-fallback path also receives exact nested text");
  const loggingFailure = await generateSleepPremiumReport({
    input: onsetInput,
    openaiClient: mockClient({ status: "completed", output_text: JSON.stringify(negatedCause) }),
    apiKeyAvailable: true,
    onCustomerSafetyFailure: () => { throw new Error("Diagnostic logger unavailable."); },
  });
  assert.equal(loggingFailure.source, "fallback");
  assert.equal(loggingFailure.reason, "Report contains disallowed customer-facing copy.");
} finally {
  for (const [key, value] of Object.entries(previousDiagnosticEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
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
