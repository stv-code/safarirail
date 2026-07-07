import { revalidateTag } from 'next/cache'
import { type NextRequest, NextResponse } from 'next/server'
import { parseBody } from 'next-sanity/webhook'

type WebhookPayload = {
  _type?: string
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.SANITY_REVALIDATE_SECRET) {
      return new Response('Missing SANITY_REVALIDATE_SECRET', { status: 500 })
    }

    const { body, isValidSignature } = await parseBody<WebhookPayload>(
      request,
      process.env.SANITY_REVALIDATE_SECRET
    )

    if (!isValidSignature) {
      return new Response('Invalid signature', { status: 401 })
    }

    const tags = Array.from(new Set(['sanity', body?._type].filter(Boolean))) as string[]

    for (const tag of tags) {
      revalidateTag(tag)
    }

    return NextResponse.json({ revalidated: tags })
  } catch (error) {
    console.error('Failed to revalidate Sanity content', error)
    return new Response('Failed to revalidate Sanity content', { status: 500 })
  }
}

