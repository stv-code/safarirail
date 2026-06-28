// seed-sanity.mjs
// Run with: node seed-sanity.mjs
// Requires: SANITY_PROJECT_ID and SANITY_TOKEN in your environment
// Get a token from sanity.io/manage → your project → API → Tokens → Add Editor token

import { createClient } from '@sanity/client'

const client = createClient({
  projectId: process.env.SANITY_PROJECT_ID,
  dataset: process.env.SANITY_DATASET || 'production',
  apiVersion: '2024-01-01',
  token: process.env.SANITY_TOKEN,
  useCdn: false,
})

const faqs = [
  {
    _type: 'faq',
    question: 'Are you the official SGR website?',
    answer: 'No. We are a private third-party agency helping tourists book tickets. We are NOT selling tickets — we assist you in booking them. The official website is metickets.krc.co.ke.',
    order: 1,
  },
  {
    _type: 'faq',
    question: 'How do I receive my ticket?',
    answer: 'After booking, we send the M-Pesa message and ticket number to your email, WhatsApp, or Telegram. You MUST use this message to physically print your ticket at the station before boarding.',
    order: 2,
  },
  {
    _type: 'faq',
    question: 'What payment methods do you accept?',
    answer: 'We accept PayPal, Wise, Remitly, Sendwave, and Western Union (all remitted to M-Pesa), as well as USDT, BTC, and BNB crypto. Contact us via WhatsApp for crypto wallet addresses.',
    order: 3,
  },
  {
    _type: 'faq',
    question: 'What if there are payment delays?',
    answer: 'The user is fully responsible for any delays during money transfer (e.g. Wise/Remitly processing times). We can only book the ticket once funds are received.',
    order: 4,
  },
  {
    _type: 'faq',
    question: 'What is your refund and cancellation policy?',
    answer: 'We do not handle refunds. Cancellation is strictly handled by Kenya Railways in person at the station. View the official policy at metickets.krc.co.ke/faqs.php.',
    order: 5,
  },
  {
    _type: 'faq',
    question: 'Do children travel for free?',
    answer: 'Children under 3 years travel free. Children aged 3–11 pay a reduced child fare. Our pricing table shows the exact breakdown per class including the service fee.',
    order: 6,
  },
]

const reviews = [
  {
    _type: 'review',
    name: 'Sarah J., UK',
    rating: 5,
    title: 'Lifesaver for tourists!',
    body: 'I tried booking on the official site but could not use my Visa card. Steve helped me get the tickets via PayPal within an hour. Highly recommend!',
    approved: true,
    publishedAt: new Date().toISOString(),
  },
  {
    _type: 'review',
    name: 'Michael T., Germany',
    rating: 5,
    title: 'Smooth process',
    body: 'Sent funds via Wise and got my M-Pesa ticket message shortly after. Printed it at the station with no issues. The Nairobi to Mombasa journey was stunning.',
    approved: true,
    publishedAt: new Date().toISOString(),
  },
]

async function seed() {
  if (!process.env.SANITY_PROJECT_ID) {
    console.error('❌ Missing SANITY_PROJECT_ID. Set it in your environment.')
    process.exit(1)
  }
  if (!process.env.SANITY_TOKEN) {
    console.error('❌ Missing SANITY_TOKEN. Get one from sanity.io/manage → API → Tokens (Editor role).')
    process.exit(1)
  }

  console.log('🌱 Seeding SafariRail Sanity dataset...\n')

  // Check for existing documents to avoid duplicates
  const existingFaqs = await client.fetch(`count(*[_type == "faq"])`)
  const existingReviews = await client.fetch(`count(*[_type == "review"])`)

  if (existingFaqs > 0) {
    console.log(`⚠️  Skipping FAQs — ${existingFaqs} already exist. Delete them in the Studio first if you want to reseed.`)
  } else {
    for (const faq of faqs) {
      await client.create(faq)
      console.log(`✓ FAQ: ${faq.question.slice(0, 50)}...`)
    }
    console.log(`\n✅ Created ${faqs.length} FAQs`)
  }

  if (existingReviews > 0) {
    console.log(`⚠️  Skipping reviews — ${existingReviews} already exist.`)
  } else {
    for (const review of reviews) {
      await client.create(review)
      console.log(`✓ Review: ${review.title} — ${review.name}`)
    }
    console.log(`\n✅ Created ${reviews.length} reviews`)
  }

  console.log('\n🎉 Done! Open your Studio at safarirail.co.ke/studio to edit everything.')
}

seed().catch(err => {
  console.error('Seed failed:', err.message)
  process.exit(1)
})
