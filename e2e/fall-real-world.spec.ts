import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { once } from 'node:events'
import { mkdirSync, createWriteStream, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from 'node:net'
import { Store } from '../src/server/store.server'
import { seedFallCalendar } from '../scripts/fixtures/fall-2026'

const output = resolve(
  `artifacts/fall-browser-${new Date().toISOString().replaceAll(':', '-')}`,
)
const database = `${output}/calendar.sqlite`
let server: ChildProcess | undefined
let boot = 0
async function startServer() {
  // Fail before browser writes if another application owns this fixed test port.
  await new Promise<void>((accept, reject) => {
    const probe = createServer()
    probe.once('error', reject)
    probe.listen(3011, '127.0.0.1', () => probe.close(() => accept()))
  })
  const log = createWriteStream(`${output}/server-${++boot}.log`)
  server = spawn(
    process.execPath,
    [
      'node_modules/vite/bin/vite.js',
      'preview',
      '--host',
      '127.0.0.1',
      '--port',
      '3011',
      '--strictPort',
    ],
    {
      env: { ...process.env, SCHEDULING_DB_PATH: database },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  server.stdout?.pipe(log)
  server.stderr?.pipe(log)
  await expect
    .poll(
      async () => {
        if (server?.exitCode !== null)
          throw new Error('Owned preview server exited; inspect its log')
        try {
          return (await fetch('http://127.0.0.1:3011')).status
        } catch {
          return 0
        }
      },
      { timeout: 30000 },
    )
    .toBe(200)
}
async function stopServer() {
  if (server && server.exitCode === null) {
    const exited = once(server, 'exit')
    server.kill('SIGTERM')
    await exited
  }
}
function state() {
  const store = new Store(database)
  try {
    return store.snapshot()
  } finally {
    store.close()
  }
}
test.beforeAll(async () => {
  mkdirSync(output, { recursive: true })
  const store = new Store(database)
  seedFallCalendar(store)
  store.close()
  await startServer()
})
test.afterAll(async () => {
  await stopServer()
})
const pending = (page: Page) =>
  page.locator('[data-testid="proposal"][data-status="pending"]')
async function send(page: Page, text: string, followup = false) {
  const continuation = page.getByRole('checkbox', {
    name: 'Include previous clarification',
  })
  if (await continuation.count()) await continuation.setChecked(followup)
  await page
    .getByRole('textbox', { name: /Enter scheduling request/ })
    .fill(text)
  await page.getByRole('button', { name: 'Send', exact: true }).click()
}
const approve = (page: Page, title: string) =>
  pending(page)
    .filter({ hasText: title })
    .getByRole('button', { name: 'Approve & save', exact: true })
    .click()

test('archived courses: concurrent review, evening move, process restart and mobile follow-up', async ({
  browser,
}) => {
  const errors: string[] = []
  const firstContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    timezoneId: 'America/New_York',
  })
  const secondContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    timezoneId: 'America/Los_Angeles',
  })
  const first = await firstContext.newPage()
  const second = await secondContext.newPage()
  for (const page of [first, second])
    page.on('pageerror', (e) => errors.push(e.message))
  await first.goto('http://127.0.0.1:3011')
  await expect(
    first.getByText('Saved events (10)', { exact: true }),
  ).toBeVisible()
  await send(
    first,
    'Schedule A2 rehearsal on 2026-10-19 for 60 minutes, not before 13:30 and finish by 17:00.',
  )
  await expect(pending(first)).toContainText('15:50')
  await expect(pending(first)).toContainText('16:50')
  expect(state().events).toHaveLength(10)
  await second.goto('http://127.0.0.1:3011')
  await send(
    second,
    'Schedule a temporary team meeting on 2026-10-19 for 15 minutes at 16:00.',
  )
  await expect(pending(second)).toHaveCount(2)
  const meeting = pending(second).filter({ hasText: '16:15' })
  await meeting
    .getByRole('button', { name: 'Approve & save', exact: true })
    .click()
  await expect(
    second.getByText('Saved events (11)', { exact: true }),
  ).toBeVisible()
  await approve(first, 'A2 rehearsal')
  await expect(first.locator('[data-status="invalidated"]')).toContainText(
    'An existing event conflicts with this time.',
  )
  expect(state().events).toHaveLength(11)
  await expect(
    first
      .locator('.schedule-event-course')
      .filter({ hasText: 'ECON 4270' })
      .first(),
  ).toBeVisible()
  await first.screenshot({
    path: `${output}/conflicting-meeting.png`,
    fullPage: true,
  })

  await send(
    first,
    'Schedule PSoft HW3 on 2026-10-20 for 90 minutes, not before 11:50 and finish by 14:00.',
  )
  await expect(pending(first)).toContainText('11:50')
  await approve(first, 'PSoft HW3')
  await expect(
    first.getByText('Saved events (12)', { exact: true }),
  ).toBeVisible()
  const hw = state().events.find((e) => e.title.includes('PSoft HW3'))!
  await send(first, `Move event ${hw.id} to 2026-10-20 at 16:00.`)
  await expect(
    first.getByText(
      'No slot satisfies the duration, deadline, availability and existing events. Please change a constraint or availability.',
      { exact: true },
    ),
  ).toBeVisible()
  await send(first, `Move event ${hw.id} to 2026-10-20 at 18:00.`)
  await expect(pending(first)).toContainText('19:30')
  await approve(first, 'PSoft HW3')
  await expect
    .poll(() => state().events.find((e) => e.id === hw.id)?.start)
    .toBe('2026-10-20T22:00:00Z')
  await expect(pending(first)).toHaveCount(0)
  const calendarHomework = first
    .locator('.schedule-event-course')
    .filter({ hasText: 'PSoft HW3' })
  await expect(calendarHomework).toHaveCount(1)
  await expect(calendarHomework).toContainText('18:00')
  await expect(calendarHomework).toContainText('19:30')
  await expect(calendarHomework).toBeVisible()
  await first.screenshot({ path: `${output}/evening-hw.png`, fullPage: true })

  await send(
    first,
    'Schedule Test 2 reflection on 2026-11-10 for 90 minutes, not before 18:00 and finish by 20:00.',
  )
  await expect(
    first.getByRole('checkbox', { name: 'Include previous clarification' }),
  ).toBeVisible()
  const beforeRestart = state()
  writeFileSync(
    `${output}/before-restart.json`,
    JSON.stringify(beforeRestart, null, 2),
  )
  await firstContext.close()
  await secondContext.close()
  await stopServer()
  await startServer()
  expect(state()).toEqual(beforeRestart)
  const resumedContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    timezoneId: 'America/Los_Angeles',
  })
  const resumed = await resumedContext.newPage()
  resumed.on('pageerror', (e) => errors.push(e.message))
  await resumed.goto('http://127.0.0.1:3011')
  await resumed.getByRole('button', { name: 'Open agent', exact: true }).click()
  await expect(resumed.getByRole('dialog')).toBeVisible()
  await send(
    resumed,
    'Change the duration to 10 minutes; keep the date and time bounds.',
    true,
  )
  await expect(pending(resumed)).toContainText('19:50')
  await expect(pending(resumed)).toContainText('20:00')
  await expect(pending(resumed)).toContainText('America/New_York')
  await resumed.screenshot({
    path: `${output}/mobile-followup.png`,
    fullPage: true,
  })
  await approve(resumed, 'Test 2 reflection')
  await expect.poll(() => state().events.length).toBe(13)
  await resumed.reload()
  await resumed.getByRole('button', { name: 'Open agent', exact: true }).click()
  await expect(
    resumed.getByRole('textbox', { name: /Enter scheduling request/ }),
  ).toHaveValue('')
  await resumed.keyboard.press('Escape')
  await expect(resumed.getByRole('dialog')).toHaveCount(0)
  expect(errors).toEqual([])
  writeFileSync(
    `${output}/result.json`,
    JSON.stringify(
      {
        passed: true,
        serverStarts: boot,
        browserContexts: 3,
        events: state().events.length,
        browserErrors: errors,
        state: state(),
      },
      null,
      2,
    ),
  )
  await resumedContext.close()
  console.log(`Evidence: ${output}`)
})
