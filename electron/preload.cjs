const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
	// Fired when the OAuth popup's postMessage call is captured and relayed here.
	// Payload is { data, sourceOrigin } — the data from window.opener.postMessage
	// and the origin of the popup window at the time of the call.
	// App.tsx dispatches a synthetic MessageEvent with the correct origin so the
	// SDK's built-in message handler resolves the actions.login() promise.
	onOauthPopupMessage: (callback) => {
		const listener = (_event, payload) => callback(payload);
		ipcRenderer.on("oauth-popup-message", listener);
		return () => ipcRenderer.removeListener("oauth-popup-message", listener);
	},

	// Fired when the user manually closes the OAuth popup before completing auth.
	onOauthCancelled: (callback) => {
		const listener = () => callback();
		ipcRenderer.on("oauth-cancelled", listener);
		return () => ipcRenderer.removeListener("oauth-cancelled", listener);
	},

	// Locate / detect / view local AI-tool config files (Codex, later Claude &
	// Copilot).  Request-response over IPC; the main process resolves all paths
	// from the descriptor registry, so the renderer only ever passes a targetId
	// (+ optional fileKey).  See electron/ideConfig/.
	ideConfig: {
		listTargets: () => ipcRenderer.invoke("ide-config:list-targets"),
		detect: (targetId) =>
			ipcRenderer.invoke(
				"ide-config:detect",
				targetId ? { targetId } : undefined,
			),
		read: (targetId, fileKey) =>
			ipcRenderer.invoke("ide-config:read", { targetId, fileKey }),
	},
});
