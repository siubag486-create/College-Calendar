import koffi from "koffi";

const user32 = koffi.load("user32.dll");
const dwmapi = koffi.load("dwmapi.dll");

const SetWindowPos = user32.func("SetWindowPos", "int", [
  "void *", "void *", "int", "int", "int", "int", "uint32",
]);
const ShowWindow = user32.func("ShowWindow", "int", ["void *", "int"]);
const GetForegroundWindow = user32.func("GetForegroundWindow", "intptr", []);
const GetAncestor = user32.func("GetAncestor", "void *", ["void *", "uint32"]);
const GetClassNameW = user32.func("GetClassNameW", "int", [
  "void *", "char16_t *", "int",
]);
const FindWindowA = user32.func("FindWindowA", "intptr", ["str", "intptr"]);
const DwmSetWindowAttribute = dwmapi.func("DwmSetWindowAttribute", "int", [
  "void *", "uint32", "void *", "uint32",
]);

const SWP_NOMOVE     = 0x0002;
const SWP_NOSIZE     = 0x0001;
const SWP_NOACTIVATE = 0x0010;
const HWND_BOTTOM    = 1n;
const DWMWA_CLOAK    = 13;
const GA_ROOT        = 2;
const GA_ROOTOWNER   = 3;
const SW_SHOWNOACTIVATE = 4;
const SW_SHOWNA         = 8;
const SW_RESTORE        = 9;
const DESKTOP_SHELL_CLASSES = new Set([
  "Progman",
  "WorkerW",
  "SHELLDLL_DefView",
  "SysListView32",
  "Shell_TrayWnd",
  "NotifyIconOverflowWindow",
]);

function bufferToHwnd(buf: Buffer): bigint {
  return buf.length >= 8
    ? buf.readBigUInt64LE(0)
    : BigInt(buf.readUInt32LE(0));
}

export function hwndFromBuffer(buf: Buffer): bigint {
  return bufferToHwnd(buf);
}

export function getForegroundHwnd(): bigint {
  try {
    const hwnd = GetForegroundWindow() as unknown as bigint;
    return hwnd ?? 0n;
  } catch {
    return 0n;
  }
}

export function getWindowClassName(hwnd: bigint): string | null {
  if (hwnd === 0n) return null;

  try {
    const buf = Buffer.alloc(256 * 2);
    const length = GetClassNameW(hwnd, buf, buf.length / 2) as number;
    if (!length) return null;
    return koffi.decode(buf, "char16", length) as string;
  } catch {
    return null;
  }
}

function getAncestorHwnd(hwnd: bigint, flag: number): bigint {
  if (hwnd === 0n) return 0n;

  try {
    const ancestor = GetAncestor(hwnd, flag) as unknown as bigint;
    return ancestor ?? 0n;
  } catch {
    return 0n;
  }
}

export function isDesktopShellWindow(hwnd: bigint): boolean {
  const handles = [
    hwnd,
    getAncestorHwnd(hwnd, GA_ROOT),
    getAncestorHwnd(hwnd, GA_ROOTOWNER),
  ];

  for (const handle of handles) {
    const className = getWindowClassName(handle);
    if (className && DESKTOP_SHELL_CLASSES.has(className)) {
      return true;
    }
  }

  return false;
}

export function pinToBottom(electronHWND: Buffer): void {
  try {
    const hwnd = bufferToHwnd(electronHWND);
    SetWindowPos(hwnd, HWND_BOTTOM, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
  } catch (e) {
    console.error("[win32] pinToBottom error:", e);
  }
}

// Win+D DWM 클로킹을 직접 해제
export function uncloak(electronHWND: Buffer): void {
  try {
    const hwnd = bufferToHwnd(electronHWND);
    const falseVal = Buffer.alloc(4, 0); // BOOL = FALSE
    DwmSetWindowAttribute(hwnd, DWMWA_CLOAK, falseVal, 4);
  } catch (e) {
    console.error("[win32] uncloak error:", e);
  }
}

export function restoreWindow(electronHWND: Buffer): void {
  try {
    const hwnd = bufferToHwnd(electronHWND);
    ShowWindow(hwnd, SW_RESTORE);
    ShowWindow(hwnd, SW_SHOWNA);
    ShowWindow(hwnd, SW_SHOWNOACTIVATE);
  } catch (e) {
    console.error("[win32] restoreWindow error:", e);
  }
}

// Progman(바탕화면) 바로 위에 고정 → 바탕화면엔 보이고, 앱 창에는 가려짐
export function pinAboveDesktop(electronHWND: Buffer): void {
  try {
    const hwnd = bufferToHwnd(electronHWND);
    let insertAfter: bigint = HWND_BOTTOM;
    try {
      const progmanHwnd = FindWindowA("Progman", 0) as unknown as bigint;
      if (progmanHwnd && progmanHwnd !== 0n) insertAfter = progmanHwnd;
    } catch {
      // Progman 못 찾으면 HWND_BOTTOM fallback
    }
    SetWindowPos(hwnd, insertAfter, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
  } catch (e) {
    console.error("[win32] pinAboveDesktop error:", e);
  }
}

// TOPMOST 제거 + Progman 위 고정 (Electron setAlwaysOnTop(false) 우회)
// setAlwaysOnTop(false)는 transparent 윈도우를 숨기는 부작용이 있어서 Win32 직접 호출
export function settleAboveDesktop(electronHWND: Buffer): void {
  try {
    const hwnd = bufferToHwnd(electronHWND);
    const flags = SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE;

    // 1) HWND_NOTOPMOST로 TOPMOST 플래그 제거
    const HWND_NOTOPMOST = -2n;
    SetWindowPos(hwnd, HWND_NOTOPMOST, 0, 0, 0, 0, flags);

    // 2) Progman 바로 위에 배치
    try {
      const progmanHwnd = FindWindowA("Progman", 0) as unknown as bigint;
      if (progmanHwnd && progmanHwnd !== 0n) {
        SetWindowPos(hwnd, progmanHwnd, 0, 0, 0, 0, flags);
      }
    } catch {
      // fallback: NOTOPMOST 위치 유지
    }
  } catch (e) {
    console.error("[win32] settleAboveDesktop error:", e);
  }
}
