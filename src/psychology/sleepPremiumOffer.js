import { getSleepDimensionSeverity } from "./sleepSignature.js";

const PREMIUM_BENEFITS = Object.freeze([
  {
    title: "TVOJ PRIORITET #1",
    description: "Na osnovu svih 12 odgovora pokazaćemo ti gde kod tebe ima najviše smisla da počneš.",
  },
  {
    title: "KAKO SE TVOJIH 12 ODGOVORA POVEZUJE",
    description: "Videćeš kako se uspavljivanje, tok noći, ritam i osećaj nakon buđenja uklapaju u tvoju ukupnu sliku.",
  },
  {
    stableTitle: "ŠTA VREDI DA ZADRŽIŠ",
    stableDescription: "Pokazaćemo ti šta u tvom snu već funkcioniše i šta nema potrebe da menjaš.",
    watchTitle: "ŠTA JOŠ VREDI DA PRATIŠ",
    watchDescription: "Pokazaćemo ti šta još nije sasvim jasno i na šta vredi da obratiš pažnju narednih dana.",
  },
  {
    title: "TVOJ LIČNI PLAN ZA 7 DANA",
    description: "Dobićeš konkretan i jednostavan korak za svaki dan, prilagođen tvojim odgovorima.",
  },
  {
    title: "AKO PRVI KORAK NE POMOGNE",
    description: "Dobićeš sledeći korak koji ima smisla da probaš, bez menjanja svega odjednom.",
  },
  {
    title: "TVOJ PDF PLAN",
    description: "Sačuvaj svoj rezultat, objašnjenje i plan za narednih 7 dana.",
  },
]);

const DIMENSION_KEYS = ["recovery", "sleepOnset", "continuity", "rhythm"];

export function hasStableSleepArea(signatureResult) {
  const scores = signatureResult?.internalScores;
  return Boolean(
    scores &&
    DIMENSION_KEYS.some((key) => Number.isFinite(scores[key]) && getSleepDimensionSeverity(scores[key]) === "stable")
  );
}

export function getSleepPremiumBenefits(signatureResult) {
  const hasStableArea = hasStableSleepArea(signatureResult);
  return PREMIUM_BENEFITS.map((benefit) => {
    if (benefit.stableTitle) {
      return {
        title: hasStableArea ? benefit.stableTitle : benefit.watchTitle,
        description: hasStableArea ? benefit.stableDescription : benefit.watchDescription,
      };
    }
    return { title: benefit.title, description: benefit.description };
  });
}

export function formatConfiguredEurPrice(price) {
  const amount = Number(price);
  if (!Number.isFinite(amount) || amount < 0) return "";
  return `${new Intl.NumberFormat("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)} €`;
}