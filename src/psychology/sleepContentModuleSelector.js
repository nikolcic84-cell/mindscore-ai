import { buildSleepPremiumInput } from "../../server/sleepPremiumInput.js";
import { getSleepPremiumPriority } from "../../server/sleepPremiumSchema.js";
import { SLEEP_ANSWER_OPTIONS } from "./sleepAssessmentContent.js";

const QUESTION_COUNT = 12;
const PROFILE_LIMITS = Object.freeze({
  "MIRNA NOĆ": 2,
  "UMORAN SAN": 3,
  "BUDAN UM": 3,
  "ISPREKIDAN SAN": 3,
  "SAN POD PRITISKOM": 4,
});
const OPTION_SEVERITY = Object.freeze({
  1: [0, 1, 2, 3, 4],
  2: [0, 1, 2, 3, 4],
  3: [0, 1, 2, 3, 4],
  4: [0, 1, 2, 3, 4],
  // Reported 7-9 hours is not a difficulty; >9 hours with poor refreshment is relevant context.
  5: [0, 1, 3, 4, 2],
  6: [0, 1, 2, 3, 4],
  7: [0, 1, 2, 3, 4],
  8: [0, 1, 2, 3, 4],
  9: [0, 1, 2, 3, 4],
  10: [0, 1, 2, 3, 4],
  11: [0, 1, 2, 3, 4],
  12: [0, 1, 2, 3, 4],
});
const MODULE_AREA = Object.freeze({
  U: "Uspavljivanje", M: "Misli pred spavanje", N: "Tok noći", R: "Jutro i oporavak",
  E: "Dnevna energija", T: "Trajanje sna", C: "Ritam", P: "Očuvanje dobrog sna",
});
const MODULE_QUESTIONS = Object.freeze({
  U01: [2], U02: [2], U03: [2, 6], U04: [6], U07: [2, 7],
  M01: [7], M02: [7], M03: [2, 7], M04: [7], M05: [7],
  N01: [3], N02: [3], N06: [3], N07: [3],
  R01: [4], R02: [4], R03: [1, 5, 8], R04: [1, 4], R05: [1, 8], R06: [4, 9, 10],
  E01: [8], E04: [1, 5, 8, 11], E05: [11],
  T01: [5], T02: [5], T03: [1, 5, 8], T04: [5], T05: [9],
  C01: [10], C02: [9], C04: [9, 10], C05: [10],
});
const SEMANTIC_GROUPS = Object.freeze([
  ["U01", "U02"],
  ["M01", "M02", "M03", "M04", "M05"],
  ["N01", "N02", "N07"],
  ["R01", "R02", "R04"],
  ["R03", "T03"],
  ["C01", "C02", "C04", "C05", "R06", "T05"],
]);
const PROFILE_PRIORITY_AREAS = Object.freeze({
  "UMORAN SAN": ["Jutro i oporavak", "Dnevna energija", "Trajanje sna"],
  "BUDAN UM": ["Uspavljivanje", "Misli pred spavanje"],
  "ISPREKIDAN SAN": ["Tok noći"],
  "SAN POD PRITISKOM": ["Jutro i oporavak", "Uspavljivanje", "Tok noći", "Trajanje sna", "Dnevna energija", "Ritam"],
});

const q = (answers, number) => answers[number - 1];
const range = (value, min, max = 5) => value >= min && value <= max;

function eligibleByAnswers(id, a) {
  switch (id) {
    case "U01": return range(q(a, 2), 3);
    case "U02": return range(q(a, 2), 4);
    case "U03": return range(q(a, 2), 2) && range(q(a, 6), 3);
    case "U04": return range(q(a, 6), 4);
    // The questionnaire does not ask about muscle tension; don't infer it from thoughts or onset answers.
    case "U07": return false;
    case "M01": return range(q(a, 7), 3);
    case "M02": return range(q(a, 7), 4);
    case "M03": return q(a, 2) === 5 && q(a, 7) >= 4;
    case "M04": return range(q(a, 7), 4);
    case "M05": return range(q(a, 7), 4);
    case "N01": return range(q(a, 3), 4);
    case "N02": return range(q(a, 3), 3);
    case "N06": return q(a, 3) === 2;
    case "N07": return q(a, 3) === 3 || q(a, 3) === 5;
    case "R01": return range(q(a, 4), 4);
    case "R02": return range(q(a, 4), 3);
    case "R03": return [1, 5].includes(q(a, 5)) && q(a, 1) >= 4;
    case "R04": return q(a, 1) >= 4 || q(a, 4) >= 4;
    case "R05": return (range(q(a, 1), 1, 2) && range(q(a, 8), 3)) ||
      (range(q(a, 1), 4) && range(q(a, 8), 1, 2));
    case "R06": return q(a, 4) >= 3 || q(a, 9) >= 3 || q(a, 10) >= 3;
    case "E01": return range(q(a, 8), 3);
    case "E04": return range(q(a, 8), 4) || q(a, 11) === 5 ||
      (q(a, 1) >= 4 && [1, 5].includes(q(a, 5)));
    case "E05": return range(q(a, 11), 2, 4);
    case "T01": return [3, 4].includes(q(a, 5));
    case "T02": return q(a, 5) === 2;
    case "T03": return q(a, 5) === 1 && (q(a, 1) >= 4 || q(a, 8) >= 4);
    case "T04": return q(a, 5) === 5;
    case "T05": return range(q(a, 9), 3, 4);
    case "C01": return range(q(a, 10), 3);
    case "C02": return range(q(a, 9), 3);
    case "C04": return range(q(a, 9), 3) || range(q(a, 10), 3);
    case "C05": return range(q(a, 10), 5);
    default: return false;
  }
}

function calmEligible(id, answers) {
  const positive = (number, max = 2) => q(answers, number) <= max;
  switch (id) {
    case "P01": return [1, 2, 3, 8, 10, 12].every((number) => positive(number));
    case "P02": return positive(2) && [1, 2].includes(q(answers, 6));
    case "P03": return q(answers, 12) === 2 &&
      [1, 2].every((number) => positive(number)) && [8, 11].every((number) => positive(number));
    case "P04": return positive(9) && positive(10);
    default: return false;
  }
}

function relevanceScore(id, answers) {
  const questions = MODULE_QUESTIONS[id] ?? [];
  const directSeverity = Math.max(0, ...questions.map((number) => OPTION_SEVERITY[number][q(answers, number) - 1]));
  const matchStrength = id === "P01" ? 12
    : id === "P03" && q(answers, 12) === 2 ? 15
      : id === "P02" && [1, 2].includes(q(answers, 6)) ? 6
        : id === "P04" ? 6
          : id === "M03" ? 8
    : id === "R03" && [1, 5].includes(q(answers, 5)) && q(answers, 1) >= 4 ? 10
      : id === "E04" && (q(answers, 8) >= 4 || q(answers, 11) === 5) ? 8
        : id === "T04" && q(answers, 5) === 5 ? 35
          : id === "U04" && q(answers, 6) >= 4 ? 7
            : id === "N01" && q(answers, 3) >= 4 ? 7
              : id === "C01" && q(answers, 10) >= 4 ? 7
                : id === "C02" && q(answers, 9) >= 4 ? 7
                  : 0;
  return directSeverity * 10 + matchStrength;
}

function buildSummary(profile, answers) {
  const q = (number) => answers[number - 1];
  if (profile === "MIRNA NOĆ") {
    const details = [];
    if (q(2) <= 2) details.push("lako zaspiš");
    if (q(3) <= 2) details.push("noć ti je uglavnom mirna");
    if (q(1) <= 2 && q(8) <= 2) details.push("jutarnji osećaj i dnevna energija deluju stabilno");
    if (q(12) === 2) details.push("povremeno se javi loša noć");
    if (!details.length) return "Tvoji osnovni odgovori o snu deluju uglavnom stabilno.";
    const supportedNoChange = q(12) === 1 && q(11) === 1 && q(5) <= 2 &&
      [1, 2, 3, 4, 6, 7, 8, 9, 10].every((number) => q(number) <= 2);
    const detailText = details.join("; ");
    return supportedNoChange
      ? `Tvoj san trenutno deluje stabilno: ${detailText}. Nema jakog signala da treba da menjaš ono što već radi.`
      : `Tvoj san trenutno deluje uglavnom stabilno: ${detailText}.`;
  }

  const details = [];
  if (q(2) >= 3) details.push("više vremena za uspavljivanje");
  if (q(6) >= 4) details.push(q(6) === 5 ? "skrolovanje pred spavanje" : "često korišćenje telefona pred spavanje");
  if (q(7) >= 3) details.push("aktivne misli kada legneš");
  if (q(3) >= 3) details.push(q(3) === 4 ? "težak povratak u san nakon buđenja" : "prekidanje sna tokom noći");
  if (q(1) >= 4) details.push("umor po buđenju");
  if (q(4) >= 4) details.push("teško ustajanje");
  if (q(8) >= 3) details.push("pad dnevne energije");
  if (q(11) >= 2) details.push("umor ili teže funkcionisanje posle loše noći");
  if ([3, 4].includes(q(5))) details.push("kraće trajanje sna");
  if (q(5) === 5) details.push("više od devet sati sna uz čest osećaj neodmorenosti");
  if ([3, 4].includes(q(9))) details.push("duže spavanje slobodnim danom");
  if (q(9) === 5 || q(10) >= 3) details.push("promenljivo vreme spavanja ili buđenja");
  if (q(12) >= 3) details.push("manje zadovoljavajući utisak o poslednjim noćima");
  if (!details.length) return "Tvoji odgovori daju mešovitu sliku bez jedne jasno izdvojene teškoće.";
  const selected = details.slice(0, 3);
  return `Odgovori izdvajaju: ${selected.join("; ")}.`;
}

function focusAreas(priority, input) {
  if (priority.key === "multiple") {
    const weak = input.dimensions;
    const byKey = [
      ["recovery", "Jutro i oporavak"], ["sleepOnset", "Uspavljivanje"], ["continuity", "Tok noći"],
    ].filter(([key]) => weak[key].state === "WEAK").map(([, area]) => area);
    return [...byKey, "Dnevna energija", "Trajanje sna", "Ritam"];
  }
  return PROFILE_PRIORITY_AREAS[input.profile] ?? [];
}

function sameRedundancyGroup(left, right, groups) {
  return [...groups, ...SEMANTIC_GROUPS].some((group) => group.includes(left) && group.includes(right));
}

/**
 * Deterministically selects existing library entries. `answers` is exactly
 * twelve 1-indexed option numbers; module objects/text are returned unchanged.
 */
export function selectSleepContentModules(answers, library) {
  if (!Array.isArray(answers) || answers.length !== QUESTION_COUNT ||
    answers.some((value) => !Number.isInteger(value) || value < 1 || value > 5)) {
    throw new TypeError("Module selection requires twelve 1-indexed answer options from 1 to 5.");
  }
  if (!library || !Array.isArray(library.modules) || library.modules.length !== 44 ||
    !library.selection || !Number.isInteger(library.selection.max_modules) ||
    !Number.isInteger(library.selection.max_per_area) || !Array.isArray(library.selection.redundancy_groups) ||
    !Array.isArray(library.selection.calm_output)) {
    throw new TypeError("Module selection requires the complete 44-module content library.");
  }
  const ids = library.modules.map(({ id }) => id);
  if (new Set(ids).size !== 44 || ids.some((id) => typeof id !== "string")) {
    throw new TypeError("Module library must contain 44 unique IDs.");
  }

  const input = buildSleepPremiumInput(answers.map((option, index) =>
    SLEEP_ANSWER_OPTIONS[index][option - 1].points));
  const profile = input.profile;
  const priority = getSleepPremiumPriority(input);
  const summary = buildSummary(profile, answers);
  const moduleById = new Map(library.modules.map((module) => [module.id, module]));
  const focus = new Set(focusAreas(priority, input));
  const candidates = profile === "MIRNA NOĆ"
    ? library.selection.calm_output.map((id) => moduleById.get(id)).filter((module) =>
      module?.automatic_eligible === true && calmEligible(module.id, answers))
    : library.modules.filter(({ id, automatic_eligible }) =>
      automatic_eligible === true && eligibleByAnswers(id, answers));
  candidates.sort((a, b) => {
    const relevance = relevanceScore(b.id, answers) - relevanceScore(a.id, answers);
    if (relevance) return relevance;
    const focusDifference = Number(focus.has(b.area)) - Number(focus.has(a.area));
    if (focusDifference) return focusDifference;
    return a.priority_rank - b.priority_rank || a.id.localeCompare(b.id, "en");
  });

  const selected = [];
  const areaCounts = new Map();
  const maxModules = PROFILE_LIMITS[profile] ?? 3;
  for (const module of candidates) {
    if (selected.length >= maxModules) break;
    if ((areaCounts.get(module.area) ?? 0) >= Math.min(library.selection.max_per_area, 2)) continue;
    if (selected.some(({ id }) => sameRedundancyGroup(id, module.id, library.selection.redundancy_groups))) continue;
    selected.push(module);
    areaCounts.set(module.area, (areaCounts.get(module.area) ?? 0) + 1);
  }

  return Object.freeze({
    profile,
    summary,
    moduleIds: Object.freeze(selected.map(({ id }) => id)),
    modules: Object.freeze(selected),
  });
}
