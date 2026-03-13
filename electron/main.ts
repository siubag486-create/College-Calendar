import {
  app,
  BrowserWindow,
  Tray,
  nativeImage,
  ipcMain,
  screen,
  Menu,
  protocol,
  net,
} from "electron";
import path from "path";
import { execSync } from "child_process";
import * as fs from "fs";
import { pathToFileURL } from "url";
import { findWorkerW, embedInWorkerW, detachFromWorkerW } from "./win32";

let tray: Tray | null = null;
let editorWin: BrowserWindow | null = null;
let wallpaperWin: BrowserWindow | null = null;
let isLiveMode = false;
let workerWHandle: unknown = null;
let healthCheckTimer: ReturnType<typeof setInterval> | null = null;

// Register custom scheme before app is ready
// "standard" makes absolute paths like /_next/... resolve correctly
protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

function getOutPath(...segments: string[]): string {
  return path.join(__dirname, "..", "out", ...segments);
}

function getWallpaperPath(): string {
  return path.join(app.getPath("userData"), "calendar-wallpaper.png");
}

function setWindowsWallpaper(imagePath: string): void {
  const escaped = imagePath.replace(/'/g, "''");
  const ps = [
    `Add-Type -TypeDefinition @"`,
    `using System.Runtime.InteropServices;`,
    `public class WP {`,
    `  [DllImport("user32.dll", CharSet = CharSet.Auto)]`,
    `  public static extern int SystemParametersInfo(int a, int b, string c, int d);`,
    `}`,
    `"@`,
    `[WP]::SystemParametersInfo(20, 0, '${escaped}', 3)`,
  ].join("\n");

  const encoded = Buffer.from(ps, "utf16le").toString("base64");

  try {
    execSync(
      `powershell -NoProfile -NonInteractive -EncodedCommand ${encoded}`,
      { windowsHide: true },
    );
  } catch (e) {
    console.error("Wallpaper set failed:", e);
  }
}

function createEditorWindow(): void {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const winWidth = Math.min(1440, width);
  const winHeight = Math.min(960, height);

  editorWin = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    center: true,
    frame: false,
    transparent: false,
    backgroundColor: "#0a0a0a",
    resizable: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // Load via custom protocol so /_next/... absolute paths resolve correctly
  editorWin.loadURL("app://host/calendar/index.html");

  editorWin.on("close", (e) => {
    e.preventDefault();
    editorWin?.hide();
  });
}

async function enableLiveMode(): Promise<{ success: boolean; error?: string }> {
  if (isLiveMode && wallpaperWin) {
    return { success: true };
  }

  try {
    // Find WorkerW
    console.log("[live] Finding WorkerW...");
    workerWHandle = findWorkerW();
    if (!workerWHandle) {
      console.error("[live] WorkerW not found");
      return { success: false, error: "WorkerW not found" };
    }
    console.log("[live] WorkerW found");

    const { width, height } = screen.getPrimaryDisplay().size;
    console.log("[live] Screen size:", width, "x", height);

    // Create wallpaper window (display-only, no interaction)
    wallpaperWin = new BrowserWindow({
      width,
      height,
      x: 0,
      y: 0,
      frame: false,
      transparent: true,
      focusable: false,
      skipTaskbar: true,
      resizable: false,
      show: false,
      hasShadow: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, "preload.js"),
      },
    });

    // Wait for page to fully load before embedding
    await wallpaperWin.loadURL("app://host/calendar/index.html?liveMode=true");
    console.log("[live] Page loaded");

    // Show window first, then embed into WorkerW
    wallpaperWin.showInactive();

    const nativeHandle = wallpaperWin.getNativeWindowHandle();
    console.log("[live] Electron HWND buffer length:", nativeHandle.length);

    embedInWorkerW(nativeHandle, workerWHandle, width, height);
    console.log("[live] Embedded into WorkerW");

    wallpaperWin.on("closed", () => {
      wallpaperWin = null;
    });

    isLiveMode = true;
    startHealthCheck();
    buildTrayMenu();

    // Notify editor window
    editorWin?.webContents.send("live-mode-changed", true);

    return { success: true };
  } catch (e) {
    console.error("[live] enableLiveMode error:", e);
    // Cleanup on failure
    if (wallpaperWin) {
      wallpaperWin.destroy();
      wallpaperWin = null;
    }
    return { success: false, error: String(e) };
  }
}

function disableLiveMode(): void {
  if (wallpaperWin) {
    try {
      const nativeHandle = wallpaperWin.getNativeWindowHandle();
      detachFromWorkerW(nativeHandle);
    } catch {
      // Window may already be destroyed
    }
    wallpaperWin.destroy();
    wallpaperWin = null;
  }

  isLiveMode = false;
  workerWHandle = null;
  stopHealthCheck();
  buildTrayMenu();

  // Notify editor window
  editorWin?.webContents.send("live-mode-changed", false);
}

function startHealthCheck(): void {
  stopHealthCheck();
  healthCheckTimer = setInterval(() => {
    if (!isLiveMode || !wallpaperWin) return;

    // Re-check if WorkerW is still valid by trying to find it again
    const newWorkerW = findWorkerW();
    if (!newWorkerW) {
      // Explorer likely restarted, try to re-embed
      console.log("[live] WorkerW lost, attempting re-embed...");
      const wasLive = isLiveMode;
      disableLiveMode();
      if (wasLive) {
        setTimeout(() => {
          enableLiveMode();
        }, 2000);
      }
    }
  }, 5000);
}

function stopHealthCheck(): void {
  if (healthCheckTimer) {
    clearInterval(healthCheckTimer);
    healthCheckTimer = null;
  }
}

function buildTrayMenu(): void {
  if (!tray) return;

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Open Calendar",
      click: () => {
        editorWin?.show();
        editorWin?.focus();
      },
    },
    { type: "separator" },
    {
      label: isLiveMode ? "Disable Live Wallpaper" : "Enable Live Wallpaper",
      click: async () => {
        if (isLiveMode) {
          disableLiveMode();
        } else {
          const result = await enableLiveMode();
          if (!result.success) {
            console.error("[live] Failed to enable:", result.error);
          }
        }
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        // Clean detach before quit
        if (isLiveMode) {
          disableLiveMode();
        }
        tray?.destroy();
        app.exit(0);
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}

function createTray(): void {
  // 16x16 dark square icon
  const icon = nativeImage.createFromDataURL(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGElEQVQ4T2NkIAAYBygNAAIAAAAA//8DAAcAAf7QVKAAAAAASUVORK5CYII="
  );

  tray = new Tray(icon);
  tray.setToolTip("College Calendar");

  buildTrayMenu();

  tray.on("click", () => {
    if (editorWin?.isVisible()) {
      editorWin.hide();
    } else {
      editorWin?.show();
      editorWin?.focus();
    }
  });
}

ipcMain.handle("capture-wallpaper", async () => {
  if (!editorWin) return { success: false };
  try {
    const image = await editorWin.capturePage();
    const dest = getWallpaperPath();
    fs.writeFileSync(dest, image.toPNG());
    setWindowsWallpaper(dest);
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
});

ipcMain.on("close-window", () => {
  editorWin?.hide();
});

ipcMain.handle("toggle-live-mode", async () => {
  if (isLiveMode) {
    disableLiveMode();
    return { success: true, isLive: false };
  } else {
    const result = await enableLiveMode();
    return { ...result, isLive: result.success };
  }
});

ipcMain.handle("get-live-mode-status", async () => {
  return { isLive: isLiveMode };
});

// When editor saves data, refresh wallpaper window to pick up changes
ipcMain.on("sync-wallpaper", () => {
  if (wallpaperWin && isLiveMode) {
    wallpaperWin.webContents.reload();
  }
});

app.whenReady().then(() => {
  // Handle custom app:// protocol — serves files from out/ directory
  protocol.handle("app", (request) => {
    const url = new URL(request.url);
    let filePath = decodeURIComponent(url.pathname);

    // Remove leading slash on Windows
    if (filePath.startsWith("/")) {
      filePath = filePath.substring(1);
    }

    const fullPath = getOutPath(filePath);

    return net.fetch(pathToFileURL(fullPath).toString());
  });

  createEditorWindow();
  createTray();
  editorWin?.show();
});

app.on("window-all-closed", () => {
  // Stay in tray — do not quit
});

app.on("before-quit", () => {
  // Clean detach on quit
  if (isLiveMode) {
    disableLiveMode();
  }
});
