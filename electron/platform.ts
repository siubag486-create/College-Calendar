import { BrowserWindow } from "electron";

type PlatformFn = (win: BrowserWindow) => void;

interface PlatformOps {
  pinAboveDesktop: PlatformFn;
  settleAboveDesktop: PlatformFn;
  uncloak: PlatformFn;
  restoreWindow: PlatformFn;
}

function loadPlatformOps(): PlatformOps {
  if (process.platform === "win32") {
    // Windows: win32.ts에서 koffi FFI를 사용하여 DLL 호출
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const win32 = require("./win32");
    return {
      pinAboveDesktop: (win: BrowserWindow) =>
        win32.pinAboveDesktop(win.getNativeWindowHandle()),
      settleAboveDesktop: (win: BrowserWindow) =>
        win32.settleAboveDesktop(win.getNativeWindowHandle()),
      uncloak: (win: BrowserWindow) =>
        win32.uncloak(win.getNativeWindowHandle()),
      restoreWindow: (win: BrowserWindow) =>
        win32.restoreWindow(win.getNativeWindowHandle()),
    };
  }

  // macOS (및 기타 플랫폼): Electron 네이티브 API 사용
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require("./darwin");
}

const ops = loadPlatformOps();

export const pinAboveDesktop = ops.pinAboveDesktop;
export const settleAboveDesktop = ops.settleAboveDesktop;
export const uncloak = ops.uncloak;
export const restoreWindow = ops.restoreWindow;
