// seed-sanity.mjs
// Run with: node seed-sanity.mjs

import { createClient } from '@sanity/client'

const client = createClient({
  projectId: process.env.SANITY_PROJECT_ID,
  dataset: process.env.SANITY_DATASET || 'production',
  apiVersion: '2024-01-01',
  token: process.env.SANITY_TOKEN,
  useCdn: false,
})

const faqs = [
  { _type: 'faq', question: 'Are you the official SGR website?', answer: 'No. We are a private third-party agency helping tourists book tickets. We are NOT selling tickets — we assist you in booking them. The official website is metickets.krc.co.ke.', order: 1 },
  { _type: 'faq', question: 'How do I receive my ticket?', answer: 'After booking, we send the M-Pesa message and ticket number to your email, WhatsApp, or Telegram. You MUST use this message to physically print your ticket at the station before boarding.', order: 2 },
  { _type: 'faq', question: 'What payment methods do you accept?', answer: 'We accept PayPal, Wise, Remitly, Sendwave, and Western Union (all remitted to M-Pesa), as well as USDT, BTC, and BNB crypto. Contact us via WhatsApp for crypto wallet addresses.', order: 3 },
  { _type: 'faq', question: 'What if there are payment delays?', answer: 'The user is fully responsible for any delays during money transfer (e.g. Wise/Remitly processing times). We can only book the ticket once funds are received.', order: 4 },
  { _type: 'faq', question: 'What is your refund and cancellation policy?', answer: 'We do not handle refunds. Cancellation is strictly handled by Kenya Railways in person at the station. View the official policy at metickets.krc.co.ke/faqs.php.', order: 5 },
  { _type: 'faq', question: 'Do children travel for free?', answer: 'Children under 3 years travel free. Children aged 3-11 pay a reduced child fare. Our pricing table shows the exact breakdown per class including the service fee.', order: 6 },
]

const reviews = [
  { _type: 'review', name: 'Sarah J., UK', rating: 5, title: 'Lifesaver for tourists!', body: 'I tried booking on the official site but could not use my Visa card. Steve helped me get the tickets via PayPal within an hour. Highly recommend!', approved: true, publishedAt: new Date().toISOString() },
  { _type: 'review', name: 'Michael T., Germany', rating: 5, title: 'Smooth process', body: 'Sent funds via Wise and got my M-Pesa ticket message shortly after. Printed it at the station with no issues. The Nairobi to Mombasa journey was stunning.', approved: true, publishedAt: new Date().toISOString() },
]

const pageContent = {
  _type: 'pageContent',
  heroEyebrow: 'Madaraka Express · Nairobi ↔ Mombasa',
  heroHeadline: 'Experience Kenya *by Rail*',
  heroSubtext: 'The hassle-free way for tourists to book SGR tickets. No M-Pesa? No Kenyan bank account? No problem.',
  heroCaveat: 'Not comfortable with third parties? We encourage you to book directly at the station.',
  infoStrip: [
    'Third-party booking agency — not affiliated with Kenya Railways Corporation',
    'Tickets delivered via Email, WhatsApp or Telegram',
    'PayPal · Wise · Crypto accepted',
  ],
  pricingTitle: 'Choose Your Journey',
  pricingSubtext: 'All prices include our booking assistance fee. Select the class that suits your travel style.',
  economyFeatures: ['Standard comfortable seating', 'Air conditioning throughout', 'Luggage storage space', 'Traveller booking support'],
  firstClassFeatures: ['Reclining spacious seats', 'Premium lounge access', 'Tray tables & power outlets', 'Priority boarding'],
  premiumFeatures: ['Private luxury compartment', 'Complimentary meals & drinks', 'Personal concierge service', 'Best views through Tsavo'],
  fraudAlert: 'If you suspect fraudulent activity in our name, contact DCI Kenya, call 911, or visit the nearest police station immediately.',
  footerDisclaimer: 'SafariRail is an independent third-party booking agency. Not affiliated with, endorsed by, or representing Kenya Railways Corporation (KRC).',
}

async function seed() {
  if (!process.env.SANITY_PROJECT_ID) { console.error('Missing SANITY_PROJECT_ID'); process.exit(1) }
  if (!process.env.SANITY_TOKEN) { console.error('Missing SANITY_TOKEN'); process.exit(1) }

  console.log('🌱 Seeding SafariRail Sanity dataset...\n')

  const [existingFaqs, existingReviews, existingContent] = await Promise.all([
    client.fetch(`count(*[_type == "faq"])`),
    client.fetch(`count(*[_type == "review"])`),
    client.fetch(`count(*[_type == "pageContent"])`),
  ])

  if (existingFaqs > 0) {
    console.log(`⚠️  Skipping FAQs — ${existingFaqs} already exist.`)
  } else {
    for (const faq of faqs) { await client.create(faq); console.log(`✓ FAQ: ${faq.question.slice(0, 50)}...`) }
    console.log(`✅ Created ${faqs.length} FAQs\n`)
  }

  if (existingReviews > 0) {
    console.log(`⚠️  Skipping reviews — ${existingReviews} already exist.`)
  } else {
    for (const r of reviews) { await client.create(r); console.log(`✓ Review: ${r.title}`) }
    console.log(`✅ Created ${reviews.length} reviews\n`)
  }

  if (existingContent > 0) {
    console.log(`⚠️  Skipping page content — already exists. Edit it in the Studio.`)
  } else {
    await client.create(pageContent)
    console.log(`✅ Created page content document\n`)
  }

  console.log('🎉 Done! Open your Studio at safarirail.co.ke/studio to edit everything.')
}

seed().catch(err => { console.error('Seed failed:', err.message); process.exit(1) })
