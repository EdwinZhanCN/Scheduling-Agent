import { CalendarDays, ListTodo, SlidersHorizontal } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from './ui/button'

export type WorkspaceTab = 'calendar' | 'tasks' | 'preferences'
export function ScheduleSidebar({
  tab,
  setTab,
  pendingCount,
  openAgent,
  modelConfigured,
}: {
  tab: WorkspaceTab
  setTab: (tab: WorkspaceTab) => void
  pendingCount: number
  openAgent: () => void
  modelConfigured: boolean
}) {
  const { t } = useTranslation()
  return (
    <aside
      className="flex h-full flex-col border-r border-border bg-muted/20 p-3"
      aria-label={t('sidebar.workspace')}
    >
      <h1 className="px-2 py-3 text-sm font-semibold">{t('app.title')}</h1>
      <nav className="space-y-1">
        {(
          [
            ['calendar', CalendarDays],
            ['tasks', ListTodo],
            ['preferences', SlidersHorizontal],
          ] as const
        ).map(([key, Icon]) => (
          <Button
            key={key}
            variant={tab === key ? 'secondary' : 'ghost'}
            className="w-full justify-start gap-2 text-xs"
            onClick={() => setTab(key)}
          >
            <Icon className="size-4" />
            {t(`app.${key}`)}
          </Button>
        ))}
      </nav>
      <Button
        variant="outline"
        size="sm"
        className="mt-5 justify-between text-xs"
        onClick={openAgent}
      >
        <span>{t('sidebar.pendingProposals')}</span>
        <span>{pendingCount}</span>
      </Button>
      <div className="mt-auto space-y-2 px-2 py-3 text-[11px] text-muted-foreground">
        <p>{t('app.local')}</p>
        <p className={modelConfigured ? 'text-emerald-700' : 'text-amber-700'}>
          {t(modelConfigured ? 'app.modelReady' : 'app.modelMissing')}
        </p>
      </div>
    </aside>
  )
}
