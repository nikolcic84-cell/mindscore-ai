import React from "react";
import { SLEEP_ANSWER_OPTIONS } from "../psychology/sleepAssessmentContent.js";
import sleepContentLibrary from "../psychology/sleep_content_library_44.json";
import { selectSleepContentModules } from "../psychology/sleepContentModuleSelector.js";

export function parsePremiumModuleText(text) {
  const lines = text.split("\n");
  const customerLines = lines.filter((line, index) =>
    !(index < 2 && (/^OBLAST:/u.test(line) || /^OKIDAČ:/u.test(line))));
  const tryIndex = customerLines.findIndex((line) => /^PROBAJ:\s*$/u.test(line));
  const mainText = customerLines.slice(0, tryIndex < 0 ? undefined : tryIndex).join("\n").trim();
  const sections = new Map();
  let activeSection = "";

  for (const line of customerLines.slice(tryIndex < 0 ? customerLines.length : tryIndex)) {
    const marker = /^(PROBAJ|ALTERNATIVA|PRATI|OGRANIČENJE):(?:\s*(.*))?$/u.exec(line);
    if (marker) {
      activeSection = marker[1];
      sections.set(activeSection, marker[2] ? [marker[2]] : []);
      continue;
    }
    if (activeSection) sections.get(activeSection).push(line);
  }

  const steps = (sections.get("PROBAJ") ?? [])
    .map((line) => /^\s*\d+\.\s+(.+?)\s*$/u.exec(line)?.[1])
    .filter(Boolean);
  const textFor = (name) => (sections.get(name) ?? []).join("\n").trim();
  return {
    mainText,
    steps,
    alternative: textFor("ALTERNATIVA"),
    track: textFor("PRATI"),
  };
}

function answerOptionsFromAnalysis(acceptedAnalysis) {
  if (!Array.isArray(acceptedAnalysis?.facts) || acceptedAnalysis.facts.length !== 12) return null;

  const facts = new Map(acceptedAnalysis.facts.map((fact) => [fact.questionId, fact.answer]));
  const options = SLEEP_ANSWER_OPTIONS.map((questionOptions, index) =>
    questionOptions.findIndex(({ text }) => text === facts.get(`Q${index + 1}`)) + 1);
  return options.every((option) => option > 0) ? options : null;
}

export default function PremiumResult({ answers, acceptedAnalysis, onHome }) {
  const answerOptions = Array.isArray(answers) && answers.length === 12
    ? answers
    : answerOptionsFromAnalysis(acceptedAnalysis);
  if (!answerOptions) return null;

  const { modules, summary } = selectSleepContentModules(answerOptions, sleepContentLibrary);

  return (
    <main className="premium-module-result">
      <header className="premium-module-header">
        <div>
          <span className="premium-module-kicker">LIČNI VODIČ</span>
          <h1>TVOJA PRIČA O SNU</h1>
          <p>{summary}</p>
        </div>
        {onHome && <button type="button" onClick={onHome}>Početna</button>}
      </header>
      <ol className="premium-module-list">
        {modules.map((module, index) => (
          <li className="premium-module-item" key={module.id}>
            <article>
              <header className="premium-module-chapter-heading">
                <span className="premium-module-number">{String(index + 1).padStart(2, "0")}</span>
                <h2>{module.title}</h2>
              </header>
              {(() => {
                const copy = parsePremiumModuleText(module.text);
                return (
                  <>
                    {copy.mainText && <p>{copy.mainText}</p>}
                    {copy.steps.length > 0 && (
                      <section className="premium-module-section">
                        <h3>PROBAJ</h3>
                        <ol>{copy.steps.map((step, index) => <li key={`${module.id}-step-${index}`}>{step}</li>)}</ol>
                      </section>
                    )}
                    {copy.alternative && (
                      <section className="premium-module-section premium-module-alternative">
                        <h3>Ako ti ovo ne odgovara</h3>
                        <p>{copy.alternative}</p>
                      </section>
                    )}
                    {copy.track && (
                      <section className="premium-module-section premium-module-checkin">
                        <h3>Obrati pažnju</h3>
                        <p>{copy.track}</p>
                      </section>
                    )}
                  </>
                );
              })()}
            </article>
          </li>
        ))}
      </ol>
      <p className="premium-module-health-notice">
        Ovaj rezultat je informativnog karaktera i ne predstavlja medicinsku dijagnozu. Ako su problemi sa spavanjem izraženi, dugotrajni ili utiču na bezbednost i svakodnevno funkcionisanje, razgovaraj sa lekarom.
      </p>
    </main>
  );
}
