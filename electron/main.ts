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
  pinAboveDesktop,
  restoreWindow,
  settleAboveDesktop,
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
let editorLoaded = false;
let pendingEditorShow = false;
let pendingWidgetRestore = false;
let desktopSettleTimer: ReturnType<typeof setTimeout> | null = null;
let widgetVisible = false;
let isQuitting = false;
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

function stopDesktopSettle(): void {
  if (desktopSettleTimer) {
    clearTimeout(desktopSettleTimer);
    desktopSettleTimer = null;
  }
}

function stopVisibilityWatch(): void {
  stopDesktopSettle();
}

function settleWidgetOnDesktop(): void {
  if (!widgetWin || widgetWin.isDestroyed()) return;
  const handle = widgetWin!.getNativeWindowHandle();
  uncloak(handle);
  settleAboveDesktop(handle);
  pinAboveDesktop(handle);
}

function scheduleDesktopSettle(): void {
  stopDesktopSettle();
  desktopSettleTimer = setTimeout(() => {
    settleWidgetOnDesktop();
    desktopSettleTimer = null;
  }, 120);
}

function showWidgetPinnedToDesktop(forceReveal = false): void {
  if (!widgetWin || widgetWin.isDestroyed()) return;

  // 1. Uncloak first — Win+D cloaks via DWM, must undo before anything else
  if (widgetWin!.isMinimized()) widgetWin!.restore();

  if (forceReveal || !widgetWin.isVisible()) {
    restoreWindow(widgetWin.getNativeWindowHandle());
    widgetWin.showInactive();
  }

  settleWidgetOnDesktop();
  scheduleDesktopSettle();
  widgetVisible = true;
}

function syncWidgetVisibility(forceRestore = false): void {
  if (!widgetWin || widgetWin.isDestroyed()) return;
  if (forceRestore || !widgetVisible || !widgetWin.isVisible()) {
    showWidgetPinnedToDesktop(forceRestore);
    return;
  }
  settleWidgetOnDesktop();
  scheduleDesktopSettle();
}

function startVisibilityWatch(): void {
  settleWidgetOnDesktop();
  scheduleDesktopSettle();
}

function restoreWidgetWindow(): void {
  if (!widgetWin || widgetWin.isDestroyed()) return;
  showWidgetPinnedToDesktop(true);
  return;
  const handle = widgetWin!.getNativeWindowHandle();
 

  // 1. Uncloak FIRST (Win+D cloaks windows — must undo before show)
  uncloak(handle);

  // 2. Force restore and show
  if (widgetWin!.isMinimized()) widgetWin!.restore();
  restoreWindow(handle);
  widgetWin!.showInactive();

  widgetVisible = true;

  // 3. Restart visibility watch — show on desktop, hide when apps are foreground
  startVisibilityWatch();
}

function animateOpacity(
  win: BrowserWindow,
  from: number,
  to: number,
  duration: number,
): Promise<void> {
  return new Promise((resolve) => {
    const steps = Math.max(Math.round(duration / 16), 1);
    let step = 0;
    win.setOpacity(from);
    const timer = setInterval(() => {
      step++;
      const t = step / steps;
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      win.setOpacity(from + (to - from) * eased);
      if (step >= steps) {
        clearInterval(timer);
        win.setOpacity(to);
        resolve();
      }
    }, 16);
  });
}

function showEditorWindow(): void {
  if (!editorWin || editorWin.isDestroyed()) return;
  if (editorWin.isMinimized()) editorWin.restore();
  editorWin.setOpacity(0);
  if (!editorWin.isVisible()) editorWin.show();
  editorWin.moveTop();
  editorWin.focus();
  pendingEditorShow = false;
  animateOpacity(editorWin, 0, 1, 220);
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

    syncWidgetVisibility(true);
    startVisibilityWatch();
  });

  const widgetWindowEvents = widgetWin as unknown as {
    on: (event: string, listener: (event: Event & { preventDefault: () => void }) => void) => void;
  };

  widgetWindowEvents.on("minimize", (e: Event & { preventDefault: () => void }) => {
    e.preventDefault();
    syncWidgetVisibility();
  });

  widgetWin.once("ready-to-show", () => {
    console.log("[widget] ready-to-show fired");
  });

  widgetWin.on("closed", () => {
    stopVisibilityWatch();
    widgetWin = null;
    widgetLoaded = false;
    pendingWidgetRestore = false;
    widgetVisible = false;
  });
}

// Editor window

function createEditorWindow(showOnReady = true): void {
  if (editorWin && !editorWin.isDestroyed()) {
    pendingEditorShow = showOnReady;
    if (showOnReady && editorLoaded) {
      showEditorWindow();
    }
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
  editorLoaded = false;
  pendingEditorShow = showOnReady;

  if (devServerUrl) {
    editorWin.loadURL(`${devServerUrl}/calendar`);
  } else {
    editorWin.loadURL("app://host/calendar/index.html");
  }

  editorWin.webContents.on("did-fail-load", (_e, code, desc) => {
    console.error("[editor] load failed:", code, desc);
  });

  editorWin.once("ready-to-show", () => {
    console.log("[editor] ready-to-show fired");
    if (pendingEditorShow) {
      showEditorWindow();
    }
  });

  editorWin.webContents.once("did-finish-load", () => {
    editorLoaded = true;
    if (pendingEditorShow) {
      showEditorWindow();
    }
  });

  editorWin.on("close", (e) => {
    if (isQuitting) {
      return;
    }

    e.preventDefault();
    closeEditorWindow();
  });

  editorWin.on("closed", () => {
    editorWin = null;
    editorLoaded = false;
    pendingEditorShow = false;
  });
}

let isEditorClosing = false;

function closeEditorWindow(): void {
  if (!editorWin || editorWin.isDestroyed() || isEditorClosing) return;
  isEditorClosing = true;
  pendingEditorShow = false;
  animateOpacity(editorWin, 1, 0, 180).then(() => {
    if (editorWin && !editorWin.isDestroyed()) {
      editorWin.hide();
      editorWin.setOpacity(1);
    }
    isEditorClosing = false;
  });
}

function focusExistingApp(): void {
  if (editorWin && !editorWin.isDestroyed() && editorWin.isVisible()) {
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
    if (editorWin && !editorWin.isDestroyed() && editorWin.isVisible()) {
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
  createEditorWindow(false);

  const shortcutRegistered = globalShortcut.register("Alt+W", () => {
    restoreWidget();
  });

  if (!shortcutRegistered) {
    console.error("[shortcut] failed to register Alt+W");
  }

  console.log("[main] widget + tray created, Alt+W registered");
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {});
