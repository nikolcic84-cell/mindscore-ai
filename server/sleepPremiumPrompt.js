export const buildSleepPremiumPrompt = (input, enforced) => {
  const customerInput = {
    profile: input.profile,
    answers: input.answers.map(({ questionId, question, answer }) => ({ questionId, question, answer })),
  };
  const profileExampleAnswer = input.answers[0].answer;
  const profileExplanationExample = `Primer obaveznog citata u profile_explanation: Tvoj odgovor „${profileExampleAnswer}“ daje konkretan lični oslonac za tumačenje profila.`;
  const connectionExampleIds = input.answers.slice(0, 2).map(({ questionId }) => questionId);
  const connectionExample = `Validan primer strukture connections stavke: ${JSON.stringify({ questionIds: connectionExampleIds, text: "Odgovori na ova dva pitanja daju različite poglede koje vredi sagledati zajedno, bez zaključka da jedno objašnjava drugo." })}`;
  const planExampleSteps = [
    ["zabeleži početni utisak o ovoj temi, bez promene rutine", "primeti kako ova tema izgleda uobičajenog dana"],
    ["isprobaj jedan mali korak samo u okviru ove teme", "primeti šta se dešava tokom ili posle tog koraka u istoj temi"],
    ["ponovi mali korak u okviru iste teme", "primeti šta ti je u vezi s ovom temom bilo lako ili teško"],
    ["uporedi iskustvo iz ove teme sa početnim utiskom", "primeti šta je u vezi s istom temom slično ili različito"],
    ["napravi samo malu izmenu koraka unutar iste teme", "primeti kako se ta izmena odnosi na istu temu"],
    ["ponovi najjednostavniji korak vezan za ovu temu", "primeti šta se događa u okviru ove teme pri ponavljanju"],
    ["pregledaj beleške i utiske o ovoj temi", "izdvoji šta si primetio/la baš o ovoj temi tokom sedam dana"],
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
      `priority: naslov mora biti „TVOJ PRIORITET #1“, oblast mora biti tačno „${enforced.priorityArea}“. Explanation kratko obrazlaže zašto je to dobar prvi fokus uz direktne odgovore i citira bar jedan ceo odgovor doslovno; bez uzroka i bez tvrdnji koje nisu potkrepljene.`,
    `connections: vrati 2–4 objekta, svaki tačno oblika {"questionIds": ["Qx", "Qy"], "text": "..."}. Svaki questionIds niz mora imati tačno dva različita ID-ja iz questionId polja ulaznih odgovora i oni predstavljaju dokaze za tu stavku. Polje text sadrži samo prirodan, kratak srpski opis veze između tema tih odgovora; ne mora da ponavlja ili citira tekst odgovora. U text nemoj prikazivati Q-ID oznake. Ne tvrdi uzročnost.`,
    connectionExample,
    `Za svaku connections stavku proveri da su oba ID-ja preuzeta iz ulaznih odgovora, da su međusobno različita, i da je text čitljiv korisniku bez izlaganja ID-ja. Odgovor u textu personalizuj prema izabranim stavkama, ali nema potrebe za doslovnim citatima.`,
    `stable_or_tracking.items: vrati 1–2 kratke stavke. Naslov i mode su fiksni. Ne nazovi oblast snagom ako to ne podržavaju dostavljeni odgovori i fiksni režim.`,
    `seven_day_plan: vrati TAČNO sedam objekata redom sa day vrednostima 1–7 i tačno postojećim poljima day, action i observe. Za SVAKI dan, i action i observe moraju izričito da uključe naziv fiksnog prioriteta „${enforced.priorityArea}“ ili njegov jasan prirodan opis koji ostaje prepoznatljiv kao ista tema. Action je konkretan mali korak unutar te teme. Observe govori šta da primeti baš u vezi sa tom temom i tim dnevnim korakom. Ne prelazi na druge oblasti sna i ne piši generičke dane čija je veza sa prioritetom samo podrazumevana. Zadrži progresiju: dan 1 početno zapažanje; dan 2 uvedi mali korak unutar prioriteta; dan 3 ponovi u istoj temi; dan 4 uporedi; dan 5 blago prilagodi korak u istoj temi; dan 6 ponovi održiv korak; dan 7 pregledaj zapažanja o istoj temi. Ne menjaj više stvari odjednom i ne obećavaj ishod.`,
    planFocusExample,
    "alternatives: vrati 1–2 praktične alternativne načine rada na istom prioritetu, ne nepovezane generičke savete.",
    "review_questions: vrati TAČNO tri kratka pitanja za lični osvrt posle plana. Pitanja su različita i vezana za isti prioritet.",
      "after_seven_days: kratak, personalizovan predlog kako uporediti zapažanja sa početnim utiskom, bez zaključka da je nešto uzrokovalo promenu.",
    "closing: kratka, smirena wellness napomena, ne dijagnoza. Možeš reći da razgovor sa zdravstvenim stručnjakom može biti koristan ako teškoće dugo traju i znatno utiču na svakodnevicu. Bez alarmiranja.",
    "Ako koristiš navodnike za answer u drugim sekcijama, citiraj samo ceo tekst kopiran iz ulaza. U connections se oslanjaj na questionIds i prirodan opis; ne stavljaj ID-jeve u tekst namenjen korisniku. Ne izmišljaj životne okolnosti, navike, osećanja ili činjenice.",
    "Zabranjeno u svim customer-facing tekstovima: dijagnoze i medicinske tvrdnje; pripisivanje uzroka; tvrdnje da nešto sigurno poboljšava, popravlja, leči, reguliše ili rešava san; lekovi ili terapija; ocene, brojevi, procenti i pragovi; interni/tehnički/AI izrazi; obećanja i zastrašivanje.",
    "Piši jasno, toplo i sažeto na srpskom. Obraćaj se direktno osobi, predlaži bez naređivanja, ne ponavljaj iste savete u svakoj sekciji. Personalizacija mora proizaći iz dostavljenih odgovora.",
    `Fiksni podaci: ${JSON.stringify({ profile: enforced.profile, priorityArea: enforced.priorityArea, mode: enforced.mode, stableTitle: enforced.stableTitle })}`,
    `Lični odgovori: ${JSON.stringify(customerInput)}`,
  ].join("\n");
};
