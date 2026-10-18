import { describe, expect, it } from 'vitest'
import { validateInterpretation } from './planner'
import type { Interpretation } from './contracts'

const first =
  'Schedule Test 2 reflection on 2026-11-10 for 90 minutes, not before 18:00 and finish by 20:00.'
const followup =
  'Change the duration to 10 minutes; keep the date and time bounds.'
const output: Interpretation = {
  intent: 'create',
  eventId: null,
  title: 'Test 2 reflection',
  date: '2026-11-10',
  durationMinutes: 10,
  earliestStart: '18:00',
  latestEnd: '20:00',
  exactStart: null,
  spans: {
    date: '2026-11-10',
    durationMinutes: '10 minutes',
    earliestStart: '18:00',
    latestEnd: '20:00',
    exactStart: null,
  },
  usePreferences: false,
  clarification: null,
  metadata: {
    summary: '',
    tags: [],
    stages: [],
    externalDependency: null,
    scopeKnown: false,
  },
}
describe('clarification turns', () => {
  it('replaces an explicitly revised duration while preserving previous bounds', () => {
    expect(
      validateInterpretation(output, `${first}\nFollow-up: ${followup}`, [
        first,
        followup,
      ]),
    ).toEqual([])
  })
  it('does not allow a model to drop an unchanged deadline', () => {
    expect(
      validateInterpretation(
        { ...output, latestEnd: null },
        `${first}\n${followup}`,
        [first, followup],
      ),
    ).toContain('constraint_mismatch')
  })
  it('does not treat a typed Follow-up marker as a trusted turn boundary', () => {
    expect(
      validateInterpretation(output, `${first}\nFollow-up: ${followup}`),
    ).toContain('ambiguous_constraints')
  })
  it('still rejects conflicting durations within the same reply', () => {
    const reply = 'Change the duration to 10 minutes or 20 minutes.'
    expect(
      validateInterpretation(output, `${first}\n${reply}`, [first, reply]),
    ).toContain('ambiguous_constraints')
  })
  it('checks the latest explicit time bounds without forgetting the duration', () => {
    const reply = 'Instead, not before 19:00 and finish by 21:00.'
    const updated = {
      ...output,
      durationMinutes: 90,
      earliestStart: '19:00',
      latestEnd: '21:00',
      spans: {
        ...output.spans,
        durationMinutes: '90 minutes',
        earliestStart: '19:00',
        latestEnd: '21:00',
      },
    }
    expect(
      validateInterpretation(updated, `${first}\n${reply}`, [first, reply]),
    ).toEqual([])
    expect(
      validateInterpretation(
        { ...updated, durationMinutes: 10 },
        `${first}\n${reply}`,
        [first, reply],
      ),
    ).toContain('constraint_mismatch')
  })
})
