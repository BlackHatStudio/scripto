import { contextBridge, ipcRenderer } from "electron"

contextBridge.exposeInMainWorld("speechflowDesktop", {
  completeDictation: (text) => ipcRenderer.invoke("desktop:complete-dictation", text),
})
