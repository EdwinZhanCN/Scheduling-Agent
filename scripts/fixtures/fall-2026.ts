import { defaultSettings } from '../../src/domain/contracts'
import { instant } from '../../src/domain/time'
import type { Store } from '../../src/server/store.server'

// Selected archived facts, not a recurrence engine or an LMS import feature.
// See docs/fall-scenarios.md for source dates, conflicts and test assumptions.
export const referenceNow = '2026-10-18T12:00:00Z'
export const zone = 'America/New_York'
export const courseBlocks = [
  ['litr-mon', 'LITR 2961', '2026-10-19', '10:00', '11:50'],
  ['econ-mon', 'ECON 4270', '2026-10-19', '14:00', '15:50'],
  ['ai-tue', 'CSCI 4150', '2026-10-20', '10:00', '11:50'],
  ['psoft-tue', 'CSCI 2600', '2026-10-20', '14:00', '15:50'],
  ['rcos-tue', 'RCOS', '2026-10-20', '16:00', '17:50'],
  ['litr-thu', 'LITR 2961', '2026-10-22', '10:00', '11:50'],
  ['econ-thu', 'ECON 4270', '2026-10-22', '14:00', '15:50'],
  ['litr-health', 'LITR 2961', '2026-11-09', '10:00', '11:50'],
  [
    'econ-health',
    'ECON Health discussion (updated)',
    '2026-11-09',
    '14:00',
    '15:50',
  ],
  ['psoft-exam', 'CSCI 2600 Test 2', '2026-11-10', '18:00', '19:50'],
] as const

export function seedFallCalendar(store: Store) {
  if (store.snapshot().events.length)
    throw new Error('Requires an empty test calendar')
  // Evening/weekend availability is a test assumption, not a personal preference claim.
  store.saveSettings({
    ...defaultSettings,
    dayEnd: '21:00',
    workingDays: [1, 2, 3, 4, 5, 6, 7],
  })
  const insert = store.db.prepare('INSERT INTO events (id, data) VALUES (?, ?)')
  store.db.transaction(() => {
    for (const [id, title, date, start, end] of courseBlocks) {
      insert.run(
        id,
        JSON.stringify({
          id,
          title,
          start: instant(date, start, zone),
          end: instant(date, end, zone),
          timezone: zone,
          taskId: null,
          version: 1,
        }),
      )
    }
  })()
}
