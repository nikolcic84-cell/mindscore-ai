import OpenAI from "openai";
import { buildSleepPremiumInput } from "../sleepPremiumInput.js";
import {
  getSleepPremiumPositiveOrWatchTitle,
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
  let safeDetail = [error?.name, error?.message, code, type]
    .filter(Boolean)
    .join(" ")
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/gi, "[REDACTED]")
    .replace(/\bBearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(/OPENAI_API_KEY\s*[:=]\s*[^\s,;]+/gi, "OPENAI_API_KEY=[REDACTED]");
  if (process.env.OPENAI_API_KEY) safeDetail = safeDetail.replaceAll(process.env.OPENAI_API_KEY, "[REDACTED]");

  if (error?.name === "PremiumAITimeoutError" || /timed out|timeout|aborterror|etimedout/i.test(safeDetail)) {
    return { category: "timeout", status, detail: safeDetail };
  }
  if (status === 401 || status === 403 || /authentication|invalid_api_key|permission_denied/i.test(`${code} ${type}`)) {
    return { category: "authentication error", status, detail: safeDetail };
  }
  if (/insufficient_quota|quota_exceeded|billing_hard_limit/i.test(`${code} ${type} ${safeDetail}`)) {
    return { category: "quota error", status, detail: safeDetail };
  }
  if (status === 429 || /rate_limit|too_many_requests/i.test(`${code} ${type}`)) {
    return { category: "rate limit error", status, detail: safeDetail };
  }
  if (/schema|json|parsed|validation|incomplete/i.test(safeDetail)) {
    return { category: "schema/JSON validation error", status, detail: safeDetail };
  }
  if (/model_not_found|invalid_model|model.*not found|unsupported model/i.test(`${code} ${type} ${safeDetail}`)) {
    return { category: "model/API error", status, detail: safeDetail };
  }
  return { category: "model/API error", status, detail: safeDetail || "No safe diagnostic details available." };
};

let profileName = "NOT CALCULATED";
let schemaStatus = "NOT RUN";
let fallbackUsed = false;
let testSucceeded = false;

const failUnless = (condition, message) => {
  if (!condition) throw new Error(message);
};

const printCustomerReport = (report) => {
  console.log("\n=== VALIDATED SERBIAN PREMIUM REPORT ===");
  console.log("\nA. PROFILE");
  console.log(report.profile.name);
  console.log(report.profile.summary);

  console.log("\nB. GDE TVOJ SAN NAJVIŠE TRPI?");
  console.log(report.mainArea.title);
  console.log(report.mainArea.explanation);

  console.log("\nC. ŠTA SE KOD TEBE POVEZUJE?");
  report.connections.items.forEach((item, index) => console.log(`${index + 1}. ${item}`));

  console.log(`\nD. ${report.positiveOrWatch.title.toLocaleUpperCase("sr-Latn")}`);
  console.log(report.positiveOrWatch.text);

  console.log(`\nE. ${report.startingPoint.title.toLocaleUpperCase("sr-Latn")}`);
  console.log(report.startingPoint.text);

  console.log(`\nF. ${report.tonight.title.toLocaleUpperCase("sr-Latn")}`);
  report.tonight.actions.forEach((action, index) => console.log(`${index + 1}. ${action}`));

  console.log("\nG. TVOJ PLAN ZA NAREDNIH 7 DANA");
  report.sevenDayPlan.forEach((day) => console.log(`${day.title}: ${day.action}`));

  console.log(`\nH. ${report.tracking.title.toLocaleUpperCase("sr-Latn")}`);
  report.tracking.items.forEach((item, index) => console.log(`${index + 1}. ${item}`));

  console.log("\nI. ZAVRŠNA PORUKA");
  console.log(report.closing);
};

try {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is unavailable in this Render service environment.");
  }

  const input = buildSleepPremiumInput(ANSWER_POINTS);
  profileName = input.profile;
  failUnless(profileName === EXPECTED_PROFILE, `Expected ${EXPECTED_PROFILE}; deterministic input produced ${profileName}.`);

  const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const generation = await generateSleepPremiumReport({
    input,
    openaiClient,
    apiKeyAvailable: true,
    fallbackOnError: false,
    timeoutMs: STAGING_AI_TIMEOUT_MS,
  });
  fallbackUsed = generation.source === "fallback";
  failUnless(generation.source === "ai", `Expected AI source; generator returned ${generation.source}.`);

  const validation = validateSleepPremiumReport(generation.report, input);
  if (!validation.valid) {
    schemaStatus = "FAIL";
    throw new Error(`Strict Premium schema validation failed: ${validation.reason}`);
  }

  failUnless(generation.report.profile.name === EXPECTED_PROFILE, "AI profile does not match the deterministic profile.");
  failUnless(generation.report.positiveOrWatch.mode === getSleepPremiumStrengthMode(input), "Positive/watch mode does not match deterministic dimensions.");
  failUnless(generation.report.positiveOrWatch.title === getSleepPremiumPositiveOrWatchTitle(getSleepPremiumStrengthMode(input)), "Positive/watch title does not match deterministic mode.");
  failUnless(generation.report.tonight.actions.length === 3, "Expected exactly three tonight actions.");
  failUnless(generation.report.sevenDayPlan.length === 7, "Expected exactly seven plan days.");
  failUnless(generation.report.tracking.items.length >= 2 && generation.report.tracking.items.length <= 4, "Expected two to four tracking items.");

  schemaStatus = "PASS";
  printCustomerReport(generation.report);
  testSucceeded = true;
} catch (error) {
  const diagnostic = classifyFailure(error);
  if (diagnostic.category === "schema/JSON validation error") schemaStatus = "FAIL";
  console.error("Real Premium AI test diagnostic:", JSON.stringify(diagnostic));
} finally {
  console.log(`REAL AI TEST: ${testSucceeded ? "SUCCESS" : "FAILED"}`);
  console.log(`PROFILE: ${profileName}`);
  console.log(`SCHEMA: ${schemaStatus}`);
  console.log(`FALLBACK USED: ${fallbackUsed ? "YES" : "NO"}`);
}

if (!testSucceeded) process.exitCode = 1;
