import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import type { Evidence, Proposal, Snapshot } from '../domain/contracts'

export function EvidenceList({
  supporting,
  excluded,
}: {
  supporting: Evidence[]
  excluded: Evidence[]
}) {
  const { t } = useTranslation()
  return (
    <details className="mt-3 text-xs text-muted-foreground">
      <summary className="cursor-pointer">
        {t('app.supporting')} ({supporting.length}) · {t('app.excluded')} (
        {excluded.length})
      </summary>
      {!supporting.length && <p className="mt-2">{t('app.noSources')}</p>}
      {[...supporting, ...excluded].map((source) => (
        <div key={source.id} className="mt-2 border-l-2 border-border pl-2">
          <p>{source.text}</p>
          <p>
            {t(`reasons.${source.reason}`)} · {source.id.slice(0, 8)}
          </p>
        </div>
      ))}
    </details>
  )
}

function ProposalCard({
  proposal: p,
  state,
  busy,
  onResolve,
}: {
  proposal: Proposal
  state: Snapshot
  busy: boolean
  onResolve: (id: string, decision: 'approve' | 'reject') => Promise<boolean>
}) {
  const { t } = useTranslation()
  const format = (value: string) =>
    new Intl.DateTimeFormat('en-US', {
      timeZone: p.timezone,
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(value))
  const before =
    p.before ||
    (p.status === 'pending'
      ? state.events.find((event) => event.id === p.eventId)
      : null)
  return (
    <article
      data-testid="proposal"
      data-status={p.status}
      className="mt-3 rounded-xl border border-border bg-card p-3.5 shadow-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <strong>{t(`app.${p.operation}`)}</strong>
        <span
          className={`rounded-full px-2 py-1 text-[10px] ${p.status === 'pending' ? 'bg-amber-100 text-amber-900' : 'bg-muted'}`}
        >
          {t(`app.${p.status}`)}
        </span>
      </div>
      <h3 className="mt-2 text-sm font-semibold">{p.title}</h3>
      {before && p.operation === 'move' && (
        <p className="mt-2 text-muted-foreground">
          {t('app.before')}: {format(before.start)} – {format(before.end)}
        </p>
      )}
      <p className="mt-2 font-medium">
        {p.operation === 'delete' ? t('app.target') : t('app.after')}:{' '}
        {format(p.start)} – {format(p.end)}
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">{p.timezone}</p>
      {p.constraints && (
        <div className="mt-3 rounded-md bg-muted/50 p-2.5">
          <strong>{t('app.constraints')}</strong>
          <dl className="mt-2 grid grid-cols-2 gap-1.5">
            <dt>{t('app.date')}</dt>
            <dd>{p.constraints.date}</dd>
            <dt>{t('app.duration')}</dt>
            <dd>
              {t('app.minutes', { count: p.constraints.durationMinutes })}
            </dd>
            {(['earliestStart', 'latestEnd', 'exactStart'] as const).map(
              (key) =>
                p.constraints?.[key] && (
                  <div key={key} className="contents">
                    <dt>
                      {t(
                        `app.${{ earliestStart: 'earliest', latestEnd: 'deadline', exactStart: 'exact' }[key]}`,
                      )}
                    </dt>
                    <dd>{p.constraints[key]}</dd>
                  </div>
                ),
            )}
          </dl>
        </div>
      )}
      <EvidenceList supporting={p.supporting} excluded={p.excluded} />
      {p.issues.map((code) => (
        <p key={code} role="alert" className="mt-2 text-red-700">
          {t(`errors.${code}`)}
        </p>
      ))}
      {p.status === 'pending' && (
        <>
          {p.operation !== 'delete' && (
            <p className="mt-3 text-[11px] text-emerald-700">
              {t('app.checksPassed')}
            </p>
          )}
          <p className="mt-3 text-[11px] text-muted-foreground">
            {t('app.reviewHint')}
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => void onResolve(p.id, 'reject')}
            >
              {t('app.reject')}
            </Button>
            <Button
              type="button"
              size="sm"
              className="flex-1"
              disabled={busy}
              onClick={() => void onResolve(p.id, 'approve')}
            >
              {t('app.approve')}
            </Button>
          </div>
        </>
      )}
    </article>
  )
}

export function AgentPanel({
  state,
  busy,
  onSend,
  onResolve,
  selectedTaskId,
  clearTask,
  prompt,
  draft,
  setDraft,
  onPromptApplied,
}: {
  state: Snapshot
  busy: boolean
  onSend: (text: string, continueContext: boolean) => Promise<boolean>
  onResolve: (id: string, decision: 'approve' | 'reject') => Promise<boolean>
  selectedTaskId: string | null
  clearTask: () => void
  prompt: { text: string; sequence: number } | null
  draft: string
  setDraft: (value: string) => void
  onPromptApplied: () => void
}) {
  const { t } = useTranslation()
  const [continueContext, setContinueContext] = useState(true)
  const stream = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const task = state.tasks.find((item) => item.id === selectedTaskId)
  useEffect(() => {
    stream.current?.scrollTo({
      top: stream.current.scrollHeight,
      behavior: 'auto',
    })
    setContinueContext(true)
  }, [state.messages.length])
  useEffect(() => {
    if (prompt) {
      setDraft(prompt.text)
      setContinueContext(false)
      input.current?.focus()
      onPromptApplied()
    }
  }, [prompt, setDraft, onPromptApplied])
  async function submit() {
    if (draft.trim() && !busy && (await onSend(draft.trim(), continueContext)))
      setDraft('')
  }
  return (
    <aside
      className="agent-panel flex h-full min-h-0 flex-col border-l border-border bg-background"
      aria-label={t('agent.title')}
    >
      <header className="border-b border-border p-4">
        <h2 className="text-sm font-semibold">{t('agent.title')}</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {t('agent.subtitle')}
        </p>
      </header>
      <div
        ref={stream}
        aria-live="polite"
        aria-busy={busy}
        className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 text-xs"
      >
        {!state.messages.length && (
          <p className="leading-relaxed text-muted-foreground">
            {t('app.noMessages')}
          </p>
        )}
        {state.messages.map((message) => (
          <div
            key={message.id}
            className={
              message.role === 'user' ? 'ml-8 rounded-xl bg-muted p-3' : 'mr-1'
            }
          >
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t(
                message.role === 'user'
                  ? 'agent.userLabel'
                  : 'agent.agentLabel',
              )}
            </p>
            {message.text && (
              <p className="whitespace-pre-wrap break-words leading-relaxed">
                {message.text}
              </p>
            )}
            {message.codes.map((code) => (
              <p
                key={code}
                className={`mt-1 leading-relaxed ${message.kind === 'error' ? 'text-red-700' : ''}`}
              >
                {t(`errors.${code}`)}
              </p>
            ))}
            {message.evidence && <EvidenceList {...message.evidence} />}
            {message.proposalId &&
              state.proposals
                .filter((p) => p.id === message.proposalId)
                .map((p) => (
                  <ProposalCard
                    key={p.id}
                    proposal={p}
                    state={state}
                    busy={busy}
                    onResolve={onResolve}
                  />
                ))}
          </div>
        ))}
        {busy && (
          <p role="status" className="animate-pulse text-muted-foreground">
            {t('app.busy')}
          </p>
        )}
        {state.proposals
          .filter(
            (proposal) =>
              proposal.status === 'pending' &&
              !state.messages.some(
                (message) => message.proposalId === proposal.id,
              ),
          )
          .map((proposal) => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              state={state}
              busy={busy}
              onResolve={onResolve}
            />
          ))}
      </div>
      <form
        className="space-y-2 border-t border-border p-3"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        {task && (
          <div className="flex items-center justify-between rounded bg-muted p-2 text-xs">
            <span>{t('app.selectedTask', { title: task.title })}</span>
            <button
              type="button"
              onClick={clearTask}
              aria-label={t('app.clearTask')}
            >
              ×
            </button>
          </div>
        )}
        {state.messages.at(-1)?.kind === 'clarify' && (
          <label className="flex gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={continueContext}
              onChange={(e) => setContinueContext(e.target.checked)}
            />
            {t('app.continueRequest')}
          </label>
        )}
        <Textarea
          ref={input}
          aria-label={t('agent.promptPlaceholder')}
          placeholder={t('agent.promptPlaceholder')}
          value={draft}
          maxLength={6000}
          onChange={(e) => setDraft(e.target.value)}
          className="min-h-24 resize-none text-sm"
          onKeyDown={(event) => {
            if (
              event.key === 'Enter' &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault()
              void submit()
            }
          }}
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-muted-foreground">
            {t('agent.shortcutHint')}
          </span>
          <Button
            type="submit"
            size="sm"
            disabled={busy || !draft.trim() || !state.modelConfigured}
          >
            {t('agent.send')}
          </Button>
        </div>
      </form>
    </aside>
  )
}
