"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld("electronAPI", {
    captureWallpaper: () => electron_1.ipcRenderer.invoke("capture-wallpaper"),
    closeWindow: () => electron_1.ipcRenderer.send("close-window"),
});
