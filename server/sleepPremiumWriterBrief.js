import { buildSleepPremiumStoryMaterial } from "./sleepPremiumStoryMaterial.js";
import { loadSleepEvidenceLibrary } from "./sleepEvidenceLibrary.js";

const unique = (values) => [...new Set(values)];

// Phase 1 contrast IDs are not always the Phase 1.5 insight IDs. A shared
// answer alone is NOT sufficient to promote a rejected contrast into the brief.
const CONTRAST_INSIGHTS = Object.freeze({
  duration_morning_free_day: ["duration_recovery"],
  easy_onset_difficult_return: ["easy_onset_difficult_return"],
  calm_routine_active_thoughts: ["calm_routine_active_thoughts"],
  variable_timing_reported_duration: ["variable_timing_duration"],
  awakening_and_tiredness: ["awakening_daytime_relation", "continuity_daytime_relation"],
});

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

function insightBrief(insight, activeClaimIds) {
  if (!insight) return null;
  return {
    insight_id: insight.insight_id,
    fact_ids: insight.fact_ids,
    relationship: insight.relationship,
    why_it_matters: insight.why_it_matters,
    non_obvious: insight.non_obvious,
    interpretation_status: insight.uncertainty.status,
    uncertainty: { text: insight.uncertainty.text, unknown_ids: insight.uncertainty.unknown_ids },
    // These flags must survive the projection: a generic fallback is not a
    // discovered relationship. Do not turn its copy into a specific insight.
    genericity_flags: insight.genericity_flags,
    evidence_claim_ids: insight.evidence_claim_ids.filter((id) => activeClaimIds.has(id)),
  };
}

// Collect dependencies from the projected records, not the raw Phase 1 dump.
// This also covers rival limiting facts and every allocated BASELINE theme.
function referencedFactIds(value, ids = new Set()) {
  if (!value || typeof value !== "object") return ids;
  for (const [key, child] of Object.entries(value)) {
    if (key.endsWith("fact_ids")) child.forEach((id) => ids.add(id));
    else if (key === "comparison_groups") child.flat().forEach((id) => ids.add(id));
    else referencedFactIds(child, ids);
  }
  return ids;
}

/**
 * Synchronous, server-only Phase 2 projection of Phase 1.5 selected material.
 * Input and options are exactly buildSleepPremiumStoryMaterial's canonical
 * input and retrieval options ({library?, maxClaims?}); validation stays there.
 * The exact top-level API is the return literal below, including the agreed
 * deduplicated supporting_facts field. No model, prompt or report adapter runs.
 *
 * supporting_facts carries only referenced observational descriptions and
 * verbatim qualifiers, never the twelve-question/selected-answer payload,
 * mapped values, dimensions or internal scores. The future server-constructed
 * legacy answer_evidence adapter must use the original canonical input, not
 * reconstruct answer text from this brief. questionId/fact_id are its anchors.
 * All twelve facts can legitimately be referenced by an existing baseline or
 * preservation story; that is not permission to independently reclassify them.
 *
 * source_ref is an array of source IDs ONLY. Bibliography must be resolved
 * later on the server; source verification and approved draft wording do not
 * constitute clinical approval. Unknown IDs remain unknown, not negative
 * findings. Every output is detached and recursively frozen, including when
 * a mutable custom evidence library is supplied.
 */
export function buildSleepPremiumWriterBrief(input, options = {}) {
  const base = buildSleepPremiumStoryMaterial(input, options);
  const story = base.story_material;
  const plan = base.editorial_plan;
  const library = options.library ?? loadSleepEvidenceLibrary();
  const claims = base.retrieval.claims.filter(({ status }) => status === "active");
  const claimIds = new Set(claims.map(({ claim_id }) => claim_id));
  const selectedInsights = [story.primary_insight, ...story.secondary_insights.slice(0, 2)].filter(Boolean);
  const selectedIds = new Set(selectedInsights.map(({ insight_id }) => insight_id));

  const approved_science = claims.map((claim) => ({
    claim_id: claim.claim_id,
    evidence_id: claim.evidence_id,
    concept: claim.concept,
    fact_ids: claim.fact_ids,
    approved_claim: claim.approved_claim,
    plain_serbian: claim.plain_serbian,
    evidence_type: claim.evidence_type,
    strength: claim.strength,
    directness: claim.directness,
    limits: unique([...claim.applicability_restrictions, ...claim.does_not_establish]),
    source_ref: unique(claim.source_ids),
    action_eligible: claim.action_eligible,
    clinical_review_status: claim.reviewmetadata.clinical_review_status,
    release_allowed: false,
  }));
  const eligible_techniques = base.techniques.eligible.map((entry) => ({
    technique_id: entry.technique_id,
    purpose: entry.purpose,
    mode: entry.mode,
    claim_ids: entry.claim_ids,
    evidence_ids: entry.evidence_ids,
    // Context that was not retrieved is not extra authorized science.
    contextual_claim_ids: (entry.contextual_claim_ids || []).filter((id) => claimIds.has(id)),
    approved_actions: entry.approved_actions,
    observe: entry.observe,
    burden: entry.burden,
    limits: unique([...entry.exclusions.notes, ...entry.no_promises, ...entry.escalation]),
    clinical_review_status: entry.reviewmetadata.clinical_review_status,
    release_allowed: false,
  }));
  const contrasts = plan.contrasts.filter(({ contrast_id }) =>
    CONTRAST_INSIGHTS[contrast_id]?.some((id) => selectedIds.has(id))).map((entry) => ({
    contrast_id: entry.contrast_id,
    fact_ids: entry.fact_ids,
    observation: entry.observation,
    explanation: entry.explanation,
    open_question: entry.open_question,
    unknown_ids: entry.unknown_ids,
    does_not_establish: entry.does_not_establish,
  }));
  const explanation_devices = plan.explanation_devices.slice(0, 2).map((entry) => ({
    device_id: entry.device_id,
    concept: entry.concept,
    fact_ids: entry.fact_ids,
    explanation: entry.explanation,
    does_not_imply: entry.does_not_imply,
  }));
  const experiment7 = plan.experiment.map((entry) => ({
    day: entry.day,
    purpose: entry.purpose,
    themeIds: entry.themeIds,
    ...(Object.hasOwn(entry, "differentActionFromDay2And3")
      ? { differentActionFromDay2And3: entry.differentActionFromDay2And3 } : {}),
    fact_ids: entry.fact_ids,
    technique_id: entry.technique_id,
    mode: entry.mode,
    action: entry.action,
    observe: entry.observe,
    restrictions: unique(entry.restrictions),
    release_allowed: false,
  }));
  const do_not_target_first = story.do_not_target_first.map((entry) => ({
    target_id: entry.target_id,
    fact_ids: entry.fact_ids,
    reason: entry.reason,
    qualification: entry.qualification,
  }));
  const supported_positives = plan.supported_positive.map(({ fact_id }) => ({ fact_id }));
  const primary_insight = insightBrief(story.primary_insight, claimIds);
  const secondary_insights = story.secondary_insights.slice(0, 2).map((entry) => insightBrief(entry, claimIds));
  const rivals = story.rival_explanations.slice(0, 3).map((entry) => ({
    interpretation: entry.interpretation,
    supporting_fact_ids: entry.supporting_fact_ids,
    limiting_fact_ids: entry.limiting_fact_ids,
    missing_information: entry.missing_information,
    discriminating_observation: entry.discriminating_observation,
    prohibited_causal_conclusion: entry.prohibited_causal_conclusion,
    interpretation_status: entry.interpretation_status,
    comparison_groups: entry.comparison_groups,
  }));
  const best_next_question = story.best_next_question && {
    question: story.best_next_question.question,
    why_it_matters: story.best_next_question.why_it_matters,
    what_different_answers_would_clarify: story.best_next_question.what_different_answers_would_clarify,
    fact_ids: story.best_next_question.fact_ids,
    unknown_ids: story.best_next_question.unknown_ids,
  };
  const twist = story.twist && {
    insight_id: story.twist.insight_id,
    fact_ids: story.twist.fact_ids,
    text: story.twist.text,
    interpretation_status: story.twist.interpretation_status,
    unknown_ids: story.twist.unknown_ids,
  };
  const refs = referencedFactIds({ primary_insight, secondary_insights, twist, contrasts, rivals,
    best_next_question, do_not_target_first, approved_science, explanation_devices, experiment7 });
  plan.priority_justification.fact_ids.forEach((id) => refs.add(id));
  supported_positives.forEach(({ fact_id }) => refs.add(fact_id));
  const facts = base.facts.facts.filter(({ fact_id }) => refs.has(fact_id));
  const supporting_facts = facts.map((fact) => ({
    fact_id: fact.fact_id,
    questionId: fact.questionId,
    description: fact.description,
    frequency: fact.frequency,
    uncertainty: fact.uncertainty,
    qualifiers: fact.qualifiers,
  }));

  // Keep general safety plus only referenced fact/selected-story boundaries.
  // Science/technique/device/day limits already live beside their records;
  // repeating them here would recreate the Phase 1 audit dump.
  const factBoundaries = new Set(base.facts.facts.flatMap(({ not_supported }) => not_supported));
  const scienceBoundaries = new Set(claims.flatMap((claim) =>
    [...claim.applicability_restrictions, ...claim.does_not_establish]));
  const localLimits = new Set([
    ...scienceBoundaries,
    ...eligible_techniques.flatMap(({ limits }) => limits),
    ...contrasts.flatMap(({ does_not_establish }) => does_not_establish),
    ...explanation_devices.flatMap(({ does_not_imply }) => does_not_imply),
    ...experiment7.flatMap(({ restrictions }) => restrictions),
  ]);
  const prohibited_conclusions = unique([
    ...base.prohibited_conclusions.filter((text) => !factBoundaries.has(text) && !scienceBoundaries.has(text)),
    ...facts.flatMap(({ not_supported }) => not_supported),
    ...selectedInsights.flatMap(({ prohibited_conclusions }) => prohibited_conclusions),
    "Promena postojećeg profila ili prioriteta",
    "Nepoznati zdravstveni podaci nisu negativan klinički nalaz.",
  ]).filter((text) => !localLimits.has(text));

  return deepFreeze(structuredClone({
    version: "premium-writer-brief.v1",
    profile: base.profile,
    priority: { area: plan.priority_justification.area, title: "TVOJ PRIORITET #1" },
    supporting_facts,
    primary_insight,
    secondary_insights,
    twist,
    contrasts,
    rivals,
    best_next_question,
    do_not_target_first,
    supported_positives,
    approved_science,
    eligible_techniques,
    explanation_devices,
    experiment7,
    prohibited_conclusions,
    unknown: unique(base.unknown.map(({ id }) => id)),
    review_only: true,
    release_allowed: false,
    evidence_library_version: library.version,
  }));
}