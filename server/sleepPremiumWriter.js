import { buildSleepPremiumWriterBrief } from "./sleepPremiumWriterBrief.js";
import { buildSleepPremiumMasterJsonSchema, validateSleepPremiumMaster } from "./sleepPremiumMasterSchema.js";
import { adaptSleepPremiumMasterForPreview } from "./sleepPremiumMasterAdapter.js";
import { buildSleepPremiumFallback } from "./sleepPremiumFallback.js";
import { validateSleepPremiumReport } from "./sleepPremiumSchema.js";

export const SLEEP_PREMIUM_WRITER_MODEL = "gpt-5-mini";
export const SLEEP_PREMIUM_WRITER_MAX_OUTPUT_TOKENS = 8000;
const STATUSES = ["completed", "incomplete", "failed", "in_progress", "queued", "cancelled"];
const count = (value) => Number.isSafeInteger(value) && value >= 0 ? value : null;
const same = (a, b) => a.length === b.length && a.every((value, index) => value === b[index]);

export const isSleepPremiumWriterEnabled = () => process.env.RENDER_GIT_BRANCH === "premium-ai-staging" &&
  process.env.ENABLE_PREMIUM_AI_PREVIEW === "true";

/** Lossless compact projection of the canonical brief ONLY. Repeated long
 * strings become {$text:index}; shared_text holds their exact originals. This
 * never accepts the pre-AI debug dump, questionnaire or raw-answer payload.
 * Safety boundaries, qualifiers, all seven days and review flags survive.
 */
export function serializeSleepPremiumWriterBrief(brief) {
  buildSleepPremiumMasterJsonSchema(brief); // Check canonical contract first.
  const frequencies = new Map();
  const visit = (value) => {
    if (typeof value === "string" && value.length >= 48) frequencies.set(value, (frequencies.get(value) ?? 0) + 1);
    else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object") Object.values(value).forEach(visit);
  };
  visit(brief);
  const shared = [...frequencies].filter(([value, n]) => (n - 1) * value.length > n * 16 + 8).map(([value]) => value);
  const indexes = new Map(shared.map((value, index) => [value, index]));
  const project = (value) => {
    if (typeof value === "string" && indexes.has(value)) return { $text: indexes.get(value) };
    if (Array.isArray(value)) return value.map(project);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, project(child)]));
    return value;
  };
  return JSON.stringify({ encoding: "shared-text.v1", shared_text: shared, brief: project(brief) });
}

// Independent Phase 2 editorial instructions. Existing v2 prompt/generator and
// their private diagnostics are deliberately not imported or modified.
export const SLEEP_PREMIUM_WRITER_INSTRUCTIONS = `Ti si urednik srpskog wellness izveštaja, ne analitičar, lekar niti novi klasifikator.
Jedini materijal je deterministički writer brief. Kod encoding=shared-text.v1 svaki objekat {$text:n} znači tačan tekst shared_text[n]; razreši ga pre pisanja. To nisu opcione skraćene granice.
Vrati samo JSON po zadatoj strict master šemi. Review je interni nacrt: klinički i semantički pregled su pending, nikada odobrenje za kupca.
Ne radi novu analizu, rangiranje, profilisanje ili izbor prioriteta. profile i priority.area ostaju potpuno isti. primary_insight je jedina glavna nit; prvi insight i provenance.primary_insight_id moraju imati njegov tačan insight_id. Sekundarni su samo iz briefa, u postojećem redosledu, najviše dva, bez konkurentske glavne priče. supporting_content.insights prati baš te iste ID-jeve i redosled.
Poveži više podržanih opažanja u jasnu priču: šta je zanimljiva razlika, zašto je važna za poređenje i šta još ne znamo. Ne prepričavaj svih dvanaest pitanja, ne citiraj izabrane odgovore redom i ne izmišljaj istovremeno javljanje. Opservacija, neuzročna hipoteza i mirnije osobine nisu ista vrsta zaključka. Sačuvaj frequency, uncertainty, qualifiers i genericity_flags; generički materijal nije otkriven lični odnos.
Piši prirodan, gramatički dobar srpski, latinicom, mirno i sa merom, direktno osobi. Bez stručnog žargona, dramatizacije, motivacionih obećanja, recitovanja upitnika ili gomilanja saveta. MIRNA NOĆ traži očuvanje onoga što osoba već navodi, ne izmišljenu teškoću, tracking ili alternative.
Ako postoji primenljiva nauka za izabrane insighte, koristi ukupno 1–3 različita claim_id iz approved_science, samo iz evidence_claim_ids baš tog insighta. Ako je nema, evidence_ids su prazni. evidence_ids sadrži claim_id, NIKADA evidence_id, source ID, DOI ili naziv rada. Naučno objašnjenje sme biti samo u text/context odgovarajućeg insighta; razlikuj smernicu, konceptualni okvir i ograničenu studiju. Svaki claim zadržava limits, strength i directness; izvor nije dokaz lične koristi ili uzroka. Nikakva bibliografija, autori, godine, URL ili DOI u generisanoj prozi: to server rešava odvojeno.
Najviše dva različita explanation_devices, isključivo ponuđena, vezana za činjenice tog insighta, bez proširivanja analogije izvan does_not_imply. device_id=null je u redu; ne forsiraj uređaj. Svi mašinski ID-jevi ostaju isključivo u metapodacima, nikada u korisničkom tekstu.
plan7 mora imati svih sedam dana u redosledu 1–7. Za svaki dan prepiši tačan technique_id (uključujući null) i themeIds kao theme_ids iz experiment7. Samo rediguj njegov postojeći action i observe unutar njihovih granica; ne biraj novu tehniku iz ukupne liste. Zadrži opcionalnost, uslove prekida, bez gledanja sata noću, bez obaveznog beleženja ili promene satnice kada su navedeni. Ne menjaj opservacioni fallback u intervenciju. Poštuj differentActionFromDay2And3 bez izmišljanja radnje. Rationale objašnjava baš tu radnju; reflection ne dodaje novi zadatak. first_step je kratak početak tog plana, ne drugi prioritet ili nova radnja.
Alternativa nije dozvola za dodatni savet: samo već postojeći korak druge raspoložive teme iz experiment7, sa istim technique_id i granicama; nikada teme drugog dana. Može biti prazna. tracking je samo opcionalno poređenje odabranih iskustava, bez novog protokola. supported_positives i do_not_target_first sa qualification ograničavaju šta treba menjati.
Ako best_next_question postoji, uncertainty.question sačuva njegov smisao i ne sme biti null; anchor_fact_ids su tačno svi njegovi fact_ids u istom redosledu. Ako ne postoji, question=null i anchor_fact_ids=[]. Sačuvaj rivals, twist, interpretation_status i unknown kao granice: ne biraj uzrok među rivalima. Nepoznati uzrast, trajanje teškoća, zdravstveni podaci, smene ili prilika za san nisu negativni nalazi.
Bez dijagnoze, lečenja, medicinskog protokola, samostalnog CBT-I, restrikcije sna, ranijeg alarma, uskraćivanja sna, precizne doze svetla, novih vežbi disanja ili izmišljenih aktivnosti. Bez tvrdnje da navika izaziva problem ili da će korak popraviti san ili energiju. Poštuj svaki prohibited_conclusions i lokalni limits/restrictions.
Provenance je tačan skup svih stvarno upotrebljenih claim_id, technique_id i device_id, bez duplikata ili nekorišćenih referenci. compliance=true izražava nameru, ne kliničko odobrenje. Poštuj sve dužinske granice šeme; kraći smislen tekst je bolji od popunjavanja limita.`;

function safeUsage(response, source) {
  const usage = response?.usage;
  return {
    model: SLEEP_PREMIUM_WRITER_MODEL,
    input_tokens: count(usage?.input_tokens), output_tokens: count(usage?.output_tokens), total_tokens: count(usage?.total_tokens),
    ...(count(usage?.input_tokens_details?.cached_tokens) !== null ? { cached_input_tokens: usage.input_tokens_details.cached_tokens } : {}),
    ...(count(usage?.output_tokens_details?.reasoning_tokens) !== null ? { reasoning_tokens: usage.output_tokens_details.reasoning_tokens } : {}),
    response_status: STATUSES.includes(response?.status) ? response.status : "unavailable",
    source: source === "ai" ? "AI_GENERATED" : "FALLBACK",
  };
}

function incompleteMetadata(response) {
  const token = (value, allowed) => typeof value !== "string" ? null : allowed.includes(value) ? value : "[withheld: unrecognized metadata]";
  const types = ["message", "reasoning", "output_text", "refusal", "function_call", "web_search_call", "file_search_call"];
  const finishReasons = ["stop", "length", "max_output_tokens", "content_filter", "tool_calls", "function_call"];
  const output = Array.isArray(response?.output) ? response.output : [];
  const item = (entry) => ({ type: token(entry?.type, types),
    ...(entry?.status !== undefined ? { status: token(entry.status, STATUSES) } : {}),
    ...(entry?.finish_reason !== undefined ? { finish_reason: token(entry.finish_reason, finishReasons) } : {}) });
  const checks = [
    ...(response?.status !== "completed" ? ['response.status !== "completed"'] : []),
    ...(response?.incomplete_details ? ["Boolean(response.incomplete_details) === true"] : []),
  ];
  return {
    status: token(response?.status, STATUSES),
    ...(response?.incomplete_details != null ? { incomplete_details: { reason: token(response.incomplete_details.reason, ["max_output_tokens", "content_filter"]) } } : {}),
    ...(response?.error != null ? { error: {
      code: token(response.error.code, ["server_error", "rate_limit_exceeded", "invalid_prompt"]),
      ...(response.error.message !== undefined ? { message: "[withheld: free-form API error message]" } : {}),
    } } : {}),
    outputTextExists: typeof response?.output_text === "string",
    outputTextCharacterLength: typeof response?.output_text === "string" ? response.output_text.length : 0,
    outputItemCount: output.length, outputItemTypes: output.map((entry) => token(entry?.type, types)),
    outputItemMetadata: output.map((entry) => ({ ...item(entry), content: Array.isArray(entry?.content) ? entry.content.map(item) : [] })),
    configuredModel: SLEEP_PREMIUM_WRITER_MODEL, max_output_tokens: SLEEP_PREMIUM_WRITER_MAX_OUTPUT_TOKENS,
    internalReason: `${checks.join(" OR ")} -> AI response was incomplete.`,
  };
}

const fail = (failureType, reason, details = {}) => Object.assign(new Error(reason), { failureType, ...details });
const observe = (callback, value) => { try { callback?.(value); } catch { /* Diagnostics must not change acceptance. */ } };

function containsSensitiveDraft(value) {
  if (typeof value === "string") return /\S+@\S+|\b(?:cs_|pi_|cus_|sess_|session[_ -]?|sk[-_]|pk_(?:live|test)_|whsec_)\S+|\b(?:bearer\s+\S+|(?:password|passwd|credential|api[_ -]?key|access[_ -]?token|secret)\s*[:=]\s*\S+)|\b[0-9a-f]{8}-[0-9a-f-]{27,}\b|(?:\+?\d[\s().-]*){7,}/iu.test(value);
  if (Array.isArray(value)) return value.some(containsSensitiveDraft);
  if (value && typeof value === "object") return Object.entries(value).some(([key, child]) => containsSensitiveDraft(key) || containsSensitiveDraft(child));
  return false;
}

async function oneCall(client, request, timeoutMs) {
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(() => client.responses.create(request, { signal: controller.signal, timeout: timeoutMs, maxRetries: 0 })),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(fail("timeout", "Premium writer request timed out."));
          controller.abort();
        }, timeoutMs);
      }),
    ]);
  } finally { clearTimeout(timer); }
}

function validateWriterBounds(master, brief) {
  for (const [index, day] of master.plan7.entries()) {
    if (day.technique_id !== brief.experiment7[index].technique_id) return { valid: false, reason: "Technique must match this canonical day.", diagnostic: { field: `plan7[${index}].technique_id` } };
  }
  for (const [index, alternative] of master.alternatives.entries()) {
    if (!brief.experiment7.some((day) => day.technique_id === alternative.technique_id && same(day.themeIds, alternative.theme_ids))) {
      return { valid: false, reason: "Alternative must reuse an existing bounded plan allocation.", diagnostic: { field: `alternatives[${index}]` } };
    }
  }
  const selected = [brief.primary_insight, ...brief.secondary_insights];
  const scienceAvailable = master.insights.some((entry) => selected.find((anchor) => anchor.insight_id === entry.insight_id).evidence_claim_ids.length);
  if (master.provenance.evidence_ids.length > 3 || (scienceAvailable && !master.provenance.evidence_ids.length) || master.provenance.device_ids.length > 2) {
    return { valid: false, reason: "Use 1–3 available selected science claims and at most two devices.", diagnostic: { field: "provenance" } };
  }
  for (const [index, insight] of master.insights.entries()) {
    const anchor = selected.find((entry) => entry.insight_id === insight.insight_id);
    const device = brief.explanation_devices.find((entry) => entry.device_id === insight.device_id);
    if (device && !device.fact_ids.some((id) => anchor.fact_ids.includes(id))) return { valid: false, reason: "Device must share a fact anchor with its insight.", diagnostic: { field: `insights[${index}].device_id` } };
  }
  if (brief.best_next_question && (master.uncertainty.question === null || !same(master.uncertainty.anchor_fact_ids, brief.best_next_question.fact_ids))) {
    return { valid: false, reason: "Keep the selected uncertainty question and its exact fact anchors.", diagnostic: { field: "uncertainty" } };
  }
  return { valid: true };
}

/** INTERNAL Phase 2 only; never imported into fulfillment or public routes.
 * A validated master is still NOT clinically/semantically approved. Rejected
 * drafts are opt-in for synthetic internal benchmarks only, never previewed.
 * There is exactly one Responses call (SDK retries disabled), no repair pass.
 */
export async function generateSleepPremiumMaster({
  input, openaiClient, apiKeyAvailable = false, timeoutMs = 60000,
  briefOptions = {}, includePreview = true, internalBenchmark = false,
  includeRejectedDraft = false, onIncompleteResponse, logUsage = console.log,
} = {}) {
  const enabled = isSleepPremiumWriterEnabled();
  let brief = null;
  let response;
  let draft;
  let validation = null;
  let result;
  let requestCount = 0;
  let serializedBriefCharacters = null;
  try {
    // Build from deterministic pre-AI through the canonical projection, never
    // accept a caller-supplied brief, prompt or analyzed debug blob.
    brief = buildSleepPremiumWriterBrief(input, { library: briefOptions.library, maxClaims: briefOptions.maxClaims });
    if (!enabled) throw fail("preview_disabled", "Writer requires premium-ai-staging and ENABLE_PREMIUM_AI_PREVIEW=true.");
    if (!apiKeyAvailable) throw fail("missing_api_key", "OPENAI_API_KEY is unavailable.");
    if (typeof openaiClient?.responses?.create !== "function") throw fail("missing_ai_client", "OpenAI Responses client is unavailable.");
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) throw fail("invalid_timeout", "Writer timeout must be a positive integer.");
    const serialized = serializeSleepPremiumWriterBrief(brief);
    serializedBriefCharacters = serialized.length;
    requestCount = 1;
    response = await oneCall(openaiClient, {
      model: SLEEP_PREMIUM_WRITER_MODEL, max_output_tokens: SLEEP_PREMIUM_WRITER_MAX_OUTPUT_TOKENS,
      store: false, text: { format: buildSleepPremiumMasterJsonSchema(brief) },
      input: [{ role: "system", content: SLEEP_PREMIUM_WRITER_INSTRUCTIONS }, { role: "user", content: serialized }],
    }, timeoutMs);
    if (response?.status !== "completed" || response.incomplete_details) {
      const metadata = incompleteMetadata(response);
      observe((value) => console.warn("[PREMIUM_AI_INCOMPLETE_RESPONSE]", JSON.stringify(value)), metadata);
      observe(onIncompleteResponse, metadata);
      throw fail("incomplete_response", "AI response was incomplete.", { incompleteDiagnostics: metadata });
    }
    if (response.output?.some((entry) => entry?.type === "message" && entry.content?.some((part) => part?.type === "refusal"))) {
      throw fail("model_refusal", "Premium writer refused the structured request.");
    }
    const text = typeof response.output_text === "string" ? response.output_text : (response.output ?? [])
      .filter((entry) => entry?.type === "message").flatMap((entry) => entry.content ?? [])
      .filter((part) => part?.type === "output_text" && typeof part.text === "string").map((part) => part.text).join("");
    try { draft = JSON.parse(text); } catch { throw fail("invalid_json", "AI response did not contain valid JSON."); }
    validation = validateSleepPremiumMaster(draft, brief);
    if (validation.valid) validation = validateWriterBounds(draft, brief);
    if (!validation.valid) throw fail("schema_validation_failure", validation.reason, { failureDiagnostic: validation.diagnostic });
    let preview;
    try {
      if (includePreview) preview = adaptSleepPremiumMasterForPreview(draft, brief, briefOptions.library ? { library: briefOptions.library } : {});
    } catch { throw fail("preview_adapter_failure", "Validated master could not be adapted against the evidence registry."); }
    result = { source: "ai", master: draft, brief, ...(preview ? { preview } : {}), reason: "ok", failureType: null,
      validation: { valid: true, semantic_review_required: true } };
  } catch (error) {
    let legacyFallback = null;
    let legacyFallbackValidation = { valid: false, reason: "Canonical input or legacy fallback unavailable." };
    try {
      const candidate = buildSleepPremiumFallback(input);
      const checked = validateSleepPremiumReport(candidate, input);
      legacyFallbackValidation = { valid: checked.valid, reason: checked.reason };
      if (checked.valid) legacyFallback = checked.report;
    } catch { /* Invalid input must not leak errors or masquerade as a report. */ }
    const httpStatus = Number.isInteger(error?.status) && error.status >= 100 && error.status <= 599 ? error.status : null;
    const failureType = error?.failureType ?? (error?.name === "APIConnectionTimeoutError" || error?.name === "AbortError" ? "timeout"
      : httpStatus ? "openai_http_error" : brief ? "openai_request_failed" : "invalid_input");
    // Never return free-form SDK error messages, response contents or secrets.
    result = { source: "fallback", master: null, brief, legacyFallback, legacyFallbackValidation,
      failureType, reason: error?.failureType ? error.message : "Premium writer could not complete the request.", failureStatus: httpStatus,
      validation: { valid: false, reason: validation?.reason ?? "Master was not accepted.", ...(validation?.diagnostic ? { diagnostic: validation.diagnostic } : {}) },
      ...(error?.incompleteDiagnostics ? { incompleteDiagnostics: error.incompleteDiagnostics } : {}),
      ...(error?.failureDiagnostic ? { failureDiagnostic: error.failureDiagnostic } : {}) };
    if (enabled && internalBenchmark && includeRejectedDraft && draft !== undefined) {
      // The privacy/internal-metadata gate takes precedence even for reviewers.
      // Scan even malformed shapes: the schema can fail before checking prose.
      if (validation?.reason === "Sensitive or internal metadata in generated copy." || containsSensitiveDraft(draft)) result.rejectedDraftWithheld = true;
      else result.rejectedDraft = { accepted: false, review_only: true, release_allowed: false, candidate: draft };
    }
  } finally {
    if (result) {
      result.usage = safeUsage(response, result.source);
      result.requestCount = requestCount;
      result.serializedBriefCharacters = serializedBriefCharacters;
      result.review_only = true;
      result.release_allowed = false;
      result.clinical_review_status = "pending";
      result.semantic_review_required = true;
      if (enabled) observe((value) => logUsage("[PREMIUM_AI_USAGE]", JSON.stringify(value)), result.usage);
    }
  }
  return result;
}