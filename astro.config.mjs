import { defineConfig } from 'astro/config'
import sitemap from '@astrojs/sitemap'

export default defineConfig({
  site: 'https://www.safarirail.co.ke',
  trailingSlash: 'never',
  integrations: [
    sitemap({
      filter: (page) => !/\/(booking-request-received|booking-confirmed|404)\/?$/.test(page),
    }),
  ],
})
