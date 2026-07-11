import { defineConfig } from 'astro/config'
import sitemap from '@astrojs/sitemap'

export default defineConfig({
  site: 'https://safarirail.co.ke',
  integrations: [
    sitemap({
      filter: (page) => !page.endsWith('/booking-request-received/') && !page.endsWith('/booking-confirmed/'),
    }),
  ],
})

