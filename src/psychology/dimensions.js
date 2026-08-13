const dimensionSets = {
  mental: [
  {
    name: "Resilience",
    questions: [0, 9]
  },
  {
    name: "Emotional Control",
    questions: [1, 4]
  },
  {
    name: "Self Discipline",
    questions: [2, 7]
  },
  {
    name: "Decision Making",
    questions: [3, 6]
  },
  {
    name: "Stress Tolerance",
    questions: [5, 8]
  }
  ],
  stress: [
    { name: "Pressure Regulation", questions: [0, 4] },
    { name: "Uncertainty Tolerance", questions: [1, 7] },
    { name: "Flexibility", questions: [2, 3] },
    { name: "Emotional Recovery", questions: [5, 8] },
    { name: "Stress Awareness", questions: [6, 9] },
  ],
  sleep: [
    { name: "Sleep Recovery", questions: [0, 11] },
    { name: "Sleep Continuity", questions: [1, 6] },
    { name: "Cognitive Wind-Down", questions: [2, 3] },
    { name: "Daytime Clarity", questions: [4, 7] },
    { name: "Sleep Consistency", questions: [5, 8, 9, 10] },
  ],
  leadership: [
    { name: "Direction", questions: [0, 10] },
    { name: "Accountability", questions: [1, 9] },
    { name: "Conflict Navigation", questions: [2, 6] },
    { name: "Decision Confidence", questions: [3, 7] },
    { name: "People Development", questions: [4, 5, 8] },
  ],
};

export const mentalDimensions = dimensionSets.mental;

export function calculateDimensions(userAnswers, assessmentType = "mental") {
  const dimensions = dimensionSets[assessmentType] || dimensionSets.mental;

  return dimensions.map((dimension) => {
    const dimensionAnswers = dimension.questions
      .map((questionIndex) => userAnswers[questionIndex])
      .filter((answer) => Number.isFinite(answer) && answer >= 1 && answer <= 5);

    if (dimensionAnswers.length === 0) {
      return {
        name: dimension.name,
        score: 0,
      };
    }

    const totalPoints = dimensionAnswers.reduce(
      (sum, answer) => sum + answer,
      0
    );

    const maximumPoints = dimensionAnswers.length * 5;

    return {
      name: dimension.name,
      score: Math.round((totalPoints / maximumPoints) * 100),
    };
  });
}