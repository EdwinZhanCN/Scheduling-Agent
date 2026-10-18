import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { Store } from './store.server'
import { SchedulingService } from './service.server'
import { DomainError, defaultSettings } from '../domain/contracts'
import type { Interpretation } from '../domain/contracts'
import { instant } from '../domain/time'

const now = '2026-10-18T12:00:00Z'
const date = '2026-10-19'
const request = `Schedule Study on ${date} for 45 minutes, not before 15:30 and finish by 17:00`
function extracted(overrides: Partial<Interpretation> = {}): Interpretation {
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
const stores: Store[] = []
function setup(output = extracted(), path = ':memory:') {
  const store = new Store(path)
  stores.push(store)
  const service = new SchedulingService(
    store,
    async () => output,
    () => now,
  )
  return { store, service }
}
afterEach(() => {
  for (const store of stores.splice(0)) if (store.db.open) store.close()
})

describe('proposal transaction boundary', () => {
  it('can delete an existing event after the calendar timezone changes', async () => {
    const { store, service } = setup()
    const initial = await service.chat(request)
    store.resolveProposal(initial.proposals[0].id, 'approve', now)
    const event = store.snapshot().events[0]
    store.saveSettings({ ...defaultSettings, timezone: 'America/Los_Angeles' })
    const deletion = new SchedulingService(
      store,
      async () => extracted({ intent: 'delete', eventId: event.id }),
      () => now,
    )
    const state = await deletion.chat('Delete Study')
    expect(
      store.resolveProposal(state.proposals.at(-1)!.id, 'approve', now).status,
    ).toBe('approved')
    expect(store.snapshot().events).toHaveLength(0)
  })
  it('retains unresolved proposals beyond the recent-history limit', async () => {
    const { store, service } = setup()
    const initial = await service.chat(request)
    for (let index = 0; index < 105; index++)
      store.addProposal({
        ...initial.proposals[0],
        id: `resolved-${index}`,
        status: 'rejected',
      })
    expect(
      store
        .snapshot()
        .proposals.some((proposal) => proposal.id === initial.proposals[0].id),
    ).toBe(true)
  })
  it('keeps drafts out of events and rejection never writes', async () => {
    const { store, service } = setup()
    const state = await service.chat(request)
    expect(state.events).toHaveLength(0)
    expect(state.proposals).toHaveLength(1)
    store.resolveProposal(state.proposals[0].id, 'reject', now)
    expect(store.snapshot().events).toHaveLength(0)
    expect(() =>
      store.resolveProposal(state.proposals[0].id, 'approve', now),
    ).toThrow('proposal_resolved')
  })
  it('approval writes once and repeated approval is idempotent', async () => {
    const { store, service } = setup()
    const state = await service.chat(request)
    store.resolveProposal(state.proposals[0].id, 'approve', now)
    store.resolveProposal(state.proposals[0].id, 'approve', now)
    expect(store.snapshot().events).toHaveLength(1)
    expect(store.snapshot().events[0].start).toBe(
      instant(date, '15:30', defaultSettings.timezone),
    )
  })
  it('revalidates competing proposals on approval', async () => {
    const { store, service } = setup()
    await service.chat(request)
    const state = await service.chat(request)
    store.resolveProposal(state.proposals[0].id, 'approve', now)
    const second = store.resolveProposal(state.proposals[1].id, 'approve', now)
    expect(second.status).toBe('invalidated')
    expect(second.issues).toContain('calendar_conflict')
    expect(store.snapshot().events).toHaveLength(1)
  })
  it('invalidates a draft when availability changes', async () => {
    const { store, service } = setup()
    const state = await service.chat(request)
    store.saveSettings({ ...defaultSettings, dayEnd: '15:00' })
    expect(
      store.resolveProposal(state.proposals[0].id, 'approve', now).issues,
    ).toContain('context_changed')
    expect(store.snapshot().events).toHaveLength(0)
  })
  it('invalidates a draft when a new preference is saved', async () => {
    const { store, service } = setup()
    const state = await service.chat(request)
    store.savePreference(
      {
        text: 'Unavailable',
        kind: 'hard',
        days: [1],
        startTime: '15:00',
        endTime: '18:00',
        effectiveFrom: date,
        expiresOn: null,
        supersedesId: null,
      },
      now,
    )
    expect(
      store.resolveProposal(state.proposals[0].id, 'approve', now).status,
    ).toBe('invalidated')
  })
  it('preserves draft and confirmed state across a database reopen', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'scheduling-test-'))
    try {
      const path = join(dir, 'test.sqlite')
      const { store, service } = setup(extracted(), path)
      const state = await service.chat(request)
      store.resolveProposal(state.proposals[0].id, 'approve', now)
      store.close()
      const next = new Store(path)
      stores.push(next)
      expect(next.snapshot().events).toHaveLength(1)
      expect(next.snapshot().messages).toHaveLength(2)
      expect(next.snapshot().proposals[0].status).toBe('approved')
      next.close()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
  it('moves and deletes only after explicit approval', async () => {
    const { store, service } = setup()
    const state = await service.chat(request)
    store.resolveProposal(state.proposals[0].id, 'approve', now)
    const event = store.snapshot().events[0]
    const moved = extracted({
      intent: 'move',
      eventId: event.id,
      durationMinutes: null,
      earliestStart: null,
      latestEnd: null,
      exactStart: '10:00',
      spans: {
        date,
        durationMinutes: null,
        earliestStart: null,
        latestEnd: null,
        exactStart: '10:00',
      },
    })
    const moveService = new SchedulingService(
      store,
      async () => moved,
      () => now,
    )
    const moveState = await moveService.chat(`Move Study on ${date} at 10:00`)
    expect(moveState.events[0].start).toBe(event.start)
    store.resolveProposal(moveState.proposals.at(-1)!.id, 'approve', now)
    expect(store.snapshot().events[0].start).toBe(
      instant(date, '10:00', defaultSettings.timezone),
    )
    expect(store.snapshot().proposals.at(-1)?.before?.start).toBe(event.start)
    const deleteService = new SchedulingService(
      store,
      async () => extracted({ intent: 'delete', eventId: event.id }),
      () => now,
    )
    const deletion = await deleteService.chat('Delete Study')
    expect(deletion.events).toHaveLength(1)
    store.resolveProposal(deletion.proposals.at(-1)!.id, 'approve', now)
    expect(store.snapshot().events).toHaveLength(0)
  })
  it('rejects a stale move when the target version changed', async () => {
    const { store, service } = setup()
    const state = await service.chat(request)
    store.resolveProposal(state.proposals[0].id, 'approve', now)
    const event = store.snapshot().events[0]
    const mover = new SchedulingService(
      store,
      async () => extracted({ intent: 'move', eventId: event.id }),
      () => now,
    )
    await mover.chat(request)
    const two = await mover.chat(request)
    store.resolveProposal(two.proposals[1].id, 'approve', now)
    expect(
      store.resolveProposal(two.proposals[2].id, 'approve', now).issues,
    ).toContain('event_changed')
  })
  it('rejects expired drafts at approval time', async () => {
    const { store, service } = setup()
    const state = await service.chat(request)
    expect(
      store.resolveProposal(
        state.proposals[0].id,
        'approve',
        '2026-10-20T12:00:00Z',
      ).issues,
    ).toContain('past_time')
  })
  it('revalidates even a malformed stored slot', async () => {
    const { store, service } = setup()
    const state = await service.chat(request)
    const p = state.proposals[0]
    store.addProposal({
      ...p,
      end: instant(date, '18:00', defaultSettings.timezone),
    })
    expect(store.resolveProposal(p.id, 'approve', now).issues).toContain(
      'duration_mismatch',
    )
    expect(store.snapshot().events).toHaveLength(0)
  })
})

describe('model integration failure boundaries', () => {
  it('stores grounded project/context labels and drops unsupported labels', async () => {
    const { service } = setup()
    const metadata = {
      summary: 'Read',
      tags: ['study'] as const,
      stages: [{ label: 'Read', evidence: 'Read' }],
      externalDependency: null,
      scopeKnown: true,
      project: { name: 'Atlas', evidence: 'Project Atlas' },
      context: { name: 'library', evidence: 'in the library' },
    }
    const state = await service.createTask(
      { title: 'Read', description: 'Project Atlas: Read in the library.' },
      async () => ({ ...metadata, tags: [...metadata.tags] }),
    )
    expect(state.tasks[0].project).toBe('Atlas')
    expect(state.tasks[0].context).toBe('library')
    const second = await service.createTask(
      { title: 'Read', description: 'Read one supplied paper.' },
      async () => ({ ...metadata, tags: [...metadata.tags] }),
    )
    expect(second.tasks[1].project).toBeNull()
    expect(second.tasks[1].context).toBeNull()
  })
  it('fails closed on provider errors and preserves a visible error message', async () => {
    const { store } = setup()
    const service = new SchedulingService(
      store,
      async () => {
        throw new DomainError('model_unavailable')
      },
      () => now,
    )
    const state = await service.chat(request)
    expect(state.events).toHaveLength(0)
    expect(state.proposals).toHaveLength(0)
    expect(state.messages.at(-1)?.codes).toEqual(['model_unavailable'])
  })
  it('blocks invalid model output', async () => {
    const { store } = setup()
    const service = new SchedulingService(
      store,
      async () => ({ ...extracted(), date: '2026-99-99' }),
      () => now,
    )
    expect((await service.chat(request)).messages.at(-1)?.kind).toBe('error')
  })
  it('does not carry previous constraints into an explicitly new request', async () => {
    const { store } = setup()
    const seen: string[] = []
    const service = new SchedulingService(
      store,
      async (text) => {
        seen.push(text)
        return extracted({ intent: 'clarify' })
      },
      () => now,
    )
    await service.chat('First request')
    await service.chat('A new task', null, false)
    expect(seen[1]).toBe('A new task')
  })
  it('retains missing-detail context for clarification replies', async () => {
    const { store } = setup()
    const seen: string[] = []
    const service = new SchedulingService(
      store,
      async (text) => {
        seen.push(text)
        return extracted({ intent: 'clarify' })
      },
      () => now,
    )
    await service.chat('Schedule study tomorrow')
    await service.chat('45 minutes')
    expect(seen[1]).toContain('Schedule study tomorrow')
    expect(seen[1]).toContain('45 minutes')
  })
  it('saves task metadata without creating a calendar event', async () => {
    const { service } = setup()
    const state = await service.createTask(
      { title: 'Paper', description: 'Read, compare, write' },
      async () => ({
        summary: 'Three stages',
        tags: ['research', 'writing'],
        stages: ['Read', 'compare', 'write'].map((evidence) => ({
          label: evidence,
          evidence,
        })),
        externalDependency: null,
        scopeKnown: true,
      }),
    )
    expect(state.tasks[0].complexity).toBe('high')
    expect(state.events).toHaveLength(0)
  })
  it('returns eligible and excluded records separately for preference questions', async () => {
    const { store } = setup()
    const old = store.savePreference(
      {
        text: 'Morning',
        kind: 'soft',
        days: [1],
        startTime: '09:00',
        endTime: '11:00',
        effectiveFrom: '2026-01-01',
        expiresOn: null,
        supersedesId: null,
      },
      now,
    )
    store.savePreference(
      {
        text: 'Afternoon',
        kind: 'soft',
        days: [1],
        startTime: '14:00',
        endTime: '17:00',
        effectiveFrom: date,
        expiresOn: null,
        supersedesId: old.id,
      },
      now,
    )
    const service = new SchedulingService(
      store,
      async () => extracted({ intent: 'preference' }),
      () => now,
    )
    const state = await service.chat(`Preferences on ${date}`)
    expect(state.messages.at(-1)?.evidence?.supporting[0].text).toBe(
      'Afternoon',
    )
    expect(state.messages.at(-1)?.evidence?.excluded[0].reason).toBe(
      'superseded',
    )
    expect(state.proposals).toHaveLength(0)
  })
})
