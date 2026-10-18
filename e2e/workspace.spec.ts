import { expect, test } from '@playwright/test'

test('live model: task, preference versions, review lifecycle, reload and mobile', async ({
  page,
}) => {
  const browserErrors: string[] = []
  page.on('pageerror', (error) => browserErrors.push(error.message))
  await page.goto('/')
  await expect(
    page.getByText('Saved events (0)', { exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Tasks', exact: true }).click()
  await page
    .getByLabel('Task title', { exact: true })
    .fill('Browser acceptance report')
  await page
    .getByLabel('Task details', { exact: true })
    .fill(
      'Read three supplied papers, compare their methods in a table, and write a 1000-word synthesis.',
    )
  await page.getByRole('button', { name: 'Analyze & save task' }).click()
  const task = page
    .getByTestId('task')
    .filter({ hasText: 'Browser acceptance report' })
  await expect(task).toContainText('Complexity: High')
  await task.getByRole('button', { name: 'Mark done' }).click()
  await expect(task.getByRole('button', { name: 'Reopen' })).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: 'Tasks', exact: true }).click()
  await expect(task.getByRole('button', { name: 'Reopen' })).toBeVisible()
  await task.getByRole('button', { name: 'Reopen' }).click()
  await expect(task.getByRole('button', { name: 'Mark done' })).toBeVisible()
  await page.screenshot({ path: 'artifacts/browser-tasks.png', fullPage: true })

  await page
    .getByRole('button', { name: 'Preferences & availability', exact: true })
    .click()
  await page
    .getByLabel('Description', { exact: true })
    .fill('Old preferred morning')
  await page.getByLabel('Effective from', { exact: true }).fill('2026-10-01')
  await page.getByLabel('Start', { exact: true }).fill('09:00')
  await page.getByLabel('End', { exact: true }).fill('11:00')
  await page
    .getByRole('button', { name: 'Save preference', exact: true })
    .click()
  const old = page
    .getByTestId('preference')
    .filter({ hasText: 'Old preferred morning' })
  await old.getByRole('button', { name: 'Replace with a new version' }).click()
  await page
    .getByLabel('Description', { exact: true })
    .fill('Current preferred afternoon')
  await page.getByLabel('Effective from', { exact: true }).fill('2026-11-01')
  await page.getByLabel('Start', { exact: true }).fill('14:00')
  await page.getByLabel('End', { exact: true }).fill('17:00')
  await page
    .getByRole('button', { name: 'Save preference', exact: true })
    .click()
  await expect(page.getByTestId('preference')).toHaveCount(2)
  await page.screenshot({
    path: 'artifacts/browser-preferences.png',
    fullPage: true,
  })

  await page.getByRole('button', { name: 'Calendar', exact: true }).click()
  const input = page.getByRole('textbox', { name: /Enter scheduling request/ })
  const pending = page.locator(
    '[data-testid="proposal"][data-status="pending"]',
  )
  const send = async (request: string) => {
    await input.fill(request)
    await page.getByRole('button', { name: 'Send', exact: true }).click()
  }
  const request =
    'Schedule a 40 minute event named Browser focus on 2026-11-17, not before 14:00 and finish by 16:00.'
  await send(request)
  await expect(pending).toHaveCount(1)
  await expect(
    page.getByText('Saved events (0)', { exact: true }),
  ).toBeVisible()
  await expect(pending).toContainText('Latest finish')
  await pending.locator('summary').click()
  await expect(pending).toContainText('Replaced by a newer effective record')
  await page.screenshot({
    path: 'artifacts/browser-proposal.png',
    fullPage: true,
  })
  await pending.getByRole('button', { name: 'Reject', exact: true }).click()
  await expect(pending).toHaveCount(0)
  await expect(
    page.getByText('Saved events (0)', { exact: true }),
  ).toBeVisible()
  await page.reload()
  await expect(page.locator('[data-status="rejected"]')).toHaveCount(1)

  await send(request)
  await expect(pending).toHaveCount(1)
  await pending
    .getByRole('button', { name: 'Approve & save', exact: true })
    .click()
  await expect(
    page.getByText('Saved events (1)', { exact: true }),
  ).toBeVisible()
  await page.reload()
  await expect(
    page.getByText('Saved events (1)', { exact: true }),
  ).toBeVisible()
  await page.getByText('Saved events (1)', { exact: true }).click()
  const saved = page.getByTestId('saved-event')
  await expect(saved).toContainText('14:00–14:40')
  await saved.getByRole('button', { name: 'Move event', exact: true }).click()
  await input.fill((await input.inputValue()) + '2026-11-17 at 16:00.')
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(pending).toHaveCount(1)
  await expect(saved).toContainText('14:00–14:40')
  await pending
    .getByRole('button', { name: 'Approve & save', exact: true })
    .click()
  await expect(saved).toContainText('16:00–16:40')
  await saved.getByRole('button', { name: 'Delete event', exact: true }).click()
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(pending).toHaveCount(1)
  await expect(saved).toHaveCount(1)
  await pending
    .getByRole('button', { name: 'Approve & save', exact: true })
    .click()
  await expect(
    page.getByText('Saved events (0)', { exact: true }),
  ).toBeVisible()

  await send(
    'Schedule 45 minutes of study on 2026-11-17, not before 15:30 and finish by 16:00.',
  )
  await expect(
    page.getByText(
      'No slot satisfies the duration, deadline, availability and existing events. Please change a constraint or availability.',
      { exact: true },
    ),
  ).toBeVisible()
  await expect(pending).toHaveCount(0)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Open agent', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('dialog').getByRole('textbox')).toHaveValue('')
  await expect(
    page
      .getByRole('dialog')
      .getByText(
        'No slot satisfies the duration, deadline, availability and existing events. Please change a constraint or availability.',
        { exact: true },
      ),
  ).toBeVisible()
  await page.screenshot({
    path: 'artifacts/browser-mobile.png',
    fullPage: true,
  })
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(browserErrors).toEqual([])
})
