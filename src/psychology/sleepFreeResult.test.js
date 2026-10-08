import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { SLEEP_ANSWER_OPTIONS } from "./sleepAssessmentContent.js";
import { calculateSleepSignature } from "./sleepSignature.js";
import {
  getSleepFreeResultPresentation,
  SLEEP_FREE_PROFILE_DESCRIPTIONS,
} from "./sleepFreeResult.js";

const pointsForPositions = (positions) => positions.map((position) => 6 - position);
const signatureFor = (points) => calculateSleepSignature(points.map((value) => 5 - value));
const setAnswer = (points, questionNumber, selectedPoints) => {
  const next = [...points];
  next[questionNumber - 1] = selectedPoints;
  return next;
};
const answerText = (points, questionNumber) =>
  SLEEP_ANSWER_OPTIONS[questionNumber - 1].find(({ points: optionPoints }) => optionPoints === points[questionNumber - 1])?.text;

const profileCases = [
  ["calm_night", pointsForPositions(Array(12).fill(1)), "MIRNA NOĆ"],
  ["tired_waking", pointsForPositions([5, 1, 1, 5, 1, 1, 1, 5, 1, 1, 5, 1]), "UMORAN SAN"],
  ["awake_mind", pointsForPositions([1, 5, 1, 1, 1, 5, 5, 1, 1, 1, 1, 1]), "BUDAN UM"],
  ["fragmented_night", pointsForPositions([1, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 5]), "ISPREKIDAN SAN"],
  ["sleep_under_pressure", pointsForPositions([5, 5, 1, 5, 1, 5, 5, 5, 1, 1, 5, 1]), "SAN POD PRITISKOM"],
];

test("all five deterministic profiles retain their approved profile names and descriptions", () => {
  assert.deepEqual(Object.keys(SLEEP_FREE_PROFILE_DESCRIPTIONS).sort(), [
    "awake_mind", "calm_night", "fragmented_night", "sleep_under_pressure", "tired_waking",
  ]);
  for (const [signatureKey, points, profileName] of profileCases) {
    const signature = signatureFor(points);
    const result = getSleepFreeResultPresentation(signature, points);
    assert.equal(signature.signature, profileName);
    assert.equal(result.profileName, profileName);
    assert.equal(result.profileDescription, SLEEP_FREE_PROFILE_DESCRIPTIONS[signatureKey]);
  }
});

test("primary free insight is deterministic and quotes the user's relevant selected answers", () => {
  let points = Array(12).fill(5);
  points = setAnswer(points, 2, 1);
  points = setAnswer(points, 6, 2);
  points = setAnswer(points, 7, 2);
  const signature = signatureFor(points);
  const result = getSleepFreeResultPresentation(signature, points);
  assert.equal(signature.signature, "BUDAN UM");
  assert.match(result.primaryInsight, new RegExp(answerText(points, 2).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(result.primaryInsight, new RegExp(answerText(points, 7).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(result.primaryInsight, /pojavljuju se.*vredi ih posmatrati zajedno/i);
  assert.doesNotMatch(result.primaryInsight, /uzrok|izaziva|remeti/i);
});

test("a genuinely different supported secondary answer appears; absent evidence omits the detail", () => {
  let points = Array(12).fill(5);
  points = setAnswer(points, 2, 1);
  points = setAnswer(points, 7, 1);
  points = setAnswer(points, 5, 1);
  points = setAnswer(points, 9, 1);
  points = setAnswer(points, 10, 1);
  const withSecondary = getSleepFreeResultPresentation(signatureFor(points), points);
  assert.equal(withSecondary.profileName, "BUDAN UM");
  assert.match(withSecondary.secondaryDetail, new RegExp(answerText(points, 10).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.notEqual(withSecondary.secondaryDetail, withSecondary.primaryInsight);

  let withoutSecondaryPoints = Array(12).fill(5);
  withoutSecondaryPoints = setAnswer(withoutSecondaryPoints, 2, 1);
  withoutSecondaryPoints = setAnswer(withoutSecondaryPoints, 7, 1);
  const withoutSecondary = getSleepFreeResultPresentation(signatureFor(withoutSecondaryPoints), withoutSecondaryPoints);
  assert.equal(withoutSecondary.secondaryDetail, null);
});

test("Q6 and Q12 distinctive answers personalize the relevant free insight", () => {
  let q6Points = Array(12).fill(5);
  q6Points = setAnswer(q6Points, 6, 1);
  const q6Result = getSleepFreeResultPresentation(signatureFor(q6Points), q6Points);
  assert.match(q6Result.primaryInsight, new RegExp(answerText(q6Points, 6).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(q6Result.tonightAction, /telefon/i);

  let q12Points = Array(12).fill(5);
  q12Points = setAnswer(q12Points, 12, 1);
  const q12Result = getSleepFreeResultPresentation(signatureFor(q12Points), q12Points);
  assert.match(q12Result.primaryInsight, new RegExp(answerText(q12Points, 12).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(q12Result.tonightAction, /zabeleži/i);
});

test("rhythm remains a secondary detail when the core sleep areas are stronger", () => {
  let points = Array(12).fill(5);
  points = setAnswer(points, 5, 1);
  points = setAnswer(points, 9, 1);
  points = setAnswer(points, 10, 1);
  const signature = signatureFor(points);
  const result = getSleepFreeResultPresentation(signature, points);
  assert.equal(signature.signature, "MIRNA NOĆ");
  assert.match(result.primaryInsight, /različitih pogleda na noć/i);
  assert.match(result.secondaryDetail, new RegExp(answerText(points, 10).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(result.primaryInsight, /ritam|spavanja i buđenja/i);
});

test("tied scores use neutral copy without arbitrary area claims", () => {
  const points = Array(12).fill(3);
  const signature = signatureFor(points);
  const result = getSleepFreeResultPresentation(signature, points);
  assert.equal(new Set(Object.values(signature.internalScores)).size, 1);
  assert.match(result.primaryInsight, /različitih pogleda na noć/i);
  assert.equal(result.secondaryDetail, null);
  assert.doesNotMatch(`${result.primaryInsight} ${result.secondaryDetail || ""}`, /oporavak|uspavljivanje|kontinuitet|ritam/i);
});

test("free contains exactly one low-risk tonight experiment and no internal terminology", () => {
  for (const [, points] of profileCases) {
    const result = getSleepFreeResultPresentation(signatureFor(points), points);
    assert.equal(typeof result.tonightAction, "string");
    assert.ok(result.tonightAction.trim().length > 0);
    assert.equal(Array.isArray(result.tonightAction), false);
    assert.doesNotMatch(JSON.stringify(result), /\b(?:STABLE|MIXED|WEAK|classifier|scoring|dimension|AI confidence|algoritam)\b/i);
    assert.doesNotMatch(JSON.stringify(result), /dijagnoz|lečenje|lekove/i);
    assert.doesNotMatch(result.tonightAction, /sigurno.*poboljš|reši.*problem|izleči/i);
  }
});

test("Premium teaser preserves the requested boundary, five locked benefits, and CTA", () => {
  const points = setAnswer(Array(12).fill(5), 2, 1);
  const teaser = getSleepFreeResultPresentation(signatureFor(points), points).premiumTeaser;
  assert.equal(teaser.heading, "ŽELIŠ DA ZNAŠ ŠTA DALJE?");
  assert.equal(teaser.text, "Jedna promena nije plan. Detaljni rezultat povezuje svih 12 odgovora i pokazuje gde ima najviše smisla da počneš i šta da radiš dalje.");
  assert.deepEqual(teaser.items.map(({ title }) => title), [
    "TVOJ PRIORITET #1",
    "TVOJ LIČNI PLAN ZA 7 DANA",
    "ŠTA ZA SADA NE MORAŠ DA MENJAŠ",
    "AKO PRVI KORAK NE POMOGNE",
    "TVOJ PDF PLAN",
  ]);
  assert.equal(teaser.cta, "OTKRIJ ŠTA DALJE →");
});

test("Free presentation has no AI, network, or backend dependency", () => {
  const source = readFileSync(new URL("./sleepFreeResult.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /from ["']openai|fetch\s*\(|responses\.parse|OPENAI_API_KEY/i);
});

test("presentation rejects missing or invalid classifier input without inventing content", () => {
  assert.equal(getSleepFreeResultPresentation(null, Array(12).fill(5)), null);
  assert.equal(getSleepFreeResultPresentation({ signatureKey: "calm_night", internalScores: { recovery: 0.8 } }, Array(12).fill(5)), null);
  const invalidAnswerResult = getSleepFreeResultPresentation(signatureFor(Array(12).fill(5)), [1, 2]);
  assert.equal(invalidAnswerResult.primaryInsight, "Tvoji odgovori donose nekoliko različitih pogleda na noć.");
  assert.equal(invalidAnswerResult.secondaryDetail, null);
});
