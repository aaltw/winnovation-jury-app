// Minimal prod server: static files + SPA fallback + /api proxy (strips prefix).
import { createServer, request as httpRequest } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const ROOT = process.argv[2];
const PORT = Number(process.env.PORT ?? 4300);
const API = { host: "localhost", port: 8787 };

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

createServer((req, res) => {
  if (req.url.startsWith("/api/") || req.url === "/api") {
    const path = req.url.replace(/^\/api\/?/, "/");
    const proxy = httpRequest(
      {
        ...API,
        path,
        method: req.method,
        headers: { ...req.headers, host: `${API.host}:${API.port}` },
      },
      (up) => {
        res.writeHead(up.statusCode, up.headers);
        up.pipe(res);
      },
    );
    proxy.on("error", () => {
      res.writeHead(502);
      res.end("sync-api unreachable");
    });
    req.pipe(proxy);
    return;
  }
  let file = normalize(join(ROOT, req.url.split("?")[0]));
  if (!file.startsWith(ROOT) || !existsSync(file) || statSync(file).isDirectory()) {
    file = join(ROOT, "index.html");
  }
  res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(res);
}).listen(PORT, "0.0.0.0", () =>
  console.log(`prod server on :${PORT} → ${ROOT}, /api → :${API.port}`),
);
