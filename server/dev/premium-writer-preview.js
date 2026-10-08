import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai"; // Resolves the existing server/node_modules dependency.
import { benchmarkFixtures } from "../../scripts/debug-sleep-premium-story-material.js";
import { buildSleepPremiumInput } from "../sleepPremiumInput.js";
import { generateSleepPremiumMaster, isSleepPremiumWriterEnabled } from "../sleepPremiumWriter.js";
import { validateSleepPremiumReport } from "../sleepPremiumSchema.js";

export const PREVIEW_HOST = "127.0.0.1";
export const PREVIEW_PORT = 4188;
const LIMIT = 6;
const HTML = new URL("./premium-writer-preview.html", import.meta.url);
// Shared across server instances in this process; reserve BEFORE awaiting AI.
let generations = 0;
const keyAvailable = () => Boolean(process.env.OPENAI_API_KEY?.trim());
const count = (value) => Number.isSafeInteger(value) && value >= 0 ? value : null;
const statuses = ["completed", "incomplete", "failed", "in_progress", "queued", "cancelled", "unavailable"];
const failures = ["preview_disabled", "missing_api_key", "missing_ai_client", "invalid_timeout", "timeout", "incomplete_response",
  "model_refusal", "invalid_json", "schema_validation_failure", "preview_adapter_failure", "openai_http_error", "openai_request_failed", "invalid_input"];

function safeUsage(usage) {
  return Object.fromEntries([
    ...["input_tokens", "output_tokens", "total_tokens", "cached_input_tokens", "reasoning_tokens"].map((key) => [key, count(usage?.[key])]),
    ["response_status", statuses.includes(usage?.response_status) ? usage.response_status : "unavailable"],
  ]);
}

export function validatedSourceUrl(value) {
  try {
    const url = new URL(value);
    // Only server-resolved registry URLs, never a generated prose link.
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

function displayPreview(preview) {
  // Deliberately omit registry_snapshot, provenance, master and writer brief.
  return {
    model_version: preview.model_version, profile: preview.profile, intro: preview.intro,
    priority: { area: preview.priority.area, explanation: preview.priority.explanation, first_step: preview.priority.first_step },
    connections: preview.connections.map(({ title, text, context, source_labels }) => ({ title, text, context, source_labels: [...source_labels] })),
    tracking: [...preview.tracking],
    plan: preview.plan.map(({ day, action, observe, rationale, reflection }) => ({ day, action, observe, rationale, reflection })),
    alternatives: preview.alternatives.map(({ text }) => ({ text })),
    review: { question: preview.review.question, closing: preview.review.closing },
    sources: preview.sources.map(({ label, url }) => ({ label, url: validatedSourceUrl(url) })),
    pdf: { available: false }, clinical_review_status: "pending", semantic_review_required: true,
    review_only: true, release_allowed: false,
  };
}

/** Local DISPLAY adapter only. Never constructs, repairs or labels a master. */
export function adaptLegacyFallbackForLocalPreview(report, input) {
  const checked = validateSleepPremiumReport(report, input);
  if (!checked.valid) return null;
  const legacy = checked.report;
  return {
    model_version: "local-legacy-fallback-display.v1", profile: legacy.profile, intro: legacy.profile_explanation,
    priority: { area: legacy.priority.area, explanation: legacy.priority.explanation, first_step: null },
    connections: legacy.connections.map(({ text }, index) => ({ title: `Poređenje ${index + 1}`, text,
      context: legacy.supporting_content?.connections[index]?.context ?? null, source_labels: [] })),
    tracking: [...legacy.stable_or_tracking.items],
    plan: legacy.seven_day_plan.map(({ day, action, observe }, index) => ({ day, action, observe,
      rationale: legacy.supporting_content?.days[index]?.rationale ?? null,
      reflection: legacy.supporting_content?.days[index]?.reflection ?? null })),
    alternatives: legacy.alternatives.map((text) => ({ text })),
    review: { question: legacy.review_questions.join("\n"), closing: [legacy.after_seven_days, legacy.closing].join("\n\n") },
    sources: [], pdf: { available: false }, clinical_review_status: "pending", semantic_review_required: true,
    review_only: true, release_allowed: false,
  };
}

export function projectGeneration(result, input) {
  const accepted = result?.source === "ai" && result.validation?.valid === true && result.master != null &&
    result.preview?.model_version === "sleep-premium-master-preview.v1";
  const preview = accepted ? displayPreview(result.preview) : adaptLegacyFallbackForLocalPreview(result?.legacyFallback, input);
  return {
    source: accepted ? "ai" : "fallback", masterBuilt: accepted,
    validationStatus: accepted ? "accepted_structural_only" : preview ? "legacy_fallback_valid" : "unavailable",
    failureType: accepted ? null : failures.includes(result?.failureType) ? result.failureType : "generation_failed",
    usage: safeUsage(result?.usage), requestCount: count(result?.requestCount), generationsUsed: generations, generationLimit: LIMIT,
    preview, review_only: true, release_allowed: false, clinical_review_status: "pending", semantic_review_required: true,
  };
}

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function readPayload(req) {
  if (req.headers["content-type"]?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw Object.assign(new Error(), { status: 415 });
  }
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1024) throw Object.assign(new Error(), { status: 413 });
    chunks.push(chunk);
  }
  let body;
  try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw Object.assign(new Error(), { status: 400 }); }
  if (!body || Array.isArray(body) || Object.keys(body).length !== 1 || !Object.hasOwn(body, "fixtureIndex") ||
    !Number.isInteger(body.fixtureIndex) || body.fixtureIndex < 0 || body.fixtureIndex > 5) {
    throw Object.assign(new Error(), { status: 400 });
  }
  return body;
}

/** Pure import: no listen, env-file loading, SDK construction or API calls.
 * clientFactory is an offline-test seam; CLI always uses the existing SDK.
 */
export function createPremiumWriterPreviewServer({ clientFactory = () => new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, maxRetries: 0, timeout: 60000,
}) } = {}) {
  return createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Content-Security-Policy", "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
    const host = req.headers.host;
    const localAuthority = `${PREVIEW_HOST}:${req.socket.localPort}`;
    // Host check prevents DNS rebinding; Origin/JSON checks prevent cross-site calls.
    if (host !== localAuthority || (req.headers.origin && req.headers.origin !== `http://${localAuthority}`) ||
      (req.headers["sec-fetch-site"] && !["same-origin", "none"].includes(req.headers["sec-fetch-site"]))) {
      json(res, 403, { error: "Local same-origin preview only." }); return;
    }
    try {
      if (req.method === "GET" && req.url === "/") {
        const html = await readFile(HTML);
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); res.end(html); return;
      }
      if (req.method === "GET" && req.url === "/config") {
        json(res, 200, { enabled: isSleepPremiumWriterEnabled(), keyAvailable: keyAvailable(), limitReached: generations >= LIMIT }); return;
      }
      if (req.method !== "POST" || req.url !== "/generate") {
        json(res, 404, { error: "Local preview route not found." }); return;
      }
      if (!isSleepPremiumWriterEnabled()) {
        json(res, 403, { status: "blocked", failureType: "preview_disabled", requestCount: 0,
          error: "Requires RENDER_GIT_BRANCH=premium-ai-staging and ENABLE_PREMIUM_AI_PREVIEW=true. No AI call was made." }); return;
      }
      if (!keyAvailable()) {
        json(res, 503, { status: "blocked", failureType: "missing_api_key", requestCount: 0,
          error: "OPENAI_API_KEY is unavailable in this process. Preview is blocked; no AI call or fallback display was made." }); return;
      }
      const { fixtureIndex } = await readPayload(req);
      if (generations >= LIMIT) {
        json(res, 429, { status: "blocked", failureType: "process_limit", requestCount: 0,
          error: "The six-generation process limit has been reached. No additional AI call was made." }); return;
      }
      const fixture = benchmarkFixtures[fixtureIndex];
      const input = buildSleepPremiumInput(fixture.answers);
      if (input.profile !== fixture.expectedProfile) throw new Error("Synthetic profile contract changed.");
      generations += 1;
      const result = await generateSleepPremiumMaster({ input, openaiClient: clientFactory(), apiKeyAvailable: true,
        includePreview: true, internalBenchmark: false, includeRejectedDraft: false, logUsage: () => {} });
      const body = projectGeneration(result, input);
      json(res, body.preview ? 200 : 502, body);
    } catch (error) {
      const status = [400, 413, 415].includes(error?.status) ? error.status : 500;
      json(res, status, { status: "blocked", error: status === 500 ? "Local preview could not complete safely. No automatic retry."
        : "Use only JSON {fixtureIndex: integer 0–5}, at most 1024 bytes." });
    }
  });
}

export function startPremiumWriterPreview() {
  const server = createPremiumWriterPreviewServer();
  server.listen(PREVIEW_PORT, PREVIEW_HOST, () => console.log(`Internal Phase 2 review only: http://${PREVIEW_HOST}:${PREVIEW_PORT} (six generations maximum; clinical review pending).`));
  server.on("error", () => { console.error("Local preview could not bind 127.0.0.1:4188."); process.exitCode = 1; });
  return server;
}

// Embedded tests keep the requested scope at exactly TWO new files.
// Run: node server/dev/premium-writer-preview.js --test (no live API/key).
export async function runOfflineSmokeTests() {
  const { default: assert } = await import("node:assert/strict");
  const { Script } = await import("node:vm");
  const { spawnSync } = await import("node:child_process");
  const { buildSleepPremiumWriterBrief } = await import("../sleepPremiumWriterBrief.js");
  const { buildSleepPremiumFallback } = await import("../sleepPremiumFallback.js");
  const { adaptSleepPremiumMasterForPreview } = await import("../sleepPremiumMasterAdapter.js");
  const { loadSleepEvidenceLibrary } = await import("../sleepEvidenceLibrary.js");
  const envKeys = ["RENDER_GIT_BRANCH", "ENABLE_PREMIUM_AI_PREVIEW", "OPENAI_API_KEY"];
  const saved = envKeys.map((key) => process.env[key]);
  const savedGenerations = generations;
  const originalFetch = globalThis.fetch;
  let calls = 0;
  let factories = 0;
  let response;
  let server;
  try {
    envKeys.forEach((key) => { delete process.env[key]; });
    const child = spawnSync(process.execPath, ["--input-type=module", "-e", `await import(${JSON.stringify(import.meta.url)});`],
      { encoding: "utf8", env: { ...process.env } });
    assert.equal(child.status, 0); assert.equal(child.stdout, ""); assert.equal(child.stderr, "");
    const syntax = spawnSync(process.execPath, ["--check", fileURLToPath(import.meta.url)], { encoding: "utf8" });
    assert.equal(syntax.status, 0);
    const html = await readFile(HTML, "utf8");
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/gu)];
    assert.equal(scripts.length, 1); new Script(scripts[0][1]);
    assert.ok(!/innerHTML|insertAdjacentHTML|document\.write/u.test(html));
    assert.equal((html.match(/data-section=/gu) ?? []).length, 6);
    for (const url of ["javascript:alert(1)", "http://example.org", "https://user:pass@example.org", "not a URL"]) assert.equal(validatedSourceUrl(url), null);
    assert.equal(validatedSourceUrl("https://example.org/paper"), "https://example.org/paper");
    server = createPremiumWriterPreviewServer({ clientFactory: () => {
      factories += 1;
      return { responses: { create: async (_request, options) => {
        calls += 1; assert.equal(options.maxRetries, 0);
        return response;
      } } };
    } });
    await new Promise((resolveListen, reject) => { server.once("error", reject); server.listen(0, PREVIEW_HOST, resolveListen); });
    const base = `http://${PREVIEW_HOST}:${server.address().port}`;
    // Fail closed on any attempted external fetch, even if a key exists outside tests.
    globalThis.fetch = (url, ...args) => {
      assert.ok(String(url).startsWith(`${base}/`), "External network forbidden in offline smoke tests");
      return originalFetch(url, ...args);
    };
    const request = async (path, options) => {
      const res = await fetch(`${base}${path}`, options);
      return { status: res.status, body: await res.json() };
    };
    const post = (body = { fixtureIndex: 0 }, headers = {}) => request("/generate", {
      method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body),
    });
    assert.equal((await fetch(`${base}/`)).status, 200);
    assert.equal((await request("/config")).body.keyAvailable, false);
    assert.equal((await post()).status, 403);
    process.env.RENDER_GIT_BRANCH = "premium-ai-staging"; process.env.ENABLE_PREMIUM_AI_PREVIEW = "TRUE";
    assert.equal((await post()).status, 403);
    process.env.ENABLE_PREMIUM_AI_PREVIEW = "true"; process.env.RENDER_GIT_BRANCH = "main";
    assert.equal((await post()).status, 403);
    process.env.RENDER_GIT_BRANCH = "premium-ai-staging";
    const missing = await post(); assert.equal(missing.status, 503); assert.equal(missing.body.requestCount, 0); assert.ok(!missing.body.preview);
    assert.equal(factories, 0); assert.equal(calls, 0);
    // Explicit noncredential sentinel; only the injected Responses mock can run.
    process.env.OPENAI_API_KEY = "offline-test-sentinel-not-a-key";
    const config = (await request("/config")).body;
    assert.ok(Object.values(config).every((value) => typeof value === "boolean"));
    assert.ok(!JSON.stringify(config).includes(process.env.OPENAI_API_KEY));
    for (const invalid of [{}, { fixtureIndex: -1 }, { fixtureIndex: 6 }, { fixtureIndex: "0" }, { fixtureIndex: 1.5 },
      { fixtureIndex: 0, answers: [] }, [], null]) assert.equal((await post(invalid)).status, 400);
    assert.equal((await post(undefined, { Origin: "https://example.org" })).status, 403);
    // Undici may normalize Host; native HTTP preserves this rebinding probe.
    const { request: httpRequest } = await import("node:http");
    const badHostStatus = await new Promise((done, reject) => {
      const probe = httpRequest(`${base}/config`, { headers: { Host: "example.org" } }, (res) => {
        res.resume(); res.once("end", () => done(res.statusCode));
      });
      probe.once("error", reject); probe.end();
    });
    assert.equal(badHostStatus, 403);
    assert.equal((await post(undefined, { "Content-Type": "text/plain" })).status, 415);
    assert.equal((await post({ fixtureIndex: 0, extra: "x".repeat(1100) })).status, 413);
    const malformed = await request("/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" });
    assert.equal(malformed.status, 400); assert.equal(calls, 0);
    assert.equal((await request("/api/premium-report/download")).status, 404);
    // All actual synthetic fixtures pass the local legacy display adapter.
    for (const fixture of benchmarkFixtures) {
      const input = buildSleepPremiumInput(fixture.answers);
      assert.equal(input.profile, fixture.expectedProfile);
      const fallback = adaptLegacyFallbackForLocalPreview(buildSleepPremiumFallback(input), input);
      assert.equal(fallback.plan.length, 7); assert.equal(fallback.sources.length, 0);
      assert.equal(fallback.model_version, "local-legacy-fallback-display.v1");
    }
    // A synthetic valid master tests the REAL writer validation and adapter.
    // This is structural scaffolding, not AI copy or semantic/clinical approval.
    const brief = buildSleepPremiumWriterBrief(buildSleepPremiumInput(benchmarkFixtures[4].answers));
    const insights = [brief.primary_insight, ...brief.secondary_insights];
    const master = {
      version: 1, profile: brief.profile, intro: "Ovo je pregled opažanja uz otvorena pitanja.",
      priority: { area: brief.priority.area, explanation: "Početak ostaje uz prijavljeno iskustvo.", first_step: "Zadrži odabrani korak u njegovim granicama." },
      insights: insights.map((entry) => ({ insight_id: entry.insight_id, title: "Odabrano opažanje", text: "Iskustva ostaju odvojena pri poređenju.", evidence_ids: [], device_id: null })),
      tracking: [], plan7: brief.experiment7.map((day) => ({ day: day.day, action: "Zadrži postojeći korak bez dodatnog zadatka.", observe: "Primeti svoje iskustvo.", technique_id: day.technique_id, theme_ids: [...day.themeIds] })),
      alternatives: [], uncertainty: { question: null, anchor_fact_ids: [] },
      supporting_content: { insights: insights.map(({ insight_id }) => ({ insight_id, context: "Opažanje ostavlja prostor za ono što nije poznato." })),
        days: brief.experiment7.map(({ day }) => ({ day, rationale: "Osvrt ostaje uz postojeći korak.", reflection: null })), closing: "Zadrži prostor za ono što još nije poznato." },
      provenance: { primary_insight_id: brief.primary_insight.insight_id, evidence_ids: [],
        technique_ids: [...new Set(brief.experiment7.map(({ technique_id }) => technique_id).filter((id) => id !== null))], device_ids: [] },
      compliance: { no_diagnosis: true, no_causation: true, no_guarantee: true },
    };
    response = { status: "completed", output_text: JSON.stringify(master), usage: { input_tokens: 12, output_tokens: 34, total_tokens: 46 } };
    generations = 0;
    const accepted = await post({ fixtureIndex: 4 });
    assert.equal(accepted.status, 200); assert.equal(accepted.body.source, "ai"); assert.equal(accepted.body.masterBuilt, true);
    assert.equal(accepted.body.requestCount, 1); assert.equal(accepted.body.usage.total_tokens, 46);
    assert.equal(accepted.body.preview.tracking.length, 0); assert.equal(accepted.body.preview.alternatives.length, 0);
    assert.equal(accepted.body.preview.pdf.available, false);
    // Resolved bibliography survives projection; only valid HTTPS URLs link.
    const sourceInput = buildSleepPremiumInput(benchmarkFixtures[0].answers);
    const sourceBrief = buildSleepPremiumWriterBrief(sourceInput);
    const sourceInsights = [sourceBrief.primary_insight, ...sourceBrief.secondary_insights];
    const sourceMaster = structuredClone(master);
    const claimId = sourceBrief.primary_insight.evidence_claim_ids[0];
    assert.ok(claimId, "Source-link smoke fixture must exercise selected science.");
    sourceMaster.profile = sourceBrief.profile; sourceMaster.priority.area = sourceBrief.priority.area;
    sourceMaster.insights = sourceInsights.map((entry, index) => ({ ...master.insights[0], insight_id: entry.insight_id, evidence_ids: index === 0 ? [claimId] : [] }));
    sourceMaster.supporting_content.insights = sourceInsights.map(({ insight_id }) => ({ ...master.supporting_content.insights[0], insight_id }));
    sourceMaster.plan7 = sourceBrief.experiment7.map((day, index) => ({ ...master.plan7[index], technique_id: day.technique_id, theme_ids: [...day.themeIds] }));
    sourceMaster.uncertainty = { question: sourceBrief.best_next_question ? "Da li ova iskustva opisuješ tokom istih dana?" : null,
      anchor_fact_ids: [...(sourceBrief.best_next_question?.fact_ids ?? [])] };
    sourceMaster.provenance = { primary_insight_id: sourceBrief.primary_insight.insight_id, evidence_ids: [claimId], device_ids: [],
      technique_ids: [...new Set(sourceMaster.plan7.map(({ technique_id }) => technique_id).filter((id) => id !== null))] };
    const registryPreview = adaptSleepPremiumMasterForPreview(sourceMaster, sourceBrief, { library: loadSleepEvidenceLibrary() });
    const projected = projectGeneration({ source: "ai", master: sourceMaster, validation: { valid: true }, preview: registryPreview }, sourceInput);
    assert.ok(projected.preview.sources.length); assert.ok(projected.preview.connections[0].source_labels.length);
    assert.ok(projected.preview.sources.every(({ url }) => url === null || url.startsWith("https://")));
    assert.ok(!/registry_snapshot|provenance|approved_science|rejectedDraft/u.test(JSON.stringify(projected)));
    response = { status: "completed", output_text: '{"unsafe":"sk-not-for-display"}', usage: { input_tokens: 7, output_tokens: 9, total_tokens: 16 } };
    const fallbacks = await Promise.all([0, 1, 2, 3, 5].map((fixtureIndex) => post({ fixtureIndex })));
    for (const fallback of fallbacks) {
      assert.equal(fallback.status, 200); assert.equal(fallback.body.source, "fallback"); assert.equal(fallback.body.masterBuilt, false);
      assert.equal(fallback.body.validationStatus, "legacy_fallback_valid"); assert.equal(fallback.body.requestCount, 1);
      assert.equal(fallback.body.usage.total_tokens, 16); assert.equal(fallback.body.preview.plan.length, 7);
      assert.ok(!/sk-not-for-display|rejectedDraft|registry_snapshot|supporting_facts/u.test(JSON.stringify(fallback.body)));
    }
    assert.equal(calls, 6); assert.equal(factories, 6);
    assert.equal((await post()).status, 429); assert.equal(calls, 6);
    assert.equal((await request("/config")).body.limitReached, true);
    console.log("PASS: server + inline script syntax; silent import; exact gates; missing-key 503/zero calls; strict synthetic input; host/origin guards; actual writer/adapter AI + legacy display; safe counts/projection; concurrent six-call cap. Offline only, no live API or credentials.");
  } finally {
    globalThis.fetch = originalFetch;
    if (server) { server.closeAllConnections(); await new Promise((done) => server.close(done)); }
    envKeys.forEach((key, index) => { if (saved[index] === undefined) delete process.env[key]; else process.env[key] = saved[index]; });
    generations = savedGenerations;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === "--test") {
    runOfflineSmokeTests().catch(() => { console.error("FAIL: offline preview smoke test."); process.exitCode = 1; });
  } else if (args.length === 0) startPremiumWriterPreview();
  else { console.error("Supported option: --test. No server started."); process.exitCode = 1; }
}