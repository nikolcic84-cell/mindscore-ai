import { SLEEP_ANSWER_OPTIONS, SLEEP_QUESTIONS } from "../src/psychology/sleepAssessmentContent.js";

// Local, observational copy only. Rows follow canonical ZERO-BASED option order.
// Tuple: [description, kind, exact answer frequency or null, exact uncertainty or null].
// No row estimates frequency, explains a cause, or changes a profile/dimension state.
const ANSWER_FACTS = [
  [
    ["Po buđenju navodiš odmornost i spremnost za dan.", "positive", null, null],
    ["Po buđenju se uglavnom osećaš dobro, uz želju za još malo sna.", "positive", "Uglavnom", "bih mogao"],
    ["Po buđenju ne navodiš ni odmornost ni poseban umor.", "context", null, null],
    ["Po buđenju navodiš umor i teško ustajanje.", "difficulty", null, null],
    ["Po buđenju opisuješ osećaj kao da nisi spavao.", "difficulty", null, "Kao da"],
  ],
  [
    ["Navodiš da zaspiš vrlo brzo po gašenju svetla.", "positive", null, null],
    ["Navodiš da ti za uspavljivanje treba malo vremena.", "context", null, null],
    ["Navodiš da ti često treba dosta vremena da zaspiš.", "difficulty", "Često", null],
    ["Navodiš da ti misli otežavaju da se isključiš pri uspavljivanju.", "difficulty", null, null],
    ["Uspavljivanje opisuješ kao osećaj borbe sa snom.", "difficulty", null, "Imam osećaj"],
  ],
  [
    ["Navodiš da uglavnom spavaš bez buđenja.", "positive", "Uglavnom", null],
    ["Navodiš jedno buđenje uz brz nastavak spavanja.", "context", null, null],
    ["Navodiš nekoliko buđenja tokom noći.", "difficulty", null, null],
    ["Navodiš da teško ponovo zaspiš kada se probudiš.", "difficulty", null, null],
    ["Navodiš da ti noć često deluje isprekidano.", "difficulty", "često", "deluje"],
  ],
  [
    ["Navodiš ustajanje bez problema kada alarm zazvoni.", "positive", null, null],
    ["Navodiš da ti za ustajanje treba nekoliko minuta.", "context", null, null],
    ["Navodiš jedno odlaganje alarma.", "difficulty", null, null],
    ["Navodiš više odlaganja alarma.", "difficulty", null, null],
    ["Navodiš da se jedva nateraš da ustaneš.", "difficulty", null, null],
  ],
  [
    ["Navodiš trajanje sna od 7–9 sati tokom noći.", "context", null, null],
    ["Navodiš trajanje sna od 6–7 sati tokom noći.", "context", null, null],
    ["Navodiš trajanje sna od 5–6 sati tokom noći.", "context", null, null],
    ["Navodiš trajanje sna kraće od 5 sati tokom noći.", "context", null, null],
    ["Navodiš više od 9 sati sna, uz čest izostanak osećaja odmornosti.", "difficulty", "često", null],
  ],
  [
    ["Navodiš da se uglavnom smiriš bez ekrana u poslednjih 30 minuta pre spavanja.", "positive", "Uglavnom", null],
    ["Navodiš mirnu večernju rutinu u poslednjih 30 minuta pre spavanja.", "positive", null, null],
    ["Navodiš gledanje TV-a ili nekog sadržaja u poslednjih 30 minuta pre spavanja.", "context", null, null],
    ["Navodiš da ti je telefon često u ruci u poslednjih 30 minuta pre spavanja.", "context", "često", null],
    ["Navodiš skrolovanje dok ne postaneš potpuno pospan pred spavanje.", "context", null, null],
  ],
  [
    ["Navodiš da se lako isključiš kada legneš.", "positive", null, null],
    ["Navodiš malo razmišljanja, a zatim smirivanje kada legneš.", "positive", null, null],
    ["Navodiš vraćanje na događaje iz dana kada legneš.", "context", null, null],
    ["Navodiš planiranje, analiziranje i razmišljanje o problemima kada legneš.", "context", null, null],
    ["Navodiš umorno telo uz osećaj da misli ne staju kada legneš.", "difficulty", null, "kao da"],
  ],
  [
    ["Navodiš uglavnom stabilnu energiju tokom dana.", "positive", "Uglavnom", null],
    ["Navodiš povremen osećaj umora tokom dana.", "difficulty", "Povremeno", null],
    ["Navodiš da ti tokom dana često treba kafa ili pauza.", "difficulty", "Često", null],
    ["Navodiš periode tokom dana kada jedva držiš oči otvorene.", "difficulty", "Imam periode", null],
    ["Navodiš osećaj manjka energije tokom većeg dela dana.", "difficulty", "Veći deo dana", "osećam"],
  ],
  [
    ["Slobodnim danom bez alarma navodiš buđenje približno u isto vreme.", "positive", null, "približno"],
    ["Slobodnim danom bez alarma navodiš malo duže spavanje.", "comparison_opportunity", null, null],
    ["Slobodnim danom bez alarma navodiš znatno duže spavanje.", "comparison_opportunity", null, null],
    ["Slobodnim danom bez alarma navodiš da bi mogao ostati u krevetu pola dana.", "comparison_opportunity", null, "Mogao bih"],
    ["Slobodnim danom bez alarma navodiš stalne promene vremena spavanja i buđenja.", "context", "stalno", null],
  ],
  [
    ["Navodiš skoro uvek slična vremena odlaska u krevet i ustajanja.", "positive", "Skoro uvek", null],
    ["Navodiš da većinom imaš isti ritam odlaska u krevet i ustajanja.", "positive", "Većinom", null],
    ["Navodiš razlike od nekoliko sati u vremenima odlaska u krevet i ustajanja.", "context", null, null],
    ["Navodiš da često nemaš raspored odlaska u krevet i ustajanja.", "context", "Često", null],
    ["Navodiš da raspored odlaska u krevet i ustajanja svakog dana može biti drugačiji.", "context", "Svaki dan", "može"],
  ],
  [
    ["Posle loše prospavane noći navodiš malo promena i uglavnom normalno funkcionisanje.", "positive", "uglavnom", null],
    ["Posle loše prospavane noći navodiš više umora sledećeg dana.", "difficulty", null, null],
    ["Posle loše prospavane noći navodiš težu koncentraciju sledećeg dana.", "difficulty", null, null],
    ["Posle loše prospavane noći navodiš više umora i promenu raspoloženja sledećeg dana.", "difficulty", null, null],
    ["Posle loše prospavane noći opisuješ osećaj da samo pokušavaš da preguraš sledeći dan.", "difficulty", null, "Imam osećaj"],
  ],
  [
    ["U osvrtu na poslednje noći navodiš zadovoljstvo svojim snom.", "positive", null, null],
    ["U osvrtu na poslednje noći navodiš uglavnom dobar san uz poneku lošu noć.", "positive", "Uglavnom", null],
    ["U osvrtu na poslednje noći navodiš da bi tvoj san mogao biti bolji.", "difficulty", null, "bi mogao"],
    ["U osvrtu na poslednje noći navodiš čest osećaj da ti san nije dovoljan.", "difficulty", "Često", "imam osećaj"],
    ["U osvrtu na poslednje noći spavanje opisuješ kao nešto sa čim se redovno boriš.", "difficulty", "redovno", null],
  ],
];

// Frequency in a question is a separate source qualifier, not a numeric estimate.
const QUESTION_FREQUENCY = ["najčešće", "obično", "najčešće", null, "obično", null, null, null, null, null, null, null];
const QUESTION_QUALIFIERS = [
  ["morning_self_report"], ["after_lights_out"], ["within_night"], ["when_alarm_rings"],
  ["sleep_duration_not_time_in_bed"], ["last_30_minutes_before_sleep"], ["when_lying_down"],
  ["daytime_self_report"], ["conditional_free_day_without_alarm"], ["bedtime_and_wake_time_predictability"],
  ["conditional_day_after_poor_sleep"], ["recent_nights_self_report"],
];

const QUESTION_NOT_SUPPORTED = [
  ["objektivno izmerena odmornost", "uzrok jutarnjeg osećaja"],
  ["tačno vreme potrebno za uspavljivanje", "uzrok otežanog uspavljivanja"],
  ["tačno trajanje buđenja", "uzrok noćnih buđenja"],
  ["tačno vreme ustajanja", "uzrok odlaganja alarma"],
  ["vreme provedeno u krevetu", "kratka prilika za spavanje", "tačna potreba za snom"],
  ["sadržaj, osvetljenost ili uređaj koji nisu navedeni", "uticaj sadržaja na san"],
  ["uzrok aktivnih misli", "misli kao dokaz poremećaja"],
  ["količina, vreme ili stvarni unos kofeina", "umor kao dokaz kliničke pospanosti", "uticaj na vožnju"],
  ["dug sna", "stvarno duže spavanje iz želje da se ostane u krevetu", "precizno trajanje dodatnog sna"],
  ["tačna vremena sna i buđenja", "smenski rad kao uzrok rasporeda"],
  ["učestalost loših noći", "učestalost opisanih posledica", "iste posledice posle svake noći"],
  ["trajanje tegoba", "objektivna procena kvaliteta sna"],
];

const UNKNOWN = [
  ["age", "Uzrast"],
  ["symptom_duration", "Trajanje eventualnih tegoba"],
  ["breathing_symptoms", "Simptomi povezani sa disanjem tokom sna"],
  ["medication", "Upotreba lekova"],
  ["medical_history", "Medicinska istorija"],
  ["driving_impairment", "Uticaj umora ili pospanosti na vožnju"],
  ["exact_sleep_wake_times", "Tačna vremena spavanja i buđenja"],
  ["shift_work", "Rad u smenama"],
  ["bedroom_conditions", "Uslovi u spavaćoj sobi"],
  ["actual_sleep_opportunity", "Stvarna prilika za spavanje"],
  ["co_occurrence_same_days", "Da li se opisane pojave javljaju istih dana"],
];

function ownDataValue(object, key) {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  if (!descriptor || !Object.hasOwn(descriptor, "value")) {
    throw new TypeError(`Premium sleep facts requires an own data field: ${key}.`);
  }
  return descriptor.value;
}

/**
 * Input: the object returned by buildSleepPremiumInput (or its canonical
 * { answers: [{ questionId, question, answer }] } evidence subset).
 * Exactly twelve unique Q1-Q12 selections are required. Ordering may vary;
 * output is always Q1-Q12. Text comparison is exact, with no trimming/fuzzing.
 * mappedValue is allowed for compatibility but NEVER used as evidence.
 * Profile, dimensions and other top-level metadata are neither read nor returned.
 *
 * Output: { facts, flags, unknown }. selected_option_index is zero-based (0-4).
 * frequency.question/answer and uncertainty are verbatim source qualifiers or
 * null, never estimates. qualifiers are scope tags, not inferred frequencies.
 * interpretation_candidates stays empty: this layer supplies no explanations.
 * Flags indicate ONLY the requested answer selections, not diagnoses, causes,
 * clinical clearance or evidence that separate answers co-occur on the same day.
 * Existing consumers expecting unknown IDs as strings need an explicit adapter:
 * { ...result, unknown: result.unknown.map(({ id }) => id) }.
 * This standalone module does not wire into or modify existing consumers.
 * All returned objects/arrays are fresh; input is never mutated or retained.
 * Invalid selections/references throw TypeError; no partial result is returned.
 */
export function buildSleepPremiumFacts(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("Premium sleep facts requires a canonical input object.");
  }
  const answers = ownDataValue(input, "answers");
  if (!Array.isArray(answers) || answers.length !== 12) {
    throw new TypeError("Premium sleep facts requires exactly twelve canonical answers.");
  }
  const selections = new Map();
  // Indexing, rather than Array#map/some, also rejects sparse arrays.
  for (let index = 0; index < answers.length; index += 1) {
    const entry = ownDataValue(answers, String(index));
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new TypeError("Each sleep answer must be a canonical evidence object.");
    }
    if (Reflect.ownKeys(entry).some((key) => !["questionId", "question", "answer", "mappedValue"].includes(key))) {
      throw new TypeError("Unknown sleep answer fields or references are not accepted.");
    }
    const id = ownDataValue(entry, "questionId");
    const questionIndex = SLEEP_QUESTIONS.findIndex((_, canonicalIndex) => id === `Q${canonicalIndex + 1}`);
    if (questionIndex === -1 || selections.has(id)) {
      throw new TypeError("Sleep question IDs must be unique canonical Q1-Q12 references.");
    }
    const question = ownDataValue(entry, "question");
    const answer = ownDataValue(entry, "answer");
    const optionIndex = SLEEP_ANSWER_OPTIONS[questionIndex].findIndex((option) => option.text === answer);
    if (question !== SLEEP_QUESTIONS[questionIndex] || optionIndex === -1) {
      throw new TypeError(`Question or answer does not match canonical ${id} text.`);
    }
    selections.set(id, optionIndex);
  }

  const facts = SLEEP_QUESTIONS.map((question, questionIndex) => {
    const questionId = `Q${questionIndex + 1}`;
    const selectedOptionIndex = selections.get(questionId);
    const [description, kind, frequency, uncertainty] = ANSWER_FACTS[questionIndex][selectedOptionIndex];
    return {
      fact_id: `FACT_${questionId}`,
      questionId,
      question,
      selected_answer: SLEEP_ANSWER_OPTIONS[questionIndex][selectedOptionIndex].text,
      selected_option_index: selectedOptionIndex,
      description,
      kind,
      frequency: { question: QUESTION_FREQUENCY[questionIndex], answer: frequency },
      uncertainty,
      qualifiers: [...QUESTION_QUALIFIERS[questionIndex]],
      interpretation_candidates: [],
      not_supported: [
        "medicinska dijagnoza", "uzrok opisanog iskustva", "precizna učestalost koja nije navedena",
        "istovremeno javljanje sa drugim odgovorima", "promena klasifikacije na osnovu jednog odgovora",
        ...QUESTION_NOT_SUPPORTED[questionIndex],
      ],
    };
  });

  const position = (id) => selections.get(id) + 1;
  return {
    facts,
    flags: {
      short_sleep: [3, 4].includes(position("Q5")),
      morning_difficulty: [4, 5].includes(position("Q1")),
      daytime_sleepiness: position("Q8") === 4,
      daytime_fatigue: [2, 3, 5].includes(position("Q8")),
      active_thoughts: position("Q7") >= 3 || position("Q2") === 4,
      onset_difficulty: position("Q2") >= 3,
      bedtime_content: position("Q6") >= 3,
      night_awakenings: position("Q3") >= 2,
      return_difficulty: position("Q3") === 4,
      variable_timing: position("Q10") >= 3 || position("Q9") === 5,
      alarm_difficulty: position("Q4") >= 3,
      // Q9 option 4 is hypothetical time in bed, NOT observed longer sleep.
      longer_without_alarm: [2, 3, 4].includes(position("Q9")),
      overall_dissatisfaction: position("Q12") >= 3,
    },
    unknown: UNKNOWN.map(([id, label]) => ({ id, label })),
  };
}