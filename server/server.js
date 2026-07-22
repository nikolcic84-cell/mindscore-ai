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

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3001);
const HOST = "0.0.0.0";
const CHECKOUT_SUCCESS_URL =
  "http://localhost:5173/payment-success?session_id={CHECKOUT_SESSION_ID}";
const CHECKOUT_CANCEL_URL = "http://localhost:5173/payment-cancelled";
const STORE_PATH = path.join(__dirname, "data", "payments-store.json");
const REPORTS_DIR = path.join(__dirname, "data", "reports");
const DOWNLOAD_TOKEN_TTL_MS = 1000 * 60 * 60 * 4;

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
app.use(cors());

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

const readStore = async () => {
  await ensureStorage();
  const raw = await fs.readFile(STORE_PATH, "utf-8");
  const parsed = JSON.parse(raw);
  return {
    assessments: parsed.assessments || {},
    purchases: parsed.purchases || {},
    processedEventIds: parsed.processedEventIds || {},
  };
};

const writeStore = async (store) => {
  await ensureStorage();
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

const sendPdfEmail = async ({ toEmail, assessmentType, pdfBuffer }) => {
  const subject = "Your MindScore AI Premium Report";
  const text = [
    "Payment successful.",
    "Your Premium PDF report is attached to this email.",
    "Thank you for using MindScore AI.",
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

const fulfillCheckoutSession = async (session, eventId) => {
  const sessionId = toSafeText(session.id);
  if (!sessionId) throw new Error("Missing session id in webhook event");

  const metadata = session.metadata || {};
  const assessmentId = toSafeText(metadata.assessmentId);

  const store = await readStore();

  if (store.processedEventIds[eventId]) {
    console.log("[stripe] idempotent skip: event already processed", { eventId, sessionId });
    return;
  }

  const existingPurchase = store.purchases[sessionId];
  if (existingPurchase?.fulfillmentStatus === "processing") {
    console.log("[stripe] idempotent skip: purchase already processing", { sessionId, eventId });
    return;
  }

  if (existingPurchase?.fulfillmentStatus === "completed") {
    store.processedEventIds[eventId] = new Date().toISOString();
    await writeStore(store);
    console.log("[stripe] idempotent skip: purchase already fulfilled", { sessionId, eventId });
    return;
  }

  const purchase = existingPurchase || {
    sessionId,
    assessmentId,
    assessmentType: toSafeText(metadata.assessmentType, "MindScore Assessment"),
    customerEmail: toSafeText(metadata.customerEmail) || toSafeText(session.customer_details?.email),
    paymentStatus: "paid",
    fulfillmentStatus: "processing",
    createdAt: new Date().toISOString(),
  };

  purchase.paymentStatus = "paid";
  purchase.paidAt = new Date().toISOString();
  purchase.fulfillmentStatus = "processing";
  store.purchases[sessionId] = purchase;
  await writeStore(store);

  try {
    console.log("[fulfillment] payment confirmed", {
      sessionId,
      assessmentId: purchase.assessmentId,
      email: purchase.customerEmail,
    });

    const refreshedStore = await readStore();
    const assessment = refreshedStore.assessments[purchase.assessmentId];
    if (!assessment) throw new Error(`Saved assessment not found: ${purchase.assessmentId}`);

    const reportText = await createAiReport({
      testName: assessment.testName,
      score: assessment.score,
      answers: assessment.answers,
      dimensions: assessment.dimensions,
    });

    const pdfBuffer = await generatePremiumPdfBuffer({
      reportText,
      dimensions: assessment.dimensions,
      finalScore: assessment.score,
      assessmentDate: assessment.assessmentDate,
      selectedTestTitle: assessment.testName,
    });

    const pdfPath = path.join(REPORTS_DIR, `${purchase.assessmentId}.pdf`);
    await fs.writeFile(pdfPath, pdfBuffer);
    console.log("[fulfillment] PDF generated", {
      sessionId,
      assessmentId: purchase.assessmentId,
      path: pdfPath,
    });

    await sendPdfEmail({
      toEmail: purchase.customerEmail,
      assessmentType: purchase.assessmentType,
      pdfBuffer,
    });
    console.log("[fulfillment] email sent", {
      sessionId,
      email: purchase.customerEmail,
    });

    await withStoreMutation(async (nextStore) => {
      const nextPurchase = nextStore.purchases[sessionId] || purchase;
      nextPurchase.fulfillmentStatus = "completed";
      nextPurchase.fulfilledAt = new Date().toISOString();
      nextPurchase.pdfPath = pdfPath;
      nextPurchase.emailSentAt = new Date().toISOString();
      nextStore.purchases[sessionId] = nextPurchase;
      nextStore.processedEventIds[eventId] = new Date().toISOString();
    });
  } catch (error) {
    console.error("[fulfillment] fulfillment error", {
      sessionId,
      message: error.message,
    });

    await withStoreMutation(async (nextStore) => {
      const failedPurchase = nextStore.purchases[sessionId] || purchase;
      failedPurchase.fulfillmentStatus = "error";
      failedPurchase.fulfillmentError = error.message;
      failedPurchase.fulfillmentErrorAt = new Date().toISOString();
      nextStore.purchases[sessionId] = failedPurchase;
    });

    throw error;
  }
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
      return res.status(400).send(`Webhook signature verification failed: ${error.message}`);
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

app.post("/api/generate-report", async (req, res) => {
  try {
    const { testName, score, answers, dimensions = [] } = req.body;

    if (!testName || typeof score !== "number" || !Array.isArray(answers)) {
      return res.status(400).json({
        error: "Missing testName, score or answers.",
      });
    }

    const report = await createAiReport({ testName, score, answers, dimensions });
    res.json({ report });
  } catch (error) {
    console.error("OpenAI error:", error);
    res.status(500).json({
      error: "Report could not be generated right now.",
    });
  }
});

app.post("/api/create-checkout-session", async (req, res) => {
  try {
    const {
      customerEmail,
      assessmentType,
      testName,
      score,
      answers,
      dimensions = [],
    } = req.body;

    if (!isValidEmail(customerEmail)) {
      return res.status(400).json({ error: "Valid customerEmail is required." });
    }

    if (!testName || typeof score !== "number" || !Array.isArray(answers)) {
      return res.status(400).json({ error: "Missing assessment payload." });
    }

    const assessmentId = makeAssessmentId();
    const now = new Date();

    await withStoreMutation(async (store) => {
      store.assessments[assessmentId] = {
        assessmentId,
        customerEmail,
        assessmentType: toSafeText(assessmentType, testName),
        testName: toSafeText(testName, "MindScore Assessment"),
        score,
        answers,
        dimensions,
        assessmentDate: now.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        createdAt: now.toISOString(),
      };
    });

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
        assessmentType: toSafeText(assessmentType, testName),
        customerEmail,
      },
    });

    await withStoreMutation(async (store) => {
      store.purchases[checkoutSession.id] = {
        sessionId: checkoutSession.id,
        assessmentId,
        assessmentType: toSafeText(assessmentType, testName),
        customerEmail,
        paymentStatus: "pending",
        fulfillmentStatus: "pending",
        createdAt: new Date().toISOString(),
      };
    });

    console.log("[checkout] checkout session created", {
      sessionId: checkoutSession.id,
      assessmentId,
      customerEmail,
      amountEur: "4.99",
    });

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

app.get("/api/payment-session/:sessionId/verify", async (req, res) => {
  try {
    const sessionId = toSafeText(req.params.sessionId);
    if (!sessionId) return res.status(400).json({ error: "Missing session id." });

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const store = await readStore();
    const purchase = store.purchases[sessionId];
    const customerEmail =
      toSafeText(purchase?.customerEmail) ||
      toSafeText(session.customer_details?.email) ||
      toSafeText(session.customer_email);

    const paid = session.payment_status === "paid";
    const ready = purchase?.fulfillmentStatus === "completed" && !!purchase?.pdfPath;

    return res.json({
      sessionId,
      paid,
      ready,
      customerEmail,
      fulfillmentStatus: purchase?.fulfillmentStatus || "unknown",
      downloadUrl: ready
        ? `${process.env.BACKEND_BASE_URL || `http://localhost:${PORT}`}/api/premium-report/download?token=${encodeURIComponent(
            createDownloadToken(sessionId, customerEmail)
          )}`
        : null,
    });
  } catch (error) {
    console.error("[payment] session verify error", error.message);
    return res.status(500).json({ error: "Unable to verify payment session." });
  }
});

app.get("/api/premium-report/download", async (req, res) => {
  try {
    const token = toSafeText(req.query.token);
    if (!token) return res.status(400).json({ error: "Missing token." });

    const payload = verifyDownloadToken(token);
    const store = await readStore();
    const purchase = store.purchases[payload.sid];

    if (!purchase || purchase.fulfillmentStatus !== "completed" || !purchase.pdfPath) {
      return res.status(404).json({ error: "Report not ready." });
    }

    if (toSafeText(purchase.customerEmail).toLowerCase() !== toSafeText(payload.email).toLowerCase()) {
      return res.status(403).json({ error: "Token does not match purchase." });
    }

    const pdfBuffer = await fs.readFile(purchase.pdfPath);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=MindScore-AI-Premium-Report.pdf");
    return res.send(pdfBuffer);
  } catch (error) {
    console.error("[payment] download token error", error.message);
    return res.status(401).json({ error: "Invalid or expired token." });
  }
});

app.use(express.static(FRONTEND_DIST_DIR));

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return next();
  }

  return res.sendFile(FRONTEND_INDEX_PATH);
});

app.listen(PORT, HOST, () => {
  console.log(`[startup] server running on ${HOST}:${PORT}`);
});
