# Extending SPEC Lexicons

## How Lexicons Work

Every API endpoint and data type in SPEC is defined by a lexicon file. Lexicons are the single source of truth. TypeScript types, XRPC client methods, and server route validation are all generated from them.

Lexicons use ATProto's Lexicon v1 schema language. We author them in YAML for readability and convert to JSON for tooling.

## File Location

```
packages/spec-sdk/src/lexicons/
  tools.spec.oauth.defs.yaml
  tools.spec.oauth.par.yaml
  tools.spec.oauth.token.yaml
  tools.spec.account.defs.yaml
  ...
```

Filename = NSID. `tools.spec.oauth.par.yaml` defines the `tools.spec.oauth.par` lexicon.

## Adding a New Endpoint

Create a YAML file named after your NSID:

```yaml
# packages/spec-sdk/src/lexicons/tools.spec.score.calculate.yaml
lexicon: 1
id: tools.spec.score.calculate
defs:
  main:
    type: procedure
    input:
      encoding: application/json
      schema:
        type: ref
        ref: tools.spec.score.defs#calculateInput
    output:
      encoding: application/json
      schema:
        type: ref
        ref: tools.spec.score.defs#calculateOutput
    errors:
      - name: InvalidInput
```

## Adding Shared Types

Group related types in a `*.defs` lexicon:

```yaml
# packages/spec-sdk/src/lexicons/tools.spec.score.defs.yaml
lexicon: 1
id: tools.spec.score.defs
defs:
  calculateInput:
    type: object
    required:
      - user_did
      - activity_type
    properties:
      user_did:
        type: string
        format: did
      activity_type:
        type: string
        enum:
          - reading
          - writing
          - listening
          - speaking

  calculateOutput:
    type: object
    required:
      - score
      - level
    properties:
      score:
        type: integer
        minimum: 0
        maximum: 10000
      level:
        type: string
```

## Generate Types

After adding or modifying any lexicon:

```sh
pnpm generate
```

This runs the pipeline: YAML -> JSON -> `@atproto/lex-cli gen-api` -> TypeScript in `src/generated/`.

## NSID Convention

```
tools.spec.<domain>.<action>
tools.spec.<domain>.defs        (shared types for domain)
```

Domains so far: `oauth`, `account`. Add new domains as needed: `score`, `progress`, `content`.

## Primary Types

- `query` -- HTTP GET, read-only
- `procedure` -- HTTP POST, mutations
- `record` -- storable data objects
- `subscription` -- WebSocket event streams

## Key Rules

1. Every lexicon file has exactly one NSID (`id` field)
2. The `main` definition is the primary type (query/procedure/record)
3. Non-main definitions are shared types referenced via `#fragmentName`
4. Cross-file references use full NSID: `tools.spec.score.defs#calculateInput`
5. New fields on existing types must be optional (backward compatibility)
6. Removing required fields is a breaking change -- create a new NSID instead

## Type Reference

| Lexicon Type | Description |
|---|---|
| `string` | Unicode text, optional `format`, `enum`, `maxLength` |
| `integer` | Signed integer, optional `minimum`, `maximum` |
| `boolean` | True/false |
| `bytes` | Raw binary data |
| `array` | Typed list with `items` schema |
| `object` | Structured type with `properties` |
| `ref` | Reference to another definition |
| `union` | One of multiple referenced types |
| `unknown` | Any valid data object |

## String Formats

| Format | Example |
|---|---|
| `did` | `did:plc:abc123` |
| `handle` | `user.spec.tools` |
| `datetime` | `2026-01-15T09:30:00.000Z` |
| `uri` | `https://spec.tools/...` |
| `at-uri` | `at://did:plc:abc123/tools.spec.score/...` |

## Forking and Customizing

To create your own namespace:

1. Fork this repo
2. Rename NSID prefix from `tools.spec` to `com.yourorg`
3. Run `pnpm generate`
4. All types and clients regenerate under your namespace
