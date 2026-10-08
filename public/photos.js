// Field evidence stays in this browser. Converting through canvas removes file metadata.
const DB_NAME = "outsideclass-photos-v1";
const STORE = "photos";
export const MAX_PHOTOS = 2;

function database() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in globalThis))
      return reject(Error("This browser cannot store photos locally."));
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onblocked = () =>
      reject(
        Error(
          "Close other OutsideClass tabs, then reopen this card to load photos.",
        ),
      );
    request.onerror = () =>
      reject(Error("Photo storage is unavailable in this browser."));
  });
}
async function transact(id, method, value) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(
      STORE,
      method === "get" ? "readonly" : "readwrite",
    );
    const request =
      method === "put"
        ? tx.objectStore(STORE).put(value, id)
        : tx.objectStore(STORE)[method](id);
    let result;
    request.onsuccess = () => {
      result = request.result;
    };
    tx.oncomplete = () => {
      resolve(method === "get" ? result || [] : undefined);
      db.close();
    };
    const fail = () => {
      db.close();
      reject(
        Error(
          method === "get"
            ? "Could not load saved photos. Reopen this card to retry."
            : "Could not save the photo. Browser storage may be full.",
        ),
      );
    };
    tx.onerror = fail;
    tx.onabort = fail;
  });
}
export const readPhotos = (id) => transact(id, "get");
export const writePhotos = (id, photos) => transact(id, "put", photos);
export const removePhotos = (id) => transact(id, "delete");

export async function shrinkPhoto(file) {
  if (
    !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(
      file.type,
    ) ||
    file.size > 12 * 1024 * 1024
  )
    throw Error("Choose a PNG, JPEG, WebP or GIF smaller than 12 MB.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(
      1,
      1200 / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.72),
    );
    if (!blob || blob.size > 600 * 1024)
      throw Error(
        "This image could not be compressed enough. Try a smaller image.",
      );
    return blob;
  } catch (error) {
    if (error.name === "EncodingError")
      throw Error("This image could not be opened.");
    throw error;
  } finally {
    URL.revokeObjectURL(url);
  }
}
