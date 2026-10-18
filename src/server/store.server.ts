import Database from 'better-sqlite3'
import { mkdirSync, chmodSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import {
  DomainError,
  defaultSettings,
  preferenceInputSchema,
  settingsSchema,
} from '../domain/contracts'
import type {
  Event,
  Message,
  Preference,
  PreferenceInput,
  Proposal,
  Settings,
  Snapshot,
  Task,
} from '../domain/contracts'
import { validateSlot } from '../domain/planner'

export class Store {
  readonly db: Database.Database
  constructor(path: string) {
    if (path !== ':memory:')
      mkdirSync(dirname(resolve(path)), { recursive: true, mode: 0o700 })
    this.db = new Database(path)
    if (path !== ':memory:') chmodSync(path, 0o600)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('busy_timeout = 5000')
    this.db.pragma('foreign_keys = ON')
    const version = this.db.pragma('user_version', { simple: true }) as number
    if (version > 1) throw new DomainError('database_version')
    if (version === 0)
      this.db.transaction(() => {
        this.db.exec(`
        CREATE TABLE settings (id INTEGER PRIMARY KEY CHECK (id = 1), data TEXT NOT NULL, revision INTEGER NOT NULL);
        CREATE TABLE events (id TEXT PRIMARY KEY, data TEXT NOT NULL);
        CREATE TABLE tasks (id TEXT PRIMARY KEY, data TEXT NOT NULL);
        CREATE TABLE preferences (id TEXT PRIMARY KEY, data TEXT NOT NULL);
        CREATE TABLE proposals (id TEXT PRIMARY KEY, data TEXT NOT NULL);
        CREATE TABLE messages (sequence INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT UNIQUE NOT NULL, data TEXT NOT NULL);
        PRAGMA user_version = 1;
      `)
        this.db
          .prepare('INSERT INTO settings VALUES (1, ?, 1)')
          .run(JSON.stringify(defaultSettings))
      })()
  }
  close() {
    this.db.close()
  }
  private all<T>(table: 'events' | 'tasks' | 'preferences' | 'proposals'): T[] {
    return (
      this.db.prepare(`SELECT data FROM ${table} ORDER BY rowid`).all() as {
        data: string
      }[]
    ).map((row) => JSON.parse(row.data) as T)
  }
  private put<T extends { id: string }>(
    table: 'events' | 'tasks' | 'preferences' | 'proposals',
    item: T,
  ) {
    this.db
      .prepare(
        `INSERT INTO ${table} (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data`,
      )
      .run(item.id, JSON.stringify(item))
  }
  snapshot(modelConfigured = false): Snapshot {
    const row = this.db
      .prepare('SELECT data, revision FROM settings WHERE id = 1')
      .get() as { data: string; revision: number }
    const messages = (
      this.db
        .prepare('SELECT data FROM messages ORDER BY sequence DESC LIMIT 100')
        .all() as { data: string }[]
    )
      .reverse()
      .map((r) => JSON.parse(r.data) as Message)
    return {
      settings: settingsSchema.parse(JSON.parse(row.data)),
      settingsRevision: row.revision,
      events: this.all<Event>('events'),
      tasks: this.all<Task>('tasks'),
      preferences: this.all<Preference>('preferences'),
      proposals: this.all<Proposal>('proposals').filter(
        (proposal, index, all) =>
          proposal.status === 'pending' || index >= all.length - 100,
      ),
      messages,
      modelConfigured,
    }
  }
  addMessage(message: Message) {
    this.db
      .prepare('INSERT INTO messages (id, data) VALUES (?, ?)')
      .run(message.id, JSON.stringify(message))
  }
  addProposal(proposal: Proposal) {
    this.put('proposals', proposal)
  }
  addTask(task: Task) {
    this.put('tasks', task)
  }
  setTaskStatus(id: string, status: 'todo' | 'done') {
    const task = this.all<Task>('tasks').find((item) => item.id === id)
    if (!task) throw new DomainError('missing_task')
    this.put('tasks', { ...task, status })
  }
  saveSettings(input: Settings) {
    const settings = settingsSchema.parse(input)
    this.db
      .prepare(
        'UPDATE settings SET data = ?, revision = revision + 1 WHERE id = 1',
      )
      .run(JSON.stringify(settings))
  }
  savePreference(input: PreferenceInput, now: string) {
    const parsed = preferenceInputSchema.parse(input)
    return this.db
      .transaction(() => {
        const existing = this.all<Preference>('preferences')
        if (
          parsed.supersedesId &&
          !existing.some(
            (p) => p.id === parsed.supersedesId && p.owner === 'local',
          )
        )
          throw new DomainError('missing_preference')
        const record: Preference = {
          ...parsed,
          id: randomUUID(),
          owner: 'local',
          status: 'active',
          createdAt: now,
        }
        this.put('preferences', record)
        this.db
          .prepare('UPDATE settings SET revision = revision + 1 WHERE id = 1')
          .run()
        return record
      })
      .immediate()
  }
  archivePreference(id: string) {
    this.db
      .transaction(() => {
        const record = this.all<Preference>('preferences').find(
          (p) => p.id === id,
        )
        if (!record) throw new DomainError('missing_preference')
        this.put('preferences', { ...record, status: 'archived' })
        this.db
          .prepare('UPDATE settings SET revision = revision + 1 WHERE id = 1')
          .run()
      })
      .immediate()
  }
  resolveProposal(
    id: string,
    decision: 'approve' | 'reject',
    now: string,
  ): Proposal {
    return this.db
      .transaction(() => {
        const row = this.db
          .prepare('SELECT data FROM proposals WHERE id = ?')
          .get(id) as { data: string } | undefined
        if (!row) throw new DomainError('missing_proposal')
        const proposal = JSON.parse(row.data) as Proposal
        if (proposal.status === 'approved' && decision === 'approve')
          return proposal
        if (proposal.status === 'rejected' && decision === 'reject')
          return proposal
        if (proposal.status !== 'pending')
          throw new DomainError('proposal_resolved')
        if (decision === 'reject') {
          const rejected: Proposal = {
            ...proposal,
            status: 'rejected',
            resolvedAt: now,
          }
          this.put('proposals', rejected)
          return rejected
        }
        const state = this.snapshot()
        const existing = state.events.find(
          (event) => event.id === proposal.eventId,
        )
        const issues: string[] = []
        if (
          proposal.settingsRevision !== state.settingsRevision ||
          proposal.timezone !== state.settings.timezone
        )
          issues.push('context_changed')
        if (
          proposal.operation !== 'create' &&
          (!existing || existing.version !== proposal.eventVersion)
        )
          issues.push('event_changed')
        if (proposal.operation !== 'delete') {
          if (!proposal.constraints) issues.push('needs_details')
          else
            issues.push(
              ...validateSlot(
                proposal,
                proposal.constraints,
                { ...state, now },
                proposal.eventId,
              ),
            )
        }
        if (issues.length) {
          const invalidated: Proposal = {
            ...proposal,
            status: 'invalidated',
            resolvedAt: now,
            issues: [...new Set(issues)],
          }
          this.put('proposals', invalidated)
          return invalidated
        }
        if (proposal.operation === 'delete')
          this.db
            .prepare('DELETE FROM events WHERE id = ?')
            .run(proposal.eventId)
        else {
          const event: Event = {
            id: proposal.eventId || `event-${proposal.id}`,
            title: proposal.title,
            start: proposal.start,
            end: proposal.end,
            timezone: proposal.timezone,
            taskId: proposal.taskId,
            version: (existing?.version || 0) + 1,
          }
          this.put('events', event)
        }
        const approved: Proposal = {
          ...proposal,
          status: 'approved',
          resolvedAt: now,
        }
        this.put('proposals', approved)
        return approved
      })
      .immediate()
  }
}

let instance: Store | undefined
export function getStore() {
  return (instance ??= new Store(
    process.env.SCHEDULING_DB_PATH || resolve('data/scheduling.sqlite'),
  ))
}
