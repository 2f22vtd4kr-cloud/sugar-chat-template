---
name: API client type patching
description: How to add new fields to the generated User (and other) types in the api-client-react package
---

## Problem
The @workspace/api-client-react package has generated TypeScript types (orval). There is NO build script in that package — the dist files are pre-committed.

## Files to patch when adding new backend User fields
1. `lib/api-client-react/src/generated/api.schemas.ts` — source User interface
2. `lib/api-client-react/dist/generated/api.schemas.d.ts` — compiled declaration file (what the app actually imports)

Both must be updated simultaneously.

**Why:** The companion-app imports types from the dist .d.ts file for TypeScript resolution. Updating only the source has no effect at compile time for consumers.

## How to apply
Edit the `User` interface in BOTH files above. No build step needed. Run `pnpm exec tsc --noEmit` in companion-app to verify.
