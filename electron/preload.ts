import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  captureWallpaper: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("capture-wallpaper"),
  closeWindow: () => ipcRenderer.send("close-window"),
});
