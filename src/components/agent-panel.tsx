import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowDown } from 'lucide-react'
import { MessageScroller } from '@shadcn/react/message-scroller'

import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Textarea } from '#/components/ui/textarea'
import type { ProposalStatus, ScheduleProposal } from '#/lib/demo-schedule'

type AgentPanelProps = {
  proposal: ScheduleProposal
  status: ProposalStatus
  onApprove: () => void
  onReject: () => void
}

type DemoMessage = {
  id: string
  role: 'user' | 'assistant'
  contentKey?: string
  content?: string
}

const initialMessages: DemoMessage[] = [
  {
    id: 'demo-user-request',
    role: 'user',
    contentKey: 'demo.initialUserPrompt',
  },
  {
    id: 'demo-assistant-answer',
    role: 'assistant',
    contentKey: 'demo.initialAgentReply',
  },
]

function ProposalReviewCard({
  proposal,
  status,
  onApprove,
  onReject,
}: AgentPanelProps) {
  const { t } = useTranslation()

  return (
    <div
      className="mt-2.5 rounded-lg border border-border bg-card p-3.5 text-xs text-card-foreground shadow-none"
      aria-label={t('sidebar.pendingProposals')}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-foreground text-xs">
          {proposal.title}
        </span>
        {status === 'pending' && (
          <Badge variant="warning" className="text-[10px] font-medium">
            {t('topbar.pending')}
          </Badge>
        )}
        {status === 'approved' && (
          <Badge variant="success" className="text-[10px] font-medium">
            {t('agent.ready')}
          </Badge>
        )}
        {status === 'rejected' && (
          <Badge variant="secondary" className="text-[10px] font-medium">
            {t('agent.completed')}
          </Badge>
        )}
      </div>

      <div className="mt-2.5 space-y-1.5 text-muted-foreground">
        <div className="flex justify-between">
          <span>{t('agent.proposal.suggestedTime')}</span>
          <span className="font-medium text-foreground">
            {t('agent.proposal.timeValue')}
          </span>
        </div>
        <div className="flex justify-between">
          <span>{t('agent.proposal.reasoning')}</span>
          <span className="text-foreground/90">{proposal.reasoning}</span>
        </div>
        <div className="flex justify-between">
          <span>{t('agent.proposal.conflictCheck')}</span>
          <span className="font-medium text-emerald-600 dark:text-emerald-400">
            {proposal.conflicts.length === 0
              ? t('agent.proposal.noConflict')
              : t('agent.proposal.hasConflict', {
                  count: proposal.conflicts.length,
                })}
          </span>
        </div>
      </div>

      {status === 'pending' ? (
        <div className="mt-3.5 flex gap-2 border-t border-border/60 pt-3">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-7 text-xs font-normal"
            type="button"
            onClick={onReject}
          >
            {t('agent.proposal.reject')}
          </Button>
          <Button
            variant="default"
            size="sm"
            className="flex-1 h-7 text-xs font-medium"
            type="button"
            onClick={onApprove}
          >
            {t('agent.proposal.approve')}
          </Button>
        </div>
      ) : (
        <div className="mt-3 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
          {status === 'approved'
            ? t('agent.proposal.approvedStatus')
            : t('agent.proposal.rejectedStatus')}
        </div>
      )}
    </div>
  )
}

export function AgentPanel({
  proposal,
  status,
  onApprove,
  onReject,
}: AgentPanelProps) {
  const { t } = useTranslation()
  const [messages, setMessages] = useState(initialMessages)
  const [draft, setDraft] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const content = draft.trim()

    if (!content) {
      return
    }

    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: 'user', content },
      {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: t('agent.mockResponse'),
      },
    ])
    setDraft('')
  }

  return (
    <aside
      className="agent-panel flex h-full flex-col justify-between border-l border-border bg-background"
      aria-label={t('agent.title')}
    >
      {/* Agent Panel Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            {t('agent.title')}
          </h2>
          <p className="text-[11px] text-muted-foreground">
            {t('agent.subtitle')}
          </p>
        </div>
        <div>
          {status === 'pending' && (
            <Badge variant="warning" className="text-[11px] font-normal">
              {t('agent.pendingCount', { count: 1 })}
            </Badge>
          )}
          {status === 'approved' && (
            <Badge variant="success" className="text-[11px] font-normal">
              {t('agent.ready')}
            </Badge>
          )}
          {status === 'rejected' && (
            <Badge variant="secondary" className="text-[11px] font-normal">
              {t('agent.completed')}
            </Badge>
          )}
        </div>
      </header>

      {/* Flat & Clean Message Stream */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <MessageScroller.Provider autoScroll defaultScrollPosition="end">
          <MessageScroller.Root className="relative h-full">
            <MessageScroller.Viewport
              className="h-full overflow-y-auto overscroll-contain p-4"
              aria-label={t('agent.title')}
            >
              <MessageScroller.Content
                className="flex flex-col gap-4 text-xs"
                aria-busy={false}
              >
                {messages.map((message) => {
                  const messageText = message.contentKey
                    ? t(message.contentKey as never)
                    : message.content

                  return (
                    <MessageScroller.Item
                      key={message.id}
                      messageId={message.id}
                      scrollAnchor={message.role === 'user'}
                      className={`flex flex-col ${
                        message.role === 'user' ? 'items-end' : 'items-start'
                      }`}
                    >
                      <span className="mb-1 text-[11px] text-muted-foreground">
                        {message.role === 'user'
                          ? t('agent.userLabel')
                          : t('agent.agentLabel')}
                      </span>

                      {message.role === 'user' ? (
                        <div className="max-w-[85%] rounded-lg bg-zinc-100 px-3 py-2 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
                          <p className="m-0 whitespace-pre-wrap leading-relaxed">
                            {messageText}
                          </p>
                        </div>
                      ) : (
                        <div className="w-full max-w-[95%]">
                          <p className="m-0 leading-relaxed text-foreground">
                            {messageText}
                          </p>

                          {message.id === 'demo-assistant-answer' && (
                            <ProposalReviewCard
                              proposal={proposal}
                              status={status}
                              onApprove={onApprove}
                              onReject={onReject}
                            />
                          )}
                        </div>
                      )}
                    </MessageScroller.Item>
                  )
                })}
              </MessageScroller.Content>
            </MessageScroller.Viewport>

            <MessageScroller.Button className="absolute right-4 bottom-3 z-10 flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-accent focus:outline-none">
              <ArrowDown className="size-3" />
              <span>{t('agent.scrollToBottom')}</span>
            </MessageScroller.Button>
          </MessageScroller.Root>
        </MessageScroller.Provider>
      </div>

      {/* Simple Clean Input Composer */}
      <form
        className="shrink-0 border-t border-border p-3"
        onSubmit={handleSubmit}
      >
        <div className="rounded-lg border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
          <Textarea
            id="agent-prompt"
            value={draft}
            placeholder={t('agent.promptPlaceholder')}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                if (draft.trim()) {
                  handleSubmit(e as unknown as FormEvent<HTMLFormElement>)
                }
              }
            }}
            className="min-h-[64px] resize-none border-0 bg-transparent p-2.5 text-xs shadow-none focus-visible:ring-0"
            rows={2}
          />
          <div className="flex items-center justify-between border-t border-border/40 px-2.5 py-1.5">
            <span className="text-[11px] text-muted-foreground">
              {t('agent.shortcutHint')}
            </span>
            <Button
              type="submit"
              size="sm"
              disabled={!draft.trim()}
              className="h-6.5 px-2.5 text-xs font-medium"
            >
              {t('agent.send')}
            </Button>
          </div>
        </div>
      </form>
    </aside>
  )
}
