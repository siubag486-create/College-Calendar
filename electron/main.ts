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

let tray: Tray | null = null;
let editorWin: BrowserWindow | null = null;

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

function createTray(): void {
  // 16x16 dark square icon
  const icon = nativeImage.createFromDataURL(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGElEQVQ4T2NkIAAYBygNAAIAAAAA//8DAAcAAf7QVKAAAAAASUVORK5CYII="
  );

  tray = new Tray(icon);
  tray.setToolTip("College Calendar");

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
      label: "Quit",
      click: () => {
        tray?.destroy();
        app.exit(0);
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

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
