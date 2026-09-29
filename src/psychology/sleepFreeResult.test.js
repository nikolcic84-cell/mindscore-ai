import assert from "node:assert/strict";
import test from "node:test";
import {
  getSleepFreeResultPresentation,
  SLEEP_FREE_PROFILE_DESCRIPTIONS,
} from "./sleepFreeResult.js";

const makeResult = (signatureKey, internalScores, answerValues = {}) => {
  const questionValues = Array(12).fill(null);
  if (answerValues.q6 !== undefined) questionValues[5] = answerValues.q6;
  if (answerValues.q12 !== undefined) questionValues[11] = answerValues.q12;
  return { signatureKey, internalScores, questionValues, strongestArea: "Oporavak" };
};

const stableCore = { recovery: 0.8, sleepOnset: 0.8, continuity: 0.8, rhythm: 0.8 };

test("all five profiles use the exact requested Free Result descriptions", () => {
  assert.deepEqual(Object.keys(SLEEP_FREE_PROFILE_DESCRIPTIONS).sort(), [
    "awake_mind",
    "calm_night",
    "fragmented_night",
    "sleep_under_pressure",
    "tired_waking",
  ]);
  assert.equal(
    SLEEP_FREE_PROFILE_DESCRIPTIONS.calm_night,
    "Tvoj san pokazuje prilično skladan obrazac. Većina signala ide u dobrom smeru — ali detalji u tvojim odgovorima otkrivaju šta najviše doprinosi toj stabilnosti i gde ipak postoje male promene."
  );
  assert.equal(
    SLEEP_FREE_PROFILE_DESCRIPTIONS.tired_waking,
    "Spavanje ti ne donosi uvek onaj osećaj odmora koji bi očekivao. Tvoji odgovori otkrivaju nekoliko tragova koji mogu pomoći da razumemo gde se taj osećaj oporavka gubi."
  );
  assert.equal(
    SLEEP_FREE_PROFILE_DESCRIPTIONS.awake_mind,
    "Telo je možda spremno za odmor, ali um ne prati uvek isti ritam. Tvoji odgovori otkrivaju obrasce koji mogu objasniti šta ti otežava da mirno pređeš iz budnosti u san."
  );
  assert.equal(
    SLEEP_FREE_PROFILE_DESCRIPTIONS.fragmented_night,
    "Tvoj san ne teče uvek bez prekida. Tvoji odgovori pokazuju da nije važna samo dužina sna — već i ono što se događa tokom noći i kako se to odražava na tvoj odmor."
  );
  assert.equal(
    SLEEP_FREE_PROFILE_DESCRIPTIONS.sleep_under_pressure,
    "Tvoj san šalje više različitih signala. Nijedan ne govori celu priču sam za sebe — ali kada ih povežemo, počinje da se otkriva šta zaista oblikuje tvoj san i osećaj odmora."
  );
});

test("MIRNA NOĆ with all stable dimensions gets the stable fallback", () => {
  const result = getSleepFreeResultPresentation(makeResult("calm_night", stableCore));
  assert.equal(result.insight, "Tvoji odgovori ne otkrivaju jednu izraženu slabu tačku — stabilnost se provlači kroz više delova tvog sna.");
});

test("MIRNA NOĆ can surface a secondary mixed rhythm without calling it good", () => {
  const result = getSleepFreeResultPresentation(makeResult("calm_night", { ...stableCore, rhythm: 0.6 }));
  assert.equal(result.insight, "Tvoj san možda nema jednu veliku prepreku, ali vreme i ritam spavanja nisu uvek potpuno predvidljivi.");
  assert.doesNotMatch(result.insight, /dobro|dobra|stabilno|stabilna/i);
});

test("UMORAN SAN recovery weakness uses the specific onset-stable contrast", () => {
  const result = getSleepFreeResultPresentation(makeResult("tired_waking", { recovery: 0.4, sleepOnset: 0.8, continuity: 0.6, rhythm: 0.8 }));
  assert.equal(result.insight, "Čini se da kod tebe veći izazov nije zaspati — već kako se osećaš nakon sna.");
});

test("BUDAN UM onset weakness uses the specific recovery-stable contrast", () => {
  const result = getSleepFreeResultPresentation(makeResult("awake_mind", { recovery: 0.8, sleepOnset: 0.4, continuity: 0.6, rhythm: 0.8 }));
  assert.equal(result.insight, "Kada san konačno dođe, slika izgleda bolje — najveća prepreka pojavljuje se pre toga.");
});

test("ISPREKIDAN SAN continuity weakness is contrasted with stable onset", () => {
  const result = getSleepFreeResultPresentation(makeResult("fragmented_night", { recovery: 0.6, sleepOnset: 0.8, continuity: 0.4, rhythm: 0.8 }));
  assert.equal(result.insight, "Zaspati ti možda nije najveći problem — veći izazov je zadržati miran san tokom noći.");
});

test("SAN POD PRITISKOM with two weak core dimensions gets the pair insight", () => {
  const cases = [
    {
      scores: { recovery: 0.4, sleepOnset: 0.8, continuity: 0.4, rhythm: 0.8 },
      insight: "Ono što se događa tokom noći prati i slabiji osećaj odmora kada se probudiš.",
    },
    {
      scores: { recovery: 0.8, sleepOnset: 0.4, continuity: 0.4, rhythm: 0.8 },
      insight: "Kod tebe se priča ne završava uspavljivanjem — signali se pojavljuju i tokom same noći.",
    },
    {
      scores: { recovery: 0.4, sleepOnset: 0.4, continuity: 0.8, rhythm: 0.8 },
      insight: "Teži ulazak u san prati i slabiji osećaj odmora nakon buđenja.",
    },
  ];
  for (const { scores, insight } of cases) {
    const result = getSleepFreeResultPresentation(makeResult("sleep_under_pressure", scores, { q6: 0, q12: 0 }));
    assert.equal(result.insight, insight);
  }
});

test("SAN POD PRITISKOM with three weak core dimensions gets neutral combined copy", () => {
  const result = getSleepFreeResultPresentation(makeResult("sleep_under_pressure", { recovery: 0.4, sleepOnset: 0.4, continuity: 0.4, rhythm: 0.8 }, { q6: 0, q12: 0 }));
  assert.equal(result.insight, "Ne izdvaja se samo jedan trenutak sna — nekoliko delova tvog obrasca zajedno utiče na to kako doživljavaš odmor.");
});

test("mapped strong-negative Q6 is selected after checking for multiple weak core areas", () => {
  const result = getSleepFreeResultPresentation(makeResult(
    "sleep_under_pressure",
    { recovery: 0.75, sleepOnset: 0.6667, continuity: 0.75, rhythm: 0.8 },
    { q6: 1 }
  ));
  assert.equal(result.insight, "Jedan deo tvoje priče o snu počinje još pre nego što zaspiš — tvojim mislima nije uvek lako da se utišaju.");
});

test("mapped strong-negative Q12 can be read from its existing supporting signal", () => {
  const result = makeResult("sleep_under_pressure", { recovery: 0.8, sleepOnset: 0.8, continuity: 0.625, rhythm: 0.8 });
  delete result.questionValues[11];
  result.supportingSignals = [{ question: 12, internalScore: 1 }];
  assert.equal(
    getSleepFreeResultPresentation(result).insight,
    "Iako neki delovi tvog sna mogu delovati mirno, jedan signal pokazuje da sama noć nije uvek tako stabilna."
  );
});

test("mixed rhythm is secondary when every core dimension is strictly higher", () => {
  const result = getSleepFreeResultPresentation(makeResult("calm_night", { recovery: 0.8, sleepOnset: 0.75, continuity: 0.8, rhythm: 0.6 }));
  assert.equal(result.insight, "Tvoj san možda nema jednu veliku prepreku, ali vreme i ritam spavanja nisu uvek potpuno predvidljivi.");
});

test("weak rhythm remains secondary when all core dimensions are better", () => {
  const result = getSleepFreeResultPresentation(makeResult("calm_night", { recovery: 0.8, sleepOnset: 0.75, continuity: 0.8, rhythm: 0.4 }));
  assert.equal(result.insight, "Tvoj san možda nema jednu veliku prepreku, ali vreme i ritam spavanja nisu uvek potpuno predvidljivi.");
});

test("single weak core dimensions use their dedicated insight when no contrast applies", () => {
  const cases = [
    ["tired_waking", { recovery: 0.4, sleepOnset: 0.6, continuity: 0.6, rhythm: 0.8 }, "Najjasniji signal pojavljuje se nakon sna — tvoje telo ne doživljava svako jutro kao pravi novi početak."],
    ["awake_mind", { recovery: 0.6, sleepOnset: 0.4, continuity: 0.6, rhythm: 0.8 }, "Najviše se izdvaja trenutak pre sna — prelazak iz budnosti u odmor kod tebe nije uvek jednostavan."],
    ["fragmented_night", { recovery: 0.6, sleepOnset: 0.6, continuity: 0.4, rhythm: 0.8 }, "Kod tebe se najviše izdvaja ono što se događa nakon što zaspiš — san ne ostaje uvek jednako miran."],
  ];
  for (const [profile, scores, insight] of cases) {
    assert.equal(getSleepFreeResultPresentation(makeResult(profile, scores)).insight, insight);
  }
});

test("tied mixed dimensions use neutral fallback rather than choosing a winner", () => {
  const result = getSleepFreeResultPresentation(makeResult("sleep_under_pressure", { recovery: 0.6, sleepOnset: 0.6, continuity: 0.6, rhythm: 0.6 }));
  assert.equal(result.insight, "Veći deo slike deluje prilično stabilno, ali nekoliko detalja pokazuje da tvoj obrazac nije potpuno isti iz noći u noć.");
  assert.doesNotMatch(result.insight, /oporavak|uspavljivanje|kontinuitet|ritam/i);
});

test("personalized copy does not use the numerical strongest area as positive evidence", () => {
  const result = makeResult("sleep_under_pressure", { recovery: 0.6, sleepOnset: 0.6, continuity: 0.6, rhythm: 0.6 });
  const baseline = getSleepFreeResultPresentation(result);
  result.strongestArea = "Ritam sna";
  result.strongestAreas = ["Ritam sna"];
  assert.deepEqual(getSleepFreeResultPresentation(result), baseline);
  assert.doesNotMatch(baseline.insight, /dobra strana|najjača|dobro ti ide/i);
});

test("missing or invalid dimension scores do not invent an insight", () => {
  assert.equal(getSleepFreeResultPresentation(null), null);
  assert.equal(getSleepFreeResultPresentation({ signatureKey: "calm_night", internalScores: { recovery: 0.8 } }), null);
});