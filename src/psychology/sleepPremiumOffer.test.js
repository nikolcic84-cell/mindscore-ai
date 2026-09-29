import assert from "node:assert/strict";
import test from "node:test";
import {
  formatConfiguredEurPrice,
  getSleepPremiumBenefits,
  hasStableSleepArea,
} from "./sleepPremiumOffer.js";

const titles = (benefits) => benefits.map(({ title }) => title);

test("Premium offer shows the five requested locked benefits", () => {
  const benefits = getSleepPremiumBenefits({
    internalScores: { recovery: 0.7, sleepOnset: 0.6, continuity: 0.5, rhythm: 0.4 },
  });
  assert.equal(benefits.length, 5);
  assert.deepEqual(titles(benefits), [
    "GDE TVOJ SAN NAJVIŠE TRPI?",
    "ŠTA SE KOD TEBE POVEZUJE?",
    "ŠTA TI VEĆ IDE DOBRO?",
    "GDE IMA NAJVIŠE SMISLA DA POČNEŠ?",
    "ŠTA MOŽEŠ DA URADIŠ VEĆ VEČERAS?",
  ]);
  assert.deepEqual(benefits.map(({ description }) => description), [
    "Videćeš koji deo tvog sna se najviše izdvaja i kako se to odražava na ostatak tvoje noći.",
    "Videćeš kako se uspavljivanje, tok noći, ritam i osećaj nakon buđenja uklapaju u tvoju ukupnu sliku.",
    "Pokazaćemo ti šta u tvom snu već funkcioniše i šta vredi da zadržiš.",
    "Umesto gomile opštih saveta, izdvojićemo ono što najviše odgovara tvojim rezultatima.",
    "Dobićeš konkretne korake koje možeš odmah da primeniš i jednostavan plan za narednih 7 dana.",
  ]);
});

test("stable-area version appears only when existing results contain a STABLE area", () => {
  const stableResults = [
    { recovery: 0.7, sleepOnset: 0.6, continuity: 0.5, rhythm: 0.4 },
    { recovery: 0.5, sleepOnset: 0.7, continuity: 0.5, rhythm: 0.4 },
    { recovery: 0.5, sleepOnset: 0.4, continuity: 0.5, rhythm: 0.7 },
  ];
  for (const internalScores of stableResults) {
    assert.equal(hasStableSleepArea({ internalScores }), true);
    assert.equal(titles(getSleepPremiumBenefits({ internalScores }))[2], "ŠTA TI VEĆ IDE DOBRO?");
  }
});

test("no-STABLE results use the observation fallback rather than inventing a strength", () => {
  const noStableResults = [
    { recovery: 0.699999, sleepOnset: 0.6, continuity: 0.55, rhythm: 0.45 },
    { recovery: 0.45, sleepOnset: 0.69, continuity: 0.6, rhythm: 0.3 },
    undefined,
    {},
  ];
  for (const internalScores of noStableResults) {
    const result = internalScores ? { internalScores } : null;
    assert.equal(hasStableSleepArea(result), false);
    assert.equal(titles(getSleepPremiumBenefits(result))[2], "ŠTA JOŠ VREDI DA PRATIŠ?");
    assert.equal(
      getSleepPremiumBenefits(result)[2].description,
      "Pokazaćemo ti koji deo tvog sna još nije sasvim jasan i na šta vredi da obratiš pažnju narednih dana."
    );
  }
});

test("euro display is formatted from the configured price value", () => {
  assert.equal(formatConfiguredEurPrice("4.99"), "4,99 €");
  assert.equal(formatConfiguredEurPrice("7.5"), "7,50 €");
  assert.equal(formatConfiguredEurPrice("invalid"), "");
});