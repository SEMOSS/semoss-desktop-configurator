import { useInsight } from "@semoss/sdk/react";
import { useCallback } from "react";

/**
 * Matches the `runPixel` contract the Redux thunks expect: resolve to the bare
 * reactor output rather than the SDK's wrapped response.
 */
export type RunPixelFn = <T = unknown>(pixel: string) => Promise<T>;

/**
 * Adapts the SDK's `actions.run` — which resolves to
 * `{ pixelReturn: [{ output, operationType, ... }] }` — into the bare-output
 * `runPixel` function the store thunks accept. Pass the result into thunks like
 * `callGetUserMcps` / `fetchEnginesByType`.
 *
 * SEMOSS returns backend failures as an ERROR operationType rather than a
 * rejected promise, so those are converted into thrown errors here, letting the
 * thunks' `.rejected` handlers run.
 */
export const useRunPixel = (): RunPixelFn => {
  const { actions } = useInsight();

  return useCallback(
    async function runPixel<T = unknown>(pixel: string): Promise<T> {
      const { pixelReturn } = await actions.run<[T]>(pixel);
      const first = pixelReturn?.[0];
      if (first?.operationType?.includes("ERROR")) {
        throw new Error(
          typeof first.output === "string"
            ? first.output
            : "Pixel execution failed",
        );
      }
      return first?.output as T;
    },
    [actions],
  );
};
