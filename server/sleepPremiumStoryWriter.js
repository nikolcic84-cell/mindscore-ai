import { buildSleepPremiumStoryMaster } from "./sleepPremiumStoryMaster.js";

export const SLEEP_PREMIUM_STORY_MODEL = "gpt-5-mini";
export const SLEEP_PREMIUM_STORY_MAX_OUTPUT_TOKENS = 8000;
export const SLEEP_PREMIUM_STORY_INSTRUCTIONS = `Ti si objašnjavač. Vrati samo tražena JSON polja na prirodnom srpskom, latinicom. MindScore je već odredio činjenice, uvide, očuvane osobine, pitanje, nauku i plan; ti ne biraš niti menjaš ništa od toga.
Svaku tvrdnju o osobi veži za dostavljene činjenice i zadrži njihov opseg: trajanje sna nije vreme u krevetu; potreba za kafom/pauzom nije isto što i pospanost; teško vraćanje u san nije učestalost buđenja; manjak energije nije raspoloženje; mogućnost dužeg ostajanja u krevetu nije ostajanje kod kuće. Ne dodaj napetost, način suočavanja, učestalost, merenje, simptom ili drugi događaj koji nije naveden.
Nepoznat odnos ostaje nepoznat. Ako pitanje traži da li se X i Y javljaju zajedno, istih noći/dana ili su povezani, predstavi ih odvojeno i sačuvaj neizvesnost: „Navodiš X i Y. Još ne znamo da li se javljaju istih noći.“ Ne piši da postoje zajedno, često se javljaju zajedno, da su povezani, da jedno doprinosi/utiče/objašnjava drugo ili da je jedno uzrok drugog. Nemoj pretvarati poređenje u zaključak.
Bezbednosna ograničenja su uputstva tebi, ne tekst za korisnika: izostavi ograde poput „bez tvrdnji o uzroku/terapiji/dijagnozi“, „ovo ne dokazuje“ i „ne može se zaključiti“. Ne dodaj dijagnozu, lečenje, preporuke, obećanja ili objektivna merenja. Ne pominji nauku u svojim poljima; odobrene tvrdnje i izvori dodaju se odvojeno.
Piši kratkim, prirodnim rečenicama na savremenom srpskom. Bez uredničkog/AI jezika, prepričavanja istog kontrasta kroz više polja ili generičkog savetovanja. story_intro uvodi samo glavni personalizovani uvid; svaki insight dodaje zaseban detalj; očuvanje objašnjava šta ne treba prvo menjati; pitanje objašnjava šta još nije poznato; eksperiment ukratko objašnjava svrhu već određenog plana, bez dodatnih zadataka.
MIRNA NOĆ ostaje mirna: pokaži šta je dosledno u prijavljenim odgovorima i šta vredi sačuvati, bez problema, drame, pitanja ili nauke ako ih master nema. Ne forsiraj savet ili promenu. Ostala polja su kratka; story_intro cilja 90–130 reči samo kada materijal to podržava. Polja za pitanje i očuvanje su null kada master nema odgovarajući podatak. insight_2/3 su null ako taj broj uvida nije unapred odabran. Vrati samo šest polja iz šeme; ne vraćaj profile, prioritete, plan/dane, radnje, tehnike, naučne tvrdnje, izvore, citate ili ID-jeve.`;

const string = (maxLength) => ({ type: "string", minLength: 1, maxLength, pattern: "\\S" });
const nullable = (schema) => ({ anyOf: [schema, { type: "null" }] });
const object = (properties) => ({ type: "object", additionalProperties: false, properties, required: Object.keys(properties) });

export function buildSleepPremiumStoryProseSchema({ selectedInsightCount = 3 } = {}) {
  const properties = {
    story_intro: string(1800),
    insight_1_explanation: string(600),
  };
  properties.insight_2_explanation = nullable(string(600));
  if (selectedInsightCount >= 3) properties.insight_3_explanation = string(600);
  properties.do_not_change_explanation = nullable(string(700));
  properties.open_question_explanation = nullable(string(500));
  properties.experiment_explanation = string(500);
  return { type: "json_schema", name: "mindscore_sleep_premium_story_prose_v1", strict: true,
    schema: object(properties) };
}

const proseKeys = (master) => ["story_intro", "insight_1_explanation", "insight_2_explanation",
  ...(master.selectedInsights.length >= 3 ? ["insight_3_explanation"] : []),
  "do_not_change_explanation", "open_question_explanation", "experiment_explanation"];
const INTERNAL_ID = /\b(?:FACT_Q\d+|Q(?:[1-9]|1[0-2])|EV_[A-Z0-9_]+|[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+|[a-f\d]{8}-[a-f\d-]{27,})\b/iu;
const SENSITIVE = /\S+@\S+|https?:\/\/|\b(?:sk[-_]|pk_|whsec_|bearer\s|password|credential|api[_ -]?key|secret)\b|(?:\+?\d[\s().-]*){7,}/iu;
const INTERNAL_WORDS = /\b(?:classifier|scoring|confidence|deterministic|deterministick\w*|urednick\w*|hipotez\w*|kandidat\w*|validator|prompt|schema|model|ovaj izveštaj|podržava \d+ uvida|tvoj prioritet #1)\b/iu;
const DIAGNOSIS = /\b(?:dijagnoz\w*|nesanic\w*|apnej\w*|depres\w*|anksiozn\w*|poremec\w*|bolest\w*|lekov\w*|medikament\w*|terapij\w*)\b/iu;
const TREATMENT_RECOMMENDATION = /\b(?:preporucuj\w*|propis\w*|primeni|uzmi|koristi|zapo[cč]ni|treba\s+da\s+uzmes)\b.{0,55}\b(?:lek\w*|terapij\w*|medikament\w*|lecenj\w*)\b/iu;
const CAUSAL = /\b(?:uzroku\w*|uzrocn\w*\s+vez\w*|izaziv\w*|prouzrok\w*|zbog toga|zbog misl\w*|dovodi do|doprinos\w*|utic\w*|objasnjav\w*|will cause|caused by)\b/iu;
const NEGATED_CAUSAL_CAVEAT = /\bne govori\s+sta\s+ih\s+je\s+izazvalo\b|\bne (?:pokazuje|utvrdjuje|potvrdjuje|dokazuje)\b.{0,45}\b(?:uzrok\w*|uzroc\w*|izaziv\w*|povezanost|da li jedno)\b|\bbez (?:izvlacenja brzih zakljucaka|tvrdnji|zakljucaka) o uzroc?\w*\b|\bbez zakljucka o uzroku\b|\bne uvodi novu pretpostavku o uzroku\b|\bne (?:postoji|postoji potvrda za) uzrocna veza\b/gu;
const NEGATED_MEDICAL_CAVEAT = /\bbez (?:tvrdnji|zakljucaka) o uzroc\w*(?: ili (?:terapij\w*|dijagnoz\w*))?\b|\bbez tvrdnji o uzrocima ili terapij\w*\b|\bbez zakljucaka o uzroku ili dijagnoz\w*\b|\bbez dijagnoz\w*\b|\bne predstavlja dijagnoz\w*\b|\bnije dijagnoz\w*\b|\bbez terapij\w*\b/gu;
const GUARANTEE = /\b(?:sigurno|garantovan\w*|definitivn\w*|will improve|will fix|leci|izleci|popravlja|resava)\b/iu;
const OBJECTIVE = /\b(?:objektiv\w*\s+(?:izmer\w*|dokaz\w*|utvrd\w*)|objectiv\w*\s+(?:measure|prove|establish))\b/iu;
const UNSUPPORTED_COOCCURRENCE = /\b(?:cesto\s+se\s+(?:javlj\w*|pojavljuj\w*)|(?:javlj\w*|pojavljuj\w*)\s+se)\s+(?:cesto\s+)?(?:zajedno|iste?\s+noci|iste?\s+dana)\b/iu;
const RELATIONSHIP_ASSERTION = /\b(?:koegzistir\w*|povezan\w*|udruzen\w*|doprinos\w*|utic\w*|objasnjav\w*|postoj\w*\s+(?:cesto\s+)?zajedno|javlj\w*\s+(?:cesto\s+)?zajedno|pojavljuj\w*\s+(?:cesto\s+)?zajedno|cesto\s+zajedno|istih\s+noci|iste\s+noci|istim\s+danima|istog\s+dana)\b/iu;
const UNCERTAINTY_CUE = /\b(?:jos\s+ne\s+znamo|ne\s+znamo|nije\s+poznato|ostaje\s+otvoren\w*|da\s+li|pitanje\s+je)\b/iu;
const SAFETY_DISCLAIMER = /\b(?:bez tvrdnji o uzroku|bez tvrdnji o terapiji|bez tvrdnji o dijagnozi|bez terapije|bez dijagnoze|ovo ne dokazuje|ne moze se zakljuciti|ovo nije dijagnoza|ne predstavlja dijagnozu)\b/iu;
const ENGLISH_PLACEHOLDER = /\b(?:begin|start) the allocated plan\b|\bno additional action\b|\byour assigned step\b|\btrack your sleep\b/iu;
const BIBLIOGRAPHY = /\b(?:doi|pubmed|pmid|et al|bibliograf\w*|citiran\w*)\b|\b(?:19|20)\d{2}\b|\[\s*\d+(?:\s*[,–-]\s*\d+)*\s*\]/iu;
const normalize = (value) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/đ/gu, "d").toLowerCase();
const words = (text) => (text.match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu) ?? []).length;
const sentences = (text) => text.split(/(?<=[.!?])\s+/u);
const stripNegatedCaveats = (text, pattern) => text.replace(pattern, " ");
function hasAssertedUnknownRelationship(copy, master) {
  return sentences(copy).some((sentence) => {
    const asserted = UNSUPPORTED_COOCCURRENCE.test(sentence) ||
      (Boolean(master.openQuestion) && RELATIONSHIP_ASSERTION.test(sentence));
    return asserted && !UNCERTAINTY_CUE.test(sentence);
  });
}
function hasUnsupportedFactStrengthening(copy, master) {
  const facts = normalize(master.selectedInsights.flatMap(({ facts: insightFacts }) => insightFacts).join(" "));
  const checks = [
    [/\b7\s*[–-]\s*9\s+sati\s+u\s+krevetu\b/u, /\b7\s*[–-]\s*9\s+sati\b/u.test(facts) && !/\bu\s+krevetu\b/u.test(facts)],
    [/\bpospanost\b/u, /\b(?:kaf\w*|pauz\w*)\b/u.test(facts) && !/\b(?:pospanost|jedva\s+drzis\s+oci|tesko\s+drzis\s+oci)\b/u.test(facts)],
    [/\b(?:cesta|ucestala)\s+budenj\w*\b|\b(?:se\s+)?budis\s+(?:se\s+)?(?:vise\s+puta|cesto)\b/u, !/\b(?:vise\s+puta|budi(?:s)?\s+se\s+cesto|cesta\s+budenja)\b/u.test(facts)],
    [/\b(?:mrzovolj\w*|razdrazljiv\w*|lose\s+raspolozen\w*)\b/u, !/\b(?:mrzovolj\w*|razdrazljiv\w*|raspolozen\w*)\b/u.test(facts)],
    [/\b(?:ostan\w*|ostaj\w*)\s+kod\s+kuce\b/u, !/\bkod\s+kuce\b/u.test(facts)],
    [/\b(?:napetost|pokusaj\s+da\s+se\s+odvrati\s+paznja|odvratis\s+paznju)\b/u, !/\b(?:napetost|odvrat\w*\s+paznj\w*)\b/u.test(facts)],
  ];
  return checks.some(([pattern, unsupported]) => unsupported && pattern.test(copy));
}
function hasAssertedCausality(copy) {
  return sentences(copy).some((sentence) => CAUSAL.test(stripNegatedCaveats(sentence, NEGATED_CAUSAL_CAVEAT)) &&
    !UNCERTAINTY_CUE.test(sentence));
}
const safeCount = (value) => Number.isSafeInteger(value) && value >= 0 ? value : null;
const safeUsage = (response, source) => ({
  input_tokens: safeCount(response?.usage?.input_tokens),
  output_tokens: safeCount(response?.usage?.output_tokens),
  total_tokens: safeCount(response?.usage?.total_tokens),
  response_status: ["completed", "incomplete", "failed", "in_progress", "queued", "cancelled"].includes(response?.status)
    ? response.status : "unavailable",
  source: source === "ai" ? "AI_GENERATED" : "FALLBACK",
});

export function validateSleepPremiumStoryProse(candidate, master) {
  const keys = proseKeys(master);
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate) ||
      Object.keys(candidate).length !== keys.length || keys.some((key) => !Object.hasOwn(candidate, key))) {
    return { valid: false, field: "$", category: "shape" };
  }
  const lengths = { story_intro: 1800, insight_1_explanation: 600, insight_2_explanation: 600,
    insight_3_explanation: 600, do_not_change_explanation: 700, open_question_explanation: 500, experiment_explanation: 500 };
  const nullableFields = new Set(["insight_2_explanation", "do_not_change_explanation", "open_question_explanation"]);
  for (const key of keys) {
    const value = candidate[key];
    if (value === null && nullableFields.has(key)) continue;
    if (value !== null && (typeof value !== "string" || !value.trim() || value.length > lengths[key])) {
      return { valid: false, field: key, category: "shape" };
    }
  }
  if ((master.selectedInsights.length < 2) !== (candidate.insight_2_explanation === null) ||
      (master.doNotTargetFirst.length === 0) !== (candidate.do_not_change_explanation === null) ||
      (master.openQuestion === null) !== (candidate.open_question_explanation === null)) {
    return { valid: false, field: "conditional_slots", category: "unauthorized_content" };
  }
  if (words(candidate.story_intro) < 80 || words(candidate.story_intro) > 210) {
    return { valid: false, field: "story_intro", category: "length" };
  }
  for (const key of keys) {
    const value = candidate[key];
    if (value === null) continue;
    const copy = normalize(value);
    if (INTERNAL_ID.test(value)) return { valid: false, field: key, category: "machine_id" };
    if (SENSITIVE.test(value)) return { valid: false, field: key, category: "sensitive_or_link" };
    if (INTERNAL_WORDS.test(copy)) return { valid: false, field: key, category: "internal_language" };
    if (SAFETY_DISCLAIMER.test(copy)) return { valid: false, field: key, category: "unnecessary_disclaimer" };
    const medicalCopy = stripNegatedCaveats(copy, NEGATED_MEDICAL_CAVEAT);
    if (DIAGNOSIS.test(medicalCopy) || TREATMENT_RECOMMENDATION.test(medicalCopy)) {
      return { valid: false, field: key, category: "medical_or_diagnostic" };
    }
    if (hasAssertedCausality(copy)) return { valid: false, field: key, category: "causal_claim" };
    if (hasAssertedUnknownRelationship(copy, master)) return { valid: false, field: key, category: "unsupported_cooccurrence" };
    if (hasAssertedUnknownRelationship(copy, master)) return { valid: false, field: key, category: "unsupported_cooccurrence" };
    if (hasUnsupportedFactStrengthening(copy, master)) return { valid: false, field: key, category: "unsupported_fact_strengthening" };
    if (GUARANTEE.test(copy)) return { valid: false, field: key, category: "guarantee" };
    if (OBJECTIVE.test(copy)) return { valid: false, field: key, category: "objective_measurement" };
    if (ENGLISH_PLACEHOLDER.test(copy)) return { valid: false, field: key, category: "english_placeholder" };
    if (BIBLIOGRAPHY.test(copy)) return { valid: false, field: key, category: "invented_citation" };
  }
  return { valid: true };
}

function assembleReport(master, prose, source, usage, diagnostics = {}) {
  const insightExplanations = [prose.insight_1_explanation, prose.insight_2_explanation, prose.insight_3_explanation]
    .slice(0, master.selectedInsights.length);
  const insights = master.selectedInsights.map((insight, index) => ({
    title: insight.title,
    explanation: insightExplanations[index],
    facts: [...insight.facts],
  }));
  const doNotChange = master.doNotTargetFirst.length ? {
    items: master.doNotTargetFirst.map(({ label, explanation, qualification }) => ({ label, explanation, qualification })),
    explanation: prose.do_not_change_explanation,
  } : null;
  const openQuestion = master.openQuestion ? {
    question: master.openQuestion.question,
    explanation: prose.open_question_explanation,
  } : null;
  const experiment = {
    explanation: prose.experiment_explanation,
    days: master.experiment.map(({ day, themes, action, observe, rationale, restrictions }) => ({
      day, themes: [...themes], action, observe, rationale, restrictions: [...restrictions],
    })),
  };
  const science = master.science.map(({ approvedText, sources, limits, clinicalReviewStatus }) => ({
    explanation: approvedText,
    sources: sources.map(({ label, title, authors, organization, year, url, review_status }) =>
      ({ label, title, authors: [...authors], organization, year, url, review_status })),
    limitations: [...limits],
    clinical_review_status: clinicalReviewStatus,
  }));
  const sections = [
    { title: "TVOJA PRIČA O SNU", text: prose.story_intro },
    { title: "ŠTA SE KOD TEBE NAJVIŠE IZDVAJA", insights },
    { title: "ŠTA SADA NE BIH MENJAO", ...(doNotChange ?? { items: [], explanation: null }) },
    { title: "ŠTA JOŠ NE ZNAMO", ...(openQuestion ?? { question: null, explanation: null }) },
    { title: "TVOJ EKSPERIMENT ZA 7 DANA", ...experiment },
    { title: "ŠTA NAUKA MOŽE DA NAM KAŽE", claims: science },
  ];
  return {
    version: "premium-story-report.v1",
    source,
    profile: master.profile,
    priority: structuredClone(master.priority),
    story_intro: prose.story_intro,
    sections,
    insights,
    do_not_change: doNotChange,
    open_question: openQuestion,
    experiment,
    science,
    safety: { review_only: true, release_allowed: false, clinical_review_status: "pending", ...diagnostics },
    usage,
  };
}

function authorizedFallback(master) {
  const fallback = structuredClone(master.fallbackCopySlots);
  const allowed = new Set(proseKeys(master.master));
  return Object.fromEntries(Object.entries(fallback).filter(([key]) => allowed.has(key)));
}

export function buildDeterministicSleepPremiumStoryReport(master) {
  const prose = authorizedFallback(master);
  const report = assembleReport(master.master, prose, "fallback", null, { reason: "not_generated" });
  return { report, prose, validation: { valid: true, deterministic: true }, source: "fallback", requestCount: 0, usage: null };
}

export async function generateSleepPremiumStoryReport({
  input, openaiClient, apiKeyAvailable = false, timeoutMs = 60000,
  library, maxClaims, onIncompleteResponse, logUsage = () => {},
} = {}) {
  const started = performance.now();
  let response;
  let requestCount = 0;
  let master;
  let writerBriefCharacters = null;
  let schemaCharacters = null;
  let instructionsCharacters = SLEEP_PREMIUM_STORY_INSTRUCTIONS.length;
  let failure = null;
  let validation = null;
  let rawProse;
  const safeRequestId = (value) => typeof value === "string" && /^req_[a-zA-Z0-9]{8,100}$/u.test(value) ? value : null;
  const safeResponseId = (value) => typeof value === "string" && /^resp_[a-zA-Z0-9]{8,100}$/u.test(value) ? value : null;
  const safeEnum = (value, allowed) => typeof value === "string" && allowed.includes(value) ? value : null;
  try {
    master = buildSleepPremiumStoryMaster(input, { ...(library ? { library } : {}), ...(maxClaims ? { maxClaims } : {}) });
  } catch {
    return { report: null, master: null, source: "unavailable", requestCount: 0, usage: null,
      failure: { type: "invalid_input", category: "deterministic_master_unavailable" } };
  }
  const enabled = process.env.RENDER_GIT_BRANCH === "premium-ai-staging" && process.env.ENABLE_PREMIUM_AI_PREVIEW === "true";
  const resultMetrics = () => ({
    writerBriefCharacters,
    instructionsCharacters,
    schemaCharacters,
    estimatedRequestCharacters: writerBriefCharacters === null || schemaCharacters === null ? null :
      writerBriefCharacters + instructionsCharacters + schemaCharacters,
    actualProviderInputTokens: Number.isSafeInteger(response?.usage?.input_tokens) ? response.usage.input_tokens : null,
    actualProviderOutputTokens: Number.isSafeInteger(response?.usage?.output_tokens) ? response.usage.output_tokens : null,
    latencyMilliseconds: Math.round(performance.now() - started),
  });
  if (!enabled) failure = { type: "preview_disabled", category: "staging_gate" };
  else if (!apiKeyAvailable) failure = { type: "missing_api_key", category: "provider_execution" };
  else if (typeof openaiClient?.responses?.create !== "function") failure = { type: "missing_ai_client", category: "provider_execution" };
  else {
    const brief = JSON.stringify(master.writerBrief);
    writerBriefCharacters = brief.length;
    const schema = buildSleepPremiumStoryProseSchema({ selectedInsightCount: master.master.selectedInsights.length });
    schemaCharacters = JSON.stringify(schema).length;
    requestCount = 1;
    try {
      response = await openaiClient.responses.create({
        model: SLEEP_PREMIUM_STORY_MODEL,
        max_output_tokens: SLEEP_PREMIUM_STORY_MAX_OUTPUT_TOKENS,
        reasoning: { effort: "low" },
        store: false,
        text: { verbosity: "low", format: schema },
        input: [
          { role: "system", content: SLEEP_PREMIUM_STORY_INSTRUCTIONS },
          { role: "user", content: brief },
        ],
      }, { maxRetries: 0, timeout: timeoutMs, signal: AbortSignal.timeout(timeoutMs) });
      if (response?.status !== "completed" || response.incomplete_details) {
        const metadata = {
          status: safeEnum(response?.status, ["incomplete", "failed", "cancelled", "queued", "in_progress", "completed"]),
          incompleteReason: safeEnum(response?.incomplete_details?.reason, ["max_output_tokens", "content_filter"]),
          requestId: safeRequestId(response?._request_id),
          responseId: safeResponseId(response?.id),
          outputItemCount: Array.isArray(response?.output) ? response.output.length : 0,
          usage: safeUsage(response, "fallback"),
          error: response?.error ? {
            code: safeEnum(response.error.code, ["server_error", "rate_limit_exceeded", "invalid_prompt"]),
            type: safeEnum(response.error.type, ["server_error", "invalid_request_error", "rate_limit_error", "api_error"]),
          } : null,
        };
        try { onIncompleteResponse?.(metadata); } catch { /* diagnostics do not alter behavior */ }
        failure = { type: "incomplete_response", category: "provider_incomplete", metadata };
      } else {
        const outputText = typeof response.output_text === "string" ? response.output_text : "";
        try { rawProse = JSON.parse(outputText); } catch { failure = { type: "invalid_json", category: "model_output" }; }
        if (!failure) {
          validation = validateSleepPremiumStoryProse(rawProse, master.master);
          if (!validation.valid) failure = { type: "prose_validation_failure", category: validation.category, field: validation.field };
        }
      }
    } catch (error) {
      failure = { type: "provider_execution", category: error?.name === "AbortError" || error?.name === "TimeoutError" ? "timeout" : "request_failed" };
    }
  }
  const source = failure ? "fallback" : "ai";
  const prose = failure ? authorizedFallback(master) : rawProse;
  const usage = response ? {
    input_tokens: Number.isSafeInteger(response.usage?.input_tokens) ? response.usage.input_tokens : null,
    output_tokens: Number.isSafeInteger(response.usage?.output_tokens) ? response.usage.output_tokens : null,
    total_tokens: Number.isSafeInteger(response.usage?.total_tokens) ? response.usage.total_tokens : null,
    response_status: response.status ?? "unavailable",
  } : null;
  const report = assembleReport(master.master, prose, source, usage, {
    semantic_review_required: true,
    ...(failure ? { prose_fallback_reason: failure.category } : {}),
  });
  const metrics = resultMetrics();
  try { logUsage({ source, requestCount, usage, ...metrics, failureType: failure?.type ?? null }); } catch { /* logging cannot alter report */ }
  return {
    report,
    master: master.master,
    writerBrief: master.writerBrief,
    prose,
      rawGptProse: rawProse ?? null,
    source,
    requestCount,
    usage,
    metrics,
    failure,
    validation: failure ? { valid: false, category: failure.category } : { valid: true },
    review_only: true,
    release_allowed: false,
  };
}

export function countWords(value) { return words(value); }