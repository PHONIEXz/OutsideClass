export function validateChecks(checks) {
  if (!Array.isArray(checks) || checks.length !== 2)
    throw Error("Two understanding checks are required.");
  return checks.map((q) => {
    if (
      !q ||
      typeof q.question !== "string" ||
      !q.question.trim() ||
      q.question.length > 300 ||
      !Array.isArray(q.options) ||
      q.options.length !== 3 ||
      !q.options.every(
        (o) => typeof o === "string" && o.trim() && o.length <= 150,
      ) ||
      new Set(q.options).size !== 3 ||
      !Number.isInteger(q.correctIndex) ||
      q.correctIndex < 0 ||
      q.correctIndex > 2 ||
      typeof q.feedback !== "string" ||
      !q.feedback.trim() ||
      q.feedback.length > 500
    )
      throw Error("An understanding check was incomplete.");
    return {
      question: q.question,
      options: q.options.slice(),
      correctIndex: q.correctIndex,
      feedback: q.feedback,
    };
  });
}
export function scoreChecks(checks, answers) {
  validateChecks(checks);
  if (
    !Array.isArray(answers) ||
    answers.length !== 2 ||
    !answers.every((n) => Number.isInteger(n) && n >= 0 && n < 3)
  )
    throw Error("Answer both questions first.");
  return {
    answers: answers.slice(),
    correct: checks.filter((q, i) => q.correctIndex === answers[i]).length,
    total: 2,
  };
}
export function learningProgress(notes) {
  return {
    saved: notes.length,
    reflections: notes.filter((n) => n.reflection.trim()).length,
    returnVisits: notes.filter((n) => n.previousId).length,
    checked: notes.filter((n) => n.checkResult).length,
    correct: notes.reduce((sum, n) => sum + (n.checkResult?.correct || 0), 0),
    questions: notes.reduce((sum, n) => sum + (n.checkResult?.total || 0), 0),
  };
}
