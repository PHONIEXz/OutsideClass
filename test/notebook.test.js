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
  const sandbox = {
    console,
    structuredClone,
    Intl,
    Date,
    URL,
    Promise,
    Blob,
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
      removeItem: (k) => stored.delete(k),
    },
    samples,
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
      `\ndownloadBlob=captureExport;globalThis.api={render,navigate,persist,deleteNote,addPhotos,downloadCard,get notes(){return notes;},get current(){return current;},get load(){return photoLoad;},setChecks(value){checkResult=value;},setPhotos(photos){photoDraft=photos;}};`,
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
    /will be sent to Gemma/,
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
