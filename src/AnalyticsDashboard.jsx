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
    <section
      className="analytics-dashboard"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.9rem",
        width: "100%",
        maxWidth: "100%",
        padding: "0.25rem 0",
      }}
    >
      <div
        className="analytics-heading"
        style={{
          background: "linear-gradient(135deg, #132a54 0%, #2b5ee4 100%)",
          borderRadius: "18px",
          padding: "1rem",
          color: "#ffffff",
          boxShadow: "0 10px 28px rgba(19, 42, 84, 0.18)",
        }}
      >
        <p
          className="analytics-label"
          style={{ margin: 0, fontSize: "0.8rem", letterSpacing: "0.16em", opacity: 0.9 }}
        >
          PERSONALIZED ANALYSIS
        </p>
        <h2
          style={{
            color: "#ffffff",
            margin: "0.35rem 0 0.25rem",
            fontSize: "clamp(1.15rem, 3.2vw, 1.5rem)",
            lineHeight: 1.2,
          }}
        >
          Your Psychological Profile
        </h2>
        <p style={{ margin: 0, fontSize: "0.95rem", lineHeight: 1.45, color: "#e8eeff" }}>
          A simple overview of your five assessment dimensions.
        </p>
      </div>

      <div
        style={{
          background: "#ffffff",
          borderRadius: "16px",
          padding: "0.95rem",
          boxShadow: "0 8px 22px rgba(16, 32, 70, 0.08)",
          border: "1px solid #e9eefc",
        }}
      >
        <h3 style={{ margin: "0 0 0.4rem", fontSize: "1rem", color: "#142a52" }}>
          Your Psychological Profile
        </h3>
        <p style={{ margin: "0 0 0.7rem", fontSize: "0.92rem", lineHeight: 1.45, color: "#56627a" }}>
          A clear snapshot of your current strengths and the areas that may need more attention.
        </p>
        <div style={{ display: "grid", gap: "0.45rem", fontSize: "0.93rem", color: "#22314f" }}>
          <div style={{ wordBreak: "break-word" }}>
            <strong>Strongest dimension:</strong> {strongestDimension?.name || "—"}
          </div>
          <div style={{ wordBreak: "break-word" }}>
            <strong>Highest growth potential:</strong> {growthDimension?.name || "—"}
          </div>
        </div>
      </div>

      <div className="dimension-cards" style={{ display: "grid", gap: "0.75rem", width: "100%" }}>
        {safeData.map((dimension, index) => {
          const safeScore = Math.max(0, Math.min(100, Number(dimension.score) || 0));
          const status = getStatus(safeScore);
          const statusClass = getStatusClass(safeScore);
          const animatedScore = animatedScores[index] ?? 0;

          return (
            <article
              className="dimension-card"
              key={dimension.name}
              style={{
                background: "#ffffff",
                borderRadius: "16px",
                padding: "0.9rem",
                boxShadow: "0 8px 22px rgba(16, 32, 70, 0.08)",
                border: "1px solid #e9eefc",
                display: "flex",
                flexDirection: "column",
                gap: "0.6rem",
                minWidth: 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "0.6rem",
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    fontSize: "1rem",
                    lineHeight: 1.3,
                    color: "#142a52",
                    wordBreak: "break-word",
                    overflowWrap: "anywhere",
                    flex: 1,
                  }}
                >
                  {dimension.name}
                </h3>
                <span className={`status-badge ${statusClass}`}>
                  {status}
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "0.6rem",
                  flexWrap: "wrap",
                }}
              >
                <strong style={{ fontSize: "1.05rem", color: "#142a52" }}>{safeScore}/100</strong>
              </div>

              <div
                style={{
                  width: "100%",
                  height: "12px",
                  background: "#e9eefc",
                  borderRadius: "999px",
                  overflow: "hidden",
                  minHeight: "12px",
                }}
              >
                <div
                  style={{
                    width: `${animatedScore}%`,
                    height: "100%",
                    background: getProgressColor(safeScore),
                    borderRadius: "999px",
                    transition: "width 0.8s ease",
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
