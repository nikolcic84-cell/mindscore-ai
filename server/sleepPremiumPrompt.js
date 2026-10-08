export const buildSleepPremiumPrompt = (input, enforced) => {
  const customerInput = {
    profile: input.profile,
    answers: input.answers.map(({ questionId, question, answer }) => ({ questionId, question, answer })),
  };
  const priorityEvidenceQuestionIds = {
    "Osećaj po buđenju": ["Q1", "Q8"],
    "Period pre sna": ["Q2", "Q6"],
    "Tok noći": ["Q3", "Q12"],
    "Vreme spavanja i buđenja": ["Q5", "Q10"],
    "Više delova tvoje noći": ["Q1", "Q3"],
    "Tvoj san u celini": ["Q1", "Q12"],
  }[enforced.priorityArea] || [];
  const priorityEvidence = input.answers
    .filter(({ questionId }) => priorityEvidenceQuestionIds.includes(questionId))
    .map(({ questionId, answer }) => ({ questionId, answer }));
  const priorityEvidenceAnswer = priorityEvidence[0]?.answer || input.answers[0].answer;
  const priorityExplanationExample = `Primer za priority.explanation uz isti prioritet „${enforced.priorityArea}“: Tema ${enforced.priorityArea} je smislen prvi fokus za razmatranje. Tvoj odgovor „${priorityEvidenceAnswer}“ daje konkretan lični kontekst.`;
  const profileExampleAnswer = input.answers[0].answer;
  const profileExplanationExample = `Primer obaveznog citata u profile_explanation: Tvoj odgovor „${profileExampleAnswer}“ daje konkretan lični oslonac za tumačenje profila.`;
  const connectionExampleIds = input.answers.slice(0, 2).map(({ questionId }) => questionId);
  const connectionExample = `Validan primer strukture connections stavke: ${JSON.stringify({ questionIds: connectionExampleIds, text: "Odgovori na ova dva pitanja daju različite poglede koje vredi sagledati zajedno, bez zaključka da jedno objašnjava drugo." })}`;
  const planExampleSteps = [
    ["zabeleži početni utisak o ovoj temi, bez promene rutine", "obrati pažnju na to kako doživljavaš ovu temu uobičajenog dana"],
    ["probaj jedan mali korak samo u okviru ove teme", "zabeleži šta primećuješ tokom ili posle tog koraka u istoj temi"],
    ["ponovi mali korak u okviru iste teme", "vidi kako ti odgovara taj korak u istoj temi"],
    ["uporedi iskustvo iz ove teme sa početnim utiskom", "uporedi kako se osećaš u vezi sa istom temom"],
    ["probaj malu izmenu koraka unutar iste teme", "obrati pažnju na to šta primećuješ posle te izmene u istoj temi"],
    ["ponovi najjednostavniji korak vezan za ovu temu", "zabeleži šta se događa u okviru ove teme pri ponavljanju"],
    ["pregledaj beleške i utiske o ovoj temi", "vidi šta si primetio/la baš o ovoj temi tokom sedam dana"],
  ];
  const planFocusExample = `Primer koherentnog napredovanja za stvarni prioritet „${enforced.priorityArea}“ (samo primer strukture): ${JSON.stringify({ seven_day_plan: planExampleSteps.map(([action, observe], index) => ({ day: index + 1, action: `Za prioritet „${enforced.priorityArea}“: ${action}.`, observe: `U vezi sa prioritetom „${enforced.priorityArea}“: ${observe}.` })) })}. Za stvarni izveštaj napiši personalizovane, bezbedne predloge, ali zadrži ovu doslednu vezu sa prioritetom u SVAKOM action i observe polju.`;
  return [
    "Ti si pažljiv autor vrednog, personalizovanog informativnog izveštaja o snu, na prirodnom srpskom jeziku.",
    "Vrati isključivo JSON koji tačno odgovara strogoj JSON šemi. Bez markdown-a, uvoda ili teksta posle JSON-a.",
    "JSON je jedna stabilna, verzionisana struktura koja se koristi i za prikaz izveštaja. Ne dodaj ključeve. Koristi tačno nazive polja iz šeme.",
    `Profil je nepromenljiv i mora biti tačno: ${enforced.profile}. Prioritet je unapred izabran i mora ostati tačno „${enforced.priorityArea}“. Ne biraj alternativni prioritet, ne menjaj profil i ne izvodi ocene.`,
      `stable_or_tracking.mode je konačan: ${enforced.mode}. Zadrži i unapred propisan naslov sekcije: „${enforced.stableTitle}“. Dozvoljene stvarno mirnije oblasti su: ${enforced.stableAreas.length ? enforced.stableAreas.join(", ") : "nema"}. Kod stable navedi isključivo jednu od navedenih oblasti; kod tracking opiši samo šta je korisno da se posmatra. Nikada ne prikazuj interne nazive stanja.`,
    `profile_explanation: 1–2 lične, kratke rečenice o tome kako profil pruža okvir za odgovore ove osobe, najviše ${enforced.profileExplanationMaxLength} znakova. OBAVEZNO uključi najmanje jedan ceo answer iz trenutnih 12 odgovora, kopiran VERBATIM, potpuno identično znak po znak, unutar srpskih navodnika „…“. Nemoj parafrazirati citirani odgovor; pre slanja proveri da se tekst između navodnika tačno poklapa sa nekim ulaznim answer poljem. Nemoj prepisivati generički opis profila ili predstavljati profil kao dijagnozu.`,
    profileExplanationExample,
    `priority: title mora biti tačno „TVOJ PRIORITET #1“, area tačno „${enforced.priorityArea}“. Explanation mora jasno obrazložiti ZAŠTO JE UPRAVO OVAJ FIKSNI PRIORITET smislen prvi fokus; ne menjaj ga. OBAVEZNO uključi najmanje jedan relevantan selected answer iz liste DOKAZI ZA OVAJ PRIORITET ispod, kopiran VERBATIM iz ulaznog answer polja i stavljen unutar srpskih navodnika „…“. KADA JE POTREBAN DOKAZ, KOPIRAJ selected answer TAČNO. Ne prevodi, ne skraćuj, ne normalizuj, ne sažimaj i ne parafraziraj citirani odgovor; sačuvaj svaki znak, interpunkciju i dijakritik. Izaberi tekst direktno iz liste, nemoj ga ponovo sastavljati iz sećanja. Proveri pre slanja da se ceo tekst između navodnika poklapa znak po znak sa jednim answer stringom iz liste. Tekst oko citata neka jednostavno i prirodno obrazloži fiksni prioritet, bez medicinske tvrdnje, dijagnoze ili uzročnog objašnjenja.`,
    `DOKAZI ZA OVAJ PRIORITET (kopiraj answer string doslovno): ${JSON.stringify(priorityEvidence)}`,
    priorityExplanationExample,
    `connections: vrati 2–4 objekta, svaki tačno oblika {"questionIds": ["Qx", "Qy"], "text": "..."}. Svaki questionIds niz mora imati tačno dva različita ID-ja iz questionId polja ulaznih odgovora i oni predstavljaju dokaze za tu stavku. Polje text sadrži samo prirodan, kratak srpski opis veze između tema tih odgovora; ne mora da ponavlja ili citira tekst odgovora. U text nemoj prikazivati Q-ID oznake. Ne tvrdi uzročnost.`,
    connectionExample,
    `Za svaku connections stavku proveri da su oba ID-ja preuzeta iz ulaznih odgovora, da su međusobno različita, i da je text čitljiv korisniku bez izlaganja ID-ja. Odgovor u textu personalizuj prema izabranim stavkama, ali nema potrebe za doslovnim citatima.`,
    `stable_or_tracking.items: vrati 1–2 kratke stavke. Naslov i mode su fiksni. Ne nazovi oblast snagom ako to ne podržavaju dostavljeni odgovori i fiksni režim.`,
    `seven_day_plan: vrati TAČNO sedam objekata redom sa day vrednostima 1–7 i tačno postojećim poljima day, action i observe. Za SVAKI dan, i action i observe moraju izričito da uključe naziv fiksnog prioriteta „${enforced.priorityArea}“ ili njegov jasan prirodan opis koji ostaje prepoznatljiv kao ista tema. Action je konkretan mali, praktičan korak unutar te teme. Observe govori šta da primeti baš u vezi sa tom temom i tim dnevnim korakom. U svih 14 tekstova koristi jednostavan svakodnevni srpski i istraživački ton, npr. „probaj“, „obrati pažnju“, „zabeleži“, „vidi kako ti odgovara“, „uporedi kako se osećaš“. Svaki action i observe mora biti ne-medicinski; bez dijagnoza, simptoma kao dokaza, tretmana, lekova ili terapijskih uputstava; bez uzročnih tvrdnji; bez internih/tehničkih izraza kao scoring, dimensions, thresholds, classifier, WEAK, STABLE, MIXED ili AI confidence; bez cifara/rezultata; i bez obećanja da nešto poboljša, popravi, reši, reguliše, vrati ili izazove bolji san. Ova ograničenja važe za SVAKU pojedinačnu stavku, ne samo za plan u celini. Ne prelazi na druge oblasti sna i ne piši generičke dane čija je veza sa prioritetom samo podrazumevana. Zadrži progresiju: dan 1 početno zapažanje; dan 2 uvedi mali korak unutar prioriteta; dan 3 ponovi u istoj temi; dan 4 uporedi; dan 5 blago prilagodi korak u istoj temi; dan 6 ponovi održiv korak; dan 7 pregledaj zapažanja o istoj temi. Ne menjaj više stvari odjednom i ne obećavaj ishod.`,
    planFocusExample,
    "alternatives: vrati 1–2 praktične alternativne načine rada na istom prioritetu, ne nepovezane generičke savete.",
    "review_questions: vrati TAČNO tri kratka pitanja za lični osvrt posle plana. Pitanja su različita i vezana za isti prioritet.",
      "after_seven_days: kratak, personalizovan predlog kako uporediti zapažanja sa početnim utiskom, bez zaključka da je nešto uzrokovalo promenu.",
    "closing: kratka, smirena wellness napomena, ne dijagnoza. Možeš reći da razgovor sa zdravstvenim stručnjakom može biti koristan ako teškoće dugo traju i znatno utiču na svakodnevicu. Bez alarmiranja.",
    "Kada bilo koje polje zahteva answer kao dokaz, KOPIRAJ selected answer TAČNO. Ne prevodi, ne skraćuj, ne normalizuj, ne sažimaj i ne parafraziraj ga. Profil i priority explanation moraju sadržati ceo verbatim answer u srpskim navodnicima. U connections se oslanjaj na questionIds i prirodan opis; ne stavljaj ID-jeve u tekst namenjen korisniku. Ne izmišljaj životne okolnosti, navike, osećanja ili činjenice.",
    "Zabranjeno u svim customer-facing tekstovima: dijagnoze i medicinske tvrdnje; pripisivanje uzroka; tvrdnje da nešto sigurno poboljšava, popravlja, leči, reguliše ili rešava san; lekovi ili terapija; ocene, brojevi, procenti i pragovi; interni/tehnički/AI izrazi; obećanja i zastrašivanje.",
    "Piši jasno, toplo i sažeto na srpskom. Obraćaj se direktno osobi, predlaži bez naređivanja, ne ponavljaj iste savete u svakoj sekciji. Personalizacija mora proizaći iz dostavljenih odgovora.",
    `Fiksni podaci: ${JSON.stringify({ profile: enforced.profile, priorityArea: enforced.priorityArea, mode: enforced.mode, stableTitle: enforced.stableTitle })}`,
    `Lični odgovori: ${JSON.stringify(customerInput)}`,
  ].join("\n");
};
