import type { AvailabilityResponse } from './client'
import { nairobiToday, monthDates, type CalendarDay } from './calendar'

type Station = { id: string; name: string }
type Directory = { stations: Station[]; origin?: string; destinations?: Station[]; window: { earliest: string | null; latest: string | null } }
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const origin = $<HTMLSelectElement>('origin')
const destination = $<HTMLSelectElement>('destination')
const departure = $<HTMLSelectElement>('departure')
const classFilter = $<HTMLSelectElement>('seat-class')
const refresh = $<HTMLButtonElement>('refresh')
const retryMonth = $<HTMLButtonElement>('retry-month')
const today = nairobiToday()
let service = 'express'
let month = today.slice(0, 7)
let selected = today
let earliest = today
let latest: string | null = null
let ready = false
let routeVersion = 0
let monthVersion = 0
let detailVersion = 0
let routeController = new AbortController()
let monthController = new AbortController()
let detailController = new AbortController()
let days = new Map<string, CalendarDay>()
const details = new Map<string, AvailabilityResponse>()
const directories = new Map<string, { value: Directory; expires: number }>()
const directoryRequests = new Map<string, Promise<Directory>>()
const snapshots = new Map<string, Map<string, CalendarDay>>()
let activeRouteKey = ''
const descriptions: Record<string, string> = { express: 'Direct connections. Choose your departure.', inter_county: 'More stops. More places to discover.', phase2: 'Through the Rift Valley to Suswa.' }
function query() { return new URLSearchParams({ origin: origin.value, destination: destination.value, service, departure: service === 'express' ? departure.value : '' }) }
function detailKey(date: string) { return `${query()}:${date}` }
function outside(date: string) { return date < earliest || Boolean(latest && date > latest) }
function readable(date: string, full = false) { return new Intl.DateTimeFormat('en-KE', { timeZone: 'UTC', ...(full ? { dateStyle: 'full' as const } : { weekday: 'short' as const, day: 'numeric' as const, month: 'long' as const }) }).format(new Date(`${date}T00:00:00Z`)) }
function statusText(message: string, busy = false) { $('month-status').textContent = message; $('scan-indicator').classList.toggle('busy', busy) }
async function request<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(path, { signal: AbortSignal.any([signal, AbortSignal.timeout(45_000)]), headers: { Accept: 'application/json' } })
  const data = await response.json()
  if (!response.ok) throw new Error(data.message || 'The checker is unavailable. Please try again shortly.')
  return data as T
}
function options(select: HTMLSelectElement, stations: Station[], preferred?: string) {
  select.replaceChildren(...stations.map(station => new Option(station.name, station.id)))
  select.value = stations.find(station => station.id === preferred || station.name === preferred)?.id || stations[0]?.id || ''
  select.disabled = !stations.length
}
function placeholder(select: HTMLSelectElement, message: string) { select.replaceChildren(new Option(message, '')); select.disabled = true }
function stopMonth() { monthController.abort(); monthController = new AbortController(); monthVersion++; }
function resetRoute() {
  if (activeRouteKey && days.size) snapshots.set(activeRouteKey, new Map(days))
  routeVersion++; routeController.abort(); routeController = new AbortController(); stopMonth()
  detailController.abort(); detailVersion++; days.clear(); ready = false; refresh.disabled = true; retryMonth.disabled = true
  $('train-list').replaceChildren(); $('results-message').textContent = 'Choose your route to see seat details.'
  $('last-checked').textContent = 'No date checked yet.'; $('selected-route').textContent = ''
  $<HTMLButtonElement>('swap-route').disabled = true
  renderCalendar()
}
function renderCalendar() {
  const focusDate = document.activeElement instanceof HTMLElement ? document.activeElement.dataset.date : undefined
  const calendar = $('calendar-days')
  $('month-label').textContent = new Intl.DateTimeFormat('en-KE', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`))
  const offset = (new Date(`${month}-01T00:00:00Z`).getUTCDay() + 6) % 7
  calendar.replaceChildren()
  for (let i = 0; i < offset; i++) { const blank = document.createElement('span'); blank.setAttribute('aria-hidden', 'true'); calendar.append(blank) }
  for (const date of monthDates(month)) {
    const record = days.get(date)
    const filteredSeats = classFilter.value === 'economy' ? record?.economy : classFilter.value === 'first' ? record?.firstClass : record?.seats
    const state = outside(date) ? 'outside-window' : record?.status === 'available' && filteredSeats === 0 ? 'sold-out' : record?.status === 'available' && (filteredSeats ?? 100) < 20 ? 'low' : record?.status || 'unchecked'
    const label = state === 'outside-window' ? 'Not open' : state === 'sold-out' ? 'Sold out' : state === 'available' || state === 'low' ? `${filteredSeats?.toLocaleString()} seats` : state === 'unavailable' ? 'Unknown' : '—'
    const button = document.createElement('button'); button.type = 'button'; button.dataset.date = date
    button.className = `state-${state}${selected === date ? ' is-selected' : ''}`
    button.disabled = !ready || outside(date)
    button.setAttribute('aria-pressed', String(selected === date)); button.setAttribute('aria-label', `${readable(date, true)}, ${label === '—' ? 'not checked' : label}`)
    if (date === today) button.setAttribute('aria-current', 'date')
    const number = document.createElement('span'); number.className = 'date-number'; number.textContent = String(Number(date.slice(8)))
    const count = document.createElement('span'); count.className = 'day-classes'
    for (const [name, short, value, kind] of [['First Class', '1st', record?.firstClass, 'first'], ['Economy', 'Eco', record?.economy, 'economy']] as const) {
      if (classFilter.value !== 'all' && classFilter.value !== kind) continue
      const row = document.createElement('span'); row.className = 'day-class ' + kind
      const confirmed = record?.status === 'available' || record?.status === 'sold-out'
      const seats = record?.status === 'sold-out' ? 0 : value
      row.classList.toggle('empty', confirmed && seats === 0)
      row.classList.toggle('few', confirmed && seats !== undefined && seats > 0 && seats < 20)
      const quantity = document.createElement('strong'); quantity.textContent = confirmed && seats !== undefined ? seats.toLocaleString() : '\u2014'
      const text = document.createElement('span'); text.className = 'class-caption'
      const full = document.createElement('span'); full.className = 'day-label-full'; full.textContent = name
      const compact = document.createElement('span'); compact.className = 'day-label-compact'; compact.textContent = short
      text.append(full, compact)
      const note = document.createElement('small'); note.textContent = confirmed && seats === 0 ? 'Sold out' : confirmed && seats !== undefined && seats < 20 ? 'Few left' : record?.status === 'unavailable' ? 'Unknown' : !confirmed ? 'Checking' : 'seats'
      text.append(note); row.append(quantity, text); count.append(row)
    }
    if (outside(date)) count.hidden = true
    const classesLabel = record?.lastChecked ? ', First Class ' + (record.firstClass ?? 0) + ', Economy ' + (record.economy ?? 0) : ''
    button.setAttribute('aria-label', readable(date, true) + ', ' + label + classesLabel)
    button.append(number, count); button.addEventListener('click', () => { selected = date; renderCalendar(); void loadDetail() }); calendar.append(button)
  }
  if (focusDate) calendar.querySelector<HTMLButtonElement>(`[data-date="${focusDate}"]`)?.focus({ preventScroll: true })
  $<HTMLButtonElement>('previous-month').disabled = month <= today.slice(0, 7)
  const cap = latest || new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10)
  $<HTMLButtonElement>('next-month').disabled = month >= cap.slice(0, 7)
}
function renderDetail(result?: AvailabilityResponse) {
  $('results-title').textContent = readable(selected)
  $('selected-route').textContent = `${origin.selectedOptions[0]?.text || ''} \u2192 ${destination.selectedOptions[0]?.text || ''} · ${service === 'inter_county' ? 'Inter-County' : service === 'phase2' ? 'Suswa' : `Express · ${departure.selectedOptions[0].text}`}`
  $('train-list').replaceChildren()
  $('results-message').textContent = result?.status === 'sold-out'
    ? 'This departure is sold out on Kenya Railways. Safari Rail has no additional seats. Please try another date or time.'
    : result?.message || (result?.status === 'available' ? 'There’s room for your next journey.' : result?.status === 'outside-window' ? 'This date is outside the current booking window.' : 'Checking seats for this date…')
  $('last-checked').textContent = result?.lastChecked ? `Checked ${new Intl.DateTimeFormat('en-KE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Nairobi' }).format(new Date(result.lastChecked))} EAT${result.cached ? ' · cached result' : ''}` : 'No confirmed seat count for this date yet.'
  for (const train of result?.trains || []) {
    const article = document.createElement('article'); article.className = 'train-result'
    const heading = document.createElement('h3'); heading.textContent = `TRAIN ${train.trainNumber}`
    const times = document.createElement('p'); times.className = 'train-times'; times.textContent = `${train.departure} \u2192 ${train.arrival}`
    const caption = document.createElement('p'); caption.className = 'time-caption'; caption.textContent = `Departure \u2192 arrival · East Africa Time${train.arrival < train.departure ? ' · arrives next day' : ''}`
    const fares = document.createElement('dl')
    for (const [label, count, price] of [['Economy', train.economyAvailable, train.economyFare], ['First Class', train.firstClassAvailable, train.firstClassFare]] as const) {
      if (classFilter.value === 'economy' && label !== 'Economy' || classFilter.value === 'first' && label !== 'First Class') continue
      const row = document.createElement('div'); row.className = 'fare-row'
      const term = document.createElement('dt'); term.textContent = label
      const seats = document.createElement('small'); seats.textContent = count ? `${count.toLocaleString()} seats available` : 'Sold out'; term.append(seats)
      const fare = document.createElement('dd'); fare.textContent = `KES ${price.toLocaleString()}`
      const adult = document.createElement('small'); adult.textContent = 'per adult'; fare.append(adult); row.append(term, fare); fares.append(row)
    }
    article.append(heading, times, caption, fares); $('train-list').append(article)
  }
}
async function loadDetail(force = false) {
  if (!ready || outside(selected)) return
  detailController.abort(); detailController = new AbortController()
  const signal = detailController.signal, version = ++detailVersion, route = routeVersion, date = selected, key = detailKey(date)
  const cached = details.get(key)
  if (!force && cached?.lastChecked && Date.now() - Date.parse(cached.lastChecked) < 120_000) { renderDetail({ ...cached, cached: true }); refresh.disabled = false; refresh.textContent = '\u21bb Check this date again'; return }
  renderDetail(); refresh.disabled = true; refresh.textContent = 'Checking seats…'
  const params = query(); params.set('date', date); if (force) params.set('refresh', '1')
  try {
    const result = await request<AvailabilityResponse>(`/api/sgr/availability?${params}`, signal)
    if (route !== routeVersion || version !== detailVersion || signal.aborted) return
    details.set(key, result)
    days.set(date, { date, status: result.status || 'unavailable', seats: result.trains?.reduce((sum, train) => sum + train.economyAvailable + train.firstClassAvailable, 0), economy: result.status === 'sold-out' ? 0 : result.trains?.reduce((sum, train) => sum + train.economyAvailable, 0), firstClass: result.status === 'sold-out' ? 0 : result.trains?.reduce((sum, train) => sum + train.firstClassAvailable, 0), trains: result.trains, lastChecked: result.lastChecked || null } as CalendarDay)
    renderDetail(result); renderCalendar()
  } catch (error) {
    if (signal.aborted || version !== detailVersion || route !== routeVersion) return
    const result: AvailabilityResponse = { date, status: 'unavailable', message: error instanceof Error && error.name !== 'TimeoutError' ? error.message : 'The check took too long. Please try again.' }
    days.set(date, { date, status: 'unavailable', lastChecked: null }); renderDetail(result); renderCalendar()
  } finally {
    if (version === detailVersion && route === routeVersion) { refresh.disabled = false; refresh.textContent = '\u21bb Check this date again' }
  }
}
function applyDay(day: CalendarDay) {
  const previous = days.get(day.date)
  if (previous?.lastChecked && (!day.lastChecked || day.lastChecked < previous.lastChecked)) return
  days.set(day.date, day)
  if (day.lastChecked && day.trains) {
    const result: AvailabilityResponse = { date: day.date, status: day.status as AvailabilityResponse['status'], lastChecked: day.lastChecked, trains: day.trains, cached: true }
    details.set(detailKey(day.date), result)
    if (selected === day.date) { renderDetail(result); refresh.disabled = false; refresh.textContent = '\u21bb Check this date again' }
  } else if (selected === day.date && day.status === 'unavailable') {
    renderDetail({ date: day.date, status: 'unavailable', message: 'Seats could not be confirmed. Check this date again.' }); refresh.disabled = false
  }
}
async function loadMonth() {
  if (!ready) return
  stopMonth()
  const version = monthVersion, route = routeVersion, signal = monthController.signal
  const params = query(); params.set('month', month); params.set('selected', selected); params.set('stream', '1')
  statusText('Loading dates and seat counts...', true); retryMonth.disabled = true
  let completed = false
  const handle = (event: { type?: string; days?: CalendarDay[]; day?: CalendarDay; incomplete?: boolean; message?: string }) => {
    if (version !== monthVersion || route !== routeVersion || signal.aborted) return
    for (const day of event.days || []) applyDay(day)
    if (event.day) applyDay(event.day)
    renderCalendar()
    const checked = monthDates(month).filter(date => days.get(date)?.lastChecked).length
    snapshots.set(activeRouteKey, new Map(days))
    if (event.type === 'done' || !event.type) {
      completed = true
      statusText(event.message || (event.incomplete ? checked + ' dates checked. Select an unknown date to retry.' : checked + ' dates checked. Results cached for up to 2 minutes.'))
      retryMonth.disabled = false
    } else statusText(checked ? checked + ' dates checked. More seats appearing as checks finish...' : 'Checking your selected date first...', true)
  }
  try {
    const response = await fetch('/api/sgr/month?' + params, { signal: AbortSignal.any([signal, AbortSignal.timeout(120_000)]), headers: { Accept: 'application/x-ndjson' } })
    if (!response.ok) { const error = await response.json(); throw new Error(error.message || 'Dates are unavailable. Please retry.') }
    if (!response.headers.get('content-type')?.includes('application/x-ndjson')) {
      handle(await response.json())
    } else {
      const reader = response.body!.getReader(), decoder = new TextDecoder()
      let buffer = ''
      try {
        while (true) {
          const { done, value } = await reader.read()
          buffer += decoder.decode(value, { stream: !done })
          let newline: number
          while ((newline = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1)
            if (line.trim()) handle(JSON.parse(line))
          }
          if (done) break
        }
        if (buffer.trim()) handle(JSON.parse(buffer))
      } finally { reader.releaseLock() }
      if (!completed && !signal.aborted) throw new Error('The connection stopped before all dates loaded. Update dates to continue.')
    }
  } catch (error) {
    if (signal.aborted || version !== monthVersion || route !== routeVersion) return
    statusText(error instanceof Error && error.name !== 'TimeoutError' ? error.message : 'Some dates took too long. Select a date to retry.'); retryMonth.disabled = false
  }
}
function activateRoute() {
  ready = true; activeRouteKey = query().toString()
  for (const day of snapshots.get(activeRouteKey)?.values() || []) {
    if (day.lastChecked && Date.now() - Date.parse(day.lastChecked) < 120_000) days.set(day.date, day)
  }
  if (outside(selected)) selected = earliest
  if (selected.slice(0, 7) !== month) selected = monthDates(month).find(date => !outside(date)) || earliest
  $('directory-status').textContent = 'Kenya Railways routes. All times are East Africa Time.'
  $('retry-directory').hidden = true; $<HTMLButtonElement>('swap-route').disabled = false
  renderCalendar()
  const cached = details.get(detailKey(selected))
  renderDetail(cached?.lastChecked && Date.now() - Date.parse(cached.lastChecked) < 120_000 ? cached : undefined)
  refresh.disabled = false
  void loadMonth()
}
async function directoryFor(type: string): Promise<Directory> {
  const cached = directories.get(type)
  if (cached && cached.expires > Date.now()) return cached.value
  if (directoryRequests.has(type)) return directoryRequests.get(type)!
  const load = request<Directory>('/api/sgr/stations?service=' + type, AbortSignal.timeout(30_000)).then(value => {
    directories.set(type, { value, expires: Date.now() + 300_000 }); return value
  })
  directoryRequests.set(type, load)
  try { return await load } finally { directoryRequests.delete(type) }
}
async function loadDestinations(preferred = 'Mombasa Terminus') {
  const version = routeVersion, signal = routeController.signal
  placeholder(destination, 'Loading destinations…')
  try {
    const params = new URLSearchParams({ origin: origin.value, service })
    const response = await request<{ destinations: Station[] }>(`/api/sgr/destinations?${params}`, signal)
    if (version !== routeVersion || signal.aborted) return
    if (!response.destinations.length) throw new Error('No destinations are available for this service.')
    options(destination, response.destinations, preferred); activateRoute()
  } catch (error) {
    if (signal.aborted || version !== routeVersion) return
    placeholder(destination, 'Unavailable'); directoryFailure(error)
  }
}
function directoryFailure(error: unknown) {
  $('directory-status').textContent = error instanceof Error && error.name !== 'TimeoutError' ? error.message : 'The connection took too long. Please try again.'
  $('retry-directory').hidden = false; statusText('The station list could not be loaded. Retry above or use Kenya Railways.')
}
async function loadDirectory() {
  resetRoute(); earliest = today; latest = null
  const version = routeVersion, signal = routeController.signal
  $('departure-field').hidden = service !== 'express'; $('service-description').textContent = descriptions[service]
  document.querySelectorAll<HTMLButtonElement>('[data-service]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.service === service)))
  $('directory-status').textContent = 'Connecting to Kenya Railways…'; $('retry-directory').hidden = true
  placeholder(origin, 'Loading stations…'); placeholder(destination, 'Loading stations…')
  try {
    const response = await directoryFor(service)
    if (version !== routeVersion || signal.aborted) return
    if (!response.stations.length) throw new Error('Station information is temporarily unavailable.')
    earliest = response.window.earliest || today; latest = response.window.latest
    options(origin, response.stations, response.origin || 'Nairobi Terminus')
    if (response.origin === origin.value && response.destinations?.length) { options(destination, response.destinations, 'Mombasa Terminus'); activateRoute() }
    else await loadDestinations()
  } catch (error) {
    if (signal.aborted || version !== routeVersion) return
    placeholder(origin, 'Unavailable'); placeholder(destination, 'Unavailable'); directoryFailure(error)
  }
}
function changeMonth(offset: number) {
  const date = new Date(`${month}-01T00:00:00Z`); date.setUTCMonth(date.getUTCMonth() + offset); month = date.toISOString().slice(0, 7)
  renderCalendar(); void loadMonth()
}
document.querySelectorAll<HTMLButtonElement>('[data-service]').forEach(button => button.addEventListener('click', () => { if (service === button.dataset.service) return; service = button.dataset.service!; void loadDirectory() }))
origin.addEventListener('change', () => { resetRoute(); void loadDestinations() })
destination.addEventListener('change', () => { resetRoute(); activateRoute() })
departure.addEventListener('change', () => { if (!ready) return; resetRoute(); activateRoute() })
$('swap-route').addEventListener('click', () => { if (!ready) return; const old = origin.value, next = destination.value; resetRoute(); origin.value = next; void loadDestinations(old) })
$('previous-month').addEventListener('click', () => changeMonth(-1)); $('next-month').addEventListener('click', () => changeMonth(1))
$('this-month').addEventListener('click', () => { month = today.slice(0, 7); renderCalendar(); void loadMonth() })
$('retry-directory').addEventListener('click', () => { void loadDirectory() })
retryMonth.addEventListener('click', () => { void loadMonth() }); refresh.addEventListener('click', () => { void loadDetail(true) })
document.addEventListener('visibilitychange', () => { if (document.hidden) stopMonth(); else if (ready) void loadMonth() })
window.addEventListener('pagehide', () => { stopMonth(); detailController.abort(); routeController.abort() })
classFilter.addEventListener('change', () => { renderCalendar(); const result = details.get(detailKey(selected)); if (result) renderDetail(result) })
document.querySelectorAll<HTMLButtonElement>('[data-service]').forEach(button => {
  button.addEventListener('pointerenter', () => { void directoryFor(button.dataset.service!).catch(() => {}) })
  button.addEventListener('focus', () => { void directoryFor(button.dataset.service!).catch(() => {}) })
})
renderCalendar(); void loadDirectory()
