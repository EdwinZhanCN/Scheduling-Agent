import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import type {
  Preference,
  PreferenceInput,
  Settings,
  Snapshot,
} from '../domain/contracts'
import { localDate } from '../domain/time'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'

const inputClass =
  'h-9 w-full rounded-md border border-input bg-background px-3 text-sm'
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-xs font-medium">
      {label}
      {children}
    </label>
  )
}
function Days({ name, initial }: { name: string; initial: number[] }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap gap-3">
      {[1, 2, 3, 4, 5, 6, 7].map((day) => (
        <label key={day} className="flex items-center gap-1 text-xs">
          <input
            type="checkbox"
            name={name}
            value={day}
            defaultChecked={initial.includes(day)}
          />
          {t(`days.${day}`)}
        </label>
      ))}
    </div>
  )
}

export function TasksPanel({
  state,
  busy,
  onCreate,
  onStatus,
  onSchedule,
}: {
  state: Snapshot
  busy: boolean
  onCreate: (data: { title: string; description: string }) => Promise<boolean>
  onStatus: (id: string, status: 'todo' | 'done') => Promise<boolean>
  onSchedule: (id: string) => void
}) {
  const { t } = useTranslation()
  return (
    <section className="mx-auto w-full max-w-3xl space-y-6 p-5">
      <header>
        <h2 className="text-xl font-semibold">{t('app.tasks')}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('app.taskHint')}
        </p>
      </header>
      <form
        className="space-y-3 rounded-xl border border-border p-4"
        onSubmit={(event) => {
          event.preventDefault()
          const form = event.currentTarget
          const data = new FormData(form)
          void onCreate({
            title: String(data.get('title')),
            description: String(data.get('description')),
          }).then((ok) => {
            if (ok) form.reset()
          })
        }}
      >
        <Field label={t('app.taskTitle')}>
          <input className={inputClass} name="title" required maxLength={160} />
        </Field>
        <Field label={t('app.description')}>
          <Textarea
            name="description"
            required
            maxLength={6000}
            className="min-h-24"
          />
        </Field>
        <Button disabled={busy || !state.modelConfigured} type="submit">
          {t('app.addTask')}
        </Button>
      </form>
      {!state.tasks.length && (
        <p className="text-sm text-muted-foreground">{t('app.noTasks')}</p>
      )}
      {[...state.tasks].reverse().map((task) => (
        <article
          key={task.id}
          data-testid="task"
          className="space-y-3 rounded-xl border border-border p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-semibold">{task.title}</h3>
            <span className="text-xs text-muted-foreground">
              {t(`app.${task.status}`)}
            </span>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {task.summary}
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded bg-muted px-2 py-1">
              {t('app.complexity')}: {t(`app.${task.complexity}`)}
            </span>
            {task.tags.map((tag) => (
              <span
                key={tag}
                className="rounded bg-blue-50 px-2 py-1 text-blue-800"
              >
                {t(`tags.${tag}`)}
              </span>
            ))}
            {task.project && (
              <span className="rounded bg-violet-50 px-2 py-1 text-violet-800">
                {t('app.project')}: {task.project}
              </span>
            )}
            {task.context && (
              <span className="rounded bg-teal-50 px-2 py-1 text-teal-800">
                {t('app.context')}: {task.context}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => onSchedule(task.id)}>
              {t('app.scheduleTask')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() =>
                void onStatus(task.id, task.status === 'todo' ? 'done' : 'todo')
              }
            >
              {t(task.status === 'todo' ? 'app.markDone' : 'app.reopen')}
            </Button>
          </div>
        </article>
      ))}
    </section>
  )
}

export function PreferencesPanel({
  state,
  busy,
  onSettings,
  onPreference,
  onArchive,
}: {
  state: Snapshot
  busy: boolean
  onSettings: (value: Settings) => Promise<boolean>
  onPreference: (value: PreferenceInput) => Promise<boolean>
  onArchive: (id: string) => Promise<boolean>
}) {
  const { t } = useTranslation()
  const [replacement, setReplacement] = useState<Preference | null>(null)
  const today = localDate(new Date().toISOString(), state.settings.timezone)
  return (
    <section className="mx-auto w-full max-w-3xl space-y-6 p-5">
      <header>
        <h2 className="text-xl font-semibold">{t('app.preferences')}</h2>
      </header>
      <form
        key={`settings-${state.settingsRevision}`}
        className="space-y-4 rounded-xl border border-border p-4"
        onSubmit={(event) => {
          event.preventDefault()
          const data = new FormData(event.currentTarget)
          void onSettings({
            timezone: String(data.get('timezone')),
            dayStart: String(data.get('dayStart')),
            dayEnd: String(data.get('dayEnd')),
            workingDays: data.getAll('workingDays').map(Number),
          })
        }}
      >
        <h3 className="font-semibold">{t('app.settings')}</h3>
        <p className="text-xs text-muted-foreground">{t('app.settingsHint')}</p>
        <Field label={t('app.zone')}>
          <input
            className={inputClass}
            name="timezone"
            defaultValue={state.settings.timezone}
            required
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('app.dayStart')}>
            <input
              className={inputClass}
              type="time"
              name="dayStart"
              defaultValue={state.settings.dayStart}
              required
            />
          </Field>
          <Field label={t('app.dayEnd')}>
            <input
              className={inputClass}
              type="time"
              name="dayEnd"
              defaultValue={state.settings.dayEnd}
              required
            />
          </Field>
        </div>
        <fieldset className="space-y-2">
          <legend className="mb-2 text-xs font-medium">
            {t('app.workingDays')}
          </legend>
          <Days name="workingDays" initial={state.settings.workingDays} />
        </fieldset>
        <Button type="submit" disabled={busy}>
          {t('app.saveSettings')}
        </Button>
      </form>
      <form
        key={replacement?.id || 'new'}
        className="space-y-4 rounded-xl border border-border p-4"
        onSubmit={(event) => {
          event.preventDefault()
          const form = event.currentTarget
          const data = new FormData(form)
          void onPreference({
            text: String(data.get('text')),
            kind: data.get('kind') as 'soft' | 'hard',
            effectiveFrom: String(data.get('effectiveFrom')),
            expiresOn: String(data.get('expiresOn')) || null,
            days: data.getAll('days').map(Number),
            startTime: String(data.get('startTime')),
            endTime: String(data.get('endTime')),
            supersedesId: replacement?.id || null,
          }).then((ok) => {
            if (ok) {
              setReplacement(null)
              form.reset()
            }
          })
        }}
      >
        <h3 className="font-semibold">{t('app.preferenceTitle')}</h3>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t('app.preferenceHint')}
        </p>
        {replacement && (
          <p className="text-xs text-blue-700">
            {t('app.replaces', { id: replacement.id.slice(0, 8) })}
            <button
              className="ml-3 underline"
              type="button"
              onClick={() => setReplacement(null)}
            >
              {t('app.cancelReplacement')}
            </button>
          </p>
        )}
        <Field label={t('app.preferenceText')}>
          <input
            className={inputClass}
            name="text"
            required
            maxLength={1000}
            defaultValue={replacement?.text || ''}
          />
        </Field>
        <Field label={t('app.kind')}>
          <select
            className={inputClass}
            name="kind"
            defaultValue={replacement?.kind || 'soft'}
          >
            <option value="soft">{t('app.soft')}</option>
            <option value="hard">{t('app.hard')}</option>
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('app.effectiveFrom')}>
            <input
              className={inputClass}
              type="date"
              name="effectiveFrom"
              required
              defaultValue={today}
            />
          </Field>
          <Field label={t('app.expiresOn')}>
            <input className={inputClass} type="date" name="expiresOn" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('app.startTime')}>
            <input
              className={inputClass}
              type="time"
              name="startTime"
              required
              defaultValue={replacement?.startTime || '14:00'}
            />
          </Field>
          <Field label={t('app.endTime')}>
            <input
              className={inputClass}
              type="time"
              name="endTime"
              required
              defaultValue={replacement?.endTime || '17:00'}
            />
          </Field>
        </div>
        <fieldset className="space-y-2">
          <legend className="mb-2 text-xs font-medium">{t('app.days')}</legend>
          <Days name="days" initial={replacement?.days || [1, 2, 3, 4, 5]} />
        </fieldset>
        <Button type="submit" disabled={busy}>
          {t('app.savePreference')}
        </Button>
      </form>
      {!state.preferences.length && (
        <p className="text-sm text-muted-foreground">
          {t('app.noPreferences')}
        </p>
      )}
      {[...state.preferences].reverse().map((p) => (
        <article
          key={p.id}
          data-testid="preference"
          className="space-y-2 rounded-xl border border-border p-4 text-sm"
        >
          <div className="flex justify-between gap-2">
            <h3 className="font-medium">{p.text}</h3>
            <span className="text-xs">{t(`app.${p.status}`)}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {t(`app.${p.kind}`)} ·{' '}
            {p.days.map((d) => t(`days.${d}`)).join(', ')} · {p.startTime}–
            {p.endTime}
          </p>
          <p className="text-xs text-muted-foreground">
            {t('app.effectiveFrom')}: {p.effectiveFrom}
            {p.expiresOn && ` · ${t('app.expiresOn')}: ${p.expiresOn}`}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {t('app.code', { id: p.id.slice(0, 8) })}
            {p.supersedesId &&
              ` · ${t('app.replaces', { id: p.supersedesId.slice(0, 8) })}`}
          </p>
          {p.status === 'active' && (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setReplacement(p)
                  document
                    .querySelector('input[name="text"]')
                    ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                }}
              >
                {t('app.replace')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => void onArchive(p.id)}
              >
                {t('app.archive')}
              </Button>
            </div>
          )}
        </article>
      ))}
    </section>
  )
}
