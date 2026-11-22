const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const mimeTypes = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8"
};

const studioPreview = process.argv.includes('--studio');
const studioFiles = new Set([
  "index.html",
  "audio-engine.js",
  "game-state.js",
  "game-ui.js",
  "storage.js",
  "styles.css",
  "words.js"
]);

http.createServer((request, response) => {
    const pathname = new URL(request.url, "http://127.0.0.1").pathname;
    const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
    const filename = path.resolve(root, relativePath);
    if (!filename.startsWith(`${root}${path.sep}`)) {
        response.writeHead(403).end("Forbidden");
        return;
    }
    if (studioPreview && !studioFiles.has(relativePath)) {
      response.writeHead(404).end();
      return;
    }
    fs.readFile(filename, (error, content) => {
        if (error) {
            response.writeHead(404).end("Not found");
            return;
        }
        response.writeHead(200, {
            "content-type": mimeTypes[path.extname(filename)]
                || "application/octet-stream",
            "cache-control": "no-store"
        });
        response.end(content);
    });
}).listen(studioPreview ? Number(process.env.PORT || 3000) : 4173, studioPreview ? "0.0.0.0" : "127.0.0.1");
