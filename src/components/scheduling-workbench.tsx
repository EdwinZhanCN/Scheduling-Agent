import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import FullCalendar from '@fullcalendar/react'
import type {
  CalendarRef,
  DatesSetInfo,
  EventDisplayInfo,
  EventClickInfo,
} from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/react/daygrid'
import interactionPlugin from '@fullcalendar/react/interaction'
import timeGridPlugin from '@fullcalendar/react/timegrid'
import pulseThemePlugin from '@fullcalendar/react/themes/pulse'
import { ChevronLeft, ChevronRight, Menu, PanelRight, X } from 'lucide-react'

import { AgentPanel } from '#/components/agent-panel'
import { ScheduleSidebar } from '#/components/schedule-sidebar'
import { Button } from '#/components/ui/button'
import { demoEvents, demoProposal, getProposalEvent } from '#/lib/demo-schedule'
import type { ProposalStatus } from '#/lib/demo-schedule'

type CalendarView = 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay'

export function SchedulingWorkbench() {
  const { t } = useTranslation()
  const calendarRef = useRef<CalendarRef>(null)
  const [proposalStatus, setProposalStatus] =
    useState<ProposalStatus>('pending')
  const [calendarView, setCalendarView] = useState<CalendarView>('timeGridWeek')
  const [calendarTitle, setCalendarTitle] = useState('September 2026')
  const [desktopAgentOpen, setDesktopAgentOpen] = useState(true)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [mobileAgentOpen, setMobileAgentOpen] = useState(false)

  const events = useMemo(() => {
    const proposalEvent = getProposalEvent(demoProposal, proposalStatus)
    return proposalEvent ? [...demoEvents, proposalEvent] : demoEvents
  }, [proposalStatus])

  const pendingCount = proposalStatus === 'pending' ? 1 : 0

  function moveCalendar(direction: 'prev' | 'next') {
    calendarRef.current?.getApi()[direction]()
  }

  function returnToDemoWeek() {
    calendarRef.current?.getApi().gotoDate('2026-09-07')
  }

  function handleViewChange(view: CalendarView) {
    setCalendarView(view)
    calendarRef.current?.getApi().changeView(view)
  }

  function handleDatesSet(info: DatesSetInfo) {
    setCalendarTitle(info.view.title)
  }

  function handleEventClick(info: EventClickInfo) {
    if (info.event.extendedProps.proposalId) {
      setDesktopAgentOpen(true)
      setMobileAgentOpen(true)
    }
  }

  function openInbox() {
    setDesktopAgentOpen(true)
    setMobileAgentOpen(true)
    setMobileSidebarOpen(false)
  }

  function toggleAgent() {
    setDesktopAgentOpen((open) => !open)
    setMobileAgentOpen((open) => !open)
  }

  return (
    <main className="flex h-dvh min-h-screen flex-col overflow-hidden bg-background text-foreground">
      {/* Top Navbar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-3 sm:px-4">
        {/* Left Navigation */}
        <nav
          className="flex items-center gap-1.5 sm:gap-2"
          aria-label={t('sidebar.calendarView')}
        >
          {/* Mobile/Tablet Menu Button to Open Sidebar */}
          <Button
            variant="ghost"
            size="icon"
            className="size-8 lg:hidden"
            type="button"
            aria-label={t('topbar.menu')}
            onClick={() => setMobileSidebarOpen(true)}
          >
            <Menu className="size-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="hidden h-8 rounded-md px-2.5 text-xs font-medium sm:inline-flex"
            type="button"
            onClick={returnToDemoWeek}
          >
            {t('topbar.demoWeek')}
          </Button>

          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-md"
              type="button"
              aria-label={t('topbar.prev')}
              onClick={() => moveCalendar('prev')}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-md"
              type="button"
              aria-label={t('topbar.next')}
              onClick={() => moveCalendar('next')}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <strong className="truncate px-1 text-sm font-semibold tracking-tight text-foreground sm:px-2 sm:text-base">
            {calendarTitle}
          </strong>
        </nav>

        {/* Right Action Controls & View Switcher */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Segmented View Switcher */}
          <div className="flex items-center rounded-lg border border-border bg-muted/50 p-0.5">
            <button
              type="button"
              onClick={() => handleViewChange('dayGridMonth')}
              className={`rounded-md px-2 py-1 text-xs font-medium transition-all sm:px-2.5 ${
                calendarView === 'dayGridMonth'
                  ? 'bg-background text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('topbar.monthView')}
            </button>
            <button
              type="button"
              onClick={() => handleViewChange('timeGridWeek')}
              className={`rounded-md px-2 py-1 text-xs font-medium transition-all sm:px-2.5 ${
                calendarView === 'timeGridWeek'
                  ? 'bg-background text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('topbar.weekView')}
            </button>
            <button
              type="button"
              onClick={() => handleViewChange('timeGridDay')}
              className={`rounded-md px-2 py-1 text-xs font-medium transition-all sm:px-2.5 ${
                calendarView === 'timeGridDay'
                  ? 'bg-background text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('topbar.dayView')}
            </button>
          </div>

          {/* Toggle Agent Dock Button */}
          <Button
            variant={
              desktopAgentOpen || mobileAgentOpen ? 'secondary' : 'outline'
            }
            size="icon"
            className="size-8"
            type="button"
            aria-label={t('topbar.toggleAgent')}
            onClick={toggleAgent}
          >
            <PanelRight className="size-4" />
          </Button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {/* Desktop Sidebar (visible on lg: and up) */}
        <div className="hidden h-full w-60 shrink-0 lg:block">
          <ScheduleSidebar
            pendingCount={pendingCount}
            onOpenInbox={openInbox}
          />
        </div>

        {/* Center Calendar Panel */}
        <section
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background p-2.5 sm:p-4"
          aria-label={t('sidebar.calendarView')}
        >
          <div className="calendar-frame min-h-0 flex-1 overflow-hidden">
            <FullCalendar
              ref={calendarRef}
              plugins={[
                dayGridPlugin,
                timeGridPlugin,
                interactionPlugin,
                pulseThemePlugin,
              ]}
              initialView="timeGridWeek"
              initialDate="2026-09-07"
              headerToolbar={false}
              weekends={false}
              allDaySlot={false}
              slotMinTime="08:00:00"
              slotMaxTime="20:00:00"
              slotDuration="00:30:00"
              dayHeaderFormat={{ weekday: 'short', day: 'numeric' }}
              eventTimeFormat={{
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              }}
              nowIndicator={false}
              editable={false}
              selectable={false}
              expandRows
              height="100%"
              events={events}
              datesSet={handleDatesSet}
              eventClick={handleEventClick}
              eventClass={(info: EventDisplayInfo) => {
                const calendar = info.event.extendedProps.calendar
                return [
                  `schedule-event-${String(calendar)}`,
                  info.event.extendedProps.proposalId ? 'is-proposal' : '',
                ]
                  .filter(Boolean)
                  .join(' ')
              }}
            />
          </div>
        </section>

        {/* Desktop Right Agent Dock (collapsible, visible on lg: and up) */}
        {desktopAgentOpen && (
          <div className="hidden h-full w-84 shrink-0 lg:block xl:w-96">
            <AgentPanel
              proposal={demoProposal}
              status={proposalStatus}
              onApprove={() => setProposalStatus('approved')}
              onReject={() => setProposalStatus('rejected')}
            />
          </div>
        )}

        {/* Tablet & Mobile Slide-over Drawer for Agent Panel (< lg) */}
        {mobileAgentOpen && (
          <div className="fixed inset-0 z-50 flex justify-end lg:hidden">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in-0"
              onClick={() => setMobileAgentOpen(false)}
            />
            {/* Slide-in Sheet */}
            <div className="relative z-10 flex h-full w-full max-w-sm flex-col bg-background shadow-2xl animate-in slide-in-from-right duration-200 sm:max-w-md">
              <div className="absolute top-3.5 right-3.5 z-20">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  type="button"
                  aria-label={t('topbar.close')}
                  onClick={() => setMobileAgentOpen(false)}
                >
                  <X className="size-4" />
                </Button>
              </div>
              <div className="h-full">
                <AgentPanel
                  proposal={demoProposal}
                  status={proposalStatus}
                  onApprove={() => setProposalStatus('approved')}
                  onReject={() => setProposalStatus('rejected')}
                />
              </div>
            </div>
          </div>
        )}

        {/* Mobile & Tablet Slide-over Drawer for Sidebar (< lg) */}
        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-50 flex justify-start lg:hidden">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in-0"
              onClick={() => setMobileSidebarOpen(false)}
            />
            {/* Slide-in Sheet */}
            <div className="relative z-10 flex h-full w-72 max-w-[80vw] flex-col bg-background shadow-2xl animate-in slide-in-from-left duration-200">
              <div className="absolute top-3 right-3 z-20">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  type="button"
                  aria-label={t('topbar.close')}
                  onClick={() => setMobileSidebarOpen(false)}
                >
                  <X className="size-4" />
                </Button>
              </div>
              <div className="h-full">
                <ScheduleSidebar
                  pendingCount={pendingCount}
                  onOpenInbox={openInbox}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
