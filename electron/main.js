"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
let tray = null;
let editorWin = null;
function getWallpaperPath() {
    return path_1.default.join(electron_1.app.getPath("userData"), "calendar-wallpaper.png");
}
function setWindowsWallpaper(imagePath) {
    const escaped = imagePath.replace(/\\/g, "\\\\");
    const ps = [
        `Add-Type -TypeDefinition @"`,
        `using System.Runtime.InteropServices;`,
        `public class WP {`,
        `  [DllImport("user32.dll", CharSet = CharSet.Auto)]`,
        `  public static extern int SystemParametersInfo(int a, int b, string c, int d);`,
        `}`,
        `"@;`,
        `[WP]::SystemParametersInfo(20, 0, '${escaped}', 3);`,
    ].join(" ");
    try {
        (0, child_process_1.execSync)(`powershell -NoProfile -NonInteractive -Command "${ps}"`, {
            windowsHide: true,
        });
    }
    catch (e) {
        console.error("Wallpaper set failed:", e);
    }
}
function createEditorWindow() {
    const { width, height } = electron_1.screen.getPrimaryDisplay().workAreaSize;
    const winWidth = Math.min(1440, width);
    const winHeight = Math.min(960, height);
    editorWin = new electron_1.BrowserWindow({
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
            preload: path_1.default.join(__dirname, "preload.js"),
        },
    });
    editorWin.loadFile(path_1.default.join(__dirname, "../out/calendar/index.html"));
    editorWin.on("close", (e) => {
        e.preventDefault();
        editorWin?.hide();
    });
}
function createTray() {
    // 16x16 dark square icon
    const icon = electron_1.nativeImage.createFromDataURL("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGElEQVQ4T2NkIAAYBygNAAIAAAAA//8DAAcAAf7QVKAAAAAASUVORK5CYII=");
    tray = new electron_1.Tray(icon);
    tray.setToolTip("College Calendar");
    const contextMenu = electron_1.Menu.buildFromTemplate([
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
                electron_1.app.exit(0);
            },
        },
    ]);
    tray.setContextMenu(contextMenu);
    tray.on("click", () => {
        if (editorWin?.isVisible()) {
            editorWin.hide();
        }
        else {
            editorWin?.show();
            editorWin?.focus();
        }
    });
}
electron_1.ipcMain.handle("capture-wallpaper", async () => {
    if (!editorWin)
        return { success: false };
    try {
        const image = await editorWin.capturePage();
        const dest = getWallpaperPath();
        fs.writeFileSync(dest, image.toPNG());
        setWindowsWallpaper(dest);
        return { success: true };
    }
    catch (e) {
        return { success: false, error: String(e) };
    }
});
electron_1.ipcMain.on("close-window", () => {
    editorWin?.hide();
});
electron_1.app.whenReady().then(() => {
    createEditorWindow();
    createTray();
    editorWin?.show();
});
electron_1.app.on("window-all-closed", () => {
    // Stay in tray — do not quit
});
