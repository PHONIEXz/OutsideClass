import http from "node:http";
import { readFile } from "node:fs/promises";
import handler from "./api/activity.js";
const files = {
  "/": "index.html",
  "/learn": "index.html",
  "/notebook": "index.html",
  "/guides": "index.html",
  "/updates": "index.html",
  "/activity": "index.html",
  "/updates.xml": "updates.xml",
  "/app.js": "app.js",
  "/style.css": "style.css",
  "/sw.js": "sw.js",
  "/learning.js": "learning.js",
  "/profile.js": "profile.js",
  "/feed.js": "feed.js",
  "/notebook-tools.js": "notebook-tools.js",
  "/diagrams.js": "diagrams.js",
  "/photos.js": "photos.js",
  "/samples.js": "samples.js",
  "/safety.js": "safety.js",
  "/outsideclass-logo.png": "outsideclass-logo.png",
};
http
  .createServer(async (req, res) => {
    res.status = (n) => {
      res.statusCode = n;
      return res;
    };
    res.json = (x) => {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(x));
    };
    const path = new URL(req.url, "http://localhost").pathname;
    if (path === "/api/activity") {
      let body = "";
      try {
        for await (const chunk of req) {
          body += chunk;
          if (body.length > 2 * 1024 * 1024)
            return res.status(413).json({ error: "Request too large." });
        }
        req.body = JSON.parse(body || "{}");
        return await handler(req, res);
      } catch {
        return res.status(400).json({ error: "Invalid JSON." });
      }
    }
    if (!files[path]) {
      res.writeHead(404);
      return res.end("Not found");
    }
    try {
      res.setHeader(
        "Content-Type",
        path.endsWith(".xml")
          ? "application/rss+xml"
          : path.endsWith(".png")
            ? "image/png"
            : path.endsWith(".js")
              ? "text/javascript"
              : path.endsWith(".css")
                ? "text/css"
                : "text/html",
      );
      res.end(
        await readFile(new URL(`public/${files[path]}`, import.meta.url)),
      );
    } catch {
      res.writeHead(500);
      res.end("Unable to load page");
    }
  })
  .listen(3000, "127.0.0.1", () =>
    console.log("OutsideClass: http://localhost:3000"),
  );
