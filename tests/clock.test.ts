import { describe, expect, it } from 'vitest'
import { countdownSeconds, elapsedMs, emptyTimer, formatDuration, formatTime, initialState, localDateInput, nextDefaultSchedule, parseSchedule, resetMain, restoreState, setAutoStart, setSchedule, tick, toggleMain, toggleTimer } from '../src/clock'

const at = (time: string) => new Date(`2026-11-25T${time}`).getTime()

describe('scheduled broadcast', () => {
  it('waits at zero until the scheduled instant', () => {
    const state = initialState(at('18:00:00'))
    expect(tick(state, at('18:59:59.999'))).toBe(false)
    expect(elapsedMs(state.main, at('18:59:59.999'))).toBe(0)
    expect(tick(state, at('19:00:00'))).toBe(true)
    expect(elapsedMs(state.main, at('19:00:03'))).toBe(3000)
  })
  it('catches up to airtime when callbacks are delayed or the device wakes', () => {
    const state = initialState(at('18:00:00'))
    tick(state, at('20:05:02'))
    expect(formatDuration(elapsedMs(state.main, at('20:05:02')) / 1000)).toBe('01:05:02')
  })
  it('never goes negative and only reaches zero at airtime', () => {
    const state = initialState(at('18:00:00'))
    expect(countdownSeconds(state, at('18:59:59.999'))).toBe(1)
    expect(countdownSeconds(state, at('19:00:00'))).toBe(0)
    expect(countdownSeconds(state, at('21:00:00'))).toBe(0)
  })
  it('does not automatically resume a main timer paused after airtime', () => {
    const state = initialState(at('18:00:00'))
    tick(state, at('19:00:00'))
    toggleMain(state, at('19:00:10'))
    tick(state, at('19:01:00'))
    expect(state.main.startedAt).toBeNull()
    expect(elapsedMs(state.main, at('19:01:00'))).toBe(10000)
  })
  it('does not overwrite a manual early start', () => {
    const state = initialState(at('18:00:00'))
    toggleMain(state, at('18:59:00'))
    tick(state, at('19:00:01'))
    expect(elapsedMs(state.main, at('19:00:01'))).toBe(61000)
  })
  it('keeps manual control available with automatic start disabled', () => {
    const state = initialState(at('18:00:00'))
    setAutoStart(state, false, at('18:00:00'))
    expect(tick(state, at('19:01:00'))).toBe(false)
    expect(state.main.startedAt).toBeNull()
    toggleMain(state, at('19:01:00'))
    expect(elapsedMs(state.main, at('19:01:03'))).toBe(3000)
  })
  it('can enable automatic start after the scheduled instant', () => {
    const state = initialState(at('18:00:00'))
    setAutoStart(state, false, at('18:00:00'))
    setAutoStart(state, true, at('19:00:30'))
    expect(elapsedMs(state.main, at('19:00:30'))).toBe(30000)
  })
  it('reset after airtime stays at zero without retriggering', () => {
    const state = initialState(at('18:00:00'))
    tick(state, at('19:01:00'))
    resetMain(state, at('19:01:10'))
    tick(state, at('19:01:30'))
    setAutoStart(state, false, at('19:01:30'))
    setAutoStart(state, true, at('19:01:31'))
    expect(elapsedMs(state.main, at('19:02:00'))).toBe(0)
    expect(state.main.startedAt).toBeNull()
  })
  it('reset before airtime remains armed', () => {
    const state = initialState(at('18:00:00'))
    toggleMain(state, at('18:20:00'))
    resetMain(state, at('18:21:00'))
    tick(state, at('19:00:02'))
    expect(elapsedMs(state.main, at('19:00:02'))).toBe(2000)
  })
  it('reschedules the main timer without touching the independent timer', () => {
    const state = initialState(at('18:00:00'))
    toggleTimer(state.stopwatch, at('18:00:00'))
    tick(state, at('19:01:00'))
    setSchedule(state, at('21:00:00'))
    expect(state.main).toEqual(emptyTimer())
    expect(elapsedMs(state.stopwatch, at('19:01:00'))).toBe(3660000)
    expect(tick(state, at('21:00:00'))).toBe(true)
  })
  it('handles a scheduled instant on the next calendar day', () => {
    const state = initialState(at('23:59:30'))
    setSchedule(state, new Date('2026-11-26T00:00:00').getTime())
    expect(countdownSeconds(state, at('23:59:30'))).toBe(30)
    const afterMidnight = new Date('2026-11-26T00:00:05').getTime()
    tick(state, afterMidnight)
    expect(elapsedMs(state.main, afterMidnight)).toBe(5000)
  })
})

describe('independent stopwatch', () => {
  it('preserves fractional elapsed time across repeated pauses and resumes', () => {
    const timer = emptyTimer()
    toggleTimer(timer, 1000)
    toggleTimer(timer, 2500)
    expect(elapsedMs(timer, 10000)).toBe(1500)
    toggleTimer(timer, 10000)
    toggleTimer(timer, 13500)
    expect(elapsedMs(timer, 20000)).toBe(5000)
  })
  it('does not add negative time when the wall clock moves backwards', () => {
    const timer = { accumulatedMs: 500, startedAt: 10000 }
    expect(elapsedMs(timer, 9000)).toBe(500)
  })
  it('preserves hours beyond a full day', () => {
    expect(formatDuration(90061)).toBe('25:01:01')
    expect(formatDuration(360000)).toBe('100:00:00')
    expect(formatDuration(-1)).toBe('00:00:00')
  })
})

describe('local preferences and dates', () => {
  it('restores a running session across an application restart', () => {
    const original = initialState(at('18:00:00'))
    tick(original, at('19:00:00'))
    toggleTimer(original.stopwatch, at('19:00:30'))
    const recovered = restoreState(JSON.stringify(original), at('19:02:00'))
    expect(elapsedMs(recovered.main, at('19:02:00'))).toBe(120000)
    expect(elapsedMs(recovered.stopwatch, at('19:02:00'))).toBe(90000)
  })
  it('keeps a paused session paused after reopening', () => {
    const original = initialState(at('18:00:00'))
    tick(original, at('19:00:00'))
    toggleMain(original, at('19:00:15'))
    const recovered = restoreState(JSON.stringify(original), at('19:02:00'))
    tick(recovered, at('19:02:00'))
    expect(recovered.main.startedAt).toBeNull()
    expect(elapsedMs(recovered.main, at('19:02:00'))).toBe(15000)
  })
  it.each([null, '{broken', '{}', 'null', '{"version":99}', '{"version":1,"main":{"accumulatedMs":-5}}'])('recovers from invalid saved data: %s', raw => {
    expect(restoreState(raw, at('18:00:00'))).toEqual(initialState(at('18:00:00')))
  })
  it('initial schedule is always in the future', () => {
    expect(nextDefaultSchedule(at('18:00:00'))).toBe(at('19:00:00'))
    expect(localDateInput(nextDefaultSchedule(at('19:00:00')))).toBe('2026-11-26')
  })
  it('parses minute-precision local dates without timezone conversion', () => {
    const timestamp = parseSchedule('2026-11-26', '09:05')
    expect(timestamp).not.toBeNull()
    expect(formatTime(timestamp!)).toBe('09:05:00')
    expect(localDateInput(timestamp!)).toBe('2026-11-26')
  })
  it.each([['2026-02-30', '10:00'], ['2026-11-26', '24:00'], ['', '12:00'], ['2026-11-26', '12:88']])('rejects invalid dates and times: %s %s', (date, time) => {
    expect(parseSchedule(date, time)).toBeNull()
  })
})
