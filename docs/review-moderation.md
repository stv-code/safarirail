# Review Moderation

Public review submissions are saved to Supabase with `status = 'pending'`. The public reviews API returns only rows where `status = 'approved'`.

Public/frontend Supabase clients must never query `public.reviews` directly. The frontend must use `/api/reviews`, which filters to approved reviews and keeps the service role key server-side.

Required environment variable:

```sh
REVIEWS_ADMIN_TOKEN=replace-with-random-admin-token
```

Use a high-entropy token. Do not expose it in frontend code.

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
3. Review `name`, `rating`, `route`, and `review_text`.
4. Set `status` to `approved` or `rejected`.
5. For approved reviews, set `approved_at` to the current timestamp.
6. If moderating manually, add a matching row in `public.review_moderation_events`.
