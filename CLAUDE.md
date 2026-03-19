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
pnpm electron:build:mac  # Build + compile electron + package .dmg installer (macOS)
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

- `components/hero-section.tsx` — Landing page hero (HALIDE/SILVER SULPHIDE dark design, Syncopate + monospace typography, grain texture, `#0a0a0a`/`#e0e0e0`/`#ff3c00` palette). 다운로드 버튼 Windows(.exe)/macOS(.dmg) 2개 분리
- `components/calendar.tsx` — Full calendar with assignment management (client component, localStorage, always-editable — no edit mode toggle). `[ XD ]` button in header opens dropdown to select widget day range (7/14/30D), saved to `college-widget-days` localStorage key
- `components/widget.tsx` — Compact widget (black/glass themes, date-grouped assignments, D-day badges). Day range driven by `college-widget-days` key (default 7). Theme stored in `college-widget-theme`
- `components/ui/button.tsx` — shadcn button
- `lib/assignments.ts` — Shared Assignment interface, localStorage helpers (`loadAssignments`, `saveAssignments`), date utilities (`getDayDiff`, `formatYMD`), notification settings (`loadNotifSettings`, `saveNotifSettings`). localStorage keys: `college-assignments`, `college-notif-enabled`, `college-notif-days`, `college-notif-last-check`

### Electron (Desktop App)

- `electron/main.ts` — Widget window (240x300, bottom-right, `focusable:true`, `skipTaskbar:true`) + Editor window (1000x800, center popup). Tray with left-click toggle editor, right-click menu.
- `electron/preload.ts` — IPC bridge (`openEditor`, `closeEditor`, `notifyAssignmentsChanged`, `onAssignmentsChanged`)
- `electron/win32.ts` — Win32 FFI via koffi (user32.dll + dwmapi.dll): `pinToBottom()` HWND_BOTTOM, `pinAboveDesktop()` Progman 위 고정, `uncloak()` DWM 클로킹 해제
- `electron/darwin.ts` — macOS 위젯 고정 로직 (Electron 네이티브 API, koffi 불필요). `setVisibleOnAllWorkspaces()` + 일반 z-order 동작
- `electron/platform.ts` — `process.platform` 분기: Windows → win32.ts (Buffer/FFI), macOS → darwin.ts (BrowserWindow API). 모든 함수는 `BrowserWindow`를 인자로 받음
- `electron-builder.yml` — Windows NSIS + macOS DMG 빌드 타겟. koffi는 Windows 빌드에서만 포함
- `tsconfig.electron.json` — Separate TS config for electron compilation
- `scripts/electron-dev.cjs` — async build runner (next build → tsc → electron)
- Build output: Windows `dist/College Calendar Setup 0.1.0.exe` → `public/downloads/college-calendar-setup.exe`, macOS `dist/College Calendar-0.1.0.dmg` → `public/downloads/college-calendar-mac.dmg`
- App flow: install → widget visible bottom-right on desktop → click/tray to open editor → edit assignments → widget remains
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

### TODO

- **Windows 자동 시작 등록**: `app.setLoginItemSettings({ openAtLogin: true })`를 `electron/main.ts`에 추가하여 부팅 시 위젯 자동 실행되도록 구현 필요
- hero section 디자인 수정 랜딩페이지 작성

---

## 크로스플랫폼 지원 (Windows + macOS)

`electron/platform.ts`가 `process.platform`에 따라 win32/darwin 모듈을 런타임 분기 로드. `main.ts`는 플랫폼 무관하게 `BrowserWindow`를 인자로 전달.

### 플랫폼별 위젯 동작 차이
- **Windows**: win32.ts (koffi FFI) → Progman 위 z-order 고정, DWM uncloak, Alt+W 복원
- **macOS**: darwin.ts (Electron API) → `setVisibleOnAllWorkspaces(true)` + 일반 z-order. 바탕화면 고정 없음 (macOS에 Progman 개념 없음). Alt+W 불필요 (바탕화면에 묻힐 일 없음)
- UI/디자인은 양 플랫폼 동일 (Chromium 렌더링)

### Known Issues

- Next.js 16 Turbopack has a PostCSS timeout bug — all build commands use `--webpack` flag to bypass
- `tw-animate-css` import was removed from globals.css due to build issues
- `next.config.ts` has custom webpack `watchOptions` to prevent Watchpack from scanning Windows system files (C:\ root)


