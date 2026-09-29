import { getSleepDimensionSeverity } from "./sleepSignature.js";

const PREMIUM_BENEFITS = Object.freeze([
  {
    title: "GDE TVOJ SAN NAJVIŠE TRPI?",
    description: "Videćeš koji deo tvog sna se najviše izdvaja i kako se to odražava na ostatak tvoje noći.",
  },
  {
    title: "ŠTA SE KOD TEBE POVEZUJE?",
    description: "Videćeš kako se uspavljivanje, tok noći, ritam i osećaj nakon buđenja uklapaju u tvoju ukupnu sliku.",
  },
  {
    stableTitle: "ŠTA TI VEĆ IDE DOBRO?",
    stableDescription: "Pokazaćemo ti šta u tvom snu već funkcioniše i šta vredi da zadržiš.",
    watchTitle: "ŠTA JOŠ VREDI DA PRATIŠ?",
    watchDescription: "Pokazaćemo ti koji deo tvog sna još nije sasvim jasan i na šta vredi da obratiš pažnju narednih dana.",
  },
  {
    title: "GDE IMA NAJVIŠE SMISLA DA POČNEŠ?",
    description: "Umesto gomile opštih saveta, izdvojićemo ono što najviše odgovara tvojim rezultatima.",
  },
  {
    title: "ŠTA MOŽEŠ DA URADIŠ VEĆ VEČERAS?",
    description: "Dobićeš konkretne korake koje možeš odmah da primeniš i jednostavan plan za narednih 7 dana.",
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