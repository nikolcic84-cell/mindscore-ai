import { calculateSleepSignature, getSleepDimensionSeverity } from "./sleepSignature.js";

const QUESTION_ANSWER_TEXT = [
  [
    "Odmorno — spreman sam za dan",
    "Uglavnom dobro, ali bih mogao još malo da spavam",
    "Ni odmorno ni posebno umorno",
    "Umorno — teško mi je da ustanem",
    "Kao da nisam ni spavao",
  ],
  [
    "Zaspim vrlo brzo",
    "Treba mi malo vremena",
    "Često mi treba dosta vremena da zaspim",
    "Misli mi ne daju da se isključim",
    "Imam osećaj da se borim sa snom",
  ],
  [
    "Uglavnom spavam bez buđenja",
    "Probudim se jednom i brzo nastavim da spavam",
    "Budim se nekoliko puta",
    "Kada se probudim, teško ponovo zaspim",
    "Noć mi često deluje isprekidano",
  ],
  [
    "Ustanem bez problema",
    "Treba mi nekoliko minuta",
    "Odložim alarm jednom",
    "Odlažem ga više puta",
    "Jedva se nateram da ustanem",
  ],
  [
    "7–9 sati",
    "6–7 sati",
    "5–6 sati",
    "Manje od 5 sati",
    "Više od 9 sati, a ipak često nisam odmoran",
  ],
  [
    "Uglavnom se smirim bez ekrana",
    "Imam svoju mirnu večernju rutinu",
    "Gledam TV ili neki sadržaj",
    "Telefon mi je često u ruci",
    "Skrolujem dok ne postanem potpuno pospan",
  ],
  [
    "Lako se isključim",
    "Razmišljam malo, pa se smirim",
    "Vrtim događaje iz tog dana",
    "Planiram, analiziram i razmišljam o problemima",
    "Telo je umorno, ali mozak kao da ne želi da stane",
  ],
  [
    "Uglavnom je stabilna",
    "Povremeno osetim umor",
    "Često mi treba kafa ili pauza",
    "Imam periode kada jedva držim oči otvorene",
    "Veći deo dana osećam da mi nedostaje energije",
  ],
  [
    "Budim se približno u isto vreme",
    "Spavam malo duže",
    "Spavam znatno duže",
    "Mogao bih da ostanem u krevetu pola dana",
    "Vreme spavanja i buđenja mi se stalno menja",
  ],
  [
    "Skoro uvek su slični",
    "Većinom imam isti ritam",
    "Razlikuju se po nekoliko sati",
    "Često nemam nikakav raspored",
    "Svaki dan može izgledati potpuno drugačije",
  ],
  [
    "Malo toga — uglavnom funkcionišem normalno",
    "Više sam umoran",
    "Teže se koncentrišem",
    "Umorniji sam i raspoloženje mi se promeni",
    "Imam osećaj da samo pokušavam da preguram dan",
  ],
  [
    "Zadovoljan sam svojim snom",
    "Uglavnom spavam dobro, uz poneku lošu noć",
    "Moj san bi mogao biti bolji",
    "Često imam osećaj da mi san nije dovoljan",
    "Spavanje mi je postalo nešto sa čim se redovno borim",
  ],
];

const DIMENSIONS = Object.freeze({
  recovery: { name: "Oporavak", questions: [0, 3, 7, 10] },
  sleepOnset: { name: "Uspavljivanje", questions: [1, 6] },
  continuity: { name: "Kontinuitet sna", questions: [2] },
  rhythm: { name: "Ritam sna", questions: [4, 8, 9] },
});

const DIMENSION_ANSWER_CONTEXT = Object.freeze({
  recovery: [
    "kako se osećaš po buđenju",
    "koliko lako ustaješ",
    "kakva ti je energija tokom dana",
    "šta primećuješ posle lošije noći",
  ],
  sleepOnset: [
    "koliko lako zaspiš",
    "koliko je um aktivan kada legneš",
  ],
  continuity: ["šta se događa tokom noći"],
  rhythm: [
    "koliko sna obično imaš",
    "kako se vreme buđenja menja slobodnim danom",
    "koliko su predvidivi vreme odlaska u krevet i ustajanja",
  ],
});

const normalizePoints = (answers) => {
  if (
    !Array.isArray(answers) ||
    answers.length !== 12 ||
    answers.some((answer) => !Number.isInteger(answer) || answer < 1 || answer > 5)
  ) {
    throw new TypeError("A complete set of twelve valid sleep answers is required.");
  }
  return answers.map((points) => 5 - points);
};

const getDimensionForArea = (areaName) =>
  Object.entries(DIMENSIONS).find(([, dimension]) => dimension.name === areaName)?.[0] || "recovery";

const getWeakestDimensionKey = (dimensionScores) =>
  Object.keys(DIMENSIONS).sort((a, b) => dimensionScores[a] - dimensionScores[b])[0];

const getAnswerText = (indexes, questionIndex) => QUESTION_ANSWER_TEXT[questionIndex][indexes[questionIndex]];

const quoteAnswer = (answer) => `„${answer}“`;

const getDimensionObservation = (key, indexes, dimensionScores) => {
  const dimension = DIMENSIONS[key];
  const severity = getSleepDimensionSeverity(dimensionScores[key]);
  const answerLines = dimension.questions.map((questionIndex) =>
    `${DIMENSION_ANSWER_CONTEXT[key][dimension.questions.indexOf(questionIndex)]}: ${quoteAnswer(getAnswerText(indexes, questionIndex))}`
  );
  const observed = answerLines.join("; ");

  if (key === "recovery") {
    if (severity === "weak") return `Odgovori ukazuju da su buđenje ili dnevno funkcionisanje trenutno zahtevniji deo tvoje priče. ${observed}.`;
    if (severity === "stable") return `U odgovorima se vide oslonci u buđenju i dnevnom funkcionisanju. Vredi sačuvati ono što ti već pomaže: ${observed}.`;
    return `Oporavak deluje promenljivo: neki odgovori ukazuju na dobru osnovu, dok drugi traže više pažnje. ${observed}.`;
  }

  if (key === "sleepOnset") {
    if (severity === "weak") return `Uspavljivanje i smirivanje misli izdvajaju se kao deo večeri koji ti može tražiti više prostora. ${observed}.`;
    if (severity === "stable") return `Odgovori pokazuju da prelazak ka snu često ide mirno. Osloni se na ono što već funkcioniše: ${observed}.`;
    return `Večernje smirivanje je delimično podržano, ali može zavisiti od dana i rutine. ${observed}.`;
  }

  if (key === "continuity") {
    if (severity === "weak") return `Tvoj odgovor ukazuje da kontinuitet noći trenutno zaslužuje pažnju: ${observed}.`;
    if (severity === "stable") return `Tvoj odgovor ukazuje na uglavnom miran tok noći: ${observed}. To je koristan oslonac koji vredi čuvati.`;
    return `Tvoj odgovor opisuje mešovito iskustvo tokom noći: ${observed}. Obrati pažnju na to šta ti olakšava povratak u san.`;
  }

  if (severity === "weak") return `Vreme sna i predvidivost ritma deluju kao važan obrazac za posmatranje. ${observed}.`;
  if (severity === "stable") return `Tvoji odgovori ukazuju na koristan oslonac u količini sna i dnevnom ritmu. ${observed}.`;
  return `Ritam sna deluje delimično ustaljen, uz određene razlike između dana. ${observed}.`;
};

const getStrengthObservation = (key, indexes, dimensionScores) => {
  const severity = getSleepDimensionSeverity(dimensionScores[key]);
  const dimension = DIMENSIONS[key];
  const evidence = dimension.questions.map((questionIndex) =>
    `${DIMENSION_ANSWER_CONTEXT[key][dimension.questions.indexOf(questionIndex)]}: ${quoteAnswer(getAnswerText(indexes, questionIndex))}`
  ).join("; ");

  if (severity === "stable") {
    return `Tvoji odgovori pokazuju najjasniji oslonac u oblasti ${dimension.name.toLowerCase()}. Vredi sačuvati ono što već funkcioniše: ${evidence}.`;
  }
  if (severity === "mixed") {
    return `U poređenju sa ostalim oblastima, ${dimension.name.toLowerCase()} deluje kao relativno stabilniji oslonac, iako može varirati. To se vidi u odgovorima: ${evidence}.`;
  }
  return `${dimension.name} je relativno najpovoljnija oblast među odgovorima, ali se ne izdvaja kao potpuno stabilan oslonac. Tvoji odgovori su: ${evidence}.`;
};

const getSignatureExplanation = (signatureResult, indexes, dimensionScores) => {
  const onsetText = getAnswerText(indexes, 1);
  const mindText = getAnswerText(indexes, 6);

  if (signatureResult.signatureKey === "calm_night") {
    return `Tvoj obrazac, ${signatureResult.signature}, opisuje odgovore bez jedne jasno izdvojene slabe oblasti. Najjači oslonac u tvojim odgovorima je ${signatureResult.strongestArea.toLowerCase()}. Ovaj potpis ne znači da je svaka noć ista; on sažima ono što si označio/la u ovom upitniku.`;
  }
  if (signatureResult.signatureKey === "empty_battery") {
    return `Potpis ${signatureResult.signature} nastaje kada se u odgovorima istovremeno izdvoje kontinuitet noći i osećaj oporavka. Tvoj odgovor o buđenjima — ${quoteAnswer(getAnswerText(indexes, 2))} — posmatra se zajedno sa odgovorima o buđenju i dnevnom funkcionisanju. To opisuje obrazac odgovora, a ne medicinski zaključak.`;
  }
  if (signatureResult.signatureKey === "sleep_under_pressure") {
    const relevantKeys = Object.keys(DIMENSIONS).filter((key) => getSleepDimensionSeverity(dimensionScores[key]) === "weak");
    const relevantAreas = relevantKeys.map((key) => DIMENSIONS[key].name.toLowerCase()).join(", ");
    return `Potpis ${signatureResult.signature} znači da se više delova tvoje priče o snu prepliće i da nije korisno svesti ih na samo jedan uzrok. U tvojim odgovorima pažnju zajedno traže oblasti: ${relevantAreas}.`;
  }
  if (signatureResult.signatureKey === "awake_mind") {
    return `Potpis ${signatureResult.signature} opisuje večeri u kojima uspavljivanje ili smirivanje misli mogu tražiti više vremena. U tvojim odgovorima stoji ${quoteAnswer(onsetText)} i ${quoteAnswer(mindText)}. To su konkretni signali za izbor nežnijeg prelaza iz dana u odmor.`;
  }
  if (signatureResult.signatureKey === "tired_waking") {
    return `Potpis ${signatureResult.signature} govori da se osećaj oporavka pri buđenju trenutno najviše izdvaja. Tvoji odgovori poput ${quoteAnswer(getAnswerText(indexes, 0))} i ${quoteAnswer(getAnswerText(indexes, 7))} daju kontekst ovom obrascu.`;
  }
  if (signatureResult.signatureKey === "fragmented_night") {
    return `Potpis ${signatureResult.signature} opisuje odgovor koji se odnosi na tok noći kao najizraženiju temu. Tvoj izbor je: ${quoteAnswer(getAnswerText(indexes, 2))}. Ostale oblasti se koriste kao kontekst, a ne kao zamena za ovaj odgovor.`;
  }
  if (signatureResult.signatureKey === "irregular_rhythm") {
    return `Potpis ${signatureResult.signature} ukazuje da se ritam spavanja i buđenja najviše izdvaja u tvojim odgovorima. Na primer, među tvojim odgovorima su ${quoteAnswer(getAnswerText(indexes, 9))} i ${quoteAnswer(getAnswerText(indexes, 8))}.`;
  }
  return signatureResult.shortText;
};

const getRelationshipInsight = (indexes, dimensionScores) => {
  const ordered = Object.keys(DIMENSIONS).sort((a, b) => dimensionScores[a] - dimensionScores[b]);
  const first = ordered[0];
  const second = ordered[1];

  if (first === "rhythm" || second === "rhythm") {
    return `Tvoj odgovor o slobodnom danu (${quoteAnswer(getAnswerText(indexes, 8))}) ide uz ono što kažeš o predvidivosti ritma (${quoteAnswer(getAnswerText(indexes, 9))}). Posmatrati ih zajedno može pomoći da razlikuješ povremenu nadoknadu sna od promenljivog rasporeda.`;
  }
  if (first === "sleepOnset" || second === "sleepOnset") {
    return `Tvoj odgovor o uspavljivanju (${quoteAnswer(getAnswerText(indexes, 1))}) može se posmatrati zajedno sa načinom na koji provodiš poslednjih 30 minuta pre sna (${quoteAnswer(getAnswerText(indexes, 5))}). Veza je korisna za razmišljanje o večernjem prelazu, bez pretpostavke da je jedan odgovor uzrok drugog.`;
  }
  if (first === "continuity" || second === "continuity") {
    return `Odgovor o toku noći (${quoteAnswer(getAnswerText(indexes, 2))}) ima smisla čitati uz jutarnji osećaj (${quoteAnswer(getAnswerText(indexes, 0))}). Zajedno daju širu sliku o tome kako se noćno iskustvo i jutro pojavljuju u tvojim odgovorima.`;
  }
  return `Odgovori o buđenju (${quoteAnswer(getAnswerText(indexes, 0))}) i energiji tokom dana (${quoteAnswer(getAnswerText(indexes, 7))}) daju dva pogleda na oporavak. Čitani zajedno, pomažu da primetiš da li jutro i ostatak dana opisuju sličan obrazac.`;
};

const getActionPlan = (focusKey, indexes) => {
  const windDownAnswer = indexes[5];
  const windDownFirstStep = windDownAnswer >= 3
    ? "Ostavi telefon van domašaja tokom poslednjih 20 minuta pre spavanja."
    : windDownAnswer === 2
    ? "Izaberi mirniji sadržaj i završi gledanje pre nego što legneš."
    : "Zadrži mirnu rutinu bez ekrana koja ti već prija.";

  const actionsByFocus = {
    recovery: [
      "Izaberi vreme ustajanja koje možeš da održiš većinu narednih dana.",
      "Pripremi jednu jednostavnu jutarnju stvar veče ranije.",
      "Ujutru zabeleži kako se osećaš jednom kratkom rečenicom.",
      "Ako osetiš umor, planiraj kratku mirnu pauzu umesto da menjaš celu rutinu.",
    ],
    sleepOnset: [
      windDownFirstStep,
      "Odvoji nekoliko minuta da zapišeš misli ili obaveze koje želiš da nastaviš sutra.",
      "Započni večernje smirivanje približno u isto vreme.",
      "Biraj jednu tihu aktivnost koja ti pomaže da usporiš.",
    ],
    continuity: [
      "Napravi jednostavan, umirujući povratak u krevet ako se probudiš.",
      "Pokušaj da ne proveravaš vreme tokom noćnog buđenja.",
      "Održavaj spavaću sobu prijatnom i spremnom za odmor.",
      "Ujutru primeti šta je prethodilo mirnijoj ili isprekidanijoj noći.",
    ],
    rhythm: [
      "Odredi okvirno vreme ustajanja koje možeš da pratiš i radnim i slobodnim danom.",
      "Pomeri vreme odlaska u krevet postepeno, bez naglih promena.",
      "Zabeleži vreme odlaska u krevet i buđenja tokom nedelje.",
      "Ako ti treba duži odmor, pokušaj da promena rasporeda bude postepena.",
    ],
  };
  return actionsByFocus[focusKey];
};

const getSevenDayPlan = (focusKey, actions) => {
  const focusNames = {
    recovery: "jutarnjeg osećaja i oporavka",
    sleepOnset: "večernjeg smirivanja",
    continuity: "mirnijeg kontinuiteta noći",
    rhythm: "predvidivijeg ritma",
  };
  return [
    `Dan 1 — Izaberi jedan korak za ${focusNames[focusKey]}: ${actions[0]}`,
    "Dan 2 — Ponovi isti korak i zabeleži kako ti je bilo.",
    `Dan 3 — Zadrži rutinu; obrati pažnju na odgovor koji se odnosi na ${DIMENSION_ANSWER_CONTEXT[focusKey][0]}.`,
    `Dan 4 — Ponovi ono što je bilo najlakše. Nemoj dodavati novu obavezu ako ti ne prija.`,
    `Dan 5 — Isprobaj i drugi predlog: ${actions[1]}`,
    `Dan 6 — Vrati se koraku koji ti deluje najprirodnije i primeti razliku u jutarnjem osećaju.`,
    `Dan 7 — Osvrni se na nedelju: zadrži jednu promenu koja se pokazala realnom za tvoj raspored.`,
  ];
};

/** Build a deterministic, Serbian, answer-grounded Premium Sleep Report model. */
export function buildSleepPremiumReport(answers) {
  const answerIndexes = normalizePoints(answers);
  const signature = calculateSleepSignature(answerIndexes);
  if (!signature) throw new TypeError("Sleep signature could not be calculated from the supplied answers.");

  const dimensionScores = signature.internalScores;
  const strongestKey = getDimensionForArea(signature.strongestArea);
  const focusKey = signature.signatureKey === "calm_night"
    ? strongestKey
    : signature.signatureKey === "sleep_under_pressure"
    ? getWeakestDimensionKey(dimensionScores)
    : getDimensionForArea(signature.mainArea);
  const observation = signature.signatureKey === "empty_battery"
    ? `${getDimensionObservation("recovery", answerIndexes, dimensionScores)} ${getDimensionObservation("continuity", answerIndexes, dimensionScores)}`
    : signature.signatureKey === "sleep_under_pressure"
    ? Object.keys(DIMENSIONS)
      .filter((key) => getSleepDimensionSeverity(dimensionScores[key]) === "weak")
      .map((key) => getDimensionObservation(key, answerIndexes, dimensionScores))
      .join(" ")
    : getDimensionObservation(focusKey, answerIndexes, dimensionScores);
  const actions = getActionPlan(focusKey, answerIndexes);

  return {
    signature,
    dimensionScores,
    sections: [
      {
        title: "Tvoj potpis sna",
        paragraphs: [getSignatureExplanation(signature, answerIndexes, dimensionScores)],
      },
      {
        title: "Šta se najviše izdvaja",
        paragraphs: [observation],
      },
      {
        title: "Šta ti već ide dobro",
        paragraphs: [getStrengthObservation(strongestKey, answerIndexes, dimensionScores)],
      },
      {
        title: "Veza koju možda ne primećuješ",
        paragraphs: [getRelationshipInsight(answerIndexes, dimensionScores)],
      },
      {
        title: "Na šta vredi obratiti pažnju",
        paragraphs: [signature.signatureKey === "calm_night"
          ? `Nijedna oblast se ne izdvaja kao jasan problem. Ako želiš da pratiš obrazac, posmatraj ${DIMENSION_ANSWER_CONTEXT[focusKey].join(" i ")} i nastavi da čuvaš navike koje ti prijaju.`
          : signature.signatureKey === "empty_battery"
          ? "U tvojim odgovorima se zajedno izdvajaju kontinuitet noći i osećaj oporavka. Možeš početi od jednog malog koraka koji podržava mirniji tok noći i lakši početak dana."
          : signature.signatureKey === "sleep_under_pressure"
          ? "Više oblasti zaslužuje pažnju, pa je korisnije izabrati jedan mali korak nego pokušavati da menjaš sve odjednom."
          : `Kao sledeći mali fokus može poslužiti ${DIMENSIONS[focusKey].name.toLowerCase()}. Ovo je smernica za posmatranje ličnih navika, ne medicinski zaključak.`],
      },
      {
        title: "Odakle da počneš",
        paragraphs: ["Izaberi samo korake koji se uklapaju u tvoj život; ne moraš uvoditi sve odjednom."],
        bullets: actions,
      },
      {
        title: "Tvoj plan za narednih 7 dana",
        paragraphs: getSevenDayPlan(focusKey, actions),
      },
      {
        title: "Za kraj",
        paragraphs: [
          `${signature.shortText} Tvoji odgovori ukazuju na lični obrazac koji može poslužiti kao polazna tačka za male, održive promene.`,
          "Ovaj izveštaj je informativnog karaktera i nije medicinska dijagnoza. Ako imaš dugotrajne ili ozbiljne probleme sa snom, razgovaraj sa lekarom ili drugim kvalifikovanim zdravstvenim stručnjakom.",
        ],
      },
    ],
  };
}

export { DIMENSIONS as SLEEP_PREMIUM_REPORT_DIMENSIONS };
