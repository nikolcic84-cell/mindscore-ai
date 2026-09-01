import { useEffect, useMemo, useState } from "react";
import AnalyticsDashboard from "./AnalyticsDashboard";
import { calculateDimensions } from "./psychology/dimensions";
import { calculateSleepScore, calculateSleepResult } from "./psychology/sleepScoring";
import "./App.css";

const BACKEND_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");
const API_BASE = "/api";
const LEGAL_LAST_UPDATED = "July 24, 2026";
const PREMIUM_PRICE_EUR = "4.99";
const DRAFT_KEY = "mindscore_assessment_draft_v2";
const COMPLETED_ASSESSMENT_KEY = "mindscore_completed_assessment_v1";

const apiUrl = (path) => (/^https?:\/\//i.test(path) ? path : `${BACKEND_URL}${path}`);

const tests = {
  mental: {
    title: "Mental Strength",
    subtitle: "Measure resilience, emotional control and consistency under pressure.",
    icon: "M",
    category: "Core Resilience",
    minutes: "2-3 min",
    questions: [
      "You spend months working toward an important goal, but just before reaching it, you fail. What best describes your usual reaction?",
      "Someone publicly criticizes your work in front of other people. What is your most natural response?",
      "You wake up feeling completely unmotivated, but you have important responsibilities. What do you usually do?",
      "A situation develops where you have very little information and must make an important decision. How do you usually respond?",
      "A close friend or colleague suddenly disappoints you. What is your first reaction?",
      "Several stressful problems happen during the same week. What usually happens to your ability to function?",
      "You notice that someone else receives recognition for work you also contributed to. How do you usually react internally?",
      "You realize you made a serious mistake that cannot be undone. What is your typical approach afterward?",
      "You are offered an easy reward today, but accepting it could reduce your chances of achieving a much bigger long-term goal. What do you usually choose?",
      "People around you become anxious or panic during a difficult situation. How do you usually behave?",
      "You repeatedly face obstacles while trying to achieve something important. What best describes your long-term behavior?",
      "At the end of a very difficult day, when you feel emotionally exhausted, how likely are you to continue acting according to your values instead of your emotions?",
    ],
  },
  stress: {
    title: "Stress Control",
    subtitle: "Understand how you regulate pressure, uncertainty and overload.",
    icon: "S",
    category: "Emotional Balance",
    minutes: "2-3 min",
    questions: [
      "Three urgent problems demand your attention at the same time, and each person expects an immediate response. What best describes how you usually react?",
      "You receive a message that could contain bad news, but you cannot open it for several hours. How do you typically handle the uncertainty?",
      "A carefully planned day suddenly falls apart because of circumstances outside your control. What is your most natural response?",
      "You are already exhausted when someone adds another important responsibility to your workload. How do you usually manage the situation?",
      "During a tense disagreement, the other person becomes emotional and raises their voice. What usually happens to your own emotional state?",
      "You make a small mistake at work, but your mind keeps returning to it long after the situation has ended. What best describes your usual reaction?",
      "You have several unfinished tasks before going to bed, and none of them can be completed that evening. How easily can you mentally disconnect?",
      "An important result is delayed, and you have no control over when you will receive an answer. How do you usually respond during the waiting period?",
      "After several stressful days in a row, you finally have free time. What are you most likely to do with it?",
      "Someone unexpectedly questions your competence while you are already under pressure. How do you usually protect your focus and emotional balance?",
      "Your body begins showing signs of stress, such as tension, rapid breathing or restlessness, during an important situation. What do you typically do next?",
      "When stress lasts for weeks rather than hours, what best describes your ability to maintain healthy routines, clear thinking and emotional stability?",
    ],
  },
  sleep: {
    title: "Sleep Quality",
    subtitle: "Explore sleep quality, consistency and daytime clarity.",
    icon: "Q",
    category: "Recovery",
    minutes: "2-3 min",
    questions: [
      "I usually wake up feeling refreshed after what should have been a full night's sleep.",
      "If I wake up during the night, I usually fall back asleep easily.",
      "After an emotionally difficult day, I am still able to sleep well that night.",
      "My thoughts keep running when I am trying to fall asleep.",
      "During the day, I often feel mentally tired even after getting enough sleep.",
      "An important event the next morning significantly affects my sleep.",
      "I often wake up before my alarm and cannot fall asleep again.",
      "My mind becomes clear and focused quickly after I wake up.",
      "I rely on caffeine or other stimulants to feel fully awake during the day.",
      "My body recovers quickly after my sleep schedule changes for one or two days.",
      "I often feel sleepy during quiet activities such as reading, studying, or watching TV.",
      "I am confident that my current sleep allows my brain and body to recover at their best.",
    ],
  },
  leadership: {
    title: "Personal Strengths",
    subtitle: "Assess confidence, decision quality and leadership potential.",
    icon: "P",
    category: "Potential",
    minutes: "2-3 min",
    questions: [
      "When a group faces confusion or uncertainty, what do you naturally tend to do?",
      "You notice a serious mistake that nobody else has seen. What is your first reaction?",
      "A team project starts falling apart because people disagree. How do you usually respond?",
      "You must make an important decision without having all the information. How comfortable are you doing that?",
      "When someone on your team performs poorly, what is your natural instinct?",
      "You receive criticism about a decision you made. What best describes your usual reaction?",
      "Two people in your group are in conflict. How likely are you to step in and help resolve it?",
      "When you believe the majority is making the wrong decision, how willing are you to respectfully disagree?",
      "You are given responsibility for a difficult task with no clear instructions. How do you usually react?",
      "After making a mistake that affects other people, what do you typically do first?",
      "When people around you become anxious or lose confidence, how often do they look to you for direction or reassurance?",
      "Imagine you could lead a team tomorrow. How confident are you that you could earn trust, make sound decisions and help others perform at their best?",
    ],
  },
};

const answers = [
  { text: "This describes me very well", points: 5 },
  { text: "Mostly true for me", points: 4 },
  { text: "Sometimes true", points: 3 },
  { text: "Rarely true", points: 2 },
  { text: "Not true for me", points: 1 },
];

// Labels shown as locked/blurred in the Premium Preview until Premium is purchased.
const PREMIUM_INSIGHT_CARDS = [
  "Recovery Stability",
  "Cognitive Recovery",
];

const PREMIUM_REPORT_CHECKLIST = [
  "Personalized AI interpretation",
  "Hidden strengths",
  "Recovery roadmap",
  "Daily action plan",
  "Professional PDF report",
];

const PREMIUM_TRUST_BADGES = [
  { icon: "🔒", label: "Secure payment" },
  { icon: "⚡", label: "Instant access" },
  { icon: "📄", label: "PDF included" },
];

const faqItems = [
  {
    question: "Are the assessments free?",
    answer:
      "Yes. Every assessment includes a free score with useful insight. The Premium Report is an optional one-time purchase.",
  },
  {
    question: "What is included in the Premium Report?",
    answer:
      "You receive a personalized AI profile, detailed score interpretation, strengths and risk patterns, practical recommendations, and a clear action plan in a downloadable PDF sent to your email.",
  },
  {
    question: "Is this a medical diagnosis?",
    answer:
      "No. MindScore AI provides educational and informational self-assessment content and does not provide diagnosis, treatment or emergency care.",
  },
  {
    question: "How is my payment processed?",
    answer:
      "Payments are processed securely through Stripe. MindScore AI does not store your card details.",
  },
  {
    question: "When will I receive my report?",
    answer:
      "In most cases your Premium PDF is available immediately after payment verification and a copy is sent to your email.",
  },
  {
    question: "What happens if the PDF does not arrive?",
    answer:
      "Use the download button on your success page first. If email delivery fails or there is any issue, contact support and include your payment email.",
  },
  {
    question: "Can I request deletion of my data?",
    answer:
      "Yes. You can request access, correction or deletion by emailing support.",
  },
  {
    question: "How do I contact support?",
    answer:
      "Email aimindscore@gmail.com and include a short description of your issue and the email used during checkout.",
  },
];

function SeoHead({ title, description }) {
  useEffect(() => {
    document.title = title;

    const setMeta = (name, content, property = false) => {
      const attr = property ? "property" : "name";
      let tag = document.head.querySelector(`meta[${attr}='${name}']`);
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute(attr, name);
        document.head.appendChild(tag);
      }
      tag.setAttribute("content", content);
    };

    setMeta("description", description);
    setMeta("og:title", title, true);
    setMeta("og:description", description, true);
    setMeta("twitter:title", title);
    setMeta("twitter:description", description);
  }, [title, description]);

  return null;
}

function SiteFooter() {
  return (
    <footer className="site-footer" aria-label="Legal and support links">
      <div className="footer-grid">
        <div className="footer-col brand">
          <p className="footer-brand">MindScore AI</p>
          <p className="footer-note">
            Educational and informational self-assessment platform. Not medical diagnosis or treatment.
          </p>
        </div>

        <nav className="footer-col" aria-label="Legal links">
          <p className="footer-col-title">Legal</p>
          <div className="site-footer-links">
            <a href="/privacy">Privacy Policy</a>
            <a href="/terms">Terms of Service</a>
          </div>
        </nav>

        <nav className="footer-col" aria-label="Support links">
          <p className="footer-col-title">Support</p>
          <div className="site-footer-links">
            <a href="/support">Customer Support</a>
            <a href="mailto:aimindscore@gmail.com">aimindscore@gmail.com</a>
          </div>
        </nav>

        <div className="footer-col" aria-label="Product notes">
          <p className="footer-col-title">Product</p>
          <div className="site-footer-links">
            <a href="/#assessments">Assessments</a>
            <a href="/#premium-report">Premium Report</a>
          </div>
        </div>
      </div>
      <p className="footer-copyright">(c) {new Date().getFullYear()} MindScore AI</p>
    </footer>
  );
}

function LegalPageLayout({ title, badge, children }) {
  return (
    <>
      <SeoHead
        title={`${title} | MindScore AI`}
        description="MindScore AI legal and support information."
      />
      <main className="page legal-page">
        <section className="content-panel legal-panel">
          <div className="badge">{badge}</div>
          <h1>{title}</h1>
          <p className="legal-last-updated">Last updated: {LEGAL_LAST_UPDATED}</p>
          <div className="legal-content">{children}</div>
          <a className="secondary-btn" href="/">
            Back to Home
          </a>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function PrivacyPolicyPage() {
  return (
    <LegalPageLayout title="Privacy Policy" badge="Legal">
      <p>
        MindScore AI collects information that you provide through the service. This includes assessment answers and,
        when you purchase a premium report, your email address for secure delivery.
      </p>

      <h2>How We Use Your Data</h2>
      <p>
        Your assessment data may be processed to generate AI-powered informational reports. This processing supports
        score summaries, profile insights and premium PDF generation.
      </p>

      <h2>Third-Party Processors</h2>
      <p>
        Payments are processed by Stripe. Email delivery is handled through secure SMTP. Hosting and infrastructure
        services are provided through Render.
      </p>

      <h2>Retention and Security</h2>
      <p>
        We retain data only as long as needed to deliver purchased reports, resolve support requests and meet legal
        obligations. Reasonable safeguards are used to protect stored data.
      </p>

      <h2>Your Rights</h2>
      <p>
        You may request access, correction or deletion of personal data at any time. Contact:
        <a className="inline-mail-link" href="mailto:aimindscore@gmail.com">
          aimindscore@gmail.com
        </a>
      </p>

      <h2>Important Notice</h2>
      <p>
        MindScore AI is not a medical service and does not provide diagnosis, treatment, psychiatric care or emergency
        assistance.
      </p>
    </LegalPageLayout>
  );
}

function TermsOfServicePage() {
  return (
    <LegalPageLayout title="Terms of Service" badge="Legal">
      <p>
        MindScore AI provides self-assessment tools and AI-generated informational reports. By using this service,
        you agree to these terms.
      </p>

      <h2>Informational Use Only</h2>
      <p>
        Results and reports are educational and informational. They are not medical advice, diagnosis or treatment.
      </p>

      <h2>Payments and Delivery</h2>
      <p>
        Premium reports are paid digital products processed by Stripe. Delivery is provided digitally through download
        and email when available.
      </p>

      <h2>Acceptable Use</h2>
      <p>
        You agree not to misuse the service, attempt unauthorized access, interfere with platform operation, or
        submit unlawful content.
      </p>

      <h2>Service Availability</h2>
      <p>
        We aim for reliable service but cannot guarantee uninterrupted access. Temporary outages may occur due to
        maintenance or infrastructure providers.
      </p>

      <h2>Liability</h2>
      <p>
        To the maximum extent permitted by law, MindScore AI is not liable for indirect or consequential damages
        resulting from use of informational report content.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about terms can be sent to:
        <a className="inline-mail-link" href="mailto:aimindscore@gmail.com">
          aimindscore@gmail.com
        </a>
      </p>
    </LegalPageLayout>
  );
}

function SupportPage() {
  return (
    <LegalPageLayout title="Customer Support" badge="Support">
      <p>
        Contact support at
        <a className="inline-mail-link" href="mailto:aimindscore@gmail.com">
          aimindscore@gmail.com
        </a>
        for help with payment, PDF delivery or privacy requests.
      </p>
      <p>To help us resolve your request faster, include the email used during payment and a short issue summary.</p>

      <h2>Common Topics</h2>
      <ul>
        <li>Payment completed but report not available</li>
        <li>PDF download issue</li>
        <li>Email delivery problem</li>
        <li>Duplicate payment</li>
        <li>Privacy and deletion request</li>
      </ul>
    </LegalPageLayout>
  );
}

function PaymentSuccessPage() {
  const [state, setState] = useState({
    loading: true,
    status: "PAYMENT_VERIFIED",
    paid: false,
    ready: false,
    reportStatus: "PENDING_PAYMENT",
    customerEmail: "",
    downloadUrl: "",
    isDownloading: false,
    isResendingEmail: false,
    resendMessage: "",
    emailSent: false,
    emailError: "",
    attempts: 0,
    error: "",
  });

  const sessionId = new URLSearchParams(window.location.search).get("session_id") || "";

  useEffect(() => {
    let cancelled = false;
    let timerId = null;

    const verify = async () => {
      if (!sessionId) {
        setState((previous) => ({
          ...previous,
          loading: false,
          error: "Missing Stripe session id.",
        }));
        return;
      }

      try {
        const verifySessionUrl = `${API_BASE}/payment-session/${encodeURIComponent(sessionId)}/verify`;
        const response = await fetch(apiUrl(verifySessionUrl));
        const rawBody = await response.text();
        const data = rawBody ? JSON.parse(rawBody) : {};

        if (!response.ok) {
          throw new Error(data.error || "Payment verification failed.");
        }

        if (cancelled) return;

        const reportStatus = data.reportStatus || "unknown";
        const generationFailed = data.status === "FAILED" || reportStatus === "FAILED";

        setState((previous) => ({
          ...previous,
          loading: false,
          status: data.status || previous.status,
          paid: Boolean(data.paid),
          ready: Boolean(data.ready),
          reportStatus,
          customerEmail: data.customerEmail || "",
          downloadUrl: data.downloadUrl || "",
          emailSent: Boolean(data.emailSent),
          emailError: data.emailError || "",
          attempts: previous.attempts + 1,
          error: generationFailed ? data.error || "Report generation failed." : "",
        }));

        if (data.paid && !data.ready && !generationFailed) {
          timerId = window.setTimeout(verify, 3000);
        }
      } catch (error) {
        if (cancelled) return;
        setState((previous) => ({
          ...previous,
          loading: false,
          error: error.message || "Payment verification failed.",
        }));
      }
    };

    verify();

    return () => {
      cancelled = true;
      if (timerId) window.clearTimeout(timerId);
    };
  }, [sessionId]);

  const handleDownloadPdf = async () => {
    if (!state.downloadUrl) {
      setState((previous) => ({
        ...previous,
        error: "Download URL is missing. Refresh and try again.",
      }));
      return;
    }

    setState((previous) => ({
      ...previous,
      isDownloading: true,
      error: "",
    }));

    try {
      const response = await fetch(apiUrl(state.downloadUrl));
      const contentType = (response.headers.get("content-type") || "").toLowerCase();
      const contentDisposition = response.headers.get("content-disposition") || "";

      if (!response.ok) {
        const rawError = await response.text();
        throw new Error(rawError || "Failed to download PDF.");
      }

      if (!contentType.includes("application/pdf")) {
        throw new Error("Download endpoint did not return a PDF file.");
      }

      const blob = await response.blob();
      if (!blob.size) {
        throw new Error("Downloaded PDF is empty.");
      }

      const nameMatch =
        /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition) || /filename="?([^";]+)"?/i.exec(contentDisposition);
      const fileName = decodeURIComponent(nameMatch?.[1] || "MindScore-AI-Premium-Report.pdf");

      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (error) {
      setState((previous) => ({
        ...previous,
        error: error.message || "Failed to download Premium PDF.",
      }));
    } finally {
      setState((previous) => ({
        ...previous,
        isDownloading: false,
      }));
    }
  };

  const handleResendEmail = async () => {
    const token = new URLSearchParams(state.downloadUrl.split("?")[1] || "").get("token");
    if (!token) {
      setState((previous) => ({ ...previous, resendMessage: "Download link is missing. Refresh and try again." }));
      return;
    }

    setState((previous) => ({ ...previous, isResendingEmail: true, resendMessage: "" }));

    try {
      const response = await fetch(apiUrl(`${API_BASE}/premium-report/resend-email`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await response.json();

      setState((previous) => ({
        ...previous,
        emailSent: Boolean(data.emailSent),
        emailError: data.emailSent ? "" : data.error || "",
        resendMessage: data.emailSent
          ? "Email resent successfully."
          : data.error || "Could not resend the email. Please try again.",
      }));
    } catch (error) {
      setState((previous) => ({
        ...previous,
        resendMessage: error.message || "Could not resend the email. Please try again.",
      }));
    } finally {
      setState((previous) => ({ ...previous, isResendingEmail: false }));
    }
  };

  const delayed = state.paid && !state.ready && state.attempts >= 6;
  const showRecoverableError = !state.loading && !state.ready && Boolean(state.error);

  return (
    <>
      <SeoHead
        title="Payment Success | MindScore AI"
        description="Verify payment, generate your premium report, and download your PDF securely."
      />
      <main className="page payment-page">
        <section className="content-panel payment-panel">
          {!state.loading && state.paid && !state.ready && state.reportStatus !== "FAILED" ? (
            <div className="payment-success-hero" aria-live="polite">
              <div className="payment-success-icon" aria-hidden="true">
                <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="40" cy="40" r="37" stroke="currentColor" strokeWidth="4" />
                  <path
                    d="M24 41.5 35 52.5 56 28.5"
                    stroke="currentColor"
                    strokeWidth="5.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h1>Payment Successful!</h1>
              <p className="payment-success-subtitle">Thank you! Your payment has been confirmed.</p>

              <div className="payment-status-card">
                <div className="payment-status-row">
                  <span className="payment-status-icon payment-status-icon-check" aria-hidden="true">✓</span>
                  <span>Payment verified</span>
                </div>
                <div className="payment-status-row">
                  <span className="payment-status-icon payment-status-icon-gear" aria-hidden="true">⚙️</span>
                  <span>AI report generation in progress</span>
                </div>
                <div className="payment-status-eta">Estimated time: 10–30 seconds</div>
              </div>

              <div className="payment-loading-ring" role="status" aria-label="Generating your report">
                <span className="sr-only">Generating your report…</span>
              </div>

              {delayed && (
                <p className="status-note">
                  Report generation is taking longer than usual. Keep this page open. Your download button will
                  appear as soon as processing completes.
                </p>
              )}

              <p className="payment-success-warning">
                Please don't close this page while we prepare your personalized AI report.
              </p>
            </div>
          ) : state.ready ? (
            <div className="payment-success-hero" aria-live="polite">
              <div className="payment-success-icon" aria-hidden="true">
                <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="40" cy="40" r="37" stroke="currentColor" strokeWidth="4" />
                  <path
                    d="M24 41.5 35 52.5 56 28.5"
                    stroke="currentColor"
                    strokeWidth="5.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h1>Your AI Report Is Ready!</h1>
              <p className="payment-success-subtitle">
                Your personalized AI sleep report has been successfully generated.
              </p>

              <div className="payment-status-card">
                <div className="payment-status-row">
                  <span className="payment-status-icon payment-status-icon-check" aria-hidden="true">✓</span>
                  <span>PDF generated</span>
                </div>
                <div className="payment-status-row">
                  <span className="payment-status-icon payment-status-icon-check" aria-hidden="true">✓</span>
                  <span>Payment confirmed</span>
                </div>
                <div className="payment-status-row">
                  <span
                    className={`payment-status-icon ${
                      state.emailSent ? "payment-status-icon-check" : "payment-status-icon-warning"
                    }`}
                    aria-hidden="true"
                  >
                    {state.emailSent ? "✓" : "!"}
                  </span>
                  <span>{state.emailSent ? "Email sent successfully" : "Email delivery pending"}</span>
                </div>
              </div>

              {state.emailError && (
                <p className="status-note warning">
                  Email delivery was not confirmed yet: {state.emailError}. Your download is still available below.
                </p>
              )}

              <div className="result-actions payment-ready-actions">
                <button className="primary-btn" onClick={handleDownloadPdf} disabled={state.isDownloading}>
                  {state.isDownloading ? "Downloading..." : "Download My AI Report"}
                </button>
                <a className="secondary-btn" href="/">
                  Return to Assessments
                </a>
              </div>

              {!state.emailSent && (
                <button
                  className="ghost-btn payment-resend-btn"
                  onClick={handleResendEmail}
                  disabled={state.isResendingEmail}
                >
                  {state.isResendingEmail ? "Resending..." : "Resend Email"}
                </button>
              )}

              {state.resendMessage && <p className="payment-success-note">{state.resendMessage}</p>}

              <p className="payment-success-note">A copy of your report has also been sent to your email.</p>
            </div>
          ) : (
            <>
              <div className="badge">Premium checkout</div>
              <h1>Your payment is confirmed</h1>
              <p>
                We are verifying fulfillment and preparing your personalized Premium PDF. This page updates
                automatically.
              </p>

              <div className="status-grid" aria-live="polite">
                <div className={`status-item ${state.loading ? "active" : "done"}`}>
                  <strong>Verifying payment</strong>
                  <span>{state.loading ? "In progress" : state.paid ? "Completed" : "Pending"}</span>
                </div>
                <div className={`status-item ${state.paid && !state.ready ? "active" : state.ready ? "done" : ""}`}>
                  <strong>Generating report</strong>
                  <span>{state.ready ? "Completed" : state.paid ? "In progress" : "Waiting for payment"}</span>
                </div>
                <div className={`status-item ${state.ready ? "done" : ""}`}>
                  <strong>Report ready</strong>
                  <span>{state.ready ? "Ready to download" : "Not ready yet"}</span>
                </div>
                <div
                  className={`status-item ${
                    state.ready && state.emailSent ? "done" : state.ready && !state.emailSent ? "attention" : ""
                  }`}
                >
                  <strong>Email delivery</strong>
                  <span>
                    {state.ready && state.emailSent
                      ? "Sent to your inbox"
                      : state.ready && !state.emailSent
                        ? "Download available, email needs retry"
                        : "Pending"}
                  </span>
                </div>
              </div>

              <div className="email-confirmation">
                <h2>Delivery email</h2>
                <p>{state.customerEmail || "Waiting for confirmation..."}</p>
              </div>

              {showRecoverableError && (
                <p className="status-note warning">
                  {state.error} You can refresh this page or contact support: aimindscore@gmail.com
                </p>
              )}

              <div className="result-actions">
                <a className="secondary-btn" href="/support">
                  Contact Support
                </a>
                <a className="ghost-btn" href="/">
                  Return Home
                </a>
              </div>
            </>
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function PaymentCancelledPage() {
  return (
    <>
      <SeoHead
        title="Payment Cancelled | MindScore AI"
        description="Your payment was cancelled. Return to your assessment when you are ready."
      />
      <main className="page payment-page">
        <section className="content-panel payment-panel">
          <div className="badge">Checkout update</div>
          <h1>Payment was cancelled</h1>
          <p>No charge was made. You can return to your assessment and continue whenever you are ready.</p>
          <a className="primary-btn" href="/">
            Return to Home
          </a>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function Homepage({ onStartAssessment }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("hero");
  const [areAssessmentCardsHighlighted, setAreAssessmentCardsHighlighted] = useState(false);
  const [showPremiumGuidanceMessage, setShowPremiumGuidanceMessage] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const guideToAssessments = () => {
    const section = document.getElementById("assessments");
    if (!section) return;

    setAreAssessmentCardsHighlighted(false);

    const triggerHighlight = () => {
      setAreAssessmentCardsHighlighted(true);
    };

    const rect = section.getBoundingClientRect();
    const isAlreadyVisible = rect.top <= window.innerHeight * 0.6 && rect.bottom >= window.innerHeight * 0.2;

    if (isAlreadyVisible) {
      window.setTimeout(triggerHighlight, 40);
    } else {
      const observer = new IntersectionObserver(
        (entries) => {
          const isVisible = entries.some((entry) => entry.isIntersecting);
          if (isVisible) {
            observer.disconnect();
            triggerHighlight();
          }
        },
        { threshold: 0.15 }
      );

      observer.observe(section);
      window.setTimeout(() => observer.disconnect(), 2200);
    }

    section.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 12);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const revealElements = document.querySelectorAll(".reveal");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.15,
      }
    );

    revealElements.forEach((element) => observer.observe(element));

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const sections = ["assessments", "how-it-works", "premium-report", "why-mindscore", "faq"];
    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries.find((entry) => entry.isIntersecting);
        if (visibleEntry?.target?.id) {
          setActiveSection(visibleEntry.target.id);
        }
      },
      { threshold: 0.42 }
    );

    sections.forEach((id) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!areAssessmentCardsHighlighted) return;

    const timeoutId = window.setTimeout(() => {
      setAreAssessmentCardsHighlighted(false);
    }, 460);

    return () => window.clearTimeout(timeoutId);
  }, [areAssessmentCardsHighlighted]);

  useEffect(() => {
    if (!showPremiumGuidanceMessage) return;

    const timeoutId = window.setTimeout(() => {
      setShowPremiumGuidanceMessage(false);
    }, 3200);

    return () => window.clearTimeout(timeoutId);
  }, [showPremiumGuidanceMessage]);

  return (
    <>
      <SeoHead
        title="Sleep Assessment | MindScore AI"
        description="Discover what your sleep is telling you in just 2 minutes using AI-powered sleep analysis."
      />
      <header className={`site-header ${isScrolled ? "header-scrolled" : ""}`}>
        <div className="brand-wrap">
          <a href="/" className="brand-link" aria-label="MindScore AI Home">
            <span className="brand-mark" aria-hidden="true">
              M
            </span>
            <span>MindScore AI</span>
          </a>
        </div>
        <nav className="site-nav" aria-label="Primary navigation">
          <a className={activeSection === "assessments" ? "active" : ""} href="#assessments">Sleep Assessment</a>
          <a className={activeSection === "how-it-works" ? "active" : ""} href="#how-it-works">How It Works</a>
          <a className={activeSection === "premium-report" ? "active" : ""} href="#premium-report">AI Report</a>
          <a className={activeSection === "faq" ? "active" : ""} href="#faq">FAQ</a>
          <a href="/support">Support</a>
        </nav>
        <span className="header-private"><span aria-hidden="true">L</span> 100% Private</span>
        <button className="header-cta header-cta-desktop" onClick={guideToAssessments}>Start Free Sleep Test</button>
      </header>

      <main className="homepage">
        <section className="hero-section reveal">
          <div className="hero-copy reveal">
            <p className="hero-label">AI-POWERED SLEEP ANALYSIS</p>
            <h1><span>Sleep</span><span>Assessment</span></h1>
            <p className="hero-subtitle">Discover what your sleep is telling you in just 2 minutes using our AI-powered sleep analysis.</p>
            <div className="hero-actions">
              <button className="primary-btn hero-primary-btn" onClick={() => onStartAssessment("sleep")}>Start Free Sleep Test</button>
            </div>
            <div className="hero-trust" aria-label="Assessment assurances">
              <span><i className="trust-icon lock-icon" aria-hidden="true" />🔒 100% Private</span>
              <span><i className="trust-icon bolt-icon" aria-hidden="true" />⚡ Instant Result</span>
              <span><i className="trust-icon user-icon" aria-hidden="true" />👤 No Signup</span>
            </div>
          </div>

          <aside className="hero-visual reveal" aria-label="Sleep analysis preview">
            <div className="hero-neural-brain" aria-hidden="true">
              <div className="particle-cloud">
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
              <div className="brain-orbit orbit-one" />
              <div className="brain-orbit orbit-two" />
              <div className="brain-orbit orbit-three" />

              <div className="brain-core">
                <span className="brain-core-label">AI</span>
              </div>
              <span className="brain-core-subtitle">Sleep Intelligence</span>
            </div>
          </aside>
        </section>

        <section className="section how-it-works-section reveal" id="assessments">
          <div className="section-heading">
            <h2 id="how-it-works">How It Works</h2>
            <p>One focused assessment, one instant result, one premium AI report.</p>
          </div>
          {showPremiumGuidanceMessage && (
            <p className="assessment-guidance-message" role="status" aria-live="polite">
              Complete a free assessment first to unlock your personalized Premium Report.
            </p>
          )}
          <div className="how-it-works-grid">
            <div className="compact-steps">
              <article><span className="step-icon" aria-hidden="true"><svg className="step-svg" viewBox="0 0 64 64" focusable="false"><rect x="17" y="15" width="30" height="39" rx="4" /><rect x="25" y="10" width="14" height="8" rx="3" /><path d="m23 29 3 3 6-7M34 29h8M23 39l3 3 6-7M34 39h8" /><path className="step-accent" d="m22 48 6 6 14-16" /></svg></span><div><h3>Choose Assessment</h3><p>Start your focused sleep check.</p></div></article>
              <article><span className="step-icon" aria-hidden="true"><svg className="step-svg" viewBox="0 0 64 64" focusable="false"><path d="M12 29c0-10 9-17 20-17s20 7 20 17-9 17-20 17c-3 0-6-.5-9-1.5L15 50l2-9c-3-3-5-7-5-12Z" /><path className="step-accent" d="M24 25c0-3 2-5 5-5s5 2 5 5-2 4-5 6c0 2 1 3 1 4M30 40h.1M38 25c0-3 2-5 5-5s5 2 5 5-2 4-5 6c0 2 1 3 1 4M44 40h.1" /></svg></span><div><h3>Answer 12 Questions</h3><p>Complete a science-based assessment in about 2 minutes.</p></div></article>
              <article><span className="step-icon" aria-hidden="true"><svg className="step-svg" viewBox="0 0 64 64" focusable="false"><rect x="13" y="12" width="38" height="40" rx="5" /><path d="M20 22h24M20 46h24" /><path className="step-accent" d="M20 39 27 32l6 4 10-12" /><path d="M20 28h3M26 28h3M32 28h3" /></svg></span><div><h3>Get Instant Result</h3><p>Receive your free sleep score immediately.</p></div></article>
            </div>
            <div className="step-arrow step-arrow-left" aria-hidden="true">›</div>
            <div className="step-arrow step-arrow-right" aria-hidden="true">›</div>
          </div>
        </section>

        <section className="section premium-section reveal" id="premium-report">
          <div className="section-heading">
            <h2>Premium PDF Report</h2>
          </div>
          <div className="premium-grid">
            <article className="premium-preview pdf-preview">
              <div className="reference-pdf-cards">
                <div className="pdf-page premium-cover-page">
                  <strong className="cover-score"><span className="cover-score-number">82</span><span className="cover-score-scale">/100</span></strong>
                  <span className="cover-progress-ring" aria-hidden="true" />
                  <span className="cover-score-label">SLEEP SCORE</span>
                  <span className="cover-overthinker-badge">OVERTHINKER</span>
                  <div className="cover-report-title"><span>Personalized</span><span>Sleep</span><span>Recovery</span><span>Report</span></div>
                  <span className="cover-ai-badge">PERSONALIZED PREMIUM REPORT</span>
                </div>
                <div className="pdf-page pdf-page-two">
                  <span>Sleep Cycle</span>
                  <div className="radar-wrap" aria-hidden="true">
                    <div className="radar-chart" />
                  </div>
                  <div className="pdf-score-bars">
                    <div><b /> <i style={{ width: "84%" }} /></div>
                    <div><b /> <i style={{ width: "71%" }} /></div>
                    <div><b /> <i style={{ width: "77%" }} /></div>
                  </div>
                </div>

                <div className="pdf-page pdf-page-three">
                  <span>Daytime Energy Insights</span>
                  <div className="energy-bars" aria-hidden="true"><i /><i /><i /><i /><i /></div>
                  <div className="recommendation-cards">
                    <article><strong>Actionable AI Recommendations</strong><p>Personalized guidance for better sleep.</p></article>
                  </div>
                </div>
              </div>
              <div className="pdf-caption-grid"><div><h3>Personalized Premium Report</h3><p>Your results, key sleep patterns, practical insights, and a clear action plan — personalized to your assessment.</p></div><div><h3>Detailed Growth Roadmap</h3><p>Understand your strongest areas, your main opportunity, and the practical steps that can improve your sleep routine.</p></div></div>
              <div className="secure-report-row"><span className="secure-report-icon" aria-hidden="true" /><div><h3>Secure &amp; Professional</h3><p>Your personalized premium report is delivered instantly after secure payment.</p></div></div>
            </article>
          </div>
        </section>

        {isPreviewOpen && (
          <div className="preview-modal" role="dialog" aria-modal="true" aria-labelledby="preview-modal-title">
            <div className="preview-modal-backdrop" onClick={() => setIsPreviewOpen(false)} />
            <div className="preview-modal-content">
              <div className="preview-modal-header">
                <div>
                  <p>Premium PDF preview</p>
                  <h2 id="preview-modal-title">Three-page report</h2>
                </div>
                <button className="preview-close-btn" type="button" aria-label="Close preview" onClick={() => setIsPreviewOpen(false)}>×</button>
              </div>
              <div className="preview-modal-pages">
                <div className="pdf-page premium-cover-page" />
                <div className="pdf-page pdf-page-two"><span>Page 2</span><h4>Sleep Signals</h4><div className="radar-wrap" aria-hidden="true"><div className="radar-chart" /></div><div className="pdf-score-bars"><div><b /> <i style={{ width: "84%" }} /></div><div><b /> <i style={{ width: "71%" }} /></div><div><b /> <i style={{ width: "77%" }} /></div></div></div>
                <div className="pdf-page pdf-page-three"><span>Page 3</span><h4>Sleep Plan</h4><div className="recommendation-cards"><article><strong>Focus</strong><p>Better habits</p></article><article><strong>Practice</strong><p>Deeper recovery</p></article><article><strong>Track</strong><p>Energy markers</p></article></div></div>
              </div>
            </div>
          </div>
        )}

        <section className="section faq-section reveal" id="faq">
          <div className="section-heading">
            <h2>Frequently Asked Questions</h2>
          </div>
          <div className="faq-list">
            {[faqItems[0], faqItems[1], faqItems[2], faqItems[4], faqItems[5]].map((item) => (
              <details key={item.question}>
                <summary>{item.question}</summary>
                <div className="faq-answer">
                  <p>{item.answer}</p>
                </div>
              </details>
            ))}
          </div>
        </section>
      </main>
      <footer className="site-footer homepage-footer" aria-label="Homepage footer">
        <div className="footer-grid">
          <div className="footer-col brand">
            <p className="footer-brand">MindScore AI</p>
            <p className="footer-note">
              Educational and informational self-assessment platform. Not medical diagnosis or treatment.
            </p>
          </div>

          <nav className="footer-col" aria-label="Privacy and terms">
            <p className="footer-col-title">Legal</p>
            <div className="site-footer-links">
              <a href="#faq">FAQ</a>
              <a href="/privacy">Privacy</a>
              <a href="/terms">Terms</a>
              <a href="/terms">Legal</a>
            </div>
          </nav>

          <nav className="footer-col" aria-label="Support contact">
            <p className="footer-col-title">Support</p>
            <div className="site-footer-links">
              <a href="/support">Support</a>
              <a href="mailto:aimindscore@gmail.com">aimindscore@gmail.com</a>
            </div>
          </nav>

          <div className="footer-col" aria-label="Copyright">
            <p className="footer-col-title">MindScore AI</p>
            <div className="site-footer-links">
              <span>(c) {new Date().getFullYear()}</span>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}

function AssessmentApp() {
  const [selectedTest, setSelectedTest] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [email, setEmail] = useState("");
  const [isCheckoutRedirecting, setIsCheckoutRedirecting] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [isEmailInvalid, setIsEmailInvalid] = useState(false);
  const [isAnswering, setIsAnswering] = useState(false);
  const [userAnswers, setUserAnswers] = useState([]);
  const [_completedAssessment, setCompletedAssessment] = useState(null);

  const test = selectedTest ? tests[selectedTest] : null;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(COMPLETED_ASSESSMENT_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw);
      if (!parsed?.selectedTest || !tests[parsed.selectedTest]) return;

      const testLength = tests[parsed.selectedTest].questions.length;
      if (!Array.isArray(parsed.userAnswers) || parsed.userAnswers.length !== testLength) return;

      setCompletedAssessment({
        selectedTest: parsed.selectedTest,
        userAnswers: parsed.userAnswers,
      });
    } catch {
      window.localStorage.removeItem(COMPLETED_ASSESSMENT_KEY);
    }
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (!draft?.selectedTest || !tests[draft.selectedTest]) return;

      setSelectedTest(draft.selectedTest);
      const testLength = tests[draft.selectedTest].questions.length;
      const restoredAnswers = Array.isArray(draft.userAnswers)
        ? draft.userAnswers.map((answer) => (Number.isFinite(answer) && answer >= 1 && answer <= 5 ? answer : null))
        : [];
      setCurrentQuestion(Math.min(testLength, Math.max(0, Number(draft.currentQuestion) || 0)));
      setUserAnswers(restoredAnswers.slice(0, testLength));
      setEmail(typeof draft.email === "string" ? draft.email : "");
    } catch {
      window.localStorage.removeItem(DRAFT_KEY);
    }
  }, []);

  useEffect(() => {
    if (!selectedTest) {
      window.localStorage.removeItem(DRAFT_KEY);
      return;
    }

    const draft = {
      selectedTest,
      currentQuestion,
      userAnswers,
      email,
    };
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [selectedTest, currentQuestion, userAnswers, email]);

  useEffect(() => {
    if (!selectedTest || !test) return;

    const isCompleted =
      currentQuestion === test.questions.length &&
      Array.isArray(userAnswers) &&
      userAnswers.length === test.questions.length;

    if (!isCompleted) return;

    const payload = {
      selectedTest,
      userAnswers,
      completedAt: new Date().toISOString(),
    };

    window.localStorage.setItem(COMPLETED_ASSESSMENT_KEY, JSON.stringify(payload));
    setCompletedAssessment({
      selectedTest,
      userAnswers,
    });
  }, [selectedTest, test, currentQuestion, userAnswers]);

  const score = useMemo(() => userAnswers.reduce((sum, value) => sum + (Number(value) || 0), 0), [userAnswers]);

  const dashboardScores = useMemo(
    () => (selectedTest && userAnswers.length > 0 ? calculateDimensions(userAnswers, selectedTest) : []),
    [selectedTest, userAnswers]
  );

  // Sleep uses a dedicated 0-100 scoring engine (reverse-scored negative statements);
  // every other test keeps the original points-based percentage formula.
  const finalScore = useMemo(() => {
    if (!test) return 0;
    if (selectedTest === "sleep") {
      const answerIndexes = userAnswers.map((points) => 5 - Number(points));
      return calculateSleepScore(answerIndexes);
    }
    return Math.round((score / (test.questions.length * 5)) * 100);
  }, [selectedTest, test, userAnswers, score]);

  // AI Sleep Profile / Subtype / Confidence, derived purely from the answer pattern.
  const sleepAIResult = useMemo(() => {
    if (selectedTest !== "sleep" || userAnswers.length === 0) return null;
    const answerIndexes = userAnswers.map((points) => 5 - Number(points));
    return calculateSleepResult(answerIndexes);
  }, [selectedTest, userAnswers]);

  const startTest = (key) => {
    setSelectedTest(key);
    setCurrentQuestion(0);
    setEmail("");
    setCheckoutError("");
    setIsCheckoutRedirecting(false);
    setIsAnswering(false);
    setUserAnswers([]);
  };

  const restart = () => {
    setSelectedTest(null);
    setCurrentQuestion(0);
    setEmail("");
    setCheckoutError("");
    setIsCheckoutRedirecting(false);
    setIsAnswering(false);
    setUserAnswers([]);
  };

  const answerQuestion = (points) => {
    if (!test || isAnswering) return;
    setIsAnswering(true);

    setUserAnswers((previous) => {
      const next = [...previous];
      next[currentQuestion] = points;
      return next;
    });

    window.setTimeout(() => {
      setCurrentQuestion((previousQuestion) => {
        if (previousQuestion < test.questions.length - 1) {
          return previousQuestion + 1;
        }
        return test.questions.length;
      });
      setIsAnswering(false);
    }, 160);
  };

  const goBackQuestion = () => {
    setCheckoutError("");
    setCurrentQuestion((previous) => Math.max(0, previous - 1));
  };

  const getLevel = (finalScore) => {
    if (finalScore >= 85) return "Strong and consistent profile";
    if (finalScore >= 70) return "Healthy baseline with growth opportunities";
    if (finalScore >= 50) return "Developing foundation";
    return "Early growth stage";
  };

  const getSummary = (finalScore) => {
    if (finalScore >= 80) {
      return {
        strengths: "You show consistent self-regulation, focus and recovery under pressure.",
        improve: "Continue refining routines to keep this level stable in high-demand periods.",
        recommendation: "Use the premium plan to translate strengths into a long-term performance strategy.",
      };
    }
    if (finalScore >= 60) {
      return {
        strengths: "You have a solid base and clear signs of resilience in everyday demands.",
        improve: "Your consistency may drop in prolonged stress or uncertainty.",
        recommendation: "Structured weekly habits can raise your reliability and confidence quickly.",
      };
    }
    return {
      strengths: "You show useful self-awareness and potential for meaningful progress.",
      improve: "Current stress patterns may be reducing clarity, energy or emotional balance.",
      recommendation: "Start with focused routines and monitor improvement using clear milestones.",
    };
  };

  const startPremiumCheckout = async () => {
    try {
      setCheckoutError("");
      setIsEmailInvalid(false);

      if (!test) throw new Error("Assessment state is missing.");

      if (!email || !/.+@.+\..+/.test(email.trim())) {
        setIsEmailInvalid(true);
        throw new Error("Please enter a valid email address before checkout.");
      }

      const profileDimensions =
        dashboardScores.length > 0 ? dashboardScores : calculateDimensions(userAnswers, selectedTest);

      setIsCheckoutRedirecting(true);
      const checkoutSessionUrl = apiUrl(`${API_BASE}/create-checkout-session`);

      const response = await fetch(checkoutSessionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerEmail: email.trim(),
          assessmentType: selectedTest || test.title,
          testName: test.title,
          score: finalScore,
          answers: userAnswers,
          dimensions: profileDimensions,
        }),
      });

      const rawBody = await response.text();
      const data = rawBody ? JSON.parse(rawBody) : {};

      if (!response.ok) throw new Error(data.error || "Unable to create checkout session.");
      if (!data.url) throw new Error("Stripe checkout URL is missing.");

      window.location.href = data.url;
    } catch (error) {
      setCheckoutError(error.message || "Checkout failed.");
      setIsCheckoutRedirecting(false);
    }
  };

  if (!selectedTest) {
    return (
      <Homepage
        onStartAssessment={startTest}
      />
    );
  }

  if (!test) {
    return (
      <main className="page">
        <section className="content-panel">
          <h1>Assessment unavailable</h1>
          <button className="primary-btn" onClick={restart}>
            Return Home
          </button>
        </section>
      </main>
    );
  }

  if (currentQuestion === test.questions.length) {
    const isSleepResult = selectedTest === "sleep" && sleepAIResult;
    const resultLevel = getLevel(finalScore);
    const summary = getSummary(finalScore);
    const strongestDimension =
      dashboardScores.length > 0
        ? [...dashboardScores].sort((a, b) => Number(b.score) - Number(a.score))[0]
        : null;
    const growthDimension =
      dashboardScores.length > 0
        ? [...dashboardScores].sort((a, b) => Number(a.score) - Number(b.score))[0]
        : null;

    return (
      <>
        <SeoHead
          title={`${test.title} Results | MindScore AI`}
          description="View your free assessment results and unlock a personalized premium report."
        />
        <main className="page assessment-page">
          <section className="content-panel result-panel">
            <div className="result-head">
              <div className="badge">Free result</div>
              <h1>{test.title} Results</h1>
              {!isSleepResult && <p>{resultLevel}</p>}
            </div>

            {isSleepResult ? (
              <div className="sleep-hero">
                <div
                  className="sleep-hero-circle"
                  role="img"
                  aria-label={`Overall score ${finalScore} out of 100`}
                >
                  <span className="sleep-hero-score">{finalScore}</span>
                  <span className="sleep-hero-max">/100</span>
                </div>
                <h2 className="sleep-hero-profile">{sleepAIResult.profile}</h2>
                <p className="sleep-hero-subtitle">Your AI Sleep Profile</p>
              </div>
            ) : (
              <div className="score-card">
                <div
                  className="score-circle"
                  role="img"
                  aria-label={`Overall score ${finalScore} out of 100`}
                >
                  <span>{finalScore}</span>
                  <small>/100</small>
                </div>
                <div className="score-copy">
                  <h2>Overall Score</h2>
                  <p>{summary.strengths}</p>
                </div>
              </div>
            )}

            {isSleepResult ? (
              <>
                <div className="ai-insight-grid">
                  <article className="ai-insight-card">
                    <span className="ai-insight-icon" aria-hidden="true">🧠</span>
                    <h3>AI Sleep Profile</h3>
                    <p>{sleepAIResult.profile}</p>
                  </article>
                  <article className="ai-insight-card">
                    <span className="ai-insight-icon" aria-hidden="true">🧩</span>
                    <h3>AI Subtype</h3>
                    <p>{sleepAIResult.subtype}</p>
                  </article>
                  <article className="ai-insight-card">
                    <span className="ai-insight-icon" aria-hidden="true">🎯</span>
                    <h3>AI Confidence</h3>
                    <p>{sleepAIResult.confidence}% Match</p>
                  </article>
                  <article className="ai-insight-card">
                    <span className="ai-insight-icon" aria-hidden="true">💪</span>
                    <h3>Strongest Pattern</h3>
                    <p>{strongestDimension ? strongestDimension.name : "Not enough data yet"}</p>
                  </article>
                  <article className="ai-insight-card ai-insight-card-full ai-insight-card-compact">
                    <span className="ai-insight-icon" aria-hidden="true">🚀</span>
                    <h3>Biggest Opportunity</h3>
                    <p>{growthDimension ? growthDimension.name : "Not enough data yet"}</p>
                  </article>
                  <article className="ai-teaser-card ai-insight-card-full">
                    <h3>🧠 AI Insight</h3>
                    <p>
                      Our AI detected one hidden sleep pattern that may be reducing your recovery more than any
                      other factor.
                    </p>
                    <p className="ai-teaser-cta">Unlock Premium to reveal it.</p>
                  </article>
                </div>

                <section className="premium-preview-panel" aria-label="Premium preview">
                  <div className="analytics-heading">
                    <p className="analytics-label">Premium preview</p>
                    <h2>Your AI Report Is Ready</h2>
                  </div>

                  <div className="premium-locked-cards">
                    {PREMIUM_INSIGHT_CARDS.map((title, index) => (
                      <article
                        className={index === 0 ? "premium-locked-card premium-locked-card-blurred" : "premium-locked-card"}
                        key={title}
                      >
                        <span className="premium-locked-icon" aria-hidden="true">🔒</span>
                        <div className="premium-locked-copy">
                          <h3>{title}</h3>
                          <p>Hidden AI analysis</p>
                        </div>
                      </article>
                    ))}
                  </div>

                  <div className="premium-checklist-card">
                    <div className="premium-checklist-header">
                      <h3>🔥 One hidden sleep pattern detected</h3>
                      <p>Your biggest opportunity for improvement</p>
                    </div>
                    <ul>
                      {PREMIUM_REPORT_CHECKLIST.map((item) => (
                        <li key={item}>✓ {item}</li>
                      ))}
                    </ul>
                  </div>
                </section>
              </>
            ) : (
              <>
                <div className="result-insights">
                  <article>
                    <h3>Key strengths</h3>
                    <p>{strongestDimension ? `${strongestDimension.name}: ${strongestDimension.score}/100.` : summary.strengths}</p>
                  </article>
                  <article>
                    <h3>Areas to improve</h3>
                    <p>{growthDimension ? `${growthDimension.name}: ${growthDimension.score}/100.` : summary.improve}</p>
                  </article>
                  <article>
                    <h3>Short recommendation</h3>
                    <p>{summary.recommendation}</p>
                  </article>
                </div>

                {dashboardScores.length > 0 && <AnalyticsDashboard data={dashboardScores} />}
              </>
            )}

            <section className="premium-cta-panel" aria-label="Premium report offer">
              <div className="premium-cta-copy">
                <h2>Unlock Your Premium Report</h2>
                <p>
                  One-time payment of EUR {PREMIUM_PRICE_EUR}. Includes personalized AI interpretation, actionable
                  recommendations, downloadable PDF, and email delivery.
                </p>
                <ul>
                  <li>Exact price: EUR {PREMIUM_PRICE_EUR}</li>
                  <li>One-time payment, no subscription</li>
                  <li>Immediate PDF availability after payment verification</li>
                  <li>Email delivery included</li>
                  <li>Secure checkout powered by Stripe</li>
                </ul>
              </div>
              <div className="premium-cta-form">
                {isSleepResult && (
                  <div className="premium-trust-badges">
                    {PREMIUM_TRUST_BADGES.map((badge) => (
                      <span key={badge.label}>
                        {badge.icon} {badge.label}
                      </span>
                    ))}
                  </div>
                )}
                {isSleepResult && (
                  <div className="premium-price-block">
                    <p>One-time payment</p>
                    <strong>€{PREMIUM_PRICE_EUR}</strong>
                    <p>No subscription</p>
                  </div>
                )}
                <label htmlFor="report-email">Email for secure report delivery</label>
                <input
                  id="report-email"
                  type="email"
                  value={email}
                  placeholder="name@example.com"
                  aria-invalid={isEmailInvalid}
                  aria-describedby={isEmailInvalid ? "report-email-error" : undefined}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setIsEmailInvalid(false);
                  }}
                />
                <button
                  className={isSleepResult ? "primary-btn premium-unlock-btn" : "primary-btn"}
                  onClick={startPremiumCheckout}
                  disabled={isCheckoutRedirecting}
                >
                  {isCheckoutRedirecting
                    ? "Redirecting to secure checkout..."
                    : isSleepResult
                    ? "Unlock My Complete AI Report"
                    : "Unlock Premium Report"}
                </button>
                {isSleepResult && (
                  <p className="premium-trust-line">
                    Used by people who want to truly understand their sleep instead of guessing.
                  </p>
                )}
                {checkoutError && (
                  <p className="inline-error" id="report-email-error" role="alert">
                    {checkoutError}
                  </p>
                )}
                <p className="support-line">Questions? aimindscore@gmail.com</p>
              </div>
            </section>

            <div className="result-actions">
              <button className="secondary-btn" onClick={restart}>
                Back to all assessments
              </button>
            </div>
          </section>
        </main>
        <SiteFooter />
      </>
    );
  }

  const progress = ((currentQuestion + 1) / test.questions.length) * 100;
  const selectedOption = userAnswers[currentQuestion];

  return (
    <>
      <SeoHead
        title={`${test.title} Assessment | MindScore AI`}
        description="Complete your assessment with a clear, mobile-friendly questionnaire and progress tracking."
      />
      <main className="page assessment-page quiz-active">
        <section className="content-panel quiz-panel">
          <nav className="quiz-nav-row" aria-label="Assessment navigation">
            <button
              type="button"
              className="quiz-nav-btn quiz-nav-back"
              onClick={goBackQuestion}
              disabled={currentQuestion === 0 || isAnswering}
            >
              <span aria-hidden="true">←</span> Back
            </button>
            <button type="button" className="quiz-nav-btn quiz-nav-home" onClick={restart}>
              <span aria-hidden="true">🏠</span> Home
            </button>
          </nav>

          <div className="quiz-top">
            <span>
              Question {currentQuestion + 1} of {test.questions.length}
            </span>
            <span>{Math.round(progress)}%</span>
          </div>

          <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>

          <h1 className="question-title">{test.questions[currentQuestion]}</h1>

          <div className="answers" role="group" aria-label="Answer options">
            {answers.map((item) => {
              const isSelected = selectedOption === item.points;
              return (
                <button
                  key={item.text}
                  onClick={() => answerQuestion(item.points)}
                  disabled={isAnswering}
                  className={isSelected ? "selected" : ""}
                  aria-pressed={isSelected}
                >
                  <strong>{item.text}</strong>
                </button>
              );
            })}
          </div>

          {isAnswering && <p className="micro-status">Saving answer...</p>}
        </section>
      </main>
    </>
  );
}

function App() {
  const pathname = window.location.pathname;

  if (pathname === "/privacy") {
    return <PrivacyPolicyPage />;
  }

  if (pathname === "/terms") {
    return <TermsOfServicePage />;
  }

  if (pathname === "/support") {
    return <SupportPage />;
  }

  if (pathname === "/payment-success") {
    return <PaymentSuccessPage />;
  }

  if (pathname === "/payment-cancelled") {
    return <PaymentCancelledPage />;
  }

  return <AssessmentApp />;
}

export default App;