# SPEC

**Sustained Profile of Encounter-based Consolidation.**

*(Earlier materials described SPEC as "Sustained Proficiency through Experience and Consumption" — that phrasing is historical/deprecated; the expansion above is canonical going forward.)*

SPEC gives learners a single, portable profile and a **proficiency score** that reflects real usage across the whole ecosystem—without locking data inside any one app, and without making learning competitive.

## The idea

Language learning is Balkanized. Your vocabulary in App A doesn’t exist in App B. Progress in one reader doesn’t feed another. In the old internet, that was normal: each product kept “its” data. In this era, we believe **you should own your data** and that a shared, tamper-evident record of what you’ve actually done is the right basis for level, recommendations, and portability.

SPEC does two things:

1. **Passive, cross-app data** – Integrations report events (words encountered, content completed, reviews done). No single app has to build or own the full picture. The more apps that integrate, the richer and more accurate the picture.
2. **A score that behaves like ELO, but isn’t zero-sum** – [ELO](https://en.wikipedia.org/wiki/Elo_rating_system) is a rating that updates from outcomes: you do something, your rating moves. In SPEC we use the same idea—signed events update your score—but there’s no opponent and no competition. You’re not taking points from anyone. The score is just a compact view of your own trajectory, derived from your own attested activity.

So: **massive integration** for passive data collection, **user-owned data** and cryptographic signing so the record is trustworthy, and a **non-competitive ELO-like score** so learners and apps have a shared, evolving measure of proficiency.

## Why it matters

- **Learners** – One identity, one ledger, one score. Your history and level move with you. No starting over when you switch apps.
- **Developers** – Integrate once; contribute events and (with permission) read profile and score. No need to build your own proficiency model or lock users in.
- **Integrity** – Events are signed by apps and verified by the system. The score is computed from a ledger that can’t be faked or edited after the fact.

## How it’s built

SPEC follows [ATProto](https://atproto.com) culture: lexicon-first schemas, DIDs for identity, signed data, and open tooling. This repo holds the **libraries**; the **servers** we run are separate, private repos.

- **spec-sdk** (this repo) – Lexicons (YAML → types), crypto, shared types. Source of truth for events and API shape.
- **spec-client** (this repo) – Client for apps: OAuth, DPoP, tokens, event writing, encryption, score fetch.
- **spec-server** ([koreanpatch/spec-server](https://github.com/koreanpatch/spec-server)) – The provider we host: auth, OAuth 2.1 (PAR, authorize, token), event verification, learner profile computation, app registry. Apps and users talk to this server. Private.
- **spec-score** ([koreanpatch/spec-score](https://github.com/koreanpatch/spec-score)) – A separate hosted service that aggregates a non-competitive, ELO-style trajectory score per user DID from the public ATProto firehose. It shares only DIDs with spec-server, never a database. Private.

Events and APIs are defined in `packages/spec-sdk/src/lexicons/`, all under the `tools.spec.*` NSID namespace. Both spec-server and spec-score consume signed events (verified via this SDK) and independently compute their own derived state — the ledger of raw events is the shared, portable source of truth; the interpretation of it is not. You own the data; the private backends run the verification and aggregation.

The actual SPEC difficulty-grading algorithm (E_diff, BKT/IRT-based learner modeling) is developed and validated in a private research repo and never lives in this public repo — see [AGENTS.md](AGENTS.md) for the full ecosystem map.

### Verifiable lexicons (Ed25519)

For lexicon verification claims, the SDK provides Ed25519 signing and verification: `signRecordEd25519`, `verifyRecordEd25519`, and key helpers. See [docs/verifiable-lexicons.md](docs/verifiable-lexicons.md) for a guide.

## Quick start

```sh
git clone https://github.com/koreanpatch/spec.git
cd spec
pnpm install
pnpm build
```

Use the SDK and client in your app and point them at the hosted SPEC server. For running or deploying the server, see [spec-server](https://github.com/koreanpatch/spec-server).

## For contributors and agents

See [AGENTS.md](AGENTS.md) / [CLAUDE.md](CLAUDE.md) for repo conventions, the NSID namespace rule, and known build issues.
