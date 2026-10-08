import { loadSleepEvidenceLibrary } from "./sleepEvidenceLibrary.js";

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

const ESCALATION = Object.freeze([
  "Ako teškoće traju, pogoršavaju se ili ometaju svakodnevno funkcionisanje, razgovaraj sa lekarom.",
  "Ako si pospan/a za volanom, nemoj voziti; obezbedi bezbedan prevoz i potraži stručni savet.",
  "Hrkanje sa prekidima disanja, gušenjem ili izraženom dnevnom pospanošću zahteva stručnu procenu, ne samo promenu rutine.",
]);

function technique(entry) {
  return {
    ...entry,
    revision: 1,
    status: "active",
    release_status: "clinical_review_pending",
    release_allowed: false,
    no_promises: ["Nema obećanja boljeg sna, kraćeg uspavljivanja ili veće energije.", "Ovo nije dijagnoza niti zamena za lečenje."],
    escalation: [...ESCALATION],
    reviewmetadata: { clinical_review_status: "pending", clinician: null, clinically_reviewed_at: null },
  };
}

/** Unreleased planning inventory. Linked claims describe the real strength of support.
 * Approved actions are bounded draft copy, not clinician-approved instructions.
 * Sleep restriction, light dosing and autonomous clinical protocols are absent.
 */
export const SLEEP_TECHNIQUES = deepFreeze([
  technique({
    technique_id: "SELF_OBSERVATION",
    purpose: "Odvojeno posmatraj tok noći i lični utisak, bez pokušaja dijagnostikovanja.",
    mode: "optional_general_observation", action_eligible: true,
    claim_ids: ["DIARY_CORE_OBSERVATION"],
    contextual_claim_ids: ["DIARY_VALIDATION_BOUNDARY"],
    evidence_basis: "Diary structure supports observation, not treatment efficacy; this abbreviated log is not the original instrument.",
    rules: { all: [], required_known_flags: [], required_assessment: [] },
    exclusions: { any: [], notes: ["Prekini beleženje ako povećava zabrinutost ili opterećenje."] },
    approved_actions: ["Ujutru kratko zabeleži približno vreme spavanja i ustajanja, da li se sećaš buđenja i svoj ukupan utisak. Ne proveravaj sat tokom noći i ne postavljaj alarm radi praćenja."],
    approved_education: [],
    observe: ["Da li se buđenja i ukupan utisak menjaju zajedno ili se razlikuju?", "Da li ti kratak zapis koristi ili dodaje obavezu?"],
    burden: { level: "low", description: "Kratak jutarnji zapis; preskoči ga ako je opterećujući. Nema obaveznog niza dana." },
  }),
  technique({
    technique_id: "COGNITIVE_OFFLOAD",
    purpose: "Ponudi dobrovoljan, kratak zapis budućih obaveza kada su misli aktivne.",
    mode: "optional_general_experiment", action_eligible: true,
    claim_ids: ["TODO_WRITING_LAB"],
    evidence_basis: "One laboratory night, 57 healthy adults aged 18–30, five minutes of to-do writing versus completed-activity writing. A home experiment is an indirect extrapolation, not established treatment.",
    rules: { all: [{ flag: "active_thoughts", equals: true }], required_known_flags: ["active_thoughts"], required_assessment: [] },
    exclusions: { any: [], notes: ["Ne koristi za produženo analiziranje problema.", "Prekini ako pisanje pojačava zabrinutost ili uznemirenost."] },
    approved_actions: ["Ako želiš, pred spavanje probaj do pet minuta da na papir zapišeš konkretne obaveze za naredne dane, pa zatvori listu. Nije potrebno dovršiti plan ili rešavati probleme; prekini ako ti ne prija."],
    approved_education: [],
    observe: ["Da li ti je lakše da ostaviš planiranje ili te zapis dodatno zaokuplja?", "Uspavljivanje posmatraj odvojeno, bez očekivanja promene."],
    burden: { level: "low", description: "Do pet minuta kao dobrovoljan pokušaj, ne dokazano optimalna doza. Bez dodatnih zadataka." },
  }),
  technique({
    technique_id: "WIND_DOWN",
    purpose: "Probaj jednostavniji prelaz iz večernjeg sadržaja ka odmoru.",
    mode: "optional_general_experiment", action_eligible: true,
    claim_ids: ["QUIET_PREBED_GUIDANCE"],
    contextual_claim_ids: ["HYGIENE_NOT_STANDALONE"],
    evidence_basis: "NHLBI educational quiet-time guidance; a short content pause is a pragmatic adaptation, not a proven insomnia intervention.",
    rules: { all: [{ flag: "bedtime_content", equals: true }], required_known_flags: ["bedtime_content"], required_assessment: [] },
    exclusions: { any: [], notes: ["Ne navodi ekran kao dokazani uzrok problema.", "Ne nameći trajanje, zabranu svih uređaja ili preciznu dozu svetla."] },
    approved_actions: ["Ako želiš, završi sadržaj malo pre odlaska u krevet i odaberi mirnu aktivnost koja ti prija. Ostatak večeri ne moraš menjati; nemoj odlagati san radi nove rutine."],
    approved_education: [],
    observe: ["Da li ti prelaz prija, čak i ako je uspavljivanje isto?", "Da li nova navika pojednostavljuje veče ili ga opterećuje?"],
    burden: { level: "low", description: "Jedna mala promena, bez obaveznog trajanja ili dodatne liste pravila." },
  }),
  technique({
    technique_id: "WAKE_REGULARITY",
    purpose: "Razmotri izvodljivost sličnijeg jutarnjeg rasporeda bez skraćivanja sna.",
    mode: "optional_general_observation", action_eligible: true,
    claim_ids: ["REGULAR_TIMES_GUIDANCE"],
    evidence_basis: "General NHLBI schedule guidance, not an individual fixed-wake prescription or evidence of circadian dysfunction.",
    rules: { all: [{ flag: "variable_timing", equals: true }, { flag: "short_sleep", equals: false }], required_known_flags: ["variable_timing", "short_sleep", "daytime_sleepiness"], required_assessment: [] },
    exclusions: { any: [{ flag: "daytime_sleepiness", equals: true }], notes: ["Ne pomeraj alarm ranije i ne skraćuj vreme za san.", "Ne propisuj istu satnicu smenskom radniku ili osobi čiji raspored nije poznat."] },
    approved_actions: ["Uporedi vreme ustajanja tokom uobičajenog i slobodnog dana. Razmotri da li bi sličniji raspored bio izvodljiv uz dovoljno sna, bez promene alarma. Ako nije izvodljiv ili radiš u smenama, ostani pri posmatranju umesto novog pravila."],
    approved_education: [],
    observe: ["Da li bi sličniji raspored ostavio dovoljno vremena za san?", "Koje obaveze ili smene ograničavaju raspored?"],
    burden: { level: "low", description: "Poređenje rasporeda, ne obavezna promena sata ili režim ustajanja." },
  }),
  technique({
    technique_id: "RELAXATION",
    purpose: "Objasni mesto terapije relaksacijom u stručnom lečenju, bez autonomnog protokola.",
    mode: "clinical_education_only", action_eligible: false,
    claim_ids: ["RELAXATION_CONDITIONAL"],
    evidence_basis: "Conditional clinical recommendation; does not authorize a generic breathing or muscle-relaxation prescription.",
    rules: { all: [{ flag: "active_thoughts", equals: true }, { flag: "onset_difficulty", equals: true }], required_known_flags: ["active_thoughts", "onset_difficulty"], required_assessment: ["age", "symptom_duration", "driving_impairment", "breathing_symptoms", "relevant_clinical_history"] },
    exclusions: { any: [], notes: ["Uvek isključeno iz izbora radnji u PHASE1.", "Nepoznati zdravstveni podaci nisu negativan klinički nalaz."] },
    approved_actions: [],
    approved_education: ["Terapija relaksacijom ima uslovnu stručnu preporuku za hroničnu nesanicu kod odraslih. Izbor terapije zahteva procenu; ovde nema uputstva za terapijsku vežbu."],
    observe: ["Ako želiš da razmotriš terapiju, opiši stručnjaku teškoće i koliko dugo traju."],
    burden: { level: "not_applicable", description: "Samo edukacija; nema dodeljene vežbe, doze ili terapijskog zadatka." },
  }),
  technique({
    technique_id: "STIMULUS_CONTROL_EDUCATION",
    purpose: "Objasni stručnu terapijsku opciju bez samostalnog sprovođenja.",
    mode: "clinical_education_only", action_eligible: false,
    claim_ids: ["STIMULUS_CONTROL_CONDITIONAL"],
    evidence_basis: "Conditional clinical recommendation for adult chronic insomnia, not an action rule derived from questionnaire flags.",
    rules: { all: [{ flag: "onset_difficulty", equals: true }], required_known_flags: ["onset_difficulty"], required_assessment: ["age", "symptom_duration", "driving_impairment", "breathing_symptoms", "mobility_safety", "relevant_clinical_history"] },
    exclusions: { any: [], notes: ["Uvek isključeno iz izbora radnji u PHASE1.", "Bez obaveznog izlaska iz kreveta, merenja minuta ili propisanog vremena ustajanja."] },
    approved_actions: [],
    approved_education: ["Kontrola stimulusa je terapijska opcija sa uslovnom preporukom za hroničnu nesanicu kod odraslih. Stručnjak procenjuje da li odgovara tvojoj situaciji i bezbednosti; ovaj upitnik to ne utvrđuje."],
    observe: ["Sa stručnjakom razmotri uspavljivanje, noćna buđenja i dnevno funkcionisanje, ako teškoće traju."],
    burden: { level: "not_applicable", description: "Samo edukacija; nema protokola za samostalno sprovođenje." },
  }),
]);

// Fail fast on authoring mistakes, without coupling to prompts, planners or scoring.
const registry = loadSleepEvidenceLibrary();
const claims = new Map(registry.claims.map((claim) => [claim.claim_id, claim]));
const ids = new Set();
for (const entry of SLEEP_TECHNIQUES) {
  if (ids.has(entry.technique_id) || !entry.claim_ids.length ||
    [...entry.claim_ids, ...(entry.contextual_claim_ids || [])].some((id) => !claims.has(id)) ||
    (entry.mode === "clinical_education_only" && (entry.action_eligible || entry.approved_actions.length))) {
    throw new TypeError(`Invalid sleep technique definition: ${entry.technique_id}`);
  }
  ids.add(entry.technique_id);
}

function normalizeUnknown(value) {
  if (value === undefined) return new Set();
  if (Array.isArray(value) && value.every((name) => typeof name === "string")) return new Set(value);
  if (value instanceof Set && [...value].every((name) => typeof name === "string")) return new Set(value);
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    // Explicit true markers only. An absent key is never clinical clearance.
    if (Object.values(value).some((marker) => typeof marker !== "boolean")) {
      throw new TypeError("facts.unknown object values must be boolean unknown markers.");
    }
    return new Set(Object.keys(value).filter((name) => value[name] === true));
  }
  throw new TypeError("facts.unknown must be a string array, Set, or boolean-marker object.");
}

function flagValue(facts, unknown, flag) {
  if (unknown.has(flag) || unknown.has(`flags.${flag}`) ||
    !Object.hasOwn(facts.flags, flag) || typeof facts.flags[flag] !== "boolean") return undefined;
  return facts.flags[flag];
}

function matches(facts, unknown, predicate) {
  return flagValue(facts, unknown, predicate.flag) === predicate.equals;
}

/** `claimIds` must be claim IDs actually returned by the evidence selection layer.
 * Every linked ID must be supplied and active, and every claim/technique all-rule
 * must match strict facts.flags booleans. Unknown is not false.
 * `eligible` means an unreleased general-action planning candidate, not permission
 * to publish. Clinical-only entries always go to excluded, retaining education copy.
 * Assessment prerequisites cannot be cleared through arbitrary fields or absence
 * from facts.unknown: this API has no clinical-clearance contract in PHASE1.
 */
export function getEligibleSleepTechniques(facts, claimIds) {
  if (!facts || typeof facts !== "object" || !facts.flags || typeof facts.flags !== "object" ||
    Array.isArray(facts.flags)) throw new TypeError("facts.flags must be an object.");
  const unknown = normalizeUnknown(facts.unknown);
  if (!(Array.isArray(claimIds) || claimIds instanceof Set) ||
    [...claimIds].some((id) => typeof id !== "string" || !claims.has(id))) {
    throw new TypeError("claimIds must be an array or Set of known sleep evidence claim IDs.");
  }
  const supplied = new Set(claimIds);
  const eligible = [];
  const excluded = [];
  for (const entry of SLEEP_TECHNIQUES) {
    const reasons = [];
    const missingClaimIds = entry.claim_ids.filter((id) => !supplied.has(id));
    const missingPrerequisites = entry.rules.required_known_flags
      .filter((flag) => flagValue(facts, unknown, flag) === undefined)
      .map((flag) => `flags.${flag}`);
    missingPrerequisites.push(...entry.rules.required_assessment.map((name) => `assessment.${name}`));
    if (entry.status !== "active") reasons.push("inactive_technique");
    if (missingClaimIds.length) reasons.push("linked_evidence_not_returned");
    if (missingPrerequisites.length) reasons.push("missing_prerequisites");
    if (!entry.rules.all.every((predicate) => matches(facts, unknown, predicate))) reasons.push("flag_rules_not_met");
    if (entry.exclusions.any.some((predicate) => matches(facts, unknown, predicate))) reasons.push("exclusion_flag_present");
    for (const id of entry.claim_ids) {
      const claim = claims.get(id);
      if (claim.status !== "active") reasons.push(`inactive_claim:${id}`);
      if (!claim.applicability.all.every((predicate) => matches(facts, unknown, predicate))) {
        reasons.push(`claim_not_applicable:${id}`);
      }
    }
    if (!entry.action_eligible || entry.mode === "clinical_education_only") reasons.push("education_only_not_action_eligible");
    const result = {
      ...structuredClone(entry),
      evidence_ids: entry.claim_ids.map((id) => claims.get(id).evidence_id),
      missing_claim_ids: missingClaimIds,
      missing_prerequisites: missingPrerequisites,
      reasons: [...new Set(reasons)],
    };
    (reasons.length ? excluded : eligible).push(result);
  }
  return deepFreeze({ eligible, excluded });
}