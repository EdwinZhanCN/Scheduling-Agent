import { z } from 'zod'
import { Temporal } from 'temporal-polyfill'

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    try {
      Temporal.PlainDate.from(value)
      return true
    } catch {
      return false
    }
  })
export const timeSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
export const timezoneSchema = z
  .string()
  .min(1)
  .max(80)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat('en', { timeZone: value })
      return true
    } catch {
      return false
    }
  })
export const tags = [
  'study',
  'meeting',
  'writing',
  'research',
  'coding',
  'exercise',
  'personal',
  'other',
] as const
export const settingsSchema = z
  .object({
    timezone: timezoneSchema,
    dayStart: timeSchema,
    dayEnd: timeSchema,
    workingDays: z.array(z.number().int().min(1).max(7)).min(1).max(7),
  })
  .strict()
  .refine((value) => value.dayStart < value.dayEnd)
export type Settings = z.infer<typeof settingsSchema>
export const defaultSettings: Settings = {
  timezone: 'America/New_York',
  dayStart: '09:00',
  dayEnd: '18:00',
  workingDays: [1, 2, 3, 4, 5],
}

export const preferenceInputSchema = z
  .object({
    text: z.string().trim().min(1).max(1000),
    kind: z.enum(['soft', 'hard']),
    effectiveFrom: dateSchema,
    expiresOn: dateSchema.nullable(),
    days: z.array(z.number().int().min(1).max(7)).min(1).max(7),
    startTime: timeSchema,
    endTime: timeSchema,
    supersedesId: z.string().max(80).nullable(),
  })
  .strict()
  .refine(
    (value) =>
      value.startTime < value.endTime &&
      (!value.expiresOn || value.expiresOn >= value.effectiveFrom),
  )
export type PreferenceInput = z.infer<typeof preferenceInputSchema>
export type Preference = PreferenceInput & {
  id: string
  owner: string
  status: 'active' | 'archived'
  createdAt: string
}
export type Evidence = { id: string; text: string; reason: string }

export const metadataSchema = z
  .object({
    summary: z.string().max(1800),
    project: z
      .object({
        name: z.string().max(120),
        evidence: z.string().min(1).max(500),
      })
      .strict()
      .nullable()
      .optional(),
    context: z
      .object({
        name: z.string().max(120),
        evidence: z.string().min(1).max(500),
      })
      .strict()
      .nullable()
      .optional(),
    tags: z.array(z.enum(tags)).max(8),
    stages: z
      .array(
        z
          .object({
            label: z.string().max(150),
            evidence: z.string().min(1).max(500),
          })
          .strict(),
      )
      .max(12),
    externalDependency: z.string().max(500).nullable(),
    scopeKnown: z.boolean(),
  })
  .strict()
export type Metadata = z.infer<typeof metadataSchema>
export type Complexity = 'low' | 'medium' | 'high' | 'unknown'
export type Task = {
  id: string
  title: string
  description: string
  summary: string
  tags: string[]
  project?: string | null
  context?: string | null
  complexity: Complexity
  status: 'todo' | 'done'
  createdAt: string
}
export const taskInputSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    description: z.string().trim().min(1).max(6000),
  })
  .strict()

const nullableSpan = z.string().min(1).max(500).nullable()
export const interpretationSchema = z
  .object({
    intent: z.enum([
      'create',
      'move',
      'delete',
      'summarize',
      'preference',
      'clarify',
    ]),
    eventId: z.string().max(80).nullable(),
    title: z.string().max(160),
    date: dateSchema.nullable(),
    durationMinutes: z.number().int().min(5).max(720).nullable(),
    earliestStart: timeSchema.nullable(),
    latestEnd: timeSchema.nullable(),
    exactStart: timeSchema.nullable(),
    spans: z
      .object({
        date: nullableSpan,
        durationMinutes: nullableSpan,
        earliestStart: nullableSpan,
        latestEnd: nullableSpan,
        exactStart: nullableSpan,
      })
      .strict(),
    usePreferences: z.boolean(),
    clarification: z.string().max(1500).nullable(),
    metadata: metadataSchema,
  })
  .strict()
export type Interpretation = z.infer<typeof interpretationSchema>
export type Event = {
  id: string
  title: string
  start: string
  end: string
  timezone: string
  taskId: string | null
  version: number
}
export type Constraints = {
  date: string
  durationMinutes: number
  earliestStart: string | null
  latestEnd: string | null
  exactStart: string | null
}
export type Proposal = {
  id: string
  operation: 'create' | 'move' | 'delete'
  status: 'pending' | 'approved' | 'rejected' | 'invalidated'
  title: string
  start: string
  end: string
  timezone: string
  eventId: string | null
  eventVersion: number | null
  before?: Pick<Event, 'title' | 'start' | 'end'> | null
  taskId: string | null
  constraints: Constraints | null
  supporting: Evidence[]
  excluded: Evidence[]
  request: string
  explanation: string
  settingsRevision: number
  createdAt: string
  resolvedAt: string | null
  issues: string[]
}
export type Message = {
  id: string
  role: 'user' | 'assistant'
  text: string
  kind: 'request' | 'proposal' | 'clarify' | 'summary' | 'error'
  proposalId: string | null
  codes: string[]
  requestContext: string
  createdAt: string
  evidence?: { supporting: Evidence[]; excluded: Evidence[] }
}
export type Snapshot = {
  settings: Settings
  settingsRevision: number
  events: Event[]
  tasks: Task[]
  preferences: Preference[]
  proposals: Proposal[]
  messages: Message[]
  modelConfigured: boolean
}
export type Result<T> = { ok: true; value: T } | { ok: false; code: string }
export class DomainError extends Error {
  constructor(public code: string) {
    super(code)
    this.name = 'DomainError'
  }
}
