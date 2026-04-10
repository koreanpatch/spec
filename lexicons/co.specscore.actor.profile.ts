import { lx } from 'prototypey'

export const coSpecscoreActorProfile = lx.lexicon('co.specscore.actor.profile', {
  main: lx.record({
    key: 'literal:self',
    type: 'record',
    record: lx.object({
      publicKey: lx.string({
        required: true,
        description: 'The issuer\'s ECDSA P-256 public key as an ATProto multikey string (e.g. zDnaep5...). Used to verify signed records.'
      }),
    }),
    description: 'A record holding the issuer\'s public key. Used when verifying a signed record.'
  })
})
