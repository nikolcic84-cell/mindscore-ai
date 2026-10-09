import assert from "node:assert/strict";
import test from "node:test";
import library from "../src/psychology/sleep_content_library_44.json" with { type: "json" };
import { selectSleepContentModules } from "../src/psychology/sleepContentModuleSelector.js";

const cases = {
  A: [1,1,1,1,1,1,1,1,1,1,1,1], // MIRNA NOĆ: all favorable answers
  B: [1,1,1,1,1,1,1,1,1,1,1,2], // MIRNA NOĆ: occasional bad night
  C: [1,1,1,1,1,5,4,1,1,1,1,1], // BUDAN UM: scrolling + active thoughts
  D: [1,5,1,1,1,1,4,1,1,1,1,1], // BUDAN UM: active thoughts, no phone issue
  E: [1,1,5,1,1,1,1,1,1,1,1,5], // ISPREKIDAN SAN, daytime works well
  F: [5,1,1,5,1,1,1,4,1,1,1,1], // UMORAN SAN, 7–9 hours
  G: [5,5,1,5,1,5,5,4,1,1,1,5], // SAN POD PRITISKOM, several supported issues
  H: [1,1,1,1,1,2,1,1,5,4,1,5], // unstable rhythm without onset difficulty
};
const choose = (answers) => selectSleepContentModules(answers, library);
const redundancyGroups = [...library.selection.redundancy_groups,
  ["U01", "U02"], ["M01", "M02", "M03", "M04", "M05"], ["N01", "N02", "N07"],
  ["R01", "R02", "R04"], ["R03", "T03"], ["C01", "C02", "C04", "C05", "R06", "T05"],
];
const hasSemanticDuplicates = (moduleIds) => redundancyGroups.some((group) =>
  moduleIds.filter((id) => group.includes(id)).length > 1);

const expected = {
  A: ["P01", "P02"],
  B: ["P03", "P01"],
  C: ["U04", "M01"],
  D: ["M03", "U02"],
  E: ["N01"],
  F: ["R03", "E04", "R01"],
  G: ["R03", "E04", "M03", "U04"],
  H: ["C02"],
};

for (const [key, answers] of Object.entries(cases)) {
  test(`${key}: selects the expected answer-supported modules without duplicates`, () => {
    const result = choose(answers);
    assert.deepEqual(result.moduleIds, expected[key]);
    assert.equal(result.moduleIds.length, result.modules.length);
    const limits = { "MIRNA NOĆ": 2, "UMORAN SAN": 3, "BUDAN UM": 3, "ISPREKIDAN SAN": 3, "SAN POD PRITISKOM": 4 };
    assert.ok(result.moduleIds.length <= limits[result.profile]);
    assert.equal(hasSemanticDuplicates(result.moduleIds), false);
    for (const module of result.modules) {
      assert.strictEqual(module, library.modules.find(({ id }) => id === module.id));
      assert.equal(module.automatic_eligible, true);
    }
    assert.ok(result.summary.length > 0);
  });
}

test("MIRNA NOĆ preservation is answer-specific and respects the two-module cap", () => {
  assert.deepEqual(choose(cases.A).moduleIds, ["P01", "P02"]);
  assert.ok(!choose(cases.A).moduleIds.includes("P03"), "no occasional-bad-night module without that answer");
  assert.ok(!choose(cases.A).moduleIds.includes("P04"), "stable rhythm module is not padded into the output");
  assert.ok(choose(cases.B).moduleIds.includes("P03"), "Q12 occasional-bad-night answer activates P03");
  assert.ok(choose(cases.B).moduleIds.length <= 2);
});

test("same BUDAN UM profile changes modules with the phone answer", () => {
  const scrolling = choose(cases.C);
  const noPhone = choose(cases.D);
  assert.equal(scrolling.profile, "BUDAN UM");
  assert.equal(noPhone.profile, "BUDAN UM");
  assert.ok(scrolling.moduleIds.includes("U04"));
  assert.ok(!noPhone.moduleIds.includes("U04"));
  assert.ok(scrolling.moduleIds.includes("M01"));
  assert.ok(noPhone.moduleIds.some((id) => ["M01", "M02", "M03", "M04", "M05"].includes(id)));
});

test("answer safeguards suppress unsupported onset, phone, awakening, duration, and rhythm advice", () => {
  assert.ok(!choose([1,1,1,1,1,1,5,1,1,1,1,1]).moduleIds.some((id) => id.startsWith("U")), "Q2 option 1 supports no onset-difficulty advice");
  assert.ok(!choose([1,1,1,1,1,2,5,1,1,1,1,1]).moduleIds.includes("U04"), "Q6 option 2 is not scrolling/phone difficulty");
  assert.ok(!choose([1,1,2,1,1,1,1,1,1,1,1,1]).moduleIds.some((id) => ["N01", "N02", "N07"].includes(id)), "one brief awakening does not imply frequent awakenings");
  assert.ok(!choose([1,1,1,1,1,1,1,1,1,1,1,1]).moduleIds.some((id) => ["T01", "T02", "T03"].includes(id)), "7–9 hours does not trigger more-sleep advice");
  assert.ok(!choose([1,1,1,1,1,1,1,1,1,1,1,1]).moduleIds.some((id) => ["C01", "C02", "C04", "C05", "R06", "T05"].includes(id)), "stable rhythm does not trigger schedule advice");
  const longUnrested = choose([5,1,1,5,5,1,1,5,1,1,5,1]);
  assert.ok(longUnrested.moduleIds.includes("T04"));
  assert.ok(!longUnrested.moduleIds.some((id) => ["T01", "T02", "T03"].includes(id)));
});

test("summary wording is grounded in answers and avoids unsupported statements", () => {
  const calm = choose(cases.A).summary;
  assert.match(calm, /lako zaspiš/u);
  assert.match(calm, /noć ti je uglavnom mirna/u);
  assert.match(calm, /Nema jakog signala/u);
  const occasional = choose(cases.B).summary;
  assert.doesNotMatch(occasional, /Nema jakog signala/u);
  assert.match(occasional, /povremeno se javi loša noć/u);
  const scrolling = choose(cases.C).summary;
  assert.match(scrolling, /skrolovanje pred spavanje/u);
  assert.match(scrolling, /aktivne misli/u);
  const noPhone = choose(cases.D).summary;
  assert.doesNotMatch(noPhone, /telefon|skrolovanje/iu);
  const rhythm = choose(cases.H).summary;
  assert.match(rhythm, /promenljivo vreme spavanja ili buđenja/u);
  assert.doesNotMatch(rhythm, /uspavljivanj/u);
});

test("selector preserves every library record and rejects invalid inputs", () => {
  const before = JSON.stringify(library);
  for (const answers of Object.values(cases)) choose(answers);
  assert.equal(JSON.stringify(library), before);
  assert.equal(library.modules.length, 44);
  assert.throws(() => selectSleepContentModules([1, 2], library), /twelve/iu);
  assert.throws(() => selectSleepContentModules(Array(12).fill(0), library), /twelve/iu);
  assert.throws(() => selectSleepContentModules(cases.A, { modules: [] }), /44-module/iu);
});

console.log("A–H profile and selected IDs:", JSON.stringify(Object.fromEntries(
  Object.entries(cases).map(([key, answers]) => {
    const result = choose(answers);
    return [key, { profile: result.profile, moduleIds: result.moduleIds }];
  })), null, 2));
