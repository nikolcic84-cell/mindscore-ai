import { makeParseableTextFormat } from "openai/lib/parser.js";
import { buildSleepPremiumFallback } from "./sleepPremiumFallback.js";
import { buildSleepPremiumPrompt } from "./sleepPremiumPrompt.js";
import { buildSleepPremiumJsonSchema, validateSleepPremiumReport } from "./sleepPremiumSchema.js";

const MODEL = "gpt-5-mini";
const TIMEOUT_MS = 20_000;
const MAX_OUTPUT_TOKENS = 5000;

const validateGeneratedReport = (candidate, input) => {
  const validation = validateSleepPremiumReport(candidate, input);
  if (!validation.valid) throw new TypeError(validation.reason);
  return validation.report;
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
}) => {
  const fallback = () => buildSleepPremiumFallback(input);
  if (!apiKeyAvailable || !openaiClient?.responses?.parse) {
    if (!fallbackOnError) throw new Error("Premium AI client or OPENAI_API_KEY is unavailable.");
    return { report: fallback(), source: "fallback", reason: "AI client or API key unavailable." };
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
            mainAreaTitle: schema.schema.properties.mainArea.properties.title.enum[0],
            positiveOrWatchMode: schema.schema.properties.positiveOrWatch.properties.mode.enum[0],
            positiveOrWatchTitle: schema.schema.properties.positiveOrWatch.properties.title.const,
          }),
        },
        { signal }
      ),
      timeoutMs
    );

    if (response?.status !== "completed" || response.incomplete_details || !response.output_parsed) {
      throw new TypeError("AI response was incomplete or did not contain valid JSON.");
    }
    const report = validateGeneratedReport(response.output_parsed, input);
    return { report, source: "ai", reason: "ok" };
  } catch (error) {
    if (!fallbackOnError) throw error;
    return { report: fallback(), source: "fallback", reason: error?.message || "AI generation failed." };
  }
};

export { MODEL as SLEEP_PREMIUM_AI_MODEL, TIMEOUT_MS as SLEEP_PREMIUM_AI_TIMEOUT_MS };
