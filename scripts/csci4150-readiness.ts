import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
import { z } from 'zod'
import { defaultSettings } from '../src/domain/contracts'
import type {
  Interpretation,
  Message,
  Proposal,
  Snapshot,
} from '../src/domain/contracts'
import { instant, localDate, localTime } from '../src/domain/time'
import {
  createInterpreter,
  interpret,
  modelConfigured,
} from '../src/server/provider.server'
import type { Interpreter } from '../src/server/provider.server'
import { SchedulingService } from '../src/server/service.server'
import { Store } from '../src/server/store.server'
import fixture from './fixtures/csci4150-readiness.json'

type Case = (typeof fixture.cases)[number]
type Slot = NonNullable<Proposal['constraints']>
type Response = { message: Message; draft?: Proposal }
type Arm = 'deepseek' | 'rules' | 'local'
type Judge = { passed: boolean; issues: string[]; critical: boolean }

const structuredLocal = process.argv[3] === '--local-structured'
const localOnly = structuredLocal || process.argv[3] === '--local'
const replaySource = localOnly ? undefined : process.argv[3]
if (!localOnly && !replaySource && !modelConfigured())
  throw new Error('The existing DeepSeek configuration is unavailable')

const source = readFileSync(
  new URL('./fixtures/csci4150-readiness.json', import.meta.url),
)
const prior = replaySource
  ? (JSON.parse(readFileSync(replaySource + '/summary.json', 'utf8')) as {
      started: string
      ended: string
      model: string
      protocolSha256: string
    })
  : null
const started = prior?.started ?? new Date().toISOString()
const output =
  process.argv[2] ||
  'artifacts/csci4150-readiness-' + started.replaceAll(':', '-')
mkdirSync(output, { recursive: true })
writeFileSync(output + '/protocol.json', source, { flag: 'wx' })

const localModel = 'qwen2.5-1.5b-q4_k_m'
const localInterpreter = createInterpreter(async (system, payload, schema) => {
  const response = await fetch('http://127.0.0.1:3019/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.SCHEDULING_EVAL_LOCAL_KEY
        ? { Authorization: 'Bearer ' + process.env.SCHEDULING_EVAL_LOCAL_KEY }
        : {}),
    },
    body: JSON.stringify({
      model: localModel,
      temperature: 0,
      seed: 4150,
      response_format: structuredLocal
        ? {
            type: 'json_schema',
            json_schema: {
              name: 'schedule_interpretation',
              strict: true,
              schema: z.toJSONSchema(schema),
            },
          }
        : { type: 'json_object' },
      max_tokens: 1024,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: JSON.stringify(payload) },
      ],
    }),
    signal: AbortSignal.timeout(45_000),
  })
  if (!response.ok) throw new Error('Local runtime HTTP ' + response.status)
  const envelope = (await response.json()) as {
    choices: { finish_reason: string; message: { content: string } }[]
  }
  const choice = envelope.choices.at(0)
  if (choice?.finish_reason !== 'stop')
    throw new Error('Local model output was incomplete')
  return schema.parse(JSON.parse(choice.message.content))
})

const emptyMetadata = {
  summary: '',
  tags: [],
  stages: [],
  externalDependency: null,
  scopeKnown: false,
}
const clock = '([012][0-9]:[0-5][0-9])'
const bounds = new RegExp('between\\s+' + clock + '\\s+and\\s+' + clock, 'i')
const startBound = new RegExp(
  '(?:not before|no earlier than|after|at or after)\\s+' + clock,
  'i',
)
const endBound = new RegExp(
  '(?:finish(?:ing)? by|end(?:ing)? by|no later than)\\s+' + clock,
  'i',
)
const exact = new RegExp(
  '\\b(?:at(?: exactly)?|to(?: start at)?)\\s+' + clock,
  'i',
)

const ruleParser: Interpreter = async (request, state) => {
  const date = request.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0] ?? null
  const minutes = request.match(/\b(\d+)[ -]minutes?\b/i)
  const range = request.match(bounds)
  const earliestStart = range?.[1] ?? request.match(startBound)?.[1] ?? null
  const latestEnd = range?.[2] ?? request.match(endBound)?.[1] ?? null
  const exactStart = request.match(exact)?.[1] ?? null
  const operation = /^(move|shift)\b/i.test(request)
    ? 'move'
    : /^(delete|remove)\b/i.test(request)
      ? 'delete'
      : 'create'
  const eventId =
    state.events.find(({ id }) => request.split(/\W+/).includes(id))?.id ?? null
  const durationMinutes = minutes ? Number(minutes[1]) : null
  const distinctClocks = [...request.matchAll(/\b\d{2}:\d{2}\b/g)].map(
    (match) => match[0],
  )
  const unexplainedClock = distinctClocks.some(
    (value) => ![earliestStart, latestEnd, exactStart].includes(value),
  )
  let clarification: string | null = null
  if (/\b(?:repeat|every|each)\b/i.test(request))
    clarification =
      'Please provide a single date. Recurring requests are outside this workflow.'
  else if (operation !== 'create' && !eventId)
    clarification = 'Which event ID should be changed?'
  else if (!date) clarification = 'What date should I schedule?'
  else if (/\bat (?:[1-9]|one|two|three|four|five)(?![\d:])/i.test(request))
    clarification = 'Please specify AM or PM, or use a 24-hour time.'
  else if (request.includes('\nFollow-up: ') || unexplainedClock)
    clarification =
      'Please restate the date, duration, and time bounds explicitly.'
  else if (
    (operation === 'create' && !durationMinutes) ||
    (durationMinutes && (durationMinutes < 5 || durationMinutes > 720))
  )
    clarification = 'Please give a duration in numeric minutes.'
  const parsed: Interpretation = {
    intent: clarification ? 'clarify' : operation,
    eventId,
    title: 'Scheduled work',
    date,
    durationMinutes:
      durationMinutes && durationMinutes >= 5 && durationMinutes <= 720
        ? durationMinutes
        : null,
    earliestStart,
    latestEnd,
    exactStart,
    spans: {
      date,
      durationMinutes: minutes?.[0] ?? null,
      earliestStart,
      latestEnd,
      exactStart,
    },
    usePreferences: false,
    clarification,
    metadata: emptyMetadata,
  }
  return parsed
}

function insertEvent(
  store: Store,
  fixtureCase: Case,
  event: { id: string; title?: string; start: string; end: string },
) {
  const { timezone, event_date: date } = fixtureCase.context
  if (!date) throw new Error('Calendar fixture has no event date')
  const value = {
    id: event.id,
    title: event.title ?? event.id,
    timezone,
    version: 1,
    taskId: null,
    start: instant(date, event.start, timezone),
    end: instant(date, event.end, timezone),
  }
  store.db
    .prepare('INSERT INTO events (id, data) VALUES (?, ?)')
    .run(event.id, JSON.stringify(value))
}

function seed(store: Store, scenario: Case) {
  const {
    timezone,
    availability,
    events,
    preferences,
    reference_time: now,
  } = scenario.context
  store.saveSettings({
    ...defaultSettings,
    timezone,
    dayStart: availability[0],
    dayEnd: availability[1],
  })
  for (const event of events) insertEvent(store, scenario, event)
  const keys = new Map<string, string>()
  for (const preference of preferences) {
    const created = store.savePreference(
      {
        text: preference.id,
        kind: 'soft',
        days: [1, 2, 3, 4, 5, 6, 7],
        effectiveFrom: preference.effective_from,
        expiresOn: null,
        startTime: preference.window[0],
        endTime: preference.window[1],
        supersedesId:
          preference.id === 'CURRENT' ? (keys.get('OLD') ?? null) : null,
      },
      now,
    )
    keys.set(preference.id, created.id)
  }
}

const clarificationChecks = {
  duration: /missing_duration|duration|how (?:long|many minutes)|length/i,
  date: /missing_date|what date|which date|what day|which day|provide.*date|specify.*date/i,
  infeasible:
    /no_feasible_slot|conflicting|contradict|impossible|(?:cannot|does not|won't|doesn't|can.?t).{0,40}fit|(?:window|time).{0,30}too short|15:30.*16:00.*45 minutes|earliest.*latest/i,
  meridiem:
    /am or pm|am\/pm|03:00.{0,20}15:00|3\s*a\.?m\.?.{0,20}3\s*p\.?m\.?|24-hour/i,
  recurrence: /recurr|repeat|single.date|single occurrence/i,
  identity: /which event|which project meeting|two.{0,25}meetings|E1.{0,30}E2/i,
} as const

function score(
  scenario: Case,
  responses: Response[],
  initialEventsUnchanged: boolean,
  staleRejected: boolean | null,
): Judge {
  const { oracle, context, expected_action: expected } = scenario
  const issues: string[] = []
  let critical = !initialEventsUnchanged
  if (!initialEventsUnchanged) issues.push('calendar mutated before approval')
  if (oracle.clarification) {
    const first = responses[0]
    const explanation = first.message.codes.join(' ') + ' ' + first.message.text
    if (first.message.kind !== 'clarify' || first.draft) {
      issues.push('expected clarification: ' + oracle.clarification)
      if (first.draft) critical = true
    } else if (
      !clarificationChecks[
        oracle.clarification as keyof typeof clarificationChecks
      ].test(explanation)
    ) {
      issues.push('clarification missed: ' + oracle.clarification)
    }
  }
  if (expected !== 'clarify') {
    const last = responses.at(-1)
    const proposal = last?.draft
    if (
      last?.message.kind !== 'proposal' ||
      !proposal ||
      proposal.status !== 'pending'
    ) {
      issues.push('expected pending proposal')
    } else {
      const start = localTime(proposal.start, context.timezone)
      const end = localTime(proposal.end, context.timezone)
      const duration =
        (Date.parse(proposal.end) - Date.parse(proposal.start)) / 60_000
      const operation = oracle.operation ?? 'create'
      const expectedConstraints: Partial<Slot> = {}
      if (oracle.lower && !oracle.support)
        expectedConstraints.earliestStart = oracle.lower
      if (oracle.upper && !oracle.support)
        expectedConstraints.latestEnd = oracle.upper
      const constraintsOmitted = Object.entries(expectedConstraints).some(
        ([key, value]) => proposal.constraints?.[key as keyof Slot] !== value,
      )
      const overlap = context.events.some(
        (event) =>
          event.id !== proposal.eventId &&
          start < event.end &&
          event.start < end,
      )
      if (
        proposal.operation !== operation ||
        proposal.eventId !== (oracle.eventId ?? null) ||
        (operation !== 'delete' &&
          (localDate(proposal.start, context.timezone) !== context.event_date ||
            start < context.availability[0] ||
            end > context.availability[1] ||
            overlap ||
            (oracle.duration !== undefined && duration !== oracle.duration) ||
            (oracle.start && start !== oracle.start) ||
            (oracle.end && end !== oracle.end) ||
            (!oracle.support &&
              ((oracle.lower && start < oracle.lower) ||
                (oracle.upper && end > oracle.upper)))))
      ) {
        issues.push('proposal violates a hard constraint or target')
        critical = true
      }
      if (constraintsOmitted)
        issues.push('proposal lost explicit constraint evidence')
      if (
        oracle.support &&
        (!proposal.supporting.some(({ text }) => text === oracle.support) ||
          !proposal.excluded.some(
            ({ text, reason }) =>
              text === oracle.exclude &&
              reason ===
                (oracle.reason === 'not_yet_effective'
                  ? 'not_effective'
                  : oracle.reason),
          ) ||
          (oracle.lower && start < oracle.lower) ||
          (oracle.upper && end > oracle.upper))
      )
        issues.push('current preference or exclusion evidence missing')
    }
  }
  if (oracle.stale && staleRejected !== true) {
    issues.push('stale proposal was not demonstrated to reject')
    if (staleRejected === false) critical = true
  }
  return { passed: issues.length === 0, issues, critical }
}

async function evaluate(scenario: Case, variant: number, arm: Arm) {
  const store = new Store(':memory:')
  const responses: Response[] = []
  const calls: {
    latencyMs: number
    output?: Interpretation
    failure?: string
  }[] = []
  let unchanged = true
  let staleRejected: boolean | null = null
  try {
    const { reference_time: now } = scenario.context
    seed(store, scenario)
    const interpreter = {
      deepseek: interpret,
      rules: ruleParser,
      local: localInterpreter,
    }[arm]
    const service = new SchedulingService(
      store,
      async (request, current, referencedAt) => {
        const at = performance.now()
        try {
          const outputValue = await interpreter(request, current, referencedAt)
          calls.push({
            latencyMs: Math.round(performance.now() - at),
            output: outputValue,
          })
          return outputValue
        } catch (error) {
          calls.push({
            latencyMs: Math.round(performance.now() - at),
            failure: error instanceof Error ? error.message : 'unknown',
          })
          throw error
        }
      },
      () => now,
    )
    const prompt =
      variant === 1 ? scenario.request : scenario.meaning_preserving_variant
    for (const turn of prompt.split(' [After clarification:] ')) {
      const before = JSON.stringify(store.snapshot().events)
      const snapshot: Snapshot = await service.chat(turn)
      const message = snapshot.messages.at(-1)
      if (!message) throw new Error('Missing service response')
      const draft = snapshot.proposals.find(
        ({ id }) => id === message.proposalId,
      )
      responses.push({ message, draft })
      unchanged = unchanged && JSON.stringify(snapshot.events) === before
    }
    const draft = responses[0]?.draft
    if (scenario.oracle.stale && draft) {
      insertEvent(store, scenario, {
        id: 'intervening-event',
        start: '10:00',
        end: '10:30',
      })
      const before = JSON.stringify(store.snapshot().events)
      const approval = store.resolveProposal(draft.id, 'approve', now)
      staleRejected =
        approval.status === 'invalidated' &&
        approval.issues.includes('calendar_conflict') &&
        JSON.stringify(store.snapshot().events) === before
    }
    return {
      id: scenario.id,
      slice: scenario.slice,
      variant,
      arm,
      responses,
      calls,
      unchanged,
      staleRejected,
      ...score(scenario, responses, unchanged, staleRejected),
    }
  } finally {
    store.close()
  }
}

const variants = [1, 2] as const
const evaluatedArms: Arm[] = localOnly ? ['local'] : ['deepseek', 'rules']
const results: Awaited<ReturnType<typeof evaluate>>[] = []
if (replaySource) {
  const original = readFileSync(replaySource + '/protocol.json')
  if (!source.equals(original))
    throw new Error('The replay protocol must match the frozen original')
  const rows: typeof results = JSON.parse(
    readFileSync(replaySource + '/results.json', 'utf8'),
  )
  if (rows.length !== fixture.cases.length * 4)
    throw new Error('Original run is incomplete')
  for (const row of rows) {
    const scenario = fixture.cases.find(({ id }) => id === row.id)
    if (!scenario) throw new Error('Unexpected case in original run: ' + row.id)
    results.push({
      ...row,
      ...score(scenario, row.responses, row.unchanged, row.staleRejected),
    })
  }
  writeFileSync(output + '/results.json', JSON.stringify(results, null, 2))
} else {
  for (const scenario of fixture.cases) {
    const batch = await Promise.all(
      variants.flatMap((variant) =>
        evaluatedArms.map((arm) => evaluate(scenario, variant, arm)),
      ),
    )
    results.push(...batch)
    writeFileSync(output + '/results.json', JSON.stringify(results, null, 2))
    console.log(
      scenario.id,
      batch
        .map(
          (entry) =>
            entry.arm +
            '/' +
            entry.variant +
            '=' +
            (entry.passed ? 'pass' : entry.issues.join('; ')),
        )
        .join(' | '),
    )
  }
}

const arms = evaluatedArms.map((arm) => {
  const rows = results.filter((row) => row.arm === arm)
  const passed = rows.filter((row) => row.passed)
  return {
    arm,
    tested: rows.length,
    passed: passed.length,
    bothVariantsPassed: fixture.cases.filter(
      (scenario) => passed.filter((row) => row.id === scenario.id).length === 2,
    ).length,
    critical: rows.filter((row) => row.critical).length,
    unauthorizedWrites: rows.filter((row) => !row.unchanged).length,
    providerErrors: rows
      .flatMap((row) => row.calls)
      .filter((call) => call.failure).length,
    verdict:
      passed.length / rows.length >= 0.9 &&
      rows.every((row) => !row.critical) &&
      rows
        .filter(
          (row) =>
            fixture.cases.find((scenario) => scenario.id === row.id)?.oracle
              .clarification ||
            fixture.cases.find((scenario) => scenario.id === row.id)?.oracle
              .stale,
        )
        .every((row) => row.passed)
        ? 'READY_WITHIN_SCOPE'
        : 'MODIFY',
  }
})
const summary = {
  started,
  ended: prior?.ended ?? new Date().toISOString(),
  model:
    prior?.model ??
    (localOnly ? localModel : process.env.DEEPSEEK_MODEL || 'deepseek-flash'),
  localOutputMode: localOnly
    ? structuredLocal
      ? 'json_schema'
      : 'json_object'
    : null,
  rescoreNote: prior
    ? 'Same recorded outputs. The planned future-effective exclusion maps to the product code not_effective.'
    : null,
  protocolSha256: createHash('sha256').update(source).digest('hex'),
  setting:
    'Synthetic, English-only paired functional cases. Review by the evaluator only, with known historical scenario overlap.',
  arms,
}
writeFileSync(output + '/summary.json', JSON.stringify(summary, null, 2) + '\n')
console.log(JSON.stringify(summary, null, 2))
