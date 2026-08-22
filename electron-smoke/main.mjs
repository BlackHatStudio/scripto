import { app, BrowserWindow } from "electron"

app.whenReady().then(() => {
  const win = new BrowserWindow({ width: 400, height: 300, show: false })
  win.loadURL("data:text/plain,smoke")
})
