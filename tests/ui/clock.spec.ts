import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-25T18:59:54+08:00') })
  await page.clock.pauseAt(new Date('2026-11-25T18:59:55+08:00'))
  await page.goto('/')
})

test('automatically starts at airtime, pauses, resumes, and stays reset', async ({ page }) => {
  await expect(page.getByTestId('main-time')).toHaveText('00:00:00')
  await expect(page.getByTestId('countdown')).toHaveText('00:00:05')
  await page.clock.runFor(8000)
  await expect(page.getByTestId('main-time')).toHaveText('00:00:03')
  await expect(page.getByTestId('countdown')).toHaveText('00:00:00')
  await page.getByRole('button', { name: '暂停主计时', exact: true }).click()
  await page.clock.runFor(5000)
  await expect(page.getByTestId('main-time')).toHaveText('00:00:03')
  await page.getByRole('button', { name: '开始主计时', exact: true }).click()
  await page.clock.runFor(2000)
  await expect(page.getByTestId('main-time')).toHaveText('00:00:05')
  await page.getByRole('button', { name: '重置主计时', exact: true }).click()
  await page.clock.runFor(3000)
  await expect(page.getByTestId('main-time')).toHaveText('00:00:00')
})

test('independent timer survives pause, reload, and schedule changes', async ({ page }) => {
  await page.getByRole('button', { name: '开始独立计时', exact: true }).click()
  await page.clock.runFor(3000)
  await page.getByRole('button', { name: '暂停独立计时', exact: true }).click()
  await page.reload()
  await expect(page.getByTestId('stopwatch-time')).toHaveText('00:00:03')
  await page.getByRole('button', { name: '设置开播时间', exact: true }).click()
  await page.getByLabel('开播日期', { exact: true }).fill('2026-11-26')
  await page.getByLabel('开播小时', { exact: true }).fill('10')
  await page.getByLabel('开播分钟', { exact: true }).fill('30')
  await page.getByRole('button', { name: '保存开播时间' }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await expect(page.getByTestId('scheduled-time')).toHaveText('10:30:00')
  await expect(page.getByTestId('stopwatch-time')).toHaveText('00:00:03')
  await page.reload()
  await expect(page.getByTestId('scheduled-time')).toHaveText('10:30:00')
  await expect(page.getByTestId('stopwatch-time')).toHaveText('00:00:03')
})

test('automatic start can be disabled and manual shortcuts remain available', async ({ page }) => {
  await page.getByRole('switch').uncheck()
  await page.clock.runFor(8000)
  await expect(page.getByTestId('main-time')).toHaveText('00:00:00')
  await page.locator('h1').click()
  await page.keyboard.press('Space')
  await page.keyboard.press('t')
  await page.clock.runFor(2000)
  await expect(page.getByTestId('main-time')).toHaveText('00:00:02')
  await expect(page.getByTestId('stopwatch-time')).toHaveText('00:00:02')
})

test('past schedule is rejected and settings dialog supports Escape', async ({ page }) => {
  await page.keyboard.press('Control+,')
  await page.getByLabel('开播小时', { exact: true }).fill('18')
  await page.getByLabel('开播分钟', { exact: true }).fill('00')
  await page.getByRole('button', { name: '保存开播时间' }).click()
  await expect(page.getByRole('alert')).toContainText('开播时间已过去')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await expect(page.getByTestId('scheduled-time')).toHaveText('19:00:00')
})

test('all resources load locally with no script errors or horizontal overflow', async ({ page }) => {
  const errors: string[] = []
  const external: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:1420')) external.push(request.url()) })
  await page.reload()
  await expect(page.getByTestId('wall-clock')).toHaveText('18:59:55')
  await page.screenshot({ path: '.runtime/screenshots/desktop.png', fullPage: true })
  for (const size of [{ width: 760, height: 660 }, { width: 1920, height: 1080 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(size)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    if (size.width >= 760) expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true)
  }
  await page.setViewportSize({ width: 1120, height: 800 })
  await page.getByRole('button', { name: '设置开播时间', exact: true }).click()
  await page.screenshot({ path: '.runtime/screenshots/settings.png' })
  expect(errors).toEqual([])
  expect(external).toEqual([])
})
