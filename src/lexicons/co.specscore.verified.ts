import { lx } from 'prototypey'

export const coSpecscoreVerified = lx.lexicon('co.specscore.verified', {
  main: lx.record({
    key: 'tid',
    type: 'record',
    record: lx.object({
      record: lx.string({
        required: true,
        format: 'uri',
        description: 'Points to the published record (at://).'
      }),
      date: lx.string({
        required: true,
        format: 'datetime',
        description: 'Timestamp of the records publish time.'
      }),
      signedBy: lx.string({
        required: true,
        format: 'did',
        description: 'The entity who signed the published record.'
      }),
      signature: lx.bytes({
        required: true,
        description: 'The computed canonical representation of the published record\'s signed fields signed with the issuer\'s private key.'
      }),
    }),
    description: 'A record representing the pointed published record is verified.'
  })
})
