import { SLEEP_PREMIUM_PROFILE_NAMES } from "./sleepPremiumInput.js";

export const SLEEP_PREMIUM_MASTER_VERSION = 1;
const unique = (values) => [...new Set(values)];
const same = (a, b) => a.length === b.length && a.every((value, index) => value === b[index]);
const sameSet = (a, b) => same([...a].sort(), [...b].sort());
const text = (maxLength, description) => ({ type: "string", minLength: 1, maxLength, pattern: "\\S", ...(description ? { description } : {}) });
const enumeration = (values) => values.length ? { type: "string", enum: values } : { type: "string", pattern: "(?!)" };
const nullable = (schema) => ({ anyOf: [schema, { type: "null" }] });
const array = (minItems, maxItems, items) => ({ type: "array", minItems, maxItems, items });
const object = (properties) => ({ type: "object", additionalProperties: false, properties, required: Object.keys(properties) });
const dayNumber = { type: "integer", minimum: 1, maximum: 7 };
const normalize = (value) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/đ/gu, "d").toLowerCase();
const hasHiddenCharacters = (value) => [...value].some((character) => {
  const code = character.codePointAt(0);
  return (code < 32 && ![9, 10, 13].includes(code)) || code === 127 || code === 0x2060 || code === 0xfeff ||
    (code >= 0x200b && code <= 0x200f) || (code >= 0x202a && code <= 0x202e) || (code >= 0x2066 && code <= 0x2069);
});

// Separate policy, not a captured/replayed legacy validator. No citation or
// answer-quote exemption: every generated prose field receives the same checks.
// Medical vocabulary alone is not diagnosis; actual assertions/prescriptions
// are blocked. Writers should still prefer plain nonmedical educational copy.
const INTERNAL = /\b(?:scoring|scores?|dimension\w*|dimenzij\w*|mapped\s*value|internalscores|classifier|klasifikator\w*|ai confidence|algorithm|algoritam|schema|sema|json|prompt\w*|tokens?|tokeni|tokena|threshold\w*|sleeponset|recovery|continuity|rhythm|stable|mixed|weak|theme[_ -]?ids?|fact[_ -]?ids?|claim[_ -]?ids?|question[_ -]?ids?|evidence[_ -]?ids?|insight[_ -]?ids?|device[_ -]?ids?|technique[_ -]?ids?)\b|\bq\d+\b|\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b|\b\d+(?:[.,]\d+)?\s*(?:\/\s*100|%|bod\w*|poen\w*)|\b(?:rezultat|ocena|prag\w*|score)\s*[:=]?\s*(?:je\s*)?\d+(?:[.,]\d+)?/iu;
const SENSITIVE = /\S+@\S+|\b(?:cs_|pi_|cus_|sess_|session[_ -]?|assessment[_ -]?|user[_ -]?id[\s:=_-]*|sk[-_]|pk_(?:live|test)_|whsec_)[\w-]+|\b(?:bearer\s+\S+|(?:password|passwd|credential|api[_ -]?key|access[_ -]?token|secret)\s*[:=]\s*\S+)|\b[0-9a-f]{8}-[0-9a-f-]{27,}\b|(?:\+?\d[\s().-]*){7,}/iu;
const MEDICAL = /\b(?:imas|imate|patis|patite|bolujes|bolujete|tvoj\w*|vasa|vas|you have|you suffer|your)\b.{0,60}\b(?:nesanic\w*|apnej\w*|depres\w*|anksiozn\w*|poremec\w*|bolest\w*|insomnia|apnea|depression)\b|\b(?:dijagnostik\w*|diagnos\w*|medikament\w*|lekov\w*|lek|terapij\w*|lecen\w*|izlec\w*|prescri\w*|treat\w*|cbt[ -]?i|kontrol\w*\s+stimulus\w*)\b|\b(?:zdrav\w*\s+san|odsustvo\s+(?:poremec\w*|bolest\w*)|bez\s+(?:poremec\w*|bolest\w*))\b/iu;
const CAUSAL = /\b(?:uzroku\w+|izaziv\w*|prouzrok\w*|remeti\w*|dovodi\s+do|causes?|caused\s+by|doprin\w*\s+(?:los\w*|problem\w*|teskoc\w*|nesanic\w*|san\w*|spav\w*)|uzrok\s+(?:tvog|tvoj\w*|problema|teskoc\w*|los\w*\s+sna))\b/iu;
const GUARANTEE = /\b(?:sigurn\w*|definitivn\w*|garantovan\w*|poboljs\w*|poprav\w*|izlec\w*|regulis\w*|res\w*|uklon\w*)\b.{0,60}\b(?:san\w*|spav\w*|problem\w*|teskoc\w*)\b|\b(?:san\w*|spav\w*|problem\w*|teskoc\w*)\b.{0,60}\b(?:sigurn\w*|definitivn\w*|garantovan\w*|poboljs\w*|poprav\w*|izlec\w*|regulis\w*|res\w*|uklon\w*)\b|\b(?:guarantee\w*|will\s+(?:improve|fix|cure|solve)|dokaz\w*|potvrdju\w*)\b/iu;
const BIBLIOGRAPHIC = /(?:https?:\/\/|www\.|doi\b|10\.\d{4,9}\/\S+|\b(?:19|20)\d{2}\b|\b(?:pubmed|pmid|isbn|issn|et\s+al|bibliograf\w*|citiran\w*)\b|\[\s*\d+(?:\s*[,–-]\s*\d+)*\s*\])/iu;
const AUTHORITY = /\b(?:studij\w*|istrazivanj\w*|naucn\w*|smernic\w*|studies|research|scientific|guidelines|aasm|nhlbi|nih|univerzitet\w*|university)\b/iu;
const REDUCTION = /\b(?:spavaj\s+manje|(?:skrati\w*|skrac\w*)\s+(?:(?:trajanje|vreme)\s+)?(?:san|sna|spav\w*)|ostani\s+budan\w*|ranij\w*\s+alarm|restrict\w*\s+sleep|sleep\s+restrict\w*|sleep\s+less|stay\s+awake|earlier\s+alarm|precizn\w*\s+doz\w*\s+svetl\w*)\b/iu;

function briefContext(brief) {
  const require = (condition) => { if (!condition) throw new TypeError("Invalid canonical Premium writer brief."); };
  const ids = (entries, key) => {
    require(Array.isArray(entries));
    const values = entries.map((entry) => entry?.[key]);
    require(values.every((id) => typeof id === "string" && id.trim()) && unique(values).length === values.length);
    return values;
  };
  require(brief?.version === "premium-writer-brief.v1" && brief.review_only === true && brief.release_allowed === false);
  require(SLEEP_PREMIUM_PROFILE_NAMES.includes(brief.profile) && typeof brief.priority?.area === "string" && brief.priority.area.trim());
  require(typeof brief.evidence_library_version === "string" && brief.evidence_library_version.trim());
  const facts = ids(brief.supporting_facts, "fact_id");
  require(brief.supporting_facts.every(({ fact_id, questionId }) => /^Q(?:[1-9]|1[0-2])$/u.test(questionId) && fact_id === `FACT_${questionId}`));
  require(brief.primary_insight && Array.isArray(brief.secondary_insights) && brief.secondary_insights.length <= 2);
  const selected = [brief.primary_insight, ...brief.secondary_insights];
  const insights = ids(selected, "insight_id");
  const evidence = ids(brief.approved_science, "claim_id");
  const techniques = ids(brief.eligible_techniques, "technique_id");
  const devices = ids(brief.explanation_devices, "device_id");
  require(brief.approved_science.every((entry) => typeof entry.evidence_id === "string" &&
    Array.isArray(entry.source_ref) && entry.source_ref.length > 0 && entry.source_ref.every((id) => typeof id === "string" && id.trim())));
  require(Array.isArray(brief.unknown) && brief.unknown.every((id) => typeof id === "string" && id.trim()));
  require(selected.every((entry) => Array.isArray(entry.fact_ids) && entry.fact_ids.every((id) => facts.includes(id)) &&
    Array.isArray(entry.evidence_claim_ids) && entry.evidence_claim_ids.every((id) => evidence.includes(id))));
  require(Array.isArray(brief.experiment7) && brief.experiment7.length === 7);
  require(brief.experiment7.every((entry, index) => entry.day === index + 1 &&
    Array.isArray(entry.themeIds) && entry.themeIds.length > 0 && unique(entry.themeIds).length === entry.themeIds.length &&
    entry.themeIds.every((id) => typeof id === "string" && id.trim()) &&
    (entry.technique_id === null || techniques.includes(entry.technique_id))));
  const themes = unique(brief.experiment7.flatMap(({ themeIds }) => themeIds));
  const priorityThemes = brief.experiment7[1].themeIds;
  const alternativeThemes = themes.filter((id) => !priorityThemes.includes(id));
  require(brief.best_next_question === null || (typeof brief.best_next_question?.question === "string" &&
    Array.isArray(brief.best_next_question.fact_ids) && brief.best_next_question.fact_ids.length > 0 &&
    brief.best_next_question.fact_ids.every((id) => facts.includes(id))));
  return { selected, insights, evidence, techniques, devices, facts, themes, alternativeThemes,
    calm: brief.profile === "MIRNA NOĆ" };
}

function makeSchema(brief, ctx) {
  const minInsights = ctx.calm ? 1 : Math.min(2, ctx.insights.length);
  const maxInsights = ctx.insights.length;
  const ids = (allowed, max = allowed.length, min = 0) => array(min, max, enumeration(allowed));
  const prose = "Natural Serbian wellness copy; no machine IDs, bibliography, diagnosis, causes, guarantees or new prescriptions. Clinical/semantic review remains pending.";
  return object({
    version: { type: "integer", enum: [SLEEP_PREMIUM_MASTER_VERSION] },
    profile: enumeration([brief.profile]),
    priority: object({ area: enumeration([brief.priority.area]), explanation: text(700, prose), first_step: text(200, "A concise first step bound to the existing plan, not a second action or priority; semantic review required.") }),
    intro: text(700, prose),
    insights: array(minInsights, maxInsights, object({
      insight_id: enumeration(ctx.insights), title: text(100, prose), text: text(650, prose),
      // Despite the legacy-shaped name, these are selected CLAIM IDs, never EV/source IDs.
      evidence_ids: ids(ctx.evidence, 3), device_id: nullable(enumeration(ctx.devices)),
    })),
    tracking: array(0, ctx.calm || brief.best_next_question === null ? 0 : 2, text(200, prose)),
    // Homogeneous seven-item schema is intentionally manageable for strict AI
    // output. Runtime enforces order and exact day themes; eligible technique
    // IDs alone cannot prove that an action respects the brief's restrictions.
    plan7: array(7, 7, object({ day: dayNumber, action: text(200, prose), observe: text(150, prose),
      technique_id: nullable(enumeration(ctx.techniques)), theme_ids: ids(ctx.themes, ctx.themes.length, 1) })),
    alternatives: array(0, ctx.calm || !ctx.alternativeThemes.length ? 0 : 2, object({
      text: text(300, prose), technique_id: nullable(enumeration(ctx.techniques)),
      theme_ids: ids(ctx.alternativeThemes, ctx.alternativeThemes.length, 1),
    })),
    uncertainty: object({ question: brief.best_next_question === null ? { type: "null" } : nullable(text(300, prose)),
      anchor_fact_ids: ids(brief.best_next_question?.fact_ids ?? [], brief.best_next_question?.fact_ids.length ?? 0) }),
    supporting_content: object({
      insights: array(minInsights, maxInsights, object({ insight_id: enumeration(ctx.insights), context: text(500, "Expand only this anchored insight; no independent profile, priority or advice.") })),
      days: array(7, 7, object({ day: dayNumber, rationale: text(250, "Explain only the existing action; do not introduce another action."), reflection: nullable(text(200, prose)) })),
      closing: text(350, prose),
    }),
    provenance: object({ primary_insight_id: enumeration([brief.primary_insight.insight_id]),
      evidence_ids: ids(ctx.evidence), technique_ids: ids(ctx.techniques), device_ids: ids(ctx.devices) }),
    compliance: object({ no_diagnosis: { type: "boolean", enum: [true] }, no_causation: { type: "boolean", enum: [true] }, no_guarantee: { type: "boolean", enum: [true] } }),
  });
}

/** Standalone INTERNAL v1, not public report v2. No existing generator uses it.
 * Empty allowlists use an impossible string pattern (not an invalid empty enum).
 * Arrays are duplicate-free at runtime; no unsupported tuple schema is needed.
 */
export function buildSleepPremiumMasterJsonSchema(brief) {
  return { type: "json_schema", name: "mindscore_sleep_premium_master_v1", strict: true,
    schema: makeSchema(brief, briefContext(brief)) };
}

const invalid = (field, reason) => ({ valid: false, reason, diagnostic: { field } });

// Walk precisely the emitted schema so type/key/length constraints cannot drift.
function shapeError(value, schema, path = "$") {
  if (schema.anyOf) return schema.anyOf.some((option) => !shapeError(value, option, path)) ? null : invalid(path, "Invalid nullable value.");
  if (schema.enum && !schema.enum.includes(value)) return invalid(path, "Value outside canonical enum.");
  if (schema.type === "null") return value === null ? null : invalid(path, "Expected null.");
  if (schema.type === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).length !== schema.required.length || !schema.required.every((key) => Object.hasOwn(value, key))) return invalid(path, "Expected exact object keys.");
    for (const key of schema.required) {
      const error = shapeError(value[key], schema.properties[key], `${path}.${key}`);
      if (error) return error;
    }
  } else if (schema.type === "array") {
    if (!Array.isArray(value) || value.length < schema.minItems || value.length > schema.maxItems) return invalid(path, "Invalid array count.");
    for (let index = 0; index < value.length; index += 1) {
      const error = shapeError(value[index], schema.items, `${path}[${index}]`);
      if (error) return error;
    }
    if (schema.items.type === "string" && unique(value).length !== value.length) return invalid(path, "Duplicate array entries.");
  } else if (schema.type === "string") {
    if (typeof value !== "string" || (schema.minLength !== undefined && [...value].length < schema.minLength) ||
      (schema.maxLength !== undefined && [...value].length > schema.maxLength) ||
      (schema.pattern && !new RegExp(schema.pattern, "u").test(value))) return invalid(path, "Invalid string or length.");
  } else if (schema.type === "integer") {
    if (!Number.isInteger(value) || (schema.minimum !== undefined && value < schema.minimum) ||
      (schema.maximum !== undefined && value > schema.maximum)) return invalid(path, "Invalid integer.");
  } else if (schema.type === "boolean" && typeof value !== "boolean") return invalid(path, "Expected boolean.");
  return null;
}

function copyFields(master) {
  const fields = [];
  const add = (field, value, science = false) => { if (value !== null) fields.push({ field, value, science }); };
  add("intro", master.intro);
  add("priority.explanation", master.priority.explanation);
  add("priority.first_step", master.priority.first_step);
  master.insights.forEach((entry, index) => {
    add(`insights[${index}].title`, entry.title);
    add(`insights[${index}].text`, entry.text, entry.evidence_ids.length > 0);
    add(`supporting_content.insights[${index}].context`, master.supporting_content.insights[index].context, entry.evidence_ids.length > 0);
  });
  master.tracking.forEach((value, index) => add(`tracking[${index}]`, value));
  master.plan7.forEach((entry, index) => {
    add(`plan7[${index}].action`, entry.action);
    add(`plan7[${index}].observe`, entry.observe);
    add(`supporting_content.days[${index}].rationale`, master.supporting_content.days[index].rationale);
    add(`supporting_content.days[${index}].reflection`, master.supporting_content.days[index].reflection);
  });
  master.alternatives.forEach((entry, index) => add(`alternatives[${index}].text`, entry.text));
  add("uncertainty.question", master.uncertainty.question);
  add("supporting_content.closing", master.supporting_content.closing);
  return fields;
}

/** Nonmutating structural + lexical gate. True compliance flags attest intent,
 * not meaning. IDs cannot prove factual entailment, correct paraphrasing, rival
 * avoidance, or that prose introduces no autonomous advice. Review is REQUIRED.
 * No normalization/repair, legacy validation replay, fallback, or release occurs.
 */
export function validateSleepPremiumMaster(candidate, brief) {
  let ctx;
  try { ctx = briefContext(brief); } catch { return invalid("brief", "Invalid canonical Premium writer brief."); }
  const error = shapeError(candidate, makeSchema(brief, ctx));
  if (error) return error;
  const insightIds = candidate.insights.map(({ insight_id }) => insight_id);
  if (insightIds[0] !== brief.primary_insight.insight_id || unique(insightIds).length !== insightIds.length ||
    !same(insightIds, ctx.insights.filter((id) => insightIds.includes(id)))) return invalid("insights", "Primary must be first, followed only by distinct selected secondaries in canonical order.");
  if (!same(candidate.supporting_content.insights.map(({ insight_id }) => insight_id), insightIds)) return invalid("supporting_content.insights", "Supporting insights must match existing anchors exactly once, in order.");
  for (let index = 0; index < 7; index += 1) {
    const day = candidate.plan7[index];
    const canonical = brief.experiment7[index];
    if (day.day !== index + 1 || candidate.supporting_content.days[index].day !== day.day ||
        !same(day.theme_ids, canonical.themeIds)) return invalid(`plan7[${index}]`, "Day and themes must match the canonical allocation exactly.");
  }
  for (let index = 0; index < candidate.insights.length; index += 1) {
    const insight = candidate.insights[index];
    const anchor = ctx.selected.find(({ insight_id }) => insight_id === insight.insight_id);
    if (!insight.evidence_ids.every((id) => anchor.evidence_claim_ids.includes(id))) return invalid(`insights[${index}].evidence_ids`, "Science must be selected for this specific insight, not merely retrieved elsewhere.");
  }
  const uncertainty = candidate.uncertainty;
  if ((uncertainty.question === null && uncertainty.anchor_fact_ids.length) ||
    (uncertainty.question !== null && !uncertainty.anchor_fact_ids.length)) return invalid("uncertainty", "Question requires nonempty best-question fact subset; null requires empty anchors.");
  for (const [key, used] of [
    ["evidence_ids", unique(candidate.insights.flatMap((entry) => entry.evidence_ids))],
    ["technique_ids", unique([...candidate.plan7, ...candidate.alternatives].map((entry) => entry.technique_id).filter((id) => id !== null))],
    ["device_ids", unique(candidate.insights.map((entry) => entry.device_id).filter((id) => id !== null))],
  ]) {
    if (!sameSet(candidate.provenance[key], used)) return invalid(`provenance.${key}`, "Provenance must equal the exact distinct union of used references.");
  }
  const forbiddenIds = unique([...ctx.insights, ...ctx.evidence, ...ctx.techniques, ...ctx.devices, ...ctx.facts,
    ...ctx.themes, ...brief.approved_science.flatMap((entry) => [entry.evidence_id, ...entry.source_ref]), ...(brief.unknown ?? [])])
    .filter((id) => typeof id === "string").map((id) => {
      const escaped = normalize(id).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
      // Whole metadata tokens only: unknown ID "age" must not reject Serbian
      // "snage". This is not a safety exemption; every other rule still runs.
      return new RegExp(`(?:^|[^\\p{L}\\p{N}_])${escaped}(?=$|[^\\p{L}\\p{N}_])`, "u");
    });
  for (const { field, value, science } of copyFields(candidate)) {
    const copy = normalize(value);
    // Permit only narrow explicit negative sleep-reduction instructions. Never
    // erase an entire sentence: unsafe advice later in it must still be checked.
    const reductionCopy = copy.replace(/\b(?:ne|nemoj)\s+(?:skracuj\w*|skracivati|skrati|spavati\s+manje)\s+(?:san|sna|spavanje)\b/gu, " ");
    if (SENSITIVE.test(copy) || INTERNAL.test(copy) || forbiddenIds.some((id) => id.test(copy)) || hasHiddenCharacters(value)) return invalid(field, "Sensitive or internal metadata in generated copy.");
    if (BIBLIOGRAPHIC.test(copy)) return invalid(field, "Bibliography must be resolved by the server, never generated in copy.");
    if (MEDICAL.test(copy) || CAUSAL.test(copy) || GUARANTEE.test(copy) || REDUCTION.test(reductionCopy)) return invalid(field, "Unsafe diagnosis, prescription, causal, guarantee or sleep-reduction copy.");
    if (AUTHORITY.test(copy) && !science) return invalid(field, "Scientific authority is only allowed in an insight text/context with matching selected evidence references.");
  }
  return { valid: true, master: candidate, reason: "ok", review_only: true, release_allowed: false,
    semantic_review_required: true };
}