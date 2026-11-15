import { checkedResult, cachedResult, limited } from '../../../src/lib/sgr/cache'
import { routeQuery, monthDates, nairobiToday, calendarDay, type CalendarDay } from '../../../src/lib/sgr/calendar'
import { getLiveDirectory } from '../../../src/lib/sgr/live'

export const onRequest = async ({ request }: { request: Request }) => {
  if (request.method !== 'GET') return new Response(null, { status: 405, headers: { Allow: 'GET' } })
  const headers = { 'Cache-Control': 'no-store' }
  const url = new URL(request.url)
  const streaming = url.searchParams.get('stream') === '1'
  if (limited(request, streaming ? 'month-stream' : 'month', streaming ? 8 : 45)) return Response.json({ message: 'Please wait a minute before loading more dates.' }, { status: 429, headers: { ...headers, 'Retry-After': '60' } })
  let query, dates
  try {
    query = routeQuery(url)
    dates = monthDates(url.searchParams.get('month') || '')
    const today = nairobiToday()
    const last = new Date(`${today}T00:00:00Z`)
    last.setUTCDate(last.getUTCDate() + 90)
    if (dates[dates.length - 1] < today || dates[0] > last.toISOString().slice(0, 10)) throw new Error('Choose a month in the current booking window.')
  } catch (error) { return Response.json({ message: (error as Error).message }, { status: 400, headers }) }
  try {
    const { window, stations } = await getLiveDirectory(fetch, query.service)
    if (!stations.some(station => station.id === query.origin) || !stations.some(station => station.id === query.destination)) {
      return Response.json({ message: 'Choose valid stations for this service.' }, { status: 400, headers })
    }
    const earliest = window.earliest || nairobiToday()
    const latest = window.latest
    const days: CalendarDay[] = await Promise.all(dates.map(async date => {
      if (date < earliest || (latest && date > latest)) return { date, status: 'outside-window', lastChecked: null }
      const result = await cachedResult(query, date)
      return result ? calendarDay(result) : { date, status: 'unchecked', lastChecked: null }
    }))
    // Each poll does bounded work; successful results are shared between visitors.
    // A provider outage stops the scan instead of fanning out to every date.
    const selected = url.searchParams.get('selected')
    const candidates = days.filter(day => day.status === 'unchecked').sort((a, b) => Number(b.date === selected) - Number(a.date === selected))
    if (streaming) {
      let cancelled = false
      const encoder = new TextEncoder()
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          const send = (value: unknown) => { if (!cancelled) controller.enqueue(encoder.encode(JSON.stringify(value) + '\n')) }
          // Cached dates are delivered before the first network seat check.
          send({ type: 'snapshot', days, window, loading: candidates.length > 0 })
          let cursor = 0, failures = 0
          const worker = async () => {
            while (!cancelled && !request.signal.aborted && failures < 3 && cursor < candidates.length) {
              const candidate = candidates[cursor++]
              const result = await checkedResult(query!, candidate.date)
              const day = calendarDay(result)
              Object.assign(days.find(item => item.date === day.date)!, day)
              send({ type: 'day', day })
              failures = result.status === 'unavailable' ? failures + 1 : 0
            }
          }
          void Promise.all(Array.from({ length: Math.min(3, candidates.length) }, worker)).then(() => {
            send({ type: 'done', incomplete: days.some(day => day.status === 'unchecked' || day.status === 'unavailable'),
              message: days.some(day => day.status === 'unavailable') ? 'Some dates could not be checked. Select a date to retry.' : undefined })
            if (!cancelled) controller.close()
          }).catch(() => {
            send({ type: 'done', incomplete: true, message: 'The connection was interrupted. Please update dates.' })
            if (!cancelled) controller.close()
          })
        },
        cancel() { cancelled = true },
      })
      return new Response(body, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store, no-transform', 'X-Content-Type-Options': 'nosniff' } })
    }
    const batch = await Promise.all(candidates.slice(0, 3).map(day => checkedResult(query, day.date)))
    for (const result of batch) {
      const day = days.find(day => day.date === result.date)!
      Object.assign(day, calendarDay(result))
    }
    const failed = batch.some(result => result.status === 'unavailable')
    return Response.json({ days, window, loading: !failed && days.some(day => day.status === 'unchecked'),
      incomplete: days.some(day => day.status === 'unchecked' || day.status === 'unavailable'),
      message: failed ? 'Some dates could not be checked. Retry shortly or use the official portal.' : undefined,
      cacheSeconds: 120 }, { headers })
  } catch {
    return Response.json({ message: 'Kenya Railways is temporarily unreachable. Please retry shortly.' }, { status: 503, headers })
  }
}
