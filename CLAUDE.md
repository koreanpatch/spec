# CLAUDE.md — spec

**Purpose:** Public, MIT-licensed ATProto protocol layer for SPEC ("Sustained Profile of Encounter-based Consolidation") — lexicon schemas (`packages/spec-sdk`) + OAuth/event client (`packages/spec-client`). **Full detail:** [`AGENTS.md`](AGENTS.md).

---

## The one rule that matters most

**Every SPEC lexicon uses the `tools.spec.*` NSID namespace. Never `app.bsky.*` (Bluesky's reserved namespace) or any other namespace SPEC doesn't own.**

This repo previously shipped 6 lexicons under `app.bsky.spec.*` that also leaked private BKT/IRT model-internal fields (fitted thresholds, posterior cutoffs). They have been removed. Don't reintroduce anything like them — see the litmus test below before adding any new lexicon.

## What this repo is (and isn't)

| Is | Isn't |
|---|---|
| ATProto lexicon schemas + generated types (`spec-sdk`) | A scoring/grading implementation |
| An OAuth/event-writing client (`spec-client`) | The hosted backend (`spec-server`, private) |
| The protocol other apps build on | The ELO trajectory service (`spec-score`, private) |

One user-owned ATProto DID, many integrating apps write signed `tools.spec.*` records into that user's own repo using this SDK. A private, proprietary backend (not this repo) computes the actual SPEC level, difficulty grading, and ELO trajectory from those records. This repo never implements scoring math.

## Public lexicon litmus test

A lexicon here should describe a **raw, verifiable, app-agnostic event** ("word looked up," "session completed," "item reviewed") — never SPEC's private interpretation of that event (no BKT posteriors, ELO deltas, fitted weights, or stage thresholds). If a proposed field looks like a score, a posterior, or a threshold rather than a fact about what a user did, flag it for review before merging rather than adding it directly.

## Known issues (see `AGENTS.md` for full detail)

- **Codegen drift:** `scripts/generate.ts` expects `.yaml` lexicon sources; only `.json` files are checked in today, so `pnpm generate` (and therefore `pnpm build`) currently **fails with an error** (confirmed by reproduction — not a silent no-op). Documented TODO — do not "fix" by guessing without checking `LEXICON_GUIDE.md`'s intended authoring workflow first.
- **npm-publish blocker:** `spec-sdk` isn't published; `spec-server`/`spec-score` depend on it via local `file:` paths today. Publishing `0.x` to public npm is the recommended fix — a deliberate maintainer action, not something to do as an agent side effect.

## Sibling repos

`spec` (this repo, public) → `spec-server` (private backend) + `spec-score` (private ELO aggregation) both consume `spec-sdk`. A separate private research repo owns the actual difficulty-grading algorithm and its validation.
