import { useEffect, useMemo, useState } from "react";

function getStatus(score) {
  if (score >= 80) return "Strong";
  if (score >= 60) return "Moderate";
  return "Priority Area";
}

function getStatusClass(score) {
  if (score >= 80) return "strong";
  if (score >= 60) return "moderate";
  return "priority";
}

function getProgressColor(score) {
  if (score >= 80) return "#2e9d5f";
  if (score >= 60) return "#f2a800";
  return "#d94b4b";
}

export default function AnalyticsDashboard({ data }) {
  const safeData = useMemo(
    () =>
      (data || []).map((dimension) => ({
        ...dimension,
        score: Math.max(0, Math.min(100, Number(dimension.score) || 0)),
      })),
    [data]
  );

  const [animatedScores, setAnimatedScores] = useState([]);

  const dataSignature = useMemo(
    () => safeData.map((dimension) => `${dimension.name}:${dimension.score}`).join("|"),
    [safeData]
  );

  useEffect(() => {
    setAnimatedScores(safeData.map(() => 0));

    const timers = safeData.map((dimension, index) =>
      window.setTimeout(() => {
        setAnimatedScores((previousScores) => {
          const nextScores = [...previousScores];
          nextScores[index] = dimension.score;
          return nextScores;
        });
      }, 80 + index * 80)
    );

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [dataSignature, safeData]);

  if (!data || data.length === 0) return null;

  const strongestDimension = [...safeData].sort((a, b) => b.score - a.score)[0];
  const growthDimension = [...safeData].sort((a, b) => a.score - b.score)[0];

  return (
    <section className="analytics-dashboard">
      <div className="analytics-heading">
        <p className="analytics-label">Personalized analysis</p>
        <h2>Your profile breakdown</h2>
        <p>A clear snapshot of your strongest patterns and highest-growth areas.</p>
      </div>

      <div className="analytics-summary">
        <h3>Your psychological profile</h3>
        <p>A concise overview of your current strengths and areas that may need more attention.</p>
        <div className="analytics-summary-grid">
          <div>
            <strong>Strongest dimension:</strong> {strongestDimension?.name || "N/A"}
          </div>
          <div>
            <strong>Highest growth potential:</strong> {growthDimension?.name || "N/A"}
          </div>
        </div>
      </div>

      <div className="dimension-cards">
        {safeData.map((dimension, index) => {
          const safeScore = Math.max(0, Math.min(100, Number(dimension.score) || 0));
          const status = getStatus(safeScore);
          const statusClass = getStatusClass(safeScore);
          const animatedScore = animatedScores[index] ?? 0;

          return (
            <article className="dimension-card" key={dimension.name}>
              <div className="dimension-card-head">
                <h3>{dimension.name}</h3>
                <span className={`status-badge ${statusClass}`}>
                  {status}
                </span>
              </div>

              <div className="dimension-score-row">
                <strong>{safeScore}/100</strong>
              </div>

              <div className="dimension-progress-wrap">
                <div
                  className="dimension-progress-bar"
                  style={{
                    width: `${animatedScore}%`,
                    background: getProgressColor(safeScore),
                  }}
                />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
