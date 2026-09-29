import assert from "node:assert/strict";
import {
  buildSleepReportPayload,
  generateSleepProfileNarrative,
  validateSleepReportNarrative,
} from "../server/sleepProfileNarrative.js";

const dimensions = [
  { name: "Sleep Recovery", score: 80 },
  { name: "Sleep Continuity", score: 70 },
  { name: "Cognitive Wind-Down", score: 70 },
  { name: "Daytime Clarity", score: 70 },
  { name: "Sleep Consistency", score: 55 },
];
const weakWindDownDimensions = dimensions.map((dimension) =>
  dimension.name === "Cognitive Wind-Down" ? { ...dimension, score: 40 } : dimension
);
const balancedDimensions = dimensions.map((dimension) => ({ ...dimension, score: 60 }));

const makePayload = (answers) => buildSleepReportPayload({
  assessment: { answers },
  dimensions,
  overallScore: 69,
});

const makeNarrative = (windDownText = "Your racing-thought signal is mixed.") => {
  const dimension = (label) => ({
    scoreSuggests: `${label} is shaped by the supplied score and answer signals.`,
    whyThisMatters: `${label} can affect how predictable the next part of the day feels.`,
    mayBeHelping: `Your answers show one supportive part of ${label.toLowerCase()} to protect.`,
    mayBeGettingInWay: `Your answers show one challenging part of ${label.toLowerCase()} to watch.`,
    inRealLife: `Notice the relevant ${label.toLowerCase()} pattern on an ordinary night.`,
    oneThingToTry: `Use one concrete step connected to ${label.toLowerCase()} for seven days.`,
    whatToNotice: `Notice whether the ${label.toLowerCase()} pattern changes across the week.`,
    nextStep: `Keep the step that is easiest to repeat for ${label.toLowerCase()}.`,
  });

  return {
    dimensions: {
      sleepRecovery: dimension("Sleep Recovery"),
      sleepContinuity: dimension("Sleep Continuity"),
      cognitiveWindDown: { ...dimension("Cognitive Wind-Down"), inRealLife: windDownText },
      daytimeClarity: dimension("Daytime Clarity"),
      sleepConsistency: dimension("Sleep Consistency"),
    },
    sleepProfile: {
      profileSummary: "Your recovery is stronger than your consistency, so one focused rhythm change is appropriate.",
      whatsWorking: "Recovery is the strongest part of this profile and is worth protecting.",
      mainFocus: "Consistency is the clearest area to improve.",
      whereToStart: "Choose one wake-up window that is realistic to repeat.",
      puttingItTogether: "Protect recovery while testing one consistency change.",
    },
  };
};

const callWithResponse = (response) => {
  let calls = 0;
  const openaiClient = {
    responses: {
      parse: async () => {
        calls += 1;
        return response;
      },
    },
  };
  return { openaiClient, getCalls: () => calls };
};

const strongPayload = makePayload([5, 5, 5, 2, 2, 2, 2, 5, 2, 5, 2, 5]);
const weakWindDownPayload = buildSleepReportPayload({
  assessment: { answers: [5, 5, 5, 1, 3, 3, 3, 5, 3, 5, 3, 5] },
  dimensions: weakWindDownDimensions,
  overallScore: 57,
});
const differentSignalsPayload = makePayload([5, 5, 5, 5, 3, 3, 3, 5, 3, 5, 3, 5]);
const balancedPayload = buildSleepReportPayload({
  assessment: { answers: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3] },
  dimensions: balancedDimensions,
  overallScore: 60,
});

assert.equal(strongPayload.dimensions.sleepRecovery.score, 80);
assert.equal(strongPayload.priorityDimension, "Sleep Consistency");
assert.equal(weakWindDownPayload.dimensions.cognitiveWindDown.score, 40);
assert.equal(balancedPayload.profileSpread, 0);
assert.equal(differentSignalsPayload.dimensions.cognitiveWindDown.score, strongPayload.dimensions.cognitiveWindDown.score);
assert.notDeepEqual(
  strongPayload.dimensions.cognitiveWindDown.relevantSignals,
  differentSignalsPayload.dimensions.cognitiveWindDown.relevantSignals
);
assert.deepEqual(balancedPayload.dimensions.sleepRecovery.relevantSignals, {
  morningRestoration: "mixed",
  stressSleepRecovery: "mixed",
  confidenceInRecovery: "mixed",
});
assert.equal(Object.prototype.hasOwnProperty.call(strongPayload, "answers"), false);
assert.equal(Object.prototype.hasOwnProperty.call(strongPayload, "email"), false);

const validResponse = { status: "completed", output_parsed: makeNarrative() };
const validClient = callWithResponse(validResponse);
const validResult = await generateSleepProfileNarrative({
  openaiClient: validClient.openaiClient,
  payload: strongPayload,
  apiKeyAvailable: true,
});
assert.equal(validResult.status, "ok");
assert.equal(validClient.getCalls(), 1);

const signalAwareClient = {
  responses: {
    parse: async (request) => ({
      status: "completed",
      output_parsed: makeNarrative(request.input.includes('"racingThoughtsAtBedtime":"challenging"')
        ? "Your racing-thought signal is challenging."
        : "Your racing-thought signal is supportive."),
    }),
  },
};
const signalAwareStrong = await generateSleepProfileNarrative({
  openaiClient: signalAwareClient,
  payload: strongPayload,
  apiKeyAvailable: true,
});
const signalAwareDifferent = await generateSleepProfileNarrative({
  openaiClient: signalAwareClient,
  payload: differentSignalsPayload,
  apiKeyAvailable: true,
});
assert.notEqual(
  signalAwareStrong.fields.dimensions.cognitiveWindDown.inRealLife,
  signalAwareDifferent.fields.dimensions.cognitiveWindDown.inRealLife
);

const missingKeyResult = await generateSleepProfileNarrative({
  openaiClient: validClient.openaiClient,
  payload: strongPayload,
  apiKeyAvailable: false,
});
assert.equal(missingKeyResult.status, "fallback");
assert.match(missingKeyResult.reason, /missing/i);

const failingClient = { responses: { parse: async () => { throw new Error("simulated API failure"); } } };
const failureResult = await generateSleepProfileNarrative({
  openaiClient: failingClient,
  payload: strongPayload,
  apiKeyAvailable: true,
});
assert.equal(failureResult.status, "fallback");
assert.match(failureResult.reason, /simulated API failure/);

const malformedClient = callWithResponse({ status: "completed", output_parsed: null });
const malformedResult = await generateSleepProfileNarrative({
  openaiClient: malformedClient.openaiClient,
  payload: strongPayload,
  apiKeyAvailable: true,
});
assert.equal(malformedResult.status, "fallback");

const missingField = makeNarrative();
delete missingField.dimensions.sleepRecovery.nextStep;
const missingFieldResult = validateSleepReportNarrative(missingField, strongPayload);
assert.equal(missingFieldResult.valid, false);
assert.match(missingFieldResult.reason, /sleepRecovery\.nextStep/);

const unsupportedClaim = makeNarrative();
unsupportedClaim.dimensions.sleepRecovery.inRealLife = "Use your phone for 20 minutes before bed.";
const unsupportedResult = validateSleepReportNarrative(unsupportedClaim, strongPayload);
assert.equal(unsupportedResult.valid, false);
assert.match(unsupportedResult.reason, /sleepRecovery\.inRealLife/);

console.log("sleep AI narrative mock tests passed");
console.log("same-score signal distinction verified");
console.log("missing-key, API-error, malformed-response, missing-field, and unsupported-claim fallbacks verified");
