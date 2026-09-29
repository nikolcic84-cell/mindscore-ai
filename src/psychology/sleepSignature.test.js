import assert from "node:assert/strict";
import test from "node:test";
import {
  DOMINANCE_GAP,
  SLEEP_SIGNATURE_THRESHOLDS,
  calculateSleepSignature,
  classifySleepDimensions,
  getSleepDimensionSeverity,
} from "./sleepSignature.js";

const indexes = () => Array(12).fill(0);
const classifyAnswers = (answerIndexes) => calculateSleepSignature(answerIndexes).signature;

test("A. stable answers classify as MIRNA NOĆ with positive insight copy", () => {
  const result = calculateSleepSignature(indexes());
  assert.equal(result.signature, "MIRNA NOĆ");
  assert.equal(result.mainArea, "Nijedna oblast se ne izdvaja kao jasan problem.");
  assert.equal(result.strongestArea, "Oporavak");
});

test("B. clearly weak recovery with stable continuity classifies as UMORNO BUĐENJE", () => {
  const answers = indexes();
  [0, 3, 7, 10].forEach((questionIndex) => { answers[questionIndex] = 4; });
  assert.equal(classifyAnswers(answers), "UMORNO BUĐENJE");
});

test("C. clearly weak sleep onset classifies as BUDAN UM", () => {
  const answers = indexes();
  [1, 6].forEach((questionIndex) => { answers[questionIndex] = 4; });
  assert.equal(classifyAnswers(answers), "BUDAN UM");
});

test("D. clearly weak continuity classifies as ISPREKIDANA NOĆ", () => {
  const answers = indexes();
  answers[2] = 4;
  assert.equal(classifyAnswers(answers), "ISPREKIDANA NOĆ");
});

test("E. clearly weak rhythm classifies as PROMENLJIV RITAM", () => {
  const answers = indexes();
  answers[4] = 3;
  answers[8] = 4;
  answers[9] = 4;
  assert.equal(classifyAnswers(answers), "PROMENLJIV RITAM");
});

test("F. weak recovery and continuity take priority as PRAZNA BATERIJA", () => {
  const answers = Array(12).fill(4);
  assert.equal(classifyAnswers(answers), "PRAZNA BATERIJA");
});

test("G. three weak areas without recovery-continuity combination classify as SAN POD PRITISKOM", () => {
  const answers = indexes();
  [0, 1, 3, 4, 6, 7, 8, 9, 10].forEach((questionIndex) => { answers[questionIndex] = 4; });
  const result = calculateSleepSignature(answers);
  assert.equal(result.signature, "SAN POD PRITISKOM");
  assert.equal(result.mainArea, "Kombinacija više faktora");
  assert.equal(result.strongestArea, "Kontinuitet sna");
});

test("severity boundaries are weak below 0.45, mixed from 0.45, and stable from 0.70", () => {
  assert.equal(getSleepDimensionSeverity(0.449), "weak");
  assert.equal(getSleepDimensionSeverity(0.45), "mixed");
  assert.equal(getSleepDimensionSeverity(0.699), "mixed");
  assert.equal(getSleepDimensionSeverity(0.70), "stable");
  assert.equal(SLEEP_SIGNATURE_THRESHOLDS.weakBelow, 0.45);
  assert.equal(SLEEP_SIGNATURE_THRESHOLDS.stable, 0.70);
});

test("a dominance gap exactly equal to DOMINANCE_GAP is sufficient", () => {
  assert.equal(DOMINANCE_GAP, 0.12);
  const result = classifySleepDimensions({
    recovery: 0.20,
    sleepOnset: 0.32,
    continuity: 0.80,
    rhythm: 0.90,
  });
  assert.equal(result.signatureKey, "tired_waking");
});

test("a gap just below DOMINANCE_GAP does not create a specific signature", () => {
  const result = classifySleepDimensions({
    recovery: 0.20,
    sleepOnset: 0.319,
    continuity: 0.80,
    rhythm: 0.90,
  });
  assert.equal(result.signatureKey, "sleep_under_pressure");
});

test("small differences between mixed dimensions do not become a specific result", () => {
  const result = classifySleepDimensions({
    recovery: 0.51,
    sleepOnset: 0.55,
    continuity: 0.90,
    rhythm: 0.92,
  });
  assert.equal(result.signatureKey, "sleep_under_pressure");
});

test("Q6 does not independently alter the sleep signature or dimension scores", () => {
  const favorable = indexes();
  const changedHabitAnswer = [...favorable];
  changedHabitAnswer[5] = 4;
  const first = calculateSleepSignature(favorable);
  const second = calculateSleepSignature(changedHabitAnswer);
  assert.equal(second.signature, first.signature);
  assert.deepEqual(second.internalScores, first.internalScores);
});

test("Q12 does not independently alter the sleep signature or dimension scores", () => {
  const favorable = indexes();
  const changedControlAnswer = [...favorable];
  changedControlAnswer[11] = 4;
  const first = calculateSleepSignature(favorable);
  const second = calculateSleepSignature(changedControlAnswer);
  assert.equal(second.signature, first.signature);
  assert.deepEqual(second.internalScores, first.internalScores);
});

test("invalid or incomplete answer sets return null", () => {
  assert.equal(calculateSleepSignature([0, 1, 2]), null);
  assert.equal(calculateSleepSignature([...indexes().slice(0, 11), 5]), null);
});

test("only the seven approved primary signatures are returned by persona tests", () => {
  const personas = [
    indexes(),
    ...[
      [0, 3, 7, 10],
      [1, 6],
      [2],
      [4, 8, 9],
      [0, 1, 3, 4, 6, 7, 8, 9, 10],
    ].map((questionIndexes) => {
      const answers = indexes();
      questionIndexes.forEach((questionIndex) => {
        answers[questionIndex] = questionIndex === 4 && questionIndexes.includes(8) ? 3 : 4;
      });
      return answers;
    }),
    Array(12).fill(4),
  ];
  const signatures = new Set(personas.map(classifyAnswers));
  assert.deepEqual([...signatures].sort(), [
    "BUDAN UM",
    "ISPREKIDANA NOĆ",
    "MIRNA NOĆ",
    "PRAZNA BATERIJA",
    "PROMENLJIV RITAM",
    "SAN POD PRITISKOM",
    "UMORNO BUĐENJE",
  ].sort());
});
