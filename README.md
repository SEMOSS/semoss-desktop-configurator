# Client

React frontend for this SEMOSS app. Built with Vite, Tailwind CSS v4, and shadcn/ui.

## Setup

1. Install dependencies:
   ```
   cd client
   pnpm i
   ```

2. Create `client/.env.local` with your app ID:
   ```
   APP="your-app-id"
   ```

## Commands

All commands run from the `client/` folder:

- **`pnpm dev`** — Start the local Vite dev server with hot reload
- **`pnpm build`** — Production build → outputs to `portals/`
- **`pnpm dlx shadcn@latest add [component-name]`** — Add a new shadcn/ui component

## Desktop app (Electron)

This app also packages as a macOS desktop binary with [electron-builder](https://www.electron.build/). The Electron shell lives in `electron/`; in packaged builds a small local server (`electron/server.cjs`) serves the built UI and proxies `/Monolith` API calls (and the `insightSocket` WebSocket) to the SEMOSS backend, replacing the Vite dev-server proxy.

Run from the repo root:

- **`pnpm dist:mac`** — Build the macOS binary. Outputs to `release/`:
  - `SEMOSS Configurator-<version>-arm64.dmg` (Apple Silicon installer)
  - `SEMOSS Configurator-<version>-arm64-mac.zip`
- **`pnpm electron:preview`** — Run the packaged (production) code path locally without building a DMG — useful for testing the proxy and login flow.
- **`pnpm electron:dev`** — Run the desktop app against the Vite dev server with hot reload.

### Installing the build (testers)

The build is ad-hoc signed (no Apple Developer ID), so macOS quarantines it on download. To run it:

1. Open the `.dmg` and drag **SEMOSS Configurator** to Applications.
2. Clear the quarantine flag:
   ```
   xattr -cr "/Applications/SEMOSS Configurator.app"
   ```
   (Or launch it once, then approve via System Settings → Privacy & Security → "Open Anyway".)
3. Launch normally.

> Builds for Apple Silicon (arm64) only. To support Intel Macs, change the `mac.target` arch to `universal` in `package.json`.

## Publishing

After building, go to the SEMOSS UI editor and click "Publish files" to make changes visible to users. The `portals/` folder is what gets served.

## Structure

```
client/
├── src/
│   ├── index.tsx          App entry point
│   ├── App.tsx            Root component with SDK provider
│   ├── index.css          Tailwind v4 theme and global styles
│   ├── components/        Shared components and shadcn/ui primitives
│   ├── pages/             Route pages and layouts
│   ├── lib/               Utility functions
│   └── assets/            Static assets (images, etc.)
├── .env.local             App ID (not committed)
├── vite.config.ts         Vite configuration
├── components.json        shadcn/ui CLI config
├── tailwind.config.js     Kept empty for shadcn/ui CLI compatibility
└── tsconfig.json          TypeScript config
```

## Key Patterns

- **SDK hook**: `useInsight()` from `@semoss/sdk/react` provides `actions.run()`, `actions.sendMCPResponseToPlayground()`, `isInitialized`, and `tool`
- **Calling reactors**: `actions.run('ReactorName(param=value)')` — drop the "Reactor" suffix
- **Calling Python MCP tools**: `actions.run('RunMCPTool(tool=["tool_name"], param=...)')`
- **Sending results to Playground**: `actions.sendMCPResponseToPlayground(response, status, executedParams)`
- **Escaping user input**: Always use `JSON.stringify()` when interpolating into Pixel commands

## Resources

- [shadcn/ui](https://ui.shadcn.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Radix UI](https://www.radix-ui.com/)
- [Vite](https://vite.dev/)

