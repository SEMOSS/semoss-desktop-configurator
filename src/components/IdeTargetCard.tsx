import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

interface IdeTargetCardProps {
	result: IdeDetectionResult;
	read: (targetId: IdeTargetId, fileKey?: string) => Promise<IdeReadResult>;
}

// ── status → label + color ─────────────────────────────────────────────────
const PILL_BASE = "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium";

function statusPill(status: DetectStatus): { label: string; className: string } {
	switch (status) {
		case "found":
			return {
				label: "Found",
				className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
			};
		case "not-found":
			return {
				label: "Not found",
				className: "bg-muted text-muted-foreground",
			};
		case "exists-empty":
			return {
				label: "Empty",
				className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
			};
		case "parse-error":
			return {
				label: "Parse error",
				className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
			};
		case "permission-error":
			return {
				label: "No access",
				className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
			};
		default:
			return {
				label: "Error",
				className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
			};
	}
}

function installPill(install: IdeInstallation): { label: string; className: string } {
	switch (install.status) {
		case "installed":
			return {
				label: "Installed",
				className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
			};
		case "not-found":
			return {
				label: "Not installed",
				className: "bg-muted text-muted-foreground",
			};
		default:
			return {
				label: "Install unknown",
				className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
			};
	}
}

const FILE_LABELS: Record<string, string> = {
	config: "Main config",
	auth: "Auth / tokens",
	skills: "Skills",
};

function fileLabel(file: IdeFileStatus): string {
	if (file.key && FILE_LABELS[file.key]) return FILE_LABELS[file.key];
	const base = file.path.split(/[\\/]/).pop();
	return base || file.path;
}

// A file/dir row: label + status, the resolved path, and an inline View toggle.
function FileRow({
	file,
	targetId,
	read,
}: {
	file: IdeFileStatus;
	targetId: IdeTargetId;
	read: (targetId: IdeTargetId, fileKey?: string) => Promise<IdeReadResult>;
}) {
	const [open, setOpen] = useState(false);
	const [content, setContent] = useState<IdeReadResult | null>(null);
	const [loading, setLoading] = useState(false);
	const [err, setErr] = useState<string | null>(null);

	// Only worth opening when there's something to show.
	const canView =
		file.status === "found" ||
		file.status === "exists-empty" ||
		file.status === "parse-error";

	const pill = statusPill(file.status);

	const toggle = async () => {
		if (open) {
			setOpen(false);
			return;
		}
		setOpen(true);
		if (content || loading) return;
		setLoading(true);
		setErr(null);
		try {
			setContent(await read(targetId, file.key));
		} catch (e) {
			setErr(e instanceof Error ? e.message : String(e));
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="px-4 py-3">
			<div className="flex items-center justify-between gap-2">
				<div className="min-w-0 space-y-1">
					<div className="flex items-center gap-2">
						<span className="text-xs font-medium">{fileLabel(file)}</span>
						<span className={cn(PILL_BASE, pill.className)}>{pill.label}</span>
					</div>
					<p
						className="truncate font-mono text-xs text-muted-foreground"
						title={file.path}
					>
						{file.path}
					</p>
					{file.error ? (
						<p className="text-xs text-red-600 dark:text-red-400">{file.error}</p>
					) : null}
				</div>
				{canView ? (
					<Button
						variant="outline"
						size="sm"
						className="shrink-0"
						onClick={toggle}
					>
						{open ? "Hide" : "View"}
					</Button>
				) : null}
			</div>

			{open ? (
				<div className="mt-2">
					{loading ? (
						<div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
							<Spinner className="size-4" /> Loading…
						</div>
					) : err ? (
						<p className="text-xs text-red-600 dark:text-red-400">{err}</p>
					) : content ? (
						<>
							{content.parseError ? (
								<p className="mb-1 text-xs text-amber-700 dark:text-amber-400">
									Could not parse: {content.parseError}
								</p>
							) : null}
							{content.isDir ? (
								<p className="mb-1 text-xs text-muted-foreground">
									Directory contents:
								</p>
							) : null}
							<pre className="max-h-80 overflow-auto rounded-md border border-border bg-muted/50 p-3 font-mono text-xs leading-relaxed">
								{content.raw.trim() ? content.raw : "(empty)"}
							</pre>
						</>
					) : null}
				</div>
			) : null}
		</div>
	);
}

// One card per AI tool: name, capabilities, install status, and a row per
// config file with an inline read-only viewer.
export function IdeTargetCard({ result, read }: IdeTargetCardProps) {
	const install = installPill(result.installation);
	const capabilities = [
		result.capabilities.models && "Models",
		result.capabilities.mcp && "MCPs",
		result.capabilities.skills && "Skills",
	].filter(Boolean) as string[];
	const files = [result.primary, ...result.others];

	return (
		<div className="flex flex-col rounded-xl border border-border bg-card text-card-foreground shadow-sm">
			<div className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
				<div className="space-y-1.5">
					<h2 className="text-sm font-semibold leading-none">
						{result.displayName}
					</h2>
					<div className="flex flex-wrap gap-1">
						{capabilities.map((c) => (
							<span
								key={c}
								className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
							>
								{c}
							</span>
						))}
					</div>
				</div>
				<span
					className={cn(PILL_BASE, install.className)}
					title={result.installation.path || result.installation.error}
				>
					{install.label}
				</span>
			</div>

			<div className="divide-y divide-border">
				{files.map((file) => (
					<FileRow
						key={file.key ?? file.path}
						file={file}
						targetId={result.targetId}
						read={read}
					/>
				))}
			</div>
		</div>
	);
}
