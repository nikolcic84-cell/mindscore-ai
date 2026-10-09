import { buildSleepPremiumWriterBrief, projectSleepPremiumWriterBrief } from "./sleepPremiumWriterBrief.js";
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

/** Compact writer transport; the full frozen canonical brief stays server-side
 * for validation/adaptation. Shared strings and column tables are lossless
 * within the selected transport, including qualifiers and local boundaries.
 */
export function serializeSleepPremiumWriterBrief(brief) {
  buildSleepPremiumMasterJsonSchema(brief); // Check canonical contract first.
  const transport = projectSleepPremiumWriterBrief(brief);
  const frequencies = new Map();
  const visit = (value) => {
    if (typeof value === "string" && value.length >= 48) frequencies.set(value, (frequencies.get(value) ?? 0) + 1);
    else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object") Object.values(value).forEach(visit);
  };
  visit(transport);
  const shared = [...frequencies].filter(([value, n]) => (n - 1) * value.length > n * 16 + 8).map(([value]) => value);
  const indexes = new Map(shared.map((value, index) => [value, index]));
  const project = (value) => {
    if (typeof value === "string" && indexes.has(value)) return { $text: indexes.get(value) };
    if (Array.isArray(value)) {
      // Homogeneous records repeat their field names once, not once per row.
      const columns = value.length >= 2 && value[0] && typeof value[0] === "object" && !Array.isArray(value[0])
        ? Object.keys(value[0]) : null;
      if (columns && value.every((row) => row && !Array.isArray(row) && same(Object.keys(row), columns))) {
        return { columns, rows: value.map((row) => columns.map((key) => project(row[key]))) };
      }
      return value.map(project);
    }
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, project(child)]));
    return value;
  };
  return JSON.stringify({ encoding: "tables-and-text.v2", shared_text: shared, brief: project(transport) });
}

// Independent Phase 2 editorial instructions. Existing v2 prompt/generator and
// their private diagnostics are deliberately not imported or modified.
export const SLEEP_PREMIUM_WRITER_INSTRUCTIONS = `Analiza je već završena. Ne opisuj postupak: ispričaj osobi priču koju materijal sadrži, prirodnim srpskim, latinicom. Vrati samo JSON po šemi.
Ne radi novu analizu, rangiranje, profilisanje ili izbor prioriteta. Opažanje + razlika + otvoreno pitanje + korisno naučno objašnjenje + mali pokušaj čine priču, ne niz odgovora iz upitnika.
Ulaz tables-and-text.v2: {$text:n}=shared_text[n]; {columns,rows} je niz objekata sa tim kolonama; days.action_ref upućuje na action_catalog. Razreši reference, uključujući sve granice.
profile i priority.area su fiksni. primary_insight ide prvi, sekundarni samo ponuđeni i u datom redosledu; supporting_content.insights prati iste ID-jeve. facts je jedino lično činjenično uporište. Sačuvaj učestalost, uslovnost, neizvesnost i genericity_flags. Ne izmišljaj iste noći/dane, uzrok niti neprijavljene navike.
Piši direktno o spavanju, ne o sistemu. Nikad u prozi: urednički, analitički, hipoteza, kandidat, anchor, noncausal, validator, deterministički, model, ovaj izveštaj, interni/klinički pregled u toku ili mašinski ID. Umesto 'urednička hipoteza' napiši prirodno 'Još ne znamo da li se ove stvari kod tebe javljaju zajedno.' Ne ponavljaj pravne ograde; objasni jedno konkretno nepoznato. Intro 1–2 rečenice; insight i context se dopunjuju, ne prepisuju.
Nauka samo u insight.text/context: lično opažanje → korisno pitanje → koncept iz science → njegova granica → nazad osobi. Razlikuj opštu smernicu, okvir i malu studiju. Samo allowed_claim_ids tog insighta; ukupno 1–3 kad relevantna nauka postoji, inače []. ID znači da si stvarno objasnio taj koncept, ne ukras. Bez autora, godina, naslova, DOI/URL ili ručnih citata; server ih rešava.
Ponuđen koristan explanation_device stvarno objasni u prozi, kao kratko zamišljeno poređenje, pa se vrati osobi. Poštuj does_not_imply; nikad ga ne predstavi kao stvaran događaj. Ako ga nisi upotrebio, device_id=null. Ne forsiraj analogiju.
Sedam dana je JEDAN mali pokušaj: 1 početni utisak; 2 glavno pitanje; 3 drugi već dodeljeni ugao; 4 poređenje; 5 postojeća druga radnja ako je dodeljena, inače drugi koristan pogled; 6 ponovi dodeljeno jednostavno opažanje; 7 šta se razlikovalo. Svaki action/observe je kratak i konkretan, ne 'dodeljeni deo sna'. Personalizuj unutar činjenica dana. Prepiši tačne technique_id i themeIds→theme_ids iz days; null ostaje opažanje, bez nove intervencije. action_catalog i restrictions određuju granice, ne rečenice za kopiranje. Ne dodaj korak da bi razbio ponavljanje; svrhovito ponavljanje jasno nazovi. Rationale jedna kratka rečenica; reflection=null osim korisnog osvrta bez novog zadatka. I bez razlike saznaješ nešto. first_step počinje taj plan.
Sve je dobrovoljno; preskoči ako opterećuje. Nema noćnog gledanja sata, namernog buđenja, uskraćivanja sna, ranijeg alarma, nove satnice, disanja, terapije ili obećanja koristi. Poštuj boundaries i sve lokalne limits/restrictions. Unknown nije negativan nalaz. Ne biraj uzrok među rivals; do_not_target_first i positives čuvaju ono što ne treba menjati.
Alternatives=[] ako nema zaista različitog postojećeg koraka druge teme; nikad kopija praćenja. Ako postoji, samo postojeća days radnja/technique_id/themeIds van teme dana 2. tracking najviše dva kratka opcionalna poređenja, ne protokol.
MIRNA NOĆ: očuvaj stabilno; bez problema, prisilne nauke, rivala, obrta, praćenja ili intervencija. Sedam kratkih dana može biti nenametljivo očuvanje bez zapisa. Ne zahtevaj stalno posmatranje.
uncertainty.question čuva smisao best_next_question, anchor_fact_ids tačno njegove fact_ids u istom redosledu; ako je null, question=null i anchors=[].
Provenance izračunaj TEK iz napisanih referenci: evidence_ids=jedinstvena UNIJA insights[*].evidence_ids, NE lista dostupne science; technique_ids=unija nenultih plan7/alternatives.technique_id; device_ids=unija nenultih insights.device_id. primary_insight_id je tačan primary ID. Nekorišćen claim NE dodaj ni ovde ni u insight radi prolaza. Ne popravljaj prozu novim zaključkom. Proveri tačne unije i dužinske limite pre vraćanja; compliance=true nije odobrenje.`;

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

const safeRequestId = (value) => typeof value === "string" && /^req_[a-zA-Z0-9]{8,100}$/u.test(value) ? value : null;

function incompleteMetadata(response, latencyMilliseconds) {
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
    responseModel: typeof response?.model === "string" && /^gpt-5-mini(?:-\d{4}-\d{2}-\d{2})?$/u.test(response.model) ? response.model : null,
    requestId: safeRequestId(response?._request_id),
    errorPresent: response?.error != null,
    usagePresent: response?.usage != null,
    usage: safeUsage(response, "fallback"),
    latencyMilliseconds,
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
          reject(fail("timeout", "Premium writer request timed out.", {
            executionDiagnostics: { timeoutLayer: "writer_deadline", timeoutMs, abortRequested: true, providerCompletionUnknown: true },
          }));
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
  let requestStarted = null;
  let requestLatencyMilliseconds = null;
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
    requestStarted = performance.now();
    response = await oneCall(openaiClient, {
      model: SLEEP_PREMIUM_WRITER_MODEL, max_output_tokens: SLEEP_PREMIUM_WRITER_MAX_OUTPUT_TOKENS,
      // v1 spent 55–68% of completed output on reasoning despite finished
      // analysis. Low effort is supported by this model and leaves the same
      // 8000 cap/strict schema/safety gate, with no extra call or timeout bump.
      reasoning: { effort: "low" },
      store: false, text: { verbosity: "low", format: buildSleepPremiumMasterJsonSchema(brief) },
      input: [{ role: "system", content: SLEEP_PREMIUM_WRITER_INSTRUCTIONS }, { role: "user", content: serialized }],
    }, timeoutMs);
    requestLatencyMilliseconds = Math.round(performance.now() - requestStarted);
    if (response?.status !== "completed" || response.incomplete_details) {
      const metadata = incompleteMetadata(response, requestLatencyMilliseconds);
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
      ...(failureType === "timeout" ? { executionDiagnostics: error.executionDiagnostics ?? {
        timeoutLayer: error?.name === "APIConnectionTimeoutError" ? "openai_sdk" : "request_abort",
        timeoutMs, abortRequested: true, providerCompletionUnknown: true,
      } } : {}),
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
      result.inputMetrics = {
        encoding: "tables-and-text.v2",
        briefCharacters: serializedBriefCharacters,
        briefEstimatedTokens: serializedBriefCharacters === null ? null : Math.ceil(serializedBriefCharacters / 4),
        instructionsCharacters: SLEEP_PREMIUM_WRITER_INSTRUCTIONS.length,
        estimateMethod: "characters / 4, rounded up; not provider tokenization",
      };
      result.requestLatencyMilliseconds = requestStarted === null ? null : requestLatencyMilliseconds ?? Math.round(performance.now() - requestStarted);
      result.providerMetadata = {
        requestId: safeRequestId(response?._request_id), usagePresent: response?.usage != null,
        responseModel: typeof response?.model === "string" && /^gpt-5-mini(?:-\d{4}-\d{2}-\d{2})?$/u.test(response.model) ? response.model : null,
        reasoningEffort: "low", timeoutMs,
      };
      result.review_only = true;
      result.release_allowed = false;
      result.clinical_review_status = "pending";
      result.semantic_review_required = true;
      if (enabled) observe((value) => logUsage("[PREMIUM_AI_USAGE]", JSON.stringify(value)), result.usage);
    }
  }
  return result;
}