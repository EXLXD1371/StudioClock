export interface Timer {
  accumulatedMs: number
  startedAt: number | null
}

export interface ClockState {
  version: 1
  scheduleAt: number
  autoStart: boolean
  autoHandled: boolean
  main: Timer
  stopwatch: Timer
}

export const emptyTimer = (): Timer => ({ accumulatedMs: 0, startedAt: null })

export function nextDefaultSchedule(now: number): number {
  const date = new Date(now)
  date.setHours(19, 0, 0, 0)
  if (date.getTime() <= now) date.setDate(date.getDate() + 1)
  return date.getTime()
}

export function initialState(now: number): ClockState {
  return {
    version: 1,
    scheduleAt: nextDefaultSchedule(now),
    autoStart: true,
    autoHandled: false,
    main: emptyTimer(),
    stopwatch: emptyTimer(),
  }
}

export function elapsedMs(timer: Timer, now: number): number {
  return timer.accumulatedMs + (timer.startedAt === null ? 0 : Math.max(0, now - timer.startedAt))
}

export function toggleTimer(timer: Timer, now: number): void {
  if (timer.startedAt === null) {
    timer.startedAt = now
  } else {
    timer.accumulatedMs = elapsedMs(timer, now)
    timer.startedAt = null
  }
}

// Anchor to the scheduled instant, so throttled callbacks and sleep do not lose time.
export function tick(state: ClockState, now: number): boolean {
  if (!state.autoStart || state.autoHandled || now < state.scheduleAt) return false
  state.autoHandled = true
  if (state.main.startedAt === null) state.main.startedAt = state.scheduleAt
  return true
}

export function toggleMain(state: ClockState, now: number): void {
  tick(state, now)
  toggleTimer(state.main, now)
  if (now >= state.scheduleAt) state.autoHandled = true
}

export function resetMain(state: ClockState, now: number): void {
  state.main = emptyTimer()
  // A reset after airtime stays at zero until explicitly started or rescheduled.
  state.autoHandled = now >= state.scheduleAt
}

export function setAutoStart(state: ClockState, enabled: boolean, now: number): void {
  state.autoStart = enabled
  if (enabled) tick(state, now)
}

export function setSchedule(state: ClockState, timestamp: number): void {
  if (!Number.isFinite(timestamp)) throw new Error('无效的开播时间')
  state.scheduleAt = timestamp
  state.autoHandled = false
  state.main = emptyTimer()
}

export function countdownSeconds(state: ClockState, now: number): number {
  return Math.max(0, Math.ceil((state.scheduleAt - now) / 1000))
}

export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const hh = Math.floor(seconds / 3600).toString().padStart(2, '0')
  const mm = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0')
  const ss = (seconds % 60).toString().padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

export function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return [date.getHours(), date.getMinutes(), date.getSeconds()].map(n => String(n).padStart(2, '0')).join(':')
}

export function localDateInput(timestamp: number): string {
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function parseSchedule(date: string, time: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null
  const timestamp = new Date(`${date}T${time}:00`).getTime()
  if (!Number.isFinite(timestamp) || localDateInput(timestamp) !== date || formatTime(timestamp).slice(0, 5) !== time) return null
  return timestamp
}

const validNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < 8.64e15
function isTimer(value: unknown): value is Timer {
  if (!value || typeof value !== 'object') return false
  const timer = value as Timer
  return validNumber(timer.accumulatedMs) && (timer.startedAt === null || validNumber(timer.startedAt))
}

export function restoreState(raw: string | null, now: number): ClockState {
  try {
    const data: unknown = JSON.parse(raw ?? 'null')
    if (data && typeof data === 'object') {
      const s = data as ClockState
      if (s.version === 1 && validNumber(s.scheduleAt) && typeof s.autoStart === 'boolean' && typeof s.autoHandled === 'boolean' && isTimer(s.main) && isTimer(s.stopwatch)) {
        return { version: 1, scheduleAt: s.scheduleAt, autoStart: s.autoStart, autoHandled: s.autoHandled, main: { ...s.main }, stopwatch: { ...s.stopwatch } }
      }
    }
  } catch { /* A corrupt preference must never prevent the clock from opening. */ }
  return initialState(now)
}
