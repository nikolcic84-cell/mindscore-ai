import assert from "node:assert/strict";
import "./test-sleep-premium-theme-plan.js";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { SLEEP_ANSWER_OPTIONS, SLEEP_QUESTIONS } from "../src/psychology/sleepAssessmentContent.js";
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
const canonicalEvidence = (reportInput) => reportInput.answers.map(({ questionId, question, answer }) => ({ questionId, question, answer }));
const assertSupportingAnchors = (report, reportInput) => {
  const support = report.supporting_content;
  assert.deepEqual(support.answer_evidence, canonicalEvidence(reportInput), "evidence preserves all twelve original selections in order, without internal scores");
  for (const [key, anchor, entries] of [
    ["connections", "connectionIndex", report.connections],
    ["tracking", "itemIndex", report.stable_or_tracking.items],
    ["alternatives", "alternativeIndex", report.alternatives],
  ]) {
    assert.deepEqual(support[key].map((entry) => entry[anchor]), entries.map((_, index) => index), `${key} contexts anchor every existing entry once, in order`);
  }
  assert.deepEqual(support.days.map(({ day }) => day), report.seven_day_plan.map(({ day }) => day));
};
// Only acceptance fixtures that intentionally resize concise arrays use this helper.
// Rejection fixtures keep their mismatched counts so the runtime must reject them.
const matchSupportingCounts = (report) => {
  for (const [key, anchor, entries] of [
    ["connections", "connectionIndex", report.connections],
    ["tracking", "itemIndex", report.stable_or_tracking.items],
    ["alternatives", "alternativeIndex", report.alternatives],
  ]) {
    const context = report.supporting_content[key][0].context;
    report.supporting_content[key] = entries.map((_, index) => ({ [anchor]: index, context }));
  }
};
assert.deepEqual(
  new Set(personas.map((points) => buildSleepPremiumInput(points).profile)),
  new Set(["MIRNA NOĆ", "UMORAN SAN", "BUDAN UM", "ISPREKIDAN SAN", "SAN POD PRITISKOM"]),
);

assert.equal(SLEEP_PREMIUM_AI_TIMEOUT_MS, 60_000);
for (const points of personas) {
  const profileInput = buildSleepPremiumInput(points);
  const report = buildSleepPremiumFallback(profileInput);
  assert.equal(validateSleepPremiumReport(report, profileInput).valid, true);
  assertSupportingAnchors(report, profileInput);
  assert.equal(report.profile, profileInput.profile);
  assert.equal(report.priority.area, getSleepPremiumPriority(profileInput).title);
  assert.equal(report.stable_or_tracking.mode, getSleepPremiumStrengthMode(profileInput));
  assert.equal(report.stable_or_tracking.title, "ŠTA JOŠ VREDI DA PRATIŠ");
  assert.equal(report.stable_or_tracking.items.length, 3);
  assert.equal(report.connections.length, 4);
  assert.equal(report.connections.every(({ questionIds, text }) =>
    questionIds.length === 2 &&
    questionIds[0] !== questionIds[1] &&
    questionIds.every((questionId) => profileInput.answers.some((answer) => answer.questionId === questionId)) &&
    typeof text === "string" && text.trim().length > 0 && text.length <= 500
  ), true);
  assert.equal(report.connections.every(({ text }) => !/\bQ(?:[1-9]|1[0-2])\b/.test(text)), true);
  assert.equal(report.seven_day_plan.length, 7);
  assert.deepEqual(report.seven_day_plan.map(({ day }) => day), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(new Set(report.seven_day_plan.map(({ action }) => action)).size, 7);
  const firstExperiment = report.seven_day_plan[1].action;
  const secondExperiment = report.seven_day_plan[4].action;
  assert.notEqual(firstExperiment, secondExperiment, "days 2 and 5 are different practical experiments");
  for (const action of [firstExperiment, secondExperiment]) {
    assert.match(action, /pripremi|napiši|čitanja|namesti|izaberi|odaberi|ostavi|završi|pauzu/iu,
      "experiment does something concrete, not only observing or tracking");
    assert.doesNotMatch(action, /^(?:zabeleži|primeti|prati|uporedi)\b/iu);
  }
  assert.equal(report.seven_day_plan.every(({ action, observe }) =>
    action.toLowerCase().includes(report.priority.area.toLowerCase()) && observe.toLowerCase().includes(report.priority.area.toLowerCase())
  ), false, "fallback does not mechanically repeat the priority label in all 14 texts");
  assert.ok(report.profile_explanation.length <= 180, "fallback introduction stays brief");
  assert.deepEqual(report.connections.map(({ questionIds }) => questionIds), [["Q1", "Q8"], ["Q2", "Q7"], ["Q3", "Q12"], ["Q9", "Q10"]]);
  for (const { questionIds, text } of report.connections) {
    for (const id of questionIds) assert.ok(text.includes(profileInput.answers.find(({ questionId }) => questionId === id).answer));
  }
  assert.equal(report.alternatives.length >= 1 && report.alternatives.length <= 2, true);
  assert.equal(report.review_questions.length, 3);
  assert.equal(new Set(report.review_questions).size, 3);
  assert.equal(report.review_questions.every((question) => question.endsWith("?")), true);
  assert.equal(report.seven_day_plan.some(({ action, observe }) => action.includes("${focus}") || observe.includes("${focus}")), false);
  const overview = getSleepPremiumAreaOverview(profileInput);
  assert.deepEqual(overview.map(({ key }) => key), ["recovery", "sleepOnset", "continuity", "rhythm"]);
  assert.equal(overview.every(({ title, status }) => title && ["Deluje mirnije", "Vredi pratiti", "Ovde se najviše izdvaja"].includes(status)), true);
  assert.equal(JSON.stringify(overview).match(/STABLE|MIXED|WEAK|score|\d/iu), null);
  assert.equal(profileInput.answers.length, 12);
  profileInput.answers.forEach(({ questionId, question, answer }, index) => {
    assert.equal(questionId, `Q${index + 1}`);
    assert.equal(question, SLEEP_QUESTIONS[index]);
    assert.equal(answer, SLEEP_ANSWER_OPTIONS[index].find(({ points: optionPoints }) => optionPoints === points[index]).text);
  });
}

const contractKeys = ["version", "profile", "profile_explanation", "priority", "connections", "stable_or_tracking", "seven_day_plan", "alternatives", "review_questions", "after_seven_days", "closing", "supporting_content"];
assert.deepEqual(Object.keys(fallback), contractKeys);
const schema = buildSleepPremiumJsonSchema(input);
assert.equal(schema.strict, true);
assert.equal(schema.schema.additionalProperties, false);
assert.deepEqual(schema.schema.required, contractKeys);
assert.deepEqual(schema.schema.properties.version.enum, [2], "support is additive within v2, not a second report version");
const supportSchema = schema.schema.properties.supporting_content;
const assertExactObjectSchema = (object, keys) => {
  assert.equal(object.type, "object");
  assert.equal(object.additionalProperties, false);
  assert.deepEqual(Object.keys(object.properties), keys);
  assert.deepEqual(object.required, keys);
};
assertExactObjectSchema(supportSchema, ["answer_evidence", "priority", "connections", "tracking", "days", "alternatives"]);
assertExactObjectSchema(supportSchema.properties.answer_evidence.items, ["questionId", "question", "answer"]);
assert.equal(supportSchema.properties.answer_evidence.minItems, 12);
assert.equal(supportSchema.properties.answer_evidence.maxItems, 12);
for (const key of ["questionId", "question", "answer"]) {
  assert.deepEqual(supportSchema.properties.answer_evidence.items.properties[key].enum, input.answers.map((entry) => entry[key]));
}
assertExactObjectSchema(supportSchema.properties.priority, ["context", "evidenceQuestionIds"]);
const supportIdsSchema = supportSchema.properties.priority.properties.evidenceQuestionIds;
assert.equal(supportIdsSchema.minItems, 1);
assert.equal(supportIdsSchema.maxItems, 12);
assert.deepEqual(supportIdsSchema.items.enum, input.answers.map(({ questionId }) => questionId));
for (const [key, anchor, minItems, maxItems] of [
  ["connections", "connectionIndex", 2, 4], ["tracking", "itemIndex", 1, 3], ["alternatives", "alternativeIndex", 1, 2],
]) {
  const collection = supportSchema.properties[key];
  assert.equal(collection.minItems, minItems);
  assert.equal(collection.maxItems, maxItems);
  assertExactObjectSchema(collection.items, [anchor, "context"]);
  assert.deepEqual(collection.items.properties[anchor], { type: "integer", minimum: 0, maximum: maxItems - 1 });
  assert.equal(collection.items.properties.context.maxLength, 500);
  assert.equal(collection.items.properties.context.pattern, "\\S");
}
assert.equal(supportSchema.properties.priority.properties.context.maxLength, 500);
assert.equal(supportSchema.properties.days.minItems, 7);
assert.equal(supportSchema.properties.days.maxItems, 7);
assertExactObjectSchema(supportSchema.properties.days.items, ["day", "rationale", "reflection"]);
assert.deepEqual(supportSchema.properties.days.items.properties.day, { type: "integer", minimum: 1, maximum: 7 });
assert.equal(supportSchema.properties.days.items.properties.rationale.maxLength, 250);
const reflectionSchema = supportSchema.properties.days.items.properties.reflection.anyOf;
assert.equal(reflectionSchema[0].type, "string");
assert.equal(reflectionSchema[0].maxLength, 200);
assert.equal(reflectionSchema[0].pattern, "\\S");
assert.deepEqual(reflectionSchema[1], { type: "null" });
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

const promptFor = (reportInput) => buildSleepPremiumPrompt(reportInput, {
  profile: reportInput.profile,
  priorityArea: getSleepPremiumPriority(reportInput).title,
  mode: getSleepPremiumStrengthMode(reportInput),
  stableTitle: "ŠTA JOŠ VREDI DA PRATIŠ",
  stableAreas: getSleepPremiumAreaOverview(reportInput).filter(({ status }) => status === "Deluje mirnije").map(({ title }) => title),
  profileExplanationMaxLength: buildSleepPremiumJsonSchema(reportInput).schema.properties.profile_explanation.maxLength,
});
// Writing quality is instructed in the prompt, not enforced by a semantic runtime gate.
for (const points of personas) {
  const reportInput = buildSleepPremiumInput(points);
  const reportPrompt = promptFor(reportInput);
  const properties = buildSleepPremiumJsonSchema(reportInput).schema.properties;
  const fixedLine = reportPrompt.split("\n").find((line) => line.startsWith("Fiksni podaci: "));
  assert.deepEqual(JSON.parse(fixedLine.slice("Fiksni podaci: ".length)), {
    profile: reportInput.profile, priorityArea: getSleepPremiumPriority(reportInput).title,
    mode: getSleepPremiumStrengthMode(reportInput), trackingTitle: "ŠTA JOŠ VREDI DA PRATIŠ",
  });
  const answersLine = reportPrompt.split("\n").find((line) => line.startsWith("Svih 12 kanonskih odgovora: "));
  assert.deepEqual(JSON.parse(answersLine.slice("Svih 12 kanonskih odgovora: ".length)),
    reportInput.answers.map(({ questionId, question, answer }) => ({ questionId, question, answer })),
    "all 12 canonical questions and exact selected strings reach the model, without scores");
  assert.doesNotMatch(reportPrompt, /mappedValue|internalScores|OBAVEZNO uključi|VERBATIM|SVAKI dan, i action i observe|U svih 14 tekstova/);
  // Copy targets guide the writer only; schema limits, safety and fallback stay unchanged.
  for (const copyGuidance of [
    /25–35% manje mobilnog teksta.*ne korisne personalizacije/,
    /JEDNA ČINJENICA — JEDNO OBJAŠNJENJE.*uglavnom objasni jednom/,
    /Detaljna objašnjenja zadrži u postojećem supporting_content/,
    /3–5 kratkih rečenica.*odakle početi.*jedan mali prvi pokušaj/,
    /60–100 reči.*700 znakova ima prednost/,
    /Svaka connections stavka: 1–2 kratke rečenice.*120–240 znakova/,
    /ne citat A \+ citat B \+ generički savet/,
    /Ne objašnjavaj ponovo vezu već obrađenu u prioritetu/,
    /Svaka tracking stavka.*60–120 znakova.*Nije dodatna preporuka/,
    /action je jedna kratka rečenica.*70–120 znakova.*35–75 znakova/,
    /rationale pripada supporting_content.days/,
    /Svaku alternatives stavku počni direktno drugim postupkom.*100–200 znakova/,
    /Ne prepisuj dan 2 ili dan 5 kao novu alternativu/,
    /Parafraziraj prirodno, citate koristi štedljivo/,
    /Ne koristi AI prvo lice/,
    /Ovo ne menja obavezne izvorne odgovore u answer_evidence/,
    /lakše za sprovesti.*više ti odgovara.*delovalo mirnije.*želiš da zadržiš/,
    /prednost ima prirodna parafraza.*obično najviše jedan kratak citat po sekciji/,
    /Sačuvaj stvarno značenje, učestalost i neizvesnost.*bez pojačavanja tvrdnje/,
    /Ne pretvaraj istovremeno navedene navike u odnos uzroka i posledice/,
    /Razlog da nešto vredi primetiti nije dokaz zašto neko loše spava/,
    /answer_evidence ostaje doslovan izvor/,
    /svaka radnja mora odmah biti razumljiva.*jasnim predmetom i usklađenim glagolima/,
    /Dan 1 je početno zapažanje.*NE uvedena rutina/,
    /Dan 4 znači poređenje sa početnim utiskom, bez novog velikog pokušaja/,
    /bez produžavanja teksta.*„korelira sa“.*„eksperimentisati sa“.*„promenljiv deo za probu“.*„testirati“.*„hipoteza“/,
    /Preporuke i dalje zasnivaj na stvarnim odgovorima, ne na generičkim savetima/,
  ]) assert.match(reportPrompt, copyGuidance);
  // Check writer responsibilities, not exact generated Serbian output or semantic token quotas.
  const strategy = reportPrompt.split("\n");
  const lineFor = (prefix) => {
    const line = strategy.find((entry) => entry.startsWith(prefix));
    assert.ok(line, `strategy guidance exists: ${prefix}`);
    return line;
  };
  const wholeProfile = lineFor("STRATEGIJA CELE SLIKE:");
  assert.match(wholeProfile, /svih 12 odgovora/);
  assert.match(wholeProfile, /potkrepljene teme/);
  assert.match(wholeProfile, /Ne ispisuj.*ne dodaj JSON ključeve.*ne izmišljaj temu/);
  const responsibilities = lineFor("RAZLIČITI POSLOVI SEKCIJA:");
  for (const field of ["profile_explanation", "priority", "connections", "tracking", "seven_day_plan", "alternatives", "supporting_content"]) {
    assert.ok(responsibilities.includes(field), `distinct role specified for ${field}`);
  }
  const introGuidance = lineFor("profile_explanation:");
  assert.match(introGuidance, /najmanje dva smisleno različita dela sna.*odgovori podržavaju/);
  assert.match(introGuidance, /Ne daj savet.*ne prepričavaj samo.*prioritet/);
  assert.match(lineFor("Kroz connections"), /najmanje tri različite potkrepljene teme.*Svaka stavka donosi novu/);
  assert.match(lineFor("Kroz connections"), /Ne nameći kvotu.*ne izmišljaj/);
  assert.match(lineFor("Tracking širi sliku"), /sporednim temama.*još nisu potpuno objašnjene/);
  assert.match(lineFor("Tracking širi sliku"), /Ne ponavljaj connections.*ne pretvaraj tracking u listu radnji/);
  const progression = lineFor("Napredovanje plana kroz celu sliku:");
  const dayRoles = [
    /dan 1.*zapažanje.*večeri, noći i jutra.*bez namerne promene/,
    /dan 2.*jedan mali pokušaj.*fiksni prioritet/,
    /dan 3.*DRUGA potkrepljena oblast.*posmatranje ili mala bezbedna promena.*ne prilagođavanje dana 2/,
    /dan 4.*poređenje dana 1–3.*bez novog velikog pokušaja/,
    /dan 5.*TREĆI UGAO.*još jedne potkrepljene teme.*ne duža ili kraća verzija dana 2/,
    /dan 6.*korisnik bira i ponavlja/,
    /dan 7.*osvrt.*JEDNE realne stvari za nastavak/,
  ];
  const dayInstructions = progression.split(";");
  dayRoles.forEach((role, index) => assert.match(dayInstructions[index], role));
  assert.match(lineFor("Plan normalno"), /najmanje tri različite teme potkrepljene odgovorima/);
  assert.match(lineFor("Plan normalno"), /manje od tri.*bez izmišljanja treće/);
  assert.match(lineFor("Plan normalno"), /Prioritet ostaje nepromenjen.*nisu novi prioriteti/);
  const alternativeGuidance = lineFor("alternatives:");
  assert.match(alternativeGuidance, /DRUGU potkrepljenu temu.*svih odgovora/);
  assert.match(alternativeGuidance, /ne automatski večernju rutinu i misli/);
  assert.match(alternativeGuidance, /drugi put, ne novi Priority #1/);
  assert.doesNotMatch(reportPrompt, /dan 3 prilagodi njegov obim|dan 3 olakšava pokušaj|dan 5 uvodi drugačiji pristup istoj temi|drugi istražuje drugi praktičan pristup toj temi/);
  for (const avoidedWording of [
    "obrazac", "signal", "faktor", "analiza pokazuje", "podaci pokazuju", "testirati hipotezu",
    "vizuelna stimulacija", "analiziram", "vidim", "zaključio sam", "pokazujem ti", "fokusiram se",
    "delovalo je", "bilo je efikasno", "poboljšalo je san", "rešilo je problem",
  ]) assert.ok(reportPrompt.includes(`„${avoidedWording}“`), `prompt explicitly discourages: ${avoidedWording}`);
  for (const instruction of [
    /prirodnom, direktnom srpskom.*sa ti/,
    /Vrati samo JSON.*version: 2.*Ne dodaj sekcije ili ključeve/,
    /Model nikada ne bira profil ili prioritet; ne menjaj ih i ne izvodi ocene/,
    /Naslov je UVEK „ŠTA JOŠ VREDI DA PRATIŠ“, nezavisno od mode/,
    /profile_explanation: 2–3 kratke rečenice.*bez ponavljanja naziva profila/,
    /priority.explanation: objasni zašto krenuti baš od fiksnog prioriteta.*relevantne izabrane odgovore.*konkretan pravac/,
    /Razlikuj ono što osoba već radi od onoga što može tek da proba/,
    /Sažmi ih prirodno.*nije potreban citat u svakoj rečenici/,
    /Ako koristiš navodnike.*prekopiraj ceo odgovarajući answer tačno, sa svim znakovima/,
    /Ne izmišljaj posao, porodicu, smene, obaveze, navike ili osećanja/,
    /connections: 2–4 smislene veze ili kontrasta.*tačno questionIds i text.*tačno dva različita ID-ja/,
    /jutro i dan, veče i misli, tok noći i ukupni utisak, trajanje i raspored/,
    /Kontrast navedi samo kada ga odgovori podržavaju.*ne tvrdi da jedno objašnjava drugo.*ID-jeve nikada/,
    /stable_or_tracking.items: 1–3 konkretne sporedne stvari.*iz preostalih odgovora/,
    /To nisu novi prioriteti, lista problema, dijagnoze ili generičke pohvale/,
    /TAČNO sedam objekata redom sa day vrednostima 1–7.*action <=300.*observe <=250.*action <=150.*observe <=100/,
    /bez stalnog ponavljanja naziva prioriteta/,
    /Ne menjaj više stvari odjednom, ne svodi plan na pisanje beležaka/,
    /ako već postoji mirna rutina bez ekrana, ne predstavljaj odlaganje telefona kao neophodan korak/,
    /misli aktivne uprkos mirnoj rutini.*završavanje planiranja pre nje.*Ne pretpostavljaj telefon ako je izabran TV/,
    /alternatives: 1–2 konkretna, stvarno drugačija pristupa.*AKO TI PRVI KORAK NE ODGOVARA/,
    /Naslov ne dodaj kao JSON ključ.*Osloni se na DRUGU potkrepljenu temu/,
    /Ne nuditi samo praćenje, zapisivanje ili manju verziju istog eksperimenta/,
    /review_questions: vrati TAČNO tri kratka, različita pitanja/,
    /after_seven_days: objasni kako uporediti početak i kraj.*bez obećanja ishoda/,
    /JSON je jedini prihvaćeni izveštaj za web i budući PDF/,
    /Ne generiši zasebnu PDF verziju ili drugi izveštaj/,
    /PDF kasnije koristi iste sačuvane podatke.*ne obećavaj da je PDF već dostupan/,
    /supporting_content je samo dopunsko objašnjenje ISTE analize, ne novi plan/,
    /answer_evidence: prekopiraj svih 12 originalnih \{questionId, question, answer\} redom i bez izmene/,
    /priority: context do 500.*postojeći razlog.*evidenceQuestionIds navodi 1–12 različitih originalnih ID-jeva/,
    /Ne dodaj drugi profil, prioritet ili medicinsko objašnjenje/,
    /supporting_content.connections: za svaku postojeću vezu tačno jedan \{connectionIndex, context\}, indeksi od nule redom/,
    /tracking: tačno jedan \{itemIndex, context\} po postojećoj sporednoj stavci, indeksi od nule redom/,
    /alternatives: tačno jedan \{alternativeIndex, context\} po postojećem pristupu, indeksi od nule redom/,
    /Svi context tekstovi do 500.*ne dodaj drugačije korake ili protivrečna tumačenja/,
    /supporting_content.days: tačno sedam \{day, rationale, reflection\} objekata redom/,
    /rationale do 250.*već navedene radnje, bez nove radnje ili obećanja/,
    /reflection je kratko pitanje do 200.*istoj radnji i zapažanju ili null/,
    /Ne prepisuj i ne menjaj action ili observe/,
    /Za osvrt i završetak koristi postojeće review_questions, after_seven_days i closing, ne njihove nezavisne kopije/,
    /Sve zaštite od medicinskih, uzročnih i internih tvrdnji važe i za dopunski tekst/,
    /closing: kratka mirna informativna napomena/,
    /Zabranjeno.*dijagnoze.*medicinske tvrdnje.*uzročna objašnjenja.*obećanja.*ocene, procenti.*interni\/tehnički termini/,
    /Praktična trajanja malih postupaka su dozvoljena/,
    /Ne koristi robotske fraze.*Izbegni ponavljanje iste poruke/,
  ]) assert.match(reportPrompt, instruction);
  assert.deepEqual(properties.profile.enum, [reportInput.profile]);
  for (const key of ["questionId", "question", "answer"]) {
    assert.deepEqual(properties.supporting_content.properties.answer_evidence.items.properties[key].enum, reportInput.answers.map((entry) => entry[key]));
  }
  assert.deepEqual(properties.priority.properties.area.enum, [getSleepPremiumPriority(reportInput).title]);
  assert.deepEqual(properties.stable_or_tracking.properties.mode.enum, [getSleepPremiumStrengthMode(reportInput)]);
  assert.deepEqual(properties.stable_or_tracking.properties.title.enum, ["ŠTA JOŠ VREDI DA PRATIŠ"]);
  assert.equal(properties.stable_or_tracking.properties.items.minItems, 1);
  assert.equal(properties.stable_or_tracking.properties.items.maxItems, 3);
  assert.match(properties.profile_explanation.description, /short natural Serbian.*selected answers as context; no mandatory quote/i);
  assert.match(properties.priority.properties.explanation.description, /why this fixed priority.*naturally.*relevant selected answers/i);
  assert.match(properties.seven_day_plan.items.properties.action.description, /concrete.*selected answers.*Day 1 baseline.*day 2 practical change.*day 5 a different small experiment.*Do not merely repeat tracking or the priority label/i);
  assert.match(properties.seven_day_plan.items.properties.observe.description, /very short.*conversational Serbian.*Do not repeat the priority label mechanically/i);
  assert.match(properties.alternatives.items.description, /genuinely different practical approach supported by another part of the selected answers/i);
}
assert.equal(schema.schema.properties.connections.items.type, "object");
assert.equal(schema.schema.properties.connections.items.properties.questionIds.minItems, 2);
assert.equal(schema.schema.properties.connections.items.properties.questionIds.maxItems, 2);
assert.deepEqual(schema.schema.properties.connections.items.properties.questionIds.items.enum, input.answers.map(({ questionId }) => questionId));
assert.equal(schema.schema.properties.connections.items.properties.text.maxLength, 500);
assert.match(schema.schema.properties.connections.items.properties.text.description, /natural.*Serbian.*Do not include or display question IDs/i);
const onsetInput = buildSleepPremiumInput(personas[2]);
const onsetPriority = getSleepPremiumPriority(onsetInput);
assert.equal(onsetPriority.title, "Period pre sna");
const onsetPrompt = promptFor(onsetInput);
assert.match(onsetPrompt, /Završi sadržaj koji gledaš.*deset minuta bez ekrana/);

const appSource = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
const previewHtml = await readFile(new URL("../server/dev/premium-ai-preview.html", import.meta.url), "utf8");
const appCss = await readFile(new URL("../src/App.css", import.meta.url), "utf8");
const extract = (source, pattern, label) => {
  const match = source.match(pattern);
  assert.ok(match, `${label} is present`);
  return match[0];
};
const reactPreview = extract(appSource, /function PremiumAiPreviewReport\([\s\S]*?(?=\nfunction SleepPremiumDiscoveryPage\()/u, "React preview component");
const paidRenderer = extract(appSource, /function SleepPremiumPaidReport\([\s\S]*?(?=\nfunction PaymentSuccessPage\()/u, "paid renderer");
const htmlRenderer = extract(previewHtml, /const renderReport = \(source\) => \{[\s\S]*?(?=\n\s*button.addEventListener)/u, "HTML renderer");
const headings = [
  "TVOJ PRIORITET #1", "KAKO SE TVOJIH 12 ODGOVORA POVEZUJE", "ŠTA JOŠ VREDI DA PRATIŠ",
  "TVOJ LIČNI PLAN ZA 7 DANA", "AKO TI PRVI KORAK NE ODGOVARA", "TVOJ PDF PLAN",
];
assert.deepEqual([...reactPreview.matchAll(/<h3>([^<]+)<\/h3>/gu)].map((match) => match[1]), headings,
  "exactly six headings in the preview component, not elsewhere in App");
assert.deepEqual([...htmlRenderer.matchAll(/\bsection\("([^"]+)"\)/gu)].map((match) => match[1]), headings);
assert.ok(paidRenderer.includes("report.connections.map((connection, index) => <li key={index}>{connection.text}</li>)"));
assert.ok(reactPreview.includes("report.connections.map((connection, index) => <li key={`connection-${index}`}>{connection.text}</li>)"));
assert.ok(htmlRenderer.includes("report.connections.map((connection) => connection.text)"));
assert.match(reactPreview, /source === "fallback" \? "FALLBACK" : "AI_GENERATED"/);
assert.match(reactPreview, /source === "fallback" && fallbackDiagnostic\?\.reason/);
assert.match(htmlRenderer, /source === "fallback"[\s\S]*Osnovni plan[\s\S]*AI plan/);
for (const body of [reactPreview, htmlRenderer]) {
  assert.doesNotMatch(body, /AKO PRVI KORAK NE POMOGNE|ŠTA VREDI DA ZADRŽIŠ/);
  assert.doesNotMatch(body, /\bfetch\s*\(|\b(?:build|generate|download)\w*Pdf\s*\(|\b(?:jsPDF|Blob|createObjectURL)\b|download\s*=|onClick\s*=|addEventListener\s*\(/iu,
    "rendering consumes the accepted report without fetching, generation or download handlers");
  assert.doesNotMatch(body, /localStorage|sessionStorage|JSON\.parse|JSON\.stringify|buildSleepPremiumFallback|generateSleepPremiumReport/);
  for (const field of ["profile", "profile_explanation", "priority.area", "priority.explanation", "connections", "stable_or_tracking.items", "seven_day_plan", "alternatives", "review_questions", "after_seven_days", "closing"]) {
    assert.ok(body.includes(`report.${field}`), `renderer uses accepted ${field}`);
  }
}
assert.match(reactPreview, /PDF nije dostupan u staging pregledu/);
assert.match(reactPreview, /iste prihvaćene podatke ovog izveštaja, bez nove analize ili izmene plana/);
assert.match(htmlRenderer, /PDF još nije dostupan.*isti prihvaćeni izveštaj i isti plan.*bez novog AI generisanja/);
assert.match(previewHtml, /let acceptedReport = null/);
assert.match(htmlRenderer, /const report = acceptedReport/);
assert.match(previewHtml, /acceptedReport = data\.report;\s*renderReport\(data\.source\)/);
assert.match(previewHtml, /\["ai", "fallback"\]\.includes\(data\.source\)/);
assert.equal([...previewHtml.matchAll(/\bfetch\s*\(/gu)].length, 1, "only the existing AI preview request remains");
assert.doesNotMatch(previewHtml, /localStorage|sessionStorage|indexedDB|application\/pdf|createObjectURL|\bjsPDF\b|\bdownload\s*=/iu);
assert.match(appSource, /<PremiumAiPreviewReport\s+report=\{previewResult\.report\}\s+source=\{previewResult\.source\}/u);

// Mobile-safe styles are scoped to the preview, including list reset and readable plan labels.
const reportCss = extract(appCss, /\.premium-staging-preview-report \{[\s\S]*?(?=\n\.sleep-discovery-back \{)/u, "scoped preview CSS");
const cssRules = [...reportCss.matchAll(/([^{}]+)\{([^{}]*)\}/gu)];
assert.ok(cssRules.length > 20);
for (const [, selectors] of cssRules) {
  for (const selector of selectors.trim().split(",")) assert.ok(selector.trim().startsWith(".premium-staging-preview-report"), `preview-only selector: ${selector}`);
}
const cssRule = (selector) => {
  const rule = cssRules.find(([, selectors]) => selectors.trim() === selector);
  assert.ok(rule, `responsive rule exists: ${selector}`);
  return rule[2];
};
assert.match(cssRule(".premium-staging-preview-report"), /grid-template-columns:\s*minmax\(0, 1fr\)/);
assert.match(cssRule(".premium-staging-preview-report"), /width:\s*100%;[\s\S]*min-width:\s*0/);
assert.match(cssRule(".premium-staging-preview-report"), /padding:\s*clamp\([\s\S]*overflow-wrap:\s*anywhere/);
assert.match(cssRule(".premium-staging-preview-report .premium-staging-preview-banner"), /flex-wrap:\s*wrap/);
assert.match(cssRule(".premium-staging-preview-report .premium-preview-plan"), /padding:\s*0;\s*list-style:\s*none/);
assert.match(cssRule(".premium-staging-preview-report dt"), /color:[\s\S]*font-weight:\s*700/);
assert.match(reportCss, /\.premium-staging-preview-report dd \{[\s\S]*line-height:\s*1\.65;\s*overflow-wrap:\s*anywhere/);
assert.match(reportCss, /\.premium-staging-preview-report dl > div \{\s*min-width:\s*0/);
assert.match(reportCss, /\.premium-staging-preview-report \* \{\s*box-sizing:\s*border-box/);
assert.doesNotMatch(reportCss, /height:\s*\d+px|overflow:\s*hidden|white-space:\s*nowrap/);
assert.match(previewHtml, /name="viewport" content="width=device-width, initial-scale=1"/);
assert.match(previewHtml, /#report \{[^}]*grid-template-columns: minmax\(0, 1fr\)/);
assert.match(previewHtml, /\.report-section \.days \{[^}]*list-style: none; padding: 0/);

// Execute the actual HTML script with a minimal DOM; no network, browser storage or PDF facilities.
const makeNode = (tagName, textContent = "") => ({
  tagName, textContent, children: [], dataset: {}, attributes: {}, className: "",
  append(...nodes) { this.children.push(...nodes); },
  replaceChildren(...nodes) { this.children = nodes; },
  setAttribute(name, value) { this.attributes[name] = value; },
  classList: { add() {} },
  addEventListener() {},
});
const domNodes = Object.fromEntries(["#generate", "#status", "#report"].map((selector) => [selector, makeNode("div")]));
const htmlContext = {
  document: { querySelector: (selector) => domNodes[selector], createElement: (tag) => makeNode(tag) },
};
const htmlScript = extract(previewHtml, /<script>[\s\S]*?<\/script>/u, "preview script").replace(/^<script>|<\/script>$/gu, "");
runInNewContext(htmlScript, htmlContext, { timeout: 1000 });
const descendants = (node) => [node, ...node.children.flatMap(descendants)];
const renderAcceptedHtml = (report, source) => {
  htmlContext.testReport = report;
  htmlContext.testSource = source;
  runInNewContext("acceptedReport = testReport; renderReport(testSource);", htmlContext, { timeout: 1000 });
  assert.equal(runInNewContext("acceptedReport === testReport", htmlContext), true, "rendering retains the same accepted object");
  const nodes = descendants(domNodes["#report"]);
  assert.deepEqual(nodes.filter(({ tagName }) => tagName === "h2").map(({ textContent }) => textContent), headings);
  assert.equal(domNodes["#report"].children[0].dataset.source, source);
  assert.match(domNodes["#report"].children[0].textContent, source === "ai" ? /^AI plan/ : /^Osnovni plan/);
  for (const text of [report.profile, report.profile_explanation, report.priority.area, report.priority.explanation,
    ...report.connections.map(({ text }) => text), ...report.stable_or_tracking.items,
    ...report.seven_day_plan.flatMap(({ action, observe }) => [action, observe]), ...report.alternatives,
    ...report.review_questions, report.after_seven_days, report.closing]) {
    assert.ok(nodes.some(({ textContent }) => textContent === text), "accepted customer text is displayed verbatim");
  }
  assert.equal(nodes.filter(({ className }) => className === "day").length, 7);
  assert.equal(nodes.filter(({ tagName }) => tagName === "details").length, 1);
  assert.equal(nodes.some(({ tagName }) => ["button", "a", "iframe"].includes(tagName)), false, "no PDF controls in rendered report");
};

// Same deterministic scores must not collapse different canonical selections into identical advice.
const sameScoreOnsets = [
  [5, 3, 5, 5, 5, 1, 3, 5, 5, 5, 5, 5], // scrolling, active thoughts
  [5, 1, 5, 5, 5, 3, 3, 5, 5, 5, 5, 5], // TV, active thoughts
  [5, 1, 5, 5, 5, 4, 2, 5, 5, 5, 5, 5], // calm routine, planning
  [5, 1, 5, 5, 5, 5, 1, 5, 5, 5, 5, 5], // no screens, busy mind
  [5, 1, 5, 5, 5, 1, 5, 5, 5, 5, 5, 5], // scrolling, quiet mind
].map(buildSleepPremiumInput);
const onsetVariants = sameScoreOnsets.map(buildSleepPremiumFallback);
for (let index = 0; index < sameScoreOnsets.length; index += 1) {
  const variantInput = sameScoreOnsets[index];
  const report = onsetVariants[index];
  assert.deepEqual(variantInput.dimensions, sameScoreOnsets[0].dimensions, "all four dimension scores/states are identical");
  assert.equal(variantInput.profile, "BUDAN UM");
  assert.equal(report.priority.area, "Period pre sna");
  assert.equal(validateSleepPremiumReport(report, variantInput).valid, true);
  for (const id of ["Q2", "Q7"]) assert.ok(report.priority.explanation.includes(variantInput.answers.find(({ questionId }) => questionId === id).answer));
  renderAcceptedHtml(report, "fallback");
}
assert.match(onsetVariants[0].seven_day_plan[1].action, /Ostavi telefon van dohvata/);
assert.match(onsetVariants[1].seven_day_plan[1].action, /Završi sadržaj koji gledaš/);
assert.doesNotMatch(onsetVariants[1].seven_day_plan[1].action, /telefon/iu, "TV answer never becomes an invented phone habit");
for (const report of onsetVariants.slice(2, 4)) {
  assert.match(report.connections[1].text, /Već imaš miran završetak večeri, ali misli ostaju aktivne/);
  assert.match(report.priority.explanation, /Već imaš miran završetak večeri/);
  assert.match(report.seven_day_plan[1].action, /Pre svoje mirne rutine napiši jednu obavezu/);
  assert.match(report.seven_day_plan[4].action, /Umesto pisanja obaveze.*tihog čitanja/);
  assert.doesNotMatch(report.seven_day_plan[1].action, /telefon|ekran/iu);
}
assert.notEqual(onsetVariants[0].connections[1].text, onsetVariants[1].connections[1].text);
assert.notEqual(onsetVariants[0].priority.explanation, onsetVariants[1].priority.explanation);
assert.notEqual(onsetVariants[0].seven_day_plan[1].action, onsetVariants[1].seven_day_plan[1].action);
assert.notEqual(onsetVariants[1].priority.explanation, onsetVariants[2].priority.explanation);
assert.notEqual(onsetVariants[1].seven_day_plan[1].action, onsetVariants[2].seven_day_plan[1].action);
assert.match(onsetVariants[0].alternatives[0], /tihog čitanja/);
assert.match(onsetVariants[4].alternatives[0], /mirno sedenje/);
assert.notEqual(onsetVariants[0].alternatives[0], onsetVariants[4].alternatives[0], "alternative responds to a different thoughts answer despite equal scores");
const recoveryVariants = [
  [1, 5, 5, 4, 5, 5, 5, 4, 5, 5, 1, 5],
  [3, 5, 5, 1, 5, 5, 5, 1, 5, 5, 5, 5],
].map(buildSleepPremiumInput);
assert.deepEqual(recoveryVariants[0].dimensions, recoveryVariants[1].dimensions);
const recoveryReports = recoveryVariants.map(buildSleepPremiumFallback);
assert.equal(recoveryVariants[0].profile, recoveryVariants[1].profile);
assert.equal(recoveryReports[0].priority.area, "Osećaj po buđenju");
assert.equal(recoveryReports[1].priority.area, recoveryReports[0].priority.area);
assert.match(recoveryReports[0].connections[0].text, /Jutarnji osećaj i energija kasnije nisu isti/);
assert.match(recoveryReports[1].connections[0].text, /Jutro i energija tokom dana daju sličan utisak/);
assert.notEqual(recoveryReports[0].priority.explanation, recoveryReports[1].priority.explanation);
assert.match(recoveryReports[0].seven_day_plan[2].action, /Premesti pripremu stvari ranije/);
assert.match(recoveryReports[1].seven_day_plan[2].action, /Pripremi samo prvu stvar/);
const rhythmInput = buildSleepPremiumInput([5, 5, 5, 5, 3, 5, 5, 5, 2, 2, 5, 5]);
const rhythmReport = buildSleepPremiumFallback(rhythmInput);
assert.equal(rhythmReport.priority.area, "Vreme spavanja i buđenja");
assert.match(rhythmReport.seven_day_plan[1].action, /realan okvir za ustajanje/);
assert.match(rhythmReport.seven_day_plan[4].action, /večernji podsetnik/);
assert.match(rhythmReport.alternatives[0], /postojeće aktivnosti, umesto za sat/);

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

// Exact shapes prohibit structural overrides. Arbitrary prose can still contradict
// another sentence semantically: consistency is instructed, not guaranteed by keywords.
const mutateSupport = (mutate, field) => {
  const report = structuredClone(fallback);
  mutate(report.supporting_content);
  expectInvalid(report, field);
};
for (const key of ["profile", "seven_day_plan", "new_plan", "review_questions", "after_seven_days", "closing"]) {
  mutateSupport((support) => { support[key] = structuredClone(fallback[key] ?? []); }, "supporting_content");
}
for (const key of ["area", "title", "action", "observe", "explanation"]) {
  mutateSupport((support) => { support.priority[key] = "Drugi fokus."; }, "supporting_content.priority");
}
for (const key of ["action", "observe", "actions", "alternatives"]) {
  mutateSupport((support) => { support.days[0][key] = key === "actions" ? ["Drugi postupak."] : "Drugi postupak."; }, "supporting_content.days[0]");
}
for (const key of ["text", "action", "actions", "alternatives", "steps", "new_alternatives"]) {
  mutateSupport((support) => { support.alternatives[0][key] = ["Drugi pristup."]; }, "supporting_content.alternatives[0]");
}
for (const [section, key] of [["connections", "questionIds"], ["connections", "text"], ["tracking", "items"], ["tracking", "action"]]) {
  mutateSupport((support) => { support[section][0][key] = ["Druga stavka."]; }, `supporting_content.${section}[0]`);
}
for (const [key, anchor] of [["connections", "connectionIndex"], ["tracking", "itemIndex"], ["alternatives", "alternativeIndex"], ["days", "day"]]) {
  for (const value of [undefined, null, {}, "contexts", [], fallback.supporting_content[key].slice(0, -1), [...fallback.supporting_content[key], fallback.supporting_content[key][0]]]) {
    mutateSupport((support) => { support[key] = value; }, `supporting_content.${key}`);
  }
  const start = key === "days" ? 1 : 0;
  for (const value of [undefined, null, `${start}`, true, -1, 0.5, 99, start + 1]) {
    mutateSupport((support) => { support[key][0][anchor] = value; }, `supporting_content.${key}[0]`);
  }
  for (const value of [null, [], "context", {}]) {
    mutateSupport((support) => { support[key][0] = value; }, `supporting_content.${key}[0]`);
  }
  for (const property of Object.keys(fallback.supporting_content[key][0])) {
    mutateSupport((support) => { delete support[key][0][property]; }, `supporting_content.${key}[0]`);
  }
  mutateSupport((support) => { support[key][0].extra = true; }, `supporting_content.${key}[0]`);
  if (fallback.supporting_content[key].length > 1) {
    mutateSupport((support) => { [support[key][0], support[key][1]] = [support[key][1], support[key][0]]; }, `supporting_content.${key}[0]`);
    mutateSupport((support) => { support[key][1][anchor] = start; }, `supporting_content.${key}[1]`);
  } else {
    // Use a valid two-alternative fixture so reorder/duplicate tests reach anchors,
    // rather than failing only because the supporting count mismatches.
    for (const reorder of [true, false]) {
      const report = structuredClone(fallback);
      report.alternatives.push(report.alternatives[0]);
      matchSupportingCounts(report);
      expectValid(report);
      if (reorder) report.supporting_content[key].reverse();
      else report.supporting_content[key][1][anchor] = start;
      expectInvalid(report, `supporting_content.${key}[${reorder ? 0 : 1}]`);
    }
  }
}
for (const value of [undefined, null, [], "support", {}]) {
  const report = structuredClone(fallback);
  report.supporting_content = value;
  expectInvalid(report, "supporting_content");
}
for (const key of Object.keys(fallback.supporting_content)) {
  mutateSupport((support) => { delete support[key]; }, "supporting_content");
}
for (const value of [undefined, null, [], "priority", {}]) {
  mutateSupport((support) => { support.priority = value; }, "supporting_content.priority");
}
for (const key of ["context", "evidenceQuestionIds"]) {
  mutateSupport((support) => { delete support.priority[key]; }, "supporting_content.priority");
}
for (const ids of [undefined, null, "Q1", [], ["Q13"], ["unknown"], [1], ["Q1", "Q1"], [...input.answers.map(({ questionId }) => questionId), "Q1"]]) {
  mutateSupport((support) => { support.priority.evidenceQuestionIds = ids; }, "supporting_content.priority.evidenceQuestionIds");
}
for (const ids of [["Q1"], input.answers.map(({ questionId }) => questionId), ["Q12", "Q1"]]) {
  const report = structuredClone(fallback);
  report.supporting_content.priority.evidenceQuestionIds = ids;
  expectValid(report); // Priority references are a set, not a positional mapping.
}
for (const value of [undefined, null, {}, [], fallback.supporting_content.answer_evidence.slice(0, 11), [...fallback.supporting_content.answer_evidence, fallback.supporting_content.answer_evidence[0]]]) {
  mutateSupport((support) => { support.answer_evidence = value; }, "supporting_content.answer_evidence");
}
// All positions must match their original triple, not merely an allowed enum value.
for (let index = 0; index < 12; index += 1) {
  for (const key of ["questionId", "question", "answer"]) {
    const other = input.answers.find((entry) => entry[key] !== input.answers[index][key]);
    assert.ok(other, `a different canonical ${key} exists for the forgery test`);
    for (const value of [undefined, null, 7, {}, "forged", other[key]]) {
      mutateSupport((support) => { support.answer_evidence[index][key] = value; }, `supporting_content.answer_evidence[${index}]`);
    }
    mutateSupport((support) => { delete support.answer_evidence[index][key]; }, `supporting_content.answer_evidence[${index}]`);
  }
  mutateSupport((support) => { support.answer_evidence[index].mappedValue = 1; }, `supporting_content.answer_evidence[${index}]`);
}
mutateSupport((support) => { support.answer_evidence.reverse(); }, "supporting_content.answer_evidence[0]");
mutateSupport((support) => { support.answer_evidence[1] = structuredClone(support.answer_evidence[0]); }, "supporting_content.answer_evidence[1]");
for (const value of [null, [], {}, "answer"]) {
  mutateSupport((support) => { support.answer_evidence[0] = value; }, "supporting_content.answer_evidence[0]");
}
const nullReflections = structuredClone(fallback);
nullReflections.supporting_content.days.forEach((day) => { day.reflection = null; });
expectValid(nullReflections);
const mixedReflections = structuredClone(fallback);
mixedReflections.supporting_content.days.forEach((day, index) => { if (index % 2 === 0) day.reflection = null; });
expectValid(mixedReflections);
assertSupportingAnchors(nullReflections, input);

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
assert.match(onsetPlanFallback.seven_day_plan[1].action, /Ostavi telefon van dohvata/);
assert.match(onsetPlanFallback.seven_day_plan[4].action, /Ranije uveče.*obaveze/);
assert.notEqual(onsetPlanFallback.seven_day_plan[1].action, onsetPlanFallback.seven_day_plan[4].action);
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
matchSupportingCounts(relaxedReport);
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
// Exercise every prose slot at the allowed maximum counts, including contexts
// that are absent from the deliberately shorter relaxed acceptance fixture.
const supportingCopyFixture = structuredClone(relaxedReport);
supportingCopyFixture.connections = Array.from({ length: 4 }, () => structuredClone(relaxedReport.connections[0]));
supportingCopyFixture.stable_or_tracking.items = Array(3).fill(repeatedObservation);
matchSupportingCounts(supportingCopyFixture);
const supportingTextFields = [
  ["supporting_content.priority.context", 500, "supporting_content.priority"],
  ...supportingCopyFixture.supporting_content.connections.map((_, index) => [`supporting_content.connections.${index}.context`, 500, `supporting_content.connections[${index}]`]),
  ...supportingCopyFixture.supporting_content.tracking.map((_, index) => [`supporting_content.tracking.${index}.context`, 500, `supporting_content.tracking[${index}]`]),
  ...supportingCopyFixture.supporting_content.days.flatMap((_, index) => [
    [`supporting_content.days.${index}.rationale`, 250, `supporting_content.days[${index}]`],
    [`supporting_content.days.${index}.reflection`, 200, `supporting_content.days[${index}]`],
  ]),
  ...supportingCopyFixture.supporting_content.alternatives.map((_, index) => [`supporting_content.alternatives.${index}.context`, 500, `supporting_content.alternatives[${index}]`]),
];
const setField = (report, path, value, remove = false) => {
  const keys = path.split(".");
  const key = keys.pop();
  const parent = keys.reduce((current, part) => current[part], report);
  if (remove) delete parent[key];
  else parent[key] = value;
};
for (const [path] of supportingTextFields) setField(supportingCopyFixture, path, repeatedObservation);
for (const [path] of supportingTextFields) {
  const parentPath = path.split(".").slice(0, -1);
  if (parentPath.reduce((current, key) => current?.[key], relaxedReport)) setField(relaxedReport, path, repeatedObservation);
}
expectValid(supportingCopyFixture, onsetInput);
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
for (const [path, limit, diagnosticField] of [...textFields, ...supportingTextFields]) {
  const fixture = path.startsWith("supporting_content.") ? supportingCopyFixture : relaxedReport;
  for (const value of [undefined, null, 7, true, {}, [], "", " \n\t ", safeLengthText(limit + 1)]) {
    if (value === null && path.endsWith(".reflection")) continue; // Required key, nullable value.
    const report = structuredClone(fixture);
    setField(report, path, value, value === undefined);
    const missingField = !path.includes(".") ? "$"
      : path === "priority.explanation" ? "priority"
        : /^connections\.\d+\.text$/u.test(path) ? path.replace(/\.(\d+)\.text$/u, "[$1]")
          : diagnosticField;
    expectInvalid(report, value === undefined ? missingField : diagnosticField, onsetInput);
  }
  const atLimit = structuredClone(fixture);
  setField(atLimit, path, safeLengthText(limit));
  expectValid(atLimit, onsetInput);
  const safetyField = path.replace(/\.(\d+)/gu, "[$1]");
  for (const unsafe of ["Ovo uzrokuje loš san.", "Ovo potvrđuje nesanicu.", "Ovo će sigurno poboljšati san.", "scoring", "rezultat 42", "prag 42", "Q2"]) {
    const report = structuredClone(fixture);
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
      const report = structuredClone(fixture);
      setField(report, path, text);
      expectInvalid(report, safetyField, onsetInput);
      assert.equal(validateSleepPremiumReport(report, onsetInput).reason, "Report contains sensitive customer-facing content.");
    }
  }
  if (path.startsWith("supporting_content.")) {
    for (const [phrase, category] of retainedSafetyPhrases) {
      for (const text of [phrase, `„${phrase}“`, `"${phrase}"`]) {
        const report = structuredClone(fixture);
        setField(report, path, text);
        expectInvalid(report, safetyField, onsetInput);
        assert.equal(diagnoseSleepPremiumCustomerSafety(safetyField, text, onsetInput).category, category);
      }
    }
    for (const sentence of naturalPatternSentences) {
      const report = structuredClone(fixture);
      setField(report, path, sentence);
      expectValid(report, onsetInput);
    }
    const canonicalQuote = structuredClone(fixture);
    setField(canonicalQuote, path, `Tvoj odgovor „${stableAnswer}“ je lični kontekst.`);
    expectValid(canonicalQuote, onsetInput);
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
  ["stable_or_tracking.items", "stable_or_tracking.items", [null, {}, [], Array(4).fill(repeatedObservation)]],
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
  matchSupportingCounts(report);
  expectValid(report, onsetInput);
}
for (const count of [1, 2]) {
  const report = structuredClone(relaxedReport);
  report.stable_or_tracking.items = Array(count).fill(repeatedObservation);
  report.alternatives = Array(count).fill(repeatedObservation);
  matchSupportingCounts(report);
  expectValid(report, onsetInput);
}
const threeTrackingItems = structuredClone(relaxedReport);
threeTrackingItems.stable_or_tracking.items = Array(3).fill(repeatedObservation);
matchSupportingCounts(threeTrackingItems);
expectValid(threeTrackingItems, onsetInput);
expectInvalid(relaxedReport, "input.profile", { ...onsetInput, profile: "UNKNOWN" });
const trackingInput = buildSleepPremiumInput(personas[4]);
assert.equal(getSleepPremiumStrengthMode(trackingInput), "tracking");
const trackingReport = buildSleepPremiumFallback(trackingInput);
assert.equal(trackingReport.stable_or_tracking.title, "ŠTA JOŠ VREDI DA PRATIŠ");
for (const count of [1, 2, 3, 4]) {
  const report = structuredClone(trackingReport);
  report.stable_or_tracking.items = Array(count).fill(repeatedObservation);
  if (count <= 3) {
    matchSupportingCounts(report);
    expectValid(report, trackingInput);
  }
  else expectInvalid(report, "stable_or_tracking.items", trackingInput);
}
trackingReport.stable_or_tracking.items = ["Odvoji trenutak za šetnju i zabeleži utisak."];
matchSupportingCounts(trackingReport);
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
        assert.equal(request.max_output_tokens, branch === "premium-ai-staging" && previewFlag === "true" ? 8000 : 5000);
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
        configuredModel: "gpt-5-mini", max_output_tokens: 8000,
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
  nestedFailure.connections[2] = { questionIds: ["Q2", "Q6"], text: nestedRejectedText };
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
const usageEnv = Object.fromEntries(["RENDER_GIT_BRANCH", "ENABLE_PREMIUM_AI_PREVIEW"].map((key) => [key, process.env[key]]));
const originalConsoleLog = console.log;
try {
  const usageLogs = [];
  console.log = (...args) => usageLogs.push(args);
  const apiUsage = {
    input_tokens: 1234, output_tokens: 2345, total_tokens: 3579,
    input_tokens_details: { cached_tokens: 432, private: "never log this" },
    output_tokens_details: { reasoning_tokens: 765 },
    email: "private@example.test", api_key: "sk-test-placeholder",
  };
  const response = { status: "completed", output_text: JSON.stringify(fallback), usage: apiUsage, payment: "private payment data" };
  for (const [branch, flag] of [["premium-ai-staging", "true"], ["main", "true"], ["other", "true"], [undefined, "true"], ["premium-ai-staging", "false"]]) {
    if (branch === undefined) delete process.env.RENDER_GIT_BRANCH;
    else process.env.RENDER_GIT_BRANCH = branch;
    process.env.ENABLE_PREMIUM_AI_PREVIEW = flag;
    usageLogs.length = 0;
    const result = await generateSleepPremiumReport({ input, apiKeyAvailable: true, openaiClient: mockClient(response) });
    assert.equal(result.source, "ai");
    assert.equal(Object.hasOwn(result, "usage"), false, "usage diagnostics are server-only");
    assert.equal(usageLogs.length, branch === "premium-ai-staging" && flag === "true" ? 1 : 0);
    if (usageLogs.length) {
      assert.equal(usageLogs[0][0], "[PREMIUM_AI_USAGE]");
      assert.deepEqual(JSON.parse(usageLogs[0][1]), {
        model: "gpt-5-mini", input_tokens: 1234, output_tokens: 2345, total_tokens: 3579,
        cached_input_tokens: 432, reasoning_tokens: 765, response_status: "completed", source: "AI_GENERATED",
      });
      for (const privateText of [response.output_text, "private@example.test", "sk-test-placeholder", "private payment data", "never log this"]) {
        assert.equal(JSON.stringify(usageLogs).includes(privateText), false);
      }
    }
  }
  process.env.RENDER_GIT_BRANCH = "premium-ai-staging";
  process.env.ENABLE_PREMIUM_AI_PREVIEW = "true";
  for (const [apiResponse, expectedSource] of [
    [{ ...response, status: "incomplete", incomplete_details: { reason: "max_output_tokens" } }, "FALLBACK"],
    [{ ...response, output_text: "not JSON" }, "FALLBACK"],
    [{ ...response, output_text: JSON.stringify({ ...fallback, profile: "BUDAN UM" }) }, "FALLBACK"],
    [{ ...response, usage: undefined }, "AI_GENERATED"],
    [{ ...response, usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0, input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: 0 } } }, "AI_GENERATED"],
    [{ ...response, usage: { input_tokens: "private@example.test", output_tokens: -1, total_tokens: NaN } }, "AI_GENERATED"],
  ]) {
    usageLogs.length = 0;
    await generateSleepPremiumReport({ input, apiKeyAvailable: true, openaiClient: mockClient(apiResponse) });
    assert.equal(usageLogs.length, 1);
    const logged = JSON.parse(usageLogs[0][1]);
    assert.equal(logged.source, expectedSource);
    assert.equal(logged.input_tokens, Number.isSafeInteger(apiResponse.usage?.input_tokens) && apiResponse.usage.input_tokens >= 0 ? apiResponse.usage.input_tokens : null);
    assert.equal(JSON.stringify(logged).includes("private@example.test"), false);
    if (!apiResponse.usage) {
      assert.equal(logged.output_tokens, null);
      assert.equal(logged.total_tokens, null);
      assert.equal(Object.hasOwn(logged, "cached_input_tokens"), false);
      assert.equal(Object.hasOwn(logged, "reasoning_tokens"), false);
    }
  }
  for (const client of [
    { responses: { create: async () => { throw new Error("private network error"); } } },
    { responses: { create: () => new Promise(() => {}) } },
    undefined,
  ]) {
    usageLogs.length = 0;
    await generateSleepPremiumReport({ input, apiKeyAvailable: true, openaiClient: client, timeoutMs: 1 });
    assert.equal(usageLogs.length, 1);
    assert.deepEqual(JSON.parse(usageLogs[0][1]), {
      model: "gpt-5-mini", input_tokens: null, output_tokens: null, total_tokens: null,
      response_status: "unavailable", source: "FALLBACK",
    });
  }
  console.log = () => { throw new Error("Logger failed."); };
  const acceptedWithBrokenLogger = await generateSleepPremiumReport({ input, apiKeyAvailable: true, openaiClient: mockClient(response) });
  assert.equal(acceptedWithBrokenLogger.source, "ai", "logging cannot affect report acceptance");
} finally {
  console.log = originalConsoleLog;
  for (const [key, value] of Object.entries(usageEnv)) {
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
assert.deepEqual(preview.body.report, onsetPlanFallback, "accepted AI preview returns the exact validated content");
renderAcceptedHtml(preview.body.report, preview.body.source);

// One model response carries both concise mobile copy and supporting context.
// This verifies the future-PDF data contract, not a PDF renderer that does not exist.
const singleSourceAiFixture = structuredClone(onsetPlanFallback);
singleSourceAiFixture.profile_explanation = "Veče i misli su početak ovog kratkog plana.";
singleSourceAiFixture.priority.explanation = "Počni od prelaza u krevet i probaj jedan mali postupak.";
singleSourceAiFixture.seven_day_plan[1].action = "Ostavi telefon van dohvata pre kreveta; ostatak večeri ne menjaj.";
singleSourceAiFixture.seven_day_plan[1].observe = "Kako ti prija ovaj prelaz?";
singleSourceAiFixture.alternatives[0] = "Ako ti prvi korak ne odgovara, probaj pet minuta tihog čitanja van kreveta.";
singleSourceAiFixture.supporting_content.priority.context = "Dopunski osvrt ostaje uz isti prvi fokus i isti mali pokušaj.";
singleSourceAiFixture.supporting_content.days[1].rationale = "Jedan pokušaj ostavlja ostatak tvoje večeri nepromenjenim.";
singleSourceAiFixture.supporting_content.days[1].reflection = null;
singleSourceAiFixture.supporting_content.alternatives[0].context = "Čitanje je ponuđeno umesto prvog koraka, ne kao nova obaveza uz njega.";
expectValid(singleSourceAiFixture, onsetInput);
let singleSourceRequests = 0;
const singleSourcePreview = await generateSleepPremiumPreview({
  enabled: true,
  answers: personas[2],
  openaiClient: mockClient({ status: "completed", output_text: JSON.stringify(singleSourceAiFixture) }, (request) => {
    singleSourceRequests += 1;
    assert.deepEqual(request.text.format, buildSleepPremiumJsonSchema(onsetInput));
    assert.equal(request.input, onsetPrompt);
  }),
  apiKeyAvailable: true,
});
assert.equal(singleSourcePreview.status, 200);
assert.equal(singleSourcePreview.body.source, "ai", "custom copy must be accepted, not silently replaced by fallback");
const acceptedSingleReport = singleSourcePreview.body.report;
const singleReportBeforeRender = structuredClone(acceptedSingleReport);
const supportBeforeRender = acceptedSingleReport.supporting_content;
assert.deepEqual(acceptedSingleReport, singleSourceAiFixture);
assert.deepEqual(Object.keys(acceptedSingleReport), contractKeys, "one v2 object, with no second PDF report or plan");
assertSupportingAnchors(acceptedSingleReport, onsetInput);
assert.deepEqual(supportBeforeRender.answer_evidence, canonicalEvidence(onsetInput));
for (const field of ["profile", "profile_explanation", "priority", "connections", "stable_or_tracking", "seven_day_plan", "alternatives", "review_questions", "after_seven_days", "closing"]) {
  assert.deepEqual(acceptedSingleReport[field], singleSourceAiFixture[field], `single accepted ${field} is reused, not independently generated for PDF`);
}
renderAcceptedHtml(acceptedSingleReport, "ai");
renderAcceptedHtml(acceptedSingleReport, "ai");
assert.equal(singleSourceRequests, 1, "acceptance and repeated mobile rendering require exactly one model request, no PDF request");
assert.equal(acceptedSingleReport.supporting_content, supportBeforeRender, "mobile rendering retains the original support reference for future PDF use");
assert.deepEqual(acceptedSingleReport, singleReportBeforeRender, "rendering does not replace, trim or rewrite either concise or supporting copy");
assert.equal(runInNewContext("acceptedReport.supporting_content === testReport.supporting_content", htmlContext), true);
for (const key of ["pdf_report", "pdf_plan", "pdf_text"]) {
  const secondPdfObject = { ...acceptedSingleReport, [key]: structuredClone(singleSourceAiFixture) };
  expectInvalid(secondPdfObject, "$", onsetInput);
}

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
assert.deepEqual(malformedPreview.body.report, onsetPlanFallback, "fallback preview returns the same deterministic report");
renderAcceptedHtml(malformedPreview.body.report, malformedPreview.body.source);
for (const points of personas) {
  const expected = buildSleepPremiumFallback(buildSleepPremiumInput(points));
  for (const source of ["ai", "fallback"]) {
    const result = await generateSleepPremiumPreview({
      enabled: true, answers: points, apiKeyAvailable: source === "ai",
      openaiClient: mockClient({ status: "completed", output_text: JSON.stringify(expected) }),
    });
    assert.equal(result.status, 200);
    assert.equal(result.body.source, source);
    assert.deepEqual(result.body.report, expected);
    renderAcceptedHtml(result.body.report, source);
  }
}

console.log("Premium v2 six-section single-source prompt/schema, canonical supporting evidence/anchors, all supporting prose safety/privacy/limits, one-request AI/mobile reuse, six personas, same-score personalized fallback, accepted AI/fallback rendering, scoped mobile CSS, structural/safety diagnostics and staging preview passed.");
