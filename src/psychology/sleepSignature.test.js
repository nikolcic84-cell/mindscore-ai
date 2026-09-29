import assert from "node:assert/strict";
import test from "node:test";
import {
  SLEEP_SIGNATURE_SCORING_MAP,
  SLEEP_SIGNATURE_THRESHOLDS,
  calculateSleepSignature,
  classifySleepDimensions,
  getSleepDimensionSeverity,
} from "./sleepSignature.js";

const positionsToIndexes = (positions) => positions.map((position) => position - 1);
const resultForPositions = (positions) => calculateSleepSignature(positionsToIndexes(positions));
const allPosition = (position) => Array(12).fill(position);
const EXPECTED_PROFILES = ["MIRNA NOĆ", "UMORAN SAN", "BUDAN UM", "ISPREKIDAN SAN", "SAN POD PRITISKOM"];

test("exactly the five requested primary profiles are reachable", () => {
  const personas = [
    allPosition(1),
    [5, 1, 1, 5, 1, 1, 1, 5, 1, 1, 5, 1],
    [1, 5, 1, 1, 1, 5, 5, 1, 1, 1, 1, 1],
    [1, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 5],
    allPosition(3),
  ];
  assert.deepEqual([...new Set(personas.map((p) => resultForPositions(p).signature))].sort(), [...EXPECTED_PROFILES].sort());
});

test("all best answers return MIRNA NOĆ and tied areas remain tied", () => {
  const result = resultForPositions(allPosition(1));
  assert.equal(result.signatureKey, "calm_night");
  assert.equal(result.signature, "MIRNA NOĆ");
  assert.deepEqual(result.strongestAreas, ["Oporavak", "Uspavljivanje", "Kontinuitet sna", "Ritam sna"]);
  assert.equal(result.strongestArea, "Više oblasti deli isti rezultat");
  assert.deepEqual(result.weakestAreas, ["Oporavak", "Uspavljivanje", "Kontinuitet sna", "Ritam sna"]);
});

test("all middle answers return SAN POD PRITISKOM, not MIRNA NOĆ", () => {
  const result = resultForPositions(allPosition(3));
  assert.equal(result.signature, "SAN POD PRITISKOM");
  assert.equal(result.mainAreaType, "mixed_pattern");
  assert.ok(Object.values(result.internalScores).every((score) => score === 0.5));
});

test("one weak recovery core dimension returns UMORAN SAN", () => {
  const result = resultForPositions([5, 1, 1, 5, 1, 1, 1, 5, 1, 1, 5, 1]);
  assert.equal(result.signature, "UMORAN SAN");
  assert.equal(result.signatureKey, "tired_waking");
  assert.equal(result.weakCoreDimensions.length, 1);
  assert.deepEqual(result.weakCoreDimensions, ["recovery"]);
});

test("one weak sleepOnset core dimension returns BUDAN UM", () => {
  const result = resultForPositions([1, 5, 1, 1, 1, 5, 5, 1, 1, 1, 1, 1]);
  assert.equal(result.signature, "BUDAN UM");
  assert.deepEqual(result.weakCoreDimensions, ["sleepOnset"]);
});

test("one weak continuity core dimension returns ISPREKIDAN SAN", () => {
  const result = resultForPositions([1, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 5]);
  assert.equal(result.signature, "ISPREKIDAN SAN");
  assert.deepEqual(result.weakCoreDimensions, ["continuity"]);
});

test("multiple weak core dimensions return SAN POD PRITISKOM, without battery profile", () => {
  const recoveryAndOnset = resultForPositions([5, 5, 1, 5, 1, 5, 5, 5, 1, 1, 5, 1]);
  const recoveryAndContinuity = resultForPositions([5, 1, 5, 5, 1, 1, 1, 5, 1, 1, 5, 5]);
  const allWorst = resultForPositions(allPosition(5));
  for (const result of [recoveryAndOnset, recoveryAndContinuity, allWorst]) {
    assert.equal(result.signature, "SAN POD PRITISKOM");
    assert.equal(result.mainAreaType, "multiple_weak");
  }
  assert.equal(recoveryAndContinuity.signatureKey, "sleep_under_pressure");
  assert.equal(allWorst.signatureKey, "sleep_under_pressure");
});

test("all worst answers resolve deterministically to SAN POD PRITISKOM", () => {
  const first = resultForPositions(allPosition(5));
  const second = resultForPositions(allPosition(5));
  assert.deepEqual(first, second);
  assert.equal(first.signature, "SAN POD PRITISKOM");
});

test("a weak rhythm alone does not create a rhythm profile and remains secondary under MIRNA NOĆ", () => {
  const result = resultForPositions([1, 1, 1, 1, 4, 1, 1, 1, 5, 5, 1, 1]);
  assert.equal(result.signature, "MIRNA NOĆ");
  assert.ok(result.internalScores.rhythm < 0.45);
  assert.ok(result.secondaryInsights.some((insight) => insight.text === "Tvoj ritam spavanja je promenljiv."));
});

test("weak rhythm does not become a primary profile when core calm gate fails", () => {
  const result = resultForPositions([3, 3, 3, 3, 4, 3, 3, 3, 5, 5, 3, 3]);
  assert.equal(result.internalScores.rhythm < 0.45, true);
  assert.equal(result.signature, "SAN POD PRITISKOM");
  assert.equal(result.mainAreaType, "rhythm_secondary");
  assert.ok(result.secondaryInsights.some((insight) => insight.key === "rhythm"));
});

test("Q6 strongly negative vetoes calm but does not create a single-area profile by itself", () => {
  const result = resultForPositions([1, 1, 1, 1, 1, 5, 1, 1, 1, 1, 1, 1]);
  assert.ok(result.internalScores.recovery >= 0.7);
  assert.ok(result.internalScores.sleepOnset >= 0.55);
  assert.ok(result.internalScores.continuity >= 0.7);
  assert.equal(result.signature, "SAN POD PRITISKOM");
  assert.equal(result.mainAreaType, "supporting_warning");
  assert.ok(result.secondaryInsights.some((insight) => insight.key === "evening_habit"));
});

test("Q12 strongly negative vetoes calm but does not create a single-area profile by itself", () => {
  const result = resultForPositions([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 4]);
  assert.ok(result.internalScores.recovery >= 0.7);
  assert.ok(result.internalScores.sleepOnset >= 0.7);
  assert.ok(result.internalScores.continuity >= 0.55);
  assert.equal(result.signature, "SAN POD PRITISKOM");
  assert.equal(result.mainAreaType, "supporting_warning");
  assert.ok(result.secondaryInsights.some((insight) => insight.key === "recent_sleep_signal"));
});

test("Q6 and Q12 still influence only their assigned dimensions", () => {
  const baseline = allPosition(3);
  const q6Changed = [...baseline];
  q6Changed[5] = 5;
  const baseScores = resultForPositions(baseline).internalScores;
  const q6Scores = resultForPositions(q6Changed).internalScores;
  assert.notEqual(q6Scores.sleepOnset, baseScores.sleepOnset);
  assert.equal(q6Scores.recovery, baseScores.recovery);
  assert.equal(q6Scores.continuity, baseScores.continuity);
  assert.equal(q6Scores.rhythm, baseScores.rhythm);

  const q12Changed = [...baseline];
  q12Changed[11] = 5;
  const q12Scores = resultForPositions(q12Changed).internalScores;
  assert.notEqual(q12Scores.continuity, baseScores.continuity);
  assert.equal(q12Scores.recovery, baseScores.recovery);
  assert.equal(q12Scores.sleepOnset, baseScores.sleepOnset);
  assert.equal(q12Scores.rhythm, baseScores.rhythm);
});

test("severity boundaries and calm thresholds are exact", () => {
  assert.equal(getSleepDimensionSeverity(0.449999), "weak");
  assert.equal(getSleepDimensionSeverity(0.45), "mixed");
  assert.equal(getSleepDimensionSeverity(0.699999), "mixed");
  assert.equal(getSleepDimensionSeverity(0.70), "stable");
  assert.equal(SLEEP_SIGNATURE_THRESHOLDS.good, 0.70);
  assert.equal(SLEEP_SIGNATURE_THRESHOLDS.weakBelow, 0.45);

  const exactCoreBoundary = classifySleepDimensions({ recovery: 0.70, sleepOnset: 0.70, continuity: 0.70, rhythm: 0.1 }, { q6Value: 4, q12Value: 4 });
  assert.equal(exactCoreBoundary.signatureKey, "calm_night");

  const twoGoodBalanced = classifySleepDimensions({ recovery: 0.80, sleepOnset: 0.75, continuity: 0.55, rhythm: 0.40 }, { q6Value: 4, q12Value: 2 });
  assert.equal(twoGoodBalanced.signatureKey, "calm_night");

  const belowCalmAverage = classifySleepDimensions({ recovery: 0.70, sleepOnset: 0.70, continuity: 0.55, rhythm: 0.40 }, { q6Value: 4, q12Value: 2 });
  assert.equal(belowCalmAverage.signatureKey, "sleep_under_pressure");
});

test("ties are returned as sets and neutral labels, never dimension-order winners", () => {
  const allEqual = resultForPositions(allPosition(2));
  assert.deepEqual(allEqual.strongestAreas, ["Oporavak", "Uspavljivanje", "Kontinuitet sna", "Ritam sna"]);
  assert.equal(allEqual.strongestArea, "Više oblasti deli isti rezultat");
  assert.deepEqual(allEqual.weakestAreas, ["Oporavak", "Uspavljivanje", "Kontinuitet sna", "Ritam sna"]);

  const tiedWeak = resultForPositions([5, 5, 1, 5, 1, 5, 5, 5, 1, 1, 5, 1]);
  assert.equal(tiedWeak.signature, "SAN POD PRITISKOM");
  assert.deepEqual(tiedWeak.weakCoreDimensions, ["recovery", "sleepOnset"]);
  assert.deepEqual(tiedWeak.weakestAreas, ["Oporavak", "Uspavljivanje"]);
  assert.equal(tiedWeak.mainArea, "Kombinacija više faktora");
});

test("dimension assignments remain exact and remove all supporting-only assignments", () => {
  assert.deepEqual(SLEEP_SIGNATURE_SCORING_MAP.map(({ dimension }) => dimension), ["recovery", "sleepOnset", "continuity", "recovery", "rhythm", "sleepOnset", "sleepOnset", "recovery", "rhythm", "rhythm", "recovery", "continuity"]);
  assert.ok(SLEEP_SIGNATURE_SCORING_MAP.every(({ dimension }) => Boolean(dimension)));
});

test("all attainable dimension-sum/Q6/Q12 combinations resolve to one of five profile keys", () => {
  const allowed = new Set(["calm_night", "tired_waking", "awake_mind", "fragmented_night", "sleep_under_pressure"]);
  let count = 0;
  for (let recoverySum = 0; recoverySum <= 16; recoverySum += 1) {
    for (let onsetSum = 0; onsetSum <= 12; onsetSum += 1) {
      for (let continuitySum = 0; continuitySum <= 8; continuitySum += 1) {
        for (let rhythmSum = 0; rhythmSum <= 12; rhythmSum += 1) {
          for (let q6Value = 0; q6Value <= 4; q6Value += 1) {
            for (let q12Value = 0; q12Value <= 4; q12Value += 1) {
              const result = classifySleepDimensions({ recovery: recoverySum / 16, sleepOnset: onsetSum / 12, continuity: continuitySum / 8, rhythm: rhythmSum / 12 }, { q6Value, q12Value });
              assert.ok(allowed.has(result.signatureKey));
              count += 1;
            }
          }
        }
      }
    }
  }
  assert.equal(count, 17 * 13 * 9 * 13 * 25);
});

test("invalid or incomplete answer sets return null", () => {
  assert.equal(calculateSleepSignature([0, 1, 2]), null);
  assert.equal(calculateSleepSignature([...Array(11).fill(0), 5]), null);
});
