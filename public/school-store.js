// Local pilot data only. This module does not provide authentication or school isolation.
export const SCHOOL_KEY = "outsideclass-school-v1";
export const MAX_SCHOOL_BYTES = 2 * 1024 * 1024;
const text = (value, name, max = 300, optional = false) => {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (!optional && !value.trim())
  )
    throw Error(`${name} is missing or too long.`);
  return value.trim();
};
const integer = (value, name, min, max) => {
  if (!Number.isInteger(value) || value < min || value > max)
    throw Error(`${name} must be between ${min} and ${max}.`);
  return value;
};
const list = (value, name, max) => {
  if (!Array.isArray(value) || value.length > max)
    throw Error(`Too many or invalid ${name}.`);
  return value;
};
const date = (value) => {
  text(value, "Date", 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  )
    throw Error("Choose a valid session date.");
  return value;
};
export const emptySchool = () => ({
  format: "outsideclass-school",
  version: 1,
  school: "",
  term: "",
  classes: [],
  plans: [],
});
export function lessonSnapshot(activity) {
  return {
    title: text(activity?.title, "Activity title", 200),
    minutes: integer(activity.minutes ?? 10, "Activity duration", 1, 120),
    goal: text(activity.goal, "Activity goal", 1000),
    materials: list(activity.materials, "materials", 20).map((v) =>
      text(v, "Material", 300),
    ),
    steps: list(activity.steps, "steps", 10).map((v) => text(v, "Step", 1000)),
    safety: text(activity.safety || "", "Activity safety", 2000, true),
    place: text(activity.place || "", "Place", 100, true),
    mobility: text(activity.mobility || "", "Mobility", 100, true),
    weather: text(activity.weather || "", "Weather", 100, true),
    timeOfDay: text(activity.timeOfDay || "", "Time of day", 100, true),
    audience: "Class",
  };
}
export function validateSchool(data) {
  if (!data || data.format !== "outsideclass-school" || data.version !== 1)
    throw Error("Choose an OutsideClass school backup, version 1.");
  const school = text(data.school, "School", 120, true),
    term = text(data.term, "Term", 80, true);
  const classes = list(data.classes, "classes", 50).map((c) => ({
    id: text(c.id, "Class ID", 80),
    name: text(c.name, "Class name", 80),
    size: integer(c.size, "Class size", 1, 200),
  }));
  const classIds = new Set(classes.map((c) => c.id));
  if (classIds.size !== classes.length) throw Error("Duplicate class IDs.");
  const plans = list(data.plans, "session plans", 200).map((p) => {
    if (!classIds.has(p.classId))
      throw Error("A session refers to a missing class.");
    const status = p.status;
    if (!["draft", "ready", "completed"].includes(status))
      throw Error("Invalid session status.");
    const plan = {
      id: text(p.id, "Session ID", 80),
      classId: p.classId,
      date: date(p.date),
      objective: text(p.objective, "Learning objective", 600),
      reference: text(p.reference || "", "Curriculum reference", 300, true),
      safetyPlan: text(
        p.safetyPlan || "",
        "Supervision and access plan",
        1200,
        true,
      ),
      reviewed: p.reviewed === true,
      status,
      lesson: lessonSnapshot(p.lesson),
      result: null,
    };
    if (!plan.lesson.steps.length)
      throw Error("A session needs at least one activity step.");
    if (status !== "draft" && (!plan.reviewed || !plan.safetyPlan))
      throw Error(
        "Review the activity and add supervision/access arrangements before marking it ready.",
      );
    if (status === "completed") {
      const size = classes.find((c) => c.id === p.classId).size;
      plan.result = {
        participated: integer(p.result?.participated, "Participants", 0, size),
        evidence: integer(
          p.result?.evidence,
          "Learners with reviewed evidence",
          0,
          size,
        ),
        summary: text(p.result?.summary, "Teacher observation", 2000),
      };
      if (plan.result.evidence > plan.result.participated)
        throw Error("Reviewed evidence cannot exceed participants.");
    }
    return plan;
  });
  if (new Set(plans.map((p) => p.id)).size !== plans.length)
    throw Error("Duplicate session IDs.");
  return {
    format: "outsideclass-school",
    version: 1,
    school,
    term,
    classes,
    plans,
  };
}
export function readSchool(storage) {
  const raw = storage.getItem(SCHOOL_KEY);
  if (!raw) return emptySchool();
  if (raw.length > MAX_SCHOOL_BYTES)
    throw Error("School workspace exceeds the size limit.");
  return validateSchool(JSON.parse(raw));
}
export function saveSchool(storage, data) {
  const clean = validateSchool(data),
    raw = JSON.stringify(clean);
  if (raw.length > MAX_SCHOOL_BYTES)
    throw Error(
      "School workspace is full. Download a backup before starting another workspace.",
    );
  storage.setItem(SCHOOL_KEY, raw);
  return clean;
}
export function schoolReport(data) {
  const clean = validateSchool(data);
  return clean.classes.map((c) => {
    const plans = clean.plans.filter((p) => p.classId === c.id),
      completed = plans.filter((p) => p.status === "completed");
    return {
      name: c.name,
      planned: plans.length,
      ready: plans.filter((p) => p.status === "ready").length,
      completed: completed.length,
      participantSessions: completed.reduce(
        (n, p) => n + p.result.participated,
        0,
      ),
      evidenceSessions: completed.reduce((n, p) => n + p.result.evidence, 0),
    };
  });
}
