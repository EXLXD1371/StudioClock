import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { countdownSeconds, elapsedMs, emptyTimer, formatDuration, formatTime, restoreState, resetMain, setAutoStart, setSchedule, tick, toggleMain, toggleTimer } from './clock'

const STORAGE_KEY = 'studio-clock.state.v1'

export function useStudioClock() {
  const now = ref(Date.now())
  const storageError = ref(false)
  let raw: string | null = null
  try { raw = localStorage.getItem(STORAGE_KEY) } catch { storageError.value = true }
  const state = reactive(restoreState(raw, now.value))
  const persist = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); storageError.value = false }
    catch { storageError.value = true }
  }
  const update = () => {
    now.value = Date.now()
    if (tick(state, now.value)) persist()
  }
  update()
  persist()
  let interval: ReturnType<typeof setInterval> | undefined
  onMounted(() => {
    interval = setInterval(update, 100)
    document.addEventListener('visibilitychange', update)
    window.addEventListener('focus', update)
  })
  onUnmounted(() => {
    clearInterval(interval)
    document.removeEventListener('visibilitychange', update)
    window.removeEventListener('focus', update)
  })
  const action = (fn: (time: number) => void) => {
    now.value = Date.now()
    fn(now.value)
    persist()
  }
  return {
    now, state, storageError,
    wallClock: computed(() => formatTime(now.value)),
    mainTime: computed(() => formatDuration(elapsedMs(state.main, now.value) / 1000)),
    stopwatchTime: computed(() => formatDuration(elapsedMs(state.stopwatch, now.value) / 1000)),
    countdown: computed(() => formatDuration(countdownSeconds(state, now.value))),
    secondsRemaining: computed(() => countdownSeconds(state, now.value)),
    toggleMain: () => action(time => toggleMain(state, time)),
    resetMain: () => action(time => resetMain(state, time)),
    toggleStopwatch: () => action(time => toggleTimer(state.stopwatch, time)),
    resetStopwatch: () => action(() => { state.stopwatch = emptyTimer() }),
    setAutoStart: (enabled: boolean) => action(time => setAutoStart(state, enabled, time)),
    setSchedule: (timestamp: number) => action(time => { setSchedule(state, timestamp); tick(state, time) }),
  }
}
