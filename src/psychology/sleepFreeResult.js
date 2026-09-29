import { getSleepDimensionSeverity } from "./sleepSignature.js";

const PROFILE_DESCRIPTIONS = Object.freeze({
  calm_night: "Tvoj san pokazuje prilično skladan obrazac. Većina signala ide u dobrom smeru — ali detalji u tvojim odgovorima otkrivaju šta najviše doprinosi toj stabilnosti i gde ipak postoje male promene.",
  tired_waking: "Spavanje ti ne donosi uvek onaj osećaj odmora koji bi očekivao. Tvoji odgovori otkrivaju nekoliko tragova koji mogu pomoći da razumemo gde se taj osećaj oporavka gubi.",
  awake_mind: "Telo je možda spremno za odmor, ali um ne prati uvek isti ritam. Tvoji odgovori otkrivaju obrasce koji mogu objasniti šta ti otežava da mirno pređeš iz budnosti u san.",
  fragmented_night: "Tvoj san ne teče uvek bez prekida. Tvoji odgovori pokazuju da nije važna samo dužina sna — već i ono što se događa tokom noći i kako se to odražava na tvoj odmor.",
  sleep_under_pressure: "Tvoj san šalje više različitih signala. Nijedan ne govori celu priču sam za sebe — ali kada ih povežemo, počinje da se otkriva šta zaista oblikuje tvoj san i osećaj odmora.",
});

const CORE_DIMENSIONS = ["recovery", "sleepOnset", "continuity"];
const ALL_DIMENSIONS = [...CORE_DIMENSIONS, "rhythm"];

const INSIGHTS = Object.freeze({
  recoveryContinuity: "Ono što se događa tokom noći prati i slabiji osećaj odmora kada se probudiš.",
  onsetContinuity: "Kod tebe se priča ne završava uspavljivanjem — signali se pojavljuju i tokom same noći.",
  onsetRecovery: "Teži ulazak u san prati i slabiji osećaj odmora nakon buđenja.",
  multipleCore: "Ne izdvaja se samo jedan trenutak sna — nekoliko delova tvog obrasca zajedno utiče na to kako doživljavaš odmor.",
  q6: "Jedan deo tvoje priče o snu počinje još pre nego što zaspiš — tvojim mislima nije uvek lako da se utišaju.",
  q12: "Iako neki delovi tvog sna mogu delovati mirno, jedan signal pokazuje da sama noć nije uvek tako stabilna.",
  recoveryWeakOnsetStable: "Čini se da kod tebe veći izazov nije zaspati — već kako se osećaš nakon sna.",
  continuityWeakOnsetStable: "Zaspati ti možda nije najveći problem — veći izazov je zadržati miran san tokom noći.",
  onsetWeakRecoveryStable: "Kada san konačno dođe, slika izgleda bolje — najveća prepreka pojavljuje se pre toga.",
  recoveryWeak: "Najjasniji signal pojavljuje se nakon sna — tvoje telo ne doživljava svako jutro kao pravi novi početak.",
  onsetWeak: "Najviše se izdvaja trenutak pre sna — prelazak iz budnosti u odmor kod tebe nije uvek jednostavan.",
  continuityWeak: "Kod tebe se najviše izdvaja ono što se događa nakon što zaspiš — san ne ostaje uvek jednako miran.",
  rhythm: "Tvoj san možda nema jednu veliku prepreku, ali vreme i ritam spavanja nisu uvek potpuno predvidljivi.",
  allStable: "Tvoji odgovori ne otkrivaju jednu izraženu slabu tačku — stabilnost se provlači kroz više delova tvog sna.",
  mixed: "Veći deo slike deluje prilično stabilno, ali nekoliko detalja pokazuje da tvoj obrazac nije potpuno isti iz noći u noć.",
});

const getMappedAnswerValue = (result, question) => {
  const index = question - 1;
  const directValue = result.questionValues?.[index];
  if (Number.isFinite(directValue) && directValue >= 0 && directValue <= 4) return directValue;

  const supportingSignal = result.supportingSignals?.find((signal) => signal.question === question);
  const signalValue = supportingSignal?.internalScore;
  return Number.isFinite(signalValue) && signalValue >= 0 && signalValue <= 4 ? signalValue : null;
};

const getPersonalizedInsight = (result, scores, states) => {
  const weakCore = CORE_DIMENSIONS.filter((key) => states[key] === "weak");

  // Multiple weak core dimensions take priority over single-question signals.
  if (weakCore.length >= 2) {
    if (weakCore.length === 2) {
      const pair = new Set(weakCore);
      if (pair.has("recovery") && pair.has("continuity")) return INSIGHTS.recoveryContinuity;
      if (pair.has("sleepOnset") && pair.has("continuity")) return INSIGHTS.onsetContinuity;
      if (pair.has("sleepOnset") && pair.has("recovery")) return INSIGHTS.onsetRecovery;
    }
    return INSIGHTS.multipleCore;
  }

  // These use the classifier's existing mapped 0-4 values and <=1 signal boundary.
  const q6Value = getMappedAnswerValue(result, 6);
  const q12Value = getMappedAnswerValue(result, 12);
  if (q6Value !== null && q6Value <= 1) return INSIGHTS.q6;
  if (q12Value !== null && q12Value <= 1) return INSIGHTS.q12;

  // Specific stable-vs-weak contrasts precede single-area copy.
  if (states.recovery === "weak" && states.sleepOnset === "stable") return INSIGHTS.recoveryWeakOnsetStable;
  if (states.continuity === "weak" && states.sleepOnset === "stable") return INSIGHTS.continuityWeakOnsetStable;
  if (states.sleepOnset === "weak" && states.recovery === "stable") return INSIGHTS.onsetWeakRecoveryStable;

  if (weakCore.length === 1) {
    if (weakCore[0] === "recovery") return INSIGHTS.recoveryWeak;
    if (weakCore[0] === "sleepOnset") return INSIGHTS.onsetWeak;
    return INSIGHTS.continuityWeak;
  }

  // Rhythm is secondary: only call it out when every core score is strictly higher.
  if (
    states.rhythm !== "stable" &&
    CORE_DIMENSIONS.every((key) => scores[key] > scores.rhythm)
  ) {
    return INSIGHTS.rhythm;
  }

  if (ALL_DIMENSIONS.every((key) => states[key] === "stable")) return INSIGHTS.allStable;
  return INSIGHTS.mixed;
};

/** Returns only presentation copy; it never changes or re-runs profile classification. */
export function getSleepFreeResultPresentation(signatureResult) {
  if (!signatureResult?.internalScores) return null;

  const scores = signatureResult.internalScores;
  if (ALL_DIMENSIONS.some((key) => !Number.isFinite(scores[key]))) return null;

  const states = Object.fromEntries(ALL_DIMENSIONS.map((key) => [key, getSleepDimensionSeverity(scores[key])]));
  return {
    profileDescription: PROFILE_DESCRIPTIONS[signatureResult.signatureKey] || "",
    insight: getPersonalizedInsight(signatureResult, scores, states),
  };
}

export { PROFILE_DESCRIPTIONS as SLEEP_FREE_PROFILE_DESCRIPTIONS };