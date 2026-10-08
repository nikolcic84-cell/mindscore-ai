import OpenAI from "openai";
import { buildSleepPremiumInput } from "../sleepPremiumInput.js";
import {
  getSleepPremiumPriority,
  getSleepPremiumStrengthMode,
  validateSleepPremiumReport,
} from "../sleepPremiumSchema.js";
import { generateSleepPremiumReport } from "../sleepPremiumGenerator.js";

const ANSWER_POINTS = Object.freeze([4, 5, 2, 3, 5, 4, 4, 3, 4, 4, 3, 3]);
const EXPECTED_PROFILE = "ISPREKIDAN SAN";
const STAGING_AI_TIMEOUT_MS = 60_000;

const classifyFailure = (error) => {
  const status = Number(error?.status || error?.statusCode) || null;
  const code = String(error?.code || error?.error?.code || "").toLowerCase();
  const type = String(error?.type || error?.error?.type || "").toLowerCase();
  if (error?.name === "PremiumAITimeoutError" || code === "etimedout" || code === "aborted") {
    return { category: "timeout", status };
  }
  if (status === 401 || status === 403 || /authentication|invalid_api_key|permission_denied/i.test(`${code} ${type}`)) {
    return { category: "authentication error", status };
  }
  if (/insufficient_quota|quota_exceeded|billing_hard_limit/i.test(`${code} ${type}`)) {
    return { category: "quota error", status };
  }
  if (status === 429 || /rate_limit|too_many_requests/i.test(`${code} ${type}`)) {
    return { category: "rate limit error", status };
  }
  if (code === "premium_schema_validation") {
    return {
      category: "schema/JSON validation error",
      status,
      field: error.diagnostic?.field || "unknown",
      expected: error.diagnostic?.expected || "unspecified constraint",
      received: error.diagnostic?.received || { type: "unknown" },
    };
  }
  if (error instanceof SyntaxError || error instanceof TypeError) {
    return { category: "schema/JSON validation error", status, field: "response JSON", expected: "complete JSON object", received: { type: "unparseable JSON" } };
  }
  if (/model_not_found|invalid_model|unsupported_model/i.test(`${code} ${type}`)) {
    return { category: "model/API error", status };
  }
  return { category: "model/API error", status };
};

let profileCheck = false;
let schemaStatus = "NOT RUN";
let fallbackUsed = false;
let testSucceeded = false;

const failUnless = (condition, message) => {
  if (!condition) throw new Error(message);
};

try {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is unavailable in this Render service environment.");
  }

  const input = buildSleepPremiumInput(ANSWER_POINTS);
  failUnless(input.profile === EXPECTED_PROFILE, "Deterministic profile did not match the expected staging fixture.");
  profileCheck = true;

  const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const generation = await generateSleepPremiumReport({
    input,
    openaiClient,
    apiKeyAvailable: true,
    fallbackOnError: false,
    timeoutMs: STAGING_AI_TIMEOUT_MS,
    onCustomerSafetyFailure: (diagnostic) => console.error("CUSTOMER SAFETY: FAIL", JSON.stringify(diagnostic)),
  });
  fallbackUsed = generation.source === "fallback";
  failUnless(generation.source === "ai", `Expected AI source; generator returned ${generation.source}.`);

  const validation = validateSleepPremiumReport(generation.report, input);
  if (!validation.valid) {
    schemaStatus = "FAIL";
    throw new Error(`Strict Premium schema validation failed: ${validation.reason}`);
  }

  failUnless(generation.report.profile === EXPECTED_PROFILE, "AI profile does not match the deterministic profile.");
  failUnless(generation.report.priority.area === getSleepPremiumPriority(input).title, "Priority does not match the deterministic selector.");
  failUnless(generation.report.stable_or_tracking.mode === getSleepPremiumStrengthMode(input), "Stable/tracking mode does not match deterministic dimensions.");
  failUnless(generation.report.review_questions.length === 3, "Expected exactly three review questions.");
  failUnless(generation.report.seven_day_plan.length === 7, "Expected exactly seven plan days.");

  schemaStatus = "PASS";
  testSucceeded = true;
} catch (error) {
  const diagnostic = classifyFailure(error);
  if (diagnostic.category === "schema/JSON validation error") schemaStatus = "FAIL";
  console.error("Real Premium AI test diagnostic:", JSON.stringify(diagnostic));
} finally {
  console.log(`REAL AI TEST: ${testSucceeded ? "SUCCESS" : "FAILED"}`);
  console.log(`DETERMINISTIC PROFILE CHECK: ${profileCheck ? "PASS" : "FAIL"}`);
  console.log(`SCHEMA: ${schemaStatus}`);
  console.log(`FALLBACK USED: ${fallbackUsed ? "YES" : "NO"}`);
}

if (!testSucceeded) process.exitCode = 1;
