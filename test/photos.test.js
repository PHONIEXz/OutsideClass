import { test } from "node:test";
import assert from "node:assert/strict";
import { readPhotos, writePhotos } from "../public/photos.js";

function databaseMock() {
  const request = {},
    tx = {},
    operation = {};
  let closed = false;
  globalThis.indexedDB = {
    open() {
      queueMicrotask(() => request.onsuccess());
      return request;
    },
  };
  request.result = {
    transaction() {
      return tx;
    },
    close() {
      closed = true;
    },
  };
  tx.objectStore = () => ({ get: () => operation, put: () => operation });
  return { tx, operation, closed: () => closed };
}
test("photo reads wait for a committed transaction and reject an abort", async () => {
  const original = globalThis.indexedDB,
    mock = databaseMock();
  try {
    let settled = false;
    const read = readPhotos("card");
    read.then(
      () => {
        settled = true;
      },
      () => {},
    );
    await Promise.resolve();
    await Promise.resolve();
    mock.operation.result = ["photo"];
    mock.operation.onsuccess();
    await Promise.resolve();
    assert.equal(settled, false);
    mock.tx.onabort();
    await assert.rejects(read, /Could not load saved photos/);
    assert.equal(mock.closed(), true);
  } finally {
    if (original === undefined) delete globalThis.indexedDB;
    else globalThis.indexedDB = original;
  }
});
test("aborted photo writes report failure instead of hanging", async () => {
  const original = globalThis.indexedDB,
    mock = databaseMock();
  try {
    const write = writePhotos("card", []);
    await Promise.resolve();
    await Promise.resolve();
    mock.tx.onabort();
    await assert.rejects(write, /Could not save the photo/);
    assert.equal(mock.closed(), true);
  } finally {
    if (original === undefined) delete globalThis.indexedDB;
    else globalThis.indexedDB = original;
  }
});
