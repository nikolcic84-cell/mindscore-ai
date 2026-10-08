import { buildSleepPremiumFallback } from "./sleepPremiumFallback.js";
import { buildSleepPremiumPrompt } from "./sleepPremiumPrompt.js";
import {
  buildSleepPremiumJsonSchema,
  diagnoseSleepPremiumCustomerSafety,
  getSleepPremiumAreaOverview,
  getSleepPremiumPriority,
  getSleepPremiumStrengthMode,
  validateSleepPremiumReport,
} from "./sleepPremiumSchema.js";

const MODEL = "gpt-5-mini";
const TIMEOUT_MS = 60_000;
const MAX_OUTPUT_TOKENS = 5000;

const logStagingUsage = (response, source) => {
  if (process.env.RENDER_GIT_BRANCH !== "premium-ai-staging" || process.env.ENABLE_PREMIUM_AI_PREVIEW !== "true") return;
  // Explicit numeric allowlist: never serialize the response, request or whole usage object.
  const count = (value) => Number.isSafeInteger(value) && value >= 0 ? value : null;
  const usage = response?.usage;
  const statuses = ["completed", "incomplete", "failed", "in_progress", "queued", "cancelled"];
  const diagnostic = {
    model: MODEL,
    input_tokens: count(usage?.input_tokens),
    output_tokens: count(usage?.output_tokens),
    total_tokens: count(usage?.total_tokens),
    ...(count(usage?.input_tokens_details?.cached_tokens) !== null
      ? { cached_input_tokens: usage.input_tokens_details.cached_tokens } : {}),
    ...(count(usage?.output_tokens_details?.reasoning_tokens) !== null
      ? { reasoning_tokens: usage.output_tokens_details.reasoning_tokens } : {}),
    response_status: statuses.includes(response?.status) ? response.status : "unavailable",
    source,
  };
  try { console.log("[PREMIUM_AI_USAGE]", JSON.stringify(diagnostic)); } catch { /* Observational only. */ }
};

const classifyGenerationFailure = (error) => {
  const status = Number(error?.status || error?.statusCode) || null;
  if (error?.name === "PremiumAITimeoutError") return { failureType: "timeout", status };
  if (error?.code === "PREMIUM_SCHEMA_VALIDATION") return { failureType: "schema_validation_failure", status };
  if (error?.code === "PREMIUM_INVALID_JSON") return { failureType: "invalid_json", status };
  if (error?.code === "PREMIUM_MODEL_REFUSAL") return { failureType: "model_refusal", status };
  if (error?.message === "AI response was incomplete.") return { failureType: "incomplete_response", status };
  if (status) return { failureType: "openai_http_error", status };
  if (error?.name === "APIConnectionError" || error?.name === "APIError" || error?.name === "OpenAIError") {
    return { failureType: "openai_request_failed", status };
  }
  return { failureType: "other_generator_error", status };
};

const validateGeneratedReport = (candidate, input, onCustomerSafetyFailure) => {
  const validation = validateSleepPremiumReport(candidate, input);
  if (!validation.valid) {
    // TEMPORARY: observe every rejected string field, not only safety-regex failures.
    // The callback name is retained for compatibility; its scope includes evidence failures.
    if (process.env.RENDER_GIT_BRANCH === "premium-ai-staging" &&
      process.env.ENABLE_PREMIUM_AI_PREVIEW === "true" && typeof onCustomerSafetyFailure === "function") {
      const field = validation.diagnostic.field;
      const value = field.replace(/\[(\d+)\]/gu, ".$1").split(".").reduce((parent, key) => parent?.[key], candidate);
      // Diagnostic delivery must never affect validation, fallback, or report contents.
      if (typeof value === "string") {
        try {
          const safetyDiagnostic = diagnoseSleepPremiumCustomerSafety(field, value, input);
          // Evidence/length failures have no safety match, but need the same privacy guard.
          const sensitive = /\S+@\S+|\b(?:cs_|pi_|cus_|sess_|session[_ -]?|assessment[_ -]?|user[_ -]?id[\s:=_-]*|sk[-_]|pk_(?:live|test)_|whsec_)[\w-]+|\b(?:bearer\s+\S+|(?:password|passwd|credential|api[_ -]?key|access[_ -]?token|secret)\s*[:=]\s*\S+)|\b[0-9a-f]{8}-[0-9a-f-]{27,}\b|(?:\+?\d[\s().-]*){7,}|\b[A-Za-z0-9_-]{24,}\b/iu.test(value);
          const exactRejectedText = sensitive ? "[withheld: possible personal identifier]" : value;
          onCustomerSafetyFailure({
            ...safetyDiagnostic,
            field,
            returnedText: exactRejectedText,
            deterministicProfile: input.profile,
            exactRejectedText,
            expectedRule: validation.diagnostic.expected,
            rejectionReason: validation.reason,
            ...(safetyDiagnostic ? { matchedTokenOrCategory: {
              token: safetyDiagnostic.rejectedText,
              category: safetyDiagnostic.category,
              rule: safetyDiagnostic.rule,
            } } : {}),
            reason: validation.reason,
            expected: validation.diagnostic.expected,
          });
        } catch { /* Logging is observational only. */ }
      }
    }
    const error = new TypeError(validation.reason);
    error.code = "PREMIUM_SCHEMA_VALIDATION";
    error.diagnostic = validation.diagnostic;
    throw error;
  }
  return validation.report;
};

const getResponseText = (response) => {
  if (typeof response?.output_text === "string") return response.output_text;
  return response?.output
    ?.filter((item) => item?.type === "message")
    .flatMap((item) => item.content || [])
    .filter((content) => content?.type === "output_text" && typeof content.text === "string")
    .map((content) => content.text)
    .join("") ?? "";
};

const hasRefusal = (response) => response?.output
  ?.some((item) => item?.type === "message" && item.content?.some((content) => content?.type === "refusal")) ?? false;

const getJsonDiagnostics = (response, text, parseError = null) => {
  const position = parseError?.message?.match(/position\s+(\d+)/i)?.[1];
  return {
    responseStatus: typeof response?.status === "string" ? response.status : "unknown",
    responseLength: text.length,
    contentEmpty: text.trim().length === 0,
    markdownFencesDetected: /```/.test(text),
    refusalDetected: hasRefusal(response),
    ...(typeof response?.incomplete_details?.reason === "string" ? { incompleteReason: response.incomplete_details.reason } : {}),
    ...(parseError ? { parseErrorType: parseError.name || "Error", ...(position ? { parseErrorPosition: Number(position) } : {}) } : {}),
  };
};

// TEMPORARY metadata-only diagnostics. Never copy free-form API messages or content.
const getIncompleteResponseMetadata = (response, maxOutputTokens) => {
  const metadataToken = (value, allowed) => typeof value !== "string" ? null
    : allowed.includes(value) ? value : "[withheld: unrecognized metadata]";
  const statuses = ["completed", "incomplete", "failed", "in_progress", "queued", "cancelled"];
  const types = ["message", "reasoning", "output_text", "refusal", "function_call", "function_call_output",
    "web_search_call", "file_search_call", "computer_call", "computer_call_output", "image_generation_call",
    "code_interpreter_call", "local_shell_call", "local_shell_call_output", "mcp_call", "mcp_list_tools", "mcp_approval_request", "mcp_approval_response"];
  const finishReasons = ["stop", "length", "max_output_tokens", "content_filter", "tool_calls", "function_call"];
  const itemMetadata = (item) => ({
    type: metadataToken(item?.type, types),
    ...(item?.status !== undefined ? { status: metadataToken(item.status, statuses) } : {}),
    ...(item?.finish_reason !== undefined ? { finish_reason: metadataToken(item.finish_reason, finishReasons) } : {}),
  });
  const output = Array.isArray(response?.output) ? response.output : [];
  const failedChecks = [
    ...(response?.status !== "completed" ? ['response.status !== "completed"'] : []),
    ...(response?.incomplete_details ? ["Boolean(response.incomplete_details) === true"] : []),
  ];
  return {
    ...(typeof response?.id === "string" ? { id: /^resp_[A-Za-z0-9]+$/u.test(response.id) ? response.id : "[withheld: unrecognized response id]" } : {}),
    status: metadataToken(response?.status, statuses),
    ...(response?.incomplete_details != null ? { incomplete_details: {
      reason: metadataToken(response.incomplete_details.reason, ["max_output_tokens", "content_filter"]),
    } } : {}),
    ...(response?.error != null ? { error: {
      code: metadataToken(response.error.code, ["server_error", "rate_limit_exceeded", "invalid_prompt", "vector_store_timeout", "invalid_image", "invalid_image_format", "invalid_base64_image", "image_too_large", "image_too_small", "image_parse_error", "image_content_policy_violation", "invalid_image_mode", "image_file_too_large", "unsupported_image_media_type", "empty_image_file", "failed_to_download_image", "image_file_not_found"]),
      ...(response.error.message !== undefined ? { message: "[withheld: free-form API error message]" } : {}),
    } } : {}),
    outputTextExists: typeof response?.output_text === "string",
    outputTextCharacterLength: typeof response?.output_text === "string" ? response.output_text.length : 0,
    outputItemCount: output.length,
    outputItemTypes: output.map((item) => metadataToken(item?.type, types)),
    outputItemMetadata: output.map((item) => ({
      ...itemMetadata(item),
      content: Array.isArray(item?.content) ? item.content.map(itemMetadata) : [],
    })),
    configuredModel: MODEL,
    max_output_tokens: maxOutputTokens,
    internalReason: `${failedChecks.join(" OR ")} -> AI response was incomplete.`,
  };
};

const parseJsonReport = (response) => {
  const text = getResponseText(response);
  if (hasRefusal(response)) {
    const error = new Error("Premium AI refused the structured report request.");
    error.code = "PREMIUM_MODEL_REFUSAL";
    error.jsonDiagnostics = getJsonDiagnostics(response, text);
    throw error;
  }
  if (!text.trim()) {
    const error = new TypeError("AI response did not contain JSON output text.");
    error.code = "PREMIUM_INVALID_JSON";
    error.jsonDiagnostics = getJsonDiagnostics(response, text);
    throw error;
  }
  try {
    return JSON.parse(text);
  } catch (parseError) {
    const error = new TypeError("AI response did not contain valid JSON.");
    error.code = "PREMIUM_INVALID_JSON";
    error.jsonDiagnostics = getJsonDiagnostics(response, text, parseError);
    throw error;
  }
};

const callWithTimeout = async (requestFactory, timeoutMs) => {
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([
      requestFactory(controller.signal),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          const timeoutError = new Error(`Premium AI request timed out after ${timeoutMs}ms.`);
          timeoutError.name = "PremiumAITimeoutError";
          reject(timeoutError);
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};

export const generateSleepPremiumReport = async ({
  input,
  openaiClient,
  apiKeyAvailable = false,
  fallbackOnError = true,
  timeoutMs = TIMEOUT_MS,
  includeFailureDiagnostics = false,
  onCustomerSafetyFailure,
  onIncompleteResponse,
}) => {
  const fallback = () => buildSleepPremiumFallback(input);
  if (!apiKeyAvailable || !openaiClient?.responses?.create) {
    logStagingUsage(null, "FALLBACK");
    if (!fallbackOnError) throw new Error("Premium AI client or OPENAI_API_KEY is unavailable.");
    return {
      report: fallback(),
      source: "fallback",
      reason: "AI client or API key unavailable.",
      ...(includeFailureDiagnostics ? { failureType: "missing_api_key", failureStatus: null } : {}),
    };
  }

  const schema = buildSleepPremiumJsonSchema(input);
  const properties = schema.schema.properties;
  const mode = getSleepPremiumStrengthMode(input);
  const maxOutputTokens = process.env.RENDER_GIT_BRANCH === "premium-ai-staging" &&
    process.env.ENABLE_PREMIUM_AI_PREVIEW === "true" ? 8000 : MAX_OUTPUT_TOKENS;
  let response;
  let usageSource = "FALLBACK";
  try {
    response = await callWithTimeout((signal) =>
      openaiClient.responses.create(
        {
          model: MODEL,
          max_output_tokens: maxOutputTokens,
          text: { format: schema },
          input: buildSleepPremiumPrompt(input, {
            profile: input.profile,
            priorityArea: getSleepPremiumPriority(input).title,
            mode,
            stableTitle: properties.stable_or_tracking.properties.title.enum[0],
            stableAreas: getSleepPremiumAreaOverview(input)
              .filter(({ status }) => status === "Deluje mirnije")
              .map(({ title }) => title),
            profileExplanationMaxLength: properties.profile_explanation.maxLength,
          }),
        },
        { signal }
      ),
      timeoutMs
    );

    if (response?.status !== "completed" || response.incomplete_details) {
      if (process.env.RENDER_GIT_BRANCH === "premium-ai-staging" &&
        process.env.ENABLE_PREMIUM_AI_PREVIEW === "true" && typeof onIncompleteResponse === "function") {
        try { onIncompleteResponse(getIncompleteResponseMetadata(response, maxOutputTokens)); } catch { /* Observational only. */ }
      }
      const error = new TypeError("AI response was incomplete.");
      error.jsonDiagnostics = getJsonDiagnostics(response, getResponseText(response));
      throw error;
    }
    const report = validateGeneratedReport(parseJsonReport(response), input, onCustomerSafetyFailure);
    usageSource = "AI_GENERATED";
    return { report, source: "ai", reason: "ok" };
  } catch (error) {
    if (!fallbackOnError) throw error;
    const failure = classifyGenerationFailure(error);
    return {
      report: fallback(),
      source: "fallback",
      reason: error?.message || "AI generation failed.",
      ...(includeFailureDiagnostics ? failure : {}),
      ...(includeFailureDiagnostics && error?.diagnostic ? { failureDiagnostic: error.diagnostic } : {}),
      ...(includeFailureDiagnostics && error?.jsonDiagnostics ? { jsonDiagnostics: error.jsonDiagnostics } : {}),
    };
  } finally {
    logStagingUsage(response, usageSource);
  }
};

export { MODEL as SLEEP_PREMIUM_AI_MODEL, TIMEOUT_MS as SLEEP_PREMIUM_AI_TIMEOUT_MS };
