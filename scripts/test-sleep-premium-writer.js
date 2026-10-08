import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test, { after } from "node:test";
import { buildSleepPremiumInput } from "../server/sleepPremiumInput.js";
import { buildSleepPremiumStoryMaterial } from "../server/sleepPremiumStoryMaterial.js";
import { buildSleepPremiumWriterBrief } from "../server/sleepPremiumWriterBrief.js";
import { buildSleepPremiumMasterJsonSchema, validateSleepPremiumMaster } from "../server/sleepPremiumMasterSchema.js";
import { adaptSleepPremiumMasterForPreview } from "../server/sleepPremiumMasterAdapter.js";
import { loadSleepEvidenceLibrary, resolveSleepEvidenceCitation } from "../server/sleepEvidenceLibrary.js";
import { buildSleepPremiumFallback } from "../server/sleepPremiumFallback.js";
import { buildSleepPremiumJsonSchema, getSleepPremiumPriority, validateSleepPremiumReport } from "../server/sleepPremiumSchema.js";
import {
  generateSleepPremiumMaster, isSleepPremiumWriterEnabled, serializeSleepPremiumWriterBrief,
  SLEEP_PREMIUM_WRITER_MODEL, SLEEP_PREMIUM_WRITER_MAX_OUTPUT_TOKENS, SLEEP_PREMIUM_WRITER_INSTRUCTIONS,
} from "../server/sleepPremiumWriter.js";
import { benchmarkFixtures } from "./debug-sleep-premium-story-material.js";
import { formatBenchmark } from "./run-sleep-premium-writer-benchmarks.js";

// All copy below is synthetic test scaffolding, NOT a real AI report or a
// semantic/clinical quality evaluation. Only the injected Responses mock runs.
const unique = (values) => [...new Set(values)];
const selected = (brief) => [brief.primary_insight, ...brief.secondary_insights];
const library = loadSleepEvidenceLibrary();
const inputs = benchmarkFixtures.map(({ answers }) => buildSleepPremiumInput(answers));
const briefs = inputs.map((input) => buildSleepPremiumWriterBrief(input));
const masterKeys = ["version", "profile", "priority", "intro", "insights", "tracking", "plan7", "alternatives",
  "uncertainty", "supporting_content", "provenance", "compliance"];
const briefKeys = ["version", "profile", "priority", "supporting_facts", "primary_insight", "secondary_insights",
  "twist", "contrasts", "rivals", "best_next_question", "do_not_target_first", "supported_positives",
  "approved_science", "eligible_techniques", "explanation_devices", "experiment7", "prohibited_conclusions",
  "unknown", "review_only", "release_allowed", "evidence_library_version"];
const legacyKeys = ["version", "profile", "profile_explanation", "priority", "connections", "stable_or_tracking",
  "seven_day_plan", "alternatives", "review_questions", "after_seven_days", "closing", "supporting_content"];

const protectedPaths = [
  "../server/sleepPremiumWriterBrief.js", "../server/sleepPremiumMasterSchema.js", "../server/sleepPremiumMasterAdapter.js",
  "../server/sleepPremiumWriter.js", "../server/sleepPremiumSchema.js", "../server/sleepPremiumGenerator.js",
  "../server/sleepPremiumPrompt.js", "../server/sleepPremiumFallback.js", "../server/sleepPremiumPreview.js",
  "../server/server.js", "../server/data-independent-content/sleep-evidence.v1.json", "../src/App.jsx",
  "../src/psychology/sleepSignature.js", "./run-sleep-premium-writer-benchmarks.js", "../package.json",
];
const sourceHash = (path) => createHash("sha256").update(readFileSync(new URL(path, import.meta.url))).digest("hex");
const originalHashes = protectedPaths.map(sourceHash);
after(() => assert.deepEqual(protectedPaths.map(sourceHash), originalHashes, "existing source files remain byte-for-byte unchanged"));

function assertFrozen(value) {
  if (!value || typeof value !== "object") return;
  assert.ok(Object.isFrozen(value));
  Object.values(value).forEach(assertFrozen);
}

function decodeBrief(serialized) {
  const envelope = JSON.parse(serialized);
  assert.deepEqual(Object.keys(envelope), ["encoding", "shared_text", "brief"]);
  assert.equal(envelope.encoding, "shared-text.v1");
  const decode = (value) => {
    if (Array.isArray(value)) return value.map(decode);
    if (value && typeof value === "object") {
      if (Object.keys(value).length === 1 && Object.hasOwn(value, "$text")) {
        assert.ok(Number.isInteger(value.$text) && value.$text >= 0 && value.$text < envelope.shared_text.length);
        return envelope.shared_text[value.$text];
      }
      return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, decode(child)]));
    }
    return value;
  };
  return decode(envelope.brief);
}

function provenance(master, brief) {
  master.provenance = {
    primary_insight_id: brief.primary_insight.insight_id,
    evidence_ids: unique(master.insights.flatMap(({ evidence_ids }) => evidence_ids)),
    technique_ids: unique([...master.plan7, ...master.alternatives].map(({ technique_id }) => technique_id).filter((id) => id !== null)),
    device_ids: unique(master.insights.map(({ device_id }) => device_id).filter((id) => id !== null)),
  };
  return master;
}

// Exact API shape, independently written rather than filled from the schema.
// No bibliographic copy; no forced science/device when the brief has none.
function draftFromBrief(brief) {
  const master = {
    version: 1, profile: brief.profile,
    priority: { area: brief.priority.area, explanation: "Odabrani početak ostaje u granicama prijavljenog iskustva.", first_step: "Kreni od već odabranog koraka." },
    intro: "Ovo je kratak pregled odabranih opažanja, uz otvorena pitanja.",
    insights: selected(brief).map((entry) => ({ insight_id: entry.insight_id,
      title: "Odabrano opažanje", text: "Različita iskustva ostaju odvojena dok ih pažljivije ne uporediš.",
      evidence_ids: entry.evidence_claim_ids.slice(0, 1), device_id: null })),
    tracking: [],
    plan7: brief.experiment7.map((entry) => ({ day: entry.day, action: "Zadrži odabrani korak u njegovim postojećim granicama.",
      observe: "Primeti svoje iskustvo bez dodatnog zadatka.", technique_id: entry.technique_id, theme_ids: [...entry.themeIds] })),
    alternatives: [],
    uncertainty: { question: brief.best_next_question ? "Da li ova iskustva opisuješ tokom istih dana?" : null,
      anchor_fact_ids: [...(brief.best_next_question?.fact_ids ?? [])] },
    supporting_content: {
      insights: selected(brief).map(({ insight_id }) => ({ insight_id, context: "Ovo opažanje ne bira objašnjenje između mogućih tumačenja." })),
      days: brief.experiment7.map(({ day }) => ({ day, rationale: "Ovaj osvrt ostaje uz postojeći korak.", reflection: null })),
      closing: "Sačuvaj prostor za ono što još nije poznato.",
    },
    provenance: {}, compliance: { no_diagnosis: true, no_causation: true, no_guarantee: true },
  };
  return provenance(master, brief);
}

function assertAccepted(master, brief) {
  const saved = structuredClone(master);
  const result = validateSleepPremiumMaster(master, brief);
  assert.equal(result.valid, true, JSON.stringify({ reason: result.reason, diagnostic: result.diagnostic }));
  assert.deepEqual(master, saved, "validation must not normalize or repair");
  assert.equal(result.master, master);
  assert.equal(result.release_allowed, false);
  assert.equal(result.semantic_review_required, true);
}

function assertBriefContract(input, brief) {
  const base = buildSleepPremiumStoryMaterial(input);
  const story = base.story_material;
  assert.deepEqual(Object.keys(brief), briefKeys);
  assert.equal(brief.profile, input.profile);
  assert.equal(brief.priority.area, getSleepPremiumPriority(input).title);
  assert.equal(brief.priority.area, base.editorial_plan.priority_justification.area);
  const allowedClaims = new Set(brief.approved_science.map(({ claim_id }) => claim_id));
  const canonicalSelected = [story.primary_insight, ...story.secondary_insights.slice(0, 2)];
  assert.deepEqual(selected(brief).map(({ insight_id }) => insight_id), canonicalSelected.map(({ insight_id }) => insight_id));
  for (const [index, entry] of selected(brief).entries()) {
    const original = canonicalSelected[index];
    for (const key of ["fact_ids", "relationship", "why_it_matters", "non_obvious", "genericity_flags"]) assert.deepEqual(entry[key], original[key]);
    assert.equal(entry.interpretation_status, original.uncertainty.status);
    assert.deepEqual(entry.uncertainty, { text: original.uncertainty.text, unknown_ids: original.uncertainty.unknown_ids });
    assert.deepEqual(entry.evidence_claim_ids, original.evidence_claim_ids.filter((id) => allowedClaims.has(id)));
  }
  assert.ok(brief.secondary_insights.length <= 2 && brief.rivals.length <= 3 && brief.explanation_devices.length <= 2);
  assert.equal(brief.primary_insight.insight_id, story.candidate_insights[0].insight_id);
  const rawKeys = new Set(["answers", "selected_answer", "selected_option_index", "mappedValue", "dimensions", "internalScores",
    "candidate_insights", "rejected_or_lower_value_candidates", "question_candidates", "criteria", "score", "sources", "authors", "year", "doi", "url", "journal"]);
  const factRefs = new Set();
  const walk = (value) => {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      assert.ok(!rawKeys.has(key), `raw/debug/bibliographic key excluded: ${key}`);
      if (key.endsWith("fact_ids")) child.forEach((id) => factRefs.add(id));
      if (key === "fact_id") factRefs.add(child);
      if (key === "comparison_groups") child.flat().forEach((id) => factRefs.add(id));
      if (key === "unknown_ids") child.forEach((id) => assert.ok(brief.unknown.includes(id)));
      walk(child);
    }
  };
  // Compute dependencies without letting supporting_facts authorize itself.
  walk({ ...brief, supporting_facts: [] });
  base.editorial_plan.priority_justification.fact_ids.forEach((id) => factRefs.add(id));
  assert.deepEqual(brief.supporting_facts.map(({ fact_id }) => fact_id), base.facts.facts.filter(({ fact_id }) => factRefs.has(fact_id)).map(({ fact_id }) => fact_id));
  for (const fact of brief.supporting_facts) {
    const original = base.facts.facts.find(({ fact_id }) => fact_id === fact.fact_id);
    assert.deepEqual(Object.keys(fact), ["fact_id", "questionId", "description", "frequency", "uncertainty", "qualifiers"]);
    for (const key of Object.keys(fact)) assert.deepEqual(fact[key], original[key]);
    assert.equal(fact.fact_id, `FACT_${fact.questionId}`);
  }
  for (const claim of brief.approved_science) {
    const original = base.retrieval.claims.find(({ claim_id }) => claim_id === claim.claim_id);
    assert.equal(original.status, "active");
    assert.deepEqual(claim.source_ref, unique(original.source_ids));
    claim.source_ref.forEach((id) => assert.ok(library.sources.some(({ source_id }) => source_id === id)));
    assert.deepEqual(claim.limits, unique([...original.applicability_restrictions, ...original.does_not_establish]));
    for (const key of ["evidence_id", "approved_claim", "plain_serbian", "strength", "directness", "fact_ids"]) assert.deepEqual(claim[key], original[key]);
  }
  for (const technique of brief.eligible_techniques) {
    assert.ok(technique.contextual_claim_ids.every((id) => allowedClaims.has(id)));
    const original = base.techniques.eligible.find(({ technique_id }) => technique_id === technique.technique_id);
    assert.deepEqual(technique.contextual_claim_ids, (original.contextual_claim_ids ?? []).filter((id) => allowedClaims.has(id)));
  }
  for (const [index, day] of brief.experiment7.entries()) {
    const original = base.editorial_plan.experiment[index];
    for (const key of ["day", "purpose", "themeIds", "fact_ids", "technique_id", "mode", "action", "observe"]) assert.deepEqual(day[key], original[key]);
    assert.deepEqual(day.restrictions, unique(original.restrictions));
    if (Object.hasOwn(original, "differentActionFromDay2And3")) assert.deepEqual(day.differentActionFromDay2And3, original.differentActionFromDay2And3);
  }
  const project = (record, keys) => Object.fromEntries(keys.map((key) => [key, record[key]]));
  assert.deepEqual(brief.rivals, story.rival_explanations.slice(0, 3).map((entry) => project(entry,
    ["interpretation", "supporting_fact_ids", "limiting_fact_ids", "missing_information", "discriminating_observation",
      "prohibited_causal_conclusion", "interpretation_status", "comparison_groups"])));
  assert.deepEqual(brief.best_next_question, story.best_next_question && project(story.best_next_question,
    ["question", "why_it_matters", "what_different_answers_would_clarify", "fact_ids", "unknown_ids"]));
  assert.deepEqual(brief.twist, story.twist && project(story.twist, ["insight_id", "fact_ids", "text", "interpretation_status", "unknown_ids"]));
  assert.deepEqual(brief.do_not_target_first, story.do_not_target_first.map((entry) => project(entry,
    ["target_id", "fact_ids", "reason", "qualification"])));
  assert.deepEqual(brief.supported_positives, base.editorial_plan.supported_positive.map(({ fact_id }) => ({ fact_id })));
  assert.deepEqual(brief.explanation_devices, base.editorial_plan.explanation_devices.slice(0, 2).map((entry) => project(entry,
    ["device_id", "concept", "fact_ids", "explanation", "does_not_imply"])));
  assert.deepEqual(brief.unknown, unique(base.unknown.map(({ id }) => id)));
  assert.equal(brief.review_only, true);
  assert.equal(brief.release_allowed, false);
  assertFrozen(brief);
  assert.deepEqual(decodeBrief(serializeSleepPremiumWriterBrief(brief)), brief, "lossless compact prompt, including every local limit");
  assert.ok(serializeSleepPremiumWriterBrief(brief).length < JSON.stringify(base).length, "not the complete pre-AI audit dump");
}

function staging(t, branch = "premium-ai-staging", flag = "true") {
  const saved = Object.fromEntries(["RENDER_GIT_BRANCH", "ENABLE_PREMIUM_AI_PREVIEW", "OPENAI_API_KEY"].map((key) => [key, process.env[key]]));
  process.env.RENDER_GIT_BRANCH = branch;
  process.env.ENABLE_PREMIUM_AI_PREVIEW = flag;
  delete process.env.OPENAI_API_KEY;
  t.after(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  const diagnostics = [];
  for (const method of ["log", "warn", "error"]) t.mock.method(console, method, (...args) => diagnostics.push(args));
  t.mock.method(globalThis, "fetch", () => { throw new Error("Network is forbidden in offline writer tests."); });
  return diagnostics;
}

function mockClient(response) {
  const calls = [];
  return { calls, client: { responses: { create: async (request, options) => {
    calls.push({ request, options });
    return typeof response === "function" ? response(request, options) : structuredClone(response);
  } } } };
}

const completed = (master) => ({ status: "completed", output_text: JSON.stringify(master),
  usage: { input_tokens: 12, output_tokens: 34, total_tokens: 46, input_tokens_details: { cached_tokens: 2 }, output_tokens_details: { reasoning_tokens: 3 } } });
const callWriter = (mock, options = {}) => generateSleepPremiumMaster({ input: inputs[0], openaiClient: mock.client, apiKeyAvailable: true, ...options });
function assertFallback(result, type, calls) {
  assert.equal(result.source, "fallback");
  assert.equal(result.failureType, type);
  assert.equal(result.requestCount, calls);
  assert.equal(result.master, null);
  assert.equal(Object.hasOwn(result, "preview"), false);
  assert.equal(result.validation.valid, false);
  assert.equal(result.legacyFallbackValidation.valid, true);
  assert.equal(result.legacyFallback.version, 2);
  assert.equal(result.release_allowed, false);
  assert.equal(result.semantic_review_required, true);
  assert.equal(validateSleepPremiumReport(result.legacyFallback, inputs[0]).valid, true);
}

for (const [index, fixture] of benchmarkFixtures.entries()) {
  test(`brief and valid synthetic master: ${fixture.id}`, () => {
    const saved = structuredClone(inputs[index]);
    assert.equal(inputs[index].profile, fixture.expectedProfile);
    assertBriefContract(inputs[index], briefs[index]);
    assert.deepEqual(buildSleepPremiumWriterBrief(inputs[index]), briefs[index]);
    assert.deepEqual(inputs[index], saved);
    const schema = buildSleepPremiumMasterJsonSchema(briefs[index]);
    assert.equal(schema.strict, true);
    assert.equal(schema.schema.additionalProperties, false);
    assert.deepEqual(schema.schema.required, masterKeys);
    assert.deepEqual(schema.schema.properties.profile.enum, [fixture.expectedProfile]);
    assert.deepEqual(schema.schema.properties.priority.properties.area.enum, [briefs[index].priority.area]);
    assert.equal(schema.schema.properties.plan7.minItems, 7);
    assert.equal(schema.schema.properties.plan7.maxItems, 7);
    assertAccepted(draftFromBrief(briefs[index]), briefs[index]);
  });
}

test("100 seeded property cases: no fusion, unchanged qualifiers, dependencies and exact provenance", async (t) => {
  let seed = 0x152a5;
  const next = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; };
  for (let index = 0; index < 100; index += 1) {
    const answers = Array.from({ length: 12 }, () => 1 + next() % 5);
    await t.test(`seeded case ${index + 1}`, () => {
      const input = buildSleepPremiumInput(answers);
      const saved = structuredClone(input);
      const brief = buildSleepPremiumWriterBrief(input);
      assertBriefContract(input, brief);
      const draft = draftFromBrief(brief);
      assertAccepted(draft, brief);
      assert.deepEqual(draft.provenance.evidence_ids, unique(draft.insights.flatMap(({ evidence_ids }) => evidence_ids)));
      assert.deepEqual(draft.provenance.technique_ids, unique(draft.plan7.map(({ technique_id }) => technique_id).filter((id) => id !== null)));
      assert.deepEqual(draft.uncertainty.anchor_fact_ids, brief.best_next_question?.fact_ids ?? []);
      assert.deepEqual(input, saved);
    });
  }
});

test("schema enums bind only selected claims/techniques/devices/facts and alternative themes", () => {
  const brief = briefs[0];
  const p = buildSleepPremiumMasterJsonSchema(brief).schema.properties;
  assert.deepEqual(p.insights.items.properties.insight_id.enum, selected(brief).map(({ insight_id }) => insight_id));
  assert.deepEqual(p.insights.items.properties.evidence_ids.items.enum, brief.approved_science.map(({ claim_id }) => claim_id));
  assert.deepEqual(p.insights.items.properties.device_id.anyOf[0].enum, brief.explanation_devices.map(({ device_id }) => device_id));
  assert.deepEqual(p.plan7.items.properties.technique_id.anyOf[0].enum, brief.eligible_techniques.map(({ technique_id }) => technique_id));
  assert.deepEqual(p.uncertainty.properties.anchor_fact_ids.items.enum, brief.best_next_question.fact_ids);
  const themes = unique(brief.experiment7.flatMap(({ themeIds }) => themeIds));
  assert.deepEqual(p.plan7.items.properties.theme_ids.items.enum, themes);
  assert.deepEqual(p.alternatives.items.properties.theme_ids.items.enum, themes.filter((id) => !brief.experiment7[1].themeIds.includes(id)));
  const walk = (schema) => {
    if (schema.type === "object") {
      assert.equal(schema.additionalProperties, false);
      assert.deepEqual(schema.required, Object.keys(schema.properties));
      Object.values(schema.properties).forEach(walk);
    }
    if (schema.items) walk(schema.items);
    schema.anyOf?.forEach(walk);
  };
  walk(buildSleepPremiumMasterJsonSchema(brief).schema);
});

const mutations = [
  ["extra root field", (m) => { m.sources = []; }],
  ["generated bibliography title metadata", (m) => { m.insights[0].citation = { title: "Invented reference" }; }],
  ["wrong profile", (m) => { m.profile = "BUDAN UM"; }],
  ["wrong priority", (m) => { m.priority.area = "Drugi prioritet"; }],
  ["wrong primary provenance", (m) => { m.provenance.primary_insight_id = briefs[0].secondary_insights[0].insight_id; }],
  ["unknown insight", (m) => { m.insights[0].insight_id = "UNKNOWN_INSIGHT"; }],
  ["primary not first", (m) => { [m.insights[0], m.insights[1]] = [m.insights[1], m.insights[0]]; }],
  ["duplicate insight anchors", (m) => { m.insights[1] = structuredClone(m.insights[0]); }],
  ["supporting insight mismatch", (m) => { m.supporting_content.insights[0].insight_id = m.insights[1].insight_id; }],
  ["extra supporting profile", (m) => { m.supporting_content.profile = "Novi profil"; }],
  ["extra supporting priority", (m) => { m.supporting_content.priority = "Drugi prioritet"; }],
  ["missing seventh day", (m) => { m.plan7.pop(); }],
  ["eighth day", (m) => { m.plan7.push(structuredClone(m.plan7[6])); }],
  ["reordered plan", (m) => { [m.plan7[0], m.plan7[1]] = [m.plan7[1], m.plan7[0]]; }],
  ["supporting day mismatch", (m) => { m.supporting_content.days[1].day = 3; }],
  ["unknown theme", (m) => { m.plan7[0].theme_ids = ["UNKNOWN_THEME"]; }],
  ["known but wrong day theme", (m) => { m.plan7[1].theme_ids = [...m.plan7[2].theme_ids]; }],
  ["duplicate theme", (m) => { m.plan7[0].theme_ids.push(m.plan7[0].theme_ids[0]); }],
  ["unknown claim", (m) => { m.insights[0].evidence_ids = ["UNKNOWN_CLAIM"]; }],
  ["source ID instead of claim ID", (m) => { m.insights[0].evidence_ids = [briefs[0].approved_science[0].source_ref[0]]; }],
  ["evidence ID instead of claim ID", (m) => { m.insights[0].evidence_ids = [briefs[0].approved_science[0].evidence_id]; }],
  ["unknown technique", (m) => { m.plan7[0].technique_id = "UNKNOWN_TECHNIQUE"; }],
  ["unknown device", (m) => { m.insights[0].device_id = "UNKNOWN_DEVICE"; }],
  ["invented uncertainty fact", (m) => { m.uncertainty.anchor_fact_ids = ["FACT_Q99"]; }],
  ["known fact outside selected question", (m) => { m.uncertainty.anchor_fact_ids = ["FACT_Q1"]; }],
  ["question without anchors", (m) => { m.uncertainty.anchor_fact_ids = []; }],
  ["null question with anchors", (m) => { m.uncertainty.question = null; }],
  ["unused evidence provenance", (m) => { m.provenance.evidence_ids.push(briefs[0].approved_science[1].claim_id); }],
  ["missing technique provenance", (m) => { m.provenance.technique_ids = []; }],
  ["duplicate evidence provenance", (m) => { m.provenance.evidence_ids.push(m.provenance.evidence_ids[0]); }],
  ["false compliance", (m) => { m.compliance.no_diagnosis = false; }],
  ["blank copy", (m) => { m.intro = "  "; }],
  ["overlong copy", (m) => { m.intro = "a".repeat(701); }],
  ["bibliographic year", (m) => { m.insights[0].text = "Naslov izmišljene studije iz 2020."; }],
  ["DOI", (m) => { m.insights[0].text = "Pogledaj DOI 10.1234/fabricated."; }],
  ["URL", (m) => { m.supporting_content.closing = "Pogledaj https://example.invalid/reference."; }],
  ["numeric citation", (m) => { m.insights[0].text = "Opažanje [1]."; }],
  ["authority without supporting claim", (m) => { m.intro = "Naučne smernice opisuju ovo iskustvo."; }],
  ["medical assertion", (m) => { m.intro = "Imaš apneju."; }],
  ["prescription", (m) => { m.plan7[0].action = "Uzmi lek za san."; }],
  ["causal assertion", (m) => { m.insights[0].text = "Ova navika uzrokuje tvoj umor."; }],
  ["outcome promise", (m) => { m.supporting_content.closing = "Ovaj korak će sigurno poboljšati san."; }],
  ["internal copy", (m) => { m.intro = "Classifier koristi scoring i internalScores."; }],
  ["machine ID in copy", (m) => { m.insights[0].text = briefs[0].primary_insight.insight_id; }],
  ["email", (m) => { m.intro = "synthetic@example.invalid"; }],
  ["credential", (m) => { m.intro = "api_key=synthetic-private-marker"; }],
  ["hidden character", (m) => { m.intro = "Mirno\u200b opažanje."; }],
  ["sleep reduction", (m) => { m.plan7[0].action = "Spavaj manje."; }],
  ["earlier alarm", (m) => { m.plan7[0].action = "Postavi raniji alarm."; }],
  ["unsafe advice after negative restriction", (m) => { m.plan7[0].action = "Nemoj skraćivati san, ali ostani budan."; }],
  ["priority-theme alternative", (m) => { m.alternatives = [{ text: "Drugi korak.", technique_id: null, theme_ids: [...briefs[0].experiment7[1].themeIds] }]; }],
];
for (const [name, mutate] of mutations) {
  test(`master rejects ${name}, without mutation or repair`, () => {
    const master = draftFromBrief(briefs[0]);
    mutate(master);
    const saved = structuredClone(master);
    const result = validateSleepPremiumMaster(master, briefs[0]);
    assert.equal(result.valid, false, name);
    assert.equal(typeof result.diagnostic?.field, "string");
    assert.deepEqual(master, saved);
  });
}

test("retrieved claim cannot migrate to an unsupported insight", () => {
  const brief = briefs[5];
  const claim = brief.secondary_insights[0].evidence_claim_ids.find((id) => !brief.primary_insight.evidence_claim_ids.includes(id));
  assert.ok(claim, "fixture must exercise an actually retrieved but unanchored claim");
  const master = draftFromBrief(brief);
  master.insights[0].evidence_ids = [claim];
  provenance(master, brief);
  const validation = validateSleepPremiumMaster(master, brief);
  assert.equal(validation.valid, false);
  assert.equal(validation.diagnostic.field, "insights[0].evidence_ids");
});

test("calm restraint: no forced science, techniques, question, tracking or alternatives", async (t) => {
  staging(t);
  const brief = briefs[4];
  assert.equal(brief.primary_insight.insight_id, "preserve_calm_features");
  assert.deepEqual(brief.approved_science, []);
  assert.deepEqual(brief.eligible_techniques, []);
  assert.equal(brief.best_next_question, null);
  const master = draftFromBrief(brief);
  assert.deepEqual(master.provenance.evidence_ids, []);
  assert.deepEqual(master.provenance.technique_ids, []);
  assert.ok(master.plan7.every(({ technique_id }) => technique_id === null));
  const mock = mockClient(completed(master));
  const result = await callWriter(mock, { input: inputs[4] });
  assert.equal(result.source, "ai");
  assert.equal(mock.calls.length, 1);
  for (const change of [
    (m) => { m.tracking = ["Prati dodatnu teškoću."]; },
    (m) => { m.alternatives = [{ text: "Drugi korak.", technique_id: null, theme_ids: [...brief.experiment7[0].themeIds] }]; },
    (m) => { m.insights[0].evidence_ids = ["SLEEP_MULTIDIMENSIONAL"]; },
    (m) => { m.plan7[0].technique_id = "SELF_OBSERVATION"; },
    (m) => { m.uncertainty.question = "Dodatno pitanje?"; },
  ]) {
    const changed = draftFromBrief(brief);
    change(changed);
    assert.equal(validateSleepPremiumMaster(changed, brief).valid, false);
  }
});

test("every generated prose location receives the same lexical safety gate", async (t) => {
  const locations = [
    ["intro", (m, text) => { m.intro = text; }],
    ["priority.explanation", (m, text) => { m.priority.explanation = text; }],
    ["priority.first_step", (m, text) => { m.priority.first_step = text; }],
    ["insights[0].title", (m, text) => { m.insights[0].title = text; }],
    ["insights[0].text", (m, text) => { m.insights[0].text = text; }],
    ["supporting_content.insights[0].context", (m, text) => { m.supporting_content.insights[0].context = text; }],
    ["tracking[0]", (m, text) => { m.tracking = [text]; }],
    ["plan7[0].action", (m, text) => { m.plan7[0].action = text; }],
    ["plan7[0].observe", (m, text) => { m.plan7[0].observe = text; }],
    ["supporting_content.days[0].rationale", (m, text) => { m.supporting_content.days[0].rationale = text; }],
    ["supporting_content.days[0].reflection", (m, text) => { m.supporting_content.days[0].reflection = text; }],
    ["alternatives[0].text", (m, text) => {
      m.alternatives = [{ text, technique_id: null, theme_ids: [...briefs[0].experiment7[2].themeIds] }];
    }],
    ["uncertainty.question", (m, text) => { m.uncertainty.question = text; }],
    ["supporting_content.closing", (m, text) => { m.supporting_content.closing = text; }],
  ];
  for (const [field, replace] of locations) {
    await t.test(field, () => {
      const control = draftFromBrief(briefs[0]);
      replace(control, "Mirno opažanje.");
      assertAccepted(control, briefs[0]);
      for (const text of ["Imaš apneju.", "Navika uzrokuje umor.", "Sigurno poboljšava san.",
        "Spavaj manje.", "https://example.invalid/fake", "synthetic@example.invalid", "FACT_Q3", "Izmišljeni rad 2020."]) {
        const candidate = structuredClone(control);
        replace(candidate, text);
        const validation = validateSleepPremiumMaster(candidate, briefs[0]);
        assert.equal(validation.valid, false);
        assert.equal(validation.diagnostic.field, field, "failure belongs to mutated copy, not an unrelated shape/anchor");
      }
    });
  }
});

test("adapter resolves only registry bibliography and hides machine anchors from display cards", () => {
  const master = draftFromBrief(briefs[0]);
  const saved = structuredClone(master);
  const preview = adaptSleepPremiumMasterForPreview(master, briefs[0]);
  const citations = master.provenance.evidence_ids.map((id) => resolveSleepEvidenceCitation(id));
  const sources = unique(citations.flatMap(({ sources }) => sources.map(({ source_id }) => source_id)))
    .map((id) => library.sources.find(({ source_id }) => source_id === id));
  assert.deepEqual(preview.sources.map(({ title, year, doi, url }) => ({ title, year, doi, url })),
    sources.map(({ title, year, doi, url }) => ({ title, year, doi, url })));
  assert.deepEqual(preview.registry_snapshot.claims, citations);
  assert.deepEqual(preview.registry_snapshot.provenance, master.provenance);
  assert.ok(preview.connections.every(({ source_labels }) => source_labels.length > 0));
  for (const card of [...preview.connections, ...preview.plan, ...preview.alternatives]) {
    assert.ok(!Object.keys(card).some((key) => /(?:_id|_ids)$/u.test(key)));
  }
  assert.equal(preview.pdf.available, false);
  assert.equal(preview.release_allowed, false);
  assert.equal(preview.source_verification_is_clinical_approval, false);
  assert.equal(preview.clinical_review_status, "pending");
  assertFrozen(preview);
  assert.deepEqual(master, saved);
  const withoutScience = draftFromBrief(briefs[4]);
  assert.deepEqual(adaptSleepPremiumMasterForPreview(withoutScience, briefs[4]).sources, []);
});

for (const [name, change] of [
  ["registry version mismatch", (l) => { l.version = "sleep-evidence.v999"; }],
  ["retired claim", (l, c) => { c.status = "retired"; }],
  ["inactive claim", (l, c) => { c.status = "inactive"; }],
  ["retired source", (l, c) => { l.sources.find(({ source_id }) => source_id === c.source_ids[0]).status = "retired"; }],
  ["missing source", (l, c) => { l.sources = l.sources.filter(({ source_id }) => source_id !== c.source_ids[0]); }],
  ["source mapping mismatch", (l, c) => { c.source_ids = [l.sources.find(({ source_id }) => !c.source_ids.includes(source_id)).source_id]; }],
  ["evidence mapping mismatch", (l, c) => { c.evidence_id = "EV_SYNTHETIC_MISMATCH"; }],
  ["changed approved claim", (l, c) => { c.approved_claim += " Changed synthetic wording."; }],
]) {
  test(`adapter fails closed: ${name}`, () => {
    const custom = structuredClone(library);
    const master = draftFromBrief(briefs[0]);
    const claim = custom.claims.find(({ claim_id }) => claim_id === master.provenance.evidence_ids[0]);
    change(custom, claim);
    const saved = structuredClone(custom);
    assert.throws(() => adaptSleepPremiumMasterForPreview(master, briefs[0], { library: custom }));
    assert.deepEqual(custom, saved, "custom registry is not repaired/frozen/mutated");
  });
}

test("adapter rejects invalid/generated bibliography instead of repairing it", () => {
  const master = draftFromBrief(briefs[0]);
  master.insights[0].text = "Izmišljeni rad iz 2020, DOI 10.1234/fake.";
  assert.throws(() => adaptSleepPremiumMasterForPreview(master, briefs[0]), { code: "PREMIUM_MASTER_VALIDATION" });
});

test("custom mutable library brief is detached, frozen, and source IDs stay metadata-only", () => {
  const custom = structuredClone(library);
  const saved = structuredClone(custom);
  const brief = buildSleepPremiumWriterBrief(inputs[0], { library: custom });
  assert.deepEqual(custom, saved);
  assert.equal(Object.isFrozen(custom), false);
  custom.claims[0].plain_serbian = "Changed synthetic wording.";
  assert.deepEqual(brief, briefs[0]);
  assertFrozen(brief);
  assert.throws(() => serializeSleepPremiumWriterBrief(buildSleepPremiumStoryMaterial(inputs[0])), /canonical/iu);
  assert.throws(() => serializeSleepPremiumWriterBrief(inputs[0]), /canonical/iu);
});

test("writer mock success: one gpt-5-mini/8000 call, serialized brief only, no reanalysis", async (t) => {
  const diagnostics = staging(t);
  const mock = mockClient(completed(draftFromBrief(briefs[0])));
  const result = await callWriter(mock);
  assert.equal(result.source, "ai");
  assert.equal(result.requestCount, 1);
  assert.equal(mock.calls.length, 1);
  assert.equal(result.validation.valid, true);
  assert.equal(result.semantic_review_required, true);
  assert.equal(result.release_allowed, false);
  const { request, options } = mock.calls[0];
  assert.equal(SLEEP_PREMIUM_WRITER_MODEL, "gpt-5-mini");
  assert.equal(SLEEP_PREMIUM_WRITER_MAX_OUTPUT_TOKENS, 8000);
  assert.equal(request.model, "gpt-5-mini");
  assert.equal(request.max_output_tokens, 8000);
  assert.equal(request.store, false);
  assert.equal(options.maxRetries, 0);
  assert.equal(options.timeout, 60000);
  assert.ok(options.signal instanceof AbortSignal);
  assert.deepEqual(request.text.format, buildSleepPremiumMasterJsonSchema(briefs[0]));
  assert.deepEqual(request.input.map(({ role }) => role), ["system", "user"]);
  assert.equal(request.input[0].content, SLEEP_PREMIUM_WRITER_INSTRUCTIONS);
  assert.match(request.input[0].content, /Ne radi novu analizu, rangiranje, profilisanje ili izbor prioriteta/u);
  assert.equal(request.input[1].content, serializeSleepPremiumWriterBrief(briefs[0]));
  assert.deepEqual(decodeBrief(request.input[1].content), briefs[0]);
  assert.equal(result.serializedBriefCharacters, request.input[1].content.length);
  assert.equal(result.usage.input_tokens, 12);
  assert.equal(result.usage.output_tokens, 34);
  assert.equal(result.usage.cached_input_tokens, 2);
  assert.equal(result.usage.reasoning_tokens, 3);
  assert.equal(result.usage.source, "AI_GENERATED");
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0][0], "[PREMIUM_AI_USAGE]");
  assert.deepEqual(JSON.parse(diagnostics[0][1]), result.usage);
});

for (const [name, response, type] of [
  ["schema failure", completed({ version: 1 }), "schema_validation_failure"],
  ["invalid JSON", { status: "completed", output_text: "not JSON" }, "invalid_json"],
  ["empty output", { status: "completed", output: [] }, "invalid_json"],
  ["incomplete response", { status: "incomplete", output_text: "{}", incomplete_details: { reason: "max_output_tokens" } }, "incomplete_response"],
  ["completed but incomplete details", { ...completed(draftFromBrief(briefs[0])), incomplete_details: { reason: "content_filter" } }, "incomplete_response"],
  ["refusal", { status: "completed", output: [{ type: "message", content: [{ type: "refusal", refusal: "Synthetic refusal" }] }] }, "model_refusal"],
  ["API error", () => { throw Object.assign(new Error("Synthetic private provider detail"), { status: 429 }); }, "openai_http_error"],
  ["connection error", () => { throw new Error("Synthetic private provider detail"); }, "openai_request_failed"],
  ["timeout", () => new Promise(() => {}), "timeout"],
]) {
  test(`writer fallback: ${name}, one attempt and no automatic retry`, async (t) => {
    const diagnostics = staging(t);
    const mock = mockClient(response);
    const result = await callWriter(mock, type === "timeout" ? { timeoutMs: 10 } : {});
    assertFallback(result, type, 1);
    assert.equal(mock.calls.length, 1);
    assert.equal(mock.calls[0].options.maxRetries, 0);
    assert.doesNotMatch(JSON.stringify({ result, diagnostics }), /Synthetic private provider detail/u);
    if (type === "timeout") assert.equal(mock.calls[0].options.signal.aborted, true);
  });
}

for (const [name, overrides, type] of [
  ["missing key defaults to unavailable", { apiKeyAvailable: undefined }, "missing_api_key"],
  ["explicit missing key", { apiKeyAvailable: false }, "missing_api_key"],
  ["missing client", { openaiClient: null }, "missing_ai_client"],
  ["invalid timeout", { timeoutMs: 0 }, "invalid_timeout"],
]) {
  test(`writer unavailable: ${name}, zero calls`, async (t) => {
    staging(t);
    const mock = mockClient(completed(draftFromBrief(briefs[0])));
    const result = await callWriter(mock, overrides);
    assertFallback(result, type, 0);
    assert.equal(mock.calls.length, 0);
  });
}

for (const [branch, flag] of [["main", "true"], ["premium-ai-staging", "false"], ["premium-ai-staging", "TRUE"], ["", "true"]]) {
  test(`non-staging gate fails closed (${branch || "unset"}/${flag}): no call, master, preview or rejected draft`, async (t) => {
    const diagnostics = staging(t, branch, flag);
    assert.equal(isSleepPremiumWriterEnabled(), false);
    const mock = mockClient(completed(draftFromBrief(briefs[0])));
    const result = await callWriter(mock, { internalBenchmark: true, includeRejectedDraft: true });
    assertFallback(result, "preview_disabled", 0);
    assert.equal(mock.calls.length, 0);
    assert.equal(Object.hasOwn(result, "rejectedDraft"), false);
    assert.deepEqual(diagnostics, []);
  });
}

test("writer enforces exact day technique and alternative allocation beyond standalone schema", async (t) => {
  staging(t);
  const master = draftFromBrief(briefs[0]);
  master.plan7[0].technique_id = briefs[0].eligible_techniques[0].technique_id;
  provenance(master, briefs[0]);
  assertAccepted(master, briefs[0]); // Schema is lexical/structural, not writer allocation validation.
  const mock = mockClient(completed(master));
  const result = await callWriter(mock);
  assertFallback(result, "schema_validation_failure", 1);
  assert.equal(result.validation.diagnostic.field, "plan7[0].technique_id");
  const alternative = draftFromBrief(briefs[0]);
  alternative.alternatives = [{ text: "Ostani uz postojeći korak.", technique_id: "SELF_OBSERVATION", theme_ids: [...briefs[0].experiment7[2].themeIds] }];
  provenance(alternative, briefs[0]);
  assertAccepted(alternative, briefs[0]);
  const alternateMock = mockClient(completed(alternative));
  const alternateResult = await callWriter(alternateMock);
  assertFallback(alternateResult, "schema_validation_failure", 1);
  assert.equal(alternateResult.validation.diagnostic.field, "alternatives[0]");
});

test("writer accepts an existing bounded alternative, matching device, and output message path", async (t) => {
  staging(t);
  const brief = briefs[0];
  const master = draftFromBrief(brief);
  const day = brief.experiment7[2];
  master.alternatives = [{ text: "Ostani uz postojeći korak.", technique_id: day.technique_id, theme_ids: [...day.themeIds] }];
  const device = brief.explanation_devices.find((d) => brief.primary_insight.fact_ids.some((id) => d.fact_ids.includes(id)));
  assert.ok(device, "device test requires a real shared canonical fact");
  master.insights[0].device_id = device.device_id;
  provenance(master, brief);
  assertAccepted(master, brief);
  const mock = mockClient({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(master) }] }] });
  const result = await callWriter(mock, { includePreview: false, logUsage: () => { throw new Error("Synthetic observer exception"); } });
  assert.equal(result.source, "ai");
  assert.equal(result.requestCount, 1);
  assert.equal(Object.hasOwn(result, "preview"), false);
  assert.equal(result.usage.input_tokens, null);
});

test("writer retains selected uncertainty and requires available science, but never invents it", async (t) => {
  staging(t);
  for (const mutate of [
    (m) => { m.uncertainty = { question: null, anchor_fact_ids: [] }; },
    (m) => { m.uncertainty.anchor_fact_ids = m.uncertainty.anchor_fact_ids.slice(0, 1); },
    (m) => { m.insights.forEach((entry) => { entry.evidence_ids = []; }); provenance(m, briefs[0]); },
  ]) {
    const master = draftFromBrief(briefs[0]);
    mutate(master);
    assertAccepted(master, briefs[0]);
    const mock = mockClient(completed(master));
    assertFallback(await callWriter(mock), "schema_validation_failure", 1);
    assert.equal(mock.calls.length, 1);
  }
});

test("incomplete diagnostics are metadata-only, console is captured/restored, observer exceptions are harmless", async (t) => {
  const diagnostics = staging(t);
  const privateMarker = "synthetic-private-provider-marker";
  const mock = mockClient({ status: "incomplete", output_text: privateMarker,
    incomplete_details: { reason: privateMarker }, error: { code: privateMarker, message: privateMarker },
    output: [{ type: privateMarker, status: privateMarker, content: [{ type: privateMarker, text: privateMarker }] }],
    usage: { input_tokens: -1, output_tokens: privateMarker, total_tokens: Infinity } });
  let observed;
  const result = await callWriter(mock, { onIncompleteResponse: (metadata) => { observed = metadata; throw new Error(privateMarker); } });
  assertFallback(result, "incomplete_response", 1);
  assert.deepEqual(observed, result.incompleteDiagnostics);
  assert.equal(observed.outputTextCharacterLength, privateMarker.length);
  assert.equal(observed.outputTextExists, true);
  assert.equal(observed.max_output_tokens, 8000);
  assert.equal(result.usage.input_tokens, null);
  assert.equal(result.usage.output_tokens, null);
  assert.equal(result.usage.total_tokens, null);
  assert.equal(diagnostics.filter(([prefix]) => prefix === "[PREMIUM_AI_INCOMPLETE_RESPONSE]").length, 1);
  assert.doesNotMatch(JSON.stringify({ result, diagnostics, observed }), new RegExp(privateMarker, "u"));
});

test("rejected draft opt-in requires internal benchmark; sensitive content stays withheld", async (t) => {
  staging(t);
  const master = draftFromBrief(briefs[0]);
  master.intro = "Izmišljeni rad iz 2020.";
  for (const options of [{}, { includeRejectedDraft: true }, { internalBenchmark: true }]) {
    const result = await callWriter(mockClient(completed(master)), options);
    assert.equal(Object.hasOwn(result, "rejectedDraft"), false);
  }
  const options = { internalBenchmark: true, includeRejectedDraft: true };
  const visible = await callWriter(mockClient(completed(master)), options);
  assert.equal(visible.rejectedDraft.accepted, false);
  assert.equal(visible.rejectedDraft.release_allowed, false);
  assert.equal(visible.master, null);
  const sensitive = { version: 1, unexpected: { note: "synthetic@example.invalid" } };
  const withheld = await callWriter(mockClient(completed(sensitive)), options);
  assert.equal(withheld.rejectedDraftWithheld, true);
  assert.equal(Object.hasOwn(withheld, "rejectedDraft"), false);
  assert.doesNotMatch(formatBenchmark(withheld, { format: "json" }), /synthetic@example\.invalid/u);
});

test("A/F same-profile fixtures keep different exact primary anchors, brief facts and source traces", async (t) => {
  staging(t);
  assert.equal(briefs[0].profile, briefs[5].profile);
  assert.equal(briefs[0].primary_insight.insight_id, "continuity_daytime_relation");
  assert.equal(briefs[5].primary_insight.insight_id, "fragmented_night_preserved_daytime");
  assert.notDeepEqual(briefs[0].supporting_facts, briefs[5].supporting_facts);
  for (const index of [0, 5]) {
    const mock = mockClient(completed(draftFromBrief(briefs[index])));
    const result = await callWriter(mock, { input: inputs[index] });
    assert.equal(result.source, "ai");
    assert.equal(mock.calls.length, 1);
    const report = JSON.parse(formatBenchmark(result, { fixtureId: benchmarkFixtures[index].id, format: "json" }));
    assert.equal(report.status, "GENERATED_REVIEW_ONLY");
    assert.equal(report.sections.length, 6);
    assert.equal(report.trace.primary, briefs[index].primary_insight.insight_id);
    assert.equal(report.master.insights[0].insight_id, report.trace.primary);
    assert.deepEqual(report.brief_summary.supporting_facts, briefs[index].supporting_facts);
    assert.deepEqual(report.brief_summary.rivals, briefs[index].rivals);
    assert.deepEqual(report.brief_summary.prohibited_conclusions, briefs[index].prohibited_conclusions);
    assert.deepEqual(report.evidence_notes, result.master.provenance.evidence_ids.map((id) => resolveSleepEvidenceCitation(id)));
    assert.deepEqual(report.trace.days, result.preview.registry_snapshot.day_anchors);
    assert.equal(report.quality_review.requires_human_review, true);
    assert.equal(report.quality_review.structural_flags.primary_anchor_first, true);
    assert.equal(report.release_allowed, false);
    assert.match(formatBenchmark(result), /INTERNAL SYNTHETIC BENCHMARK.*REVIEW ONLY/u);
  }
});

test("benchmark fallback makes no generated-master or quality-success claim", async (t) => {
  staging(t);
  const result = await callWriter(mockClient(completed(draftFromBrief(briefs[0]))), { apiKeyAvailable: false });
  const report = JSON.parse(formatBenchmark(result, { format: "json" }));
  assert.equal(report.status, "FALLBACK_NOT_AI_MASTER");
  assert.equal(report.request_count, 0);
  assert.equal(report.master, null);
  assert.equal(report.preview, null);
  assert.equal(report.trace, null);
  assert.deepEqual(report.sections, []);
  assert.deepEqual(report.evidence_notes, []);
  assert.match(report.quality_review.evaluation, /no quality success claimed/u);
});

test("legacy v2 schema/fallback invariants and source isolation stay unchanged", () => {
  for (const input of inputs) {
    const fallback = buildSleepPremiumFallback(input);
    assert.equal(fallback.version, 2);
    assert.deepEqual(Object.keys(fallback).sort(), [...legacyKeys].sort());
    assert.equal(validateSleepPremiumReport(fallback, input).valid, true);
    assert.deepEqual(buildSleepPremiumJsonSchema(input).schema.required, legacyKeys);
    assert.equal(validateSleepPremiumReport(draftFromBrief(buildSleepPremiumWriterBrief(input)), input).valid, false);
  }
  // Read-only integration check: this API has no HTTP route exposure today.
  // This is not an assertion that the legacy preview gate uses branch gating.
  for (const path of ["../server/server.js", "../server/sleepPremiumPreview.js", "../server/sleepPremiumGenerator.js", "../src/App.jsx"]) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.doesNotMatch(source, /(?:sleepPremiumWriter|sleepPremiumMaster|generateSleepPremiumMaster|adaptSleepPremiumMasterForPreview)/u);
  }
});

test("writer rejects more than three distinct selected claims with exact provenance", async (t) => {
  staging(t);
  const brief = briefs[5];
  const master = draftFromBrief(brief);
  master.insights[0].evidence_ids = [...brief.primary_insight.evidence_claim_ids];
  master.insights[1].evidence_ids = brief.secondary_insights[0].evidence_claim_ids.filter((id) => !master.insights[0].evidence_ids.includes(id));
  provenance(master, brief);
  assert.equal(master.provenance.evidence_ids.length, 4);
  assertAccepted(master, brief);
  const mock = mockClient(completed(master));
  const result = await callWriter(mock, { input: inputs[5] });
  assert.equal(result.source, "fallback");
  assert.equal(result.failureType, "schema_validation_failure");
  assert.equal(result.validation.diagnostic.field, "provenance");
  assert.equal(mock.calls.length, 1);
});

test("writer fails closed on a registry changed during the single request", async (t) => {
  staging(t);
  const custom = structuredClone(library);
  const master = draftFromBrief(briefs[0]);
  const mock = mockClient(() => {
    custom.claims.find(({ claim_id }) => claim_id === master.provenance.evidence_ids[0]).status = "retired";
    return completed(master);
  });
  const result = await callWriter(mock, { briefOptions: { library: custom } });
  assertFallback(result, "preview_adapter_failure", 1);
  assert.equal(mock.calls.length, 1);
});

test("invalid canonical input is not reconstructed into a fabricated report", async (t) => {
  staging(t);
  const mock = mockClient(completed(draftFromBrief(briefs[0])));
  const result = await callWriter(mock, { input: null });
  assert.equal(result.failureType, "invalid_input");
  assert.equal(result.source, "fallback");
  assert.equal(result.master, null);
  assert.equal(result.brief, null);
  assert.equal(result.legacyFallback, null);
  assert.equal(result.legacyFallbackValidation.valid, false);
  assert.equal(result.requestCount, 0);
  assert.equal(mock.calls.length, 0);
});