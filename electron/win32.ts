import koffi from "koffi";

// ── Load user32.dll ──
const user32 = koffi.load("user32.dll");

// All HWND params/returns use 'void *' — koffi handles null correctly for this type.
// Nullable strings use 'str16' — koffi converts JS string ↔ WCHAR*, null → NULL.

const FindWindowW = user32.func("FindWindowW", "void *", ["str16", "str16"]);

const FindWindowExW = user32.func("FindWindowExW", "void *", [
  "void *", // hWndParent
  "void *", // hWndChildAfter
  "str16",  // lpszClass
  "str16",  // lpszWindow
]);

const SendMessageTimeoutW = user32.func("SendMessageTimeoutW", "int64", [
  "void *", // hWnd
  "uint32", // Msg
  "uint64", // wParam
  "int64",  // lParam
  "uint32", // fuFlags
  "uint32", // uTimeout
  "void *",  // lpdwResult (we don't need the result, just pass a buffer)
]);

const EnumWindowsCb = koffi.proto("EnumWindowsCb", "int", ["void *", "int64"]);
const EnumWindows = user32.func("EnumWindows", "int", [
  koffi.pointer(EnumWindowsCb),
  "int64",
]);

const SetParent = user32.func("SetParent", "void *", ["void *", "void *"]);

const SetWindowPos = user32.func("SetWindowPos", "int", [
  "void *", // hWnd
  "void *", // hWndInsertAfter
  "int",    // X
  "int",    // Y
  "int",    // cx
  "int",    // cy
  "uint32", // uFlags
]);

const ShowWindow = user32.func("ShowWindow", "int", ["void *", "int"]);

// ── Constants ──
const SMTO_NORMAL = 0x0000;
const SWP_NOACTIVATE = 0x0010;
const SWP_SHOWWINDOW = 0x0040;
const SW_SHOW = 5;

/**
 * Find the WorkerW to embed into as a live wallpaper.
 *
 * Send 0x052C to Progman, then find the WorkerW containing SHELLDLL_DefView.
 * We embed our window as a child of THAT WorkerW — it goes behind
 * SHELLDLL_DefView (icons) in Z-order, so it appears as the background.
 *
 * On some Windows versions a second empty WorkerW is created; on others
 * (like Windows 11) only the one with SHELLDLL_DefView exists.
 * Embedding into the SHELLDLL_DefView parent works on both.
 */
export function findWorkerW(): unknown {
  // 1. Find Progman
  const progman = FindWindowW("Progman", null);
  console.log("[win32] FindWindowW('Progman') →", progman);
  if (!progman) {
    console.error("[win32] Progman not found");
    return null;
  }

  // 2. Send 0x052C to trigger WorkerW creation
  const resultBuf = Buffer.alloc(4);
  SendMessageTimeoutW(progman, 0x052c, 0, 0, SMTO_NORMAL, 1000, resultBuf);
  console.log("[win32] Sent 0x052C to Progman");

  // 3. Find the WorkerW that contains SHELLDLL_DefView (icon layer)
  let targetWorkerW: unknown = null;

  const callback = koffi.register(
    (hwnd: unknown, _lParam: number) => {
      const shellView = FindWindowExW(hwnd, null, "SHELLDLL_DefView", null);
      if (shellView) {
        // First try: look for the next empty WorkerW (some Windows versions)
        const nextWorkerW = FindWindowExW(null, hwnd, "WorkerW", null);
        if (nextWorkerW) {
          console.log("[win32] Found empty WorkerW after icon WorkerW");
          targetWorkerW = nextWorkerW;
        } else {
          // Fallback: embed into the WorkerW that has SHELLDLL_DefView
          // Our window will be placed behind SHELLDLL_DefView in Z-order
          console.log("[win32] No empty WorkerW — using icon WorkerW as target");
          targetWorkerW = hwnd;
        }
        return 0; // stop enumeration
      }
      return 1; // continue
    },
    koffi.pointer(EnumWindowsCb),
  );

  EnumWindows(callback, 0);
  koffi.unregister(callback);

  if (!targetWorkerW) {
    console.error("[win32] No WorkerW with SHELLDLL_DefView found");
    return null;
  }
  console.log("[win32] Target WorkerW:", targetWorkerW);

  return targetWorkerW;
}

/**
 * Convert Electron's getNativeWindowHandle() Buffer to a BigInt
 * that koffi can use as a void* (raw HWND address).
 *
 * Electron returns a Buffer containing the HWND value as bytes.
 * If we pass the Buffer directly to koffi void*, koffi sends
 * the address OF the Buffer (wrong). We need the value INSIDE it.
 */
function bufferToHwnd(buf: Buffer): bigint {
  return buf.length >= 8
    ? buf.readBigUInt64LE(0)
    : BigInt(buf.readUInt32LE(0));
}

/**
 * Embed an Electron BrowserWindow into the WorkerW.
 */
export function embedInWorkerW(
  electronHWND: Buffer,
  workerWHWND: unknown,
  width: number,
  height: number,
): void {
  const hwnd = bufferToHwnd(electronHWND);
  console.log("[win32] SetParent - electronHWND: 0x" + hwnd.toString(16), "workerW:", workerWHWND);
  SetParent(hwnd, workerWHWND);
  SetWindowPos(hwnd, null, 0, 0, width, height, SWP_NOACTIVATE | SWP_SHOWWINDOW);
  ShowWindow(hwnd, SW_SHOW);
  console.log("[win32] Embed complete");
}

/**
 * Detach an Electron BrowserWindow from WorkerW (re-parent to null/desktop).
 */
export function detachFromWorkerW(electronHWND: Buffer): void {
  const hwnd = bufferToHwnd(electronHWND);
  SetParent(hwnd, null);
  console.log("[win32] Detached from WorkerW");
}
