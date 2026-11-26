import { test, expect } from '@playwright/test'

test.use({ hasTouch: true, viewport: { width: 1280, height: 800 } })

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    let full = true
    let awake = true
    window.StudioClockAndroid = {
      isFullscreen: () => full,
      isKeepScreenOn: () => awake,
      setFullscreen: enabled => {
        full = enabled
        window.dispatchEvent(new CustomEvent('studio-fullscreen', { detail: enabled }))
      },
      setKeepScreenOn: enabled => { awake = enabled },
    }
  })
  await page.goto('/')
})

test('tablet controls use the Android bridge and back dismisses dialogs before fullscreen', async ({ page }) => {
  await expect(page.locator('.studio')).toHaveClass(/is-android/)
  await expect(page.getByRole('button', { name: '窗口置顶' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '最小化' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '退出全屏' })).toBeVisible()
  const awake = page.getByRole('button', { name: '保持屏幕常亮' })
  await expect(awake).toHaveAttribute('aria-pressed', 'true')
  await awake.tap()
  expect(await page.evaluate(() => window.StudioClockAndroid!.isKeepScreenOn())).toBe(false)
  await page.getByRole('button', { name: '设置开播时间', exact: true }).tap()
  expect(await page.evaluate(() => window.studioClockHandleBack?.())).toBe(true)
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await expect(page.getByRole('button', { name: '退出全屏' })).toBeVisible()
  expect(await page.evaluate(() => window.studioClockHandleBack?.())).toBe(true)
  await expect(page.getByRole('button', { name: '全屏显示' })).toBeVisible()
  expect(await page.evaluate(() => window.studioClockHandleBack?.())).toBe(false)
})

test('tablet landscape and portrait layouts keep clocks and controls within the screen', async ({ page }) => {
  for (const size of [{ width: 1280, height: 800 }, { width: 960, height: 600 }, { width: 800, height: 1280 }, { width: 768, height: 1024 }]) {
    await page.setViewportSize(size)
    const geometry = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, viewportWidth: innerWidth, viewportHeight: innerHeight }))
    expect(geometry.width, `${size.width}x${size.height} horizontal overflow`).toBeLessThanOrEqual(geometry.viewportWidth)
    expect(geometry.height, `${size.width}x${size.height} vertical overflow`).toBeLessThanOrEqual(geometry.viewportHeight)
    for (const id of ['wall-clock', 'main-time', 'stopwatch-time', 'countdown']) {
      const fits = await page.getByTestId(id).evaluate(el => el.scrollWidth <= el.clientWidth)
      expect(fits, `${id} fits at ${size.width}x${size.height}`).toBe(true)
    }
    if (size.width === 1280 || size.width === 800) await page.screenshot({ path: `.runtime/screenshots/android-${size.width}.png` })
  }
})
