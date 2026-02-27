# Verification Claims

Verification claims are a separate attestation layer for records already written to ATProto.

They are not the same as inline event signatures.

## App signing vs issuer claims

- **App event signing**: SPEC-integrated apps write event records and include `appDid` + `signature` inline on the event.
- **Issuer verification claims**: third-party issuers (exam providers, schools, institutions) create a separate pointer record that attests a target record is valid.

Use app signatures for event integrity. Use verification claims for external credential trust.

## Claim schema

`tools.spec.verification.claim`:

- `record` (at-uri): target record URI being attested
- `date` (datetime): issuance time
- `signedBy` (did): issuer DID
- `signature` (string): signature over canonical JSON payload (with `signature` stripped)
- `issuerPublicKey` (string, optional): issuer JWK as JSON string

If `issuerPublicKey` is omitted, verifiers resolve a key from issuer DID documents.

## Key generation and publishing

Ed25519 is the recommended algorithm for issuer signatures.

```typescript
import {
  generateEd25519KeyPair,
  exportEd25519PublicKey,
} from "spec-sdk";

const keyPair = await generateEd25519KeyPair();
const publicKeyJwk = await exportEd25519PublicKey(keyPair.publicKey);

// Publish this JWK via your issuer DID doc, issuer metadata,
// or embed as issuerPublicKey in claims.
```

## End-to-end flow

1. Issuer identifies a target record URI (for example an exam result record).
2. Issuer creates a claim payload with `record`, `date`, and `signedBy`.
3. Issuer signs the payload and adds `signature`.
4. Claim is published and can be verified by third parties.
5. Verifier resolves issuer key (inline JWK or DID document), verifies signature, then trusts/rejects the claim.

## Signing and verification example

```typescript
import {
  signRecordEd25519,
  verifyRecordEd25519,
  importEd25519PublicKey,
} from "spec-sdk";

const unsignedClaim = {
  record: "at://did:plc:learner/app.exam.result/3ly5example",
  date: new Date().toISOString(),
  signedBy: "did:plc:issuer123",
};

const signedClaim = await signRecordEd25519(unsignedClaim, issuerPrivateKey);
const issuerPublicKey = await importEd25519PublicKey(issuerPublicKeyJwk);
const isValid = await verifyRecordEd25519(signedClaim, issuerPublicKey);
```

## spec-server verification endpoints

- `POST /verification/claims`: verify and store a claim
- `GET /verification/claims/by-record/:uri`: list claims for a target AT URI
- `GET /verification/claims/by-issuer/:did`: list claims issued by a DID
