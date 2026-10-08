import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { benchmarkFixtures } from "./debug-sleep-premium-story-material.js";
import { buildSleepPremiumInput } from "../server/sleepPremiumInput.js";
import { buildSleepPremiumWriterBrief } from "../server/sleepPremiumWriterBrief.js";
import { resolveSleepEvidenceCitation } from "../server/sleepEvidenceLibrary.js";
import {
  generateSleepPremiumMaster, isSleepPremiumWriterEnabled, serializeSleepPremiumWriterBrief,
  SLEEP_PREMIUM_WRITER_MODEL, SLEEP_PREMIUM_WRITER_MAX_OUTPUT_TOKENS,
} from "../server/sleepPremiumWriter.js";

const BANNER = "INTERNAL SYNTHETIC BENCHMARK — REVIEW ONLY — CLINICAL/SEMANTIC REVIEW PENDING — NEVER CUSTOMER RELEASE";
const words = (value) => (value.match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu) ?? []).length;

function briefSummary(brief) {
  if (!brief) return null;
  return {
    profile: brief.profile, priority: brief.priority.area,
    primary: brief.primary_insight, secondaries: brief.secondary_insights,
    selected_fact_ids: brief.supporting_facts.map(({ fact_id }) => fact_id),
    supporting_facts: brief.supporting_facts,
    twist: brief.twist, contrasts: brief.contrasts, rivals: brief.rivals,
    best_next_question: brief.best_next_question, do_not_target_first: brief.do_not_target_first,
    supported_positives: brief.supported_positives, prohibited_conclusions: brief.prohibited_conclusions,
    unknown: brief.unknown, science_claim_ids: brief.approved_science.map(({ claim_id }) => claim_id),
    eligible_technique_ids: brief.eligible_techniques.map(({ technique_id }) => technique_id),
    device_ids: brief.explanation_devices.map(({ device_id }) => device_id),
    // Reviewers need the exact actions/restrictions to assess paraphrases.
    experiment7: brief.experiment7,
    original_characters: JSON.stringify(brief).length,
    serialized_characters: serializeSleepPremiumWriterBrief(brief).length,
    evidence_library_version: brief.evidence_library_version,
    review_only: true, release_allowed: false,
  };
}

function copySections(master) {
  const selected = master.insights.map((entry, index) => [entry.title, entry.text, master.supporting_content.insights[index].context].join("\n"));
  return [
    { title: "1. TVOJ PRIORITET #1", text: `${master.priority.area}\n${master.priority.explanation}\nPrvi korak: ${master.priority.first_step}` },
    { title: "2. KAKO SE TVOJA ISKUSTVA POVEZUJU", text: selected.join("\n\n") },
    { title: master.profile === "MIRNA NOĆ" ? "3. ŠTA VREDI DA ZADRŽIŠ" : "3. ŠTA JOŠ VREDI DA PRATIŠ",
      text: master.tracking.length ? master.tracking.join("\n") : "[Nema dodatnog praćenja; očuvanje je u odabranim uvidima. Ova napomena je oznaka prikaza, ne AI tekst.]" },
    { title: "4. TVOJ LIČNI PLAN ZA 7 DANA", text: master.plan7.map((entry, index) => {
      const day = master.supporting_content.days[index];
      return [`Dan ${entry.day}: ${entry.action}`, `Posmatraj: ${entry.observe}`, day.rationale, day.reflection].filter((value) => value !== null).join("\n");
    }).join("\n\n") },
    { title: "5. AKO PRVI KORAK NE ODGOVARA", text: master.alternatives.map(({ text }) => text).join("\n") || "[Nema dodatnih alternativa; nije forsirano.]" },
    { title: "6. OTVORENO PITANJE I ZAVRŠNA MISAO", text: [master.uncertainty.question, master.supporting_content.closing].filter((value) => value !== null).join("\n\n") },
  ];
}

/** Observational flags and word counts, NOT a semantic quality score or
 * automatic verification of efficacy, factual entailment or clinical safety.
 */
function qualityReview(result) {
  const master = result.master;
  if (!master) return { requires_human_review: true, evaluation: "No accepted AI master; no quality success claimed." };
  const insightCopy = master.insights.map((entry, index) => `${entry.title} ${entry.text} ${master.supporting_content.insights[index].context}`).join(" ");
  const adviceCopy = [master.priority.first_step, ...master.tracking, ...master.plan7.flatMap(({ action, observe }) => [action, observe]),
    ...master.alternatives.map(({ text }) => text), ...master.supporting_content.days.flatMap(({ rationale, reflection }) => [rationale, reflection ?? ""])].join(" ");
  const allCopy = [master.intro, master.priority.explanation, insightCopy, adviceCopy, master.uncertainty.question ?? "", master.supporting_content.closing].join(" ");
  const total = words(allCopy);
  const planAnchorsMatch = master.plan7.every((day, index) => day.technique_id === result.brief.experiment7[index].technique_id &&
    JSON.stringify(day.theme_ids) === JSON.stringify(result.brief.experiment7[index].themeIds));
  return {
    requires_human_review: true, evaluation: "Structural observations only; lexical validation is not semantic approval.",
    word_count: total, insight_words: words(insightCopy), advice_labeled_words: words(adviceCopy),
    advice_labeled_word_ratio: total ? Number((words(adviceCopy) / total).toFixed(3)) : null,
    advice_ratio_definition: "Words in first step/tracking/actions/observations/alternatives/day support divided by all generated prose words; not a claim classifier.",
    structural_flags: {
      primary_anchor_first: master.insights[0].insight_id === result.brief.primary_insight.insight_id,
      exact_day_technique_and_theme_anchors: planAnchorsMatch,
      selected_question_kept: !result.brief.best_next_question || master.uncertainty.question !== null,
      distinct_science_claims: master.provenance.evidence_ids.length,
      distinct_devices: master.provenance.device_ids.length,
    },
    review_questions: [
      "Does the primary relationship actually carry the report, rather than just appearing as an ID?",
      "Are all personal statements entailed by scoped facts, without questionnaire recitation or invented co-occurrence?",
      "Are rival interpretations and missing information genuinely retained, not converted into a cause?",
      "Does every paraphrased action retain optionality, stop rules and limits, without extra tasks?",
      "Do science/device explanations stay within the exact selected claims and their limitations?",
      "Is the Serbian natural, calm and restrained, with preservation rather than invented problems for MIRNA NOĆ?",
      "Does the report explain more than it advises? Inspect the word ratio, not just the counts.",
    ],
  };
}

// Extra privacy guard for REJECTED output: it has not passed the copy gate.
// Accepted reports are already validated. Do not reproduce SDK messages/raw
// invalid JSON, identifiers or potentially secret-looking rejected strings.
function reviewerDraft(draft) {
  const redact = (value) => {
    if (typeof value === "string") return /\S+@\S+|https?:\/\/|\b(?:sk[-_]|pk_|whsec_|bearer\s|password|credential|api[_ -]?key|secret)|\b[\w-]{24,}\b|(?:\+?\d[\s().-]*){7,}/iu.test(value)
      ? "[withheld: possible identifier/credential in unvalidated draft]" : value;
    if (Array.isArray(value)) return value.map(redact);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, child]) => [redact(key), redact(child)]));
    return value;
  };
  return redact(draft);
}

/** Pure formatter. Full six-section copy plus server-resolved claim/source
 * records and anchored trace; no second model, auto-review or file writes.
 * JSON output can be captured explicitly by the operator as a review artifact.
 */
export function formatBenchmark(result, { fixtureId = "unspecified", format = "text" } = {}) {
  const accepted = result.source === "ai" && result.master !== null;
  const claims = accepted ? result.master.provenance.evidence_ids.map((id) => resolveSleepEvidenceCitation(id)) : [];
  const report = {
    banner: BANNER, fixture: fixtureId,
    status: accepted ? "GENERATED_REVIEW_ONLY" : "FALLBACK_NOT_AI_MASTER",
    source: result.source, model: SLEEP_PREMIUM_WRITER_MODEL,
    max_output_tokens: SLEEP_PREMIUM_WRITER_MAX_OUTPUT_TOKENS,
    request_count: result.requestCount, usage: result.usage,
    failure_type: result.failureType, reason: result.reason, failure_status: result.failureStatus ?? null,
    validation: result.validation, legacy_fallback_validation: result.legacyFallbackValidation ?? null,
    review_only: true, release_allowed: false, clinical_review_status: "pending", semantic_review_required: true,
    brief_summary: briefSummary(result.brief), quality_review: qualityReview(result),
    introduction: accepted ? result.master.intro : null,
    sections: accepted ? copySections(result.master) : [],
    master: accepted ? result.master : null,
    // Preview holds complete server-resolved source notes and registry snapshot.
    preview: accepted ? result.preview ?? null : null,
    evidence_notes: claims,
    technique_notes: accepted ? result.brief.eligible_techniques.filter(({ technique_id }) => result.master.provenance.technique_ids.includes(technique_id)) : [],
    device_notes: accepted ? result.brief.explanation_devices.filter(({ device_id }) => result.master.provenance.device_ids.includes(device_id)) : [],
    trace: accepted ? {
      primary: result.master.provenance.primary_insight_id,
      insights: result.master.insights.map(({ insight_id, evidence_ids, device_id }) => ({ insight_id, evidence_ids, device_id })),
      days: result.master.plan7.map(({ day, technique_id, theme_ids }) => ({ day, technique_id, theme_ids })),
      alternatives: result.master.alternatives.map(({ technique_id, theme_ids }) => ({ technique_id, theme_ids })),
      uncertainty_fact_ids: result.master.uncertainty.anchor_fact_ids,
    } : null,
    legacy_fallback: result.legacyFallback ?? null,
    rejected_draft: result.rejectedDraft ? reviewerDraft(result.rejectedDraft) : null,
    rejected_draft_withheld: result.rejectedDraftWithheld ?? false,
    incomplete_diagnostics: result.incompleteDiagnostics ?? null,
  };
  if (format === "json") return JSON.stringify(report, null, 2);
  return [BANNER, `FIXTURE: ${fixtureId} | ${report.status} | source=${result.source}`,
    `MODEL: ${report.model} | max_output_tokens=${report.max_output_tokens} | calls=${report.request_count}`,
    `USAGE (actual; null means unavailable): ${JSON.stringify(report.usage)}`,
    `VALIDATION: ${JSON.stringify(report.validation)} | FAILURE: ${report.failure_type ?? "none"} | ${report.reason}`,
    "BRIEF SUMMARY / EXACT REVIEW BOUNDARIES:", JSON.stringify(report.brief_summary, null, 2),
    ...(accepted ? ["FULL AI REPORT — INTERNAL REVIEW ONLY", `PROFILE: ${result.master.profile}`, report.introduction,
      ...report.sections.flatMap(({ title, text }) => [title, text]),
      "SERVER-RESOLVED EVIDENCE NOTES (claim/evidence/source IDs, complete limits and bibliography):", JSON.stringify(report.evidence_notes, null, 2),
      "TECHNIQUE NOTES:", JSON.stringify(report.technique_notes, null, 2),
      "DEVICE NOTES:", JSON.stringify(report.device_notes, null, 2),
      "ANCHOR TRACE:", JSON.stringify(report.trace, null, 2)] : [
      "NO ACCEPTED AI MASTER. No preview or generated success is claimed.",
      `LEGACY FALLBACK VALIDATION: ${JSON.stringify(report.legacy_fallback_validation)}`,
      "LEGACY FALLBACK — SEPARATE DETERMINISTIC v2, NOT AN AI MASTER:", JSON.stringify(report.legacy_fallback, null, 2),
      "REJECTED CANDIDATE — NOT ACCEPTED / NOT CUSTOMER COPY:", report.rejected_draft_withheld ? "[withheld by privacy gate]" : JSON.stringify(report.rejected_draft, null, 2),
      "INCOMPLETE METADATA ONLY:", JSON.stringify(report.incomplete_diagnostics, null, 2),
    ]),
    "QUALITY REVIEW — HUMAN REQUIRED, NO AUTOMATIC SUCCESS CLAIM:", JSON.stringify(report.quality_review, null, 2),
  ].join("\n\n");
}

/** CLI: real SDK only, sequential single-call reports. Reads existing env files
 * without override; never creates credentials, sets staging flags or writes to
 * payments/reports/production config. --json emits one aggregate JSON document
 * on stdout (writer's safe diagnostic prefixes go to stderr).
 */
export async function runSleepPremiumWriterBenchmarks({ json = false, includeRejectedDraft = false } = {}) {
  const { default: dotenv } = await import("../server/node_modules/dotenv/lib/main.js");
  dotenv.config({ path: fileURLToPath(new URL("../server/.env", import.meta.url)), override: false });
  dotenv.config({ path: fileURLToPath(new URL("../.env", import.meta.url)), override: false });
  const keyAvailable = Boolean(process.env.OPENAI_API_KEY?.trim());
  const enabled = isSleepPremiumWriterEnabled();
  const prerequisites = { api_key_available: keyAvailable, staging_gate_enabled: enabled };
  if (!keyAvailable || !enabled) {
    const blocked = { banner: BANNER, status: "BLOCKED", prerequisites,
      reason: !keyAvailable ? "OPENAI_API_KEY unavailable; no live reports generated, no API calls, no mocks." : "Requires premium-ai-staging and ENABLE_PREMIUM_AI_PREVIEW=true; flags were not changed.",
      model: SLEEP_PREMIUM_WRITER_MODEL, max_output_tokens: SLEEP_PREMIUM_WRITER_MAX_OUTPUT_TOKENS,
      request_count: 0, review_only: true, release_allowed: false,
      fixtures: benchmarkFixtures.map((fixture) => {
        const brief = buildSleepPremiumWriterBrief(buildSleepPremiumInput(fixture.answers));
        return { fixture: fixture.id, status: "BLOCKED", expected_profile: fixture.expectedProfile,
          actual_profile: brief.profile, request_count: 0, master: null, brief_summary: briefSummary(brief) };
      }) };
    console.log(json ? JSON.stringify(blocked, null, 2) : [BANNER, "BLOCKED — NO LIVE CALLS / NO GENERATED REPORTS",
      blocked.reason, `PREREQUISITES: ${JSON.stringify(prerequisites)}`,
      ...blocked.fixtures.map((fixture) => `${fixture.fixture}: BLOCKED | ${fixture.actual_profile} | primary=${fixture.brief_summary.primary.insight_id} | brief=${fixture.brief_summary.serialized_characters} chars | calls=0`),
    ].join("\n"));
    return { ...blocked, exitCode: 1 };
  }
  const { default: OpenAI } = await import("../server/node_modules/openai/index.mjs");
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0, timeout: 60000 });
  const reports = [];
  // Keep --json stdout machine-readable without silencing any usage entry.
  // An injected sink affects ONLY the new writer, never the old logger/global console.
  for (const fixture of benchmarkFixtures) {
    const input = buildSleepPremiumInput(fixture.answers);
    if (input.profile !== fixture.expectedProfile) throw new Error("Synthetic benchmark profile contract changed.");
    const result = await generateSleepPremiumMaster({ input, openaiClient: client, apiKeyAvailable: true,
      internalBenchmark: true, includeRejectedDraft, logUsage: json ? console.error : console.log });
    reports.push(JSON.parse(formatBenchmark(result, { fixtureId: fixture.id, format: "json" })));
    if (!json) console.log(formatBenchmark(result, { fixtureId: fixture.id }));
  }
  const failures = reports.filter((report) => report.source !== "ai" || report.request_count !== 1);
  const summary = { banner: BANNER, status: failures.length ? "REVIEW_WITH_FAILURES" : "GENERATED_REVIEW_ONLY",
    fixture_count: reports.length, request_count: reports.reduce((sum, report) => sum + report.request_count, 0),
    accepted_structural_masters: reports.filter((report) => report.source === "ai").length,
    failed_fixtures: failures.map(({ fixture }) => fixture), human_review_required: true,
    clinical_review_status: "pending", release_allowed: false, reports };
  console.log(json ? JSON.stringify(summary, null, 2) : `BENCHMARK SUMMARY: ${JSON.stringify({ ...summary, reports: undefined })}`);
  return { ...summary, exitCode: failures.length ? 1 : 0 };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some((arg) => !["--json", "--include-rejected-draft"].includes(arg))) {
    console.error("Supported options: --json, --include-rejected-draft (internal synthetic review only).");
    process.exitCode = 1;
  } else {
    runSleepPremiumWriterBenchmarks({ json: args.includes("--json"), includeRejectedDraft: args.includes("--include-rejected-draft") })
      .then(({ exitCode }) => { process.exitCode = exitCode; })
      .catch(() => { console.error("BLOCKED/FAILED: benchmark could not finish. No credentials or raw API errors are printed."); process.exitCode = 1; });
  }
}