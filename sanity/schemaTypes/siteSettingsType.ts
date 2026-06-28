import { defineType, defineField } from 'sanity'

export const siteSettingsType = defineType({
  name: 'siteSettings',
  title: 'Site Settings & Images',
  type: 'document',
  fields: [
    defineField({
      name: 'heroImage',
      title: 'Hero Background Image',
      type: 'image',
      description: 'Appears behind the hero text on the homepage. Best: wide landscape of the Madaraka Express or Tsavo.',
      options: { hotspot: true },
    }),
    defineField({
      name: 'economyImage',
      title: 'Economy Class Image',
      type: 'image',
      description: 'Interior shot of economy class seats.',
      options: { hotspot: true },
    }),
    defineField({
      name: 'firstClassImage',
      title: 'First Class Image',
      type: 'image',
      description: 'Interior shot of first class seats.',
      options: { hotspot: true },
    }),
    defineField({
      name: 'premiumImage',
      title: 'Premium Class Image',
      type: 'image',
      description: 'Interior shot of the premium cabin.',
      options: { hotspot: true },
    }),
    defineField({
      name: 'aboutImage',
      title: 'About / Journey Image',
      type: 'image',
      description: 'Optional scenic photo (e.g. Tsavo, Mombasa coast) used in the about strip.',
      options: { hotspot: true },
    }),
    defineField({
      name: 'whatsappNumber',
      title: 'WhatsApp Number',
      type: 'string',
      description: 'With country code, no spaces. e.g. 254769869503',
      initialValue: '254769869503',
    }),
    defineField({
      name: 'email',
      title: 'Booking Email',
      type: 'string',
      initialValue: 'safarirailbookings@gmail.com',
    }),
  ],
  preview: {
    prepare() {
      return { title: 'Site Settings & Images' }
    },
  },
})
