import { useEffect, useMemo, useState } from "react";
import AnalyticsDashboard from "./AnalyticsDashboard";
import { calculateDimensions } from "./psychology/dimensions";
import "./App.css";

const BACKEND_URL = import.meta.env.VITE_API_BASE_URL || "";
const API_BASE = "/api";
const LEGAL_LAST_UPDATED = "July 24, 2026";
const PREMIUM_PRICE_EUR = "4.99";
const DRAFT_KEY = "mindscore_assessment_draft_v2";

const apiUrl = (path) => `${BACKEND_URL}${path}`;

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
    subtitle: "Explore recovery quality, sleep consistency and daytime clarity.",
    icon: "Q",
    category: "Recovery",
    minutes: "2-3 min",
    questions: [
      "When you wake up after what should have been a full night's sleep, how refreshed do you usually feel?",
      "If you wake up during the night, how easily do you fall back asleep?",
      "After an emotionally difficult day, how well are you able to sleep that night?",
      "How often do your thoughts keep running when you are trying to fall asleep?",
      "During the day, how often do you feel mentally tired even after sleeping enough hours?",
      "If you have an important event the next morning, how much does it affect your sleep?",
      "How often do you wake up before your alarm and cannot fall asleep again?",
      "After waking up, how quickly does your mind become clear and focused?",
      "How often do you rely on caffeine or stimulants just to feel fully awake?",
      "If your sleep schedule changes for one or two days, how quickly does your body recover?",
      "How often do you feel sleepy during quiet activities such as reading, studying or watching TV?",
      "Overall, how confident are you that your current sleep is allowing your brain and body to recover at their best?",
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

const trustItems = [
  "Secure Stripe Payments",
  "AI Powered",
  "Private",
  "Instant PDF",
  "Email Delivery",
  "GDPR Friendly",
  "Educational Only",
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
    paid: false,
    ready: false,
    fulfillmentStatus: "pending",
    customerEmail: "",
    downloadUrl: "",
    isDownloading: false,
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
        const response = await fetch(verifySessionUrl);
        const rawBody = await response.text();
        const data = rawBody ? JSON.parse(rawBody) : {};

        if (!response.ok) {
          throw new Error(data.error || "Payment verification failed.");
        }

        if (cancelled) return;

        setState((previous) => ({
          ...previous,
          loading: false,
          paid: Boolean(data.paid),
          ready: Boolean(data.ready),
          fulfillmentStatus: data.fulfillmentStatus || "unknown",
          customerEmail: data.customerEmail || "",
          downloadUrl: data.downloadUrl || "",
          emailSent: Boolean(data.emailSent),
          emailError: data.emailError || "",
          attempts: previous.attempts + 1,
          error: "",
        }));

        if (data.paid && !data.ready) {
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
      const response = await fetch(state.downloadUrl);
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

          {delayed && (
            <p className="status-note">
              Report generation is taking longer than usual. Keep this page open. Your download button will appear as
              soon as processing completes.
            </p>
          )}

          {state.ready && state.emailError && (
            <p className="status-note warning">
              Email delivery was not confirmed yet: {state.emailError}. Your download is still available below.
            </p>
          )}

          {showRecoverableError && (
            <p className="status-note warning">
              {state.error} You can refresh this page or contact support: aimindscore@gmail.com
            </p>
          )}

          <div className="result-actions">
            <button className="primary-btn" onClick={handleDownloadPdf} disabled={!state.ready || state.isDownloading}>
              {state.isDownloading ? "Downloading..." : "Download Premium PDF"}
            </button>
            <a className="secondary-btn" href="/support">
              Contact Support
            </a>
            <a className="ghost-btn" href="/">
              Return Home
            </a>
          </div>
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

function AssessmentCard({ item, onStart }) {
  const iconMap = {
    mental: "RS",
    stress: "SC",
    sleep: "SQ",
    leadership: "PS",
  };

  return (
    <button className={`assessment-card ${item.key}`} onClick={() => onStart(item.key)}>
      <div className="assessment-card-top">
        <span className="assessment-icon" aria-hidden="true">
          {iconMap[item.key] || item.icon}
        </span>
        <span className="assessment-arrow" aria-hidden="true">
          {">"}
        </span>
      </div>
      <h3>{item.title}</h3>
      <p>{item.subtitle}</p>
      <div className="assessment-meta">
        <span className="assessment-pill time">Estimated {item.minutes}</span>
        <span className="assessment-pill free">Free result</span>
        <span className="assessment-pill premium">Premium report</span>
      </div>
      <p className="assessment-time">{item.category}</p>
      <span className="assessment-cta">Start assessment</span>
    </button>
  );
}

function Homepage({ onStartAssessment }) {
  const assessments = Object.entries(tests).map(([key, value]) => ({ key, ...value }));
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("hero");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

  return (
    <>
      <SeoHead
        title="MindScore AI | Premium Self-Assessment Platform"
        description="Complete intelligent self-assessments and unlock a personalized premium AI report with secure Stripe checkout and instant PDF delivery."
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
        <button
          className={`mobile-menu-toggle ${isMobileMenuOpen ? "open" : ""}`}
          type="button"
          aria-label="Toggle navigation menu"
          aria-expanded={isMobileMenuOpen}
          onClick={() => setIsMobileMenuOpen((previous) => !previous)}
        >
          <span />
          <span />
          <span />
        </button>
        <nav className={`site-nav ${isMobileMenuOpen ? "open" : ""}`} aria-label="Primary navigation">
          <a className={activeSection === "assessments" ? "active" : ""} href="#assessments" onClick={() => setIsMobileMenuOpen(false)}>Assessments</a>
          <a className={activeSection === "how-it-works" ? "active" : ""} href="#how-it-works" onClick={() => setIsMobileMenuOpen(false)}>How It Works</a>
          <a className={activeSection === "premium-report" ? "active" : ""} href="#premium-report" onClick={() => setIsMobileMenuOpen(false)}>Premium Report</a>
          <a className={activeSection === "faq" ? "active" : ""} href="#faq" onClick={() => setIsMobileMenuOpen(false)}>FAQ</a>
          <a href="/support" onClick={() => setIsMobileMenuOpen(false)}>Support</a>
        </nav>
        <button className="header-cta header-cta-desktop" onClick={() => { setIsMobileMenuOpen(false); onStartAssessment("mental"); }}>Start Free Assessment</button>
      </header>

      <main className="homepage">
        <section className="hero-section reveal">
          <div className="hero-copy reveal">
            <p className="hero-label">AI-powered personal development insights</p>
            <h1>Understand Your Mind. Strengthen Your Life.</h1>
            <p>
              Complete intelligent self-assessments and receive clear, personalized insights into your mindset,
              stress patterns, sleep quality and personal strengths.
            </p>
            <div className="hero-actions">
              <button className="primary-btn" onClick={() => onStartAssessment("mental")}>Start Free Assessment</button>
              <a className="secondary-btn" href="#premium-report">
                See What You Get
              </a>
            </div>
            <div className="trust-strip hero-trust" aria-label="Value highlights">
              <span>Free basic results</span>
              <span>Personalized AI analysis</span>
              <span>Secure Stripe payment</span>
              <span>Instant PDF report</span>
              <span>Private and confidential</span>
              <span>Informational, not medical</span>
            </div>
          </div>

          <aside className="hero-visual reveal" aria-label="Platform preview">
            <div className="hero-neural-brain" aria-hidden="true">
              <div className="particle-cloud">
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
                <span className="brain-core-label">AI Core</span>
              </div>

              <span className="brain-node node-a" />
              <span className="brain-node node-b" />
              <span className="brain-node node-c" />
              <span className="brain-node node-d" />
              <span className="brain-node node-e" />
              <span className="brain-node node-f" />

              <span className="brain-link link-a" />
              <span className="brain-link link-b" />
              <span className="brain-link link-c" />
              <span className="brain-link link-d" />
              <span className="brain-link link-e" />
            </div>

            <div className="visual-dashboard reveal">
              <div className="visual-dashboard-head">
                <p>MindScore analysis panel</p>
                <span>Live preview</span>
              </div>

              <div className="visual-dashboard-grid">
                <div className="visual-dashboard-score">
                  <strong>84</strong>
                  <small>Overall score</small>
                </div>
                <div className="visual-dashboard-bars">
                  <div>
                    <span>Resilience</span>
                    <i style={{ width: "88%" }} className="bar-anim-one" />
                  </div>
                  <div>
                    <span>Emotional Control</span>
                    <i style={{ width: "72%" }} className="bar-anim-two" />
                  </div>
                  <div>
                    <span>Stress Tolerance</span>
                    <i style={{ width: "66%" }} className="bar-anim-three" />
                  </div>
                </div>
              </div>
            </div>

            <div className="hero-metrics">
              <article className="visual-card float-a reveal">
                <p>Top strength</p>
                <h3>Resilience</h3>
                <small>Calm, durable and recovery-oriented pattern</small>
              </article>
              <article className="visual-card float-b reveal">
                <p>Growth focus</p>
                <h3>Stress tolerance</h3>
                <small>Action plan with practical weekly steps</small>
              </article>
            </div>
          </aside>
        </section>

        <section className="section trust-section reveal" id="trust">
          <div className="section-heading">
            <h2>Trusted Infrastructure, Responsible AI Experience</h2>
            <p>Built for clarity, security and immediate access to practical self-assessment insights.</p>
          </div>
          <div className="trust-grid">
            {trustItems.map((item) => (
              <article key={item} className="trust-chip">
                <span>{item}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="section reveal" id="assessments">
          <div className="section-heading">
            <h2>Assessments Designed for Real Insight</h2>
            <p>Short, focused questionnaires built for clarity and practical self-development guidance.</p>
          </div>
          <div className="assessment-grid">
            {assessments.map((item) => (
              <AssessmentCard key={item.key} item={item} onStart={onStartAssessment} />
            ))}
          </div>
        </section>

        <section className="section steps reveal" id="how-it-works">
          <div className="section-heading">
            <h2>How It Works</h2>
            <p>Clear from start to finish in four simple steps.</p>
          </div>
          <div className="steps-grid timeline-grid">
            <article>
              <span>1</span>
              <h3>Choose an assessment</h3>
              <p>Select the area you want to understand first.</p>
            </article>
            <article>
              <span>2</span>
              <h3>Answer the questions</h3>
              <p>Complete a short questionnaire with clear answer options.</p>
            </article>
            <article>
              <span>3</span>
              <h3>View your free results</h3>
              <p>Get your overall score, profile snapshot and key interpretation.</p>
            </article>
            <article>
              <span>4</span>
              <h3>Unlock Premium Report</h3>
              <p>Receive a complete personalized PDF and email delivery.</p>
            </article>
          </div>
        </section>

        <section className="section premium-section reveal" id="premium-report">
          <div className="section-heading">
            <h2>Why the Premium Report Is Worth It</h2>
            <p>Move from scores to structured understanding and practical next steps.</p>
          </div>
          <div className="premium-grid">
            <article className="premium-features">
              <ul>
                <li>Personalized AI profile based on your answers</li>
                <li>Detailed interpretation of every score area</li>
                <li>Strengths and risk pattern analysis</li>
                <li>Practical recommendations in clear language</li>
                <li>Action plan you can apply immediately</li>
                <li>Downloadable premium PDF</li>
                <li>Email delivery to your inbox</li>
                <li>Secure one-time payment via Stripe</li>
              </ul>
              <button className="primary-btn" onClick={() => onStartAssessment("mental")}>Unlock Your Premium Report</button>
            </article>
            <article className="premium-preview pdf-preview">
              <div className="pdf-preview-header">
                <div>
                  <p>Premium PDF preview</p>
                  <h3>Professional report layout</h3>
                </div>
                <span>3 pages</span>
              </div>

              <div className="pdf-preview-grid">
                <div className="pdf-page pdf-page-one">
                  <span>Page 1</span>
                  <h4>Executive Summary</h4>
                  <div className="pdf-summary-card">
                    <strong>84</strong>
                    <small>Overall score</small>
                  </div>
                  <div className="pdf-copy-lines">
                    <i />
                    <i />
                    <i />
                  </div>
                </div>

                <div className="pdf-page pdf-page-two">
                  <span>Page 2</span>
                  <h4>Charts</h4>
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
                  <span>Page 3</span>
                  <h4>Action Plan</h4>
                  <div className="recommendation-cards">
                    <article>
                      <strong>Focus</strong>
                      <p>Weekly habits</p>
                    </article>
                    <article>
                      <strong>Practice</strong>
                      <p>Stress regulation</p>
                    </article>
                    <article>
                      <strong>Track</strong>
                      <p>Progress markers</p>
                    </article>
                  </div>
                </div>
              </div>
            </article>
          </div>
        </section>

        <section className="section why-section reveal" id="why-mindscore">
          <div className="section-heading">
            <h2>Why MindScore AI</h2>
            <p>Built for people who want guidance they can use, not generic quiz text.</p>
          </div>
          <div className="comparison-grid">
            <article>
              <h3>Typical online quiz</h3>
              <ul>
                <li>Generic feedback</li>
                <li>Minimal explanation</li>
                <li>Limited practical steps</li>
              </ul>
            </article>
            <article className="highlighted">
              <h3>MindScore AI</h3>
              <ul>
                <li>Personalized analysis based on your answers</li>
                <li>Clear language instead of jargon</li>
                <li>Immediate results and actionable recommendations</li>
                <li>Accessible anywhere, on any device</li>
              </ul>
            </article>
          </div>
        </section>

        <section className="section safety-section reveal">
          <h2>Safety and Disclaimer</h2>
          <p>
            MindScore AI provides educational and informational self-assessment content. It does not provide medical
            diagnosis, psychological treatment, psychiatric care or emergency assistance.
          </p>
        </section>

        <section className="section faq-section reveal" id="faq">
          <div className="section-heading">
            <h2>Frequently Asked Questions</h2>
          </div>
          <div className="faq-list">
            {faqItems.map((item) => (
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
            <p className="footer-col-title">Company</p>
            <div className="site-footer-links">
              <a href="/privacy">Privacy</a>
              <a href="/terms">Terms</a>
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
              <span>Premium self-assessment</span>
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
  const [isAnswering, setIsAnswering] = useState(false);
  const [userAnswers, setUserAnswers] = useState([]);

  const test = selectedTest ? tests[selectedTest] : null;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (!draft?.selectedTest || !tests[draft.selectedTest]) return;

      setSelectedTest(draft.selectedTest);
      setCurrentQuestion(Math.max(0, Number(draft.currentQuestion) || 0));
      setUserAnswers(Array.isArray(draft.userAnswers) ? draft.userAnswers : []);
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

  const score = useMemo(() => userAnswers.reduce((sum, value) => sum + (Number(value) || 0), 0), [userAnswers]);

  const dashboardScores = useMemo(
    () => (selectedTest && userAnswers.length > 0 ? calculateDimensions(userAnswers) : []),
    [selectedTest, userAnswers]
  );

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

      if (!test) throw new Error("Assessment state is missing.");

      if (!email || !/.+@.+\..+/.test(email.trim())) {
        throw new Error("Please enter a valid email address before checkout.");
      }

      const finalScore = Math.round((score / (test.questions.length * 5)) * 100);
      const profileDimensions =
        dashboardScores.length > 0 ? dashboardScores : calculateDimensions(userAnswers);

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
    return <Homepage onStartAssessment={startTest} />;
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
    const finalScore = Math.round((score / (test.questions.length * 5)) * 100);
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
              <div className="score-circle" aria-label={`Overall score ${finalScore} out of 100`}>
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
                  onChange={(event) => setEmail(event.target.value)}
                />
                <button className="primary-btn" onClick={startPremiumCheckout} disabled={isCheckoutRedirecting}>
                  {isCheckoutRedirecting ? "Redirecting to secure checkout..." : "Unlock Premium Report"}
                </button>
                {checkoutError && <p className="inline-error">{checkoutError}</p>}
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
      <main className="page assessment-page">
        <section className="content-panel quiz-panel">
          <div className="quiz-header-row">
            <button className="ghost-btn" onClick={restart}>
              Home
            </button>
            <p>{test.title}</p>
            <button className="ghost-btn" onClick={goBackQuestion} disabled={currentQuestion === 0 || isAnswering}>
              Back
            </button>
          </div>

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
      <SiteFooter />
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