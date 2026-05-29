// Type declarations for environment variables and static assets.
// TypeScript uses these to provide autocomplete and type safety.

// Environment variables available via import.meta.env (configured in .env and .env.local)
interface ImportMetaEnv {
	readonly ENDPOINT: string; // SEMOSS server URL (e.g. http://localhost:9090)
	readonly MODULE: string; // API module path (e.g. /Monolith)
	readonly APP: string; // App/project ID
	readonly VITE_ACCESS_KEY: string; // Local dev auth (not used in production)
	readonly VITE_SECRET_KEY: string; // Local dev auth (not used in production)
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

// ── IDE-config detection (electron/ideConfig) ──────────────────────────────
// Hand-written contract for the .cjs registry in electron/, which the renderer
// can't import directly. Keep in sync with electron/ideConfig/.
type IdeTargetId = "codex" | "claude" | "copilot";

type DetectStatus =
	| "found"
	| "not-found"
	| "exists-empty"
	| "parse-error"
	| "permission-error"
	| "error";

type InstallStatus = "installed" | "not-found" | "unknown";

interface IdeCapabilities {
	models: boolean;
	mcp: boolean;
	skills: boolean;
}

interface IdeFileStatus {
	/** Stable key for this file/dir within the target (e.g. "config", "auth"). */
	key?: string;
	/** Absolute resolved path. */
	path: string;
	status: DetectStatus;
	kind?: "file" | "dir";
	error?: string;
}

interface IdeInstallation {
	status: InstallStatus;
	path?: string;
	version?: string;
	error?: string;
}

interface IdeDetectionResult {
	targetId: IdeTargetId;
	displayName: string;
	capabilities: IdeCapabilities;
	format: "toml" | "json";
	installation: IdeInstallation;
	primary: IdeFileStatus;
	others: IdeFileStatus[];
}

interface IdeTargetMeta {
	id: IdeTargetId;
	displayName: string;
	capabilities: IdeCapabilities;
	format: "toml" | "json";
}

interface IdeReadResult {
	path: string;
	raw: string;
	exists: boolean;
	/** True when the read target was a directory (raw is a newline listing). */
	isDir?: boolean;
	/** Structured parse (JSON now; TOML once the parser is wired). */
	parsed?: unknown;
	/** Set when the file exists but couldn't be parsed. */
	parseError?: string;
}

// Electron preload bridge — only present when running inside the Electron shell.
// Undefined in a normal browser context.
interface Window {
	electron?: {
		/** Relay of window.opener.postMessage data from the OAuth popup. */
		onOauthPopupMessage: (
			callback: (payload: { data: unknown; sourceOrigin: string }) => void,
		) => () => void;
		/** Fired when the user closes the OAuth popup before completing auth. */
		onOauthCancelled: (callback: () => void) => () => void;
		/**
		 * Locate / detect / view local AI-tool config files. Present whenever the
		 * Electron shell is (i.e. non-optional within `electron`).
		 */
		ideConfig: {
			listTargets: () => Promise<IdeTargetMeta[]>;
			detect: (targetId?: IdeTargetId) => Promise<IdeDetectionResult[]>;
			read: (targetId: IdeTargetId, fileKey?: string) => Promise<IdeReadResult>;
		};
	};
}

// Allow importing CSS files as modules
declare module "*.css" {
	const content: string;
	export default content;
}

// Allow importing image files as modules
declare module "*.jpg" {
	const value: string;
	export = value;
}

declare module "*.png" {
	const value: string;
	export = value;
}

declare module "*.svg" {
	const content: string;
	export default content;
}
