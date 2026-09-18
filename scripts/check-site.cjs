// Run after npm run build. Tests only local files and mocked API responses.
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const http = require('node:http')
const { chromium } = require('playwright')
const root = path.resolve(__dirname, '../dist')
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.xml': 'application/xml' }
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
    let file = path.resolve(root, '.' + pathname)
    if (file !== root && !file.startsWith(root + path.sep)) throw new Error('Invalid path')
    if ((await fs.stat(file)).isDirectory()) file = path.join(file, 'index.html')
    res.setHeader('Content-Type', types[path.extname(file)] || 'text/plain')
    res.end(await fs.readFile(file))
  } catch { res.writeHead(404); res.end('Not found') }
})

async function main() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  let browser
  try {
    browser = await chromium.launch({ headless: true, channel: 'chromium' })
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/_vercel/insights/**', route => route.fulfill({ contentType: 'text/javascript', body: '' }))
    await page.route('**/api/reviews', route => route.fulfill({ json: { reviews: [] } }))
    let booking
    await page.route('**/api/bookings', route => {
      booking = route.request().postDataJSON()
      return route.fulfill({ json: { bookingReference: 'TEST-LOCAL-ONLY' } })
    })
    await page.goto(base, { waitUntil: 'networkidle' })
    assert.equal(await page.locator('.passenger-entry').count(), 1, 'Passenger form must initialize')
    assert.equal(await page.locator('script[src*="insights"]').count(), 1, 'Analytics must load once')
    assert.equal(await page.locator('#disclaimer-modal').count(), 0)
    const redacted = await page.evaluate(() => window.webAnalyticsBeforeSend({ type: 'pageview', url: location.origin + '/booking-request-received?reference=private#private' }).url)
    assert.equal(redacted, base + '/booking-request-received')
    await page.getByRole('button', { name: 'Choose First Class' }).click()
    assert.equal(await page.locator('#class').inputValue(), 'First Class')
    await page.locator('#adults').selectOption('2')
    assert.equal(await page.locator('.passenger-entry').count(), 2)
    assert.match(await page.locator('#booking-total').innerText(), /11,000/)
    await page.locator('#passenger-1-name').fill('Test Traveller')
    await page.locator('#children').selectOption('1')
    assert.equal(await page.locator('#passenger-1-name').inputValue(), 'Test Traveller', 'Passenger details survive count changes')
    assert.match(await page.locator('#booking-total').innerText(), /14,250/)
    await fs.mkdir(path.resolve(__dirname, '../.artifacts'), { recursive: true })
    // Scroll to load the lazy images before capturing the whole page.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 700) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 50)) }
      window.scrollTo(0, 0)
    })
    await page.screenshot({ path: '.artifacts/home-desktop.png', fullPage: true })

    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `No horizontal overflow at ${width}px`)
    }
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(base, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Menu', exact: true }).click()
    assert.equal(await page.locator('.nav-toggle').getAttribute('aria-expanded'), 'true')
    await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: 'Classes' }).click()
    assert.equal(await page.locator('.nav-toggle').getAttribute('aria-expanded'), 'false')
    const travelDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    await page.locator('#date').fill(travelDate)
    await page.locator('#booking-next').click()
    assert.equal(await page.locator('[data-step="1"]').getAttribute('data-active'), 'true')
    await page.locator('#passenger-1-name').fill('Test Traveller')
    await page.locator('#passenger-1-passport').fill('TEST12345')
    await page.locator('#passenger-1-gender').selectOption('Female')
    await page.locator('#passenger-1-country').selectOption('GB')
    await page.locator('#booking-next').click()
    await page.locator('#email').fill('test@example.com')
    await page.locator('#privacy-consent').check()
    await page.locator('#booking-next').click()
    await page.getByRole('button', { name: 'Submit Booking Request', exact: true }).click()
    await page.waitForURL('**/booking-request-received?reference=TEST-LOCAL-ONLY')
    assert.equal(booking.passengers.length, 1)
    assert.equal(booking.passengers[0].countryCode, 'GB')
    assert.equal(booking.consent, true)

    const sitemap = await fs.readFile(path.join(root, 'sitemap-0.xml'), 'utf8')
    assert.doesNotMatch(sitemap, /booking-confirmed|booking-request-received|404/)
    const locations = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1])
    assert.equal(locations.length, 6)
    for (const url of locations) {
      assert.equal(new URL(url).hostname, 'www.safarirail.co.ke')
      const pathname = new URL(url).pathname
      const response = await page.goto(base + pathname, { waitUntil: 'networkidle' })
      assert.equal(response.status(), 200)
      assert.equal(await page.locator('h1').count(), 1)
      assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), 'https://www.safarirail.co.ke' + pathname)
      assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'index, follow')
      assert.ok((await page.locator('meta[name="description"]').getAttribute('content')).length > 40)
      for (const data of await page.locator('script[type="application/ld+json"]').allTextContents()) JSON.parse(data)
      const ids = await page.locator('[id]').evaluateAll(elements => elements.map(element => element.id))
      assert.equal(ids.length, new Set(ids).size, `Unique IDs: ${pathname}`)
      const links = await page.locator('a[href^="/"]').evaluateAll(elements => elements.map(element => element.getAttribute('href')))
      for (const href of new Set(links)) {
        const target = new URL(href, base)
        const response = await fetch(target)
        assert.equal(response.status, 200, `Internal link ${href}`)
        if (target.hash) assert.ok((await response.text()).includes(`id="${target.hash.slice(1)}"`), `Anchor ${href}`)
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Mobile overflow: ${pathname}`)
    }
    for (const route of ['/booking-confirmed', '/booking-request-received', '/404.html']) {
      await page.goto(base + route)
      assert.match(await page.locator('meta[name="robots"]').getAttribute('content'), /noindex/)
    }
    await page.goto(base)
    await page.screenshot({ path: '.artifacts/home-mobile.png', fullPage: true })
    assert.deepEqual(errors, [], 'No browser runtime errors')
    console.log('PASS: desktop/mobile layout, navigation, passenger controls, mocked booking submission, analytics initialization/redaction, canonical URLs, sitemap, structured data and internal links.')
  } finally {
    if (browser) await browser.close()
    server.close()
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
