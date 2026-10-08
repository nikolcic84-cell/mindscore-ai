import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { buildSleepPremiumInput } from "../server/sleepPremiumInput.js";
import { buildSleepPremiumStoryMaterial } from "../server/sleepPremiumStoryMaterial.js";

// Synthetic raw answer points, not option indexes. Expected names are regression
// expectations; both the CLI and tests calculate the actual canonical profile.
export const benchmarkFixtures = Object.freeze([
  { id: "current", answers: [4, 5, 2, 3, 5, 4, 4, 3, 4, 4, 3, 3], expectedProfile: "ISPREKIDAN SAN" },
  { id: "budan", answers: [5, 1, 5, 5, 5, 4, 1, 5, 5, 5, 5, 5], expectedProfile: "BUDAN UM" },
  { id: "umoran", answers: [1, 5, 5, 1, 5, 5, 5, 1, 5, 5, 1, 5], expectedProfile: "UMORAN SAN" },
  { id: "pressure", answers: [2, 2, 2, 2, 3, 2, 2, 2, 2, 2, 2, 2], expectedProfile: "SAN POD PRITISKOM" },
  { id: "calm", answers: Array(12).fill(5), expectedProfile: "MIRNA NOĆ" },
  { id: "second_isprekidan", answers: [5, 5, 1, 5, 3, 5, 5, 5, 1, 1, 5, 1], expectedProfile: "ISPREKIDAN SAN" },
].map((fixture) => Object.freeze({ ...fixture, answers: Object.freeze(fixture.answers) })));

const json = (value) => JSON.stringify(value);
const joined = (values) => values.length ? values.join("; ") : "none";

/** Pure, compact plaintext inspection of actual Phase 1 + Phase 1.5 records.
 * No prose clipping, invented explanations, bibliographic duplication or calls
 * to AI/network/persistence. Long record lines deliberately retain all limits.
 */
export function formatSleepPremiumStoryMaterialDebug(analysis) {
  const s = analysis.story_material;
  const p = s.primary_insight;
  const plan = analysis.editorial_plan;
  const lines = ["LOCAL SYNTHETIC STORY MATERIAL — INTERNAL DRAFT, NOT RELEASED",
    `PROFILE: ${analysis.profile}; release_allowed=${analysis.release_allowed}`];
  const section = (heading, records) => {
    lines.push(heading);
    lines.push(...(records.length ? records.map((record) => `  ${record}`) : ["  none — not forced"]));
  };
  section("SUPPORTED FACTS — ALL 12, SHORT VALUES WITH SOURCE QUALIFIERS", analysis.facts.facts.map((f) =>
    `${f.fact_id} ${f.questionId} option=${f.selected_option_index} ${f.kind}: ${f.selected_answer} | ${f.description} | frequency=${json(f.frequency)} uncertainty=${json(f.uncertainty)} scope=${joined(f.qualifiers)}`));
  section("SUPPORTED POSITIVE — PRESERVE ONLY WHAT WAS SELECTED", plan.supported_positive.map((f) =>
    `${f.fact_id}: ${f.description}; frequency=${json(f.frequency)} uncertainty=${json(f.uncertainty)}`));
  section("THEMES", [
    `priority=${analysis.theme_plan.priority_theme}; area=${analysis.theme_plan.priority_area}`,
    ...analysis.theme_plan.theme_map.map((t) => `${t.theme_id}: ${t.summary}; focus=${joined(t.focusQuestionIds)}; evidence=${json(t.evidence)}`),
  ]);
  section("CANDIDATE INSIGHTS — RANKING REASONS, NOT CONFIDENCE", s.candidate_insights.map((c, index) =>
    `rank=${index + 1} ${c.insight_id} score=${c.score}; facts=${joined(c.fact_ids)}; evidence=${joined(c.evidence_claim_ids)}; criteria=${json(c.criteria)}; genericity=${json(c.genericity_flags)}`));
  section("REJECTED / LOWER VALUE — EXCLUSION REASONS", s.rejected_or_lower_value_candidates.map((c) =>
    `${c.insight_id}: ${c.reason}; predicate=${json(c.criteria?.required_predicates ?? c.required_predicates)} met=${c.criteria?.predicate_met ?? c.predicate_met}; facts=${joined(c.fact_ids ?? [])}; evidence=${joined(c.evidence_claim_ids)}; score=${c.score ?? "not applicable"}`));
  section("PRIMARY — FACTS / WHY / NONOBVIOUS / EVIDENCE / UNCERTAINTY / PROHIBITED", [
    `${p.insight_id}; facts=${joined(p.fact_ids)}`,
    `Relationship: ${p.relationship}`,
    `Why: ${p.why_it_matters}`,
    `Nonobvious: ${p.non_obvious}`,
    `Evidence: ${joined(p.evidence_claim_ids)}`,
    `Uncertainty: ${json(p.uncertainty)}`,
    `Prohibited: ${joined(p.prohibited_conclusions)}`,
    `Specificity: ${json(s.specificity_check)}`,
  ]);
  section("SECONDARY — AT MOST TWO", s.secondary_insights.map((c) =>
    `${c.insight_id}; facts=${joined(c.fact_ids)}; ${c.relationship} Why: ${c.why_it_matters} Nonobvious: ${c.non_obvious}; evidence=${joined(c.evidence_claim_ids)}; uncertainty=${json(c.uncertainty)}; prohibited=${joined(c.prohibited_conclusions)}`));
  section("SO WHAT", [json(s.so_what)]);
  section("RIVALS — SUPPORT / LIMIT / MISSING / OBSERVATION / PROHIBITION", s.rival_explanations.map(json));
  section("BEST NEXT QUESTION — WHY / DISTINCT OUTCOMES", s.best_next_question ? [json(s.best_next_question)] : []);
  section("QUESTION CANDIDATES — INFORMATION VALUE", s.question_candidates.map(json));
  section("DO NOT FIX FIRST — REFERENCES AND QUALIFICATION", s.do_not_target_first.map(json));
  section("MAIN STORY — FIXED PHASE 1 PRIORITY", [json(s.main_story)]);
  section("TWIST — NEVER MANUFACTURED", s.twist ? [json(s.twist)] : []);
  section("CONTRAST — PHASE 1 OBSERVATIONS AND LIMITS", plan.contrasts.map(json));
  section("OPEN QUESTION", s.open_question ? [json(s.open_question)] : []);
  section("SCIENCE — SELECTED APPROVED CLAIMS / SOURCE IDS / DOI / REVIEW PENDING", analysis.retrieval.claims.map((c) =>
    `${c.claim_id} ${c.evidence_id} revision=${c.revision} concept=${c.concept}; approved=${c.approved_claim}; Serbian=${c.plain_serbian}; facts=${joined(c.fact_ids)}; relevance=${c.relevance_reason}; evidence=${c.evidence_type}/${c.strength}/${c.directness}; review=${c.reviewmetadata.clinical_review_status}; release=${c.release_status}/${c.release_allowed}; sources=${json(c.sources.map(({ source_id, doi, review_status }) => ({ source_id, doi, review_status })))}; restrictions=${joined(c.applicability_restrictions)}; does_not_establish=${joined(c.does_not_establish)}`));
  section("EXCLUDED SCIENCE — REASONS", analysis.retrieval.excluded.map((c) => `${c.claim_id}: ${joined(c.reasons)}`));
  section("TECHNIQUES — ELIGIBLE / EXCLUDED WITH REASONS", [
    ...analysis.techniques.eligible.map((t) => `ELIGIBLE ${t.technique_id}: ${t.purpose}; reasons=${json(t.reasons)}; rules=${json(t.rules)}; claims=${joined(t.claim_ids)}; contextual=${joined(t.contextual_claim_ids ?? [])}; basis=${t.evidence_basis}; actions=${json(t.approved_actions)}; education=${json(t.approved_education)}; observe=${json(t.observe)}; burden=${json(t.burden)}; review=${t.reviewmetadata.clinical_review_status}; release=${t.release_allowed}`),
    ...analysis.techniques.excluded.map((t) => `EXCLUDED ${t.technique_id}: ${joined(t.reasons)}; missing_claims=${joined(t.missing_claim_ids)}; missing_prerequisites=${joined(t.missing_prerequisites)}; rules=${json(t.rules)}; education=${json(t.approved_education)}; release=${t.release_allowed}`),
  ]);
  section("DEVICES — CONCEPT / REFERENCES / LIMITS", plan.explanation_devices.map(json));
  section("EXPERIMENT — SEVEN UNCHANGED PHASE 1 ALLOCATIONS", plan.experiment.map(json));
  // De-duplicate shared boundaries without dropping any fact-, claim-, story-
  // or technique-specific prohibition, including excluded clinical actions.
  const boundaries = [...new Set([
    ...analysis.prohibited_conclusions,
    ...analysis.facts.facts.flatMap((f) => f.not_supported),
    ...s.candidate_insights.flatMap((c) => c.prohibited_conclusions),
    ...analysis.retrieval.claims.flatMap((c) => [...c.applicability_restrictions, ...c.does_not_establish]),
    ...[...analysis.techniques.eligible, ...analysis.techniques.excluded].flatMap((t) =>
      [...t.exclusions.notes, ...t.no_promises, ...t.escalation]),
  ])];
  // Eight short boundaries per plaintext record keeps the benchmark near 120
  // lines, while numbering every boundary and preserving its complete text.
  const boundaryLines = [];
  for (let index = 0; index < boundaries.length; index += 8) {
    boundaryLines.push(boundaries.slice(index, index + 8).map((text, offset) => `${index + offset + 1}) ${text}`).join(" | "));
  }
  section("PROHIBITED — ALL BOUNDARIES", boundaryLines);
  section("UNKNOWN — ALL, NOT NEGATIVE FINDINGS OR CLINICAL CLEARANCE", analysis.unknown.map((u) => `${u.id}: ${u.label}`));
  return lines.join("\n");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const fixture of benchmarkFixtures) {
    const input = buildSleepPremiumInput(fixture.answers);
    if (input.profile !== fixture.expectedProfile) throw new Error(`Profile regression: ${fixture.id}: ${input.profile}`);
    console.log(`\n=== BENCHMARK ${fixture.id} ===\n${formatSleepPremiumStoryMaterialDebug(buildSleepPremiumStoryMaterial(input))}`);
  }
}