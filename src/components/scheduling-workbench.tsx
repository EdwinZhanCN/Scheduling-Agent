import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import FullCalendar from '@fullcalendar/react'
import type { CalendarRef } from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/react/daygrid'
import interactionPlugin from '@fullcalendar/react/interaction'
import timeGridPlugin from '@fullcalendar/react/timegrid'
import pulseThemePlugin from '@fullcalendar/react/themes/pulse'
import {
  ChevronLeft,
  ChevronRight,
  PanelRight,
  RefreshCw,
  X,
} from 'lucide-react'
import { AgentPanel } from './agent-panel'
import { ScheduleSidebar } from './schedule-sidebar'
import type { WorkspaceTab } from './schedule-sidebar'
import { PreferencesPanel, TasksPanel } from './workspace-forms'
import { Button } from './ui/button'
import type { Result, Snapshot } from '../domain/contracts'
import { localDate, localTime } from '../domain/time'
import {
  archivePreference,
  createTask,
  getWorkspace,
  resolveProposal,
  savePreference,
  saveSettings,
  sendRequest,
  setTaskStatus,
} from '../server/functions'

export function SchedulingWorkbench() {
  const { t } = useTranslation()
  const calendar = useRef<CalendarRef>(null)
  const [state, setState] = useState<Snapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState<WorkspaceTab>('calendar')
  const [agentOpen, setAgentOpen] = useState(true)
  const [mobileAgentOpen, setMobileAgentOpen] = useState(false)
  const [smallScreen, setSmallScreen] = useState(false)
  const [title, setTitle] = useState('')
  const [view, setView] = useState('timeGridWeek')
  const [taskId, setTaskId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [prompt, setPrompt] = useState<{
    text: string
    sequence: number
  } | null>(null)
  async function run(operation: () => Promise<Result<Snapshot>>) {
    setBusy(true)
    setError(null)
    try {
      const result = await operation()
      if (!result.ok) {
        setError(result.code)
        return false
      }
      const latest = result.value.proposals.at(-1)
      if (latest && latest.id !== state?.proposals.at(-1)?.id)
        calendar.current
          ?.getApi()
          .gotoDate(localDate(latest.start, result.value.settings.timezone))
      setState(result.value)
      return true
    } catch {
      setError('unexpected_error')
      return false
    } finally {
      setBusy(false)
    }
  }
  useEffect(() => {
    let alive = true
    void getWorkspace()
      .then((result) => {
        if (alive) {
          if (result.ok) setState(result.value)
          else setError(result.code)
        }
      })
      .catch(() => {
        if (alive) setError('unexpected_error')
      })
    return () => {
      alive = false
    }
  }, [])
  useEffect(() => {
    const media = window.matchMedia('(max-width: 1023px)')
    const update = () => setSmallScreen(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape') setMobileAgentOpen(false)
    }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [])
  function openAgent() {
    setAgentOpen(true)
    setMobileAgentOpen(smallScreen)
  }
  function prepare(text: string) {
    setPrompt({ text, sequence: Date.now() })
    openAgent()
  }
  if (!state)
    return (
      <main className="flex min-h-dvh items-center justify-center p-6">
        <div role="status">
          <p>{t(error ? `errors.${error}` : 'app.loading')}</p>
          {error && (
            <Button
              className="mt-4"
              onClick={() => void run(() => getWorkspace())}
            >
              {t('app.retry')}
            </Button>
          )}
        </div>
      </main>
    )
  const zone = state.settings.timezone
  const wall = (value: string) =>
    `${localDate(value, zone)}T${localTime(value, zone)}:00`
  const events = [
    ...state.events.map((e) => ({
      id: e.id,
      title: e.title,
      start: wall(e.start),
      end: wall(e.end),
      extendedProps: { calendar: 'course' },
    })),
    ...state.proposals
      .filter((p) => p.status === 'pending' && p.operation !== 'delete')
      .map((p) => ({
        id: p.id,
        title: `${t('app.pending')}: ${p.title}`,
        start: wall(p.start),
        end: wall(p.end),
        extendedProps: { calendar: 'proposal' },
      })),
  ]
  const panel = (
    <AgentPanel
      state={state}
      busy={busy}
      selectedTaskId={taskId}
      clearTask={() => setTaskId(null)}
      prompt={prompt}
      draft={draft}
      setDraft={setDraft}
      onPromptApplied={() => setPrompt(null)}
      onSend={(text, continueContext) =>
        run(() => sendRequest({ data: { text, taskId, continueContext } }))
      }
      onResolve={(id, decision) =>
        run(() => resolveProposal({ data: { id, decision } }))
      }
    />
  )
  return (
    <main className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <header className="flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              calendar.current
                ?.getApi()
                .gotoDate(localDate(new Date().toISOString(), zone))
            }
          >
            {t('app.now')}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('topbar.prev')}
            onClick={() => calendar.current?.getApi().prev()}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('topbar.next')}
            onClick={() => calendar.current?.getApi().next()}
          >
            <ChevronRight className="size-4" />
          </Button>
          <strong className="text-sm">
            {tab === 'calendar' ? title : t(`app.${tab}`)}
          </strong>
        </div>
        <div className="flex items-center gap-1">
          {tab === 'calendar' &&
            (['dayGridMonth', 'timeGridWeek', 'timeGridDay'] as const).map(
              (key, i) => (
                <Button
                  key={key}
                  size="sm"
                  variant={view === key ? 'secondary' : 'ghost'}
                  onClick={() => {
                    setView(key)
                    calendar.current?.getApi().changeView(key)
                  }}
                >
                  {t(`topbar.${['monthView', 'weekView', 'dayView'][i]}`)}
                </Button>
              ),
            )}
          <Button
            size="icon"
            variant="ghost"
            disabled={busy}
            aria-label={t('app.refresh')}
            onClick={() => void run(() => getWorkspace())}
          >
            <RefreshCw className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            aria-label={t('topbar.toggleAgent')}
            onClick={() => {
              if (smallScreen) setMobileAgentOpen(!mobileAgentOpen)
              else setAgentOpen(!agentOpen)
            }}
          >
            <PanelRight className="size-4" />
          </Button>
        </div>
      </header>
      {error && (
        <div
          role="alert"
          className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800"
        >
          {t(`errors.${error}`)}
        </div>
      )}
      <nav className="flex shrink-0 gap-1 overflow-x-auto border-b p-2 lg:hidden">
        {(['calendar', 'tasks', 'preferences'] as const).map((key) => (
          <Button
            key={key}
            size="sm"
            variant={tab === key ? 'secondary' : 'ghost'}
            onClick={() => setTab(key)}
          >
            {t(`app.${key}`)}
          </Button>
        ))}
        <Button size="sm" variant="outline" onClick={openAgent}>
          {t('app.openAgent')}
        </Button>
      </nav>
      <div className="flex min-h-0 flex-1">
        <div className="hidden w-52 shrink-0 lg:block">
          <ScheduleSidebar
            tab={tab}
            setTab={setTab}
            pendingCount={
              state.proposals.filter((p) => p.status === 'pending').length
            }
            openAgent={openAgent}
            modelConfigured={state.modelConfigured}
          />
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
          {tab === 'calendar' && (
            <>
              <p className="shrink-0 px-4 pt-3 text-xs text-muted-foreground">
                {t('app.timezone', { zone })}
              </p>
              <div className="calendar-frame m-3 min-h-72 flex-1 overflow-hidden">
                <FullCalendar
                  ref={calendar}
                  plugins={[
                    dayGridPlugin,
                    timeGridPlugin,
                    interactionPlugin,
                    pulseThemePlugin,
                  ]}
                  initialView={view}
                  initialDate={localDate(new Date().toISOString(), zone)}
                  headerToolbar={false}
                  weekends
                  allDaySlot={false}
                  slotMinTime="00:00:00"
                  slotMaxTime="24:00:00"
                  scrollTime="08:00:00"
                  slotDuration="00:30:00"
                  eventTimeFormat={{
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  }}
                  nowIndicator={false}
                  editable={false}
                  selectable={false}
                  height="100%"
                  events={events}
                  datesSet={(info) => setTitle(info.view.title)}
                  eventClick={(info) => {
                    const event = state.events.find(
                      (e) => e.id === info.event.id,
                    )
                    if (event)
                      prepare(
                        t('app.movePrompt', {
                          id: event.id,
                          title: event.title,
                        }),
                      )
                    else openAgent()
                  }}
                  eventClass={(info) =>
                    [
                      `schedule-event-${String(info.event.extendedProps.calendar)}`,
                      info.event.extendedProps.calendar === 'proposal'
                        ? 'is-proposal'
                        : '',
                    ]
                      .filter(Boolean)
                      .join(' ')
                  }
                />
              </div>
              <details
                className="max-h-48 shrink-0 overflow-auto border-t p-3 text-xs"
                open={!state.events.length}
              >
                <summary className="cursor-pointer font-medium">
                  {t('app.savedEvents')} ({state.events.length})
                </summary>
                {!state.events.length && (
                  <p className="mt-2 text-muted-foreground">{t('app.empty')}</p>
                )}
                {state.events.map((event) => (
                  <div
                    key={event.id}
                    data-testid="saved-event"
                    className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded bg-muted/40 p-2"
                  >
                    <div>
                      <strong>{event.title}</strong>
                      <p>
                        {localDate(event.start, zone)} ·{' '}
                        {localTime(event.start, zone)}–
                        {localTime(event.end, zone)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          prepare(
                            t('app.movePrompt', {
                              id: event.id,
                              title: event.title,
                            }),
                          )
                        }
                      >
                        {t('app.move')}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          prepare(
                            t('app.deletePrompt', {
                              id: event.id,
                              title: event.title,
                            }),
                          )
                        }
                      >
                        {t('app.delete')}
                      </Button>
                    </div>
                  </div>
                ))}
              </details>
            </>
          )}
          {tab === 'tasks' && (
            <TasksPanel
              state={state}
              busy={busy}
              onCreate={(data) => run(() => createTask({ data }))}
              onStatus={(id, status) =>
                run(() => setTaskStatus({ data: { id, status } }))
              }
              onSchedule={(id) => {
                setTaskId(id)
                openAgent()
              }}
            />
          )}
          {tab === 'preferences' && (
            <PreferencesPanel
              state={state}
              busy={busy}
              onSettings={(data) => run(() => saveSettings({ data }))}
              onPreference={(data) => run(() => savePreference({ data }))}
              onArchive={(id) => run(() => archivePreference({ data: { id } }))}
            />
          )}
        </div>
        {agentOpen && !smallScreen && (
          <div className="hidden h-full w-96 shrink-0 lg:block xl:w-[420px]">
            {panel}
          </div>
        )}
      </div>
      {mobileAgentOpen && smallScreen && (
        <div className="fixed inset-0 z-50 flex justify-end lg:hidden">
          <button
            className="absolute inset-0 bg-black/40"
            aria-label={t('app.closeAgent')}
            onClick={() => setMobileAgentOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t('agent.title')}
            className="relative h-full w-full max-w-md bg-background pt-10"
          >
            <Button
              className="absolute right-2 top-1"
              size="icon"
              variant="ghost"
              aria-label={t('app.closeAgent')}
              onClick={() => setMobileAgentOpen(false)}
            >
              <X className="size-4" />
            </Button>
            {panel}
          </div>
        </div>
      )}
    </main>
  )
}
