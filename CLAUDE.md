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
- `public/downloads/` — Downloadable files (e.g. `college-calendar-setup.exe`)

### Routes

- `/` — Landing page (hero-section)
- `/calendar` — Calendar app page (editor popup)
- `/widget` — Compact widget view (7-day upcoming assignments)

### Components

- `components/hero-section.tsx` — Landing page hero (HALIDE/SILVER SULPHIDE dark design, Syncopate + monospace typography, grain texture, `#0a0a0a`/`#e0e0e0`/`#ff3c00` palette)
- `components/calendar.tsx` — Full calendar with assignment management (client component, localStorage, always-editable — no edit mode toggle). `[ XD ]` button in header opens dropdown to select widget day range (7/14/30D), saved to `college-widget-days` localStorage key
- `components/widget.tsx` — Compact widget (black/glass themes, date-grouped assignments, D-day badges). Day range driven by `college-widget-days` key (default 7). Theme stored in `college-widget-theme`
- `components/ui/button.tsx` — shadcn button
- `lib/assignments.ts` — Shared Assignment interface, localStorage helpers, date utilities

### Electron (Desktop App)

- `electron/main.ts` — Widget window (240x300, bottom-right, `focusable:true`, `skipTaskbar:true`) + Editor window (1000x800, center popup). Tray with left-click toggle editor, right-click menu.
- `electron/preload.ts` — IPC bridge (`openEditor`, `closeEditor`, `notifyAssignmentsChanged`, `onAssignmentsChanged`)
- `electron/win32.ts` — Win32 FFI via koffi (user32.dll + dwmapi.dll): `pinToBottom()` HWND_BOTTOM, `pinAboveDesktop()` Progman 위 고정, `uncloak()` DWM 클로킹 해제
- `electron-builder.yml` — NSIS installer config
- `tsconfig.electron.json` — Separate TS config for electron compilation
- `scripts/electron-dev.cjs` — async build runner (next build → tsc → electron)
- Build output: `dist/College Calendar Setup 0.1.0.exe` → copy to `public/downloads/college-calendar-setup.exe` for web download
- App flow: install .exe → widget visible bottom-right on desktop (hidden behind apps) → click/tray to open editor → edit assignments → widget remains
- Widget z-order: 시작 시 `pinToBottom` (HWND_BOTTOM) + `minimize` event block. Alt+W 복원 시 `alwaysOnTop(true, "screen-saver")` → 200ms 후 `alwaysOnTop(true, "normal")` + foreground watch 시작 → 다른 앱 포커스 시 `alwaysOnTop(false)` + `pinAboveDesktop()` (바탕화면 클릭해도 위젯 유지)
- localStorage shared between widget and editor via same `app://` origin; IPC `assignments-changed` syncs changes

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
- `next.config.ts` has custom webpack `watchOptions` to prevent Watchpack from scanning Windows system files (C:\ root)


