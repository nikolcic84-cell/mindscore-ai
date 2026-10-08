import { buildSleepPremiumInput } from "./sleepPremiumInput.js";
import { generateSleepPremiumReport } from "./sleepPremiumGenerator.js";
import { validateSleepPremiumReport } from "./sleepPremiumSchema.js";

export const isPremiumAiPreviewEnabled = (env = process.env) => env.ENABLE_PREMIUM_AI_PREVIEW === "true";

const logPreviewStatus = (log, label, details = {}) => log(label, details);
const getCustomerFacingReport = (report) => ({
  profile: report.profile,
  mainArea: report.mainArea,
  connections: report.connections,
  positiveOrWatch: {
    title: report.positiveOrWatch.title,
    text: report.positiveOrWatch.text,
  },
  startingPoint: report.startingPoint,
  tonight: report.tonight,
  sevenDayPlan: report.sevenDayPlan,
  tracking: report.tracking,
  closing: report.closing,
});

export const generateSleepPremiumPreview = async ({
  enabled = isPremiumAiPreviewEnabled(),
  answers,
  openaiClient,
  apiKeyAvailable = false,
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
  if (!validation.valid || validation.report.profile.name !== input.profile) {
    const diagnostic = validation.diagnostic || {
      field: "profile.name",
      expected: "exact deterministic profile",
      received: { type: "mismatch" },
    };
    logPreviewStatus(log, "REAL AI: FAILED", { deterministicProfile: input.profile });
    logPreviewStatus(log, "SCHEMA: FAIL", diagnostic);
    logPreviewStatus(log, `FALLBACK USED: ${generation.source === "fallback" ? "YES" : "NO"}`, { deterministicProfile: input.profile });
    return { status: 502, body: { error: "Generated report failed Premium validation.", diagnostic } };
  }

  const fallbackUsed = generation.source === "fallback";
  logPreviewStatus(log, `REAL AI: ${fallbackUsed ? "FAILED" : "SUCCESS"}`, { deterministicProfile: input.profile });
  logPreviewStatus(log, "SCHEMA: PASS", { deterministicProfile: input.profile });
  logPreviewStatus(log, `FALLBACK USED: ${fallbackUsed ? "YES" : "NO"}`, { deterministicProfile: input.profile });

  return {
    status: 200,
    body: {
      source: fallbackUsed ? "fallback" : "ai",
      deterministicProfile: input.profile,
      report: getCustomerFacingReport(validation.report),
    },
  };
};
