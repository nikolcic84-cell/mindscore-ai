import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import sleepContentLibrary from "../src/psychology/sleep_content_library_44.json" with { type: "json" };
import { buildFreeModuleView } from "../src/psychology/sleepFreeModuleView.js";
import { selectSleepContentModules } from "../src/psychology/sleepContentModuleSelector.js";
import { SLEEP_ANSWER_OPTIONS } from "../src/psychology/sleepAssessmentContent.js";

const fixtures = {
  CALM: [1,1,1,1,1,1,1,1,1,1,1,1],
  UMORAN: [5,1,1,5,1,1,1,5,1,1,5,1],
  BUDAN: [1,5,1,1,1,2,5,1,1,1,1,1],
  FRAGMENTED: [1,1,4,1,1,1,1,1,1,1,1,3],
};
const escapeHtml = (text) => text.replace(/[&<>"']/gu, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#x27;",
})[character]);

let vite;
let PremiumResult;
let parsePremiumModuleText;
test("load module-only PremiumResult through Vite SSR", async (t) => {
  vite = await createServer({ configFile: "vite.config.js", server: { middlewareMode: true }, appType: "custom" });
  t.after(async () => vite?.close());
  ({ default: PremiumResult, parsePremiumModuleText } = await vite.ssrLoadModule("/src/components/PremiumResult.jsx"));
  assert.equal(typeof PremiumResult, "function");
  assert.equal(typeof parsePremiumModuleText, "function");
});

const render = (options) => renderToStaticMarkup(React.createElement(PremiumResult, {
  answers: options,
}));

test("PremiumResult renders selected customer-facing sections and hides internal module metadata", { concurrency: false }, () => {
  for (const answers of Object.values(fixtures)) {
    const selected = selectSleepContentModules(answers, sleepContentLibrary);
    const html = render(answers);
    assert.match(html, /<h1>TVOJA PRIČA O SNU<\/h1>/u);
    assert.ok(html.includes(`<p>${escapeHtml(selected.summary)}</p>`), "selector summary is displayed below the title");
    assert.equal((html.match(/class="premium-module-item"/gu) || []).length, selected.modules.length);
    for (const index of selected.modules.keys()) {
      assert.ok(html.includes(`<span class="premium-module-number">${String(index + 1).padStart(2, "0")}</span>`));
    }
    for (const module of selected.modules) {
      assert.ok(html.includes(`<h2>${escapeHtml(module.title)}</h2>`), `${module.id} original title is rendered`);
      const copy = parsePremiumModuleText(module.text);
      if (copy.mainText) assert.ok(html.includes(`<p>${escapeHtml(copy.mainText)}</p>`), `${module.id} main copy is preserved`);
      if (copy.steps.length) {
        assert.ok(html.includes("<h3>PROBAJ</h3>"), `${module.id} action heading is shown`);
        for (const step of copy.steps) assert.ok(html.includes(`<li>${escapeHtml(step)}</li>`), `${module.id} action text is preserved`);
      }
      if (copy.alternative) assert.ok(html.includes(`<h3>Ako ti ovo ne odgovara</h3><p>${escapeHtml(copy.alternative)}</p>`));
      if (copy.track) assert.ok(html.includes(`<h3>Obrati pažnju</h3><p>${escapeHtml(copy.track)}</p>`));
    }
    for (const module of sleepContentLibrary.modules) {
      if (!selected.moduleIds.includes(module.id)) {
        assert.ok(!html.includes(`<h2>${escapeHtml(module.title)}</h2>`), `${module.id} is not rendered unless selected`);
      }
    }
    assert.doesNotMatch(html, /OBLAST:|OKIDAČ:|OGRANIČENJE:|\bQ\d+\b|candidate_condition|original_trigger_note/u);
    assert.doesNotMatch(html, /TVOJ DETALJNI REZULTAT|Šta se kod tebe izdvaja|Šta ti već prija|TVOJ POČETNI FOKUS|Jedan sledeći korak|TVOJ LIČNI PLAN/u);
    const notice = "Ovaj rezultat je informativnog karaktera i ne predstavlja medicinsku dijagnozu. Ako su problemi sa spavanjem izraženi, dugotrajni ili utiču na bezbednost i svakodnevno funkcionisanje, razgovaraj sa lekarom.";
    assert.equal((html.match(new RegExp(escapeHtml(notice), "gu")) || []).length, 1);
  }
});

test("PremiumResult exposes distinct, selector-generated summaries for scrolling and no-phone answer patterns", { concurrency: false }, () => {
  const scrollingAnswers = [1,1,1,1,1,5,4,1,1,1,1,1];
  const noPhoneAnswers = [1,5,1,1,1,1,4,1,1,1,1,1];
  const scrollingResult = selectSleepContentModules(scrollingAnswers, sleepContentLibrary);
  const noPhoneResult = selectSleepContentModules(noPhoneAnswers, sleepContentLibrary);
  const scrollingHtml = render(scrollingAnswers);
  const noPhoneHtml = render(noPhoneAnswers);
  assert.ok(scrollingHtml.includes(`<p>${escapeHtml(scrollingResult.summary)}</p>`));
  assert.ok(noPhoneHtml.includes(`<p>${escapeHtml(noPhoneResult.summary)}</p>`));
  assert.match(scrollingResult.summary, /skrolovanje pred spavanje/u);
  assert.doesNotMatch(noPhoneResult.summary, /telefon|skrolovanje/iu);
  assert.notEqual(scrollingResult.summary, noPhoneResult.summary);
});

test("MIRNA NOĆ displays the selector's curated P modules", { concurrency: false }, () => {
  const html = render(fixtures.CALM);
  const selected = selectSleepContentModules(fixtures.CALM, sleepContentLibrary);
  assert.equal(selected.profile, "MIRNA NOĆ");
  assert.deepEqual(selected.moduleIds, ["P01", "P02"]);
  for (const module of selected.modules) {
    assert.ok(html.includes(`<h2>${escapeHtml(module.title)}</h2>`));
    const copy = parsePremiumModuleText(module.text);
    if (copy.mainText) assert.ok(html.includes(escapeHtml(copy.mainText)));
    assert.ok(copy.steps.every((step) => html.includes(escapeHtml(step))));
  }
  assert.match(html, /<span class="premium-module-number">01<\/span>/u);
  assert.doesNotMatch(html, /<span class="premium-module-number">03<\/span>/u);
});

test("FREE module disclosure uses real profile modules and never includes the full second module", { concurrency: false }, () => {
  const profiles = {
    "MIRNA NOĆ": { answers: [1,1,1,1,1,1,1,1,1,1,1,1], ids: ["P01", "P02"] },
    "BUDAN UM": { answers: [1,1,1,1,1,5,4,1,1,1,1,1], ids: ["U04", "M01"] },
    "SAN POD PRITISKOM": { answers: [5,5,1,5,1,5,5,4,1,1,1,5], ids: ["R03", "E04", "M03", "U04"] },
  };

  for (const [profile, { answers, ids }] of Object.entries(profiles)) {
    const selected = selectSleepContentModules(answers, sleepContentLibrary);
    assert.equal(selected.profile, profile);
    assert.deepEqual(selected.moduleIds, ids, `${profile} uses its actual answer-selected modules in order`);
    const view = buildFreeModuleView(selected.modules, parsePremiumModuleText);
    assert.equal(view.primary?.module.id, selected.moduleIds[0]);
    assert.equal(view.preview?.id ?? null, selected.moduleIds[1] ?? null);
    assert.equal(view.preview?.title ?? null, selected.modules[1]?.title ?? null);
    if (selected.modules.length > 1) {
      const second = selected.modules[1];
      assert.ok(view.preview.excerpt.length <= 191);
      assert.ok(view.preview.excerpt.length > 0);
      assert.notEqual(view.preview.excerpt, second.text);
      const secondCopy = parsePremiumModuleText(second.text);
      assert.ok(!view.preview.excerpt.includes(secondCopy.steps[0]));
      if (secondCopy.alternative) assert.ok(!view.preview.excerpt.includes(secondCopy.alternative));
      if (secondCopy.track) assert.ok(!view.preview.excerpt.includes(secondCopy.track));
    }
  }

  const oneModule = selectSleepContentModules([1,1,5,1,1,1,1,1,1,1,1,5], sleepContentLibrary).modules.slice(0, 1);
  const single = buildFreeModuleView(oneModule, parsePremiumModuleText);
  assert.ok(single.primary);
  assert.equal(single.preview, null);
});

test("module parsing leaves all 44 library records untouched and never exposes per-card restriction copy", () => {
  const before = JSON.stringify(sleepContentLibrary);
  for (const module of sleepContentLibrary.modules) {
    const copy = parsePremiumModuleText(module.text);
    assert.ok(copy.steps.length > 0, `${module.id} has concrete steps`);
    assert.ok(!copy.mainText.includes("OBLAST:") && !copy.mainText.includes("OKIDAČ:"));
    assert.ok(!JSON.stringify(copy).includes("OGRANIČENJE:"));
    assert.ok(!/\bQ\d+\b/u.test(JSON.stringify(copy)));
  }
  assert.equal(JSON.stringify(sleepContentLibrary), before);
});
