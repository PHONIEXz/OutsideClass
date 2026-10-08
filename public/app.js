import { scoreChecks, learningProgress } from "./learning.js";
import {
  encodePhoto,
  makeBackup,
  restoreBackup,
  MAX_BACKUP_BYTES,
} from "./notebook-tools.js";
import { diagramHtml } from "./diagrams.js";
import { samples } from "./samples.js";
import { safetyNotes } from "./safety.js";
import {
  MAX_PHOTOS,
  readPhotos,
  writePhotos,
  removePhotos,
  shrinkPhoto,
} from "./photos.js";
const $ = (id) => document.getElementById(id);
let checkResult = null;
let questionImages = [],
  questionImageUrls = [],
  questionImageBusy = false,
  notebookBusy = false;
let current = null;
let notes = [];
let revisitId = null;
let followUp = null;
const key = "outsideclass-notes-v1";
let photoDraft = [],
  photoUrls = [],
  photoGeneration = 0,
  photoBusy = false,
  photoLoad = Promise.resolve(),
  photoLoadFailed = false,
  saving = false;
function clearPhotoUrls() {
  for (const url of photoUrls) URL.revokeObjectURL(url);
  photoUrls = [];
}
function photoUrl(blob) {
  const url = URL.createObjectURL(blob);
  photoUrls.push(url);
  return url;
}
function showPhotos() {
  clearPhotoUrls();
  const preview = $("photo-preview"),
    print = $("photo-print");
  if (!preview || !print) return;
  preview.innerHTML = photoDraft
    .map(
      (blob, i) =>
        `<figure><img src="${photoUrl(blob)}" alt="Evidence photo ${i + 1}"><button type="button" data-remove-photo="${i}" aria-label="Remove evidence photo ${i + 1}">Remove</button></figure>`,
    )
    .join("");
  print.hidden = !photoDraft.length;
  print.innerHTML = photoDraft.length
    ? `<h2>Field evidence</h2><div class="photo-strip">${photoDraft.map((blob, i) => `<img src="${photoUrl(blob)}" alt="Evidence photo ${i + 1}">`).join("")}</div>`
    : "";
  preview.querySelectorAll("[data-remove-photo]").forEach(
    (button) =>
      (button.onclick = () => {
        photoDraft.splice(Number(button.dataset.removePhoto), 1);
        showPhotos();
      }),
  );
  $("photo-input").disabled = photoBusy || photoDraft.length >= MAX_PHOTOS;
}
async function loadCardPhotos(id) {
  const generation = ++photoGeneration;
  photoDraft = [];
  photoLoadFailed = false;
  showPhotos();
  if (!id || !notes.find((n) => n.id === id)?.photoCount) return;
  $("photo-input").disabled = true;
  try {
    const photos = await readPhotos(id);
    if (generation !== photoGeneration) return;
    photoDraft = photos.slice(0, MAX_PHOTOS);
    showPhotos();
  } catch (error) {
    if (generation === photoGeneration) {
      photoLoadFailed = true;
      $("photo-status").textContent =
        error.message +
        " Reopen this card to retry. Existing photos will be kept.";
    }
  } finally {
    if (generation === photoGeneration)
      $("photo-input").disabled =
        photoLoadFailed || photoDraft.length >= MAX_PHOTOS;
  }
}
async function addPhotos(event) {
  const selected = Array.from(event.target.files || []);
  event.target.value = "";
  if (selected.length > MAX_PHOTOS - photoDraft.length) {
    $("photo-status").textContent = "Add up to two photos per note.";
    return;
  }
  const generation = photoGeneration;
  photoBusy = true;
  $("photo-input").disabled = true;
  $("save-card").disabled = true;
  $("save-note").disabled = true;
  $("photo-status").textContent = "Preparing photos on this device…";
  try {
    const resized = await Promise.all(selected.map(shrinkPhoto));
    if (generation !== photoGeneration) return;
    photoDraft.push(...resized);
    showPhotos();
    $("photo-status").textContent =
      `${photoDraft.length} photo${photoDraft.length === 1 ? "" : "s"} ready. Save the note to keep them.`;
  } catch (error) {
    if (generation === photoGeneration)
      $("photo-status").textContent = error.message;
  } finally {
    photoBusy = false;
    if (generation === photoGeneration) {
      $("save-card").disabled = false;
      $("save-note").disabled = false;
      $("photo-input").disabled = photoDraft.length >= MAX_PHOTOS;
    }
  }
}
try {
  const value = JSON.parse(localStorage.getItem(key) || "[]");
  if (Array.isArray(value))
    notes = value
      .filter(
        (n) =>
          n &&
          typeof n.id === "string" &&
          typeof n.reflection === "string" &&
          n.activity &&
          typeof n.activity.title === "string" &&
          Array.isArray(n.activity.steps),
      )
      .slice(0, 100);
} catch {
  $("status").textContent =
    "Saved notes could not be read. New activities still work.";
}
const esc = (x) =>
  String(x).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
function groupHtml(a) {
  if (
    !a.audience ||
    a.audience === "Myself" ||
    !Array.isArray(a.discussion) ||
    !a.groupTips
  )
    return "";
  return `<section class="group"><h2>For the group leader</h2><p class="hint">${esc(a.audience === "Class" ? "Class" : "Family")} of ${esc(a.groupSize)} · ages ${esc(a.ageRange)}</p><p>${esc(a.groupTips)}</p><h3>Talk about it afterwards</h3><ul>${a.discussion.map((q) => `<li>${esc(q)}</li>`).join("")}</ul><p class="safety">Before you go: agree where the boundary is and a signal that means come back. Count everyone when you leave and when you return. Stay with the group.</p></section>`;
}
function groupInput() {
  const audience = $("audience").value;
  return audience === "Myself"
    ? { audience }
    : {
        audience,
        groupSize: Number($("groupSize").value),
        ageRange: $("ageRange").value,
      };
}
const routes = {
  home: "/",
  builder: "/learn",
  notebook: "/notebook",
  guides: "/guides",
  updates: "/updates",
  activity: "/activity",
};
function view(id) {
  for (const v of Object.keys(routes)) $(v).hidden = v !== id;
  document.querySelectorAll("[data-page]").forEach((link) => {
    const active = link.dataset.page === id;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  if (location.pathname !== routes[id]) history.pushState({}, "", routes[id]);
  document.title =
    {
      home: "Learn from the world",
      builder: "Find an activity",
      notebook: "Your field notebook",
      guides: "Learning guides",
      updates: "News and updates",
      activity: "Your field card",
    }[id] + " | OutsideClass";
  $(id).focus();
  window.scrollTo(0, 0);
}
function navigate(id) {
  if (id === "notebook") notebook();
  else if (id === "activity") {
    if (current) render(current.activity, current.id);
    else if (session?.activity) render(session.activity, session.id);
    else view("builder");
  } else view(id);
}

function save() {
  try {
    localStorage.setItem(key, JSON.stringify(notes));
    $("count").textContent = notes.length;
    return true;
  } catch {
    alert("Your browser could not save this note. Copy it before leaving.");
    return false;
  }
}
const reflectionFields = [
  [
    "noticed",
    "What did you notice?",
    "Describe what you saw, heard, or measured.",
  ],
  [
    "explanation",
    "What do you think it means?",
    "One possible explanation, even if you are unsure.",
  ],
  [
    "alternative",
    "What else could explain it?",
    "Think of another possible reason.",
  ],
  [
    "surprised",
    "What surprised you?",
    "Was anything different from what you expected?",
  ],
  [
    "question",
    "What question do you still have?",
    "What would you like to explore next?",
  ],
];
function readReflection() {
  return Object.fromEntries(
    reflectionFields.map(([id]) => [id, $("reflection-" + id).value.trim()]),
  );
}
function fillReflection(answers) {
  for (const [id] of reflectionFields)
    $("reflection-" + id).value =
      typeof answers?.[id] === "string" ? answers[id] : "";
}
function render(a, id = null) {
  checkResult = notes.find((n) => n.id === id)?.checkResult || null;
  const direct = a.kind === "explanation";
  current = { activity: structuredClone(a), id };
  view("activity");
  $("activity").innerHTML =
    `<article class="card"><span class="eyebrow">${direct ? "YOUR LEARNING ANSWER" : "YOUR FIELD CARD"}</span><h1>${esc(a.title)}</h1><span class="tag">${direct ? "EXPLANATION" : esc(a.minutes) + " MIN"} · ${esc(a.level)}</span><p>${esc(a.goal)}</p><details class="your-question"><summary>Your question</summary><p>${esc(a.topic || a.title)}</p></details>${direct ? `<section class="direct-answer"><h2>Here’s the explanation</h2><p>${esc(a.explanation)}</p><p class="hint">${esc(a.reason)}</p></section>` : ""}<p class="hint">${esc(a.source)} · ${esc(a.place)}${a.weather && a.weather !== "Any" ? " · " + esc(a.weather) : ""}${a.timeOfDay && a.timeOfDay !== "Any" ? " · " + esc(a.timeOfDay) : ""}</p>${a.spot ? `<p class="spot-label">Your spot: <strong>${esc(a.spot)}</strong>${a.previous ? " · Return visit" : ""}</p>` : ""}${a.previous ? `<div class="evidence-recall"><strong>Last time you noticed</strong><p>${esc(a.previous.noticed || "Your earlier reflection")}</p><small>Compare what you find today. Your earlier notes are observations, not confirmed facts.</small></div>` : ""}${diagramHtml(a)}<section class="attachments" aria-label="Your image attachments"><h2>Your own images</h2><label for="photo-input">Upload photos or sketches (optional, up to two)</label><input id="photo-input" type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple><p class="hint">Choose PNG, JPEG, WebP or GIF, up to 12 MB each. Images stay in this browser and are not sent to Gemma. Use Save card to keep them, with or without a reflection.</p><div id="photo-preview" class="photo-strip"></div><p id="photo-status" role="status"></p></section>${
      direct
        ? ""
        : `<h2>Bring along</h2><p>${a.materials.map(esc).join(", ") || "Just your curiosity."}</p><h2>${["By a window", "From a doorway"].includes(a.place) ? "Explore from your spot" : "Try this outside"}</h2><ol>${a.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol><section class="safety-check"><h2>Before you begin</h2><ul>${safetyNotes(
            a,
          )
            .map((note) => `<li>${esc(note)}</li>`)
            .join(
              "",
            )}</ul><p class="safety">For this activity: ${esc(a.safety)}</p></section>${groupHtml(a)}`
    } ${a.audience === "Class" ? '<p class="print-only">Name: ______________________ Date: ______________</p>' : ""}<div class="actions"><button class="secondary" id="save-card">Save card</button><button class="secondary" id="print">Print card</button></div><button class="primary" id="go" ${direct ? "hidden" : ""}>I’m ready. Phone away.</button><details ${direct ? "hidden" : ""}><summary>Understand the idea</summary><p>${esc(a.explanation)}</p></details>${checkHtml(a)}<div class="actions"><button class="secondary" id="download-lesson">Download activity pack</button><button class="secondary" id="download-work">Download this work</button></div><button class="secondary" id="ask-followup">Ask a follow-up question</button><div class="reflection"><h2>${direct ? "Your learning notes" : "When you come back"}</h2><p class="hint">A thought to start with: ${esc(a.reflection)}</p><p class="hint">${direct ? "Write what makes sense now and what you still want to understand. A few words are enough." : "Record evidence, then try two possible explanations. A few words are enough."}</p>${reflectionFields.map(([id, label, placeholder]) => `<label for="reflection-${id}">${direct && id === "noticed" ? "What do you understand now?" : label}</label><textarea id="reflection-${id}" maxlength="4000" placeholder="${placeholder}"></textarea>`).join("")}<button class="primary" id="save-note">Save reflection</button><p id="saved-status" role="status"></p></div><section id="photo-print" class="photo-print" hidden></section></article>`;
  const saved = notes.find((n) => n.id === id);
  fillReflection(
    saved?.reflectionAnswers || { noticed: saved?.reflection || "" },
  );
  photoLoad = loadCardPhotos(id);
  $("photo-input").onchange = addPhotos;
  bindChecks(a);
  $("download-lesson").onclick = () => downloadCard(true);
  $("download-work").onclick = () => downloadCard(false);
  $("ask-followup").onclick = () => {
    followUp = {
      question: String(a.topic || a.title).slice(0, 600),
      answer: a.explanation.slice(0, 1200),
    };
    revisitId = null;
    updateRevisit();
    updateFollowUp();
    $("topic").value = "";
    view("builder");
    $("topic").focus();
  };
  $("save-card").onclick = () => persist(false);
  $("save-note").onclick = () => persist(true);
  $("print").onclick = async () => {
    const generation = photoGeneration;
    await photoLoad;
    if (generation !== photoGeneration) return;
    if (photoBusy || photoLoadFailed) {
      $("photo-status").textContent =
        "Wait for your photos to finish loading before printing.";
      return;
    }
    window.print();
  };
  $("go").onclick = async () => {
    if (session && !confirm("Replace your current activity timer?")) return;
    const draft = readReflection();
    if (!(await persist(false))) return;
    startSession(draft);
    $("activity").innerHTML =
      '<div class="quiet"><span class="eyebrow">YOUR CLASSROOM IS OUT THERE</span><h1>Look up.<br>Take your time.</h1><p>Your activity timer is running. You can lock your phone.<br>It will catch up when you return, but won’t ring in the background.</p><button class="secondary" id="back">Return to my card</button></div>';
    $("back").onclick = () => {
      render(current.activity, current.id);
      fillReflection(draft);
    };
  };
}

async function persist(requireReflection) {
  if (saving || notebookBusy) return false;
  const card = current,
    generation = photoGeneration;
  await photoLoad;
  if (saving || card !== current || generation !== photoGeneration || photoBusy)
    return false;
  if (photoLoadFailed) {
    $("saved-status").textContent =
      "Your existing photos could not be loaded. Reopen this card before saving so they are kept.";
    return false;
  }
  const reflectionAnswers = readReflection();
  const reflection = reflectionFields
    .filter(([id]) => reflectionAnswers[id])
    .map(([id, label]) => label + "\n" + reflectionAnswers[id])
    .join("\n\n");
  if (requireReflection && !reflection) {
    $("saved-status").textContent =
      "Answer at least one reflection prompt first.";
    return false;
  }
  const old = notes.slice(),
    id = card.id || crypto.randomUUID(),
    photos = photoDraft.slice();
  const entry = {
    id,
    activity: card.activity,
    reflection,
    reflectionAnswers,
    spot: card.activity.spot || "",
    previousId: card.activity.previousId || null,
    photoCount: photos.length,
    checkResult,
    date: new Date().toISOString(),
  };
  saving = true;
  try {
    notes = [entry, ...notes.filter((n) => n.id !== id)].slice(0, 100);
    if (!save()) {
      notes = old;
      return false;
    }
    try {
      if (photos.length || old.find((n) => n.id === id)?.photoCount)
        await writePhotos(id, photos);
    } catch (error) {
      notes = old;
      save();
      if (card === current)
        $("saved-status").textContent =
          error.message +
          " Your text and photos have not been saved; try again.";
      return false;
    }
    card.id = id;
    for (const discarded of old.filter(
      (n) => !notes.some((kept) => kept.id === n.id),
    ))
      removePhotos(discarded.id).catch(() => {});
    if (card === current)
      $("saved-status").textContent = requireReflection
        ? "Reflection and photos saved on this browser."
        : "Card and photos saved on this browser.";
    return card === current;
  } finally {
    saving = false;
  }
}
function deleteNote(id) {
  if (saving || notebookBusy) return;
  const old = notes;
  notes = notes.filter((n) => n.id !== id);
  if (!save()) {
    notes = old;
    return;
  }
  removePhotos(id).catch(() => {});
  if (revisitId === id) {
    revisitId = null;
    updateRevisit();
  }
  notebook();
}
$("form").onsubmit = async (e) => {
  e.preventDefault();
  if (questionImageBusy) return;
  if (questionImages.length && !$("image-consent").checked) {
    $("status").textContent =
      "Confirm sending the selected images to Google AI first.";
    return;
  }
  $("generate").disabled = true;
  $("generate").textContent = "Exploring your question…";
  $("question-images").disabled = true;
  $("status").textContent = "";
  try {
    const selectedQuestionImages = questionImages.slice();
    const response = await fetch("/api/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic: $("topic").value,
        minutes: Number($("minutes").value),
        level: $("level").value,
        learnerStage: $("learner-stage").value,
        ...(questionImages.length
          ? {
              images: await Promise.all(
                selectedQuestionImages.map(encodePhoto),
              ),
              imageConsent: $("image-consent").checked,
            }
          : {}),
        place: $("place").value,
        mobility: $("mobility").value,
        weather: $("weather").value,
        timeOfDay: $("timeOfDay").value,
        spot: $("spot").value,
        ...(followUp ? { followUp } : {}),
        ...(revisitId
          ? { previous: previousFor(notes.find((n) => n.id === revisitId)) }
          : {}),
        ...groupInput(),
      }),
      signal: AbortSignal.timeout(30000),
    });
    const data = await response.json();
    if (!response.ok) throw Error(data.error || "Unable to make an activity.");
    render({
      ...data.activity,
      ...(revisitId ? { previousId: revisitId } : {}),
    });
    photoDraft = selectedQuestionImages;
    showPhotos();
    clearQuestionImages();
    revisitId = null;
    followUp = null;
    updateRevisit();
    updateFollowUp();
  } catch (e) {
    $("status").textContent =
      e.name === "TimeoutError"
        ? "That took too long. Try again or choose a sample."
        : e.message;
  } finally {
    $("generate").disabled = false;
    $("generate").textContent = "Explore my question";
    $("question-images").disabled = false;
  }
};
document.querySelectorAll("[data-topic]").forEach(
  (b) =>
    (b.onclick = () => {
      $("topic").value = b.dataset.topic;
      $("topic").focus();
    }),
);
document
  .querySelectorAll("[data-sample]")
  .forEach(
    (b) => (b.onclick = () => render(samples[Number(b.dataset.sample)])),
  );
$("audience").onchange = () => {
  const a = $("audience").value;
  $("group-fields").hidden = a === "Myself";
  if (a === "Family") $("groupSize").value = 4;
  if (a === "Class") $("groupSize").value = 20;
};
function previousFor(note) {
  const answers = note?.reflectionAnswers || {};
  return {
    noticed: String(answers.noticed || note?.reflection || "").slice(0, 350),
    explanation: String(answers.explanation || "").slice(0, 350),
    alternative: String(answers.alternative || "").slice(0, 350),
    question: String(answers.question || "").slice(0, 350),
  };
}
function updateRevisit() {
  const entry = notes.find((n) => n.id === revisitId);
  $("revisit-context").hidden = !entry;
  $("revisit-summary").textContent = entry
    ? `From ${entry.spot}: ${previousFor(entry).noticed.slice(0, 160)} Your earlier answers will be sent to Gemma to make the next activity.`
    : "";
}
function updateFollowUp() {
  $("followup-context").hidden = !followUp;
  $("followup-summary").textContent = followUp
    ? "Following up on: " +
      followUp.question +
      " Your earlier question and answer will be sent to Gemma."
    : "";
}
$("clear-followup").onclick = () => {
  followUp = null;
  updateFollowUp();
};
function revisit(note) {
  followUp = null;
  updateFollowUp();
  if (!note || !note.spot || !previousFor(note).noticed) return;
  revisitId = note.id;
  $("topic").value = note.activity.topic || note.activity.title;
  $("minutes").value = String(note.activity.minutes || 10);
  if (
    [
      "Courtyard",
      "Garden or park",
      "Outside my doorway",
      "By a window",
      "From a doorway",
    ].includes(note.activity.place)
  )
    $("place").value = note.activity.place;
  $("spot").value = note.spot;
  $("level").value = note.activity.level || "Beginner";
  $("mobility").value = note.activity.mobility || "Flexible";
  $("weather").value = "Any";
  $("timeOfDay").value = "Any";
  $("audience").value = note.activity.audience || "Myself";
  $("audience").onchange();
  if (note.activity.groupSize) $("groupSize").value = note.activity.groupSize;
  if (note.activity.ageRange) $("ageRange").value = note.activity.ageRange;
  updateRevisit();
  view("builder");
  $("weather").focus();
}
$("clear-revisit").onclick = () => {
  revisitId = null;
  updateRevisit();
};
function notebook() {
  view("notebook");
  renderProgress();
  renderComparisonOptions();
  clearPhotoUrls();
  $("entries").innerHTML = notes.length
    ? notes
        .map(
          (n) =>
            `<article class="note"><span class="tag">${n.reflection ? "REFLECTION RECORDED" : "SAVED ACTIVITY"}</span><h2>${esc(n.activity.title)}</h2>${n.activity.workLabel ? `<p class="hint">Shared work: ${esc(n.activity.workLabel)}</p>` : ""}${n.spot ? `<p class="spot-label">${esc(n.spot)} · ${esc(new Date(n.date).toLocaleDateString())}${n.previousId ? " · Return visit" : ""}</p>` : ""}<p>${esc(n.reflection || "Your field card is ready when you are.")}</p>${n.photoCount ? `<div class="note-photos" id="photos-${esc(n.id)}" aria-label="Evidence photos"></div>` : ""}${n.previousId && notes.some((older) => older.id === n.previousId) ? `<p class="hint">Builds on: ${esc(notes.find((older) => older.id === n.previousId).activity.title)}</p>` : ""}<button data-open="${esc(n.id)}">Open card</button>${n.activity.kind !== "explanation" && n.spot && previousFor(n).noticed ? `<button data-revisit="${esc(n.id)}">Return to this spot</button>` : ""}<button data-delete="${esc(n.id)}">Delete</button></article>`,
        )
        .join("")
    : '<div class="note"><h2>Your first discovery belongs here.</h2><p>Choose a sample or make an activity, then save its card.</p></div>';
  for (const n of notes.filter((n) => n.photoCount))
    readPhotos(n.id)
      .then((photos) => {
        const target = $("photos-" + n.id);
        if (target && !$("notebook").hidden)
          target.innerHTML = photos
            .map(
              (blob, i) =>
                `<img src="${photoUrl(blob)}" alt="Evidence photo ${i + 1} for ${esc(n.activity.title)}">`,
            )
            .join("");
      })
      .catch(() => {});
  document.querySelectorAll("[data-open]").forEach(
    (b) =>
      (b.onclick = () => {
        const n = notes.find((n) => n.id === b.dataset.open);
        render(n.activity, n.id);
      }),
  );
  document
    .querySelectorAll("[data-revisit]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          revisit(notes.find((n) => n.id === b.dataset.revisit))),
    );
  document.querySelectorAll("[data-delete]").forEach(
    (b) =>
      (b.onclick = () => {
        if (confirm("Delete this saved card and reflection?")) {
          deleteNote(b.dataset.delete);
        }
      }),
  );
}
$("count").textContent = notes.length;
if ("serviceWorker" in navigator)
  navigator.serviceWorker
    .register("/sw.js")
    .then(() => navigator.serviceWorker.ready)
    .then(() => {
      $("offline").textContent =
        "Cards & samples available offline after this visit.";
    })
    .catch(() => {});

// Timestamp-based sessions keep accurate elapsed time when a tab is suspended.
let session = null;
const sessionKey = "outsideclass-session-v1";
try {
  const value = JSON.parse(localStorage.getItem(sessionKey) || "null");
  if (
    value &&
    value.activity &&
    Array.isArray(value.activity.steps) &&
    typeof value.activity.title === "string" &&
    Number.isFinite(value.remaining) &&
    value.remaining >= 0 &&
    (value.deadline === null || Number.isFinite(value.deadline))
  )
    session = value;
} catch {}
function sessionSeconds() {
  return session
    ? Math.max(
        0,
        session.deadline === null
          ? session.remaining
          : Math.ceil((session.deadline - Date.now()) / 1000),
      )
    : 0;
}
function storeSession() {
  try {
    if (session) localStorage.setItem(sessionKey, JSON.stringify(session));
    else localStorage.removeItem(sessionKey);
  } catch {
    $("timer-status").textContent = "Timer cannot be saved on this browser.";
  }
}
function updateTimer() {
  const panel = $("session-panel");
  panel.hidden = !session;
  document.body.classList.toggle("has-session", !!session);
  if (!session) return;
  const seconds = sessionSeconds();
  $("timer-title").textContent = session.activity.title;
  $("timer-clock").textContent =
    String(Math.floor(seconds / 60)).padStart(2, "0") +
    ":" +
    String(seconds % 60).padStart(2, "0");
  const status =
    seconds === 0
      ? "Time is up. Finish when you are ready."
      : session.deadline === null
        ? "Paused"
        : "Exploration in progress";
  if ($("timer-status").textContent !== status)
    $("timer-status").textContent = status;
  $("timer-pause").textContent = session.deadline === null ? "Resume" : "Pause";
  $("timer-pause").disabled = seconds === 0;
}
function startSession(draft) {
  const seconds = Number(current.activity.minutes) * 60;
  session = {
    activity: structuredClone(current.activity),
    id: current.id,
    draft,
    remaining: seconds,
    deadline: Date.now() + seconds * 1000,
  };
  storeSession();
  updateTimer();
}
$("timer-pause").onclick = () => {
  if (!session) return;
  if (session.deadline === null)
    session.deadline = Date.now() + session.remaining * 1000;
  else {
    session.remaining = sessionSeconds();
    session.deadline = null;
  }
  storeSession();
  updateTimer();
};
$("timer-finish").onclick = () => {
  if (!session) return;
  const completed = session;
  const draft =
    current?.id === completed.id &&
    document.getElementById("reflection-noticed")
      ? readReflection()
      : null;
  session = null;
  storeSession();
  updateTimer();
  render(completed.activity, completed.id);
  if (draft) fillReflection(draft);
  else if (!notes.some((n) => n.id === completed.id))
    fillReflection(completed.draft);
  $("reflection-noticed").focus();
};
function updateClock() {
  $("local-clock").textContent = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}
setInterval(() => {
  updateTimer();
  updateClock();
}, 1000);
document.addEventListener("visibilitychange", updateTimer);
document.addEventListener("click", (event) => {
  const link = event.target.closest("a[data-page]");
  if (
    !link ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey ||
    event.altKey ||
    event.button !== 0
  )
    return;
  event.preventDefault();
  navigate(link.dataset.page);
});
document.querySelectorAll("[data-audience]").forEach(
  (button) =>
    (button.onclick = () => {
      $("audience").value = button.dataset.audience;
      $("audience").onchange();
      view("builder");
      $("topic").focus();
    }),
);
window.addEventListener("popstate", () =>
  navigate(
    Object.keys(routes).find((id) => routes[id] === location.pathname) ||
      "home",
  ),
);
$("copy-feed").onclick = async () => {
  try {
    await navigator.clipboard.writeText($("feed-url").value);
    $("feed-status").textContent =
      "Copied. Paste this address into your feed reader to subscribe.";
  } catch {
    $("feed-url").select();
    $("feed-status").textContent =
      "Select and copy the feed address, then add it to your feed reader.";
  }
};
updateClock();
updateTimer();
navigate(
  Object.keys(routes).find((id) => routes[id] === location.pathname) || "home",
);

function checkHtml(a) {
  if (!Array.isArray(a.checks)) return "";
  return `<section class="understanding"><h2>Check your understanding</h2><p class="hint">Two practice questions, not a formal grade. Save your card after checking to keep your result.</p>${a.checks.map((q, i) => `<fieldset><legend>${esc(q.question)}</legend>${q.options.map((option, j) => `<label><input type="radio" name="check-${i}" value="${j}" ${checkResult?.answers?.[i] === j ? "checked" : ""}> ${esc(option)}</label>`).join("")}<p id="check-feedback-${i}" class="hint"></p></fieldset>`).join("")}<button id="check-answers" class="secondary">Check my answers</button><p id="check-status" role="status"></p>${a.nextQuestion ? `<button id="next-discovery" class="secondary">Next discovery: ${esc(a.nextQuestion)}</button>` : ""}</section>`;
}
function bindChecks(a) {
  if (!a.checks) return;
  const show = () => {
    if (!checkResult) return;
    for (const [i, q] of a.checks.entries())
      $("check-feedback-" + i).textContent =
        (checkResult.answers[i] === q.correctIndex
          ? "Correct. "
          : "Try again. ") + q.feedback;
    $("check-status").textContent =
      `${checkResult.correct} of 2 correct. Review the explanation and try again if needed.`;
  };
  show();
  $("check-answers").onclick = () => {
    try {
      checkResult = scoreChecks(
        a.checks,
        a.checks.map((q, i) => {
          const selected = document.querySelector(
            `input[name="check-${i}"]:checked`,
          );
          return selected ? Number(selected.value) : null;
        }),
      );
      show();
    } catch (error) {
      $("check-status").textContent = error.message;
    }
  };
  if ($("next-discovery"))
    $("next-discovery").onclick = () => {
      followUp = {
        question: String(a.topic || a.title).slice(0, 600),
        answer: a.explanation.slice(0, 1200),
      };
      $("topic").value = a.nextQuestion;
      revisitId = null;
      updateRevisit();
      updateFollowUp();
      view("builder");
      $("topic").focus();
    };
}
function renderProgress() {
  const p = learningProgress(notes);
  $("progress-summary").innerHTML =
    `<h2>Your learning so far</h2><div class="progress-grid"><p><strong>${p.saved}</strong> saved cards</p><p><strong>${p.reflections}</strong> reflections</p><p><strong>${p.returnVisits}</strong> return visits</p><p><strong>${p.checked}</strong> cards checked</p></div><p class="hint">${p.correct} correct answers out of ${p.questions} checked questions. Practice results do not prove mastery.</p>`;
}
function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
$("backup-notebook").onclick = async () => {
  if (saving || notebookBusy) return;
  notebookBusy = true;
  $("backup-notebook").disabled = true;
  $("backup-status").textContent = "Preparing your notebook and photos…";
  try {
    downloadBlob(
      await makeBackup(notes.slice(), readPhotos),
      "outsideclass-notebook.json",
    );
    $("backup-status").textContent =
      "Backup downloaded. Keep it somewhere safe; it includes your photos and reflections.";
  } catch (error) {
    $("backup-status").textContent = error.message;
  } finally {
    notebookBusy = false;
    $("backup-notebook").disabled = false;
  }
};
$("import-notebook").onchange = async (event) => {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file || saving || notebookBusy) return;
  if (file.size > MAX_BACKUP_BYTES) {
    $("backup-status").textContent = "Choose a backup smaller than 180 MB.";
    return;
  }
  notebookBusy = true;
  try {
    const data = JSON.parse(await file.text());
    const result = await restoreBackup(
      data,
      notes,
      writePhotos,
      removePhotos,
      (next) => {
        const old = notes;
        notes = next;
        if (save()) return true;
        notes = old;
        return false;
      },
    );
    notes = result.notes;
    notebook();
    $("backup-status").textContent =
      `Imported ${result.added} cards. Existing cards were kept.`;
  } catch (error) {
    $("backup-status").textContent = error.message;
  } finally {
    notebookBusy = false;
  }
};
async function downloadCard(lesson) {
  const card = current;
  if (!card || saving || notebookBusy) return;
  await photoLoad;
  if (current !== card || photoBusy || photoLoadFailed) return;
  try {
    const id = crypto.randomUUID();
    const { previous, followUp, previousId, spot, ...publicLesson } =
      card.activity;
    const label = lesson
      ? ""
      : prompt(
          "Label your shared work (optional, e.g. Learner 01). This label is saved in the downloaded file, not sent to AI.",
          "",
        );
    if (label === null) return;
    const activity = lesson
      ? { ...publicLesson, assignmentId: id }
      : { ...card.activity, workLabel: String(label || "").slice(0, 60) };
    const entry = {
      id,
      activity,
      reflection: lesson
        ? ""
        : reflectionFields
            .filter(([key]) => readReflection()[key])
            .map(([key, label]) => label + "\n" + readReflection()[key])
            .join("\n\n"),
      reflectionAnswers: lesson ? {} : readReflection(),
      spot: activity.spot || "",
      previousId: lesson ? null : card.id,
      date: new Date().toISOString(),
      photos: lesson ? [] : await Promise.all(photoDraft.map(encodePhoto)),
    };
    downloadBlob(
      new Blob(
        [
          JSON.stringify({
            format: "outsideclass-notebook",
            version: 1,
            entries: [entry],
          }),
        ],
        { type: "application/json" },
      ),
      lesson ? "outsideclass-activity-pack.json" : "outsideclass-my-work.json",
    );
    $("saved-status").textContent = lesson
      ? "Activity pack downloaded without personal notes or photos."
      : "Work downloaded with your current notes and images.";
  } catch (error) {
    $("saved-status").textContent = error.message;
  }
}
function clearQuestionImages() {
  for (const url of questionImageUrls) URL.revokeObjectURL(url);
  questionImageUrls = [];
  questionImages = [];
  $("question-image-preview").innerHTML = "";
  $("image-consent").checked = false;
  $("clear-question-images").hidden = true;
  $("question-image-status").textContent = "";
}
$("clear-question-images").onclick = clearQuestionImages;
$("question-images").onchange = async (event) => {
  const files = Array.from(event.target.files || []);
  event.target.value = "";
  if (questionImageBusy || !files.length) return;
  if (files.length > 2) {
    $("question-image-status").textContent = "Choose up to two images.";
    return;
  }
  questionImageBusy = true;
  $("generate").disabled = true;
  try {
    const photos = await Promise.all(files.map(shrinkPhoto));
    clearQuestionImages();
    questionImages = photos;
    $("question-image-preview").innerHTML = photos
      .map((photo, i) => {
        const url = URL.createObjectURL(photo);
        questionImageUrls.push(url);
        return `<img src="${url}" alt="Selected question image ${i + 1}">`;
      })
      .join("");
    $("clear-question-images").hidden = false;
    $("question-image-status").textContent =
      "Ready. Confirm sending these images before asking.";
  } catch (error) {
    $("question-image-status").textContent = error.message;
  } finally {
    questionImageBusy = false;
    $("generate").disabled = false;
  }
};
function renderComparisonOptions() {
  const options =
    '<option value="">Choose a saved card</option>' +
    notes
      .map(
        (n) =>
          `<option value="${esc(n.id)}">${esc(n.activity.title)} · ${esc(n.spot || "Unnamed spot")}</option>`,
      )
      .join("");
  $("compare-first").innerHTML = options;
  $("compare-second").innerHTML = options;
  $("comparison-result").innerHTML = "";
}
$("compare-notes").onclick = async () => {
  const first = notes.find((n) => n.id === $("compare-first").value),
    second = notes.find((n) => n.id === $("compare-second").value);
  if (!first || !second || first.id === second.id) {
    $("comparison-result").textContent = "Choose two different saved cards.";
    return;
  }
  const selected = [first, second];
  $("comparison-result").innerHTML =
    `<p class="hint">${first.spot && first.spot === second.spot ? "Same named spot." : "These cards may describe different places or conditions."} Compare observations before deciding why they differ.</p><div class="row">${selected.map((n, i) => `<article><h3>${esc(n.activity.title)}</h3><p>${esc(new Date(n.date).toLocaleDateString())} · ${esc(n.activity.weather || "Any")} · ${esc(n.activity.timeOfDay || "Any")}</p><p class="comparison-note">${esc(n.reflection || "No observation recorded yet.")}</p><div id="compare-photos-${i}" class="photo-strip"></div></article>`).join("")}</div>`;
  for (const [i, n] of selected.entries()) {
    try {
      const photos = n.photoCount ? await readPhotos(n.id) : [];
      const target = $("compare-photos-" + i);
      if (target)
        target.innerHTML = photos
          .map(
            (photo, j) =>
              `<img src="${photoUrl(photo)}" alt="Evidence photo ${j + 1}">`,
          )
          .join("");
    } catch {
      const target = $("compare-photos-" + i);
      if (target) target.textContent = "Saved photos could not be loaded.";
    }
  }
};
