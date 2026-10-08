import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { buildSleepPremiumInput } from "../server/sleepPremiumInput.js";
import { buildSleepPremiumPreAiAnalysis } from "../server/sleepPremiumEditorialPlan.js";

// Same complete synthetic fixture as the canonical staging test. Never import
// that executable test (it would invoke AI); never read stored personal answers.
export const ANSWER_POINTS = Object.freeze([4, 5, 2, 3, 5, 4, 4, 3, 4, 4, 3, 3]);

/** Pure formatter: returns full human-readable local inspection, no logging.
 * The executable entry point prints ONLY the fixed synthetic fixture below.
 */
export function formatSleepPremiumPreAiDebug(analysis) {
  const lines = ["LOCAL SYNTHETIC PRE-AI INSPECTION — NOT RELEASED", `PROFILE: ${analysis.profile}`,
    `RELEASE ALLOWED: ${analysis.release_allowed}`, "", "FACTS — ALL 12 ORIGINAL SELECTIONS"];
  const item = (label, value) => lines.push(`${label}: ${value}`);
  const list = (values) => values.length ? values.forEach((value) => lines.push(`  - ${value}`)) : lines.push("  (none)");
  for (const fact of analysis.facts.facts) {
    item(fact.fact_id, fact.question);
    item("  Original answer", fact.selected_answer);
    item("  Description", fact.description);
    item("  Kind / zero-based option", `${fact.kind} / ${fact.selected_option_index}`);
    item("  Question frequency", fact.frequency.question ?? "not specified");
    item("  Answer frequency", fact.frequency.answer ?? "not specified");
    item("  Uncertainty", fact.uncertainty ?? "not specified");
    item("  Scope qualifiers", fact.qualifiers.join(", "));
    item("  Unsupported", fact.not_supported.join("; "));
  }
  lines.push("", "FLAGS");
  for (const [key, value] of Object.entries(analysis.facts.flags)) item(key, value);
  lines.push("", "THEME PLAN");
  item("Priority theme / area", `${analysis.theme_plan.priority_theme} / ${analysis.theme_plan.priority_area}`);
  for (const theme of analysis.theme_plan.theme_map) item(theme.theme_id,
    `${theme.summary} Focus: ${theme.focusQuestionIds.join(", ") || "none"}; answers: ${theme.evidence.map(({ questionId, answer }) => `${questionId}: ${answer}`).join(" | ")}`);
  const plan = analysis.editorial_plan;
  lines.push("", "MAIN STORY");
  item("Facts", plan.main_story.fact_ids.join(", "));
  lines.push(plan.main_story.text);
  lines.push("", "EXACT PRIORITY JUSTIFICATION");
  item("Area", plan.priority_justification.area);
  item("Facts", plan.priority_justification.fact_ids.join(", "));
  lines.push(plan.priority_justification.text);
  lines.push("", "TWIST");
  item("Supported cross-answer contrast", plan.twist ? `${plan.twist.contrast_id}: ${plan.twist.explanation}` : "none — not manufactured");
  lines.push("", "CONTRASTS");
  for (const contrast of plan.contrasts) {
    item(contrast.contrast_id, contrast.fact_ids.join(", "));
    lines.push(contrast.observation, contrast.explanation, contrast.open_question);
    item("  Does not establish", contrast.does_not_establish.join("; "));
  }
  if (!plan.contrasts.length) lines.push("  (none)");
  lines.push("", "OPEN RELATIONAL QUESTION");
  lines.push(plan.open_question.text);
  item("Facts / unknowns", `${plan.open_question.fact_ids.join(", ")} / ${plan.open_question.unknown_ids.join(", ")}`);
  lines.push("", "SUPPORTED POSITIVE FACTS");
  list(plan.supported_positive.map(({ fact_id, description, selected_answer }) => `${fact_id}: ${description} Original: ${selected_answer}`));
  lines.push("", "SCIENCE — SELECTED CLAIMS AND CANONICAL SOURCES");
  for (const claim of analysis.retrieval.claims) {
    item(claim.claim_id, `${claim.evidence_id}; revision ${claim.revision}; ${claim.concept}`);
    lines.push(claim.approved_claim, claim.plain_serbian, claim.relevance_reason);
    item("  Fact references", claim.fact_ids.join(", "));
    item("  Evidence / strength / directness", `${claim.evidence_type}; ${claim.strength}; ${claim.directness}`);
    item("  Review / release", `${claim.reviewmetadata.clinical_review_status} / ${claim.release_allowed}`);
    for (const source of claim.sources) {
      item("  Source", `${source.source_id}: ${source.title}`);
      item("  Attribution", `${source.authors.join(", ") || source.organization}; ${source.year}; ${source.journal ?? "no journal"}`);
      item("  Organization", source.organization ?? "none");
      item("  DOI", source.doi ?? "none (educational web page)");
      item("  URL", source.url);
      item("  Verified URL", source.verified_url);
      item("  Verification", `${source.verified_at}; ${source.review_status}; ${source.support_location}`);
    }
    lines.push("  Caveats:");
    list([...claim.applicability_restrictions, ...claim.does_not_establish]);
  }
  if (!analysis.retrieval.claims.length) lines.push("  (none — no forced research)");
  lines.push("", "EXCLUDED CLAIMS");
  list(analysis.retrieval.excluded.map(({ claim_id, reasons }) => `${claim_id}: ${reasons.join("; ")}`));
  lines.push("", "ELIGIBLE TECHNIQUES — UNRELEASED DRAFT CANDIDATES");
  for (const technique of analysis.techniques.eligible) {
    item(technique.technique_id, `${technique.purpose}; claims: ${technique.claim_ids.join(", ")}`);
    lines.push(technique.evidence_basis);
    list(technique.approved_actions);
    list([...technique.exclusions.notes, ...technique.no_promises, ...technique.escalation]);
    item("  Burden", technique.burden.description);
  }
  if (!analysis.techniques.eligible.length) lines.push("  (none)");
  lines.push("", "EXCLUDED TECHNIQUES");
  for (const technique of analysis.techniques.excluded) {
    item(technique.technique_id, technique.reasons.join("; "));
    item("  Missing claims", technique.missing_claim_ids.join(", ") || "none");
    item("  Missing prerequisites", technique.missing_prerequisites.join(", ") || "none");
    list(technique.approved_education);
  }
  lines.push("", "EXPLANATION DEVICES — HYPOTHETICAL, AT MOST TWO");
  for (const device of plan.explanation_devices) {
    item(device.device_id, `${device.concept}; ${device.fact_ids.join(", ")}`);
    lines.push(device.explanation);
    list(device.does_not_imply);
  }
  if (!plan.explanation_devices.length) lines.push("  (none — plain facts preferred)");
  lines.push("", "SEVEN-DAY ALLOCATIONS");
  for (const day of plan.experiment) {
    item(`Day ${day.day}`, `${day.purpose}; ${day.themeIds.join(", ")}; ${day.mode}; technique: ${day.technique_id ?? "none"}`);
    item("  Facts", day.fact_ids.join(", "));
    lines.push(day.action, day.observe);
    if (day.fallback_reason) item("  Fallback", day.fallback_reason);
    list(day.restrictions);
  }
  lines.push("", "PROHIBITED CONCLUSIONS");
  list(analysis.prohibited_conclusions);
  lines.push("", "UNKNOWN — NOT NEGATIVE FINDINGS OR CLINICAL CLEARANCE");
  list(analysis.unknown.map(({ id, label }) => `${id}: ${label}`));
  return lines.join("\n");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(formatSleepPremiumPreAiDebug(buildSleepPremiumPreAiAnalysis(buildSleepPremiumInput(ANSWER_POINTS))));
}