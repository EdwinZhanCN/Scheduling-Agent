import { Temporal } from 'temporal-polyfill'

export function minutes(time: string) {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}
export function clock(total: number) {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}
export function instant(date: string, time: string, zone: string) {
  // Reject nonexistent/ambiguous wall times rather than silently shifting across DST.
  return Temporal.PlainDateTime.from(`${date}T${time}`)
    .toZonedDateTime(zone, { disambiguation: 'reject' })
    .toInstant()
    .toString()
}
export function localDate(value: string, zone: string) {
  return Temporal.Instant.from(value)
    .toZonedDateTimeISO(zone)
    .toPlainDate()
    .toString()
}
export function localTime(value: string, zone: string) {
  return Temporal.Instant.from(value)
    .toZonedDateTimeISO(zone)
    .toPlainTime()
    .toString()
    .slice(0, 5)
}
export function epoch(value: string) {
  return Temporal.Instant.from(value).epochMilliseconds
}
export function overlaps(
  a: { start: string; end: string },
  b: { start: string; end: string },
) {
  return epoch(a.start) < epoch(b.end) && epoch(b.start) < epoch(a.end)
}
