import assert from "node:assert/strict";
import test from "node:test";
import { buildSleepPremiumInput } from "../server/sleepPremiumInput.js";
import { buildSleepPremiumWriterBrief } from "../server/sleepPremiumWriterBrief.js";
import { buildSleepPremiumStoryMaster } from "../server/sleepPremiumStoryMaster.js";
import {
  buildDeterministicSleepPremiumStoryReport,
  generateSleepPremiumStoryReport,
  validateSleepPremiumStoryProse,
} from "../server/sleepPremiumStoryWriter.js";
import { benchmarkFixtures } from "./debug-sleep-premium-story-material.js";

const inputs = benchmarkFixtures.map(({ answers }) => buildSleepPremiumInput(answers));
const masters = inputs.map((input) => buildSleepPremiumStoryMaster(input));
const savedEnv = { branch: process.env.RENDER_GIT_BRANCH, enabled: process.env.ENABLE_PREMIUM_AI_PREVIEW };
process.env.RENDER_GIT_BRANCH = "premium-ai-staging";
process.env.ENABLE_PREMIUM_AI_PREVIEW = "true";
test.after(() => {
  if (savedEnv.branch === undefined) delete process.env.RENDER_GIT_BRANCH; else process.env.RENDER_GIT_BRANCH = savedEnv.branch;
  if (savedEnv.enabled === undefined) delete process.env.ENABLE_PREMIUM_AI_PREVIEW; else process.env.ENABLE_PREMIUM_AI_PREVIEW = savedEnv.enabled;
});

function baselineProse(master) {
  const prose = {
    story_intro: "U tvojim odgovorima pojavljuje se nekoliko delova iskustva sa snom: završetak večeri, tok noći, jutro i energija tokom dana. Svaki opis govori o svom delu, pa ih vredi čitati odvojeno. Odabrani uvidi izdvajaju konkretne odgovore i pokazuju šta je u njima vredno pažnje. Kada je za razumevanje potrebno poređenje, ono ostaje otvoreno dok ne znamo kako se utisci raspoređuju po noćima ili danima. Deo plana već je određen iz tvojih odgovora; ova priča ga ne menja niti mu dodaje novu radnju. Sačuvane osobine imaju svoje mesto uz uvid, bez pretvaranja u drugi prioritet. Tekst se drži onoga što si prijavio i ne dopunjava praznine pretpostavkama.",
    insight_1_explanation: "Odabrani odgovori daju dva odvojena ugla; nije poznato da li se javljaju iste noći.",
    experiment_explanation: "Plan razdvaja već izabrane uglove kako bi ostalo jasno šta je izvodljivo, bez menjanja svega odjednom.",
  };
  prose.insight_2_explanation = master.master.selectedInsights.length >= 2
    ? "Sledeći uvid izdvaja drugi deo odgovora koji prvi ne obuhvata." : null;
  if (master.master.selectedInsights.length >= 3) prose.insight_3_explanation = "Treći uvid dodaje zaseban podatak iz tvojih odgovora.";
  prose.do_not_change_explanation = master.master.doNotTargetFirst.length
    ? "Ovaj deo već opisuje osobinu koju želiš da sačuvaš." : null;
  prose.open_question_explanation = master.master.openQuestion
    ? "Poređenje bi razjasnilo da li se ova dva opisa odnose na istu noć." : null;
  return prose;
}

function mockResponse(master, mutate = (value) => value) {
  const prose = mutate(baselineProse(master));
  return { status: "completed", id: "resp_testStoryResponse123456", _request_id: "req_testStoryRequest123456",
    output_text: JSON.stringify(prose), usage: { input_tokens: 456, output_tokens: 234, total_tokens: 690 } };
}
function mockClient(responseFactory) {
  const calls = [];
  return { calls, client: { responses: { create: async (request, options) => {
    calls.push({ request, options });
    return responseFactory(request, options);
  } } } };
}

function customerCopy(report) {
  return JSON.stringify({
    sections: report.sections,
    profile: report.profile,
    priority: report.priority,
    insights: report.insights,
    do_not_change: report.do_not_change,
    open_question: report.open_question,
    experiment: report.experiment,
    science: report.science,
  });
}

test("deterministic master preserves engine selections and chronological seven-day allocation", () => {
  for (const [index, fixture] of benchmarkFixtures.entries()) {
    const master = masters[index].master;
    const brief = buildSleepPremiumWriterBrief(inputs[index]);
    assert.equal(master.profile, inputs[index].profile);
    assert.equal(master.priority.area, brief.priority.area);
    assert.deepEqual(master.selectedInsights.map(({ insightId }) => insightId),
      [brief.primary_insight, ...brief.secondary_insights].map(({ insight_id }) => insight_id));
    assert.equal(master.experiment.length, 7);
    assert.deepEqual(master.experiment.map(({ day }) => day), [1, 2, 3, 4, 5, 6, 7]);
    for (const [dayIndex, day] of master.experiment.entries()) {
      const allocated = brief.experiment7[dayIndex];
      assert.deepEqual(day.themeIds, allocated.themeIds);
      assert.equal(day.techniqueId, allocated.technique_id);
      if (fixture.id === "calm") {
        assert.equal(day.techniqueId, null);
        assert.match(day.action, /ništa ne moraš menjati/u);
      } else {
        assert.equal(day.action, allocated.action);
        assert.equal(day.observe, allocated.observe);
      }
    }
    assert.equal(master.profile, fixture.expectedProfile);
  }
});

test("v4 writer request is prose-only, customer-safe and contains no architecture-owned IDs", async () => {
  for (const [index, master] of masters.entries()) {
    const mock = mockClient(async (request, options) => {
      assert.equal(request.model, "gpt-5-mini");
      assert.equal(request.max_output_tokens, 8000);
      assert.equal(request.store, false);
      assert.deepEqual(request.reasoning, { effort: "low" });
      assert.equal(options.maxRetries, 0);
      const schema = request.text.format.schema;
      const expectedKeys = ["story_intro", "insight_1_explanation", "insight_2_explanation",
        ...(master.master.selectedInsights.length >= 3 ? ["insight_3_explanation"] : []),
        "do_not_change_explanation", "open_question_explanation", "experiment_explanation"];
      assert.deepEqual(schema.required, expectedKeys);
      assert.ok(!schema.properties.profile && !schema.properties.priority && !schema.properties.plan7 && !schema.properties.provenance);
      assert.equal(request.input[1].content, JSON.stringify(master.writerBrief));
      const requestText = request.input.map(({ content }) => content).join(" ");
      for (const id of [...master.master.selectedInsights.map(({ insightId }) => insightId),
        ...master.master.science.map(({ claimId }) => claimId), ...master.master.experiment.flatMap(({ techniqueId, themeIds }) => [techniqueId, ...themeIds].filter(Boolean))]) {
        assert.ok(!requestText.includes(id), `writer brief must not expose internal ID ${id}`);
      }
      return mockResponse(master);
    });
    const result = await generateSleepPremiumStoryReport({ input: inputs[index], openaiClient: mock.client, apiKeyAvailable: true });
    assert.equal(result.source, "ai", JSON.stringify(result.failure));
    assert.equal(result.validation.valid, true);
    assert.equal(result.requestCount, 1);
    assert.equal(result.report.profile, master.master.profile);
    assert.equal(result.report.priority.area, master.master.priority.area);
    assert.deepEqual(result.report.experiment.days.map(({ day }) => day), [1, 2, 3, 4, 5, 6, 7]);
    assert.equal(mock.calls.length, 1);
  }
});

test("model attempts to change profile/priority/insights/plan/evidence are rejected; deterministic master survives", async () => {
  const master = masters[0];
  const mock = mockClient(async () => ({ ...mockResponse(master), output_text: JSON.stringify({
    ...baselineProse(master), profile: "BUDAN UM", priority: { area: "Invented" }, selectedInsights: [],
    plan7: [{ day: 99, action: "Izmisli radnju" }], evidence_ids: ["FAKE_CLAIM"], technique_ids: ["FAKE_TECHNIQUE"],
  }) }));
  const result = await generateSleepPremiumStoryReport({ input: inputs[0], openaiClient: mock.client, apiKeyAvailable: true });
  assert.equal(result.source, "fallback");
  assert.equal(result.failure.category, "shape");
  assert.equal(result.report.profile, master.master.profile);
  assert.equal(result.report.priority.area, master.master.priority.area);
  assert.deepEqual(result.report.insights.map(({ title }) => title), master.master.selectedInsights.map(({ title }) => title));
  assert.deepEqual(result.report.experiment.days.map(({ day }) => day), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(result.report.science.flatMap(({ explanation }) => [explanation]), master.master.science.map(({ approvedText }) => approvedText));
});

test("prose gate rejects IDs, English placeholders, unsupported claims and machine metadata", () => {
  const master = masters[0].master;
  for (const [field, value, category] of [
    ["story_intro", "FACT_Q3 appeared here.", "machine_id"],
    ["insight_1_explanation", "SLEEP_MULTIDIMENSIONAL is relevant.", "machine_id"],
    ["story_intro", "Begin the allocated plan; no additional action.", "english_placeholder"],
    ["insight_1_explanation", "Ova navika sigurno popravlja san.", "guarantee"],
    ["insight_1_explanation", "Objektivno izmeri buđenja tokom noći.", "objective_measurement"],
    ["insight_1_explanation", "Mislima zbog toga teško zaspiš.", "causal_claim"],
    ["insight_1_explanation", "Osećaj isprekidanosti često se javlja zajedno sa mirnim jutrom.", "unsupported_cooccurrence"],
    ["insight_1_explanation", "U maloj studiji iz 2020. godine.", "invented_citation"],
    ["story_intro", "Ovaj izveštaj koristi classifier i scoring.", "internal_language"],
  ]) {
    const prose = baselineProse(masters[0]);
    prose[field] = value;
    if (field === "story_intro") prose.story_intro = `${value} ${"Ovi odgovori ostaju lični opisi bez dodatnih predviđanja. ".repeat(12)}`;
    assert.equal(validateSleepPremiumStoryProse(prose, master).category, category, `${field}: ${value}`);
  }
});

test("narrow safety exceptions allow ordinary Serbian and negated caveats but reject actual claims", () => {
  const master = masters[0].master;
  const accepted = [
    ["insight_1_explanation", "Imaš potrebu za kafom tokom dana."],
    ["insight_1_explanation", "Lični utisak, bez izvlačenja brzih zaključaka o uzroku."],
    ["insight_1_explanation", "Ovo je opis odgovora, bez tvrdnji o uzrocima ili terapiji."],
    ["insight_1_explanation", "Opis ostaje lični, bez zaključaka o uzroku ili dijagnozi."],
    ["insight_1_explanation", "Navodiš isprekidane noći i odmorna jutra. Još ne znamo da li se javljaju istih noći."],
  ];
  for (const [field, value] of accepted) {
    const prose = baselineProse(masters[0]);
    prose[field] = value;
    assert.equal(validateSleepPremiumStoryProse(prose, master).valid, true, value);
  }

  const rejected = [
    ["insight_1_explanation", "Ovaj odgovor potvrđuje da imaš nesanicu.", "medical_or_diagnostic"],
    ["insight_1_explanation", "Za teškoće sa snom preporučuje se terapija.", "medical_or_diagnostic"],
    ["insight_1_explanation", "Uzmi lek za lakše uspavljivanje.", "medical_or_diagnostic"],
    ["insight_1_explanation", "Promenljiv raspored doprinosi kraćem snu.", "causal_claim"],
    ["insight_1_explanation", "Isprekidane noći utiču na odmorna jutra.", "causal_claim"],
    ["insight_1_explanation", "Isprekidane noći su povezane sa odmornim jutrima.", "unsupported_cooccurrence"],
    ["insight_1_explanation", "Isprekidane noći često postoje zajedno sa odmornim jutrima.", "unsupported_cooccurrence"],
  ];
  for (const [field, value, category] of rejected) {
    const prose = baselineProse(masters[5]);
    prose[field] = value;
    assert.equal(validateSleepPremiumStoryProse(prose, masters[5].master).category, category, value);
  }
});

test("known v4 fact-strengthening paraphrases are rejected only when absent from selected facts", () => {
  const cases = [
    [0, "insight_1_explanation", "Spavaš 7–9 sati u krevetu."],
    [0, "insight_1_explanation", "Potreba za kafom pokazuje dnevnu pospanost."],
    [0, "insight_1_explanation", "Često se budiš više puta tokom noći."],
    [2, "insight_1_explanation", "Manjak energije čini te mrzovoljnijim."],
    [3, "insight_1_explanation", "Slobodnim danom bez alarma ostaješ kod kuće."],
    [1, "insight_1_explanation", "Osećaš napetost i pokušavaš da odvratiš pažnju od misli."],
  ];
  for (const [index, field, value] of cases) {
    const prose = baselineProse(masters[index]);
    prose[field] = value;
    const result = validateSleepPremiumStoryProse(prose, masters[index].master);
    assert.equal(result.category, "unsupported_fact_strengthening", value);
  }
});

test("deterministic sources and days survive prose success and provider/schema failure", async () => {
  const master = masters[1];
  const claimIds = master.master.science.map(({ claimId }) => claimId);
  assert.ok(claimIds.length > 0);
  for (const [label, client, keyAvailable] of [
    ["provider error", { responses: { create: async () => { throw new Error("private provider message"); } } }, true],
    ["missing key", { responses: { create: async () => { throw new Error("must not run"); } } }, false],
  ]) {
    const result = await generateSleepPremiumStoryReport({ input: inputs[1], openaiClient: client, apiKeyAvailable: keyAvailable });
    assert.equal(result.source, "fallback", label);
    assert.equal(result.report.insights.length, master.master.selectedInsights.length);
    assert.deepEqual(result.report.experiment.days.map(({ day }) => day), [1, 2, 3, 4, 5, 6, 7]);
    assert.deepEqual(result.report.science.map(({ explanation }) => explanation), master.master.science.map(({ approvedText }) => approvedText));
    assert.ok(result.report.science.every(({ sources }) => sources.length > 0));
    assert.ok(!JSON.stringify(result).includes("private provider message"));
  }
});

test("C/E-style incomplete diagnostics preserve safe response metadata and complete deterministic fallback", async () => {
  const fixtureIndex = 2;
  const master = masters[fixtureIndex].master;
  const privateMarker = "synthetic-private-provider-marker";
  const provider = { responses: { create: async () => ({
    id: "resp_testIncompleteResponse123456", _request_id: "req_testIncompleteRequest123456",
    status: "incomplete", incomplete_details: { reason: "max_output_tokens" },
    output_text: "", output: [],
    usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0, secret: privateMarker },
    error: { type: "server_error", code: "server_error", message: privateMarker },
  }) } };
  let observed;
  const result = await generateSleepPremiumStoryReport({ input: inputs[fixtureIndex], openaiClient: provider, apiKeyAvailable: true,
    onIncompleteResponse: (metadata) => { observed = metadata; } });
  assert.equal(result.source, "fallback");
  assert.equal(result.requestCount, 1);
  assert.equal(result.report.profile, master.profile);
  assert.deepEqual(result.report.experiment.days.map(({ day }) => day), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(result.rawGptProse, null);
  assert.equal(observed.status, "incomplete");
  assert.equal(observed.incompleteReason, "max_output_tokens");
  assert.equal(observed.requestId, "req_testIncompleteRequest123456");
  assert.equal(observed.responseId, "resp_testIncompleteResponse123456");
  assert.equal(observed.outputItemCount, 0);
  assert.equal(observed.usage.input_tokens, 0);
  assert.equal(observed.usage.output_tokens, 0);
  assert.deepEqual(observed.error, { code: "server_error", type: "server_error" });
  assert.ok(!JSON.stringify(observed).includes(privateMarker));
});

test("customer-facing assembly contains no machine IDs; source record is server-resolved", async () => {
  const master = masters[5];
  const mock = mockClient(async () => mockResponse(master));
  const result = await generateSleepPremiumStoryReport({ input: inputs[5], openaiClient: mock.client, apiKeyAvailable: true });
  const copy = customerCopy(result.report);
  for (const id of ["FACT_Q3", "SLEEP_MULTIDIMENSIONAL", "REGULAR_TIMES_GUIDANCE", "SELF_OBSERVATION", "RECOVERY_DURATION"]) {
    assert.ok(!copy.includes(id), `customer report must omit ${id}`);
  }
  assert.ok(result.report.science.every(({ sources }) => sources.every(({ title, url }) => title && url?.startsWith("https://"))));
  assert.deepEqual(result.report.experiment.days.map(({ day }) => day), [1, 2, 3, 4, 5, 6, 7]);
});

test("A/F retain different deterministic stories and MIRNA NOĆ invents no problem", () => {
  assert.equal(masters[0].master.profile, masters[5].master.profile);
  assert.notDeepEqual(masters[0].master.selectedInsights.map(({ insightId }) => insightId),
    masters[5].master.selectedInsights.map(({ insightId }) => insightId));
  assert.notDeepEqual(masters[0].master.selectedInsights.map(({ relationship }) => relationship),
    masters[5].master.selectedInsights.map(({ relationship }) => relationship));
  const calm = masters[4].master;
  const report = buildDeterministicSleepPremiumStoryReport(masters[4]).report;
  assert.equal(calm.profile, "MIRNA NOĆ");
  assert.deepEqual(calm.science, []);
  assert.equal(calm.openQuestion, null);
  assert.ok(!/problem|teškoć|poremeć|intervencij/iu.test(report.story_intro));
  assert.ok(calm.experiment.every(({ action, techniqueId }) => /ništa ne moraš menjati/iu.test(action) && techniqueId === null));
  assert.equal(report.sections.length, 6);
});

test("deterministic science claims retain canonical source records without GPT provenance", () => {
  for (const [index, fixture] of benchmarkFixtures.entries()) {
    const master = masters[index].master;
    const report = buildDeterministicSleepPremiumStoryReport(masters[index]).report;
    assert.deepEqual(report.science.map(({ explanation }) => explanation), master.science.map(({ approvedText }) => approvedText));
    assert.ok(report.science.every(({ sources, clinical_review_status }) =>
      sources.every(({ title, year, url }) => title && Number.isInteger(year) && url.startsWith("https://")) &&
      clinical_review_status === "pending"));
    if (fixture.id === "calm") assert.equal(report.science.length, 0);
    assert.ok(!Object.hasOwn(report, "provenance"));
  }
});

test("v2/v3 request diagnostics and history remain intact; story request brief is compact", () => {
  const baseline = [
    { input: 7779, briefChars: 19458, v2BriefChars: 15172, v3Input: 5808 },
    { input: 7987, briefChars: 20611, v2BriefChars: 15297, v3Input: 5706 },
    { input: null, briefChars: 16326, v2BriefChars: 13381, v3Input: null },
    { input: null, briefChars: 22762, v2BriefChars: 15518, v3Input: null },
    { input: null, briefChars: 9921, v2BriefChars: 8381, v3Input: null },
    { input: 8184, briefChars: 20160, v2BriefChars: 16024, v3Input: 5968 },
  ];
  assert.ok(masters.every(({ writerBrief }) => JSON.stringify(writerBrief).length < 6000));
  assert.equal(baseline.length, 6);
});
