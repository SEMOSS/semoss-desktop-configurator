// IPC surface for locating, detecting, and viewing local AI-tool config files.
//
// SECURITY: the renderer never sends a filesystem path.  It sends a `targetId`
// (+ an enumerated `fileKey`); the main process resolves the real path from the
// descriptor in registry.cjs.  There is no channel that accepts an arbitrary
// path — that resolution IS the allow-list.
//
// Channels (all ipcMain.handle / request-response):
//   ide-config:list-targets  -> IdeTargetMeta[]      (static metadata, no fs)
//   ide-config:detect        -> IdeDetectionResult[] (paths + statuses + install)
//   ide-config:read          -> { path, raw, exists, parsed?, parseError? }

const fs = require("node:fs/promises");
const { ipcMain } = require("electron");
const registry = require("./registry.cjs");

// Classify a single file/dir spec into a detection status.  Never throws —
// missing files and permission problems are first-class statuses, not errors.
async function classify(descriptor, spec) {
	let stat;
	try {
		stat = await fs.stat(spec.path);
	} catch (e) {
		if (e.code === "ENOENT")
			return { path: spec.path, status: "not-found", kind: spec.kind };
		if (e.code === "EACCES" || e.code === "EPERM")
			return {
				path: spec.path,
				status: "permission-error",
				error: e.message,
				kind: spec.kind,
			};
		return { path: spec.path, status: "error", error: e.message, kind: spec.kind };
	}

	if (spec.kind === "dir") {
		return {
			path: spec.path,
			kind: "dir",
			status: stat.isDirectory() ? "found" : "error",
		};
	}

	if (stat.size === 0) return { path: spec.path, status: "exists-empty" };

	let raw;
	try {
		raw = await fs.readFile(spec.path, "utf8");
	} catch (e) {
		if (e.code === "EACCES" || e.code === "EPERM")
			return { path: spec.path, status: "permission-error", error: e.message };
		return { path: spec.path, status: "error", error: e.message };
	}
	if (!raw.trim()) return { path: spec.path, status: "exists-empty" };

	// Validate the primary config by parsing it — but only if the descriptor has
	// a parser wired (added in the TOML hardening step).  Until then, an
	// existing, non-empty config counts as "found".
	if (spec.role === "config" && typeof descriptor.parse === "function") {
		try {
			descriptor.parse(raw);
		} catch (e) {
			return {
				path: spec.path,
				status: "parse-error",
				error: String((e && e.message) || e),
			};
		}
	}
	return { path: spec.path, status: "found" };
}

// Look up the file spec for a (target, fileKey) pair from the descriptor's
// resolved paths.  Returns null if the key isn't one this target declares.
function resolveSpec(descriptor, fileKey) {
	const paths = descriptor.resolvePaths();
	if (!fileKey || fileKey === paths.primary.key) return paths.primary;
	return paths.others.find((f) => f.key === fileKey) || null;
}

function registerIdeConfigHandlers() {
	// Static metadata only — safe to call before any filesystem access.
	ipcMain.handle("ide-config:list-targets", () =>
		registry.list().map((t) => ({
			id: t.id,
			displayName: t.displayName,
			capabilities: t.capabilities,
			format: t.format,
		})),
	);

	// Detect config status + installation for one or all targets.
	ipcMain.handle("ide-config:detect", async (_event, arg) => {
		const targets =
			arg && arg.targetId
				? [registry.get(arg.targetId)].filter(Boolean)
				: registry.list();

		return Promise.all(
			targets.map(async (t) => {
				const paths = t.resolvePaths();
				const [primary, installation, ...others] = await Promise.all([
					classify(t, paths.primary),
					typeof t.detectInstall === "function"
						? Promise.resolve()
								.then(() => t.detectInstall())
								.catch((e) => ({ status: "unknown", error: e.message }))
						: Promise.resolve({ status: "unknown" }),
					...paths.others.map((f) => classify(t, f)),
				]);
				return {
					targetId: t.id,
					displayName: t.displayName,
					capabilities: t.capabilities,
					format: t.format,
					installation,
					primary,
					others: others.map((o, i) => ({ key: paths.others[i].key, ...o })),
				};
			}),
		);
	});

	// Read a single file's raw contents (powers the "View" action).  For a
	// directory spec (e.g. the skills dir) we return a newline-joined listing.
	ipcMain.handle("ide-config:read", async (_event, args) => {
		const { targetId, fileKey } = args || {};
		const t = registry.get(targetId);
		if (!t) throw new Error(`Unknown target: ${targetId}`);
		const spec = resolveSpec(t, fileKey);
		if (!spec) throw new Error(`Unknown file for ${targetId}: ${fileKey}`);

		if (spec.kind === "dir") {
			try {
				const entries = await fs.readdir(spec.path, { withFileTypes: true });
				const listing = entries
					.map((d) => (d.isDirectory() ? `${d.name}/` : d.name))
					.sort()
					.join("\n");
				return { path: spec.path, raw: listing, exists: true, isDir: true };
			} catch (e) {
				if (e.code === "ENOENT")
					return { path: spec.path, raw: "", exists: false, isDir: true };
				throw e;
			}
		}

		try {
			const raw = await fs.readFile(spec.path, "utf8");
			let parsed;
			let parseError;
			try {
				const isJson = spec.format === "json" || (!spec.format && t.format === "json");
				if (isJson) {
					parsed = raw.trim() ? JSON.parse(raw) : undefined;
				} else if (spec.role === "config" && typeof t.parse === "function") {
					parsed = t.parse(raw);
				}
			} catch (e) {
				parseError = String((e && e.message) || e);
			}
			return { path: spec.path, raw, exists: true, parsed, parseError };
		} catch (e) {
			if (e.code === "ENOENT") return { path: spec.path, raw: "", exists: false };
			throw e;
		}
	});
}

module.exports = { registerIdeConfigHandlers };
