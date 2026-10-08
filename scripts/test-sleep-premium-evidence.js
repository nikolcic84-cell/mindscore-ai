import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { buildSleepPremiumInput, SLEEP_PREMIUM_PROFILE_NAMES } from "../server/sleepPremiumInput.js";
import { buildSleepPremiumFacts } from "../server/sleepPremiumFacts.js";
import { loadSleepEvidenceLibrary, resolveSleepEvidenceCitation } from "../server/sleepEvidenceLibrary.js";
import { SLEEP_TECHNIQUES, getEligibleSleepTechniques } from "../server/sleepTechniqueLibrary.js";
import { retrieveSleepPremiumEvidence } from "../server/sleepPremiumEvidenceRetrieval.js";
import { buildSleepPremiumPreAiAnalysis } from "../server/sleepPremiumEditorialPlan.js";
import { selectSleepPremiumExplanationDevices } from "../server/sleepPremiumExplanationDevices.js";
import { buildSleepPremiumThemePlan } from "../server/sleepPremiumThemePlan.js";
import { getSleepPremiumPriority, getSleepPremiumStrengthMode } from "../server/sleepPremiumSchema.js";
import { calculateSleepSignature } from "../src/psychology/sleepSignature.js";
import { SLEEP_QUESTIONS, SLEEP_ANSWER_OPTIONS } from "../src/psychology/sleepAssessmentContent.js";
import { ANSWER_POINTS, formatSleepPremiumPreAiDebug } from "./debug-sleep-premium-pre-ai.js";

// Offline contract tests, not a medical review or verification of remote papers.
// Facts/retrieval/editorial results are fresh mutable values; only the registry,
// citations and technique results promise deep freezing. Invalid registries
// throw (fail closed); inactive/retired entries are valid, explained exclusions.
const library = loadSleepEvidenceLibrary();
const inputFor = (indexes = Array(12).fill(0)) => buildSleepPremiumInput(indexes.map((index) => 5 - index));
const indexesWith = (changes) => {
  const indexes = Array(12).fill(0);
  for (const [id, index] of Object.entries(changes)) indexes[Number(id.slice(1)) - 1] = index;
  return indexes;
};
const factsFor = (changes = {}) => buildSleepPremiumFacts(inputFor(indexesWith(changes)));
const analysisFor = (changes = {}, options) => buildSleepPremiumPreAiAnalysis(inputFor(indexesWith(changes)), options);
const adaptTechniques = (facts, ids) => getEligibleSleepTechniques({ ...facts, unknown: facts.unknown.map(({ id }) => id) }, ids);
const claimIds = (result) => result.claims.map(({ claim_id }) => claim_id);
const exclusion = (result, id) => {
  const entry = result.excluded.find((entry) => (entry.claim_id ?? entry.technique_id) === id);
  assert.ok(entry, `Expected exclusion for ${id}`);
  return entry;
};
const subset = (ids) => ({ ...structuredClone(library), claims: structuredClone(library.claims.filter(({ claim_id }) => ids.includes(claim_id))) });
const assertFrozen = (value) => {
  if (value === null || typeof value !== "object") return;
  assert.ok(Object.isFrozen(value));
  Object.values(value).forEach(assertFrozen);
};
const freeze = (value) => {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
const assertRefs = (ids, facts) => {
  assert.ok(Array.isArray(ids));
  assert.equal(new Set(ids).size, ids.length);
  const known = new Set(facts.facts.map(({ fact_id }) => fact_id));
  for (const id of ids) assert.ok(known.has(id), `Unsupported reference ${id}`);
};

// Independent expected qualifiers for every option, not copied from output.
const kinds = [
  ["positive", "positive", "context", "difficulty", "difficulty"],
  ["positive", "context", "difficulty", "difficulty", "difficulty"],
  ["positive", "context", "difficulty", "difficulty", "difficulty"],
  ["positive", "context", "difficulty", "difficulty", "difficulty"],
  ["context", "context", "context", "context", "difficulty"],
  ["positive", "positive", "context", "context", "context"],
  ["positive", "positive", "context", "context", "difficulty"],
  ["positive", "difficulty", "difficulty", "difficulty", "difficulty"],
  ["positive", "comparison_opportunity", "comparison_opportunity", "comparison_opportunity", "context"],
  ["positive", "positive", "context", "context", "context"],
  ["positive", "difficulty", "difficulty", "difficulty", "difficulty"],
  ["positive", "positive", "difficulty", "difficulty", "difficulty"],
];
const answerFrequency = [
  [null, "Uglavnom", null, null, null], [null, null, "Često", null, null],
  ["Uglavnom", null, null, null, "često"], Array(5).fill(null),
  [null, null, null, null, "često"], ["Uglavnom", null, null, "često", null],
  Array(5).fill(null), ["Uglavnom", "Povremeno", "Često", "Imam periode", "Veći deo dana"],
  [null, null, null, null, "stalno"], ["Skoro uvek", "Većinom", null, "Često", "Svaki dan"],
  ["uglavnom", null, null, null, null], [null, "Uglavnom", null, "Često", "redovno"],
];
const uncertainties = [
  [null, "bih mogao", null, null, "Kao da"], [null, null, null, null, "Imam osećaj"],
  [null, null, null, null, "deluje"], Array(5).fill(null), Array(5).fill(null),
  Array(5).fill(null), [null, null, null, null, "kao da"], [null, null, null, null, "osećam"],
  ["približno", null, null, "Mogao bih", null], [null, null, null, null, "može"],
  [null, null, null, null, "Imam osećaj"], [null, null, "bi mogao", "imam osećaj", null],
];
const questionFrequency = ["najčešće", "obično", "najčešće", null, "obično", null, null, null, null, null, null, null];
const scopes = ["morning_self_report", "after_lights_out", "within_night", "when_alarm_rings",
  "sleep_duration_not_time_in_bed", "last_30_minutes_before_sleep", "when_lying_down", "daytime_self_report",
  "conditional_free_day_without_alarm", "bedtime_and_wake_time_predictability", "conditional_day_after_poor_sleep", "recent_nights_self_report"];

// Semantic anchors catch swapped descriptions without locking final report prose.
const descriptionAnchors = [
  [/odmornost i spremnost/, /uglavnom.*još malo sna/, /ni odmornost ni poseban umor/, /umor i teško ustajanje/, /kao da nisi spavao/],
  [/vrlo brzo.*gašenju svetla/, /malo vremena/, /često.*dosta vremena/, /misli.*isključiš/, /osećaj borbe/],
  [/uglavnom.*bez buđenja/, /jedno buđenje.*brz nastavak/, /nekoliko buđenja/, /teško ponovo zaspiš/, /često deluje isprekidano/],
  [/bez problema.*alarm/, /nekoliko minuta/, /jedno odlaganje/, /više odlaganja/, /jedva nateraš/],
  [/7–9 sati/, /6–7 sati/, /5–6 sati/, /kraće od 5 sati/, /više od 9 sati.*čest izostanak/],
  [/uglavnom.*bez ekrana/, /mirnu večernju rutinu/, /TV-a ili nekog sadržaja/, /telefon često/, /skrolovanje.*potpuno pospan/],
  [/lako isključiš/, /malo razmišljanja.*smirivanje/, /događaje iz dana/, /planiranje, analiziranje.*problemima/, /umorno telo.*misli ne staju/],
  [/uglavnom stabilnu energiju/, /povremen osećaj umora/, /često.*kafa ili pauza/, /periode.*oči otvorene/, /većeg dela dana/],
  [/približno u isto vreme/, /malo duže spavanje/, /znatno duže spavanje/, /bi mogao ostati u krevetu pola dana/, /stalne promene/],
  [/skoro uvek slična/, /većinom.*isti ritam/, /nekoliko sati/, /često nemaš raspored/, /svakog dana može biti drugačiji/],
  [/loše.*malo promena.*uglavnom normalno/, /loše.*više umora/, /loše.*težu koncentraciju/, /loše.*umora.*raspoloženja/, /loše.*osećaj.*preguraš/],
  [/poslednje noći.*zadovoljstvo/, /poslednje noći.*uglavnom dobar.*poneku lošu/, /poslednje noći.*mogao biti bolji/, /poslednje noći.*čest osećaj.*nije dovoljan/, /poslednje noći.*redovno boriš/],
];

function expectedFlags(indexes) {
  const q = (number) => indexes[number - 1];
  return {
    short_sleep: [2, 3].includes(q(5)), morning_difficulty: q(1) >= 3,
    daytime_sleepiness: q(8) === 3, daytime_fatigue: [1, 2, 4].includes(q(8)),
    active_thoughts: q(7) >= 2 || q(2) === 3, onset_difficulty: q(2) >= 2,
    bedtime_content: q(6) >= 2, night_awakenings: q(3) >= 1, return_difficulty: q(3) === 3,
    variable_timing: q(10) >= 2 || q(9) === 4, alarm_difficulty: q(4) >= 2,
    longer_without_alarm: [1, 2, 3].includes(q(9)), overall_dissatisfaction: q(12) >= 2,
  };
}

for (let question = 0; question < 12; question += 1) {
  for (let option = 0; option < 5; option += 1) {
    test(`canonical Q${question + 1} option ${option}: source, qualifiers, flags and no interpretation`, () => {
      const indexes = Array(12).fill(0);
      indexes[question] = option;
      const input = freeze(inputFor(indexes));
      const before = structuredClone(input);
      const result = buildSleepPremiumFacts(input);
      assert.equal(result.facts.length, 12);
      assert.deepEqual(result.facts.map(({ fact_id }) => fact_id), Array.from({ length: 12 }, (_, i) => `FACT_Q${i + 1}`));
      const fact = result.facts[question];
      assert.equal(fact.questionId, `Q${question + 1}`);
      assert.equal(fact.question, SLEEP_QUESTIONS[question]);
      assert.equal(fact.selected_answer, SLEEP_ANSWER_OPTIONS[question][option].text);
      assert.equal(fact.selected_option_index, option);
      assert.equal(fact.kind, kinds[question][option]);
      assert.deepEqual(fact.frequency, { question: questionFrequency[question], answer: answerFrequency[question][option] });
      assert.equal(fact.uncertainty, uncertainties[question][option]);
      assert.deepEqual(fact.qualifiers, [scopes[question]]);
      assert.deepEqual(fact.interpretation_candidates, []);
      assert.ok(fact.description.trim());
      assert.match(fact.description, new RegExp(descriptionAnchors[question][option]));
      assert.ok(fact.not_supported.includes("uzrok opisanog iskustva"));
      if (fact.frequency.answer) assert.ok(fact.selected_answer.includes(fact.frequency.answer));
      if (fact.uncertainty) assert.ok(fact.selected_answer.includes(fact.uncertainty));
      assert.deepEqual(result.flags, expectedFlags(indexes));
      assert.deepEqual(input, before);
      assert.equal(Object.hasOwn(result, "profile"), false);
      assert.equal(Object.hasOwn(result, "dimensions"), false);
    });
  }
}

test("canonical facts reject incomplete, sparse, duplicate, forged and accessor-based evidence", () => {
  const canonical = () => structuredClone(inputFor());
  for (const bad of [null, [], {}, { answers: [] }, { answers: Array(12) }]) {
    assert.throws(() => buildSleepPremiumFacts(bad), TypeError);
  }
  const mutations = [
    (input) => input.answers.pop(),
    (input) => { input.answers[1] = input.answers[0]; },
    (input) => { input.answers[0].questionId = "Q13"; },
    (input) => { input.answers[0].questionId = "q1"; },
    (input) => { input.answers[0].question += " "; },
    (input) => { input.answers[0].answer += " "; },
    (input) => { input.answers[0].answer = input.answers[1].answer; },
    (input) => { input.answers[0].history = "invented"; },
    (input) => { input.answers[0][Symbol("hidden")] = true; },
    (input) => { delete input.answers[0]; },
    (input) => { input.answers[0] = Object.create(input.answers[0]); },
  ];
  for (const mutate of mutations) {
    const input = canonical();
    mutate(input);
    assert.throws(() => buildSleepPremiumFacts(input), TypeError);
  }
  let reads = 0;
  for (const key of ["questionId", "question", "answer"]) {
    const input = canonical();
    Object.defineProperty(input.answers[0], key, { get() { reads += 1; throw new Error("Getter executed"); } });
    assert.throws(() => buildSleepPremiumFacts(input), TypeError);
  }
  assert.throws(() => buildSleepPremiumFacts({ get answers() { reads += 1; return canonical().answers; } }), TypeError);
  assert.equal(reads, 0);
});

test("facts ignore metadata/history and mapped scores, sort references and return isolated fresh values", () => {
  const input = inputFor();
  const expected = buildSleepPremiumFacts(input);
  input.answers.reverse();
  input.answers.forEach((answer) => { answer.mappedValue = -999; });
  for (const field of ["profile", "dimensions", "medical_history", "age"]) {
    Object.defineProperty(input, field, { get() { throw new Error("Unsupported metadata read"); }, configurable: true });
  }
  const actual = buildSleepPremiumFacts(input);
  assert.deepEqual(actual, expected);
  assert.deepEqual(actual.unknown.map(({ id }) => id), ["age", "symptom_duration", "breathing_symptoms", "medication",
    "medical_history", "driving_impairment", "exact_sleep_wake_times", "shift_work", "bedroom_conditions",
    "actual_sleep_opportunity", "co_occurrence_same_days"]);
  actual.facts[0].qualifiers.push("invented");
  actual.facts[0].frequency.answer = "invented";
  actual.unknown[0].label = "invented";
  actual.flags.short_sleep = true;
  assert.deepEqual(buildSleepPremiumFacts(input), expected);
});

test("Q5 is reported duration, Q11 is conditional, Q9 hypothetical is not observed recovery", () => {
  const facts = factsFor({ Q5: 3, Q11: 4, Q9: 3, Q8: 2 });
  const byId = (id) => facts.facts.find(({ questionId }) => questionId === id);
  assert.ok(byId("Q5").not_supported.includes("kratka prilika za spavanje"));
  assert.ok(byId("Q5").not_supported.includes("vreme provedeno u krevetu"));
  assert.equal(byId("Q11").frequency.question, null);
  assert.equal(byId("Q11").frequency.answer, null);
  assert.ok(byId("Q11").not_supported.includes("učestalost loših noći"));
  assert.ok(byId("Q11").not_supported.includes("iste posledice posle svake noći"));
  assert.equal(byId("Q9").uncertainty, "Mogao bih");
  assert.equal(byId("Q9").kind, "comparison_opportunity");
  assert.match(byId("Q9").description, /bi mogao ostati u krevetu/);
  assert.ok(byId("Q9").not_supported.includes("dug sna"));
  assert.equal(facts.flags.daytime_fatigue, true);
  assert.equal(facts.flags.daytime_sleepiness, false);
  assert.ok(byId("Q8").not_supported.includes("količina, vreme ili stvarni unos kofeina"));
});

const sourceExpectations = {
  AASM_INSOMNIA_2021: ["10.5664/jcsm.8986", 2021, "33164742"],
  AASM_SRS_DURATION_2015: ["10.5664/jcsm.4758", 2015, "25979105"],
  SCULLIN_WRITING_2018: ["10.1037/xge0000374", 2018, "29058942"],
  BORBELY_TWO_PROCESS_2016: ["10.1111/jsr.12371", 2016, "26762182"],
  CARNEY_DIARY_2012: ["10.5665/sleep.1642", 2012, "PMC3250369"],
  NHLBI_HABITS_2022: [null, 2022, "/health/sleep-deprivation/healthy-sleep-habits"],
};
const claimSources = {
  CBTI_STRONG: "AASM_INSOMNIA_2021", STIMULUS_CONTROL_CONDITIONAL: "AASM_INSOMNIA_2021",
  RELAXATION_CONDITIONAL: "AASM_INSOMNIA_2021", HYGIENE_NOT_STANDALONE: "AASM_INSOMNIA_2021",
  ADULT_SLEEP_7H: "AASM_SRS_DURATION_2015", SLEEP_MULTIDIMENSIONAL: "AASM_SRS_DURATION_2015",
  LONG_SLEEP_CONTEXT: "AASM_SRS_DURATION_2015", TODO_WRITING_LAB: "SCULLIN_WRITING_2018",
  TODO_SPECIFICITY_ASSOCIATION: "SCULLIN_WRITING_2018", TWO_PROCESS_MODEL: "BORBELY_TWO_PROCESS_2016",
  DIARY_CORE_OBSERVATION: "CARNEY_DIARY_2012", DIARY_VALIDATION_BOUNDARY: "CARNEY_DIARY_2012",
  QUIET_PREBED_GUIDANCE: "NHLBI_HABITS_2022", REGULAR_TIMES_GUIDANCE: "NHLBI_HABITS_2022",
};

test("registry has 14 canonical claims, six verifiable source records and pending clinical review", () => {
  assert.equal(library.claims.length, 14);
  assert.equal(library.sources.length, 6);
  assert.deepEqual(library, JSON.parse(readFileSync(new URL("../server/data-independent-content/sleep-evidence.v1.json", import.meta.url), "utf8")));
  assert.strictEqual(loadSleepEvidenceLibrary(), library);
  assertFrozen(library);
  assert.equal(library.release_status, "clinical_review_pending");
  assert.deepEqual(library.sources.map(({ source_id }) => source_id).sort(), Object.keys(sourceExpectations).sort());
  assert.deepEqual(library.claims.map(({ claim_id }) => claim_id).sort(), Object.keys(claimSources).sort());
  for (const source of library.sources) {
    const [doi, year, location] = sourceExpectations[source.source_id];
    assert.equal(source.doi, doi);
    assert.equal(source.year, year);
    assert.ok(source.verified_url.includes(location));
    if (doi) assert.equal(source.url, `https://doi.org/${doi}`);
    assert.equal(new URL(source.url).protocol, "https:");
    assert.equal(new URL(source.verified_url).protocol, "https:");
    assert.ok(source.authors.length || source.organization);
    for (const field of ["title", "support_location", "verification_excerpt", "verification_method"]) assert.ok(source[field].trim());
    assert.equal(source.verified_at, "2026-10-09");
    assert.equal(source.review_status, "source_verified_clinical_review_pending");
  }
  for (const claim of library.claims) {
    assert.deepEqual(claim.source_ids, [claimSources[claim.claim_id]]);
    assert.equal(claim.status, "active");
    assert.equal(claim.release_status, "clinical_review_pending");
    assert.equal(claim.reviewmetadata.clinical_review_status, "pending");
    assert.equal(claim.reviewmetadata.clinician, null);
    assert.equal(claim.reviewmetadata.clinically_reviewed_at, null);
    assert.ok(claim.reviewmetadata.support_location);
    assert.ok(claim.exclusions.length && claim.limitations.length && claim.does_not_establish.length);
    const citation = resolveSleepEvidenceCitation(claim.claim_id);
    assertFrozen(citation);
    assert.equal(citation.evidence_id, claim.evidence_id);
    assert.equal(citation.revision, claim.revision);
    assert.equal(citation.approved_claim, claim.approved_claim);
    assert.deepEqual(citation.sources, claim.source_ids.map((id) => library.sources.find(({ source_id }) => source_id === id)));
  }
});

test("citation resolution rejects unknown claim/source/evidence IDs and copies caller registries", () => {
  for (const id of ["UNKNOWN", library.sources[0].source_id, library.claims[0].evidence_id]) {
    assert.throws(() => resolveSleepEvidenceCitation(id), RangeError);
  }
  for (const id of [null, "", " ", 123]) assert.throws(() => resolveSleepEvidenceCitation(id), TypeError);
  const supplied = structuredClone(library);
  const before = structuredClone(supplied);
  const citation = resolveSleepEvidenceCitation("TODO_WRITING_LAB", supplied);
  assert.deepEqual(supplied, before);
  assert.equal(Object.isFrozen(supplied.sources[0]), false);
  supplied.sources.find(({ source_id }) => source_id === "SCULLIN_WRITING_2018").title = "changed";
  assert.notEqual(citation.sources[0].title, "changed");
  assert.throws(() => { citation.sources[0].title = "changed"; }, TypeError);
  const writing = library.claims.find(({ claim_id }) => claim_id === "TODO_WRITING_LAB");
  assert.equal(writing.strength, "limited_single_study");
  assert.ok(writing.does_not_establish.includes("Benefit versus doing no writing"));
  assert.ok(writing.limitations.includes("57 participants aged 18–30."));
  assert.equal(library.claims.find(({ claim_id }) => claim_id === "TODO_SPECIFICITY_ASSOCIATION").evidence_type, "within_study_association");
});

test("retrieval is deterministic, bounded, nonredundant and detached without mutating frozen input", () => {
  const facts = freeze(factsFor({ Q1: 3, Q2: 3, Q3: 3, Q5: 3, Q6: 3, Q7: 4, Q9: 2, Q10: 3 }));
  const before = structuredClone(facts);
  const first = retrieveSleepPremiumEvidence(facts);
  assert.deepEqual(first, retrieveSleepPremiumEvidence(facts));
  assert.equal(first.claims.length, 4);
  assert.equal(first.release_allowed, false);
  assert.deepEqual(facts, before);
  for (let maxClaims = 0; maxClaims <= 4; maxClaims += 1) {
    const result = retrieveSleepPremiumEvidence(facts, { maxClaims });
    assert.equal(result.claims.length, maxClaims);
    assert.deepEqual(claimIds(result), claimIds(first).slice(0, maxClaims));
    assert.equal(result.claims.length + result.excluded.length, library.claims.length);
    assert.equal(new Set([...claimIds(result), ...result.excluded.map(({ claim_id }) => claim_id)]).size, 14);
  }
  for (const maxClaims of [-1, 5, 1.5, NaN, Infinity, "4", null]) {
    assert.throws(() => retrieveSleepPremiumEvidence(facts, { maxClaims }), RangeError);
  }
  for (let a = 0; a < first.claims.length; a += 1) {
    const claim = first.claims[a];
    assertRefs(claim.fact_ids, facts);
    assert.ok(claim.fact_ids.length && claim.matched_signals.length);
    assert.equal(claim.release_allowed, false);
    assert.equal(claim.reviewmetadata.clinical_review_status, "pending");
    assert.deepEqual(claim.sources, resolveSleepEvidenceCitation(claim.claim_id).sources);
    for (const signal of claim.matched_signals) assert.equal(facts.flags[signal], true);
    for (const other of first.claims.slice(a + 1)) {
      assert.notEqual(claim.redundancy_family, other.redundancy_family);
      assert.equal(claim.source_ids.some((id) => other.source_ids.includes(id)) && claim.topic_ids.some((id) => other.topic_ids.includes(id)), false);
    }
  }
  first.claims[0].sources[0].title = "mutated";
  first.claims[0].fact_ids.push("FAKE");
  const clean = retrieveSleepPremiumEvidence(facts);
  assert.equal(clean.claims.some(({ fact_ids }) => fact_ids.includes("FAKE")), false);
  assert.notEqual(retrieveSleepPremiumEvidence(facts).claims[0].sources[0].title, "mutated");
  const reversed = structuredClone(library);
  reversed.claims.reverse();
  reversed.sources.reverse();
  const selected = retrieveSleepPremiumEvidence(facts, { library: reversed });
  assert.deepEqual(selected.claims, retrieveSleepPremiumEvidence(facts).claims);
});

test("retrieval known flags require own strict booleans and unknown markers override them", () => {
  for (const alter of [
    (facts) => { delete facts.flags.active_thoughts; },
    (facts) => { facts.flags.active_thoughts = "true"; },
    (facts) => { facts.flags.active_thoughts = 1; },
    (facts) => { facts.flags = Object.create({ active_thoughts: true }); },
    (facts) => { facts.unknown.push({ id: "active_thoughts" }); },
    (facts) => { facts.unknown.push("flags.active_thoughts"); },
  ]) {
    const facts = factsFor({ Q7: 3 });
    alter(facts);
    const result = retrieveSleepPremiumEvidence(facts, { library: subset(["TODO_WRITING_LAB"]) });
    assert.deepEqual(result.claims, []);
    assert.ok(exclusion(result, "TODO_WRITING_LAB").reasons.includes("registry_predicates_not_met_or_unknown"));
  }
  for (const facts of [null, {}, { facts: [], flags: [], unknown: [] }, { facts: [], flags: {} }]) {
    assert.throws(() => retrieveSleepPremiumEvidence(facts), TypeError);
  }
});

test("retired/inactive sources and claims exclude safely; malformed registries fail closed", () => {
  const facts = factsFor({ Q7: 3 });
  for (const status of ["inactive", "retired"]) {
    const registry = subset(["TODO_WRITING_LAB"]);
    registry.claims[0].status = status;
    assert.deepEqual(retrieveSleepPremiumEvidence(facts, { library: registry }).excluded,
      [{ claim_id: "TODO_WRITING_LAB", reasons: ["inactive_claim"] }]);
    registry.claims[0].status = "active";
    registry.sources.find(({ source_id }) => source_id === "SCULLIN_WRITING_2018").status = status;
    const result = retrieveSleepPremiumEvidence(facts, { library: registry });
    assert.deepEqual(result.claims, []);
    assert.ok(exclusion(result, "TODO_WRITING_LAB").reasons.includes("inactive_or_retired_source"));
  }
  const corruptions = [
    (registry) => { registry.claims[0].source_ids = ["MISSING_SOURCE"]; },
    (registry) => { registry.sources = registry.sources.filter(({ source_id }) => source_id !== "SCULLIN_WRITING_2018"); },
    (registry) => { registry.claims[0].applicability.all = [{ flag: "invented", equals: true }]; },
    (registry) => { registry.claims[0].applicability.all = [{ flag: "active_thoughts", equals: "true" }]; },
    (registry) => { registry.claims[0].applicability.all = [{ flag: "active_thoughts", equals: true, extra: true }]; },
    (registry) => { registry.claims[0].applicability.all.push(registry.claims[0].applicability.all[0]); },
    (registry) => { registry.sources[0].doi = "10.1234/forged"; },
    (registry) => { registry.sources[0].verified_url = "http://example.invalid"; },
    (registry) => { registry.claims[0].reviewmetadata.clinical_review_status = "approved"; },
  ];
  for (const corrupt of corruptions) {
    const registry = subset(["TODO_WRITING_LAB"]);
    corrupt(registry);
    const before = structuredClone(registry);
    assert.throws(() => retrieveSleepPremiumEvidence(facts, { library: registry }), TypeError);
    assert.deepEqual(registry, before);
  }
  for (const registry of [null, {}, { claims: [], sources: null }]) {
    assert.throws(() => retrieveSleepPremiumEvidence(facts, { library: registry }), TypeError);
  }
});

test("empty registry, no eligible claims and zero budget produce complete observation-only pipelines", () => {
  for (const options of [
    { library: { claims: [], sources: [] } }, { maxClaims: 0 },
    { library: { ...structuredClone(library), claims: library.claims.map((claim) => ({ ...structuredClone(claim), status: "inactive" })) } },
  ]) {
    const result = analysisFor({ Q2: 3, Q3: 3, Q5: 3, Q7: 4 }, options);
    assert.deepEqual(result.retrieval.claims, []);
    assert.deepEqual(result.techniques.eligible, []);
    assert.deepEqual(result.editorial_plan.science_moments, []);
    assert.deepEqual(result.editorial_plan.explanation_devices, []);
    assert.equal(result.editorial_plan.experiment.length, 7);
    for (const day of result.editorial_plan.experiment) {
      assert.equal(day.technique_id, null);
      assert.equal(day.mode, "observation_fallback");
      assert.ok(day.fallback_reason);
      assert.equal(day.release_allowed, false);
    }
    assert.equal(result.release_allowed, false);
  }
});

test("all-positive selections preserve positives without inventing a problem, research or twist", () => {
  const result = analysisFor();
  assert.equal(result.profile, "MIRNA NOĆ");
  assert.deepEqual(result.retrieval.claims, []);
  assert.deepEqual(result.editorial_plan.main_story.aspects, []);
  assert.equal(result.editorial_plan.twist, null);
  assert.deepEqual(result.editorial_plan.contrasts, []);
  assert.deepEqual(result.editorial_plan.explanation_devices, []);
  assert.deepEqual(result.editorial_plan.supported_positive,
    result.facts.facts.filter(({ kind }) => kind === "positive"));
  assert.equal(result.editorial_plan.supported_positive.length, 11); // Q5 is duration context, not a health endorsement.
  assert.equal(Object.values(result.facts.flags).some(Boolean), false);
  assert.equal(result.theme_plan.theme_map.some(({ focusQuestionIds }) => focusQuestionIds.length), false);
});

test("clinical claims remain excluded; absent age/history markers never authorize treatment", () => {
  const clinical = ["CBTI_STRONG", "STIMULUS_CONTROL_CONDITIONAL", "RELAXATION_CONDITIONAL"];
  for (const clearUnknown of [false, true]) {
    const facts = factsFor({ Q2: 3, Q3: 3, Q7: 4, Q12: 4 });
    if (clearUnknown) facts.unknown = [];
    facts.age = 30;
    facts.assessment = { age: 30, symptom_duration: "years", medical_history: "clear", clinical_clearance: true };
    const result = retrieveSleepPremiumEvidence(facts, { library: subset(clinical) });
    assert.deepEqual(result.claims, []);
    for (const id of clinical) {
      const reasons = exclusion(result, id).reasons;
      assert.ok(reasons.includes("clinical_assessment_not_established"));
      if (!clearUnknown) {
        assert.ok(reasons.includes("unknown_prerequisite:age"));
        assert.ok(reasons.includes("unknown_prerequisite:medical_history"));
        assert.ok(reasons.includes("unknown_prerequisite:actual_sleep_opportunity"));
      }
    }
  }
  const registry = subset(clinical);
  registry.claims.forEach((claim) => { claim.education_only = true; });
  const result = retrieveSleepPremiumEvidence(factsFor({ Q2: 3, Q3: 3, Q7: 4 }), { library: registry });
  assert.ok(result.claims.length);
  for (const claim of result.claims) {
    assert.equal(claim.action_eligible, false);
    assert.equal(claim.release_allowed, false);
    assert.ok(claim.applicability_restrictions.some((text) => text.includes("Education only")));
  }
  const duration = retrieveSleepPremiumEvidence(factsFor({ Q5: 3 }), { library: subset(["ADULT_SLEEP_7H"]) }).claims[0];
  assert.ok(duration.applicability_restrictions.some((text) => text.includes("Age is not established")));
});

test("technique inventory is deeply frozen, pending, evidence-linked and contains no sleep restriction", () => {
  assertFrozen(SLEEP_TECHNIQUES);
  assert.deepEqual(SLEEP_TECHNIQUES.map(({ technique_id }) => technique_id), ["SELF_OBSERVATION", "COGNITIVE_OFFLOAD",
    "WIND_DOWN", "WAKE_REGULARITY", "RELAXATION", "STIMULUS_CONTROL_EDUCATION"]);
  for (const technique of SLEEP_TECHNIQUES) {
    assert.equal(technique.release_allowed, false);
    assert.equal(technique.reviewmetadata.clinical_review_status, "pending");
    assert.equal(technique.reviewmetadata.clinician, null);
    assert.equal(technique.reviewmetadata.clinically_reviewed_at, null);
    for (const id of technique.claim_ids) assert.ok(Object.hasOwn(claimSources, id));
    assert.ok(technique.no_promises.length && technique.escalation.length);
    if (technique.mode === "clinical_education_only") {
      assert.equal(technique.action_eligible, false);
      assert.deepEqual(technique.approved_actions, []);
    }
  }
  const facts = freeze(factsFor({ Q2: 3, Q3: 3, Q6: 3, Q7: 4, Q10: 3 }));
  const selected = retrieveSleepPremiumEvidence(facts);
  const result = adaptTechniques(facts, claimIds(selected));
  assertFrozen(result);
  for (const technique of result.eligible) {
    for (const id of technique.claim_ids) assert.ok(claimIds(selected).includes(id));
    assert.equal(technique.action_eligible, true);
    assert.deepEqual(technique.reasons, []);
  }
  assert.deepEqual(adaptTechniques(facts, []).eligible, []);
  assert.throws(() => adaptTechniques(facts, ["UNKNOWN"]), TypeError);
  assert.throws(() => getEligibleSleepTechniques(facts, []), TypeError); // Explicit unknown-object adapter required.
});

test("techniques require primary evidence while redundant contextual claims cannot deadlock eligibility", () => {
  const facts = factsFor({ Q6: 3, Q7: 3 });
  const primary = adaptTechniques(facts, ["DIARY_CORE_OBSERVATION", "QUIET_PREBED_GUIDANCE"]);
  assert.deepEqual(primary.eligible.map(({ technique_id }) => technique_id), ["SELF_OBSERVATION", "WIND_DOWN"]);
  const missing = adaptTechniques(facts, ["DIARY_VALIDATION_BOUNDARY", "HYGIENE_NOT_STANDALONE"]);
  for (const [id, claim] of [["SELF_OBSERVATION", "DIARY_CORE_OBSERVATION"], ["WIND_DOWN", "QUIET_PREBED_GUIDANCE"]]) {
    const entry = exclusion(missing, id);
    assert.ok(entry.reasons.includes("linked_evidence_not_returned"));
    assert.ok(entry.missing_claim_ids.includes(claim));
  }
  const offload = adaptTechniques(facts, ["TODO_WRITING_LAB"]);
  assert.deepEqual(offload.eligible.map(({ technique_id }) => technique_id), ["COGNITIVE_OFFLOAD"]);
  const unknown = { ...facts, unknown: ["flags.active_thoughts"] };
  const blocked = getEligibleSleepTechniques(unknown, ["TODO_WRITING_LAB"]);
  assert.ok(exclusion(blocked, "COGNITIVE_OFFLOAD").missing_prerequisites.includes("flags.active_thoughts"));
});

test("wake regularity excludes short sleep, sleepiness and unknown flags; clinical prerequisites cannot be cleared", () => {
  const allowed = adaptTechniques(factsFor({ Q10: 3 }), ["REGULAR_TIMES_GUIDANCE"]);
  assert.deepEqual(allowed.eligible.map(({ technique_id }) => technique_id), ["WAKE_REGULARITY"]);
  for (const changes of [{ Q10: 3, Q5: 2 }, { Q10: 3, Q5: 3 }, { Q10: 3, Q8: 3 }]) {
    assert.equal(adaptTechniques(factsFor(changes), ["REGULAR_TIMES_GUIDANCE"]).eligible.some(({ technique_id }) => technique_id === "WAKE_REGULARITY"), false);
  }
  const facts = factsFor({ Q10: 3 });
  delete facts.flags.daytime_sleepiness;
  assert.ok(exclusion(adaptTechniques(facts, ["REGULAR_TIMES_GUIDANCE"]), "WAKE_REGULARITY").missing_prerequisites.includes("flags.daytime_sleepiness"));
  for (const unknown of [[], new Set(), { age: false, medical_history: false }]) {
    const result = getEligibleSleepTechniques({ flags: { active_thoughts: true, onset_difficulty: true }, unknown,
      assessment: { age: 30, relevant_clinical_history: "clear", mobility_safety: true } }, ["RELAXATION_CONDITIONAL", "STIMULUS_CONTROL_CONDITIONAL"]);
    assert.deepEqual(result.eligible, []);
    for (const id of ["RELAXATION", "STIMULUS_CONTROL_EDUCATION"]) {
      const entry = exclusion(result, id);
      assert.ok(entry.reasons.includes("education_only_not_action_eligible"));
      assert.ok(entry.missing_prerequisites.includes("assessment.age"));
      assert.ok(entry.missing_prerequisites.includes("assessment.relevant_clinical_history"));
    }
  }
});

const contrastCases = [
  ["duration_morning_free_day", { Q5: 3, Q1: 3, Q9: 3 }, ["FACT_Q5", "FACT_Q1", "FACT_Q9"]],
  ["easy_onset_difficult_return", { Q3: 3 }, ["FACT_Q2", "FACT_Q3"]],
  ["calm_routine_active_thoughts", { Q6: 1, Q7: 3 }, ["FACT_Q6", "FACT_Q7", "FACT_Q2"]],
  ["variable_timing_reported_duration", { Q10: 3 }, ["FACT_Q10", "FACT_Q9", "FACT_Q5"]],
  ["awakening_and_tiredness", { Q3: 2, Q1: 3, Q8: 1 }, ["FACT_Q3", "FACT_Q1", "FACT_Q8"]],
];
for (const [id, changes, expected] of contrastCases) {
  test(`cross-answer contrast ${id} has exact supported fact IDs and explicit noncausal boundaries`, () => {
    const analysis = analysisFor(changes);
    const contrast = analysis.editorial_plan.contrasts.find(({ contrast_id }) => contrast_id === id);
    assert.ok(contrast);
    assert.deepEqual(contrast.fact_ids, expected);
    assertRefs(contrast.fact_ids, analysis.facts);
    assert.deepEqual(contrast.unknown_ids, ["co_occurrence_same_days"]);
    assert.ok(contrast.does_not_establish.length >= 3);
    assert.ok(contrast.open_question.endsWith("?"));
    for (const factId of expected) {
      assert.ok(contrast.observation.includes(analysis.facts.facts.find(({ fact_id }) => fact_id === factId).description));
    }
    assert.equal(analysis.release_allowed, false);
  });
}

test("short sleep, hard mornings and hypothetical alarm-free time never become debt or causal claims", () => {
  const result = analysisFor({ Q5: 3, Q1: 3, Q9: 3 });
  const contrast = result.editorial_plan.contrasts.find(({ contrast_id }) => contrast_id === "duration_morning_free_day");
  for (const forbidden of ["Dug sna", "Kratka prilika za spavanje", "Stvarno duže spavanje kada je odgovor hipotetičan", "Uzrok jutarnjeg umora"]) {
    assert.ok(contrast.does_not_establish.includes(forbidden));
  }
  for (const text of ["Dug sna iz dužeg spavanja bez alarma", "Povezanost ili zajedničko navođenje dokazuje uzrok",
    "Restrikcija sna, raniji alarm koji skraćuje san ili precizna doza svetla", "Neprijavljeni uzrast, smene, navike ili istorija",
    "Izvor je klinički pregledan ili spreman za objavljivanje"]) assert.ok(result.prohibited_conclusions.includes(text));
  const prose = [result.editorial_plan.main_story.text, ...result.editorial_plan.contrasts.map(({ explanation }) => explanation)].join(" ");
  assert.doesNotMatch(prose, /uzrokuje|dovodi do|dokazuje da|garantuje/iu);
});

test("devices require matching facts AND retrieved concepts, are hypothetical and capped at two", () => {
  const cases = [
    ["journey_interruption", { Q5: 3, Q3: 2 }, "SLEEP_MULTIDIMENSIONAL", ["FACT_Q3", "FACT_Q5"]],
    ["unfinished_tasks", { Q2: 3, Q7: 4 }, "TODO_WRITING_LAB", ["FACT_Q2", "FACT_Q7"]],
    ["timing", { Q10: 3 }, "REGULAR_TIMES_GUIDANCE", ["FACT_Q9", "FACT_Q10"]],
    ["one_variable_comparison", { Q3: 2, Q1: 3 }, "SLEEP_MULTIDIMENSIONAL", ["FACT_Q1", "FACT_Q3", "FACT_Q8"]],
  ];
  for (const [id, changes, claim, refs] of cases) {
    const facts = freeze(factsFor(changes));
    const claims = retrieveSleepPremiumEvidence(facts, { library: subset([claim]) }).claims;
    assert.equal(claims.length, 1);
    const devices = selectSleepPremiumExplanationDevices(facts, claims);
    assert.deepEqual(devices.map(({ device_id }) => device_id), [id]);
    assert.deepEqual(devices[0].fact_ids, refs);
    assert.ok(devices[0].does_not_imply.length >= 2);
    assert.match(devices[0].explanation, /zamišljen|Zamisli/);
    assert.deepEqual(selectSleepPremiumExplanationDevices(facts, []), []);
    assert.deepEqual(selectSleepPremiumExplanationDevices(factsFor(), claims), []);
  }
  const facts = factsFor({ Q5: 3, Q3: 2, Q2: 3, Q7: 4, Q10: 3 });
  const claims = ["SLEEP_MULTIDIMENSIONAL", "TODO_WRITING_LAB", "REGULAR_TIMES_GUIDANCE"].map((id) => resolveSleepEvidenceCitation(id));
  const devices = selectSleepPremiumExplanationDevices(facts, claims);
  assert.deepEqual(devices.map(({ device_id }) => device_id), ["journey_interruption", "unfinished_tasks"]);
  assert.deepEqual(selectSleepPremiumExplanationDevices(facts, claims), devices);
  const marked = structuredClone(facts);
  marked.unknown.push({ id: "short_sleep" }, { id: "flags.active_thoughts" }, { id: "variable_timing" });
  assert.deepEqual(selectSleepPremiumExplanationDevices(marked, claims), []);
  assert.throws(() => selectSleepPremiumExplanationDevices(null, []), TypeError);
});

// Safety regression: the selector should not return a device when one of its
// required canonical facts has been removed, even if stale flags remain true.
test("devices reject incomplete canonical fact support rather than becoming decoration", () => {
  const facts = factsFor({ Q5: 3, Q3: 2 });
  facts.facts = facts.facts.filter(({ questionId }) => questionId !== "Q5");
  assert.deepEqual(selectSleepPremiumExplanationDevices(facts, [resolveSleepEvidenceCitation("SLEEP_MULTIDIMENSIONAL")]), []);
});

const personas = [
  ["MIRNA NOĆ", Array(12).fill(0)],
  ["UMORAN SAN", [4, 0, 0, 4, 0, 0, 0, 4, 0, 0, 4, 0]],
  ["BUDAN UM", [0, 4, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0]],
  ["ISPREKIDAN SAN", [0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 4]],
  ["SAN POD PRITISKOM", Array(12).fill(2)],
];

function assertPipeline(analysis, input) {
  assert.equal(analysis.profile, input.profile);
  assert.equal(analysis.release_allowed, false);
  assert.deepEqual(analysis.theme_plan, buildSleepPremiumThemePlan(input));
  assert.deepEqual(analysis.editorial_plan.priority_justification.key, getSleepPremiumPriority(input).key);
  assert.equal(analysis.editorial_plan.priority_justification.area, getSleepPremiumPriority(input).title);
  const plan = analysis.editorial_plan;
  assertRefs(plan.main_story.fact_ids, analysis.facts);
  assertRefs(plan.priority_justification.fact_ids, analysis.facts);
  assertRefs(plan.open_question.fact_ids, analysis.facts);
  for (const aspect of plan.main_story.aspects) assertRefs(aspect.fact_ids, analysis.facts);
  for (const contrast of plan.contrasts) assertRefs(contrast.fact_ids, analysis.facts);
  assert.deepEqual(plan.supported_positive, analysis.facts.facts.filter(({ kind }) => kind === "positive"));
  assert.deepEqual(plan.science_moments.map(({ claim_id }) => claim_id), claimIds(analysis.retrieval));
  for (const moment of plan.science_moments) {
    const claim = analysis.retrieval.claims.find(({ claim_id }) => claim_id === moment.claim_id);
    assert.deepEqual(moment.fact_ids, claim.fact_ids);
    assert.deepEqual(moment.sources, claim.sources);
    assert.equal(moment.release_allowed, false);
  }
  assert.ok(plan.explanation_devices.length <= 2);
  for (const device of plan.explanation_devices) assertRefs(device.fact_ids, analysis.facts);
  assert.deepEqual(plan.experiment.map(({ day }) => day), [1, 2, 3, 4, 5, 6, 7]);
  for (const day of plan.experiment) {
    assertRefs(day.fact_ids, analysis.facts);
    assert.equal(day.release_allowed, false);
    assert.deepEqual(day.themeIds, analysis.theme_plan.allocation.seven_day_plan[day.day - 1].themeIds);
    if (day.technique_id) {
      const technique = analysis.techniques.eligible.find(({ technique_id }) => technique_id === day.technique_id);
      assert.ok(technique);
      assert.ok(technique.approved_actions.includes(day.action));
      for (const id of technique.claim_ids) assert.ok(claimIds(analysis.retrieval).includes(id));
    } else assert.equal(day.mode, "observation_fallback");
  }
  assert.deepEqual(analysis.unknown, analysis.facts.unknown);
}

for (const [profile, indexes] of personas) {
  test(`full pre-AI persona reaches ${profile} without changing deterministic selectors`, () => {
    const input = freeze(inputFor(indexes));
    const before = structuredClone(input);
    const result = buildSleepPremiumPreAiAnalysis(input);
    assert.equal(input.profile, profile);
    assertPipeline(result, input);
    assert.deepEqual(input, before);
  });
}

test("same profile with different answer combinations produces different evidence and editorial content", () => {
  const first = analysisFor();
  const second = analysisFor({ Q7: 2 });
  assert.equal(first.profile, second.profile);
  assert.notDeepEqual(first.facts, second.facts);
  assert.notDeepEqual(first.retrieval, second.retrieval);
  assert.notDeepEqual(first.editorial_plan.main_story, second.editorial_plan.main_story);
  assert.notDeepEqual(first.editorial_plan.supported_positive, second.editorial_plan.supported_positive);
});

test("debug export uses the actual ISPREKIDAN SAN fixture, is pure and reflects the complete pipeline", () => {
  assertFrozen(ANSWER_POINTS);
  const input = buildSleepPremiumInput(ANSWER_POINTS);
  const analysis = freeze(buildSleepPremiumPreAiAnalysis(input));
  const before = structuredClone(analysis);
  assert.equal(analysis.profile, "ISPREKIDAN SAN");
  const formatted = formatSleepPremiumPreAiDebug(analysis);
  assert.equal(formatted, formatSleepPremiumPreAiDebug(analysis));
  assert.deepEqual(analysis, before);
  assert.ok(formatted.includes(`PROFILE: ${analysis.profile}`));
  assert.ok(formatted.includes("RELEASE ALLOWED: false"));
  for (const fact of analysis.facts.facts) {
    assert.ok(formatted.includes(fact.fact_id));
    assert.ok(formatted.includes(fact.selected_answer));
    assert.ok(formatted.includes(fact.question));
  }
  for (const claim of analysis.retrieval.claims) {
    assert.ok(formatted.includes(claim.claim_id));
    for (const source of claim.sources) {
      assert.ok(formatted.includes(source.title));
      assert.ok(formatted.includes(source.verified_url));
    }
  }
  for (const conclusion of analysis.prohibited_conclusions) assert.ok(formatted.includes(conclusion));
  for (const { id } of analysis.unknown) assert.ok(formatted.includes(id));
});

test("full pipeline/debug import and execution make no network or API calls", () => {
  // Child isolation also covers import-time behavior (techniques load local JSON).
  const moduleUrl = new URL("../server/sleepPremiumEditorialPlan.js", import.meta.url).href;
  const debugUrl = new URL("./debug-sleep-premium-pre-ai.js", import.meta.url).href;
  const inputUrl = new URL("../server/sleepPremiumInput.js", import.meta.url).href;
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", `
    import assert from 'node:assert/strict';
    import http from 'node:http';
    import https from 'node:https';
    import net from 'node:net';
    import tls from 'node:tls';
    import { syncBuiltinESMExports } from 'node:module';
    let calls = 0;
    const deny = () => { calls++; throw new Error('Unexpected network/API call'); };
    globalThis.fetch = deny;
    http.request = http.get = https.request = https.get = deny;
    net.connect = net.createConnection = tls.connect = deny;
    net.Socket.prototype.connect = deny;
    syncBuiltinESMExports();
    const { buildSleepPremiumPreAiAnalysis } = await import(${JSON.stringify(moduleUrl)});
    const { buildSleepPremiumInput } = await import(${JSON.stringify(inputUrl)});
    const { ANSWER_POINTS, formatSleepPremiumPreAiDebug } = await import(${JSON.stringify(debugUrl)});
    const analysis = buildSleepPremiumPreAiAnalysis(buildSleepPremiumInput(ANSWER_POINTS));
    assert.ok(formatSleepPremiumPreAiDebug(analysis).length);
    assert.equal(calls, 0);
  `], { encoding: "utf8", timeout: 15_000 });
  assert.ifError(child.error);
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stdout, ""); // Importing the debug export must not run its CLI.
});

test("1000 seeded fixtures preserve grounding, deterministic selection, profiles, priority and input", () => {
  let state = 0x5eed1234;
  const randomIndex = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state % 5;
  };
  const seen = new Set();
  // Explicit personas guarantee profile reachability independently of sampling.
  const fixtures = [...personas.map(([, indexes]) => indexes),
    ...Array.from({ length: 995 }, () => Array.from({ length: 12 }, randomIndex))];
  assert.equal(fixtures.length, 1000);
  for (const [index, indexes] of fixtures.entries()) {
    const input = freeze(inputFor(indexes));
    const before = structuredClone(input);
    const priority = getSleepPremiumPriority(input);
    const mode = getSleepPremiumStrengthMode(input);
    const signature = calculateSleepSignature(indexes);
    const result = buildSleepPremiumPreAiAnalysis(input);
    assert.equal(result.profile, signature.signature, `fixture ${index}`);
    seen.add(result.profile);
    assert.deepEqual(result.facts.flags, expectedFlags(indexes));
    assertPipeline(result, input);
    assert.deepEqual(buildSleepPremiumPreAiAnalysis(input), result, `unstable fixture ${index}`);
    assert.deepEqual(getSleepPremiumPriority(input), priority);
    assert.equal(getSleepPremiumStrengthMode(input), mode);
    assert.deepEqual(input, before);
    assert.ok(result.retrieval.claims.length <= 4);
    for (const claim of result.retrieval.claims) {
      assertRefs(claim.fact_ids, result.facts);
      assert.equal(claim.release_allowed, false);
      assert.deepEqual(claim.sources, resolveSleepEvidenceCitation(claim.claim_id).sources);
      for (const signal of claim.matched_signals) assert.equal(result.facts.flags[signal], true);
    }
    for (const technique of result.techniques.eligible) {
      assert.equal(technique.action_eligible, true);
      assert.equal(technique.release_allowed, false);
      assert.notEqual(technique.mode, "clinical_education_only");
      for (const id of technique.claim_ids) assert.ok(claimIds(result.retrieval).includes(id));
      if (result.facts.flags.short_sleep || result.facts.flags.daytime_sleepiness) assert.notEqual(technique.technique_id, "WAKE_REGULARITY");
    }
  }
  assert.deepEqual([...seen].sort(), [...SLEEP_PREMIUM_PROFILE_NAMES].sort());
});