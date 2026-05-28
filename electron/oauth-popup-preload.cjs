// Preload for OAuth popup windows.
//
// Runs with contextIsolation: false so it shares the page's JavaScript context
// and can directly patch window.opener before any page scripts execute.
//
// Problem: when the parent BrowserWindow has contextIsolation: true, Electron
// sets window.opener = null in all popup windows.  The SEMOSS SemossWeb page at
// the OAuth callback URL calls window.opener.postMessage(data, '*') to signal
// auth completion.  With opener = null the call throws, so the SDK's login
// promise never resolves.
//
// Fix: define a fake opener object whose postMessage method forwards the call
// (plus the popup's current origin) via IPC to the main process, which injects
// the session cookie, then relays the data to the parent window.  The parent
// reloads so InsightProvider can re-check auth with the injected cookie.
const { ipcRenderer } = require("electron");

console.log("[OAuth Popup Preload] Running");

const fakeOpener = {
	postMessage(data, targetOrigin) {
		console.log("[OAuth Popup Preload] postMessage intercepted →", typeof data, targetOrigin);
		// Include the popup's current origin so the parent can dispatch a
		// MessageEvent with the correct origin (the SEMOSS SDK checks event.origin).
		ipcRenderer.send("oauth-popup-message", {
			data,
			sourceOrigin: window.location.origin,
		});
	},
};

// Attempt 1: delete the null instance property so a prototype getter is
// visible, then define our own getter there.
let patched = false;
try {
	if (delete window.opener) {
		Object.defineProperty(Window.prototype, "opener", {
			configurable: true,
			get() { return fakeOpener; },
		});
		patched = true;
		console.log("[OAuth Popup Preload] opener patched via prototype defineProperty");
	}
} catch (_) {}

// Attempt 2: defineProperty directly on the window instance.
if (!patched) {
	try {
		Object.defineProperty(window, "opener", {
			configurable: true,
			get() { return fakeOpener; },
		});
		patched = true;
		console.log("[OAuth Popup Preload] opener patched via instance defineProperty");
	} catch (_) {}
}

// Attempt 3: direct assignment (works only when the property is writable).
if (!patched) {
	try {
		window.opener = fakeOpener;
		patched = true;
		console.log("[OAuth Popup Preload] opener patched via direct assignment");
	} catch (e) {
		console.error("[OAuth Popup Preload] all patching approaches failed:", e.message);
	}
}
