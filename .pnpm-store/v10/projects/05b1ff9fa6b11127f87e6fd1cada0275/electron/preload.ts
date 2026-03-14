import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  openEditor: () => ipcRenderer.send("open-editor"),
  closeEditor: () => ipcRenderer.send("close-editor"),
  notifyAssignmentsChanged: () => ipcRenderer.send("assignments-changed"),
  onAssignmentsChanged: (callback: () => void) => {
    ipcRenderer.on("assignments-changed", () => {
      callback();
    });
  },
});
