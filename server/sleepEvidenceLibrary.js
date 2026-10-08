import { readFileSync } from "node:fs";

const REGISTRY_URL = new URL("./data-independent-content/sleep-evidence.v1.json", import.meta.url);
const REVIEW_STATUS = "source_verified_clinical_review_pending";
const FLAGS = new Set([
  "short_sleep", "morning_difficulty", "daytime_sleepiness", "daytime_fatigue",
  "active_thoughts", "onset_difficulty", "bedtime_content", "night_awakenings",
  "return_difficulty", "variable_timing", "alarm_difficulty", "longer_without_alarm",
  "overall_dissatisfaction",
]);
const STATUSES = new Set(["active", "inactive", "retired"]);
let cachedLibrary;

function assert(condition, message) {
  if (!condition) throw new TypeError(`Invalid sleep evidence library: ${message}`);
}

function text(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function strings(value, nonempty = false) {
  return Array.isArray(value) && (!nonempty || value.length > 0) &&
    value.every(text) && new Set(value).size === value.length;
}

function https(value) {
  try {
    const url = new URL(value);
    return typeof value === "string" && url.protocol === "https:" &&
      !url.username && !url.password && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function validDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/u.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

function uniqueIds(entries, key) {
  const ids = new Set();
  for (const entry of entries) {
    assert(entry && text(entry[key]) && /^[A-Z][A-Z0-9_]*$/u.test(entry[key]), `invalid ${key}`);
    assert(!ids.has(entry[key]), `duplicate ${key}: ${entry[key]}`);
    ids.add(entry[key]);
  }
  return ids;
}

function validateLibrary(library) {
  assert(library && library.version === "sleep-evidence.v1", "unsupported version");
  assert(library.release_status === "clinical_review_pending", "unreviewed v1 cannot be released");
  assert(text(library.scope) && text(library.predicate_contract), "missing scope/predicate contract");
  assert(Array.isArray(library.sources) && library.sources.length > 0, "missing sources");
  assert(Array.isArray(library.claims) && library.claims.length > 0, "missing claims");
  const sourceIds = uniqueIds(library.sources, "source_id");
  uniqueIds(library.claims, "claim_id");
  uniqueIds(library.claims, "evidence_id");

  for (const source of library.sources) {
    const id = source.source_id;
    assert(text(source.title) && strings(source.authors), `${id}: title/authors`);
    assert(source.organization === null || text(source.organization), `${id}: organization`);
    assert(source.authors.length > 0 || text(source.organization), `${id}: no attribution`);
    assert(Number.isInteger(source.year) && source.year >= 1900, `${id}: year`);
    assert(source.journal === null || text(source.journal), `${id}: journal`);
    assert(source.doi === null || (text(source.doi) && /^10\.\d{4,9}\/\S+$/u.test(source.doi)), `${id}: DOI`);
    assert(https(source.url) && https(source.verified_url), `${id}: URL`);
    if (source.doi !== null) {
      assert(source.url === `https://doi.org/${source.doi}`, `${id}: DOI link mismatch`);
    }
    assert(source.additional_verified_urls === undefined ||
      (strings(source.additional_verified_urls) && source.additional_verified_urls.every(https)), `${id}: additional URLs`);
    assert(text(source.evidence_type) && text(source.verification_excerpt) &&
      text(source.support_location) && text(source.verification_method), `${id}: verification record`);
    assert(validDate(source.verified_at), `${id}: verification date`);
    assert(source.review_status === REVIEW_STATUS, `${id}: review status`);
  }

  for (const claim of library.claims) {
    const id = claim.claim_id;
    assert(Number.isInteger(claim.revision) && claim.revision > 0, `${id}: revision`);
    assert(strings(claim.topic_ids, true), `${id}: topics`);
    assert(text(claim.approved_claim) && text(claim.plain_serbian), `${id}: claim copy`);
    assert(strings(claim.source_ids, true) && claim.source_ids.every((sourceId) => sourceIds.has(sourceId)), `${id}: source links`);
    assert(strings(claim.questionIds) && claim.questionIds.every((questionId) => /^Q(?:[1-9]|1[0-2])$/u.test(questionId)), `${id}: question IDs`);
    for (const field of ["exclusions", "does_not_establish", "limitations"]) {
      assert(strings(claim[field], true), `${id}: ${field}`);
    }
    assert(claim.applicability && Object.keys(claim.applicability).length === 1 &&
      Array.isArray(claim.applicability.all), `${id}: applicability.all`);
    const predicateFlags = new Set();
    for (const predicate of claim.applicability.all) {
      assert(predicate && Object.keys(predicate).length === 2 && FLAGS.has(predicate.flag) &&
        typeof predicate.equals === "boolean", `${id}: unsupported flag predicate`);
      assert(!predicateFlags.has(predicate.flag), `${id}: duplicate flag predicate`);
      predicateFlags.add(predicate.flag);
    }
    assert(text(claim.evidence_type) && text(claim.strength) && text(claim.directness), `${id}: evidence description`);
    assert(STATUSES.has(claim.status), `${id}: status`);
    assert(claim.release_status === "clinical_review_pending", `${id}: release status`);
    const review = claim.reviewmetadata;
    assert(review && validDate(review.source_verified_at) && text(review.support_location) &&
      review.clinical_review_status === "pending" && review.clinician === null &&
      review.clinically_reviewed_at === null, `${id}: no clinical approval may be implied`);
  }
  return library;
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

/** Server-only, synchronous and dependency-free. Returns a cached, deeply frozen registry.
 * `active` means source-verified educational inventory, NEVER release approval.
 * No I/O occurs until this function is called; no remote source fetching at runtime.
 */
export function loadSleepEvidenceLibrary() {
  if (!cachedLibrary) {
    cachedLibrary = deepFreeze(validateLibrary(JSON.parse(readFileSync(REGISTRY_URL, "utf8"))));
  }
  return cachedLibrary;
}

/** Resolve a claim ID, not a source/evidence ID, to deterministic server metadata.
 * No generated bibliography, no inference of applicability, no release authorization.
 * A supplied registry is validated and copied so the caller's object is never frozen.
 */
export function resolveSleepEvidenceCitation(claimId, library = loadSleepEvidenceLibrary()) {
  if (!text(claimId)) throw new TypeError("A nonempty sleep evidence claim ID is required.");
  const registry = library === cachedLibrary ? library : validateLibrary(structuredClone(library));
  const claim = registry.claims.find((entry) => entry.claim_id === claimId);
  if (!claim) throw new RangeError(`Unknown sleep evidence claim ID: ${claimId}`);
  return deepFreeze({
    version: registry.version,
    claim_id: claim.claim_id,
    evidence_id: claim.evidence_id,
    revision: claim.revision,
    status: claim.status,
    release_status: claim.release_status,
    approved_claim: claim.approved_claim,
    plain_serbian: claim.plain_serbian,
    evidence_type: claim.evidence_type,
    strength: claim.strength,
    directness: claim.directness,
    applicability: structuredClone(claim.applicability),
    exclusions: [...claim.exclusions],
    does_not_establish: [...claim.does_not_establish],
    limitations: [...claim.limitations],
    reviewmetadata: structuredClone(claim.reviewmetadata),
    sources: claim.source_ids.map((sourceId) => structuredClone(registry.sources.find((source) => source.source_id === sourceId))),
  });
}