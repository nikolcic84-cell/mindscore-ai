import { buildSleepPremiumInput } from "./sleepPremiumInput.js";
import { generateSleepPremiumReport } from "./sleepPremiumGenerator.js";
import { validateSleepPremiumReport } from "./sleepPremiumSchema.js";

export const isPremiumAiPreviewEnabled = (env = process.env) => env.ENABLE_PREMIUM_AI_PREVIEW === "true";

const logPreviewStatus = (log, label, details = {}) => log(label, details);
const getFallbackDiagnostic = (generation) => {
  switch (generation?.failureType) {
    case "missing_api_key":
      return { code: "MISSING_API_KEY", reason: "OpenAI API key unavailable." };
    case "timeout":
      return { code: "TIMEOUT", reason: "OpenAI request timed out.", ...(generation.status ? { status: generation.status } : {}) };
    case "invalid_json":
      return {
        code: "INVALID_JSON",
        reason: "Invalid AI JSON.",
        ...(generation.jsonDiagnostics ? { jsonDiagnostics: generation.jsonDiagnostics } : {}),
      };
    case "model_refusal":
      return {
        code: "MODEL_REFUSAL",
        reason: "The AI did not return a report.",
        ...(generation.jsonDiagnostics ? { jsonDiagnostics: generation.jsonDiagnostics } : {}),
      };
    case "incomplete_response":
      return { code: "INCOMPLETE_RESPONSE", reason: "Incomplete OpenAI response." };
    case "schema_validation_failure":
      return {
        code: "SCHEMA_VALIDATION_FAILURE",
        reason: "Schema validation failed.",
        ...(generation.failureDiagnostic ? { field: generation.failureDiagnostic.field, expected: generation.failureDiagnostic.expected, received: generation.failureDiagnostic.received } : {}),
      };
    case "openai_http_error":
      return { code: "OPENAI_HTTP_ERROR", reason: "OpenAI HTTP/API error.", ...(generation.status ? { status: generation.status } : {}) };
    case "openai_request_failed":
      return { code: "OPENAI_REQUEST_FAILED", reason: "OpenAI request failed." };
    default:
      return { code: "OTHER_GENERATOR_ERROR", reason: "Other Premium generator error." };
  }
};
export const generateSleepPremiumPreview = async ({
  enabled = isPremiumAiPreviewEnabled(),
  answers,
  openaiClient,
  apiKeyAvailable = false,
  timeoutMs,
  log = () => {},
}) => {
  if (!enabled) return { status: 404, body: { error: "Preview unavailable." } };

  let input;
  try {
    input = buildSleepPremiumInput(answers);
  } catch {
    return { status: 400, body: { error: "A complete valid sleep assessment is required." } };
  }

  logPreviewStatus(log, "PREMIUM PREVIEW REQUEST", { deterministicProfile: input.profile });
  let generation;
  try {
    generation = await generateSleepPremiumReport({
      input,
      openaiClient,
      apiKeyAvailable,
      fallbackOnError: true,
      includeFailureDiagnostics: true,
      onCustomerSafetyFailure: (diagnostic) => logPreviewStatus(log, "CUSTOMER SAFETY: FAIL", diagnostic),
      ...(timeoutMs ? { timeoutMs } : {}),
    });
  } catch (error) {
    const diagnostic = error?.code === "PREMIUM_SCHEMA_VALIDATION" ? error.diagnostic : null;
    logPreviewStatus(log, "REAL AI: FAILED", { deterministicProfile: input.profile });
    logPreviewStatus(log, "SCHEMA: FAIL", diagnostic || {});
    logPreviewStatus(log, "FALLBACK USED: NO", { deterministicProfile: input.profile });
    return {
      status: 502,
      body: {
        error: "Unable to generate a safe Premium preview.",
        ...(diagnostic ? { diagnostic } : {}),
      },
    };
  }

  const validation = validateSleepPremiumReport(generation.report, input);
  if (!validation.valid || validation.report.profile !== input.profile) {
    const diagnostic = validation.diagnostic || {
      field: "profile",
      expected: "exact deterministic profile",
      received: { type: "mismatch" },
    };
    logPreviewStatus(log, "REAL AI: FAILED", { deterministicProfile: input.profile });
    logPreviewStatus(log, "SCHEMA: FAIL", diagnostic);
    logPreviewStatus(log, `FALLBACK USED: ${generation.source === "fallback" ? "YES" : "NO"}`, { deterministicProfile: input.profile });
    return { status: 502, body: { error: "Generated report failed Premium validation.", diagnostic } };
  }

  const fallbackUsed = generation.source === "fallback";
  const fallbackDiagnostic = fallbackUsed ? getFallbackDiagnostic(generation) : null;
  logPreviewStatus(log, `REAL AI: ${fallbackUsed ? "FAILED" : "SUCCESS"}`, { deterministicProfile: input.profile });
  const schemaStatus = !fallbackUsed
    ? "PASS"
    : generation.failureType === "invalid_json" || generation.failureType === "schema_validation_failure"
      ? "FAIL"
      : "NOT RUN";
  logPreviewStatus(log, `SCHEMA: ${schemaStatus}`, {
    deterministicProfile: input.profile,
    ...(fallbackDiagnostic?.field ? { field: fallbackDiagnostic.field, expected: fallbackDiagnostic.expected, received: fallbackDiagnostic.received } : {}),
  });
  logPreviewStatus(log, `FALLBACK USED: ${fallbackUsed ? "YES" : "NO"}`, {
    deterministicProfile: input.profile,
    ...(fallbackDiagnostic ? {
      reason: fallbackDiagnostic.code,
      ...(fallbackDiagnostic.status ? { status: fallbackDiagnostic.status } : {}),
      ...(fallbackDiagnostic.field ? { field: fallbackDiagnostic.field, expected: fallbackDiagnostic.expected, received: fallbackDiagnostic.received } : {}),
      ...(fallbackDiagnostic?.jsonDiagnostics ? { jsonDiagnostics: fallbackDiagnostic.jsonDiagnostics } : {}),
    } : {}),
  });

  return {
    status: 200,
    body: {
      source: fallbackUsed ? "fallback" : "ai",
      ...(fallbackDiagnostic ? { fallbackDiagnostic } : {}),
      deterministicProfile: input.profile,
      report: validation.report,
    },
  };
};
