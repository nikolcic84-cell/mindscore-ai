import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  isOwnerLiveCheckoutAuthorized,
  resolveStripeMode,
  validateStripeConfiguration,
} from "../server/stripeConfiguration.js";

const answers = [5,1,1,5,5,1,1,5,1,1,5,1];
const email = "sleep-test@example.invalid";
const expectedAmount = 999;
const sessions = new Map();
let sessionNumber = 0;

const stripeMock = createHttpServer(async (request, response) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const body = Buffer.concat(chunks).toString("utf8");
  const headers = { "Content-Type": "application/json", "Request-Id": "req_local_stripe_mock" };
  const send = (status, payload) => {
    response.writeHead(status, headers);
    response.end(JSON.stringify(payload));
  };

  if (request.method === "POST" && request.url === "/v1/checkout/sessions") {
    const form = new URLSearchParams(body);
    const id = `cs_test_local_${++sessionNumber}`;
    const metadata = Object.fromEntries([...form.entries()].flatMap(([key, value]) => {
      const match = /^metadata\[([^\]]+)\]$/u.exec(key);
      return match ? [[match[1], value]] : [];
    }));
    const session = {
      id, object: "checkout.session", created: Math.floor(Date.now() / 1000), livemode: false,
      url: `https://checkout.stripe.test/${id}`, mode: form.get("mode"), status: "open",
      payment_status: "unpaid", currency: form.get("line_items[0][price_data][currency]"),
      amount_total: Number(form.get("line_items[0][price_data][unit_amount]")),
      customer_email: form.get("customer_email"), customer_details: null, metadata,
      success_url: form.get("success_url"), cancel_url: form.get("cancel_url"),
    };
    sessions.set(id, session);
    return send(200, session);
  }

  const sessionRoute = /^GET \/v1\/checkout\/sessions\/([^?]+)(?:\?.*)?$/u.exec(`${request.method} ${request.url}`);
  if (sessionRoute) {
    const session = sessions.get(decodeURIComponent(sessionRoute[1]));
    return session ? send(200, session) : send(404, {
      error: { type: "invalid_request_error", message: "No such checkout.session: unknown" },
    });
  }

  return send(404, { error: { type: "invalid_request_error", message: "Mock route not found" } });
});

const listen = (server) => new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => {
    server.removeListener("error", reject);
    resolve(server.address().port);
  });
});
const close = (server) => new Promise((resolve) => server.close(resolve));
const startBackend = async ({ port, dataDir, stripePort = 12111, stripeSecretKey = "sk_test_local_mock_only", stripeMode = "test", ownerTestToken = "" }) => {
  const env = {
    ...process.env,
    NODE_ENV: "test",
    PORT: String(port),
    DATA_DIR: dataDir,
    FRONTEND_BASE_URL: "http://localhost:5173",
    STRIPE_MODE: stripeMode,
    STRIPE_SECRET_KEY: stripeSecretKey,
    STRIPE_OWNER_TEST_TOKEN: ownerTestToken,
    STRIPE_TEST_API_HOST: "127.0.0.1",
    STRIPE_TEST_API_PORT: String(stripePort),
    STRIPE_WEBHOOK_SECRET: "whsec_local_test_placeholder",
    OPENAI_API_KEY: "sk-openai-local-test-placeholder",
    SMTP_HOST: "localhost",
    SMTP_PORT: "2525",
    SMTP_USER: "sleep-test",
    SMTP_PASS: "sleep-test-placeholder",
    SMTP_FROM_EMAIL: "sleep-test@example.invalid",
  };
  const child = spawn(process.execPath, ["server/server.js"], { env, stdio: "ignore" });
  const baseUrl = `http://127.0.0.1:${port}`;
  let healthy = false;
  for (let attempt = 0; attempt < 80 && !healthy && child.exitCode === null; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      healthy = response.ok && (await response.json()).status === "ok";
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  if (!healthy) {
    child.kill();
    throw new Error("Local test backend did not start.");
  }
  return { child, baseUrl };
};
const stopBackend = async (child) => {
  if (child.exitCode !== null) return;
  child.kill();
  await new Promise((resolve) => child.once("exit", resolve));
};
const postJson = (url, value) => fetch(url, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value),
});

test("Stripe mode defaults safely to TEST when STRIPE_MODE is omitted", () => {
  assert.equal(resolveStripeMode(undefined), "test");
  assert.equal(validateStripeConfiguration({ secretKey: "sk_test_default_mode_test_only" }), "test");
});

test("MAIN release excludes the staging-only accepted-analysis route and keeps the backend-only LIVE gate", async () => {
  const source = await readFile(new URL("../server/server.js", import.meta.url), "utf8");
  const registrations = [...source.matchAll(/app\.get\("\/api\/premium-report\/accepted-analysis"/gu)];
  assert.equal(registrations.length, 0, "MAIN had no accepted-analysis handler; staging-only duplicates are not carried into the release");
  assert.doesNotMatch(await readFile(new URL("../src/App.jsx", import.meta.url), "utf8"), /premium-report\/accepted-analysis/u);
  assert.match(source, /stripeMode === "live" && !isOwnerLiveCheckoutAuthorized/u);
  assert.match(source, /configuredToken: process\.env\.STRIPE_OWNER_TEST_TOKEN/u);
  assert.match(source, /req\.get\("x-stripe-owner-test-token"\)/u);
});

test("LIVE checkout owner token authorizes only an exact constant-time match", () => {
  assert.equal(isOwnerLiveCheckoutAuthorized({ configuredToken: "owner-test-token", suppliedToken: "owner-test-token" }), true);
  assert.equal(isOwnerLiveCheckoutAuthorized({ configuredToken: "owner-test-token", suppliedToken: "wrong-token" }), false);
  assert.equal(isOwnerLiveCheckoutAuthorized({ configuredToken: "owner-test-token", suppliedToken: "" }), false);
  assert.equal(isOwnerLiveCheckoutAuthorized({ configuredToken: "", suppliedToken: "owner-test-token" }), false);
});

test("TEST mode accepts a TEST key and checkout unlocks only from a paid verified session", async (t) => {
  sessions.clear();
  sessionNumber = 0;
  const stripePort = await listen(stripeMock);
  const dataDir = await mkdtemp(path.join(tmpdir(), "mindscore-sleep-content-") );
  const port = 34_000 + Math.floor(Math.random() * 15_000);
  const { child, baseUrl } = await startBackend({ port, dataDir, stripePort, stripeMode: "test" });
  t.after(async () => {
    await stopBackend(child);
    await close(stripeMock);
    await rm(dataDir, { recursive: true, force: true });
  });

  const invalidEmail = await postJson(`${baseUrl}/api/create-checkout-session`, {
    customerEmail: "not-an-email", assessmentType: "sleep", testName: "Sleep Quality",
    purchaseType: "sleep-content-unlock", answers,
  });
  assert.equal(invalidEmail.status, 400, "invalid email is rejected before Stripe");
  assert.equal(sessions.size, 0);

  const invalidAnswers = await postJson(`${baseUrl}/api/create-checkout-session`, {
    customerEmail: email, assessmentType: "sleep", testName: "Sleep Quality",
    purchaseType: "sleep-content-unlock", answers: [1,2],
  });
  assert.equal(invalidAnswers.status, 400, "incomplete answers are rejected before Stripe");

  const checkoutResponse = await postJson(`${baseUrl}/api/create-checkout-session`, {
    customerEmail: email,
    assessmentType: "sleep",
    testName: "Sleep Quality",
    purchaseType: "sleep-content-unlock",
    answers,
    amount: 1,
    currency: "usd",
  });
  assert.equal(checkoutResponse.status, 200);
  const checkout = await checkoutResponse.json();
  assert.match(checkout.sessionId, /^cs_test_local_/u);
  assert.match(checkout.url, /^https:\/\/checkout\.stripe\.test\//u);

  const session = sessions.get(checkout.sessionId);
  assert.ok(session);
  assert.equal(session.mode, "payment", "one-time Checkout Session, no subscription");
  assert.equal(session.currency, "eur");
  assert.equal(session.amount_total, expectedAmount, "amount is server-defined; client-supplied amount/currency ignored");
  assert.equal(session.customer_email, email);
  assert.equal(session.metadata.assessmentId, checkout.assessmentId);
  assert.equal(session.metadata.purchaseType, "sleep-content-unlock");
  assert.equal(Object.keys(session.metadata).some((key) => /answer/i.test(key)), false, "answers are not placed in Stripe metadata");
  assert.match(session.success_url, /\/payment-success\?session_id=\{CHECKOUT_SESSION_ID\}&unlock=/u);
  const unlockToken = new URL(session.success_url).searchParams.get("unlock");
  const cancelUrl = new URL(session.cancel_url);
  assert.equal(cancelUrl.pathname, "/");
  assert.equal(cancelUrl.searchParams.get("checkout"), "cancelled");
  assert.equal(cancelUrl.searchParams.get("unlock"), unlockToken);

  const storeBeforePayment = JSON.parse(await readFile(path.join(dataDir, "payments-store.json"), "utf8"));
  const assessment = storeBeforePayment.assessments[checkout.assessmentId];
  assert.deepEqual(assessment.answers, answers, "the existing server-side assessment store holds all 12 answers");
  assert.equal(assessment.customerEmail, email);
  assert.equal(assessment.aiProfile, "Sleep Struggler");
  assert.equal(typeof assessment.sleepContentAccessTokenHash, "string");
  assert.equal(assessment.sleepContentAccessTokenHash.includes(unlockToken), false, "only the token hash is stored");
  assert.equal(JSON.stringify(storeBeforePayment).includes(unlockToken), false, "plaintext access token is never persisted");

  const paidWithoutToken = await fetch(`${baseUrl}/api/payment-session/${checkout.sessionId}/verify`);
  assert.equal(paidWithoutToken.status, 200);
  const noTokenData = await paidWithoutToken.json();
  assert.equal(noTokenData.paid, false);
  assert.equal(noTokenData.contentUnlocked, false);
  assert.equal(Object.hasOwn(noTokenData, "answers"), false);

  const unpaidWithToken = await fetch(`${baseUrl}/api/payment-session/${checkout.sessionId}/verify?unlock=${encodeURIComponent(unlockToken)}`);
  const unpaidData = await unpaidWithToken.json();
  assert.equal(unpaidData.paid, false);
  assert.equal(unpaidData.contentUnlocked, false, "unlock token alone cannot unlock unpaid content");
  assert.equal(Object.hasOwn(unpaidData, "answers"), false);

  const badTokenResponse = await fetch(`${baseUrl}/api/payment-session/${checkout.sessionId}/verify?unlock=${encodeURIComponent(`${unlockToken}x`)}`);
  const badTokenData = await badTokenResponse.json();
  assert.equal(badTokenData.contentUnlocked, false);
  assert.equal(Object.hasOwn(badTokenData, "answers"), false);

  const cancelRecovery = await fetch(`${baseUrl}/api/sleep-content/free-result?unlock=${encodeURIComponent(unlockToken)}`);
  assert.equal(cancelRecovery.status, 200);
  assert.deepEqual((await cancelRecovery.json()).answers, answers, "a canceled purchase can restore its original FREE result");

  session.payment_status = "paid";
  session.status = "complete";
  const paidResponse = await fetch(`${baseUrl}/api/payment-session/${checkout.sessionId}/verify?unlock=${encodeURIComponent(unlockToken)}`);
  assert.equal(paidResponse.status, 200);
  const paidData = await paidResponse.json();
  assert.equal(paidData.paid, true, "Stripe session is retrieved server-side");
  assert.equal(paidData.contentPurchase, true);
  assert.equal(paidData.contentUnlocked, true);
  assert.deepEqual(paidData.answers, answers);
  assert.equal(paidData.ready, false, "content purchase does not create a PDF");
  assert.equal(paidData.downloadUrl, null);
  assert.equal(paidData.emailSent, false);

  const directWithoutToken = await fetch(`${baseUrl}/api/payment-session/${checkout.sessionId}/verify`);
  const directData = await directWithoutToken.json();
  assert.equal(directData.paid, true);
  assert.equal(directData.contentUnlocked, false, "success URL/session ID alone cannot unlock answers");
  assert.equal(Object.hasOwn(directData, "answers"), false);

  const storeAfterPayment = JSON.parse(await readFile(path.join(dataDir, "payments-store.json"), "utf8"));
  const purchase = storeAfterPayment.purchases[checkout.sessionId];
  assert.equal(purchase.paymentStatus, "paid");
  assert.equal(purchase.purchaseType, "sleep-content-unlock");
  assert.ok(purchase.contentUnlockedAt);
  assert.equal(Object.hasOwn(purchase, "pdfPath"), false, "PDF generation is out of scope for this purchase");
  assert.equal(Object.hasOwn(purchase, "emailSentAt"), false, "PDF email is out of scope for this purchase");
});

test("TEST mode rejects a LIVE key at backend startup", async () => {
  sessions.clear();
  const dataDir = await mkdtemp(path.join(tmpdir(), "mindscore-test-live-key-") );
  try {
    await assert.rejects(
      startBackend({
        port: 34_000 + Math.floor(Math.random() * 15_000),
        dataDir,
        stripeMode: "test",
        stripeSecretKey: "sk_live_mode_mismatch_test_only",
      }),
      /Local test backend did not start/u,
    );
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});

test("LIVE mode accepts a LIVE key without making any Stripe requests", async (t) => {
  sessions.clear();
  const dataDir = await mkdtemp(path.join(tmpdir(), "mindscore-live-mode-start-") );
  const port = 34_000 + Math.floor(Math.random() * 15_000);
  const { child, baseUrl } = await startBackend({
    port,
    dataDir,
    stripeMode: "live",
    stripeSecretKey: "sk_live_mode_acceptance_test_only",
  });
  t.after(async () => {
    await stopBackend(child);
    await rm(dataDir, { recursive: true, force: true });
  });
  const response = await fetch(`${baseUrl}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(sessions.size, 0, "startup and health checks do not contact Stripe or create a charge");
});

test("LIVE checkout is denied to public callers before any Stripe request", async (t) => {
  sessions.clear();
  const dataDir = await mkdtemp(path.join(tmpdir(), "mindscore-live-public-block-") );
  const port = 34_000 + Math.floor(Math.random() * 15_000);
  const { child, baseUrl } = await startBackend({
    port,
    dataDir,
    stripeMode: "live",
    stripeSecretKey: "sk_live_owner_gate_test_only",
    ownerTestToken: "owner-token-test-only",
  });
  t.after(async () => {
    await stopBackend(child);
    await rm(dataDir, { recursive: true, force: true });
  });

  const response = await postJson(`${baseUrl}/api/create-checkout-session`, {
    customerEmail: email,
    assessmentType: "sleep",
    testName: "Sleep Quality",
    purchaseType: "sleep-content-unlock",
    answers,
  });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "Checkout is temporarily unavailable.");
  assert.equal(sessions.size, 0, "public LIVE request cannot contact Stripe or create a session");
});

test("LIVE mode rejects a TEST key at backend startup", async () => {
  sessions.clear();
  const dataDir = await mkdtemp(path.join(tmpdir(), "mindscore-live-test-key-") );
  try {
    await assert.rejects(
      startBackend({
        port: 34_000 + Math.floor(Math.random() * 15_000),
        dataDir,
        stripeMode: "live",
        stripeSecretKey: "sk_test_mode_mismatch_test_only",
      }),
      /Local test backend did not start/u,
    );
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});

test("missing Stripe key returns a generic checkout configuration error", async (t) => {
  sessions.clear();
  const stripePort = await listen(stripeMock);
  const dataDir = await mkdtemp(path.join(tmpdir(), "mindscore-missing-stripe-key-") );
  const port = 34_000 + Math.floor(Math.random() * 15_000);
  const { child, baseUrl } = await startBackend({ port, dataDir, stripePort, stripeSecretKey: "" });
  t.after(async () => {
    await stopBackend(child);
    await close(stripeMock);
    await rm(dataDir, { recursive: true, force: true });
  });

  const response = await postJson(`${baseUrl}/api/create-checkout-session`, {
    customerEmail: email,
    assessmentType: "sleep",
    testName: "Sleep Quality",
    purchaseType: "sleep-content-unlock",
    answers,
  });
  const data = await response.json();
  assert.equal(response.status, 503);
  assert.equal(data.error, "Payment processing is not configured on this service.");
  assert.equal(JSON.stringify(data).includes("sk_"), false, "API error never contains a Stripe key");
  assert.equal(sessions.size, 0, "missing key is rejected before any Stripe API request");
});
