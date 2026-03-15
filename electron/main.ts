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
  globalShortcut,
} from "electron";
import path from "path";
import { pathToFileURL } from "url";
import {
  getForegroundHwnd,
  hwndFromBuffer,
  isDesktopShellWindow,
  pinAboveDesktop,
  pinToBottom,
  uncloak,
} from "./win32";

app.commandLine.appendSwitch("disable-gpu-shader-disk-cache");
app.setName("College Calendar");
if (process.platform === "win32") {
  app.setAppUserModelId("com.pswk.college-calendar");
}

let tray: Tray | null = null;
let widgetWin: BrowserWindow | null = null;
let editorWin: BrowserWindow | null = null;
let widgetLoaded = false;
let pendingWidgetRestore = false;
let fgWatchTimer: ReturnType<typeof setInterval> | null = null;
const isDevElectronRun = process.env.COLLEGE_WIDGET_DEV === "1";
const devServerUrl = process.env.COLLEGE_DEV_SERVER_URL || "";
const hasSingleInstanceLock = isDevElectronRun ? true : app.requestSingleInstanceLock();

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

// Widget window

function stopForegroundWatch(): void {
  if (fgWatchTimer) {
    clearInterval(fgWatchTimer);
    fgWatchTimer = null;
  }
}

function showWidgetOnDesktop(): void {
  if (!widgetWin || widgetWin.isDestroyed()) return;
  stopForegroundWatch();
  widgetWin.showInactive();
  pinToBottom(widgetWin.getNativeWindowHandle());
}

function startForegroundWatch(): void {
  stopForegroundWatch();

  fgWatchTimer = setInterval(() => {
    if (!widgetWin || widgetWin.isDestroyed()) {
      stopForegroundWatch();
      return;
    }

    const foregroundHwnd = getForegroundHwnd();
    const widgetHwnd = hwndFromBuffer(widgetWin.getNativeWindowHandle());

    if (
      foregroundHwnd === 0n ||
      foregroundHwnd === widgetHwnd ||
      isDesktopShellWindow(foregroundHwnd)
    ) {
      return;
    }

    widgetWin.setAlwaysOnTop(false);
    pinAboveDesktop(widgetWin.getNativeWindowHandle());
    stopForegroundWatch();
  }, 250);
}

function restoreWidgetWindow(): void {
  if (!widgetWin || widgetWin.isDestroyed()) return;
  if (widgetWin.isMinimized()) widgetWin.restore();

  stopForegroundWatch();
  widgetWin.setAlwaysOnTop(true, "screen-saver");
  widgetWin.show();
  widgetWin.focus();
  uncloak(widgetWin.getNativeWindowHandle());
  setTimeout(() => {
    if (widgetWin && !widgetWin.isDestroyed()) {
      widgetWin.setAlwaysOnTop(true, "normal");
      startForegroundWatch();
    }
  }, 200);
}

let lastRestoreTime = 0;
function restoreWidget(): void {
  const now = Date.now();
  if (now - lastRestoreTime < 500) return;
  lastRestoreTime = now;

  if (!widgetWin || widgetWin.isDestroyed()) return;
  if (!widgetLoaded) {
    pendingWidgetRestore = true;
    console.log("[widget] restore requested before load finished");
    return;
  }

  restoreWidgetWindow();
  console.log("[widget] restored via Alt+W");
}

function createWidgetWindow(): void {
  widgetLoaded = false;
  pendingWidgetRestore = false;

  const display = screen.getPrimaryDisplay();
  const { width: screenW, height: screenH } = display.workAreaSize;

  const widgetW = 240;
  const widgetH = 300;

  widgetWin = new BrowserWindow({
    width: widgetW,
    height: widgetH,
    x: screenW - widgetW - 16,
    y: screenH - widgetH - 16,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    skipTaskbar: true,
    resizable: false,
    alwaysOnTop: false,
    focusable: true,
    show: false,
    hasShadow: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  if (devServerUrl) {
    widgetWin.loadURL(`${devServerUrl}/widget`);
  } else {
    widgetWin.loadURL("app://host/widget/index.html");
  }

  widgetWin.webContents.on("did-fail-load", (_e, code, desc) => {
    console.error("[widget] load failed:", code, desc);
  });
  widgetWin.webContents.on("did-finish-load", () => {
    console.log("[widget] page loaded OK");
    widgetLoaded = true;

    if (pendingWidgetRestore) {
      pendingWidgetRestore = false;
      restoreWidgetWindow();
      console.log("[widget] restored after load finished");
      return;
    }

    showWidgetOnDesktop();
  });

  (widgetWin as any).on("minimize", (e: Event & { preventDefault: () => void }) => {
    e.preventDefault();
    if (widgetWin && !widgetWin.isDestroyed()) {
      showWidgetOnDesktop();
    }
  });

  widgetWin.once("ready-to-show", () => {
    console.log("[widget] ready-to-show fired");
  });

  widgetWin.on("closed", () => {
    stopForegroundWatch();
    widgetWin = null;
    widgetLoaded = false;
    pendingWidgetRestore = false;
  });
}

// Editor window

function createEditorWindow(): void {
  stopForegroundWatch();

  if (widgetWin && !widgetWin.isDestroyed()) {
    widgetWin.setAlwaysOnTop(false);
  }

  if (editorWin && !editorWin.isDestroyed()) {
    if (editorWin.isMinimized()) editorWin.restore();
    if (!editorWin.isVisible()) editorWin.show();
    editorWin.moveTop();
    editorWin.focus();
    return;
  }

  const display = screen.getPrimaryDisplay();
  const { width: screenW, height: screenH } = display.workAreaSize;

  const editorW = 1000;
  const editorH = 800;

  editorWin = new BrowserWindow({
    width: editorW,
    height: editorH,
    x: Math.round((screenW - editorW) / 2),
    y: Math.round((screenH - editorH) / 2),
    frame: false,
    roundedCorners: true,
    transparent: false,
    backgroundColor: "#000000",
    skipTaskbar: false,
    resizable: true,
    show: false,
    hasShadow: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  if (devServerUrl) {
    editorWin.loadURL(`${devServerUrl}/calendar`);
  } else {
    editorWin.loadURL("app://host/calendar/index.html");
  }
  editorWin.show();
  editorWin.moveTop();

  editorWin.webContents.on("did-fail-load", (_e, code, desc) => {
    console.error("[editor] load failed:", code, desc);
  });

  editorWin.once("ready-to-show", () => {
    console.log("[editor] ready-to-show fired");
    editorWin?.show();
    editorWin?.moveTop();
    editorWin?.focus();
  });

  editorWin.webContents.once("did-finish-load", () => {
    if (editorWin && !editorWin.isDestroyed() && !editorWin.isVisible()) {
      editorWin.show();
      editorWin.moveTop();
      editorWin.focus();
    }
  });

  editorWin.on("closed", () => {
    editorWin = null;
  });
}

function closeEditorWindow(): void {
  if (editorWin && !editorWin.isDestroyed()) {
    editorWin.close();
  }
}

function focusExistingApp(): void {
  if (editorWin && !editorWin.isDestroyed()) {
    if (editorWin.isMinimized()) editorWin.restore();
    if (!editorWin.isVisible()) editorWin.show();
    editorWin.moveTop();
    editorWin.focus();
    return;
  }

  restoreWidget();
}

// Tray

function createTray(): void {
  const icon = nativeImage.createFromDataURL(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGElEQVQ4T2NkIAAYBygNAAIAAAAA//8DAAcAAf7QVKAAAAAASUVORK5CYII=",
  );

  tray = new Tray(icon);
  tray.setToolTip("College Calendar  |  Alt+W: restore widget");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Open Editor",
      click: () => createEditorWindow(),
    },
    {
      label: "Restore Widget (Alt+W)",
      click: () => restoreWidget(),
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        tray?.destroy();
        app.exit(0);
      },
    },
  ]);
  tray.setContextMenu(contextMenu);

  tray.on("click", () => {
    if (editorWin && !editorWin.isDestroyed()) {
      closeEditorWindow();
    } else {
      createEditorWindow();
    }
  });
}

// IPC

ipcMain.on("open-editor", () => {
  createEditorWindow();
});

ipcMain.on("close-editor", () => {
  closeEditorWindow();
});

ipcMain.on("assignments-changed", () => {
  if (widgetWin && !widgetWin.isDestroyed()) {
    widgetWin.webContents.send("assignments-changed");
  }
  if (editorWin && !editorWin.isDestroyed()) {
    editorWin.webContents.send("assignments-changed");
  }
});

// App lifecycle

if (!hasSingleInstanceLock) {
  app.quit();
}

if (!isDevElectronRun) {
  app.on("second-instance", () => {
    focusExistingApp();
  });
}

app.whenReady().then(() => {
  console.log("[main] app ready");

  protocol.handle("app", (request) => {
    const url = new URL(request.url);
    let filePath = decodeURIComponent(url.pathname);
    if (filePath.startsWith("/")) {
      filePath = filePath.substring(1);
    }
    const fullPath = getOutPath(filePath);
    console.log("[protocol]", request.url, "->", fullPath);
    return net.fetch(pathToFileURL(fullPath).toString());
  });

  createWidgetWindow();
  createTray();

  globalShortcut.register("Alt+W", () => {
    restoreWidget();
  });

  console.log("[main] widget + tray created, Alt+W registered");
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {});
