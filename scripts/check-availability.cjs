// Built-page verification with deterministic API fixtures; never creates bookings.
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const http = require('node:http')
const { chromium } = require('playwright')
const root = path.resolve(__dirname, '../dist')
const server = http.createServer(async (req, res) => {
  try {
    let file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname)
    if (!file.startsWith(root + path.sep)) throw Error('Invalid path')
    if ((await fs.stat(file)).isDirectory()) file = path.join(file, 'index.html')
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.webp': 'image/webp' })[path.extname(file)] || 'application/octet-stream')
    res.end(await fs.readFile(file))
  } catch { res.writeHead(404); res.end() }
})
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const after = n => new Date(Date.parse(today + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10)
const train = { trainNumber: 'E1', departure: '15:00', arrival: '20:30', economyAvailable: 182, firstClassAvailable: 36, economyFare: 1500, firstClassFare: 4500 }
async function main() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const browser = await chromium.launch({ headless: true, channel: 'chromium' })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } })
    const errors = []; page.on('pageerror', error => errors.push(error.message))
    let failDirectory = false, failDetail = false
    await page.route('**/*', route => {
      const url = new URL(route.request().url())
      if (url.hostname !== '127.0.0.1') return route.abort()
      return route.continue()
    })
    await page.route('**/api/sgr/stations*', route => failDirectory ? route.fulfill({ status: 503, json: { message: 'Station information is temporarily unavailable.' } }) : route.fulfill({ json: { stations: [{ id: '2', name: 'Nairobi Terminus' }, { id: '3', name: 'Mombasa Terminus' }], window: { earliest: today, latest: after(60) } } }))
    await page.route('**/api/sgr/destinations*', route => {
      const origin = new URL(route.request().url()).searchParams.get('origin')
      return route.fulfill({ json: { destinations: [origin === '2' ? { id: '3', name: 'Mombasa Terminus' } : { id: '2', name: 'Nairobi Terminus' }] } })
    })
    await page.route('**/api/sgr/month*', route => {
      const month = new URL(route.request().url()).searchParams.get('month')
      const [y, m] = month.split('-').map(Number)
      const days = Array.from({ length: new Date(Date.UTC(y, m, 0)).getUTCDate() }, (_, n) => {
        const date = `${month}-${String(n + 1).padStart(2, '0')}`
        const status = date < today || date > after(60) ? 'outside-window' : n % 7 === 0 && date !== today ? 'sold-out' : n % 11 === 0 ? 'unavailable' : 'available'
        return { date, status, seats: status === 'available' ? (n % 5 === 0 ? 24 : 218 + n * 3) : 0, lastChecked: status === 'available' || status === 'sold-out' ? new Date().toISOString() : null }
      })
      return route.fulfill({ json: { days, loading: false, incomplete: true } })
    })
    await page.route('**/api/sgr/availability*', async route => {
      const params = new URL(route.request().url()).searchParams, date = params.get('date')
      if (date === after(1)) await new Promise(resolve => setTimeout(resolve, 500))
      if (failDetail) return route.fulfill({ status: 503, json: { status: 'unavailable', message: 'The source could not confirm availability.' } }).catch(() => {})
      return route.fulfill({ json: { date, status: 'available', lastChecked: new Date().toISOString(), trains: [{ ...train, trainNumber: date === after(1) ? 'OLD' : 'E1' }] } }).catch(() => {})
    })
    const url = `http://127.0.0.1:${server.address().port}/sgr/availability/`
    await page.goto(url)
    await page.waitForSelector('.train-result')
    await page.waitForFunction(() => document.getElementById('month-status').textContent.includes('dates checked'))
    assert.equal(await page.locator('[data-service=express]').getAttribute('aria-pressed'), 'true')
    assert.ok(await page.locator('.state-available').count())
    await fs.mkdir('.artifacts', { recursive: true })
    await page.screenshot({ path: '.artifacts/availability-desktop.png', fullPage: true })
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 })
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `No horizontal overflow at ${width}px`)
    }
    await page.setViewportSize({ width: 390, height: 844 })
    await page.screenshot({ path: '.artifacts/availability-mobile.png', fullPage: true })
    // A slow earlier selection must never replace the newer date's details.
    if (after(2).slice(0, 7) !== today.slice(0, 7)) await page.locator('#next-month').click()
    await page.locator(`[data-date="${after(1)}"]`).click()
    await page.locator(`[data-date="${after(2)}"]`).click()
    await page.waitForFunction(() => document.querySelector('.train-result h3')?.textContent === 'TRAIN E1')
    await page.waitForTimeout(600)
    assert.equal(await page.locator('.train-result h3').innerText(), 'TRAIN E1')
    assert.equal(await page.locator(`[data-date="${after(2)}"]`).getAttribute('aria-pressed'), 'true')
    // Changing service resets the previous result and keeps route selection working.
    await page.locator('[data-service=inter_county]').click()
    await page.waitForSelector('.train-result')
    assert.equal(await page.locator('#departure-field').isVisible(), false)
    await page.locator('#swap-route').click()
    await page.waitForFunction(() => document.getElementById('destination').value === '2')
    assert.equal(await page.locator('#origin').inputValue(), '3')
    // Errors clear old train data and never create a sold-out result.
    failDetail = true
    await page.waitForFunction(() => !document.getElementById('refresh').disabled)
    await page.locator('#refresh').click()
    await page.waitForFunction(() => document.getElementById('results-message').textContent.includes('could not confirm'))
    assert.equal(await page.locator('.train-result').count(), 0)
    assert.ok(await page.locator('.is-selected').getAttribute('class').then(c => c.includes('unavailable')))
    failDirectory = true
    await page.locator('[data-service=phase2]').click()
    await page.waitForSelector('#retry-directory:not([hidden])')
    failDirectory = false; failDetail = false
    await page.locator('#retry-directory').click()
    await page.waitForSelector('.train-result')
    assert.deepEqual(errors, [])
    console.log('Calendar browser checks passed: responsive layout, month results, date race, service change, swap, failure and recovery.')
  } finally { await browser.close(); server.close() }
}
main().catch(error => { console.error(error); server.close(); process.exitCode = 1 })
