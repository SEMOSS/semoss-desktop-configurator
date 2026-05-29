// Descriptor for the OpenAI Codex CLI.
//
// A descriptor is a plain object of metadata + pure-ish functions.  Its job is
// per-OS path resolution (honoring env overrides) and declaring what the tool
// supports.  It never touches the filesystem itself — index.cjs does the I/O.
//
// Adding Claude Code / Copilot later = drop a sibling file in targets/ and
// register it in registry.cjs.  No changes to the IPC layer or the renderer.
//
// Codex config facts (confirmed from OpenAI Codex docs):
//   - dir: ~/.codex/   (Windows: %USERPROFILE%\.codex\), overridable via CODEX_HOME
//   - main config: config.toml (TOML)
//   - auth/tokens:  auth.json (plaintext JSON)
//   - skills:       ~/.agents/skills/<name>/SKILL.md
//   - model providers under [model_providers.<id>] (wire_api = "responses")
//   - MCP servers under [mcp_servers.<name>]

const path = require("node:path");
const os = require("node:os");
const { probeInstall } = require("../installProbe.cjs");

module.exports = {
	id: "codex",
	displayName: "OpenAI Codex CLI",
	format: "toml",
	capabilities: { models: true, mcp: true, skills: true },

	// Absolute paths only.  `primary` is the file detect/view/edit target by
	// default; `others` are additional files/dirs we surface but don't parse.
	resolvePaths() {
		const home = os.homedir();
		const codexHome = (process.env.CODEX_HOME || "").trim()
			? process.env.CODEX_HOME
			: path.join(home, ".codex");
		return {
			baseDir: codexHome,
			primary: {
				key: "config",
				path: path.join(codexHome, "config.toml"),
				role: "config",
			},
			others: [
				{
					key: "auth",
					path: path.join(codexHome, "auth.json"),
					role: "auth",
					format: "json",
				},
				{
					key: "skills",
					path: path.join(home, ".agents", "skills"),
					role: "skillsDir",
					kind: "dir",
				},
			],
		};
	},

	// Tri-state install probe — is the `codex` binary on the user's PATH?
	detectInstall() {
		return probeInstall("codex");
	},

	// TOML parse/validate.  Detection uses it for the "parse-error" status; the
	// `read` handler uses it to return a structured `parsed` object.
	// serialize() is for the editing phase (not used by detect/view).
	parse(raw) {
		return require("../formats/toml.cjs").parse(raw);
	},
	serialize(data) {
		return require("../formats/toml.cjs").stringify(data);
	},
};
