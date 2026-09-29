import { SLEEP_ANSWER_OPTIONS, SLEEP_QUESTIONS } from "../src/psychology/sleepAssessmentContent.js";
import { calculateSleepSignature, getSleepDimensionSeverity } from "../src/psychology/sleepSignature.js";

const DIMENSION_KEYS = ["recovery", "sleepOnset", "continuity", "rhythm"];

export const buildSleepPremiumInput = (answers) => {
  if (
    !Array.isArray(answers) ||
    answers.length !== 12 ||
    answers.some((answer) => !Number.isInteger(answer) || answer < 1 || answer > 5)
  ) {
    throw new TypeError("Premium sleep input requires exactly twelve valid answers.");
  }

  const answerIndexes = answers.map((points) => 5 - points);
  const signature = calculateSleepSignature(answerIndexes);
  if (!signature) throw new TypeError("Premium sleep profile could not be calculated.");

  return {
    profile: signature.signature,
    dimensions: Object.fromEntries(DIMENSION_KEYS.map((key) => [
      key,
      {
        score: signature.internalScores[key],
        state: getSleepDimensionSeverity(signature.internalScores[key]).toUpperCase(),
      },
    ])),
    answers: answers.map((points, index) => {
      const selectedOption = SLEEP_ANSWER_OPTIONS[index].find((option) => option.points === points);
      if (!selectedOption) throw new TypeError(`No canonical answer option exists for Q${index + 1}.`);
      return {
        questionId: `Q${index + 1}`,
        question: SLEEP_QUESTIONS[index],
        answer: selectedOption.text,
        mappedValue: signature.questionValues[index],
      };
    }),
  };
};

export const SLEEP_PREMIUM_PROFILE_NAMES = Object.freeze([
  "MIRNA NOĆ",
  "UMORAN SAN",
  "BUDAN UM",
  "ISPREKIDAN SAN",
  "SAN POD PRITISKOM",
]);

export const SLEEP_PREMIUM_DIMENSION_KEYS = Object.freeze(DIMENSION_KEYS);
