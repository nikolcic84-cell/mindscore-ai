export const mentalDimensions = [
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
];
export function calculateDimensions(userAnswers) {
  return mentalDimensions.map((dimension) => {
    const dimensionAnswers = dimension.questions
      .map((questionIndex) => userAnswers[questionIndex])
      .filter((answer) => typeof answer === "number");

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