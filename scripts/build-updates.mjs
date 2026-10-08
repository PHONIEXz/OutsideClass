import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const origin = "https://outsideclass-phoenix.vercel.app";
const esc = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );

export function validatePosts(posts) {
  if (!Array.isArray(posts) || !posts.length)
    throw Error("Publish at least one update.");
  const ids = new Set();
  for (const post of posts) {
    if (
      !post ||
      typeof post.id !== "string" ||
      !/^[a-z0-9-]+$/.test(post.id) ||
      ids.has(post.id)
    )
      throw Error("Update IDs must be unique safe slugs.");
    ids.add(post.id);
    if (!["Product", "Fixes", "Learning tips"].includes(post.category))
      throw Error("Invalid update category.");
    if (
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(post.publishedAt) ||
      !Number.isFinite(Date.parse(post.publishedAt)) ||
      new Date(post.publishedAt).toISOString().replace(".000Z", "Z") !==
        post.publishedAt
    )
      throw Error("Use a valid UTC publication date.");
    for (const field of ["title", "summary"])
      if (typeof post[field] !== "string" || !post[field].trim())
        throw Error("Updates need a title and summary.");
    if (
      !Array.isArray(post.body) ||
      post.body.some((p) => typeof p !== "string" || !p.trim())
    )
      throw Error("Update body must contain paragraphs.");
    if (
      post.action &&
      (!["/learn", "/notebook", "/guides", "/updates"].includes(
        post.action.path,
      ) ||
        typeof post.action.label !== "string" ||
        !post.action.label.trim())
    )
      throw Error("Update actions must link to an app page.");
  }
  return posts
    .slice()
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}

export function renderFeed(posts) {
  const ordered = validatePosts(posts);
  const html = ordered
    .map((post) => {
      const date = new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(post.publishedAt));
      return `<article class="release" id="${post.id}" data-category="${post.category}" tabindex="-1"><div class="release-meta"><span class="tag">${post.category}</span><time datetime="${post.publishedAt}">${date}</time></div><h2><a href="/updates#${post.id}">${esc(post.title)}</a></h2><p>${esc(post.summary)}</p>${post.body.length ? `<details><summary>Read the full update</summary>${post.body.map((paragraph) => `<p>${esc(paragraph)}</p>`).join("")}</details>` : ""}<div class="actions">${post.action ? `<a class="text-link" href="${post.action.path}" data-page="${{ "/learn": "builder", "/notebook": "notebook", "/guides": "guides", "/updates": "updates" }[post.action.path]}">${esc(post.action.label)} →</a>` : ""}<button type="button" class="secondary" data-copy-update="${post.id}">Copy link</button></div></article>`;
    })
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>OutsideClass updates</title><link>${origin}/updates</link><description>Product news, fixes and learning tips from OutsideClass.</description><language>en</language><atom:link href="${origin}/updates.xml" rel="self" type="application/rss+xml"/><lastBuildDate>${new Date(ordered[0].publishedAt).toUTCString()}</lastBuildDate>${ordered.map((post) => `<item><title>${esc(post.title)}</title><link>${origin}/updates#${post.id}</link><guid isPermaLink="false">${post.id}</guid><pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate><category>${post.category}</category><description>${esc([post.summary, ...post.body].join("\n\n"))}</description></item>`).join("")}</channel></rss>\n`;
  return { html, xml };
}

export async function buildUpdates() {
  const root = new URL("../", import.meta.url);
  const posts = JSON.parse(
    await readFile(new URL("public/updates.json", root), "utf8"),
  );
  const { html, xml } = renderFeed(posts);
  const path = new URL("public/index.html", root);
  const page = await readFile(path, "utf8");
  const pattern = /<!-- UPDATES_START -->[\s\S]*?<!-- UPDATES_END -->/;
  if (!pattern.test(page)) throw Error("Updates page markers are missing.");
  await writeFile(
    path,
    page.replace(
      pattern,
      () => `<!-- UPDATES_START -->\n${html}\n<!-- UPDATES_END -->`,
    ),
  );
  await writeFile(new URL("public/updates.xml", root), xml);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await buildUpdates();
