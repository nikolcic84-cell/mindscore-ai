import { makeParseableTextFormat } from "openai/lib/parser.js";
import { buildSleepPremiumFallback } from "./sleepPremiumFallback.js";
import { buildSleepPremiumPrompt } from "./sleepPremiumPrompt.js";
import { buildSleepPremiumJsonSchema, validateSleepPremiumReport } from "./sleepPremiumSchema.js";

const MODEL = "gpt-5-mini";
const TIMEOUT_MS = 20_000;
const MAX_OUTPUT_TOKENS = 5000;

const classifyGenerationFailure = (error) => {
  const status = Number(error?.status || error?.statusCode) || null;
  if (error?.name === "PremiumAITimeoutError") return { failureType: "timeout", status };
  if (error?.code === "PREMIUM_SCHEMA_VALIDATION") return { failureType: "schema_validation_failure", status };
  if (error?.message === "AI response was incomplete.") return { failureType: "incomplete_response", status };
  if (error instanceof SyntaxError || /json output text|valid json|unexpected end of json|incomplete/i.test(error?.message || "")) {
    return { failureType: "invalid_json", status };
  }
  if (status) return { failureType: "openai_http_error", status };
  if (error?.name === "APIConnectionError" || error?.name === "APIError" || error?.name === "OpenAIError") {
    return { failureType: "openai_request_failed", status };
  }
  return { failureType: "other_generator_error", status };
};

const validateGeneratedReport = (candidate, input) => {
  const validation = validateSleepPremiumReport(candidate, input);
  if (!validation.valid) {
    const error = new TypeError(validation.reason);
    error.code = "PREMIUM_SCHEMA_VALIDATION";
    error.diagnostic = validation.diagnostic;
    throw error;
  }
  return validation.report;
};

const getResponseText = (response) => {
  if (typeof response?.output_text === "string" && response.output_text.trim()) {
    return response.output_text;
  }

  const outputText = response?.output
    ?.filter((item) => item?.type === "message")
    .flatMap((item) => item.content || [])
    .filter((content) => content?.type === "output_text" && typeof content.text === "string")
    .map((content) => content.text)
    .join("");

  return typeof outputText === "string" && outputText.trim() ? outputText : null;
};

const getParsedReport = (response) => {
  if (response?.output_parsed && typeof response.output_parsed === "object") {
    return response.output_parsed;
  }

  const responseText = getResponseText(response);
  if (!responseText) throw new TypeError("AI response did not contain JSON output text.");
  return JSON.parse(responseText);
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
}) => {
  const fallback = () => buildSleepPremiumFallback(input);
  if (!apiKeyAvailable || !openaiClient?.responses?.parse) {
    if (!fallbackOnError) throw new Error("Premium AI client or OPENAI_API_KEY is unavailable.");
    return {
      report: fallback(),
      source: "fallback",
      reason: "AI client or API key unavailable.",
      ...(includeFailureDiagnostics ? { failureType: "missing_api_key", failureStatus: null } : {}),
    };
  }

  const schema = buildSleepPremiumJsonSchema(input);
  try {
    const response = await callWithTimeout((signal) =>
      openaiClient.responses.parse(
        {
          model: MODEL,
          max_output_tokens: MAX_OUTPUT_TOKENS,
          text: { format: makeParseableTextFormat(schema, JSON.parse) },
          input: buildSleepPremiumPrompt(input, {
            profile: input.profile,
            profileSummaryMaxLength: schema.schema.properties.profile.properties.summary.maxLength,
            mainAreaTitle: schema.schema.properties.mainArea.properties.title.enum[0],
            mainAreaExplanationMaxLength: schema.schema.properties.mainArea.properties.explanation.maxLength,
            tonightActionMaxLength: schema.schema.properties.tonight.properties.actions.items.maxLength,
            sevenDayActionMaxLength: schema.schema.properties.sevenDayPlan.items.properties.action.maxLength,
            positiveOrWatchMode: schema.schema.properties.positiveOrWatch.properties.mode.enum[0],
            positiveOrWatchTitle: schema.schema.properties.positiveOrWatch.properties.title.const,
          }),
        },
        { signal }
      ),
      timeoutMs
    );

    if (response?.status !== "completed" || response.incomplete_details) {
      throw new TypeError("AI response was incomplete.");
    }
    const report = validateGeneratedReport(getParsedReport(response), input);
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
    };
  }
};

export { MODEL as SLEEP_PREMIUM_AI_MODEL, TIMEOUT_MS as SLEEP_PREMIUM_AI_TIMEOUT_MS };
