import { BrowserWindow } from "electron";

// macOS에서 위젯을 바탕화면 위에 고정 (Electron 네이티브 API 사용, FFI 불필요)

export function pinAboveDesktop(win: BrowserWindow): void {
  if (win.isDestroyed()) return;
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });
  if (!win.isVisible()) win.showInactive();
}

export function settleAboveDesktop(win: BrowserWindow): void {
  if (win.isDestroyed()) return;
  win.setAlwaysOnTop(false);
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });
}

// macOS에는 DWM 클로킹이 없음 — 창이 숨겨져 있으면 다시 표시
export function uncloak(win: BrowserWindow): void {
  if (win.isDestroyed()) return;
  if (!win.isVisible()) win.showInactive();
}

export function restoreWindow(win: BrowserWindow): void {
  if (win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  win.showInactive();
}
