import path from "node:path"
import fs from "node:fs"
import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"

import { iohook } from "@tkomde/iohook"
import { app, BrowserWindow, clipboard, ipcMain } from "electron"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const WEB_URL = process.env.SPEECHFLOW_WEB_URL || "http://localhost:4444"
const API_URL = process.env.SPEECHFLOW_API_URL || "http://localhost:4445/health"
const HOTKEY_HOLD_MS = 180
const HOTKEY_TAP_MAX_MS = 420
const HOTKEY_DOUBLE_TAP_GAP_MS = 400
const CTRL_LEFT = 0x001d
const CTRL_RIGHT = 0x0e1d
const WIN_LEFT = 0x0e5b
const WIN_RIGHT = 0x0e5c
const ELECTRON_USER_DATA = path.join(process.cwd(), ".electron-data")
const nativeHookEnabled = process.env.SPEECHFLOW_ENABLE_NATIVE_HOOK !== "0"

app.commandLine.appendSwitch("no-sandbox")
fs.mkdirSync(ELECTRON_USER_DATA, { recursive: true })
app.setPath("userData", ELECTRON_USER_DATA)

let managementWindow = null
let dictationWindow = null
let hotkeyTimer = null
let isQuitting = false
let hotkeyState = {
  ctrlDown: false,
  winDown: false,
  chordActive: false,
  chordStartedAt: 0,
  chordTriggered: false,
  lastTapReleasedAt: 0,
  lastTriggerAt: 0,
}

function createWindow(url, options = {}) {
  const window = new BrowserWindow({
    width: 1440,
    height: 1024,
    backgroundColor: "#060b14",
    show: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      ...options.webPreferences,
    },
    ...options,
  })

  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }))
  window.webContents.session.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === "media" || permission === "mediaKeySystem")
  })
  void window.loadURL(url)
  return window
}

function wirePersistentWindowBehavior(window) {
  window.on("minimize", (event) => {
    event.preventDefault()
    window.hide()
  })

  window.on("close", (event) => {
    if (isQuitting) return
    event.preventDefault()
    window.hide()
  })
}

function showManagementWindow() {
  if (managementWindow && !managementWindow.isDestroyed()) {
    managementWindow.show()
    managementWindow.focus()
    return managementWindow
  }

  managementWindow = createWindow(WEB_URL)
  wirePersistentWindowBehavior(managementWindow)
  managementWindow.on("closed", () => {
    managementWindow = null
  })
  return managementWindow
}

async function waitForService(url, timeoutMs = 60000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { method: "GET" })
      if (response.ok) return true
    } catch {
      // Keep polling until the frontend is reachable.
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  return false
}

async function waitForWebApp(timeoutMs = 60000) {
  await waitForService(WEB_URL, timeoutMs)
  await waitForService(API_URL, timeoutMs)
  return true
}

function showDictationWindow() {
  if (dictationWindow && !dictationWindow.isDestroyed()) {
    dictationWindow.show()
    dictationWindow.focus()
    void dictationWindow.loadURL(`${WEB_URL}/dictation?desktop=1`)
    return dictationWindow
  }

  dictationWindow = createWindow(`${WEB_URL}/dictation?desktop=1`, {
    width: 1120,
    height: 980,
    resizable: true,
    minimizable: false,
    maximizable: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
    },
  })
  wirePersistentWindowBehavior(dictationWindow)

  dictationWindow.on("closed", () => {
    dictationWindow = null
  })

  return dictationWindow
}

async function finalizeDictation(text) {
  if (typeof text !== "string" || text.length === 0) {
    return false
  }

  clipboard.writeText(text)
  if (dictationWindow && !dictationWindow.isDestroyed()) {
    dictationWindow.hide()
  }
  setTimeout(() => {
    void pasteIntoActiveWindow()
  }, 180)
  return true
}

async function pasteIntoActiveWindow() {
  if (process.platform !== "win32") return

  const command = "$wshell = New-Object -ComObject WScript.Shell; Start-Sleep -Milliseconds 120; $wshell.SendKeys('^v')"
  spawn("powershell.exe", ["-NoProfile", "-WindowStyle", "Hidden", "-Command", command], {
    detached: true,
    stdio: "ignore",
  }).unref()
}

function isHotkeyKey(keycode) {
  return keycode === CTRL_LEFT || keycode === CTRL_RIGHT || keycode === WIN_LEFT || keycode === WIN_RIGHT
}

function resetHotkeyState() {
  hotkeyState = {
    ctrlDown: false,
    winDown: false,
    chordActive: false,
    chordStartedAt: 0,
    chordTriggered: false,
    lastTapReleasedAt: 0,
    lastTriggerAt: hotkeyState.lastTriggerAt,
  }
}

function triggerDictationFromHotkey() {
  const now = Date.now()
  if (now - hotkeyState.lastTriggerAt < 250) return

  hotkeyState.lastTriggerAt = now
  hotkeyState.lastTapReleasedAt = 0
  hotkeyState.chordTriggered = true
  showDictationWindow()
}

function updateHotkeyState(event) {
  if (!event || (event.type !== "keydown" && event.type !== "keyup")) return
  if (!isHotkeyKey(event.keycode)) return

  const now = Date.now()
  const wasChordActive = hotkeyState.ctrlDown && hotkeyState.winDown

  if (event.type === "keydown") {
    if (event.keycode === CTRL_LEFT || event.keycode === CTRL_RIGHT) {
      hotkeyState.ctrlDown = true
    }
    if (event.keycode === WIN_LEFT || event.keycode === WIN_RIGHT) {
      hotkeyState.winDown = true
    }

    if (hotkeyState.ctrlDown && hotkeyState.winDown) {
      if (!hotkeyState.chordActive) {
        hotkeyState.chordActive = true
        hotkeyState.chordStartedAt = now
        hotkeyState.chordTriggered = false
      }

      if (!hotkeyState.chordTriggered && now - hotkeyState.chordStartedAt >= HOTKEY_HOLD_MS) {
        triggerDictationFromHotkey()
      }
    }
    return
  }

  if (event.keycode === CTRL_LEFT || event.keycode === CTRL_RIGHT) {
    hotkeyState.ctrlDown = false
  }
  if (event.keycode === WIN_LEFT || event.keycode === WIN_RIGHT) {
    hotkeyState.winDown = false
  }

  const chordStillActive = hotkeyState.ctrlDown && hotkeyState.winDown
  if (wasChordActive && !chordStillActive) {
    const heldFor = now - hotkeyState.chordStartedAt

    if (!hotkeyState.chordTriggered && heldFor >= 30 && heldFor <= HOTKEY_TAP_MAX_MS) {
      if (hotkeyState.lastTapReleasedAt && now - hotkeyState.lastTapReleasedAt <= HOTKEY_DOUBLE_TAP_GAP_MS) {
        triggerDictationFromHotkey()
        hotkeyState.lastTapReleasedAt = 0
        return
      }

      hotkeyState.lastTapReleasedAt = now
    }

    hotkeyState.chordActive = false
    hotkeyState.chordStartedAt = 0
    hotkeyState.chordTriggered = false
  }
}

app.whenReady().then(() => {
  if (nativeHookEnabled) {
    iohook.on("keydown", updateHotkeyState)
    iohook.on("keyup", updateHotkeyState)
    iohook.start()

    hotkeyTimer = setInterval(() => {
      if (hotkeyState.chordActive && !hotkeyState.chordTriggered) {
        const heldFor = Date.now() - hotkeyState.chordStartedAt
        if (heldFor >= HOTKEY_HOLD_MS) {
          triggerDictationFromHotkey()
        }
      }
    }, 50)
  } else {
    console.log("Native hotkey hook disabled for startup diagnostics.")
  }

  void (async () => {
    await waitForWebApp()
    showManagementWindow()
  })
})

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    showManagementWindow()
  }
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
  }
})

app.on("before-quit", () => {
  isQuitting = true
  if (hotkeyTimer) {
    clearInterval(hotkeyTimer)
    hotkeyTimer = null
  }
  if (nativeHookEnabled) {
    iohook.removeAllListeners()
    iohook.stop()
    iohook.unload()
  }
})

ipcMain.handle("desktop:complete-dictation", async (_event, text) => {
  return finalizeDictation(text)
})
