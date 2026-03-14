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

  // Block Win+D from minimizing the widget
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

  // Fallback: periodically check if Win+D hid/minimized the widget and recover
  const recovery = setInterval(() => {
    if (!widgetWin || widgetWin.isDestroyed()) {
      clearInterval(recovery);
      return;
    }
    if (widgetWin.isMinimized() || !widgetWin.isVisible()) {
      console.log("[widget] recovered from hide/minimize (Win+D?)");
      widgetWin.restore();
      widgetWin.showInactive();
      pinToBottom(widgetWin.getNativeWindowHandle());
    }
  }, 500);

  widgetWin.on("closed", () => {
    widgetWin = null;
    clearInterval(recovery);
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
  tray.setToolTip("College Calendar");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Open Editor",
      click: () => createEditorWindow(),
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
  console.log("[main] widget + tray created");
});

app.on("window-all-closed", () => {});
