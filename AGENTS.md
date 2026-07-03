# AGENTS.md

## What this repo is

**`spec`** is the public, MIT-licensed open protocol layer for the SPEC ecosystem ("**SPEC** — Sustained Profile of Encounter-based Consolidation," a Korean L2 reading-proficiency framework). It contains:

- **`packages/spec-sdk`** — ATProto lexicon schemas (the protocol contract) plus generated TypeScript types, crypto helpers (Ed25519 record signing/verification), and shared types.
- **`packages/spec-client`** — A client SDK for integrating apps: OAuth 2.1 (PAR/DPoP/PKCE) against a user's own ATProto PDS, event writing, encryption, score fetch.

The model this repo implements: **one user-owned ATProto identity (DID), many integrating apps.** Any app (Sunbi, Shelf, Yoten, SPEC-RSSHub, or a future third party) writes signed, `tools.spec.*`-shaped records into a user's own ATProto repo using this SDK. No app needs to build its own proficiency model or lock in a user's data. **This repo never computes a score or a difficulty grade — it only defines the shape of events and provides the client tooling to write/read them.** A private, proprietary backend (not this repo) reads across a user's full event history and computes the actual SPEC level / difficulty grading / ELO trajectory. See "Sibling repos" below.

This is a young, pre-1.0 (`v0.1.0`) repo with no published npm releases and no external integrators yet — see the npm-publish blocker below.

## NSID namespace rule (must follow, no exceptions)

**All SPEC lexicons MUST use the `tools.spec.*` NSID namespace.** Never use `app.bsky.*` (Bluesky's own reserved namespace — SPEC has no rights to publish records under it) or any other namespace SPEC doesn't own.

**Cautionary history:** this repo previously shipped 6 lexicons under `app.bsky.spec.*` (BKT/IRT model-internal record shapes). These have been removed. Do not reintroduce anything under `app.bsky.*`. If a future maintainer wants a dedicated domain-based NSID (`<yourdomain>.spec.*`), that's a fine long-term evolution per ATProto convention, but `tools.spec.*` remains the correct namespace until that decision is made deliberately — don't invent a third convention in the meantime.

## What belongs in a public lexicon (and what doesn't)

A public SPEC lexicon should describe a **portable, verifiable, app-agnostic EVENT** — something that provably happened, that any integrating app can emit and any consumer can verify was signed by that app and DID. Examples: a word was looked up, a session was completed, an SRS item was reviewed, a book was completed.

A public lexicon should **never** encode SPEC's private interpretation of an event — no BKT posteriors, no ELO deltas, no fitted difficulty weights, no stage/level thresholds, no other output of SPEC's proprietary scoring math. That interpretation layer lives exclusively in SPEC's private backend.

**Quick litmus test:** if a proposed lexicon field looks like a score, a posterior, a fitted weight, or a threshold rather than a fact about something a user did, don't add it here — flag it for internal review before merging. When in doubt, keep the record shape minimal and raw; a lexicon that only ever describes "what happened" can stay stable for years even while the private scoring algorithm iterates weekly. A lexicon that encodes "what SPEC concluded about it" couples protocol stability to algorithm churn, which is the exact problem this rule exists to prevent.

**Operational audit (2026-07-03):** see [`docs/lexicon-public-private-audit.md`](docs/lexicon-public-private-audit.md) for the current public SDK inventory and remediation log. Draft lexicons live in private `spec-research-suite/docs/lexicons/proposals/`; blocked NSIDs are listed in `RELEASE_BLOCKERS.md`.

## Sibling repos (this ecosystem, at a glance)

- **`spec`** (this repo) — public protocol: ATProto lexicons + SDK/client libraries. MIT.
- **`spec-server`** (private) — hosted backend: OAuth identity provider, event verification, learner profile computation, app registry.
- **`spec-score`** (private) — a separate hosted service: ELO-style trajectory aggregation per user DID from the public ATProto firehose. Shares only DIDs with `spec-server`, never a database.
- A private companion research repo holds the actual E_diff/BKT/IRT difficulty-grading algorithm, its validation, and lexicon proposals in draft form. This repo never implements scoring math itself — only the protocol shapes and client tooling that scoring math consumes as input.

## Known build issues (read before touching codegen)

### YAML/JSON codegen drift

`LEXICON_GUIDE.md` documents YAML as the intended lexicon authoring format (`pnpm generate` runs YAML → JSON → `@atproto/lex-cli gen-api` → TypeScript). **In practice, `packages/spec-sdk/src/lexicons/` currently contains only `.json` files — zero `.yaml` sources exist.** `scripts/generate.ts` filters `readdirSync(LEXICONS_DIR)` for `.yaml` extensions only, so running `pnpm generate` today finds zero input files, writes zero files into `tmp-lexicons/`, and then **crashes** (`ENOENT`, `lex gen-api` fails trying to glob `tmp-lexicons/*.json` when the directory is empty) rather than silently succeeding with empty output. Confirmed by direct reproduction: `pnpm --filter spec-sdk generate` currently fails, which means **`pnpm build` at the repo root currently fails too** (spec-sdk's `build` script is `pnpm generate && tsc`).

**This is a known TODO, not fixed in this pass.** YAML-as-source-of-truth still appears to be the intended design per `LEXICON_GUIDE.md`, so the correct fix is most likely one of:
1. Add the missing `.yaml` sources (hand-author or mechanically convert the existing `.json` files back to `.yaml`), keeping `.json` as the generated/derived artifact as originally intended, or
2. If YAML authoring is no longer wanted, deliberately repoint `scripts/generate.ts` at `.json` sources directly and update `LEXICON_GUIDE.md` to match.

Do not silently pick one without confirming which one the maintainers actually want — this changes the authoring workflow for every future lexicon contribution.

### Phantom `apps/*` workspace glob

`pnpm-workspace.yaml` lists `apps/*` as a workspace package glob; no `apps/` directory exists on disk. This is harmless (pnpm tolerates globs matching nothing) but don't waste time looking for a phantom `apps/` directory.

## npm-publish blocker (action item, do not publish yourself)

`spec-sdk` is not yet published to npm. Private sibling repos (`spec-server`, `spec-score`) currently depend on it via local `file:../spec/packages/spec-sdk` path dependencies, which means neither can be built or deployed independently of a `spec` checkout at the exact same relative filesystem path.

**Recommended near-term fix:** publish `spec-sdk` to public npm as a `0.x` pre-1.0 version (it's already MIT-licensed and meant to be a public, consumable ATProto artifact — this is unrelated to the "keep scoring internals private" rule above, since no scoring logic lives in this package). This is a deliberate release decision for this repo's maintainers to make — **do not run `npm publish` as an agent action**; just flag it as a clear, actionable next step when relevant.

## Documentation

- [`LEXICON_GUIDE.md`](LEXICON_GUIDE.md) — how to author and extend lexicons.
- [`docs/learner-data-architecture.md`](docs/learner-data-architecture.md) — the public firehose vs. private server-DB data split.
- [`docs/verifiable-lexicons.md`](docs/verifiable-lexicons.md) — Ed25519 record signing/verification guide.
