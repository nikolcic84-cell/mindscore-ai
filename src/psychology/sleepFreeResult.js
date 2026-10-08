import { SLEEP_ANSWER_OPTIONS } from "./sleepAssessmentContent.js";
import {
  getSleepDimensionSeverity,
  SLEEP_SIGNATURE_DIMENSION_QUESTION_INDICES,
} from "./sleepSignature.js";

const PROFILE_DESCRIPTIONS = Object.freeze({
  calm_night: "Tvoj san pokazuje prilično skladan obrazac. Većina signala ide u dobrom smeru — ali detalji u tvojim odgovorima otkrivaju šta najviše doprinosi toj stabilnosti i gde ipak postoje male promene.",
  tired_waking: "Spavanje ti ne donosi uvek onaj osećaj odmora koji bi očekivao. Tvoji odgovori otkrivaju nekoliko tragova koji mogu pomoći da razumemo gde se taj osećaj oporavka gubi.",
  awake_mind: "Telo je možda spremno za odmor, ali um ne prati uvek isti ritam. Tvoji odgovori otkrivaju obrasce koji mogu objasniti šta ti otežava da mirno pređeš iz budnosti u san.",
  fragmented_night: "Tvoj san ne teče uvek bez prekida. Tvoji odgovori pokazuju da nije važna samo dužina sna — već i ono što se događa tokom noći i kako se to odražava na tvoj odmor.",
  sleep_under_pressure: "Tvoj san šalje više različitih signala. Nijedan ne govori celu priču sam za sebe — ali kada ih povežemo, počinje da se otkriva šta zaista oblikuje tvoj san i osećaj odmora.",
});

const CORE_DIMENSIONS = ["recovery", "sleepOnset", "continuity"];
const ALL_DIMENSIONS = [...CORE_DIMENSIONS, "rhythm"];
const DIMENSION_QUESTIONS = SLEEP_SIGNATURE_DIMENSION_QUESTION_INDICES;
const SECONDARY_DETAIL_ORDER = Object.freeze({
  sleepOnset: ["continuity", "rhythm", "recovery"],
  recovery: ["sleepOnset", "continuity", "rhythm"],
  continuity: ["sleepOnset", "recovery", "rhythm"],
  rhythm: ["sleepOnset", "continuity", "recovery"],
});

const getSelectedAnswers = (answerPoints) => {
  if (!Array.isArray(answerPoints) || answerPoints.length !== 12) return null;
  return answerPoints.map((points, questionIndex) => {
    const options = SLEEP_ANSWER_OPTIONS[questionIndex];
    return options?.find((option) => option.points === points)?.text || null;
  });
};

const getAnswer = (answers, questionNumber) => answers?.[questionNumber - 1] || null;
const formatQuote = (answer) => `„${answer}“`;

const getMappedAnswerValue = (result, question) => {
  const index = question - 1;
  const directValue = result.questionValues?.[index];
  if (Number.isFinite(directValue) && directValue >= 0 && directValue <= 4) return directValue;
  const signal = result.supportingSignals?.find((item) => item.question === question);
  return Number.isFinite(signal?.internalScore) && signal.internalScore >= 0 && signal.internalScore <= 4
    ? signal.internalScore
    : null;
};

const getDistinctiveAnswerForDimension = (key, answerPoints, answerTexts) => {
  const questionNumbers = DIMENSION_QUESTIONS[key].map((index) => index + 1);
  const ranked = questionNumbers
    .map((question) => ({ question, value: getMappedAnswerValueForQuestion(question, answerPoints) }))
    .filter(({ value }) => Number.isFinite(value))
    .sort((left, right) => left.value - right.value);
  const lowest = ranked[0];
  if (!lowest || lowest.value > 2) return null;
  const answer = getAnswer(answerTexts, lowest.question);
  return answer ? { question: lowest.question, answer, value: lowest.value } : null;
};

const getMappedAnswerValueForQuestion = (question, answerPoints) => {
  const points = answerPoints?.[question - 1];
  return Number.isInteger(points) && points >= 1 && points <= 5 ? 5 - points : null;
};

const PRIMARY_COPY = Object.freeze({
  sleepOnset: "Uspavljivanje i period pre sna izdvajaju se u tvojim odgovorima.",
  recovery: "Osećaj po buđenju i dnevna energija izdvajaju se u tvojim odgovorima.",
  continuity: "Tok noći i buđenja izdvajaju se u tvojim odgovorima.",
  multiple: "U tvojim odgovorima izdvaja se više delova noći, pa ih je korisno posmatrati zajedno.",
  q6: "Jedan odgovor o večeri pre spavanja posebno se izdvaja.",
  q12: "Tvoj opis poslednjih noći posebno se izdvaja.",
  balanced: "Tvoji odgovori donose nekoliko različitih pogleda na noć.",
});

const getPrimaryArea = (signatureResult, scores, states) => {
  const weak = CORE_DIMENSIONS.filter((key) => states[key] === "weak");
  if (weak.length >= 2) return { key: "multiple", weak };
  if (weak.length === 1) return { key: weak[0], weak };

  const q6 = getMappedAnswerValue(signatureResult, 6);
  if (q6 !== null && q6 <= 1) return { key: "sleepOnset", weak: [] };
  const q12 = getMappedAnswerValue(signatureResult, 12);
  if (q12 !== null && q12 <= 1) return { key: "continuity", weak: [] };

  if (ALL_DIMENSIONS.every((key) => states[key] === "stable")) return { key: "balanced", weak: [] };
  return { key: "balanced", weak: [] };
};

const getPrimaryInsight = (primary, signatureResult, answerPoints, answerTexts) => {
  const q6Answer = getAnswer(answerTexts, 6);
  const q12Answer = getAnswer(answerTexts, 12);
  const onsetAnswer = getAnswer(answerTexts, 2);
  const activeThoughts = getAnswer(answerTexts, 7);
  const continuityAnswer = getAnswer(answerTexts, 3);
  const earlyWake = getAnswer(answerTexts, 4);
  const recoveryAnswer = getAnswer(answerTexts, 1);

  if (primary.key === "multiple") {
    const evidence = primary.weak
      .map((key) => getDistinctiveAnswerForDimension(key, answerPoints, answerTexts))
      .filter(Boolean)
      .slice(0, 2);
    if (evidence.length === 2) {
      return `Navodiš ${formatQuote(evidence[0].answer)}, a istovremeno i ${formatQuote(evidence[1].answer)}. Ova dva odgovora odnose se na različite delove tvoje noći i vredi ih posmatrati zajedno.`;
    }
    return PRIMARY_COPY.multiple;
  }

  if (primary.key === "sleepOnset") {
    if (onsetAnswer && /misli|analiz|planir|mozak/i.test(activeThoughts || "")) {
      return `Za uspavljivanje si izabrao/la ${formatQuote(onsetAnswer)}, a kada legneš ${formatQuote(activeThoughts)}. Ova dva odgovora pojavljuju se u istom delu tvoje večeri i vredi ih posmatrati zajedno.`;
    }
    if (onsetAnswer && q6Answer) return `Za uspavljivanje si izabrao/la ${formatQuote(onsetAnswer)}, a za period pred spavanje ${formatQuote(q6Answer)}. Ova dva odgovora pojavljuju se u istom delu tvoje večeri i vredi ih posmatrati zajedno.`;
    return PRIMARY_COPY.sleepOnset;
  }
  if (primary.key === "continuity") {
    if (continuityAnswer && q12Answer) return `Tokom noći si izabrao/la ${formatQuote(continuityAnswer)}, a o poslednjim noćima ${formatQuote(q12Answer)}. Ova dva odgovora opisuju različite delove tvog noćnog iskustva.`;
    return PRIMARY_COPY.continuity;
  }
  if (primary.key === "recovery") {
    const daytimeEnergy = getAnswer(answerTexts, 8);
    if (recoveryAnswer && daytimeEnergy) return `Po buđenju si naveo/la ${formatQuote(recoveryAnswer)}, a o energiji tokom dana ${formatQuote(daytimeEnergy)}. Ova dva odgovora opisuju jutro i deo dana koji sledi.`;
    if (recoveryAnswer && earlyWake) return `Po buđenju si naveo/la ${formatQuote(recoveryAnswer)}, a o ustajanju ${formatQuote(earlyWake)}. Ova dva odgovora pojavljuju se u jutarnjem delu tvoje rutine.`;
    return PRIMARY_COPY.recovery;
  }
  if (q6Answer && getMappedAnswerValue(signatureResult, 6) <= 1) return `Za poslednjih 30 minuta pre sna izabrao/la si ${formatQuote(q6Answer)}. To je deo večeri koji možeš da posmatraš zajedno sa svojim doživljajem uspavljivanja.`;
  if (q12Answer && getMappedAnswerValue(signatureResult, 12) <= 1) return `O poslednjim noćima si izabrao/la ${formatQuote(q12Answer)}. Ovaj utisak možeš da posmatraš zajedno sa onim čega se sećaš tokom noći.`;
  return PRIMARY_COPY.balanced;
};

const DIMENSION_DETAIL_COPY = Object.freeze({
  sleepOnset: "Ovo je još jedan deo večeri koji možeš da pratiš.",
  recovery: "Ovo je još jedan jutarnji detalj koji možeš da pratiš.",
  continuity: "Ovo je još jedan detalj o toku noći koji možeš da pratiš.",
  rhythm: "Ovo je još jedan detalj o ritmu koji možeš da pratiš.",
});

const getSecondaryDetail = (primaryKey, states, signatureResult, answerPoints, answerTexts) => {
  const primaryAreas = primaryKey === "multiple" ? new Set(CORE_DIMENSIONS) : new Set([primaryKey]);
  const secondaryOrder = SECONDARY_DETAIL_ORDER[primaryKey] || ["sleepOnset", "continuity", "recovery", "rhythm"];
  for (const secondaryKey of secondaryOrder) {
    if (primaryAreas.has(secondaryKey)) continue;
    if (states[secondaryKey] === "weak") {
      const answer = getDistinctiveAnswerForDimension(secondaryKey, answerPoints, answerTexts);
      if (answer) return `Naveo/la si i ${formatQuote(answer.answer)}. ${DIMENSION_DETAIL_COPY[secondaryKey]}`;
    }
  }

  const q6Value = getMappedAnswerValue(signatureResult, 6);
  const q12Value = getMappedAnswerValue(signatureResult, 12);
  if (!primaryAreas.has("sleepOnset") && q6Value !== null && q6Value <= 1) {
    const answer = getAnswer(answerTexts, 6);
    if (answer) return `O periodu pred spavanje naveo/la si ${formatQuote(answer)}. To je još jedan detalj večeri koji možeš da pratiš.`;
  }
  if (!primaryAreas.has("continuity") && q12Value !== null && q12Value <= 1) {
    const answer = getAnswer(answerTexts, 12);
    if (answer) return `O poslednjim noćima naveo/la si ${formatQuote(answer)}. To je još jedan detalj noći koji možeš da pratiš.`;
  }
  if (!primaryAreas.has("rhythm") && states.rhythm !== "stable" && CORE_DIMENSIONS.every((key) => signatureResult.internalScores[key] > signatureResult.internalScores.rhythm)) {
    const answer = getAnswer(answerTexts, 10);
    if (answer) return `O predvidivosti vremena odlaska u krevet i ustajanja naveo/la si ${formatQuote(answer)}. To je dodatni detalj koji možeš da pratiš.`;
  }
  return null;
};

const getTonightAction = (primaryKey, answerTexts) => {
  if (primaryKey?.key === "multiple") {
    return getTonightAction(primaryKey.weak[0] || "sleepOnset", answerTexts);
  }
  const areaKey = primaryKey?.key || primaryKey;
  if (areaKey === "sleepOnset") {
    const q6 = getAnswer(answerTexts, 6) || "";
    const thoughts = getAnswer(answerTexts, 7) || "";
    if (/telefon|skrol|ekran/i.test(q6)) return "Poslednjih 30 minuta pre spavanja ostavi telefon van kreveta. Nemoj menjati ništa drugo. Samo primeti da li ti je prelazak ka snu bio mirniji.";
    if (/misli|analiz|planir|mozak/i.test(thoughts)) return "Pre nego što legneš, odvoji nekoliko minuta i zapiši ono što ti se najviše vrti po glavi. Zatim samo primeti da li ti je bilo lakše da pređeš u odmor.";
    return "Večeras izaberi jednu mirnu aktivnost pre spavanja i primeti kako ti odgovara.";
  }
  if (areaKey === "continuity") return "Ako se večeras probudiš tokom noći, nemoj pokušavati da menjaš više stvari odjednom. Ujutru samo zabeleži koliko puta se sećaš da si bio/la budan/budna.";
  if (areaKey === "recovery") return "Ujutru zastani trenutak i zabeleži kako se osećaš, jednom rečju. To je dovoljno za prvi dan.";
  return "Večeras izaberi jedan miran trenutak pre spavanja i samo primeti kako ti odgovara.";
};

const getPremiumTeaserItems = () => [
  { title: "TVOJ PRIORITET #1", description: "Gde kod tebe ima najviše smisla da počneš." },
  { title: "TVOJ LIČNI PLAN ZA 7 DANA", description: "Konkretni koraci zasnovani na tvojim odgovorima." },
  { title: "ŠTA ZA SADA NE MORAŠ DA MENJAŠ", description: "Da ne pokušavaš da promeniš sve odjednom." },
  { title: "AKO PRVI KORAK NE POMOGNE", description: "Šta sledeće ima smisla da probaš." },
  { title: "TVOJ PDF PLAN", description: "Rezultat i plan koji možeš da sačuvaš." },
];

/** Presentation only. The deterministic signatureResult is consumed, never recalculated or changed here. */
export function getSleepFreeResultPresentation(signatureResult, answerPoints) {
  if (!signatureResult?.internalScores) return null;
  const scores = signatureResult.internalScores;
  if (ALL_DIMENSIONS.some((key) => !Number.isFinite(scores[key]))) return null;

  const answerTexts = getSelectedAnswers(answerPoints);
  const states = Object.fromEntries(ALL_DIMENSIONS.map((key) => [key, getSleepDimensionSeverity(scores[key])]));
  const primary = getPrimaryArea(signatureResult, scores, states);
  const primaryInsight = getPrimaryInsight(primary, signatureResult, answerPoints, answerTexts);
  const secondaryDetail = getSecondaryDetail(primary.key, states, signatureResult, answerPoints, answerTexts);
  const premiumItems = getPremiumTeaserItems();
  return {
    profileDescription: PROFILE_DESCRIPTIONS[signatureResult.signatureKey] || "",
    profileName: signatureResult.signature,
    primaryInsight,
    secondaryDetail,
    tonightAction: getTonightAction(primary, answerTexts),
    premiumTeaser: {
      heading: "ŽELIŠ DA ZNAŠ ŠTA DALJE?",
      text: "Jedna promena nije plan. Detaljni rezultat povezuje svih 12 odgovora i pokazuje gde ima najviše smisla da počneš i šta da radiš dalje.",
      items: premiumItems,
      cta: "OTKRIJ ŠTA DALJE →",
    },
    // Compatibility for consumers still reading the previous field.
    insight: primaryInsight,
  };
}

export { PROFILE_DESCRIPTIONS as SLEEP_FREE_PROFILE_DESCRIPTIONS };
