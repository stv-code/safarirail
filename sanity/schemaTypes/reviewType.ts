import { defineType, defineField } from 'sanity'

export const reviewType = defineType({
  name: 'review',
  title: 'Reviews',
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      title: 'Traveller Name & Country',
      type: 'string',
      description: 'e.g. James W., France',
      validation: Rule => Rule.required().min(3).max(80),
    }),
    defineField({
      name: 'rating',
      title: 'Star Rating',
      type: 'number',
      options: {
        list: [
          { title: '5 stars', value: 5 },
          { title: '4 stars', value: 4 },
          { title: '3 stars', value: 3 },
        ],
      },
      validation: Rule => Rule.required().integer().min(3).max(5),
    }),
    defineField({
      name: 'title',
      title: 'Review Title',
      type: 'string',
      validation: Rule => Rule.required().min(4).max(90),
    }),
    defineField({
      name: 'body',
      title: 'Review Body',
      type: 'text',
      rows: 4,
      validation: Rule => Rule.required().min(20).max(1200),
    }),
    defineField({
      name: 'approved',
      title: 'Approved (visible on site)',
      type: 'boolean',
      initialValue: false,
      validation: Rule => Rule.required(),
    }),
    defineField({
      name: 'publishedAt',
      title: 'Date',
      type: 'datetime',
      initialValue: () => new Date().toISOString(),
      validation: Rule => Rule.required(),
    }),
  ],
  preview: {
    select: { title: 'title', subtitle: 'name', approved: 'approved' },
    prepare({ title, subtitle, approved }) {
      return { title, subtitle: `${subtitle} - ${approved ? 'approved' : 'pending'}` }
    },
  },
  orderings: [
    { title: 'Newest First', name: 'publishedAtDesc', by: [{ field: 'publishedAt', direction: 'desc' }] },
  ],
})
