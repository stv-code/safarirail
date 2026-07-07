import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'
import { presentationTool } from 'sanity/presentation'
import { visionTool } from '@sanity/vision'
import { schemaTypes } from './sanity/schemaTypes'
import { dataset, projectId } from './sanity/env'
import { singletonTypes, structure } from './sanity/structure'

const isProduction = process.env.NODE_ENV === 'production'
const productionUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://safarirail.co.ke'
const localUrl = 'http://localhost:3000'

export default defineConfig({
  name: 'safarirail',
  title: 'SafariRail CMS',
  projectId,
  dataset,
  plugins: [
    structureTool({ structure }),
    presentationTool({
      previewUrl: {
        initial: isProduction ? productionUrl : localUrl,
        previewMode: {
          enable: '/api/draft-mode/enable',
        },
      },
      resolve: {
        mainDocuments: [
          {
            route: '/',
            filter: '_id == "pageContent" || _id == "siteSettings"',
          },
        ],
        locations: {
          pageContent: {
            locations: [{ title: 'Home', href: '/' }],
          },
          siteSettings: {
            locations: [{ title: 'Home', href: '/' }],
          },
          faq: {
            locations: [{ title: 'FAQ', href: '/#faq' }],
          },
          review: {
            locations: [{ title: 'Reviews', href: '/reviews' }],
          },
        },
      },
    }),
    ...(!isProduction ? [visionTool()] : []),
  ],
  schema: {
    types: schemaTypes,
    templates: (templates) => templates.filter(({ schemaType }) => !singletonTypes.has(schemaType)),
  },
  document: {
    actions: (previous, context) =>
      singletonTypes.has(context.schemaType)
        ? previous.filter(({ action }) => action !== 'duplicate')
        : previous,
  },
  basePath: '/studio',
})
