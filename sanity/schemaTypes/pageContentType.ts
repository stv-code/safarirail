import { defineType, defineField } from 'sanity'

export const pageContentType = defineType({
  name: 'pageContent',
  title: 'Page Content',
  type: 'document',
  fields: [
    // Hero
    defineField({
      name: 'heroEyebrow',
      title: 'Hero — Eyebrow Text',
      type: 'string',
      description: 'Small text above the headline e.g. "Madaraka Express · Nairobi ↔ Mombasa"',
      initialValue: 'Madaraka Express · Nairobi ↔ Mombasa',
    }),
    defineField({
      name: 'heroHeadline',
      title: 'Hero — Headline',
      type: 'string',
      description: 'Main headline. Use * around a word to italicise it e.g. "Experience Kenya *by Rail*"',
      initialValue: 'Experience Kenya *by Rail*',
    }),
    defineField({
      name: 'heroSubtext',
      title: 'Hero — Subtext',
      type: 'text',
      rows: 2,
      initialValue: "The hassle-free way for tourists to book SGR tickets. No M-Pesa? No Kenyan bank account? No problem.",
    }),
    defineField({
      name: 'heroCaveat',
      title: 'Hero — Caveat (small print)',
      type: 'string',
      initialValue: "Not comfortable with third parties? We encourage you to book directly at the station.",
    }),

    // Info strip
    defineField({
      name: 'infoStrip',
      title: 'Info Strip Items',
      type: 'array',
      description: 'The three notice items below the hero',
      of: [{ type: 'string' }],
      initialValue: [
        '⚠️ Third-party booking agency — not affiliated with Kenya Railways Corporation',
        '🎫 Tickets delivered via Email, WhatsApp or Telegram',
        '🌍 PayPal · Wise · Crypto accepted',
      ],
    }),

    // Pricing section
    defineField({
      name: 'pricingTitle',
      title: 'Pricing — Section Title',
      type: 'string',
      initialValue: 'Choose Your Journey',
    }),
    defineField({
      name: 'pricingSubtext',
      title: 'Pricing — Subtext',
      type: 'text',
      rows: 2,
      initialValue: 'All prices include our booking assistance fee. Select the class that suits your travel style.',
    }),

    // Economy class
    defineField({
      name: 'economyFeatures',
      title: 'Economy — Feature List',
      type: 'array',
      of: [{ type: 'string' }],
      initialValue: [
        'Standard comfortable seating',
        'Air conditioning throughout',
        'Luggage storage space',
        'Traveller booking support',
      ],
    }),

    // First class
    defineField({
      name: 'firstClassFeatures',
      title: 'First Class — Feature List',
      type: 'array',
      of: [{ type: 'string' }],
      initialValue: [
        'Reclining spacious seats',
        'Premium lounge access',
        'Tray tables & power outlets',
        'Priority boarding',
      ],
    }),

    // Premium
    defineField({
      name: 'premiumFeatures',
      title: 'Premium — Feature List',
      type: 'array',
      of: [{ type: 'string' }],
      initialValue: [
        'Private luxury compartment',
        'Complimentary meals & drinks',
        'Personal concierge service',
        'Best views through Tsavo',
      ],
    }),

    // Footer
    defineField({
      name: 'footerDisclaimer',
      title: 'Footer Disclaimer',
      type: 'text',
      rows: 3,
      initialValue: 'SafariRail is an independent third-party booking agency. Not affiliated with, endorsed by, or representing Kenya Railways Corporation (KRC).',
    }),

    // Fraud alert
    defineField({
      name: 'fraudAlert',
      title: 'Fraud Alert Text',
      type: 'text',
      rows: 2,
      initialValue: 'If you suspect fraudulent activity in our name, contact DCI Kenya, call 911, or visit the nearest police station immediately.',
    }),
  ],
  preview: {
    prepare() {
      return { title: 'Page Content' }
    },
  },
})
