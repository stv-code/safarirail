# Review Moderation

Public review submissions are saved to Supabase with `status = 'pending'`. The public reviews API returns only rows where `status = 'approved'`.

Public/frontend Supabase clients must never query `public.reviews` directly. The frontend must use `/api/reviews`, which filters to approved reviews and keeps the service role key server-side.

Reviews may include an optional private `booking_reference`. During submission the API checks that reference against `public.bookings.reference`; public responses expose only `verifiedBooking: true/false`, never the reference itself.

Required environment variable:

```sh
REVIEWS_ADMIN_TOKEN=replace-with-random-admin-token
```

Use a high-entropy token. Do not expose it in frontend code.

## Make Reviews Believable

Use real customer submissions only. Do not invent names, routes, or ratings.

Approve reviews that are specific enough to help another traveller: route, timing, communication, payment clarity, ticket delivery, or support experience.

Do not approve reviews that include private identity details, passport or ID numbers, phone numbers, slurs, spam, links, competitor attacks, or claims you cannot reasonably stand behind.

Keep a natural mix. If every review is five stars and generic, the page will look less credible than a smaller set of detailed reviews with varied wording.

Prefer reviews with `verified_booking = true` when available. Unverified reviews may still be approved if they are plausible and useful, but they display as moderated rather than verified.

## Approve a Review

```sh
curl -X POST https://safarirail.co.ke/api/reviews/admin \
  -H "Authorization: Bearer $REVIEWS_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"id\":\"REVIEW_UUID\",\"status\":\"approved\"}"
```

Approving a review sets `status = 'approved'` and stores `approved_at`.
It also writes a `review_moderation_events` audit row with the previous status, new status, moderation action, timestamp, and non-secret actor label.

## Reject a Review

```sh
curl -X POST https://safarirail.co.ke/api/reviews/admin \
  -H "Authorization: Bearer $REVIEWS_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"id\":\"REVIEW_UUID\",\"status\":\"rejected\"}"
```

Rejecting a review sets `status = 'rejected'` and clears `approved_at`.
It also writes a `review_moderation_events` audit row.

## Manual Supabase Moderation

In Supabase Table Editor:

1. Open `public.reviews`.
2. Filter `status = pending`.
3. Review `name`, `rating`, `route`, `review_text`, and `verified_booking`.
4. Confirm `booking_reference` is not sensitive before approving; it is private and should not be copied into review text.
5. Set `status` to `approved` or `rejected`.
6. For approved reviews, set `approved_at` to the current timestamp.
7. If moderating manually, add a matching row in `public.review_moderation_events`.
