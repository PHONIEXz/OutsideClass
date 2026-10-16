import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emptySchool,
  lessonSnapshot,
  validateSchool,
  schoolReport,
  readSchool,
  saveSchool,
  SCHOOL_KEY,
} from "../public/school-store.js";
import { samples } from "../public/samples.js";
const fixture = () => ({
  ...emptySchool(),
  school: "Test school",
  term: "Term 1",
  classes: [{ id: "a", name: "Basic 4", size: 30 }],
  plans: [
    {
      id: "p",
      classId: "a",
      date: "2026-10-16",
      objective: "Compare shadows at two times",
      reference: "Teacher checked source, p. 12",
      safetyPlan: "Adult leads, shaded courtyard, seated option",
      reviewed: true,
      status: "ready",
      lesson: lessonSnapshot(samples[0]),
      result: null,
    },
  ],
});
test("school snapshot excludes notebook reflections, images, identities and prior context", () => {
  const clean = lessonSnapshot({
    ...samples[0],
    reflection: "Private note",
    images: ["secret"],
    workLabel: "Learner name",
    previous: { noticed: "Private evidence" },
    spot: "Home address",
  });
  const raw = JSON.stringify(clean);
  for (const privateText of [
    "Private note",
    "secret",
    "Learner name",
    "Private evidence",
    "Home address",
  ])
    assert.ok(!raw.includes(privateText));
  assert.equal(clean.audience, "Class");
});
test("ready and completed plans require explicit review and supervision arrangements", () => {
  for (const status of ["ready", "completed"]) {
    const data = fixture();
    data.plans[0].status = status;
    data.plans[0].reviewed = false;
    assert.throws(() => validateSchool(data), /Review/);
    data.plans[0].reviewed = true;
    data.plans[0].safetyPlan = "";
    assert.throws(() => validateSchool(data), /Review/);
  }
  const draft = fixture();
  draft.plans[0].status = "draft";
  draft.plans[0].reviewed = false;
  draft.plans[0].safetyPlan = "";
  assert.equal(validateSchool(draft).plans[0].status, "draft");
});
test("reports count recorded session participation and evidence without inventing mastery", () => {
  const data = fixture();
  data.plans[0].status = "completed";
  data.plans[0].result = {
    participated: 24,
    evidence: 18,
    summary: "Six groups compared observations.",
  };
  data.plans.push({
    ...data.plans[0],
    id: "second",
    result: { participated: 20, evidence: 12, summary: "Second visit." },
  });
  assert.deepEqual(schoolReport(data), [
    {
      name: "Basic 4",
      planned: 2,
      ready: 0,
      completed: 2,
      participantSessions: 44,
      evidenceSessions: 30,
    },
  ]);
  assert.equal(schoolReport(emptySchool()).length, 0);
});
test("completion rejects evidence beyond participation or class size", () => {
  const data = fixture();
  data.plans[0].status = "completed";
  for (const result of [
    { participated: 31, evidence: 1 },
    { participated: 10, evidence: 11 },
    { participated: -1, evidence: 0 },
    { participated: 1.5, evidence: 1 },
  ]) {
    data.plans[0].result = { ...result, summary: "Actual group observations" };
    assert.throws(() => validateSchool(data));
  }
});
test("school backup validates dates, references, bounds and duplicate IDs", () => {
  for (const mutate of [
    (d) => (d.plans[0].date = "2026-02-30"),
    (d) => (d.plans[0].classId = "missing"),
    (d) => d.classes.push(d.classes[0]),
    (d) => d.plans.push(d.plans[0]),
    (d) => (d.plans[0].lesson.steps = []),
    (d) => (d.plans[0].objective = "x".repeat(601)),
    (d) =>
      (d.classes = Array.from({ length: 51 }, (_, i) => ({
        id: String(i),
        name: "Class",
        size: 1,
      }))),
  ]) {
    const data = fixture();
    mutate(data);
    assert.throws(() => validateSchool(data));
  }
  assert.throws(() => validateSchool({ ...fixture(), version: 2 }));
});
test("school storage round-trips records and does not mutate data on invalid writes or storage failure", () => {
  let raw = null;
  const storage = {
    getItem: (key) => (key === SCHOOL_KEY ? raw : null),
    setItem: (_, value) => (raw = value),
  };
  assert.deepEqual(readSchool(storage), emptySchool());
  const clean = saveSchool(storage, fixture());
  assert.deepEqual(readSchool(storage), clean);
  const before = raw,
    invalid = fixture();
  invalid.plans[0].classId = "missing";
  assert.throws(() => saveSchool(storage, invalid));
  assert.equal(raw, before);
  assert.throws(
    () =>
      saveSchool(
        {
          ...storage,
          setItem() {
            throw Error("quota");
          },
        },
        fixture(),
      ),
    /quota/,
  );
  assert.equal(raw, before);
  raw = "invalid-json";
  assert.throws(() => readSchool(storage));
  assert.equal(raw, "invalid-json");
});
