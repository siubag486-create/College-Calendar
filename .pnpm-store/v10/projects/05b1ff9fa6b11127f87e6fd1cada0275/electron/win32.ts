import koffi from "koffi";

const user32 = koffi.load("user32.dll");

const SetWindowPos = user32.func("SetWindowPos", "int", [
  "void *", "void *", "int", "int", "int", "int", "uint32",
]);

const GetForegroundWindow = user32.func("GetForegroundWindow", "void *", []);

const SWP_NOMOVE     = 0x0002;
const SWP_NOSIZE     = 0x0001;
const SWP_NOACTIVATE = 0x0010;
const HWND_BOTTOM    = 1n;

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
    const hwnd = GetForegroundWindow();
    if (!hwnd) return 0n;
    return bufferToHwnd(hwnd as Buffer);
  } catch {
    return 0n;
  }
}

export function pinToBottom(electronHWND: Buffer): void {
  try {
    const hwnd = bufferToHwnd(electronHWND);
    SetWindowPos(hwnd, HWND_BOTTOM, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
  } catch (e) {
    console.error("[win32] pinToBottom error:", e);
  }
}
