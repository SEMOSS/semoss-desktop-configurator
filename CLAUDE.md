# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A React frontend (Vite + Tailwind v4 + shadcn/ui) for a SEMOSS app that **also packages as a macOS Electron desktop app**. It talks to a SEMOSS backend through the `@semoss/sdk`. Package manager is **pnpm**.

## Commands

Run from the repo root:

- `pnpm dev` — Vite dev server with hot reload (http://localhost:5173). Browser-only; no Electron.
- `pnpm build` — Production build → `dist/` (see "Build output" below).
- `pnpm electron:dev` — Run the desktop shell against the Vite dev server (hot reload). Uses `concurrently` + `wait-on`.
- `pnpm electron:preview` — `vite build` then run Electron with `ELECTRON_PREVIEW_PROD=1`, exercising the **packaged** code path (local proxy server + login flow) from source without building a DMG. Use this to test prod-only behavior.
- `pnpm dist:mac` — Build the macOS binary → `release/` (`.dmg` + `.zip`, arm64 only).
- `pnpm dlx shadcn@latest add <component>` — Add a shadcn/ui primitive into `src/components/ui/`.

There is **no test runner and no lint/format tooling** configured. Don't invent `pnpm test`/`pnpm lint` commands.

## Two runtime modes (the core architectural split)

The same renderer runs in two environments, and a lot of the code exists to make them behave identically:

1. **Dev / browser** — Vite serves the renderer and proxies the SDK's relative `MODULE` (e.g. `/Monolith`) HTTP calls to the SEMOSS backend (`ENDPOINT`). Proxy is configured in [vite.config.ts](vite.config.ts).
2. **Packaged Electron** — There is no Vite server. [electron/main.cjs](electron/main.cjs) starts [electron/server.cjs](electron/server.cjs), a loopback HTTP server that (a) serves the built `dist/` over `http://localhost:<ephemeral-port>` and (b) proxies both `/Monolith` HTTP requests **and the `insightSocket` WebSocket upgrade** to the SEMOSS backend.

**Why serve over http instead of `file://`:** the SDK relies on relative URLs and same-origin cookie / `postMessage` checks. Serving the packaged renderer over `http://localhost` makes those behave exactly as in dev. Preserve this when touching the Electron startup or proxy code.

`isDev` in main.cjs is `!app.isPackaged && !ELECTRON_PREVIEW_PROD`, which is what lets `electron:preview` force the prod path.

## SEMOSS SDK integration

- [src/App.tsx](src/App.tsx) calls `Env.update({ MODULE, APP, ACCESS_KEY, SECRET_KEY })` from env config, then wraps the app in `<InsightProvider>` (from `@semoss/sdk/react`). This must wrap everything.
- Components consume `useInsight()`, which returns `{ isInitialized, isAuthorized, isReady, error, system, actions, insightId, tool }`.
- **Running backend logic** — `actions.run('ReactorName(param=value)')` for Pixel/reactors (drop the "Reactor" suffix); `actions.runMCPTool(name, params)`; `actions.sendMCPResponseToPlayground(response, status, executedParams)` to return results to Playground.
- **`tool`** is the `MCPToolRequest` populated when the app is launched from Playground as an MCP tool UI (pre-filled params).
- **Auth** — `actions.login({ type: 'native', username, password })` or `actions.login({ type: 'oauth', provider })`. Available SSO providers come from `system.config.availableProviders` (each `{ provider, name, isOauth }`); see [src/pages/LoginPage.tsx](src/pages/LoginPage.tsx).

## Routing & init gate

Entry flow: `index.html → src/index.tsx → App.tsx → Router → pages`.

- [src/pages/Router.tsx](src/pages/Router.tsx) uses **`createHashRouter`** (hash routing is required for SEMOSS apps — URLs look like `/#/path`).
- Every route is wrapped in [src/pages/layouts/InitializedLayout.tsx](src/pages/layouts/InitializedLayout.tsx), which gates rendering on SDK state: `error → ErrorPage`, `!isInitialized → LoadingScreen`, `!isAuthorized → LoginPage`, else `<Outlet />`. New pages render automatically once authorized.
- To add a page: create it in `src/pages/`, add a route entry in Router.tsx. If it's an MCP tool UI, set its path to match the `resourceURI` in `pixel_mcp.json`.

## OAuth/SSO popup flow in Electron (subtle, spans 4 files)

This is the most intricate part of the codebase and the focus of recent work. **Root problem:** with `contextIsolation: true`, Electron sets `window.opener = null` in popups. SEMOSS's OAuth callback page calls `window.opener.postMessage(...)` to signal auth success — with a null opener this silently fails and the SDK's `login()` promise never resolves. The fix is a relay chain:

1. [electron/oauth-popup-preload.cjs](electron/oauth-popup-preload.cjs) — attached to popups, runs with `contextIsolation: false` so it can patch `window.opener` with a fake object whose `postMessage` forwards the payload (+ popup origin) over IPC (`oauth-popup-message`).
2. [electron/main.cjs](electron/main.cjs) — on that IPC, injects SEMOSS session cookies into proxied `/Monolith` requests (`webRequest.onBeforeSendHeaders`) and into the WebSocket upgrade (`getSessionCookieHeader`), relays the message to the parent window, and closes the popup. Settle-timer and `closed`-event fallbacks reload the parent so `InsightProvider` re-checks auth via the injected cookie if `postMessage` never arrives.
3. [electron/preload.cjs](electron/preload.cjs) — exposes `window.electron.onOauthPopupMessage` / `onOauthCancelled` to the renderer.
4. [src/App.tsx](src/App.tsx) `OauthMessageRelay` — dispatches a synthetic `MessageEvent` (with the popup's real origin, so the SDK's origin check passes) so the SDK resolves `login()` without a page reload. LoginPage resets its spinner on `onOauthCancelled`.

GCP load-balancer cookies (`gcplb*`) are deliberately excluded from the injected cookie set.

## State management (Redux Toolkit)

- Store in [src/store/store.ts](src/store/store.ts) with `mcp` and `engines` slices. Use the typed `useAppDispatch` / `useAppSelector` from `@/store` (re-exported from [src/store/hooks.ts](src/store/hooks.ts)) — not the raw react-redux hooks.
- **Thunks receive `runPixel` as an argument** rather than importing the SDK. Components pass `actions.run` in (`dispatch(callGetUserMcps({ runPixel: actions.run, ... }))`). Slices stay decoupled from the SDK.
- **Pixel strings are built in helper functions** inside each slice (e.g. `MyEngineProject(...)`, `MyEngines(...)`, `GetSelectedModelEngines(...)`). User-supplied text interpolated into a Pixel command is wrapped in `<encode>...</encode>` so the backend handles escaping.
- **Stale-response guarding:** async slices track `activeRequestId` and compare the request's `filterWord` against the current `search` in `extraReducers`, dropping responses that no longer match (search-as-you-type race protection). Preserve this when editing those thunks.

## Conventions & config

- **Path alias `@/` → `src/`** (set in both [vite.config.ts](vite.config.ts) and [tsconfig.json](tsconfig.json)). Vite `root` is `src/`; `envDir` is the project root, so `.env` files live at the repo root, not in `src/`.
- **Env vars** (typed in [src/declarations.d.ts](src/declarations.d.ts)): `ENDPOINT` (SEMOSS URL), `MODULE` (API prefix, e.g. `/Monolith`), `APP` (app/project ID), plus `VITE_ACCESS_KEY` / `VITE_SECRET_KEY` for **local dev auth only**. Live in `.env` / `.env.local` (both gitignored). Vite `define`s `ENDPOINT`/`MODULE`/`APP` onto `import.meta.env` at build time; main.cjs also has hardcoded fallbacks.
- **Components** are barrel-exported from `@/components`; shadcn/ui primitives live in `src/components/ui/`. Merge classes with `cn()` from `@/lib/utils`.
- **Tailwind v4** — theme is CSS-only in [src/index.css](src/index.css) (`@import "tailwindcss"`, `@theme inline`, oklch colors, light/`.dark` variables). `tailwind.config.js` is intentionally empty (kept for shadcn CLI compatibility).

## Build output & macOS packaging

- **Build output is currently `dist/`** (so Electron's loader finds it). The vite config notes the previous `portals/` target used by the SEMOSS "Publish files" flow — restore that path in [vite.config.ts](vite.config.ts) if publishing through the SEMOSS UI rather than shipping the desktop app.
- **macOS builds are ad-hoc signed** (`mac.identity: null`). electron-builder's skipped signing leaves a stale signature that Apple Silicon rejects as "damaged", so [scripts/after-pack.cjs](scripts/after-pack.cjs) re-signs the bundle ad-hoc (`codesign --force --deep --sign -`). Builds are **arm64 only**; testers must clear quarantine once (`xattr -cr "/Applications/SEMOSS Configurator.app"`). Swap in a Developer ID identity + notarization for a no-prompt install.
