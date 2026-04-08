import { lx } from 'prototypey'

export const coSpecscoreActorProfile = lx.lexicon('co.specscore.actor.profile', {
  main: lx.record({
    key: 'literal:self',
    type: 'record',
    record: lx.object({
      publicKey: lx.string({
        required: true,
        format: 'did',
        description: 'The users public key.'
      }),
    }),
    description: 'A record holding a users public key. This is used when verifying a record.'
  })
})
