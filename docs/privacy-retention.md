# Privacy Retention Notes

SafariRail collects passport or ID details only to request and reconcile SGR booking assistance.

Retention rule: delete or anonymize passenger identity details within 30 days after journey completion unless a legal dispute, fraud report, chargeback, or regulatory request requires longer retention.

Deletion rule: travellers can request deletion by emailing support@safarirail.co.ke with their booking reference.

Encryption boundary: passport or ID storage is isolated in the `passengers` table and encrypted in `prepareSensitivePassengerFields` inside `api/bookings.ts` before persistence. The database receives an AES-256-GCM envelope in the format `v1:iv:tag:ciphertext`, not the plaintext passport or ID value.

Required encryption environment variable: set `PASSPORT_ID_ENCRYPTION_KEY` to a high-entropy 32-byte base64 value. Generate one with:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Do not log plaintext or ciphertext passport/ID values. Decryption tooling, if added later for operational workflows, must live behind explicit authorization and audit logging.

Production rate limiting: configure `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to replace the local fallback limiter with durable shared rate limiting across serverless instances.
