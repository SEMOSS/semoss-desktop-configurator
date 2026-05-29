// Best-effort, tri-state probe for whether a CLI tool is installed.
//
// Returns { status: "installed" | "not-found" | "unknown", path?, error? }.
//
// Why this is tricky: a packaged macOS app launched from Finder inherits a
// minimal process.env.PATH that omits Homebrew (/opt/homebrew/bin),
// /usr/local/bin, and npm/bun/deno global bins.  A naive lookup against that
// PATH would report "not-found" for tools that ARE installed.  So on
// macOS/Linux we resolve the user's real PATH by asking their login shell, and
// fall back to checking well-known install locations.  When we genuinely can't
// tell (timeout, shell error) we return "unknown" rather than a false negative.

const { execFile } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

// Resolve a binary via the platform's PATH-aware lookup.
function whichViaShell(binName) {
	return new Promise((resolve) => {
		if (process.platform === "win32") {
			// `where` searches PATH plus a few system locations.
			execFile(
				"where",
				[binName],
				{ timeout: 4000, windowsHide: true },
				(err, stdout) => {
					const first = String(stdout || "")
						.split(/\r?\n/)
						.map((s) => s.trim())
						.filter(Boolean)[0];
					if (first) return resolve({ status: "installed", path: first });
					if (err && err.code === 1) return resolve({ status: "not-found" });
					return resolve({
						status: err ? "unknown" : "not-found",
						error: err && err.message,
					});
				},
			);
			return;
		}

		// macOS / Linux: use an interactive login shell so the user's profile
		// files (.zprofile/.zshrc, .bash_profile, ...) populate PATH the same way
		// they would in a real terminal.
		const shell = process.env.SHELL || "/bin/zsh";
		execFile(
			shell,
			["-ilc", `command -v ${binName} 2>/dev/null`],
			{ timeout: 5000 },
			(err, stdout) => {
				const first = String(stdout || "")
					.split(/\r?\n/)
					.map((s) => s.trim())
					.filter(Boolean)[0];
				if (first) return resolve({ status: "installed", path: first });
				if (err && err.killed)
					return resolve({ status: "unknown", error: "probe timed out" });
				// `command -v` exits 1 when the name isn't found.
				if (err && err.code === 1) return resolve({ status: "not-found" });
				return resolve({
					status: err ? "unknown" : "not-found",
					error: err && err.message,
				});
			},
		);
	});
}

// Well-known install directories to check if the shell probe came up empty.
function knownLocations(binName) {
	if (process.platform === "win32") return [];
	const home = os.homedir();
	return [
		"/opt/homebrew/bin",
		"/usr/local/bin",
		path.join(home, ".local", "bin"),
		path.join(home, ".bun", "bin"),
		path.join(home, ".deno", "bin"),
	].map((dir) => path.join(dir, binName));
}

async function probeInstall(binName) {
	const viaShell = await whichViaShell(binName);
	if (viaShell.status === "installed") return viaShell;

	for (const candidate of knownLocations(binName)) {
		try {
			if (fs.existsSync(candidate)) {
				return { status: "installed", path: candidate };
			}
		} catch (_) {
			// ignore and keep checking
		}
	}

	// Preserve the shell probe's verdict ("not-found" or "unknown").
	return viaShell;
}

module.exports = { probeInstall };
