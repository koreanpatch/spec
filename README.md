# SPEC - Sustained Proficiency through Experience and Consumption

**SPEC** is a decentralized identity and data management system for language learning applications. It provides a unified, tamper-proof profile that passively collects vocabulary encounters, reading progress, listening history, and achievement data across multiple apps-all owned by the learner, shared with permission, and cryptographically signed to ensure integrity.

## What It Does

SPEC solves the cold-start and data-sharing problems in language learning by creating a single source of truth for learner data:

- **Unified learner identity** - One DID-based account works across all connected apps
- **Passive data collection** - Track vocabulary exposure, content consumption, and learning activities automatically with zero friction
- **Tamper-proof ledger** - All data is cryptographically signed to prevent users from inflating their skills or history
- **Cross-app data sharing** - Apps can read and write to shared learner profiles with explicit permission
- **Portable progress** - Learners own their data and can move between apps freely
- **Self-documenting schema** - Growing, type-safe profile template that evolves with learner needs

## Why It Matters

Language learning apps typically operate in silos. When you switch from App A to App B, you lose your vocabulary history, reading progress, and achievement data. SPEC eliminates this friction:

- **For learners** - Your data follows you everywhere, improving recommendations and eliminating redundant work
- **For developers** - Skip building complex user profiling systems; integrate with SPEC and get rich user data immediately
- **For data integrity** - The signed ledger ensures that progress metrics, test scores, and achievements are trustworthy

## Architecture

SPEC is built on [ATProto](https://atproto.com) and follows its lexicon-based schema system:

- **spec-sdk** - Lexicon definitions (YAML → TypeScript types)
- **spec-server** - OAuth 2.1 server with signed data ledger
- **spec-client** - Client SDK for app integration

All endpoints and data structures are defined as lexicons in `packages/spec-sdk/src/lexicons/`. This ensures type safety across the entire stack and makes the API self-documenting.

### The Ledger

Every action that modifies learner data (vocabulary encounters, content completions, test scores, etc.) is recorded in a cryptographically signed ledger. This ensures:

- **Authenticity** - Data comes from verified apps, not user manipulation
- **Immutability** - Historical records cannot be altered or deleted
- **Auditability** - Apps can verify the source and timestamp of any data point
- **Trust** - Skill assessments and progress metrics reflect real learning history

## Quick Start

### Installation

```sh
git clone https://github.com/koreanpatch/spec.git
cd spec
pnpm install
