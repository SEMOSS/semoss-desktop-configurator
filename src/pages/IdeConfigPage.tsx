import { Link } from "react-router-dom";
import { IdeTargetCard } from "@/components";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useIdeConfig } from "@/lib/useIdeConfig";

// Locate + view local AI-tool config files (Codex first; Claude & Copilot later).
// Read-only for now — editing (writing our models/MCPs/skills) comes later.
export const IdeConfigPage = () => {
	const { available, results, isLoading, error, refresh, read } = useIdeConfig();

	return (
		<div className="mx-auto max-w-3xl space-y-6 p-6">
			<header className="space-y-2">
				<Link
					to="/"
					className="text-xs text-muted-foreground underline-offset-4 hover:underline"
				>
					← Back to configurator
				</Link>
				<div className="flex items-start justify-between gap-2">
					<div className="space-y-1">
						<h1 className="text-2xl font-semibold tracking-tight">
							Local AI Tools
						</h1>
						<p className="text-sm text-muted-foreground">
							Where each tool's configuration lives on this machine, and what's
							in it.
						</p>
					</div>
					{available ? (
						<Button
							variant="outline"
							size="sm"
							onClick={() => void refresh()}
							disabled={isLoading}
							className="shrink-0"
						>
							{isLoading ? <Spinner className="size-4" /> : null}
							Refresh
						</Button>
					) : null}
				</div>
			</header>

			{!available ? (
				<div className="rounded-xl border border-border bg-card p-8 text-center">
					<p className="text-sm font-medium">Desktop app only</p>
					<p className="mt-1 text-sm text-muted-foreground">
						Detecting local AI-tool configs requires the SEMOSS Configurator
						desktop app. This screen is inactive in the browser.
					</p>
				</div>
			) : error ? (
				<div className="rounded-xl border border-border bg-card p-6">
					<p className="text-sm text-red-600 dark:text-red-400">
						Couldn't detect configurations: {error}
					</p>
					<Button
						variant="outline"
						size="sm"
						className="mt-3"
						onClick={() => void refresh()}
					>
						Try again
					</Button>
				</div>
			) : isLoading && results.length === 0 ? (
				<div className="flex items-center justify-center py-16">
					<Spinner className="size-6" />
				</div>
			) : results.length === 0 ? (
				<p className="py-16 text-center text-sm text-muted-foreground">
					No AI tools to show.
				</p>
			) : (
				<div className="space-y-4">
					{results.map((result) => (
						<IdeTargetCard
							key={result.targetId}
							result={result}
							read={read}
						/>
					))}
				</div>
			)}
		</div>
	);
};
