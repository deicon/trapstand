# Offline-PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first usable static Offline-PWA for recording Runden at the Trabstand.

**Architecture:** Keep the fachliche Regeln in small, deep TypeScript modules that can be tested without React. The UI is a tablet-first shell over the domain, local storage, CSV/JSON export, print view, and PWA install/offline assets.

**Tech Stack:** Vite, React, TypeScript, Vitest, Testing Library, browser localStorage, Web Share API where available.

---

### Task 1: Project Scaffold

**Files:**
- Create: package metadata, TypeScript/Vite config, HTML entrypoint, test setup
- Create: app source folders under `src/`

- [ ] Add Vite/React/TypeScript/Vitest dependencies and scripts.
- [ ] Add config files and root HTML.
- [ ] Install dependencies.

### Task 2: Domain Module

**Files:**
- Create: `src/domain/model.ts`
- Create: `src/domain/runden.ts`
- Test: `src/domain/runden.test.ts`

- [ ] Write failing tests for creating a Runde, Schuetzen limits, 25 Tauben, Ergebnis, Entwurf, and Vollstaendige Runde.
- [ ] Run tests and confirm RED.
- [ ] Implement minimal domain code.
- [ ] Run tests and confirm GREEN.

### Task 3: Export and Backup Modules

**Files:**
- Create: `src/export/csv.ts`
- Create: `src/export/backup.ts`
- Test: `src/export/export.test.ts`

- [ ] Write failing tests for CSV fields, Taubenstatus output, Ergebnis, Gaststatus, Zahlungsstatus, Rundenzeit, JSON backup round-trip, and invalid backup rejection.
- [ ] Run tests and confirm RED.
- [ ] Implement minimal export code.
- [ ] Run tests and confirm GREEN.

### Task 4: Local Datenbestand

**Files:**
- Create: `src/storage/datenbestand.ts`
- Test: `src/storage/datenbestand.test.ts`

- [ ] Write failing tests for save, list, get, delete, replace Datenbestand, and chronological order.
- [ ] Run tests and confirm RED.
- [ ] Implement localStorage-backed storage.
- [ ] Run tests and confirm GREEN.

### Task 5: Tablet UI

**Files:**
- Create: `src/App.tsx`
- Create: `src/main.tsx`
- Create: `src/styles.css`
- Test: `src/App.test.tsx`

- [ ] Write workflow tests for creating a Runde, autosave, editing Schuetzen, marking statuses, and derived Ergebnis.
- [ ] Run tests and confirm RED.
- [ ] Implement the UI: Rundenliste, editor, print view, CSV/JSON export/import actions, delete confirmation.
- [ ] Run tests and confirm GREEN.

### Task 6: PWA Shell

**Files:**
- Create: `public/manifest.webmanifest`
- Create: `public/sw.js`
- Modify: app bootstrap to register the service worker.

- [ ] Add installable manifest and service worker.
- [ ] Verify production build.
- [ ] Start dev server for manual inspection.
