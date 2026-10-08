import { SLEEP_ANSWER_OPTIONS } from "../src/psychology/sleepAssessmentContent.js";
import { getSleepPremiumPriority } from "./sleepPremiumSchema.js";

// Content planning only. These assignments neither calculate nor modify sleep scores.
const THEMES = Object.freeze([
  { id: "BEDTIME_TRANSITION", ids: ["Q2", "Q6", "Q7"], summary: "Uspavljivanje, poslednji deo večeri i misli kada legneš." },
  { id: "RECOVERY_DURATION", ids: ["Q1", "Q5", "Q8", "Q11", "Q12"], summary: "Trajanje sna, jutarnji osećaj i doživljaj dana." },
  { id: "NIGHT_CONTINUITY", ids: ["Q3", "Q12"], summary: "Tok noći i ukupni utisak; samo odgovor o buđenjima opisuje prekide sna." },
  { id: "RHYTHM_WAKE", ids: ["Q4", "Q9", "Q10"], summary: "Ustajanje uz alarm, slobodan dan i vreme spavanja i buđenja." },
]);
const PRIORITY_THEME = Object.freeze({
  sleepOnset: "BEDTIME_TRANSITION", recovery: "RECOVERY_DURATION",
  continuity: "NIGHT_CONTINUITY", rhythm: "RHYTHM_WAKE",
});

export const buildSleepPremiumThemePlan = (input) => {
  if (!Array.isArray(input?.answers) || input.answers.length !== 12) throw new TypeError("Twelve canonical sleep answers are required for content planning.");
  const answers = new Map(input.answers.map((entry) => [entry.questionId, entry]));
  const notable = new Set();
  for (let index = 0; index < 12; index += 1) {
    const id = `Q${index + 1}`;
    const entry = answers.get(id);
    const option = SLEEP_ANSWER_OPTIONS[index].find(({ text }) => text === entry?.answer);
    if (!option) throw new TypeError(`Canonical selected answer missing for ${id}.`);
    // A concrete variation/difficulty to explore, not a diagnosis or new severity score.
    if (option.points <= 3) notable.add(id);
  }
  const priority = getSleepPremiumPriority(input);
  const requiredTheme = PRIORITY_THEME[priority.key];
  const candidates = THEMES.map(({ id, ids, summary }) => ({
    theme_id: id,
    evidence: ids.map((questionId) => ({ questionId, answer: answers.get(questionId).answer })),
    focusQuestionIds: ids.filter((questionId) => notable.has(questionId) && (id !== "NIGHT_CONTINUITY" || questionId === "Q3")),
    summary,
  }));
  let themeMap = candidates.filter(({ theme_id, focusQuestionIds }) => focusQuestionIds.length || theme_id === requiredTheme);
  // A calm profile still has actual positive evidence, not fabricated difficulties.
  if (!themeMap.length) themeMap = [candidates.find(({ theme_id }) => theme_id === "RECOVERY_DURATION")];
  const priorityTheme = themeMap.find(({ theme_id }) => theme_id === requiredTheme)?.theme_id || themeMap[0].theme_id;
  const others = themeMap.map(({ theme_id }) => theme_id).filter((id) => id !== priorityTheme);
  const second = others[0] || priorityTheme;
  const third = others[1] || second;
  const connectionPairs = others.length
    ? [[priorityTheme, second], ...(others.length > 1 ? [[second, third]] : [[second, priorityTheme]]),
      ...(others.length > 2 ? [[third, others[2]]] : [])]
    : [[priorityTheme, priorityTheme], [priorityTheme, priorityTheme]];
  return {
    theme_map: themeMap,
    priority_theme: priorityTheme,
    priority_area: priority.title,
    allocation: {
      connections: connectionPairs.map((themeIds, index) => ({ slot: index, themeIds, purpose: index === 0 ? "co_occurrence" : "contrast_or_comparison" })),
      tracking: (others.length ? others : [priorityTheme]).slice(0, 3),
      seven_day_plan: [
        { day: 1, purpose: "BASELINE", themeIds: themeMap.map(({ theme_id }) => theme_id) },
        { day: 2, purpose: "PRIORITY_EXPERIMENT", themeIds: [priorityTheme] },
        { day: 3, purpose: "OTHER_SUPPORTED_AREA", themeIds: [second] },
        { day: 4, purpose: "COMPARISON", themeIds: [...new Set([priorityTheme, second])] },
        { day: 5, purpose: "THIRD_ANGLE", themeIds: [third], differentActionFromDay2And3: true },
        { day: 6, purpose: "USER_CHOICE", themeIds: [...new Set([priorityTheme, second, third])] },
        { day: 7, purpose: "REVIEW", themeIds: themeMap.map(({ theme_id }) => theme_id) },
      ],
      alternatives: (others.length ? others : [priorityTheme]).slice(0, 2),
    },
  };
};