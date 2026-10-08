import { buildSleepPremiumFacts } from "./sleepPremiumFacts.js";
import { buildSleepPremiumThemePlan } from "./sleepPremiumThemePlan.js";
import { getSleepPremiumPriority } from "./sleepPremiumSchema.js";
import { getEligibleSleepTechniques } from "./sleepTechniqueLibrary.js";
import { retrieveSleepPremiumEvidence } from "./sleepPremiumEvidenceRetrieval.js";
import { selectSleepPremiumExplanationDevices } from "./sleepPremiumExplanationDevices.js";

const TECHNIQUE_THEMES = Object.freeze({
  SELF_OBSERVATION: ["NIGHT_CONTINUITY", "RECOVERY_DURATION", "BEDTIME_TRANSITION", "RHYTHM_WAKE"],
  COGNITIVE_OFFLOAD: ["BEDTIME_TRANSITION"], WIND_DOWN: ["BEDTIME_TRANSITION"], WAKE_REGULARITY: ["RHYTHM_WAKE"],
});
const PRIORITY_QUESTIONS = Object.freeze({ recovery: ["Q1", "Q5", "Q8", "Q11", "Q12"],
  sleepOnset: ["Q2", "Q6", "Q7"], continuity: ["Q3", "Q12"], rhythm: ["Q4", "Q9", "Q10"],
  multiple: ["Q1", "Q2", "Q3", "Q5", "Q7", "Q8", "Q12"],
  whole: ["Q1", "Q2", "Q3", "Q5", "Q6", "Q7", "Q8", "Q9", "Q10", "Q11", "Q12"] });
const OBSERVATION_QUESTIONS = Object.freeze({
  BEDTIME_TRANSITION: "Da li se tvoj utisak o poslednjem delu večeri razlikuje od iskustva uspavljivanja?",
  RECOVERY_DURATION: "Da li se prijavljeno trajanje, jutarnji osećaj i doživljaj dana menjaju zajedno ili razlikuju?",
  NIGHT_CONTINUITY: "Da li se sećanje na buđenja i ukupan utisak o noći podudaraju ili razlikuju?",
  RHYTHM_WAKE: "Da li je ustajanje drugačije uz alarm i bez njega, i šta o rasporedu još nije jasno?",
});

/** Standalone, unreleased pre-AI planning only. input is buildSleepPremiumInput's
 * canonical object, options are retrieval's {library?, maxClaims?}. No AI,
 * generator, UI, public report schema, persistence or clinical protocol calls.
 */
export function buildSleepPremiumPreAiAnalysis(input, options = {}) {
  const facts = buildSleepPremiumFacts(input);
  const theme_plan = buildSleepPremiumThemePlan(input);
  const retrieval = retrieveSleepPremiumEvidence(facts, options);
  // Existing technique API expects string IDs, unlike the canonical facts API.
  const techniques = getEligibleSleepTechniques({ ...facts, unknown: facts.unknown.map(({ id }) => id) },
    retrieval.claims.filter(({ action_eligible }) => action_eligible).map(({ claim_id }) => claim_id));
  const priority = getSleepPremiumPriority(input);
  const flag = (id) => facts.flags[id] === true;
  const byQuestion = (id) => facts.facts.find(({ questionId }) => questionId === id);
  const refs = (ids) => ids.map((id) => byQuestion(id).fact_id);
  const descriptions = (ids) => ids.map((id) => byQuestion(id).description).join(" ");
  const contrasts = [];
  const contrast = (id, ids, text, question, notEstablished) => contrasts.push({
    contrast_id: id, fact_ids: refs(ids), observation: descriptions(ids), explanation: text,
    open_question: question, unknown_ids: ["co_occurrence_same_days"], does_not_establish: notEstablished,
  });
  if (flag("short_sleep") && flag("morning_difficulty") && flag("longer_without_alarm")) {
    contrast("duration_morning_free_day", ["Q5", "Q1", "Q9"],
      "Kraće prijavljeno trajanje, teško jutro i odgovor o danu bez alarma daju tri različita ugla. Slobodan dan je prilika za poređenje, ne potvrda nadoknade sna.",
      "Da li je jutarnji osećaj drugačiji bez alarma i da li se kraće noći i teško jutro javljaju istih dana?",
      ["Dug sna", "Kratka prilika za spavanje", "Stvarno duže spavanje kada je odgovor hipotetičan", "Uzrok jutarnjeg umora"]);
  }
  if (byQuestion("Q2").selected_option_index === 0 && flag("return_difficulty")) {
    contrast("easy_onset_difficult_return", ["Q2", "Q3"],
      "Brz početak sna i težak povratak nakon buđenja nisu ista situacija; lako uspavljivanje ne opisuje celu noć.",
      "Da li teško nastavljanje sna dolazi posle noći u kojima je početno uspavljivanje bilo lako?", ["Nesanica", "Trajanje budnosti", "Uzrok buđenja"]);
  }
  if (byQuestion("Q6").kind === "positive" && flag("active_thoughts")) {
    contrast("calm_routine_active_thoughts", ["Q6", "Q7", "Q2"],
      "Miran završetak večeri i aktivne misli mogu biti dva odvojena opisa. Nije opravdano automatski dodavati još pravila o ekranima.",
      "Da li su misli aktivne i onih večeri kada ti mirna rutina prija?", ["Ekrani kao uzrok", "Psihološki poremećaj", "Neuspeh rutine"]);
  }
  if (flag("variable_timing") && byQuestion("Q5").selected_option_index === 0) {
    contrast("variable_timing_reported_duration", ["Q10", "Q9", "Q5"],
      "Prijavljenih 7–9 sati i promenljiv raspored opisuju različite delove sna. Taj raspon nije potvrda da je trajanje dovoljno baš za tebe.",
      "Da li se jutarnji utisak razlikuje sa rasporedom i kada prijavljuješ slično trajanje sna?", ["Poremećen biološki ritam", "Dovoljno sna za svaki uzrast", "Uzročni odnos"]);
  }
  if (flag("night_awakenings") && (flag("daytime_fatigue") || flag("daytime_sleepiness") || flag("morning_difficulty"))) {
    const ids = ["Q3", ...(flag("morning_difficulty") ? ["Q1"] : []),
      ...(flag("daytime_fatigue") || flag("daytime_sleepiness") ? ["Q8"] : [])];
    contrast("awakening_and_tiredness", ids,
      "Buđenja i osećaj umora daju odvojene informacije o noći i danu. Njihovo navođenje u upitniku ne pokazuje da jedno objašnjava drugo.",
      "Da li se umor javlja baš posle noći sa buđenjima ili i nakon drugačijih noći?", ["Buđenja kao uzrok umora", "Apneja", "Klinička pospanost iz odgovora o umoru"]);
  }

  const aspects = [
    { aspect_id: "duration_recovery", ids: ["Q1", "Q5", "Q8", "Q11", "Q12"],
      present: flag("short_sleep") || flag("morning_difficulty") || flag("daytime_fatigue") || flag("daytime_sleepiness") ||
        flag("overall_dissatisfaction") || byQuestion("Q11").kind === "difficulty" || byQuestion("Q5").kind === "difficulty" },
    { aspect_id: "bedtime", ids: ["Q2", "Q6", "Q7"], present: flag("onset_difficulty") || flag("active_thoughts") || flag("bedtime_content") },
    { aspect_id: "continuity", ids: ["Q3"], present: flag("night_awakenings") },
    { aspect_id: "timing_waking", ids: ["Q4", "Q9", "Q10"], present: flag("variable_timing") || flag("alarm_difficulty") || flag("longer_without_alarm") },
  ].filter(({ present }) => present).map(({ aspect_id, ids }) => ({ aspect_id, fact_ids: refs(ids), text: descriptions(ids) }));
  const supported_positive = facts.facts.filter(({ kind }) => kind === "positive").map((fact) => structuredClone(fact));
  const storyIds = aspects.length ? [...new Set(aspects.flatMap(({ fact_ids }) => fact_ids))]
    : facts.facts.map(({ fact_id }) => fact_id);
  const main_story = {
    fact_ids: storyIds, aspects,
    text: aspects.length ? `${aspects.map(({ text }) => text).join(" ")} Ovo su različiti delovi odgovora, ne potvrđen uzrok niti ista noć.`
      : "Odgovori ne izdvajaju teškoću koju treba izmišljati. Prijavljeno trajanje i postojeći mirniji delovi ostaju opis tvog iskustva, ne potvrda zdravlja ili odsustva poremećaja.",
  };
  const priorityIds = PRIORITY_QUESTIONS[priority.key];
  const priority_justification = { area: priority.title, key: priority.key, fact_ids: refs(priorityIds),
    text: `Početak ostaje „${priority.title}“, tačno prema postojećem izboru prioriteta. ${descriptions(priorityIds)} To je urednički početak, ne uzrok drugih odgovora niti novi zaključak o profilu.` };
  // A twist requires an actual cross-answer contrast, never a quota or surprise.
  const twist = contrasts.find(({ contrast_id }) => ["easy_onset_difficult_return", "calm_routine_active_thoughts",
    "variable_timing_reported_duration"].includes(contrast_id)) || null;
  const open_question = contrasts.length ? { text: contrasts[0].open_question,
    fact_ids: [...contrasts[0].fact_ids], unknown_ids: [...contrasts[0].unknown_ids] }
    : { text: aspects.length >= 2 ? "Da li se ovi različiti delovi tvog iskustva javljaju istih dana ili nezavisno?"
      : "Da li se tvoj ukupni utisak i opis pojedinačnih noći menjaju zajedno ili razlikuju?",
    fact_ids: storyIds, unknown_ids: ["co_occurrence_same_days"] };
  const science_moments = retrieval.claims.map((claim) => ({ claim_id: claim.claim_id,
    concept: claim.concept, fact_ids: [...claim.fact_ids], explanation: claim.plain_serbian,
    relevance_reason: claim.relevance_reason, sources: structuredClone(claim.sources),
    caveats: [...claim.applicability_restrictions, ...claim.does_not_establish], release_allowed: false }));

  const used = new Set();
  const experiment = theme_plan.allocation.seven_day_plan.map((allocation) => {
    const themeFacts = theme_plan.theme_map.filter(({ theme_id }) => allocation.themeIds.includes(theme_id))
      .flatMap(({ evidence }) => evidence.map(({ questionId }) => byQuestion(questionId)));
    const candidate = [2, 3, 5, 6].includes(allocation.day) ? techniques.eligible.find((entry) =>
      TECHNIQUE_THEMES[entry.technique_id]?.some((id) => allocation.themeIds.includes(id)) &&
      (allocation.day === 6 || !used.has(entry.technique_id))) : null;
    if (candidate) used.add(candidate.technique_id);
    return { ...structuredClone(allocation), fact_ids: [...new Set(themeFacts.map(({ fact_id }) => fact_id))],
      technique_id: candidate?.technique_id ?? null, mode: candidate ? "optional_draft_candidate" : "observation_fallback",
      action: candidate ? candidate.approved_actions[0] : allocation.day === 4
        ? "Ako želiš, uporedi dosadašnje utiske, bez nove promene ili namernog buđenja."
        : allocation.day === 7 ? "Osvrni se na utiske i izaberi šta ti je bilo izvodljivo; nije potrebno nastaviti praćenje."
          : "Ako želiš, primeti svoj utisak o dodeljenom delu sna, bez promene rutine, proveravanja sata ili namernog buđenja.",
      observe: candidate ? candidate.observe[0] : allocation.themeIds.length === 1
        ? OBSERVATION_QUESTIONS[allocation.themeIds[0]] : "Da li se opisani utisci javljaju zajedno ili se razlikuju?",
      fallback_reason: candidate ? null : "No distinct eligible selected-evidence action for this allocation; observation is optional, not a validated diary or treatment.",
      restrictions: candidate ? [...candidate.exclusions.notes, ...candidate.no_promises] : ["Preskoči ako posmatranje povećava zabrinutost.", "Nema obaveznog zapisa ni promene satnice."],
      release_allowed: false };
  });
  const prohibited_conclusions = [...new Set([
    ...facts.facts.flatMap(({ not_supported }) => not_supported),
    "Dug sna iz dužeg spavanja bez alarma", "Upitnik potvrđuje hroničnu nesanicu ili apneju",
    "Izvor je klinički pregledan ili spreman za objavljivanje", "Neprijavljeni uzrast, smene, navike ili istorija",
    "Samostalni CBT-I, kontrola stimulusa ili klinički protokol relaksacije",
    "Restrikcija sna, raniji alarm koji skraćuje san ili precizna doza svetla",
    "Povezanost ili zajedničko navođenje dokazuje uzrok", "Obećanje da će pokušaj poboljšati san",
    ...retrieval.claims.flatMap(({ does_not_establish }) => does_not_establish),
  ])];
  return { profile: input.profile, theme_plan, facts, retrieval, techniques,
    editorial_plan: { main_story, priority_justification, twist, contrasts, open_question,
      supported_positive, science_moments, explanation_devices: selectSleepPremiumExplanationDevices(facts, retrieval.claims), experiment },
    prohibited_conclusions, unknown: structuredClone(facts.unknown), release_allowed: false };
}