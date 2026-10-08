import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildSleepPremiumInput, SLEEP_PREMIUM_PROFILE_NAMES } from "../server/sleepPremiumInput.js";
import { buildSleepPremiumFacts } from "../server/sleepPremiumFacts.js";
import { buildSleepPremiumPreAiAnalysis } from "../server/sleepPremiumEditorialPlan.js";
import { buildSleepPremiumStoryMaterial } from "../server/sleepPremiumStoryMaterial.js";
import { loadSleepEvidenceLibrary } from "../server/sleepEvidenceLibrary.js";
import { benchmarkFixtures, formatSleepPremiumStoryMaterialDebug } from "./debug-sleep-premium-story-material.js";

const fixtures = Object.fromEntries(benchmarkFixtures.map((f) => [f.id, f.answers]));
const analyze = (answers, options) => buildSleepPremiumStoryMaterial(buildSleepPremiumInput(answers), options);
const material = (answers, options) => analyze(answers, options).story_material;
const freeze = (value) => {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
const changed = (answers, index, points) => answers.map((answer, i) => i === index ? points : answer);
const candidate = (s, id) => s.candidate_insights.find((c) => c.insight_id === id);
const weighted = (weights, values) => Object.entries(weights).reduce((n, [key, weight]) => n + (values[key] ? weight : 0), 0);

// Independent interpreter: evaluate the public executable predicates against
// canonical facts, never profile names, generated text similarity or ranking.
function predicateMatches(predicate, facts) {
  if (predicate.all) return predicate.all.every((p) => predicateMatches(p, facts));
  if (predicate.any) return predicate.any.some((p) => predicateMatches(p, facts));
  if (predicate.flag) return facts.flags[predicate.flag] === predicate.equals;
  const f = facts.facts.find((entry) => entry.questionId === predicate.questionId);
  assert.ok(f, `canonical predicate dependency ${predicate.questionId}`);
  return predicate.kind ? f.kind === predicate.kind : predicate.selected_option_indexes.includes(f.selected_option_index);
}

function assertReferences(value, analysis) {
  const factIds = new Set(analysis.facts.facts.map((f) => f.fact_id));
  const unknownIds = new Set(analysis.unknown.map((u) => u.id));
  const claimIds = new Set(analysis.retrieval.claims.map((c) => c.claim_id));
  const visit = (object) => {
    if (!object || typeof object !== "object") return;
    for (const [key, v] of Object.entries(object)) {
      const valid = key.endsWith("fact_ids") ? factIds : key === "unknown_ids" ? unknownIds
        : key === "evidence_claim_ids" ? claimIds : null;
      if (valid) {
        assert.ok(Array.isArray(v), key);
        assert.equal(new Set(v).size, v.length, `unique ${key}`);
        for (const id of v) assert.ok(valid.has(id), `valid selected ${key}: ${id}`);
      }
      if (key === "fact_id") assert.ok(factIds.has(v), v);
      if (key === "unknown_id") assert.ok(unknownIds.has(v), v);
      if (key === "release_allowed") assert.equal(v, false);
      visit(v);
    }
  };
  visit(value);
}

function assertContract(answers, options = {}) {
  const savedAnswers = structuredClone(answers);
  const input = freeze(buildSleepPremiumInput(answers));
  const savedInput = structuredClone(input);
  const savedOptions = structuredClone(options);
  const base = buildSleepPremiumPreAiAnalysis(input, options);
  const out = buildSleepPremiumStoryMaterial(input, options);
  const { story_material: s, ...phase1 } = out;
  assert.deepEqual(phase1, base, "wrapper leaves every Phase 1 field unchanged");
  assert.deepEqual(out.facts, buildSleepPremiumFacts(input));
  assert.deepEqual(out, buildSleepPremiumStoryMaterial(input, options), "deterministic fresh output");
  assert.deepEqual(answers, savedAnswers);
  assert.deepEqual(input, savedInput);
  assert.deepEqual(options, savedOptions);
  assert.equal(out.profile, input.profile);
  assert.equal(out.release_allowed, false);
  assert.deepEqual(s.main_story.fixed_priority, base.editorial_plan.priority_justification);
  assert.deepEqual(s.main_story.fixed_priority, out.editorial_plan.priority_justification);
  assert.equal(s.so_what.does_not_change_priority, true);
  assert.equal(out.facts.facts.length, 12);
  assert.ok(out.facts.facts.every((f) => f.interpretation_candidates.length === 0));
  assert.deepEqual(out.editorial_plan.supported_positive, out.facts.facts.filter((f) => f.kind === "positive"));
  assert.deepEqual(out.editorial_plan.experiment, base.editorial_plan.experiment);
  assert.equal(out.editorial_plan.experiment.length, 7);
  for (const [index, allocation] of out.theme_plan.allocation.seven_day_plan.entries()) {
    for (const [key, value] of Object.entries(allocation)) assert.deepEqual(out.editorial_plan.experiment[index][key], value);
  }
  assertReferences(s, out);
  for (const record of [...out.retrieval.claims, ...out.techniques.eligible, ...out.techniques.excluded, ...out.editorial_plan.experiment]) {
    assert.equal(record.release_allowed, false);
  }
  const ids = s.candidate_insights.map((c) => c.insight_id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(s.primary_insight, s.candidate_insights[0]);
  assert.ok(s.secondary_insights.length <= 2);
  assert.ok(s.rival_explanations.length <= 3);
  const covered = new Set(s.primary_insight.fact_ids);
  for (const c of s.secondary_insights) {
    assert.deepEqual(c, candidate(s, c.insight_id));
    assert.notEqual(c.insight_id, s.primary_insight.insight_id);
    assert.equal(c.criteria.penalties.existing_duplicate.applied, false);
    assert.ok(c.fact_ids.some((id) => !covered.has(id)), "secondary adds distinct canonical dependency");
    c.fact_ids.forEach((id) => covered.add(id));
  }
  assert.deepEqual(new Set(s.main_story.fact_ids), covered);
  for (const [index, c] of s.candidate_insights.entries()) {
    const k = c.criteria;
    assert.equal(k.predicate_met, true);
    assert.equal(predicateMatches(k.required_predicates, out.facts), true);
    assert.deepEqual(k.dependency_fact_ids, c.fact_ids);
    assert.ok(c.fact_ids.length >= 2);
    assert.equal(k.score_use, "internal_editorial_utility_only_not_confidence");
    assert.equal(c.score, weighted(k.weights, k.values) - Object.values(k.penalties).reduce((n, p) => n + (p.applied ? p.weight : 0), 0));
    assert.equal(k.values.evidence_available_bounded, c.evidence_claim_ids.length > 0);
    for (const id of c.evidence_claim_ids) {
      const claim = out.retrieval.claims.find((entry) => entry.claim_id === id);
      assert.ok(claim.fact_ids.some((factId) => c.fact_ids.includes(factId)));
      assert.ok(claim.applicability_restrictions.length && claim.does_not_establish.length);
    }
    for (const qualifier of c.uncertainty.source_qualifiers) {
      const f = out.facts.facts.find((entry) => entry.fact_id === qualifier.fact_id);
      assert.deepEqual(qualifier.frequency, f.frequency);
      assert.equal(qualifier.uncertainty, f.uncertainty);
    }
    for (const id of c.fact_ids) {
      const f = out.facts.facts.find((entry) => entry.fact_id === id);
      for (const boundary of f.not_supported) assert.ok(c.prohibited_conclusions.includes(boundary));
    }
    if (index) {
      const prev = s.candidate_insights[index - 1];
      assert.ok(prev.score > c.score || (prev.score === c.score && (prev.fact_ids.length > c.fact_ids.length ||
        (prev.fact_ids.length === c.fact_ids.length && prev.insight_id.localeCompare(c.insight_id, "en") <= 0))));
    }
    const duplicate = k.penalties.existing_duplicate;
    if (duplicate.applied) {
      const covering = candidate(s, duplicate.covered_by);
      assert.ok(covering.fact_ids.length > c.fact_ids.length);
      assert.ok(c.fact_ids.every((id) => covering.fact_ids.includes(id)));
      assert.deepEqual(k.comparison_groups, covering.criteria.comparison_groups);
    }
  }
  for (const r of s.rejected_or_lower_value_candidates) {
    assert.ok(r.reason);
    if (r.reason === "not_applicable") {
      assert.equal(predicateMatches(r.required_predicates, out.facts), false);
      assert.equal(r.predicate_met, false);
      assert.deepEqual(r.evidence_claim_ids, []);
      assert.equal(Object.hasOwn(r, "relationship"), false, "unmet rule has no unsupported personal copy");
    } else assert.ok(ids.includes(r.insight_id));
  }
  const p = s.primary_insight;
  assert.equal(s.specificity_check.method, "executable_predicates_and_canonical_dependencies_not_text_similarity");
  assert.equal(s.specificity_check.passed, p.criteria.predicate_met && p.criteria.values.grounded_multiple_facts &&
    p.criteria.distinct_scope_count >= 2 && p.genericity_flags.length === 0 && !p.criteria.penalties.unsupported.applied &&
    (p.criteria.preservation || p.criteria.values.separate_experiences));
  for (const [index, q] of s.question_candidates.entries()) {
    assert.equal(q.rank, index + 1);
    assert.equal(q.score, weighted(q.criteria.weights, q.criteria.values) + q.criteria.dependency_coverage_bonus);
    assert.equal(q.criteria.already_collected, false);
    assert.equal(q.criteria.diagnostic, false);
    assert.equal(q.criteria.score_use, "internal_information_value_only");
    assert.equal(q.optional, true);
    assert.ok(!input.answers.some((entry) => entry.question === q.question));
    assert.ok(q.unknown_ids.includes("co_occurrence_same_days"));
    assert.ok(q.what_different_answers_would_clarify.length >= 2);
    const c = candidate(s, q.insight_id);
    assert.deepEqual(q.fact_ids, c.question_fact_ids);
    if (index) assert.ok(s.question_candidates[index - 1].score >= q.score);
  }
  if (s.best_next_question) {
    const { question, why_it_matters, what_different_answers_would_clarify, fact_ids, unknown_ids } = s.question_candidates[0];
    assert.deepEqual(s.best_next_question, { question, why_it_matters, what_different_answers_would_clarify, fact_ids, unknown_ids });
    assert.deepEqual(s.open_question, { text: question, fact_ids, unknown_ids });
  } else {
    assert.deepEqual(s.question_candidates, []);
    assert.equal(s.open_question, null);
  }
  const meaningfulRivals = Boolean(s.best_next_question && !p.criteria.preservation && !p.genericity_flags.length && p.criteria.comparison_groups.length === 2);
  assert.equal(s.rival_explanations.length > 0, meaningfulRivals);
  for (const r of s.rival_explanations) {
    assert.ok(r.supporting_fact_ids.length >= 2);
    assert.ok(Array.isArray(r.limiting_fact_ids)); // A pair need not have a third, limiting fact.
    assert.deepEqual(r.comparison_groups, p.criteria.comparison_groups);
    assert.ok(r.missing_information.length);
    assert.ok(r.missing_information.every((m) => m.unknown_id === "co_occurrence_same_days"));
    assert.ok(r.discriminating_observation && r.prohibited_causal_conclusion);
    assert.equal(r.interpretation_status, "noncausal_hypothesis");
  }
  for (const n of s.do_not_target_first) {
    assert.ok(n.fact_ids.length && n.reason && n.qualification);
    assert.equal(n.fixed_priority_key, base.editorial_plan.priority_justification.key);
  }
  // Inspect affirmative personal prose only. Prohibition/education text is
  // allowed to name diagnoses in order to forbid them, not attribute them.
  const personal = [s.main_story.text, s.so_what.text, ...s.candidate_insights.flatMap((c) =>
    [c.relationship, c.why_it_matters, c.non_obvious, c.question ?? "", ...c.what_different_answers_would_clarify]),
  ...s.rival_explanations.flatMap((r) => [r.interpretation, r.discriminating_observation])].join("\n");
  assert.doesNotMatch(personal, /(?:imaš|patiš od|dokazuje da imaš|tvoja dijagnoza je)\s+(?:hroničn\S*\s+)?(?:nesanic\S*|apnej\S*|insomnia|sleep apnea|depresij\S*|poremećaj\S*)/iu);
  return out;
}

test("six verified benchmarks span all five canonical profiles and distinct same-profile relationships", () => {
  assert.ok(benchmarkFixtures.length >= 6);
  assert.equal(new Set(benchmarkFixtures.map((f) => f.id)).size, benchmarkFixtures.length);
  for (const f of benchmarkFixtures) assert.equal(assertContract(f.answers).profile, f.expectedProfile, f.id);
  assert.deepEqual(new Set(benchmarkFixtures.map((f) => analyze(f.answers).profile)), new Set(SLEEP_PREMIUM_PROFILE_NAMES));
  const a = material(fixtures.current), b = material(fixtures.second_isprekidan);
  assert.equal(a.primary_insight.insight_id, "continuity_daytime_relation");
  assert.equal(b.primary_insight.insight_id, "fragmented_night_preserved_daytime");
  assert.notDeepEqual(a.primary_insight.criteria.required_predicates, b.primary_insight.criteria.required_predicates);
  assert.notDeepEqual(a.primary_insight.fact_ids, b.primary_insight.fact_ids);
  assert.notEqual(a.main_story.text, b.main_story.text);
});

test("current high-value night/day interpretation outranks declaration order and onset/return question", () => {
  const s = material(fixtures.current);
  const primary = s.primary_insight;
  const simpler = candidate(s, "easy_onset_difficult_return");
  const redundant = candidate(s, "awakening_daytime_relation");
  assert.deepEqual(primary.fact_ids, ["FACT_Q5", "FACT_Q3", "FACT_Q8"]);
  assert.ok(primary.score > simpler.score);
  assert.equal(redundant.criteria.penalties.existing_duplicate.covered_by, primary.insight_id);
  const questions = s.question_candidates;
  assert.equal(questions[0].insight_id, primary.insight_id);
  assert.ok(questions[0].score > questions.find((q) => q.insight_id === simpler.insight_id).score);
  assert.ok(s.rival_explanations.every((r) => r.limiting_fact_ids.includes("FACT_Q1")));
  // Canonical answers may arrive shuffled. Ranking must not follow input order.
  const shuffled = buildSleepPremiumInput(fixtures.current);
  shuffled.answers.reverse();
  assert.deepEqual(buildSleepPremiumStoryMaterial(shuffled).story_material, s);
  // duration_recovery is declared before recovery_despite_calm_night in the
  // actual API. When both apply, the higher-value later rule still wins.
  const laterWins = material(changed(changed(fixtures.umoran, 4, 2), 8, 4));
  assert.ok(candidate(laterWins, "duration_recovery"));
  assert.equal(laterWins.primary_insight.insight_id, "recovery_despite_calm_night");
  assert.ok(laterWins.primary_insight.score > candidate(laterWins, "duration_recovery").score);
});

test("controlled Q3 easy, Q6 active, Q5 short and Q10 variable changes obey actual predicates", () => {
  const cases = [
    { base: fixtures.current, index: 2, value: 5, removed: "continuity_daytime_relation", primary: "rested_morning_daytime_difficulty" },
    { base: fixtures.budan, index: 5, value: 1, removed: "calm_routine_active_thoughts", primary: "onset_thoughts_calm_night" },
    { base: fixtures.current, index: 4, value: 2, removed: "continuity_daytime_relation", primary: "rested_morning_daytime_difficulty" },
  ];
  for (const c of cases) {
    const before = material(c.base);
    const after = assertContract(changed(c.base, c.index, c.value));
    assert.equal(predicateMatches(candidate(before, c.removed).criteria.required_predicates, after.facts), false);
    assert.equal(candidate(after.story_material, c.removed), undefined);
    assert.equal(after.story_material.primary_insight.insight_id, c.primary);
  }
  const regular = material(fixtures.current);
  const variable = assertContract(changed(fixtures.current, 9, 1)).story_material;
  assert.equal(candidate(regular, "variable_timing_duration"), undefined);
  assert.ok(candidate(variable, "variable_timing_duration"));
  assert.equal(variable.primary_insight.insight_id, regular.primary_insight.insight_id);
  assert.notDeepEqual(variable.secondary_insights.map((c) => c.insight_id), regular.secondary_insights.map((c) => c.insight_id));
});

test("specificity depends on predicates and canonical dependencies, not extremes or forced surprise", () => {
  for (const answers of [
    [3, 5, 2, 5, 4, 5, 5, 5, 5, 5, 5, 5],
    [1, 5, 5, 5, 2, 5, 5, 5, 5, 5, 5, 5],
    [3, 5, 3, 5, 5, 5, 5, 4, 5, 5, 5, 5],
    [5, 5, 5, 5, 5, 5, 5, 4, 5, 5, 5, 5],
  ]) {
    const s = assertContract(answers).story_material;
    assert.equal(s.primary_insight.fact_ids.length, 2);
    assert.deepEqual(s.primary_insight.genericity_flags, []);
    assert.equal(s.specificity_check.passed, true);
  }
  const generic = assertContract([5, 5, 5, 5, 5, 3, 5, 5, 5, 5, 5, 5]).story_material;
  assert.equal(generic.specificity_check.passed, false);
  assert.ok(generic.primary_insight.genericity_flags.includes("unresolved_juxtaposition"));
  assert.deepEqual(generic.rival_explanations, []);
  assert.equal(generic.twist, null);
  const calm = material(fixtures.calm);
  assert.equal(calm.primary_insight.insight_id, "preserve_calm_features");
  assert.equal(calm.specificity_check.passed, true);
  assert.equal(calm.primary_insight.criteria.preservation, true);
  assert.equal(calm.best_next_question, null);
  assert.equal(calm.twist, null);
  assert.deepEqual(calm.rival_explanations, []);
  assert.deepEqual(calm.secondary_insights, []);
});

test("positive preservation is specific and Q7 active thoughts never authorize blanket routine reassurance", () => {
  const calm = material(fixtures.calm), current = material(fixtures.current), budan = material(fixtures.budan);
  assert.deepEqual(new Set(calm.do_not_target_first.map((n) => n.target_id)),
    new Set(["faster_initial_onset", "extra_wind_down_rules", "stricter_schedule"]));
  assert.ok(current.do_not_target_first.some((n) => n.target_id === "faster_initial_onset"));
  assert.ok(current.do_not_target_first.some((n) => n.target_id === "extra_wind_down_rules"));
  assert.ok(current.do_not_target_first.some((n) => n.target_id === "stricter_schedule"));
  assert.equal(budan.do_not_target_first.some((n) => n.target_id === "extra_wind_down_rules"), false);
  const active = assertContract(changed(fixtures.calm, 6, 1));
  const n = active.story_material.do_not_target_first.find((entry) => entry.target_id === "faster_initial_onset");
  assert.ok(n.qualification);
  assert.match(n.qualification, /misli/iu);
  assert.equal(active.story_material.do_not_target_first.some((entry) => entry.target_id === "extra_wind_down_rules"), false);
  assert.ok(candidate(active.story_material, "calm_routine_active_thoughts"));
  const variable = material(changed(fixtures.calm, 9, 1));
  assert.equal(variable.do_not_target_first.some((entry) => entry.target_id === "stricter_schedule"), false);
  const difficultOnset = material(changed(fixtures.calm, 1, 1));
  assert.equal(difficultOnset.do_not_target_first.some((entry) => entry.target_id === "faster_initial_onset"), false);
  assert.ok(material(fixtures.umoran).best_next_question.fact_ids.includes("FACT_Q5"));
});

test("retrieval options restrict insight evidence to selected claims and never force evidence or release", () => {
  for (const f of benchmarkFixtures) {
    const out = assertContract(f.answers, { maxClaims: 0 });
    assert.deepEqual(out.retrieval.claims, []);
    assert.ok(out.story_material.candidate_insights.every((c) => !c.evidence_claim_ids.length && !c.criteria.values.evidence_available_bounded));
    assert.ok(out.techniques.eligible.every((t) => !t.claim_ids.length));
  }
  assertContract(fixtures.current, { library: freeze(structuredClone(loadSleepEvidenceLibrary())), maxClaims: 2 });
  assert.throws(() => analyze(fixtures.current, { maxClaims: 5 }), RangeError);
  assert.throws(() => buildSleepPremiumStoryMaterial({ answers: [] }), TypeError);
});

test("output detachment prevents primary, facts, metadata and Phase 1 mutations leaking to inputs or sibling records", () => {
  const input = freeze(buildSleepPremiumInput(fixtures.current));
  const saved = structuredClone(input);
  const before = buildSleepPremiumPreAiAnalysis(input);
  const out = buildSleepPremiumStoryMaterial(input);
  out.story_material.primary_insight.fact_ids.push("TEST_ONLY");
  out.story_material.main_story.fixed_priority.fact_ids.push("TEST_ONLY");
  out.editorial_plan.main_story.fact_ids.push("TEST_ONLY");
  out.facts.facts[0].qualifiers.push("TEST_ONLY");
  assert.ok(out.story_material.candidate_insights.every((c) => !c.fact_ids.includes("TEST_ONLY")));
  assert.ok(!out.editorial_plan.priority_justification.fact_ids.includes("TEST_ONLY"));
  assert.deepEqual(input, saved);
  const { story_material: ignored, ...again } = buildSleepPremiumStoryMaterial(input);
  assert.ok(ignored);
  assert.deepEqual(again, before);
});

test("500 seeded answer sets retain ranking arithmetic, valid selected references, bounded rivals and unchanged Phase 1", () => {
  let seed = 0x51ee150;
  for (let n = 0; n < 500; n += 1) {
    const answers = Array.from({ length: 12 }, () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return 1 + seed % 5;
    });
    assertContract(answers, { maxClaims: n % 5 });
  }
});

test("compact pure formatter includes all requested records, qualifiers and boundaries from actual data", () => {
  for (const f of benchmarkFixtures) {
    const out = freeze(analyze(f.answers));
    const saved = structuredClone(out);
    const text = formatSleepPremiumStoryMaterialDebug(out);
    assert.deepEqual(out, saved);
    assert.equal(text, formatSleepPremiumStoryMaterialDebug(out));
    assert.ok(text.split("\n").length <= 180, "compact plaintext inspection, not full bibliography");
    for (const heading of ["PROFILE:", "SUPPORTED FACTS", "SUPPORTED POSITIVE", "THEMES", "CANDIDATE INSIGHTS", "PRIMARY", "SECONDARY", "SO WHAT", "RIVALS", "BEST NEXT QUESTION", "DO NOT FIX FIRST", "MAIN STORY", "TWIST", "CONTRAST", "OPEN QUESTION", "SCIENCE", "TECHNIQUES", "DEVICES", "EXPERIMENT", "PROHIBITED", "UNKNOWN"]) assert.ok(text.includes(heading), heading);
    for (const fact of out.facts.facts) {
      const line = text.split("\n").find((entry) => entry.startsWith(`  ${fact.fact_id} ${fact.questionId} `));
      assert.ok(line && line.includes(fact.selected_answer) && line.includes(fact.description));
      assert.ok(line.includes(JSON.stringify(fact.frequency)) && line.includes(JSON.stringify(fact.uncertainty)));
      for (const scope of fact.qualifiers) assert.ok(line.includes(scope));
      for (const boundary of fact.not_supported) assert.ok(text.includes(boundary));
    }
    for (const c of out.story_material.candidate_insights) {
      assert.ok(text.includes(JSON.stringify(c.criteria)));
      for (const boundary of c.prohibited_conclusions) assert.ok(text.includes(boundary));
    }
    for (const c of out.retrieval.claims) {
      assert.ok(text.includes(c.claim_id) && text.includes(c.approved_claim));
      for (const source of c.sources) assert.ok(text.includes(source.source_id) && (!source.doi || text.includes(source.doi)));
      for (const boundary of [...c.applicability_restrictions, ...c.does_not_establish]) assert.ok(text.includes(boundary));
    }
    for (const record of [...out.story_material.rival_explanations, ...out.story_material.question_candidates,
      ...out.story_material.do_not_target_first, ...out.editorial_plan.explanation_devices, ...out.editorial_plan.experiment]) {
      assert.ok(text.includes(JSON.stringify(record)), "complete compact record");
    }
    for (const t of [...out.techniques.eligible, ...out.techniques.excluded]) {
      assert.ok(text.includes(t.technique_id));
      for (const boundary of [...t.reasons, ...t.exclusions.notes, ...t.no_promises, ...t.escalation]) assert.ok(text.includes(boundary));
    }
    for (const boundary of out.prohibited_conclusions) assert.ok(text.includes(boundary));
    for (const u of out.unknown) assert.ok(text.includes(`${u.id}: ${u.label}`));
  }
  const real = analyze(fixtures.current);
  const edited = structuredClone(real);
  edited.story_material.primary_insight.why_it_matters = "FORMATTER_SENTINEL_ACTUAL_RECORD";
  edited.unknown.push({ id: "unknown_sentinel", label: "FORMATTER_SENTINEL_UNKNOWN" });
  const text = formatSleepPremiumStoryMaterialDebug(edited);
  assert.ok(text.includes("FORMATTER_SENTINEL_ACTUAL_RECORD") && text.includes("unknown_sentinel: FORMATTER_SENTINEL_UNKNOWN"));
  assert.notEqual(text, formatSleepPremiumStoryMaterialDebug(real));
});

test("fresh import is silent; import, formatting and all six CLI benchmarks work with network APIs blocked", () => {
  const debugUrl = new URL("./debug-sleep-premium-story-material.js", import.meta.url).href;
  const storyUrl = new URL("../server/sleepPremiumStoryMaterial.js", import.meta.url).href;
  const inputUrl = new URL("../server/sleepPremiumInput.js", import.meta.url).href;
  const blockNetwork = `
    import assert from 'node:assert/strict';
    import http from 'node:http'; import https from 'node:https';
    import net from 'node:net'; import tls from 'node:tls'; import dgram from 'node:dgram';
    import {syncBuiltinESMExports} from 'node:module';
    let networkCalls = 0;
    const deny = () => { networkCalls++; throw new Error('Network forbidden in offline story inspection'); };
    globalThis.fetch = deny; globalThis.WebSocket = deny;
    http.request = http.get = https.request = https.get = deny;
    net.connect = net.createConnection = net.Socket.prototype.connect = tls.connect = dgram.createSocket = deny;
    syncBuiltinESMExports();
  `;
  const imports = spawnSync(process.execPath, ["--input-type=module", "-e", `${blockNetwork}
    const oldLog = console.log; const oldWarn = console.warn; const oldError = console.error;
    const logged = []; console.log = console.warn = console.error = (...v) => logged.push(v);
    const debug = await import(${JSON.stringify(debugUrl)});
    const {buildSleepPremiumStoryMaterial: story} = await import(${JSON.stringify(storyUrl)});
    const {buildSleepPremiumInput: input} = await import(${JSON.stringify(inputUrl)});
    assert.deepEqual(logged, []);
    for (const f of debug.benchmarkFixtures) debug.formatSleepPremiumStoryMaterialDebug(story(input(f.answers)));
    assert.deepEqual(logged, []); assert.equal(networkCalls, 0);
    console.log = oldLog; console.warn = oldWarn; console.error = oldError;
  `], { encoding: "utf8" });
  assert.equal(imports.status, 0, imports.stderr);
  assert.equal(imports.stdout, "");
  assert.equal(imports.stderr, "");
  const cli = spawnSync(process.execPath, ["--input-type=module", "-e", `${blockNetwork}
    process.argv[1] = ${JSON.stringify(fileURLToPath(debugUrl))};
    await import(${JSON.stringify(debugUrl)});
    assert.equal(networkCalls, 0);
  `], { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
  assert.equal(cli.status, 0, cli.stderr);
  assert.equal(cli.stderr, "");
  assert.equal((cli.stdout.match(/^=== BENCHMARK /gm) ?? []).length, benchmarkFixtures.length);
  for (const f of benchmarkFixtures) assert.ok(cli.stdout.includes(`=== BENCHMARK ${f.id} ===`));
});