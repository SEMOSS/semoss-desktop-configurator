// Hook for locating / detecting / viewing local AI-tool config files.
//
// This feature only works inside the Electron desktop shell (the renderer has
// no filesystem access in the browser). `available` is false under `pnpm dev`,
// and the UI degrades to a "desktop app only" state — the same guard pattern
// used by OauthMessageRelay in App.tsx.
//
// Detection is a local, parameterless, idempotent call, so this is a plain hook
// rather than a Redux slice (the mcp/engines slices exist to manage
// search-as-you-type SEMOSS backend state, which this isn't).

import { useCallback, useEffect, useState } from "react";

export interface UseIdeConfig {
	/** True when running inside the Electron shell with the ideConfig bridge. */
	available: boolean;
	results: IdeDetectionResult[];
	isLoading: boolean;
	error: string | null;
	/** Re-run detection. */
	refresh: () => Promise<void>;
	/** Read one file's raw contents (powers the View action). */
	read: (targetId: IdeTargetId, fileKey?: string) => Promise<IdeReadResult>;
}

export function useIdeConfig(): UseIdeConfig {
	const available =
		typeof window !== "undefined" && !!window.electron?.ideConfig;
	const [results, setResults] = useState<IdeDetectionResult[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const refresh = useCallback(async () => {
		if (!available) return;
		setIsLoading(true);
		setError(null);
		try {
			setResults(await window.electron!.ideConfig.detect());
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setIsLoading(false);
		}
	}, [available]);

	const read = useCallback(
		(targetId: IdeTargetId, fileKey?: string) => {
			if (!available) {
				return Promise.reject(new Error("Not running in the desktop app"));
			}
			return window.electron!.ideConfig.read(targetId, fileKey);
		},
		[available],
	);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return { available, results, isLoading, error, refresh, read };
}
