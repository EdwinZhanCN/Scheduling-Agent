import { describe, expect, it } from 'vitest'
import {
  defaultSettings,
  interpretationSchema,
  settingsSchema,
} from './contracts'
import type { Event, Interpretation, Metadata, Preference } from './contracts'
import { complexity, explicitConstraints, plan, validateSlot } from './planner'
import { retrievePreferences } from './retrieval'
import { instant } from './time'

const now = '2026-10-18T12:00:00Z'
const date = '2026-10-19'
const request = `Schedule study on ${date} for 45 minutes, not before 15:30 and finish by 17:00.`
export function interpretation(
  overrides: Partial<Interpretation> = {},
): Interpretation {
  return {
    intent: 'create',
    eventId: null,
    title: 'Study',
    date,
    durationMinutes: 45,
    earliestStart: '15:30',
    latestEnd: '17:00',
    exactStart: null,
    spans: {
      date,
      durationMinutes: '45 minutes',
      earliestStart: '15:30',
      latestEnd: '17:00',
      exactStart: null,
    },
    usePreferences: false,
    clarification: null,
    metadata: {
      summary: 'Study',
      tags: ['study'],
      stages: [],
      externalDependency: null,
      scopeKnown: false,
    },
    ...overrides,
  }
}
function pref(overrides: Partial<Preference> = {}): Preference {
  return {
    id: 'p1',
    owner: 'local',
    status: 'active',
    text: 'Prefer afternoons',
    kind: 'soft',
    effectiveFrom: '2026-01-01',
    expiresOn: null,
    days: [1, 2, 3, 4, 5],
    startTime: '14:00',
    endTime: '17:00',
    supersedesId: null,
    createdAt: now,
    ...overrides,
  }
}
const context = {
  settings: defaultSettings,
  events: [] as Event[],
  preferences: [] as Preference[],
  now,
}

describe('hard constraints and request grounding', () => {
  it('rejects the S08 deadline failure even when the slot fits availability', () => {
    const input = interpretation({
      latestEnd: '16:00',
      spans: { ...interpretation().spans, latestEnd: '16:00' },
    })
    expect(plan(input, request.replace('17:00', '16:00'), context)).toEqual({
      ok: false,
      codes: ['no_feasible_slot'],
    })
    expect(
      validateSlot(
        {
          start: instant(date, '15:30', defaultSettings.timezone),
          end: instant(date, '16:15', defaultSettings.timezone),
        },
        {
          date,
          durationMinutes: 45,
          earliestStart: '15:30',
          latestEnd: '16:00',
          exactStart: null,
        },
        context,
      ),
    ).toContain('deadline_violation')
  })
  it('rejects a wrong duration independently of valid JSON', () => {
    expect(
      validateSlot(
        {
          start: instant(date, '15:30', defaultSettings.timezone),
          end: instant(date, '16:00', defaultSettings.timezone),
        },
        {
          date,
          durationMinutes: 45,
          earliestStart: null,
          latestEnd: null,
          exactStart: null,
        },
        context,
      ),
    ).toContain('duration_mismatch')
  })
  it('rejects an omitted deadline in extracted fields', () => {
    expect(plan(interpretation({ latestEnd: null }), request, context)).toEqual(
      { ok: false, codes: ['constraint_mismatch'] },
    )
  })
  it('rejects fabricated constraint evidence', () => {
    const input = interpretation()
    input.spans.date = 'next Thursday'
    expect(plan(input, request, context)).toEqual({
      ok: false,
      codes: ['ungrounded_constraint'],
    })
  })
  it('intersects availability windows and explicit deadlines', () => {
    expect(
      explicitConstraints(
        '45 minutes, available from 15:30 to 17:00, finish by 16:00',
      ).values,
    ).toEqual({
      durationMinutes: 45,
      earliestStart: '15:30',
      latestEnd: '16:00',
    })
  })
  it('recognizes Chinese duration and finish bounds', () => {
    expect(explicitConstraints('安排45分钟，16:00前结束').values).toEqual({
      durationMinutes: 45,
      latestEnd: '16:00',
    })
  })
  it('requires a date and duration instead of guessing', () => {
    const input = interpretation({
      date: null,
      durationMinutes: null,
      earliestStart: null,
      latestEnd: null,
      spans: {
        date: null,
        durationMinutes: null,
        earliestStart: null,
        latestEnd: null,
        exactStart: null,
      },
    })
    expect(plan(input, 'Schedule study', context)).toEqual({
      ok: false,
      codes: ['missing_date', 'missing_duration'],
    })
  })
  it('rejects conflicting numeric durations', () => {
    expect(explicitConstraints('30 minutes and 45 minutes').issues).toContain(
      'ambiguous_constraints',
    )
  })
  it('accepts exact deadline equality', () => {
    const input = interpretation({
      latestEnd: '16:15',
      spans: { ...interpretation().spans, latestEnd: '16:15' },
    })
    expect(plan(input, request.replace('17:00', '16:15'), context).ok).toBe(
      true,
    )
  })
  it('shifts around an existing event without changing duration', () => {
    const events: Event[] = [
      {
        id: 'busy',
        title: 'Busy',
        start: instant(date, '15:30', defaultSettings.timezone),
        end: instant(date, '16:00', defaultSettings.timezone),
        timezone: defaultSettings.timezone,
        version: 1,
        taskId: null,
      },
    ]
    const result = plan(interpretation(), request, { ...context, events })
    expect(result.ok && result.draft.start).toBe(
      instant(date, '16:00', defaultSettings.timezone),
    )
  })
  it('does not shift an exact start around a conflict', () => {
    const input = interpretation({
      exactStart: '15:30',
      spans: { ...interpretation().spans, exactStart: '15:30' },
    })
    const events: Event[] = [
      {
        id: 'busy',
        title: 'Busy',
        start: instant(date, '15:30', defaultSettings.timezone),
        end: instant(date, '16:00', defaultSettings.timezone),
        timezone: defaultSettings.timezone,
        version: 1,
        taskId: null,
      },
    ]
    expect(plan(input, request, { ...context, events }).ok).toBe(false)
  })
  it('preserves move duration when omitted', () => {
    const events: Event[] = [
      {
        id: 'meeting',
        title: 'Meeting',
        start: instant(date, '10:00', defaultSettings.timezone),
        end: instant(date, '10:30', defaultSettings.timezone),
        timezone: defaultSettings.timezone,
        version: 1,
        taskId: null,
      },
    ]
    const input = interpretation({
      intent: 'move',
      eventId: 'meeting',
      durationMinutes: null,
      earliestStart: null,
      latestEnd: null,
      exactStart: '15:30',
      spans: {
        date,
        durationMinutes: null,
        earliestStart: null,
        latestEnd: null,
        exactStart: '15:30',
      },
    })
    const result = plan(input, `Move Meeting on ${date} at 15:30`, {
      ...context,
      events,
    })
    expect(result.ok && result.draft.constraints?.durationMinutes).toBe(30)
  })
  it('rejects ambiguous or invented event identity', () => {
    expect(
      plan(
        interpretation({ intent: 'delete', eventId: 'missing' }),
        'Delete it',
        context,
      ).ok,
    ).toBe(false)
  })
  it('rejects requests outside working days', () => {
    expect(
      plan(interpretation(), request, {
        ...context,
        settings: { ...defaultSettings, workingDays: [2] },
      }).ok,
    ).toBe(false)
  })
  it('rejects slots in the past', () => {
    expect(
      plan(interpretation(), request, {
        ...context,
        now: '2026-10-20T12:00:00Z',
      }).ok,
    ).toBe(false)
  })
  it('rejects DST gaps and repeated local times', () => {
    expect(() => instant('2027-03-14', '02:30', 'America/New_York')).toThrow()
    expect(() => instant('2026-11-01', '01:30', 'America/New_York')).toThrow()
  })
  it('rejects invalid dates, times and unknown action fields', () => {
    expect(
      interpretationSchema.safeParse(interpretation({ date: '2026-02-30' }))
        .success,
    ).toBe(false)
    expect(
      interpretationSchema.safeParse({ ...interpretation(), executed: true })
        .success,
    ).toBe(false)
    expect(
      settingsSchema.safeParse({ ...defaultSettings, timezone: 'not/a-zone' })
        .success,
    ).toBe(false)
  })
})

describe('temporal preference retrieval', () => {
  it.each([
    'archived',
    'not_effective',
    'expired',
    'wrong_owner',
    'different_day',
  ])('excludes %s records before ranking', (reason) => {
    const overrides: Record<string, Partial<Preference>> = {
      archived: { status: 'archived' },
      not_effective: { effectiveFrom: '2026-11-01' },
      expired: { expiresOn: '2026-10-01' },
      wrong_owner: { owner: 'someone-else' },
      different_day: { days: [2] },
    }
    const result = retrievePreferences(
      [pref(overrides[reason])],
      date,
      'afternoon',
    )
    expect(result.supporting).toHaveLength(0)
    expect(result.excluded[0].reason).toBe(reason)
  })
  it('uses the old version until a replacement takes effect', () => {
    const records = [
      pref(),
      pref({ id: 'p2', supersedesId: 'p1', effectiveFrom: '2026-10-20' }),
    ]
    expect(
      retrievePreferences(records, date, '').supporting.map((p) => p.id),
    ).toEqual(['p1'])
    expect(
      retrievePreferences(records, '2026-10-20', '').supporting.map(
        (p) => p.id,
      ),
    ).toEqual(['p2'])
  })
  it('does not resurrect old versions when a replacement is archived', () => {
    expect(
      retrievePreferences(
        [pref(), pref({ id: 'p2', supersedesId: 'p1', status: 'archived' })],
        date,
        '',
      ).supporting,
    ).toHaveLength(0)
  })
  it('applies every hard rule even if lexical relevance is zero', () => {
    expect(
      plan(interpretation(), request, {
        ...context,
        preferences: [
          pref({
            kind: 'hard',
            text: 'xyz',
            startTime: '15:00',
            endTime: '18:00',
          }),
        ],
      }).ok,
    ).toBe(false)
  })
  it('permits a feasible slot outside a soft preference', () => {
    expect(
      plan(interpretation(), request, {
        ...context,
        preferences: [pref({ startTime: '09:00', endTime: '10:00' })],
      }).ok,
    ).toBe(true)
  })
  it('clarifies conflicting preferred periods when asked to use preferences', () => {
    expect(
      plan(interpretation({ usePreferences: true }), request, {
        ...context,
        preferences: [
          pref(),
          pref({ id: 'p2', startTime: '09:00', endTime: '10:00' }),
        ],
      }),
    ).toEqual({ ok: false, codes: ['conflicting_preferences'] })
  })
})

describe('task grading', () => {
  it('does not treat already supplied material as an unresolved external dependency', () => {
    const metadata: Metadata = {
      summary: 'Read',
      tags: ['study'],
      stages: [{ label: 'Read', evidence: 'Read one supplied paper' }],
      externalDependency: 'supplied paper',
      scopeKnown: true,
    }
    expect(complexity(metadata, 'Read one supplied paper.')).toBe('low')
  })
  it('does not inflate complexity with duplicated stage evidence', () => {
    const stage = { label: 'Read', evidence: 'Read' }
    expect(
      complexity(
        {
          summary: 'Read',
          tags: ['study'],
          stages: [stage, stage, stage],
          externalDependency: null,
          scopeKnown: true,
        },
        'Read one paper',
      ),
    ).toBe('low')
  })
  const base: Metadata = {
    summary: 'Read and write',
    tags: ['study'],
    stages: [{ label: 'Read', evidence: 'Read' }],
    externalDependency: null,
    scopeKnown: true,
  }
  it.each([
    [1, 'low'],
    [2, 'medium'],
    [3, 'high'],
  ] as const)('grades %i explicit stages as %s', (count, grade) => {
    const stages = ['Read', 'Compare', 'Write']
      .slice(0, count)
      .map((label) => ({ label, evidence: label }))
    expect(complexity({ ...base, stages }, 'Read Compare Write')).toBe(grade)
  })
  it('returns unknown for fabricated evidence or missing scope', () => {
    expect(complexity(base, 'Prepare presentation')).toBe('unknown')
    expect(complexity({ ...base, scopeKnown: false }, 'Read')).toBe('unknown')
  })
  it('treats an explicit external dependency separately from urgency', () => {
    expect(
      complexity(
        { ...base, externalDependency: 'Wait for approval' },
        'Read. Wait for approval',
      ),
    ).toBe('high')
  })
})

// New deterministic boundary grid, independent of the archived 2026-10-17 fixture.
describe('new duration/deadline grid', () => {
  for (const duration of [5, 20, 35, 50, 65])
    for (const window of [15, 30, 45, 60, 75, 90]) {
      it(`duration ${duration} in window ${window}`, () => {
        const latestEnd = `${String(13 + Math.floor(window / 60)).padStart(2, '0')}:${String(window % 60).padStart(2, '0')}`
        const text = `Study on ${date} for ${duration} minutes, not before 13:00 and finish by ${latestEnd}`
        const input = interpretation({
          durationMinutes: duration,
          earliestStart: '13:00',
          latestEnd,
          spans: {
            date,
            durationMinutes: `${duration} minutes`,
            earliestStart: '13:00',
            latestEnd,
            exactStart: null,
          },
        })
        expect(plan(input, text, context).ok).toBe(duration <= window)
      })
    }
})
