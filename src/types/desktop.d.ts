export {}

declare global {
  interface Window {
    speechflowDesktop?: {
      completeDictation: (text: string) => Promise<boolean>
    }
    chrome?: {
      webview?: {
        postMessage: (message: unknown) => void
        addEventListener: (type: "message", listener: (event: any) => void) => void
        removeEventListener: (type: "message", listener: (event: any) => void) => void
      }
    }
  }
}
