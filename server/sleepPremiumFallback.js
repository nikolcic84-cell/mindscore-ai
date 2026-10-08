import {
  getSleepPremiumPriority,
  getSleepPremiumStrengthMode,
  validateSleepPremiumReport,
} from "./sleepPremiumSchema.js";

const answer = (input, id) => input.answers.find((item) => item.questionId === id)?.answer || "tvoj izabrani odgovor";
const QUESTION_TOPICS = Object.freeze({
  Q1: "osećaju po buđenju",
  Q2: "uspavljivanju",
  Q3: "toku noći",
  Q4: "ustajanju",
  Q5: "dužini sna",
  Q6: "vremenu pre spavanja",
  Q7: "mislima pred san",
  Q8: "energiji tokom dana",
  Q9: "snu bez alarma",
  Q10: "predvidivosti ritma",
  Q11: "doživljaju dana posle loše noći",
  Q12: "ukupnom utisku o poslednjim noćima",
});
const getFocusQuestionIds = (priority) => ({
    recovery: ["Q1", "Q8"],
    sleepOnset: ["Q2", "Q6"],
    continuity: ["Q3", "Q12"],
    rhythm: ["Q5", "Q10"],
    multiple: ["Q1", "Q3"],
    whole: ["Q1", "Q12"],
  })[priority.key];
const focusEvidence = (input, priority) => getFocusQuestionIds(priority).map((id) => answer(input, id));
const connectionText = (questionIds) => {
  const [firstId, secondId] = questionIds;
  return `Tvoji odgovori o ${QUESTION_TOPICS[firstId]} i ${QUESTION_TOPICS[secondId]} daju dva pogleda koja vredi sagledati zajedno, bez zaključka da jedno objašnjava drugo.`;
};
const priorityContext = (priority) => ({
  recovery: "osećaj po buđenju",
  sleepOnset: "period pre sna",
  continuity: "tok noći",
  rhythm: "vreme spavanja i buđenja",
  multiple: "više delova tvoje noći",
  whole: "tvoj san u celini",
})[priority.key];

const getProfileExplanation = (input) => {
  const [first, second] = focusEvidence(input, getSleepPremiumPriority(input));
  return `Tvoj profil, ${input.profile}, pruža okvir za sagledavanje tvojih odgovora, a ne opisuje svaku noć isto. Odgovori „${first}“ i „${second}“ daju dva lična pogleda koja vredi čitati zajedno.`;
};

const getConnections = (priority) => {
  const extras = priority.key === "sleepOnset" ? ["Q1", "Q3"]
    : priority.key === "continuity" ? ["Q1", "Q8"]
      : priority.key === "recovery" ? ["Q3", "Q5"]
        : priority.key === "rhythm" ? ["Q1", "Q8"]
          : ["Q2", "Q8"];
  return [
    getFocusQuestionIds(priority),
    extras,
  ].map((questionIds) => ({ questionIds, text: connectionText(questionIds) }));
};

const getStableOrTracking = (input, priority) => {
  const mode = getSleepPremiumStrengthMode(input);
  const stableKey = Object.keys(input.dimensions).find((key) => input.dimensions[key].state === "STABLE");
  const stableArea = {
    recovery: "osećaj po buđenju",
    sleepOnset: "period pre sna",
    continuity: "tok noći",
    rhythm: "ritam i raspored",
  }[stableKey];
  if (mode === "stable") {
    const id = { recovery: "Q1", sleepOnset: "Q2", continuity: "Q3", rhythm: "Q10" }[stableKey];
    return {
      mode,
      title: "ŠTA VREDI DA ZADRŽIŠ",
      items: [`U odgovorima o temi ${stableArea} vidi se deo iskustva koji možeš da nastaviš da primećuješ, na primer: „${answer(input, id)}“.`],
    };
  }
  const [first, second] = focusEvidence(input, priority);
  return {
    mode,
    title: "ŠTA JOŠ VREDI DA PRATIŠ",
    items: [`Za sada može biti korisno da primetiš kako se odgovori „${first}“ i „${second}“ uklapaju u tvoj doživljaj ${priorityContext(priority)} kroz naredne dane.`],
  };
};

const getPlan = (priority) => {
  const focus = priorityContext(priority);
  const steps = [
    ["Zabeleži kako trenutno doživljavaš ovaj deo sna, bez menjanja rutine.", "Koji je bio tvoj prvi utisak o ovoj temi?"],
    ["Izaberi jednu malu, realnu stvar povezanu sa ovim delom sna i isprobaj je.", "Šta si primetio/la u vezi sa odabranim korakom?"],
    ["Ako ti je prethodni korak odgovarao, ponovi ga na sličan način.", "Da li je bilo nečeg sličnog ili drugačijeg?"],
    ["Uporedi svoj doživljaj sa prvim danom, bez očekivanja određenog ishoda.", `Kako bi opisao/la ${focus} danas?`],
    ["Ako želiš, napravi samo malu izmenu u koraku koji isprobavaš.", "Koja verzija koraka ti je delovala jednostavnije?"],
    ["Ponovi najjednostavniji korak koji želiš još jednom da isprobaš.", "Šta je bilo lako da ponoviš?"],
    ["Pregledaj beleške i odluči šta želiš da nastaviš da posmatraš.", `Koji utisak o ${focus} želiš da zapamtiš?`],
  ];
  return steps.map(([action, observe], index) => ({
    day: index + 1,
    action: `Za ${focus}: ${action}`,
    observe: `U vezi sa ${focus}: ${observe}`,
  }));
};

export const buildSleepPremiumFallback = (input) => {
  const priority = getSleepPremiumPriority(input);
  const [first, second] = focusEvidence(input, priority);
  const focus = priorityContext(priority);
  const report = {
    version: 2,
    profile: input.profile,
    profile_explanation: getProfileExplanation(input),
    priority: {
      title: "TVOJ PRIORITET #1",
      area: priority.title,
      explanation: `Počinje se od teme ${focus}, jer se ona izdvaja u tvojim odgovorima. Izbori „${first}“ i „${second}“ daju lični kontekst za ovaj prvi fokus, bez potrebe da ostatak sna svedeš na jednu stvar.`,
    },
    connections: getConnections(priority),
    stable_or_tracking: getStableOrTracking(input, priority),
    seven_day_plan: getPlan(priority),
    alternatives: [
      `Ako ti prvi korak ne odgovara, izaberi jednostavniji način da primetiš ${focus}, na primer kratkom beleškom o tome kako ga doživljavaš.`,
    ],
    review_questions: [
      `Šta si primetio/la o ${focus} tokom ovih dana?`,
      `Koji korak u vezi sa ${focus} ti je bio najjednostavniji da isprobaš?`,
      `Šta bi želeo/la da nastaviš da pratiš o ${focus}, bez očekivanja određenog ishoda?`,
    ],
    after_seven_days: `Pregledaj šta si zabeležio/la o ${focus} i uporedi beleške sa početnim utiskom. Zadrži samo ono što ti je korisno da nastaviš da posmatraš; ne moraš da zaključuješ da je jedna navika objasnila tvoje iskustvo.`,
    closing: "Ovo je informativni wellness prikaz tvojih odgovora. Ako teškoće sa snom dugo traju i znatno utiču na svakodnevicu, razgovor sa zdravstvenim stručnjakom može biti koristan.",
  };

  const validation = validateSleepPremiumReport(report, input);
  if (!validation.valid) throw new Error(`Deterministic Premium fallback failed validation: ${validation.reason}`);
  return validation.report;
};
