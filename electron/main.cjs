const { app, BrowserWindow, ipcMain, session } = require("electron");
const path = require("node:path");

const isDev = !app.isPackaged;

// Per-popup state tracked outside the did-create-window closure so the
// ipcMain handler (which is not in that closure) can read and write it.
// Keyed by the popup BrowserWindow; garbage-collected when the window is GC'd.
const popupStateMap = new WeakMap();

// Reads all non-LB cookies for workshop.cfg.deloitte.com from the Electron
// session and registers a webRequest interceptor that injects them into every
// proxied /Monolith request.  The Vite proxy then forwards them to the
// production SEMOSS server so subsequent auth API calls are authenticated.
async function injectSessionCookies() {
	try {
		const allCookies = await session.defaultSession.cookies.get({
			domain: "workshop.cfg.deloitte.com",
		});
		console.log(
			"[OAuth] Cookies for workshop.cfg.deloitte.com:",
			allCookies
				.map((c) => `${c.name}(path:${c.path})`)
				.join(", ") || "(none)",
		);

		// Exclude GCP load-balancer routing cookies; keep session cookies.
		const sessionCookies = allCookies.filter(
			(c) => !c.name.startsWith("gcplb"),
		);

		if (sessionCookies.length > 0) {
			const cookieHeader = sessionCookies
				.map((c) => `${c.name}=${c.value}`)
				.join("; ");

			session.defaultSession.webRequest.onBeforeSendHeaders(
				{ urls: ["http://localhost:5173/Monolith/*"] },
				(reqDetails, callback) => {
					const existing =
						reqDetails.requestHeaders["Cookie"] || "";
					callback({
						requestHeaders: {
							...reqDetails.requestHeaders,
							Cookie: [existing, cookieHeader]
								.filter(Boolean)
								.join("; "),
						},
					});
				},
			);
			console.log(
				"[OAuth] Injecting session cookies:",
				sessionCookies.map((c) => c.name).join(", "),
			);
			return true;
		}

		console.log("[OAuth] No session cookies found");
		return false;
	} catch (e) {
		console.error("[OAuth] Cookie injection error:", e.message);
		return false;
	}
}

function createWindow() {
	const win = new BrowserWindow({
		width: 1400,
		height: 900,
		webPreferences: {
			preload: path.join(__dirname, "preload.cjs"),
			contextIsolation: true,
			nodeIntegration: false,
		},
	});

	if (isDev) {
		win.loadURL("http://localhost:5173");
		win.webContents.openDevTools();
	} else {
		win.loadFile(path.join(__dirname, "../dist/index.html"));
	}

	// OAuth popup handling.
	//
	// Root cause: contextIsolation:true sets window.opener = null in any popup
	// created by window.open().  The SEMOSS frontend at the OAuth callback
	// destination calls window.opener.postMessage(data, '*') to signal auth
	// success.  With opener = null, the call silently fails and the SDK's
	// actions.login() promise never resolves.
	//
	// Fix:
	//  1. Attach oauth-popup-preload.cjs to every popup.  That preload runs
	//     with contextIsolation:false so it can patch window.opener directly
	//     before any page scripts execute.  Calls to window.opener.postMessage()
	//     are forwarded via IPC to the main process.
	//  2. The main process (ipcMain handler below) injects the production
	//     session cookies into subsequent /Monolith proxy requests, then relays
	//     the data to the parent window via 'oauth-popup-message' IPC.
	//  3. The parent window (preload.cjs + App.tsx) dispatches a synthetic
	//     MessageEvent so the SDK's existing message listener handles auth
	//     completion and resolves the login promise normally.
	//  4. The popup is closed immediately (300 ms after relay) from the IPC
	//     handler.  A 5-second settle timer closes it as a fallback if the
	//     postMessage path never fires; in that case a full page reload is
	//     triggered so the InsightProvider re-checks auth with injected cookies.
	win.webContents.setWindowOpenHandler(({ url }) => {
		console.log("[OAuth] Allowing popup:", url);
		return {
			action: "allow",
			overrideBrowserWindowOptions: {
				webPreferences: {
					// contextIsolation:false lets the preload patch window.opener
					// directly in the page's JS context before scripts run.
					contextIsolation: false,
					nodeIntegration: false,
					preload: path.join(__dirname, "oauth-popup-preload.cjs"),
				},
			},
		};
	});

	// Relay postMessage data from the popup to the parent window.
	// The oauth-popup-preload.cjs sends 'oauth-popup-message' when the SEMOSS
	// frontend calls window.opener.postMessage(data, '*').
	// payload = { data: <sdk-auth-data>, sourceOrigin: 'https://workshop.cfg.deloitte.com' }
	ipcMain.on("oauth-popup-message", async (event, payload) => {
		console.log("[OAuth] Received postMessage from popup via IPC");

		// Mark this popup as having sent the message so the closed-event
		// handler does not emit oauth-cancelled.
		const popupWin = BrowserWindow.fromWebContents(event.sender);
		if (popupWin) {
			const state = popupStateMap.get(popupWin);
			if (state) state.postMessageReceived = true;
		}

		// Inject cookies before relaying so the SDK's immediate follow-up
		// userinfo call is authenticated when the proxy forwards it.
		await injectSessionCookies();

		console.log("[OAuth] Relaying postMessage to parent window");
		win.webContents.send("oauth-popup-message", payload);

		// Close the popup after a brief pause (gives the SDK time to start
		// the userinfo call before teardown).
		if (popupWin && !popupWin.isDestroyed()) {
			setTimeout(() => {
				if (!popupWin.isDestroyed()) popupWin.close();
			}, 300);
		}
	});

	// Settle-timer fallback: close the popup once it stops navigating after the
	// OAuth code exchange.  This handles the case where the postMessage path
	// never fires.  If no postMessage was received we also inject cookies and
	// reload the parent window so the InsightProvider can re-check auth state.
	win.webContents.on("did-create-window", (childWin, details) => {
		console.log("[OAuth] Popup created:", details.url);

		// Open DevTools on the popup in dev mode to make preload logs visible.
		if (isDev) childWin.webContents.openDevTools();

		const state = { postMessageReceived: false };
		popupStateMap.set(childWin, state);

		let initialOrigin = null;
		let hasLeftInitialOrigin = false;
		let codeExchangeSeen = false;
		let triggered = false;
		let settleTimer = null;

		if (details.url && details.url !== "about:blank") {
			try {
				initialOrigin = new URL(details.url).origin;
			} catch (_) {}
		}

		const closePopup = () => {
			if (triggered) return;
			triggered = true;

			if (state.postMessageReceived) {
				// postMessage was already handled — just close.
				console.log(
					"[OAuth] Settle timer fired (postMessage already handled) — closing popup",
				);
				if (!childWin.isDestroyed()) childWin.close();
			} else {
				// postMessage never arrived — inject cookies and reload the
				// parent window so InsightProvider re-checks auth state.
				console.log(
					"[OAuth] Settle timer fired without postMessage — injecting cookies and reloading parent",
				);
				injectSessionCookies().then(() => {
					if (!childWin.isDestroyed()) childWin.close();
					win.webContents.reload();
				});
			}
		};

		const resetSettleTimer = () => {
			if (settleTimer) clearTimeout(settleTimer);
			// 5 seconds gives the SemossWeb page time to exchange the auth
			// code (a server-side round-trip) and call window.opener.postMessage.
			// The reload fallback in the closed-event handler covers any remaining
			// cases where postMessage doesn't fire within this window.
			settleTimer = setTimeout(closePopup, 5000);
		};

		const check = (label, urlString) => {
			if (triggered) return;
			if (!urlString || urlString === "about:blank") return;

			let parsed;
			try {
				parsed = new URL(urlString);
			} catch (_) {
				return;
			}

			const origin = parsed.origin;
			console.log(`[OAuth] ${label}: ${urlString}`);

			if (!initialOrigin) {
				initialOrigin = origin;
				return;
			}

			if (origin !== initialOrigin) hasLeftInitialOrigin = true;

			if (
				hasLeftInitialOrigin &&
				!codeExchangeSeen &&
				parsed.searchParams.has("code") &&
				parsed.searchParams.has("state")
			) {
				codeExchangeSeen = true;
				console.log("[OAuth] Auth code callback detected");
			}

			if (codeExchangeSeen) resetSettleTimer();
		};

		childWin.webContents.on("did-navigate", (_e, url) =>
			check("did-navigate", url),
		);
		childWin.webContents.on("will-redirect", (_e, url) =>
			check("will-redirect", url),
		);

		childWin.on("closed", () => {
			if (settleTimer) clearTimeout(settleTimer);

			if (state.postMessageReceived) {
				// postMessage was relayed.  The SDK's message listener may reject
				// our synthetic event (e.g. event.source !== popup check).  Reload
				// the parent so InsightProvider re-initialises and confirms auth via
				// the injected cfg-ai-dev session cookie — the reliable path.
				// 2-second delay gives the SDK a head-start in case it does process
				// the message successfully on its own.
				console.log("[OAuth] Popup closed after relay — reloading parent in 2 s");
				setTimeout(() => {
					if (!win.isDestroyed()) win.webContents.reload();
				}, 2000);
			} else if (!triggered) {
				// User manually closed the popup before auth completed.
				win.webContents.send("oauth-cancelled");
			}
			// triggered=true, postMessageReceived=false → settle timer already
			// injected cookies and triggered the reload inside closePopup().
		});
	});
}

app.whenReady().then(() => {
	createWindow();
	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") app.quit();
});
