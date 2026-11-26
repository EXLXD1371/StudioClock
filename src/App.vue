<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { ArrowUpRight, CalendarDays, Check, ChevronRight, Clock3, Maximize2, Minimize2, Minus, Pause, Pin, Play, Radio, RotateCcw, Settings2, Square, Sun, Timer, X } from 'lucide-vue-next'
import { formatTime, localDateInput, parseSchedule } from './clock'
import { useStudioClock } from './useStudioClock'
import { androidFullscreen, appWindow, fullscreen, isAndroid, isDesktop, keepScreenOn, screenKeptOn } from './native'

const clock = useStudioClock()
const { now, state, wallClock, mainTime, stopwatchTime, countdown, secondsRemaining, storageError } = clock
const dateText = computed(() => new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }).format(now.value))
const weekday = computed(() => new Intl.DateTimeFormat('zh-CN', { weekday: 'long' }).format(now.value))
const mainRunning = computed(() => state.main.startedAt !== null)
const stopwatchRunning = computed(() => state.stopwatch.startedAt !== null)
const mainStatus = computed(() => mainRunning.value ? '计时中' : state.main.accumulatedMs > 0 ? '已暂停' : '待机')
const scheduleDate = computed(() => {
  const day = localDateInput(state.scheduleAt)
  const tomorrow = new Date(now.value)
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (day === localDateInput(now.value)) return '今天'
  if (day === localDateInput(tomorrow.getTime())) return '明天'
  return new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric' }).format(state.scheduleAt)
})
const isFull = ref(androidFullscreen())
const keepAwake = ref(screenKeptOn())
const isPinned = ref(false)
const toast = ref('')
let toastTimer: ReturnType<typeof setTimeout> | undefined
function notify(message: string) {
  toast.value = message
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 3500)
}
async function nativeAction(action: () => Promise<unknown>) {
  try { await action() } catch { notify('窗口操作未完成，请重试') }
}
async function toggleFullscreen() {
  await nativeAction(async () => {
    const target = !isFull.value
    await fullscreen(target)
    isFull.value = target
  })
}
async function togglePin() {
  await nativeAction(async () => {
    if (!appWindow) return
    await appWindow.setAlwaysOnTop(!isPinned.value)
    isPinned.value = !isPinned.value
    notify(isPinned.value ? '窗口已置顶' : '已取消窗口置顶')
  })
}
function toggleKeepAwake() {
  keepAwake.value = !keepAwake.value
  keepScreenOn(keepAwake.value)
  notify(keepAwake.value ? '使用时保持屏幕常亮' : '已恢复系统自动息屏')
}
function androidFullscreenChanged(event: Event) { isFull.value = (event as CustomEvent<boolean>).detail }

const settings = ref<HTMLDialogElement | null>(null)
const draftDate = ref('')
const draftHour = ref('')
const draftMinute = ref('')
const formError = ref('')
const timeInput = ref<HTMLInputElement | null>(null)
async function openSettings() {
  draftDate.value = localDateInput(state.scheduleAt)
  draftHour.value = formatTime(state.scheduleAt).slice(0, 2)
  draftMinute.value = formatTime(state.scheduleAt).slice(3, 5)
  formError.value = ''
  settings.value?.showModal()
  await nextTick()
  timeInput.value?.focus()
}
function chooseDay(offset: number) {
  const day = new Date(Date.now())
  day.setDate(day.getDate() + offset)
  draftDate.value = localDateInput(day.getTime())
  formError.value = ''
}
function saveSchedule() {
  const timestamp = parseSchedule(draftDate.value, `${draftHour.value.padStart(2, '0')}:${draftMinute.value.padStart(2, '0')}`)
  if (timestamp === null) { formError.value = '请选择有效的开播日期和时间'; return }
  if (timestamp <= Date.now()) { formError.value = '开播时间已过去，请选择未来的时间'; return }
  clock.setSchedule(timestamp)
  settings.value?.close()
  notify('开播时间已更新，主计时已归零')
}
function onKeydown(event: KeyboardEvent) {
  if (event.repeat) return
  if (event.key === 'F11') { event.preventDefault(); void toggleFullscreen(); return }
  if (event.key === 'Escape' && !settings.value?.open && isFull.value) { event.preventDefault(); void toggleFullscreen(); return }
  if (settings.value?.open) return
  if ((event.ctrlKey || event.metaKey) && event.key === ',') { event.preventDefault(); void openSettings(); return }
  if (event.ctrlKey || event.metaKey || event.altKey || (event.target as HTMLElement)?.closest('input, textarea, select, button, [contenteditable="true"]')) return
  if (event.code === 'Space') { event.preventDefault(); clock.toggleMain() }
  if (event.code === 'KeyT') { event.preventDefault(); clock.toggleStopwatch() }
}
function browserFullscreenChanged() { isFull.value = !!document.fullscreenElement }
let stopResize: (() => void) | undefined
let destroyed = false
onMounted(async () => {
  window.addEventListener('keydown', onKeydown)
  document.addEventListener('fullscreenchange', browserFullscreenChanged)
  window.addEventListener('studio-fullscreen', androidFullscreenChanged)
  if (isAndroid) window.studioClockHandleBack = () => {
    if (settings.value?.open) { settings.value.close(); return true }
    if (isFull.value) { void toggleFullscreen(); return true }
    return false
  }
  const nativeWindow = appWindow
  if (nativeWindow) {
    await nativeAction(async () => {
      isFull.value = await nativeWindow.isFullscreen()
      isPinned.value = await nativeWindow.isAlwaysOnTop()
      const unlisten = await nativeWindow.onResized(async () => { isFull.value = await nativeWindow.isFullscreen() })
      if (destroyed) unlisten()
      else stopResize = unlisten
    })
  }
})
onUnmounted(() => {
  destroyed = true
  stopResize?.()
  clearTimeout(toastTimer)
  window.removeEventListener('keydown', onKeydown)
  document.removeEventListener('fullscreenchange', browserFullscreenChanged)
  window.removeEventListener('studio-fullscreen', androidFullscreenChanged)
  if (isAndroid) delete window.studioClockHandleBack
})
</script>

<template>
  <div class="studio" :class="{ 'is-fullscreen': isFull, 'is-android': isAndroid }">
    <header class="topbar" data-tauri-drag-region>
      <div class="brand" data-tauri-drag-region>
        <span class="brand-icon"><Clock3 :size="22" /><i></i></span>
        <span data-tauri-drag-region>演播时钟 <span class="brand-en">STUDIO CLOCK</span></span>
      </div>
      <div class="window-tools">
        <button v-if="isAndroid" class="icon-button" :class="{ active: keepAwake }" :aria-pressed="keepAwake" :title="keepAwake ? '关闭屏幕常亮' : '保持屏幕常亮'" aria-label="保持屏幕常亮" @click="toggleKeepAwake"><Sun :size="19" /></button>
        <button v-if="isDesktop" class="icon-button" :class="{ active: isPinned }" :aria-pressed="isPinned" :title="isPinned ? '取消置顶' : '窗口置顶'" aria-label="窗口置顶" @click="togglePin"><Pin :size="16" /></button>
        <button class="icon-button" :title="isFull ? '退出全屏 · F11' : '全屏显示 · F11'" :aria-label="isFull ? '退出全屏' : '全屏显示'" @click="toggleFullscreen"><Minimize2 v-if="isFull" :size="17" /><Maximize2 v-else :size="17" /></button>
        <span v-if="isDesktop" class="tool-divider"></span>
        <template v-if="isDesktop">
          <button class="icon-button" title="最小化" aria-label="最小化" @click="nativeAction(() => appWindow!.minimize())"><Minus :size="17" /></button>
          <button class="icon-button" title="最大化 / 还原" aria-label="最大化或还原" @click="nativeAction(() => appWindow!.toggleMaximize())"><Square :size="14" /></button>
          <button class="icon-button close-button" title="关闭" aria-label="关闭窗口" @click="nativeAction(() => appWindow!.close())"><X :size="19" /></button>
        </template>
      </div>
    </header>

    <main>
      <div class="page-heading">
        <div>
          <div class="date-line"><h1>{{ dateText }}</h1><span class="weekday">{{ weekday }}</span></div>
        </div>
        <span class="studio-status" :class="{ live: mainRunning }"><span class="status-dot"></span>{{ mainRunning ? 'ON AIR' : 'STANDBY' }}</span>
      </div>

      <section class="hero" aria-label="主时钟与主计时">
        <div class="clock-pane">
          <div class="panel-label"><Clock3 :size="17" /><h2>当前时间</h2><span class="small-en">LOCAL TIME</span></div>
          <div class="digits hero-digits" data-testid="wall-clock">{{ wallClock }}</div>
        </div>
        <div class="hero-divider"></div>
        <div class="clock-pane main-timer-pane">
          <div class="panel-label"><Radio :size="18" /><h2>主计时</h2><span class="timer-badge" :class="{ running: mainRunning }">{{ mainStatus }}</span></div>
          <div class="digits hero-digits" :class="{ muted: !mainRunning && state.main.accumulatedMs === 0, 'long-time': mainTime.length > 8 }" data-testid="main-time">{{ mainTime }}</div>
          <div class="hero-caption">{{ mainRunning ? '正在记录开播时长' : state.main.accumulatedMs > 0 ? '计时已暂停' : state.autoStart && !state.autoHandled ? '等待开播，届时自动开始' : '准备就绪，随时开始计时' }}</div>
        </div>
        <div class="hero-bottom-line"></div>
      </section>

      <section class="metric-grid" aria-label="开播与独立计时">
        <article class="metric-card schedule-card">
          <div class="metric-heading"><span class="panel-label"><CalendarDays :size="16" /><h2>开播时间</h2></span><button class="small-icon" title="设置开播时间 · Ctrl+," aria-label="设置开播时间" @click="openSettings"><ArrowUpRight :size="18" /></button></div>
          <div class="digits metric-digits" data-testid="scheduled-time">{{ formatTime(state.scheduleAt) }}</div>
          <button class="schedule-link" @click="openSettings">{{ scheduleDate }}<span>计划开播</span><ChevronRight :size="13" /></button>
        </article>
        <article class="metric-card">
          <div class="metric-heading"><span class="panel-label"><Timer :size="16" /><h2>计时时长</h2></span><span v-if="stopwatchRunning" class="recording-dot" title="独立计时中"></span></div>
          <div class="digits metric-digits" :class="{ 'long-time': stopwatchTime.length > 8 }" data-testid="stopwatch-time">{{ stopwatchTime }}</div>
        </article>
        <article class="metric-card countdown-card" :class="{ imminent: secondsRemaining > 0 && secondsRemaining <= 60 }">
          <div class="metric-heading"><span class="panel-label"><Radio :size="16" /><h2>距离开播</h2></span><span class="countdown-unit">{{ secondsRemaining > 0 ? '倒计时' : '已到点' }}</span></div>
          <div class="digits metric-digits" :class="{ 'long-time': countdown.length > 8 }" data-testid="countdown">{{ countdown }}</div>
          <div class="countdown-track"><div :style="{ width: `${Math.min(100, Math.max(0, (1 - secondsRemaining / 3600) * 100))}%` }"></div></div>
        </article>
      </section>

      <section class="controls" aria-label="计时控制">
        <div class="controls-heading"><span>控制台</span><span class="small-en">CONTROLS</span></div>
        <div class="control-row main-control-row">
          <div class="control-description"><span class="control-icon green"><Radio :size="18" /></span><div><h3>主计时</h3><p>记录本场开播时长</p></div></div>
          <label class="auto-control"><span>到点自动开始</span><input type="checkbox" role="switch" aria-label="主计时到点自动开始" :checked="state.autoStart" @change="clock.setAutoStart(($event.target as HTMLInputElement).checked)" /><span class="switch-track" aria-hidden="true"></span></label>
          <div class="control-actions"><button class="button primary" :aria-label="mainRunning ? '暂停主计时' : '开始主计时'" @click="clock.toggleMain"><Pause v-if="mainRunning" :size="15" fill="currentColor" /><Play v-else :size="15" fill="currentColor" />{{ mainRunning ? '暂停' : state.main.accumulatedMs > 0 ? '继续' : '开始' }}<kbd>Space</kbd></button><button class="button reset" aria-label="重置主计时" title="重置主计时" @click="clock.resetMain"><RotateCcw :size="15" /><span>重置</span></button></div>
        </div>
        <div class="control-row">
          <div class="control-description"><span class="control-icon red"><Timer :size="18" /></span><div><h3>独立计时</h3><p>自由计时，与开播互不影响</p></div></div>
          <span class="independent-hint">按需开始，随时暂停</span>
          <div class="control-actions"><button class="button secondary" :aria-label="stopwatchRunning ? '暂停独立计时' : '开始独立计时'" @click="clock.toggleStopwatch"><Pause v-if="stopwatchRunning" :size="15" fill="currentColor" /><Play v-else :size="15" fill="currentColor" />{{ stopwatchRunning ? '暂停' : state.stopwatch.accumulatedMs > 0 ? '继续' : '开始' }}<kbd>T</kbd></button><button class="button reset" aria-label="重置独立计时" title="重置独立计时" @click="clock.resetStopwatch"><RotateCcw :size="15" /><span>重置</span></button></div>
        </div>
      </section>

      <footer>
        <span class="save-status" :class="{ warning: storageError }"><span class="status-dot"></span>{{ storageError ? '本次设置无法保存' : '状态已自动保存' }}</span>
        <div class="footer-actions"><span v-if="isAndroid" class="fullscreen-hint">{{ keepAwake ? '屏幕常亮' : '自动息屏' }}</span><span v-else class="fullscreen-hint"><kbd>F11</kbd> 全屏</span><span class="footer-divider"></span><button @click="openSettings"><Settings2 :size="14" />开播设置</button></div>
      </footer>
    </main>

    <dialog ref="settings" class="settings-dialog" aria-labelledby="settings-title" @click="($event.target === settings) && settings?.close()">
      <form @submit.prevent="saveSchedule">
        <div class="dialog-heading"><span class="dialog-symbol"><CalendarDays :size="23" /></span><button type="button" class="icon-button" aria-label="关闭开播设置" @click="settings?.close()"><X :size="20" /></button></div>
        <div class="eyebrow">SCHEDULE YOUR BROADCAST</div>
        <h2 id="settings-title">设置开播时间</h2>
        <p class="dialog-intro">为下一场开播，留好每一秒。</p>
        <label class="field-label" for="broadcast-date">开播日期</label>
        <div class="date-input-row"><input id="broadcast-date" v-model="draftDate" type="date" required :min="localDateInput(now)" @input="formError = ''" /><button type="button" class="day-preset" @click="chooseDay(0)">今天</button><button type="button" class="day-preset" @click="chooseDay(1)">明天</button></div>
        <label class="field-label" for="broadcast-hour">开播时间 <span>24 小时制 · 精确到分钟</span></label>
        <div class="time-input-group">
          <div><input id="broadcast-hour" ref="timeInput" v-model="draftHour" aria-label="开播小时" type="text" inputmode="numeric" maxlength="2" pattern="[0-9]{1,2}" placeholder="19" required @input="formError = ''" @focus="timeInput?.select()" /><span>时 · 00–23</span></div>
          <span class="time-colon" aria-hidden="true">:</span>
          <div><input id="broadcast-minute" v-model="draftMinute" aria-label="开播分钟" type="text" inputmode="numeric" maxlength="2" pattern="[0-9]{1,2}" placeholder="00" required @input="formError = ''" @focus="($event.target as HTMLInputElement).select()" /><span>分 · 00–59</span></div>
          <Clock3 class="time-input-icon" :size="27" aria-hidden="true" />
        </div>
        <div class="schedule-note"><Clock3 :size="16" /><span>保存后主计时归零，独立计时不受影响。{{ state.autoStart ? '到点将自动开始主计时。' : '自动开始已关闭，请手动开始主计时。' }}</span></div>
        <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
        <div class="dialog-actions"><button type="button" class="button reset" @click="settings?.close()">取消</button><button type="submit" class="button primary"><Check :size="16" />保存开播时间</button></div>
      </form>
    </dialog>
    <Transition name="toast"><div v-if="toast" class="toast-message" role="status"><Check :size="16" />{{ toast }}</div></Transition>
  </div>
</template>
