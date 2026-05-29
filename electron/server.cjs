// Production replacement for the Vite dev-server proxy.
//
// In dev, the renderer is served by Vite at http://localhost:5173, which also
// proxies the SDK's relative `/Monolith` API calls (and the OAuth login
// redirect) to the SEMOSS backend.  Packaged builds have no Vite server, so
// this module starts an equivalent local server that:
//   1. serves the built renderer from dist/ over http://localhost:<port>, so
//      the SDK's relative URLs and same-origin cookie / postMessage checks
//      behave exactly as they do in dev; and
//   2. forwards every `/Monolith` request — HTTP and the insightSocket
//      WebSocket upgrade — to the SEMOSS endpoint.
//
// The port is ephemeral; main.cjs reads it back and points the BrowserWindow
// (and the session-cookie injection filter) at it.

const http = require("node:http");
const https = require("node:https");
const fs = require("node:fs");
const path = require("node:path");

const MIME = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".mjs": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".svg": "image/svg+xml",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".ico": "image/x-icon",
	".webp": "image/webp",
	".woff": "font/woff",
	".woff2": "font/woff2",
	".ttf": "font/ttf",
	".map": "application/json; charset=utf-8",
	".txt": "text/plain; charset=utf-8",
};

// Starts the local server.  Resolves with { server, port }.
//   distDir            absolute path to the built renderer (dist/)
//   endpoint           SEMOSS base URL, e.g. https://host/cfg-ai-dev/
//   module             API path prefix to proxy, e.g. /Monolith
//   getUpstreamCookies optional async () => "name=value; ..." injected into the
//                      WebSocket upgrade (HTTP requests get cookies injected
//                      upstream of here, via the main process's webRequest hook)
function startProductionServer({ distDir, endpoint, module: modulePath, getUpstreamCookies }) {
	const target = new URL(endpoint);
	// e.g. "/cfg-ai-dev" — prepended to the renderer's "/Monolith/..." path so
	// the upstream URL matches what the Vite proxy produces (target path + req path).
	const targetBasePath = target.pathname.replace(/\/+$/, "");
	const transport = target.protocol === "https:" ? https : http;
	const upstreamPort = target.port || (target.protocol === "https:" ? 443 : 80);

	const isApiRequest = (url) => (url || "").startsWith(modulePath);

	const upstreamOptions = (req, headers) => ({
		protocol: target.protocol,
		hostname: target.hostname,
		port: upstreamPort,
		method: req.method,
		path: targetBasePath + req.url,
		headers: { ...headers, host: target.host },
		rejectUnauthorized: false, // matches Vite's `secure: false`
	});

	// --- HTTP proxy: forward /Monolith requests upstream ---------------------
	function proxyHttp(req, res) {
		const proxyReq = transport.request(upstreamOptions(req, req.headers), (proxyRes) => {
			res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
			proxyRes.pipe(res);
		});
		proxyReq.on("error", (err) => {
			console.error("[Server] Upstream error:", err.message);
			if (!res.headersSent) res.writeHead(502);
			res.end("Bad Gateway");
		});
		req.pipe(proxyReq);
	}

	// --- Static file serving for the built renderer --------------------------
	function serveStatic(req, res) {
		let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
		if (urlPath === "/") urlPath = "/index.html";

		const filePath = path.join(distDir, urlPath);
		// Prevent path traversal outside distDir.
		if (filePath !== distDir && !filePath.startsWith(distDir + path.sep)) {
			res.writeHead(403);
			res.end("Forbidden");
			return;
		}

		fs.readFile(filePath, (err, data) => {
			if (err) {
				// SPA fallback: serve index.html for client-side routes.
				fs.readFile(path.join(distDir, "index.html"), (fallbackErr, html) => {
					if (fallbackErr) {
						res.writeHead(404);
						res.end("Not Found");
						return;
					}
					res.writeHead(200, { "Content-Type": MIME[".html"] });
					res.end(html);
				});
				return;
			}
			const ext = path.extname(filePath).toLowerCase();
			res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
			res.end(data);
		});
	}

	const server = http.createServer((req, res) => {
		if (isApiRequest(req.url)) proxyHttp(req, res);
		else serveStatic(req, res);
	});

	// --- WebSocket proxy: forward the SDK's insightSocket upgrade upstream ----
	server.on("upgrade", async (req, clientSocket, head) => {
		if (!isApiRequest(req.url)) {
			clientSocket.destroy();
			return;
		}

		const headers = { ...req.headers };
		if (getUpstreamCookies) {
			try {
				const cookie = await getUpstreamCookies();
				if (cookie) {
					headers.cookie = [req.headers.cookie, cookie].filter(Boolean).join("; ");
				}
			} catch (_) {
				// fall through with whatever cookies the request already carried
			}
		}

		const proxyReq = transport.request(upstreamOptions(req, headers));

		proxyReq.on("upgrade", (proxyRes, upstreamSocket, upstreamHead) => {
			const lines = [`HTTP/1.1 ${proxyRes.statusCode} ${proxyRes.statusMessage}`];
			for (const [key, value] of Object.entries(proxyRes.headers)) {
				lines.push(`${key}: ${value}`);
			}
			clientSocket.write(lines.join("\r\n") + "\r\n\r\n");

			if (upstreamHead && upstreamHead.length) upstreamSocket.unshift(upstreamHead);
			if (head && head.length) upstreamSocket.write(head);

			upstreamSocket.pipe(clientSocket);
			clientSocket.pipe(upstreamSocket);

			const teardown = () => {
				upstreamSocket.destroy();
				clientSocket.destroy();
			};
			upstreamSocket.on("error", teardown);
			clientSocket.on("error", teardown);
		});

		proxyReq.on("error", (err) => {
			console.error("[Server] WebSocket upstream error:", err.message);
			clientSocket.destroy();
		});

		proxyReq.end();
	});

	return new Promise((resolve) => {
		// Loopback only — never exposed on the network.
		server.listen(0, "127.0.0.1", () => {
			const { port } = server.address();
			console.log(`[Server] Production server on http://localhost:${port} -> ${endpoint}`);
			resolve({ server, port });
		});
	});
}

module.exports = { startProductionServer };
