/** Bounded hypothetical teaching devices, never reconstructed personal history.
 * A device must have both canonical fact support and a retrieved concept.
 * Plain factual copy is preferred when an analogy adds no distinct explanation.
 */
export function selectSleepPremiumExplanationDevices(facts, claims) {
  if (!facts || !Array.isArray(facts.facts) || !facts.flags || !Array.isArray(claims)) {
    throw new TypeError("Explanation devices require facts and selected claims.");
  }
  const unknown = new Set((facts.unknown || []).map((entry) => typeof entry === "string" ? entry : entry.id));
  const active = (flag) => facts.flags[flag] === true && !unknown.has(flag) && !unknown.has(`flags.${flag}`);
  const supports = (...ids) => claims.some((claim) => ids.includes(claim.claim_id));
  const refs = (...ids) => facts.facts.filter(({ questionId }) => ids.includes(questionId)).map(({ fact_id }) => fact_id);
  const hasRefs = (...ids) => ids.every((id) => facts.facts.some(({ questionId }) => questionId === id));
  const candidates = [];
  if (hasRefs("Q5", "Q3") && active("short_sleep") && active("night_awakenings") && supports("SLEEP_MULTIDIMENSIONAL", "DIARY_CORE_OBSERVATION")) {
    candidates.push({ device_id: "journey_interruption", concept: "duration_and_continuity", fact_ids: refs("Q5", "Q3"),
      explanation: "Zamisli putovanje: njegova dužina i prekidi su dve različite stvari. Tako se i prijavljeno trajanje sna može razmatrati odvojeno od buđenja.",
      does_not_imply: ["Ovo je zamišljeno poređenje, ne događaj iz tvog života.", "Ne meri trajanje budnosti, ne dokazuje uzrok umora niti dug sna."] });
  }
  if (hasRefs("Q2", "Q7") && active("active_thoughts") && active("onset_difficulty") && supports("TODO_WRITING_LAB", "TODO_SPECIFICITY_ASSOCIATION")) {
    candidates.push({ device_id: "unfinished_tasks", concept: "active_thoughts", fact_ids: refs("Q2", "Q7"),
      explanation: "Kao zamišljena lista nedovršenih zadataka: zapis može ponuditi mesto za buduće obaveze, bez njihovog rešavanja. To je način da se objasni dobrovoljan pokušaj, ne opis onoga što tvoje misli rade.",
      does_not_imply: ["Nije dokaz da su tvoje misli stvarno nedovršeni zadaci.", "Ne utvrđuje mehanizam niti obećava brže uspavljivanje; mala studija nema poređenje sa nepisanjem."] });
  }
  if (hasRefs("Q9", "Q10") && active("variable_timing") && supports("TWO_PROCESS_MODEL", "REGULAR_TIMES_GUIDANCE")) {
    candidates.push({ device_id: "timing", concept: "sleep_timing", fact_ids: refs("Q9", "Q10"),
      explanation: "Zamisli isti događaj u različito vreme: vreme i trajanje nisu ista informacija. Ovo poređenje pomaže da raspored razmotriš odvojeno od broja sati sna.",
      does_not_imply: ["Primer je hipotetičan, ne tvoja stvarna istorija.", "Ne meri biološki ritam i ne propisuje satnicu, raniji alarm ili dozu svetla."] });
  }
  // Only useful with a real multi-answer contrast; no generic filler device.
  if (!candidates.length && hasRefs("Q3", "Q1", "Q8") && supports("SLEEP_MULTIDIMENSIONAL") && active("night_awakenings") &&
    (active("daytime_fatigue") || active("morning_difficulty"))) {
    candidates.push({ device_id: "one_variable_comparison", concept: "multiple_aspects", fact_ids: refs("Q3", "Q1", "Q8"),
      explanation: "U zamišljenom poređenju dve noći zadrži jednu stvar istom, a razmotri drugu: broj sati nije isto što i prekidi ili jutarnji utisak. Stvarni odgovori ne potvrđuju da se te pojave javljaju istih dana.",
      does_not_imply: ["Ovo nije sproveden eksperiment niti opis dve tvoje noći.", "Ne izoluje uzrok i ne dokazuje da promena jedne stvari menja drugu."] });
  }
  return candidates.slice(0, 2);
}