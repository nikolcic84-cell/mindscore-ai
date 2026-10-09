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
const longIntro = "Tvoji odgovori daju više pogleda na san nego što staje u jednu ocenu. Jedan deo se odnosi na period pred spavanje, drugi na tok noći, a treći na osećaj po buđenju ili tokom dana. To ne znači da se sve dogodilo iste noći niti da jedan deo objašnjava drugi. Vredi zadržati i ono što već deluje mirnije, umesto da se menja sve odjednom. Uvidi ispod izdvajaju samo odnose koje tvoji odgovori podržavaju. Gde nedostaje važan podatak, pitanje ostaje otvoreno. Sedmodnevni pokušaj je mali i dobrovoljan; možeš ga preskočiti ako ti ne prija. Cilj je jasnije razumeti sopstvene utiske, a ne postići unapred obećan ishod. Neke razlike mogu ostati otvorene, čak i kada nekoliko delova sna deluje mirnije. Zato plan nudi prostor da razmisliš bez menjanja navika, brojanja minuta ili očekivanja određenog rezultata. Možeš uzeti samo ono što ti je korisno i ostaviti po strani sve što ti dodaje obavezu.";
const proseFor = (master) => ({
  story_intro: longIntro,
  insight_1_explanation: "Ovaj odnos povezuje samo iskustva koja su već navedena; ne govori šta ih je izazvalo.",
  insight_2_explanation: master.selectedInsights.length >= 2 ? "Drugi uvid dodaje zaseban ugao iz odgovora, bez zaključka da su iskustva nastala zajedno." : null,
  ...(master.selectedInsights.length >= 3 ? { insight_3_explanation: "Treći ugao dopunjuje priču, ali ne uvodi novu pretpostavku o uzroku." } : {}),
  do_not_change_explanation: master.doNotTargetFirst.length ? "Ovaj deo ne mora biti prvi cilj jer već postoji prijavljeni oslonac; to ne poništava ostale odgovore." : null,
  open_question_explanation: master.openQuestion ? "Odgovor bi pomogao da se razdvoje dva moguća opisa, bez pretpostavke da su ista noć." : null,
  experiment_explanation: "Plan razdvaja već izabrane uglove kako bi ostalo jasno šta je izvodljivo, bez menjanja svega odjednom.",
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

test("v4 returns complete structured prose-only reports and derives every report scaffold deterministically", async (t) => {
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
    const response = await app.send("POST", V4, { fixture: "".concat("ABCDEF"[index]) });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.version, "phase2bench.v4");
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
  const status = await app.send("GET", V4);
  assert.equal(status.body.version, "phase2bench.v4");
  assert.equal(status.body.completed, 6);
});

test("v4 provider/validation failure returns a complete deterministic fallback without altering the master", async (t) => {
  const app = await setup(t, async () => ({ status: "completed", output_text: JSON.stringify({ story_intro: "invalid" }), usage: { input_tokens: 40, output_tokens: 5, total_tokens: 45 } }));
  const response = await app.send("POST", V4, { fixture: "A" });
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

test("v1/v2/v3 archives are preserved and v4 cache is independent", async (t) => {
  const app = await setup(t, async () => ({ status: "failed", incomplete_details: { reason: "max_output_tokens" },
    id: "resp_test", _request_id: "req_test", usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 } }));
  const expected = [
    ["/api/dev/premium-writer-benchmark", "phase2bench.v1", app.v1Dir],
    ["/api/dev/premium-writer-benchmark-v2", "phase2bench.v2", app.v2Dir],
    [V3, "phase2bench.v3", app.v3Dir],
  ];
  for (const [path, version, directory] of expected) {
    const historical = { version, fixture: "A", status: "completed", review_only: true, release_allowed: false, result: { preserve: version } };
    await writeFile(join(directory, "A.reserved"), "");
    await writeFile(join(directory, "A.json"), JSON.stringify(historical));
    assert.deepEqual((await app.send("GET", `${path}?fixture=A`)).body, historical);
    const post = await app.send("POST", path, { fixture: "A" });
    if (version === "phase2bench.v3") assert.deepEqual(post.body, historical, "v3 cached records are returned unchanged");
    else assert.equal(post.status, 410, `${version} generation is retired`);
    assert.deepEqual(JSON.parse(await readFile(join(directory, "A.json"), "utf8")), historical);
  }
  assert.equal((await app.send("GET", `${V4}?fixture=A`)).status, 404);
  const status = await app.send("GET", V4);
  assert.deepEqual(status.body.fixtures, Object.fromEntries(["A", "B", "C", "D", "E", "F"].map((id) => [id, "unused"])));
  assert.equal(app.calls.length, 0);
});
