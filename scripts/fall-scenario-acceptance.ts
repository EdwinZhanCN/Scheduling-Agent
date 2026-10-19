import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { Store } from '../src/server/store.server'
import { SchedulingService } from '../src/server/service.server'
import { interpret } from '../src/server/provider.server'
import type { Snapshot } from '../src/domain/contracts'
import { localTime } from '../src/domain/time'
import { referenceNow, seedFallCalendar, zone } from './fixtures/fall-2026'

const output = `artifacts/fall-${new Date().toISOString().replaceAll(':', '-')}`
mkdirSync(output, { recursive: true })
const protocol = readFileSync('docs/fall-scenarios.md', 'utf8')
writeFileSync(`${output}/protocol.md`, protocol)
const calls: unknown[] = []
const results: { id: string; passed: boolean; error?: string }[] = []
let currentCase = ''
const recording: typeof interpret = async (request, state, now) => {
  const started = Date.now()
  try {
    const response = await interpret(request, state, now)
    calls.push({
      case: currentCase,
      request,
      state,
      now,
      response,
      latencyMs: Date.now() - started,
    })
    writeFileSync(`${output}/calls.json`, JSON.stringify(calls, null, 2))
    return response
  } catch (error) {
    calls.push({ case: currentCase, request, now, error: String(error) })
    writeFileSync(`${output}/calls.json`, JSON.stringify(calls, null, 2))
    throw error
  }
}
const pending = (s: Snapshot) => {
  assert.equal(
    s.messages.at(-1)?.kind,
    'proposal',
    JSON.stringify(s.messages.at(-1)),
  )
  const p = s.proposals.find(
    (candidate) => candidate.id === s.messages.at(-1)?.proposalId,
  )
  assert.ok(p)
  assert.equal(p.status, 'pending')
  return p
}
function clarify(s: Snapshot) {
  assert.equal(
    s.messages.at(-1)?.kind,
    'clarify',
    JSON.stringify(s.messages.at(-1)),
  )
}
const wall = (value: string) => localTime(value, zone)
async function run(
  id: string,
  scenario: (store: Store, service: SchedulingService) => Promise<void>,
) {
  currentCase = id
  const store = new Store(`${output}/${id}.sqlite`)
  seedFallCalendar(store)
  const service = new SchedulingService(store, recording, () => referenceNow)
  try {
    await scenario(store, service)
    results.push({ id, passed: true })
  } catch (error) {
    results.push({
      id,
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    })
  } finally {
    if (store.db.open) {
      writeFileSync(
        `${output}/${id}-state.json`,
        JSON.stringify(store.snapshot(), null, 2),
      )
      store.close()
    }
    console.log(id, results.at(-1)?.passed ? 'PASS' : 'FAIL')
  }
}
const rehearsal =
  'Schedule A2 rehearsal on 2026-10-19 for 60 minutes, not before 13:30 and finish by 17:00.'
await run('F01-monday', async (store, service) => {
  const before = store.snapshot().events.length
  const p = pending(await service.chat(rehearsal))
  assert.equal(wall(p.start), '15:50')
  assert.equal(wall(p.end), '16:50')
  assert.equal(store.snapshot().events.length, before)
  assert.equal(
    store.resolveProposal(p.id, 'approve', referenceNow).status,
    'approved',
  )
  store.resolveProposal(p.id, 'approve', referenceNow)
  assert.equal(store.snapshot().events.length, before + 1)
})
await run('F02-competing-meeting', async (store, service) => {
  const p = pending(await service.chat(rehearsal))
  const meeting = pending(
    await service.chat(
      'Schedule a temporary team meeting on 2026-10-19 for 15 minutes at 16:00.',
      null,
      false,
    ),
  )
  store.resolveProposal(meeting.id, 'approve', referenceNow)
  const result = store.resolveProposal(p.id, 'approve', referenceNow)
  assert.equal(result.status, 'invalidated')
  assert.ok(result.issues.includes('calendar_conflict'))
  assert.equal(store.snapshot().events.length, 11)
})
await run('F03-tuesday-move-reopen', async (store, service) => {
  const p = pending(
    await service.chat(
      'Schedule PSoft HW3 on 2026-10-20 for 90 minutes, not before 11:50 and finish by 14:00.',
    ),
  )
  assert.equal(wall(p.start), '11:50')
  store.resolveProposal(p.id, 'approve', referenceNow)
  const id = `event-${p.id}`
  clarify(
    await service.chat(`Move event ${id} to 2026-10-20 at 16:00.`, null, false),
  )
  assert.equal(
    wall(store.snapshot().events.find((e) => e.id === id)!.start),
    '11:50',
  )
  const moved = pending(
    await service.chat(`Move event ${id} to 2026-10-20 at 18:00.`, null, false),
  )
  assert.equal(wall(moved.end), '19:30')
  store.resolveProposal(moved.id, 'approve', referenceNow)
  const path = store.db.name
  store.close()
  const reopened = new Store(path)
  try {
    assert.equal(
      wall(reopened.snapshot().events.find((e) => e.id === id)!.start),
      '18:00',
    )
    writeFileSync(
      `${output}/F03-reopened.json`,
      JSON.stringify(reopened.snapshot(), null, 2),
    )
  } finally {
    reopened.close()
  }
})
await run('F04-exam-followup', async (store, service) => {
  clarify(
    await service.chat(
      'Schedule Test 2 reflection on 2026-11-10 for 90 minutes, not before 18:00 and finish by 20:00.',
    ),
  )
  const p = pending(
    await service.chat(
      'Change the duration to 10 minutes; keep the date and time bounds.',
    ),
  )
  assert.equal(wall(p.start), '19:50')
  assert.equal(wall(p.end), '20:00')
  assert.equal(p.constraints?.date, '2026-11-10')
  assert.equal(p.constraints.latestEnd, '20:00')
  assert.equal(store.snapshot().events.length, 10)
})
await run('F05-econ-deadline', async (_store, service) => {
  const p = pending(
    await service.chat(
      'Schedule ECON Discrimination preparation on 2026-10-22 for 60 minutes, not before 11:50 and finish by 14:00.',
    ),
  )
  assert.equal(wall(p.start), '11:50')
  assert.equal(wall(p.end), '12:50')
})
await run('F06-conflicting-sources', async (store, service) => {
  clarify(
    await service.chat(
      'A2 has conflicting deadlines: Submitty says 2026-10-18 at 23:59, the announcement says 2026-10-19 at 17:00. I do not know which is correct. Arrange 60 minutes of final checking before the correct deadline.',
    ),
  )
  assert.equal(store.snapshot().events.length, 10)
  assert.equal(store.snapshot().proposals.length, 0)
})
await run('F07-corrected-health-date', async (store, service) => {
  clarify(
    await service.chat(
      'Schedule Health preparation on 2026-11-09 for 60 minutes at 14:00.',
    ),
  )
  assert.equal(
    store.snapshot().events.filter((e) => e.title.includes('Health')).length,
    1,
  )
  assert.equal(store.snapshot().proposals.length, 0)
})
await run('F08-litr-reject', async (store, service) => {
  const p = pending(
    await service.chat(
      'Schedule LITR Close Reading 2 editing on 2026-10-25 for 90 minutes at 19:00.',
    ),
  )
  assert.equal(wall(p.end), '20:30')
  store.resolveProposal(p.id, 'reject', referenceNow)
  assert.equal(store.snapshot().events.length, 10)
})
await run('F09-preference-revision', async (store, service) => {
  const input = {
    text: 'Test assumption: prefer morning study',
    kind: 'soft' as const,
    effectiveFrom: '2026-10-01',
    expiresOn: null,
    days: [1, 2, 3, 4, 5],
    startTime: '09:00',
    endTime: '10:00',
    supersedesId: null,
  }
  const old = store.savePreference(input, referenceNow)
  const p = pending(
    await service.chat(
      'Use my preferences to schedule 30 minutes of PSoft practice on 2026-10-20.',
    ),
  )
  assert.equal(wall(p.start), '09:00')
  const next = store.savePreference(
    {
      ...input,
      text: 'Test assumption: prefer afternoon study',
      effectiveFrom: '2026-10-19',
      startTime: '12:00',
      endTime: '14:00',
      supersedesId: old.id,
    },
    referenceNow,
  )
  assert.equal(
    store.resolveProposal(p.id, 'approve', referenceNow).status,
    'invalidated',
  )
  const state = await service.chat(
    'What are my current preferred times on 2026-10-20?',
    null,
    false,
  )
  assert.equal(state.messages.at(-1)?.kind, 'summary')
  assert.ok(
    state.messages.at(-1)?.evidence?.supporting.some((e) => e.id === next.id),
  )
  assert.ok(
    state.messages.at(-1)?.evidence?.excluded.some((e) => e.id === old.id),
  )
  const fresh = pending(
    await service.chat(
      'Use my preferences to schedule 30 minutes of PSoft practice on 2026-10-20.',
      null,
      false,
    ),
  )
  assert.equal(wall(fresh.start), '12:00')
  assert.ok(fresh.excluded.some((e) => e.id === old.id))
})
const report = {
  protocolSha256: createHash('sha256').update(protocol).digest('hex'),
  referenceNow,
  realApiCalls: calls.length,
  passed: results.filter((r) => r.passed).length,
  total: results.length,
  results,
}
writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2))
console.log(output, JSON.stringify(report))
process.exitCode = report.passed === report.total ? 0 : 1
