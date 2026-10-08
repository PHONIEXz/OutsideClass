import { scoreChecks, learningProgress } from "../public/learning.js";
import {
  encodePhoto,
  makeBackup,
  restoreBackup,
  MAX_BACKUP_BYTES,
} from "../public/notebook-tools.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { diagramHtml } from "../public/diagrams.js";
import { samples } from "../public/samples.js";
import { matchesUpdate } from "../public/feed.js";
import { readProfile, saveProfile, clearProfile } from "../public/profile.js";

// Run the real UI handlers with controlled browser storage failures.
const source = (
  await readFile(new URL("../public/app.js", import.meta.url), "utf8")
).replace(/^import\s[\s\S]*?from\s+["'][^"']+["'];\r?\n/gm, "");
function browser(saved = [], overrides = {}) {
  const elements = new Map(),
    stored = new Map([["outsideclass-notes-v1", JSON.stringify(saved)]]),
    deleted = [],
    writes = [],
    exports = [];
  for (const [key, value] of Object.entries(overrides.initialStorage || {}))
    stored.set(key, value);
  const element = (id) => {
    if (!elements.has(id))
      elements.set(id, {
        hidden: false,
        value: "",
        textContent: "",
        innerHTML: "",
        disabled: false,
        focus() {},
        querySelectorAll() {
          return [];
        },
      });
    return elements.get(id);
  };
  let failSave = false;
  let failRemove = false;
  const sandbox = {
    console,
    structuredClone,
    Intl,
    Date,
    URL,
    Promise,
    Blob,
    AbortSignal,
    btoa,
    prompt: () => "Learner 01",
    captureExport: (blob, name) => exports.push({ blob, name }),
    crypto: { randomUUID: () => "new-card" },
    setInterval() {},
    alert() {},
    confirm: () => true,
    document: {
      getElementById: element,
      querySelectorAll: () => [],
      addEventListener() {},
      body: { classList: { toggle() {} } },
    },
    window: { scrollTo() {}, addEventListener() {} },
    location: { pathname: "/" },
    history: { pushState() {} },
    navigator: {},
    localStorage: {
      getItem: (k) => stored.get(k) || null,
      setItem(k, v) {
        if (failSave) throw Error("quota");
        stored.set(k, v);
      },
      removeItem(k) {
        if (failRemove) throw Error("storage unavailable");
        stored.delete(k);
      },
    },
    samples,
    matchesUpdate,
    readProfile,
    saveProfile,
    clearProfile,
    diagramHtml,
    scoreChecks,
    learningProgress,
    encodePhoto,
    makeBackup,
    restoreBackup,
    MAX_BACKUP_BYTES,
    safetyNotes: () => [],
    MAX_PHOTOS: 2,
    readPhotos: async () => [],
    writePhotos: async (id, photos) => writes.push({ id, photos }),
    removePhotos: async (id) => deleted.push(id),
    shrinkPhoto: async (f) => f,
    ...overrides,
  };
  vm.runInNewContext(
    source +
      `\ndownloadBlob=captureExport;globalThis.api={render,navigate,persist,deleteNote,addPhotos,downloadCard,startSession,updateTimer,get session(){return session;},get notes(){return notes;},get current(){return current;},get load(){return photoLoad;},setChecks(value){checkResult=value;},setPhotos(photos){photoDraft=photos;}};`,
    sandbox,
  );
  return {
    api: sandbox.api,
    element,
    stored,
    deleted,
    writes,
    exports,
    failSave: () => {
      failSave = true;
    },
    failRemove: () => {
      failRemove = true;
    },
  };
}
const note = (id, photoCount = 1) => ({
  id,
  activity: samples[0],
  reflection: "Original note",
  reflectionAnswers: { noticed: "Original note" },
  photoCount,
  date: "2026-10-07T10:00:00Z",
});

test("photo read failure cannot overwrite the existing photos or reflection", async () => {
  const b = browser([note("saved")], {
    readPhotos: async () => {
      throw Error("storage unavailable");
    },
  });
  b.api.render(samples[0], "saved");
  await b.api.load;
  b.element("reflection-noticed").value = "New text";
  assert.equal(await b.api.persist(true), false);
  assert.equal(b.writes.length, 0);
  assert.equal(b.api.notes[0].reflection, "Original note");
  assert.match(b.element("saved-status").textContent, /Reopen this card/);
});
test("failed note deletion keeps the note and its photos", () => {
  const b = browser([note("saved")]);
  b.failSave();
  b.api.deleteNote("saved");
  assert.equal(b.api.notes.length, 1);
  assert.deepEqual(b.deleted, []);
});
test("successful deletion removes only that note and its photos", () => {
  const b = browser([note("saved"), note("other")]);
  b.api.deleteNote("saved");
  assert.equal(b.api.notes.length, 1);
  assert.equal(b.api.notes[0].id, "other");
  assert.deepEqual(b.deleted, ["saved"]);
});
test("double save creates one note and writes its photos once", async () => {
  let finish;
  const pending = new Promise((resolve) => (finish = resolve));
  const b = browser([], {
    writePhotos: async () => {
      b.writes.push("write");
      await pending;
    },
  });
  b.api.render(samples[0]);
  b.api.setPhotos(["photo"]);
  b.element("reflection-noticed").value = "A shadow";
  const first = b.api.persist(true),
    second = b.api.persist(true);
  await Promise.resolve();
  await Promise.resolve();
  finish();
  assert.equal(await first, true);
  assert.equal(await second, false);
  assert.equal(b.api.notes.length, 1);
  assert.equal(b.writes.length, 1);
});
test("a full notebook cannot silently evict a saved card or its photos", async () => {
  const b = browser(Array.from({ length: 100 }, (_, i) => note(String(i))));
  b.api.render(samples[0]);
  assert.equal(await b.api.persist(false), false);
  assert.equal(b.api.notes.length, 100);
  assert.equal(b.api.notes[99].id, "99");
  assert.deepEqual(b.deleted, []);
  assert.match(b.element("saved-status").textContent, /Download a backup/);
  b.api.render(samples[0], "0");
  assert.equal(await b.api.persist(false), true);
});
test("a delayed photo save does not change the card the learner navigated to", async () => {
  let finish;
  const pending = new Promise((resolve) => (finish = resolve));
  const b = browser([], { writePhotos: async () => pending });
  b.api.render(samples[0]);
  b.api.setPhotos(["photo"]);
  const saving = b.api.persist(false);
  await Promise.resolve();
  await Promise.resolve();
  b.api.render(samples[1]);
  finish();
  assert.equal(await saving, false);
  assert.equal(b.api.current.id, null);
  assert.equal(b.api.notes[0].activity.title, samples[0].title);
  assert.equal(b.element("saved-status").textContent, "");
});
test("text-only notes can save without photo storage support", async () => {
  const b = browser([note("text", 0)], {
    readPhotos: async () => {
      throw Error("unsupported");
    },
  });
  b.api.render(samples[0], "text");
  b.element("reflection-noticed").value = "Leaves";
  assert.equal(await b.api.persist(true), true);
  assert.equal(b.writes.length, 0);
});

test("upload prepares two images and saves them without requiring a reflection", async () => {
  const b = browser();
  b.api.render(samples[0]);
  const images = [
    new Blob(["one"], { type: "image/png" }),
    new Blob(["two"], { type: "image/jpeg" }),
  ];
  await b.api.addPhotos({ target: { files: images, value: "selected" } });
  assert.equal(await b.api.persist(false), true);
  assert.equal(b.api.notes[0].photoCount, 2);
  assert.equal(b.writes[0].photos.length, 2);
  assert.equal(b.api.notes[0].reflection, "");
});
test("an upload beyond the two-image limit is rejected without changing the saved card", async () => {
  const b = browser();
  b.api.render(samples[0]);
  await b.api.addPhotos({ target: { files: [1, 2, 3], value: "selected" } });
  assert.match(b.element("photo-status").textContent, /up to two/);
  await b.api.persist(false);
  assert.equal(b.api.notes[0].photoCount, 0);
  assert.equal(b.writes.length, 0);
});
test("direct explanations render an answer, hide the activity timer trigger and keep uploads", () => {
  const b = browser();
  b.api.render({
    ...samples[0],
    kind: "explanation",
    steps: [],
    materials: [],
    reason: "An explanation fits better.",
  });
  const html = b.element("activity").innerHTML;
  assert.match(html, /Here’s the explanation/);
  assert.match(html, /id="go" hidden/);
  assert.ok(!html.includes("<h2>Bring along</h2>"));
  assert.match(html, /id="photo-input"/);
  assert.match(html, /id="ask-followup"/);
  b.element("ask-followup").onclick();
  assert.match(
    b.element("followup-summary").textContent,
    /will be sent to OutsideClass AI/,
  );
  assert.equal(b.element("topic").value, "");
});

test("offline questions explain recovery without calling the provider", async () => {
  let requested = false;
  const b = browser([], {
    navigator: { onLine: false },
    fetch: async () => {
      requested = true;
    },
  });
  await b.element("form").onsubmit({ preventDefault() {} });
  assert.equal(requested, false);
  assert.match(
    b.element("status").textContent,
    /sample or reopen a saved card/,
  );
});

test("navigation back to the current card retains unsaved reflection and photos", async () => {
  const b = browser();
  b.api.render(samples[0]);
  await b.api.load;
  b.element("reflection-noticed").value = "Unsaved observation";
  b.api.setPhotos([new Blob(["draft"], { type: "image/jpeg" })]);
  b.api.navigate("guides");
  b.api.navigate("activity");
  assert.equal(b.element("reflection-noticed").value, "Unsaved observation");
  assert.match(b.element("photo-preview").innerHTML, /Evidence photo 1/);
  assert.equal(b.api.notes.length, 0);
});

test("class packs remove learner labels while work exports preserve checked answers", async () => {
  const b = browser();
  b.api.render({
    ...samples[0],
    workLabel: "Private learner name",
    spot: "Private spot",
    previous: { noticed: "Private observation" },
  });
  await b.api.load;
  b.element("reflection-noticed").value = "Shared observation";
  b.api.setChecks({ answers: [0, 1], correct: 2, total: 2 });
  await b.api.downloadCard(true);
  const lesson = JSON.parse(await b.exports[0].blob.text()).entries[0];
  assert.equal(lesson.activity.workLabel, undefined);
  assert.equal(lesson.activity.previous, undefined);
  assert.equal(lesson.activity.spot, undefined);
  assert.equal(lesson.reflection, "");
  assert.equal(lesson.checkResult, null);
  await b.api.downloadCard(false);
  const work = JSON.parse(await b.exports[1].blob.text());
  const { validateBackup } = await import("../public/notebook-tools.js");
  const restored = validateBackup(work)[0].entry;
  assert.equal(restored.reflectionAnswers.noticed, "Shared observation");
  assert.equal(restored.checkResult.correct, 2);
  assert.equal(restored.activity.workLabel, "Learner 01");
});

test("finishing a timer keeps unsaved photos, checked answers and reflection on its current card", async () => {
  const b = browser([note("saved", 0)]);
  b.api.render(samples[0], "saved");
  await b.api.load;
  b.api.startSession({ noticed: "Earlier draft" });
  b.api.setPhotos([new Blob(["new evidence"], { type: "image/jpeg" })]);
  b.api.setChecks({ answers: [0, 1], correct: 2, total: 2 });
  b.element("reflection-noticed").value = "New unsaved reflection";
  b.api.navigate("guides");
  b.element("timer-finish").onclick();
  assert.equal(b.api.session, null);
  assert.equal(b.element("session-panel").hidden, true);
  assert.equal(b.stored.has("outsideclass-session-v1"), false);
  assert.equal(await b.api.persist(true), true);
  assert.equal(b.api.notes[0].photoCount, 1);
  assert.equal(b.api.notes[0].checkResult.correct, 2);
  assert.equal(
    b.api.notes[0].reflectionAnswers.noticed,
    "New unsaved reflection",
  );
});

test("timer pause, reload, resume and suspended-tab expiry use elapsed time", () => {
  let now = 1000000;
  class Clock extends Date {
    static now() {
      return now;
    }
  }
  const b = browser([note("saved", 0)], { Date: Clock });
  b.api.render(samples[0], "saved");
  b.api.startSession({});
  now += 12500;
  b.element("timer-pause").onclick();
  const pausedSeconds = 588;
  assert.equal(b.api.session.remaining, pausedSeconds);
  assert.equal(b.api.session.deadline, null);
  now += 600000;
  const restored = browser([note("saved", 0)], {
    Date: Clock,
    initialStorage: {
      "outsideclass-session-v1": b.stored.get("outsideclass-session-v1"),
    },
  });
  assert.equal(restored.element("timer-clock").textContent, "09:48");
  assert.equal(restored.element("timer-status").textContent, "Paused");
  restored.element("timer-pause").onclick();
  assert.equal(restored.api.session.deadline, now + pausedSeconds * 1000);
  now += (pausedSeconds + 10) * 1000;
  restored.api.updateTimer();
  assert.equal(restored.element("timer-clock").textContent, "00:00");
  assert.equal(restored.element("timer-pause").disabled, true);
  assert.match(restored.element("timer-status").textContent, /Time is up/);
});

test("finishing a recovered timer opens its saved reflection and practice results", async () => {
  const saved = {
    ...note("saved", 0),
    checkResult: { answers: [0, 1], correct: 2, total: 2 },
  };
  const b = browser([saved], {
    initialStorage: {
      "outsideclass-session-v1": JSON.stringify({
        activity: samples[0],
        id: "saved",
        draft: { noticed: "Old draft" },
        remaining: 0,
        deadline: null,
      }),
    },
  });
  b.element("timer-finish").onclick();
  await b.api.load;
  assert.equal(b.api.current.id, "saved");
  assert.equal(b.element("reflection-noticed").value, "Original note");
  assert.equal(
    b.element("check-status").textContent,
    "2 of 2 correct. Review the explanation and try again if needed.",
  );
});

test("failed timer pause persistence stays visible across countdown updates", () => {
  const b = browser([note("saved", 0)]);
  b.api.render(samples[0], "saved");
  b.api.startSession({});
  b.failSave();
  b.element("timer-pause").onclick();
  b.api.updateTimer();
  assert.equal(b.api.session.deadline, null);
  assert.match(
    b.element("timer-status").textContent,
    /Paused.*could not be saved/,
  );
});

test("failed timer removal warns that it may reappear after reload", () => {
  const b = browser([note("saved", 0)]);
  b.api.render(samples[0], "saved");
  b.api.startSession({});
  b.failRemove();
  b.element("timer-finish").onclick();
  assert.equal(b.api.session, null);
  assert.equal(b.stored.has("outsideclass-session-v1"), true);
  assert.match(
    b.element("saved-status").textContent,
    /may reappear after reload/,
  );
});

test("local profile personalizes safely, survives navigation and clearing keeps notebook work", () => {
  const b = browser([note("saved", 0)]);
  b.element("profile-name").value = "Phoenix <b>";
  b.element("profile-role").value = "Teacher";
  b.element("profile-form").onsubmit({ preventDefault() {} });
  assert.equal(
    b.element("profile-greeting").textContent,
    "Welcome back, Phoenix <b>.",
  );
  assert.equal(b.element("profile-greeting").innerHTML, "");
  assert.equal(
    b.element("notebook-label").textContent,
    "Phoenix <b>’s field notebook",
  );
  b.api.navigate("guides");
  assert.equal(b.element("profile-role-label").textContent, "Teacher");
  b.element("profile-clear").onclick();
  assert.equal(b.element("profile-greeting").textContent, "Welcome, explorer.");
  assert.equal(b.api.notes.length, 1);
  assert.equal(b.api.notes[0].id, "saved");
  assert.equal(b.stored.has("outsideclass-profile-v1"), false);
});

test("failed profile save keeps the previous greeting and clear failure keeps its profile", () => {
  const initialStorage = {
    "outsideclass-profile-v1": JSON.stringify({ name: "Phoenix", role: "" }),
  };
  const b = browser([], { initialStorage });
  b.failSave();
  b.element("profile-name").value = "Changed name";
  b.element("profile-form").onsubmit({ preventDefault() {} });
  assert.equal(
    b.element("profile-greeting").textContent,
    "Welcome back, Phoenix.",
  );
  assert.match(
    b.element("profile-status").textContent,
    /previous profile is kept/,
  );
  b.failRemove();
  b.element("profile-clear").onclick();
  assert.equal(
    b.element("profile-greeting").textContent,
    "Welcome back, Phoenix.",
  );
  assert.equal(b.stored.has("outsideclass-profile-v1"), true);
});

test("profile name and role never enter AI requests or downloaded learner work", async () => {
  let request;
  const b = browser([], {
    initialStorage: {
      "outsideclass-profile-v1": JSON.stringify({
        name: "PrivateNickname123",
        role: "Teacher",
      }),
    },
    fetch: async (url, options) => {
      request = JSON.parse(options.body);
      return { ok: false, json: async () => ({ error: "Mock provider" }) };
    },
  });
  b.element("topic").value = "Shadows";
  b.element("audience").value = "Myself";
  await b.element("form").onsubmit({ preventDefault() {} });
  assert.ok(request);
  assert.equal(request.name, undefined);
  assert.equal(request.role, undefined);
  assert.ok(!JSON.stringify(request).includes("PrivateNickname123"));
  b.api.render(samples[0]);
  await b.api.downloadCard(false);
  const exported = await b.exports[0].blob.text();
  assert.ok(!exported.includes("PrivateNickname123"));
  assert.ok(!exported.includes('"role":"Teacher"'));
});

test("older saved AI cards display OutsideClass AI while keeping their stored attribution", () => {
  const activity = { ...samples[0], source: "Gemma · gemma-4-26b-a4b-it" };
  const saved = { ...note("saved", 0), activity };
  const b = browser([saved]);
  b.api.render(activity, "saved");
  assert.match(b.element("activity").innerHTML, /OutsideClass AI/);
  assert.ok(!b.element("activity").innerHTML.includes("Gemma ·"));
  assert.equal(b.api.notes[0].activity.source, activity.source);
});
