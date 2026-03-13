import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  captureWallpaper: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("capture-wallpaper"),
  closeWindow: () => ipcRenderer.send("close-window"),
  toggleLiveMode: (): Promise<{ success: boolean; isLive: boolean; error?: string }> =>
    ipcRenderer.invoke("toggle-live-mode"),
  getLiveModeStatus: (): Promise<{ isLive: boolean }> =>
    ipcRenderer.invoke("get-live-mode-status"),
  onLiveModeChanged: (callback: (isLive: boolean) => void) => {
    ipcRenderer.on("live-mode-changed", (_event, isLive: boolean) => {
      callback(isLive);
    });
  },
  syncWallpaper: () => ipcRenderer.send("sync-wallpaper"),
});
