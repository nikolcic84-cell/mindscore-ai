import express from "express";
import { closeSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";

const V1_PATH = "/api/dev/premium-writer-benchmark";
const V2_PATH = "/api/dev/premium-writer-benchmark-v2";
const V3_PATH = "/api/dev/premium-writer-benchmark-v3";
const V4_PATH = "/api/dev/premium-writer-benchmark-v4";
const V5_PATH = "/api/dev/premium-writer-benchmark-v5";
const HOST = "mindscore-premium-staging.onrender.com";
const V1_VERSION = "phase2bench.v1";
const V2_VERSION = "phase2bench.v2";
const V3_VERSION = "phase2bench.v3";
const V4_VERSION = "phase2bench.v4";
const V5_VERSION = "phase2bench.v5";
const FIXTURES = Object.freeze(["A", "B", "C", "D", "E", "F"]);
const MAX_JSON_BYTES = 256 * 1024;
// Shared by every registration/cache directory in this process, not per app.
let activeJob = null;
const enabled = (env) => env.RENDER_GIT_BRANCH === "premium-ai-staging" &&
  env.ENABLE_PREMIUM_AI_PREVIEW === "true" && env.RENDER_EXTERNAL_HOSTNAME === HOST;
const commit = (env) => typeof env.RENDER_GIT_COMMIT === "string" && /^[a-f\d]{40}$/iu.test(env.RENDER_GIT_COMMIT)
  ? env.RENDER_GIT_COMMIT : null;
const known = (fixture) => typeof fixture === "string" && FIXTURES.includes(fixture);

// No evidence/writer/benchmark imports on an ungated registration (or GET).
async function dependencies() {
  const [fixtures, formatter, input, writer, storyBenchmark] = await Promise.all([
    import("../scripts/debug-sleep-premium-story-material.js"),
    import("../scripts/run-sleep-premium-writer-benchmarks.js"),
    import("./sleepPremiumInput.js"), import("./sleepPremiumWriter.js"),
    import("../scripts/run-sleep-premium-story-benchmarks.js"),
  ]);
  return { ...fixtures, ...formatter, ...input, ...writer, ...storyBenchmark };
}

/** Staging exposure gate, NOT authentication. Mount by dynamic import ONLY
 * after the server's exact premium-ai-staging branch check. No customer flow,
 * SDK construction, env changes, secrets, listening or import-time generation.
 * A..F map in order to the existing six frozen synthetic benchmark fixtures.
 * Reservations are never deleted/retried, including failures/timeouts/crashes.
 * Budget survives restarts ONLY while this cache survives: Render ephemeral
 * storage/redeploys can reset it. Use one stable cache directory per service;
 * process-wide concurrency is not a distributed multi-instance lock.
 */
function registerNamespace(app, { path, version, directory, generationEnabled, openaiClient, apiKeyAvailable, env }) {
  const reply = (res, code, body) => res.status(code).json(body);
  const error = (res, code, name, fixture) => reply(res, code, {
    version, error: name,
    ...(fixture ? { fixture, retryGet: `${path}?fixture=${fixture}` } : {}),
  });
  const gate = (req, res, next) => {
    res.set({ "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
    // req.hostname may trust X-Forwarded-Host if the parent uses trust proxy.
    // Require BOTH it and the actual Host header; never accept forwarded host.
    const authority = req.headers.host;
    if (!enabled(env) || req.hostname !== HOST || typeof authority !== "string" ||
      !new RegExp(`^${HOST.replaceAll(".", "\\.")}(?::[0-9]+)?$`, "u").test(authority)) {
      return error(res, 404, "route_not_found");
    }
    next();
  };
  const prepareDisk = () => {
    if (!directory) throw new Error("Unavailable");
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    if (!lstatSync(directory).isDirectory() || lstatSync(directory).isSymbolicLink()) throw new Error("Unavailable");
  };
  const readState = (fixture) => {
    const resultPath = join(directory, `${fixture}.json`);
    const reserved = existsSync(join(directory, `${fixture}.reserved`));
    if (existsSync(resultPath)) {
      const stat = lstatSync(resultPath);
      if (!reserved || !stat.isFile() || stat.isSymbolicLink() || stat.size >= MAX_JSON_BYTES) throw new Error("Unavailable");
      const payload = JSON.parse(readFileSync(resultPath, "utf8"));
      if (payload.version !== version || payload.fixture !== fixture || payload.review_only !== true ||
        payload.release_allowed !== false || !["completed", "failed"].includes(payload.status)) throw new Error("Unavailable");
      return { status: payload.status, payload };
    }
    return { status: reserved ? (activeJob?.directory === directory && activeJob.fixture === fixture ? "in_progress" : "reserved") : "unused" };
  };
  const queryFixture = (req) => {
    const query = new URL(req.originalUrl, "http://benchmark.invalid").searchParams;
    if (!query.size) return null;
    if (query.size !== 1 || !known(query.get("fixture"))) throw new Error("Invalid query");
    return query.get("fixture");
  };
  const save = (fixture, payload) => {
    const json = JSON.stringify(payload);
    if (Buffer.byteLength(json, "utf8") >= MAX_JSON_BYTES) throw new Error("Too large");
    // Atomic publication: GET cannot see a half-written successful result.
    // A leftover temp file after a crash does not allow another generation.
    const temp = join(directory, `${fixture}.json.tmp`);
    writeFileSync(temp, json, { flag: "wx", mode: 0o600 });
    renameSync(temp, join(directory, `${fixture}.json`));
  };

  app.get(path, gate, (req, res) => {
    let fixture;
    try { fixture = queryFixture(req); } catch { return error(res, 400, "invalid_query"); }
    try {
      prepareDisk();
      if (fixture) {
        const state = readState(fixture);
        if (state.payload) return reply(res, 200, state.payload);
        return error(res, state.status === "unused" ? 404 : 409, state.status, fixture);
      }
      const fixtures = Object.fromEntries(FIXTURES.map((id) => [id, readState(id).status]));
      return reply(res, 200, { version, commit: commit(env), enabled: enabled(env),
        completed: Object.values(fixtures).filter((state) => state === "completed").length, fixtures });
    } catch { return error(res, 503, "cache_unavailable"); }
  });

  // v1 remains available for status and historical cache reads only. Its
  // POST is retired deliberately, even for cached fixtures; use GET to read.
  if (!generationEnabled) {
    app.post(path, gate, (_req, res) => error(res, 410, "generation_retired"));
    return;
  }

  // Works with or without an existing parent JSON parser. The route-local
  // error handler never echoes malformed bodies or parser/SDK/filesystem errors.
  app.post(path, gate, express.json({ limit: 1024, strict: false }), async (req, res) => {
    const body = req.body;
    let query;
    try { query = queryFixture(req); } catch { return error(res, 400, "invalid_query"); }
    if (query !== null || !req.is("application/json") || !body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).length !== 1 || !Object.hasOwn(body, "fixture") || !known(body.fixture)) {
      return error(res, 400, "invalid_payload");
    }
    const fixture = body.fixture;
    let claimed = false;
    try {
      prepareDisk();
      const state = readState(fixture);
      if (state.payload) return reply(res, 200, state.payload);
      if (state.status !== "unused") return error(res, 409, state.status, fixture);
      if (activeJob) return error(res, 429, "generation_busy");
      if (apiKeyAvailable !== true || typeof openaiClient?.responses?.create !== "function" ||
        process.env.RENDER_GIT_BRANCH !== "premium-ai-staging" || process.env.ENABLE_PREMIUM_AI_PREVIEW !== "true") {
        return error(res, 503, "writer_unavailable");
      }
      // Synchronous O_EXCL claim + process lock before the first await: neither
      // simultaneous requests nor another process can claim this fixture twice.
      let fd;
      try {
        fd = openSync(join(directory, `${fixture}.reserved`), "wx", 0o600);
        claimed = true;
      } catch (failure) {
        return error(res, failure.code === "EEXIST" ? 409 : 503,
          failure.code === "EEXIST" ? "reserved" : "cache_unavailable", failure.code === "EEXIST" ? fixture : undefined);
      } finally { if (fd !== undefined) closeSync(fd); }
      activeJob = { directory, fixture };
      const started = performance.now();
      const api = await dependencies();
      // Import may yield to a runtime gate change; do not spend an API call.
      if (!enabled(env)) return error(res, 404, "route_not_found");
      if (api.benchmarkFixtures.length !== 6) throw new Error("Fixture contract");
      const synthetic = api.benchmarkFixtures[FIXTURES.indexOf(fixture)];
      const input = api.buildSleepPremiumInput(synthetic.answers);
      if (input.profile !== synthetic.expectedProfile) throw new Error("Fixture contract");
      const storyPipeline = version === V4_VERSION || version === V5_VERSION;
      const result = storyPipeline
        ? await api.generateSleepPremiumStoryReport({ input, openaiClient, apiKeyAvailable: true,
          onIncompleteResponse: (metadata) => console.warn("[PREMIUM_AI_STORY_INCOMPLETE_RESPONSE]", JSON.stringify(metadata)),
          logUsage: (metadata) => console.log("[PREMIUM_AI_STORY_USAGE]", JSON.stringify(metadata)) })
        : await api.generateSleepPremiumMaster({ input, openaiClient, apiKeyAvailable: true,
          internalBenchmark: true, includeRejectedDraft: true, includePreview: true });
      const review = storyPipeline
        ? JSON.parse(api.formatSleepPremiumStoryBenchmark(result, { fixtureId: fixture, format: "json", benchmarkVersion: version }))
        : JSON.parse(api.formatBenchmark(result, { fixtureId: fixture, format: "json" }));
      const payload = { version, commit: commit(env), fixture,
        profile: storyPipeline ? result.master.profile : result.brief.profile,
        priority: storyPipeline ? result.master.priority.area : result.brief.priority.area,
        latencyMilliseconds: Math.round(performance.now() - started),
        status: storyPipeline ? (result.report && result.validation?.valid ? "completed" : "failed")
          : result.source === "ai" && result.validation?.valid === true ? "completed" : "failed",
        phase2reviewonly: true, review_only: true, release_allowed: false, result: review };
      if (Buffer.byteLength(JSON.stringify(payload), "utf8") >= MAX_JSON_BYTES) {
        // Never clip prose into a purported full report, or regenerate it.
        payload.status = "failed";
        payload.result = null;
        payload.error = "review_result_too_large";
      }
      save(fixture, payload);
      return reply(res, 200, payload);
    } catch {
      // No reservation is removed, even if formatting/persistence fails.
      return error(res, 503, "benchmark_unavailable", claimed ? fixture : undefined);
    } finally {
      if (claimed && activeJob?.directory === directory && activeJob.fixture === fixture) activeJob = null;
    }
  }, (failure, req, res, next) => {
    if (!failure) return next();
    return error(res, failure.type === "entity.too.large" ? 413 : 400, "invalid_payload");
  });
}

/** Staging-only benchmark route set. Each version keeps its own cache; v4
 * generation is retired, and v5 is the new six-fixture story-writer run.
 */
export function registerSleepPremiumBenchmarkRoute(app, {
  openaiClient, apiKeyAvailable, cacheDir, env = process.env,
} = {}) {
  if (!enabled(env)) return false;
  const directory = typeof cacheDir === "string" && isAbsolute(cacheDir) ? resolve(cacheDir) : null;
  // server.js owns the stable v1 path. Derive independent siblings without
  // migrating, deleting, or modifying any historical version's cache.
  const directoryForVersion = (version) => directory
    ? /-v[1-5]$/u.test(basename(directory))
      ? join(dirname(directory), `${basename(directory).replace(/-v[1-5]$/u, "")}-${version}`)
      : join(directory, `premium-writer-benchmark-${version}`)
    : null;
  const v2Directory = directoryForVersion("v2");
  const v3Directory = directoryForVersion("v3");
  const v4Directory = directoryForVersion("v4");
  const v5Directory = directoryForVersion("v5");
  registerNamespace(app, { path: V1_PATH, version: V1_VERSION, directory,
    generationEnabled: false, openaiClient, apiKeyAvailable, env });
  registerNamespace(app, { path: V2_PATH, version: V2_VERSION, directory: v2Directory,
    generationEnabled: false, openaiClient, apiKeyAvailable, env });
  registerNamespace(app, { path: V3_PATH, version: V3_VERSION, directory: v3Directory,
    generationEnabled: true, openaiClient, apiKeyAvailable, env });
  registerNamespace(app, { path: V4_PATH, version: V4_VERSION, directory: v4Directory,
    generationEnabled: false, openaiClient, apiKeyAvailable, env });
  registerNamespace(app, { path: V5_PATH, version: V5_VERSION, directory: v5Directory,
    generationEnabled: true, openaiClient, apiKeyAvailable, env });
  return true;
}