import { useEffect, useState } from "react";
import { calculateDimensions } from "./psychology/dimensions";
import "./App.css";
import AnalyticsDashboard from "./AnalyticsDashboard";

const BACKEND_URL = import.meta.env.VITE_API_BASE_URL || "";

const apiUrl = (path) => `${BACKEND_URL}${path}`;
const API_BASE = "/api";

const tests = {
  mental: {
    title: "Mental Strength Score",
    subtitle: "Discover how resilient, focused and emotionally strong you are.",
    icon: "🧠",
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
  "At the end of a very difficult day, when you feel emotionally exhausted, how likely are you to continue acting according to your values instead of your emotions?"
],
  },
  stress: {
    title: "Stress Control Score",
    subtitle: "Find out how well you handle pressure and emotional overload.",
    icon: "⚡",
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

"When stress lasts for weeks rather than hours, what best describes your ability to maintain healthy routines, clear thinking and emotional stability?"
    ],
  },
  sleep: {
    title: "Sleep Quality Score",
    subtitle: "Understand how strong your sleep habits really are.",
    icon: "🌙",
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

"Overall, how confident are you that your current sleep is allowing your brain and body to recover at their best?"
]
  },
  leadership: {
    title: "Leadership Potential Score",
    subtitle: "Discover your confidence, clarity and decision-making power.",
    icon: "🚀",
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

"Imagine you could lead a team tomorrow. How confident are you that you could earn trust, make sound decisions and help others perform at their best?"
]
  },
};

const answers = [
  { icon: "🔥", text: "This describes me perfectly", points: 5 },
  { icon: "🙂", text: "Mostly true for me", points: 4 },
  { icon: "😐", text: "Sometimes true", points: 3 },
  { icon: "🤔", text: "Rarely true", points: 2 },
  { icon: "❌", text: "Not like me at all", points: 1 },
];

const LEGAL_LAST_UPDATED = "July 23, 2026";

function SiteFooter() {
  return (
    <footer className="site-footer" aria-label="Legal and support links">
      <p>MindScore AI</p>
      <nav className="site-footer-links">
        <a href="/privacy">Privacy Policy</a>
        <a href="/terms">Terms of Service</a>
        <a href="/support">Support</a>
      </nav>
    </footer>
  );
}

function PrivacyPolicyPage() {
  return (
    <>
      <main className="page page-with-footer">
        <section className="result-card legal-card">
          <div className="badge">Legal</div>
          <h1>Privacy Policy</h1>
          <p className="legal-last-updated">Last updated: {LEGAL_LAST_UPDATED}</p>

          <div className="legal-content">
            <p>
              MindScore AI collects information that you provide directly through the service. This includes your
              self-assessment answers and, when you choose to purchase a premium report, your email address.
            </p>

            <h3>How We Use Your Data</h3>
            <p>
              Your assessment data may be processed to generate AI-powered informational reports. We use this
              processing to provide test scores, profile insights, and premium PDF report content.
            </p>

            <h3>Third-Party Processors</h3>
            <p>
              Payments are processed by Stripe. Email delivery for premium reports is handled through Gmail/SMTP.
              Hosting and infrastructure are provided through Render.
            </p>

            <h3>Retention and Security</h3>
            <p>
              We retain data only as long as needed to operate the service, fulfill paid report delivery, resolve
              support issues, and meet legal obligations. We apply reasonable technical and organizational safeguards
              to protect stored assessment and transaction data.
            </p>

            <h3>Your Rights</h3>
            <p>
              You may request access, correction, or deletion of your personal data. You may also submit privacy
              concerns or deletion requests at any time by contacting us.
            </p>

            <h3>Important Notice</h3>
            <p>
              MindScore AI is not a medical service and does not provide diagnosis or treatment. Content is for
              educational and informational use only.
            </p>

            <h3>Contact</h3>
            <p>
              For privacy questions or deletion requests, contact:
              <a className="inline-mail-link" href="mailto:aimindscore@gmail.com">
                aimindscore@gmail.com
              </a>
            </p>
          </div>

          <a className="secondary-btn" href="/">
            Back to Home
          </a>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function TermsOfServicePage() {
  return (
    <>
      <main className="page page-with-footer">
        <section className="result-card legal-card">
          <div className="badge">Legal</div>
          <h1>Terms of Service</h1>
          <p className="legal-last-updated">Last updated: {LEGAL_LAST_UPDATED}</p>

          <div className="legal-content">
            <p>
              MindScore AI provides self-assessment tools and AI-generated informational PDF reports. By using this
              service, you agree to these terms.
            </p>

            <h3>Informational Use Only</h3>
            <p>
              Results and reports are for educational and informational purposes only. MindScore AI does not provide
              medical, psychological, psychiatric, or emergency care.
            </p>

            <h3>Payments and Digital Delivery</h3>
            <p>
              Premium reports are paid digital products processed through Stripe. Delivery is provided digitally by
              secure download and email when available.
            </p>

            <h3>Acceptable Use</h3>
            <p>
              You agree not to misuse the service, attempt unauthorized access, interfere with platform operations,
              or submit unlawful content.
            </p>

            <h3>Intellectual Property</h3>
            <p>
              The MindScore AI platform, branding, design, and generated report formats are protected intellectual
              property. You may use purchased reports for personal use unless otherwise agreed in writing.
            </p>

            <h3>Service Availability</h3>
            <p>
              We work to keep the service available but do not guarantee uninterrupted operation. Maintenance,
              provider outages, or infrastructure issues may temporarily affect access.
            </p>

            <h3>Limitation of Liability</h3>
            <p>
              To the maximum extent permitted by law, MindScore AI is not liable for indirect, incidental, or
              consequential damages arising from use of the service or reliance on informational report content.
            </p>

            <h3>Contact</h3>
            <p>
              Questions about these terms:
              <a className="inline-mail-link" href="mailto:aimindscore@gmail.com">
                aimindscore@gmail.com
              </a>
            </p>
          </div>

          <a className="secondary-btn" href="/">
            Back to Home
          </a>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function SupportPage() {
  return (
    <>
      <main className="page page-with-footer">
        <section className="result-card legal-card">
          <div className="badge">Support</div>
          <h1>Customer Support</h1>
          <p className="legal-last-updated">Last updated: {LEGAL_LAST_UPDATED}</p>

          <div className="legal-content">
            <p>
              Contact our support team at
              <a className="inline-mail-link" href="mailto:aimindscore@gmail.com">
                aimindscore@gmail.com
              </a>
              .
            </p>
            <p>
              To help us resolve your request faster, include the email used for payment and a short description of
              the problem.
            </p>

            <h3>Common Help Topics</h3>
            <ul>
              <li>Payment completed but report not received</li>
              <li>PDF download problems</li>
              <li>Duplicate payment</li>
              <li>Deletion/privacy request</li>
            </ul>
          </div>

          <a className="secondary-btn" href="/">
            Back to Home
          </a>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function PaymentSuccessPage() {
  const [state, setState] = useState({
    loading: true,
    paid: false,
    ready: false,
    customerEmail: "",
    downloadUrl: "",
    isDownloading: false,
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

        let data;
        try {
          data = rawBody ? JSON.parse(rawBody) : {};
        } catch {
          throw new Error(
            `Payment verification endpoint returned non-JSON response from ${verifySessionUrl}.`
          );
        }

        if (!response.ok) {
          throw new Error(data.error || "Payment verification failed.");
        }

        if (cancelled) return;

        setState({
          loading: false,
          paid: Boolean(data.paid),
          ready: Boolean(data.ready),
          customerEmail: data.customerEmail || "",
          downloadUrl: data.downloadUrl || "",
          error: "",
        });

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
    console.log("[download-click] handler start", {
      sessionId,
      ready: state.ready,
      hasDownloadUrl: Boolean(state.downloadUrl),
    });

    if (!state.downloadUrl) {
      setState((previous) => ({
        ...previous,
        error: "Download URL is missing. Please refresh the page and try again.",
      }));
      return;
    }

    console.log("[download-click] requested URL", state.downloadUrl);

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

      if (!contentDisposition.toLowerCase().includes("attachment")) {
        throw new Error("Download response is missing attachment headers.");
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

  return (
    <>
      <main className="page page-with-footer">
        <section className="result-card payment-status-card">
          <div className="badge">Payment status</div>
          <h1>Payment successful</h1>
          <p>Your Premium PDF is being prepared</p>

          <div className="email-box">
            <h3>Customer email</h3>
            <p className="payment-email-value">{state.customerEmail || "Waiting for confirmation..."}</p>
          </div>

          {state.loading && <p>Verifying payment and fulfillment status...</p>}
          {!state.loading && !state.paid && !state.error && (
            <p>Payment has not been confirmed yet. This page will refresh automatically.</p>
          )}

          {state.error && <p className="payment-error">{state.error}</p>}

          <div className="result-actions">
            {state.ready ? (
              <button className="primary-btn" onClick={handleDownloadPdf} disabled={state.isDownloading}>
                {state.isDownloading ? "Downloading..." : "Download Premium PDF"}
              </button>
            ) : (
              <button className="primary-btn" disabled>
                Download Premium PDF
              </button>
            )}
          </div>

          <button
            className="secondary-btn"
            onClick={() => {
              window.location.href = "/";
            }}
          >
            Back to Home
          </button>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function PaymentCancelledPage() {
  return (
    <>
      <main className="page page-with-footer">
        <section className="result-card payment-status-card">
          <div className="badge">Payment cancelled</div>
          <h1>Payment was cancelled</h1>
          <p>No charge was made. You can return and complete checkout when ready.</p>
          <button
            className="primary-btn"
            onClick={() => {
              window.location.href = "/";
            }}
          >
            Return to Assessment
          </button>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function AssessmentApp() {
  const [selectedTest, setSelectedTest] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [score, setScore] = useState(0);
  const [email, setEmail] = useState("");
  const [isCheckoutRedirecting, setIsCheckoutRedirecting] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [userAnswers, setUserAnswers] = useState([]);

  const test = selectedTest ? tests[selectedTest] : null;
  const dashboardScores =
    selectedTest && userAnswers.length > 0
      ? calculateDimensions(userAnswers)
      : [];

const startPremiumCheckout = async () => {
  try {
    setCheckoutError("");

    if (!test) {
      throw new Error("Assessment state is missing.");
    }

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
    let data;

    try {
      data = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      throw new Error(
        `Checkout endpoint returned non-JSON response from ${checkoutSessionUrl}.`
      );
    }

    if (!response.ok) {
      throw new Error(data.error || "Unable to create checkout session.");
    }

    if (!data.url) {
      throw new Error("Stripe checkout URL is missing.");
    }

    window.location.href = data.url;
  } catch (error) {
    setCheckoutError(error.message || "Checkout failed.");
    setIsCheckoutRedirecting(false);
  }
};

function startTest(key) {
  setSelectedTest(key);
  setCurrentQuestion(0);
  setScore(0);
  setEmail("");
  setCheckoutError("");
  setIsCheckoutRedirecting(false);
  setUserAnswers([]);
}

  function answer(points) {
    const newScore = score + points;
    setUserAnswers((previousAnswers) => [
  ...previousAnswers,
  points,
]);

    if (currentQuestion < test.questions.length - 1) {
      setScore(newScore);
      setCurrentQuestion(currentQuestion + 1);
    } else {
      setScore(newScore);
      setCurrentQuestion(test.questions.length);
    }
  }

  function restart() {
    setSelectedTest(null);
    setCurrentQuestion(0);
    setScore(0);
    setEmail("");
    setCheckoutError("");
    setIsCheckoutRedirecting(false);
  }
function getLevel(finalScore) {
  if (finalScore >= 90) return "Elite Mental Strength";
  if (finalScore >= 80) return "Exceptional Profile";
  if (finalScore >= 65) return "Strong Foundation";
  if (finalScore >= 50) return "Developing Resilience";
  if (finalScore >= 30) return "Growth Potential";
  return "Starting Your Journey";
}

  function getMessage(finalScore) {
    if (finalScore >= 80) {
      return [
        "Your result shows a powerful internal structure and strong self-control.",
        "You appear capable of staying focused even when pressure increases.",
        "Your answers suggest above-average resilience and emotional regulation.",
        "Your next level is refinement, not survival.",
        "The full report can reveal your hidden strengths and advanced growth areas.",
      ];
    }

    if (finalScore >= 60) {
      return [
        "You have a strong base and clear potential for further growth.",
        "You can handle pressure, but some situations may still affect your consistency.",
        "Your answers suggest discipline, awareness and emotional intelligence.",
        "The next step is building stronger routines during difficult periods.",
        "The full report can show which patterns are limiting your next level.",
      ];
    }

    if (finalScore >= 40) {
      return [
        "Your result shows potential, but also several areas that need more structure.",
        "Stress, uncertainty or self-doubt may sometimes slow your progress.",
        "You are not weak — your system simply needs better habits and clearer direction.",
        "With consistent practice, this score can improve significantly.",
        "The full report can give you a practical plan for improvement.",
      ];
    }

    return [
      "Your answers suggest that pressure may currently affect your daily performance.",
      "You may need more recovery, structure and emotional support.",
      "This result is not a diagnosis and it does not define you.",
      "It is only a starting point for building stronger habits.",
      "The full report can help you understand where to begin.",
    ];
  }

  if (!selectedTest) {
    return (
      <>
        <main className="page page-with-footer">
          <section className="hero-card">
            <div className="badge">AI-powered self-assessment platform</div>

<h1>🧠 MindScore AI</h1>

<h2 className="slogan">
  Know Yourself. Build Yourself. Become Stronger.
</h2>

<h2 className="section-title">
  Choose Your Assessment
</h2>
          <p>
            Discover your mindset, stress patterns, sleep quality and personal
            strengths through short intelligent tests.
          </p>
          <p className="free-text">
  ✓ Free basic results • AI report available
</p>
<div className="feature-row">
  <span>⭐ AI Powered</span>
  <span>🔒 Secure & Private</span>
  <span>⚡ Instant Results</span>
</div>
    <div className="social-proof">
  <p className="trusted-text">
    Join thousands discovering their true mental potential.
  </p>
</div>      

          <div className="test-grid">
            {Object.entries(tests).map(([key, item]) => (
              <button className="test-card" key={key} onClick={() => startTest(key)}>
                <span>{item.icon}</span>
                <strong>{item.title}</strong>
                <small>{item.subtitle}</small>
              </button>
            ))}
          </div>
          <p className="bottom-cta">
  Start with a free test and unlock your personalized AI report in less than 2 minutes.
</p>
          </section>
        </main>
        <SiteFooter />
      </>
    );
  }

  if (currentQuestion === test.questions.length) {
    const finalScore = Math.round((score / (test.questions.length * 5)) * 100);
      const resultLevel = getLevel(finalScore);
    const resultMessage = getMessage(finalScore);
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
        <main className="page page-with-footer">
          <section className="result-card">
            <div className="badge">Your result is ready</div>

          <h1>{test.icon} {test.title}</h1>

          <div className="score-circle">
            <span>{finalScore}</span>
            <small>/100</small>
          </div>

          <h3
  style={{
    marginTop: "18px",
    marginBottom: "18px",
    fontSize: "28px",
    lineHeight: "1.1",
    fontWeight: "800"
  }}
>
  {resultLevel}
</h3>

          <div className="result-message">
            {resultMessage.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>

          <div className="email-box">
            <h3>Unlock Your Personalized AI Report</h3>

<p>
  Enter your email to receive your personalized AI report instantly after payment.
</p>

<input
  type="email"
  placeholder="name@example.com"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
/>

<p className="email-privacy">
  🔒 We never share your email.
</p>
          </div>

          <div className="premium-offer-card">
            <div className="premium-offer-header">
              <span className="premium-pill">Premium</span>
              <h3>Unlock Premium AI Report</h3>
            </div>
            <p className="premium-offer-copy">
              A polished, downloadable report tailored to your assessment results.
            </p>
            <div className="premium-offer-meta">
              <span>€4.99</span>
              <span>Instant access</span>
              <span>Downloadable PDF</span>
            </div>
            <div className="premium-offer-grid">
              <div className="premium-benefits-card">
                <h4>What’s included</h4>
                <ul>
                  <li>Full five-dimension breakdown</li>
                  <li>Personalized AI interpretation</li>
                  <li>Strengths and blind spots</li>
                  <li>Practical recommendations</li>
                  <li>Personalized 30-day action plan</li>
                  <li>Downloadable premium PDF</li>
                </ul>
              </div>
              <div className="premium-preview-card">
                <p className="preview-label">Preview of your premium report</p>
                <div className="preview-cover">
                  <div className="preview-cover-top">Premium Report</div>
                  <div className="preview-cover-body">
                    <div className="preview-score">{finalScore}/100</div>
                    <div className="preview-meta">{strongestDimension?.name || "—"}</div>
                  </div>
                </div>
                <div className="preview-bars">
                  <div className="preview-bar-row"><span></span><i></i></div>
                  <div className="preview-bar-row"><span></span><i></i></div>
                  <div className="preview-bar-row"><span></span><i></i></div>
                </div>
                <div className="preview-plan">30-day action plan</div>
              </div>
            </div>
          </div>
          <div className="result-summary">
            <div className="result-summary-item">
              <span>Strongest dimension</span>
              <strong>{strongestDimension?.name || "—"}</strong>
            </div>
            <div className="result-summary-item">
              <span>Growth opportunity</span>
              <strong>{growthDimension?.name || "—"}</strong>
            </div>
          </div>
          {dashboardScores.length > 0 && (
  <AnalyticsDashboard data={dashboardScores} />
)}

            <div className="result-actions">
            <button
  className="primary-btn"
  onClick={startPremiumCheckout}
  disabled={isCheckoutRedirecting}
>
  {isCheckoutRedirecting ? "Redirecting to secure checkout..." : "Unlock Premium AI Report"}
</button>
            </div>
          {checkoutError && <p className="payment-error">{checkoutError}</p>}
          <p className="premium-supporting-line">€4.99 • Instant access • Downloadable PDF</p>
          <p className="premium-trust-line">Secure payment powered by Stripe</p>

            <button className="secondary-btn" onClick={restart}>
              Back to all tests
            </button>
          </section>
        </main>
        <SiteFooter />
      </>
    );
  }

  const progress = ((currentQuestion + 1) / test.questions.length) * 100;

  return (
    <>
      <main className="page page-with-footer">
        <section className="quiz-card question-animation">
          <div className="quiz-top">
          <span>
            Question {currentQuestion + 1} of {test.questions.length}
          </span>
          <span>{Math.round(progress)}%</span>
          </div>

        <div className="progress">
          <div
            className="progress-fill"
            style={{ width: `${progress}%` }}
          ></div>
        </div>

        <h1>{test.icon}</h1>
        <h2 className="question-title">
  {test.questions[currentQuestion]}
</h2>

        <div className="answers">
          {answers.map((item) => (
            <button key={item.text} onClick={() => answer(item.points)}>
              <span>{item.icon}</span>
              <strong>{item.text}</strong>
            </button>
          ))}
        </div>
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