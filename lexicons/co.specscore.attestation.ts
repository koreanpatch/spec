import { lx } from 'prototypey'

export const coSpecscoreAttestation = lx.lexicon('co.specscore.attestation', {
  main: lx.record({
    key: 'tid',
    type: 'record',
    record: lx.object({
      record: lx.string({
        required: true,
        format: 'at-uri',
        description: 'AT URI of the published record being verified.'
      }),
      signedAt: lx.string({
        required: true,
        format: 'datetime',
        description: 'Timestamp of when the record was signed.'
      }),
      signedBy: lx.string({
        required: true,
        format: 'did',
        description: 'DID of the issuer who signed the record.'
      }),
      signature: lx.string({
        required: true,
        description: 'ECDSA P-256 signature over the RFC 8785 canonical form of the record, base64url-encoded.'
      }),
    }),
    description: 'Attestation that a published record was signed by an issuer.'
  })
})
