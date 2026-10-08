import {
  getSleepPremiumPriority,
  getSleepPremiumStrengthMode,
  validateSleepPremiumReport,
} from "./sleepPremiumSchema.js";

const selected = (input, id) => input.answers.find(({ questionId }) => questionId === id);
const answer = (input, id) => selected(input, id).answer;
const value = (input, id) => selected(input, id).mappedValue;
const quote = (input, id) => `„${answer(input, id)}“`;

const focusIds = {
  recovery: ["Q1", "Q8"],
  sleepOnset: ["Q2", "Q7"],
  continuity: ["Q3", "Q12"],
  rhythm: ["Q9", "Q10"],
  multiple: ["Q1", "Q3"],
  whole: ["Q1", "Q12"],
};

const getEveningStep = (input) => {
  const q6 = value(input, "Q6");
  if (q6 <= 1) return "Ostavi telefon van dohvata deset minuta pre odlaska u krevet; ostatak večeri ne menjaj.";
  if (q6 === 2) return "Završi sadržaj koji gledaš deset minuta pre odlaska u krevet; ostatak večeri ne menjaj.";
  return value(input, "Q7") <= 2
    ? "Pre svoje mirne rutine napiši jednu obavezu za sutra i njen prvi korak; ostavi planiranje za sutra."
    : "Pripremi stvari za sutra pre svoje mirne rutine, pa poslednji deo večeri ostavi onakav kakav ti već prija.";
};

const getConnections = (input) => {
  const waking = value(input, "Q1");
  const energy = value(input, "Q8");
  const onset = value(input, "Q2");
  const thoughts = value(input, "Q7");
  const night = value(input, "Q3");
  const overall = value(input, "Q12");
  const morningContrast = (waking >= 3 && energy <= 2) || (waking <= 2 && energy >= 3);
  const morningMeaning = morningContrast
    ? "Jutarnji osećaj i energija kasnije nisu isti: zato proveri kada tokom dana primećuješ razliku."
    : "Jutro i energija tokom dana daju sličan utisak; ipak ih posmatraj odvojeno, da vidiš da li se menjaju zajedno.";
  const rising = value(input, "Q4") <= 2 ? "Navodiš i teško ustajanje." : "Uporedi i lakoću ustajanja, ne samo osećaj kada se probudiš.";
  const nextDay = value(input, "Q11") <= 2 ? "Posle loše noći posebno primeti kako izgleda ostatak dana." : "Uporedi i svoj doživljaj dana posle loše noći.";
  const eveningMeaning = value(input, "Q6") >= 3 && thoughts <= 2
    ? "Već imaš miran završetak večeri, ali misli ostaju aktivne. Umesto još pravila za ekrane, probaj da planiranje završiš pre svoje rutine."
    : onset >= 3 && thoughts <= 2
      ? "Aktivne misli kod tebe ne znače nužno dugo uspavljivanje. Primeti koliko ti taj deo večeri prija, ne samo koliko brzo zaspiš."
      : value(input, "Q6") <= 2
        ? "U završetku večeri navodiš i ekran. Probaj kratku pauzu od sadržaja i uporedi doživljaj odlaska u krevet."
        : "Miran završetak večeri već postoji. Primeti da li ti isti postupak jednako prija i posle drugačijih dana.";
  const nightMeaning = (night >= 3 && overall <= 2) || (night <= 2 && overall >= 3)
    ? "Tok noći i ukupan utisak se razlikuju. Zato pri pregledu nedelje razdvoji buđenja od toga koliko ti je cela noć prijala."
    : night <= 2
      ? "Buđenja se vide i u ukupnom doživljaju noći. Za početak primeti šta ti je pri buđenju neprijatno, bez pokušaja da odmah menjaš sve."
      : "Tok noći i ukupni utisak uglavnom idu u istom smeru. Pri poređenju izdvoji pojedinačnu drugačiju noć od ostatka nedelje.";
  const rhythmMeaning = value(input, "Q9") >= 3 && value(input, "Q10") >= 3
    ? "Raspored opisuješ kao prilično sličan i kada nema alarma. Nema potrebe za strožim rasporedom; primeti samo odstupanja."
    : "Slobodan dan i uobičajen raspored daju koristan kontrast. Uporedi vreme ustajanja, bez skraćivanja sna da bi se uklopio u satnicu.";
  return [
    { questionIds: ["Q1", "Q8"], text: `Za jutro biraš ${quote(input, "Q1")}, a za energiju ${quote(input, "Q8")}. ${morningMeaning} ${rising} ${nextDay}` },
    { questionIds: ["Q2", "Q7"], text: `Uspavljivanje: ${quote(input, "Q2")}. Misli pred san: ${quote(input, "Q7")}. ${eveningMeaning}` },
    { questionIds: ["Q3", "Q12"], text: `Tok noći opisuješ kao ${quote(input, "Q3")}, a poslednje noći kao ${quote(input, "Q12")}. ${nightMeaning}` },
    { questionIds: ["Q9", "Q10"], text: `Bez alarma: ${quote(input, "Q9")}. Raspored: ${quote(input, "Q10")}. Navodiš i trajanje sna ${quote(input, "Q5")}. ${rhythmMeaning}` },
  ];
};

const getTracking = (input, priority) => {
  const candidates = [
    { key: "rhythm", text: `Uz trajanje sna ${quote(input, "Q5")}, primeti da li se vreme ustajanja razlikuje kada nema alarma. Ne skraćuj san radi poređenja.` },
    { key: "recovery", text: `Ustajanje opisuješ kao ${quote(input, "Q4")}. Primeti da li se taj utisak razlikuje od energije kasnije i od dana posle loše noći.` },
    { key: "sleepOnset", text: value(input, "Q6") >= 3
      ? "Već imaš miran završetak večeri. Primeti kada misli ipak ostaju aktivne i da li tada razmišljaš o danu ili o sutrašnjim obavezama."
      : `Za završetak večeri biraš ${quote(input, "Q6")}. Primeti da li ti je lako da prekineš sadržaj u trenutku koji si izabrao/la.` },
    { key: "continuity", text: "Ako se spontano probudiš, ujutru se priseti da li ti je smetalo svetlo, zvuk ili udobnost. Ne postavljaj alarm radi praćenja." },
  ];
  return {
    mode: getSleepPremiumStrengthMode(input),
    title: "ŠTA JOŠ VREDI DA PRATIŠ",
    items: candidates.filter(({ key }) => key !== priority.key).slice(0, 3).map(({ text }) => text),
  };
};

const getPlan = (input, priority) => {
  const evening = getEveningStep(input);
  const thoughtExperiment = value(input, "Q7") <= 2
    ? "Ranije uveče odvoji pet minuta za obaveze: odaberi jednu za sutra, pa zatvori papir pre svoje rutine."
    : "Probaj pet minuta tihog čitanja van kreveta umesto dodatnog planiranja večeri.";
  const plans = {
    recovery: [
      ["Ujutru primeti kako ti je pri ustajanju, a kasnije proveri energiju u uobičajenom delu dana.", "Da li je jutarnji utisak isti kao kasnije tokom dana?"],
      ["Uveče pripremi odeću i stvari koje koristiš kada ustaneš; ostalo ne menjaj.", "Da li ti je početak jutra jednostavniji ili isti?"],
      [value(input, "Q4") <= 2 ? "Pripremi samo prvu stvar koju želiš da uradiš kada ustaneš, umesto cele jutarnje liste." : "Premesti pripremu stvari ranije uveče, da ne dodaješ obaveze pred odlazak u krevet.", "Da li ti ova verzija pripreme više odgovara?"],
      ["Uporedi jutro sa pripremom i prvo jutro. Proveri i kako ti je bilo kasnije tokom dana.", "Da li primećuješ razliku u lakoći ustajanja, energiji ili ni u jednom?"],
      ["Umesto večernje pripreme, probaj kratku mirnu pauzu u delu dana kada ti energija obično opada.", "Da li ti pauza prija u tom trenutku?"],
      ["Ponovi pripremu jedne jutarnje stvari ili kratku dnevnu pauzu — izaberi ono što je bilo lakše.", "Koji postupak možeš da ponoviš i tokom običnog dana?"],
      ["Pregledaj jutarnje i dnevne utiske. Izaberi jedan postupak za narednu nedelju, ako ti je prijao.", "Šta je bilo korisno, a šta ti je dodavalo obavezu?"],
    ],
    sleepOnset: [
      ["Provedi veče kao obično. Ujutru se priseti završetka večeri, misli i lakoće uspavljivanja.", "Šta ti je najviše zaokupljalo pažnju kada si legao/la?"],
      [evening, "Kako ti je prijao prelaz iz večeri u krevet?"],
      [value(input, "Q6") <= 2 ? "Pomeri kraj gledanja sadržaja malo ranije ili kasnije, prema trenutku kada ti pauza najlakše pada." : "Pripremu za sutra pomeri ranije uveče; svoju mirnu rutinu ostavi nepromenjenu.", "Da li je novi trenutak praktičniji?"],
      ["Uporedi ovo veče sa prvim: odvojeno se priseti misli i lakoće uspavljivanja.", "Da li ti je postupak prijao, čak i ako je uspavljivanje bilo slično?"],
      [value(input, "Q6") >= 3 && value(input, "Q7") <= 2 ? "Umesto pisanja obaveze, probaj pet minuta tihog čitanja van kreveta pre svoje rutine." : thoughtExperiment, "Da li ti ovaj drugačiji završetak večeri više prija?"],
      ["Ponovi onaj završetak večeri koji je zahtevao manje truda; nemoj kombinovati oba eksperimenta.", "Da li bi ti bilo lako da ga ponoviš sutra?"],
      ["Pregledaj utiske o mislima i uspavljivanju. Odaberi jedan postupak ili zadrži svoju raniju rutinu.", "Koja verzija večeri ti najviše odgovara?"],
    ],
    continuity: [
      ["Ne menjaj veče. Ako se spontano probudiš, ujutru se priseti toka noći, bez brojanja minuta.", "Šta ti je pri buđenju bilo najprimetnije?"],
      ["Pre spavanja namesti posteljinu i svetlo kako ti prija; ostatak večeri ostavi isti.", "Ako je bilo buđenja, da li ti je prostor bio prijatan?"],
      ["Promeni samo jedan detalj udobnosti koji ti nije prijao, ili ostavi isti raspored ako jeste.", "Da li ti taj detalj više odgovara?"],
      ["Uporedi tok noći sa početkom, a zatim odvojeno svoj ukupni utisak o njoj.", "Da li buđenja i ukupan utisak opisuješ na isti način?"],
      [evening, "Kako ti je noć delovala posle drugačijeg završetka večeri?"],
      ["Ponovi prijatnije podešavanje prostora ili lakši završetak večeri, bez drugih promena.", "Koji postupak ti je jednostavnije da ponoviš?"],
      ["Pregledaj nekoliko noći zajedno; izdvoji šta ti je prijalo i šta želiš još da probaš.", "Da li jedna drugačija noć menja tvoj utisak o celoj nedelji?"],
    ],
    rhythm: [
      ["Primeti kada ležeš i ustaješ kao obično, kao i da li tog jutra ima alarma.", "Koliko se raspored razlikuje od prethodnog dana?"],
      ["Izaberi realan okvir za ustajanje prema svojim obavezama, uz dovoljno vremena za san.", "Da li je taj okvir izvodljiv bez žurbe?"],
      ["Prilagodi okvir svojim stvarnim obavezama; nemoj skraćivati san da bi ustao/la u izabrano vreme.", "Koji deo rasporeda je najteže uklopiti?"],
      ["Uporedi raspored sa prvim danom; ako je bilo dana bez alarma, razmotri ga odvojeno.", "Da li isti okvir odgovara i slobodnom danu?"],
      ["Umesto oslanjanja na jutarnji okvir, probaj večernji podsetnik za pripremu stvari za sutra.", "Da li ti je lakše da započneš pripremu uveče?"],
      ["Ponovi praktičniji izbor: okvir za ustajanje ili večernji podsetnik, bez novih promena.", "Koji izbor se lakše uklapa u tvoj dan?"],
      ["Pregledaj raspored i izvodljivost oba pristupa. Zadrži fleksibilan okvir koji ti odgovara.", "Šta možeš da ponoviš i kada je dan drugačiji?"],
    ],
    multiple: [
      ["Provedi dan kao obično; primeti završetak večeri, tok noći i jutarnji osećaj.", "Koji deo ti je bio najnaporniji, a koji manje zahtevan?"],
      [evening, "Da li ti je završetak večeri jednostavniji?"],
      ["Pomeri isti večernji postupak u trenutak kada ti je lakše da ga sprovedeš; ne dodaj drugi.", "Da li ti novi trenutak više odgovara?"],
      ["Uporedi veče, noć i jutro sa početkom. Nemoj očekivati da se sva tri promene zajedno.", "U kom delu primećuješ razliku, ako je ima?"],
      ["Vrati uobičajeno veče, a umesto toga pripremi odeću i prvu jutarnju obavezu unapred.", "Da li ti je početak jutra jednostavniji?"],
      ["Ponovi lakši izbor: večernji prelaz ili pripremu za jutro. Ostalo ostavi isto.", "Koji postupak zahteva manje truda?"],
      ["Pregledaj svaki deo odvojeno i odaberi jedan postupak za nastavak, ne novu listu promena.", "Čemu želiš da posvetiš sledeću nedelju?"],
    ],
    whole: [
      ["Zadrži uobičajenu rutinu i ujutru se priseti šta ti je tokom večeri i noći prijalo.", "Šta želiš da ostane isto?"],
      [evening, "Da li ti je ova mala izmena prijala ili bila suvišna?"],
      [value(input, "Q6") <= 2 ? "Pomeri kraj gledanja sadržaja u trenutak kada ti je lakše da napraviš pauzu pre kreveta." : "Pomeri pripremu za sutra ranije uveče i zadrži ostatak rutine koji ti već odgovara.", "Da li je novi trenutak jednostavniji?"],
      ["Uporedi ukupan utisak sa prvim danom, uključujući jutro i energiju tokom dana.", "Da li želiš da zadržiš izmenu ili svoju raniju rutinu?"],
      ["Vrati uobičajeno veče i probaj kratku mirnu pauzu tokom dana, u trenutku koji ti odgovara.", "Kako ti prija pauza u odnosu na uobičajen dan?"],
      ["Ponovi večernji postupak ili dnevnu pauzu samo ako ti je prijala; ne dodaj obe.", "Da li je postupak vredan truda u običnom danu?"],
      ["Pregledaj nedelju i zadrži ono što ti već odgovara; izmenu nastavi samo ako ti je korisna.", "Šta želiš da ponoviš, a šta da preskočiš?"],
    ],
  };
  return plans[priority.key].map(([action, observe], index) => ({ day: index + 1, action, observe }));
};

const getAlternatives = (input, priority) => {
  const thoughts = value(input, "Q7") <= 2;
  const eveningAlternative = thoughts
    ? "Ako ti prvi postupak ne odgovara, probaj pet minuta tihog čitanja van kreveta pre svoje rutine. To je drugačiji prelaz od planiranja obaveza ili prekidanja sadržaja."
    : "Ako ti prvi postupak ne odgovara, probaj kratko mirno sedenje van kreveta pre svoje rutine, bez novog sadržaja i bez obaveze da zaspiš odmah.";
  return {
    recovery: [value(input, "Q11") <= 2
      ? "Ako večernja priprema nije za tebe, posle naporne noći izaberi jednostavniji redosled jutarnjih obaveza: jednu najvažniju prvo, ostalo kasnije kada je moguće."
      : "Ako večernja priprema nije za tebe, po ustajanju prvo uradi jednu jednostavnu stvar, poput oblačenja, pre nego što pogledaš celu listu obaveza."],
    sleepOnset: [eveningAlternative],
    continuity: [thoughts
      ? "Ako podešavanje prostora nije korisno, završi planiranje sutrašnjih obaveza ranije uveče: izaberi prvi korak i zatvori papir pre svoje rutine. Uporedi doživljaj noći, ne samo buđenja."
      : "Ako podešavanje prostora nije za tebe, probaj pet minuta tihog čitanja pre odlaska u krevet. Ujutru uporedi ukupan utisak o noći, bez brojanja minuta."],
    rhythm: ["Ako ti fiksni okvir za ustajanje ne odgovara, veži početak večernje pripreme za završetak postojeće aktivnosti, umesto za sat. Na primer, posle večere pripremi stvari za sutra."],
    multiple: [thoughts
      ? value(input, "Q6") >= 3
        ? "Ako ti planiranje unapred ne odgovara, probaj pet minuta tihog čitanja van kreveta pre svoje rutine. To je drugačiji prelaz od pisanja obaveza; jutarnju pripremu tada ostavi po strani."
        : "Ako ti promena završetka večeri ne odgovara, ranije u toku dana odvoji kratak trenutak za jednu sutrašnju obavezu. Time probaj drugi pristup aktivnim mislima, bez nove večernje liste."
      : "Ako ti promene večeri i jutra ne odgovaraju, probaj kratku mirnu pauzu u toku dana. Izaberi deo dana prema svojoj energiji, ne prema novom strogom rasporedu."],
    whole: ["Ako ti nove navike deluju suvišno, nemoj ih dodavati. Izaberi postojeći deo rutine koji ti prija i daj mu mesto i tokom drugačijeg dana, bez stroge satnice."],
  }[priority.key];
};

export const buildSleepPremiumFallback = (input) => {
  const priority = getSleepPremiumPriority(input);
  const [first, second] = focusIds[priority.key];
  const rationale = {
    recovery: "Zato prvo probaj jednostavniji početak jutra, pa uporedi jutarnji osećaj sa energijom kasnije. Nema potrebe da odmah menjaš celu večernju rutinu.",
    sleepOnset: value(input, "Q6") >= 3
      ? "Već imaš miran završetak večeri. Kreni od onoga što se događa kada legneš, umesto da dodaješ nova pravila za ekrane."
      : "Kreni od kratkog prelaza između sadržaja koji gledaš i odlaska u krevet. To je konkretan postupak koji možeš da uporediš sa uobičajenim večerima.",
    continuity: "Kreni od udobnosti tokom noći i svog doživljaja buđenja. Posmatraj i celu noć, jer broj buđenja nije jedino što ti može biti važno.",
    rhythm: "Kreni od izvodljivog okvira za raspored, uz postojeće trajanje sna. Slobodan dan uporedi sa uobičajenim danom, bez skraćivanja sna.",
    multiple: "Nekoliko delova traži pažnju, pa nemoj sve menjati odjednom. Prvo probaj večernji prelaz, a zatim odvojeno jednostavniju pripremu za jutro.",
    whole: "Ovde nema potrebe da tražiš novu veliku promenu. Zadrži ono što ti već prija i uporedi dve male, različite mogućnosti sa svojom uobičajenom rutinom.",
  }[priority.key];
  const report = {
    version: 2,
    profile: input.profile,
    profile_explanation: {
      recovery: "U tvojim odgovorima najviše se izdvaja kako ti je ujutru i tokom dana. Plan počinje od tog iskustva.",
      sleepOnset: "Najviše pažnje zaslužuje prelaz iz večeri u san. Važno je i šta radiš pre kreveta i kako ti je kada legneš.",
      continuity: "Tok noći se izdvaja u tvojim odgovorima. Plan odvaja doživljaj buđenja od ukupnog utiska o noći.",
      rhythm: "Raspored zaslužuje pažnju iako drugi delovi sna mogu da ti prijaju. Plan ostavlja prostor za različite dane.",
      multiple: "Odgovori izdvajaju nekoliko zahtevnih delova noći. Plan ih razdvaja u male pokušaje, umesto da menja sve odjednom.",
      whole: "Tvoji odgovori daju prostor da sačuvaš ono što ti prija i proveriš da li je neka mala izmena uopšte korisna.",
    }[priority.key],
    priority: {
      title: "TVOJ PRIORITET #1",
      area: priority.title,
      explanation: `Za početak su važni tvoji izbori ${quote(input, first)} i ${quote(input, second)}. ${rationale}`,
    },
    connections: getConnections(input),
    stable_or_tracking: getTracking(input, priority),
    seven_day_plan: getPlan(input, priority),
    alternatives: getAlternatives(input, priority),
    review_questions: [
      "Šta se razlikovalo od početka nedelje, a šta je ostalo isto?",
      "Koji postupak ti je prijao i bio dovoljno jednostavan za običan dan?",
      "Šta želiš da nastaviš, a šta da zameniš drugim pristupom?",
    ],
    after_seven_days: "Uporedi prvi dan sa ostatkom nedelje, ne samo sa poslednjom noći. Zadrži jedan izvodljiv postupak ako ti je prijao. Ako nije, probaj ponuđeni drugi pristup naredne nedelje, umesto da dodaješ više promena odjednom. Jedna drugačija noć nije dovoljna da objasni celu nedelju.",
    closing: "Ovaj plan služi za lični osvrt na tvoje navike i iskustvo sna. Ako teškoće dugo traju i znatno utiču na svakodnevicu, razgovor sa zdravstvenim stručnjakom može biti koristan.",
  };
  const dailyRationales = [
    "Početni utisak daje ti osnovu za poređenje, bez dodavanja novih obaveza prvog dana.",
    "Jedan mali pokušaj je jednostavnije uklopiti u običan dan nego nekoliko promena odjednom.",
    "Prilagođavanje trenutka ili obima pokazuje koliko ti je isti postupak praktičan.",
    "Poređenje sa početkom ostavlja prostor i za razlike između dana, ne samo za poslednji utisak.",
    "Drugi pristup daje ti izbor ako prvi nije prijatan ili izvodljiv; ne moraš ih kombinovati.",
    "Lakši postupak je jednostavnije ponoviti bez dodavanja nove liste obaveza.",
    "Osvrt služi da izabereš šta želiš dalje da probaš, a ne da očekuješ određeni ishod.",
  ];
  report.supporting_content = {
    answer_evidence: input.answers.map(({ questionId, question, answer }) => ({ questionId, question, answer })),
    priority: {
      context: "Ovaj prvi fokus odnosi se na deo iskustva koji si opisao/la u upitniku. Počni od predloženog malog pokušaja i proceni koliko ti je prijatan i izvodljiv; ostali delovi tvog sna i dalje ostaju deo iste slike.",
      evidenceQuestionIds: [first, second],
    },
    connections: report.connections.map(({ questionIds }, connectionIndex) => ({
      connectionIndex,
      context: `U ovoj vezi zajedno čitaš svoje izbore ${quote(input, questionIds[0])} i ${quote(input, questionIds[1])}. Pri osvrtu zadrži oba iskustva u vidu, čak i kada se tvoj utisak o njima razlikuje od dana do dana.`,
    })),
    tracking: report.stable_or_tracking.items.map((_, itemIndex) => ({
      itemIndex,
      context: "Ovo je dodatno zapažanje uz glavni plan. Priseti ga se tokom običnog dana, bez nove obaveze da svako iskustvo meriš ili zapisuješ.",
    })),
    days: report.seven_day_plan.map(({ day }, index) => ({
      day,
      rationale: dailyRationales[index],
      reflection: "Da li ti je ovaj postupak bio prijatan i dovoljno jednostavan?",
    })),
    alternatives: report.alternatives.map((_, alternativeIndex) => ({
      alternativeIndex,
      context: "Ovaj pristup je ponuđen umesto prvog, ne kao dodatna obaveza. Procenjuj ga prema tome kako ti prija i uklapa li se u tvoj dan, bez očekivanja određenog ishoda.",
    })),
  };
  const validation = validateSleepPremiumReport(report, input);
  if (!validation.valid) throw new Error(`Deterministic Premium fallback failed validation: ${validation.reason}`);
  return validation.report;
};
