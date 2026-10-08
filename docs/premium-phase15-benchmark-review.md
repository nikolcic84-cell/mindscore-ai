# Phase 1.5 premium sleep: six-fixture benchmark review

**Inspection date:** 2026-10-09. **Status:** internal analytical draft; clinical review and release approval pending. **All examples are synthetic.**

## Provenance, API and reading contract

This is an authored **readable rendering** of actual local `buildSleepPremiumStoryMaterial(buildSleepPremiumInput(fixture.answers))` outputs, with default options, for all six exported `benchmarkFixtures`. Condensed explanations below are review prose, not additional machine-generated conclusions. Canonical selected-answer strings, IDs, scores, next questions and main-story text are retained exactly. Repeated caveats, prohibitions, unknowns and experiment actions are normalized into shared dictionaries with explicit fixture references; they are not omitted or silently relaxed. No external source paragraphs or published diary instrument are reproduced.

The raw complete CLI is available through the existing [debug script](../scripts/debug-sleep-premium-story-material.js): `node scripts/debug-sleep-premium-story-material.js`. It was executed through Node stdout for this review; no AI, network call, customer record or report generation was used. Additional stdout queries extracted structured decisions and checked all-six equality against `buildSleepPremiumPreAiAnalysis`.

Current API: [input builder](../server/sleepPremiumInput.js) takes twelve integer **raw points**, 1–5, converts to canonical answer selections and computes the existing profile. [Story material](../server/sleepPremiumStoryMaterial.js) takes that canonical object and optional Phase 1 retrieval options `{ library?, maxClaims? }`; it synchronously returns the unchanged Phase 1 analysis plus `story_material`. It does not accept a profile name as a story-selection shortcut. Answer predicates, fact dependencies and already-selected evidence determine applicability. Every returned Phase 1 field was deep-equal to the separately built Phase 1 output for each fixture. `release_allowed` remained `false`.

The wrapper is **not connected** to the current [generator](../server/sleepPremiumGenerator.js), [prompt](../server/sleepPremiumPrompt.js), [preview](../server/sleepPremiumPreview.js) or [server routes](../server/server.js): inspected files contain no story-wrapper import/reference. This review is not a deployed report, new report schema, customer-facing score or approval to integrate. Implementation, tests, payments, UI, PDFs and delivery are outside this document's scope.

## Cross-fixture comparison

| Fixture | Actual profile | Fixed priority area / theme | Primary insight | Editorial score | Why this selection wins |
| --- | --- | --- | --- | --- | --- |
| `current` | ISPREKIDAN SAN | Tok noći / `NIGHT_CONTINUITY` | `continuity_daytime_relation` | 80 | Duration supplies a third dependency to the night/day comparison; wins the 80-point tie against the two-fact morning/day contrast. |
| `budan` | BUDAN UM | Period pre sna / `BEDTIME_TRANSITION` | `calm_routine_active_thoughts` | 80 | Calm routine versus active thoughts/onset; equal score and fact count with the other candidate, so ID ordering resolves the tie. |
| `umoran` | UMORAN SAN | Osećaj po buđenju / `RECOVERY_DURATION` | `recovery_despite_calm_night` | 80 | Adds calm onset and continuation to morning/day difficulty; the smaller morning/day pair is redundant. |
| `pressure` | SAN POD PRITISKOM | Više delova tvoje noći / `BEDTIME_TRANSITION` | `duration_recovery` | 75 | Short duration, hard morning and conditional free-day answer create a contrast; no positive-preservation bonus. Priority remains the original multiple-area priority. |
| `calm` | MIRNA NOĆ | Tvoj san u celini / `RECOVERY_DURATION` | `preserve_calm_features` | 15 | All required calmer selections hold; preservation deliberately earns neither a manufactured contrast nor question/evidence bonuses. |
| `second_isprekidan` | ISPREKIDAN SAN | Tok noći / `NIGHT_CONTINUITY` | `fragmented_night_preserved_daytime` | 80 | Fragmented-night description contrasts with rested morning and stable energy, not invented daytime difficulty. |

### Internal ranking criteria, not validated measurement

Candidate weights are editorial choices: grounded multiple facts **10**, contrast **15**, focus reframe **10**, separate experiences **10**, positive avoidance/preservation **5**, actionable unknown **15**, available bounded evidence **5**, usable observation **10**. Penalties: single fact **30**, existing duplicate **10**, generic **25**, unsupported **100**, not applicable **100**. These arbitrary weights have no clinical calibration, success probability, confidence meaning, normative sample or validated utility scale.

For compact candidate tables, **G/C/F/S/P/U/E/O** refer to the eight criteria in the preceding order. A listed letter is true; an unlisted letter is false. Applicable benchmark candidates have grounded dependencies and no generic/unsupported/not-applicable penalty. **D−10** means the exact containment/comparison-group duplicate penalty, not a semantic similarity judgment. Sort: descending score, then descending number of facts, then English-locale insight ID. Secondary selection adds a previously uncovered fact, rejects duplicate-penalized candidates and stops at two; being eligible is not enough to become a secondary.

Question ranking is separate: uncollected relationship **20**, distinguishes interpretations **20**, observation utility **15**, primary relevance **25**, plus up to **3** fact-coverage points. All emitted questions are optional, non-diagnostic and not already collected. In these outputs the best question scores **83**; non-primary three-fact questions score **58**, two-fact questions **57**. None of those numbers is information gain measured in a study. Specificity checks passed for all six, with distinct scopes respectively **3, 3, 4, 3, 12, 3**; passing means executable predicate/dependency checks, not validation of an inferred personal relationship.

## Shared answer scopes and uncertainty

In every fixture, `Qn` below is the readable alias for the actual `FACT_Qn`. Every primary/secondary inherits the frequency and uncertainty of each referenced answer exactly; no question qualifier becomes an exact incidence estimate. A dash in an answer table means the returned qualifier is null, not a negative finding.

| Question | Actual scope qualifier | Question-level frequency |
| --- | --- | --- |
| Q1 | `morning_self_report` | najčešće |
| Q2 | `after_lights_out` | obično |
| Q3 | `within_night` | najčešće |
| Q4 | `when_alarm_rings` | — |
| Q5 | `sleep_duration_not_time_in_bed` | obično |
| Q6 | `last_30_minutes_before_sleep` | — |
| Q7 | `when_lying_down` | — |
| Q8 | `daytime_self_report` | — |
| Q9 | `conditional_free_day_without_alarm` | — |
| Q10 | `bedtime_and_wake_time_predictability` | — |
| Q11 | `conditional_day_after_poor_sleep` | — |
| Q12 | `recent_nights_self_report` | — |

All non-preservation insights have status `noncausal_hypothesis`, unknown reference `co_occurrence_same_days`, and this exact boundary: **“Urednička hipoteza za poređenje odgovora, ne utvrđena povezanost, uzrok ili dijagnoza.”** The calm candidate has status `observational_preservation`, empty unknown references and the same boundary text. It is preservation of reported experience, not medical clearance.

## Shared complete unknown register

**All eleven remain unknown in every fixture**, including `calm`. Every fixture's “All unknowns” heading incorporates this complete register. A selected qualitative answer does not resolve exact sleep opportunity, clinical duration or safety.

| Actual ID | Actual label |
| --- | --- |
| `age` | Uzrast |
| `symptom_duration` | Trajanje eventualnih tegoba |
| `breathing_symptoms` | Simptomi povezani sa disanjem tokom sna |
| `medication` | Upotreba lekova |
| `medical_history` | Medicinska istorija |
| `driving_impairment` | Uticaj umora ili pospanosti na vožnju |
| `exact_sleep_wake_times` | Tačna vremena spavanja i buđenja |
| `shift_work` | Rad u smenama |
| `bedroom_conditions` | Uslovi u spavaćoj sobi |
| `actual_sleep_opportunity` | Stvarna prilika za spavanje |
| `co_occurrence_same_days` | Da li se opisane pojave javljaju istih dana |

## Shared science: authored source metadata and exact returned caveats

These are the **six distinct selected claim IDs** across the benchmarks, not six sources selected for each person. The clinical AASM guideline is in the registry but never selected here. All selected claims are revision **1**, `clinical_review_status=pending`, `release_status=clinical_review_pending`, `release_allowed=false`; source records are `source_verified_clinical_review_pending`. Source verification recorded in the registry is not a new verification performed by this review, clinician approval or proof that the product works.

Every selected claim includes both exact common restrictions:

- “Age is not established; population-limited evidence is educational, not an individual prescription.”
- “Clinical review is pending; source verification does not authorize release.”

Each fixture incorporates those two restrictions plus **all** claim-specific restrictions and non-establishment items below for each claim it lists.

### `SLEEP_MULTIDIMENSIONAL` — `EV_SLEEP_MULTIDIMENSIONAL_R1`

Source: `AASM_SRS_DURATION_2015`; AASM/SRS, 2015, healthy-adult sleep-duration consensus, *Journal of Clinical Sleep Medicine*. DOI **10.5664/jcsm.4758**. Evidence `expert_consensus`; strength `consensus_context`. Educational point: duration, timing, regularity and perceived quality are different aspects; hours alone do not establish recovery.

Exact restrictions: “Do not claim a questionnaire measures circadian phase or rules out disorders.”; “No causal attribution to a particular answer.”; “Perceived quality is not a clinical assessment.”

Exact does-not-establish: “A cause of poor recovery”; “A diagnosis”; “Validity of a product score”.

### `DIARY_CORE_OBSERVATION` — `EV_DIARY_CORE_OBSERVATION_R1`

Source: `CARNEY_DIARY_2012`; Carney and colleagues, 2012, consensus sleep diary development, *Sleep*. DOI **10.5665/sleep.1642**. Evidence `expert_consensus_measurement_development`; strength `measurement_design_consensus`. It supports separating prospective subjective observations, not treating symptoms or calling the product's abbreviated log the published instrument.

Exact restrictions: “No overnight alarms or clock-checking for measurement.”; “Stop optional tracking if it increases preoccupation.”; “Subjective self-report.”; “No efficacy trial of tracking in this paper.”; “Do not reproduce the published diary or claim instrument equivalence.”

Exact does-not-establish: “Treatment efficacy”; “Objective sleep measurement”; “That this abbreviated log is the validated Consensus Sleep Diary”.

### `TWO_PROCESS_MODEL` — `EV_TWO_PROCESS_MODEL_R1`

Source: `BORBELY_TWO_PROCESS_2016`; Borbély, Daan, Wirz-Justice and Deboer, 2016, two-process-model reappraisal, *Journal of Sleep Research*. DOI **10.1111/jsr.12371**. Evidence `conceptual_review`; strength `conceptual_framework`. A conceptual account of homeostatic/circadian interaction, not measurement of this synthetic person's physiology.

Exact restrictions: “No inferred circadian-phase defect.”; “No prescribed sleep deprivation or light dose.”; “Not a trial of wake-regularity actions.”; “Questionnaire does not measure homeostatic or circadian physiology.”

Exact does-not-establish: “An individual's circadian phase”; “Cause of morning difficulty”; “A treatment schedule”.

### `TODO_WRITING_LAB` — `EV_TODO_WRITING_LAB_R1`

Source: `SCULLIN_WRITING_2018`; Scullin and colleagues, 2018, bedtime-writing laboratory study, *Journal of Experimental Psychology: General*. DOI **10.1037/xge0000374**. Evidence `small_randomized_laboratory_study`; strength `limited_single_study`. The study compared future-task with completed-activity writing in one laboratory night, not writing versus nothing; an optional home adaptation is indirect extrapolation.

Exact restrictions: “Stop an optional writing experiment if it increases distress or rumination.”; “Do not substitute for assessment of persistent symptoms.”; “57 participants aged 18–30.”; “One controlled laboratory night.”; “Completed-activity-list comparator, not a no-writing control.”; “Active thoughts do not identify the studied mechanism.”

Exact does-not-establish: “Benefit versus doing no writing”; “Long-term benefit”; “Effect in clinical insomnia or all ages”; “Earlier-evening writing has the same effect”.

### `QUIET_PREBED_GUIDANCE` — `EV_QUIET_PREBED_GUIDANCE_R1`

Source: `NHLBI_HABITS_2022`; NHLBI/NIH, 2022 educational page, “Sleep Deprivation and Deficiency: Healthy Sleep Habits”; DOI **null**, not missing bibliographic evidence of a trial. Canonical URL: https://www.nhlbi.nih.gov/health/sleep-deprivation/healthy-sleep-habits. Evidence `public_health_education`; strength `general_guidance_not_trial_evidence`. A quiet transition is educational guidance; a short content pause is not a demonstrated insomnia intervention.

Exact restrictions: “No claim that screens caused this person's difficulty.”; “No precise light dosing or rigid routine duration.”; “No trial effect size or guarantee.”; “Not standalone chronic-insomnia treatment.”

Exact does-not-establish: “Trial efficacy of a short content break”; “A causal effect of this person's screen use”; “A mandatory one-hour routine”.

### `REGULAR_TIMES_GUIDANCE` — `EV_REGULAR_TIMES_GUIDANCE_R1`

Source: `NHLBI_HABITS_2022`, same 2022 public-health page and URL; DOI **null**. Evidence `public_health_education`; strength `general_guidance_not_trial_evidence`. General regularity advice must preserve sleep opportunity and accommodate feasibility and shift work; it is not a fixed-wake prescription.

Exact restrictions: “No wake-time prescription that reduces sleep opportunity.”; “Do not assume a non-shift-work schedule.”; “Age and work schedule are not inferred.”; “No efficacy trial of this product's scheduling experiment.”

Exact does-not-establish: “An optimal wake hour”; “That an alarm difficulty indicates circadian dysfunction”; “Guaranteed improved energy”.

## Shared technique and seven-day rendering dictionary

Eligible means an **unreleased optional draft candidate**, not a clinical indication or a requirement to use it. Review is pending for eligible and excluded techniques alike. Selection is based on action-eligible returned claim IDs; contextual claims are not substitutes for a missing linked claim.

| Code / actual technique | Concise rendering of actual approved action | Actual first observation / additional eligible value |
| --- | --- | --- |
| **S** / `SELF_OBSERVATION` | In the morning briefly note approximate sleep/rise times, remembered awakenings and overall impression; no nighttime clock checks or monitoring alarms. | “Da li se buđenja i ukupan utisak menjaju zajedno ili se razlikuju?” Also asks whether the short record is useful or adds burden. Low burden; no mandatory run of days. Linked `DIARY_CORE_OBSERVATION`, contextual `DIARY_VALIDATION_BOUNDARY`; not the original instrument or treatment-efficacy evidence. |
| **W** / `COGNITIVE_OFFLOAD` | Optional paper list of concrete upcoming tasks before bed, up to five minutes; close it, do not solve problems or finish the plan, stop if unpleasant. | “Da li ti je lakše da ostaviš planiranje ili te zapis dodatno zaokuplja?” Onset remains a separate observation, without expected change. Linked `TODO_WRITING_LAB`; the home adaptation is not established treatment. |
| **V** / `WIND_DOWN` | Optional end to content a little before bed and a pleasant quiet activity; no need to change the rest of the evening or delay sleep for the routine. | “Da li ti prelaz prija, čak i ako je uspavljivanje isto?” Also asks whether the habit simplifies or burdens the evening. Linked `QUIET_PREBED_GUIDANCE`; guidance, not trial efficacy. |
| **F** / no technique | Optional notice of the allocated sleep aspect, without changing routine, checking the clock or deliberately awakening. | Use the allocation's observation code below. Actual mode `observation_fallback`. |
| **C** / no technique | Optional comparison of impressions so far, with no new change or deliberate awakening. | Allocation observation below; day 4 fallback. |
| **R** / no technique | Review impressions and choose what was feasible; continued tracking is not necessary. | Allocation observation below; day 7 fallback. |

`WAKE_REGULARITY` is excluded for all six; its unused approved candidate would compare usual/free-day rise times and feasibility without changing the alarm, with enough sleep and allowance for shifts. It is **not** an action added to these plans. `RELAXATION` and `STIMULUS_CONTROL_EDUCATION` have **no approved actions**, are always excluded from Phase 1 action selection, and retain clinical educational context only. No generic breathing rate, breath hold, muscle-tension regimen, leaving-bed timer or fixed-rise prescription is authorized.

Exact observation codes used in the seven-day tables:

- **J:** “Da li se opisani utisci javljaju zajedno ili se razlikuju?”
- **B:** “Da li se tvoj utisak o poslednjem delu večeri razlikuje od iskustva uspavljivanja?”
- **D:** “Da li se prijavljeno trajanje, jutarnji osećaj i doživljaj dana menjaju zajedno ili razlikuju?”
- **N:** “Da li se sećanje na buđenja i ukupan utisak o noći podudaraju ili razlikuju?”
- **T:** “Da li je ustajanje drugačije uz alarm i bez njega, i šta o rasporedu još nije jasno?”
- **S/W:** the exact first observation of the corresponding technique above.

Theme shorthand: **B** = `BEDTIME_TRANSITION`, **D** = `RECOVERY_DURATION`, **N** = `NIGHT_CONTINUITY`, **T** = `RHYTHM_WAKE`. Days 1–7 retain actual purposes respectively `BASELINE`, `PRIORITY_EXPERIMENT`, `OTHER_SUPPORTED_AREA`, `COMPARISON`, `THIRD_ANGLE`, `USER_CHOICE`, `REVIEW`. Day 5 retains `differentActionFromDay2And3=true`; it does **not** guarantee a distinct eligible technique. S/W/V actions are `optional_draft_candidate`; F/C/R have null technique IDs. Fallback reason in every F/C/R record is lack of a distinct eligible selected-evidence action for that allocation; observation is optional, not a validated diary or treatment.

All fallback records retain “Preskoči ako posmatranje povećava zabrinutost.” and “Nema obaveznog zapisa ni promene satnice.” S records retain the stop-tracking, no-promise and no-treatment restrictions below. Every day has `release_allowed=false`. Tables preserve the actual allocations and action/observation selections rather than redesigning them around Phase 1.5 stories.

## Shared prohibitions: complete fact/general/technique boundaries

For **every** fixture, include this entire section, its selected science restrictions, and its case-specific candidate prohibitions below. This preserves boundaries from excluded techniques too, rather than equating exclusion with clinical clearance.

### Fact boundaries

Every Q1–Q12 forbids: “medicinska dijagnoza”; “uzrok opisanog iskustva”; “precizna učestalost koja nije navedena”; “istovremeno javljanje sa drugim odgovorima”; “promena klasifikacije na osnovu jednog odgovora”. Additional exact per-question prohibitions:

| Fact | Additional `not_supported` values |
| --- | --- |
| Q1 | objektivno izmerena odmornost; uzrok jutarnjeg osećaja |
| Q2 | tačno vreme potrebno za uspavljivanje; uzrok otežanog uspavljivanja |
| Q3 | tačno trajanje buđenja; uzrok noćnih buđenja |
| Q4 | tačno vreme ustajanja; uzrok odlaganja alarma |
| Q5 | vreme provedeno u krevetu; kratka prilika za spavanje; tačna potreba za snom |
| Q6 | sadržaj, osvetljenost ili uređaj koji nisu navedeni; uticaj sadržaja na san |
| Q7 | uzrok aktivnih misli; misli kao dokaz poremećaja |
| Q8 | količina, vreme ili stvarni unos kofeina; umor kao dokaz kliničke pospanosti; uticaj na vožnju |
| Q9 | dug sna; stvarno duže spavanje iz želje da se ostane u krevetu; precizno trajanje dodatnog sna |
| Q10 | tačna vremena sna i buđenja; smenski rad kao uzrok rasporeda |
| Q11 | učestalost loših noći; učestalost opisanih posledica; iste posledice posle svake noći |
| Q12 | trajanje tegoba; objektivna procena kvaliteta sna |

### General and inherited insight prohibitions

Exact shared items: “Dug sna iz dužeg spavanja bez alarma”; “Upitnik potvrđuje hroničnu nesanicu ili apneju”; “Izvor je klinički pregledan ili spreman za objavljivanje”; “Neprijavljeni uzrast, smene, navike ili istorija”; “Samostalni CBT-I, kontrola stimulusa ili klinički protokol relaksacije”; “Restrikcija sna, raniji alarm koji skraćuje san ili precizna doza svetla”; “Povezanost ili zajedničko navođenje dokazuje uzrok”; “Obećanje da će pokušaj poboljšati san”. Every candidate also forbids “Promena postojećeg profila ili prioriteta”, inherits its referenced facts' full `not_supported`, and inherits related claims' full `does_not_establish`. A case's complete boundary set includes **all applicable candidates**, not just primary and secondaries.

### Technique exclusions, no promises and escalation (including excluded techniques)

- `SELF_OBSERVATION`: “Prekini beleženje ako povećava zabrinutost ili opterećenje.”
- `COGNITIVE_OFFLOAD`: “Ne koristi za produženo analiziranje problema.”; “Prekini ako pisanje pojačava zabrinutost ili uznemirenost.”
- `WIND_DOWN`: “Ne navodi ekran kao dokazani uzrok problema.”; “Ne nameći trajanje, zabranu svih uređaja ili preciznu dozu svetla.”
- `WAKE_REGULARITY`: “Ne pomeraj alarm ranije i ne skraćuj vreme za san.”; “Ne propisuj istu satnicu smenskom radniku ili osobi čiji raspored nije poznat.”
- `RELAXATION`: “Uvek isključeno iz izbora radnji u PHASE1.”; “Nepoznati zdravstveni podaci nisu negativan klinički nalaz.”
- `STIMULUS_CONTROL_EDUCATION`: “Uvek isključeno iz izbora radnji u PHASE1.”; “Bez obaveznog izlaska iz kreveta, merenja minuta ili propisanog vremena ustajanja.”
- All six: “Nema obećanja boljeg sna, kraćeg uspavljivanja ili veće energije.”; “Ovo nije dijagnoza niti zamena za lečenje.”
- All six escalation records: “Ako teškoće traju, pogoršavaju se ili ometaju svakodnevno funkcionisanje, razgovaraj sa lekarom.”; “Ako si pospan/a za volanom, nemoj voziti; obezbedi bezbedan prevoz i potraži stručni savet.”; “Hrkanje sa prekidima disanja, gušenjem ili izraženom dnevnom pospanošću zahteva stručnu procenu, ne samo promenu rutine.” These are conditional safety boundaries, **not** assertions that any fixture has those symptoms.

### Shared clinical exclusion keys

For concise but complete exclusion rendering, **CA** means `clinical_assessment_not_established` plus all actual unknown prerequisite reasons: `age`, `symptom_duration`, `breathing_symptoms`, `medication`, `medical_history`, `driving_impairment`, `actual_sleep_opportunity`. **H** means `education_need_not_established` plus `unknown_prerequisite:symptom_duration`. **NR** = `no_personal_relevance`; **RP** = `registry_predicates_not_met_or_unknown`. These abbreviations are reasons, not assessments.

Excluded technique reason shorthand: **L** = `linked_evidence_not_returned`; **F** = `flag_rules_not_met`; **A(claim)** = `claim_not_applicable:claim`; **M** = `missing_prerequisites`; **X** = `exclusion_flag_present`; **ED** = `education_only_not_action_eligible`. `RELAXATION` M is exactly `assessment.age`, `assessment.symptom_duration`, `assessment.driving_impairment`, `assessment.breathing_symptoms`, `assessment.relevant_clinical_history`; stimulus-control M adds `assessment.mobility_safety`. Both clinical techniques remain excluded even when their symptom flags hold.

## Shared rival records and do-not-target qualifications

The five non-calm fixtures each emit **exactly two** rivals; `calm` emits none. Their interpretation and missing-information text are identical, while support, limits and comparison groups vary per case. Each fixture's rival subsection supplies those actual references and the full selected question; the discriminating observation is the exact prefix below **followed by that question** (literal concatenation, not an invented alternative question).

1. Exact interpretation: “Moguće je da se dva izdvojena iskustva javljaju u povezanim noćima i danima; odgovori to još ne potvrđuju.” Exact discriminating prefix: “Primeti da li se opisani utisci javljaju zajedno u istim ili povezanim noćima i danima.”
2. Exact interpretation: “Moguće je da se dva iskustva menjaju odvojeno ili da odgovori opisuju različite noći i dane.” Exact discriminating prefix: “Primeti da li se jedan utisak menja dok drugi ostaje sličan, ili se odnose na različite noći i dane.”

Both records have status `noncausal_hypothesis`, missing ID `co_occurrence_same_days` and exact missing description “Odgovori ne potvrđuju iste noći i dane; kontekstualni ili mirniji odgovor ograničava objedinjavanje iskustava.” Both prohibit “Ni zajedničko ni odvojeno javljanje ne pokazuje uzrok, dijagnozu ili efekat promene navike.” An empty limiting list is preserved as empty; it is not proof of an unlimited interpretation.

Repeated do-not-target records, included only where a fixture lists them:

- **E** / `extra_wind_down_rules`, Q6+Q7: “Miran poslednji deo večeri i smirivanje misli ne traže automatski još pravila.” Qualification: “Samo ova kombinacija je mirnija; eventualna teškoća uspavljivanja u drugom odgovoru i dalje ostaje priznata.”
- **T** / `stricter_schedule`, Q10+Q9: “Prijavljen sličan raspored uz približno isto ili malo duže spavanje bez alarma nije osnov za strožu satnicu.” Qualification: “Mala razlika slobodnim danom nije isto što i stalno promenljiv raspored; nema preporuke za raniji alarm.”
- **O** / `faster_initial_onset`, Q2: “Već navodiš vrlo brz početak sna; nije potrebno ciljati još brže uspavljivanje.” Qualification is case-specific below. All entries retain the fixture's original `fixed_priority_key`; they do not veto recognition of another selected difficulty.

## 1. `current`

### Profile / all 12 exact selected answers

Raw points: `[4,5,2,3,5,4,4,3,4,4,3,3]`; actual **ISPREKIDAN SAN**. Scope/question frequency are in the shared table; below are the exact answer-level frequency and uncertainty.

| Fact | Exact selected string | Answer frequency | Uncertainty |
| --- | --- | --- | --- |
| Q1 | Uglavnom dobro, ali bih mogao još malo da spavam | Uglavnom | bih mogao |
| Q2 | Zaspim vrlo brzo | — | — |
| Q3 | Kada se probudim, teško ponovo zaspim | — | — |
| Q4 | Odložim alarm jednom | — | — |
| Q5 | 7–9 sati | — | — |
| Q6 | Imam svoju mirnu večernju rutinu | — | — |
| Q7 | Razmišljam malo, pa se smirim | — | — |
| Q8 | Često mi treba kafa ili pauza | Često | — |
| Q9 | Spavam malo duže | — | — |
| Q10 | Većinom imam isti ritam | Većinom | — |
| Q11 | Teže se koncentrišem | — | — |
| Q12 | Moj san bi mogao biti bolji | — | bi mogao |

### Themes / priority

`RECOVERY_DURATION` (duration, morning and day), focus Q8/Q11/Q12; `NIGHT_CONTINUITY` (night course/overall impression, only awakening answer describes interruptions), focus Q3; `RHYTHM_WAKE` (alarm/free day/predictability), focus Q4. Fixed area **Tok noći**, key `continuity`, theme `NIGHT_CONTINUITY`; priority justification references Q3/Q12. Q1 remains qualified mostly-good experience, not a fabricated hard morning.

### Candidates with actual scores / concise criteria

| Rank | ID | Score | Facts | True criteria / penalty |
| --- | --- | --- | --- | --- |
| 1 | `continuity_daytime_relation` | 80 | Q5/Q3/Q8 | G/C/F/S/P/U/E/O |
| 2 | `rested_morning_daytime_difficulty` | 80 | Q1/Q8 | G/C/F/S/P/U/E/O |
| 3 | `easy_onset_difficult_return` | 70 | Q2/Q3 | G/C/S/P/U/E/O |
| 4 | `awakening_daytime_relation` | 40 | Q3/Q8 | G/S/U/E/O; D−10, covered by rank 1 |

All four evidence lists are exactly `SLEEP_MULTIDIMENSIONAL`, `DIARY_CORE_OBSERVATION`. The first tie resolves by three versus two dependencies, not greater clinical importance.

### Rejected / lower-value and inapplicable IDs

`awakening_daytime_relation`: `covered_by_more_specific_relationship`, same comparison groups contained in the duration-context primary. All remaining entries are `not_applicable`, with `predicate_met=false` and no evidence IDs: `duration_recovery`, `short_sleep_daytime`, `variable_timing_short_duration` (no short sleep/hard morning as required); `variable_timing_duration` (no variable timing); `calm_routine_active_thoughts`, `onset_thoughts_calm_night` (no active thoughts/onset difficulty); `recovery_despite_calm_night` (no hard morning or calm Q3); `fragmented_night_preserved_daytime` (Q8 is not positive); `long_duration_unrestored` (no >9-hour/hard-morning pair); `morning_daytime_relation` (Q1 not hard); `preserve_calm_features` (not every calmer prerequisite). No unsupported personalized text is emitted for unmet rules.

### Primary: facts / why / non-obvious / evidence / uncertainty / prohibited

`continuity_daytime_relation`, Q5/Q3/Q8: 7–9 reported hours, difficult return and a daytime difficulty describe separate aspects. **Why / SO WHAT:** compare morning/day impressions after more versus fewer interruptions at similar reported duration, rather than automatically adding hours or accelerating initial onset. **Non-obvious:** a calmer-sounding duration range can coexist with difficult continuation/daytime experience; same-day occurrence is unknown. Evidence: the two claims above. Uncertainty: shared noncausal status plus exact Q5/Q3/Q8 qualifiers. Primary-specific forbidden conclusions: “7–9 sati je dovoljno baš za ovu osobu”; “Prekidi uzrokuju dnevni umor”; “Potrebno je produžiti san”. Shared inherited limits also apply.

### Secondary insights: same value fields

- `rested_morning_daytime_difficulty`, Q1/Q8, same two claims: mostly-good morning does not cancel later difficulty. Why: separate day start from later energy, not target a morning described as calmer. Non-obvious: a good morning is not all-day stable energy. Same-day relationship is unknown, with Q1 “Uglavnom”/“bih mogao” and Q8 “Često” retained. Prohibited: “Neprijavljeno teško jutro”; “Uzrok pada energije tokom dana”; “Dobro jutro isključuje zdravstvenu teškoću”. Adds Q1.
- `easy_onset_difficult_return`, Q2/Q3, same two claims: rapid initial onset differs from difficult continuation. Why: do not accelerate the already-fast start; compare continuation. Non-obvious: easily falling asleep is not easily resuming sleep. Exact source qualifiers/shared noncausal uncertainty apply. Prohibited: “Nesanica”; “Tačno trajanje budnosti”; “Uzrok buđenja”. Adds Q2; neither secondary changes priority or explains the primary causally.

### SO WHAT

Actual `so_what` reuses the primary why, references Q5/Q3/Q8 and `co_occurrence_same_days`, with `does_not_change_priority=true`.

### Rivals: all support / limits / missing / observations / prohibition

Both exact shared rival records apply. Support **Q3/Q8**; limits **Q1/Q5**; groups **[Q3] versus [Q8]**. Duration context and the mostly-good morning constrain merging everything into one fatigue story. Missing information, both exact discriminating prefixes and noncausal prohibition are in the shared rival section; each prefix is followed by the complete question immediately below.

### Best next question / full alternative answers / before versus after

**Phase 1 before:** “Da li teško nastavljanje sna dolazi posle noći u kojima je početno uspavljivanje bilo lako?”

**Phase 1.5 after / open question:** “Da li su jutarnji osećaj i energija tokom dana drugačiji posle noći sa više ili manje prekida, uz slično prijavljeno trajanje sna?” Why: the primary night/day comparison, not another onset question. References Q5/Q3/Q8, unknown `co_occurrence_same_days`.

Actual distinct outcomes:

1. “Teža jutra ili dani baš posle više prekida podržali bi zajedničko javljanje, ne uzrok.”
2. “Slična energija posle različitih noći ostavila bi dnevno iskustvo kao odvojen ugao.”
3. “Različit jutarnji i dnevni utisak pokazao bi da ih ne treba objediniti u jedan opis umora.”

Question order/scores: `continuity_daytime_relation` 83; `awakening_daytime_relation` 57; `easy_onset_difficult_return` 57; `rested_morning_daytime_difficulty` 57. Lower-value candidate questions remain auditable, not promoted into primary story slots.

### Do not target first: all reasons / qualifications

O, E and T all apply, key `continuity`. O qualification: “Unutar toka noći ovo se odnosi samo na početak, ne na težak povratak u san.” E/T retain the complete shared reasons and qualifications. No extra wind-down rule or earlier alarm is justified by these selections.

### Main story: actual returned text

> Prijavljenih 7–9 sati, težak povratak u san i teškoća tokom dana ili jutra opisuju različite delove iskustva. Sam raspon sati ne opisuje nastavak sna ni energiju. Prvo poređenje vredi usmeriti na jutra i dane posle noći sa više ili manje prekida, umesto automatski na duže spavanje ili brže početno uspavljivanje. Kao dopuna, Vredi razdvojiti početak dana od energije kasnije, umesto automatski ciljati jutro koje opisuješ kao mirnije. Lako početno uspavljivanje nije deo koji treba dodatno ubrzavati; poređenje se odnosi na nastavak sna. Ostaje otvoreno da li ovi opisi pripadaju istim noćima i danima; nijedan odnos ovde nije utvrđeni uzrok.

### Twist / base contrasts / open question

Phase 1.5 twist is the primary non-obvious statement: “Trajanje može zvučati mirnije dok se povratak u san i dan izdvajaju; ne znamo da li se izdvajaju istih dana.” Base contrasts remain `easy_onset_difficult_return` (Q2/Q3: separate onset/return, not insomnia/minutes/cause) and `awakening_and_tiredness` (Q3/Q8: separate night/day, not awakening-caused fatigue, apnea or clinical sleepiness). Base twist was onset/return; the wrapper adds a ranked story without replacing it. Open question is exactly the selected after-question above.

### Science: each selected ID / source / DOI / caveats

`SLEEP_MULTIDIMENSIONAL` → `AASM_SRS_DURATION_2015`, **10.5664/jcsm.4758**; `DIARY_CORE_OBSERVATION` → `CARNEY_DIARY_2012`, **10.5665/sleep.1642**. Both full caveat sets/common pending restrictions apply. No causal night/day effect or tracking efficacy follows.

Excluded science: `CBTI_STRONG` and `STIMULUS_CONTROL_CONDITIONAL` CA; `RELAXATION_CONDITIONAL` NR+CA; `HYGIENE_NOT_STANDALONE` H; `ADULT_SLEEP_7H`, `LONG_SLEEP_CONTEXT`, `TWO_PROCESS_MODEL` NR; `TODO_WRITING_LAB`, `TODO_SPECIFICITY_ASSOCIATION`, `QUIET_PREBED_GUIDANCE`, `REGULAR_TIMES_GUIDANCE` RP+NR; `DIARY_VALIDATION_BOUNDARY` `redundant_with:DIARY_CORE_OBSERVATION`.

### Techniques: eligible and every excluded reason

Eligible S only. Excluded: `COGNITIVE_OFFLOAD` L/F/A(`TODO_WRITING_LAB`); `WIND_DOWN` L/F/A(`QUIET_PREBED_GUIDANCE`); `WAKE_REGULARITY` L/F/A(`REGULAR_TIMES_GUIDANCE`); `RELAXATION` L/M/F/ED; `STIMULUS_CONTROL_EDUCATION` L/M/F/ED. Shared M lists and clinical prohibitions apply in full.

### Devices: all concepts / references / limits

Only `one_variable_comparison`, concept `multiple_aspects`, Q1/Q3/Q8: hypothetical two-night comparison distinguishes hours, interruptions and morning impression. Exact limits: “Ovo nije sproveden eksperiment niti opis dve tvoje noći.”; “Ne izoluje uzrok i ne dokazuje da promena jedne stvari menja drugu.”

### Experiment: seven actual allocations / actions / observations

| Day | Theme allocation | Action code | Observation |
| --- | --- | --- | --- |
| 1 | D/N/T | F | J |
| 2 | N | S | S |
| 3 | D | F | D |
| 4 | N/D | C | J |
| 5 | T | F | T |
| 6 | N/D/T | S | S |
| 7 | D/N/T | R | J |

### Prohibited conclusions / all unknowns

Entire shared boundary set, both selected science caveat sets and all four applicable candidates' case-specific prohibitions apply. The lower-value `awakening_daytime_relation` also forbids “Buđenja uzrokuju umor”; “Umor je klinička pospanost”; “Apneja”. All eleven shared unknowns remain unresolved; mostly-good mornings and 7–9 hours do not constitute clinical reassurance.

## 2. `budan`

### Profile / all 12 exact selected answers

Raw points: `[5,1,5,5,5,4,1,5,5,5,5,5]`; actual **BUDAN UM**. Shared question scopes/frequencies apply.

| Fact | Exact selected string | Answer frequency | Uncertainty |
| --- | --- | --- | --- |
| Q1 | Odmorno — spreman sam za dan | — | — |
| Q2 | Imam osećaj da se borim sa snom | — | Imam osećaj |
| Q3 | Uglavnom spavam bez buđenja | Uglavnom | — |
| Q4 | Ustanem bez problema | — | — |
| Q5 | 7–9 sati | — | — |
| Q6 | Imam svoju mirnu večernju rutinu | — | — |
| Q7 | Telo je umorno, ali mozak kao da ne želi da stane | — | kao da |
| Q8 | Uglavnom je stabilna | Uglavnom | — |
| Q9 | Budim se približno u isto vreme | — | približno |
| Q10 | Skoro uvek su slični | Skoro uvek | — |
| Q11 | Malo toga — uglavnom funkcionišem normalno | uglavnom | — |
| Q12 | Zadovoljan sam svojim snom | — | — |

### Themes / priority

Only `BEDTIME_TRANSITION`, focus Q2/Q7. Fixed **Period pre sna**, key `sleepOnset`; justification Q2/Q6/Q7. The calm routine and reported mostly-uninterrupted continuation remain supported positives; a difficult onset does not invent a continuity problem.

### Candidates with actual scores / concise criteria

| Rank | ID | Score | Facts | True criteria |
| --- | --- | --- | --- | --- |
| 1 | `calm_routine_active_thoughts` | 80 | Q6/Q7/Q2 | G/C/F/S/P/U/E/O |
| 2 | `onset_thoughts_calm_night` | 80 | Q2/Q7/Q3 | G/C/F/S/P/U/E/O |

Both evidence lists: `SLEEP_MULTIDIMENSIONAL`, `DIARY_CORE_OBSERVATION`, `TODO_WRITING_LAB`. Equal score and three dependencies resolve by insight ID, not evidence prestige. No penalty.

### Rejected / lower-value and inapplicable IDs

No applicable candidate is rejected; rank 2 adds Q3. `not_applicable`: `duration_recovery`, `short_sleep_daytime` (no short/hard-morning pair); `continuity_daytime_relation` (no return/day or morning difficulty); `easy_onset_difficult_return` (neither very-fast onset nor difficult return); `variable_timing_duration`, `variable_timing_short_duration` (no variable timing); `recovery_despite_calm_night`, `morning_daytime_relation`, `rested_morning_daytime_difficulty` (no daytime difficulty); `fragmented_night_preserved_daytime`, `awakening_daytime_relation` (no difficult/awakening Q3); `long_duration_unrestored` (no long/hard-morning pair); `preserve_calm_features` (Q2/Q7 not calmer). Unmet rules have false predicates and empty evidence IDs.

### Primary: facts / why / non-obvious / evidence / uncertainty / prohibited

`calm_routine_active_thoughts`, Q6/Q7/Q2: a calm last part of the evening is not the experience of active thoughts when lying down. **Why / SO WHAT:** distinguish routine from in-bed experience within the unchanged pre-sleep priority; do not automatically add screen rules. **Non-obvious:** calm evening ending is not easy mental disengagement in bed. Three exact evidence IDs above; shared noncausal status, Q2 “Imam osećaj” and Q7 “kao da” retained. Prohibited: “Ekrani su uzrok”; “Rutina ne uspeva”; “Misli dokazuju psihološki poremećaj”.

### Secondary insights: same value fields

`onset_thoughts_calm_night`, Q2/Q7/Q3, same three claims: difficult onset/active thoughts stand beside mostly-uninterrupted continuation. Why: stay with transition rather than invent a resumption problem. Non-obvious: difficult beginning need not describe the rest of the night. Shared noncausal uncertainty and Q2/Q7 uncertainty/Q3 “Uglavnom” remain. Prohibited: “Misli uzrokuju teško uspavljivanje”; “Noć je objektivno neprekinuta”; “Potreban je rad na buđenjima”. It adds Q3, not a causal explanation or new priority.

### SO WHAT

Primary why is the actual `so_what`, Q6/Q7/Q2, unknown `co_occurrence_same_days`, unchanged priority true.

### Rivals: all support / limits / missing / observations / prohibition

Both exact shared records. Support **Q6/Q7/Q2**, limits **empty**, groups **[Q6] versus [Q7,Q2]**. Compare whether calmer routines and active thoughts/onset descriptions concern connected or different evenings. Each shared discriminating prefix is followed by the complete selected question below; common missing description and noncausal prohibition apply unchanged.

### Best next question / full alternative answers

“Da li su misli aktivne i onih večeri kada ti mirna rutina prija, i da li je tada uspavljivanje drugačije?” Why: distinguish routine and lying-down experience, not add screen restrictions. References Q6/Q7/Q2; same-day unknown.

1. “Aktivne misli i posle prijatne rutine razdvojile bi ta dva iskustva.”
2. “Različit doživljaj misli posle različitih večeri podržao bi poređenje, ne uticaj rutine.”
3. “Lako uspavljivanje uprkos mislima pokazalo bi da aktivne misli nisu automatski teško uspavljivanje.”

Question rankings: primary 83, `onset_thoughts_calm_night` 58. Phase 1 question was “Da li su misli aktivne i onih večeri kada ti mirna rutina prija?”; the added onset comparison is the actual Phase 1.5 change.

### Do not target first: all reasons / qualifications

Only T applies, Q10/Q9, key `sleepOnset`; complete shared reason/qualification. No O because onset is difficult; no E because Q7 is active, despite calm Q6. Those absent records must not be invented.

### Main story: actual returned text

> Miran poslednji deo večeri i aktivne misli pri ležanju nisu isti opis. Prijavljena rutina ostaje mirnija, ali ne poništava odgovor o mislima ili uspavljivanju. Unutar perioda pre sna vredi razdvojiti rutinu od iskustva kada legneš, a ne automatski dodavati pravila o ekranima. Kao dopuna, Pažnju vredi zadržati na prelazu u san, bez izmišljanja problema sa nastavkom spavanja. Ostaje otvoreno da li ovi opisi pripadaju istim noćima i danima; nijedan odnos ovde nije utvrđeni uzrok.

### Twist / base contrasts / open question

Twist: “Miran završetak večeri nije isto što i lako isključivanje misli u krevetu.” Base contrast/twist `calm_routine_active_thoughts`, Q6/Q7/Q2, observes these separate experiences, not screens-as-cause, psychological disorder or failed routine. Open question is exactly the selected question above.

### Science: each selected ID / source / DOI / caveats

`SLEEP_MULTIDIMENSIONAL` → `AASM_SRS_DURATION_2015`, **10.5664/jcsm.4758**; `TWO_PROCESS_MODEL` → `BORBELY_TWO_PROCESS_2016`, **10.1111/jsr.12371**; `DIARY_CORE_OBSERVATION` → `CARNEY_DIARY_2012`, **10.5665/sleep.1642**; `TODO_WRITING_LAB` → `SCULLIN_WRITING_2018`, **10.1037/xge0000374**. All four complete caveat sets apply. Model selection is conceptual context, not a claim that Q7 measures a biological mechanism.

Excluded science: all three clinical claims CA; `HYGIENE_NOT_STANDALONE` H; `ADULT_SLEEP_7H`, `LONG_SLEEP_CONTEXT` NR; `QUIET_PREBED_GUIDANCE`, `REGULAR_TIMES_GUIDANCE` RP+NR; `DIARY_VALIDATION_BOUNDARY` redundant with diary core; `TODO_SPECIFICITY_ASSOCIATION` `redundant_with:TODO_WRITING_LAB`.

### Techniques: eligible and every excluded reason

Eligible S and W. W remains an indirect optional home adaptation, without benefit-versus-no-writing or long-term claims. Excluded: `WIND_DOWN` L/F/A(`QUIET_PREBED_GUIDANCE`); `WAKE_REGULARITY` L/F/A(`REGULAR_TIMES_GUIDANCE`); `RELAXATION` L/M/ED; `STIMULUS_CONTROL_EDUCATION` L/M/ED. Their symptom flags do not lift missing assessment or education-only restrictions.

### Devices: all concepts / references / limits

Only `unfinished_tasks`, concept `active_thoughts`, Q2/Q7: an imagined unfinished-task list explains optional writing, not what this person's thoughts actually do. Exact limits: “Nije dokaz da su tvoje misli stvarno nedovršeni zadaci.”; “Ne utvrđuje mehanizam niti obećava brže uspavljivanje; mala studija nema poređenje sa nepisanjem.”

### Experiment: seven actual allocations / actions / observations

| Day | Theme allocation | Action code | Observation |
| --- | --- | --- | --- |
| 1 | B | F | B |
| 2 | B | S | S |
| 3 | B | W | W |
| 4 | B | C | B |
| 5 | B | F | B |
| 6 | B | S | S |
| 7 | B | R | B |

### Prohibited conclusions / all unknowns

Entire shared boundary set, all four science caveat sets and both candidates' prohibitions apply. Calm routine is not proof of treatment failure; active thoughts are not diagnosis or proof of unfinished tasks. All eleven shared unknowns remain, including age relative to the writing study's 18–30 population and actual symptom duration.

## 3. `umoran`

### Profile / all 12 exact selected answers

Raw points: `[1,5,5,1,5,5,5,1,5,5,1,5]`; actual **UMORAN SAN**.

| Fact | Exact selected string | Answer frequency | Uncertainty |
| --- | --- | --- | --- |
| Q1 | Kao da nisam ni spavao | — | Kao da |
| Q2 | Zaspim vrlo brzo | — | — |
| Q3 | Uglavnom spavam bez buđenja | Uglavnom | — |
| Q4 | Jedva se nateram da ustanem | — | — |
| Q5 | 7–9 sati | — | — |
| Q6 | Uglavnom se smirim bez ekrana | Uglavnom | — |
| Q7 | Lako se isključim | — | — |
| Q8 | Veći deo dana osećam da mi nedostaje energije | Veći deo dana | osećam |
| Q9 | Budim se približno u isto vreme | — | približno |
| Q10 | Skoro uvek su slični | Skoro uvek | — |
| Q11 | Imam osećaj da samo pokušavam da preguram dan | — | Imam osećaj |
| Q12 | Zadovoljan sam svojim snom | — | — |

### Themes / priority

`RECOVERY_DURATION`, focus Q1/Q8/Q11; `RHYTHM_WAKE`, focus Q4. Fixed **Osećaj po buđenju**, key `recovery`, theme `RECOVERY_DURATION`; justification Q1/Q5/Q8/Q11/Q12. Satisfaction in Q12 is preserved beside, not used to erase, morning/day difficulty.

### Candidates with actual scores / concise criteria

| Rank | ID | Score | Facts | True criteria / penalty |
| --- | --- | --- | --- | --- |
| 1 | `recovery_despite_calm_night` | 80 | Q1/Q8/Q3/Q2 | G/C/F/S/P/U/E/O |
| 2 | `morning_daytime_relation` | 40 | Q1/Q8 | G/S/U/E/O; D−10, covered by rank 1 |

Both use exactly `SLEEP_MULTIDIMENSIONAL`, `DIARY_CORE_OBSERVATION`.

### Rejected / lower-value and inapplicable IDs

`morning_daytime_relation`: `covered_by_more_specific_relationship`; its pair/groups are covered by the four-fact primary. `not_applicable`: `duration_recovery`, `short_sleep_daytime`, `variable_timing_short_duration` (no short duration); `continuity_daytime_relation`, `easy_onset_difficult_return`, `fragmented_night_preserved_daytime`, `awakening_daytime_relation` (Q3 calmer, not difficult/awakening); `calm_routine_active_thoughts`, `onset_thoughts_calm_night` (no active thoughts); `variable_timing_duration` (no variable timing); `long_duration_unrestored` (no >9 hours); `rested_morning_daytime_difficulty` (Q1 not positive); `preserve_calm_features` (Q1/Q4/Q8/Q11 not all calmer). False predicates, empty evidence IDs.

### Primary: facts / why / non-obvious / evidence / uncertainty / prohibited

`recovery_despite_calm_night`: hard morning and low daytime energy stand beside easy onset and mostly-uninterrupted continuation. **Why / SO WHAT:** separate morning impression from later energy; do not add unreported interruptions/onset difficulty. **Non-obvious:** a calmer night description does not cancel the selected recovery difficulty. Facts Q1/Q8/Q3/Q2, two claims above. Noncausal status; “Kao da”, “osećam”, “Veći deo dana”, “Uglavnom” remain exactly scoped. Prohibited: “Neprijavljena buđenja”; “Mirna noć isključuje zdravstvenu teškoću”; “Uzrok neoporavljajućeg sna”.

### Secondary insights: same value fields

None. The smaller candidate adds no distinct dependency and carries the duplicate penalty; no second insight is forced. Its auditable value is separating morning/day estimates, not assuming they always co-occur; it also forbids “Jutarnji umor uzrokuje dnevni umor” and “Jedan uzrok za oba odgovora”.

### SO WHAT

Actual primary why, references Q1/Q8/Q3/Q2 and same-day unknown, unchanged priority true. Q5 is added to the question, not silently to the primary fact list.

### Rivals: all support / limits / missing / observations / prohibition

Both exact shared records. Support **Q1/Q8**; limits **Q2/Q3**; groups **[Q1] versus [Q8]**. Calm onset/continuation limit an invented night-interruption explanation. Exact shared missing record, two discriminating prefixes plus the complete next question, and noncausal prohibition apply.

### Best next question / full alternative answers

“Da li se teško jutro i manjak energije kasnije tokom dana javljaju istih dana, i da li se razlikuju posle noći s drugačijim trajanjem?” Why: separate morning/day recovery experience without adding unreported night difficulty. Question facts **Q1/Q8/Q3/Q2/Q5**, same-day unknown.

1. “Zajedničko javljanje povezalo bi jutarnji i dnevni opis samo kao posmatranje.”
2. “Teško jutro uz kasnije stabilniju energiju razdvojilo bi dva iskustva.”
3. “Razlike posle različitog trajanja dale bi dodatno poređenje, ne objašnjenje umora.”

Question rankings: primary 83; `morning_daytime_relation` 57. Base question was generic same-day versus independent aspects; the new question explicitly separates morning/day and duration comparison.

### Do not target first: all reasons / qualifications

O/E/T apply, key `recovery`. O qualification: “Ovo čuva samo prijavljeni početak sna, ne procenjuje celu noć niti menja postojeći prioritet.” E/T exact shared reasons/qualifications. None says the recovery difficulty is medically harmless.

### Main story: actual returned text

> Teško jutro i umor ili pospanost tokom dana stoje uz lako uspavljivanje i uglavnom noć bez buđenja. Mirniji početak i tok nisu isto što i osećaj oporavka. Prvo razdvoji jutarnji osećaj od energije kasnije tokom dana, bez dodavanja neprijavljenih prekida ili težeg uspavljivanja. Ostaje otvoreno da li ovi opisi pripadaju istim noćima i danima; nijedan odnos ovde nije utvrđeni uzrok.

### Twist / base contrasts / open question

Twist: “Mirniji opis noći ne poništava stvarni odgovor o jutru i danu.” Base contrasts are **empty**, base twist null; Phase 1.5 adds this supported cross-answer contrast rather than implying a base contrast existed. Open question equals the complete next question above.

### Science: each selected ID / source / DOI / caveats

`SLEEP_MULTIDIMENSIONAL` → `AASM_SRS_DURATION_2015`, **10.5664/jcsm.4758**; `DIARY_CORE_OBSERVATION` → `CARNEY_DIARY_2012`, **10.5665/sleep.1642**. Both complete caveat sets apply; neither establishes cause of unrefreshing experience.

Excluded science: all three clinical claims NR+CA; `HYGIENE_NOT_STANDALONE` NR+H; `ADULT_SLEEP_7H`, `LONG_SLEEP_CONTEXT`, `TWO_PROCESS_MODEL` NR; both writing claims, quiet guidance and regular-times guidance RP+NR; `DIARY_VALIDATION_BOUNDARY` redundant with diary core.

### Techniques: eligible and every excluded reason

Eligible S only. Excluded exactly as `current`: offload L/F/A(`TODO_WRITING_LAB`); wind-down L/F/A(`QUIET_PREBED_GUIDANCE`); wake regularity L/F/A(`REGULAR_TIMES_GUIDANCE`); relaxation L/M/F/ED; stimulus control L/M/F/ED. The complete shared clinical M lists remain unresolved.

### Devices: all concepts / references / limits

**None selected.** No analogy or mechanistic explanation is forced.

### Experiment: seven actual allocations / actions / observations

| Day | Theme allocation | Action code | Observation |
| --- | --- | --- | --- |
| 1 | D/T | F | J |
| 2 | D | S | S |
| 3 | T | F | T |
| 4 | D/T | C | J |
| 5 | T | F | T |
| 6 | D/T | S | S |
| 7 | D/T | R | J |

The actual S observation still mentions awakenings, despite calmer Q3; this is a generic technique observation, **not** a new finding of awakenings or a rewritten story-specific plan.

### Prohibited conclusions / all unknowns

Entire shared set, both science caveat sets, primary and smaller-candidate prohibitions apply. Do not infer unreported awakenings, cause of low energy, a single morning/day cause or health from easy onset/calm continuation. All eleven unknowns remain; Q11 is conditional after a poor night, not a measured frequency of poor nights.

## 4. `pressure`

### Profile / all 12 exact selected answers

Raw points: `[2,2,2,2,3,2,2,2,2,2,2,2]`; actual **SAN POD PRITISKOM**.

| Fact | Exact selected string | Answer frequency | Uncertainty |
| --- | --- | --- | --- |
| Q1 | Umorno — teško mi je da ustanem | — | — |
| Q2 | Misli mi ne daju da se isključim | — | — |
| Q3 | Kada se probudim, teško ponovo zaspim | — | — |
| Q4 | Odlažem ga više puta | — | — |
| Q5 | 5–6 sati | — | — |
| Q6 | Telefon mi je često u ruci | često | — |
| Q7 | Planiram, analiziram i razmišljam o problemima | — | — |
| Q8 | Imam periode kada jedva držim oči otvorene | Imam periode | — |
| Q9 | Mogao bih da ostanem u krevetu pola dana | — | Mogao bih |
| Q10 | Često nemam nikakav raspored | Često | — |
| Q11 | Umorniji sam i raspoloženje mi se promeni | — | — |
| Q12 | Često imam osećaj da mi san nije dovoljan | Često | imam osećaj |

### Themes / priority

All four: `BEDTIME_TRANSITION` focus Q2/Q6/Q7; `RECOVERY_DURATION` Q1/Q5/Q8/Q11/Q12; `NIGHT_CONTINUITY` Q3; `RHYTHM_WAKE` Q4/Q9/Q10. Fixed **Više delova tvoje noći**, key `multiple`, allocation priority theme `BEDTIME_TRANSITION`. Justification Q1/Q2/Q3/Q5/Q7/Q8/Q12. A duration-led story is not permission to replace that multiple-area priority.

### Candidates with actual scores / concise criteria

| Rank | ID | Score | Facts | True criteria |
| --- | --- | --- | --- | --- |
| 1 | `duration_recovery` | 75 | Q5/Q1/Q9 | G/C/F/S/U/E/O |
| 2 | `variable_timing_short_duration` | 60 | Q10/Q9/Q5 | G/F/S/U/E/O |
| 3 | `short_sleep_daytime` | 60 | Q5/Q1 | G/F/S/U/E/O |
| 4 | `awakening_daytime_relation` | 50 | Q3/Q8 | G/S/U/E/O |
| 5 | `morning_daytime_relation` | 50 | Q1/Q8 | G/S/U/E/O |

No applied penalty. All use `SLEEP_MULTIDIMENSIONAL`, `DIARY_CORE_OBSERVATION`; rank 2 additionally uses `REGULAR_TIMES_GUIDANCE`. Rank 2 beats rank 3 on three versus two facts; rank 4 beats rank 5 by ID.

### Rejected / lower-value and inapplicable IDs

`short_sleep_daytime` and `morning_daytime_relation`: `adds_no_distinct_dependency` after primary plus the two selected secondaries cover their facts. This is **not** a duplicate penalty. `not_applicable`: `continuity_daytime_relation`, `variable_timing_duration` (Q5 not 7–9); `calm_routine_active_thoughts` (Q6 not positive); `easy_onset_difficult_return` (Q2 not very-fast); `onset_thoughts_calm_night` (Q3 not positive); `recovery_despite_calm_night` (Q2/Q3 not positive); `fragmented_night_preserved_daytime` (Q1/Q8 not positive); `long_duration_unrestored` (Q5 not >9); `rested_morning_daytime_difficulty` (Q1 not positive); `preserve_calm_features` (calmer prerequisites fail). False predicates, no evidence IDs for unmet rules.

### Primary: facts / why / non-obvious / evidence / uncertainty / prohibited

`duration_recovery`, Q5/Q1/Q9: reported shorter duration and hard morning stand beside a **conditional wish** to remain in bed without an alarm. **Why / SO WHAT:** compare mornings after different nights rather than call that wish recovery of sleep debt. **Non-obvious:** free-day answer measures neither added sleep nor debt. Two claims above, noncausal uncertainty, Q9 “Mogao bih” retained. Prohibited: “Dug sna”; “Stvarno duže spavanje iz hipotetičnog odgovora”; “Trajanje uzrokuje jutarnji umor”.

### Secondary insights: same value fields

- `variable_timing_short_duration`, Q10/Q9/Q5, multidimensional/diary/regular-times claims: timing and duration are separate angles, unknown whether they change together. Why: separate them before explaining hours through schedule. Non-obvious: short duration is not measured short sleep opportunity, and variable timing has no established cause. Preserve Q10 “Često” and Q9 “Mogao bih”; shared noncausal uncertainty. Prohibited: “Raspored uzrokuje kratko trajanje”; “Kratka prilika za spavanje”; “Potrebna precizna satnica”. Adds Q10.
- `awakening_daytime_relation`, Q3/Q8, multidimensional/diary claims: night awakenings and daytime difficulty are separate selected reports, not known same days. Why: compare days after more/fewer interruptions before explaining fatigue. Non-obvious: co-reporting is not co-occurrence. Q8 “Imam periode” remains, noncausal unknown applies. Prohibited: “Buđenja uzrokuju umor”; “Umor je klinička pospanost”; “Apneja”. Adds Q3/Q8; no medical rival causes are manufactured.

### SO WHAT

Primary why, Q5/Q1/Q9, same-day unknown, unchanged priority true. The 75 score lacks a positive-preservation bonus; it is not severity.

### Rivals: all support / limits / missing / observations / prohibition

Both exact shared records. Support **Q5/Q9/Q1**; limits **empty**; groups **[Q5,Q9] versus [Q1]**. The complete missing description and discriminating prefixes followed by the question below apply. In particular neither rival upgrades Q9's hypothetical wish into actual extra sleep, nor co-occurrence into causation.

### Best next question / full alternative answers

“Da li se jutarnji osećaj razlikuje posle kraćih i dužih noći, i šta zaista primećuješ slobodnim danom bez alarma?” Why: compare mornings rather than assume sleep-debt repayment. References Q5/Q1/Q9, same-day unknown.

1. “Razlika u jutrima uz različito trajanje dala bi odnos vredan daljeg posmatranja, ne uzrok.”
2. “Slična jutra uz različito trajanje oslabila bi priču zasnovanu samo na trajanju.”
3. “Želja za ostajanjem u krevetu bez stvarno dužeg sna razdvojila bi želju od iskustva.”

Question rankings: primary 83; variable timing/short duration 58; awakening/daytime 57; morning/daytime 57; short sleep/daytime 57. Base question: “Da li je jutarnji osećaj drugačiji bez alarma i da li se kraće noći i teško jutro javljaju istih dana?” The after-question explicitly asks what actually happens on the free day.

### Do not target first: all reasons / qualifications

**Empty list.** No fast-onset, calmer-wind-down or similar-schedule avoidance predicate holds. Empty does not authorize a clinical intervention, alarm change or rigid sleep rule.

### Main story: actual returned text

> Kraće prijavljeno trajanje i teško jutro stoje uz poređenje sa slobodnim danom bez alarma. Taj odgovor može opisivati duže spavanje ili samo želju za ostajanjem u krevetu. Korisnije je uporediti jutra posle različitih noći nego unapred proglasiti duži ostanak bez alarma nadoknadom sna. Kao dopuna, Najpre razdvoji raspored od trajanja, bez zaključka da promena rasporeda već objašnjava broj sati. Poređenje dana posle više i manje prekida vrednije je od zaključka da su buđenja već objašnjenje umora. Ostaje otvoreno da li ovi opisi pripadaju istim noćima i danima; nijedan odnos ovde nije utvrđeni uzrok.

### Twist / base contrasts / open question

Twist: “Odgovor o slobodnom danu nije merenje dodatnog sna ni dokaz duga sna.” Base contrasts `duration_morning_free_day`, Q5/Q1/Q9 (not debt, short opportunity, actual extra sleep from hypothetical answer or morning-fatigue cause) and `awakening_and_tiredness`, Q3/Q1/Q8 (not causation, apnea or clinical sleepiness from fatigue). Base twist null; the wrapper's duration contrast is a supported new editorial selection. Open question equals the selected question above.

### Science: each selected ID / source / DOI / caveats

`SLEEP_MULTIDIMENSIONAL` → `AASM_SRS_DURATION_2015`, **10.5664/jcsm.4758**; `QUIET_PREBED_GUIDANCE` → `NHLBI_HABITS_2022`, DOI **null**; `DIARY_CORE_OBSERVATION` → `CARNEY_DIARY_2012`, **10.5665/sleep.1642**; `REGULAR_TIMES_GUIDANCE` → `NHLBI_HABITS_2022`, DOI **null**. All full caveat sets apply. Guidance does not establish screen causation or an optimal wake hour.

Excluded science: all three clinical claims CA; hygiene H; diary validation redundant with diary core; `LONG_SLEEP_CONTEXT` and `ADULT_SLEEP_7H` `redundant_with:SLEEP_MULTIDIMENSIONAL`; `TODO_WRITING_LAB`, `TODO_SPECIFICITY_ASSOCIATION`, `TWO_PROCESS_MODEL` **`selection_limit`**, not failed applicability. This matters: active thoughts are selected, but the bounded retrieval did not return writing evidence.

### Techniques: eligible and every excluded reason

Eligible **S and V**. Excluded: `COGNITIVE_OFFLOAD` **L only**, because linked writing evidence was not returned; `WAKE_REGULARITY` **F/X**, because short duration fails its rule and daytime-sleepiness flag activates exclusion; `RELAXATION` L/M/ED; `STIMULUS_CONTROL_EDUCATION` L/M/ED. Do not misreport offload as inactive thoughts, or infer safety from unknown medical data.

### Devices: all concepts / references / limits

- `journey_interruption`, `duration_and_continuity`, Q3/Q5: hypothetical journey length versus interruptions. Exact limits: “Ovo je zamišljeno poređenje, ne događaj iz tvog života.”; “Ne meri trajanje budnosti, ne dokazuje uzrok umora niti dug sna.”
- `timing`, `sleep_timing`, Q9/Q10: imagined same event at different times, distinguishing timing/duration. Exact limits: “Primer je hipotetičan, ne tvoja stvarna istorija.”; “Ne meri biološki ritam i ne propisuje satnicu, raniji alarm ili dozu svetla.”

### Experiment: seven actual allocations / actions / observations

| Day | Theme allocation | Action code | Observation |
| --- | --- | --- | --- |
| 1 | B/D/N/T | F | J |
| 2 | B | S | S |
| 3 | D | F | D |
| 4 | B/D | C | J |
| 5 | N | F | N |
| 6 | B/D/N | S | S |
| 7 | B/D/N/T | R | J |

V is eligible but **not allocated**: S wins the first compatible eligible choice on day 2; later relevant slots do not assign V under the unchanged algorithm. No wind-down or writing action is invented to make this plan look more personalized.

### Prohibited conclusions / all unknowns

Entire shared set, all four science caveat sets and all five candidates' prohibitions apply. Lower-value `short_sleep_daytime` also forbids “Trajanje uzrokuje umor”; “Dnevni umor iz jutarnjeg odgovora”; “Kratka prilika za spavanje”. Lower-value morning/day pair forbids morning-caused daytime fatigue and one cause for both answers. All eleven unknowns remain. Q8's selected periods of difficulty holding eyes open do not diagnose clinical sleepiness or establish driving impairment; the shared conditional driving restriction remains essential.

## 5. `calm`

### Profile / all 12 exact selected answers

Raw points: `[5,5,5,5,5,5,5,5,5,5,5,5]`; actual **MIRNA NOĆ**.

| Fact | Exact selected string | Answer frequency | Uncertainty |
| --- | --- | --- | --- |
| Q1 | Odmorno — spreman sam za dan | — | — |
| Q2 | Zaspim vrlo brzo | — | — |
| Q3 | Uglavnom spavam bez buđenja | Uglavnom | — |
| Q4 | Ustanem bez problema | — | — |
| Q5 | 7–9 sati | — | — |
| Q6 | Uglavnom se smirim bez ekrana | Uglavnom | — |
| Q7 | Lako se isključim | — | — |
| Q8 | Uglavnom je stabilna | Uglavnom | — |
| Q9 | Budim se približno u isto vreme | — | približno |
| Q10 | Skoro uvek su slični | Skoro uvek | — |
| Q11 | Malo toga — uglavnom funkcionišem normalno | uglavnom | — |
| Q12 | Zadovoljan sam svojim snom | — | — |

### Themes / priority

Only `RECOVERY_DURATION`, **empty focus-question list**. Fixed **Tvoj san u celini**, key `whole`, allocation theme `RECOVERY_DURATION`. Justification Q1/Q2/Q3/Q5/Q6/Q7/Q8/Q9/Q10/Q11/Q12; primary additionally includes Q4. All selected calmer features are preserved at their reported precision.

### Candidates with actual scores / concise criteria

Only rank 1 `preserve_calm_features`, **15**, facts in actual order **Q1/Q2/Q3/Q5/Q6/Q7/Q8/Q9/Q10/Q11/Q12/Q4**, true G/P. No contrast, reframe, separate-comparison groups, question, observation or evidence bonus; no penalties, no evidence IDs. Preservation is a positive result of the rule, not generic fallback failure.

### Rejected / lower-value and inapplicable IDs

All fourteen other definitions are `not_applicable`, false predicates, empty evidence IDs: `duration_recovery`, `short_sleep_daytime` (no short/hard-morning pair); `continuity_daytime_relation`, `easy_onset_difficult_return`, `fragmented_night_preserved_daytime`, `awakening_daytime_relation` (no return/difficult-night report); `calm_routine_active_thoughts`, `onset_thoughts_calm_night` (no active thoughts/onset difficulty); `variable_timing_duration`, `variable_timing_short_duration` (no variable timing); `recovery_despite_calm_night`, `morning_daytime_relation`, `rested_morning_daytime_difficulty` (no required morning/day difficulty); `long_duration_unrestored` (no >9/hard-morning pair). No applicable lower-value candidate or secondary is created.

### Primary: facts / why / non-obvious / evidence / uncertainty / prohibited

All twelve facts support calmer start/continuation, rested morning, stable energy, 7–9 reported hours and a calmer routine. **Why / SO WHAT:** preserve pleasant parts without mandatory monitoring or new intervention. **Non-obvious:** no surprise is necessary; calmer reports do not prove absence of health difficulties. Evidence IDs empty. Status `observational_preservation`, unknown references empty, **all exact source qualifiers retained**, and the common noncausal boundary still present. Prohibited: “Potvrđeno zdravlje”; “Odsustvo poremećaja”; “Potrebna intervencija”.

### Secondary insights: same value fields

None; no added relationship, evidence, uncertainty claim or secondary intervention is manufactured.

### SO WHAT

Primary preservation why; all twelve primary facts, empty unknown references, unchanged priority true. This does not mean the overall analysis has no unknowns.

### Rivals: all support / limits / missing / observations / prohibition

**None.** No question or two comparison groups justify rival relationship records; no medical alternatives are introduced. Shared prohibition against diagnosing or clearing disorders remains.

### Best next question / full alternative answers

`best_next_question=null`; `question_candidates=[]`; `open_question=null`. Consequently no alternative-answer outcomes. Phase 1 still has its preserved generic question “Da li se tvoj ukupni utisak i opis pojedinačnih noći menjaju zajedno ili razlikuju?” Phase 1.5 does not promote it into a compulsory question. Null is intentional restraint, not missing documentation.

### Do not target first: all reasons / qualifications

O/E/T apply, key `whole`. O qualification: “Ovo čuva samo prijavljeni početak sna, ne procenjuje celu noć niti menja postojeći prioritet.” E/T full shared reasons/qualifications. No earlier alarm, faster onset or additional wind-down rules are called for by these answers.

### Main story: actual returned text

> Mirniji početak i tok sna, odmornije jutro i stabilnija energija stoje uz prijavljenih 7–9 sati i mirniju rutinu. Odgovori ne izdvajaju teškoću koju treba izmišljati. Postojeće prijatne delove vredi sačuvati bez obaveznog praćenja ili nove intervencije. Bez obavezne intervencije ili forsiranog iznenađenja.

### Twist / base contrasts / open question

Twist null, base contrasts empty, base twist null, story open question null. The actual non-obvious field is “Nije potrebno forsirati iznenađenje: mirniji odgovori nisu dokaz odsustva zdravstvenih teškoća.” It is **not** converted into a manufactured twist.

### Science: each selected ID / source / DOI / caveats

**No selected claims or sources; no DOI attached.** Generic registry knowledge is not inserted just to fill a science quota. Pending-review/release boundaries still govern the system.

Excluded science: all three clinical claims NR+CA; hygiene NR+H; adult-duration, multidimensional, long-duration context, two-process model, diary core and diary validation NR; both writing claims, quiet-prebed guidance and regular-times guidance RP+NR. Thus `DIARY_VALIDATION_BOUNDARY` here is **no personal relevance**, not redundant with a selected diary claim.

### Techniques: eligible and every excluded reason

**None eligible.** `SELF_OBSERVATION` L (diary core absent); offload L/F/A(`TODO_WRITING_LAB`); wind-down L/F/A(`QUIET_PREBED_GUIDANCE`); wake regularity L/F/A(`REGULAR_TIMES_GUIDANCE`); relaxation L/M/F/ED; stimulus control L/M/F/ED. Clinical unknowns are not negative findings; absence of action selection is not an assertion of health.

### Devices: all concepts / references / limits

**None selected.** No analogy, science moment or mechanism is needed to justify preservation.

### Experiment: seven actual allocations / actions / observations

| Day | Theme allocation | Action code | Observation |
| --- | --- | --- | --- |
| 1 | D | F | D |
| 2 | D | F | D |
| 3 | D | F | D |
| 4 | D | C | D |
| 5 | D | F | D |
| 6 | D | F | D |
| 7 | D | R | D |

This preserved Phase 1 scaffold still has seven optional observation slots despite the Phase 1.5 preservation story's no-monitoring requirement. They are **not** an instruction to complete seven days, not selected self-observation treatment, and not evidence that a problem exists.

### Prohibited conclusions / all unknowns

Entire shared fact/general/technique set plus preservation prohibitions apply. No selected-science caveats are added because there are no selected claims. All eleven unknowns remain, especially health history, breathing symptoms, duration and driving safety. “MIRNA NOĆ” is a deterministic synthetic answer profile, never a negative clinical finding.

## 6. `second_isprekidan`

### Profile / all 12 exact selected answers

Raw points: `[5,5,1,5,3,5,5,5,1,1,5,1]`; actual **ISPREKIDAN SAN**, same profile as `current`, different relationship.

| Fact | Exact selected string | Answer frequency | Uncertainty |
| --- | --- | --- | --- |
| Q1 | Odmorno — spreman sam za dan | — | — |
| Q2 | Zaspim vrlo brzo | — | — |
| Q3 | Noć mi često deluje isprekidano | često | deluje |
| Q4 | Ustanem bez problema | — | — |
| Q5 | 5–6 sati | — | — |
| Q6 | Uglavnom se smirim bez ekrana | Uglavnom | — |
| Q7 | Lako se isključim | — | — |
| Q8 | Uglavnom je stabilna | Uglavnom | — |
| Q9 | Vreme spavanja i buđenja mi se stalno menja | stalno | — |
| Q10 | Svaki dan može izgledati potpuno drugačije | Svaki dan | može |
| Q11 | Malo toga — uglavnom funkcionišem normalno | uglavnom | — |
| Q12 | Spavanje mi je postalo nešto sa čim se redovno borim | redovno | — |

### Themes / priority

`RECOVERY_DURATION`, focus Q5/Q12; `NIGHT_CONTINUITY`, Q3; `RHYTHM_WAKE`, Q9/Q10. Fixed **Tok noći**, key `continuity`, theme `NIGHT_CONTINUITY`; justification Q3/Q12. Shorter duration and variable schedule do not erase rested morning/stable day, and Q3 does not establish difficult return specifically.

### Candidates with actual scores / concise criteria

| Rank | ID | Score | Facts | True criteria |
| --- | --- | --- | --- | --- |
| 1 | `fragmented_night_preserved_daytime` | 80 | Q3/Q1/Q8 | G/C/F/S/P/U/E/O |
| 2 | `variable_timing_short_duration` | 60 | Q10/Q9/Q5 | G/F/S/U/E/O |

Primary claims: `SLEEP_MULTIDIMENSIONAL`, `DIARY_CORE_OBSERVATION`. Secondary adds `REGULAR_TIMES_GUIDANCE`, `TWO_PROCESS_MODEL` to those two. No penalties.

### Rejected / lower-value and inapplicable IDs

No applicable rejection; secondary adds three new facts. `not_applicable`: `duration_recovery`, `short_sleep_daytime`, `long_duration_unrestored` (no hard morning, and no long duration); `continuity_daytime_relation` (no 7–9/difficult-return/day difficulty combination); `calm_routine_active_thoughts`, `onset_thoughts_calm_night` (no active thoughts/onset difficulty); `easy_onset_difficult_return` (Q3 not the difficult-return answer); `variable_timing_duration` (duration not 7–9); `recovery_despite_calm_night`, `morning_daytime_relation`, `rested_morning_daytime_difficulty`, `awakening_daytime_relation` (no required morning/day difficulty); `preserve_calm_features` (Q3/Q5/Q9/Q10/Q12 fail calmer prerequisites). False predicates, empty evidence IDs.

### Primary: facts / why / non-obvious / evidence / uncertainty / prohibited

`fragmented_night_preserved_daytime`, Q3/Q1/Q8: more difficult night-course description stands beside rested morning/stable energy. **Why / SO WHAT:** distinguish interruptions from reported recovery while preserving the calmer morning/day. **Non-obvious:** fragmented description is not a difficult day; current selections do not equate them. Primary evidence IDs above. Exact Q3 “često”/“deluje” and Q8 “Uglavnom” plus shared noncausal unknown preserved. Prohibited: “Neprijavljeni dnevni umor”; “Prekidi nemaju nikakav značaj”; “Stabilna energija isključuje zdravstvenu teškoću”.

### Secondary insights: same value fields

`variable_timing_short_duration`, Q10/Q9/Q5: timing and shorter duration are separate reports, unknown whether they vary together. Why: separate schedule/duration before explaining hours through timing. Non-obvious: shorter duration does not measure short opportunity or establish schedule cause. Four exact claim IDs above; retain “Svaki dan”/“može”, “stalno”, broad 5–6 range and noncausal status. Prohibited: “Raspored uzrokuje kratko trajanje”; “Kratka prilika za spavanje”; “Potrebna precizna satnica”. Adds contextual angle, not a replacement priority or prescription.

### SO WHAT

Actual primary why, Q3/Q1/Q8, same-day unknown, unchanged priority true. This differs from `current` because Q8 is positive rather than a daytime difficulty; the profile label alone did not choose the story.

### Rivals: all support / limits / missing / observations / prohibition

Both exact shared records. Support **Q3/Q1/Q8**; limits **empty**; groups **[Q3] versus [Q1,Q8]**. Compare whether calm morning/day persists after the described fragmented nights or whether answers concern different nights. Exact shared missing description, discriminating prefixes plus full question, and noncausal prohibition remain.

### Best next question / full alternative answers

“Da li odmornije jutro i stabilnija energija ostaju prisutni i posle noći koje deluju više isprekidano, ili ovi odgovori opisuju različite noći?” Why: distinguish interruptions from recovery without inventing a hard day. References Q3/Q1/Q8, same-day unknown.

1. “Mirniji dan i posle više prekida ograničio bi zaključak da prekidi već objašnjavaju dnevno iskustvo.”
2. “Različite noći za mirnije dane i prekide pokazale bi da se odgovori ne odnose na ista vremena.”

Question rankings: primary 83; variable timing/short duration 58. Base question was generic same-day versus independent aspects; the actual new question tests the preserved night/day contrast.

### Do not target first: all reasons / qualifications

O and E only, key `continuity`. O qualification: “Ovo čuva samo prijavljeni početak sna, ne procenjuje celu noć niti menja postojeći prioritet.” E uses its complete shared qualification. T is absent because timing is variable; its absence is not permission to impose a stricter schedule or earlier alarm.

### Main story: actual returned text

> Teži opis toka noći stoji uz odmornije jutro i uglavnom stabilnu energiju tokom dana. Prekidi nisu dovoljan osnov da se izmisli jutarnji ili dnevni umor. Vredi razdvojiti iskustvo prekida od prijavljenog oporavka, a sačuvati mirniji opis jutra i dana. Kao dopuna, Najpre razdvoji raspored od trajanja, bez zaključka da promena rasporeda već objašnjava broj sati. Ostaje otvoreno da li ovi opisi pripadaju istim noćima i danima; nijedan odnos ovde nije utvrđeni uzrok.

### Twist / base contrasts / open question

Twist: “Isprekidan opis noći nije isto što i težak dan; trenutni odgovori ih ne izjednačavaju.” Base contrasts empty, base twist null. It does not invent a base awakening/fatigue contrast where daytime difficulty was not selected. Open question equals the next question above.

### Science: each selected ID / source / DOI / caveats

`SLEEP_MULTIDIMENSIONAL` → `AASM_SRS_DURATION_2015`, **10.5664/jcsm.4758**; `DIARY_CORE_OBSERVATION` → `CARNEY_DIARY_2012`, **10.5665/sleep.1642**; `REGULAR_TIMES_GUIDANCE` → `NHLBI_HABITS_2022`, DOI **null**; `TWO_PROCESS_MODEL` → `BORBELY_TWO_PROCESS_2016`, **10.1111/jsr.12371**. All four exact caveat sets apply. No circadian defect, sufficient sleep for this person or optimized schedule follows.

Excluded science: CBT-I CA; stimulus control/relaxation NR+CA; hygiene H; long-duration context NR; both writing claims and quiet-prebed guidance RP+NR; diary validation redundant with diary core; adult seven-hour guidance redundant with multidimensional context.

### Techniques: eligible and every excluded reason

Eligible S only. Offload L/F/A(`TODO_WRITING_LAB`); wind-down L/F/A(`QUIET_PREBED_GUIDANCE`); wake regularity **F only** (short sleep violates required false flag, although linked evidence is returned); relaxation L/M/F/ED; stimulus control L/M/F/ED. Unlike `pressure`, there is **no** wake-technique `exclusion_flag_present` reason because Q8 does not select daytime sleepiness.

### Devices: all concepts / references / limits

`journey_interruption`, `duration_and_continuity`, Q3/Q5; `timing`, `sleep_timing`, Q9/Q10. Same two complete concept explanations and exact limits as `pressure`: hypothetical, not personal history; no measured wake minutes/debt/cause; no measured rhythm, prescribed timetable, earlier alarm or light dose.

### Experiment: seven actual allocations / actions / observations

| Day | Theme allocation | Action code | Observation |
| --- | --- | --- | --- |
| 1 | D/N/T | F | J |
| 2 | N | S | S |
| 3 | D | F | D |
| 4 | N/D | C | J |
| 5 | T | F | T |
| 6 | N/D/T | S | S |
| 7 | D/N/T | R | J |

### Prohibited conclusions / all unknowns

Entire shared set, all four science caveat sets and both candidates' prohibitions apply. Do not invent daytime fatigue, dismiss interruptions as meaningless, diagnose rhythm disturbance, prescribe exact hours or infer health from stable energy. All eleven unknowns remain; “redovno” and “postalo” in Q12 do not establish diagnostic duration.

## Review conclusions and limitations

1. **Actual editorial differentiation exists.** The two `ISPREKIDAN SAN` examples have the same deterministic priority but opposite daytime context and different primary IDs/questions. This demonstrates answer-dependent selection on these synthetic cases, not generalizability or clinical validity.
2. **The current fixture's question changes materially.** Phase 1's onset/return comparison survives unchanged in `editorial_plan`; Phase 1.5 ranks the continuity/daytime comparison at similar duration first. The additional morning/day distinction avoids recasting qualified mostly-good mornings as unreported fatigue.
3. **Restraint is observable.** `calm` has no selected science, technique, device, rivals, next question, secondary or twist. Its 15-point preservation score is not low confidence. Its retained seven-day fallback scaffold remains a reviewable tension with a no-required-monitoring story, not a reason to invent an intervention.
4. **Rank ties and arbitrary weights remain limitations.** `budan` selects one of two equal-score/equal-fact candidates by ID. `pressure` has no positive-preservation bonus. Evidence availability adds utility, but does not validate any individual's relationship. No confidence percentage, hard clinical inference, diagnostic threshold or guaranteed benefit should be inferred from these examples.
5. **Retrieval and scheduling affect available material.** `pressure` loses writing/model evidence to the selection cap; that differs from inapplicability. It has eligible wind-down guidance but no allocated wind-down day. Generic diary observations can mention awakenings in a recovery allocation; these are retained implementation decisions, not invented reported symptoms. The review documents them rather than changing implementation.
6. **Clinical restrictions are preserved.** Strong/conditional clinical registry recommendations do not establish diagnosis or eligibility here. Unknown health data are never clearance. Persistent/worsening/functionally impairing symptoms, unsafe driving sleepiness or breathing-related concerns require the conditional escalation boundaries already recorded, not an autonomous CBT-I, stimulus-control, sleep-restriction or relaxation protocol.
7. **Review remains pending.** Source-verified educational inventory, executable references and all-six Phase 1 equality are implementation facts, not clinical review, instrument equivalence, patient research, treatment efficacy or release readiness. All clinical review, editorial release and product-effectiveness questions remain open. No production connection, commit, push or deployment is part of this artifact.