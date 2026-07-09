export const privacyRetentionPolicy = {
  passengerIdentityPurpose: 'Passport or ID details are used only to request and reconcile SGR ticket booking assistance.',
  retentionWindow: 'Delete or anonymize passenger identity details within 30 days after journey completion unless a legal dispute, fraud report, or chargeback requires longer retention.',
  deletionRequest: 'Travellers can request deletion by emailing support@safarirail.co.ke with their booking reference.',
  encryptionBoundary: 'Passport or ID storage is isolated in the passengers table and passes through prepareSensitivePassengerFields before persistence; add field-level encryption at this boundary before production launch.',
} as const
