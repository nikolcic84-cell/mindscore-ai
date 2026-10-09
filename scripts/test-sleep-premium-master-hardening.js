import assert from "node:assert/strict";
import test from "node:test";
import { buildSleepPremiumInput } from "../server/sleepPremiumInput.js";
import { buildSleepPremiumWriterBrief, projectSleepPremiumWriterBrief } from "../server/sleepPremiumWriterBrief.js";
import { validateSleepPremiumMaster } from "../server/sleepPremiumMasterSchema.js";
import { generateSleepPremiumMaster } from "../server/sleepPremiumWriter.js";
import { benchmarkFixtures } from "./debug-sleep-premium-story-material.js";

const unique = (values) => [...new Set(values)];
const fixture = benchmarkFixtures[5];
const input = buildSleepPremiumInput(fixture.answers);
const brief = buildSleepPremiumWriterBrief(input);
const selected = [brief.primary_insight, ...brief.secondary_insights];

function decodeWriterTransport(serialized) {
  const envelope = JSON.parse(serialized);
  assert.equal(envelope.encoding, "tables-and-text.v2.2");
  const decode = (value) => {
    if (Array.isArray(value)) return value.map(decode);
    if (value && typeof value === "object") {
      if (Object.keys(value).length === 1 && Object.hasOwn(value, "$text")) return envelope.shared_text[value.$text];
      if (Array.isArray(value.columns) && Array.isArray(value.rows)) {
        return value.rows.map((row) => Object.fromEntries(value.columns.map((column, index) => [column, decode(row[index])])));
      }
      return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, decode(child)]));
    }
    return value;
  };
  return decode(envelope.brief);
}

function draftFromBrief() {
  const master = {
    version: 1,
    profile: brief.profile,
    priority: { area: brief.priority.area, explanation: "Odabrani početak ostaje u granicama prijavljenog iskustva.", first_step: "Kreni od već odabranog koraka." },
    intro: "Ovo je kratak pregled odabranih opažanja, uz otvorena pitanja.",
    insights: selected.map((entry) => ({ insight_id: entry.insight_id, title: "Odabrano opažanje",
      text: "Različita iskustva ostaju odvojena dok ih pažljivije ne uporediš.",
      evidence_ids: entry.evidence_claim_ids.slice(0, 1), device_id: null })),
    tracking: [],
    plan7: brief.experiment7.map((entry) => ({ day: entry.day,
      action: "Zadrži odabrani korak u njegovim postojećim granicama.",
      observe: "Primeti svoje iskustvo bez dodatnog zadatka.", technique_id: entry.technique_id,
      theme_ids: [...entry.themeIds] })),
    alternatives: [],
    uncertainty: { question: brief.best_next_question ? "Da li ova iskustva opisuješ tokom istih dana?" : null,
      anchor_fact_ids: [...(brief.best_next_question?.fact_ids ?? [])] },
    supporting_content: {
      insights: selected.map(({ insight_id }) => ({ insight_id,
        context: "Ovo opažanje ne bira objašnjenje između mogućih tumačenja." })),
      days: brief.experiment7.map(({ day }) => ({ day,
        rationale: "Ovaj osvrt ostaje uz postojeći korak.", reflection: null })),
      closing: "Sačuvaj prostor za ono što još nije poznato.",
    },
    provenance: {},
    compliance: { no_diagnosis: true, no_causation: true, no_guarantee: true },
  };
  master.provenance = {
    primary_insight_id: brief.primary_insight.insight_id,
    evidence_ids: unique(master.insights.flatMap(({ evidence_ids }) => evidence_ids)),
    technique_ids: unique(master.plan7.map(({ technique_id }) => technique_id).filter((id) => id !== null)),
    device_ids: [],
  };
  return master;
}

function assertRejectsCopy(master, phrase, field = "intro") {
  const candidate = structuredClone(master);
  if (field === "supporting_content.days[1].rationale") candidate.supporting_content.days[1].rationale = phrase;
  else candidate[field] = phrase;
  const result = validateSleepPremiumMaster(candidate, brief);
  assert.equal(result.valid, false, phrase);
  assert.equal(result.diagnostic.field, field);
  return result;
}

test("ordinary Serbian investigation phrasing does not assert scientific authority", () => {
  const master = draftFromBrief();
  master.supporting_content.days[1].rationale = "Bez istraživanja tokom noći, samo primeti svoj utisak ujutru.";
  assert.equal(validateSleepPremiumMaster(master, brief).valid, true);

  const ownImpressions = draftFromBrief();
  ownImpressions.supporting_content.days[1].rationale = "Istraživanje sopstvenih utisaka može ostati kratko i neobavezno.";
  assert.equal(validateSleepPremiumMaster(ownImpressions, brief).valid, true);
});

test("ordinary investigation exception does not hide a mixed scientific-authority claim", () => {
  const master = draftFromBrief();
  assertRejectsCopy(master,
    "Bez istraživanja tokom noći, naučne smernice potvrđuju da ovaj korak deluje.",
    "supporting_content.days[1].rationale");

  const second = draftFromBrief();
  assertRejectsCopy(second,
    "Istraživanje sopstvenih utisaka; naučno istraživanje potvrđuje ovaj zaključak.",
    "supporting_content.days[1].rationale");
});

test("negated proof language is allowed but proof claims and mixed guarantees still fail", () => {
  const cautious = draftFromBrief();
  cautious.intro = "Ova opažanja ne dokazuju uzrok.";
  assert.equal(validateSleepPremiumMaster(cautious, brief).valid, true);

  const affirmative = draftFromBrief();
  affirmative.intro = "Ova opažanja dokazuju uzrok.";
  const affirmativeResult = validateSleepPremiumMaster(affirmative, brief);
  assert.equal(affirmativeResult.valid, false);
  assert.equal(affirmativeResult.diagnostic.category, "unsupported_proof_claim");

  const mixed = draftFromBrief();
  mixed.intro = "Ova opažanja ne dokazuju uzrok, ali sigurno popravljaju san.";
  const mixedResult = validateSleepPremiumMaster(mixed, brief);
  assert.equal(mixedResult.valid, false);
  assert.equal(mixedResult.diagnostic.category, "unsafe_claim");
});

test("rejects objective diary claims and unsupported causal/co-occurrence wording", () => {
  for (const [phrase, category] of [
    ["Kratki dnevnički zapisi objektivno zabeleže razlike.", "objective_measurement"],
    ["Teško zaspiš zbog toga što ti misli ne staju.", "unsupported_causality"],
    ["Aktivne misli i teško uspavljivanje javljaju se iste noći.", "unsupported_cooccurrence"],
  ]) {
    const candidate = draftFromBrief();
    candidate.intro = phrase;
    const result = validateSleepPremiumMaster(candidate, brief);
    assert.equal(result.valid, false, phrase);
    assert.equal(result.diagnostic.category, category);
  }

  const uncertain = draftFromBrief();
  uncertain.intro = "Oba iskustva su u odgovorima, ali ne znamo da li se javljaju zajedno niti da li jedno objašnjava drugo.";
  assert.equal(validateSleepPremiumMaster(uncertain, brief).valid, true);
});

test("scientific phrasing requires an allowed reference attached to that insight", () => {
  const candidate = draftFromBrief();
  candidate.insights[0].evidence_ids = [];
  candidate.provenance.evidence_ids = unique(candidate.insights.flatMap(({ evidence_ids }) => evidence_ids));
  candidate.insights[0].text = "Naučno istraživanje potvrđuje ovaj obrazac.";
  const result = validateSleepPremiumMaster(candidate, brief);
  assert.equal(result.valid, false);
  assert.equal(result.diagnostic.field, "insights[0].text");
  assert.equal(result.diagnostic.category, "missing_evidence_reference");
});

test("internal analytical/editorial vocabulary is rejected from generated prose", () => {
  const master = draftFromBrief();
  for (const phrase of ["Urednički pregled.", "Analitički okvir.", "Ovo je kandidat.", "Anchor insight.",
    "Noncausal framing.", "Validator.", "Deterministički izbor.", "Model.", "Ovaj izveštaj.",
    "Internal review.", "Hipoteza."]) {
    const result = assertRejectsCopy(master, phrase);
    assert.equal(result.reason, "Sensitive or internal metadata in generated copy.");
  }
});

test("privacy-safe diagnostics identify categories without retaining matched copy", () => {
  for (const [phrase, category] of [
    ["FACT_Q3", "machine_id"],
    ["api_key=synthetic-marker", "sensitive_string"],
    ["Ovo je classifier.", "internal_vocabulary"],
    ["Skriven znak: \u200b", "hidden_character"],
    ["Begin the allocated plan; no additional action.", "english_placeholder"],
  ]) {
    const candidate = draftFromBrief();
    candidate.intro = phrase;
    const result = validateSleepPremiumMaster(candidate, brief);
    assert.equal(result.valid, false, phrase);
    assert.equal(result.diagnostic.category, category);
    assert.deepEqual(Object.keys(result.diagnostic).sort(), ["category", "field"]);
    assert.ok(!JSON.stringify(result.diagnostic).includes(phrase));
  }
});

test("evidence provenance must be the exact distinct union: extra and missing claims reject", () => {
  const baseline = draftFromBrief();
  assert.equal(validateSleepPremiumMaster(baseline, brief).valid, true);
  const unused = brief.approved_science.map(({ claim_id }) => claim_id)
    .find((claimId) => !baseline.provenance.evidence_ids.includes(claimId));
  assert.ok(unused, "fixture F must contain an approved but unused claim for the extra-ID regression");
  const noRootCopy = structuredClone(baseline);
  delete noRootCopy.provenance;
  assert.equal(validateSleepPremiumMaster(noRootCopy, brief).valid, true,
    "writer schema should not require a duplicated model-authored root union");

  const staleRoot = structuredClone(baseline);
  staleRoot.provenance.evidence_ids.push(unused);
  const staleResult = validateSleepPremiumMaster(staleRoot, brief);
  assert.equal(staleResult.valid, false);
  assert.equal(staleResult.diagnostic.field, "provenance.evidence_ids");
});

test("writer derives root provenance without inventing uncited claims", async (t) => {
  const previous = { branch: process.env.RENDER_GIT_BRANCH, enabled: process.env.ENABLE_PREMIUM_AI_PREVIEW };
  process.env.RENDER_GIT_BRANCH = "premium-ai-staging";
  process.env.ENABLE_PREMIUM_AI_PREVIEW = "true";
  t.after(() => {
    if (previous.branch === undefined) delete process.env.RENDER_GIT_BRANCH;
    else process.env.RENDER_GIT_BRANCH = previous.branch;
    if (previous.enabled === undefined) delete process.env.ENABLE_PREMIUM_AI_PREVIEW;
    else process.env.ENABLE_PREMIUM_AI_PREVIEW = previous.enabled;
  });

  const candidate = draftFromBrief();
  const cited = unique(candidate.insights.flatMap(({ evidence_ids }) => evidence_ids));
  const uncited = brief.approved_science.map(({ claim_id }) => claim_id).find((claimId) => !cited.includes(claimId));
  assert.ok(uncited);
  delete candidate.provenance;
  const calls = [];
  const result = await generateSleepPremiumMaster({ input, apiKeyAvailable: true, internalBenchmark: true,
    includePreview: false, includeRejectedDraft: true, logUsage: () => {},
    openaiClient: { responses: { create: async (request, options) => {
      calls.push(options);
      assert.deepEqual(request.reasoning, { effort: "low" });
      assert.equal(request.text.verbosity, "low");
      assert.equal(request.text.format.name, "mindscore_sleep_premium_master_v1");
      assert.deepEqual(decodeWriterTransport(request.input[1].content), projectSleepPremiumWriterBrief(brief));
      return { status: "completed", output_text: JSON.stringify(candidate) };
    } } },
  });
  assert.equal(calls.length, 1);
  assert.equal(result.source, "ai");
  assert.deepEqual(result.master.provenance.evidence_ids, cited);
  assert.ok(!result.master.provenance.evidence_ids.includes(uncited));
});

test("authority exception does not loosen medical, causal, or sleep-reduction safety", () => {
  const master = draftFromBrief();
  for (const phrase of ["Imaš apneju.", "Ova navika uzrokuje umor.", "Spavaj manje."]) {
    assert.equal(assertRejectsCopy(master, phrase).valid, false, phrase);
  }
});
