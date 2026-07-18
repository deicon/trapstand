# Multi-Tablet Delta Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tablets using the same club credentials can independently record rounds and converge through sync without blocking when the cloud backup is newer.

**Architecture:** Keep the existing encrypted full-backup object in Cloudflare/S3. Add a client-side merge that treats each `Runde` as the sync unit, selects the newer version by `zuletztBearbeitet`, uploads the merged backup, and lets the app replace local state without marking another pending sync.

**Tech Stack:** React, TypeScript, Vitest, existing Cloudflare Worker endpoints.

---

### Task 1: Pure Merge

**Files:**
- Create: `src/sync/merge.ts`
- Test: `src/sync/merge.test.ts`

- [x] Write failing tests for merging different local/cloud rounds.
- [x] Write failing tests for same round id where newer `zuletztBearbeitet` wins.
- [x] Implement `mergeDatenbestand(local, cloud)`.
- [x] Run `npm test -- src/sync/merge.test.ts`.

### Task 2: Sync Uses Merge

**Files:**
- Modify: `src/sync/sync.ts`
- Test: `src/sync/sync.test.ts`

- [x] Replace `CloudIsNewerError` behavior with `mergeDatenbestand`.
- [x] Encrypt/upload an exported backup JSON with `version`.
- [x] Return the merged `Datenbestand` from `syncNow` and `triggerSyncIfNeeded`.
- [x] Run `npm test -- src/sync/sync.test.ts`.

### Task 3: Apply Synced State Locally

**Files:**
- Modify: `src/storage/datenbestand.ts`
- Modify: `src/App.tsx`
- Test: `src/storage/datenbestand.test.ts`, `src/App.test.tsx`

- [x] Add a local replace path for cloud-synced data that does not mark pending again.
- [x] Use the returned merged data after manual and automatic sync.
- [x] Run `npm test -- src/storage/datenbestand.test.ts src/App.test.tsx`.
