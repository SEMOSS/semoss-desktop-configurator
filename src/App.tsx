// App.tsx - Root React component.
//
// Env.update() configures the SEMOSS SDK with connection details from .env files.
// InsightProvider (from @semoss/sdk) initializes a SEMOSS Insight session and provides
// SDK hooks (useInsight) to all child components.
//
// To simulate an MCP tool invocation during local development, uncomment the TOOL
// block below. This lets you test how your UI behaves when launched from Playground
// with pre-filled parameters.

import { Env } from "@semoss/sdk";
import { InsightProvider } from "@semoss/sdk/react";
import { useEffect } from "react";
import { Toaster } from "sonner";
import { Router } from "./pages";

Env.update({
  MODULE: import.meta.env.MODULE || "",
  ACCESS_KEY: import.meta.env.VITE_ACCESS_KEY || "", // only used in local dev
  SECRET_KEY: import.meta.env.VITE_SECRET_KEY || "", // only used in local dev
  APP: import.meta.env.APP || "",
});

// Relay window.opener.postMessage data captured in the OAuth popup back into
// the main window as a real MessageEvent.  The SEMOSS SDK listens for these
// events via window.addEventListener('message', ...) inside actions.login() —
// dispatching the message lets the SDK resolve the login promise and flip
// isAuthorized to true without a full page reload.
// Only active when running inside the Electron shell (window.electron defined).
function OauthMessageRelay() {
  useEffect(() => {
    if (!window.electron) return;
    const remove = window.electron.onOauthPopupMessage(({ data, sourceOrigin }) => {
      console.log("[OAuth] Dispatching relayed postMessage to window, origin:", sourceOrigin);
      window.dispatchEvent(
        new MessageEvent("message", {
          data,
          // Use the popup's actual origin so the SDK's origin check passes.
          origin: sourceOrigin,
        }),
      );
    });
    return remove;
  }, []);
  return null;
}

export const App = () => {
  return (
    // InsightProvider must wrap the entire app — it starts a SEMOSS Insight session
    // and exposes the `useInsight()` hook for running Pixel commands, calling MCP tools,
    // and sending results back to Playground.
    <InsightProvider>
      <OauthMessageRelay />
      <Router />
      <Toaster />
    </InsightProvider>
  );
};
