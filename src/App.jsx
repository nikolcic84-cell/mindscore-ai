import { useEffect, useMemo, useRef, useState } from "react";
import AnalyticsDashboard from "./AnalyticsDashboard";
import { calculateDimensions } from "./psychology/dimensions";
import { SLEEP_ANSWER_OPTIONS, SLEEP_QUESTIONS } from "./psychology/sleepAssessmentContent";
import { calculateSleepScore } from "./psychology/sleepScoring";
import { buildFreeModuleView } from "./psychology/sleepFreeModuleView";
import { getSleepFreeResultPresentation } from "./psychology/sleepFreeResult";
import sleepContentLibrary from "./psychology/sleep_content_library_44.json";
import { selectSleepContentModules } from "./psychology/sleepContentModuleSelector";
import { formatConfiguredEurPrice, getSleepPremiumBenefits } from "./psychology/sleepPremiumOffer";
import { calculateSleepSignature } from "./psychology/sleepSignature";
import PremiumResult, { parsePremiumModuleText } from "./components/PremiumResult";
import "./App.css";

const BACKEND_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");
const API_BASE = "/api";
const LEGAL_LAST_UPDATED = "July 24, 2026";
const PREMIUM_PRICE_EUR = "9.99";
const SLEEP_PREMIUM_DISPLAY_PRICE_EUR = "9.99";
const DRAFT_KEY = "mindscore_assessment_draft_v2";
const COMPLETED_ASSESSMENT_KEY = "mindscore_completed_assessment_v1";

const apiUrl = (path) => (/^https?:\/\//i.test(path) ? path : `${BACKEND_URL}${path}`);

async function beginSleepContentCheckout(customerEmail, answers) {
  const response = await fetch(apiUrl(`${API_BASE}/create-checkout-session`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerEmail,
      assessmentType: "sleep",
      purchaseType: "sleep-content-unlock",
      testName: "Sleep Quality",
      answers,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.url) throw new Error(data.error || "Plaćanje trenutno nije moguće. Pokušaj ponovo.");
  window.location.assign(data.url);
}

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
    questions: SLEEP_QUESTIONS,
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

const sleepAnswerOptions = SLEEP_ANSWER_OPTIONS;
const toSleepAnswerOptions = (pointsAnswers) => {
  if (!Array.isArray(pointsAnswers) || pointsAnswers.length !== SLEEP_ANSWER_OPTIONS.length) return null;
  const options = pointsAnswers.map((points, index) =>
    SLEEP_ANSWER_OPTIONS[index].findIndex((option) => option.points === points) + 1);
  return options.every((option) => option > 0) ? options : null;
};
const isValidSleepAnswers = (values) => Array.isArray(values) && values.length === SLEEP_ANSWER_OPTIONS.length &&
  values.every((points) => Number.isInteger(points) && points >= 1 && points <= 5);

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
  const { userAnswers: savedSleepAnswers } = useSavedSleepAssessment();
  const sleepModuleAnswers = useMemo(() => toSleepAnswerOptions(savedSleepAnswers), [savedSleepAnswers]);
  const [showContentResult, setShowContentResult] = useState(false);
  const accessToken = new URLSearchParams(window.location.search).get("unlock") || "";
  const [state, setState] = useState({
    loading: true,
    status: "PAYMENT_VERIFIED",
    assessmentType: "",
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
    acceptedAnalysis: null,
    contentPurchase: Boolean(new URLSearchParams(window.location.search).get("unlock")),
    contentUnlocked: false,
    contentAnswers: null,
    premiumLoading: false,
    premiumError: "",
    attempts: 0,
    error: "",
  });

  const sessionId = new URLSearchParams(window.location.search).get("session_id") || "";

  useEffect(() => {
    let cancelled = false;
    let timerId = null;
    let verificationAttempts = 0;

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
        const url = accessToken ? `${verifySessionUrl}?unlock=${encodeURIComponent(accessToken)}` : verifySessionUrl;
        const response = await fetch(apiUrl(url), { cache: "no-store" });
        const rawBody = await response.text();
        const data = rawBody ? JSON.parse(rawBody) : {};
        verificationAttempts += 1;

        if (!response.ok) {
          throw new Error(data.error || "Payment verification failed.");
        }

        if (cancelled) return;

        const reportStatus = data.reportStatus || "unknown";
        const generationFailed = data.status === "FAILED" || reportStatus === "FAILED";
        const contentPurchase = data.purchaseType === "sleep-content-unlock";

        setState((previous) => ({
          ...previous,
          loading: false,
          status: data.status || previous.status,
          assessmentType: data.assessmentType || previous.assessmentType,
          paid: Boolean(data.paid),
          contentPurchase: previous.contentPurchase || contentPurchase,
          contentUnlocked: Boolean(data.contentUnlocked),
          contentAnswers: Array.isArray(data.answers) ? data.answers : null,
          ready: Boolean(data.ready),
          reportStatus,
          customerEmail: data.customerEmail || "",
          downloadUrl: data.downloadUrl || "",
          emailSent: Boolean(data.emailSent),
          emailError: data.emailError || "",
          attempts: previous.attempts + 1,
          error: generationFailed ? data.error || "Report generation failed." : "",
        }));

        if (data.paid && !data.contentUnlocked && !generationFailed && verificationAttempts < 12 &&
          (!data.ready || (!data.emailSent && !data.emailError))) {
          timerId = window.setTimeout(verify, 1000);
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
      const fallbackFileName = state.assessmentType === "sleep"
        ? "MindScore-AI-Premium-Sleep-Report.pdf"
        : "MindScore-AI-Premium-Report.pdf";
      const fileName = decodeURIComponent(nameMatch?.[1] || fallbackFileName);

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
      setState((previous) => ({ ...previous, resendMessage: "Slanje ponovo trenutno nije moguće. Pokušaj ponovo." }));
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
          ? "Izveštaj je ponovo poslat na tvoj email."
          : "Slanje emaila trenutno nije uspelo. PDF možeš preuzeti ispod.",
      }));
    } catch {
      setState((previous) => ({
        ...previous,
        resendMessage: "Slanje emaila trenutno nije uspelo. Pokušaj ponovo.",
      }));
    } finally {
      setState((previous) => ({ ...previous, isResendingEmail: false }));
    }
  };

  const delayed = state.paid && !state.ready && state.attempts >= 6;
  const showRecoverableError = !state.loading && !state.ready && Boolean(state.error);
  const isSleepPurchase = state.assessmentType === "sleep";
  const sleepReportFailed = state.reportStatus === "FAILED" || state.status === "FAILED";
  const sleepEmailFailed = state.ready && !state.emailSent && Boolean(state.emailError);

  if (state.contentPurchase) {
    if (state.contentUnlocked && isSleepPurchase && state.contentAnswers?.length === 12) {
      if (showContentResult) {
        return <PremiumResult
          answers={toSleepAnswerOptions(state.contentAnswers)}
          onHome={() => window.location.assign("/")}
        />;
      }
      return (
        <main className="sleep-payment-page">
          <section className="sleep-payment-card sleep-content-unlocked-card" aria-live="polite">
            <h1>Plaćanje je uspešno.</h1>
            <p>Tvoja kompletna priča o snu je otključana.</p>
            <button className="sleep-payment-primary" type="button" onClick={() => setShowContentResult(true)}>
              OTVORI KOMPLETAN REZULTAT →
            </button>
          </section>
        </main>
      );
    }
    return (
      <main className="sleep-payment-page">
        <section className="sleep-payment-card sleep-content-unlocked-card" aria-live="polite">
          <h1>{state.loading ? "Proveravamo uplatu" : state.paid ? "Uplata je evidentirana" : "Plaćanje još nije potvrđeno"}</h1>
          <p>{state.loading
            ? "Proveravamo Stripe sesiju i vezu sa tvojim rezultatom."
            : state.paid
              ? "Nismo uspeli da potvrdimo pristup rezultatu. Proveri povratni link ili pokušaj ponovo."
              : "Premium rezultat se otključava tek nakon potvrde uplate od strane Stripe-a."}</p>
          {state.error && <p className="sleep-payment-error" role="alert">Proveru trenutno nije moguće završiti. Pokušaj ponovo da otvoriš Stripe povratni link.</p>}
          <a className="sleep-payment-secondary" href="/">Nazad na moj rezultat</a>
        </section>
      </main>
    );
  }

  return (
    <>
      <SeoHead
        title={isSleepPurchase ? "Tvoja priča o snu" : "Payment Success | MindScore AI"}
        description={isSleepPurchase
          ? "Proveri status pripreme i dostave svog personalizovanog izveštaja o snu."
          : "Verify payment, generate your premium report, and download your PDF securely."}
      />
      <main className={isSleepPurchase
        ? `sleep-payment-page${state.acceptedAnalysis ? " premium-v2-payment-page" : ""}`
        : "page payment-page"}>
        {isSleepPurchase ? (
          <section className={`sleep-payment-card${state.acceptedAnalysis ? " sleep-payment-card-report premium-v2-payment-card" : ""}`} aria-live="polite">
            {!state.acceptedAnalysis && <>
              <header className="sleep-experience-brand" aria-label="Payment status">
                <span className="sleep-brand-mark" aria-hidden="true">✦</span>
                <span>PLAĆENI REZULTAT</span>
              </header>
              <p className="sleep-payment-kicker">
                {state.paid ? "UPLATA JE USPEŠNA" : state.loading ? "PROVERAVAMO UPLATU" : "STATUS UPLATE"}
              </p>
              <h1>
                {sleepReportFailed
                  ? "Uplata je potvrđena"
                  : state.ready
                  ? "TVOJA PRIČA O SNU JE OTKLJUČANA"
                  : state.paid
                  ? "TVOJA PRIČA O SNU JE OTKLJUČANA"
                  : "Proveravamo uplatu"}
              </h1>
              <p className="sleep-payment-subtitle">
                {state.emailSent
                  ? "Izveštaj je poslat na tvoj email."
                  : state.ready
                  ? "Tvoj rezultat je spreman."
                  : sleepReportFailed
                  ? "Uplata je evidentirana, ali priprema rezultata trenutno nije uspela. Kontaktiraj podršku za pomoć."
                  : state.paid
                  ? "Hvala ti. Tvoj rezultat se priprema."
                  : "Sačekaj trenutak dok proverimo status tvoje uplate."}
              </p>

              <div className="sleep-payment-steps">
              <div className={`sleep-payment-step ${state.paid ? "is-done" : state.loading ? "is-active" : ""}`}>
                <span aria-hidden="true">{state.paid ? "✓" : state.loading ? "·" : "!"}</span>
                <p>{state.paid ? "Uplata uspešno izvršena" : "Proveravamo uplatu"}</p>
              </div>
              <div className={`sleep-payment-step ${sleepReportFailed ? "is-error" : state.ready ? "is-done" : state.paid ? "is-active" : ""}`}>
                <span aria-hidden="true">{sleepReportFailed ? "!" : state.ready ? "✓" : state.paid ? "◌" : "·"}</span>
                <p>{sleepReportFailed ? "Priprema izveštaja nije uspela" : state.ready ? "Tvoja analiza je spremna" : "Tvoja analiza se priprema"}</p>
              </div>
              <div className={`sleep-payment-step ${sleepEmailFailed || sleepReportFailed ? "is-error" : state.emailSent ? "is-done" : state.ready ? "is-active" : ""}`}>
                <span aria-hidden="true">{sleepEmailFailed || sleepReportFailed ? "!" : state.emailSent ? "✓" : state.ready ? "◌" : "·"}</span>
                <p>{sleepEmailFailed
                  ? "Slanje emaila nije potvrđeno"
                  : sleepReportFailed
                  ? "PDF izveštaj još nije spreman za slanje"
                  : state.emailSent
                  ? "PDF izveštaj je poslat na tvoj email"
                  : "PDF izveštaj šaljemo na tvoj email"}</p>
              </div>
              </div>

              {state.paid && !state.ready && !sleepReportFailed && (
                <p className="sleep-payment-processing" role="status">Pripremamo tvoj rezultat...</p>
              )}
              {state.ready && <p className="sleep-payment-spam-note">Proveri i Spam/Neželjenu poštu ako poruka ne stigne u Inbox.</p>}
              {state.ready && state.emailError && <p className="sleep-payment-delivery-warning">Email nije potvrđen.</p>}
              {state.premiumLoading && <p className="sleep-premium-report-status" role="status">Otvaramo tvoju priču o snu…</p>}
              {state.premiumError && <p className="sleep-payment-error" role="alert">{state.premiumError}</p>}
            </>}

            {state.ready && !state.acceptedAnalysis && (
              <div className="sleep-payment-actions">
                <button className="sleep-payment-primary" onClick={handleDownloadPdf} disabled={state.isDownloading}>
                  {state.isDownloading ? "Preuzimanje..." : "Preuzmi PDF izveštaj ↓"}
                </button>
                {!state.emailSent && (
                  <button className="sleep-payment-secondary" onClick={handleResendEmail} disabled={state.isResendingEmail}>
                    {state.isResendingEmail ? "Šaljemo..." : "Pokušaj ponovo da pošalješ email"}
                  </button>
                )}
              </div>
            )}

            {state.acceptedAnalysis && (
              <PremiumResult
                answers={sleepModuleAnswers}
                acceptedAnalysis={state.acceptedAnalysis}
                onHome={() => window.location.assign("/")}
              />
            )}

            {state.ready && state.acceptedAnalysis && (
              <div className="premium-v2-existing-file-actions">
                <p>PDF izveštaj je dostupan i dalje možeš ga preuzeti.</p>
                <button className="sleep-payment-primary" onClick={handleDownloadPdf} disabled={state.isDownloading}>
                  {state.isDownloading ? "Preuzimanje..." : "Preuzmi PDF izveštaj ↓"}
                </button>
                {!state.emailSent && (
                  <button className="sleep-payment-secondary" onClick={handleResendEmail} disabled={state.isResendingEmail}>
                    {state.isResendingEmail ? "Šaljemo..." : "Pokušaj ponovo da pošalješ email"}
                  </button>
                )}
                {state.resendMessage && !state.emailSent && <p>{state.resendMessage}</p>}
              </div>
            )}

            {state.resendMessage && !state.emailSent && !state.acceptedAnalysis && <p className="sleep-payment-note">{state.resendMessage}</p>}
            {showRecoverableError && !state.acceptedAnalysis && (
              <p className="sleep-payment-error" role="alert">
                Nismo uspeli da potvrdimo uplatu ili pripremimo izveštaj. Osveži stranicu ili kontaktiraj podršku.
              </p>
            )}
            {delayed && !state.acceptedAnalysis && <p className="sleep-payment-note">Priprema traje duže nego obično. Ova stranica će se sama ažurirati.</p>}
          </section>
        ) : (
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
        )}
      </main>
      {!isSleepPurchase && <SiteFooter />}
    </>
  );
}

function PaymentCancelledPage() {
  const returnToSleepCheckout = new URLSearchParams(window.location.search).get("return_to") === "/sleep-checkout";
  const contentUnlock = new URLSearchParams(window.location.search).get("unlock");

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
          <a className="primary-btn" href={contentUnlock
            ? `/?checkout=cancelled&unlock=${encodeURIComponent(contentUnlock)}`
            : returnToSleepCheckout ? "/sleep-checkout" : "/"}>
            {returnToSleepCheckout ? "Nazad na plaćanje" : "Return to Home"}
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
        title="Tvoja priča o snu"
        description="Za dva minuta odgovori na 12 pitanja i upoznaj svoj obrazac sna."
      />
      <header className={`site-header ${isScrolled ? "header-scrolled" : ""}`}>
        <div className="brand-wrap">
          <a href="/" className="brand-link" aria-label="Tvoja priča o snu">
            <span className="brand-mark" aria-hidden="true">
              T
            </span>
            <span>Tvoja priča o snu</span>
          </a>
        </div>
      </header>

      <main className="homepage">
        <section className="hero-section reveal">
          <div className="hero-copy reveal">
            <h1>UPOZNAJ SVOJ SAN</h1>
            <p className="hero-subtitle">Kako zaista spavaš?</p>
            <p className="hero-detail">Za 2 minuta otkrij šta tvoje navike govore o tvom snu.</p>
            <div className="hero-actions">
              <button className="primary-btn hero-primary-btn" onClick={() => onStartAssessment("sleep")}>
                POKRENI BESPLATAN TEST →
              </button>
            </div>
            <div className="hero-trust" aria-label="Assessment assurances">
              <span>🔒 Privatno</span>
              <span>⚡ Rezultat odmah</span>
              <span>👤 Bez registracije</span>
            </div>
          </div>
        </section>

      </main>
    </>
  );
}

function SleepSignatureResultPage({ signatureResult, answerPoints, onRestart, onCheckout, checkoutCancelled = false }) {
  const presentation = getSleepFreeResultPresentation(signatureResult, answerPoints);
  const answerOptions = toSleepAnswerOptions(answerPoints);
  const moduleSelection = answerOptions ? selectSleepContentModules(answerOptions, sleepContentLibrary) : null;
  const selectedModules = moduleSelection?.profile === signatureResult?.signature ? moduleSelection.modules : [];
  const freeModuleView = buildFreeModuleView(selectedModules, parsePremiumModuleText);
  const [customerEmail, setCustomerEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);

  const handleContentUnlock = async () => {
    setEmailError("");
    setCheckoutError("");
    const trimmedEmail = customerEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(trimmedEmail)) {
      setEmailError("Unesi ispravnu email adresu.");
      return;
    }
    if (!Array.isArray(answerPoints) || answerPoints.length !== 12 || typeof onCheckout !== "function") {
      setCheckoutError("Odgovori nisu dostupni. Ponovi test pa pokušaj ponovo.");
      return;
    }

    setIsCheckoutLoading(true);
    try {
      await onCheckout(trimmedEmail);
    } catch (error) {
      setCheckoutError(error.message || "Plaćanje trenutno nije moguće. Pokušaj ponovo.");
      setIsCheckoutLoading(false);
    }
  };

  return (
    <>
      <SeoHead
        title="Tvoja priča o snu"
        description="Pogledaj svoj lični potpis sna i šta se najviše izdvaja iz tvojih odgovora."
      />
      <main className="sleep-experience-page sleep-result-page">
        <div className="sleep-experience-overlay" aria-hidden="true" />
        <div className="sleep-experience-shell">
          <header className="sleep-experience-brand sleep-result-brand" aria-label="Tvoja priča o snu">
            <span>Tvoja priča o snu</span>
            <a
              className="sleep-result-home-link"
              href="/"
              onClick={() => {
                window.localStorage.removeItem(DRAFT_KEY);
                window.localStorage.removeItem(COMPLETED_ASSESSMENT_KEY);
              }}
            >
              Početna
            </a>
          </header>

          <section className="sleep-result-intro" aria-labelledby="sleep-result-page-title">
            <h1 id="sleep-result-page-title">TVOJA PRIČA O SNU JE SPREMNA</h1>
          </section>

          {signatureResult ? (
            <article className="sleep-signature-card">
              <div className="sleep-signature-copy">
                <p className="sleep-card-eyebrow">TVOJ PROFIL SNA</p>
                <h2 className="sleep-result-profile-name">{signatureResult.signature}</h2>
                <p className="sleep-signature-description">{presentation?.profileDescription}</p>
              </div>

              {freeModuleView.primary && (() => {
                const { module, copy } = freeModuleView.primary;
                return (
                  <section className="sleep-free-module sleep-free-module-primary" aria-labelledby="free-module-primary-title">
                    <p className="sleep-free-module-kicker">01 · TVOJ NAJVAŽNIJI SIGNAL</p>
                    <h2 id="free-module-primary-title">{module.title}</h2>
                    {copy.mainText && <p>{copy.mainText}</p>}
                    {copy.steps.length > 0 && (
                      <div className="sleep-free-module-steps">
                        <h3>PROBAJ</h3>
                        <ol>{copy.steps.map((step, stepIndex) => <li key={`${module.id}-step-${stepIndex}`}>{step}</li>)}</ol>
                      </div>
                    )}
                    {copy.alternative && <p className="sleep-free-module-alternative"><strong>Ako ti ovo ne odgovara</strong><br />{copy.alternative}</p>}
                    {copy.track && <p className="sleep-free-module-track"><strong>Obrati pažnju</strong><br />{copy.track}</p>}
                  </section>
                );
              })()}

              {freeModuleView.preview && (() => {
                const { title, excerpt } = freeModuleView.preview;
                return (
                  <section className="sleep-free-module sleep-free-module-preview" aria-labelledby="free-module-preview-title">
                    <p className="sleep-free-module-kicker">02 · JOŠ JEDNA STVAR SE IZDVAJA</p>
                    <h2 id="free-module-preview-title">{title}</h2>
                    {excerpt && <div className="sleep-free-preview-fade" aria-hidden="true"><p>{excerpt}</p></div>}
                    <p className="sleep-free-preview-hint">Ostatak ovog poglavlja je deo kompletnog rezultata.</p>
                  </section>
                );
              })()}

              <section className="sleep-free-paywall" aria-labelledby="sleep-free-paywall-title">
                <p className="sleep-free-paywall-kicker">🔒 KOMPLETAN REZULTAT</p>
                <h2 id="sleep-free-paywall-title">OTKLJUČAJ OSTATAK TVOJE PRIČE O SNU</h2>
                <p>Na osnovu tvojih 12 odgovora izdvojili smo šta kod tvog sna ima najviše smisla da razumeš i probaš sledeće.</p>
                {checkoutCancelled && <p className="sleep-free-checkout-cancelled" role="status">Plaćanje nije završeno. Možeš pokušati ponovo.</p>}
                <h3>Dobijaš:</h3>
                <ul>
                  <li>Tvoj prioritet #1</li>
                  <li>Ostale signale koje smo pronašli</li>
                  <li>Konkretne sledeće korake</li>
                  <li>Šta trenutno ne moraš da menjaš</li>
                  <li>Šta probati ako prvi korak ne pomogne</li>
                  <li>Lični plan za 7 dana</li>
                </ul>
                <p className="sleep-free-price">9,99 €</p>
                <p className="sleep-free-price-note">Jednokratno plaćanje · Bez pretplate</p>
                <label className="sleep-free-email-label" htmlFor="sleep-free-email">EMAIL ZA TVOJ REZULTAT</label>
                <input
                  className="sleep-free-email-input"
                  id="sleep-free-email"
                  type="email"
                  autoComplete="email"
                  placeholder="tvoj@email.com"
                  value={customerEmail}
                  aria-invalid={Boolean(emailError)}
                  aria-describedby={emailError ? "sleep-free-email-error" : undefined}
                  onChange={(event) => { setCustomerEmail(event.target.value); setEmailError(""); }}
                />
                <p className="sleep-free-email-help">Email povezuje tvoje odgovore, Stripe potvrdu i otključan rezultat.</p>
                {emailError && <p className="sleep-free-form-error" id="sleep-free-email-error" role="alert">{emailError}</p>}
                {checkoutError && <p className="sleep-free-form-error" role="alert">{checkoutError}</p>}
                <button className="sleep-free-paywall-cta" type="button" onClick={handleContentUnlock} disabled={isCheckoutLoading}>
                  {isCheckoutLoading ? "OTVARAM SIGURNO PLAĆANJE…" : "OTKLJUČAJ MOJU PRIČU — 9,99 € →"}
                </button>
                <p className="sleep-free-paywall-footnote">🔒 Sigurno plaćanje · Jednokratno · Bez pretplate</p>
                <p className="sleep-free-paywall-answers-note">Rezultat je sastavljen na osnovu tvojih odgovora na 12 pitanja.</p>
              </section>
            </article>
          ) : (
            <article className="sleep-signature-card sleep-result-unavailable">
              <p>Nismo uspeli da pripremimo tvoj rezultat. Pokušaj ponovo da završiš upitnik.</p>
              <a className="sleep-discovery-cta" href="/">Vrati se na upitnik</a>
            </article>
          )}
          {signatureResult && (
            <button className="sleep-result-restart" type="button" onClick={onRestart}>
              Ponovi test
            </button>
          )}
        </div>
      </main>
    </>
  );
}

function useSavedSleepAssessment() {
  const [savedAssessment, setSavedAssessment] = useState({ userAnswers: null, signatureResult: null });

  useEffect(() => {
    try {
      const rawDraft = window.localStorage.getItem(DRAFT_KEY);
      const rawCompleted = window.localStorage.getItem(COMPLETED_ASSESSMENT_KEY);
      const assessment = rawDraft ? JSON.parse(rawDraft) : rawCompleted ? JSON.parse(rawCompleted) : null;
      const answers = assessment?.userAnswers;

      if (
        assessment?.selectedTest !== "sleep" ||
        !Array.isArray(answers) ||
        answers.length !== 12 ||
        answers.some((answer) => !Number.isInteger(answer) || answer < 1 || answer > 5)
      ) return;

      setSavedAssessment({
        userAnswers: answers,
        signatureResult: calculateSleepSignature(answers.map((points) => 5 - points)),
      });
    } catch {
      setSavedAssessment({ userAnswers: null, signatureResult: null });
    }
  }, []);

  return savedAssessment;
}

const SLEEP_V2_FIXTURES = Object.freeze([
  ["mirna-noc", "MIRNA NOĆ"],
  ["umoran", "UMORAN SAN"],
  ["budan-um", "BUDAN UM"],
  ["isprekidan-a", "ISPREKIDAN SAN — A"],
  ["isprekidan-f", "ISPREKIDAN SAN — F"],
]);

function SleepPremiumV2FixturePage() {
  const initial = new URLSearchParams(window.location.search).get("fixture");
  const [fixture, setFixture] = useState(SLEEP_V2_FIXTURES.some(([key]) => key === initial) ? initial : "mirna-noc");
  const [acceptedAnalysis, setAcceptedAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setAcceptedAnalysis(null);
    fetch(apiUrl(`${API_BASE}/dev/sleep-premium-v2-fixture?fixture=${encodeURIComponent(fixture)}`), { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.acceptedAnalysis?.version !== "sleep-premium-deterministic-report.v2") {
          throw new Error(data.error || "Local V2 fixture is unavailable.");
        }
        return data.acceptedAnalysis;
      })
      .then((analysis) => setAcceptedAnalysis(analysis))
      .catch((failure) => {
        if (failure.name !== "AbortError") setError(failure.message || "Local V2 fixture is unavailable.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [fixture]);

  return (
    <main className="sleep-experience-page premium-v2-preview-page">
      <div className="sleep-experience-overlay" aria-hidden="true" />
      <section className="premium-v2-preview-controls" aria-label="Development fixture selector">
        <label htmlFor="premium-v2-fixture">Local fixture preview</label>
        <select id="premium-v2-fixture" value={fixture} onChange={(event) => setFixture(event.target.value)}>
          {SLEEP_V2_FIXTURES.map(([key, label]) => <option value={key} key={key}>{label}</option>)}
        </select>
      </section>
      {loading && <p className="premium-v2-preview-status" role="status">Loading deterministic fixture…</p>}
      {error && <p className="premium-v2-preview-status" role="alert">{error}</p>}
      {acceptedAnalysis && <PremiumResult acceptedAnalysis={acceptedAnalysis} />}
    </main>
  );
}

function PremiumAiPreviewReport({ report, source, fallbackDiagnostic }) {
  return (
    <section className="premium-staging-preview-report" aria-label="Staging Premium AI report preview">
      <div className="premium-staging-preview-banner">
        <strong>STAGING PREVIEW</strong>
        <span>{source === "fallback" ? "FALLBACK" : "AI_GENERATED"}</span>
      </div>
      {source === "fallback" && fallbackDiagnostic?.reason && (
        <p className="premium-staging-preview-reason">{fallbackDiagnostic.reason}</p>
      )}
      <header className="premium-preview-profile-header">
        <span className="premium-preview-eyebrow">Tvoj profil sna</span>
        <p className="premium-preview-profile">{report.profile}</p>
        <p>{report.profile_explanation}</p>
      </header>
      <section className="premium-preview-priority">
        <h3>TVOJ PRIORITET #1</h3>
        <p className="premium-preview-priority-area">{report.priority.area}</p>
        <p>{report.priority.explanation}</p>
      </section>
      <section>
        <h3>KAKO SE TVOJIH 12 ODGOVORA POVEZUJE</h3>
        <ul>{report.connections.map((connection, index) => <li key={`connection-${index}`}>{connection.text}</li>)}</ul>
      </section>
      <section>
        <h3>ŠTA JOŠ VREDI DA PRATIŠ</h3>
        <ul>{report.stable_or_tracking.items.map((item, index) => <li key={`mode-${index}`}>{item}</li>)}</ul>
      </section>
      <section>
        <h3>TVOJ LIČNI PLAN ZA 7 DANA</h3>
        <ol className="premium-preview-plan">
          {report.seven_day_plan.map((day) => (
            <li key={day.day}>
              <strong className="premium-preview-day">Dan {day.day}</strong>
              <dl>
                <div><dt>Šta da probaš</dt><dd>{day.action}</dd></div>
                <div><dt>Šta da primetiš</dt><dd>{day.observe}</dd></div>
              </dl>
            </li>
          ))}
        </ol>
        <details className="premium-preview-review">
          <summary>Osvrt posle 7 dana</summary>
          <ol>{report.review_questions.map((item, index) => <li key={`question-${index}`}>{item}</li>)}</ol>
          <p>{report.after_seven_days}</p>
        </details>
      </section>
      <section>
        <h3>AKO TI PRVI KORAK NE ODGOVARA</h3>
        <ul>{report.alternatives.map((item, index) => <li key={`alternative-${index}`}>{item}</li>)}</ul>
      </section>
      <section className="premium-preview-pdf">
        <h3>TVOJ PDF PLAN</h3>
        <p className="premium-preview-pdf-status">PDF nije dostupan u staging pregledu.</p>
        <p>Ovaj pregled ne pravi niti preuzima PDF. Budući PDF treba da koristi iste prihvaćene podatke ovog izveštaja, bez nove analize ili izmene plana.</p>
      </section>
      <footer className="premium-preview-closing"><p>{report.closing}</p></footer>
    </section>
  );
}

function SleepPremiumDiscoveryPage() {
  const { signatureResult, userAnswers } = useSavedSleepAssessment();
  const premiumBenefits = getSleepPremiumBenefits(signatureResult);
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [premiumPreviewEnabled, setPremiumPreviewEnabled] = useState(false);
  const [isPreviewGenerating, setIsPreviewGenerating] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [previewResult, setPreviewResult] = useState(null);
  const submitLock = useRef(false);

  useEffect(() => {
    if (!Array.isArray(userAnswers) || userAnswers.length !== 12) return undefined;
    const controller = new AbortController();
    fetch(apiUrl(`${API_BASE}/dev/premium-ai-preview/config`), { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((config) => setPremiumPreviewEnabled(config?.enabled === true))
      .catch(() => setPremiumPreviewEnabled(false));
    return () => controller.abort();
  }, [userAnswers]);

  const handlePremiumPreview = async () => {
    if (!premiumPreviewEnabled || isPreviewGenerating || userAnswers?.length !== 12) return;
    setIsPreviewGenerating(true);
    setPreviewError("");
    setPreviewResult(null);
    try {
      const response = await fetch(apiUrl(`${API_BASE}/dev/premium-ai-preview`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: userAnswers }),
      });
      const data = await response.json();
      if (!response.ok || !data.report) throw new Error("preview_unavailable");
      if (
        !signatureResult?.signature ||
        data.deterministicProfile !== signatureResult.signature ||
        data.report.profile !== signatureResult.signature
      ) throw new Error("profile_mismatch");
      setPreviewResult(data);
    } catch {
      setPreviewError("Nismo uspeli da pripremimo staging pregled. Proveri da li su tvoji odgovori dostupni i pokušaj ponovo.");
    } finally {
      setIsPreviewGenerating(false);
    }
  };

  const handleCheckoutSubmit = async (event) => {
    event.preventDefault();
    if (submitLock.current) return;

    setEmailError("");
    setCheckoutError("");
    const trimmedEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setEmailError("Unesi ispravnu email adresu.");
      return;
    }
    if (!Array.isArray(userAnswers) || userAnswers.length !== 12) {
      setCheckoutError("Tvoji odgovori nisu dostupni. Vrati se na rezultat i pokušaj ponovo.");
      return;
    }

    submitLock.current = true;
    setIsSubmitting(true);

    try {
      const response = await fetch(apiUrl(`${API_BASE}/create-checkout-session`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerEmail: trimmedEmail,
          assessmentType: "sleep",
          testName: tests.sleep.title,
          answers: userAnswers,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.url) throw new Error("checkout_unavailable");

      window.location.assign(data.url);
    } catch {
      submitLock.current = false;
      setIsSubmitting(false);
      setCheckoutError("Plaćanje trenutno nije moguće. Pokušaj ponovo.");
    }
  };

  return (
    <>
      <SeoHead
        title="Tvoja priča se nastavlja | MindScore AI"
        description="Nastavi da istražuješ šta tvoji odgovori govore o tvom snu."
      />
      <main className="sleep-experience-page sleep-discovery-page">
        <div className="sleep-experience-overlay" aria-hidden="true" />
        <div className="sleep-discovery-shell">
          <header className="sleep-experience-brand" aria-label="MindScore AI">
            <span className="sleep-brand-mark" aria-hidden="true">M</span>
            <span>MindScore AI</span>
          </header>

          <section className="sleep-discovery-intro">
            <h1>OTKRIJ VIŠE O SVOM SNU</h1>
            <p className="sleep-discovery-description">
              Tvoj rezultat je samo početak. Pogledaćemo svih 12 odgovora zajedno da ti pokažemo gde tvoj san najviše gubi kvalitet, šta ti već ide dobro i odakle ima najviše smisla da kreneš.
            </p>
            {signatureResult && (
              <p className="sleep-discovery-signature">Tvoj rezultat: <strong>{signatureResult.signature}</strong></p>
            )}
          </section>

          <section className="sleep-discoveries" aria-label="Zaključana otkrića">
            {premiumBenefits.map((card, index) => (
              <article className="sleep-discovery-card" key={card.title}>
                <span className="sleep-discovery-lock" aria-hidden="true">🔒</span>
                <div className="sleep-discovery-card-copy">
                  <h2>{card.title}</h2>
                  <p>{card.description}</p>
                </div>
                <div className="sleep-discovery-blurred-preview" aria-hidden="true">
                  <span style={{ width: `${62 + index * 5}%` }} />
                  <span style={{ width: `${78 - index * 4}%` }} />
                </div>
              </article>
            ))}
          </section>

          <section className="sleep-premium-purchase" aria-label="Kupovina kompletnog izveštaja">
            <p className="sleep-discovery-hook">Ne moraš da menjaš sve.<br />Važno je da znaš šta prvo ima smisla da probaš.</p>
            <section className="sleep-discovery-price" aria-label="Cena">
              <strong>{formatConfiguredEurPrice(SLEEP_PREMIUM_DISPLAY_PRICE_EUR)}</strong>
              <span>Jednokratno · Bez pretplate</span>
            </section>

            <form className="sleep-checkout-form" onSubmit={handleCheckoutSubmit} noValidate>
              <label htmlFor="sleep-premium-email">Email za dostavu izveštaja</label>
              <input
                id="sleep-premium-email"
                type="email"
                autoComplete="email"
                placeholder="tvoj@email.com"
                value={email}
                aria-invalid={Boolean(emailError)}
                aria-describedby={emailError ? "sleep-premium-email-error" : undefined}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setEmailError("");
                }}
              />
              {emailError && <p className="sleep-checkout-error" id="sleep-premium-email-error" role="alert">{emailError}</p>}
              {checkoutError && <p className="sleep-checkout-error" role="alert">{checkoutError}</p>}
              <button className="sleep-discovery-cta" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Otvaramo sigurno plaćanje..." : "OTKLJUČAJ MOJ DETALJNI REZULTAT →"}
              </button>
              <p className="sleep-premium-includes">Lično objašnjenje · prioritet #1 · plan za 7 dana · PDF za čuvanje</p>
              {premiumPreviewEnabled && (
                <div className="premium-staging-preview-control">
                  <span>Developer alat · nije kupovina</span>
                  <button
                    className="premium-staging-preview-button"
                    type="button"
                    onClick={handlePremiumPreview}
                    disabled={isPreviewGenerating}
                  >
                    {isPreviewGenerating ? "PRIPREMAM STAGING PREGLED…" : "STAGING: TESTIRAJ PREMIUM AI"}
                  </button>
                  {previewError && <p className="sleep-checkout-error" role="alert">{previewError}</p>}
                  {previewResult && (
                    <PremiumAiPreviewReport
                      report={previewResult.report}
                      source={previewResult.source}
                      deterministicProfile={previewResult.deterministicProfile}
                      fallbackDiagnostic={previewResult.fallbackDiagnostic}
                    />
                  )}
                </div>
              )}
            </form>

            <p className="sleep-checkout-trust">🔒 Sigurno plaćanje putem Stripe-a</p>
          </section>
          <a className="sleep-discovery-back" href="/">← Nazad na moj rezultat</a>
        </div>
      </main>
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
  const [checkoutCancelled, setCheckoutCancelled] = useState(() =>
    new URLSearchParams(window.location.search).get("checkout") === "cancelled");

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
    const params = new URLSearchParams(window.location.search);
    const unlock = params.get("unlock");
    if (params.get("checkout") !== "cancelled" || !unlock) return undefined;
    let cancelled = false;
    fetch(apiUrl(`${API_BASE}/sleep-content/free-result?unlock=${encodeURIComponent(unlock)}`), { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.selectedTest !== "sleep" || !isValidSleepAnswers(data.answers)) {
          throw new Error("Saved free sleep result unavailable.");
        }
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        setSelectedTest("sleep");
        setCurrentQuestion(SLEEP_QUESTIONS.length);
        setUserAnswers(data.answers);
        setCheckoutCancelled(true);
        const restored = { selectedTest: "sleep", currentQuestion: SLEEP_QUESTIONS.length, userAnswers: data.answers, email: "" };
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify(restored));
        window.localStorage.setItem(COMPLETED_ASSESSMENT_KEY, JSON.stringify({ ...restored, completedAt: new Date().toISOString() }));
      })
      .catch(() => {});
    return () => { cancelled = true; };
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

  const sleepSignatureResult = useMemo(() => {
    if (selectedTest !== "sleep" || userAnswers.length !== sleepAnswerOptions.length) return null;
    const answerIndexes = userAnswers.map((points) => 5 - Number(points));
    const answerTexts = answerIndexes.map((answerIndex, questionIndex) => sleepAnswerOptions[questionIndex]?.[answerIndex]?.text);
    return calculateSleepSignature(answerIndexes, answerTexts);
  }, [selectedTest, userAnswers]);

  const startTest = (key) => {
    window.localStorage.removeItem(DRAFT_KEY);
    window.localStorage.removeItem(COMPLETED_ASSESSMENT_KEY);
    setSelectedTest(key);
    setCurrentQuestion(0);
    setEmail("");
    setCheckoutError("");
    setIsCheckoutRedirecting(false);
    setIsAnswering(false);
    setUserAnswers([]);
    setCheckoutCancelled(false);
    window.history.replaceState(null, "", window.location.pathname);
  };

  const handleSleepContentCheckout = (customerEmail) => beginSleepContentCheckout(customerEmail, userAnswers);

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

  if (currentQuestion === test.questions.length && selectedTest === "sleep") {
    return <SleepSignatureResultPage
      signatureResult={sleepSignatureResult}
      answerPoints={userAnswers}
      onRestart={() => startTest("sleep")}
      onCheckout={handleSleepContentCheckout}
      checkoutCancelled={checkoutCancelled}
    />;
  }

  if (currentQuestion === test.questions.length) {
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
              <p>{resultLevel}</p>
            </div>

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
                  className="primary-btn"
                  onClick={startPremiumCheckout}
                  disabled={isCheckoutRedirecting}
                >
                  {isCheckoutRedirecting ? "Redirecting to secure checkout..." : "Unlock Premium Report"}
                </button>
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
  const visibleAnswers = selectedTest === "sleep" ? sleepAnswerOptions[currentQuestion] || answers : answers;

  return (
    <>
      <SeoHead
        title={selectedTest === "sleep" ? "Tvoja priča o snu" : `${test.title} Assessment | MindScore AI`}
        description="Complete your assessment with a clear, mobile-friendly questionnaire and progress tracking."
      />
      <main className="page assessment-page quiz-active">
        <div className="quiz-photo-overlay" aria-hidden="true" />
        <section className="content-panel quiz-panel">
          <nav className="quiz-nav-row" aria-label="Assessment navigation">
            <button
              type="button"
              className="quiz-nav-btn quiz-nav-back"
              onClick={goBackQuestion}
              disabled={currentQuestion === 0 || isAnswering}
            >
              Nazad
            </button>
            <div className="quiz-branding" aria-label="Tvoja priča o snu">
              <span className="quiz-brand-name">Tvoja priča o snu</span>
              <span className="quiz-brand-subtitle">12 pitanja o snu</span>
            </div>
            <button type="button" className="quiz-nav-btn quiz-nav-home" onClick={restart}>
              Početna
            </button>
          </nav>

          <div className="quiz-top">
            <span>
              Pitanje {currentQuestion + 1} od {test.questions.length}
            </span>
            <span>{Math.round(progress)}%</span>
          </div>

          <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>

          <h1 className="question-title">{test.questions[currentQuestion]}</h1>

          <div className="answers" role="group" aria-label="Answer options">
            {visibleAnswers.map((item) => {
              const isSelected = selectedOption === item.points;
              return (
                <button
                  key={item.text}
                  onClick={() => answerQuestion(item.points)}
                  disabled={isAnswering}
                  className={isSelected ? "selected" : ""}
                  aria-pressed={isSelected}
                >
                  <span className="answer-radio" aria-hidden="true">
                    <span className="answer-radio-dot" />
                  </span>
                  <span className="answer-copy">{item.text}</span>
                </button>
              );
            })}
          </div>

          <div className="quiz-bottom-nav">
            <button
              type="button"
              className="quiz-bottom-btn quiz-bottom-prev"
              onClick={goBackQuestion}
              disabled={currentQuestion === 0 || isAnswering}
            >
              Prethodno
            </button>
            <button
              type="button"
              className="quiz-bottom-btn quiz-bottom-next"
              onClick={() => {
                if (typeof selectedOption === "number") {
                  answerQuestion(selectedOption);
                }
              }}
              disabled={!selectedOption || isAnswering}
            >
              Sledeće →
            </button>
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