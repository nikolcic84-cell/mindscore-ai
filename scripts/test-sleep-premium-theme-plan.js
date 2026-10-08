import assert from "node:assert/strict";
import { buildSleepPremiumInput } from "../server/sleepPremiumInput.js";
import { buildSleepPremiumThemePlan } from "../server/sleepPremiumThemePlan.js";
import { buildSleepPremiumPrompt } from "../server/sleepPremiumPrompt.js";
import { buildSleepPremiumFallback } from "../server/sleepPremiumFallback.js";
import { buildSleepPremiumJsonSchema, getSleepPremiumPriority, getSleepPremiumStrengthMode, validateSleepPremiumReport } from "../server/sleepPremiumSchema.js";

const oneTheme = [5, 1, 5, 5, 5, 1, 1, 5, 5, 5, 5, 5];
const twoThemes = [5, 1, 1, 5, 5, 1, 1, 5, 5, 5, 5, 5];
const threeThemes = [5, 1, 1, 2, 5, 1, 1, 5, 2, 2, 5, 5];
const fourThemes = [2, 1, 1, 2, 2, 1, 1, 2, 2, 2, 2, 2];
const fixtures = [oneTheme, twoThemes, threeThemes, fourThemes];
for (let index = 0; index < fixtures.length; index += 1) {
  const input = buildSleepPremiumInput(fixtures[index]);
  const snapshot = structuredClone(input);
  const plan = buildSleepPremiumThemePlan(input);
  assert.equal(plan.theme_map.length, index + 1);
  assert.deepEqual(buildSleepPremiumThemePlan(input), plan, "planning is deterministic");
  assert.deepEqual(input, snapshot, "planning cannot modify scores, profile, original answers or classifier input");
  const ids = new Set(plan.theme_map.map(({ theme_id }) => theme_id));
  assert.ok(ids.has(plan.priority_theme));
  assert.equal(plan.priority_area, getSleepPremiumPriority(input).title);
  for (const theme of plan.theme_map) {
    assert.ok(theme.evidence.length);
    for (const entry of theme.evidence) {
      assert.equal(entry.answer, input.answers.find(({ questionId }) => questionId === entry.questionId).answer);
    }
  }
  const days = plan.allocation.seven_day_plan;
  assert.deepEqual(days.map(({ day }) => day), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(days.map(({ purpose }) => purpose), ["BASELINE", "PRIORITY_EXPERIMENT", "OTHER_SUPPORTED_AREA", "COMPARISON", "THIRD_ANGLE", "USER_CHOICE", "REVIEW"]);
  assert.equal(days[1].themeIds[0], plan.priority_theme);
  const experiments = [days[1], days[2], days[4]].map(({ themeIds }) => themeIds[0]);
  assert.equal(new Set(experiments).size, Math.min(3, ids.size));
  assert.equal(days[4].differentActionFromDay2And3, true);
  if (ids.size > 1) {
    assert.notEqual(experiments[1], plan.priority_theme);
    assert.ok(plan.allocation.tracking.every((id) => id !== plan.priority_theme));
    assert.ok(plan.allocation.alternatives.every((id) => id !== plan.priority_theme));
    assert.ok(plan.allocation.connections.every(({ themeIds }) => themeIds[0] !== themeIds[1]));
  }
  const represented = new Set(plan.allocation.connections.flatMap(({ themeIds }) => themeIds));
  assert.ok(represented.size >= Math.min(3, ids.size));
  for (const id of [
    ...days.flatMap(({ themeIds }) => themeIds), ...plan.allocation.tracking,
    ...plan.allocation.alternatives, ...represented,
  ]) assert.ok(ids.has(id), "no unsupported theme allocated");
  const prompt = buildSleepPremiumPrompt(input, { profile: input.profile, priorityArea: getSleepPremiumPriority(input).title, mode: getSleepPremiumStrengthMode(input) });
  const line = prompt.split("\n").find((entry) => entry.startsWith("Interni plan sadržaja (ne vraćaj u izveštaju): "));
  assert.deepEqual(JSON.parse(line.slice(line.indexOf(": ") + 2)), plan);
  assert.match(prompt, /ne menjaj raspodelu dana/);
  assert.match(prompt, /nikada ne stavljaj u korisnički tekst/);
  assert.match(prompt, /Telefon, pisanje misli i muzika nisu tri teme/);
  assert.match(prompt, /Opažanja nisu uzroci/);
  const report = buildSleepPremiumFallback(input);
  assert.equal(validateSleepPremiumReport(report, input).valid, true);
  assert.equal(report.profile, snapshot.profile);
  assert.equal(Object.hasOwn(report, "theme_map"), false);
  const customerCopy = [report.profile_explanation, report.priority.explanation,
    ...report.connections.map(({ text }) => text), ...report.stable_or_tracking.items,
    ...report.seven_day_plan.flatMap(({ action, observe }) => [action, observe]),
    ...report.alternatives, ...report.review_questions, report.after_seven_days, report.closing].join("\n");
  assert.doesNotMatch(customerCopy, /BEDTIME_TRANSITION|RECOVERY_DURATION|NIGHT_CONTINUITY|RHYTHM_WAKE|theme_id|theme_map|\bQ(?:[1-9]|1[0-2])\b/u);
  assert.equal(Object.hasOwn(buildSleepPremiumJsonSchema(input).schema.properties, "theme_map"), false);
}
const narrow = buildSleepPremiumThemePlan(buildSleepPremiumInput(oneTheme));
assert.deepEqual(narrow.theme_map.map(({ theme_id }) => theme_id), ["BEDTIME_TRANSITION"], "calm night/rhythm/recovery cannot be invented as difficulties");
const calm = buildSleepPremiumThemePlan(buildSleepPremiumInput(Array(12).fill(5)));
assert.equal(calm.theme_map.length, 1);
assert.deepEqual(calm.theme_map[0].focusQuestionIds, [], "positive evidence does not create a problem");
const overallConcern = buildSleepPremiumThemePlan(buildSleepPremiumInput([5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 3]));
assert.equal(overallConcern.theme_map.some(({ theme_id }) => theme_id === "NIGHT_CONTINUITY"), false, "overall dissatisfaction alone does not imply awakenings");
const invalid = buildSleepPremiumInput(oneTheme);
invalid.answers[0].answer = "invented answer";
assert.throws(() => buildSleepPremiumThemePlan(invalid), /Canonical selected answer/);
console.log("Deterministic internal Premium theme planning, supported diversity, immutable profile and public-schema isolation passed.");