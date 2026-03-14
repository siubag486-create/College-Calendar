import koffi from "koffi";

const user32 = koffi.load("user32.dll");
const dwmapi = koffi.load("dwmapi.dll");

const SetWindowPos = user32.func("SetWindowPos", "int", [
  "void *", "void *", "int", "int", "int", "int", "uint32",
]);
const GetForegroundWindow = user32.func("GetForegroundWindow", "intptr", []);
const GetClassNameW = user32.func("GetClassNameW", "int", [
  "void *", "char16_t *", "int",
]);
const FindWindowA = user32.func("FindWindowA", "void *", ["str", "void *"]);
const DwmSetWindowAttribute = dwmapi.func("DwmSetWindowAttribute", "int", [
  "void *", "uint32", "void *", "uint32",
]);

const SWP_NOMOVE     = 0x0002;
const SWP_NOSIZE     = 0x0001;
const SWP_NOACTIVATE = 0x0010;
const HWND_BOTTOM    = 1n;
const DWMWA_CLOAK    = 13;
const DESKTOP_SHELL_CLASSES = new Set([
  "Progman",
  "WorkerW",
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

export function isDesktopShellWindow(hwnd: bigint): boolean {
  const className = getWindowClassName(hwnd);
  return className ? DESKTOP_SHELL_CLASSES.has(className) : false;
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

// Progman(바탕화면) 바로 위에 고정 → 바탕화면엔 보이고, 앱 창에는 가려짐
export function pinAboveDesktop(electronHWND: Buffer): void {
  try {
    const hwnd = bufferToHwnd(electronHWND);
    let insertAfter = HWND_BOTTOM;
    try {
      const progman = FindWindowA("Progman", null) as Buffer | null;
      if (progman) {
        const progmanHwnd = bufferToHwnd(progman);
        if (progmanHwnd !== 0n) insertAfter = progmanHwnd;
      }
    } catch {
      // Progman 못 찾으면 HWND_BOTTOM fallback
    }
    SetWindowPos(hwnd, insertAfter, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
  } catch (e) {
    console.error("[win32] pinAboveDesktop error:", e);
  }
}
