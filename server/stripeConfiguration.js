import crypto from "node:crypto";

export const resolveStripeMode = (modeValue) => {
  const configuredMode = typeof modeValue === "string" ? modeValue.trim().toLowerCase() : "";
  const mode = configuredMode || "test";
  if (mode !== "test" && mode !== "live") {
    throw new Error("STRIPE_MODE must be either test or live.");
  }
  return mode;
};

export const validateStripeConfiguration = ({ mode: modeValue, secretKey }) => {
  const mode = resolveStripeMode(modeValue);
  const key = typeof secretKey === "string" ? secretKey.trim() : "";
  if (!key) return mode;

  const keyMode = key.startsWith("sk_test_")
    ? "test"
    : key.startsWith("sk_live_")
      ? "live"
      : "";

  if (!keyMode || keyMode !== mode) {
    throw new Error("STRIPE_MODE and STRIPE_SECRET_KEY do not match.");
  }

  return mode;
};

export const isOwnerLiveCheckoutAuthorized = ({ configuredToken, suppliedToken }) => {
  if (typeof configuredToken !== "string" || typeof suppliedToken !== "string" ||
    !configuredToken || !suppliedToken) return false;
  const expected = Buffer.from(configuredToken, "utf8");
  const actual = Buffer.from(suppliedToken, "utf8");
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
};