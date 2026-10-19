import { randomUUID } from 'node:crypto'
import { ZodError } from 'zod'
import {
  DomainError,
  interpretationSchema,
  metadataSchema,
  taskInputSchema,
} from '../domain/contracts'
import type {
  Message,
  Metadata,
  Result,
  Snapshot,
  Task,
} from '../domain/contracts'
import { complexity, plan } from '../domain/planner'
import { retrievePreferences } from '../domain/retrieval'
import { localDate } from '../domain/time'
import { analyzeTask, interpret, modelConfigured } from './provider.server'
import type { Interpreter } from './provider.server'
import { getStore } from './store.server'
import type { Store } from './store.server'

export async function safe<T>(
  operation: () => T | Promise<T>,
): Promise<Result<T>> {
  try {
    return { ok: true, value: await operation() }
  } catch (error) {
    return {
      ok: false,
      code:
        error instanceof DomainError
          ? error.code
          : error instanceof ZodError
            ? 'invalid_input'
            : 'unexpected_error',
    }
  }
}

export class SchedulingService {
  private busy = false
  constructor(
    readonly store: Store,
    private interpreter: Interpreter = interpret,
    private now = () => new Date().toISOString(),
  ) {}
  snapshot(): Snapshot {
    return this.store.snapshot(modelConfigured())
  }
  async chat(
    text: string,
    taskId: string | null = null,
    continueContext = true,
  ) {
    if (this.busy) throw new DomainError('request_in_progress')
    this.busy = true
    const now = this.now()
    try {
      const state = this.snapshot()
      const task = taskId ? state.tasks.find((t) => t.id === taskId) : null
      if (taskId && !task) throw new DomainError('missing_task')
      const previous = state.messages.at(-1)
      const followup =
        continueContext && previous?.kind === 'clarify'
          ? previous.requestContext
          : ''
      const currentTurn =
        text +
        (task ? `\nSelected task: ${task.title}\n${task.description}` : '')
      const requestTurns = [
        ...(followup ? (previous?.requestTurns ?? [followup]) : []),
        currentTurn,
      ]
      const request = requestTurns.join('\nFollow-up: ')
      if (request.length > 18000) throw new DomainError('conversation_too_long')
      this.store.addMessage({
        id: randomUUID(),
        role: 'user',
        text,
        kind: 'request',
        proposalId: null,
        codes: [],
        requestContext: request,
        requestTurns,
        createdAt: now,
      })
      let output: Message
      try {
        const input = interpretationSchema.parse(
          await this.interpreter(request, state, now),
        )
        if (input.intent === 'preference') {
          const evidence = retrievePreferences(
            state.preferences,
            input.date || localDate(now, state.settings.timezone),
            request,
            Boolean(input.date),
          )
          output = {
            id: randomUUID(),
            role: 'assistant',
            text: '',
            kind: 'summary',
            proposalId: null,
            codes: [
              evidence.supporting.length
                ? 'current_preferences'
                : 'no_preferences',
            ],
            evidence: {
              supporting: evidence.supporting,
              excluded: evidence.excluded,
            },
            requestContext: request,
            createdAt: this.now(),
          }
        } else if (input.intent === 'summarize') {
          const grade = complexity(input.metadata, request)
          output = {
            id: randomUUID(),
            role: 'assistant',
            text: input.metadata.summary,
            kind: 'summary',
            proposalId: null,
            codes: [
              `complexity_${grade}`,
              ...input.metadata.tags.map((t) => `tag_${t}`),
            ],
            requestContext: request,
            createdAt: this.now(),
          }
        } else if (input.intent === 'clarify') {
          output = {
            id: randomUUID(),
            role: 'assistant',
            text: input.clarification || '',
            kind: 'clarify',
            proposalId: null,
            codes: ['needs_details'],
            requestContext: request,
            createdAt: this.now(),
          }
        } else {
          // Read fresh calendar data after the network call; model latency must not hide concurrent edits.
          const fresh = this.snapshot()
          if (fresh.settingsRevision !== state.settingsRevision)
            throw new DomainError('context_changed')
          const result = plan(
            input,
            request,
            { ...fresh, now: this.now() },
            requestTurns,
          )
          if (!result.ok)
            output = {
              id: randomUUID(),
              role: 'assistant',
              text: '',
              kind: 'clarify',
              proposalId: null,
              codes: result.codes,
              requestContext: request,
              createdAt: this.now(),
            }
          else {
            const id = randomUUID()
            this.store.addProposal({
              ...result.draft,
              before:
                fresh.events.find(
                  (event) => event.id === result.draft.eventId,
                ) || null,
              id,
              status: 'pending',
              taskId,
              request,
              explanation: input.metadata.summary,
              settingsRevision: fresh.settingsRevision,
              createdAt: this.now(),
              resolvedAt: null,
              issues: [],
            })
            output = {
              id: randomUUID(),
              role: 'assistant',
              text: input.metadata.summary,
              kind: 'proposal',
              proposalId: id,
              codes: [],
              requestContext: request,
              createdAt: this.now(),
            }
          }
        }
      } catch (error) {
        output = {
          id: randomUUID(),
          role: 'assistant',
          text: '',
          kind: 'error',
          proposalId: null,
          codes: [
            error instanceof DomainError ? error.code : 'invalid_model_output',
          ],
          requestContext: request,
          createdAt: this.now(),
        }
      }
      this.store.addMessage({ ...output, requestTurns })
      return this.snapshot()
    } finally {
      this.busy = false
    }
  }
  async createTask(
    raw: { title: string; description: string },
    analyzer: (
      title: string,
      description: string,
    ) => Promise<Metadata> = analyzeTask,
  ) {
    const input = taskInputSchema.parse(raw)
    const metadata = metadataSchema.parse(
      await analyzer(input.title, input.description),
    )
    const source = `${input.title}\n${input.description}`
    const groundedLabel = (field: Metadata['project']) =>
      field &&
      field.name.trim() &&
      source.includes(field.evidence) &&
      field.evidence.includes(field.name)
        ? field.name
        : null
    const task: Task = {
      id: randomUUID(),
      ...input,
      summary: metadata.summary,
      tags: [...new Set(metadata.tags)],
      project: groundedLabel(metadata.project),
      context: groundedLabel(metadata.context),
      complexity: complexity(metadata, `${input.title}\n${input.description}`),
      status: 'todo',
      createdAt: this.now(),
    }
    this.store.addTask(task)
    return this.snapshot()
  }
}

let service: SchedulingService | undefined
export function getService() {
  return (service ??= new SchedulingService(getStore()))
}
