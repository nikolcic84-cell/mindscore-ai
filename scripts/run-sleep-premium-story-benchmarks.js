import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { benchmarkFixtures } from "./debug-sleep-premium-story-material.js";
import { buildSleepPremiumInput } from "../server/sleepPremiumInput.js";
import { buildDeterministicSleepPremiumStoryReport, generateSleepPremiumStoryReport } from "../server/sleepPremiumStoryWriter.js";

export { generateSleepPremiumStoryReport };

export function formatSleepPremiumStoryBenchmark(result, { fixtureId = "unspecified", format = "text", benchmarkVersion = "phase2bench.v4" } = {}) {
  const raw = safeRawProse(result.rawGptProse);
  const report = {
    banner: "INTERNAL SYNTHETIC BENCHMARK — REVIEW ONLY — NOT CUSTOMER RELEASE",
    version: benchmarkVersion,
    fixture: fixtureId,
    source: result.source,
    validation: result.validation,
    failure: result.failure ?? null,
    request_count: result.requestCount,
    usage: result.usage,
    metrics: result.metrics,
    raw_gpt_prose: raw.value,
    raw_gpt_prose_withheld: raw.withheld,
    accepted_prose: result.prose,
    deterministic_master: result.master,
    assembled_report: result.report,
    writer_brief_characters: result.metrics?.writerBriefCharacters ?? null,
    instructions_characters: result.metrics?.instructionsCharacters ?? null,
    schema_characters: result.metrics?.schemaCharacters ?? null,
    estimated_request_characters: result.metrics?.estimatedRequestCharacters ?? null,
    actual_provider_input_tokens: result.metrics?.actualProviderInputTokens ?? null,
    actual_provider_output_tokens: result.metrics?.actualProviderOutputTokens ?? null,
    latency_milliseconds: result.metrics?.latencyMilliseconds ?? null,
    review_only: true,
    release_allowed: false,
  };
  return format === "json" ? JSON.stringify(report, null, 2) : JSON.stringify(report, null, 2);
}
const PRIVATE_TEXT = /\S+@\S+|\b(?:sk[-_]|pk_(?:live|test)_|whsec_|bearer\s+\S+|password\s*[:=]|api[_ -]?key\s*[:=]|secret\s*[:=])\S*|\b[0-9a-f]{8}-[0-9a-f-]{27,}\b|(?:\+?\d[\s().-]*){7,}/iu;
function safeRawProse(value) {
  let withheld = false;
  const visit = (entry) => {
    if (typeof entry === "string" && PRIVATE_TEXT.test(entry)) { withheld = true; return "[withheld: possible private identifier/credential]"; }
    if (Array.isArray(entry)) return entry.map(visit);
    if (entry && typeof entry === "object") return Object.fromEntries(Object.entries(entry).map(([key, child]) => [key, visit(child)]));
    return entry;
  };
  return { value: visit(value), withheld };
}

export async function runSleepPremiumStoryBenchmarks({ json = false } = {}) {
  const { default: dotenv } = await import("../server/node_modules/dotenv/lib/main.js");
  dotenv.config({ path: fileURLToPath(new URL("../server/.env", import.meta.url)), override: false });
  dotenv.config({ path: fileURLToPath(new URL("../.env", import.meta.url)), override: false });
  const enabled = process.env.RENDER_GIT_BRANCH === "premium-ai-staging" && process.env.ENABLE_PREMIUM_AI_PREVIEW === "true";
  if (!enabled || !process.env.OPENAI_API_KEY?.trim()) {
    return { status: "BLOCKED", request_count: 0, reason: enabled ? "OPENAI_API_KEY unavailable" : "Staging preview gate unavailable", reports: [] };
  }
  const { default: OpenAI } = await import("../server/node_modules/openai/index.mjs");
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0, timeout: 60000 });
  const reports = [];
  for (const fixture of benchmarkFixtures) {
    const input = buildSleepPremiumInput(fixture.answers);
    if (input.profile !== fixture.expectedProfile) throw new Error("Fixture/profile contract changed.");
    const result = await generateSleepPremiumStoryReport({ input, openaiClient: client, apiKeyAvailable: true });
    reports.push(JSON.parse(formatSleepPremiumStoryBenchmark(result, { fixtureId: fixture.id, format: "json" })));
  }
  const summary = { status: "REVIEW_ONLY", fixture_count: reports.length,
    request_count: reports.reduce((sum, report) => sum + report.request_count, 0), reports,
    review_only: true, release_allowed: false };
  console.log(json ? JSON.stringify(summary, null, 2) : JSON.stringify(summary, null, 2));
  return summary;
}

export { buildDeterministicSleepPremiumStoryReport };

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--json")) process.exitCode = 1;
  else runSleepPremiumStoryBenchmarks({ json: args.includes("--json") })
    .catch(() => { console.error("Benchmark failed; no raw provider response or secret is printed."); process.exitCode = 1; });
}
