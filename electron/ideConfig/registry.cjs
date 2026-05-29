// Registry of AI-tool descriptors.  The single source of truth for which tools
// we can detect/view/edit.  To add a tool, require its descriptor and add it to
// TARGETS — nothing else in the IPC layer or renderer needs to change.

const codex = require("./targets/codex.cjs");
// Future:
// const claude = require("./targets/claude.cjs");
// const copilot = require("./targets/copilot.cjs");

const TARGETS = [codex /*, claude, copilot */];
const byId = new Map(TARGETS.map((t) => [t.id, t]));

module.exports = {
	list: () => TARGETS,
	get: (id) => byId.get(id) || null,
};
