import { validateChecks, scoreChecks } from "./learning.js";
export const MAX_BACKUP_BYTES = 180 * 1024 * 1024;
export async function encodePhoto(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let text = "";
  for (let i = 0; i < bytes.length; i += 8192)
    text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return { mimeType: "image/jpeg", data: btoa(text) };
}
export function decodePhoto(photo) {
  if (
    !photo ||
    photo.mimeType !== "image/jpeg" ||
    typeof photo.data !== "string" ||
    photo.data.length > 819200 ||
    !/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      photo.data,
    )
  )
    throw Error("A backup photo is invalid or too large.");
  const bytes = Uint8Array.from(atob(photo.data), (c) => c.charCodeAt(0));
  if (
    bytes.length < 4 ||
    bytes[0] !== 255 ||
    bytes[1] !== 216 ||
    bytes[2] !== 255
  )
    throw Error("A backup photo is not a JPEG.");
  return new Blob([bytes], { type: "image/jpeg" });
}
const text = (x, max) => typeof x === "string" && x.length <= max;
function checkCard(a) {
  if (
    !a ||
    !text(a.title, 140) ||
    !a.title.trim() ||
    !["goal", "explanation", "reflection", "safety"].every((k) =>
      text(a[k], 1200),
    ) ||
    !Array.isArray(a.steps) ||
    a.steps.length > 5 ||
    !a.steps.every((s) => text(s, 600)) ||
    !Array.isArray(a.materials) ||
    a.materials.length > 6 ||
    !a.materials.every((s) => text(s, 100)) ||
    ![5, 10, 15, 20].includes(a.minutes) ||
    !text(a.topic || "", 600) ||
    !["Beginner", "Intermediate"].includes(a.level) ||
    !text(a.place, 100)
  )
    throw Error("A saved learning card is invalid.");
  if (a.kind !== undefined && !["activity", "explanation"].includes(a.kind))
    throw Error("A learning card has an unknown type.");
  if (a.checks) validateChecks(a.checks);
  if (
    a.discussion &&
    (!Array.isArray(a.discussion) ||
      a.discussion.length > 3 ||
      !a.discussion.every((s) => text(s, 300)))
  )
    throw Error("Group questions are invalid.");
  if (a.groupTips && !text(a.groupTips, 800))
    throw Error("Group guidance is invalid.");
  return a;
}
export function validateBackup(data) {
  if (
    !data ||
    data.format !== "outsideclass-notebook" ||
    data.version !== 1 ||
    !Array.isArray(data.entries) ||
    data.entries.length > 100
  )
    throw Error(
      "Choose an OutsideClass notebook backup (version 1, up to 100 cards).",
    );
  const ids = new Set();
  return data.entries.map((n) => {
    if (
      !n ||
      !text(n.id, 100) ||
      !n.id ||
      ids.has(n.id) ||
      !text(n.reflection, 22000) ||
      !Number.isFinite(Date.parse(n.date)) ||
      !Array.isArray(n.photos) ||
      n.photos.length > 2
    )
      throw Error("A notebook entry is invalid or duplicated.");
    ids.add(n.id);
    const activity = checkCard(n.activity),
      answers = n.reflectionAnswers || {};
    if (
      !["noticed", "explanation", "alternative", "surprised", "question"].every(
        (k) => answers[k] === undefined || text(answers[k], 4000),
      )
    )
      throw Error("Reflection answers are invalid.");
    const photos = n.photos.map(decodePhoto);
    return {
      entry: {
        id: n.id,
        activity,
        reflection: n.reflection,
        reflectionAnswers: answers,
        spot: String(n.spot || "").slice(0, 60),
        previousId: typeof n.previousId === "string" ? n.previousId : null,
        photoCount: photos.length,
        checkResult:
          n.checkResult && activity.checks
            ? scoreChecks(activity.checks, n.checkResult.answers)
            : null,
        date: n.date,
      },
      photos,
    };
  });
}
export async function makeBackup(notes, readPhotos) {
  const entries = [];
  for (const n of notes) {
    const photos = n.photoCount ? await readPhotos(n.id) : [];
    if (photos.length !== (n.photoCount || 0))
      throw Error(
        "Some saved photos could not be found. Reopen that card before backing up.",
      );
    entries.push({ ...n, photos: await Promise.all(photos.map(encodePhoto)) });
  }
  const blob = new Blob(
    [
      JSON.stringify({
        format: "outsideclass-notebook",
        version: 1,
        createdAt: new Date().toISOString(),
        entries,
      }),
    ],
    { type: "application/json" },
  );
  if (blob.size > MAX_BACKUP_BYTES)
    throw Error(
      "This notebook is too large for one backup. Export individual cards instead.",
    );
  return blob;
}
export async function restoreBackup(
  data,
  notes,
  writePhotos,
  removePhotos,
  commit,
) {
  const incoming = validateBackup(data).filter(
    (n) => !notes.some((old) => old.id === n.entry.id),
  );
  if (notes.length + incoming.length > 100)
    throw Error(
      "Import would exceed 100 cards. Make room first; no cards were changed.",
    );
  const added = [];
  try {
    for (const n of incoming) {
      if (n.photos.length) {
        await writePhotos(n.entry.id, n.photos);
        added.push(n.entry.id);
      }
    }
    const next = [...incoming.map((n) => n.entry), ...notes];
    if (!commit(next))
      throw Error("Browser storage could not save the imported notebook.");
    return { notes: next, added: incoming.length };
  } catch (error) {
    await Promise.allSettled(added.map(removePhotos));
    throw error;
  }
}
