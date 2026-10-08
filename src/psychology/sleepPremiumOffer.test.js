import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  formatConfiguredEurPrice,
  getSleepPremiumBenefits,
  hasStableSleepArea,
} from "./sleepPremiumOffer.js";

const titles = (benefits) => benefits.map(({ title }) => title);

test("Premium offer shows all six requested priority and strategy benefits", () => {
  const benefits = getSleepPremiumBenefits({
    internalScores: { recovery: 0.7, sleepOnset: 0.6, continuity: 0.5, rhythm: 0.4 },
  });
  assert.equal(benefits.length, 6);
  assert.deepEqual(titles(benefits), [
    "TVOJ PRIORITET #1",
    "KAKO SE TVOJIH 12 ODGOVORA POVEZUJE",
    "ŠTA VREDI DA ZADRŽIŠ",
    "TVOJ LIČNI PLAN ZA 7 DANA",
    "AKO PRVI KORAK NE POMOGNE",
    "TVOJ PDF PLAN",
  ]);
  assert.deepEqual(benefits.map(({ description }) => description), [
    "Na osnovu svih 12 odgovora pokazaćemo ti gde kod tebe ima najviše smisla da počneš.",
    "Videćeš kako se uspavljivanje, tok noći, ritam i osećaj nakon buđenja uklapaju u tvoju ukupnu sliku.",
    "Pokazaćemo ti šta u tvom snu već funkcioniše i šta nema potrebe da menjaš.",
    "Dobićeš konkretan i jednostavan korak za svaki dan, prilagođen tvojim odgovorima.",
    "Dobićeš sledeći korak koji ima smisla da probaš, bez menjanja svega odjednom.",
    "Sačuvaj svoj rezultat, objašnjenje i plan za narednih 7 dana.",
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
    const conditionalBenefit = getSleepPremiumBenefits({ internalScores })[2];
    assert.equal(conditionalBenefit.title, "ŠTA VREDI DA ZADRŽIŠ");
    assert.equal(conditionalBenefit.description, "Pokazaćemo ti šta u tvom snu već funkcioniše i šta nema potrebe da menjaš.");
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
    assert.equal(titles(getSleepPremiumBenefits(result))[2], "ŠTA JOŠ VREDI DA PRATIŠ");
    assert.equal(
      getSleepPremiumBenefits(result)[2].description,
      "Pokazaćemo ti šta još nije sasvim jasno i na šta vredi da obratiš pažnju narednih dana."
    );
  }
});

test("euro display is formatted from the configured price value", () => {
  assert.equal(formatConfiguredEurPrice("9.99"), "9,99 €");
  assert.equal(formatConfiguredEurPrice("7.5"), "7,50 €");
  assert.equal(formatConfiguredEurPrice("invalid"), "");
});

test("paywall hook, display price, supporting line, and CTA match requested offer copy", () => {
  const app = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
  assert.match(app, /const PREMIUM_PRICE_EUR = "9\.99"/);
  assert.match(app, /const SLEEP_PREMIUM_DISPLAY_PRICE_EUR = "9\.99"/);
  assert.match(app, /Ne moraš da menjaš sve\.<br \/>Važno je da znaš šta prvo ima smisla da probaš\./);
  assert.match(app, /Lično objašnjenje · prioritet #1 · plan za 7 dana · PDF za čuvanje/);
  assert.match(app, /OTKLJUČAJ MOJ DETALJNI REZULTAT →/);
  assert.equal(formatConfiguredEurPrice("9.99"), "9,99 €");
});

test("compact Premium cards keep a narrow-screen responsive grid", () => {
  const css = readFileSync(new URL("../App.css", import.meta.url), "utf8");
  assert.match(css, /\.sleep-discovery-card\s*\{[^}]*grid-template-columns:\s*28px minmax\(0, 1fr\) 46px/s);
  assert.match(css, /\.sleep-discovery-card h2\s*\{\s*font-size:\s*0\.78rem/s);
  assert.match(css, /\.sleep-discovery-card p\s*\{\s*font-size:\s*0\.69rem/s);
  assert.match(css, /@media\s*\(max-width:\s*760px\)/);
});

test("no-STABLE version uses the requested watch copy without asserting a strength", () => {
  const benefit = getSleepPremiumBenefits({
    internalScores: { recovery: 0.69, sleepOnset: 0.6, continuity: 0.55, rhythm: 0.45 },
  })[2];
  assert.deepEqual(benefit, {
    title: "ŠTA JOŠ VREDI DA PRATIŠ",
    description: "Pokazaćemo ti šta još nije sasvim jasno i na šta vredi da obratiš pažnju narednih dana.",
  });
});

test("paywall uses the requested hook, display-only price, supporting line, and CTA", () => {
  const app = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
  assert.match(app, /const SLEEP_PREMIUM_DISPLAY_PRICE_EUR = "9\.99"/);
  assert.match(app, /Ne moraš da menjaš sve\.<br \/>Važno je da znaš šta prvo ima smisla da probaš\./);
  assert.match(app, /Lično objašnjenje · prioritet #1 · plan za 7 dana · PDF za čuvanje/);
  assert.match(app, /OTKLJUČAJ MOJ DETALJNI REZULTAT →/);

  const server = readFileSync(new URL("../../server/server.js", import.meta.url), "utf8");
  assert.match(server, /unit_amount:\s*999/);
});