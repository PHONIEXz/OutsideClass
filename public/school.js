import { samples } from "./samples.js";
import { safetyNotes } from "./safety.js";
import {
  SCHOOL_KEY,
  MAX_SCHOOL_BYTES,
  emptySchool,
  lessonSnapshot,
  readSchool,
  saveSchool,
  schoolReport,
  validateSchool,
} from "./school-store.js";
const $ = (id) => document.getElementById(id);
const esc = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const status = (message) => {
  $("school-status").textContent = message;
};
let data = emptySchool(),
  baseline = null,
  failed = false,
  editId = null;
let lessons = samples.map((a) => lessonSnapshot(a));
try {
  baseline = localStorage.getItem(SCHOOL_KEY);
  data = readSchool(localStorage);
} catch {
  failed = true;
  status(
    "This browser could not read the school workspace. Existing data has been kept. Reopen in a working browser or recover a school backup before making changes.",
  );
  $("school-controls")
    .querySelectorAll("input,select,textarea,button")
    .forEach((el) => (el.disabled = true));
}
try {
  const notes = JSON.parse(
    localStorage.getItem("outsideclass-notes-v1") || "[]",
  );
  if (Array.isArray(notes))
    for (const note of notes.slice(0, 100)) {
      if (note.activity?.kind === "explanation") continue;
      try {
        lessons.push(lessonSnapshot(note.activity));
      } catch {
        /* An invalid note cannot break the school workspace. */
      }
    }
} catch {
  status(
    "Notebook activities could not be read. Built-in samples are still available.",
  );
}
function commit(next) {
  if (failed)
    throw Error("The workspace could not be read. No changes were saved.");
  if (
    data.plans.length &&
    (next.school !== data.school || next.term !== data.term)
  )
    throw Error(
      "This pilot workspace holds one school and term. Existing plans cannot be relabelled. Keep a backup and use a separate browser profile for another term.",
    );
  if (localStorage.getItem(SCHOOL_KEY) !== baseline)
    throw Error(
      "This workspace changed in another tab. Reload before saving; no changes were overwritten.",
    );
  const saved = saveSchool(localStorage, next);
  data = saved;
  baseline = localStorage.getItem(SCHOOL_KEY);
  render();
}
function handle(action) {
  try {
    action();
  } catch (error) {
    status(
      error.message ||
        "The browser could not save. Existing records have been kept.",
    );
  }
}
function lessonHtml(lesson) {
  return `<h3>${esc(lesson.title)}</h3><p>${lesson.minutes} minutes · ${esc(lesson.goal)}</p><p><strong>Materials:</strong> ${lesson.materials.map(esc).join(", ")}</p><ol>${lesson.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol><ul>${safetyNotes(
    lesson,
  )
    .map((s) => `<li>${esc(s)}</li>`)
    .join("")}</ul>${lesson.safety ? `<p>${esc(lesson.safety)}</p>` : ""}`;
}
function preview() {
  const lesson = lessons[Number($("plan-lesson").value)];
  $("lesson-preview").innerHTML = lesson
    ? lessonHtml(lesson)
    : "Choose an activity.";
}
function reportHtml() {
  const rows = schoolReport(data);
  if (!rows.length)
    return "<p>Add your first class to begin. No demonstration statistics are included.</p>";
  return `<div class="school-table"><table><caption>${esc(data.school || "School workspace")} · ${esc(data.term || "Term not set")}</caption><thead><tr><th scope="col">Class</th><th scope="col">Planned</th><th scope="col">Ready</th><th scope="col">Completed</th><th scope="col">Participant-sessions</th><th scope="col">Evidence-sessions</th></tr></thead><tbody>${rows.map((r) => `<tr><th scope="row">${esc(r.name)}</th><td>${r.planned}</td><td>${r.ready}</td><td>${r.completed}</td><td>${r.participantSessions}</td><td>${r.evidenceSessions}</td></tr>`).join("")}</tbody></table></div>`;
}
function render() {
  $("school-name").value = data.school;
  $("school-term").value = data.term;
  $("class-list").innerHTML = data.classes
    .map((c) => `<li>${esc(c.name)} · ${c.size} learners</li>`)
    .join("");
  const selected = $("plan-class").value;
  $("plan-class").innerHTML =
    `<option value="">Choose a class</option>${data.classes.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("")}`;
  if (data.classes.some((c) => c.id === selected))
    $("plan-class").value = selected;
  $("school-report").innerHTML = reportHtml();
  $("session-board").innerHTML = data.plans.length
    ? data.plans
        .map((p) => {
          const c = data.classes.find((c) => c.id === p.classId);
          return `<article class="school-session" data-plan="${esc(p.id)}"><span class="tag">${esc(p.status.toUpperCase())} · ${esc(c.name)} · ${esc(p.date)}</span><h3>${esc(p.lesson.title)}</h3><p>${esc(p.objective)}</p>${p.reference ? `<p>Teacher-entered curriculum reference: ${esc(p.reference)}</p>` : '<p class="hint">No curriculum reference supplied.</p>'}<details><summary>Review activity and arrangements</summary>${lessonHtml(p.lesson)}<p><strong>Class arrangements:</strong> ${esc(p.safetyPlan || "Not yet supplied")}</p></details><div class="actions">${p.status !== "completed" ? `<button class="secondary" data-edit="${esc(p.id)}">Edit plan</button>` : ""}${p.status !== "draft" ? `<button class="secondary" data-pack="${esc(p.id)}">Print group pack</button>` : ""}</div>${p.status !== "draft" ? `<details><summary>${p.result ? "Review session record" : "Record what happened"}</summary><form data-result="${esc(p.id)}"><div class="school-grid"><div><label for="participants-${esc(p.id)}">Learners who participated</label><input id="participants-${esc(p.id)}" name="participated" type="number" min="0" max="${c.size}" required value="${p.result?.participated ?? ""}"></div><div><label for="evidence-${esc(p.id)}">Learners with evidence you reviewed</label><input id="evidence-${esc(p.id)}" name="evidence" type="number" min="0" max="${c.size}" required value="${p.result?.evidence ?? ""}"></div></div><label for="summary-${esc(p.id)}">What happened, what did the evidence show, and what comes next?</label><textarea id="summary-${esc(p.id)}" name="summary" maxlength="2000" required>${esc(p.result?.summary || "")}</textarea><p class="hint">Use anonymous group observations. Record actual results, including cancelled sessions or no clear finding. These are teacher records, not AI grades.</p><button class="primary" type="submit">Save session record</button></form></details>` : ""}${p.result ? `<p><strong>Recorded:</strong> ${p.result.participated} participants · ${p.result.evidence} with reviewed evidence</p><p>${esc(p.result.summary)}</p>` : ""}</article>`;
        })
        .join("")
    : "<p>No sessions yet. Choose a class and plan your first investigation above.</p>";
}
$("plan-lesson").innerHTML = lessons
  .map(
    (a, i) =>
      `<option value="${i}">${i < samples.length ? "Sample" : "Notebook"}: ${esc(a.title)}</option>`,
  )
  .join("");
$("plan-lesson").onchange = preview;
$("plan-date").value = new Date().toLocaleDateString("en-CA");
$("school-settings").onsubmit = (event) => {
  event.preventDefault();
  handle(() => {
    commit({
      ...data,
      school: $("school-name").value,
      term: $("school-term").value,
    });
    status("Workspace details saved on this browser.");
  });
};
$("class-form").onsubmit = (event) => {
  event.preventDefault();
  handle(() => {
    const name = $("class-name").value.trim();
    if (data.classes.some((c) => c.name.toLowerCase() === name.toLowerCase()))
      throw Error("That class label already exists.");
    commit({
      ...data,
      classes: [
        ...data.classes,
        { id: crypto.randomUUID(), name, size: Number($("class-size").value) },
      ],
    });
    $("class-form").reset();
    status("Class added. You can now plan an investigation for it.");
  });
};
$("plan-form").onsubmit = (event) => {
  event.preventDefault();
  handle(() => {
    if (!data.school || !data.term)
      throw Error("Save your school and term details first.");
    const plan = {
      id: editId || crypto.randomUUID(),
      classId: $("plan-class").value,
      date: $("plan-date").value,
      objective: $("plan-objective").value,
      reference: $("plan-reference").value,
      safetyPlan: $("plan-safety").value,
      reviewed: $("plan-reviewed").checked,
      status: event.submitter?.value === "ready" ? "ready" : "draft",
      lesson: lessons[Number($("plan-lesson").value)],
      result: null,
    };
    commit({
      ...data,
      plans: editId
        ? data.plans.map((p) => (p.id === editId ? plan : p))
        : [plan, ...data.plans],
    });
    editId = null;
    $("cancel-edit").hidden = true;
    $("plan-form").reset();
    preview();
    status(
      plan.status === "ready"
        ? "Plan marked ready. Print a group pack before the session."
        : "Draft saved. Edit and review it before marking it ready.",
    );
  });
};
$("session-board").onclick = (event) => {
  const edit = event.target.closest("[data-edit]"),
    pack = event.target.closest("[data-pack]");
  if (edit)
    handle(() => {
      const p = data.plans.find((p) => p.id === edit.dataset.edit);
      editId = p.id;
      $("cancel-edit").hidden = false;
      lessons.push(p.lesson);
      const option = document.createElement("option");
      option.value = String(lessons.length - 1);
      option.textContent = `Saved plan: ${p.lesson.title}`;
      $("plan-lesson").append(option);
      $("plan-class").value = p.classId;
      $("plan-date").value = p.date;
      $("plan-lesson").value = option.value;
      $("plan-objective").value = p.objective;
      $("plan-reference").value = p.reference;
      $("plan-safety").value = p.safetyPlan;
      // Any edit requires a fresh review, including a previously ready plan.
      $("plan-reviewed").checked = false;
      preview();
      $("plan-objective").focus();
      status(
        "Editing the existing plan. Review any changes before marking it ready again.",
      );
    });
  if (pack)
    handle(() => {
      const p = data.plans.find((p) => p.id === pack.dataset.pack),
        c = data.classes.find((c) => c.id === p.classId);
      if (p.status === "draft")
        throw Error("Review and mark the plan ready before printing.");
      $("school-print").innerHTML =
        `<h1>${esc(p.lesson.title)}</h1><p>${esc(data.school)} · ${esc(data.term)} · ${esc(c.name)} · ${esc(p.date)}</p><p><strong>Learning objective:</strong> ${esc(p.objective)}</p>${p.reference ? `<p>Teacher-entered reference: ${esc(p.reference)}</p>` : ""}${lessonHtml(p.lesson)}<p><strong>Supervision and access:</strong> ${esc(p.safetyPlan)}</p><p>Group label: ____________________ · Observation time: ____________________</p><h2>What did you observe or measure?</h2><div class="writing-space"></div><h2>What might explain it? What else could explain it?</h2><div class="writing-space"></div><h2>What would you investigate next?</h2><div class="writing-space"></div>`;
      $("school-print").hidden = false;
      window.print();
    });
};
$("cancel-edit").onclick = () => {
  editId = null;
  $("plan-form").reset();
  $("cancel-edit").hidden = true;
  preview();
  status("Editing cancelled. The saved plan is unchanged.");
};
$("session-board").onsubmit = (event) => {
  const form = event.target.closest("form[data-result]");
  if (!form) return;
  event.preventDefault();
  handle(() => {
    const p = data.plans.find((p) => p.id === form.dataset.result),
      fields = new FormData(form);
    const result = {
      participated: Number(fields.get("participated")),
      evidence: Number(fields.get("evidence")),
      summary: fields.get("summary"),
    };
    commit({
      ...data,
      plans: data.plans.map((v) =>
        v.id === p.id ? { ...p, status: "completed", result } : v,
      ),
    });
    status(
      "Session record saved. The term overview now includes these teacher-entered counts.",
    );
  });
};
$("print-report").onclick = () => {
  $("school-print").innerHTML =
    `<h1>Practical learning · term report</h1>${reportHtml()}<p>Teacher-entered records. Counts are session totals, not unique learners or proof of mastery.</p>${data.plans
      .filter((p) => p.status === "completed")
      .map(
        (p) =>
          `<h2>${esc(p.lesson.title)} · ${esc(p.date)}</h2><p>${esc(data.classes.find((c) => c.id === p.classId).name)} · ${esc(p.objective)}</p><p>${esc(p.result.summary)}</p>`,
      )
      .join("")}`;
  $("school-print").hidden = false;
  window.print();
};
$("school-backup").onclick = () =>
  handle(() => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(validateSchool(data), null, 2)], {
        type: "application/json",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "outsideclass-school-backup.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status(
      "School backup downloaded. It contains your school plans and teacher observations, not notebook photos.",
    );
  });
$("school-import").onchange = async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (file.size > MAX_SCHOOL_BYTES)
      throw Error("Choose a school backup smaller than 2 MB.");
    if (data.classes.length || data.plans.length || data.school || data.term)
      throw Error(
        "Restore needs an empty school workspace. Current records have been kept.",
      );
    const imported = validateSchool(JSON.parse(await file.text()));
    commit(imported);
    status(
      "School backup restored. Classes, plans and session records are available on this browser.",
    );
  } catch (error) {
    status(
      error.message ||
        "Could not restore this file. Existing data has been kept.",
    );
  }
  event.target.value = "";
};
render();
preview();
if ("serviceWorker" in navigator)
  navigator.serviceWorker
    .register("/sw.js")
    .catch(() =>
      status(
        "Offline installation could not complete. Reconnect and revisit before relying on offline access.",
      ),
    );
