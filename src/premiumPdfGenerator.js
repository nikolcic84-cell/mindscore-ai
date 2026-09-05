import { jsPDF } from "jspdf";

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN_LEFT = 20;
const MARGIN_RIGHT = 20;
const MARGIN_TOP = 24;
const MARGIN_BOTTOM = 16;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
const CONTENT_BOTTOM = PAGE_HEIGHT - MARGIN_BOTTOM;

const COLORS = {
  white: [255, 255, 255],
  navy: [8, 30, 75],
  navySoft: [14, 50, 119],
  blue: [43, 113, 233],
  blueSoft: [142, 190, 255],
  ink: [24, 37, 63],
  text: [48, 67, 98],
  muted: [106, 126, 160],
  line: [214, 228, 247],
  card: [248, 252, 255],
  good: [39, 149, 93],
  medium: [223, 145, 34],
  risk: [205, 72, 72],
};

const REQUIRED_SUBSECTIONS = [
  "Deep Behavioral Analysis",
  "Risk Analysis",
  "Professional Recommendations",
  "Weekly Action Plan",
  "Progress Indicators",
];

const CALLOUT_TYPES = [
  "AI Insight",
  "Expert Commentary",
  "Growth Opportunity",
  "Warning Signal",
  "Psychology Note",
  "Science Behind This Pattern",
  "Practical Example",
  "Implementation Strategy",
];

const CALLOUT_COLORS = {
  "AI Insight": [230, 241, 255],
  "Expert Commentary": [236, 246, 255],
  "Growth Opportunity": [232, 248, 240],
  "Warning Signal": [255, 240, 236],
  "Psychology Note": [240, 244, 255],
  "Science Behind This Pattern": [233, 246, 250],
  "Practical Example": [243, 247, 255],
  "Implementation Strategy": [236, 243, 255],
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const toSafeText = (value, fallback = "") => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") {
    const v = value.trim();
    return v || fallback;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    const joined = value.map((x) => toSafeText(x, "")).filter(Boolean).join(" ");
    return joined || fallback;
  }
  return fallback;
};

const _countWords = (text = "") =>
  toSafeText(text)
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean).length;

const normalizeSectionTitle = (title = "") => {
  return title
    .trim()
    .replace(/^[\s"'`([{]+/, "")
    .replace(/^\d+\.\s*/, "")
    .replace(/^[•\s-]+/, "")
    .replace(/[\s"'`)]*$/, "")
    .trim();
};

export { normalizeSectionTitle };

export const parseReportSections = (reportText = "") => {
  const lines = toSafeText(reportText, "").split(/\n/);
  const sections = [];
  let current = null;

  lines.forEach((line) => {
    const match = line.match(/^#{2,3}\s*(\d+)?(?:\.|\s+)?\s*(.+)$/);
    if (match) {
      if (current) sections.push(current);
      current = {
        number: match[1] || String(sections.length + 1),
        title: toSafeText(match[2], "Detailed analysis"),
        content: "",
      };
      return;
    }

    if (current) current.content += `${line}\n`;
  });

  if (current) sections.push(current);

  if (sections.length === 0) {
    sections.push({
      number: "1",
      title: "Detailed AI Analysis",
      content: reportText || "A personalized assessment overview is included here.",
    });
  }

  return sections;
};

const _splitContent = (content = "") => {
  const paragraphs = toSafeText(content)
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const bullets = paragraphs
    .filter((p) => /^\s*(?:[-*•]|\d+\.)\s+/.test(p))
    .map((p) => p.replace(/^\s*(?:[-*•]|\d+\.)\s+/, ""));

  const prose = paragraphs.filter((p) => !/^\s*(?:[-*•]|\d+\.)\s+/.test(p));

  return { paragraphs: prose, bullets };
};

const statusFromScore = (score) => {
  const s = clamp(Math.round(Number(score) || 0), 0, 100);
  if (s >= 80) return { label: "Strong", color: COLORS.good };
  if (s >= 60) return { label: "Moderate", color: COLORS.medium };
  return { label: "Priority", color: COLORS.risk };
};

const developmentLevel = (score) => {
  if (score >= 90) return "Advanced Adaptive Profile";
  if (score >= 80) return "High Performance Potential";
  if (score >= 70) return "Stable Growth Profile";
  if (score >= 60) return "Developing Capability Profile";
  return "Foundational Rebuild Profile";
};

const normalizeDimensions = (profileDimensions = []) => {
  const palette = [[56, 123, 236], [43, 161, 140], [117, 103, 232], [245, 164, 42], [225, 96, 106]];
  const source = profileDimensions.length ? profileDimensions : [{ name: "Your score", score: 0 }];

  return source.map((dimension, idx) => {
    const name = toSafeText(dimension?.name, `Area ${idx + 1}`);
    const score = clamp(Math.round(Number(dimension?.score) || 0), 0, 100);
    const tone = statusFromScore(score);

    return {
      id: name.toLowerCase().replace(/\s+/g, "-"),
      name,
      score,
      status: tone.label,
      statusColor: tone.color,
      color: palette[idx % palette.length],
    };
  });
};

const pick = (arr, seed, shift = 0) => arr[(seed + shift) % arr.length];

const scoreDirection = (score) => {
  if (score >= 85) return "highly stable";
  if (score >= 75) return "functionally stable";
  if (score >= 65) return "developing but inconsistent";
  if (score >= 55) return "fragile under pressure";
  return "highly vulnerable to disruption";
};

const getMajorSections = (context) => {
  return context.dimensions.map((d) => ({
    key: `dimension-${d.id}`,
    title: d.name,
    shortTitle: d.name,
    type: "dimension",
    score: d.score,
    color: d.color,
    status: d.status,
    focus: `${d.name.toLowerCase()} capability`,
  }));
};

const getProfileInsights = (dimensions, overallScore) => {
  const rankedHigh = [...dimensions].sort((a, b) => b.score - a.score);
  const rankedLow = [...dimensions].sort((a, b) => a.score - b.score);
  const strongest = rankedHigh[0];
  const secondStrongest = rankedHigh[1] || strongest;
  const weakest = rankedLow[0];
  const secondWeakest = rankedLow[1] || weakest;
  return {
    strongest,
    secondStrongest,
    weakest,
    secondWeakest,
    overallDistance: strongest.score - overallScore,
    spread: strongest.score - weakest.score,
  };
};

const buildSleepPattern = (profile, overallScore) => {
  const highNames = `${profile.strongest.name} and ${profile.secondStrongest.name}`;
  const lowNames = `${profile.weakest.name} and ${profile.secondWeakest.name}`;
  const concentration = profile.spread >= 20
    ? "The difference between these areas is pronounced, so your next step can be focused rather than broad."
    : "Your scores sit relatively close together, so a simple routine change may support the whole profile.";
  return [
    `Within this self-assessment, ${highNames} appear relatively more protected, while ${lowNames} may be worth focusing on. Your overall score of ${overallScore}/100 sits between those results, which suggests a mixed sleep picture rather than one single pattern.`,
    `${concentration} Start with ${profile.weakest.name.toLowerCase()}, then notice whether the strength in ${profile.strongest.name.toLowerCase()} gives you a useful routine to borrow.`,
  ];
};

const dimensionConnection = (major, profile, overallScore) => {
  const name = major.shortTitle;
  if (name === profile.strongest.name) {
    return `${name} is one of the more protected parts of your profile. Notice which cue or timing already supports it, then use that same cue to make ${profile.weakest.name.toLowerCase()} easier to begin.`;
  }
  if (name === profile.weakest.name) {
    return `${name} is the clearest priority within this self-assessment. The gap of ${profile.spread} points from ${profile.strongest.name} suggests that one targeted routine may be more useful than changing everything at once.`;
  }
  if (major.score > overallScore) {
    return `${name} sits above your overall score and can help steady the profile. Protect what is already working here while you focus on ${profile.weakest.name.toLowerCase()}.`;
  }
  return `${name} sits below your overall score, alongside ${profile.weakest.name}. Improving either area may make the rest of your sleep routine feel easier to maintain.`;
};

const poolFallback = (pool, seed) => {
  if (!pool.paragraphs.length) return "";
  return pool.paragraphs[seed % pool.paragraphs.length];
};

const buildSubsectionNarrative = ({ major, subsection, context, pool, seed }) => {
  const growth = context.growth.name;
  const profileLevel = developmentLevel(major.score);

  const mechanismA = [
    "habit automation is not yet fully protected when workload shifts quickly",
    "emotional carryover leaks from one context into the next decision window",
    "attention control narrows under uncertainty and produces short-term overfocus",
    "recovery rituals are skipped exactly when biological stress signals rise",
    "decision standards change with mood state instead of remaining criterion-based",
  ];

  const mechanismB = [
    "social pressure increases self-monitoring and reduces cognitive flexibility",
    "unresolved internal dialogue consumes working memory and weakens follow-through",
    "fatigue amplifies threat scanning and decreases patience for deliberate analysis",
    "implicit assumptions are treated as evidence and then reinforced by urgency",
    "micro-disappointments accumulate and trigger avoidant action selection",
  ];

  const behaviorSignals = [
    "starting strongly in the morning and losing strategic pace after unplanned interruptions",
    "performing well in structured tasks while hesitating in ambiguous social situations",
    "maintaining output but delaying emotionally difficult conversations",
    "choosing speed over reflection when stakes are high and time is limited",
    "over-delivering in visible domains while under-investing in recovery behaviors",
  ];

  const impactWork = [
    "strategic planning quality is uneven across the week",
    "meeting communication can become concise but emotionally blunt",
    "execution reliability drops when priorities are not sequenced in advance",
    "decision quality remains acceptable but rework increases",
    "delegation quality declines when trust calibration is rushed",
  ];

  const impactRelationships = [
    "partners and colleagues may perceive inconsistency in tone rather than inconsistency in values",
    "conflict recovery can take longer than necessary because repair starts too late",
    "boundaries are either too flexible or too abrupt when energy is low",
    "support requests are postponed until pressure is already high",
    "empathetic listening narrows during cognitive overload",
  ];

  const strengths = [
    "high adaptive intelligence when clear constraints are present",
    "above-average willingness to learn from difficult feedback",
    "good capacity to regain structure after temporary setbacks",
    "strong ethical orientation when decisions are reframed deliberately",
    "ability to re-engage after stress when a protocol is predefined",
  ];

  const risks = [
    "slow drift into functional burnout despite acceptable outward performance",
    "increasing decision fatigue and avoidable reversals",
    "erosion of trust due to inconsistency during conflict moments",
    "reduced innovation because cognitive bandwidth is consumed by recovery debt",
    "stalled long-term growth from repeated short-cycle reactivity",
  ];

  const recovery = [
    "standardized morning and evening routines anchored to fixed cues",
    "two-minute pre-decision pause before irreversible commitments",
    "weekly pattern review using one behavior metric and one stress metric",
    "if-then scripts for predictable trigger moments",
    "structured decompression blocks that protect sleep and emotional reset",
  ];

  const mA = pick(mechanismA, seed, 0);
  const mB = pick(mechanismB, seed, 2);
  const signal = pick(behaviorSignals, seed, 1);
  const work = pick(impactWork, seed, 3);
  const rel = pick(impactRelationships, seed, 2);
  const strength = pick(strengths, seed, 1);
  const risk = pick(risks, seed, 4);
  const rec = pick(recovery, seed, 3);

  const sourceFragment = poolFallback(pool, seed + 3);

  const p1 = `${subsection} in this chapter is interpreted through the lens of your ${major.focus}. Your current section score of ${major.score}/100 suggests a ${scoreDirection(major.score)} state shaped by repeated interaction between context, physiology, and behavior strategy. In practical terms, this pattern tends to emerge because ${mA}, and it is reinforced when ${mB}. This explains why performance can look strong in one setting and inconsistent in another setting within the same week. Professional assessment logic treats this as a systems problem, not a character flaw.`;

  const p2 = `Behaviorally, the pattern usually appears as ${signal}. The advantage is that you retain functional capacity and can produce meaningful results when expectations are explicit and structure is clear. The cost is compounding friction: ${work}. In relationships and leadership contexts, ${rel}. Over months, these dynamics can shape reputation, influence, and self-trust more than isolated achievements. A hidden positive indicator is ${strength}, and it should be used deliberately as leverage for your growth priority, ${growth}.`;

  const p3 = `If this pattern is ignored, the most likely long-term consequence is ${risk}. That outcome is preventable. The core recovery strategy is to install a disciplined protocol anchored in ${rec}, then evaluate progress weekly with objective indicators. In personal growth terms, you are currently positioned at a ${profileLevel} stage and can make meaningful gains by protecting recovery, strengthening transitions, and converting insight into execution. ${sourceFragment ? `A supporting AI observation highlights that ${sourceFragment.toLowerCase()}.` : "A supporting AI observation indicates that adaptation improves when structure and accountability are clear."}`;

  return [p1, p2, p3];
};

const buildReflectionQuestions = (major, context) => {
  const questions = [
    `Which recurring trigger undermines ${major.shortTitle} first: uncertainty, fatigue, conflict, or overload?`,
    `What behavior this week most improved your ${major.shortTitle} quality in work and relationships?`,
    `Where did urgency cause you to abandon a protocol that usually protects performance?`,
    `How can ${context.strongest.name} be deliberately used to stabilize ${context.growth.name}?`,
    `What evidence would prove that your next 30 days created structural change rather than temporary effort?`,
  ];

  return questions.join("\n");
};

const buildProgressIndicators = (major) => {
  return [
    `Weekly consistency index for ${major.shortTitle}: percentage of days where planned routines were executed as designed.`,
    "Behavior checklist completion rate: number of high-impact behaviors executed without skipping under moderate stress.",
    "Decision quality score: percentage of high-stakes decisions made with explicit criteria and post-decision review.",
    "Stress protocol adherence: number of trigger events where pause, reframe, and recovery sequence was used correctly.",
    `30-day target: improve ${major.shortTitle} by process quality first, then score movement; score should follow behavioral reliability.`,
    "90-day roadmap signal: lower variance between intention and action across difficult weeks, not only easy weeks.",
  ].join("\n");
};

const buildWeeklyPlan = () => {
  return [
    "Week 1: Baseline mapping and friction audit. Track when behavior quality drops and identify the first trigger in the chain.",
    "Week 2: Install two micro habits and one morning routine anchor. Keep actions small enough to execute even on low-energy days.",
    "Week 3: Apply a decision framework for all important commitments. Separate reversible and irreversible decisions before action.",
    "Week 4: Review outcomes, remove one recurring friction point, and harden the stress recovery protocol for future overload periods.",
    "Daily reflection: one sentence on what improved performance, one sentence on what degraded performance, and one correction for tomorrow.",
    "Evening routine: decompression, cognitive closure, and next-day preplanning to protect sleep and emotional reset quality.",
    "Behavior checklist: complete pause protocol, execute priority block, perform boundary communication, and run end-of-day review.",
  ].join("\n");
};

const buildCoachNotes = (major, context) => {
  return [
    `Coach Note 1: treat ${major.shortTitle} as a professional skill, not a personality label.`,
    "Coach Note 2: when stressed, reduce complexity; use protocol mode and execute minimum viable high-quality behavior.",
    `Coach Note 3: your leverage dimension is ${context.strongest.name}; pair one reliable habit from that domain with one weak behavior here.`,
    "Coach Note 4: run personal experiments weekly, but keep only interventions that improve both performance and recovery.",
    "Coach Note 5: if two difficult days occur in sequence, activate recovery protocol immediately instead of waiting for motivation to return.",
  ].join("\n");
};

const createSubsectionText = ({ major, subsection, context, pool, seed }) => {
  if (subsection === "Reflection Questions") {
    const foundation = buildSubsectionNarrative({ major, subsection, context, pool, seed });
    return [...foundation, buildReflectionQuestions(major, context)];
  }

  if (subsection === "Progress Indicators") {
    const foundation = buildSubsectionNarrative({ major, subsection, context, pool, seed });
    return [...foundation, buildProgressIndicators(major)];
  }

  if (subsection === "Weekly Action Plan") {
    const foundation = buildSubsectionNarrative({ major, subsection, context, pool, seed });
    return [...foundation, buildWeeklyPlan()];
  }

  if (subsection === "AI Coaching Notes") {
    const foundation = buildSubsectionNarrative({ major, subsection, context, pool, seed });
    return [...foundation, buildCoachNotes(major, context)];
  }

  if (subsection === "Professional Recommendations") {
    const foundation = buildSubsectionNarrative({ major, subsection, context, pool, seed });
    const recommendations = [
      "Recommendation 1: define one non-negotiable behavior that protects this domain during high-pressure days.",
      "Recommendation 2: implement a morning routine and evening routine with fixed triggers and short execution windows.",
      "Recommendation 3: use a habit tracker and weekly review to verify progress objectively.",
      "Recommendation 4: install micro habits for transitions between tasks, meetings, and personal commitments.",
      "Recommendation 5: run a stress protocol before important decisions, then apply a written decision framework.",
      "Recommendation 6: schedule a 90-day roadmap checkpoint to evaluate long-term consequences and recovery strategy effectiveness.",
    ].join("\n");
    return [...foundation, recommendations];
  }

  if (subsection === "Real Life Examples") {
    const foundation = buildSubsectionNarrative({ major, subsection, context, pool, seed });
    const examples = [
      "Example A: a manager receives critical feedback before a client meeting and uses a two-minute pause protocol to avoid reactive communication.",
      "Example B: an entrepreneur faces ambiguous data and applies a reversible versus irreversible decision map to reduce regret-driven decisions.",
      "Example C: a team lead notices emotional spillover after conflict, uses a reset routine, and restores boundary quality before the next conversation.",
      "Example D: during a high-load week, a professional protects sleep and daily reflection, preventing small errors from escalating into burnout patterns.",
    ].join("\n");
    return [...foundation, examples];
  }

  return buildSubsectionNarrative({ major, subsection, context, pool, seed });
};

const _createAssessmentContent = (context, pool) => {
  const majorSections = getMajorSections(context);

  return majorSections.map((major, majorIndex) => {
    const subsectionBlocks = REQUIRED_SUBSECTIONS.map((subsection, subsectionIndex) => {
      const seed = majorIndex * 31 + subsectionIndex * 7 + 11;
      const paragraphs = createSubsectionText({
        major,
        subsection,
        context,
        pool,
        seed,
      });

      const calloutTypeA = pick(CALLOUT_TYPES, seed, 0);
      const calloutTypeB = pick(CALLOUT_TYPES, seed, 3);

      const calloutTextA = `${calloutTypeA}: ${major.shortTitle} improves fastest when behavior is standardized before motivation declines.`;
      const calloutTextB = `${calloutTypeB}: monitor early warning signals and activate recovery strategy before errors accumulate.`;

      return {
        title: subsection,
        paragraphs,
        callouts: [
          { type: calloutTypeA, text: calloutTextA },
          { type: calloutTypeB, text: calloutTextB },
        ],
      };
    });

    return {
      ...major,
      subsections: subsectionBlocks,
    };
  });
};

const drawSolidPageBackground = (doc, dark = false) => {
  if (dark) {
    doc.setFillColor(...COLORS.navy);
    doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, "F");
    return;
  }

  doc.setFillColor(...COLORS.white);
  doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, "F");
};

const drawScoreCircle = (doc, cx, cy, score, onDark = false, radius = 29) => {
  const s = clamp(Math.round(Number(score) || 0), 0, 100);
  const status = statusFromScore(s);
  const ring = status.color;
  const ringRadius = radius - 5;

  doc.setFillColor(onDark ? 22 : 238, onDark ? 50 : 247, onDark ? 113 : 255);
  doc.circle(cx, cy, radius, "F");

  doc.setDrawColor(215, 230, 250);
  doc.setLineWidth(4);
  doc.circle(cx, cy, ringRadius, "S");

  doc.setDrawColor(ring[0], ring[1], ring[2]);
  doc.setLineWidth(4.4);
  const arc = Math.round((360 * s) / 100);
  for (let d = 0; d < arc; d += 3) {
    const a1 = ((-90 + d) * Math.PI) / 180;
    const a2 = ((-90 + d + 2.4) * Math.PI) / 180;
    doc.line(cx + Math.cos(a1) * ringRadius, cy + Math.sin(a1) * ringRadius, cx + Math.cos(a2) * ringRadius, cy + Math.sin(a2) * ringRadius);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(radius < 29 ? 21 : 24);
  doc.setTextColor(...(onDark ? COLORS.white : COLORS.ink));
  doc.text(String(s), cx, cy + 2.2, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(radius < 29 ? 8.7 : 9.8);
  doc.setTextColor(...(onDark ? [214, 228, 250] : COLORS.muted));
  doc.text("Overall Score", cx, cy + (radius < 29 ? 9.4 : 10.7), { align: "center" });
};

const drawHeader = (doc, title, subtitle) => {
  doc.setFillColor(...COLORS.navy);
  doc.rect(0, 0, PAGE_WIDTH, 18, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.8);
  doc.setTextColor(...COLORS.white);
  doc.text("MindScore AI Premium", MARGIN_LEFT, 11.5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...COLORS.white);
  doc.text(toSafeText(title), PAGE_WIDTH / 2, 11.5, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.9);
  doc.setTextColor(210, 226, 252);
  doc.text(toSafeText(subtitle), PAGE_WIDTH - MARGIN_RIGHT, 11.5, { align: "right" });
};

const drawFooter = (doc, page, total) => {
  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(0.35);
  doc.line(MARGIN_LEFT, PAGE_HEIGHT - 10.2, PAGE_WIDTH - MARGIN_RIGHT, PAGE_HEIGHT - 10.2);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.7);
  doc.setTextColor(...COLORS.muted);
  doc.text("MindScore AI Premium Report", MARGIN_LEFT, PAGE_HEIGHT - 6.2);
  doc.text(`Page ${page} of ${total}`, PAGE_WIDTH - MARGIN_RIGHT, PAGE_HEIGHT - 6.2, { align: "right" });
};

const writeWrappedText = (doc, text, x, y, width, options = {}) => {
  const size = options.size || 12.2;
  const lineHeight = options.lineHeight || 7.1;
  const style = options.style || "normal";
  const color = options.color || COLORS.text;

  doc.setFont("helvetica", style);
  doc.setFontSize(size);
  doc.setTextColor(...color);

  const linesRaw = doc.splitTextToSize(toSafeText(text, ""), width);
  const lines = Array.isArray(linesRaw) ? linesRaw : [toSafeText(linesRaw, "")];
  doc.text(lines, x, y, { maxWidth: width });

  return {
    lines,
    nextY: y + lines.length * lineHeight,
    height: lines.length * lineHeight,
  };
};

const createFlowContext = (doc, startY = MARGIN_TOP + 8, debug = false) => ({
  doc,
  y: startY,
  headerTitle: "Sleep quality insights",
  headerSubtitle: "Your personalized report",
  hasBodyContent: false,
  debug,
});

const startBodyPage = (flow, title, subtitle) => {
  flow.doc.addPage();
  drawSolidPageBackground(flow.doc, false);
  drawHeader(flow.doc, title, subtitle);
  flow.y = MARGIN_TOP + 8;
  flow.headerTitle = title;
  flow.headerSubtitle = subtitle;
};

const ensureSpace = (flow, heightNeeded, blockName = "Content block") => {
  const currentPage = flow.doc.getNumberOfPages();
  const startY = flow.y;
  const pageBreak = flow.y + heightNeeded > CONTENT_BOTTOM;
  if (pageBreak) startBodyPage(flow, flow.headerTitle, flow.headerSubtitle);
  if (flow.debug) {
    const page = flow.doc.getNumberOfPages();
    console.log(`[premium-pdf] PAGE ${page} | ${blockName} | START Y ${flow.y.toFixed(1)} | HEIGHT ${heightNeeded.toFixed(1)} | END Y ${(flow.y + heightNeeded).toFixed(1)} | PAGE BREAK ${pageBreak ? `YES (from ${currentPage} at ${startY.toFixed(1)})` : "NO"}`);
  }
};

const startDimensionFlow = (flow) => {
  flow.hasBodyContent = true;
  return flow.doc.getNumberOfPages();
};

const drawIcon = (doc, type, x, y, size = 1) => {
  const s = size;
  doc.setDrawColor(43, 113, 233);
  doc.setFillColor(230, 241, 255);
  doc.setLineWidth(0.75 * s);

  if (type === "moon") {
    doc.setFillColor(43, 113, 233);
    doc.circle(x, y, 5.8 * s, "F");
    doc.setFillColor(...COLORS.white);
    doc.circle(x + 2.8 * s, y - 1.2 * s, 5.8 * s, "F");
    doc.setDrawColor(43, 113, 233);
    doc.circle(x, y, 5.8 * s, "S");
    doc.setFillColor(43, 161, 140);
    [[7, -5], [9, 1], [5, 5]].forEach(([dx, dy]) => doc.circle(x + dx * s, y + dy * s, 0.7 * s, "F"));
    return;
  }

  if (type === "bed") {
    doc.roundedRect(x - 8 * s, y - 1 * s, 15 * s, 6 * s, 1.5 * s, 1.5 * s, "S");
    doc.line(x - 8 * s, y - 4 * s, x - 8 * s, y + 6 * s);
    doc.roundedRect(x - 5.5 * s, y - 3 * s, 4 * s, 2.5 * s, 1 * s, 1 * s, "S");
    doc.circle(x + 7.5 * s, y - 5 * s, 2.4 * s, "S");
    doc.setFillColor(...COLORS.white);
    doc.circle(x + 8.7 * s, y - 5.4 * s, 2.2 * s, "F");
    return;
  }

  if (type === "waves") {
    for (let row = 0; row < 3; row += 1) {
      const yy = y - 4 * s + row * 4 * s;
      doc.lines([[3 * s, -2 * s], [4 * s, 2 * s], [4 * s, -2 * s], [3 * s, 2 * s]], x - 8 * s, yy);
    }
    return;
  }

  if (type === "brain") {
    doc.circle(x - 4 * s, y - 2 * s, 3 * s, "S");
    doc.circle(x + 1 * s, y - 3 * s, 3.2 * s, "S");
    doc.circle(x + 4 * s, y + 1 * s, 3 * s, "S");
    doc.line(x - 6 * s, y + 2 * s, x - 1 * s, y + 5 * s);
    doc.line(x - 1 * s, y + 5 * s, x + 5 * s, y + 3 * s);
    doc.circle(x + 8 * s, y - 5 * s, 2 * s, "S");
    doc.setFillColor(...COLORS.white);
    doc.circle(x + 9 * s, y - 5.4 * s, 1.8 * s, "F");
    return;
  }

  if (type === "sun") {
    doc.circle(x, y, 4 * s, "S");
    for (let i = 0; i < 8; i += 1) {
      const angle = (Math.PI * 2 * i) / 8;
      doc.line(x + Math.cos(angle) * 6 * s, y + Math.sin(angle) * 6 * s, x + Math.cos(angle) * 8.5 * s, y + Math.sin(angle) * 8.5 * s);
    }
    return;
  }

  if (type === "clock") {
    doc.circle(x, y, 6 * s, "S");
    doc.line(x, y, x, y - 3.8 * s);
    doc.line(x, y, x + 3 * s, y + 1.8 * s);
    return;
  }

  if (type === "calendar") {
    doc.roundedRect(x - 7 * s, y - 6 * s, 14 * s, 12 * s, 1.5 * s, 1.5 * s, "S");
    doc.line(x - 7 * s, y - 2.5 * s, x + 7 * s, y - 2.5 * s);
    doc.line(x - 3 * s, y - 8 * s, x - 3 * s, y - 4.8 * s);
    doc.line(x + 3 * s, y - 8 * s, x + 3 * s, y - 4.8 * s);
    doc.line(x - 2.5 * s, y + 1.2 * s, x - 0.4 * s, y + 3.5 * s);
    doc.line(x - 0.4 * s, y + 3.5 * s, x + 4 * s, y - 1.5 * s);
    return;
  }

  if (type === "check") {
    doc.roundedRect(x - 6 * s, y - 6 * s, 12 * s, 12 * s, 2 * s, 2 * s, "S");
    doc.line(x - 3.5 * s, y, x - 0.8 * s, y + 2.8 * s);
    doc.line(x - 0.8 * s, y + 2.8 * s, x + 4.2 * s, y - 3 * s);
    return;
  }

  if (type === "shield") {
    doc.lines([[5 * s, 2 * s], [0, 7 * s], [-5 * s, -7 * s], [0, -5 * s], [5 * s, 3 * s]], x - 5 * s, y - 5 * s);
    doc.line(x - 2 * s, y, x, y + 2 * s);
    doc.line(x, y + 2 * s, x + 4 * s, y - 3 * s);
    return;
  }

  if (type === "chart") {
    doc.line(x - 7 * s, y + 5 * s, x + 7 * s, y + 5 * s);
    doc.line(x - 7 * s, y + 5 * s, x - 7 * s, y - 6 * s);
    doc.line(x - 5 * s, y + 2 * s, x - 1 * s, y - 1 * s);
    doc.line(x - 1 * s, y - 1 * s, x + 2.5 * s, y + 1 * s);
    doc.line(x + 2.5 * s, y + 1 * s, x + 6 * s, y - 4 * s);
    return;
  }

  if (type === "home") {
    doc.lines([[6 * s, 5 * s], [0, 8 * s], [-12 * s, 0], [0, -8 * s], [6 * s, -5 * s]], x - 6 * s, y - 3 * s);
    doc.roundedRect(x - 4.5 * s, y + 1 * s, 9 * s, 6 * s, 1 * s, 1 * s, "S");
    doc.line(x - 1.5 * s, y + 7 * s, x - 1.5 * s, y + 3.5 * s);
    doc.line(x + 1.5 * s, y + 7 * s, x + 1.5 * s, y + 3.5 * s);
    return;
  }

  if (type === "target") {
    doc.circle(x, y, 6 * s, "S");
    doc.circle(x, y, 3 * s, "S");
    doc.line(x + 1.5 * s, y - 1.5 * s, x + 7 * s, y - 7 * s);
    doc.line(x + 7 * s, y - 7 * s, x + 7 * s, y - 3.5 * s);
    doc.line(x + 7 * s, y - 7 * s, x + 3.5 * s, y - 7 * s);
    return;
  }

  if (type === "bulb") {
    doc.circle(x, y - 2 * s, 3.8 * s, "S");
    doc.line(x - 2.2 * s, y + 2.6 * s, x + 2.2 * s, y + 2.6 * s);
    doc.line(x - 1.5 * s, y + 4.2 * s, x + 1.5 * s, y + 4.2 * s);
  }
};

const iconTypeForTitle = (title) => {
  if (/Your Sleep Profile|sleep pattern/i.test(title)) return "moon";
  if (/Sleep Recovery/i.test(title)) return "bed";
  if (/Sleep Continuity/i.test(title)) return "waves";
  if (/Cognitive Wind-Down/i.test(title)) return "brain";
  if (/Daytime Clarity/i.test(title)) return "sun";
  if (/Sleep Consistency/i.test(title)) return "clock";
  if (/30-day action plan/i.test(title)) return "calendar";
  return "moon";
};

const drawSleepAccent = (doc, title, y) => {
  drawIcon(doc, iconTypeForTitle(title), PAGE_WIDTH - MARGIN_RIGHT - 12, y - 4, 0.78);
};

const drawSectionTitle = (flow, text, bottomGap = 6.5) => {
  ensureSpace(flow, 15.5, `Heading: ${text}`);
  flow.doc.setFont("helvetica", "bold");
  flow.doc.setFontSize(19.5);
  flow.doc.setTextColor(...COLORS.ink);
  flow.doc.text(text, MARGIN_LEFT, flow.y);
  drawSleepAccent(flow.doc, text, flow.y);
  flow.y += 9;

  flow.doc.setDrawColor(...COLORS.line);
  flow.doc.setLineWidth(0.5);
  flow.doc.line(MARGIN_LEFT, flow.y, PAGE_WIDTH - MARGIN_RIGHT, flow.y);
  flow.y += bottomGap;
};

const drawSubsectionTitle = (flow, text) => {
  ensureSpace(flow, 7.5, `Subheading: ${text}`);
  flow.doc.setFont("helvetica", "bold");
  flow.doc.setFontSize(15.7);
  flow.doc.setTextColor(...COLORS.ink);
  flow.doc.text(text, MARGIN_LEFT, flow.y);
  flow.y += 7.5;
};

const drawParagraph = (flow, text, bottomGap = 4.4) => {
  const width = CONTENT_WIDTH;
  const lineHeight = 7.1;
  flow.doc.setFont("helvetica", "normal");
  flow.doc.setFontSize(12.2);
  const linesRaw = flow.doc.splitTextToSize(toSafeText(text, ""), width);
  const lines = Array.isArray(linesRaw) ? linesRaw : [toSafeText(linesRaw, "")];
  const height = lines.length * lineHeight;

  ensureSpace(flow, height + bottomGap, "Paragraph");

  writeWrappedText(flow.doc, text, MARGIN_LEFT, flow.y, width, {
    size: 12.2,
    lineHeight,
    style: "normal",
    color: COLORS.text,
  });
  flow.y += height + bottomGap;
};

const drawMiniProgressBar = (flow, label, score, color) => {
  ensureSpace(flow, 8.5, `Score bar: ${label}`);
  flow.doc.setFont("helvetica", "bold");
  flow.doc.setFontSize(10.2);
  flow.doc.setTextColor(...COLORS.muted);
  flow.doc.text(label, MARGIN_LEFT, flow.y);

  const barY = flow.y + 2.4;
  const barW = 80;
  const barH = 4.2;

  flow.doc.setFillColor(232, 239, 251);
  flow.doc.roundedRect(MARGIN_LEFT + 44, barY - 3.3, barW, barH, 2, 2, "F");

  const fillW = (barW * clamp(score, 0, 100)) / 100;
  flow.doc.setFillColor(color[0], color[1], color[2]);
  flow.doc.roundedRect(MARGIN_LEFT + 44, barY - 3.3, fillW, barH, 2, 2, "F");

  flow.doc.setFont("helvetica", "bold");
  flow.doc.setFontSize(10.6);
  flow.doc.setTextColor(...COLORS.ink);
  flow.doc.text(`${Math.round(score)}/100`, MARGIN_LEFT + 132, flow.y, { align: "right" });

  flow.y += 8.5;
};

const drawComparisonChart = (flow, major) => {
  ensureSpace(flow, 27.6, "Score comparison");

  flow.doc.setFont("helvetica", "bold");
  flow.doc.setFontSize(11.3);
  flow.doc.setTextColor(...COLORS.ink);
  flow.doc.text("Your personal comparison", MARGIN_LEFT, flow.y);
  flow.y += 6;

  const rows = [
    { label: "This area", value: major.score, color: major.color || COLORS.blue },
    { label: "Overall score", value: flow.context.overallScore, color: [110, 136, 190] },
    { label: "Strongest area", value: flow.context.strongest.score, color: flow.context.strongest.color },
  ];

  rows.forEach((row) => {
    ensureSpace(flow, 9);
    flow.doc.setFont("helvetica", "normal");
    flow.doc.setFontSize(10.1);
    flow.doc.setTextColor(...COLORS.text);
    flow.doc.text(row.label, MARGIN_LEFT, flow.y);

    const bx = MARGIN_LEFT + 40;
    const bw = 100;
    const bh = 3.8;

    flow.doc.setFillColor(231, 238, 250);
    flow.doc.roundedRect(bx, flow.y - 3.2, bw, bh, 1.8, 1.8, "F");

    const fw = (bw * clamp(row.value, 0, 100)) / 100;
    flow.doc.setFillColor(row.color[0], row.color[1], row.color[2]);
    flow.doc.roundedRect(bx, flow.y - 3.2, fw, bh, 1.8, 1.8, "F");

    flow.doc.setFont("helvetica", "bold");
    flow.doc.setFontSize(10.2);
    flow.doc.setTextColor(...COLORS.ink);
    flow.doc.text(`${Math.round(row.value)}%`, MARGIN_LEFT + 145, flow.y, { align: "right" });

    flow.y += 6.7;
  });

  flow.y += 1.5;

  drawParagraph(flow, `This is a comparison within your own results. ${major.shortTitle} is ${Math.abs(major.score - flow.context.overallScore)} points ${major.score >= flow.context.overallScore ? "above" : "below"} your overall score.`);
};

const drawScoreComparisonSentence = (flow, major, context) => {
  const fromOverall = major.score - context.overallScore;
  const fromStrongest = context.profile.strongest.score - major.score;
  const sentence = major.shortTitle === context.profile.strongest.name
    ? `${major.shortTitle} is your strongest area, ${Math.abs(fromOverall)} points ${fromOverall >= 0 ? "above" : "below"} your overall score.`
    : `${major.shortTitle} is ${Math.abs(fromOverall)} points ${fromOverall >= 0 ? "above" : "below"} your overall score and ${fromStrongest} points below your strongest area.`;
  drawParagraph(flow, sentence, 3);
};

const drawCallout = (flow, type, text) => {
  const fill = CALLOUT_COLORS[type] || COLORS.card;
  const width = CONTENT_WIDTH;
  const x = MARGIN_LEFT;

  const textWidth = type === "Your next step" ? width - 24 : width - 10;
  const linesRaw = flow.doc.splitTextToSize(toSafeText(text, ""), textWidth);
  const lines = Array.isArray(linesRaw) ? linesRaw : [toSafeText(linesRaw, "")];
  const lineHeight = 6.2;
  const contentHeight = lines.length * lineHeight;
  const boxHeight = 11 + contentHeight;

  ensureSpace(flow, boxHeight + 4.5, `Callout: ${type}`);

  flow.doc.setFillColor(fill[0], fill[1], fill[2]);
  flow.doc.roundedRect(x, flow.y, width, boxHeight, 2.7, 2.7, "F");

  flow.doc.setFillColor(...COLORS.navy);
  flow.doc.rect(x, flow.y, 2.8, boxHeight, "F");
  if (type === "Your next step") {
    drawIcon(flow.doc, "target", x + width - 10, flow.y + 9, 0.55);
  }

  flow.doc.setFont("helvetica", "bold");
  flow.doc.setFontSize(10.3);
  flow.doc.setTextColor(...COLORS.ink);
  flow.doc.text(type, x + 5.2, flow.y + 6.2);

  flow.doc.setFont("helvetica", "normal");
  flow.doc.setFontSize(11.2);
  flow.doc.setTextColor(...COLORS.text);
  flow.doc.text(lines, x + 5.2, flow.y + 12, { maxWidth: textWidth });

  flow.y += boxHeight + 4.5;
};

const didYouKnowText = (major) => {
  const name = major.shortTitle;
  const score = `${major.score}/100`;
  if (name.includes("Recovery")) {
    return `Sleep is an active recovery period, not just time spent in bed. Your ${name} score of ${score} makes restoration a useful signal to watch this week.`;
  }
  if (name.includes("Continuity")) {
    return `Sleep can feel less refreshing when the night is repeatedly interrupted, even if time in bed seems adequate. Your ${name} score of ${score} makes night-to-night smoothness worth observing.`;
  }
  if (name.includes("Wind-Down")) {
    return `The mind often needs a clear transition before sleep, especially after stimulating or unresolved tasks. Your ${name} score of ${score} suggests this transition may deserve extra attention.`;
  }
  if (name.includes("Clarity")) {
    return `Daytime alertness can give useful context when judging how well sleep is supporting you. Your ${name} score of ${score} can help you notice whether mornings and afternoons tell the same story.`;
  }
  return `A regular sleep and wake rhythm can make bedtime feel more predictable over time. Your ${name} score of ${score} makes routine timing a useful pattern to track.`;
};

const drawDidYouKnow = (flow, major) => {
  const text = didYouKnowText(major);
  const lines = flow.doc.splitTextToSize(text, CONTENT_WIDTH - 18);
  const boxHeight = 16 + lines.length * 5.4;
  ensureSpace(flow, boxHeight + 4, `Did you know: ${major.shortTitle}`);

  flow.doc.setFillColor(236, 246, 255);
  flow.doc.roundedRect(MARGIN_LEFT, flow.y, CONTENT_WIDTH, boxHeight, 3, 3, "F");
  flow.doc.setDrawColor(214, 228, 247);
  flow.doc.roundedRect(MARGIN_LEFT, flow.y, CONTENT_WIDTH, boxHeight, 3, 3, "S");
  drawIcon(flow.doc, "bulb", MARGIN_LEFT + 8, flow.y + 10, 0.62);
  flow.doc.setFont("helvetica", "bold");
  flow.doc.setFontSize(9.2);
  flow.doc.setTextColor(...COLORS.ink);
  flow.doc.text("DID YOU KNOW?", MARGIN_LEFT + 16, flow.y + 8);
  flow.doc.setFont("helvetica", "normal");
  flow.doc.setFontSize(10.4);
  flow.doc.setTextColor(...COLORS.text);
  flow.doc.text(lines, MARGIN_LEFT + 16, flow.y + 15, { maxWidth: CONTENT_WIDTH - 18 });
  flow.y += boxHeight + 4;
};

const dimensionDefinition = (name) => {
  if (name.includes("Recovery")) return "How restored you feel after sleep. In everyday terms: do you wake up feeling that sleep actually helped you recharge?";
  if (name.includes("Continuity")) return "How uninterrupted your sleep tends to feel. Waking often, lying awake for a while, or feeling restless can make sleep feel less continuous.";
  if (name.includes("Wind-Down")) return "How easily your mind shifts from daytime activity into sleep mode. If you lie in bed thinking, planning, scrolling, or replaying the day, this area may feel harder.";
  if (name.includes("Clarity")) return "How clear, alert, and mentally present you tend to feel during the day. It is about how your sleep seems to show up after you wake.";
  return "How regular your sleep and wake times are from day to day. It looks at whether your routine has a predictable rhythm.";
};

const drawInRealLife = (flow, text) => {
  const lines = flow.doc.splitTextToSize(text, CONTENT_WIDTH - 10);
  const boxHeight = 13 + lines.length * 5.6;
  ensureSpace(flow, boxHeight + 4, "In real life");
  flow.doc.setFillColor(248, 252, 255);
  flow.doc.roundedRect(MARGIN_LEFT, flow.y, CONTENT_WIDTH, boxHeight, 3, 3, "F");
  flow.doc.setDrawColor(214, 228, 247);
  flow.doc.roundedRect(MARGIN_LEFT, flow.y, CONTENT_WIDTH, boxHeight, 3, 3, "S");
  flow.doc.setFont("helvetica", "bold");
  flow.doc.setFontSize(9.2);
  flow.doc.setTextColor(...COLORS.ink);
  drawIcon(flow.doc, "home", MARGIN_LEFT + 7, flow.y + 8, 0.55);
  flow.doc.text("IN REAL LIFE", MARGIN_LEFT + 15, flow.y + 7);
  flow.doc.setFont("helvetica", "normal");
  flow.doc.setFontSize(10.4);
  flow.doc.setTextColor(...COLORS.text);
  flow.doc.text(lines, MARGIN_LEFT + 15, flow.y + 14, { maxWidth: CONTENT_WIDTH - 20 });
  flow.y += boxHeight + 4;
};

const drawThreeTiles = (flow, tiles, bottomGap = 5) => {
  const gap = 4;
  const width = (CONTENT_WIDTH - gap * 2) / 3;
  const height = 38;
  ensureSpace(flow, height + bottomGap, "Action card row");

  tiles.forEach((tile, index) => {
    const x = MARGIN_LEFT + index * (width + gap);
    flow.doc.setFillColor(...(tile.fill || COLORS.card));
    flow.doc.roundedRect(x, flow.y, width, height, 3.4, 3.4, "F");
    flow.doc.setDrawColor(...COLORS.line);
    flow.doc.setLineWidth(0.3);
    flow.doc.roundedRect(x, flow.y, width, height, 3.4, 3.4, "S");
    flow.doc.setFont("helvetica", "bold");
    flow.doc.setFontSize(8.1);
    flow.doc.setTextColor(...COLORS.muted);
    flow.doc.text(tile.label.toUpperCase(), x + 4, flow.y + 7);
    flow.doc.setFontSize(9.4);
    flow.doc.setTextColor(...COLORS.ink);
    const lines = flow.doc.splitTextToSize(tile.text, width - 8);
    flow.doc.text(lines.slice(0, 4), x + 4, flow.y + 15, { maxWidth: width - 8 });
  });

  flow.y += height + bottomGap;
};

const drawActionPlanCard = (flow, card) => {
  const cardGap = 2;
  const labelWidth = 40;
  const valueX = MARGIN_LEFT + labelWidth + 24;
  const valueWidth = PAGE_WIDTH - MARGIN_RIGHT - valueX - 6;
  const lineHeight = 5.2;
  const rowGap = 4;
  const topPadding = 12;
  const bottomPadding = 8;
  flow.doc.setFont("helvetica", "normal");
  flow.doc.setFontSize(9.6);
  const rows = [
    { label: "WHAT TO DO", text: card.what },
    { label: "HOW", text: card.how },
    { label: "WHY", text: card.why },
  ].map((row) => ({
    ...row,
    lines: flow.doc.splitTextToSize(row.text, valueWidth),
  }));
  const contentHeight = rows.reduce((sum, row, index) => {
    return sum + row.lines.length * lineHeight + (index < rows.length - 1 ? rowGap : 0);
  }, 0);
  const boxHeight = Math.max(42, topPadding + contentHeight + bottomPadding);
  ensureSpace(flow, boxHeight + cardGap, `Action plan: ${card.label}`);

  flow.doc.setFillColor(...(card.fill || COLORS.card));
  flow.doc.roundedRect(MARGIN_LEFT, flow.y, CONTENT_WIDTH, boxHeight, 3.4, 3.4, "F");
  flow.doc.setDrawColor(...COLORS.line);
  flow.doc.roundedRect(MARGIN_LEFT, flow.y, CONTENT_WIDTH, boxHeight, 3.4, 3.4, "S");
  drawIcon(flow.doc, card.icon, MARGIN_LEFT + 10, flow.y + 14, 0.78);
  flow.doc.setFont("helvetica", "bold");
  flow.doc.setFontSize(8.8);
  flow.doc.setTextColor(...COLORS.ink);
  flow.doc.text(card.label.toUpperCase(), MARGIN_LEFT + 21, flow.y + 10);

  let textY = flow.y + topPadding;
  rows.forEach((row, index) => {
    flow.doc.setFont("helvetica", "bold");
    flow.doc.setFontSize(8.8);
    flow.doc.setTextColor(...COLORS.muted);
    flow.doc.text(row.label, MARGIN_LEFT + labelWidth, textY);
    flow.doc.setFont("helvetica", "normal");
    flow.doc.setFontSize(9.6);
    flow.doc.setTextColor(...COLORS.text);
    flow.doc.text(row.lines, valueX, textY, { maxWidth: valueWidth });
    textY += row.lines.length * lineHeight + (index < rows.length - 1 ? rowGap : 0);
  });

  flow.y += boxHeight + cardGap;
};

const measureActionPlanCardHeight = (doc, card) => {
  const cardGap = 2;
  const labelWidth = 40;
  const valueX = MARGIN_LEFT + labelWidth + 24;
  const valueWidth = PAGE_WIDTH - MARGIN_RIGHT - valueX - 6;
  const lineHeight = 5.2;
  const rowGap = 4;
  const topPadding = 12;
  const bottomPadding = 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.6);
  const rowHeights = [card.what, card.how, card.why].map((text) => doc.splitTextToSize(text, valueWidth).length * lineHeight);
  const contentHeight = rowHeights.reduce((sum, height, index) => sum + height + (index < rowHeights.length - 1 ? rowGap : 0), 0);
  return Math.max(42, topPadding + contentHeight + bottomPadding) + cardGap;
};

const measureParagraphHeight = (doc, text) => {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12.2);
  const lines = doc.splitTextToSize(toSafeText(text, ""), CONTENT_WIDTH);
  return lines.length * 7.1 + 4.4;
};

const sleepGuidance = (name) => {
  const key = name.toLowerCase();
  if (key.includes("recovery")) return { tonight: "Give yourself a calm 20 minutes before bed.", week: "Keep a simple wind-down cue for seven nights.", quick: "Leave tomorrow's first task ready before bed." };
  if (key.includes("continuity")) return { tonight: "Keep the bedroom calm and ready for sleep.", week: "Protect the same wake-up window most days.", quick: "Move one disruption out of reach before bed." };
  if (key.includes("wind")) return { tonight: "Put one screen away for the final 30 minutes.", week: "Start your wind-down at a repeatable time.", quick: "Write down one thought you do not need to solve tonight." };
  if (key.includes("clarity")) return { tonight: "Set up one easier morning step before bed.", week: "Notice when you feel most clear during the day.", quick: "Get daylight early when you can." };
  if (key.includes("consistency")) return { tonight: "Choose a realistic bedtime window for tonight.", week: "Keep bedtime within a 30-45 minute window.", quick: "Set one reminder to begin winding down." };
  return { tonight: "Choose one calming step before bed.", week: "Repeat one sleep-supporting habit for seven days.", quick: "Make your next bedtime step easier to start." };
};

const renderCoverPage = (doc, context) => {
  drawSolidPageBackground(doc, true);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(23.5);
  doc.setTextColor(...COLORS.white);
  doc.text("MindScore AI Premium Report", MARGIN_LEFT, 31);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12.8);
  doc.setTextColor(214, 229, 252);
  doc.text(context.isSleep ? "Your personalized sleep quality guide" : "Your personalized assessment guide", MARGIN_LEFT, 42);

  drawScoreCircle(doc, PAGE_WIDTH - 30, 57, context.overallScore, true, 25);

  doc.setFillColor(15, 45, 106);
  doc.roundedRect(MARGIN_LEFT, 57, 128, 76, 4.5, 4.5, "F");

  const leftMeta = [
    ["Assessment Date", context.assessmentDate],
    ["Assessment Type", context.selectedTestTitle],
    ["Priority Level", context.priorityLevel],
    ["Strongest Dimension", context.strongest.name],
    ["Growth Opportunity", context.growth.name],
    ["Estimated Reading Time", context.readingTime],
  ];

  let y = 67;
  leftMeta.forEach(([k, v]) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.2);
    doc.setTextColor(172, 201, 244);
    doc.text(k, MARGIN_LEFT + 5, y);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.8);
    doc.setTextColor(...COLORS.white);
    const value = toSafeText(v, "-");
    doc.text(value, MARGIN_LEFT + 55, y, { maxWidth: 62 });

    y += 10.2;
  });

  doc.setFillColor(230, 241, 255);
  doc.roundedRect(MARGIN_LEFT, 148, CONTENT_WIDTH, 43, 4.5, 4.5, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13.8);
  doc.setTextColor(...COLORS.ink);
  doc.text("YOUR RESULT AT A GLANCE", MARGIN_LEFT + 7, 158);

  doc.setFontSize(20);
  doc.text(`${context.overallScore}/100`, MARGIN_LEFT + 7, 174);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.4);
  doc.setTextColor(...COLORS.text);
  doc.text("Overall Score", MARGIN_LEFT + 47, 174);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`STRONGEST AREA  ${context.strongest.name} - ${context.strongest.score}/100`, MARGIN_LEFT + 7, 182);
  doc.text(`MAIN OPPORTUNITY  ${context.growth.name} - ${context.growth.score}/100`, MARGIN_LEFT + 7, 189);

  const coverBrief = `Your results show a clear strength and one practical area to focus on. Start with a small change that supports ${context.growth.name}, then give it a week before you add more.`;
  writeWrappedText(doc, coverBrief, MARGIN_LEFT, 205, CONTENT_WIDTH, {
    size: 12,
    lineHeight: 6.7,
    style: "normal",
    color: [214, 229, 252],
  });
};

const reserveTocPages = (doc, count) => {
  for (let i = 0; i < count; i += 1) {
    doc.addPage();
  }
};

const _renderExecutivePreface = (flow, context) => {
  drawSectionTitle(flow, "How to use your report");
  drawParagraph(flow, `Your score is a snapshot from a short self-assessment, not a diagnosis or a prediction. It highlights the areas that appear stronger today and the areas most worth your attention.`);
  drawParagraph(flow, `Read the chapters in any order. Start with ${context.growth.name}, choose one action that feels realistic, and revisit it for a week before adding another. Use ${context.strongest.name} as proof that you already have a useful foundation to build from.`);
  drawCallout(flow, "Your focus", `Aim for steady practice, not a perfect week. Small changes that fit your real routine are easier to keep.`);
};

const _renderMajorSectionIntro = (flow, major, context) => {
  drawSectionTitle(flow, major.title);
  drawMiniProgressBar(flow, "Section Score", major.score, major.color || COLORS.blue);
  drawMiniProgressBar(flow, "Overall Score", context.overallScore, COLORS.blue);
  drawMiniProgressBar(flow, `${context.strongest.name} Leverage`, context.strongest.score, context.strongest.color);
  drawMiniProgressBar(flow, `${context.growth.name} Growth Priority`, context.growth.score, context.growth.color);

  drawComparisonChart(flow, major);

  drawCallout(
    flow,
    "Psychology Note",
    `${major.shortTitle} should be interpreted as a dynamic capability system. Improvement depends on how you design routines, regulate stress carryover, and maintain criterion-based decisions during uncertainty.`
  );
};

const renderMajorSections = (flow, sections, context, tocEntries) => {
  sections.forEach((major) => {
    const guidance = context.isSleep ? sleepGuidance(major.shortTitle) : sleepGuidance("");
    const isGrowth = major.shortTitle === context.profile.weakest.name;
    const isStrongest = major.shortTitle === context.profile.strongest.name;
    const difference = Math.abs(major.score - context.overallScore);

    tocEntries.push({ level: 1, title: major.title, page: startDimensionFlow(flow) });
    flow.context = context;
    drawSectionTitle(flow, isGrowth ? `${major.shortTitle}: priority area` : isStrongest ? `${major.shortTitle}: your strongest area` : `${major.shortTitle}: score snapshot`);
    drawMiniProgressBar(flow, major.shortTitle, major.score, major.color);
    drawMiniProgressBar(flow, "Overall score", context.overallScore, COLORS.blue);
    drawMiniProgressBar(flow, `Strongest: ${context.strongest.name}`, context.strongest.score, context.strongest.color);
    drawScoreComparisonSentence(flow, major, context);
    drawSubsectionTitle(flow, "What it means");
    drawParagraph(flow, dimensionDefinition(major.shortTitle));
    drawSubsectionTitle(flow, "What this means");
    const meaning = isGrowth
      ? `${major.shortTitle} is your lowest result at ${major.score}/100. Your responses suggest that a calmer, more repeatable lead-in to sleep may be worth focusing on first.`
      : isStrongest
        ? `${major.shortTitle} is your strongest result at ${major.score}/100. Within this self-assessment, this part of your sleep routine appears relatively more supported.`
        : `${major.shortTitle} is ${difference} points ${major.score >= context.overallScore ? "above" : "below"} your overall score. It may be worth protecting while you work on the areas that need more attention.`;
    drawParagraph(flow, meaning);
    drawDidYouKnow(flow, major);
    if (major.shortTitle.includes("Wind-Down")) {
      drawInRealLife(flow, "Instead of aiming for a perfect bedtime routine, try this: around the same time, put your phone on charge, prepare one thing for tomorrow, and spend the last 30 minutes doing something quieter.");
    }
    drawSubsectionTitle(flow, "How it connects to your profile");
    drawParagraph(flow, dimensionConnection(major, context.profile, context.overallScore));

    drawSectionTitle(flow, "Your pattern");
    drawParagraph(flow, isGrowth ? `This is the area where a modest evening adjustment may have the clearest value. Focus on reducing friction before sleep, not on creating a perfect routine.` : isStrongest ? `This strength may be useful because it shows that part of your sleep routine is already working for you. Keep that pattern visible as you make one change elsewhere.` : `This area sits within the middle of your profile. It may respond best to one clear cue you can return to on ordinary days.`);
    const watchFor = isGrowth
      ? "Look for the first point in the evening where stimulation starts to crowd out rest. That is often the easiest place to make a small change."
      : major.shortTitle.includes("Recovery")
        ? "Notice whether a calm lead-in to bed changes how restored you feel on waking."
        : major.shortTitle.includes("Continuity")
          ? "Notice what tends to interrupt your usual sleep routine and whether one small change reduces that friction."
          : major.shortTitle.includes("Clarity")
            ? "Notice which morning cue helps you feel most clear, then protect it on ordinary days."
            : "Notice whether a steadier bedtime window makes this part of your routine easier to maintain.";
    drawCallout(flow, "Watch for this", watchFor);
    drawThreeTiles(flow, [
      { label: "One thing to try", text: guidance.tonight, fill: [230, 241, 255] },
      { label: "What to notice", text: `Over the next 7 days, notice whether ${major.shortTitle.toLowerCase()} feels easier, unchanged, or harder.`, fill: isGrowth ? [255, 240, 236] : [232, 248, 240] },
      { label: "Next step", text: isStrongest ? `Keep the cue that supports this area.` : guidance.quick, fill: [240, 244, 255] },
    ]);
  });
};

const renderSleepPattern = (flow, context, tocEntries) => {
  tocEntries.push({ level: 1, title: "Your Sleep Pattern", page: flow.doc.getNumberOfPages() });
  drawSectionTitle(flow, "Your sleep pattern");
  const [first, second] = buildSleepPattern(context.profile, context.overallScore);
  drawParagraph(flow, first);
  drawParagraph(flow, second);
  drawCallout(flow, "Profile focus", `Start with ${context.profile.weakest.name.toLowerCase()}. Protect the routine that supports ${context.profile.strongest.name.toLowerCase()}.`);
};

const renderSleepProfilePage = (flow, context, tocEntries) => {
  startBodyPage(flow, "Your Sleep Profile", "Putting your results together");
  tocEntries.push({ level: 1, title: "Your Sleep Profile", page: flow.doc.getNumberOfPages() });
  drawSectionTitle(flow, "Your Sleep Profile");

  flow.doc.setFont("helvetica", "normal");
  flow.doc.setFontSize(10.8);
  flow.doc.setTextColor(...COLORS.muted);
  flow.doc.text("Putting your results together", MARGIN_LEFT, flow.y);
  flow.y += 10;

  const illustrationX = PAGE_WIDTH - MARGIN_RIGHT - 25;
  const illustrationY = flow.y + 12;
  flow.doc.setFillColor(230, 241, 255);
  flow.doc.circle(illustrationX, illustrationY, 16, "F");
  flow.doc.setDrawColor(43, 113, 233);
  flow.doc.setLineWidth(1.2);
  flow.doc.circle(illustrationX - 3, illustrationY, 7.5, "S");
  flow.doc.setFillColor(230, 241, 255);
  flow.doc.circle(illustrationX + 1.5, illustrationY - 3, 7.5, "F");
  flow.doc.setFillColor(43, 161, 140);
  [[-12, -10], [10, -11], [12, 5]].forEach(([dx, dy]) => flow.doc.circle(illustrationX + dx, illustrationY + dy, 0.9, "F"));

  const fallbackProfileSummary = `Your five scores form a ${context.profile.spread >= 20 ? "clear contrast" : "fairly even"} profile. ${context.profile.strongest.name} (${context.profile.strongest.score}/100) is your strongest result, while ${context.profile.weakest.name} (${context.profile.weakest.score}/100) is the main area to focus on.`;
  const fallbackWhatsWorking = `${context.profile.strongest.name} is relatively supported. Protect the cue or routine that helps it.`;
  const fallbackMainFocus = `${context.profile.weakest.name} sits ${context.profile.spread} points below your strongest area.`;
  const fallbackWhereToStart = sleepGuidance(context.profile.weakest.name).tonight;
  const fallbackPuttingItTogether = `Within this self-assessment, ${context.profile.secondStrongest.name} may help support ${context.profile.secondWeakest.name}. Start with one change around ${context.profile.weakest.name.toLowerCase()}, then notice whether the rest of your routine feels easier to maintain.`;
  const narrative = context.sleepProfileNarrative || {};
  const profileSummary = narrative.profileSummary || fallbackProfileSummary;
  drawParagraph(flow, profileSummary);

  context.dimensions.forEach((dimension) => drawMiniProgressBar(flow, dimension.name, dimension.score, dimension.color));
  drawThreeTiles(flow, [
    { label: "What's working", text: narrative.whatsWorking || fallbackWhatsWorking, fill: [232, 248, 240] },
    { label: "Your main focus", text: narrative.mainFocus || fallbackMainFocus, fill: [255, 240, 236] },
    { label: "Where to start", text: narrative.whereToStart || fallbackWhereToStart, fill: [230, 241, 255] },
  ]);
  drawCallout(flow, "Putting it together", narrative.puttingItTogether || fallbackPuttingItTogether);
};

const renderPracticalAppendix = (flow, context, tocEntries) => {
  const opening = `This plan focuses on ${context.profile.weakest.name}, while keeping ${context.profile.strongest.name} steady.`;
  const nextStep = "The goal is not a perfect sleep score. The goal is to discover which small behaviors are realistic enough to become part of everyday life, then check what changes in your next assessment.";
  flow.headerTitle = "Your action plan";
  flow.headerSubtitle = "A clear plan for the next 30 days";
  const guidance = sleepGuidance(context.growth.name);
  const actionCards = [
    {
      label: "Tonight",
      icon: "moon",
      fill: [230, 241, 255],
      what: guidance.tonight,
      how: "Choose one screen or stimulating habit and stop it for the final 30 minutes before bed. Put the device somewhere you do not automatically reach for it.",
      why: "This gives your mind a clearer transition between daytime stimulation and sleep.",
    },
    {
      label: "Next 7 days",
      icon: "clock",
      fill: [255, 247, 232],
      what: "Use the same wind-down window most nights. Wind-down means the period before bed when you deliberately reduce stimulation and prepare for sleep.",
      how: "Choose a realistic 30-60 minute window. Reduce screen use, finish work tasks, prepare for tomorrow, and pick one calm activity.",
      why: "Consistency matters more than perfection because a repeatable cue is easier for your body and mind to recognize.",
    },
    {
      label: "After 7 days",
      icon: "check",
      fill: [240, 244, 255],
      what: "Review what actually happened during the week.",
      how: "Ask: did I follow it most days, was it easy enough, did falling asleep feel easier, unchanged, or harder, and what part was unrealistic?",
      why: "If something was hard, modify it instead of abandoning it. If 60 minutes without your phone is too much, try 30.",
    },
    {
      label: "Days 8-30",
      icon: "brain",
      fill: [232, 248, 240],
      what: `Continue the evening routine that helps your mind move from daytime activity toward sleep, especially for ${context.profile.weakest.name}.`,
      how: "Keep only the behaviors that were realistic in week one. Do less, but do it consistently.",
      why: "One sustainable habit is more useful than five habits that disappear after a few days.",
    },
    {
      label: "Keep going",
      icon: "shield",
      fill: [255, 240, 236],
      what: `Protect what supports ${context.profile.strongest.name}. Protecting a routine simply means making it easier to repeat.`,
      how: "Keep preparation simple, avoid extra steps, prepare earlier when possible, and return after an imperfect night instead of giving up.",
      why: "Missing one evening does not mean the plan failed. Returning to the routine is part of the plan.",
    },
    {
      label: "After 30 days",
      icon: "chart",
      fill: [248, 252, 255],
      what: "Re-take the MindScore Sleep assessment and compare all five dimension scores.",
      how: "Look for meaningful changes, identify which habit was easiest to maintain, and decide what to continue next month.",
      why: "A score that does not improve does not automatically mean the month failed. The point is to learn what works for you.",
    },
  ];
  const openingGroupHeight = 15.5 + measureParagraphHeight(flow.doc, opening, 0) + actionCards.slice(0, 3).reduce((sum, card) => sum + measureActionPlanCardHeight(flow.doc, card), 0);
  ensureSpace(flow, openingGroupHeight, "Action Plan opening group");
  tocEntries.push({ level: 1, title: "Your Action Plan", page: flow.doc.getNumberOfPages() });
  drawSectionTitle(flow, "Your 30-day action plan", 3);
  drawParagraph(flow, opening, 0);
  actionCards.forEach((card) => drawActionPlanCard(flow, card));
  drawInRealLife(flow, "A realistic plan might look like this: at around 10:30 PM, charge your phone away from the bed, prepare for tomorrow, and spend the last 30 minutes doing something quieter.");
  drawCallout(flow, "Your next step", nextStep);
};

const renderClosingPage = (doc, context) => {
  doc.addPage();
  drawSolidPageBackground(doc, true);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(30);
  doc.setTextColor(...COLORS.white);
  doc.text("Your next chapter", PAGE_WIDTH / 2, 40, { align: "center" });

  drawScoreCircle(doc, PAGE_WIDTH / 2, 82, context.overallScore, true);

  doc.setFillColor(15, 45, 106);
  doc.roundedRect(MARGIN_LEFT, 122, CONTENT_WIDTH, 142, 6.2, 6.2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14.2);
  doc.setTextColor(...COLORS.white);
  doc.text("Your result", MARGIN_LEFT + 8, 138);

  const summary = `Your overall score is ${context.overallScore}/100. Your pattern shows more support in ${context.profile.strongest.name} and more room to focus on ${context.profile.weakest.name}. Start with one realistic action, then pay attention to how the wider pattern changes.`;

  const linesRaw = doc.splitTextToSize(summary, CONTENT_WIDTH - 16);
  const lines = Array.isArray(linesRaw) ? linesRaw : [summary];

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12.3);
  doc.setTextColor(223, 236, 255);
  doc.text(lines, MARGIN_LEFT + 8, 152, { maxWidth: CONTENT_WIDTH - 16 });

  const rows = [
    ["Overall Score", `${context.overallScore}/100`],
    ["Protect", `${context.profile.strongest.name}: keep the routine that already supports it.`],
    ["Focus", `${context.profile.weakest.name}: it is the clearest place for one practical change.`],
    ["Your First Step", sleepGuidance(context.profile.weakest.name).tonight],
    ["Review", "Repeat the assessment after 30 days and compare the pattern."],
  ];

  let y = 187;
  rows.forEach(([k, v]) => {
    const valueLines = doc.splitTextToSize(v, CONTENT_WIDTH - 56);
    const rowHeight = Math.max(13, valueLines.length * 4.2 + 5);
    doc.setFillColor(20, 57, 128);
    doc.roundedRect(MARGIN_LEFT + 8, y - 5, CONTENT_WIDTH - 16, rowHeight, 2.4, 2.4, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.8);
    doc.setTextColor(193, 217, 251);
    doc.text(k.toUpperCase(), MARGIN_LEFT + 12, y + 3);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.2);
    doc.setTextColor(...COLORS.white);
    doc.text(valueLines, MARGIN_LEFT + 52, y + 3, { maxWidth: CONTENT_WIDTH - 56 });
    y += rowHeight + 3;
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.4);
  doc.setTextColor(193, 217, 251);
  doc.text("Small changes become useful when they are realistic enough to repeat.", PAGE_WIDTH / 2, 267, { align: "center" });
  const disclaimer = "This report is an educational self-assessment and is not a medical diagnosis. If sleep difficulties are persistent, severe, or significantly affect daytime functioning, consider discussing them with a qualified healthcare professional.";
  doc.text(doc.splitTextToSize(disclaimer, CONTENT_WIDTH - 16), PAGE_WIDTH / 2, 274, { align: "center", maxWidth: CONTENT_WIDTH - 16 });
};

const renderTocPages = (doc, tocEntries, context) => {
  const tocStartPage = 2;
  const tocPageCount = 1;

  let page = tocStartPage;
  let y = 40;

  for (let p = tocStartPage; p < tocStartPage + tocPageCount; p += 1) {
    doc.setPage(p);
    drawSolidPageBackground(doc, false);
    drawHeader(doc, "Table of Contents", "Premium Report Navigation");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18.2);
    doc.setTextColor(...COLORS.ink);
    doc.text("Table of Contents", MARGIN_LEFT, 30);

    doc.setDrawColor(...COLORS.line);
    doc.setLineWidth(0.5);
    doc.line(MARGIN_LEFT, 33.8, PAGE_WIDTH - MARGIN_RIGHT, 33.8);
  }

  doc.setPage(page);

  tocEntries.forEach((entry) => {
    if (y > 274) {
      page += 1;
      if (page >= tocStartPage + tocPageCount) return;
      doc.setPage(page);
      y = 40;
    }

    const indent = entry.level === 1 ? 0 : 8;

    doc.setFont("helvetica", entry.level === 1 ? "bold" : "normal");
    doc.setFontSize(entry.level === 1 ? 10.9 : 10.2);
    doc.setTextColor(...(entry.level === 1 ? COLORS.ink : COLORS.text));
    doc.text(entry.title, MARGIN_LEFT + indent, y);

    const tw = doc.getTextWidth(entry.title);
    const dotStart = MARGIN_LEFT + indent + tw + 2;
    const dotEnd = PAGE_WIDTH - MARGIN_RIGHT - 15;
    if (dotEnd > dotStart + 2) {
      doc.setDrawColor(214, 227, 246);
      doc.setLineWidth(0.24);
      doc.line(dotStart, y - 1, dotEnd, y - 1);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.0);
    doc.setTextColor(...COLORS.muted);
    doc.text(String(entry.page), PAGE_WIDTH - MARGIN_RIGHT, y, { align: "right" });

    y += entry.level === 1 ? 7.2 : 6.5;
  });

  const introY = Math.max(y + 12, 105);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14.5);
  doc.setTextColor(...COLORS.ink);
  doc.text("How to use your report", MARGIN_LEFT, introY);
  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(0.4);
  doc.line(MARGIN_LEFT, introY + 4, PAGE_WIDTH - MARGIN_RIGHT, introY + 4);

  const steps = [
    `1. Start with ${context.growth.name}, your main opportunity.`,
    "2. Choose one action that feels easy to begin.",
    "3. Repeat it for seven days before adding more.",
    `4. Use ${context.strongest.name} as the routine to protect.`,
  ];
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.6);
  doc.setTextColor(...COLORS.text);
  doc.text(steps, MARGIN_LEFT, introY + 13, { maxWidth: CONTENT_WIDTH });

  const cardY = introY + 47;
  doc.setFillColor(...CALLOUT_COLORS["AI Insight"]);
  doc.roundedRect(MARGIN_LEFT, cardY, CONTENT_WIDTH, 28, 3.2, 3.2, "F");
  doc.setFillColor(...COLORS.navy);
  doc.rect(MARGIN_LEFT, cardY, 2.8, 28, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.2);
  doc.setTextColor(...COLORS.ink);
  doc.text("YOUR FOCUS", MARGIN_LEFT + 5.2, cardY + 7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.4);
  doc.setTextColor(...COLORS.text);
  const focus = "This is educational self-assessment guidance, not a medical diagnosis. Aim for steady practice, not a perfect week.";
  doc.text(doc.splitTextToSize(focus, CONTENT_WIDTH - 10), MARGIN_LEFT + 5.2, cardY + 14, { maxWidth: CONTENT_WIDTH - 10 });

  return { page, nextY: cardY + 32.5 };
};

const estimateReadingTime = () => "15-20 minutes";

export const buildPremiumPdf = async ({
  reportText = "",
  profileDimensions = [],
  finalScore = 0,
  assessmentDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }),
  selectedTestTitle = "MindScore Assessment",
  sleepProfileNarrative = null,
  paginationDebug = false,
  doc = new jsPDF({ unit: "mm", format: "a4" }),
}) => {
  const sections = parseReportSections(reportText);
  const dimensions = normalizeDimensions(profileDimensions);
  const overallScore = clamp(Math.round(Number(finalScore) || 0), 0, 100);
  const strongest = [...dimensions].sort((a, b) => b.score - a.score)[0] || dimensions[0];
  const growth = [...dimensions].sort((a, b) => a.score - b.score)[0] || dimensions[0];

  const context = {
    sections,
    dimensions,
    overallScore,
    strongest,
    growth,
    assessmentDate: toSafeText(assessmentDate, "Unknown date"),
    selectedTestTitle: toSafeText(selectedTestTitle, "MindScore Assessment"),
    priorityLevel:
      overallScore >= 80 ? "High Stability" : overallScore >= 60 ? "Moderate Focus" : "Priority Attention",
    isSleep: /sleep/i.test(selectedTestTitle) || dimensions.some((dimension) => /sleep/i.test(dimension.name)),
    readingTime: estimateReadingTime(),
    sleepProfileNarrative,
  };
  context.profile = getProfileInsights(dimensions, overallScore);

  const assessmentSections = getMajorSections(context);

  if (doc.getNumberOfPages() === 0) doc.addPage();
  doc.setPage(1);

  renderCoverPage(doc, context);

  const tocEntries = [];

  reserveTocPages(doc, 1);

  const tocLayout = renderTocPages(doc, tocEntries, context);
  const flow = createFlowContext(doc, tocLayout.nextY, paginationDebug);
  tocEntries.push({ level: 1, title: "How to Use Your Report", page: 2 });

  renderSleepPattern(flow, context, tocEntries);
  renderMajorSections(flow, assessmentSections, context, tocEntries);
  renderSleepProfilePage(flow, context, tocEntries);
  renderPracticalAppendix(flow, context, tocEntries);
  renderClosingPage(doc, context);
  tocEntries.push({ level: 1, title: "Your Next Chapter", page: doc.getNumberOfPages() });

  renderTocPages(doc, tocEntries, context);

  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    drawFooter(doc, page, totalPages);
  }

  return doc;
};

export const generatePremiumPdf = async (options) => {
  return buildPremiumPdf(options);
};
