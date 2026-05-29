// TOML parse/serialize wrapper.  Isolates the library choice behind one module
// so it can be swapped later (e.g. for a comment-preserving editor in the
// editing phase) without touching descriptors or the IPC layer.
//
// @iarna/toml is pure CommonJS and dependency-free, so it `require()`s cleanly
// from the .cjs main process (no ESM interop concerns under Electron's Node)
// and bundles without pulling a dependency tree.
//
// NOTE (editing phase): parse() -> stringify() does NOT preserve comments or
// original formatting.  For writes, prefer format-preserving section splices
// over a full round-trip, and always back up the file first.

const TOML = require("@iarna/toml");

module.exports = {
	parse: (raw) => TOML.parse(raw),
	stringify: (data) => TOML.stringify(data),
};
