const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const mimeTypes = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8"
};

http.createServer((request, response) => {
    const pathname = new URL(request.url, "http://127.0.0.1").pathname;
    const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
    const filename = path.resolve(root, relativePath);
    if (!filename.startsWith(`${root}${path.sep}`)) {
        response.writeHead(403).end("Forbidden");
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
}).listen(4173, "127.0.0.1");
