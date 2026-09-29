import {
  getSleepPremiumMainAreaTitle,
  getSleepPremiumPositiveOrWatchTitle,
  getSleepPremiumStrengthMode,
  validateSleepPremiumReport,
} from "./sleepPremiumSchema.js";

const CORE = ["recovery", "sleepOnset", "continuity"];
const AREA_NAMES = Object.freeze({
  recovery: "osećaj nakon buđenja",
  sleepOnset: "uspavljivanje",
  continuity: "tok noći",
  rhythm: "vreme i ritam spavanja",
});

const answer = (input, id) => input.answers.find((item) => item.questionId === id)?.answer || "tvoj izabrani odgovor";
const weakCore = (input) => CORE.filter((key) => input.dimensions[key].state === "WEAK");
const stableAreas = (input) => Object.keys(AREA_NAMES).filter((key) => input.dimensions[key].state === "STABLE");

const getProfileSummary = (input) => {
  const summaries = {
    "MIRNA NOĆ": "Tvoji odgovori daju skladnu sliku sna. U nastavku možeš da pogledaš kako se pojedini delovi tvog iskustva uklapaju.",
    "UMORAN SAN": "U odgovorima se izdvaja osećaj nakon sna i buđenja. Izveštaj povezuje taj utisak sa ostalim delovima tvoje noći.",
    "BUDAN UM": "U večernjim odgovorima se izdvaja prelazak ka snu. Pogledaćemo ga zajedno sa onim što primećuješ tokom noći i nakon buđenja.",
    "ISPREKIDAN SAN": "U odgovorima se izdvaja tok noći. Ostali delovi, uključujući jutarnji osećaj, pružaju dodatni kontekst.",
    "SAN POD PRITISKOM": "Tvoji odgovori daju više različitih pogleda na san. Korisno ih je sagledati zajedno, bez svođenja cele priče na jedan odgovor.",
  };
  return summaries[input.profile];
};

const getMainExplanation = (input) => {
  const weak = weakCore(input);
  if (weak.length >= 2) {
    const evidenceQuestions = { recovery: "Q1", sleepOnset: "Q2", continuity: "Q3" };
    const evidence = weak.map((key) => `${AREA_NAMES[key]}: „${answer(input, evidenceQuestions[key])}“`).join("; ");
    return `Odgovori o ${weak.map((key) => AREA_NAMES[key]).join(" i ")} izdvajaju se zajedno. U tvojim izborima stoji ${evidence}. Nijedan pojedinačni odgovor ne objašnjava celu sliku, pa ih je korisnije posmatrati uporedo.`;
  }
  if (weak[0] === "recovery") return `Pri buđenju si izabrao/la „${answer(input, "Q1")}“, a za dnevnu energiju „${answer(input, "Q8")}“. Vredi pratiti kako se ova dva doživljaja pojavljuju kroz naredne dane.`;
  if (weak[0] === "sleepOnset") return `Za uspavljivanje si izabrao/la „${answer(input, "Q2")}“, a za poslednjih 30 minuta pre sna „${answer(input, "Q6")}“. Ova dva odgovora zajedno opisuju tvoj večernji prelaz ka odmoru.`;
  if (weak[0] === "continuity") return `Tok noći si opisao/la kao „${answer(input, "Q3")}“, dok su tvoje poslednje noći „${answer(input, "Q12")}“. Vredi ih razmotriti zajedno sa jutarnjim osećajem.`;
  if (input.answers.find((item) => item.questionId === "Q6").mappedValue <= 1) {
    return `Za poslednjih 30 minuta pre sna izabrao/la si „${answer(input, "Q6")}“. Može biti korisno da primetiš kako se večernji sadržaj uklapa u tvoj doživljaj uspavljivanja.`;
  }
  if (input.answers.find((item) => item.questionId === "Q12").mappedValue <= 1) {
    return `O poslednjim noćima izabrao/la si „${answer(input, "Q12")}“. Taj utisak vredi sagledati uz odgovor o toku noći: „${answer(input, "Q3")}“.`;
  }
  if (input.dimensions.rhythm.state !== "STABLE" && CORE.every((key) => input.dimensions[key].score > input.dimensions.rhythm.score)) {
    return `Tvoji odgovori o dužini sna („${answer(input, "Q5")}“) i predvidivosti vremena („${answer(input, "Q10")}“) mogu se posmatrati uz to kako se osećaš nakon buđenja.`;
  }
  return `Odgovor o jutru („${answer(input, "Q1")}“) i tvoj utisak o poslednjim noćima („${answer(input, "Q12")}“) daju dva korisna pogleda na to kako doživljavaš san.`;
};

const getConnections = (input) => {
  const weak = weakCore(input);
  if (weak.includes("sleepOnset") && weak.includes("recovery")) {
    return [
      `Pre sna si izabrao/la „${answer(input, "Q2")}“, a nakon buđenja „${answer(input, "Q1")}“. Vredi obratiti pažnju na to kako se ova iskustva pojavljuju zajedno.`,
      `Odgovor o večernjem smirivanju („${answer(input, "Q6")}“) možeš da uporediš sa jutarnjim osećajem („${answer(input, "Q1")}“), bez pretpostavke da jedno objašnjava drugo.`,
    ];
  }
  if (weak.includes("continuity") && weak.includes("recovery")) {
    return [
      `Tok noći („${answer(input, "Q3")}“) i osećaj po buđenju („${answer(input, "Q1")}“) u tvojim odgovorima zaslužuju da se posmatraju zajedno.`,
      `Tvoj utisak o poslednjim noćima („${answer(input, "Q12")}“) možeš da uporediš sa dnevnom energijom („${answer(input, "Q8")}“).`,
    ];
  }
  if (weak.includes("sleepOnset") && weak.includes("continuity")) {
    return [
      `Odgovor o uspavljivanju („${answer(input, "Q2")}“) možeš da posmatraš uz ono što se dešava tokom noći („${answer(input, "Q3")}“).`,
      `Poslednjih 30 minuta pre sna („${answer(input, "Q6")}“) i tvoj utisak o noći („${answer(input, "Q12")}“) daju različite delove tvoje priče.`,
    ];
  }
  if (input.dimensions.recovery.state === "WEAK" && input.dimensions.sleepOnset.state === "STABLE") {
    return [
      `Uspavljivanje si opisao/la kao „${answer(input, "Q2") }“, dok je jutarnji osećaj „${answer(input, "Q1")}“. Vredi pratiti ovu razliku kroz nekoliko dana.`,
      `Odgovori o ustajanju („${answer(input, "Q4")}“) i dnevnoj energiji („${answer(input, "Q8")}“) mogu da se čitaju zajedno.`,
    ];
  }
  if (input.dimensions.rhythm.state === "STABLE" && input.dimensions.recovery.state === "WEAK") {
    return [
      `Predvidivost vremena („${answer(input, "Q10")}“) možeš da posmatraš uz osećaj nakon buđenja („${answer(input, "Q1")}“).`,
      `Odgovor o dužini sna („${answer(input, "Q5")}“) i dnevnoj energiji („${answer(input, "Q8")}“) zajedno daju korisniji kontekst.`,
    ];
  }
  return [
    `Uspavljivanje („${answer(input, "Q2")}“) i tok noći („${answer(input, "Q3")}“) daju dva različita pogleda na tvoju noć.`,
    `Jutarnji osećaj („${answer(input, "Q1")}“) možeš da posmatraš uz ono što primećuješ nakon lošije noći („${answer(input, "Q11")}“).`,
  ];
};

const getPositiveOrWatchText = (input, mode) => {
  if (mode === "watch") {
    const focus = weakCore(input)[0] || (input.answers.find((item) => item.questionId === "Q6").mappedValue <= 1 ? "sleepOnset" : "recovery");
    return `Narednih dana obrati pažnju na ${AREA_NAMES[focus]} i zabeleži šta primećuješ, bez potrebe da odmah menjaš rutinu.`;
  }
  const areas = stableAreas(input);
  if (areas.length > 1) {
    return `U više delova sna vidi se dobra osnova. Među njima su ${areas.map((key) => AREA_NAMES[key]).join(" i ")}; možeš da obratiš pažnju na navike koje ti pomažu da ih održiš.`;
  }
  const area = areas[0];
  return `U odgovorima o ${AREA_NAMES[area]} vidi se dobra osnova. Na primer, izabrao/la si „${answer(input, area === "recovery" ? "Q1" : area === "sleepOnset" ? "Q2" : area === "continuity" ? "Q3" : "Q10")}“. Vredi da zadržiš ono što ti prija.`;
};

const getFocusName = (input) => {
  const weak = weakCore(input);
  if (weak.length >= 2) return "više delova sna";
  if (weak.length === 1) return AREA_NAMES[weak[0]];
  if (input.answers.find((item) => item.questionId === "Q6").mappedValue <= 1) return AREA_NAMES.sleepOnset;
  if (input.answers.find((item) => item.questionId === "Q12").mappedValue <= 1) return AREA_NAMES.continuity;
  if (input.dimensions.rhythm.state !== "STABLE") return AREA_NAMES.rhythm;
  return "naviku koju najlakše možeš da ponoviš";
};

const getTonightActions = (input) => {
  const weak = weakCore(input);
  if (weak.includes("sleepOnset") || input.answers.find((item) => item.questionId === "Q6").mappedValue <= 1) {
    return [
      "Izaberi jednu mirnu aktivnost za poslednjih nekoliko minuta pre spavanja.",
      "Odloži za sutra jednu misao ili obavezu koja ti se vraća pred san.",
      "Zabeleži kako ti je prijao večernji prelaz, bez očekivanja da svaka noć bude ista.",
    ];
  }
  if (weak.includes("continuity") || input.answers.find((item) => item.questionId === "Q12").mappedValue <= 1) {
    return [
      "Pripremi miran povratak u krevet ako se probudiš tokom noći.",
      "Ako se probudiš, probaj da ne proveravaš koliko je sati.",
      "Ujutru zabeleži da li se sećaš buđenja i kako se osećaš.",
    ];
  }
  if (weak.includes("recovery")) {
    return [
      "Izaberi vreme ustajanja koje ti je realno i za sutra.",
      "Pripremi jednu jednostavnu jutarnju stvar pre spavanja.",
      "Ujutru zabeleži jednom rečju kako se osećaš.",
    ];
  }
  if (input.dimensions.rhythm.state !== "STABLE") {
    return [
      "Odredi okvirno vreme ustajanja za sutra.",
      "Pripremi večernju rutinu bez dodavanja novih obaveza.",
      "Zabeleži kada si legao/la i kada si ustao/la.",
    ];
  }
  return [
    "Zadrži jednu večernju naviku koja ti već prija.",
    "Pripremi jednu jednostavnu stvar za mirnije jutro.",
    "Ujutru zabeleži kako se osećaš nakon noći.",
  ];
};

const getSevenDayActions = (input) => {
  const focus = getFocusName(input);
  return [
    `Primeti kako ti je večeras pre sna, posebno oko ${focus}.`,
    `Zabeleži jutarnji osećaj i približno vreme odlaska na spavanje.`,
    `Ponovi jednu malu večernju naviku koja ti deluje prijatno.`,
    `Obrati pažnju na ${focus}, bez menjanja više stvari odjednom.`,
    `Zabeleži šta je bilo slično ili drugačije u odnosu na prethodne dane.`,
    `Ponovi korak koji ti je bio najlakši i primeti kako se osećaš ujutru.`,
    `Pogledaj beleške i odluči koju jednu naviku želiš da zadržiš.`,
  ];
};

const getTrackingItems = (input) => {
  const weak = weakCore(input);
  const items = [];
  if (weak.includes("sleepOnset") || input.answers.find((item) => item.questionId === "Q6").mappedValue <= 1) {
    items.push("Koliko ti je približno trebalo da zaspiš.", "Šta si radio/la tokom poslednjih minuta pre spavanja.");
  }
  if (weak.includes("continuity") || input.answers.find((item) => item.questionId === "Q12").mappedValue <= 1) {
    items.push("Da li si se budio/la tokom noći.", "Kako si se osećao/la po buđenju.");
  }
  if (weak.includes("recovery")) items.push("Kako si se osećao/la ujutru i kakva ti je bila dnevna energija.");
  if (input.dimensions.rhythm.state !== "STABLE") items.push("Približno vreme odlaska na spavanje i ustajanja.");
  return [...new Set([...items, "Kako si se osećao/la po buđenju.", "Približno vreme odlaska na spavanje."])].slice(0, 4);
};

export const buildSleepPremiumFallback = (input) => {
  const mode = getSleepPremiumStrengthMode(input);
  const actions = getTonightActions(input);
  const dayActions = getSevenDayActions(input);
  const report = {
    version: 1,
    profile: { name: input.profile, summary: getProfileSummary(input) },
    mainArea: {
      title: getSleepPremiumMainAreaTitle(input),
      explanation: getMainExplanation(input),
    },
    connections: {
      title: "Šta se kod tebe povezuje?",
      items: getConnections(input),
    },
    positiveOrWatch: {
      mode,
      title: getSleepPremiumPositiveOrWatchTitle(mode),
      text: getPositiveOrWatchText(input, mode),
    },
    startingPoint: {
      title: "Gde ima najviše smisla da počneš?",
      text: `Počni od ${getFocusName(input)} i izaberi jednu malu promenu koju možeš realno da ponoviš.`,
    },
    tonight: {
      title: "Šta možeš da uradiš već večeras?",
      actions,
    },
    sevenDayPlan: dayActions.map((action, index) => ({
      day: index + 1,
      title: `Dan ${index + 1}`,
      action,
    })),
    tracking: {
      title: "Šta vredi da pratiš?",
      items: getTrackingItems(input),
    },
    closing: "Ovo je informativni prikaz tvojih odgovora, a ne zamena za razgovor sa zdravstvenim stručnjakom. Ako ti teškoće često ometaju svakodnevni život, razgovor sa lekarom može biti koristan.",
  };

  const validation = validateSleepPremiumReport(report, input);
  if (!validation.valid) throw new Error(`Deterministic Premium fallback failed validation: ${validation.reason}`);
  return validation.report;
};
