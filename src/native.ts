import { isTauri } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'

interface AndroidBridge {
  setFullscreen(enabled: boolean): void
  isFullscreen(): boolean
  setKeepScreenOn(enabled: boolean): void
  isKeepScreenOn(): boolean
}

declare global {
  interface Window {
    StudioClockAndroid?: AndroidBridge
    studioClockHandleBack?: () => boolean
  }
}

export const isAndroid = !!window.StudioClockAndroid
export const isDesktop = isTauri() && !isAndroid
export const appWindow = isDesktop ? getCurrentWindow() : null

export function androidFullscreen(): boolean { return window.StudioClockAndroid?.isFullscreen() ?? false }
export function screenKeptOn(): boolean { return window.StudioClockAndroid?.isKeepScreenOn() ?? false }
export function keepScreenOn(enabled: boolean): void { window.StudioClockAndroid?.setKeepScreenOn(enabled) }

export async function fullscreen(enabled: boolean): Promise<void> {
  if (isAndroid) window.StudioClockAndroid!.setFullscreen(enabled)
  else if (appWindow) await appWindow.setFullscreen(enabled)
  else if (enabled) await document.documentElement.requestFullscreen()
  else if (document.fullscreenElement) await document.exitFullscreen()
}
