import { chromium, expect } from '@playwright/test'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createServer } from 'node:net'
import { mkdirSync, createWriteStream, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Store } from '../src/server/store.server'
import { seedFallCalendar } from './fixtures/fall-2026'

const output = resolve(
  `artifacts/presentation-${new Date().toISOString().replaceAll(':', '-')}`,
)
mkdirSync(output, { recursive: true })
const database = `${output}/calendar.sqlite`
const store = new Store(database)
seedFallCalendar(store)
store.close()
await new Promise<void>((accept, reject) => {
  const probe = createServer()
  probe.once('error', reject)
  probe.listen(3004, '127.0.0.1', () => probe.close(() => accept()))
})
const log = createWriteStream(`${output}/server.log`)
const server = spawn(
  process.execPath,
  [
    'node_modules/vite/bin/vite.js',
    'preview',
    '--host',
    '127.0.0.1',
    '--port',
    '3004',
    '--strictPort',
  ],
  {
    env: { ...process.env, SCHEDULING_DB_PATH: database },
    stdio: ['ignore', 'pipe', 'pipe'],
  },
)
server.stdout.pipe(log)
server.stderr.pipe(log)
const browser = await chromium.launch({ channel: 'chrome' })
const context = await browser.newContext({
  viewport: { width: 1680, height: 1050 },
  timezoneId: 'America/Los_Angeles',
})
await context.tracing.start({
  screenshots: true,
  snapshots: true,
  sources: true,
})
const page = await context.newPage()
const errors: string[] = []
page.on('pageerror', (error) => errors.push(error.message))
const images: string[] = []
const prompts: string[] = []
const screenshot = async (name: string) => {
  await page.screenshot({ path: `${output}/${name}.png`, fullPage: true })
  images.push(`${name}.png`)
}
const pending = page.locator('[data-testid="proposal"][data-status="pending"]')
const send = async (text: string, followup = false) => {
  const checkbox = page.getByRole('checkbox', {
    name: 'Include previous clarification',
  })
  if (await checkbox.count()) await checkbox.setChecked(followup)
  await page
    .getByRole('textbox', { name: /Enter scheduling request/ })
    .fill(text)
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(
    page.getByRole('textbox', { name: /Enter scheduling request/ }),
  ).toHaveValue('', { timeout: 60000 })
  prompts.push(text)
}
function snapshot() {
  const db = new Store(database)
  try {
    return db.snapshot()
  } finally {
    db.close()
  }
}
try {
  await expect
    .poll(
      async () => {
        if (server.exitCode !== null)
          throw new Error('Preview failed; see server.log')
        try {
          return (await fetch('http://127.0.0.1:3004')).status
        } catch {
          return 0
        }
      },
      { timeout: 30000 },
    )
    .toBe(200)
  await page.goto('http://127.0.0.1:3004')
  await expect(
    page.getByText('Saved events (10)', { exact: true }),
  ).toBeVisible()
  await screenshot('01-course-calendar')
  await page.getByRole('button', { name: 'Tasks', exact: true }).click()
  await page
    .getByLabel('Task title', { exact: true })
    .fill('Scheduling Agent presentation')
  await page
    .getByLabel('Task details', { exact: true })
    .fill(
      'For the Scheduling Agent project, review the existing test results, compare the failed and fixed scheduling examples, and prepare a five-minute presentation.',
    )
  await page.getByRole('button', { name: 'Analyze & save task' }).click()
  const task = page.getByTestId('task')
  await expect(task).toContainText('Complexity:', { timeout: 60000 })
  await task.scrollIntoViewIfNeeded()
  await screenshot('02-task-analysis')
  await page
    .getByRole('button', { name: 'Preferences & availability', exact: true })
    .click()
  await page
    .getByLabel('Description', { exact: true })
    .fill('Demo: prefer morning study')
  await page.getByLabel('Effective from', { exact: true }).fill('2026-10-01')
  await page.getByLabel('Start', { exact: true }).fill('09:00')
  await page.getByLabel('End', { exact: true }).fill('10:00')
  await page
    .getByRole('button', { name: 'Save preference', exact: true })
    .click()
  await page
    .getByTestId('preference')
    .getByRole('button', { name: 'Replace with a new version' })
    .click()
  await page
    .getByLabel('Description', { exact: true })
    .fill('Demo: prefer afternoon study from November')
  await page.getByLabel('Effective from', { exact: true }).fill('2026-11-01')
  await page.getByLabel('Start', { exact: true }).fill('16:00')
  await page.getByLabel('End', { exact: true }).fill('18:00')
  await page
    .getByRole('button', { name: 'Save preference', exact: true })
    .click()
  await expect(page.getByTestId('preference')).toHaveCount(2)
  await page.getByTestId('preference').last().scrollIntoViewIfNeeded()
  await screenshot('03-preference-versions')
  await page.getByRole('button', { name: 'Calendar', exact: true }).click()
  await send(
    'Use my current preferences to schedule 60 minutes of Health discussion notes on 2026-11-09, not before 15:50 and finish by 18:00.',
  )
  await expect(pending).toHaveCount(1, { timeout: 60000 })
  await expect(pending).toContainText('16:00')
  await expect(pending).toContainText('17:00')
  await pending.locator('summary').click()
  await expect(pending).toContainText('Replaced by a newer effective record')
  await pending.scrollIntoViewIfNeeded()
  expect(snapshot().events).toHaveLength(10)
  await screenshot('04-proposal-with-evidence')
  await pending
    .getByRole('button', { name: 'Approve & save', exact: true })
    .click()
  await expect(pending).toHaveCount(0)
  await expect(
    page.getByText('Saved events (11)', { exact: true }),
  ).toBeVisible()
  await expect(
    page
      .locator('.schedule-event-course')
      .filter({ hasText: 'Health discussion notes' }),
  ).toContainText('16:00')
  await screenshot('05-approved-calendar')
  await send('Schedule 60 minutes of Health notes on 2026-11-09 at 14:00.')
  const noSlot =
    'No slot satisfies the duration, deadline, availability and existing events. Please change a constraint or availability.'
  await expect(page.getByText(noSlot, { exact: true })).toBeVisible({
    timeout: 60000,
  })
  expect(snapshot().events).toHaveLength(11)
  await screenshot('06-class-conflict')
  await send(
    'Schedule Test 2 reflection on 2026-11-10 for 90 minutes, not before 18:00 and finish by 20:00.',
  )
  await expect(
    page.getByRole('checkbox', { name: 'Include previous clarification' }),
  ).toBeVisible({ timeout: 60000 })
  await send(
    'Change the duration to 10 minutes; keep the date and time bounds.',
    true,
  )
  await expect(pending).toHaveCount(1, { timeout: 60000 })
  await expect(pending).toContainText('19:50')
  await expect(pending).toContainText('20:00')
  await pending.scrollIntoViewIfNeeded()
  await screenshot('07-followup-revision')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Open agent', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await screenshot('08-mobile-review')
  expect(errors).toEqual([])
  writeFileSync(
    `${output}/capture.json`,
    JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        realModelCalls: 5,
        screenshots: images,
        prompts,
        browserErrors: errors,
        boundary:
          'Selected archived courses; explicit demo preferences and durations; production app with real DeepSeek; isolated database',
        state: snapshot(),
      },
      null,
      2,
    ),
  )
  console.log(output)
} finally {
  await context.tracing.stop({ path: `${output}/trace.zip` })
  await browser.close()
  if (server.exitCode === null) {
    const exited = once(server, 'exit')
    server.kill('SIGTERM')
    await exited
  }
}
