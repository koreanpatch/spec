# Verifiable Lexicons: Ed25519 Signing

A verification claim attests that a record is valid. You create one when you publish a lexicon (or any record) and want others to trust it. The claim has four fields:

- **record** – AT URI of the record you're attesting to (e.g. `at://did:plc:xxx/com.example.lexicon/vocab-1`)
- **date** – When you issued the claim (ISO 8601)
- **signedBy** – Your DID
- **signature** – A cryptographic signature over the other three fields

The signature proves you hold the private key for `signedBy`. Verifiers use your public key to check it.

## Why Ed25519?

Ed25519 is fast, compact (64-byte signatures), and built into Node and browsers. Same payload always gives the same signature, which simplifies debugging and replay.

## What gets signed?

The canonical JSON of `record`, `date`, and `signedBy` (keys sorted alphabetically), encoded as UTF-8. The `signature` field is excluded—you sign the payload, then add the signature.

Example payload:

```json
{
  "date": "2026-02-16T12:00:00Z",
  "record": "at://did:plc:abc123/com.example.lexicon/vocab-1",
  "signedBy": "did:plc:xyz789"
}
```

## Usage

Generate keys, sign a claim, verify it:

```typescript
import {
  generateEd25519KeyPair,
  exportEd25519PublicKey,
  signRecordEd25519,
  verifyRecordEd25519,
  importEd25519PublicKey,
} from "spec-sdk";

// Generate and store your key pair. Publish the public key (e.g. in app registry).
const keyPair = await generateEd25519KeyPair();
const publicKeyJwk = await exportEd25519PublicKey(keyPair.publicKey);

// Sign a claim
const claim = {
  record: "at://did:plc:abc123/com.example.lexicon/vocab-1",
  date: new Date().toISOString(),
  signedBy: "did:plc:xyz789",
};
const signed = await signRecordEd25519(claim, keyPair.privateKey);

// Verify (e.g. on the server)
const publicKey = await importEd25519PublicKey(publicKeyJwk);
const ok = await verifyRecordEd25519(signed, publicKey);
```

## API

| Function | Description |
|----------|-------------|
| `generateEd25519KeyPair()` | Create a new key pair |
| `exportEd25519PublicKey(key)` | Export public key as JWK |
| `importEd25519PublicKey(jwk)` | Import public key from JWK |
| `importEd25519PrivateKey(jwk)` | Import private key from JWK |
| `signRecordEd25519(record, privateKey)` | Sign a record, return it with `signature` |
| `verifyRecordEd25519(record, publicKey)` | Verify signature, return boolean |

## JWK format

Ed25519 keys use `kty: "OKP"` and `crv: "Ed25519"`. The public key is in `x` (base64url, 32 bytes). Private keys include `d`.

```json
{
  "kty": "OKP",
  "crv": "Ed25519",
  "x": "..."
}
```

## Tests

From `packages/spec-sdk`:

```bash
pnpm test
```
