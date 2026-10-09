import assert from "node:assert/strict";
import test, { after } from "node:test";
import express from "../server/node_modules/express/index.js";
import { createServer, request } from "node:http";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { registerSleepPremiumBenchmarkRoute } from "../server/sleepPremiumBenchmarkRoute.js";
import { benchmarkFixtures } from "./debug-sleep-premium-story-material.js";
import { buildSleepPremiumInput } from "../server/sleepPremiumInput.js";
import { buildSleepPremiumStoryMaster } from "../server/sleepPremiumStoryMaster.js";
import { SLEEP_PREMIUM_STORY_INSTRUCTIONS } from "../server/sleepPremiumStoryWriter.js";

const HOST = "mindscore-premium-staging.onrender.com";
const V3 = "/api/dev/premium-writer-benchmark-v3";
const V4 = "/api/dev/premium-writer-benchmark-v4";
const V5 = "/api/dev/premium-writer-benchmark-v5";
const staging = { RENDER_GIT_BRANCH: "premium-ai-staging", ENABLE_PREMIUM_AI_PREVIEW: "true",
  RENDER_EXTERNAL_HOSTNAME: HOST, RENDER_GIT_COMMIT: "a".repeat(40) };
const savedEnvironment = { branch: process.env.RENDER_GIT_BRANCH, enabled: process.env.ENABLE_PREMIUM_AI_PREVIEW };
process.env.RENDER_GIT_BRANCH = "premium-ai-staging";
process.env.ENABLE_PREMIUM_AI_PREVIEW = "true";
after(() => {
  if (savedEnvironment.branch === undefined) delete process.env.RENDER_GIT_BRANCH;
  else process.env.RENDER_GIT_BRANCH = savedEnvironment.branch;
  if (savedEnvironment.enabled === undefined) delete process.env.ENABLE_PREMIUM_AI_PREVIEW;
  else process.env.ENABLE_PREMIUM_AI_PREVIEW = savedEnvironment.enabled;
});
const longIntro = "U tvojim odgovorima pojavljuje se nekoliko delova iskustva sa snom: završetak večeri, tok noći, jutro i energija tokom dana. Svaki opis govori o svom delu, pa ih vredi čitati odvojeno. Odabrani uvidi izdvajaju konkretne odgovore i pokazuju šta je u njima vredno pažnje. Kada je za razumevanje potrebno poređenje, ono ostaje otvoreno dok ne znamo kako se utisci raspoređuju po noćima ili danima. Deo plana već je određen iz tvojih odgovora; ova priča ga ne menja niti mu dodaje novu radnju. Sačuvane osobine imaju svoje mesto uz uvid, bez pretvaranja u drugi prioritet. Tekst se drži onoga što si prijavio i ne dopunjava praznine pretpostavkama.";
const proseFor = (master) => ({
  story_intro: longIntro,
  insight_1_explanation: "Odabrani odgovori daju dva odvojena ugla; nije poznato da li se javljaju iste noći.",
  insight_2_explanation: master.selectedInsights.length >= 2 ? "Sledeći uvid izdvaja drugi deo odgovora koji prvi ne obuhvata." : null,
  ...(master.selectedInsights.length >= 3 ? { insight_3_explanation: "Treći uvid dodaje zaseban podatak iz tvojih odgovora." } : {}),
  do_not_change_explanation: master.doNotTargetFirst.length ? "Ovaj deo već opisuje osobinu koju želiš da sačuvaš." : null,
  open_question_explanation: master.openQuestion ? "Poređenje bi razjasnilo da li se ova dva opisa odnose na istu noć." : null,
  experiment_explanation: "Plan već sadrži odabrane korake; ovo polje ne dodaje novu radnju.",
});

async function setup(t, handler) {
  const root = await mkdtemp(join(tmpdir(), "premium-story-v4-"));
  const v1Dir = join(root, "premium-writer-benchmark-v1");
  const v2Dir = join(root, "premium-writer-benchmark-v2");
  const v3Dir = join(root, "premium-writer-benchmark-v3");
  for (const directory of [v1Dir, v2Dir, v3Dir]) await mkdir(directory, { recursive: true });
  t.after(() => rm(root, { recursive: true, force: true }));
  const calls = [];
  const client = { responses: { create: async (body, options) => {
    calls.push({ body, options });
    return handler(body, options, calls.length - 1);
  } } };
  const app = express();
  app.set("trust proxy", true);
  const registered = registerSleepPremiumBenchmarkRoute(app, { cacheDir: v1Dir, env: staging,
    openaiClient: client, apiKeyAvailable: true });
  assert.equal(registered, true);
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const send = (method, path, body) => new Promise((resolve, reject) => {
    const req = request({ host: "127.0.0.1", port: server.address().port, method, path,
      headers: { Host: HOST, ...(body ? { "Content-Type": "application/json" } : {}) } }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString("utf8")) }));
    });
    req.on("error", reject);
    if (body) req.end(JSON.stringify(body)); else req.end();
  });
  return { root, v1Dir, v2Dir, v3Dir, calls, send };
}

test("v5 returns complete structured prose-only reports and derives every report scaffold deterministically", async (t) => {
  const expectedRawProse = [];
  const app = await setup(t, async (requestBody, options, index) => {
    const input = buildSleepPremiumInput(benchmarkFixtures[index].answers);
    const master = buildSleepPremiumStoryMaster(input).master;
    assert.equal(options.maxRetries, 0);
    assert.equal(requestBody.model, "gpt-5-mini");
    assert.equal(requestBody.max_output_tokens, 8000);
    assert.equal(requestBody.input[0].content, SLEEP_PREMIUM_STORY_INSTRUCTIONS);
    const writer = JSON.parse(requestBody.input[1].content);
    for (const forbidden of ["profile", "priority", "plan7", "days", "techniqueId", "technique_id", "science_ids", "evidence_ids", "provenance", "fact_id"]) {
      assert.equal(Object.hasOwn(writer, forbidden), false, `writer brief excludes ${forbidden}`);
    }
    assert.equal(Object.hasOwn(requestBody.text.format.schema.properties, "profile"), false);
    assert.equal(Object.hasOwn(requestBody.text.format.schema.properties, "plan7"), false);
    assert.equal(Object.hasOwn(requestBody.text.format.schema.properties, "provenance"), false);
    const prose = proseFor(master);
    expectedRawProse[index] = structuredClone(prose);
    return { status: "completed", id: `resp_storySyntheticResponse${index}abcdef`,
      _request_id: `req_storySyntheticRequest${index}abcdef`, output_text: JSON.stringify(prose),
      usage: { input_tokens: 410, output_tokens: 260, total_tokens: 670 } };
  });

  for (const [index, fixture] of benchmarkFixtures.entries()) {
    const response = await app.send("POST", V5, { fixture: "".concat("ABCDEF"[index]) });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.version, "phase2bench.v5");
    assert.equal(response.body.status, "completed", JSON.stringify(response.body.result.failure));
    const report = response.body.result;
    const expectedMaster = buildSleepPremiumStoryMaster(buildSleepPremiumInput(fixture.answers)).master;
    assert.equal(report.source, "ai", JSON.stringify(report.failure));
    assert.equal(report.validation.valid, true, JSON.stringify(report.failure));
    assert.equal(report.assembled_report.profile, expectedMaster.profile);
    assert.equal(report.assembled_report.priority.area, expectedMaster.priority.area);
    assert.deepEqual(report.assembled_report.insights.map(({ title }) => title), expectedMaster.selectedInsights.map(({ title }) => title));
    assert.deepEqual(report.assembled_report.experiment.days.map(({ day }) => day), [1, 2, 3, 4, 5, 6, 7]);
    assert.deepEqual(report.assembled_report.science.map(({ explanation }) => explanation), expectedMaster.science.map(({ approvedText }) => approvedText));
    assert.deepEqual(report.assembled_report.sections.map(({ title }) => title), [
      "TVOJA PRIČA O SNU", "ŠTA SE KOD TEBE NAJVIŠE IZDVAJA", "ŠTA SADA NE BIH MENJAO",
      "ŠTA JOŠ NE ZNAMO", "TVOJ EKSPERIMENT ZA 7 DANA", "ŠTA NAUKA MOŽE DA NAM KAŽE",
    ]);
    assert.deepEqual(report.raw_gpt_prose, expectedRawProse[index]);
    assert.equal(report.request_count, 1);
    assert.equal(report.usage.input_tokens, 410);
    assert.equal(app.calls.length, index + 1);
  }
  const status = await app.send("GET", V5);
  assert.equal(status.body.version, "phase2bench.v5");
  assert.equal(status.body.completed, 6);
});

test("v5 provider/validation failure returns a complete deterministic fallback without altering the master", async (t) => {
  const app = await setup(t, async () => ({ status: "completed", output_text: JSON.stringify({ story_intro: "invalid" }), usage: { input_tokens: 40, output_tokens: 5, total_tokens: 45 } }));
  const response = await app.send("POST", V5, { fixture: "A" });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.body.status, "failed");
  const report = response.body.result;
  assert.equal(report.source, "fallback");
  assert.equal(report.raw_gpt_prose.story_intro, "invalid");
  assert.equal(report.assembled_report.profile, "ISPREKIDAN SAN");
  assert.equal(report.assembled_report.experiment.days.length, 7);
  assert.deepEqual(report.assembled_report.experiment.days.map(({ day }) => day), [1, 2, 3, 4, 5, 6, 7]);
  assert.ok(report.assembled_report.science.length);
  assert.equal(report.request_count, 1);
  assert.equal(app.calls.length, 1);
});

test("v1-v4 archives are preserved and v5 cache is independent", async (t) => {
  const app = await setup(t, async () => ({ status: "failed", incomplete_details: { reason: "max_output_tokens" },
    id: "resp_test", _request_id: "req_test", usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 } }));
  const expected = [
    ["/api/dev/premium-writer-benchmark", "phase2bench.v1", app.v1Dir],
    ["/api/dev/premium-writer-benchmark-v2", "phase2bench.v2", app.v2Dir],
    [V3, "phase2bench.v3", app.v3Dir],
    [V4, "phase2bench.v4", join(app.root, "premium-writer-benchmark-v4")],
  ];
  for (const [path, version, directory] of expected) {
    await mkdir(directory, { recursive: true });
    const historical = { version, fixture: "A", status: "completed", review_only: true, release_allowed: false, result: { preserve: version } };
    await writeFile(join(directory, "A.reserved"), "");
    await writeFile(join(directory, "A.json"), JSON.stringify(historical));
    assert.deepEqual((await app.send("GET", `${path}?fixture=A`)).body, historical);
    const post = await app.send("POST", path, { fixture: "A" });
    if (version === "phase2bench.v3") assert.deepEqual(post.body, historical, "v3 cached records are returned unchanged");
    else assert.equal(post.status, 410, `${version} generation is retired`);
    assert.deepEqual(JSON.parse(await readFile(join(directory, "A.json"), "utf8")), historical);
  }
  assert.equal((await app.send("GET", `${V5}?fixture=A`)).status, 404);
  const retiredV4 = await app.send("POST", V4, { fixture: "B" });
  assert.equal(retiredV4.status, 410, "v4 cannot generate or mutate its immutable cache");
  const status = await app.send("GET", V5);
  assert.deepEqual(status.body.fixtures, Object.fromEntries(["A", "B", "C", "D", "E", "F"].map((id) => [id, "unused"])));
  assert.equal(app.calls.length, 0);
});
