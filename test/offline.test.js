import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
const source = await readFile(
  new URL("../public/sw.js", import.meta.url),
  "utf8",
);
function worker() {
  const handlers = new Map(),
    stores = new Map(),
    deleted = [],
    timers = [];
  let network = async (req) =>
      new Response("online:" + new URL(req.url).pathname),
    putFails = false;
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const entries = stores.get(name);
      return {
        async addAll(paths) {
          for (const path of paths)
            entries.set(path, new Response("installed:" + path));
        },
        async put(path, response) {
          if (putFails) throw Error("quota");
          entries.set(path, response.clone());
        },
        async match(path) {
          return entries.get(path)?.clone();
        },
      };
    },
    async keys() {
      return [...stores.keys()];
    },
    async delete(name) {
      deleted.push(name);
      return stores.delete(name);
    },
  };
  let claimed = false;
  vm.runInNewContext(source, {
    self: {
      location: { origin: "https://outsideclass.test" },
      addEventListener: (name, handler) => handlers.set(name, handler),
      clients: {
        claim: async () => {
          claimed = true;
        },
      },
    },
    caches,
    fetch: (...args) => network(...args),
    URL,
    Response,
    AbortController,
    setTimeout: (fn) => {
      timers.push(fn);
      return timers.length;
    },
    clearTimeout() {},
  });
  const event = async (name) => {
    let pending;
    handlers.get(name)({
      waitUntil: (p) => {
        pending = p;
      },
    });
    await pending;
  };
  const request = (path, options = {}) => {
    let response;
    handlers.get("fetch")({
      request: {
        url: new URL(path, "https://outsideclass.test").href,
        method: "GET",
        ...options,
      },
      respondWith: (p) => {
        response = p;
      },
    });
    return response;
  };
  return {
    event,
    request,
    stores,
    deleted,
    timers,
    get claimed() {
      return claimed;
    },
    setNetwork: (fn) => {
      network = fn;
    },
    failWrites: () => {
      putFails = true;
    },
  };
}
test("offline installation includes every page and imported browser module", async () => {
  const w = worker();
  await w.event("install");
  const cache = [...w.stores.values()][0];
  for (const path of [
    "/",
    "/app.js",
    "/photos.js",
    "/learning.js",
    "/notebook-tools.js",
    "/diagrams.js",
    "/samples.js",
    "/safety.js",
    "/style.css",
  ])
    assert.ok(cache.has(path), path);
  w.setNetwork(async () => {
    throw Error("offline");
  });
  for (const path of [
    "/",
    "/learn",
    "/notebook",
    "/guides",
    "/updates",
    "/activity",
  ])
    assert.equal(await (await w.request(path)).text(), "installed:/");
});
test("successful visits refresh cached content and versioned icons work offline", async () => {
  const w = worker();
  await w.event("install");
  assert.equal(await (await w.request("/learn")).text(), "online:/learn");
  assert.equal(
    await (await w.request("/outsideclass-logo.png?v=2")).text(),
    "online:/outsideclass-logo.png",
  );
  w.setNetwork(async () => {
    throw Error("offline");
  });
  assert.equal(await (await w.request("/learn")).text(), "online:/learn");
  assert.equal(
    await (await w.request("/outsideclass-logo.png?v=2")).text(),
    "online:/outsideclass-logo.png",
  );
});
test("API calls, external references and unrecognised paths never enter the offline cache", async () => {
  const w = worker();
  await w.event("install");
  for (const [path, options] of [
    ["/api/activity", {}],
    ["/learn", { method: "POST" }],
    ["https://example.com/learn", {}],
    ["/private", {}],
  ])
    assert.equal(w.request(path, options), undefined);
});
test("provider errors and stalled connections cannot destroy cached pages", async () => {
  const w = worker();
  await w.event("install");
  w.setNetwork(async () => new Response("server error", { status: 500 }));
  assert.equal(await (await w.request("/learn")).text(), "installed:/");
  w.setNetwork(
    (req, { signal }) =>
      new Promise((resolve, reject) =>
        signal.addEventListener("abort", () => reject(Error("timeout"))),
      ),
  );
  const pending = w.request("/learn");
  w.timers.at(-1)();
  assert.equal(await (await pending).text(), "installed:/");
});
test("cache write failure cannot break an online lesson and an empty offline cache gives an honest response", async () => {
  const w = worker();
  await w.event("install");
  w.failWrites();
  assert.equal(await (await w.request("/learn")).text(), "online:/learn");
  const empty = worker();
  empty.setNetwork(async () => {
    throw Error("offline");
  });
  const response = await empty.request("/learn");
  assert.equal(response.status, 503);
  assert.match(await response.text(), /Reconnect/);
});
test("worker activation removes only obsolete OutsideClass caches", async () => {
  const w = worker();
  w.stores.set("outsideclass-old", new Map());
  w.stores.set("other-application", new Map());
  await w.event("install");
  await w.event("activate");
  assert.deepEqual(w.deleted, ["outsideclass-old"]);
  assert.ok(w.stores.has("other-application"));
  assert.equal(w.claimed, true);
});
