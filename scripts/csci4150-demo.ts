import { chromium, expect } from '@playwright/test'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defaultSettings } from '../src/domain/contracts'
import { instant, localDate, localTime } from '../src/domain/time'
import { Store } from '../src/server/store.server'

const output = resolve(process.argv[2] || 'artifacts/csci4150-demo')
mkdirSync(output, { recursive: true })
const database = resolve(output, 'demo.sqlite')
const now = new Date().toISOString()
const zone = 'America/New_York'
const requestedDate = process.argv[3] || '2026-12-01'
if (requestedDate <= localDate(now, zone))
  throw new Error('Choose a future date for the demo clock')
const store = new Store(database)
try {
  if (store.snapshot().events.length)
    throw new Error('Use a fresh demo directory')
  store.saveSettings({ ...defaultSettings, workingDays: [1, 2, 3, 4, 5, 6, 7] })
  store.db.prepare('INSERT INTO events (id, data) VALUES (?, ?)').run(
    'class',
    JSON.stringify({
      id: 'class',
      title: 'Seminar',
      start: instant(requestedDate, '14:00', zone),
      end: instant(requestedDate, '15:50', zone),
      timezone: zone,
      taskId: null,
      version: 1,
    }),
  )
  const preference = {
    kind: 'soft' as const,
    days: [1, 2, 3, 4, 5, 6, 7],
    expiresOn: null,
  }
  const old = store.savePreference(
    {
      ...preference,
      text: 'Prefer morning study',
      startTime: '09:00',
      endTime: '11:00',
      effectiveFrom: '2026-09-01',
      supersedesId: null,
    },
    now,
  )
  store.savePreference(
    {
      ...preference,
      text: 'Prefer afternoon study',
      startTime: '16:00',
      endTime: '18:00',
      effectiveFrom: '2026-11-01',
      supersedesId: old.id,
    },
    now,
  )
} finally {
  store.close()
}
const port = 3026
const url = 'http://127.0.0.1:' + port
const preview = spawn(
  process.execPath,
  [
    'node_modules/vite/bin/vite.js',
    'preview',
    '--host',
    '127.0.0.1',
    '--port',
    String(port),
    '--strictPort',
  ],
  {
    env: { ...process.env, SCHEDULING_DB_PATH: database },
    stdio: ['ignore', 'pipe', 'pipe'],
  },
)
const serverLog: string[] = []
preview.stdout.on('data', (line) => serverLog.push(String(line)))
preview.stderr.on('data', (line) => serverLog.push(String(line)))
const browser = await chromium.launch({ channel: 'chrome' })
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  timezoneId: zone,
  recordVideo: { dir: output, size: { width: 1440, height: 900 } },
})
const page = await context.newPage()
const video = page.video()
const errors: string[] = []
page.on('pageerror', (error) => errors.push(error.message))
const steps: Record<string, number> = {}
const start = Date.now()
const mark = (step: string) => {
  steps[step] = Math.round((Date.now() - start) / 100) / 10
}
const hold = (seconds: number) =>
  new Promise<void>((done) => setTimeout(done, seconds * 1000))
const request = page.getByRole('textbox', { name: /Enter scheduling request/ })
const pending = page.locator('[data-testid="proposal"][data-status="pending"]')
const send = async (text: string) => {
  await request.fill(text)
  await hold(3)
  await page.getByRole('button', { name: 'Send', exact: true }).click()
}
const savedEvent = page
  .locator('.schedule-event-course')
  .filter({ hasText: 'Seminar notes' })
try {
  await expect
    .poll(
      async () => {
        if (preview.exitCode !== null) throw new Error(serverLog.join(''))
        try {
          return (await fetch(url)).status
        } catch {
          return 0
        }
      },
      { timeout: 18000 },
    )
    .toBe(200)
  await page.goto(url)
  await expect(
    page.getByText('Saved events (1)', { exact: true }),
  ).toBeVisible()
  const next = page.getByRole('button', { name: 'Next', exact: true })
  for (
    let index = 0;
    index < 5 &&
    !(await page.getByText('Seminar', { exact: true }).first().isVisible());
    index++
  )
    await next.click()
  await expect(page.getByText('Seminar', { exact: true }).first()).toBeVisible()
  mark('agenda')
  await hold(3)
  await send(
    'Use my current preferences to schedule Seminar notes on ' +
      requestedDate +
      ' for 90 minutes, not before 15:50 and finish by 17:00.',
  )
  await expect(page.getByText(/No slot satisfies the duration/)).toBeVisible({
    timeout: 30000,
  })
  await expect(
    page.getByText('Saved events (1)', { exact: true }),
  ).toBeVisible()
  mark('conflict')
  await hold(5)
  await send(
    'Change the duration to 60 minutes. Keep the date and time bounds.',
  )
  await expect(pending).toHaveCount(1, { timeout: 30000 })
  await expect(pending).toContainText('16:00')
  await expect(pending).toContainText('17:00')
  await pending.locator('summary').click()
  await expect(pending).toContainText('Replaced by a newer effective record')
  await expect(
    page.getByText('Saved events (1)', { exact: true }),
  ).toBeVisible()
  await pending.scrollIntoViewIfNeeded()
  mark('pending')
  await page.screenshot({ path: resolve(output, 'pending.png') })
  await hold(8)
  await pending
    .getByRole('button', { name: 'Approve & save', exact: true })
    .click()
  await expect(
    page.getByText('Saved events (2)', { exact: true }),
  ).toBeVisible()
  await expect(savedEvent).toBeVisible()
  mark('saved')
  await page.screenshot({ path: resolve(output, 'saved.png') })
  await hold(4)
  await page.reload()
  await expect(
    page.getByText('Saved events (2)', { exact: true }),
  ).toBeVisible()
  for (let index = 0; index < 5 && !(await savedEvent.isVisible()); index++)
    await next.click()
  await expect(savedEvent).toBeVisible()
  const reopened = new Store(database)
  try {
    const confirmed = reopened
      .snapshot()
      .events.find(({ title }) => title === 'Seminar notes')
    if (!confirmed || localTime(confirmed.start, zone) !== '16:00')
      throw new Error('Persistence check failed')
  } finally {
    reopened.close()
  }
  mark('reloaded')
  await hold(Math.max(5, 43 - (Date.now() - start) / 1000))
  expect(errors).toEqual([])
  writeFileSync(
    resolve(output, 'capture.json'),
    JSON.stringify(
      { date: requestedDate, steps, errors, fixture: 'synthetic' },
      null,
      2,
    ),
  )
} finally {
  await context.close()
  if (video) copyFileSync(await video.path(), resolve(output, 'capture.webm'))
  await browser.close()
  if (preview.exitCode === null && preview.signalCode === null) {
    const closed = once(preview, 'exit')
    preview.kill('SIGTERM')
    await closed
  }
  writeFileSync(resolve(output, 'server.log'), serverLog.join(''))
}
