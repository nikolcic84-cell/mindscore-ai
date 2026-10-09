import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { createServer, request } from "node:http";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
// Bridge the existing server dependency; no package/dependency changes.
import express from "../server/node_modules/express/index.js";
import { registerSleepPremiumBenchmarkRoute } from "../server/sleepPremiumBenchmarkRoute.js";
import { benchmarkFixtures } from "./debug-sleep-premium-story-material.js";
import { buildSleepPremiumInput } from "../server/sleepPremiumInput.js";
import { buildSleepPremiumWriterBrief, projectSleepPremiumWriterBrief } from "../server/sleepPremiumWriterBrief.js";
import { formatBenchmark } from "./run-sleep-premium-writer-benchmarks.js";
import { generateSleepPremiumMaster } from "../server/sleepPremiumWriter.js";

// Standalone: node --test scripts/test-sleep-premium-benchmark-route.js
// All AI responses are injected synthetic scaffolding, never live AI or keys.
const LEGACY_ENDPOINT = "/api/dev/premium-writer-benchmark";
const ENDPOINT = "/api/dev/premium-writer-benchmark-v2";
const HOST = "mindscore-premium-staging.onrender.com";
const LETTERS = ["A", "B", "C", "D", "E", "F"];
const staging = () => ({ RENDER_GIT_BRANCH: "premium-ai-staging", ENABLE_PREMIUM_AI_PREVIEW: "true",
  RENDER_EXTERNAL_HOSTNAME: HOST, RENDER_GIT_COMMIT: "a".repeat(40) });
const envKeys = ["RENDER_GIT_BRANCH", "ENABLE_PREMIUM_AI_PREVIEW"];
const savedEnv = envKeys.map((key) => process.env[key]);
const protectedPaths = ["../server/server.js", "../package.json", "../server/package.json",
  "../server/sleepPremiumWriter.js", "../server/sleepPremiumWriterBrief.js", "../server/sleepPremiumMasterSchema.js",
  "./debug-sleep-premium-story-material.js", "./run-sleep-premium-writer-benchmarks.js"];
let hashes;
const hashSources = () => Promise.all(protectedPaths.map(async (path) =>
  createHash("sha256").update(await readFile(new URL(path, import.meta.url))).digest("hex")));
before(async () => {
  process.env.RENDER_GIT_BRANCH = "premium-ai-staging";
  process.env.ENABLE_PREMIUM_AI_PREVIEW = "true";
  hashes = await hashSources();
});
after(async () => {
  envKeys.forEach((key, i) => { if (savedEnv[i] === undefined) delete process.env[key]; else process.env[key] = savedEnv[i]; });
  assert.deepEqual(await hashSources(), hashes, "existing source/configuration files unchanged");
});

const unique = (values) => [...new Set(values)];
function decodeWriterTransport(serialized) {
  const envelope = JSON.parse(serialized);
  assert.equal(envelope.encoding, "tables-and-text.v2");
  const { brief, shared_text } = envelope;
  const decode = (value) => {
    if (Array.isArray(value)) return value.map(decode);
    if (value && typeof value === "object") {
      if (Object.keys(value).length === 1 && Object.hasOwn(value, "$text")) return shared_text[value.$text];
      if (Array.isArray(value.columns) && Array.isArray(value.rows)) {
        return value.rows.map((row) => Object.fromEntries(value.columns.map((column, index) => [column, decode(row[index])])));
      }
      return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, decode(child)]));
    }
    return value;
  };
  return decode(brief);
}

// Structurally accepted test copy, not a semantic/clinical quality claim.
function draft(brief) {
  const selected = [brief.primary_insight, ...brief.secondary_insights];
  const master = {
    version: 1, profile: brief.profile,
    priority: { area: brief.priority.area, explanation: "Odabrani početak ostaje u granicama prijavljenog iskustva.", first_step: "Kreni od već odabranog koraka." },
    intro: "Ovo je kratak pregled odabranih opažanja, uz otvorena pitanja.",
    insights: selected.map((entry) => ({ insight_id: entry.insight_id, title: "Odabrano opažanje",
      text: "Različita iskustva ostaju odvojena dok ih pažljivije ne uporediš.", evidence_ids: entry.evidence_claim_ids.slice(0, 1), device_id: null })),
    tracking: [],
    plan7: brief.experiment7.map((entry) => ({ day: entry.day, action: "Zadrži odabrani korak u njegovim postojećim granicama.",
      observe: "Primeti svoje iskustvo bez dodatnog zadatka.", technique_id: entry.technique_id, theme_ids: [...entry.themeIds] })),
    alternatives: [], uncertainty: { question: brief.best_next_question ? "Da li ova iskustva opisuješ tokom istih dana?" : null,
      anchor_fact_ids: [...(brief.best_next_question?.fact_ids ?? [])] },
    supporting_content: {
      insights: selected.map(({ insight_id }) => ({ insight_id, context: "Ovo opažanje ne bira objašnjenje između mogućih tumačenja." })),
      days: brief.experiment7.map(({ day }) => ({ day, rationale: "Ovaj osvrt ostaje uz postojeći korak.", reflection: null })),
      closing: "Sačuvaj prostor za ono što još nije poznato.",
    },
    provenance: {}, compliance: { no_diagnosis: true, no_causation: true, no_guarantee: true },
  };
  master.provenance = { primary_insight_id: brief.primary_insight.insight_id,
    evidence_ids: unique(master.insights.flatMap(({ evidence_ids }) => evidence_ids)),
    technique_ids: unique(master.plan7.map(({ technique_id }) => technique_id).filter((id) => id !== null)), device_ids: [] };
  return master;
}
const response = (_requestBody, _options, fixtureIndex) => {
  const fixture = benchmarkFixtures[fixtureIndex];
  assert.ok(fixture, "each synthetic writer request maps to a fixture answer set");
  const canonicalBrief = buildSleepPremiumWriterBrief(buildSleepPremiumInput(fixture.answers));
  return { status: "completed", output_text: JSON.stringify(draft(canonicalBrief)),
    usage: { input_tokens: 120, output_tokens: 80, total_tokens: 200, credential: "never-return-this-usage-field" } };
};
function mock(handler = response) {
  const calls = [];
  return { calls, responses: { create: async (body, options) => {
    const callIndex = calls.length;
    calls.push({ body, options });
    assert.equal(options.maxRetries, 0);
    assert.equal(options.timeout, 60000);
    assert.ok(options.signal instanceof AbortSignal);
    assert.equal(body.model, "gpt-5-mini");
    assert.equal(body.max_output_tokens, 8000);
    assert.equal(body.store, false);
    assert.deepEqual(body.reasoning, { effort: "low" });
    assert.equal(body.text.verbosity, "low");
    return handler(body, options, callIndex);
  } } };
}

async function setup(t, options = {}, cache) {
  const baseDirectory = cache ? dirname(cache) : await mkdtemp(join(tmpdir(), "sleep-bench-route-"));
  const directory = cache ?? join(baseDirectory, "premium-writer-benchmark-v2");
  const legacyDirectory = join(baseDirectory, "premium-writer-benchmark-v1");
  await mkdir(directory, { recursive: true });
  await mkdir(legacyDirectory, { recursive: true });
  if (!cache) t.after(() => rm(baseDirectory, { recursive: true, force: true }));
  const client = options.openaiClient ?? mock();
  const env = options.env ?? staging();
  const app = express();
  app.set("trust proxy", true); // Stronger check: forwarded hostname MUST NOT authorize.
  const registered = registerSleepPremiumBenchmarkRoute(app, { openaiClient: client, apiKeyAvailable: true,
    cacheDir: legacyDirectory, ...options, env });
  // Even an ungated app must not echo arbitrary paths in its default 404 HTML.
  app.use((req, res) => res.status(404).json({ error: "not_found" }));
  const server = createServer(app);
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const send = (method = "GET", body, path = ENDPOINT, headers = {}) => new Promise((resolve, reject) => {
    const req = request({ host: "127.0.0.1", port: server.address().port, method, path,
      headers: { Host: HOST, ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...headers } }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        try { resolve({ status: res.statusCode, body: JSON.parse(text), text, headers: res.headers }); } catch (error) { reject(error); }
      });
    });
    req.on("error", reject);
    if (body !== undefined) req.write(typeof body === "string" ? body : JSON.stringify(body));
    req.end();
  });
  return { directory, legacyDirectory, client, env, registered, send };
}

test("pure import is silent and production import does not load evidence", () => {
  const route = new URL("../server/sleepPremiumBenchmarkRoute.js", import.meta.url).href;
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", `
    const { registerSleepPremiumBenchmarkRoute } = await import(${JSON.stringify(route)});
    const app = { get() { throw Error('registered'); }, post() { throw Error('registered'); } };
    if (registerSleepPremiumBenchmarkRoute(app, { env: { RENDER_GIT_BRANCH: 'main' } }) !== false) throw Error('gate');
  `], { encoding: "utf8", env: { ...process.env, RENDER_GIT_BRANCH: "main" } });
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stdout, "");
  assert.equal(child.stderr, "");
});

test("exact branch, preview flag and external hostname gate BEFORE registration", async (t) => {
  for (const change of [{ RENDER_GIT_BRANCH: "main" }, { RENDER_GIT_BRANCH: "premium-ai-staging-extra" },
    { ENABLE_PREMIUM_AI_PREVIEW: undefined }, { ENABLE_PREMIUM_AI_PREVIEW: "TRUE" },
    { RENDER_EXTERNAL_HOSTNAME: undefined }, { RENDER_EXTERNAL_HOSTNAME: "mindscore-ai.onrender.com" }]) {
    const app = await setup(t, { env: { ...staging(), ...change } });
    assert.equal(app.registered, false);
    assert.equal((await app.send()).status, 404);
    assert.equal((await app.send("POST", { fixture: "A" })).status, 404);
    assert.equal(app.client.calls.length, 0);
    assert.deepEqual(await readdir(app.directory), []);
  }
});

test("runtime gate and raw Host defeat forwarded hostname even with trust proxy", async (t) => {
  const app = await setup(t);
  for (const headers of [{ Host: "localhost", "X-Forwarded-Host": HOST },
    { Host: "mindscore-ai.onrender.com", "X-Forwarded-Host": HOST }, { Host: `${HOST}.evil`, "X-Forwarded-Host": HOST },
    { Host: HOST, "X-Forwarded-Host": "evil.invalid" }]) {
    assert.equal((await app.send("GET", undefined, ENDPOINT, headers)).status, 404);
    assert.equal((await app.send("POST", { fixture: "A" }, ENDPOINT, headers)).status, 404);
  }
  for (const [key, value] of [["RENDER_GIT_BRANCH", "main"], ["ENABLE_PREMIUM_AI_PREVIEW", "false"], ["RENDER_EXTERNAL_HOSTNAME", "other.invalid"]]) {
    const saved = app.env[key];
    app.env[key] = value;
    assert.equal((await app.send()).status, 404);
    assert.equal((await app.send("POST", { fixture: "A" })).status, 404);
    app.env[key] = saved;
  }
  assert.equal(app.client.calls.length, 0);
  assert.deepEqual(await readdir(app.directory), []);
});

test("safe status contains only commit, enable boolean, completed count and fixture states", async (t) => {
  const app = await setup(t);
  app.env.SECRET = "must-not-appear";
  let out = await app.send();
  assert.equal(out.status, 200);
  assert.deepEqual(out.body, { version: "phase2bench.v2", commit: "a".repeat(40), enabled: true, completed: 0,
    fixtures: Object.fromEntries(LETTERS.map((id) => [id, "unused"])) });
  assert.equal(out.headers["cache-control"], "no-store");
  for (const invalid of ["commit-with-secret", "a".repeat(39), "g".repeat(40), undefined]) {
    app.env.RENDER_GIT_COMMIT = invalid;
    out = await app.send();
    assert.equal(out.body.commit, null);
    assert.ok(!out.text.includes("must-not-appear"));
  }
  assert.equal(app.client.calls.length, 0);
});

test("POST rejects every malformed/extra/arbitrary payload and GET rejects unknown/duplicate query", async (t) => {
  const app = await setup(t);
  for (const body of [null, [], ["A"], true, 3, '"A"', {}, { fixture: "G" }, { fixture: "a" },
    { fixture: 0 }, { fixture: ["A"] }, { fixture: "../A" }, { fixture: "A", answers: Array(12).fill(5) },
    { fixture: "A", prompt: "never-echo-arbitrary-prompt" }, { fixture: "A", model: "arbitrary-model" },
    { fixture: "A", arbitraryField: "never-echo-arbitrary-field" }, '{"fixture":', ""]) {
    const out = await app.send("POST", body);
    assert.equal(out.status, 400, JSON.stringify(body));
    assert.ok(!out.text.includes("never-echo"));
  }
  assert.equal((await app.send("POST", { fixture: "A" }, ENDPOINT, { "Content-Type": "text/plain" })).status, 400);
  assert.equal((await app.send("POST", "x".repeat(2000))).status, 413);
  assert.equal((await app.send("POST", { fixture: "A" }, `${ENDPOINT}?fixture=A`)).status, 400);
  for (const query of ["fixture=G", "fixture=A&fixture=A", "fixture[]=A", "prompt=private", "fixture=A&answers=5", "fixture="]) {
    const out = await app.send("GET", undefined, `${ENDPOINT}?${query}`);
    assert.equal(out.status, 400, query);
    assert.ok(!out.text.includes("private"));
  }
  assert.equal((await app.send("GET", undefined, `${ENDPOINT}?fixture=A`)).status, 404);
  assert.equal(app.client.calls.length, 0);
  assert.deepEqual(await readdir(app.directory), []);
});

test("six canonical fixtures: six real writer mock calls, complete formatter JSON, then cache only", async (t) => {
  const app = await setup(t);
  for (const [i, fixture] of LETTERS.entries()) {
    const out = await app.send("POST", { fixture });
    assert.equal(out.status, 200, out.text);
    assert.equal(out.body.status, "completed", out.text);
    assert.equal(out.body.fixture, fixture);
    assert.equal(out.body.profile, benchmarkFixtures[i].expectedProfile);
    assert.equal(out.body.phase2reviewonly, true);
    assert.equal(out.body.review_only, true);
    assert.equal(out.body.release_allowed, false);
    assert.ok(Number.isInteger(out.body.latencyMilliseconds) && out.body.latencyMilliseconds >= 0);
    const result = out.body.result;
    assert.equal(result.request_count, 1);
    assert.deepEqual(result.usage, { model: "gpt-5-mini", input_tokens: 120, output_tokens: 80, total_tokens: 200,
      response_status: "completed", source: "AI_GENERATED" });
    assert.equal(result.validation.valid, true);
    assert.equal(result.sections.length, 6);
    assert.equal(result.master.plan7.length, 7);
    assert.ok(result.master.provenance);
    assert.ok(result.preview.registry_snapshot);
    assert.ok(result.trace);
    assert.ok(Array.isArray(result.evidence_notes));
    assert.ok(Array.isArray(result.technique_notes));
    assert.ok(Array.isArray(result.device_notes));
    assert.equal(result.clinical_review_status, "pending");
    assert.equal(result.semantic_review_required, true);
    assert.equal(result.release_allowed, false);
    const brief = buildSleepPremiumWriterBrief(buildSleepPremiumInput(benchmarkFixtures[i].answers));
    const writerRequest = app.client.calls[i].body;
    const transport = decodeWriterTransport(writerRequest.input[1].content);
    assert.deepEqual(transport, projectSleepPremiumWriterBrief(brief));
    assert.equal(writerRequest.text.format.name, "mindscore_sleep_premium_master_v1");
    assert.equal(writerRequest.text.verbosity, "low");
    assert.deepEqual(writerRequest.reasoning, { effort: "low" });
    assert.ok(!Object.hasOwn(transport, "supporting_facts"));
    assert.equal(out.body.priority, brief.priority.area);
    assert.ok(Buffer.byteLength(out.text) < 256 * 1024);
    assert.ok(!out.text.includes("never-return-this-usage-field"));
    assert.deepEqual(JSON.parse(await readFile(join(app.directory, `${fixture}.json`), "utf8")), out.body);
    assert.deepEqual((await app.send("GET", undefined, `${ENDPOINT}?fixture=${fixture}`)).body, out.body);
    assert.deepEqual((await app.send("POST", { fixture })).body, out.body);
    assert.equal(app.client.calls.length, i + 1);
  }
  const status = await app.send();
  assert.equal(status.body.completed, 6);
  assert.deepEqual(status.body.fixtures, Object.fromEntries(LETTERS.map((id) => [id, "completed"])));
  assert.equal((await app.send("POST", { fixture: "G" })).status, 400);
  assert.equal((await readdir(app.directory)).filter((name) => name.endsWith(".reserved")).length, 6);
  // New registration with no API capability still serves disk-only results.
  const restarted = await setup(t, { apiKeyAvailable: false }, app.directory);
  for (const fixture of LETTERS) {
    assert.equal((await restarted.send("POST", { fixture })).body.status, "completed");
    assert.equal((await restarted.send("GET", undefined, `${ENDPOINT}?fixture=${fixture}`)).status, 200);
  }
  assert.equal(restarted.client.calls.length, 0);
  assert.equal(app.client.calls.length, 6);
  // Genuine fresh Node process: no in-memory state, no key/client, same disk.
  const routeUrl = new URL("../server/sleepPremiumBenchmarkRoute.js", import.meta.url).href;
  const expressUrl = new URL("../server/node_modules/express/index.js", import.meta.url).href;
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", `
    import express from ${JSON.stringify(expressUrl)};
    import { createServer, request } from 'node:http';
    import { registerSleepPremiumBenchmarkRoute } from ${JSON.stringify(routeUrl)};
    const app = express();
    registerSleepPremiumBenchmarkRoute(app, { cacheDir: ${JSON.stringify(app.legacyDirectory)},
      apiKeyAvailable: false, env: ${JSON.stringify(staging())} });
    const server = createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const results = [];
    for (const method of ['GET', 'POST']) {
      results.push(await new Promise((resolve, reject) => {
        const req = request({ host: '127.0.0.1', port: server.address().port, method,
          path: ${JSON.stringify(ENDPOINT)} + (method === 'GET' ? '?fixture=A' : ''),
          headers: { Host: ${JSON.stringify(HOST)}, 'Content-Type': 'application/json' } }, res => {
            let text = ''; res.on('data', chunk => text += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(text) }));
          });
        req.on('error', reject); req.end(method === 'POST' ? JSON.stringify({ fixture: 'A' }) : undefined);
      }));
    }
    await new Promise(resolve => server.close(resolve));
    console.log(JSON.stringify(results));
  `], { encoding: "utf8" });
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stderr, "");
  const cachedA = JSON.parse(await readFile(join(app.directory, "A.json"), "utf8"));
  assert.deepEqual(JSON.parse(child.stdout), [{ status: 200, body: cachedA }, { status: 200, body: cachedA }]);
});

test("exclusive reservation precedes API; simultaneous repeat=409, other fixture/app=429 without consuming it", async (t) => {
  let started;
  let finish;
  const entered = new Promise((resolve) => { started = resolve; });
  const pending = new Promise((resolve) => { finish = resolve; });
  const client = mock(async (_body, _options, fixtureIndex) => { started(); await pending; return response(null, null, fixtureIndex); });
  const app = await setup(t, { openaiClient: client });
  const otherApp = await setup(t);
  const duplicateApp = await setup(t, {}, app.directory);
  const first = app.send("POST", { fixture: "A" });
  await entered;
  try {
    assert.ok((await readdir(app.directory)).includes("A.reserved"));
    assert.equal((await app.send()).body.fixtures.A, "in_progress");
    const repeat = await duplicateApp.send("POST", { fixture: "A" });
    assert.equal(repeat.status, 409);
    assert.equal(repeat.body.retryGet, `${ENDPOINT}?fixture=A`);
    assert.equal((await app.send("GET", undefined, `${ENDPOINT}?fixture=A`)).status, 409);
    assert.equal((await app.send("POST", { fixture: "B" })).status, 429);
    assert.equal((await otherApp.send("POST", { fixture: "A" })).status, 429);
    assert.deepEqual(await readdir(otherApp.directory), []);
    assert.deepEqual(await readdir(app.directory), ["A.reserved"]);
    assert.equal(client.calls.length, 1);
  } finally { finish(); }
  assert.equal((await first).body.status, "completed");
  assert.equal((await app.send("POST", { fixture: "B" })).body.status, "completed");
  assert.equal(client.calls.length, 2);
});

test("missing API/client/writer gate and unavailable filesystem return 503 before reservation or API", async (t) => {
  for (const options of [{ apiKeyAvailable: false }, { openaiClient: { calls: [], responses: {} } },
    { cacheDir: undefined }, { cacheDir: "relative-cache" }]) {
    const app = await setup(t, options);
    assert.equal((await app.send("POST", { fixture: "A" })).status, 503);
    assert.deepEqual(await readdir(app.directory), []);
    assert.equal(app.client.calls.length, 0);
  }
  const app = await setup(t);
  const saved = process.env.ENABLE_PREMIUM_AI_PREVIEW;
  try {
    delete process.env.ENABLE_PREMIUM_AI_PREVIEW;
    assert.equal((await app.send("POST", { fixture: "A" })).status, 503);
  } finally { process.env.ENABLE_PREMIUM_AI_PREVIEW = saved; }
  assert.deepEqual(await readdir(app.directory), []);
  const blockedPath = join(app.directory, "file-not-directory");
  await writeFile(blockedPath, "private-filesystem-content");
  const unavailable = await setup(t, { cacheDir: blockedPath });
  for (const method of ["GET", "POST"]) {
    const out = await unavailable.send(method, method === "POST" ? { fixture: "A" } : undefined);
    assert.equal(out.status, 503);
    assert.ok(!out.text.includes(blockedPath));
    assert.ok(!out.text.includes("private-filesystem-content"));
  }
  assert.equal(unavailable.client.calls.length, 0);
});

test("existing crash reservation never retries, including new registrations", async (t) => {
  const app = await setup(t);
  await writeFile(join(app.directory, "A.reserved"), "", { flag: "wx" });
  const restarted = await setup(t, {}, app.directory);
  for (const instance of [app, restarted]) {
    assert.equal((await instance.send()).body.fixtures.A, "reserved");
    assert.equal((await instance.send("POST", { fixture: "A" })).status, 409);
    assert.equal((await instance.send("GET", undefined, `${ENDPOINT}?fixture=A`)).status, 409);
    assert.equal(instance.client.calls.length, 0);
  }
});

test("failed, invalid JSON, refused, incomplete and timeout responses cache failure without retries or secrets", async (t) => {
  const secret = "sk-test-do-not-echo-provider-secret";
  const handlers = [
    () => { throw Object.assign(new Error(secret), { status: 500 }); },
    () => { throw Object.assign(new Error(secret), { name: "AbortError" }); },
    () => ({ status: "completed", output_text: secret }),
    () => ({ status: "completed", output: [{ type: "message", content: [{ type: "refusal", refusal: secret }] }] }),
    () => ({ status: "incomplete", incomplete_details: { reason: "max_output_tokens" }, error: { message: secret }, output_text: secret }),
    () => ({ status: "completed", output_text: JSON.stringify({ private: secret, email: "private@example.invalid" }) }),
  ];
  for (const [i, handler] of handlers.entries()) {
    const client = mock(handler);
    const app = await setup(t, { openaiClient: client });
    const out = await app.send("POST", { fixture: "A" });
    assert.equal(out.status, 200, out.text);
    assert.equal(out.body.status, "failed");
    assert.equal(out.body.result.master, null);
    assert.equal(out.body.result.request_count, 1);
    assert.equal(out.body.result.failure_type, ["openai_http_error", "timeout", "invalid_json", "model_refusal",
      "incomplete_response", "schema_validation_failure"][i]);
    assert.equal(out.body.result.legacy_fallback_validation.valid, true);
    assert.ok(out.body.result.legacy_fallback);
    assert.ok(out.body.result.brief_summary);
    assert.ok(!out.text.includes(secret));
    assert.ok(!out.text.includes("private@example.invalid"));
    if (i === 5) assert.equal(out.body.result.rejected_draft_withheld, true);
    assert.deepEqual((await app.send("POST", { fixture: "A" })).body, out.body);
    assert.deepEqual((await app.send("GET", undefined, `${ENDPOINT}?fixture=A`)).body, out.body);
    assert.equal((await app.send()).body.fixtures.A, "failed");
    assert.equal(client.calls.length, 1);
  }
});

test("safe rejected candidate preserved through existing formatter; potentially identifying strings redacted", async (t) => {
  const candidate = { invalid_shape: "reviewable rejected synthetic text", possible_identifier: "abcdefghijklmnopqrstuvwx" };
  const client = mock(() => ({ status: "completed", output_text: JSON.stringify(candidate) }));
  const app = await setup(t, { openaiClient: client });
  const out = await app.send("POST", { fixture: "A" });
  assert.equal(out.body.status, "failed");
  assert.equal(out.body.result.rejected_draft.candidate.invalid_shape, candidate.invalid_shape);
  assert.match(out.body.result.rejected_draft.candidate.possible_identifier, /withheld/u);
  assert.ok(!out.text.includes(candidate.possible_identifier));
  // Independently compare the complete route review to the exported formatter.
  const expected = await generateSleepPremiumMaster({ input: buildSleepPremiumInput(benchmarkFixtures[0].answers),
    openaiClient: mock(() => ({ status: "completed", output_text: JSON.stringify(candidate) })), apiKeyAvailable: true,
    internalBenchmark: true, includeRejectedDraft: true, includePreview: true, logUsage: () => {} });
  assert.deepEqual(out.body.result, JSON.parse(formatBenchmark(expected, { fixtureId: "A", format: "json" })));
  assert.equal(client.calls.length, 1);
});

test("oversized review is a cached terminal failure, never truncated or regenerated", async (t) => {
  // Spaces avoid the formatter's long-identifier redaction: exercise byte cap.
  const client = mock(() => ({ status: "completed", output_text: JSON.stringify({ copy: "review text ".repeat(30000) }) }));
  const app = await setup(t, { openaiClient: client });
  const out = await app.send("POST", { fixture: "A" });
  assert.equal(out.status, 200);
  assert.equal(out.body.status, "failed");
  assert.equal(out.body.error, "review_result_too_large");
  assert.equal(out.body.result, null);
  assert.ok(Buffer.byteLength(out.text) < 256 * 1024);
  assert.deepEqual((await app.send("POST", { fixture: "A" })).body, out.body);
  assert.equal(client.calls.length, 1);
});

test("corrupt disk cache or failed publication fails closed and never permits another generation", async (t) => {
  const app = await setup(t);
  await writeFile(join(app.directory, "A.reserved"), "");
  await writeFile(join(app.directory, "A.json"), "private-corrupt-cache-content");
  for (const method of ["GET", "POST"]) {
    const out = await app.send(method, method === "POST" ? { fixture: "A" } : undefined);
    assert.equal(out.status, 503);
    assert.ok(!out.text.includes("private-corrupt-cache-content"));
  }
  assert.equal(app.client.calls.length, 0);
  const publication = await setup(t);
  await writeFile(join(publication.directory, "A.json.tmp"), "leftover");
  assert.equal((await publication.send("POST", { fixture: "A" })).status, 503);
  assert.equal((await publication.send("POST", { fixture: "A" })).status, 409);
  assert.equal(publication.client.calls.length, 1);
});

test("v1 remains historical read-only; v2 generation and caches are isolated", async (t) => {
  const app = await setup(t);
  const historical = { version: "phase2bench.v1", commit: "b".repeat(40), fixture: "A", status: "completed",
    review_only: true, release_allowed: false, result: { historical: "keep-this-record" } };
  await writeFile(join(app.legacyDirectory, "A.reserved"), "");
  await writeFile(join(app.legacyDirectory, "A.json"), JSON.stringify(historical));

  const oldRead = await app.send("GET", undefined, `${LEGACY_ENDPOINT}?fixture=A`);
  assert.equal(oldRead.status, 200);
  assert.deepEqual(oldRead.body, historical);
  const oldStatus = await app.send("GET", undefined, LEGACY_ENDPOINT);
  assert.equal(oldStatus.body.version, "phase2bench.v1");
  assert.equal(oldStatus.body.completed, 1);
  assert.equal(oldStatus.body.fixtures.A, "completed");
  assert.equal((await app.send("POST", { fixture: "A" }, LEGACY_ENDPOINT)).status, 410);
  assert.equal(app.client.calls.length, 0);

  assert.equal((await app.send("GET", undefined, `${ENDPOINT}?fixture=A`)).status, 404);
  const fresh = await app.send("POST", { fixture: "A" });
  assert.equal(fresh.status, 200, fresh.text);
  assert.equal(fresh.body.version, "phase2bench.v2");
  assert.equal(fresh.body.status, "completed");
  assert.equal(app.client.calls.length, 1);
  assert.deepEqual(JSON.parse(await readFile(join(app.legacyDirectory, "A.json"), "utf8")), historical);
  assert.deepEqual(JSON.parse(await readFile(join(app.directory, "A.json"), "utf8")), fresh.body);
  assert.deepEqual((await app.send("GET", undefined, `${LEGACY_ENDPOINT}?fixture=A`)).body, historical);
  assert.equal((await app.send("POST", { fixture: "A" }, LEGACY_ENDPOINT)).status, 410,
    "even an existing v1 cache is only accessible through GET");
  assert.equal(app.client.calls.length, 1, "v1 must never invoke generation");
});