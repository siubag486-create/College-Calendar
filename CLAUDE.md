# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

###IMPORTANT
-ALWAYS use shadcn mcp to create ui
-ALWAYS ask user for permission when implementing a plan
-ALWAYS prioritize server component over client component
-NEVER use emoji for design.
-NEVER write or modify any code unless the user explicitly asks you to implement something. If the user asks a question, only answer it — do not write, edit, or create any code.
-NEVER use MCP tools (Playwright, browser automation, etc.) to verify results without asking the user first. When a task is complete, tell the user "작업 완료, 직접 확인해주세요" and wait for their feedback. Do not self-verify unless the user explicitly says to.

## Commands

```bash
pnpm dev              # Start development server
pnpm build            # Build for production (uses --webpack flag, Turbopack has PostCSS bug)
pnpm start            # Start production server
pnpm lint             # Run ESLint
pnpm electron:dev     # Build + compile electron + run locally
pnpm electron:build   # Build + compile electron + package .exe installer
```

## Architecture

**Next.js 16 App Router** project with React 19, TypeScript, and Tailwind CSS v4.
Static export mode (`output: "export"`) — no server required.

### Key directories

- `app/` — App Router pages and layouts (RSC by default)
- `components/` — Page-level components
- `components/ui/` — shadcn/ui components (add new ones via `npx shadcn add <component>`)
- `lib/utils.ts` — `cn()` helper for merging Tailwind classes
- `electron/` — Electron main process + preload scripts (TypeScript source + compiled JS)

### Routes

- `/` — Landing page (hero-section)
- `/calendar` — Calendar app page

### Components

- `components/hero-section.tsx` — Landing page hero (HALIDE/SILVER SULPHIDE dark design, Syncopate + monospace typography, grain texture, `#0a0a0a`/`#e0e0e0`/`#ff3c00` palette)
- `components/calendar.tsx` — Calendar with assignment management (client component, localStorage, edit mode, wallpaper capture)
- `components/ui/button.tsx` — shadcn button

### Electron (Desktop App)

- `electron/main.ts` — Tray app, frameless BrowserWindow, wallpaper capture via PowerShell + Win32 API
- `electron/preload.ts` — IPC bridge (`captureWallpaper`, `closeWindow`)
- `electron-builder.yml` — NSIS installer config
- `tsconfig.electron.json` — Separate TS config for electron compilation
- App flow: install .exe → tray icon → click to edit calendar → "SET WALLPAPER" captures PNG → sets as Windows desktop wallpaper

### Styling

- Tailwind CSS v4 via `@tailwindcss/postcss` (no `tailwind.config.js` — configured in `globals.css`)
- Theme uses OKLch CSS variables for light/dark mode
- Component variants use `class-variance-authority` (CVA)
- Merge classes with `cn()` from `lib/utils.ts` (clsx + tailwind-merge)

### shadcn/ui

- Style: `radix-nova`, icon library: `lucide-react`
- Path aliases: `@/components`, `@/lib`, `@/hooks`
- Add components: `npx shadcn add <component-name>`

### Known Issues

- Next.js 16 Turbopack has a PostCSS timeout bug — all build commands use `--webpack` flag to bypass
- `tw-animate-css` import was removed from globals.css due to build issues
