import { loadSleepEvidenceLibrary, resolveSleepEvidenceCitation } from "./sleepEvidenceLibrary.js";
import { validateSleepPremiumMaster } from "./sleepPremiumMasterSchema.js";

const unique = (values) => [...new Set(values)];
const sameSet = (a, b) => a.length === b.length && [...a].sort().every((id, index) => id === [...b].sort()[index]);
const freeze = (value) => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

/** Server-only NEW preview model, explicitly NOT a public-v2 report adapter.
 * Throws on invalid master or mismatched registry; never repairs unsafe output.
 * Optional registry supports a canonical custom-library brief and offline tests.
 * sources is server-resolved bibliography, separate from generated prose. All
 * machine references live in registry_snapshot, not display cards. Store that
 * snapshot WITH the validated master for future PDF: same revisions/refs, no AI
 * regeneration or re-resolution against a later registry. No PDF exists here.
 */
export function adaptSleepPremiumMasterForPreview(master, brief, { library = loadSleepEvidenceLibrary() } = {}) {
  const validation = validateSleepPremiumMaster(master, brief);
  if (!validation.valid) {
    const error = new TypeError("Premium master failed validation.");
    error.code = "PREMIUM_MASTER_VALIDATION";
    error.diagnostic = validation.diagnostic;
    throw error;
  }
  if (library.version !== brief.evidence_library_version) throw new TypeError("Premium master evidence registry version mismatch.");
  const claims = master.provenance.evidence_ids.map((claimId) => {
    const citation = resolveSleepEvidenceCitation(claimId, library);
    const selected = brief.approved_science.find((entry) => entry.claim_id === claimId);
    if (citation.status !== "active" || citation.sources.some((source) => source.status !== undefined && source.status !== "active") ||
      citation.evidence_id !== selected.evidence_id || !sameSet(citation.sources.map(({ source_id }) => source_id), selected.source_ref) ||
      ["approved_claim", "plain_serbian", "evidence_type", "strength", "directness"].some((key) => citation[key] !== selected[key])) {
      throw new TypeError("Premium master selected evidence no longer matches registry; rebuild/review the brief, do not repair the master.");
    }
    return citation;
  });
  const sourceIds = unique(claims.flatMap(({ sources }) => sources.map(({ source_id }) => source_id)));
  const sourceRecords = sourceIds.map((id) => claims.flatMap(({ sources }) => sources).find(({ source_id }) => source_id === id));
  const label = (source) => [source.organization || source.authors.join(", "), source.title, String(source.year)].join(" · ");
  const sourceLabels = (claimIds) => unique(claims.filter(({ claim_id }) => claimIds.includes(claim_id))
    .flatMap(({ sources }) => sources.map(label)));
  const model = {
    model_version: "sleep-premium-master-preview.v1",
    profile: master.profile,
    intro: master.intro,
    priority: { area: master.priority.area, explanation: master.priority.explanation, first_step: master.priority.first_step },
    connections: master.insights.map((entry, index) => ({ title: entry.title, text: entry.text,
      context: master.supporting_content.insights[index].context, source_labels: sourceLabels(entry.evidence_ids) })),
    tracking: [...master.tracking],
    plan: master.plan7.map((entry, index) => ({ day: entry.day, action: entry.action, observe: entry.observe,
      rationale: master.supporting_content.days[index].rationale, reflection: master.supporting_content.days[index].reflection })),
    alternatives: master.alternatives.map(({ text }) => ({ text })),
    review: { question: master.uncertainty.question, closing: master.supporting_content.closing },
    sources: sourceRecords.map((source) => ({ label: label(source), title: source.title,
      authors: [...source.authors], organization: source.organization, year: source.year, journal: source.journal,
      doi: source.doi, url: source.url, review_status: source.review_status })),
    review_only: true,
    release_allowed: false,
    source_verification_is_clinical_approval: false,
    clinical_review_status: "pending",
    semantic_review_required: true,
    pdf: { available: false, reason: "Master PDF integration is not implemented." },
    // INTERNAL metadata: do not render this object or the master as user copy.
    registry_snapshot: {
      evidence_library_version: library.version,
      master_version: master.version,
      provenance: structuredClone(master.provenance),
      claims: structuredClone(claims),
      techniques: structuredClone(brief.eligible_techniques.filter(({ technique_id }) => master.provenance.technique_ids.includes(technique_id))),
      devices: structuredClone(brief.explanation_devices.filter(({ device_id }) => master.provenance.device_ids.includes(device_id))),
      insight_anchors: master.insights.map(({ insight_id, evidence_ids, device_id }) => ({ insight_id, evidence_ids: [...evidence_ids], device_id })),
      day_anchors: master.plan7.map(({ day, technique_id, theme_ids }) => ({ day, technique_id, theme_ids: [...theme_ids] })),
      alternative_anchors: master.alternatives.map(({ technique_id, theme_ids }) => ({ technique_id, theme_ids: [...theme_ids] })),
      uncertainty_fact_ids: [...master.uncertainty.anchor_fact_ids],
    },
  };
  return freeze(model);
}