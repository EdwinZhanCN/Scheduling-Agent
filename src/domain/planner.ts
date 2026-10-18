import { Temporal } from 'temporal-polyfill'
import type {
  Complexity,
  Constraints,
  Event,
  Interpretation,
  Metadata,
  Preference,
  Proposal,
  Settings,
} from './contracts'
import { retrievePreferences } from './retrieval'
import {
  clock,
  epoch,
  instant,
  localDate,
  localTime,
  minutes,
  overlaps,
} from './time'

export function complexity(metadata: Metadata, source: string): Complexity {
  if (
    !metadata.scopeKnown ||
    metadata.stages.length === 0 ||
    metadata.stages.some((stage) => !source.includes(stage.evidence))
  )
    return 'unknown'
  if (
    metadata.externalDependency &&
    !source.includes(metadata.externalDependency)
  )
    return 'unknown'
  const dependency = metadata.externalDependency || ''
  const pending =
    /\b(wait(?:ing)?|await(?:ing)?|pending|approval|external dependency)\b|等待|待批|审批|外部依赖/i.test(
      dependency,
    )
  const alreadyAvailable =
    /\b(supplied|provided|existing|received|already available)\b|已提供|已收到|现有/i.test(
      dependency,
    )
  if (dependency && !pending && !alreadyAvailable) return 'unknown'
  const stageCount = new Set(
    metadata.stages.map((stage) => stage.evidence.trim().toLowerCase()),
  ).size
  if (pending || stageCount >= 3) return 'high'
  return stageCount === 2 ? 'medium' : 'low'
}

function parsedClock(raw: string): string | null {
  const match = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm|点|時|时)?$/i.exec(raw.trim())
  if (!match) return null
  let h = Number(match[1])
  const m = Number(match[2] || 0)
  const suffix = (match[3] || '').toLowerCase()
  if ((suffix === 'am' || suffix === 'pm') && (h < 1 || h > 12)) return null
  if (suffix === 'am' && h === 12) h = 0
  if (suffix === 'pm' && h < 12) h += 12
  if (h > 23 || m > 59) return null
  return clock(h * 60 + m)
}

// Independent guards for explicit numeric constraints; unsupported wording still requires
// grounded model extraction and visible human review. This is not a universal language parser.
export function explicitConstraints(request: string) {
  const values: Partial<Constraints> = {}
  const issues: string[] = []
  function add(key: keyof Constraints, value: string | number) {
    if (key === 'latestEnd' && values.latestEnd) {
      values.latestEnd =
        String(value) < values.latestEnd ? String(value) : values.latestEnd
      return
    }
    if (key === 'earliestStart' && values.earliestStart) {
      values.earliestStart =
        String(value) > values.earliestStart
          ? String(value)
          : values.earliestStart
      return
    }
    if (values[key] !== undefined && values[key] !== value)
      issues.push('ambiguous_constraints')
    Object.assign(values, { [key]: value })
  }
  for (const m of request.matchAll(
    /(\d+(?:\.\d+)?)\s*(minutes?|mins?|小时|小時|hours?|hrs?|分钟|分鐘)/gi,
  )) {
    const value = Number(m[1]) * (/^(h|小)/i.test(m[2]) ? 60 : 1)
    if (Number.isInteger(value)) add('durationMinutes', value)
  }
  const time = '(\\d{1,2}(?::\\d{2})?\\s*(?:am|pm|点|时)?)'
  for (const m of request.matchAll(
    new RegExp(
      '(?:finish(?:ing)?|end(?:ing)?|complete|done)\\s*(?:no later than|by|before|at)\\s*' +
        time +
        '|(?:latest end|deadline|no later than|最晚|不晚于|截止到)\\s*(?:is|of|:)?\\s*' +
        time,
      'gi',
    ),
  )) {
    const value = parsedClock(m[1] || m[2])
    if (value) add('latestEnd', value)
  }
  for (const m of request.matchAll(
    new RegExp(time + '\\s*(?:之前|前)(?:结束|完成)', 'gi'),
  )) {
    const value = parsedClock(m[1])
    if (value) add('latestEnd', value)
  }
  for (const m of request.matchAll(
    new RegExp(
      '(?:not before|no earlier than|earliest start|starting from|不得早于|不早于)\\s*(?:is|:)?\\s*' +
        time,
      'gi',
    ),
  )) {
    const value = parsedClock(m[1])
    if (value) add('earliestStart', value)
  }
  for (const m of request.matchAll(
    new RegExp(
      '(?:between|available from)\\s*' + time + '\\s*(?:and|to|-)\\s*' + time,
      'gi',
    ),
  )) {
    const start = parsedClock(m[1])
    const end = parsedClock(m[2])
    if (start) add('earliestStart', start)
    if (end) add('latestEnd', end)
  }
  const dates = new Set(request.match(/\b\d{4}-\d{2}-\d{2}\b/g) ?? [])
  if (dates.size === 1) values.date = [...dates][0]
  return { values, issues }
}

export function validateInterpretation(
  input: Interpretation,
  request: string,
  constraintTurns: readonly string[] = [request],
) {
  const issues: string[] = []
  for (const key of [
    'date',
    'durationMinutes',
    'earliestStart',
    'latestEnd',
    'exactStart',
  ] as const) {
    if (
      input[key] !== null &&
      (!input.spans[key] || !request.includes(input.spans[key]))
    )
      issues.push('ungrounded_constraint')
  }
  // Turn boundaries come from persisted server messages, never from splitting user text.
  // A reply replaces only the fields it explicitly supplies; other bounds still apply.
  const explicit = {
    values: {} as Partial<Constraints>,
    issues: [] as string[],
  }
  for (const turn of constraintTurns) {
    const parsed = explicitConstraints(turn)
    Object.assign(explicit.values, parsed.values)
    explicit.issues.push(...parsed.issues)
  }
  issues.push(...explicit.issues)
  for (const key of [
    'date',
    'durationMinutes',
    'earliestStart',
    'latestEnd',
  ] as const) {
    if (
      explicit.values[key] !== undefined &&
      input[key] !== explicit.values[key]
    )
      issues.push('constraint_mismatch')
  }
  return [...new Set(issues)]
}

type Context = {
  settings: Settings
  events: Event[]
  preferences: Preference[]
  now: string
}

export function validateSlot(
  slot: { start: string; end: string },
  constraints: Constraints,
  context: Context,
  ignoreEventId: string | null = null,
): string[] {
  const { settings, events, preferences, now } = context
  const issues: string[] = []
  try {
    const start = epoch(slot.start)
    const end = epoch(slot.end)
    const day = localDate(slot.start, settings.timezone)
    const startTime = localTime(slot.start, settings.timezone)
    const endTime = localTime(slot.end, settings.timezone)
    if (end <= start || (end - start) / 60000 !== constraints.durationMinutes)
      issues.push('duration_mismatch')
    if (
      day !== constraints.date ||
      localDate(slot.end, settings.timezone) !== constraints.date
    )
      issues.push('date_mismatch')
    if (start < epoch(now)) issues.push('past_time')
    if (
      !settings.workingDays.includes(Temporal.PlainDate.from(day).dayOfWeek) ||
      startTime < settings.dayStart ||
      endTime > settings.dayEnd
    )
      issues.push('outside_availability')
    if (constraints.earliestStart && startTime < constraints.earliestStart)
      issues.push('earliest_start_violation')
    if (constraints.latestEnd && endTime > constraints.latestEnd)
      issues.push('deadline_violation')
    if (constraints.exactStart && startTime !== constraints.exactStart)
      issues.push('exact_start_violation')
    if (
      events.some(
        (event) => event.id !== ignoreEventId && overlaps(slot, event),
      )
    )
      issues.push('calendar_conflict')
    for (const p of retrievePreferences(preferences, day, '').eligible.filter(
      (record) => record.kind === 'hard',
    )) {
      if (
        overlaps(slot, {
          start: instant(day, p.startTime, settings.timezone),
          end: instant(day, p.endTime, settings.timezone),
        })
      )
        issues.push('hard_preference_conflict')
    }
  } catch {
    issues.push('invalid_time')
  }
  return [...new Set(issues)]
}

export type Plan =
  | { ok: false; codes: string[] }
  | {
      ok: true
      draft: Pick<
        Proposal,
        | 'operation'
        | 'title'
        | 'start'
        | 'end'
        | 'timezone'
        | 'eventId'
        | 'eventVersion'
        | 'constraints'
        | 'supporting'
        | 'excluded'
      >
    }

export function plan(
  input: Interpretation,
  request: string,
  context: Context,
  constraintTurns?: readonly string[],
): Plan {
  if (
    input.intent === 'clarify' ||
    input.intent === 'summarize' ||
    input.intent === 'preference'
  )
    return { ok: false, codes: ['needs_details'] }
  const event = input.eventId
    ? context.events.find((item) => item.id === input.eventId)
    : null
  if (input.intent !== 'create' && !event)
    return { ok: false, codes: ['missing_event'] }
  if (input.intent === 'create' && input.eventId)
    return { ok: false, codes: ['invalid_target'] }
  if (input.intent === 'delete' && event)
    return {
      ok: true,
      draft: {
        operation: 'delete',
        title: event.title,
        start: event.start,
        end: event.end,
        timezone: context.settings.timezone,
        eventId: event.id,
        eventVersion: event.version,
        constraints: null,
        supporting: [],
        excluded: [],
      },
    }
  const grounded = validateInterpretation(input, request, constraintTurns)
  if (grounded.length) return { ok: false, codes: grounded }
  const date =
    input.date ||
    (event ? localDate(event.start, context.settings.timezone) : null)
  const durationMinutes =
    input.durationMinutes ||
    (event ? (epoch(event.end) - epoch(event.start)) / 60000 : null)
  const missing: string[] = []
  if (!date) missing.push('missing_date')
  if (!durationMinutes) missing.push('missing_duration')
  if (missing.length || !date || !durationMinutes)
    return { ok: false, codes: missing }
  if (
    Temporal.PlainDate.from(
      localDate(context.now, context.settings.timezone),
    ).until(Temporal.PlainDate.from(date)).days > 366
  )
    return { ok: false, codes: ['date_too_far'] }
  const constraints: Constraints = {
    date,
    durationMinutes,
    earliestStart: input.earliestStart,
    latestEnd: input.latestEnd,
    exactStart: input.exactStart,
  }
  const retrieval = retrievePreferences(context.preferences, date, request)
  const soft = retrieval.eligible.filter((p) => p.kind === 'soft')
  if (
    input.usePreferences &&
    soft.length > 1 &&
    Math.max(...soft.map((p) => minutes(p.startTime))) >=
      Math.min(...soft.map((p) => minutes(p.endTime)))
  )
    return { ok: false, codes: ['conflicting_preferences'] }
  const first = input.exactStart
    ? minutes(input.exactStart)
    : Math.max(
        minutes(context.settings.dayStart),
        input.earliestStart ? minutes(input.earliestStart) : 0,
      )
  const last = input.exactStart
    ? first
    : Math.min(
        minutes(context.settings.dayEnd),
        input.latestEnd ? minutes(input.latestEnd) : 1440,
      ) - durationMinutes
  const candidates: { start: string; end: string; score: number }[] = []
  for (let start = first; start <= last; start += 5) {
    if (start + durationMinutes >= 1440) continue
    try {
      const slot = {
        start: instant(date, clock(start), context.settings.timezone),
        end: instant(
          date,
          clock(start + durationMinutes),
          context.settings.timezone,
        ),
      }
      if (validateSlot(slot, constraints, context, event?.id).length === 0)
        candidates.push({
          ...slot,
          score: soft.filter(
            (p) =>
              start >= minutes(p.startTime) &&
              start + durationMinutes <= minutes(p.endTime),
          ).length,
        })
    } catch {
      /* DST gaps/overlaps are not candidates. */
    }
  }
  candidates.sort(
    (a, b) => b.score - a.score || epoch(a.start) - epoch(b.start),
  )
  if (!candidates.length) return { ok: false, codes: ['no_feasible_slot'] }
  const chosen = candidates[0]
  return {
    ok: true,
    draft: {
      operation: input.intent,
      title: event?.title || input.title || request.slice(0, 80),
      start: chosen.start,
      end: chosen.end,
      timezone: context.settings.timezone,
      eventId: event?.id || null,
      eventVersion: event?.version || null,
      constraints,
      supporting: retrieval.supporting,
      excluded: retrieval.excluded,
    },
  }
}
