import assert from "node:assert/strict";
import test from "node:test";
import { buildSleepPremiumReport } from "./sleepPremiumReport.js";
import { buildSleepPremiumPdf } from "../sleepPremiumPdf.js";

const toPoints = (indexes) => indexes.map((index) => 5 - index);
const personas = [
  { name: "MIRNA NOĆ", indexes: Array(12).fill(0) },
  { name: "UMORNO BUĐENJE", indexes: [4, 0, 0, 4, 0, 0, 0, 4, 0, 0, 4, 0] },
  { name: "BUDAN UM", indexes: [0, 4, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0] },
  { name: "ISPREKIDANA NOĆ", indexes: [0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { name: "PROMENLJIV RITAM", indexes: [0, 0, 0, 0, 3, 0, 0, 0, 4, 4, 0, 0] },
  { name: "PRAZNA BATERIJA", indexes: Array(12).fill(4) },
  { name: "SAN POD PRITISKOM", indexes: [4, 4, 0, 4, 3, 0, 4, 4, 4, 4, 4, 0] },
];

const allText = (report) => report.sections.flatMap((section) => [
  section.title,
  ...(section.paragraphs || []),
  ...(section.bullets || []),
]).join("\n");

test("builds a personalized Serbian sleep report and PDF for every signature persona", () => {
  const reports = personas.map(({ name, indexes }) => {
    const answers = toPoints(indexes);
    const report = buildSleepPremiumReport(answers, [{ name: "Sleep Recovery" }]);
    const pdf = buildSleepPremiumPdf({ answers, dimensions: [{ name: "Sleep Recovery" }] });
    const bytes = Buffer.from(pdf.output("arraybuffer"));
    const text = allText(report);

    assert.equal(report.signature.signature, name);
    assert.equal(report.sections.length, 8);
    assert.ok(bytes.length > 2_000);
    assert.equal(bytes.subarray(0, 5).toString("ascii"), "%PDF-");
    assert.ok(text.includes("Tvoj potpis sna"));
    assert.ok(text.includes("Tvoj plan za narednih 7 dana"));
    assert.ok(text.includes("Ovaj izveštaj je informativnog karaktera i nije medicinska dijagnoza."));
    assert.doesNotMatch(text, /AI Confidence|psychological assessment|psihološka procena|\/100|\b\d+\s*%/i);
    assert.doesNotMatch(text, /internalScores|sleepOnset|continuity|recovery|rhythm/);

    return { report, text, bytes };
  });

  assert.equal(new Set(reports.map(({ report }) => report.signature.signature)).size, 7);
  assert.equal(new Set(reports.map(({ text }) => text)).size, 7);
  assert.ok(new Set(reports.map(({ bytes }) => bytes.length)).size > 1);
});

test("specific answer changes personalize report evidence even when the signature remains the same", () => {
  const firstAnswers = toPoints([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const secondIndexes = [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const secondAnswers = toPoints(secondIndexes);
  const first = buildSleepPremiumReport(firstAnswers);
  const second = buildSleepPremiumReport(secondAnswers);

  assert.equal(first.signature.signature, second.signature.signature);
  assert.notEqual(allText(first), allText(second));
  assert.match(allText(first), /Zaspim vrlo brzo/);
  assert.match(allText(second), /Treba mi malo vremena/);
});

test("rejects missing or invalid original answer sets", () => {
  assert.throws(() => buildSleepPremiumReport([5, 4]), /twelve valid sleep answers/i);
  assert.throws(() => buildSleepPremiumReport([...Array(11).fill(5), 8]), /twelve valid sleep answers/i);
});
