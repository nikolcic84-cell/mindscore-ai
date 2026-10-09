import assert from "node:assert/strict";
import test from "node:test";
import { buildSleepPremiumInput } from "../server/sleepPremiumInput.js";
import { buildSleepPremiumWriterBrief, projectSleepPremiumWriterBrief } from "../server/sleepPremiumWriterBrief.js";
import { benchmarkFixtures } from "./debug-sleep-premium-story-material.js";

const unique = (values) => [...new Set(values)];
const selected = (brief) => [brief.primary_insight, ...brief.secondary_insights];
const canonicalBriefs = benchmarkFixtures.map((fixture) =>
  buildSleepPremiumWriterBrief(buildSleepPremiumInput(fixture.answers)));
const projections = canonicalBriefs.map(projectSleepPremiumWriterBrief);
const sizes = canonicalBriefs.map((brief, index) => ({
  canonical: JSON.stringify(brief).length,
  projected: JSON.stringify(projections[index]).length,
}));

function assertFrozen(value) {
  if (!value || typeof value !== "object") return;
  assert.ok(Object.isFrozen(value));
  Object.values(value).forEach(assertFrozen);
}

function assertProjection(brief, projected) {
  assert.equal(projected.version, "premium-writer-transport.v2.2");
  assert.equal(projected.profile, brief.profile);
  assert.deepEqual(projected.priority, brief.priority);
  assert.equal(projected.review_only, true);
  assert.equal(projected.release_allowed, false);
  assert.deepEqual(projected.primary_insight.insight_id, brief.primary_insight.insight_id);
  assert.deepEqual(projected.secondary_insights.map(({ insight_id }) => insight_id),
    brief.secondary_insights.map(({ insight_id }) => insight_id));

  for (const [index, anchor] of selected(brief).entries()) {
    const insight = index === 0 ? projected.primary_insight : projected.secondary_insights[index - 1];
    assert.deepEqual(insight.fact_ids, anchor.fact_ids);
    assert.equal(insight.relationship, anchor.relationship);
    assert.equal(insight.why_it_matters, anchor.why_it_matters);
    assert.equal(insight.interpretation_status, anchor.interpretation_status);
    assert.deepEqual(insight.uncertainty, anchor.uncertainty);
    assert.deepEqual(insight.genericity_flags, anchor.genericity_flags);
    assert.deepEqual(insight.allowed_claim_ids, anchor.evidence_claim_ids);
    assert.ok(!Object.hasOwn(insight, "non_obvious"));
  }

  const factById = new Map(brief.supporting_facts.map((fact) => [fact.fact_id, fact]));
  for (const fact of projected.facts) {
    const canonical = factById.get(fact.fact_id);
    assert.ok(canonical, `projected fact exists in canonical brief: ${fact.fact_id}`);
    for (const key of ["questionId", "description", "frequency", "uncertainty", "qualifiers"])
      assert.deepEqual(fact[key], canonical[key], `${fact.fact_id}.${key} remains canonical`);
    assert.ok(unique(projected.facts.map(({ fact_id }) => fact_id)).includes(fact.fact_id));
  }
  assert.equal(new Set(projected.facts.map(({ fact_id }) => fact_id)).size, projected.facts.length);

  const canonicalDays = brief.experiment7;
  assert.equal(projected.days.length, 7);
  for (const [index, day] of projected.days.entries()) {
    const original = canonicalDays[index];
    assert.equal(day.day, original.day);
    assert.deepEqual(day.themeIds, original.themeIds);
    assert.deepEqual(day.fact_ids, original.fact_ids);
    assert.equal(day.technique_id, original.technique_id);
    assert.equal(projected.action_catalog[day.action_ref], original.action);
    assert.equal(projected.observe_catalog[day.observe_ref], original.observe);
    assert.deepEqual(day.restriction_refs.map((ref) => projected.boundary_catalog[ref]), original.restrictions);
    assert.equal(day.mode, original.mode);
    if (Object.hasOwn(original, "differentActionFromDay2And3"))
      assert.equal(day.differentActionFromDay2And3, original.differentActionFromDay2And3);
  }
  assert.deepEqual(projected.action_catalog, unique(canonicalDays.map(({ action }) => action)));

  assert.deepEqual(projected.rivals, brief.rivals);
  assert.deepEqual(projected.best_next_question, brief.best_next_question);
  assert.deepEqual(projected.do_not_target_first, brief.do_not_target_first);
  assert.deepEqual(projected.supported_positives, brief.supported_positives);
  assert.deepEqual(projected.unknown, brief.unknown);

  const allocatedIds = new Set(canonicalDays.map(({ technique_id }) => technique_id).filter(Boolean));
  assert.deepEqual(projected.techniques.map(({ technique_id }) => technique_id),
    brief.eligible_techniques.filter(({ technique_id }) => allocatedIds.has(technique_id)).map(({ technique_id }) => technique_id));
  for (const technique of projected.techniques) {
    const canonical = brief.eligible_techniques.find(({ technique_id }) => technique_id === technique.technique_id);
    for (const key of ["mode", "claim_ids", "contextual_claim_ids", "approved_actions", "observe", "burden"])
      assert.deepEqual(technique[key], canonical[key]);
    assert.deepEqual(technique.boundary_refs.map((ref) => projected.boundary_catalog[ref]), canonical.limits);
  }
  const citedClaims = new Set([
    ...selected(brief).flatMap(({ evidence_claim_ids }) => evidence_claim_ids),
    ...projected.techniques.flatMap(({ claim_ids, contextual_claim_ids }) => [...claim_ids, ...contextual_claim_ids]),
  ]);
  assert.ok(projected.science.every(({ claim_id }) => citedClaims.has(claim_id)));
  for (const claim of projected.science) {
    const canonical = brief.approved_science.find(({ claim_id }) => claim_id === claim.claim_id);
    for (const key of ["plain_serbian", "evidence_type", "strength", "directness"])
      assert.deepEqual(claim[key], canonical[key]);
    assert.deepEqual(claim.boundary_refs.map((ref) => projected.boundary_catalog[ref]), canonical.limits);
    for (const forbidden of ["source_ref", "evidence_id", "concept", "approved_claim", "action_eligible", "clinical_review_status", "release_allowed"])
      assert.ok(!Object.hasOwn(claim, forbidden), `science metadata omitted: ${forbidden}`);
  }

  const selectedFactIds = new Set(selected(brief).flatMap(({ fact_ids }) => fact_ids));
  assert.ok(projected.explanation_devices.every(({ fact_ids }) => fact_ids.some((id) => selectedFactIds.has(id))));
  for (const device of projected.explanation_devices) {
    const canonical = brief.explanation_devices.find(({ device_id }) => device_id === device.device_id);
    assert.deepEqual(device.fact_ids, canonical.fact_ids);
    assert.equal(device.explanation, canonical.explanation);
    assert.deepEqual(device.boundary_refs.map((ref) => projected.boundary_catalog[ref]), canonical.does_not_imply);
  }

  const localLimits = new Set([
    ...projected.science.flatMap(({ boundary_refs }) => boundary_refs.map((ref) => projected.boundary_catalog[ref])),
    ...projected.techniques.flatMap(({ boundary_refs }) => boundary_refs.map((ref) => projected.boundary_catalog[ref])),
    ...projected.explanation_devices.flatMap(({ boundary_refs }) => boundary_refs.map((ref) => projected.boundary_catalog[ref])),
    ...canonicalDays.flatMap(({ restrictions }) => restrictions),
  ]);
  const expectedGlobalBoundaries = unique([
    ...brief.prohibited_conclusions,
    ...brief.contrasts.flatMap(({ does_not_establish }) => does_not_establish),
  ]);
  assert.deepEqual(projected.global_boundary_refs.map((ref) => projected.boundary_catalog[ref]), expectedGlobalBoundaries);
  assert.deepEqual(new Set(projected.boundary_catalog), new Set([...expectedGlobalBoundaries, ...localLimits]));

  const forbiddenKeys = new Set(["rejected_or_lower_value_candidates", "candidate_insights", "question_candidates", "specificity_check",
    "source_ref", "evidence_id", "doi", "bibliography", "internal_utility_score"]);
  const inspectKeys = (value) => {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      assert.ok(!forbiddenKeys.has(key), `debug/audit/provenance key omitted: ${key}`);
      inspectKeys(child);
    }
  };
  inspectKeys(projected);
  assertFrozen(projected);
}

test("projects all six benchmark briefs into materially smaller frozen v2.2 transport records", () => {
  for (const [index, brief] of canonicalBriefs.entries()) {
    assertProjection(brief, projections[index]);
    assert.ok(sizes[index].projected < sizes[index].canonical,
      `fixture ${benchmarkFixtures[index].id}: ${sizes[index].projected} < ${sizes[index].canonical}`);
  }
  console.log("Phase2.2 transport size measurements:", JSON.stringify(benchmarkFixtures.map(({ id }, index) => ({
    fixture: id,
    canonicalCharacters: sizes[index].canonical,
    transportCharacters: sizes[index].projected,
    reductionPercent: Number(((1 - sizes[index].projected / sizes[index].canonical) * 100).toFixed(1)),
  }))));
});

test("preserves projected invariants across deterministic property-style answer inputs", () => {
  let seed = 0x21c0ffee;
  const next = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return 1 + (seed % 5);
  };
  for (let sample = 0; sample < 36; sample += 1) {
    const answers = Array.from({ length: 12 }, next);
    const brief = buildSleepPremiumWriterBrief(buildSleepPremiumInput(answers));
    const projected = projectSleepPremiumWriterBrief(brief);
    assertProjection(brief, projected);
    assert.ok(JSON.stringify(projected).length < JSON.stringify(brief).length, `property sample ${sample} shrinks`);
  }
});

test("rejects non-canonical inputs rather than silently projecting arbitrary objects", () => {
  assert.throws(() => projectSleepPremiumWriterBrief({ version: "premium-writer-transport.v2.2" }), TypeError);
});
