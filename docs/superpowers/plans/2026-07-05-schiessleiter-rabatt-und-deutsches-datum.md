# Schießleiter-Rabatt und deutsches Datumsformat – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Füge pro Schütze/Runde eine `kostenlos`-Markierung hinzu, mit der der Schießleiter automatisch seine erste Runde am Tag frei erhält, und stelle alle App- und Druck-Datumsangaben im deutschen Format `dd.mm.yyyy hh:mm` dar.

**Architecture:** Das Domain-Modell `Schuetze` erhält ein Pflichtfeld `kostenlos`. Hilfsfunktionen in `src/domain/runden.ts` kapseln alle Abfragen (`isKostenlos`, Zahlungslogik, Freirunden-Automatik). UI, CSV, Backup und `localStorage` werden so angepasst, dass fehlende `kostenlos`-Werte normalisiert und `kostenlos` in Berechnungen stets Vorrang hat. Datumsformatierung erfolgt zentral in einem neuen Formatter.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, React Testing Library, lokaler `localStorage`-Speicher.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/domain/model.ts` | `Schuetze` Typ erweitert um `kostenlos: boolean` |
| `src/domain/runden.ts` | Hilfsfunktionen, Freirunden-Automatik, Zahlungslogik, Datumsformatter |
| `src/domain/runden.test.ts` | Domain-Tests |
| `src/App.tsx` | Editor, Liste, Bezahlen-Dialog, Druckansicht, Vorschläge |
| `src/App.test.tsx` | UI-Tests |
| `src/export/csv.ts` | CSV-Spalte `kostenlos` |
| `src/export/export.test.ts` | CSV-Tests |
| `src/export/backup.ts` | Backup-Validierung und Normalisierung |
| `src/export/backup.test.ts` | Backup-Tests |
| `src/storage/datenbestand.ts` | `localStorage` Normalisierung |
| `src/storage/datenbestand.test.ts` | Storage-Tests |

---

### Task 1: Domain Model – `kostenlos` hinzufügen

**Files:**
- Modify: `src/domain/model.ts`
- Modify: `src/domain/runden.ts`
- Test: `src/domain/runden.test.ts`

- [ ] **Step 1: Write the failing test**

In `src/domain/runden.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createSchuetze } from "./runden";

describe("createSchuetze", () => {
  it("initializes kostenlos to false", () => {
    const schuetze = createSchuetze("Max", 1);
    expect(schuetze.kostenlos).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/domain/runden.test.ts`
Expected: TypeScript error: `Property 'kostenlos' does not exist on type 'Schuetze'`.

- [ ] **Step 3: Update model and factory**

In `src/domain/model.ts`:

```ts
export interface Schuetze {
  id: string;
  name: string;
  gaststatus: boolean;
  zahlungsstatus: boolean;
  kostenlos: boolean;
  tauben: Taube[];
}
```

In `src/domain/runden.ts`, in `createSchuetze`:

```ts
export function createSchuetze(name: string, position: number, id = `schuetze-${position}`): Schuetze {
  return {
    id,
    name,
    gaststatus: false,
    zahlungsstatus: false,
    kostenlos: false,
    tauben: createTauben()
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/domain/runden.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domain/model.ts src/domain/runden.ts src/domain/runden.test.ts
git commit -m "feat(domain): add kostenlos flag to Schuetze"
```

---

### Task 2: Domain Helpers – `isKostenlos` und Freirunden-Automatik

**Files:**
- Modify: `src/domain/runden.ts`
- Test: `src/domain/runden.test.ts`

- [ ] **Step 1: Write failing tests**

In `src/domain/runden.test.ts`:

```ts
import {
  createEntwurf,
  createRunde,
  ensureSchiessleiterFreirunde,
  hatSchuetzeKostenloseRundeAmTag,
  isKostenlos
} from "./runden";
import type { Runde } from "./model";

describe("isKostenlos", () => {
  it("returns false by default", () => {
    const schuetze = createSchuetze("Max", 1);
    expect(isKostenlos(schuetze)).toBe(false);
  });

  it("returns true when kostenlos is true", () => {
    const schuetze = { ...createSchuetze("Max", 1), kostenlos: true };
    expect(isKostenlos(schuetze)).toBe(true);
  });
});

describe("hatSchuetzeKostenloseRundeAmTag", () => {
  it("returns false when no kostenlos round exists", () => {
    const runde = createRunde({
      id: "r1",
      rundenzeit: "2026-04-23T09:00",
      schiessleiter: "Leo",
      schuetzenNamen: ["Max"]
    });
    expect(hatSchuetzeKostenloseRundeAmTag([runde], "Leo", "2026-04-23")).toBe(false);
  });

  it("returns true when a kostenlos round exists on the day", () => {
    const runde = createRunde({
      id: "r1",
      rundenzeit: "2026-04-23T09:00",
      schiessleiter: "Leo",
      schuetzenNamen: ["Leo"]
    });
    const withKostenlos = ensureSchiessleiterFreirunde(runde, []);
    expect(hatSchuetzeKostenloseRundeAmTag([withKostenlos], "Leo", "2026-04-23")).toBe(true);
  });
});

describe("ensureSchiessleiterFreirunde", () => {
  it("marks schiessleiter as kostenlos when in rotte and first round of day", () => {
    const runde = createRunde({
      id: "r1",
      rundenzeit: "2026-04-23T09:00",
      schiessleiter: "Leo",
      schuetzenNamen: ["Leo", "Max"]
    });
    const result = ensureSchiessleiterFreirunde(runde, []);
    const leo = result.rotte.find((s) => s.name === "Leo");
    expect(leo?.kostenlos).toBe(true);
  });

  it("does not mark when schiessleiter is not in rotte", () => {
    const runde = createRunde({
      id: "r1",
      rundenzeit: "2026-04-23T09:00",
      schiessleiter: "Leo",
      schuetzenNamen: ["Max"]
    });
    const result = ensureSchiessleiterFreirunde(runde, []);
    expect(result.rotte.every((s) => !s.kostenlos)).toBe(true);
  });

  it("does not mark when a kostenlos round already exists for the day", () => {
    const first = ensureSchiessleiterFreirunde(
      createRunde({
        id: "r1",
        rundenzeit: "2026-04-23T09:00",
        schiessleiter: "Leo",
        schuetzenNamen: ["Leo"]
      }),
      []
    );
    const second = createRunde({
      id: "r2",
      rundenzeit: "2026-04-23T10:00",
      schiessleiter: "Leo",
      schuetzenNamen: ["Leo"]
    });
    const result = ensureSchiessleiterFreirunde(second, [first]);
    const leo = result.rotte.find((s) => s.name === "Leo");
    expect(leo?.kostenlos).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/domain/runden.test.ts`
Expected: FAIL – functions not defined.

- [ ] **Step 3: Implement helpers**

In `src/domain/runden.ts`:

```ts
export function isKostenlos(schuetze: Schuetze): boolean {
  return schuetze.kostenlos ?? false;
}

export function schuetzeIstZahlungspflichtig(schuetze: Schuetze): boolean {
  return !isKostenlos(schuetze);
}

export function dayKey(runde: Runde): string {
  return runde.rundenzeit.slice(0, 10);
}

export function hatSchuetzeKostenloseRundeAmTag(
  runden: Runde[],
  name: string,
  tag: string
): boolean {
  const normalizedName = name.trim().toLocaleLowerCase();
  return runden.some(
    (runde) =>
      dayKey(runde) === tag &&
      runde.rotte.some(
        (schuetze) =>
          schuetze.name.trim().toLocaleLowerCase() === normalizedName &&
          isKostenlos(schuetze)
      )
  );
}

export function ensureSchiessleiterFreirunde(runde: Runde, alleRunden: Runde[]): Runde {
  const schiessleiter = runde.schiessleiter.trim();
  if (!schiessleiter) {
    return runde;
  }

  const tag = dayKey(runde);
  const andereRunden = alleRunden.filter((andere) => andere.id !== runde.id);
  if (hatSchuetzeKostenloseRundeAmTag(andereRunden, schiessleiter, tag)) {
    return runde;
  }

  const normalizedSchiessleiter = schiessleiter.toLocaleLowerCase();
  const schiessleiterInRotte = runde.rotte.find(
    (schuetze) => schuetze.name.trim().toLocaleLowerCase() === normalizedSchiessleiter
  );

  if (!schiessleiterInRotte) {
    return runde;
  }

  return updateSchuetze(runde, schiessleiterInRotte.id, { kostenlos: true });
}
```

Note: move `dayKey` from `src/App.tsx` to `src/domain/runden.ts` and export it. Update `src/App.tsx` to import `dayKey` from `./domain/runden`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/domain/runden.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domain/runden.ts src/domain/runden.test.ts
git commit -m "feat(domain): add kostenlos helpers and schiessleiter free-round automation"
```

---

### Task 3: Move payment helpers to domain

**Files:**
- Modify: `src/domain/runden.ts`
- Modify: `src/App.tsx`

`getRundenPreise` and `getSchuetzenPreisCent` currently live in `src/App.tsx`. Move them to `src/domain/runden.ts` and export them, then update imports in `src/App.tsx`.

- [ ] **Step 1: Move functions**

In `src/domain/runden.ts`, add:

```ts
export function getRundenPreise(runde: Runde): RundenPreise {
  return runde.preise ?? DEFAULT_PREISE;
}

export function getSchuetzenPreisCent(runde: Runde, schuetze: Schuetze): number {
  const rundenPreise = getRundenPreise(runde);
  return schuetze.gaststatus ? rundenPreise.gastCent : rundenPreise.mitgliedCent;
}
```

Remove the same functions from `src/App.tsx` and import them from `./domain/runden`.

- [ ] **Step 2: Run tests**

Run: `npm test`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/domain/runden.ts src/App.tsx
git commit -m "refactor(domain): move payment helpers to runden.ts"
```

---

### Task 4: Payment Logic – `kostenlos` overrides payment

**Files:**
- Modify: `src/domain/runden.ts`
- Test: `src/domain/runden.test.ts`

- [ ] **Step 1: Write failing tests**

In `src/domain/runden.test.ts`:

```ts
import { getSchuetzenPreisCent, createRunde } from "./runden";

describe("getSchuetzenPreisCent", () => {
  it("returns 0 for kostenlos shooters", () => {
    const runde = createRunde({
      id: "r1",
      rundenzeit: "2026-04-23T09:00",
      schiessleiter: "Leo",
      schuetzenNamen: ["Max"]
    });
    const max = { ...runde.rotte[0], kostenlos: true };
    expect(getSchuetzenPreisCent(runde, max)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/domain/runden.test.ts`
Expected: FAIL – `getSchuetzenPreisCent` does not consider `kostenlos`.

- [ ] **Step 3: Update payment logic**

In `src/domain/runden.ts`, update `getSchuetzenPreisCent`:

```ts
export function getSchuetzenPreisCent(runde: Runde, schuetze: Schuetze): number {
  if (isKostenlos(schuetze)) {
    return 0;
  }
  const rundenPreise = getRundenPreise(runde);
  return schuetze.gaststatus ? rundenPreise.gastCent : rundenPreise.mitgliedCent;
}
```

Verify `getEingenommenCent` and `getRundengeld` in `src/App.tsx` already use `getSchuetzenPreisCent` and `zahlungsstatus`. Because `getSchuetzenPreisCent` now returns 0 for kostenlos, these will automatically exclude kostenlos shooters from revenue.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/domain/runden.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domain/runden.ts src/domain/runden.test.ts
git commit -m "feat(domain): kostenlos shooters have zero price"
```

---

### Task 5: Backup Import – normalize missing `kostenlos`

**Files:**
- Modify: `src/export/backup.ts`
- Test: `src/export/backup.test.ts`

- [ ] **Step 1: Write failing test**

In `src/export/backup.test.ts`:

```ts
import { importBackupJson } from "./backup";

describe("importBackupJson kostenlos normalization", () => {
  it("defaults missing kostenlos to false", () => {
    const json = JSON.stringify({
      version: 1,
      runden: [
        {
          id: "r1",
          rundenzeit: "2026-04-23T09:00",
          schiessleiter: "Leo",
          rotte: [
            {
              id: "s1",
              name: "Max",
              gaststatus: false,
              zahlungsstatus: false,
              tauben: Array.from({ length: 25 }, (_, i) => ({
                nummer: i + 1,
                status: "offen"
              }))
            }
          ]
        }
      ]
    });

    const result = importBackupJson(json);
    expect(result.runden[0].rotte[0].kostenlos).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/export/backup.test.ts`
Expected: FAIL – `kostenlos` missing or `isSchuetze` rejects.

- [ ] **Step 3: Update backup validation and import**

In `src/export/backup.ts`, update `isSchuetze`:

```ts
function isSchuetze(value: unknown): value is Schuetze {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.gaststatus === "boolean" &&
    typeof value.zahlungsstatus === "boolean" &&
    (value.kostenlos === undefined || typeof value.kostenlos === "boolean") &&
    Array.isArray(value.tauben) &&
    value.tauben.length === 25 &&
    value.tauben.every(isTaube)
  );
}
```

Update `importBackupJson` to normalize:

```ts
export function importBackupJson(json: string): Datenbestand {
  try {
    const parsed: unknown = JSON.parse(json);
    if (!isDatenbestandBackup(parsed)) {
      throw new Error("invalid");
    }
    return {
      runden: parsed.runden.map((runde) => ({
        ...runde,
        rotte: runde.rotte.map((schuetze) => ({
          ...schuetze,
          kostenlos: schuetze.kostenlos ?? false
        }))
      })),
      ...(parsed.schuetzen ? { schuetzen: parsed.schuetzen } : {}),
      ...(parsed.preise ? { preise: parsed.preise } : {})
    };
  } catch {
    throw new Error("Ungueltiger Backup-Export.");
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/export/backup.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/export/backup.ts src/export/backup.test.ts
git commit -m "feat(backup): normalize missing kostenlos on import"
```

---

### Task 6: localStorage – normalize missing `kostenlos`

**Files:**
- Modify: `src/storage/datenbestand.ts`
- Test: `src/storage/datenbestand.test.ts`

- [ ] **Step 1: Write failing test**

In `src/storage/datenbestand.test.ts`:

```ts
import { LocalDatenbestand } from "./datenbestand";
import type { Runde } from "../domain/model";

describe("LocalDatenbestand kostenlos normalization", () => {
  it("defaults missing kostenlos to false when reading from localStorage", () => {
    const raw = JSON.stringify({
      runden: [
        {
          id: "r1",
          rundenzeit: "2026-04-23T09:00",
          schiessleiter: "Leo",
          rotte: [
            {
              id: "s1",
              name: "Max",
              gaststatus: false,
              zahlungsstatus: false,
              tauben: Array.from({ length: 25 }, (_, i) => ({
                nummer: i + 1,
                status: "offen"
              }))
            }
          ]
        }
      ] as Runde[]
    });

    localStorage.setItem("trapstand:datenbestand", raw);
    const store = new LocalDatenbestand();
    const runde = store.get("r1")!;
    expect(runde.rotte[0].kostenlos).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/storage/datenbestand.test.ts`
Expected: FAIL – `kostenlos` is `undefined`.

- [ ] **Step 3: Update LocalDatenbestand.read**

In `src/storage/datenbestand.ts`, update `read()`:

```ts
private read(): Datenbestand {
  const raw = localStorage.getItem(this.key);
  if (!raw) {
    return { runden: [], schuetzen: [], preise: { ...DEFAULT_PREISE } };
  }

  try {
    const parsed = JSON.parse(raw) as Datenbestand;
    const runden = Array.isArray(parsed.runden)
      ? parsed.runden.map((runde) => ({
          ...runde,
          rotte: runde.rotte.map((schuetze) => ({
            ...schuetze,
            kostenlos: schuetze.kostenlos ?? false
          }))
        }))
      : [];
    const schuetzen = normalizeSchuetzen(parsed.schuetzen, runden);
    return {
      runden,
      schuetzen,
      preise: normalizePreise(parsed.preise)
    };
  } catch {
    return { runden: [], schuetzen: [], preise: { ...DEFAULT_PREISE } };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/storage/datenbestand.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/storage/datenbestand.ts src/storage/datenbestand.test.ts
git commit -m "feat(storage): normalize missing kostenlos when reading localStorage"
```

---

### Task 7: CSV Export – add `kostenlos` column

**Files:**
- Modify: `src/export/csv.ts`
- Test: `src/export/export.test.ts`

- [ ] **Step 1: Write failing test**

In `src/export/export.test.ts`:

```ts
import { exportRundenCsv } from "./csv";
import { createRunde } from "../domain/runden";

describe("exportRundenCsv", () => {
  it("includes kostenlos column", () => {
    const runde = createRunde({
      id: "r1",
      rundenzeit: "2026-04-23T09:00",
      schiessleiter: "Leo",
      schuetzenNamen: ["Leo"]
    });
    const withKostenlos = {
      ...runde,
      rotte: runde.rotte.map((s) => (s.name === "Leo" ? { ...s, kostenlos: true } : s))
    };
    const csv = exportRundenCsv([withKostenlos]);
    const lines = csv.split("\n");
    expect(lines[0]).toContain("kostenlos");
    expect(lines[1]).toContain("ja");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/export/export.test.ts`
Expected: FAIL – no `kostenlos` column.

- [ ] **Step 3: Update CSV export**

In `src/export/csv.ts`:

```ts
export function exportRundenCsv(runden: Runde[]): string {
  const header = [
    "rundenId",
    "rundenzeit",
    "schiessleiter",
    "schuetze",
    "gaststatus",
    "zahlungsstatus",
    "kostenlos",
    "ergebnis",
    ...Array.from({ length: 25 }, (_, index) => `taube_${index + 1}`)
  ];

  const rows = runden.flatMap((runde) =>
    runde.rotte.map((schuetze) => [
      runde.id,
      runde.rundenzeit,
      runde.schiessleiter,
      schuetze.name,
      schuetze.gaststatus ? "ja" : "nein",
      schuetze.zahlungsstatus ? "ja" : "nein",
      schuetze.kostenlos ? "ja" : "nein",
      String(schuetzenErgebnis(schuetze)),
      ...schuetze.tauben.map((taube) => taube.status)
    ])
  );

  return [header, ...rows].map((row) => row.map(escapeCsvValue).join(",")).join("\n");
}
```

- [ ] **Step 4: Update existing export.test.ts assertions**

Existing assertions in `src/export/export.test.ts` expect the old column order (`zahlungsstatus` immediately followed by `ergebnis`). Update them to include the new `kostenlos` column between `zahlungsstatus` and `ergebnis`.

- [ ] **Step 5: Run all export tests**

Run: `npm test -- src/export/export.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/export/csv.ts src/export/export.test.ts
git commit -m "feat(csv): add kostenlos column"
```

---

### Task 8: RundenEditor – Kostenlos-Checkbox und gegenseitiger Ausschluss

**Files:**
- Modify: `src/App.tsx`
- Test: `src/App.test.tsx`

- [ ] **Step 1: Write failing test**

In `src/App.test.tsx`:

```ts
import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { App } from "./App";

describe("RundenEditor kostenlos", () => {
  it("shows Kostenlos checkbox", () => {
    render(<App />);
    fireEvent.click(screen.getByText("Neue Runde"));
    expect(screen.getByLabelText(/.*ist kostenlos/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/App.test.tsx`
Expected: FAIL – no "Kostenlos" checkbox.

- [ ] **Step 3: Add Kostenlos column and mutual exclusion**

In `src/App.tsx`, in the `setup-table` header:

```tsx
<thead>
  <tr>
    <th>Schuetze</th>
    <th>Gast</th>
    <th>Kostenlos</th>
    <th>Bezahlt</th>
    <th>Aktion</th>
  </tr>
</thead>
```

Add a new `<td>` in the row renderer, between Gast and Bezahlt:

```tsx
<td>
  <label className="compact-check">
    <input
      type="checkbox"
      checked={schuetze.kostenlos}
      disabled={ergebnisseLocked}
      onChange={(event) =>
        onChange(updateSchuetze(runde, schuetze.id, {
          kostenlos: event.target.checked,
          zahlungsstatus: event.target.checked ? false : schuetze.zahlungsstatus
        }))
      }
    />
    <span>{(schuetze.name || `Schuetze ${schuetzeIndex + 1}`)} ist kostenlos</span>
  </label>
</td>
```

Update the Bezahlt checkbox to be disabled when kostenlos:

```tsx
<td>
  <label className="compact-check">
    <input
      type="checkbox"
      checked={schuetze.zahlungsstatus}
      disabled={ergebnisseLocked || schuetze.kostenlos}
      onChange={(event) =>
        onChange(updateSchuetze(runde, schuetze.id, { zahlungsstatus: event.target.checked }))
      }
    />
    <span>{(schuetze.name || `Schuetze ${schuetzeIndex + 1}`)} hat bezahlt</span>
  </label>
</td>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/App.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat(editor): add Kostenlos checkbox with Bezahlt exclusion"
```

---

### Task 9: RundenEditor – Schießleiter in Schützen-Vorschlägen und Auto-Markierung

**Files:**
- Modify: `src/App.tsx`
- Test: `src/App.test.tsx`

- [ ] **Step 1: Write failing test**

In `src/App.test.tsx`:

```ts
describe("Schiessleiter freirunde", () => {
  it("marks schiessleiter as kostenlos when added as shooter", () => {
    render(<App />);
    fireEvent.click(screen.getByText("Neue Runde"));

    const schiessleiterInput = screen.getByLabelText("Schießleiter");
    fireEvent.change(schiessleiterInput, { target: { value: "Leo" } });

    const shooterInput = screen.getByLabelText("Name Schuetze 1");
    fireEvent.change(shooterInput, { target: { value: "Leo" } });

    const kostenlosCheckbox = screen.getByLabelText(/Leo ist kostenlos/i);
    expect(kostenlosCheckbox).toBeChecked();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/App.test.tsx`
Expected: FAIL – checkbox not checked.

- [ ] **Step 3: Merge Schießleiter into known shooters and auto-apply freirunde**

In `src/App.tsx`, update `getKnownShooters` to include known Schiessleiter as non-guest shooters:

```ts
interface KnownShooter {
  name: string;
  gaststatus: boolean;
}

function getKnownShooters(schuetzen: GespeicherterSchuetze[], runden: Runde[]): KnownShooter[] {
  const byName = new Map<string, boolean>();

  for (const schuetze of schuetzen) {
    byName.set(schuetze.name, schuetze.gaststatus);
  }

  for (const runde of runden) {
    const name = runde.schiessleiter.trim();
    if (name && !byName.has(name)) {
      byName.set(name, false);
    }
  }

  return Array.from(byName.entries())
    .map(([name, gaststatus]) => ({ name, gaststatus }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
```

Update the `RundenEditor` call to pass `runden`:

```tsx
const knownShooters = getKnownShooters(schuetzen, runden);
```

Update `updateShooterName` to apply freirunde:

```tsx
function updateShooterName(schuetzeId: string, name: string) {
  const knownShooter = knownShooters.find((schuetze) => schuetze.name === name);
  const patch: Partial<Omit<Schuetze, "id" | "tauben">> = knownShooter
    ? { name, gaststatus: knownShooter.gaststatus }
    : { name };

  let nextRunde = updateSchuetze(runde, schuetzeId, patch);

  if (name.trim().toLocaleLowerCase() === runde.schiessleiter.trim().toLocaleLowerCase()) {
    nextRunde = ensureSchiessleiterFreirunde(nextRunde, runden);
  }

  onChange(nextRunde);
}
```

Also update `applyKnownShooter`:

```tsx
function applyKnownShooter(schuetzeId: string, knownShooter: KnownShooter) {
  let nextRunde = updateSchuetze(runde, schuetzeId, {
    name: knownShooter.name,
    gaststatus: knownShooter.gaststatus
  });

  if (knownShooter.name.trim().toLocaleLowerCase() === runde.schiessleiter.trim().toLocaleLowerCase()) {
    nextRunde = ensureSchiessleiterFreirunde(nextRunde, runden);
  }

  onChange(nextRunde);
}
```

Also update `addRecentSchuetze` so that clicking a recent-shooter pill triggers the free-round logic when the name matches the Schießleiter:

```tsx
function addRecentSchuetze(schuetze: GespeicherterSchuetze) {
  if (rotteLocked || ergebnisseLocked || currentShooterNames.has(schuetze.name)) {
    return;
  }

  const emptySchuetze = runde.rotte.find((entry) => entry.name.trim().length === 0);
  if (emptySchuetze) {
    let nextRunde = updateSchuetze(runde, emptySchuetze.id, {
      name: schuetze.name,
      gaststatus: schuetze.gaststatus
    });
    if (schuetze.name.trim().toLocaleLowerCase() === runde.schiessleiter.trim().toLocaleLowerCase()) {
      nextRunde = ensureSchiessleiterFreirunde(nextRunde, runden);
    }
    onChange(nextRunde);
    return;
  }

  if (runde.rotte.length < 6) {
    let nextRunde = addSchuetze(runde);
    const newSchuetze = nextRunde.rotte[nextRunde.rotte.length - 1];
    nextRunde = updateSchuetze(nextRunde, newSchuetze.id, {
      name: schuetze.name,
      gaststatus: schuetze.gaststatus
    });
    if (schuetze.name.trim().toLocaleLowerCase() === runde.schiessleiter.trim().toLocaleLowerCase()) {
      nextRunde = ensureSchiessleiterFreirunde(nextRunde, runden);
    }
    onChange(nextRunde);
  }
}
```

Ensure `src/App.tsx` imports `ensureSchiessleiterFreirunde` from `./domain/runden`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/App.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat(editor): suggest schiessleiter as shooter and auto-apply free round"
```

---

### Task 10: RundenListe – unbezahlt-Zähler exkludiert kostenlos

**Files:**
- Modify: `src/App.tsx`
- Test: `src/App.test.tsx`

- [ ] **Step 1: Write failing test**

In `src/App.test.tsx`:

```ts
describe("RundenListe kostenlos", () => {
  it("does not count kostenlos shooters as unbezahlt", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /neue runde/i }));
    await user.type(screen.getByLabelText(/schie(?:ß|ss)leiter/i), "Leiter");
    await user.clear(screen.getByLabelText(/name schuetze 1/i));
    await user.type(screen.getByLabelText(/name schuetze 1/i), "Bernd");
    await user.click(screen.getByRole("checkbox", { name: /bernd ist kostenlos/i }));
    await startRunde(user);
    const berndRow = screen.getByRole("row", { name: /bernd/i });
    await user.click(within(berndRow).getByRole("button", { name: /taube 1 als treffer markieren/i }));
    await user.click(screen.getByRole("button", { name: /runde beenden/i }));
    await user.click(screen.getByRole("button", { name: /zurueck zur liste/i }));
    expect(screen.getByText(/0 unbezahlt/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/App.test.tsx`
Expected: FAIL – checkbox "Bernd ist kostenlos" not found.

- [ ] **Step 3: Update unpaid count**

In `src/App.tsx`, in `RundenListItem`:

```tsx
const offen = runde.rotte.filter((schuetze) => !schuetze.kostenlos && !schuetze.zahlungsstatus).length;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/App.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat(list): exclude kostenlos shooters from unpaid count"
```

---

### Task 11: DayPaymentDialog – kostenlose Schützen korrekt anzeigen

**Files:**
- Modify: `src/App.tsx`
- Test: `src/App.test.tsx`

- [ ] **Step 1: Write failing test**

In `src/App.test.tsx`:

```ts
describe("DayPaymentDialog kostenlos", () => {
  it("shows kostenlos shooter with zero amount and disabled checkbox", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /neue runde/i }));
    await user.type(screen.getByLabelText(/schie(?:ß|ss)leiter/i), "Leiter");
    await user.clear(screen.getByLabelText(/name schuetze 1/i));
    await user.type(screen.getByLabelText(/name schuetze 1/i), "Bernd");
    await user.click(screen.getByRole("checkbox", { name: /bernd ist kostenlos/i }));
    await startRunde(user);
    const berndRow = screen.getByRole("row", { name: /bernd/i });
    await user.click(within(berndRow).getByRole("button", { name: /taube 1 als treffer markieren/i }));
    await user.click(screen.getByRole("button", { name: /runde beenden/i }));
    await user.click(screen.getByRole("button", { name: /zurueck zur liste/i }));

    await user.click(screen.getByRole("button", { name: /bezahlen/i }));
    expect(screen.getByText(/0,00 €/i)).toBeInTheDocument();
    expect(screen.getByText(/kostenlos/i)).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /bernd bezahlt/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/App.test.tsx`
Expected: FAIL – amount not 0,00 € or checkbox not disabled.

- [ ] **Step 3: Update `getDayPaymentShooters`**

In `src/App.tsx`:

```ts
function getDayPaymentShooters(runden: Runde[]): DayPaymentShooter[] {
  const shooters = new Map<string, DayPaymentShooter>();

  for (const runde of runden) {
    for (const schuetze of runde.rotte) {
      const name = schuetze.name.trim();
      if (!name) {
        continue;
      }

      if (isKostenlos(schuetze)) {
        const current = shooters.get(name);
        shooters.set(name, {
          name,
          roundCount: current?.roundCount ?? 0,
          gaststatus: Boolean(current?.gaststatus || schuetze.gaststatus),
          paid: current ? current.paid : true,
          amountCent: current?.amountCent ?? 0
        });
        continue;
      }

      const current = shooters.get(name);
      shooters.set(name, {
        name,
        roundCount: (current?.roundCount ?? 0) + 1,
        gaststatus: Boolean(current?.gaststatus || schuetze.gaststatus),
        paid: current ? current.paid && schuetze.zahlungsstatus : schuetze.zahlungsstatus,
        amountCent: (current?.amountCent ?? 0) + getSchuetzenPreisCent(runde, schuetze)
      });
    }
  }

  return Array.from(shooters.values()).sort((a, b) => a.name.localeCompare(b.name));
}
```

Ensure `src/App.tsx` imports `isKostenlos` from `./domain/runden`.

- [ ] **Step 4: Disable checkbox for kostenlos / zero-amount shooters**

In `DayPaymentDialog`, update the row renderer:

```tsx
{shooters.map((schuetze) => {
  const isKostenlosShooter = schuetze.amountCent === 0 && schuetze.roundCount === 0;
  return (
    <label key={schuetze.name} className={`payment-row${isKostenlosShooter ? " payment-row-kostenlos" : ""}`}>
      <input
        type="checkbox"
        aria-label={`${schuetze.name} bezahlt`}
        checked={schuetze.paid}
        disabled={isKostenlosShooter}
        onChange={(event) => onTogglePaid(schuetze.name, event.target.checked)}
      />
      <span className="payment-person">
        <span className="payment-name">{schuetze.name}</span>
        {schuetze.gaststatus && <span className="round-badge">Gast</span>}
        {isKostenlosShooter && <span className="round-badge">Kostenlos</span>}
      </span>
      <span className="payment-rounds">{formatRoundCount(schuetze.roundCount)}</span>
      <span className="payment-amount">{formatMoney(schuetze.amountCent)}</span>
    </label>
  );
})}
```

- [ ] **Step 5: Run tests**

Run: `npm test -- src/App.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat(payment): handle kostenlos shooters in day payment dialog"
```

**Note on CSS:** The `payment-row-kostenlos` class is added for future styling but is not required; the existing `.payment-row` and badge styles provide sufficient visual distinction.

---

### Task 12: Deutsches Datumsformat überall

**Files:**
- Modify: `src/domain/runden.ts`
- Modify: `src/App.tsx`
- Test: `src/domain/runden.test.ts`

- [ ] **Step 1: Write failing test**

In `src/domain/runden.test.ts`:

```ts
import { formatRundenzeitDeutsch } from "./runden";

describe("formatRundenzeitDeutsch", () => {
  it("returns fallback for empty value", () => {
    expect(formatRundenzeitDeutsch("")).toBe("Rundenzeit offen");
  });

  it("formats datetime to german format", () => {
    expect(formatRundenzeitDeutsch("2026-04-23T09:30")).toBe("23.04.2026 09:30");
  });

  it("formats date-only to german format", () => {
    expect(formatRundenzeitDeutsch("2026-04-23")).toBe("23.04.2026");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/domain/runden.test.ts`
Expected: FAIL – function not defined.

- [ ] **Step 3: Implement formatter and update call sites**

In `src/domain/runden.ts`:

```ts
export function formatRundenzeitDeutsch(value: string): string {
  if (!value) {
    return "Rundenzeit offen";
  }

  const [datePart, timePart] = value.split("T");
  const [year, month, day] = datePart.split("-");
  const germanDate = `${day}.${month}.${year}`;
  return timePart ? `${germanDate} ${timePart.slice(0, 5)}` : germanDate;
}
```

In `src/App.tsx`:

- Replace `formatRundenzeit` with `formatRundenzeitDeutsch` in `RundenListItem`.
- Replace `formatRundenzeit` in `PapierkorbView`.
- Replace `formatRundenzeit` with `formatRundenzeitDeutsch` in `PrintView`.
- Delete the old `formatRundenzeit` function.

Ensure `src/App.tsx` imports `formatRundenzeitDeutsch` from `./domain/runden`.

- [ ] **Step 4: Run tests**

Run: `npm test -- src/domain/runden.test.ts`
Expected: PASS

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/domain/runden.ts src/domain/runden.test.ts src/App.tsx
git commit -m "feat(format): use german date format for all displayed datetimes"
```

---

### Task 13: Druckansicht – Kostenlos-Spalte und deutsches Datum

**Files:**
- Modify: `src/App.tsx`
- Test: `src/App.test.tsx`

- [ ] **Step 1: Write failing test**

In `src/App.test.tsx`:

```ts
describe("Druckansicht kostenlos und datum", () => {
  it("shows kostenlos column and german date", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /neue runde/i }));
    await user.type(screen.getByLabelText(/schie(?:ß|ss)leiter/i), "Leiter");
    await user.clear(screen.getByLabelText(/name schuetze 1/i));
    await user.type(screen.getByLabelText(/name schuetze 1/i), "Bernd");
    await user.click(screen.getByRole("checkbox", { name: /bernd ist kostenlos/i }));
    await startRunde(user);
    const berndRow = screen.getByRole("row", { name: /bernd/i });
    await user.click(within(berndRow).getByRole("button", { name: /taube 1 als treffer markieren/i }));
    await user.click(screen.getByRole("button", { name: /runde beenden/i }));
    await user.click(screen.getByRole("button", { name: /zurueck zur liste/i }));

    await user.click(screen.getByRole("button", { name: /anna|bernd/i })); // open round
    await user.click(screen.getByRole("button", { name: /druckansicht/i }));
    expect(screen.getByText(/kostenlos/i)).toBeInTheDocument();
    expect(screen.getByText(/\d{2}\.\d{2}\.\d{4}/i)).toBeInTheDocument();
  });
});
```



- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/App.test.tsx`
Expected: FAIL – no Kostenlos column or german date.

- [ ] **Step 3: Add Kostenlos column to print tables**

In `PrintEinzelergebnisse`:

```tsx
<thead>
  <tr>
    <th>Schuetze</th>
    {Array.from({ length: 25 }, (_, index) => <th key={index}>Zwischenstand {index + 1}</th>)}
    <th>Gast</th>
    <th>Ergebnis</th>
    <th>Kostenlos</th>
    <th>Bezahlt</th>
  </tr>
</thead>
<tbody>
  {runde.rotte.map((schuetze) => (
    <tr key={schuetze.id}>
      <th>{schuetze.name}</th>
      {cumulativeErgebnisse(schuetze).map((value, index) => <td key={index}>{value}</td>)}
      <td>{schuetze.gaststatus ? "ja" : "nein"}</td>
      <td>{schuetzenErgebnis(schuetze)}</td>
      <td>{schuetze.kostenlos ? "ja" : "nein"}</td>
      <td>{schuetze.zahlungsstatus ? "ja" : "nein"}</td>
    </tr>
  ))}
</tbody>
```

In `PrintZusammenfassung`:

```tsx
<thead>
  <tr>
    <th>Schuetze</th>
    <th>Gast</th>
    <th>Ergebnis</th>
    <th>Kostenlos</th>
    <th>Bezahlt</th>
  </tr>
</thead>
```

Add corresponding body cell.

- [ ] **Step 4: Run tests**

Run: `npm test -- src/App.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat(print): add kostenlos column"
```

---

### Task 14: Full verification

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 2: Type-check**

Run: `npm run lint`
Expected: No TypeScript errors.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git commit --allow-empty -m "chore: verify full feature passes tests and build"
```

---

## Plan Review

After completing the plan, dispatch the plan-document-reviewer subagent with the plan and spec paths.
