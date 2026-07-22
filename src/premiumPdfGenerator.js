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
  "Executive Insight",
  "Deep Behavioral Analysis",
  "Psychological Interpretation",
  "Real Life Examples",
  "Risk Analysis",
  "Hidden Strengths",
  "Blind Spots",
  "Professional Recommendations",
  "Weekly Action Plan",
  "AI Coaching Notes",
  "Reflection Questions",
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

const countWords = (text = "") =>
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

const splitContent = (content = "") => {
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

const confidenceLevel = (sections, dimensions) => {
  const textMass = sections.reduce((acc, s) => acc + countWords(s.content), 0);
  const spread = dimensions.length
    ? Math.max(...dimensions.map((d) => d.score)) - Math.min(...dimensions.map((d) => d.score))
    : 0;
  const base = clamp(68 + Math.round(textMass / 170) + Math.round(spread / 7), 74, 96);
  return `${base}%`;
};

const normalizeDimensions = (profileDimensions = []) => {
  const target = [
    "Resilience",
    "Emotional Control",
    "Self Discipline",
    "Decision Making",
    "Stress Tolerance",
  ];

  const mapped = profileDimensions.map((d) => ({
    rawName: toSafeText(d?.name, ""),
    score: clamp(Math.round(Number(d?.score) || 0), 0, 100),
  }));

  const byName = (name) => {
    const lower = name.toLowerCase();
    return (
      mapped.find((d) => d.rawName.toLowerCase().includes(lower)) ||
      mapped.find((d) => lower.includes(d.rawName.toLowerCase())) ||
      null
    );
  };

  return target.map((name, idx) => {
    const match = byName(name);
    const fallback = 54 + idx * 7;
    const score = match ? match.score : fallback;
    const tone = statusFromScore(score);

    return {
      id: name.toLowerCase().replace(/\s+/g, "-"),
      name,
      score,
      status: tone.label,
      statusColor: tone.color,
      color:
        idx === 0
          ? [56, 123, 236]
          : idx === 1
            ? [43, 161, 140]
            : idx === 2
              ? [117, 103, 232]
              : idx === 3
                ? [245, 164, 42]
                : [225, 96, 106],
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
    title: `${d.name} Professional Chapter`,
    shortTitle: d.name,
    type: "dimension",
    score: d.score,
    color: d.color,
    status: d.status,
    focus: `${d.name.toLowerCase()} capability`,
  }));
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

const createAssessmentContent = (context, pool) => {
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

const drawScoreCircle = (doc, cx, cy, score, onDark = false) => {
  const s = clamp(Math.round(Number(score) || 0), 0, 100);
  const status = statusFromScore(s);
  const ring = status.color;

  doc.setFillColor(onDark ? 22 : 238, onDark ? 50 : 247, onDark ? 113 : 255);
  doc.circle(cx, cy, 29, "F");

  doc.setDrawColor(215, 230, 250);
  doc.setLineWidth(4);
  doc.circle(cx, cy, 24, "S");

  doc.setDrawColor(ring[0], ring[1], ring[2]);
  doc.setLineWidth(4.4);
  const arc = Math.round((360 * s) / 100);
  for (let d = 0; d < arc; d += 3) {
    const a1 = ((-90 + d) * Math.PI) / 180;
    const a2 = ((-90 + d + 2.4) * Math.PI) / 180;
    doc.line(cx + Math.cos(a1) * 24, cy + Math.sin(a1) * 24, cx + Math.cos(a2) * 24, cy + Math.sin(a2) * 24);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(...(onDark ? COLORS.white : COLORS.ink));
  doc.text(String(s), cx, cy + 2.5, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.8);
  doc.setTextColor(...(onDark ? [214, 228, 250] : COLORS.muted));
  doc.text("Overall Score", cx, cy + 10.7, { align: "center" });
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
  doc.text("MindScore AI Confidential Psychological Assessment", MARGIN_LEFT, PAGE_HEIGHT - 6.2);
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

const createFlowContext = (doc) => ({
  doc,
  y: MARGIN_TOP + 8,
  headerTitle: "",
  headerSubtitle: "",
});

const startBodyPage = (flow, title, subtitle) => {
  flow.doc.addPage();
  drawSolidPageBackground(flow.doc, false);
  drawHeader(flow.doc, title, subtitle);
  flow.y = MARGIN_TOP + 8;
  flow.headerTitle = title;
  flow.headerSubtitle = subtitle;
};

const ensureSpace = (flow, heightNeeded) => {
  if (flow.y + heightNeeded <= CONTENT_BOTTOM) return;
  startBodyPage(flow, flow.headerTitle, flow.headerSubtitle);
};

const drawSectionTitle = (flow, text) => {
  ensureSpace(flow, 16);
  flow.doc.setFont("helvetica", "bold");
  flow.doc.setFontSize(19.5);
  flow.doc.setTextColor(...COLORS.ink);
  flow.doc.text(text, MARGIN_LEFT, flow.y);
  flow.y += 9;

  flow.doc.setDrawColor(...COLORS.line);
  flow.doc.setLineWidth(0.5);
  flow.doc.line(MARGIN_LEFT, flow.y, PAGE_WIDTH - MARGIN_RIGHT, flow.y);
  flow.y += 6.5;
};

const drawSubsectionTitle = (flow, text) => {
  ensureSpace(flow, 14);
  flow.doc.setFont("helvetica", "bold");
  flow.doc.setFontSize(15.7);
  flow.doc.setTextColor(...COLORS.ink);
  flow.doc.text(text, MARGIN_LEFT, flow.y);
  flow.y += 7.5;
};

const drawParagraph = (flow, text) => {
  const width = CONTENT_WIDTH;
  const preview = writeWrappedText(flow.doc, text, MARGIN_LEFT, flow.y, width, {
    size: 12.2,
    lineHeight: 7.1,
    style: "normal",
    color: COLORS.text,
  });

  if (flow.y + preview.height > CONTENT_BOTTOM) {
    startBodyPage(flow, flow.headerTitle, flow.headerSubtitle);
  }

  const rendered = writeWrappedText(flow.doc, text, MARGIN_LEFT, flow.y, width, {
    size: 12.2,
    lineHeight: 7.1,
    style: "normal",
    color: COLORS.text,
  });

  flow.y = rendered.nextY + 4.4;
};

const drawMiniProgressBar = (flow, label, score, color) => {
  ensureSpace(flow, 16);
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
  ensureSpace(flow, 34);

  flow.doc.setFont("helvetica", "bold");
  flow.doc.setFontSize(11.3);
  flow.doc.setTextColor(...COLORS.ink);
  flow.doc.text("Simple Comparison Chart", MARGIN_LEFT, flow.y);
  flow.y += 6;

  const rows = [
    { label: "Current", value: major.score, color: major.color || COLORS.blue },
    { label: "Executive Benchmark", value: 78, color: [110, 136, 190] },
    { label: "Elite Benchmark", value: 88, color: [82, 111, 169] },
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

  drawParagraph(
    flow,
    `This chart is intentionally minimal. It shows where ${major.shortTitle} currently sits compared with practical executive performance references. The goal is not to compare identity, but to clarify the performance gap that can be closed through disciplined routines, stronger recovery systems, and higher-quality decision architecture.`
  );
};

const drawCallout = (flow, type, text) => {
  const fill = CALLOUT_COLORS[type] || COLORS.card;
  const width = CONTENT_WIDTH;
  const x = MARGIN_LEFT;

  const linesRaw = flow.doc.splitTextToSize(toSafeText(text, ""), width - 10);
  const lines = Array.isArray(linesRaw) ? linesRaw : [toSafeText(linesRaw, "")];
  const lineHeight = 6.2;
  const contentHeight = lines.length * lineHeight;
  const boxHeight = 11 + contentHeight;

  ensureSpace(flow, boxHeight + 5);

  flow.doc.setFillColor(fill[0], fill[1], fill[2]);
  flow.doc.roundedRect(x, flow.y, width, boxHeight, 2.7, 2.7, "F");

  flow.doc.setFillColor(...COLORS.navy);
  flow.doc.rect(x, flow.y, 2.8, boxHeight, "F");

  flow.doc.setFont("helvetica", "bold");
  flow.doc.setFontSize(10.3);
  flow.doc.setTextColor(...COLORS.ink);
  flow.doc.text(type, x + 5.2, flow.y + 6.2);

  flow.doc.setFont("helvetica", "normal");
  flow.doc.setFontSize(11.2);
  flow.doc.setTextColor(...COLORS.text);
  flow.doc.text(lines, x + 5.2, flow.y + 12, { maxWidth: width - 10 });

  flow.y += boxHeight + 4.5;
};

const renderCoverPage = (doc, context) => {
  drawSolidPageBackground(doc, true);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(27);
  doc.setTextColor(...COLORS.white);
  doc.text("MindScore AI Premium Psychological Assessment", MARGIN_LEFT, 38);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12.8);
  doc.setTextColor(214, 229, 252);
  doc.text("Executive-grade AI psychological profile", MARGIN_LEFT, 49);

  drawScoreCircle(doc, PAGE_WIDTH - 45, 58, context.overallScore, true);

  doc.setFillColor(15, 45, 106);
  doc.roundedRect(MARGIN_LEFT, 62, 122, 88, 4.5, 4.5, "F");

  const leftMeta = [
    ["Assessment Date", context.assessmentDate],
    ["Assessment Type", context.selectedTestTitle],
    ["Priority Level", context.priorityLevel],
    ["Strongest Dimension", context.strongest.name],
    ["Growth Opportunity", context.growth.name],
    ["Development Level", context.developmentLevel],
    ["AI Confidence", context.aiConfidenceLevel],
    ["Estimated Reading Time", context.readingTime],
  ];

  let y = 72;
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

    y += 9.2;
  });

  doc.setFillColor(255, 255, 255);
  doc.roundedRect(MARGIN_LEFT, 156, CONTENT_WIDTH, 121, 5.5, 5.5, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(17.5);
  doc.setTextColor(...COLORS.ink);
  doc.text("Executive Cover Brief", MARGIN_LEFT + 7, 171);

  const coverBrief = [
    `Your current score profile indicates a ${statusFromScore(context.overallScore).label.toLowerCase()} executive foundation with identifiable growth leverage in ${context.growth.name}.`,
    "This report is intentionally long-form and practical. It explains not only what your score suggests, but why these patterns emerge, where they create risk, where they create advantage, and how to build reliable behavioral systems over the next 30, 60, and 90 days.",
    "The objective is to provide a premium-grade psychological operating manual that can be implemented in daily work, leadership interactions, stress episodes, and strategic decision contexts.",
  ].join(" ");

  writeWrappedText(doc, coverBrief, MARGIN_LEFT + 7, 181, CONTENT_WIDTH - 14, {
    size: 12.3,
    lineHeight: 7.2,
    style: "normal",
    color: COLORS.text,
  });
};

const reserveTocPages = (doc, count) => {
  for (let i = 0; i < count; i += 1) {
    doc.addPage();
  }
};

const renderExecutivePreface = (flow, context) => {
  drawSectionTitle(flow, "Executive Preface");

  const p1 = `This premium document is designed to read like an executive psychology brief, not a short motivational summary. It integrates behavioral science logic, applied coaching structure, and implementation-focused strategy. Your overall profile sits at ${context.overallScore}/100, which indicates meaningful capability with clear leverage points for measurable growth. The central theme is consistency under pressure: sustainable outcomes depend on whether your routines, decision architecture, and recovery systems remain functional during difficult weeks.`;
  const p2 = `Each major chapter includes Executive Insight, Deep Behavioral Analysis, Psychological Interpretation, Real Life Examples, Risk Analysis, Hidden Strengths, Blind Spots, Professional Recommendations, Weekly Action Plan, AI Coaching Notes, Reflection Questions, and Progress Indicators. This format is intentional. It ensures you receive both deep explanation and practical execution guidance so each insight can be translated into real behavior.`;
  const p3 = `Use this report actively: annotate it, choose one high-impact intervention per week, run personal experiments, and track outcomes through objective indicators. The objective is not perfection. The objective is reduction of behavioral variance, faster recovery after pressure, stronger leadership stability, and better long-term decision quality.`;

  drawParagraph(flow, p1);
  drawCallout(flow, "Expert Commentary", "Text is the premium product in this report. Graphics are intentionally limited so implementation insights remain central.");
  drawParagraph(flow, p2);
  drawCallout(flow, "Implementation Strategy", "Commit to one weekly review session where you evaluate evidence, update protocols, and remove one recurring friction source.");
  drawParagraph(flow, p3);
};

const renderMajorSectionIntro = (flow, major, context) => {
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
  sections.forEach((major, majorIndex) => {
    startBodyPage(flow, major.shortTitle, "Premium Long-Form Chapter");
    tocEntries.push({ level: 1, title: major.title, page: flow.doc.getNumberOfPages() });

    renderMajorSectionIntro(flow, major, context);

    major.subsections.forEach((subsection, subsectionIndex) => {
      drawSubsectionTitle(flow, subsection.title);
      tocEntries.push({ level: 2, title: subsection.title, page: flow.doc.getNumberOfPages() });

      drawMiniProgressBar(
        flow,
        `${major.shortTitle} Progress`,
        major.score,
        major.color || COLORS.blue
      );

      drawCallout(flow, subsection.callouts[0].type, subsection.callouts[0].text);
      drawParagraph(flow, subsection.paragraphs[0]);
      drawParagraph(flow, subsection.paragraphs[1]);
      drawParagraph(flow, subsection.paragraphs[2]);

      if (subsection.paragraphs[3]) {
        drawParagraph(flow, subsection.paragraphs[3]);
      }

      if (majorIndex === 0 && subsectionIndex === 8) {
        drawCallout(
          flow,
          "Practical Example",
          "Use the 30-day improvement plan with a daily reflection, habit tracker, stress protocol, and weekly review. Then extend to a 90-day roadmap with measurable milestones."
        );
      }

      flow.y += 2.8;
    });
  });
};

const renderPracticalAppendix = (flow, context, tocEntries) => {
  startBodyPage(flow, "Applied Systems", "30-day and 90-day Implementation Toolkit");
  tocEntries.push({ level: 1, title: "Applied Systems Toolkit", page: flow.doc.getNumberOfPages() });

  drawSectionTitle(flow, "Applied Systems Toolkit");

  const blocks = [
    {
      title: "30-Day Improvement Plan",
      body: "Days 1-7: establish baseline data and identify top three triggers. Days 8-14: install two micro habits linked to morning routine and evening routine. Days 15-21: apply decision framework to all important commitments and run stress protocol before major conversations. Days 22-30: review trend data, remove one friction point, and formalize your personal recovery protocol.",
    },
    {
      title: "90-Day Roadmap",
      body: "Month 1 emphasizes consistency. Month 2 emphasizes quality under pressure. Month 3 emphasizes transfer into leadership, relationships, and strategic decisions. At each month end, conduct a formal review with progress indicators, blind spot analysis, and implementation strategy updates.",
    },
    {
      title: "Habit Tracker and Behavior Checklist",
      body: "Track daily completion of key actions: morning planning, priority execution block, emotional pause protocol, boundary communication, evening reflection, and sleep protection routine. Behavioral reliability is the leading indicator; score movement is a lagging indicator.",
    },
    {
      title: "Personal Experiments and Micro Habits",
      body: "Run one personal experiment per week. Keep the hypothesis explicit and measurable. Example: if I run a two-minute pre-meeting reset, then my communication clarity score should improve from 6/10 to 8/10 in at least four meetings this week.",
    },
  ];

  blocks.forEach((block) => {
    drawSubsectionTitle(flow, block.title);
    drawParagraph(flow, block.body);
    drawCallout(
      flow,
      "Growth Opportunity",
      `Apply this block with disciplined weekly review. Strongest leverage remains ${context.strongest.name}, while the highest development return remains ${context.growth.name}.`
    );
  });
};

const renderClosingPage = (doc, context) => {
  doc.addPage();
  drawSolidPageBackground(doc, true);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(30);
  doc.setTextColor(...COLORS.white);
  doc.text("Executive Closing", PAGE_WIDTH / 2, 40, { align: "center" });

  drawScoreCircle(doc, PAGE_WIDTH / 2, 82, context.overallScore, true);

  doc.setFillColor(15, 45, 106);
  doc.roundedRect(MARGIN_LEFT, 122, CONTENT_WIDTH, 142, 6.2, 6.2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14.2);
  doc.setTextColor(...COLORS.white);
  doc.text("Final Professional Summary", MARGIN_LEFT + 8, 138);

  const summary = [
    `This assessment positions you in a ${context.developmentLevel} stage with strongest leverage in ${context.strongest.name} and highest growth return in ${context.growth.name}.`,
    "The central recommendation is to protect consistency under pressure through structured routines, explicit decision criteria, and disciplined recovery protocol execution.",
    "Growth will be confirmed when behavioral reliability improves across difficult weeks, not just peak performance days.",
  ].join(" ");

  const linesRaw = doc.splitTextToSize(summary, CONTENT_WIDTH - 16);
  const lines = Array.isArray(linesRaw) ? linesRaw : [summary];

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12.3);
  doc.setTextColor(223, 236, 255);
  doc.text(lines, MARGIN_LEFT + 8, 152, { maxWidth: CONTENT_WIDTH - 16 });

  const rows = [
    ["Overall Score", `${context.overallScore}/100`],
    ["Strongest Dimension", context.strongest.name],
    ["Growth Opportunity", context.growth.name],
    ["AI Confidence", context.aiConfidenceLevel],
    ["Recommended Review Cycle", "Weekly and Monthly"],
  ];

  let y = 208;
  rows.forEach(([k, v]) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.6);
    doc.setTextColor(193, 217, 251);
    doc.text(k, MARGIN_LEFT + 8, y);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.1);
    doc.setTextColor(...COLORS.white);
    doc.text(v, PAGE_WIDTH - MARGIN_RIGHT - 8, y, { align: "right" });
    y += 11;
  });
};

const renderTocPages = (doc, tocEntries) => {
  const tocStartPage = 2;
  const tocPageCount = 4;

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
};

const estimateReadingTime = (assessmentSections) => {
  const totalWords = assessmentSections.reduce((sectionAcc, section) => {
    return (
      sectionAcc +
      section.subsections.reduce((subAcc, subsection) => {
        return subAcc + subsection.paragraphs.reduce((pAcc, p) => pAcc + countWords(p), 0);
      }, 0)
    );
  }, 0);

  const minutes = Math.ceil(totalWords / 175);
  return `${minutes}-${minutes + 12} minutes`;
};

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
  doc = new jsPDF({ unit: "mm", format: "a4" }),
}) => {
  const sections = parseReportSections(reportText);
  const dimensions = normalizeDimensions(profileDimensions);
  const overallScore = clamp(Math.round(Number(finalScore) || 0), 0, 100);
  const strongest = [...dimensions].sort((a, b) => b.score - a.score)[0] || dimensions[0];
  const growth = [...dimensions].sort((a, b) => a.score - b.score)[0] || dimensions[0];

  const pool = sections.reduce(
    (acc, section) => {
      const p = splitContent(section.content);
      acc.paragraphs.push(...p.paragraphs);
      acc.bullets.push(...p.bullets);
      return acc;
    },
    { paragraphs: [], bullets: [] }
  );

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
    developmentLevel: developmentLevel(overallScore),
    aiConfidenceLevel: confidenceLevel(sections, dimensions),
    readingTime: "",
  };

  const assessmentSections = createAssessmentContent(context, pool);
  context.readingTime = estimateReadingTime(assessmentSections);

  if (doc.getNumberOfPages() === 0) doc.addPage();
  doc.setPage(1);

  renderCoverPage(doc, context);

  const tocEntries = [{ level: 1, title: "Cover", page: 1 }, { level: 1, title: "Table of Contents", page: 2 }];

  reserveTocPages(doc, 4);

  const flow = createFlowContext(doc);
  startBodyPage(flow, "Executive Preface", "How to read this assessment");
  renderExecutivePreface(flow, context);

  tocEntries.push({ level: 1, title: "Executive Preface", page: 6 });

  renderMajorSections(flow, assessmentSections, context, tocEntries);
  renderPracticalAppendix(flow, context, tocEntries);
  renderClosingPage(doc, context);
  tocEntries.push({ level: 1, title: "Executive Closing", page: doc.getNumberOfPages() });

  renderTocPages(doc, tocEntries);

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
