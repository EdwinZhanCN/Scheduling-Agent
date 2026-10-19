import { Temporal } from 'temporal-polyfill'
import type { Evidence, Preference } from './contracts'

function tokens(text: string): Set<string> {
  return new Set(text.toLowerCase().match(/[a-z0-9]+|[\u3400-\u9fff]/g) ?? [])
}

export function retrievePreferences(
  records: Preference[],
  date: string,
  query: string,
  onlyDay = true,
) {
  const eligible: Preference[] = []
  const excluded: Evidence[] = []
  const weekday = Temporal.PlainDate.from(date).dayOfWeek
  // Once a replacement takes effect, archiving/expiring it must not resurrect its predecessor.
  const replaced = new Set(
    records
      .filter((p) => p.owner === 'local' && p.effectiveFrom <= date)
      .map((p) => p.supersedesId)
      .filter(Boolean),
  )
  for (const p of records) {
    const reason =
      p.owner !== 'local'
        ? 'wrong_owner'
        : p.status !== 'active'
          ? 'archived'
          : p.effectiveFrom > date
            ? 'not_effective'
            : p.expiresOn && p.expiresOn < date
              ? 'expired'
              : replaced.has(p.id)
                ? 'superseded'
                : onlyDay && !p.days.includes(weekday)
                  ? 'different_day'
                  : null
    if (reason) excluded.push({ id: p.id, text: p.text, reason })
    else eligible.push(p)
  }
  const q = tokens(query)
  const score = (p: Preference) =>
    [...tokens(p.text)].filter((token) => q.has(token)).length
  eligible.sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id))
  // Never truncate hard constraints based on relevance. All applicable rules are enforced.
  return {
    eligible,
    excluded,
    supporting: eligible.map((p) => ({
      id: p.id,
      text: p.text,
      reason: p.kind,
    })),
  }
}
