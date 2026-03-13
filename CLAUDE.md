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
- `/calendar` — Calendar app page

### Components

- `components/hero-section.tsx` — Landing page hero (HALIDE/SILVER SULPHIDE dark design, Syncopate + monospace typography, grain texture, `#0a0a0a`/`#e0e0e0`/`#ff3c00` palette)
- `components/calendar.tsx` — Calendar with assignment management (client component, localStorage, edit mode, wallpaper capture)
- `components/ui/button.tsx` — shadcn button

### Electron (Desktop App)

- `electron/main.ts` — Tray app, frameless BrowserWindow, wallpaper capture via PowerShell + Win32 API, live wallpaper (WorkerW embedding)
- `electron/win32.ts` — Win32 FFI bindings via koffi (FindWindowW, EnumWindows, SetParent, etc.)
- `electron/preload.ts` — IPC bridge (`captureWallpaper`, `closeWindow`, `toggleLiveMode`, `getLiveModeStatus`, `onLiveModeChanged`, `syncWallpaper`)
- `electron-builder.yml` — NSIS installer config
- `tsconfig.electron.json` — Separate TS config for electron compilation
- Build output: `dist/College Calendar Setup 0.1.0.exe` → copy to `public/downloads/college-calendar-setup.exe` for web download
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

### Live Wallpaper (WorkerW Embedding) — 구현 진행 중

캘린더를 데스크탑 배경화면으로 라이브 표시하는 기능 (Wallpaper Engine과 동일한 WorkerW 임베딩 기법).

**아키텍처:** 두 개의 윈도우 — editorWin(편집용) + wallpaperWin(라이브 표시용, `?liveMode=true`)
- `electron/win32.ts` — koffi를 통한 Win32 FFI (FindWindowW, SendMessageTimeoutW, EnumWindows, SetParent)
- `enableLiveMode()` in `electron/main.ts` — async, Progman → 0x052C → WorkerW 탐색 → BrowserWindow 생성 → SetParent로 embed
- `disableLiveMode()` — SetParent(null)로 detach → wallpaperWin 파괴
- 5초 주기 health check로 Explorer 재시작 감지 → 자동 re-embed
- editorWin에서 과제 저장 시 `syncWallpaper` IPC로 wallpaperWin reload
- 트레이 메뉴에 "Enable/Disable Live Wallpaper" 토글
- `components/calendar.tsx` — "LIVE WALLPAPER" 토글 버튼 추가, `?liveMode=true` 쿼리 감지 시 transparent/display-only 모드
- 기존 "SET WALLPAPER" 캡쳐 방식과 공존

**현재 상태 (2026-03-13): embed 테스트 중**

디버깅 경과:
1. koffi 타입 선언 문제 — `koffi.pointer("HWND", koffi.opaque())` 반환값이 koffi External 객체 → `Buffer.isBuffer()` 항상 실패 → **해결: 모든 HWND를 `'void *'`로 선언**
2. Progman 찾기/0x052C/SHELLDLL_DefView WorkerW 찾기 성공
3. 빈 WorkerW 못 찾음 (Windows 11) → **해결: fallback으로 icon WorkerW 자체에 embed**
4. embed 후에도 전체화면 팝업처럼 동작 (바탕화면 아이콘 뒤에 안 감) → 원인: Electron `getNativeWindowHandle()` Buffer를 koffi `void *`에 직접 넘기면 Buffer 메모리 주소가 넘어감 (HWND 값이 아님) → **해결: `bufferToHwnd()` 함수로 Buffer에서 BigInt로 HWND 값 추출 후 전달**

**koffi FFI 핵심 교훈:**
- koffi `void *` 반환값: null → JS `null`, 유효 → `[External: ...]` (truthy)
- koffi `void *` 파라미터에 Buffer 넘기면 Buffer **메모리 주소** 전달 (내용물 X)
- Electron `getNativeWindowHandle()` Buffer → `readBigUInt64LE(0)` 으로 BigInt 변환 후 전달해야 정확한 HWND 값이 감
- koffi `void *` 파라미터는 BigInt 값을 raw pointer address로 받아들임

### Known Issues

- Next.js 16 Turbopack has a PostCSS timeout bug — all build commands use `--webpack` flag to bypass
- `tw-animate-css` import was removed from globals.css due to build issues
- `next.config.ts` has custom webpack `watchOptions` to prevent Watchpack from scanning Windows system files (C:\ root)
