import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { renderFeed, validatePosts } from "../scripts/build-updates.mjs";
import { matchesUpdate } from "../public/feed.js";
const posts = JSON.parse(
  await readFile(new URL("../public/updates.json", import.meta.url), "utf8"),
);

test("category and search filters work together with case-insensitive full-post search", () => {
  const post = {
    category: "Learning tips",
    text: "Rainy day: keep the window closed.",
  };
  assert.equal(matchesUpdate(post, "All updates", " WINDOW "), true);
  assert.equal(matchesUpdate(post, "Learning tips", "rainy"), true);
  assert.equal(matchesUpdate(post, "Fixes", "rainy"), false);
  assert.equal(matchesUpdate(post, "All updates", "unknown"), false);
});

test("website and RSS include the same ordered posts and exact permalink IDs", async () => {
  const { html, xml } = renderFeed(posts);
  const page = await readFile(
    new URL("../public/index.html", import.meta.url),
    "utf8",
  );
  const published = await readFile(
    new URL("../public/updates.xml", import.meta.url),
    "utf8",
  );
  assert.equal(
    xml,
    published,
    "Run npm run updates before committing changed posts",
  );
  assert.equal((xml.match(/<item>/g) || []).length, posts.length);
  for (const post of posts) {
    assert.ok(html.includes(`id="${post.id}"`));
    assert.ok(page.includes(`id="${post.id}"`));
    assert.ok(xml.includes(`/updates#${post.id}</link>`));
    assert.ok(xml.includes(`<guid isPermaLink="false">${post.id}</guid>`));
  }
  const ids = validatePosts(posts).map((post) => post.id);
  assert.ok(
    html.indexOf(`id="${ids[0]}"`) < html.indexOf(`id="${ids.at(-1)}"`),
  );
});

test("published HTML and XML escape text including closing-tag and markup attempts", () => {
  const post = {
    ...posts[0],
    title: '<script>"&',
    summary: "</description><script>$&",
    body: ["<img src=x> & 'text'"],
  };
  const { html, xml } = renderFeed([post]);
  assert.ok(!html.includes("<script>"));
  assert.ok(!xml.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;&quot;&amp;"));
  assert.ok(xml.includes("&lt;/description&gt;&lt;script&gt;$&amp;"));
});

test("duplicate IDs, impossible dates and external action links cannot be published", () => {
  assert.throws(() => validatePosts([posts[0], posts[0]]), /unique/);
  assert.throws(
    () => validatePosts([{ ...posts[0], id: '"onclick="x' }]),
    /slugs/,
  );
  assert.throws(
    () => validatePosts([{ ...posts[0], publishedAt: "2026-02-31T00:00:00Z" }]),
    /date/,
  );
  assert.throws(
    () =>
      validatePosts([
        { ...posts[0], action: { label: "Open", path: "javascript:alert(1)" } },
      ]),
    /app page/,
  );
});

test("existing subscriber GUIDs remain stable across the feed rebuild", () => {
  for (const id of [
    "outsideclass-local-profile-20261008",
    "outsideclass-web-recovery-20261008",
    "outsideclass-learning-workspace-20261007",
    "outsideclass-freeform-questions-20261007",
    "outsideclass-diagrams-uploads-20261007",
    "outsideclass-evidence-trails-20261007",
    "outsideclass-pages-timer-20261007",
    "outsideclass-reflections-20261007",
  ])
    assert.ok(posts.some((post) => post.id === id));
});
