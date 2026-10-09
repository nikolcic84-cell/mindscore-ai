import { buildSleepPremiumWriterBrief } from "./sleepPremiumWriterBrief.js";
import { resolveSleepEvidenceCitation } from "./sleepEvidenceLibrary.js";

const unique = (values) => [...new Set(values)];
function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}
const INSIGHT_TITLES = Object.freeze({
  continuity_daytime_relation: "Tok noći i osećaj tokom dana",
  rested_morning_daytime_difficulty: "Mirno jutro i energija kasnije",
  easy_onset_difficult_return: "Uspavljivanje i nastavak sna",
  calm_routine_active_thoughts: "Mirna rutina i aktivne misli",
  onset_thoughts_calm_night: "Početak sna i tok noći",
  recovery_despite_calm_night: "Oporavak uz mirniji tok noći",
  duration_recovery: "Trajanje i jutarnji osećaj",
  variable_timing_short_duration: "Raspored i trajanje sna",
  awakening_daytime_relation: "Noćna buđenja i osećaj tokom dana",
  fragmented_night_preserved_daytime: "Prekidi noću uz očuvan dan",
  variable_timing_duration: "Raspored i prijavljeno trajanje",
  short_sleep_daytime: "Trajanje i jutarnji osećaj",
  morning_daytime_relation: "Jutro i energija tokom dana",
  preserve_calm_features: "Ono što već deluje mirnije",
});
const TARGET_LABELS = Object.freeze({
  faster_initial_onset: "početno uspavljivanje",
  extra_wind_down_rules: "mirni završetak večeri",
  stricter_schedule: "raspored sna",
});
const THEME_LABELS = Object.freeze({
  BEDTIME_TRANSITION: "prelaz iz večeri u san",
  RECOVERY_DURATION: "trajanje sna i osećaj po buđenju",
  NIGHT_CONTINUITY: "tok noći i buđenja",
  RHYTHM_WAKE: "raspored spavanja i ustajanja",
});
const DAY_RATIONALES = Object.freeze([
  "Početni utisak daje polaznu tačku bez promene rutine.",
  "Ovaj već odobreni korak izdvojen je kao prvi mali pokušaj.",
  "Drugi ugao ostaje odvojen da ne menjaš više stvari odjednom.",
  "Poređenje vraća pažnju na isti utisak bez nove radnje.",
  "Treći ugao koristi samo ono što je već raspoređeno u planu.",
  "Dan izbora koristi samo korak koji je već dodeljen ovom delu plana.",
  "Završni osvrt pomaže da izabereš šta, ako išta, želiš da zadržiš.",
]);
const DEFAULT_DAY_ACTION = "Ako želiš, zadrži uobičajenu rutinu i razmisli o dodeljenom delu sna.";
const DEFAULT_DAY_OBSERVE = "Šta ti je najlakše da se setiš bez dodatnog beleženja?";

function factText(fact) {
  const frequency = fact.frequency?.answer ?? fact.frequency?.question;
  return frequency ? `${fact.description} (u odgovoru: ${frequency.toLowerCase()})` : fact.description;
}

function sourceRecord(claimId) {
  const citation = resolveSleepEvidenceCitation(claimId);
  return {
    claimId,
    approvedText: citation.plain_serbian,
    limits: [...citation.limitations, ...citation.does_not_establish, ...citation.exclusions],
    sources: citation.sources.map((source) => ({
      label: [source.organization || source.authors.join(", "), source.title, String(source.year)].join(" · "),
      title: source.title,
      authors: [...source.authors],
      organization: source.organization,
      year: source.year,
      url: source.url,
      review_status: source.review_status,
    })),
    clinicalReviewStatus: citation.reviewmetadata.clinical_review_status,
    release_allowed: false,
  };
}

function deterministicExperiment(brief) {
  const allocations = brief.experiment7;
  const calm = brief.profile === "MIRNA NOĆ";
  const plan = allocations.map((allocation, index) => ({
    day: index + 1,
    purpose: allocation.purpose,
    themeIds: [...allocation.themeIds],
    themes: unique(allocation.themeIds.map((id) => THEME_LABELS[id]).filter(Boolean)),
    techniqueId: allocation.technique_id,
    action: calm ? "Zadrži ono što ti već prija; ništa ne moraš menjati." : allocation.action || DEFAULT_DAY_ACTION,
    observe: calm ? "Šta u tvojoj rutini već odgovara?" : allocation.observe || DEFAULT_DAY_OBSERVE,
    rationale: DAY_RATIONALES[index],
    restrictions: [...allocation.restrictions],
    release_allowed: false,
  }));
  // Keep every allocated day action/technique pair intact. The allocation's
  // USER_CHOICE day is rendered as an optional choice; it doesn't substitute
  // a different action from another technique.
  return plan;
}

function fallbackCopy(master) {
  const insightSentences = master.selectedInsights.map(({ relationship }) => relationship).filter(Boolean);
  const factSentences = unique(master.selectedInsights.flatMap(({ facts }) => facts)).slice(0, 5);
  const calm = master.profile === "MIRNA NOĆ";
  const story = calm
    ? `Na osnovu tvojih odgovora, više delova sna deluje mirnije. ${factSentences.join(" ")} Ovi odgovori opisuju tvoje iskustvo, ne procenu svake noći. Početak sna, tok noći i osećaj tokom dana mogu se sagledati odvojeno, bez traženja skrivenog objašnjenja. Nema potrebe da menjaš ono što ti već odgovara niti da svakodnevno beležiš kako si spavao/la. Sedam dana ovde služi samo kao nežan okvir da sačuvaš postojeću rutinu i razmisliš šta ti prija. Ako neki osvrt deluje suvišan, možeš ga preskočiti. Ništa ne moraš dokazati niti popraviti.`
    : `${insightSentences.slice(0, 2).join(" ")} ${factSentences.slice(0, 3).join(" ")} Ovi odgovori opisuju zasebne delove iskustva; ne znamo da li se sve dešava iste noći niti da li jedno objašnjava drugo. ${master.openQuestion?.question ?? "Ostaje prostora da razjasniš kako se ovi utisci uklapaju u tvoju nedelju."} Sedmodnevni plan ostavlja ostale navike nepromenjene i koristi samo već odobrene korake. Možeš preskočiti ono što ti dodaje obavezu. Cilj je razumevanje tvog opisa, ne obećanje da će se san promeniti.`;
  const insightText = master.selectedInsights.map(({ relationship }) => relationship);
  const preserve = master.doNotTargetFirst.length
    ? master.doNotTargetFirst.map(({ explanation, qualification }) => `${explanation} ${qualification}`).join(" ")
    : null;
  const question = master.openQuestion?.question ?? null;
  const questionExplain = master.openQuestion
    ? `${question} Razjašnjenje bi pomoglo da se odgovori ne tumače kao da opisuju iste noći.`
    : null;
  return {
    story_intro: story || "Tvoji odgovori daju nekoliko različitih pogleda na san. Ne moraju svi opisivati istu noć.",
    insight_1_explanation: insightText[0],
    insight_2_explanation: insightText[1] ?? insightText[0],
    insight_3_explanation: insightText[2] ?? null,
    do_not_change_explanation: preserve,
    open_question_explanation: questionExplain,
    experiment_explanation: master.profile === "MIRNA NOĆ"
      ? "Ovaj sedmodnevni osvrt služi samo da sačuvaš ono što već odgovara; ne traži promenu ni svakodnevno beleženje."
      : "Plan razdvaja već odobrene male korake, da možeš videti šta ti je izvodljivo bez menjanja svega odjednom.",
  };
}

/** Build authoritative, deterministic report structure before any model call.
 * This consumes the existing Phase 1/1.5 selection unchanged and cannot accept
 * model-authored profile, priority, insights, techniques, plan or evidence. */
export function buildSleepPremiumStoryMaster(input, options = {}) {
  const brief = buildSleepPremiumWriterBrief(input, options);
  const facts = new Map(brief.supporting_facts.map((fact) => [fact.fact_id, fact]));
  const selected = [brief.primary_insight, ...brief.secondary_insights].slice(0, 3);
  const selectedInsights = selected.map((insight) => ({
    insightId: insight.insight_id,
    title: INSIGHT_TITLES[insight.insight_id] ?? "Još jedan deo tvog sna",
    relationship: insight.relationship,
    whyItMatters: insight.why_it_matters,
    facts: insight.fact_ids.map((id) => facts.get(id)).filter(Boolean).map(factText),
    uncertainty: insight.uncertainty.text,
    evidenceClaimIds: [...insight.evidence_claim_ids],
  }));
  const doNotTargetFirst = unique(brief.do_not_target_first.map((entry) => JSON.stringify({
    targetId: entry.target_id,
    label: TARGET_LABELS[entry.target_id] ?? "ovaj deo sna",
    explanation: entry.reason,
    qualification: entry.qualification,
    factIds: [...entry.fact_ids],
  }))).map((entry) => JSON.parse(entry));
  const selectedClaimIds = unique(selectedInsights.flatMap(({ evidenceClaimIds }) => evidenceClaimIds));
  const science = selectedClaimIds.map(sourceRecord);
  const scienceById = new Map(science.map((entry) => [entry.claimId, entry]));
  const scienceForInsights = selectedInsights.map(({ evidenceClaimIds }) =>
    evidenceClaimIds.map((id) => scienceById.get(id)).filter(Boolean));
  const bestQuestion = brief.best_next_question;
  const openQuestion = bestQuestion ? {
    question: bestQuestion.question,
    explanation: bestQuestion.why_it_matters,
    factIds: [...bestQuestion.fact_ids],
  } : null;
  const experiment = deterministicExperiment(brief);
  const master = {
    version: "premium-story-master.v1",
    profile: brief.profile,
    priority: { area: brief.priority.area },
    selectedInsights,
    doNotTargetFirst,
    openQuestion,
    experiment,
    science,
    scienceForInsights,
    safety: {
      unknown: [...brief.unknown],
      prohibitedConclusions: [...brief.prohibited_conclusions],
      reviewOnly: true,
      releaseAllowed: false,
      clinicalReviewStatus: "pending",
    },
    reviewOnly: true,
    releaseAllowed: false,
  };
  const fallbackCopySlots = fallbackCopy(master);
  const writerBrief = {
    language: "Serbian Latin",
    insights: selectedInsights.map(({ title, relationship, facts: insightFacts, uncertainty }) => ({
      title, relationship, facts: insightFacts, uncertainty,
    })),
    preservedFeatures: doNotTargetFirst.map(({ label, explanation, qualification }) => ({ label, explanation, qualification })),
    openQuestion: openQuestion ? { question: openQuestion.question, whyItMatters: openQuestion.explanation } : null,
    experimentContext: unique(experiment.flatMap(({ themes }) => themes)),
    scienceConcepts: science.map(({ approvedText, limits }) => ({ approvedText, limits })),
    writingGuide: {
      intro: "120–180 words if the supplied material supports it; warm, curious and specific, never diagnostic.",
      insights: "Concise explanations of only the selected insights, in order.",
      uncertainty: "Keep the supplied question and explain why it would clarify interpretation.",
      experiment: "Explain the fixed experiment only; do not produce or change daily actions.",
      style: "Natural customer-facing Serbian. Avoid repetitive stock verbs and meta/editorial language.",
    },
  };
  return deepFreeze({ master, fallbackCopySlots, writerBrief });
}