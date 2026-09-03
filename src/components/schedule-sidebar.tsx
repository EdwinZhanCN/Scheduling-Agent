import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarDays, CircleHelp, Info, Settings } from 'lucide-react'

import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Separator } from '#/components/ui/separator'

type ScheduleSidebarProps = {
  pendingCount: number
  onOpenInbox: () => void
}

export function ScheduleSidebar({
  pendingCount,
  onOpenInbox,
}: ScheduleSidebarProps) {
  const { t } = useTranslation()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <aside
      className="schedule-sidebar flex h-full flex-col justify-between border-r border-border bg-zinc-50/60 text-sm overflow-hidden"
      aria-label={t('sidebar.workspace')}
    >
      {/* Scrollable Navigation Body */}
      <div className="flex flex-1 flex-col gap-5 p-3 overflow-y-auto">
        {/* Workspace Section */}
        <div className="flex flex-col gap-1">
          <div className="px-2 py-1">
            <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              {t('sidebar.workspace')}
            </span>
          </div>

          <Button
            variant="secondary"
            size="sm"
            className="w-full justify-between font-medium shadow-none"
            type="button"
          >
            <span className="flex items-center gap-2">
              <CalendarDays className="size-4 text-foreground" />
              <span>{t('sidebar.calendarView')}</span>
            </span>
            <kbd className="pointer-events-none inline-flex h-4.5 select-none items-center rounded border border-border bg-background px-1.5 font-mono text-[10px] text-muted-foreground">
              ⌘1
            </kbd>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-between text-muted-foreground hover:text-foreground font-normal"
            type="button"
            onClick={onOpenInbox}
          >
            <span>{t('sidebar.pendingProposals')}</span>
            {pendingCount > 0 && (
              <Badge
                variant="warning"
                className="h-4.5 min-w-4.5 justify-center rounded-full px-1.5 text-[10px] font-medium"
              >
                {pendingCount}
              </Badge>
            )}
          </Button>
        </div>

        <Separator className="bg-border/60" />

        {/* My Calendars / Legend Section */}
        <div className="flex flex-col gap-1">
          <div className="px-2 py-1">
            <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              {t('sidebar.myCalendars')}
            </span>
          </div>

          <div className="flex flex-col gap-0.5">
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs text-foreground transition-colors hover:bg-zinc-200/50"
            >
              <div className="flex items-center gap-2.5">
                <span className="size-2 rounded-xs bg-zinc-900" />
                <span>{t('sidebar.courses')}</span>
              </div>
              <span className="text-[11px] text-muted-foreground">
                {t('sidebar.itemCount', { count: 2 })}
              </span>
            </button>

            <button
              type="button"
              className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs text-foreground transition-colors hover:bg-zinc-200/50"
            >
              <div className="flex items-center gap-2.5">
                <span className="size-2 rounded-xs bg-rose-400" />
                <span>{t('sidebar.personal')}</span>
              </div>
              <span className="text-[11px] text-muted-foreground">
                {t('sidebar.itemCount', { count: 1 })}
              </span>
            </button>

            <button
              type="button"
              onClick={onOpenInbox}
              className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs text-foreground transition-colors hover:bg-zinc-200/50"
            >
              <div className="flex items-center gap-2.5">
                <span className="size-2 rounded-xs border border-dashed border-amber-500 bg-amber-50" />
                <span className="text-amber-800 dark:text-amber-400">
                  {t('sidebar.aiReview')}
                </span>
              </div>
              <Badge
                variant="outline"
                className="h-4 border-amber-300 px-1 text-[10px] text-amber-700 dark:border-amber-700 dark:text-amber-400 font-normal"
              >
                {t('sidebar.proposalBadge')}
              </Badge>
            </button>
          </div>
        </div>
      </div>

      {/* Fixed Footer Area: Ghost Button with Popover */}
      <div className="relative shrink-0 border-t border-border/70 bg-zinc-50/90 p-2 backdrop-blur-xs">
        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-30"
              onClick={() => setMenuOpen(false)}
            />
            <div
              className="absolute right-2 bottom-full left-2 z-40 mb-2 flex flex-col gap-0.5 rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-xl animate-in fade-in-0 zoom-in-95"
              role="menu"
            >
              {/* App Info Header Item */}
              <div className="flex items-center gap-2.5 px-2 py-2">
                <img
                  src="/icon.png"
                  alt={t('sidebar.appName')}
                  className="size-7 rounded-lg object-cover ring-1 ring-border"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-foreground">
                    {t('sidebar.appName')}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {t('sidebar.appSubtitle')}
                  </p>
                </div>
              </div>

              <Separator className="my-1 bg-border/60" />

              {/* Menu Actions: Settings & About Only */}
              <button
                type="button"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <div className="flex items-center gap-2">
                  <Settings className="size-4 text-muted-foreground" />
                  <span>{t('sidebar.menu.settings')}</span>
                </div>
                <kbd className="font-mono text-[10px] text-muted-foreground">
                  ⌘,
                </kbd>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <Info className="size-4 text-muted-foreground" />
                <span>{t('sidebar.menu.about')}</span>
              </button>
            </div>
          </>
        )}

        {/* Footer Row: Left Ghost Trigger + Right Standalone Help Ghost Button */}
        <div className="flex items-center justify-between gap-1">
          {/* App Ghost Trigger Button (Only this triggers menu) */}
          <button
            type="button"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-zinc-200/60 active:scale-[0.98] ${
              menuOpen ? 'bg-zinc-200/60' : ''
            }`}
          >
            <img
              src="/icon.png"
              alt={t('sidebar.appName')}
              className="size-5.5 shrink-0 rounded-md object-cover ring-1 ring-border/80"
            />
            <span className="truncate text-xs font-medium text-foreground">
              {t('sidebar.appName')}
            </span>
          </button>

          {/* Standalone Help/About Ghost Button */}
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground hover:text-foreground rounded-lg shrink-0"
            type="button"
            aria-label={t('sidebar.about')}
          >
            <CircleHelp className="size-3.5" />
          </Button>
        </div>
      </div>
    </aside>
  )
}
