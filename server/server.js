import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import Stripe from "stripe";
import nodemailer from "nodemailer";
import crypto from "crypto";
import { existsSync } from "fs";
import path from "path";
import { promises as fs } from "fs";
import { fileURLToPath } from "url";
import { buildPremiumPdf } from "../src/premiumPdfGenerator.js";
import { calculateDimensions } from "../src/psychology/dimensions.js";
import { calculateSleepScore, calculateSleepResult } from "../src/psychology/sleepScoring.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3001);
const HOST = "0.0.0.0";
const rawFrontendBaseUrl =
  process.env.FRONTEND_BASE_URL || (process.env.NODE_ENV === "production" ? "" : "http://localhost:5173");
const FRONTEND_BASE_URL = rawFrontendBaseUrl.replace(/\/+$/, "");
const CHECKOUT_SUCCESS_URL = `${FRONTEND_BASE_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`;
const CHECKOUT_CANCEL_URL = `${FRONTEND_BASE_URL}/payment-cancelled`;
const rawDataDir = typeof process.env.DATA_DIR === "string" ? process.env.DATA_DIR.trim() : "";
const DATA_DIR = rawDataDir ? path.resolve(rawDataDir) : path.join(__dirname, "data");
const STORE_PATH = path.join(DATA_DIR, "payments-store.json");
const REPORTS_DIR = path.join(DATA_DIR, "reports");
const DOWNLOAD_TOKEN_TTL_MS = 1000 * 60 * 60 * 4;
const QUESTIONS_PER_ASSESSMENT = 12;
const PREMIUM_PDF_GENERATOR_VERSION = "compact-v7";

// Structured event log for production observability. Never include secrets
// (API keys, tokens, SMTP credentials) in `details`.
const logEvent = (event, details = {}) => {
  console.log(`[event] ${event}`, details);
};

// Only the raw answers are ever trusted from the client. Score, dimensions,
// AI profile/subtype/confidence are always recalculated server-side from
// those answers using the same pure scoring engine as the frontend.
const isValidAnswersPayload = (answers) =>
  Array.isArray(answers) &&
  answers.length === QUESTIONS_PER_ASSESSMENT &&
  answers.every((answer) => Number.isInteger(answer) && answer >= 1 && answer <= 5);

const recalculateAssessment = (answers, assessmentType) => {
  const dimensions = calculateDimensions(answers, assessmentType);

  if (assessmentType === "sleep") {
    const answerIndexes = answers.map((points) => 5 - Number(points));
    const sleepResult = calculateSleepResult(answerIndexes);
    return {
      score: sleepResult.score,
      dimensions,
      aiProfile: sleepResult.profile,
      aiSubtype: sleepResult.subtype,
      aiConfidence: sleepResult.confidence,
    };
  }

  const total = answers.reduce((sum, value) => sum + (Number(value) || 0), 0);
  const score = Math.round((total / (QUESTIONS_PER_ASSESSMENT * 5)) * 100);
  return { score, dimensions, aiProfile: null, aiSubtype: null, aiConfidence: null };
};

// Minimal in-memory sliding-window rate limiter (no extra dependency).
// Protects payment/download endpoints from brute-force and abuse.
const rateLimitHits = new Map();
const rateLimit = (windowMs, maxHits) => (req, res, next) => {
  const key = `${req.path}:${req.ip}`;
  const now = Date.now();
  const hits = (rateLimitHits.get(key) || []).filter((timestamp) => now - timestamp < windowMs);
  hits.push(now);
  rateLimitHits.set(key, hits);
  if (hits.length > maxHits) {
    logEvent("rate_limit_blocked", { path: req.path, ip: req.ip });
    return res.status(429).json({ error: "Too many requests. Please try again shortly." });
  }
  return next();
};

const REQUIRED_ENV = [
  "OPENAI_API_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM_EMAIL",
];

const missingRequired = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missingRequired.length > 0) {
  console.warn("[startup] Missing environment variables:", missingRequired.join(", "));
}

if (!FRONTEND_BASE_URL) {
  console.warn("[startup] Missing FRONTEND_BASE_URL. Set it in production environment.");
}

console.log("[startup] Storage directory", DATA_DIR);

const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-06-30.basil",
});

const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpSecure = process.env.SMTP_SECURE === "true";
const mailTransport = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: smtpPort,
  secure: smtpSecure,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const app = express();

// Restrict cross-origin API access to the configured frontend in
// production; fall back to permissive CORS only for local development.
app.use(
  cors({
    origin: FRONTEND_BASE_URL || true,
  })
);

// Baseline security headers (no extra dependency needed for this scope).
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

const DIST_CANDIDATES = [
  path.resolve(__dirname, "../dist"),
  path.resolve(process.cwd(), "../dist"),
  path.resolve(process.cwd(), "dist"),
];

const FRONTEND_DIST_DIR =
  DIST_CANDIDATES.find((candidate) => existsSync(path.join(candidate, "index.html"))) ||
  DIST_CANDIDATES[0];
const FRONTEND_INDEX_PATH = path.join(FRONTEND_DIST_DIR, "index.html");

if (!existsSync(FRONTEND_INDEX_PATH)) {
  console.warn("[startup] Frontend dist/index.html not found", {
    checkedPaths: DIST_CANDIDATES,
    selectedPath: FRONTEND_DIST_DIR,
  });
}

const toSafeText = (value, fallback = "") => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || fallback;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
};

const isValidEmail = (email) => /.+@.+\..+/.test(toSafeText(email));

const ensureStorage = async () => {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  await fs.mkdir(REPORTS_DIR, { recursive: true });

  try {
    await fs.access(STORE_PATH);
  } catch {
    const seed = {
      assessments: {},
      purchases: {},
      processedEventIds: {},
    };
    await fs.writeFile(STORE_PATH, JSON.stringify(seed, null, 2), "utf-8");
  }
};

// In-memory cache of the parsed store, kept in sync on every write. Avoids
// re-reading and re-parsing the same JSON file repeatedly within and across
// requests (this process is the only writer for a given DATA_DIR instance).
let storeCache = null;

const readStore = async () => {
  if (storeCache) return storeCache;
  await ensureStorage();
  const raw = await fs.readFile(STORE_PATH, "utf-8");
  const parsed = JSON.parse(raw);
  storeCache = {
    assessments: parsed.assessments || {},
    purchases: parsed.purchases || {},
    processedEventIds: parsed.processedEventIds || {},
  };
  return storeCache;
};

const writeStore = async (store) => {
  await ensureStorage();
  storeCache = store;
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf-8");
};

const withStoreMutation = async (mutate) => {
  const store = await readStore();
  await mutate(store);
  await writeStore(store);
};

const makeAssessmentId = () => `asm_${crypto.randomUUID()}`;

const getTokenSecret = () => {
  return (
    process.env.DOWNLOAD_TOKEN_SECRET ||
    process.env.STRIPE_WEBHOOK_SECRET ||
    process.env.STRIPE_SECRET_KEY ||
    "mindscore-dev-token"
  );
};

const createDownloadToken = (sessionId, customerEmail) => {
  const payload = {
    sid: sessionId,
    email: customerEmail,
    exp: Date.now() + DOWNLOAD_TOKEN_TTL_MS,
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");
  const sig = crypto
    .createHmac("sha256", getTokenSecret())
    .update(payloadB64)
    .digest("base64url");

  return `${payloadB64}.${sig}`;
};

const verifyDownloadToken = (token) => {
  const [payloadB64, sig] = toSafeText(token).split(".");
  if (!payloadB64 || !sig) throw new Error("Invalid token format");

  const expectedSig = crypto
    .createHmac("sha256", getTokenSecret())
    .update(payloadB64)
    .digest("base64url");

  if (sig !== expectedSig) throw new Error("Invalid token signature");

  const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf-8"));
  if (!payload.sid || !payload.email || !payload.exp) throw new Error("Invalid token payload");
  if (Date.now() > Number(payload.exp)) throw new Error("Token expired");

  return payload;
};

const createAiReport = async ({ testName, score, answers, dimensions = [] }) => {
  const dimensionSummary = dimensions
    .map((dimension) => `${dimension.name}: ${dimension.score}/100`)
    .join("\n");

  const response = await openaiClient.responses.create({
    model: "gpt-5-mini",
    max_output_tokens: 7000,
    input: `
Create a detailed, personalized self-development report in English.

Assessment:
${testName}

Overall score:
${score}/100

Individual answers:
${JSON.stringify(answers)}

Dimension scores:
${dimensionSummary || "No dimension scores available."}

Important rules:
- This is a self-development report, not a medical or clinical diagnosis.
- Do not claim that the user has a mental disorder or medical condition.
- Clearly distinguish observations from possibilities.
- Base every conclusion only on the supplied scores and answers.
- Avoid generic filler and repetition.
- Use a supportive, professional and practical tone.
- Explain differences between the overall score and individual dimensions.
- Identify the highest and lowest dimensions.
- Give concrete recommendations connected to the lowest dimensions.
- Mention that scores are based on a short self-assessment and may be influenced by current mood or circumstances.

Write the report so it can be used as source content for a premium multi-page PDF, but keep every paragraph useful and specific.
Write exactly these 15 sections:

## 1. Executive Summary
## 2. Overall Score Interpretation
## 3. Dimension Overview
## 4. Detailed Analysis of Resilience
## 5. Detailed Analysis of Emotional Control
## 6. Detailed Analysis of Self Discipline
## 7. Detailed Analysis of Decision Making
## 8. Detailed Analysis of Stress Tolerance
## 9. Strongest Personal Resources
## 10. Possible Blind Spots
## 11. Stress and Behaviour Patterns
## 12. Emotional and Decision-Making Patterns
## 13. Practical Recommendations
## 14. Personalized 30-Day Action Plan
## 15. Final Summary and Important Disclaimer

Formatting rules:

- Every section must begin with the exact heading shown above.
- Do not change, shorten or omit any heading.
- Do not place any text before section 1.
- Write approximately 180-280 words for sections 1-13.
- Section 14 must contain four clearly separated weekly plans and should be approximately 400-600 words.
- Section 15 should be approximately 180-250 words.
- Use short paragraphs and practical bullet points where appropriate.
- Avoid repeating the same advice in different sections.
- Connect every interpretation directly to the supplied scores and answers.
- Clearly distinguish observations from possible interpretations.
- Keep the tone supportive, professional and practical.
- This is a self-development report, not a medical or clinical diagnosis.
`,
  });

  return response.output_text;
};

const generatePremiumPdfBuffer = async ({
  reportText,
  dimensions,
  finalScore,
  assessmentDate,
  selectedTestTitle,
}) => {
  const doc = await buildPremiumPdf({
    reportText,
    profileDimensions: dimensions,
    finalScore,
    assessmentDate,
    selectedTestTitle,
  });

  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
};

const hasCurrentPremiumPdf = (purchase) =>
  Boolean(purchase?.pdfPath) && purchase.pdfGeneratorVersion === PREMIUM_PDF_GENERATOR_VERSION;

const readCurrentPremiumPdf = async (purchase, sessionId, usage) => {
  if (!hasCurrentPremiumPdf(purchase)) {
    throw new Error("Current premium report artifact is unavailable.");
  }

  const pdfBuffer = await fs.readFile(purchase.pdfPath);
  logEvent("premium_pdf_artifact", {
    sessionId,
    usage,
    pdfPath: purchase.pdfPath,
    pdfGeneratorVersion: purchase.pdfGeneratorVersion,
    byteSize: pdfBuffer.length,
  });
  return pdfBuffer;
};

const sendPdfEmail = async ({ toEmail, assessmentType, purchase, sessionId, usage }) => {
  const pdfBuffer = await readCurrentPremiumPdf(purchase, sessionId, usage);
  const subject = "Your MindScore AI Premium Report";
  const text = [
    "Thank you for your purchase.",
    "Your Premium Report is attached to this email.",
    "For support, contact: aimindscore@gmail.com.",
    `Assessment type: ${assessmentType}`,
  ].join("\n");

  await mailTransport.sendMail({
    from: process.env.SMTP_FROM_EMAIL,
    to: toEmail,
    subject,
    text,
    attachments: [
      {
        filename: "MindScore-AI-Premium-Report.pdf",
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });
};

const fulfillmentLocks = new Map();
const resendLocks = new Map();

// Statuses persisted per purchase in the JSON store (our "database" record
// for this app). Once REPORT_READY or COMPLETED is reached, the PDF is
// never regenerated — only an explicit resend-email call can retry email.
const REPORT_STATUS = {
  PENDING_PAYMENT: "PENDING_PAYMENT",
  PAYMENT_VERIFIED: "PAYMENT_VERIFIED",
  GENERATING_REPORT: "GENERATING_REPORT",
  REPORT_READY: "REPORT_READY",
  EMAIL_SENT: "EMAIL_SENT",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
};

const FRIENDLY_GENERATION_ERROR =
  "We couldn't generate your report after multiple attempts. Please contact support at aimindscore@gmail.com and reference your payment confirmation.";

const generateReportPdfWithRetry = async (assessment, sessionId) => {
  const attemptOnce = async () => {
    const reportText = await createAiReport({
      testName: assessment.testName,
      score: assessment.score,
      answers: assessment.answers,
      dimensions: assessment.dimensions,
    });

    return generatePremiumPdfBuffer({
      reportText,
      dimensions: assessment.dimensions,
      finalScore: assessment.score,
      assessmentDate: assessment.assessmentDate,
      selectedTestTitle: assessment.testName,
    });
  };

  try {
    return await attemptOnce();
  } catch (firstError) {
    console.error("[fulfillment] PDF generation attempt 1 failed, retrying once", {
      sessionId,
      message: firstError.message,
    });
    try {
      return await attemptOnce();
    } catch (secondError) {
      console.error("[fulfillment] PDF generation attempt 2 failed, giving up", {
        sessionId,
        message: secondError.message,
      });
      throw new Error(FRIENDLY_GENERATION_ERROR);
    }
  }
};

const fulfillCheckoutSessionInternal = async (session, eventId = "") => {
  const sessionId = toSafeText(session.id);
  if (!sessionId) throw new Error("Missing session id in webhook event");
  const eventKey = toSafeText(eventId, `session_${sessionId}`);

  const metadata = session.metadata || {};
  const assessmentId = toSafeText(metadata.assessmentId);

  const store = await readStore();

  if (store.processedEventIds[eventKey]) {
    console.log("[stripe] idempotent skip: event already processed", { eventId: eventKey, sessionId });
    return;
  }

  const existingPurchase = store.purchases[sessionId];
  const existingStatus = existingPurchase?.reportStatus;

  // One session -> one report. Never regenerate once a PDF exists, and
  // never re-run while a generation attempt is already in flight.
  if (
    existingStatus === REPORT_STATUS.GENERATING_REPORT ||
    ((existingStatus === REPORT_STATUS.REPORT_READY ||
      existingStatus === REPORT_STATUS.EMAIL_SENT ||
      existingStatus === REPORT_STATUS.COMPLETED) &&
      hasCurrentPremiumPdf(existingPurchase))
  ) {
    console.log("[stripe] idempotent skip: report already generated or in progress", {
      sessionId,
      eventId: eventKey,
      reportStatus: existingStatus,
    });
    await withStoreMutation(async (nextStore) => {
      nextStore.processedEventIds[eventKey] = new Date().toISOString();
    });
    return;
  }

  if (session.payment_status !== "paid") {
    console.log("[fulfillment] skipping: payment not verified yet", {
      sessionId,
      paymentStatus: session.payment_status,
    });
    await withStoreMutation(async (nextStore) => {
      const pendingPurchase = nextStore.purchases[sessionId] || {
        sessionId,
        assessmentId,
        assessmentType: toSafeText(metadata.assessmentType, "MindScore Assessment"),
        customerEmail: toSafeText(session.customer_details?.email) || toSafeText(metadata.customerEmail),
        createdAt: new Date().toISOString(),
      };
      pendingPurchase.paymentStatus = session.payment_status;
      pendingPurchase.reportStatus = REPORT_STATUS.PENDING_PAYMENT;
      nextStore.purchases[sessionId] = pendingPurchase;
    });
    return;
  }

  const purchase = existingPurchase || {
    sessionId,
    assessmentId,
    assessmentType: toSafeText(metadata.assessmentType, "MindScore Assessment"),
    customerEmail: toSafeText(session.customer_details?.email) || toSafeText(metadata.customerEmail),
    createdAt: new Date().toISOString(),
  };

  purchase.paymentStatus = "paid";
  purchase.paidAt = new Date().toISOString();
  purchase.reportStatus = REPORT_STATUS.PAYMENT_VERIFIED;
  store.purchases[sessionId] = purchase;
  await writeStore(store);

  logEvent("payment_succeeded", { sessionId, assessmentId: purchase.assessmentId });

  await withStoreMutation(async (nextStore) => {
    const nextPurchase = nextStore.purchases[sessionId] || purchase;
    nextPurchase.reportStatus = REPORT_STATUS.GENERATING_REPORT;
    nextPurchase.generationStartedAt = new Date().toISOString();
    nextStore.purchases[sessionId] = nextPurchase;
  });

  try {
    const refreshedStore = await readStore();
    const assessment = refreshedStore.assessments[purchase.assessmentId];
    if (!assessment) throw new Error(`Saved assessment not found (${purchase.assessmentId})`);

    logEvent("pdf_generation_started", { sessionId, assessmentId: purchase.assessmentId });
    const pdfBuffer = await generateReportPdfWithRetry(assessment, sessionId);

    const pdfPath = path.join(REPORTS_DIR, `${purchase.assessmentId}.pdf`);
    await fs.writeFile(pdfPath, pdfBuffer);
    const reportArtifact = {
      ...purchase,
      pdfPath,
      pdfGeneratorVersion: PREMIUM_PDF_GENERATOR_VERSION,
    };
    logEvent("pdf_generation_completed", {
      sessionId,
      assessmentId: purchase.assessmentId,
      pdfPath,
      pdfGeneratorVersion: PREMIUM_PDF_GENERATOR_VERSION,
      byteSize: pdfBuffer.length,
    });

    // PDF is now safely on disk and downloadable; email is a best-effort
    // step from here on and must never trigger a regeneration.
    await withStoreMutation(async (nextStore) => {
      const nextPurchase = nextStore.purchases[sessionId] || purchase;
      nextPurchase.reportStatus = REPORT_STATUS.REPORT_READY;
      nextPurchase.reportReadyAt = new Date().toISOString();
      nextPurchase.pdfPath = reportArtifact.pdfPath;
      nextPurchase.pdfGeneratorVersion = reportArtifact.pdfGeneratorVersion;
      nextStore.purchases[sessionId] = nextPurchase;
    });

    let emailSent = true;
    let emailErrorDetail = "";
    try {
      await sendPdfEmail({
        toEmail: purchase.customerEmail,
        assessmentType: purchase.assessmentType,
        purchase: reportArtifact,
        sessionId,
        usage: "initial-email",
      });
      logEvent("email_sent", { sessionId, assessmentId: purchase.assessmentId });
    } catch (error) {
      emailSent = false;
      emailErrorDetail = error.message;
      console.error("[fulfillment] email send failed (PDF remains available for download)", {
        sessionId,
        message: error.message,
      });
    }

    await withStoreMutation(async (nextStore) => {
      const nextPurchase = nextStore.purchases[sessionId] || purchase;
      if (emailSent) {
        nextPurchase.reportStatus = REPORT_STATUS.COMPLETED;
        nextPurchase.emailSentAt = new Date().toISOString();
        delete nextPurchase.emailError;
        delete nextPurchase.emailErrorDetail;
      } else {
        // Stays REPORT_READY: download is available, email can be resent later.
        nextPurchase.reportStatus = REPORT_STATUS.REPORT_READY;
        // Friendly message only — raw SMTP/provider errors never reach the client.
        nextPurchase.emailError = "We couldn't email your report right now. You can resend it anytime from this page.";
        nextPurchase.emailErrorDetail = emailErrorDetail;
      }
      nextStore.purchases[sessionId] = nextPurchase;
      nextStore.processedEventIds[eventKey] = new Date().toISOString();
    });
  } catch (error) {
    console.error("[fulfillment] fulfillment error", {
      sessionId,
      message: error.message,
    });

    await withStoreMutation(async (nextStore) => {
      const failedPurchase = nextStore.purchases[sessionId] || purchase;
      failedPurchase.reportStatus = REPORT_STATUS.FAILED;
      failedPurchase.fulfillmentError = error.message;
      failedPurchase.fulfillmentErrorAt = new Date().toISOString();
      nextStore.purchases[sessionId] = failedPurchase;
    });

    throw error;
  }
};

const fulfillCheckoutSession = (session, eventId = "") => {
  const sessionId = toSafeText(session?.id);
  const existingLock = sessionId ? fulfillmentLocks.get(sessionId) : null;
  if (existingLock) return existingLock;

  const task = fulfillCheckoutSessionInternal(session, eventId).finally(() => {
    if (sessionId) fulfillmentLocks.delete(sessionId);
  });

  if (sessionId) fulfillmentLocks.set(sessionId, task);
  return task;
};

app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      return res.status(400).send("Missing Stripe signature");
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET || ""
      );
    } catch (error) {
      console.error("[stripe] webhook signature verification failed", error.message);
      return res.status(400).send("Webhook signature verification failed.");
    }

    try {
      if (event.type === "checkout.session.completed") {
        await fulfillCheckoutSession(event.data.object, event.id);
      }

      return res.json({ received: true });
    } catch (error) {
      console.error("[stripe] webhook fulfillment error", error.message);
      return res.status(500).json({ error: "Webhook fulfillment failed" });
    }
  }
);

app.use(express.json({ limit: "2mb" }));

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/create-checkout-session", rateLimit(60_000, 10), async (req, res) => {
  try {
    if (!FRONTEND_BASE_URL) {
      return res.status(500).json({
        error: "Server configuration error: FRONTEND_BASE_URL is not set.",
      });
    }

    const { customerEmail, assessmentType, testName, answers } = req.body || {};

    if (!isValidEmail(customerEmail)) {
      return res.status(400).json({ error: "Valid customerEmail is required." });
    }

    // Score, dimensions and AI profile/subtype/confidence are NEVER trusted
    // from the client — only the raw answers are, and everything else is
    // recalculated server-side below.
    if (!testName || !isValidAnswersPayload(answers)) {
      return res.status(400).json({ error: "Missing or invalid assessment answers." });
    }

    const safeAssessmentType = toSafeText(assessmentType, testName);
    const recalculated = recalculateAssessment(answers, safeAssessmentType);

    const assessmentId = makeAssessmentId();
    const now = new Date();

    await withStoreMutation(async (store) => {
      store.assessments[assessmentId] = {
        assessmentId,
        customerEmail,
        assessmentType: safeAssessmentType,
        testName: toSafeText(testName, "MindScore Assessment"),
        score: recalculated.score,
        answers,
        dimensions: recalculated.dimensions,
        aiProfile: recalculated.aiProfile,
        aiSubtype: recalculated.aiSubtype,
        aiConfidence: recalculated.aiConfidence,
        assessmentDate: now.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        createdAt: now.toISOString(),
      };
    });

    logEvent("assessment_completed", { assessmentId, assessmentType: safeAssessmentType, score: recalculated.score });

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: customerEmail,
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: "MindScore AI Premium Psychological Report",
              description: "Personalized premium PDF psychological assessment",
            },
            unit_amount: 499,
          },
          quantity: 1,
        },
      ],
      success_url: CHECKOUT_SUCCESS_URL,
      cancel_url: CHECKOUT_CANCEL_URL,
      metadata: {
        assessmentId,
        assessmentType: safeAssessmentType,
        customerEmail,
      },
    });

    await withStoreMutation(async (store) => {
      store.purchases[checkoutSession.id] = {
        sessionId: checkoutSession.id,
        assessmentId,
        assessmentType: safeAssessmentType,
        customerEmail,
        paymentStatus: "pending",
        reportStatus: REPORT_STATUS.PENDING_PAYMENT,
        createdAt: new Date().toISOString(),
      };
    });

    logEvent("payment_started", { sessionId: checkoutSession.id, assessmentId });

    return res.json({
      sessionId: checkoutSession.id,
      url: checkoutSession.url,
      assessmentId,
    });
  } catch (error) {
    console.error("[checkout] checkout session creation failed", error.message);
    return res.status(500).json({ error: "Unable to create checkout session." });
  }
});

// Maps a purchase's persisted reportStatus (+ live Stripe paid flag) to the
// structured status contract the frontend polls.
const derivePublicStatus = (paid, reportStatus) => {
  if (!paid) return "AWAITING_PAYMENT";
  if (reportStatus === REPORT_STATUS.COMPLETED) return "COMPLETED";
  if (reportStatus === REPORT_STATUS.REPORT_READY) return "REPORT_READY";
  if (reportStatus === REPORT_STATUS.FAILED) return "FAILED";
  if (reportStatus === REPORT_STATUS.GENERATING_REPORT) return "GENERATING_REPORT";
  if (reportStatus === REPORT_STATUS.PAYMENT_VERIFIED) return "PAYMENT_VERIFIED";
  return "GENERATING_REPORT";
};

app.get("/api/payment-session/:sessionId/verify", rateLimit(60_000, 30), async (req, res) => {
  try {
    const sessionId = toSafeText(req.params.sessionId);
    if (!sessionId) return res.status(400).json({ status: "PAYMENT_FAILED", error: "Missing session id." });

    let session;
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId);
    } catch (error) {
      console.error("[payment] Stripe session retrieve failed", { sessionId, message: error.message });
      return res.status(400).json({
        status: "PAYMENT_FAILED",
        error: "Unable to verify your payment right now. Please try again or contact support.",
      });
    }

    const store = await readStore();
    const purchase = store.purchases[sessionId];
    const paid = session.payment_status === "paid";

    const shouldReconcileFulfillment =
      paid &&
      (!purchase ||
        purchase.reportStatus === REPORT_STATUS.PENDING_PAYMENT ||
        purchase.reportStatus === REPORT_STATUS.PAYMENT_VERIFIED ||
        purchase.reportStatus === REPORT_STATUS.FAILED ||
        !hasCurrentPremiumPdf(purchase) ||
        !purchase.reportStatus);

    if (shouldReconcileFulfillment) {
      try {
        await fulfillCheckoutSession(session, `verify_${sessionId}`);
      } catch (error) {
        console.error("[payment] verify reconciliation failed", {
          sessionId,
          message: error.message,
        });
      }
    }

    const refreshedStore = await readStore();
    const refreshedPurchase = refreshedStore.purchases[sessionId];
    // Stripe's own verified checkout email always wins over anything the
    // client supplied — never trust client-side email for report delivery.
    const customerEmail =
      toSafeText(session.customer_details?.email) ||
      toSafeText(session.customer_email) ||
      toSafeText(refreshedPurchase?.customerEmail);

    const reportStatus = refreshedPurchase?.reportStatus || "unknown";
    const ready =
      (reportStatus === REPORT_STATUS.REPORT_READY || reportStatus === REPORT_STATUS.COMPLETED) &&
      hasCurrentPremiumPdf(refreshedPurchase);

    const status = derivePublicStatus(paid, reportStatus);

    return res.json({
      sessionId,
      status,
      paid,
      ready,
      customerEmail,
      reportStatus,
      emailSent: Boolean(refreshedPurchase?.emailSentAt),
      emailError: toSafeText(refreshedPurchase?.emailError),
      error: status === "FAILED" ? toSafeText(refreshedPurchase?.fulfillmentError) : "",
      downloadUrl: ready
        ? `/api/premium-report/download?token=${encodeURIComponent(
            createDownloadToken(sessionId, customerEmail)
          )}`
        : null,
    });
  } catch (error) {
    console.error("[payment] session verify error", error.message);
    return res.status(500).json({ status: "PAYMENT_FAILED", error: "Unable to verify payment session." });
  }
});

app.get("/api/premium-report/download", rateLimit(60_000, 20), async (req, res) => {
  try {
    const token = toSafeText(req.query.token);
    if (!token) return res.status(400).json({ status: "PAYMENT_FAILED", error: "Missing token." });

    const payload = verifyDownloadToken(token);
    console.log("[download] request received", {
      sessionId: payload.sid,
      email: payload.email,
    });

    const store = await readStore();
    let purchase = store.purchases[payload.sid];

    console.log("[download] token lookup result", {
      sessionId: payload.sid,
      found: Boolean(purchase),
      reportStatus: purchase?.reportStatus || "missing",
      hasPdfPath: Boolean(purchase?.pdfPath),
    });

    const isReportReady = (candidate) =>
      Boolean(candidate) &&
      (candidate.reportStatus === REPORT_STATUS.REPORT_READY || candidate.reportStatus === REPORT_STATUS.COMPLETED) &&
      hasCurrentPremiumPdf(candidate);

    if (!isReportReady(purchase)) {
      const session = await stripe.checkout.sessions.retrieve(payload.sid);
      if (session.payment_status !== "paid") {
        return res
          .status(404)
          .json({ status: "AWAITING_PAYMENT", error: "Report not ready: payment not completed." });
      }

      try {
        console.log("[download] attempting reconciliation", {
          sessionId: payload.sid,
        });
        await fulfillCheckoutSession(session, `download_${payload.sid}`);
      } catch (error) {
        console.error("[download] reconciliation failed", {
          sessionId: payload.sid,
          message: error.message,
        });
      }

      const refreshedStore = await readStore();
      purchase = refreshedStore.purchases[payload.sid];

      console.log("[download] post-reconciliation lookup", {
        sessionId: payload.sid,
        found: Boolean(purchase),
        reportStatus: purchase?.reportStatus || "missing",
        hasPdfPath: Boolean(purchase?.pdfPath),
      });
    }

    if (!isReportReady(purchase)) {
      return res.status(404).json({
        status: purchase?.reportStatus === REPORT_STATUS.FAILED ? "FAILED" : "GENERATING_REPORT",
        error:
          purchase?.fulfillmentError ||
          "Report not ready. Fulfillment data is unavailable on this instance.",
      });
    }

    if (toSafeText(purchase.customerEmail).toLowerCase() !== toSafeText(payload.email).toLowerCase()) {
      return res.status(403).json({ status: "PAYMENT_FAILED", error: "Token does not match purchase." });
    }

    const pdfBuffer = await readCurrentPremiumPdf(purchase, payload.sid, "download");
    logEvent("download_completed", { sessionId: payload.sid, pdfPath: purchase.pdfPath, pdfGeneratorVersion: purchase.pdfGeneratorVersion, byteSize: pdfBuffer.length });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=MindScore-AI-Premium-Report.pdf");
    return res.send(pdfBuffer);
  } catch (error) {
    console.error("[payment] download token error", error.message);
    return res.status(401).json({ status: "PAYMENT_FAILED", error: "Invalid or expired token." });
  }
});

app.post("/api/premium-report/resend-email", rateLimit(60_000, 5), async (req, res) => {
  let payload;
  try {
    payload = verifyDownloadToken(toSafeText(req.body?.token));
  } catch (error) {
    return res.status(401).json({ status: "PAYMENT_FAILED", error: "Invalid or expired token." });
  }

  const sessionId = payload.sid;
  const existingLock = resendLocks.get(sessionId);
  if (existingLock) return existingLock.then((result) => res.json(result));

  const task = (async () => {
    const store = await readStore();
    const purchase = store.purchases[sessionId];

    if (
      !purchase ||
      (purchase.reportStatus !== REPORT_STATUS.REPORT_READY && purchase.reportStatus !== REPORT_STATUS.COMPLETED) ||
      !hasCurrentPremiumPdf(purchase)
    ) {
      return {
        status: purchase?.reportStatus === REPORT_STATUS.FAILED ? "FAILED" : "GENERATING_REPORT",
        emailSent: false,
        error: "Report is not ready yet, so there is nothing to resend.",
      };
    }

    if (toSafeText(purchase.customerEmail).toLowerCase() !== toSafeText(payload.email).toLowerCase()) {
      return { status: "PAYMENT_FAILED", emailSent: false, error: "Token does not match purchase." };
    }

    try {
      await sendPdfEmail({
        toEmail: purchase.customerEmail,
        assessmentType: purchase.assessmentType,
        purchase,
        sessionId,
        usage: "resend-email",
      });

      await withStoreMutation(async (nextStore) => {
        const nextPurchase = nextStore.purchases[sessionId] || purchase;
        nextPurchase.reportStatus = REPORT_STATUS.COMPLETED;
        nextPurchase.emailSentAt = new Date().toISOString();
        delete nextPurchase.emailError;
        nextStore.purchases[sessionId] = nextPurchase;
      });

      console.log("[resend] email resent successfully", { sessionId, email: purchase.customerEmail });
      logEvent("email_sent", { sessionId, via: "resend" });
      return { status: "COMPLETED", emailSent: true, error: "" };
    } catch (error) {
      const friendlyError = "We couldn't resend the email right now. Please try again shortly.";
      await withStoreMutation(async (nextStore) => {
        const nextPurchase = nextStore.purchases[sessionId] || purchase;
        nextPurchase.emailError = friendlyError;
        nextPurchase.emailErrorDetail = error.message;
        nextStore.purchases[sessionId] = nextPurchase;
      });
      console.error("[resend] email resend failed", { sessionId, message: error.message });
      return { status: "REPORT_READY", emailSent: false, error: friendlyError };
    }
  })().finally(() => {
    resendLocks.delete(sessionId);
  });

  resendLocks.set(sessionId, task);
  return task.then((result) => res.json(result));
});

app.use("/api", (req, res) => {
  return res.status(404).json({ error: "API route not found." });
});

app.use(
  express.static(FRONTEND_DIST_DIR, {
    // Hashed build assets (logos, icons, JS/CSS bundles) are safe to cache
    // long-term; index.html itself is not served from here (handled below).
    maxAge: "1d",
    etag: true,
  })
);

app.get("*", (req, res, next) => {
  if (req.path === "/api" || req.path.startsWith("/api/")) {
    return next();
  }

  return res.sendFile(FRONTEND_INDEX_PATH);
});

// Safety net: never leak stack traces or internal error details to clients.
app.use((error, req, res, _next) => {
  console.error("[fatal] unhandled request error", { path: req.path, message: error?.message });
  if (res.headersSent) return;
  res.status(500).json({ error: "Something went wrong. Please try again." });
});

app.listen(PORT, HOST, () => {
  console.log(`[startup] server running on ${HOST}:${PORT}`);
});

// Fail fast and loudly on unexpected crashes rather than leaving the
// process in an undefined state; the platform process manager restarts it.
process.on("unhandledRejection", (reason) => {
  console.error("[fatal] unhandled promise rejection", reason);
});

process.on("uncaughtException", (error) => {
  console.error("[fatal] uncaught exception", error);
  process.exit(1);
});
