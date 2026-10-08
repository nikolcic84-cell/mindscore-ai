import { buildSleepPremiumPreAiAnalysis } from "./sleepPremiumEditorialPlan.js";

// Phase 1.5, internal editorial material only. These are utility weights, NOT
// probabilities, clinical severity, confidence, or customer-facing scores.
const WEIGHTS = Object.freeze({
  grounded_multiple_facts: 10, contrast: 15, focus_reframe: 10,
  separate_experiences: 10, positive_avoid: 5, actionable_unknown: 15,
  evidence_available_bounded: 5, observation: 10,
});
const PENALTIES = Object.freeze({
  single_fact: 30, existing_duplicate: 10, generic: 25,
  unsupported: 100, not_applicable: 100,
});
const unique = (values) => [...new Set(values)];
const CO_OCCURRENCE = "co_occurrence_same_days";
const NONCAUSAL = "Urednička hipoteza za poređenje odgovora, ne utvrđena povezanost, uzrok ili dijagnoza.";
const flagIs = (name) => ({ flag: name, equals: true });
const optionIs = (questionId, ...indexes) => ({ questionId, selected_option_indexes: indexes });
const kindIs = (questionId, kind) => ({ questionId, kind });
const all = (...predicates) => ({ all: predicates });
const any = (...predicates) => ({ any: predicates });
const DAY_DIFFICULTY = any(flagIs("daytime_fatigue"), flagIs("daytime_sleepiness"));

// Every rule has executable predicates and named dependencies. Applicability is
// answer-based, never profile-based, prose-similarity-based or source-prestige-based.
// Evidence concepts below only FILTER Phase 1's already selected claims.
function definitions() {
  return [
    {
      id: "duration_recovery", predicate: all(flagIs("short_sleep"), flagIs("morning_difficulty"), flagIs("longer_without_alarm")),
      ids: ["Q5", "Q1", "Q9"], groups: [["Q5", "Q9"], ["Q1"]], contrast: true, reframe: true,
      concepts: ["sleep_duration", "duration_context", "multiple_aspects", "self_observation"],
      relationship: "Kraće prijavljeno trajanje i teško jutro stoje uz poređenje sa slobodnim danom bez alarma. Taj odgovor može opisivati duže spavanje ili samo želju za ostajanjem u krevetu.",
      why: "Korisnije je uporediti jutra posle različitih noći nego unapred proglasiti duži ostanak bez alarma nadoknadom sna.",
      nonObvious: "Odgovor o slobodnom danu nije merenje dodatnog sna ni dokaz duga sna.",
      question: "Da li se jutarnji osećaj razlikuje posle kraćih i dužih noći, i šta zaista primećuješ slobodnim danom bez alarma?",
      alternatives: ["Razlika u jutrima uz različito trajanje dala bi odnos vredan daljeg posmatranja, ne uzrok.", "Slična jutra uz različito trajanje oslabila bi priču zasnovanu samo na trajanju.", "Želja za ostajanjem u krevetu bez stvarno dužeg sna razdvojila bi želju od iskustva."],
      prohibited: ["Dug sna", "Stvarno duže spavanje iz hipotetičnog odgovora", "Trajanje uzrokuje jutarnji umor"],
    },
    {
      id: "continuity_daytime_relation", predicate: all(optionIs("Q5", 0), flagIs("return_difficulty"), any(DAY_DIFFICULTY, flagIs("morning_difficulty"))),
      ids: (ctx) => ["Q5", "Q3", ...(ctx.dayDifficulty ? ["Q8"] : ["Q1"])],
      groups: (ctx) => [["Q3"], [ctx.dayDifficulty ? "Q8" : "Q1"]], contrast: true, reframe: true, preserve: true,
      concepts: ["multiple_aspects", "self_observation"],
      relationship: "Prijavljenih 7–9 sati, težak povratak u san i teškoća tokom dana ili jutra opisuju različite delove iskustva. Sam raspon sati ne opisuje nastavak sna ni energiju.",
      why: "Prvo poređenje vredi usmeriti na jutra i dane posle noći sa više ili manje prekida, umesto automatski na duže spavanje ili brže početno uspavljivanje.",
      nonObvious: "Trajanje može zvučati mirnije dok se povratak u san i dan izdvajaju; ne znamo da li se izdvajaju istih dana.",
      question: "Da li su jutarnji osećaj i energija tokom dana drugačiji posle noći sa više ili manje prekida, uz slično prijavljeno trajanje sna?",
      alternatives: ["Teža jutra ili dani baš posle više prekida podržali bi zajedničko javljanje, ne uzrok.", "Slična energija posle različitih noći ostavila bi dnevno iskustvo kao odvojen ugao.", "Različit jutarnji i dnevni utisak pokazao bi da ih ne treba objediniti u jedan opis umora."],
      prohibited: ["7–9 sati je dovoljno baš za ovu osobu", "Prekidi uzrokuju dnevni umor", "Potrebno je produžiti san"],
    },
    {
      id: "calm_routine_active_thoughts", predicate: all(kindIs("Q6", "positive"), flagIs("active_thoughts")),
      ids: ["Q6", "Q7", "Q2"], groups: [["Q6"], ["Q7", "Q2"]], contrast: true, reframe: true, preserve: true,
      concepts: ["active_thoughts", "bedtime_transition", "multiple_aspects", "self_observation"],
      relationship: "Miran poslednji deo večeri i aktivne misli pri ležanju nisu isti opis. Prijavljena rutina ostaje mirnija, ali ne poništava odgovor o mislima ili uspavljivanju.",
      why: "Unutar perioda pre sna vredi razdvojiti rutinu od iskustva kada legneš, a ne automatski dodavati pravila o ekranima.",
      nonObvious: "Miran završetak večeri nije isto što i lako isključivanje misli u krevetu.",
      question: "Da li su misli aktivne i onih večeri kada ti mirna rutina prija, i da li je tada uspavljivanje drugačije?",
      alternatives: ["Aktivne misli i posle prijatne rutine razdvojile bi ta dva iskustva.", "Različit doživljaj misli posle različitih večeri podržao bi poređenje, ne uticaj rutine.", "Lako uspavljivanje uprkos mislima pokazalo bi da aktivne misli nisu automatski teško uspavljivanje."],
      prohibited: ["Ekrani su uzrok", "Rutina ne uspeva", "Misli dokazuju psihološki poremećaj"],
    },
    {
      id: "easy_onset_difficult_return", predicate: all(optionIs("Q2", 0), flagIs("return_difficulty")),
      ids: ["Q2", "Q3"], groups: [["Q2"], ["Q3"]], contrast: true, preserve: true,
      concepts: ["multiple_aspects", "self_observation"],
      relationship: "Vrlo brz početak sna i težak povratak nakon buđenja opisuju dve odvojene situacije u noći.",
      why: "Lako početno uspavljivanje nije deo koji treba dodatno ubrzavati; poređenje se odnosi na nastavak sna.",
      nonObvious: "Lako zaspati nije isto što i lako nastaviti spavanje.",
      question: "Da li teško nastavljanje sna dolazi i posle noći u kojima je početno uspavljivanje bilo lako?",
      alternatives: ["Oba iskustva iste noći podržala bi razliku između početka i nastavka sna.", "Različite noći za ova iskustva ograničile bi priču o kontrastu unutar iste noći."],
      prohibited: ["Nesanica", "Tačno trajanje budnosti", "Uzrok buđenja"],
    },
    {
      id: "variable_timing_duration", predicate: all(flagIs("variable_timing"), optionIs("Q5", 0)),
      ids: ["Q10", "Q9", "Q5"], groups: [["Q10", "Q9"], ["Q5"]], contrast: true, reframe: true, preserve: true,
      concepts: ["sleep_timing", "multiple_aspects", "self_observation"],
      relationship: "Promenljiv raspored i prijavljenih 7–9 sati odnose se na vreme sna i na trajanje, ne na istu karakteristiku.",
      why: "Raspored vredi porediti pri sličnom trajanju, bez zaključka da je potrebno više sati ili novi alarm.",
      nonObvious: "Sličan raspon trajanja može stajati uz različita vremena spavanja i buđenja.",
      question: "Da li se tvoj utisak o noći i jutru razlikuje kada se raspored menja, a prijavljeno trajanje ostaje slično?",
      alternatives: ["Različit utisak uz slične sate podržao bi poređenje rasporeda kao zasebnog ugla.", "Sličan utisak uz različit raspored ograničio bi značaj tog poređenja.", "Ako se menjaju i trajanje i raspored, ova dva ugla još ne bi bila razdvojena."],
      prohibited: ["Poremećen biološki ritam", "Raspored uzrokuje loš san", "7–9 sati potvrđuje dovoljnost sna"],
    },
    {
      id: "onset_thoughts_calm_night", predicate: all(flagIs("onset_difficulty"), flagIs("active_thoughts"), kindIs("Q3", "positive")),
      ids: ["Q2", "Q7", "Q3"], groups: [["Q2", "Q7"], ["Q3"]], contrast: true, reframe: true, preserve: true,
      concepts: ["active_thoughts", "multiple_aspects", "self_observation"],
      relationship: "Teže uspavljivanje i aktivne misli stoje uz prijavljenu uglavnom mirnu noć bez buđenja. Početak i kasniji tok sna nisu isto iskustvo.",
      why: "Pažnju vredi zadržati na prelazu u san, bez izmišljanja problema sa nastavkom spavanja.",
      nonObvious: "Težak početak ne opisuje nužno ostatak noći.",
      question: "Da li i posle večeri sa aktivnim mislima i težim uspavljivanjem noć uglavnom ostaje bez buđenja?",
      alternatives: ["Miran nastavak iste noći suzio bi opis teškoće na početak sna.", "Odgovori koji opisuju različite noći ne bi potvrđivali taj kontrast u istoj noći."],
      prohibited: ["Misli uzrokuju teško uspavljivanje", "Noć je objektivno neprekinuta", "Potreban je rad na buđenjima"],
    },
    {
      id: "recovery_despite_calm_night", predicate: all(flagIs("morning_difficulty"), DAY_DIFFICULTY, kindIs("Q3", "positive"), kindIs("Q2", "positive")),
      ids: ["Q1", "Q8", "Q3", "Q2"], groups: [["Q1"], ["Q8"]], contrast: true, reframe: true, preserve: true,
      concepts: ["multiple_aspects", "self_observation"],
      relationship: "Teško jutro i umor ili pospanost tokom dana stoje uz lako uspavljivanje i uglavnom noć bez buđenja. Mirniji početak i tok nisu isto što i osećaj oporavka.",
      why: "Prvo razdvoji jutarnji osećaj od energije kasnije tokom dana, bez dodavanja neprijavljenih prekida ili težeg uspavljivanja.",
      nonObvious: "Mirniji opis noći ne poništava stvarni odgovor o jutru i danu.",
      question: "Da li se teško jutro i manjak energije kasnije tokom dana javljaju istih dana, i da li se razlikuju posle noći s drugačijim trajanjem?",
      questionIds: ["Q1", "Q8", "Q3", "Q2", "Q5"],
      alternatives: ["Zajedničko javljanje povezalo bi jutarnji i dnevni opis samo kao posmatranje.", "Teško jutro uz kasnije stabilniju energiju razdvojilo bi dva iskustva.", "Razlike posle različitog trajanja dale bi dodatno poređenje, ne objašnjenje umora."],
      prohibited: ["Neprijavljena buđenja", "Mirna noć isključuje zdravstvenu teškoću", "Uzrok neoporavljajućeg sna"],
    },
    {
      id: "fragmented_night_preserved_daytime", predicate: all(kindIs("Q3", "difficulty"), kindIs("Q1", "positive"), kindIs("Q8", "positive")),
      ids: ["Q3", "Q1", "Q8"], groups: [["Q3"], ["Q1", "Q8"]], contrast: true, reframe: true, preserve: true,
      concepts: ["multiple_aspects", "self_observation"],
      relationship: "Teži opis toka noći stoji uz odmornije jutro i uglavnom stabilnu energiju tokom dana. Prekidi nisu dovoljan osnov da se izmisli jutarnji ili dnevni umor.",
      why: "Vredi razdvojiti iskustvo prekida od prijavljenog oporavka, a sačuvati mirniji opis jutra i dana.",
      nonObvious: "Isprekidan opis noći nije isto što i težak dan; trenutni odgovori ih ne izjednačavaju.",
      question: "Da li odmornije jutro i stabilnija energija ostaju prisutni i posle noći koje deluju više isprekidano, ili ovi odgovori opisuju različite noći?",
      alternatives: ["Mirniji dan i posle više prekida ograničio bi zaključak da prekidi već objašnjavaju dnevno iskustvo.", "Različite noći za mirnije dane i prekide pokazale bi da se odgovori ne odnose na ista vremena."],
      prohibited: ["Neprijavljeni dnevni umor", "Prekidi nemaju nikakav značaj", "Stabilna energija isključuje zdravstvenu teškoću"],
    },
    {
      id: "variable_timing_short_duration", predicate: all(flagIs("variable_timing"), flagIs("short_sleep")),
      ids: ["Q10", "Q9", "Q5"], groups: [["Q10", "Q9"], ["Q5"]], reframe: true,
      concepts: ["sleep_timing", "sleep_duration", "multiple_aspects", "self_observation"],
      relationship: "Promenljiv raspored i kraće prijavljeno trajanje opisuju dva ugla; nije poznato da li se menjaju zajedno.",
      why: "Najpre razdvoji raspored od trajanja, bez zaključka da promena rasporeda već objašnjava broj sati.",
      nonObvious: "Kraće trajanje ne potvrđuje kratku priliku za spavanje, a promenljiv raspored ne otkriva njen uzrok.",
      question: "Da li su kraće noći vezane za dane sa drugačijim rasporedom ili se javljaju i kada je raspored sličan?",
      alternatives: ["Zajednička promena dala bi poređenje rasporeda i trajanja, ne uzrok.", "Kraće noći i uz sličan raspored pokazale bi da trajanje ostaje zaseban ugao."],
      prohibited: ["Raspored uzrokuje kratko trajanje", "Kratka prilika za spavanje", "Potrebna precizna satnica"],
    },
    {
      id: "short_sleep_daytime", predicate: all(flagIs("short_sleep"), flagIs("morning_difficulty")),
      ids: ["Q5", "Q1"], groups: [["Q5"], ["Q1"]], reframe: true,
      concepts: ["sleep_duration", "multiple_aspects", "self_observation"],
      relationship: "Kraće prijavljeno trajanje i teško jutro daju odnos za poređenje; jutarnji odgovor sam ne opisuje energiju tokom celog dana.",
      why: "Vredi proveriti da li se teško jutro razlikuje posle različitog trajanja, bez tvrdnje da su kraće noći objašnjenje.",
      nonObvious: "Ovaj par ne dokazuje dnevni umor ni kratku priliku za spavanje.",
      question: "Da li je jutarnji osećaj drugačiji posle kraćih i dužih noći?",
      alternatives: ["Različita jutra podržala bi poređenje trajanja i jutarnjeg utiska.", "Slična jutra ostavila bi trajanje kao nepotpuno objašnjenje tog utiska."],
      prohibited: ["Trajanje uzrokuje umor", "Dnevni umor iz jutarnjeg odgovora", "Kratka prilika za spavanje"],
    },
    {
      id: "awakening_daytime_relation", predicate: all(flagIs("night_awakenings"), any(DAY_DIFFICULTY, flagIs("morning_difficulty"))),
      ids: (ctx) => ["Q3", ...(ctx.dayDifficulty ? ["Q8"] : ["Q1"])],
      groups: (ctx) => [["Q3"], [ctx.dayDifficulty ? "Q8" : "Q1"]],
      concepts: ["multiple_aspects", "self_observation"],
      relationship: "Prijavljena buđenja i teškoća u jutru ili danu daju dva odvojena ugla. Odgovori još ne pokazuju da se odnose na iste noći i dane.",
      why: "Poređenje dana posle više i manje prekida vrednije je od zaključka da su buđenja već objašnjenje umora.",
      nonObvious: "Zajedničko navođenje nije zajedničko javljanje.",
      question: "Da li su jutarnji osećaj i energija tokom dana drugačiji posle noći sa više ili manje prekida?",
      alternatives: ["Teži dani posle više prekida podržali bi zajedničko javljanje.", "Teški dani i posle drugačijih noći pokazali bi da dnevni opis ostaje zaseban ugao."],
      prohibited: ["Buđenja uzrokuju umor", "Umor je klinička pospanost", "Apneja"],
    },
    {
      id: "long_duration_unrestored", predicate: all(optionIs("Q5", 4), flagIs("morning_difficulty")),
      ids: ["Q5", "Q1"], groups: [["Q5"], ["Q1"]], contrast: true, reframe: true,
      concepts: ["multiple_aspects", "self_observation"],
      relationship: "Više od devet sati uz izostanak odmornosti i teško jutro ne daju osnovu da se priča svede na kratko trajanje.",
      why: "Najpre poredi osećaj oporavka posle različitih noći; nemoj automatski predlagati još duži ili kraći san.",
      nonObvious: "Duže prijavljeno trajanje nije potvrda osećaja oporavka.",
      question: "Da li se jutarnji osećaj razlikuje između noći s različitim trajanjem ili ostaje sličan?",
      alternatives: ["Razlike u jutrima dale bi poređenje, ne preporuku broja sati.", "Slična jutra uprkos različitom trajanju ograničila bi priču zasnovanu na satima."],
      prohibited: ["Kratko trajanje", "Potrebno je skratiti ili produžiti san", "Uzrok izostanka odmornosti"],
    },
    {
      id: "morning_daytime_relation", predicate: all(flagIs("morning_difficulty"), DAY_DIFFICULTY),
      ids: ["Q1", "Q8"], groups: [["Q1"], ["Q8"]],
      concepts: ["multiple_aspects", "self_observation"],
      relationship: "Jutarnji osećaj i energija tokom dana nisu ista procena, iako oba odgovora izdvajaju teškoću.",
      why: "Razdvajanje jutra i kasnijeg dana sprečava da se ceo dan opiše samo jutarnjim utiskom.",
      nonObvious: "Dve teškoće ne potvrđuju da se javljaju zajedno svakog dana.",
      question: "Da li teško jutro prati i manjak energije kasnije istog dana ili se ova iskustva razlikuju?",
      alternatives: ["Zajedničko javljanje dalo bi objedinjeno posmatranje jutra i dana.", "Različito javljanje pokazalo bi da jutro i dan treba opisati odvojeno."],
      prohibited: ["Jutarnji umor uzrokuje dnevni umor", "Jedan uzrok za oba odgovora"],
    },
    {
      id: "rested_morning_daytime_difficulty", predicate: all(kindIs("Q1", "positive"), DAY_DIFFICULTY),
      ids: ["Q1", "Q8"], groups: [["Q1"], ["Q8"]], contrast: true, reframe: true, preserve: true,
      concepts: ["multiple_aspects", "self_observation"],
      relationship: "Mirniji jutarnji osećaj i umor ili pospanost kasnije tokom dana nisu isti opis. Jutarnji odgovor ne poništava dnevno iskustvo.",
      why: "Vredi razdvojiti početak dana od energije kasnije, umesto automatski ciljati jutro koje opisuješ kao mirnije.",
      nonObvious: "Dobro jutro ne znači nužno stabilnu energiju tokom celog dana.",
      question: "Da li se umor ili pospanost tokom dana javljaju i posle jutara kada se osećaš dobro, ili ovi odgovori opisuju različite dane?",
      alternatives: ["Teži deo dana posle mirnijeg jutra potvrdio bi razliku između dva vremenska dela iskustva, ne uzrok.", "Različiti dani za ova iskustva ograničili bi kontrast unutar istog dana."],
      prohibited: ["Neprijavljeno teško jutro", "Uzrok pada energije tokom dana", "Dobro jutro isključuje zdravstvenu teškoću"],
    },
    {
      id: "preserve_calm_features", predicate: all(optionIs("Q5", 0), ...["Q1", "Q2", "Q3", "Q4", "Q6", "Q7", "Q8", "Q9", "Q10", "Q11", "Q12"].map((id) => kindIs(id, "positive"))),
      ids: ["Q1", "Q2", "Q3", "Q5", "Q6", "Q7", "Q8", "Q9", "Q10", "Q11", "Q12", "Q4"],
      groups: [], preserve: true, preservation: true, concepts: [],
      relationship: "Mirniji početak i tok sna, odmornije jutro i stabilnija energija stoje uz prijavljenih 7–9 sati i mirniju rutinu. Odgovori ne izdvajaju teškoću koju treba izmišljati.",
      why: "Postojeće prijatne delove vredi sačuvati bez obaveznog praćenja ili nove intervencije.",
      nonObvious: "Nije potrebno forsirati iznenađenje: mirniji odgovori nisu dokaz odsustva zdravstvenih teškoća.",
      question: null, alternatives: [], prohibited: ["Potvrđeno zdravlje", "Odsustvo poremećaja", "Potrebna intervencija"],
    },
  ];
}

function contextFor(base) {
  const byQuestion = new Map(base.facts.facts.map((fact) => [fact.questionId, fact]));
  const flag = (id) => base.facts.flags[id] === true;
  const ctx = { base, byQuestion, flag, dayDifficulty: flag("daytime_fatigue") || flag("daytime_sleepiness") };
  ctx.matches = (predicate) => {
    if (predicate.all) return predicate.all.every(ctx.matches);
    if (predicate.any) return predicate.any.some(ctx.matches);
    if (predicate.flag) return base.facts.flags[predicate.flag] === predicate.equals;
    const fact = byQuestion.get(predicate.questionId);
    return Boolean(fact && (predicate.kind ? fact.kind === predicate.kind
      : predicate.selected_option_indexes.includes(fact.selected_option_index)));
  };
  ctx.refs = (ids) => unique(ids.map((id) => byQuestion.get(id).fact_id));
  return ctx;
}

function candidateFor(rule, ctx) {
  const ids = typeof rule.ids === "function" ? rule.ids(ctx) : rule.ids;
  const fact_ids = ctx.refs(ids);
  const groups = typeof rule.groups === "function" ? rule.groups(ctx) : rule.groups;
  const related = ctx.base.retrieval.claims.filter((claim) => rule.concepts.includes(claim.concept) &&
    claim.fact_ids.some((id) => fact_ids.includes(id)));
  const predicate_met = ctx.matches(rule.predicate);
  const unknown_ids = rule.question ? [CO_OCCURRENCE] : [];
  const separate = groups.length === 2 && groups.every((group) => group.length > 0) &&
    !groups[0].some((id) => groups[1].includes(id));
  const genericity_flags = rule.generic ? ["unresolved_juxtaposition"] : [];
  if (fact_ids.length < 2) genericity_flags.push("single_fact");
  if (!predicate_met) genericity_flags.push("not_applicable");
  const grounded = fact_ids.length >= 2 && ids.every((id) => ctx.byQuestion.has(id));
  const values = {
    grounded_multiple_facts: grounded, contrast: rule.contrast === true,
    focus_reframe: rule.reframe === true, separate_experiences: separate,
    positive_avoid: rule.preserve === true,
    actionable_unknown: Boolean(rule.question && ctx.base.unknown.some(({ id }) => id === CO_OCCURRENCE)),
    evidence_available_bounded: related.length > 0 && related.every((claim) =>
      claim.release_allowed === false && claim.applicability_restrictions.length > 0 && claim.does_not_establish.length > 0),
    observation: Boolean(rule.question && rule.alternatives.length >= 2 && separate),
  };
  const penalties = {
    single_fact: fact_ids.length < 2,
    // A legacy contrast is useful, NOT a duplicate merely because it existed in
    // Phase 1. Only redundant generated candidates are penalized below.
    existing_duplicate: false, generic: Boolean(rule.generic), unsupported: !grounded,
    not_applicable: !predicate_met,
  };
  const criteria = {
    weights: { ...WEIGHTS }, values, penalties: Object.fromEntries(Object.entries(PENALTIES)
      .map(([key, weight]) => [key, { applied: penalties[key], weight }])),
    required_predicates: structuredClone(rule.predicate), predicate_met,
    dependency_fact_ids: [...fact_ids], distinct_scope_count: unique(ids.flatMap((id) => ctx.byQuestion.get(id).qualifiers)).length,
    interpretation_status: rule.preservation ? "observational_preservation" : "noncausal_hypothesis",
    score_use: "internal_editorial_utility_only_not_confidence", preservation: Boolean(rule.preservation),
    comparison_groups: groups.map(ctx.refs),
  };
  const score = Object.entries(WEIGHTS).reduce((sum, [key, weight]) => sum + (values[key] ? weight : 0), 0) -
    Object.entries(PENALTIES).reduce((sum, [key, weight]) => sum + (penalties[key] ? weight : 0), 0);
  return {
    insight_id: rule.id, fact_ids, relationship: rule.relationship, why_it_matters: rule.why,
    non_obvious: rule.nonObvious,
    uncertainty: { status: rule.preservation ? "observational_preservation" : "noncausal_hypothesis", text: NONCAUSAL,
      unknown_ids, source_qualifiers: ids.map((id) => {
        const fact = ctx.byQuestion.get(id);
        return { fact_id: fact.fact_id, frequency: structuredClone(fact.frequency), uncertainty: fact.uncertainty };
      }) },
    question: rule.question, prohibited_conclusions: unique([...rule.prohibited,
      ...ids.flatMap((id) => ctx.byQuestion.get(id).not_supported), ...related.flatMap((claim) => claim.does_not_establish),
      "Povezanost ili zajedničko navođenje dokazuje uzrok", "Promena postojećeg profila ili prioriteta"]),
    evidence_claim_ids: related.map(({ claim_id }) => claim_id), criteria, score, genericity_flags,
    question_fact_ids: rule.question ? ctx.refs(rule.questionIds || ids) : [],
    what_different_answers_would_clarify: [...rule.alternatives],
  };
}

function rankCandidates(candidates) {
  // Exact semantic containment with the same comparison groups, not textual
  // similarity. The more specific three-fact rule adds duration context to the
  // two-fact night/day question; keep the smaller candidate, mark redundancy.
  for (const candidate of candidates) {
    const covering = candidates.find((other) => other !== candidate &&
      other.fact_ids.length > candidate.fact_ids.length &&
      candidate.fact_ids.every((id) => other.fact_ids.includes(id)) &&
      JSON.stringify(other.criteria.comparison_groups) === JSON.stringify(candidate.criteria.comparison_groups));
    if (covering) {
      candidate.criteria.penalties.existing_duplicate.applied = true;
      candidate.criteria.penalties.existing_duplicate.covered_by = covering.insight_id;
      candidate.score -= PENALTIES.existing_duplicate;
    }
  }
  return candidates.sort((a, b) => b.score - a.score ||
    b.fact_ids.length - a.fact_ids.length || a.insight_id.localeCompare(b.insight_id, "en"));
}

function questionsFor(candidates, primary) {
  const seen = new Set();
  return candidates.filter(({ question }) => {
    if (!question || seen.has(question)) return false;
    seen.add(question);
    return true;
  }).map((candidate) => {
    const primaryRelevant = candidate.insight_id === primary.insight_id;
    // Question ranking is a separate information-value calculation. Never ask
    // again for an already selected answer; all questions explore uncollected
    // co-occurrence/comparison, not a new diagnostic questionnaire item.
    const values = { uncollected_relationship: candidate.uncertainty.unknown_ids.includes(CO_OCCURRENCE),
      separates_interpretations: candidate.what_different_answers_would_clarify.length >= 2,
      observation_utility: candidate.criteria.values.observation, primary_relevance: primaryRelevant };
    const weights = { uncollected_relationship: 20, separates_interpretations: 20,
      observation_utility: 15, primary_relevance: 25 };
    const score = Object.entries(weights).reduce((sum, [key, weight]) => sum + (values[key] ? weight : 0), 0) +
      Math.min(3, candidate.fact_ids.length);
    return { insight_id: candidate.insight_id, question: candidate.question, why_it_matters: candidate.why_it_matters,
      what_different_answers_would_clarify: [...candidate.what_different_answers_would_clarify],
      fact_ids: [...candidate.question_fact_ids], unknown_ids: [...candidate.uncertainty.unknown_ids],
      criteria: { weights, values, dependency_coverage_bonus: Math.min(3, candidate.fact_ids.length),
        already_collected: false, diagnostic: false, score_use: "internal_information_value_only" },
      score, quality: candidate.genericity_flags.length ? "low" : "relationship_specific", optional: true };
  }).sort((a, b) => b.score - a.score || a.insight_id.localeCompare(b.insight_id, "en"))
    .map((question, index) => ({ ...question, rank: index + 1 }));
}

function rivalsFor(primary, ctx, bestQuestion) {
  if (!bestQuestion || primary.criteria.preservation || primary.genericity_flags.length ||
    primary.criteria.comparison_groups.length !== 2) return [];
  const groups = primary.criteria.comparison_groups;
  // Two rival interpretations of timing, NEVER two invented medical causes.
  const supporting_fact_ids = unique(groups.flat());
  const limiting = ctx.base.facts.facts.filter((fact) => !supporting_fact_ids.includes(fact.fact_id) &&
    ((primary.insight_id.includes("daytime") && fact.questionId === "Q1" && fact.kind === "positive") ||
      primary.fact_ids.includes(fact.fact_id))).map(({ fact_id }) => fact_id);
  return [
    { interpretation: "Moguće je da se dva izdvojena iskustva javljaju u povezanim noćima i danima; odgovori to još ne potvrđuju.",
      observation: "Primeti da li se opisani utisci javljaju zajedno u istim ili povezanim noćima i danima." },
    { interpretation: "Moguće je da se dva iskustva menjaju odvojeno ili da odgovori opisuju različite noći i dane.",
      observation: "Primeti da li se jedan utisak menja dok drugi ostaje sličan, ili se odnose na različite noći i dane." },
  ].map(({ interpretation, observation }) => ({
    interpretation, supporting_fact_ids: [...supporting_fact_ids], limiting_fact_ids: [...limiting],
    missing_information: [{ unknown_id: CO_OCCURRENCE,
      description: "Odgovori ne potvrđuju iste noći i dane; kontekstualni ili mirniji odgovor ograničava objedinjavanje iskustava." }],
    discriminating_observation: `${observation} ${bestQuestion.question}`,
    prohibited_causal_conclusion: "Ni zajedničko ni odvojeno javljanje ne pokazuje uzrok, dijagnozu ili efekat promene navike.",
    interpretation_status: "noncausal_hypothesis", comparison_groups: structuredClone(groups),
  }));
}

function doNotTargetFirst(ctx) {
  const entries = [];
  const add = (id, ids, reason, qualification) => entries.push({ target_id: id, fact_ids: ctx.refs(ids),
    reason, qualification, fixed_priority_key: ctx.base.editorial_plan.priority_justification.key });
  if (ctx.byQuestion.get("Q2").selected_option_index === 0) {
    add("faster_initial_onset", ["Q2"], "Već navodiš vrlo brz početak sna; nije potrebno ciljati još brže uspavljivanje.",
      ctx.flag("active_thoughts") ? "Aktivne misli ostaju priznate. Unutar iste teme fokus nije brzina početka sna, nego odnos misli i iskustva kada legneš."
        : ctx.flag("return_difficulty") ? "Unutar toka noći ovo se odnosi samo na početak, ne na težak povratak u san."
          : "Ovo čuva samo prijavljeni početak sna, ne procenjuje celu noć niti menja postojeći prioritet.");
  }
  if (ctx.byQuestion.get("Q6").kind === "positive" && ctx.byQuestion.get("Q7").kind === "positive" && !ctx.flag("active_thoughts")) {
    add("extra_wind_down_rules", ["Q6", "Q7"], "Miran poslednji deo večeri i smirivanje misli ne traže automatski još pravila.",
      "Samo ova kombinacija je mirnija; eventualna teškoća uspavljivanja u drugom odgovoru i dalje ostaje priznata.");
  }
  if (ctx.byQuestion.get("Q10").kind === "positive" && !ctx.flag("variable_timing") &&
    [0, 1].includes(ctx.byQuestion.get("Q9").selected_option_index)) {
    add("stricter_schedule", ["Q10", "Q9"], "Prijavljen sličan raspored uz približno isto ili malo duže spavanje bez alarma nije osnov za strožu satnicu.",
      "Mala razlika slobodnim danom nije isto što i stalno promenljiv raspored; nema preporuke za raniji alarm.");
  }
  return entries;
}

function fallbackRule(ctx) {
  const notable = ctx.base.facts.facts.filter((fact) => fact.kind !== "positive" && fact.questionId !== "Q5");
  const first = notable[0] || ctx.byQuestion.get("Q5");
  const partnerId = first.questionId === "Q1" ? "Q8" : first.questionId === "Q8" ? "Q1"
    : ["Q2", "Q6", "Q7"].includes(first.questionId) ? (first.questionId === "Q2" ? "Q6" : "Q2")
      : ["Q4", "Q9", "Q10"].includes(first.questionId) ? (first.questionId === "Q10" ? "Q9" : "Q10")
        : first.questionId === "Q3" ? "Q12" : "Q3";
  const partner = ctx.byQuestion.get(partnerId);
  return {
    id: "selected_experiences_context", ids: [first.questionId, partnerId], groups: [[first.questionId], [partnerId]],
    predicate: all(optionIs(first.questionId, first.selected_option_index), optionIs(partnerId, partner.selected_option_index)),
    generic: true, concepts: ["self_observation"],
    relationship: `${first.description} ${partner.description} Nema dovoljno određenog kontrasta za jaču priču.`,
    why: "Ako želiš, uporedi ova dva utiska bez izmišljanja nove teškoće ili obaveznog praćenja.",
    nonObvious: "Ovde se ne forsira iznenađenje niti tumačenje izvan odgovora.",
    question: "Da li se ova dva opisana utiska menjaju zajedno ili se odnose na različite noći i dane?",
    alternatives: ["Zajedničko javljanje dalo bi konkretnije poređenje.", "Odvojeno javljanje ograničilo bi njihovo objedinjavanje."],
    prohibited: ["Nepotkrepljena teškoća", "Potvrđeni odnos između odgovora"],
  };
}

/**
 * Additive, synchronous Phase 1.5 wrapper. input: buildSleepPremiumInput's
 * canonical object; options: Phase 1 retrieval's {library?, maxClaims?}.
 * Returns {...Phase1, story_material}. Phase 1 editorial_plan, facts, profile,
 * theme_plan, evidence and techniques are deep-copied but otherwise unchanged.
 * All scores/criteria are internal draft ranking only. No AI, persistence,
 * diagnostic questions, clinical action, release permission or public schema.
 */
export function buildSleepPremiumStoryMaterial(input, options = {}) {
  const base = structuredClone(buildSleepPremiumPreAiAnalysis(input, options));
  const ctx = contextFor(base);
  const rules = definitions();
  const applicable = rules.filter((rule) => ctx.matches(rule.predicate));
  if (!applicable.length) applicable.push(fallbackRule(ctx));
  const candidates = rankCandidates(applicable.map((rule) => candidateFor(rule, ctx)));
  const primary = candidates[0];
  const secondaries = [];
  const covered = new Set(primary.fact_ids);
  for (const candidate of candidates.slice(1)) {
    if (secondaries.length === 2) break;
    if (!candidate.criteria.penalties.existing_duplicate.applied && candidate.fact_ids.some((id) => !covered.has(id))) {
      secondaries.push(candidate);
      candidate.fact_ids.forEach((id) => covered.add(id));
    }
  }
  const selectedIds = new Set([primary, ...secondaries].map(({ insight_id }) => insight_id));
  const rejected = candidates.filter(({ insight_id }) => !selectedIds.has(insight_id)).map((candidate) => ({
    ...structuredClone(candidate), reason: candidate.criteria.penalties.existing_duplicate.applied ? "covered_by_more_specific_relationship"
      : candidate.fact_ids.every((id) => covered.has(id)) ? "adds_no_distinct_dependency" : "lower_editorial_utility_or_secondary_limit",
  }));
  // Inapplicable definitions are NOT invented candidate insights. Keep only an
  // audit record of the unmet rule, without unsupported copy or evidence IDs.
  rejected.push(...rules.filter((rule) => !ctx.matches(rule.predicate)).map((rule) => ({
    insight_id: rule.id, reason: "not_applicable", required_predicates: structuredClone(rule.predicate),
    predicate_met: false, evidence_claim_ids: [],
  })));
  const questionCandidates = questionsFor(candidates, primary);
  const bestQuestion = questionCandidates[0] || null;
  const passed = primary.criteria.predicate_met && primary.criteria.values.grounded_multiple_facts &&
    primary.criteria.distinct_scope_count >= 2 && primary.genericity_flags.length === 0 &&
    !primary.criteria.penalties.unsupported.applied &&
    (primary.criteria.preservation || primary.criteria.values.separate_experiences);
  const storyRefs = unique([primary, ...secondaries].flatMap(({ fact_ids }) => fact_ids));
  const secondaryLinks = secondaries.map((candidate) => ({ insight_id: candidate.insight_id,
    fact_ids: [...candidate.fact_ids], why_it_matters: candidate.why_it_matters,
    relation_to_primary: "Dodatni ugao za poređenje, ne uzrok glavnog iskustva i ne novi prioritet." }));
  const story = {
    primary_insight_id: primary.insight_id, fact_ids: storyRefs,
    text: `${primary.relationship} ${primary.why_it_matters}${secondaries.length ? ` Kao dopuna, ${secondaries.map((candidate) => candidate.why_it_matters).join(" ")}` : ""} ${primary.criteria.preservation ? "Bez obavezne intervencije ili forsiranog iznenađenja." : "Ostaje otvoreno da li ovi opisi pripadaju istim noćima i danima; nijedan odnos ovde nije utvrđeni uzrok."}`,
    secondary_links: secondaryLinks, unknown_ids: unique([primary, ...secondaries].flatMap((candidate) => candidate.uncertainty.unknown_ids)),
    fixed_priority: structuredClone(base.editorial_plan.priority_justification),
    interpretation_status: primary.criteria.interpretation_status,
  };
  return { ...base, story_material: {
    candidate_insights: structuredClone(candidates), primary_insight: structuredClone(primary),
    secondary_insights: structuredClone(secondaries), rejected_or_lower_value_candidates: rejected,
    so_what: { text: primary.why_it_matters, fact_ids: [...primary.fact_ids],
      unknown_ids: [...primary.uncertainty.unknown_ids], does_not_change_priority: true },
    rival_explanations: rivalsFor(primary, ctx, bestQuestion), best_next_question: bestQuestion && {
      question: bestQuestion.question, why_it_matters: bestQuestion.why_it_matters,
      what_different_answers_would_clarify: [...bestQuestion.what_different_answers_would_clarify],
      fact_ids: [...bestQuestion.fact_ids], unknown_ids: [...bestQuestion.unknown_ids],
    },
    do_not_target_first: doNotTargetFirst(ctx), question_candidates: questionCandidates,
    specificity_check: { passed, required_predicates: structuredClone(primary.criteria.required_predicates),
      predicate_met: primary.criteria.predicate_met, dependency_fact_ids: [...primary.fact_ids],
      distinct_scope_count: primary.criteria.distinct_scope_count, internal_utility_score: primary.score,
      genericity_flags: [...primary.genericity_flags], method: "executable_predicates_and_canonical_dependencies_not_text_similarity",
      note: primary.criteria.preservation ? "Grounded preservation; no forced surprise or intervention, not a generic failure."
        : passed ? "Grounded noncausal relationship; two-fact relationships can be valuable without rare or extreme answers."
          : "Selected-answer context only; no specific relationship or surprise is established." },
    main_story: story,
    twist: primary.criteria.values.contrast && !primary.criteria.preservation ? {
      insight_id: primary.insight_id, fact_ids: [...primary.fact_ids], text: primary.non_obvious,
      interpretation_status: "noncausal_hypothesis", unknown_ids: [...primary.uncertainty.unknown_ids],
    } : null,
    open_question: bestQuestion ? { text: bestQuestion.question, fact_ids: [...bestQuestion.fact_ids],
      unknown_ids: [...bestQuestion.unknown_ids] } : null,
  } };
}