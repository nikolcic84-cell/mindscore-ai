import { loadSleepEvidenceLibrary, resolveSleepEvidenceCitation } from "./sleepEvidenceLibrary.js";

const SIGNAL_FACTS = Object.freeze({
  short_sleep: ["Q5"], morning_difficulty: ["Q1"], daytime_sleepiness: ["Q8"],
  daytime_fatigue: ["Q8"], active_thoughts: ["Q2", "Q7"], onset_difficulty: ["Q2"],
  bedtime_content: ["Q6"], night_awakenings: ["Q3"], return_difficulty: ["Q3"],
  variable_timing: ["Q9", "Q10"], alarm_difficulty: ["Q4"],
  longer_without_alarm: ["Q9"], overall_dissatisfaction: ["Q12"],
});
const CLINICAL = new Set(["CBTI_STRONG", "STIMULUS_CONTROL_CONDITIONAL", "RELAXATION_CONDITIONAL"]);
const CLINICAL_PREREQUISITES = ["age", "symptom_duration", "breathing_symptoms", "medication",
  "medical_history", "driving_impairment", "actual_sleep_opportunity"];

// Text exclusions in the registry are not executable policy. These local rules
// narrow relevance; they never turn flags or absent unknowns into clinical clearance.
function policyFor(id, active, difficulty) {
  const any = (...flags) => flags.filter((flag) => active(flag));
  const both = (a, b) => active(a) && active(b) ? [a, b] : [];
  switch (id) {
    case "ADULT_SLEEP_7H": return { signals: any("short_sleep"), family: "duration", concept: "sleep_duration" };
    case "LONG_SLEEP_CONTEXT": return { signals: both("longer_without_alarm", "short_sleep"), family: "duration", concept: "duration_context" };
    case "SLEEP_MULTIDIMENSIONAL": {
      const signals = Object.keys(SIGNAL_FACTS).filter(active);
      return { signals: signals.length >= 2 ? signals : [], family: "whole_picture", concept: "multiple_aspects" };
    }
    case "TWO_PROCESS_MODEL": return { signals: active("variable_timing") ? any("variable_timing")
      : both("active_thoughts", "onset_difficulty"), family: "regulation", concept: "sleep_timing" };
    case "TODO_WRITING_LAB":
    case "TODO_SPECIFICITY_ASSOCIATION": return { signals: any("active_thoughts"), family: "task_writing", concept: "active_thoughts" };
    case "QUIET_PREBED_GUIDANCE": return { signals: active("bedtime_content") &&
      (active("onset_difficulty") || active("active_thoughts")) ? any("bedtime_content", "onset_difficulty", "active_thoughts") : [],
    family: "wind_down", concept: "bedtime_transition" };
    case "REGULAR_TIMES_GUIDANCE": return { signals: any("variable_timing"), family: "regularity", concept: "sleep_timing" };
    case "DIARY_CORE_OBSERVATION":
    case "DIARY_VALIDATION_BOUNDARY": return { signals: difficulty ? Object.keys(SIGNAL_FACTS).filter(active) : [],
      family: "diary", concept: "self_observation", difficulty_relevance: difficulty };
    case "CBTI_STRONG": return { signals: any("onset_difficulty", "return_difficulty", "overall_dissatisfaction"), family: "clinical", concept: "insomnia_care" };
    case "STIMULUS_CONTROL_CONDITIONAL": return { signals: any("onset_difficulty", "return_difficulty"), family: "clinical", concept: "insomnia_care" };
    case "RELAXATION_CONDITIONAL": return { signals: both("active_thoughts", "onset_difficulty"), family: "clinical", concept: "insomnia_care" };
    case "HYGIENE_NOT_STANDALONE": return { signals: any("onset_difficulty", "overall_dissatisfaction"), family: "clinical_boundary", concept: "insomnia_care" };
    default: return { signals: [], family: id, concept: null };
  }
}

/** Local-only educational retrieval. Accepts the {facts, flags, unknown} facts
 * contract. maxClaims is a strict integer 0..4. Supplied registries are resolved
 * through the canonical validator (no invented bibliography or mutated input).
 * Optional claim.education_only === true permits clinical CONTEXT only; it does
 * not establish assessment prerequisites or authorize any clinical action.
 */
export function retrieveSleepPremiumEvidence(facts, { library = loadSleepEvidenceLibrary(), maxClaims = 4 } = {}) {
  if (!Number.isInteger(maxClaims) || maxClaims < 0 || maxClaims > 4) {
    throw new RangeError("maxClaims must be an integer from 0 to 4.");
  }
  if (!facts || !Array.isArray(facts.facts) || !facts.flags || typeof facts.flags !== "object" ||
    Array.isArray(facts.flags) || !Array.isArray(facts.unknown)) {
    throw new TypeError("Retrieval requires { facts, flags, unknown }.");
  }
  if (!library || !Array.isArray(library.claims) || !Array.isArray(library.sources)) {
    throw new TypeError("Retrieval requires a local evidence registry.");
  }
  const unknown = new Set(facts.unknown.map((entry) => typeof entry === "string" ? entry : entry.id));
  const known = (flag) => !unknown.has(flag) && !unknown.has(`flags.${flag}`) &&
    Object.hasOwn(facts.flags, flag) && typeof facts.flags[flag] === "boolean";
  const active = (flag) => known(flag) && facts.flags[flag] === true;
  const difficultyFacts = facts.facts.filter((fact) => fact.kind === "difficulty");
  const excluded = [];
  const candidates = [];
  for (const claim of library.claims) {
    if (claim.status !== "active") {
      excluded.push({ claim_id: claim.claim_id, reasons: ["inactive_claim"] });
      continue;
    }
    // Validates all source IDs and citation metadata even when this claim has
    // no personal relevance. A broken clone must not silently fabricate sources.
    const citation = resolveSleepEvidenceCitation(claim.claim_id, library);
    const policy = policyFor(claim.claim_id, active, difficultyFacts.length > 0);
    const reasons = [];
    if (citation.sources.some((source) => source.status !== undefined && source.status !== "active")) {
      reasons.push("inactive_or_retired_source");
    }
    if (!claim.applicability.all.every(({ flag, equals }) => known(flag) && facts.flags[flag] === equals)) {
      reasons.push("registry_predicates_not_met_or_unknown");
    }
    if (!policy.signals.length && !policy.difficulty_relevance) reasons.push("no_personal_relevance");
    const clinical = CLINICAL.has(claim.claim_id);
    if (clinical && claim.education_only !== true) {
      reasons.push("clinical_assessment_not_established");
      reasons.push(...CLINICAL_PREREQUISITES.filter((id) => unknown.has(id)).map((id) => `unknown_prerequisite:${id}`));
    }
    if (claim.claim_id === "HYGIENE_NOT_STANDALONE" && claim.education_only !== true) {
      reasons.push("education_need_not_established");
      if (unknown.has("symptom_duration")) reasons.push("unknown_prerequisite:symptom_duration");
    }
    if (reasons.length) {
      excluded.push({ claim_id: claim.claim_id, reasons });
      continue;
    }
    const questionIds = new Set(policy.signals.flatMap((flag) => SIGNAL_FACTS[flag]));
    const linkedFacts = facts.facts.filter((fact) => questionIds.has(fact.questionId) ||
      (policy.difficulty_relevance && fact.kind === "difficulty"));
    // Signal match dominates a modest evidence-description bonus. Guideline
    // prestige cannot outweigh population mismatch or missing clinical assessment.
    const quality = ({ expert_consensus: 2, public_health_education: 1,
      small_randomized_laboratory_study: 1, conceptual_review: 0,
      expert_consensus_measurement_development: 1, within_study_association: 0 })[claim.evidence_type] ?? 0;
    const score = 10 * Math.min(3, policy.signals.length || linkedFacts.length) + quality -
      (policy.family === "diary" ? 8 : 0) - (clinical || policy.family === "clinical_boundary" ? 15 : 0);
    candidates.push({ ...structuredClone(claim), ...structuredClone(citation),
      source_ids: [...claim.source_ids], topic_ids: [...claim.topic_ids], questionIds: [...claim.questionIds],
      fact_ids: linkedFacts.map(({ fact_id }) => fact_id), matched_signals: [...policy.signals],
      relevance_reason: `Selected answers support ${policy.concept}: ${linkedFacts.map(({ fact_id }) => fact_id).join(", ")}. This is context, not a cause or diagnosis.`,
      concept: policy.concept, redundancy_family: policy.family,
      ranking: { signal_score: score, quality_bonus: quality },
      applicability_restrictions: [...claim.exclusions, ...claim.limitations,
        // The facts contract supplies no verified age, even if a caller omits
        // the unknown marker. Its absence is not proof of population fit.
        "Age is not established; population-limited evidence is educational, not an individual prescription.",
        "Clinical review is pending; source verification does not authorize release.",
        ...(clinical || policy.family === "clinical_boundary" ? ["Education only; clinical prerequisites are not established and no autonomous actions are allowed."] : []),
        ...(claim.claim_id === "LONG_SLEEP_CONTEXT" ? ["Longer sleep or hypothetical time in bed without an alarm does not establish sleep debt or more than nine hours."] : [])],
      action_eligible: !clinical && policy.family !== "clinical_boundary",
      release_allowed: false,
    });
  }
  const selected = [];
  const duplicate = (a, b) => a.redundancy_family === b.redundancy_family ||
    (a.source_ids.some((id) => b.source_ids.includes(id)) && a.topic_ids.some((id) => b.topic_ids.includes(id)));
  while (candidates.length && selected.length < maxClaims) {
    const topics = new Set(selected.flatMap(({ topic_ids }) => topic_ids));
    const rank = (entry) => entry.ranking.signal_score + (entry.topic_ids.some((id) => !topics.has(id)) ? 8 : 0);
    candidates.sort((a, b) => rank(b) - rank(a) || (a.claim_id < b.claim_id ? -1 : a.claim_id > b.claim_id ? 1 : 0));
    const next = candidates.shift();
    const repeated = selected.find((entry) => duplicate(entry, next));
    if (repeated) excluded.push({ claim_id: next.claim_id, reasons: [`redundant_with:${repeated.claim_id}`] });
    else selected.push(next);
  }
  for (const entry of candidates) {
    const repeated = selected.find((chosen) => duplicate(chosen, entry));
    excluded.push({ claim_id: entry.claim_id, reasons: [repeated ? `redundant_with:${repeated.claim_id}` : "selection_limit"] });
  }
  return { version: "sleep-premium-evidence-retrieval.v1", claims: selected, excluded, release_allowed: false };
}