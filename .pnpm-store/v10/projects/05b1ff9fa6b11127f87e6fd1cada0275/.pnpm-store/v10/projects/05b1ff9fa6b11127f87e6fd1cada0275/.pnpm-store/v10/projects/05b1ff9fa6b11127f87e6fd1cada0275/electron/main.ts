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
import { pinToBottom } from "./win32";

app.commandLine.appendSwitch("disable-gpu-shader-disk-cache");

let tray: Tray | null = null;
let widgetWin: BrowserWindow | null = null;
let editorWin: BrowserWindow | null = null;

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

// ── Widget Window (compact, bottom-right, desktop only) ──

let lastRestoreTime = 0;
function restoreWidget(): void {
  const now = Date.now();
  if (now - lastRestoreTime < 500) return; // key repeat 방지
  lastRestoreTime = now;

  if (!widgetWin || widgetWin.isDestroyed()) return;
  if (widgetWin.isMinimized()) widgetWin.restore();

  // Win+D는 DWM 클로킹으로 창을 숨김 — alwaysOnTop(true)으로만 뚫림.
  // pinToBottom으로 되돌리면 Win+D 상태에서 다시 사라지므로 유지.
  widgetWin.setAlwaysOnTop(true, "screen-saver");
  widgetWin.showInactive();

  console.log("[widget] restored via Alt+W");
}

function createWidgetWindow(): void {
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
    transparent: false,
    backgroundColor: "#141414",
    skipTaskbar: true,
    resizable: false,
    alwaysOnTop: false,
    focusable: false,
    show: false,
    hasShadow: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  widgetWin.loadURL("app://host/widget/index.html");

  widgetWin.webContents.on("did-fail-load", (_e, code, desc) => {
    console.error("[widget] load failed:", code, desc);
  });
  widgetWin.webContents.on("did-finish-load", () => {
    console.log("[widget] page loaded OK");
  });

  // Block regular minimize events
  (widgetWin as any).on("minimize", (e: Event & { preventDefault: () => void }) => {
    e.preventDefault();
    if (widgetWin && !widgetWin.isDestroyed()) {
      widgetWin.showInactive();
      pinToBottom(widgetWin.getNativeWindowHandle());
    }
  });

  widgetWin.once("ready-to-show", () => {
    console.log("[widget] ready-to-show fired");
    if (!widgetWin) return;
    widgetWin.showInactive();
    pinToBottom(widgetWin.getNativeWindowHandle());
  });

  widgetWin.on("closed", () => {
    widgetWin = null;
  });
}

// ── Editor Window (full calendar, center, popup) ──

function createEditorWindow(): void {
  if (editorWin && !editorWin.isDestroyed()) {
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
    transparent: false,
    backgroundColor: "#0a0a0a",
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

  editorWin.loadURL("app://host/calendar/index.html");

  editorWin.webContents.on("did-fail-load", (_e, code, desc) => {
    console.error("[editor] load failed:", code, desc);
  });

  editorWin.once("ready-to-show", () => {
    console.log("[editor] ready-to-show fired");
    editorWin?.show();
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

// ── Tray ──

function createTray(): void {
  const icon = nativeImage.createFromDataURL(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGElEQVQ4T2NkIAAYBygNAAIAAAAA//8DAAcAAf7QVKAAAAAASUVORK5CYII=",
  );

  tray = new Tray(icon);
  tray.setToolTip("College Calendar  |  Alt+W: 위젯 복원");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Open Editor",
      click: () => createEditorWindow(),
    },
    {
      label: "위젯 복원 (Alt+W)",
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

  // Left-click → toggle editor
  tray.on("click", () => {
    if (editorWin && !editorWin.isDestroyed()) {
      closeEditorWindow();
    } else {
      createEditorWindow();
    }
  });
}

// ── IPC ──

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

// ── App Lifecycle ──

app.whenReady().then(() => {
  console.log("[main] app ready");

  protocol.handle("app", (request) => {
    const url = new URL(request.url);
    let filePath = decodeURIComponent(url.pathname);
    if (filePath.startsWith("/")) {
      filePath = filePath.substring(1);
    }
    const fullPath = getOutPath(filePath);
    console.log("[protocol]", request.url, "→", fullPath);
    return net.fetch(pathToFileURL(fullPath).toString());
  });

  createWidgetWindow();
  createTray();

  // Alt+W → 위젯 복원 (Win+D로 사라진 경우 등)
  globalShortcut.register("Alt+W", () => {
    restoreWidget();
  });

  console.log("[main] widget + tray created, Alt+W registered");
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {});
