import type { StructureResolver } from 'sanity/structure'

export const singletonTypes = new Set(['pageContent', 'siteSettings'])

export const structure: StructureResolver = (S) =>
  S.list()
    .title('SafariRail Content')
    .items([
      S.listItem()
        .title('Page Content')
        .schemaType('pageContent')
        .child(S.document().schemaType('pageContent').documentId('pageContent')),
      S.listItem()
        .title('Site Settings & Images')
        .schemaType('siteSettings')
        .child(S.document().schemaType('siteSettings').documentId('siteSettings')),
      S.divider(),
      ...S.documentTypeListItems().filter((item) => {
        const id = item.getId()
        return !id || !singletonTypes.has(id)
      }),
    ])

