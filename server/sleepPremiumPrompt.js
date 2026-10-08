export const buildSleepPremiumPrompt = (input, enforced) => {
  const customerInput = {
    profile: input.profile,
    answers: input.answers.map(({ questionId, question, answer }) => ({ questionId, question, answer })),
  };
  const connectionExampleIds = input.answers.slice(0, 2).map(({ questionId }) => questionId);
  const connectionExample = `Validan primer strukture connections stavke: ${JSON.stringify({ questionIds: connectionExampleIds, text: "Odgovori na ova dva pitanja daju različite poglede koje vredi sagledati zajedno, bez zaključka da jedno objašnjava drugo." })}`;
  return [
    "Ti si pažljiv autor vrednog, personalizovanog informativnog izveštaja o snu, na prirodnom srpskom jeziku.",
    "Vrati isključivo JSON koji tačno odgovara strogoj JSON šemi. Bez markdown-a, uvoda ili teksta posle JSON-a.",
    "JSON je jedna stabilna, verzionisana struktura koja se koristi i za prikaz izveštaja. Ne dodaj ključeve. Koristi tačno nazive polja iz šeme.",
    `Profil je nepromenljiv i mora biti tačno: ${enforced.profile}. Prioritet je unapred izabran i mora ostati tačno „${enforced.priorityArea}“. Ne biraj alternativni prioritet, ne menjaj profil i ne izvodi ocene.`,
      `stable_or_tracking.mode je konačan: ${enforced.mode}. Zadrži i unapred propisan naslov sekcije: „${enforced.stableTitle}“. Dozvoljene stvarno mirnije oblasti su: ${enforced.stableAreas.length ? enforced.stableAreas.join(", ") : "nema"}. Kod stable navedi isključivo jednu od navedenih oblasti; kod tracking opiši samo šta je korisno da se posmatra. Nikada ne prikazuj interne nazive stanja.`,
      `profile_explanation: 1–2 lične, kratke rečenice o tome kako profil pruža okvir za odgovore ove osobe, najviše ${enforced.profileExplanationMaxLength} znakova. Citiraj bar jedan ceo izabrani odgovor doslovno. Nemoj prepisivati generički opis profila ili predstavljati profil kao dijagnozu.`,
      `priority: naslov mora biti „TVOJ PRIORITET #1“, oblast mora biti tačno „${enforced.priorityArea}“. Explanation kratko obrazlaže zašto je to dobar prvi fokus uz direktne odgovore i citira bar jedan ceo odgovor doslovno; bez uzroka i bez tvrdnji koje nisu potkrepljene.`,
    `connections: vrati 2–4 objekta, svaki tačno oblika {"questionIds": ["Qx", "Qy"], "text": "..."}. Svaki questionIds niz mora imati tačno dva različita ID-ja iz questionId polja ulaznih odgovora i oni predstavljaju dokaze za tu stavku. Polje text sadrži samo prirodan, kratak srpski opis veze između tema tih odgovora; ne mora da ponavlja ili citira tekst odgovora. U text nemoj prikazivati Q-ID oznake. Ne tvrdi uzročnost.`,
    connectionExample,
    `Za svaku connections stavku proveri da su oba ID-ja preuzeta iz ulaznih odgovora, da su međusobno različita, i da je text čitljiv korisniku bez izlaganja ID-ja. Odgovor u textu personalizuj prema izabranim stavkama, ali nema potrebe za doslovnim citatima.`,
    `stable_or_tracking.items: vrati 1–2 kratke stavke. Naslov i mode su fiksni. Ne nazovi oblast snagom ako to ne podržavaju dostavljeni odgovori i fiksni režim.`,
    "seven_day_plan: vrati tačno sedam stavki sa day vrednostima 1–7 redom. Svaki action i observe pripadaju istom unapred izabranom prioritetu. Napravi jedan postepen, koherentan mini-eksperiment: prvi dan početno zapažanje; drugi uvođenje jedne male stvari; treći ponavljanje; četvrti poređenje; peti blago prilagođavanje; šesti ponavljanje najjednostavnijeg koraka; sedmi osvrt. Svaki dan ima zaseban action i observe. Ne menjaj više stvari odjednom i ne obećavaj ishod.",
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
