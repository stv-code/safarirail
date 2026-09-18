# Site refresh and measurement

The prior Astro layout did not load Vercel Web Analytics. Zero recorded visitors therefore does not establish that nobody visited. The booking form also used TypeScript inside an unprocessed `define:vars` script, producing a browser syntax error. The form now uses a bundled script.

## Verify locally

```sh
npm ci
npx playwright install chromium
npm run check
npm test
npm run build
npm run test:site
```

The browser check serves the production build locally and mocks the booking/review APIs and analytics script. It checks mobile booking submission without creating a real booking, passenger changes, navigation, runtime errors, metadata, internal links and sitemap exclusions. It writes screenshots to `.artifacts/`. It does not prove that Vercel has received an event or that production API credentials work.

## After deploying to the existing Vercel project

1. Keep `https://www.safarirail.co.ke` as the primary production domain. The live site already redirected the non-www domain to it; metadata and the sitemap now agree with that destination.
2. Confirm Web Analytics is enabled for the **safarirail** project. Visit production in a browser without an ad blocker, navigate between pages, and check the Network panel for the analytics script and a successful pageview request. Check the production date/environment filters in Vercel Analytics. The package is installed in the shared Astro layout; no historical visits can be recovered by installing it.
3. Submit `https://www.safarirail.co.ke/sitemap-index.xml` in Google Search Console. Inspect the homepage, `/reviews` and each `/guides/…` page and request indexing if needed. Search Console access/verification is separate from this repository and cannot be established by adding a sitemap alone.
4. Confirm the deployed booking form renders passenger fields and that the existing production API returns the intended WhatsApp handoff. Do not create test bookings containing real passenger identification.
5. Compare the next complete week of recorded visitors and referrers with later weeks. Use Search Console impressions/clicks to evaluate organic discovery separately from Vercel pageviews.

## Content and privacy

- Business prices, service fees, departure preferences and contact details remain managed in `src/config/business.ts`. The form is a request, not live seat inventory.
- Guides explain the existing service without promising seat availability, exact journey times or search rankings.
- The independent-agency notice remains in the header and footer; the blocking first-visit modal was removed.
- Analytics page URLs have query parameters and fragments removed before sending, so booking references in URLs are not included. Form contents are not sent as custom analytics events.
- Confirmation pages and the custom 404 page use `noindex` and are excluded from the sitemap.

References: [Vercel Analytics setup](https://vercel.com/docs/analytics/quickstart), [Vercel data redaction](https://vercel.com/docs/analytics/redacting-sensitive-data), [Google canonical guidance](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls).
