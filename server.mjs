import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scanPhotos, writePhotosJson } from "./scan-photos.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 3456;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".bmp": "image/bmp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(body);
}

function safeJoin(root, requestPath) {
  const decoded = decodeURIComponent(requestPath.split("?")[0]);
  const cleaned = path.normalize(decoded).replace(/^([/\\])+/, "");
  const full = path.join(root, cleaned);
  if (!full.startsWith(root)) return null;
  return full;
}

function serveFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || "application/octet-stream";
  const stream = fs.createReadStream(filePath);
  res.writeHead(200, {
    "Content-Type": type,
    "Cache-Control": ext.match(/\.(jpe?g|png|gif|webp|avif)$/)
      ? "public, max-age=86400"
      : "no-cache",
  });
  stream.pipe(res);
  stream.on("error", () => {
    if (!res.headersSent) {
      res.writeHead(500);
      res.end("Erreur lecture fichier");
    }
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/api/photos") {
    try {
      const data = scanPhotos(ROOT);
      writePhotosJson(ROOT, data);
      sendJson(res, 200, data);
    } catch (err) {
      sendJson(res, 500, { error: String(err && err.message), albums: [] });
    }
    return;
  }

  let reqPath = url.pathname;
  if (reqPath === "/") reqPath = "/index.html";

  const filePath = safeJoin(ROOT, reqPath);
  if (!filePath) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    serveFile(res, filePath);
  });
});

server.listen(PORT, () => {
  const data = scanPhotos(ROOT);
  writePhotosJson(ROOT, data);
  const total = data.albums.reduce((n, a) => n + a.photos.length, 0);
  console.log(`Ankara 2026 → http://localhost:${PORT}`);
  console.log(`Albums détectés : ${data.albums.length} · Photos : ${total}`);
  console.log(`API live : http://localhost:${PORT}/api/photos`);
});
