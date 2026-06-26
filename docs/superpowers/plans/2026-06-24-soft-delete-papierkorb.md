# Soft-Delete und Papierkorb Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Runden sollen nicht mehr direkt gelöscht werden, sondern zunächst als gelöscht markiert werden. Gelöschte Runden sind in einem Papierkorb (Einstellungen-Menü) wiederherstellbar oder endgültig löschbar. Endgültiges Löschen erfordert die Texteingabe `Loeschen`.

**Architecture:** Ein optionales `geloescht: boolean` Feld auf `Runde` steuert die Sichtbarkeit. `LocalDatenbestand.list()` filtert gelöschte Runden aus; `listGeloescht()` liefert sie. Die bestehende `delete(id)` Methode wird durch `softDelete(id)` ersetzt. Ein neuer `papierkorb` View in `App.tsx` zeigt gelöschte Runden und bietet Wiederherstellen sowie einen Dialog für endgültiges Löschen.

**Tech Stack:** TypeScript, React, Vite, Vitest, React Testing Library, localStorage

---

## File Map

| File | Responsibility |
|------|----------------|
| `src/domain/model.ts` | `Runde` interface bekommt `geloescht?: boolean`. |
| `src/domain/runden.ts` | Neue Hilfsfunktion `isGeloescht(runde)`.
| `src/export/backup.ts` | `isRunde` Validierung akzeptiert `geloescht?: boolean`. |
| `src/storage/datenbestand.ts` | `list()` filtert; neue Methoden `listGeloescht()`, `softDelete(id)`, `restore(id)`, `deletePermanent(id)`. |
| `src/App.tsx` | Soft-Delete ohne Inline-Bestätigung; neuer View `"papierkorb"`; Papierkorb-UI; Textbestätigungsdialog. |
| `src/styles.css` | Ggf. Styles für Papierkorb und Lösch-Bestätigung. |
| `src/domain/runden.test.ts` | Test für `isGeloescht()`. |
| `src/export/backup.test.ts` | Test für Backup-Roundtrip mit `geloescht`-Flag. |
| `src/storage/datenbestand.test.ts` | Tests für Soft-Delete, Wiederherstellen, permanentes Löschen. |
| `src/App.test.tsx` | Tests für Soft-Delete, Papierkorb-Zugriff, Wiederherstellen, Textbestätigung. |

---

## Task 1: Datenmodell erweitern und Domain-Hilfsfunktion hinzufügen

**Files:**
- Modify: `src/domain/model.ts:28-36`
- Modify: `src/domain/runden.ts`
- Test: `src/domain/runden.test.ts`

### Step 1.1: Write the failing test

Add to `src/domain/runden.test.ts`:

```ts
it("detects deleted Runden", () => {
  const runde = createRunde({
    id: "runde-1",
    rundenzeit: "2026-05-30T14:00",
    schiessleiter: "Dieter",
    schuetzenNamen: ["Anna"]
  });

  expect(isGeloescht(runde)).toBe(false);
  expect(isGeloescht({ ...runde, geloescht: true })).toBe(true);
  expect(isGeloescht({ ...runde, geloescht: false })).toBe(false);
});
```

### Step 1.2: Run test to verify it fails

```bash
npx vitest run src/domain/runden.test.ts
```

Expected: FAIL with "isGeloescht is not defined"

### Step 1.3: Add `geloescht` to model and implement `isGeloescht`

Modify `src/domain/model.ts`:

```ts
export interface Runde {
  id: string;
  rundenzeit: string;
  schiessleiter: string;
  gesperrt?: boolean;
  sicherheitBestaetigt?: boolean;
  preise?: RundenPreise;
  geloescht?: boolean;
  rotte: Schuetze[];
}
```

Add to `src/domain/runden.ts` (near `isEntwurf`):

```ts
export function isGeloescht(runde: Runde): boolean {
  return runde.geloescht === true;
}
```

Export `isGeloescht` from `src/domain/runden.ts` and import it in the test.

### Step 1.4: Run test to verify it passes

```bash
npx vitest run src/domain/runden.test.ts
```

Expected: PASS

### Step 1.5: Commit

```bash
git add src/domain/model.ts src/domain/runden.ts src/domain/runden.test.ts
git commit -m "feat(domain): add geloescht flag and isGeloescht helper"
```

---

## Task 2: Backup-Validierung für `geloescht` erweitern

**Files:**
- Modify: `src/export/backup.ts:36-50`

### Step 2.1: Write the failing test

There is no existing backup test file. Verify behavior manually by adding a temporary inline check or rely on existing import flow. For a dedicated test, create `src/export/backup.test.ts`:

```ts
import { importBackupJson, exportBackupJson } from "./backup";
import { createRunde } from "../domain/runden";

describe("backup", () => {
  it("round-trips a Runde with geloescht flag", () => {
    const runde = { ...createRunde({ id: "r-1", rundenzeit: "2026-05-30T10:00", schiessleiter: "Dieter", schuetzenNamen: ["Anna"] }), geloescht: true };
    const exported = exportBackupJson({ runden: [runde], schuetzen: [], preise: { mitgliedCent: 500, gastCent: 800 } });
    const imported = importBackupJson(exported);
    expect(imported.runden[0].geloescht).toBe(true);
  });
});
```

### Step 2.2: Run test to verify it fails

```bash
npx vitest run src/export/backup.test.ts
```

Expected: FAIL with invalid backup because `geloescht` is rejected.

### Step 2.3: Extend `isRunde`

Modify `src/export/backup.ts` inside `isRunde`:

```ts
(value.geloescht === undefined || typeof value.geloescht === "boolean") &&
```

Add this line after the `sicherheitBestaetigt` check.

### Step 2.4: Run test to verify it passes

```bash
npx vitest run src/export/backup.test.ts
```

Expected: PASS

### Step 2.5: Commit

```bash
git add src/export/backup.ts src/export/backup.test.ts
git commit -m "feat(backup): accept geloescht flag in backup validation"
```

---

## Task 3: Speicher-Schicht für Soft-Delete anpassen

**Files:**
- Modify: `src/storage/datenbestand.ts`

### Step 3.1: Write the failing tests

Modify `src/storage/datenbestand.test.ts`. Replace the existing delete test with these two tests, and keep the existing `replace` test:

```ts
it("soft-deletes Runden, lists them separately and restores them", () => {
  const store = new LocalDatenbestand("test-store");
  const runde = createRunde({
    id: "runde-1",
    rundenzeit: "2026-05-30T10:00",
    schiessleiter: "Dieter",
    schuetzenNamen: ["Anna"]
  });

  store.save(runde);
  store.softDelete("runde-1");

  expect(store.list()).toEqual([]);
  expect(store.listGeloescht().map((r) => r.id)).toEqual(["runde-1"]);
  expect(store.get("runde-1")?.geloescht).toBe(true);

  store.restore("runde-1");

  expect(store.list().map((r) => r.id)).toEqual(["runde-1"]);
  expect(store.listGeloescht()).toEqual([]);
  expect(store.get("runde-1")?.geloescht).toBe(false);
});

it("permanently deletes Runden", () => {
  const store = new LocalDatenbestand("test-store");
  const runde = createRunde({
    id: "runde-1",
    rundenzeit: "2026-05-30T10:00",
    schiessleiter: "Dieter",
    schuetzenNamen: ["Anna"]
  });

  store.save(runde);
  store.softDelete("runde-1");
  store.deletePermanent("runde-1");

  expect(store.list()).toEqual([]);
  expect(store.listGeloescht()).toEqual([]);
  expect(store.get("runde-1")).toBeUndefined();
});

it("replaces the complete Datenbestand", () => {
  const store = new LocalDatenbestand("test-store");
  const runde = createRunde({
    id: "runde-1",
    rundenzeit: "2026-05-30T10:00",
    schiessleiter: "Dieter",
    schuetzenNamen: ["Anna"]
  });

  store.save(runde);
  store.softDelete("runde-1");
  expect(store.list()).toEqual([]);

  store.replace({ runden: [runde] });
  expect(store.list()).toEqual([runde]);
});
```

### Step 3.2: Run tests to verify they fail

```bash
npx vitest run src/storage/datenbestand.test.ts
```

Expected: FAIL with "softDelete is not a function" etc.

### Step 3.3: Implement storage changes

Modify `src/storage/datenbestand.ts`:

1. Change `list()`:

```ts
list(): Runde[] {
  return [...this.read().runden]
    .filter((runde) => !runde.geloescht)
    .sort((a, b) => b.rundenzeit.localeCompare(a.rundenzeit));
}
```

2. Add `listGeloescht()` after `list()`:

```ts
listGeloescht(): Runde[] {
  return [...this.read().runden]
    .filter((runde) => runde.geloescht === true)
    .sort((a, b) => b.rundenzeit.localeCompare(a.rundenzeit));
}
```

3. Replace `delete(id)` with `softDelete(id)`:

```ts
softDelete(id: string): void {
  const runde = this.get(id);
  if (runde) {
    this.save({ ...runde, geloescht: true });
  }
}
```

4. Add `restore(id)` and `deletePermanent(id)`:

```ts
restore(id: string): void {
  const runde = this.get(id);
  if (runde) {
    this.save({ ...runde, geloescht: false });
  }
}

deletePermanent(id: string): void {
  const datenbestand = this.read();
  this.write({ ...datenbestand, runden: datenbestand.runden.filter((runde) => runde.id !== id) });
}
```

### Step 3.4: Run tests to verify they pass

```bash
npx vitest run src/storage/datenbestand.test.ts
```

Expected: PASS

### Step 3.5: Commit

```bash
git add src/storage/datenbestand.ts src/storage/datenbestand.test.ts
git commit -m "feat(storage): implement soft-delete, restore and permanent delete"
```

---

## Task 4: App-UI – Soft-Delete in der Rundenliste

**Files:**
- Modify: `src/App.tsx`

### Step 4.1: Update App state and handlers

1. Remove `deleteCandidate` state:

```ts
// Remove: const [deleteCandidate, setDeleteCandidate] = useState<string | null>(null);
```

2. Rename `confirmDelete` to `softDeleteRunde` and use `store.softDelete`:

```ts
function softDeleteRunde(id: string) {
  store.softDelete(id);
  if (activeId === id) {
    setActiveId(null);
    setView("list");
  }
  refreshRunden();
  setMessage("Runde geloescht.");
}
```

3. Add restore and permanent delete handlers:

```ts
function restoreRunde(id: string) {
  store.restore(id);
  refreshRunden();
  setMessage("Runde wiederhergestellt.");
}

function permanentlyDeleteRunde(id: string) {
  store.deletePermanent(id);
  refreshRunden();
  setMessage("Runde endgueltig geloescht.");
}
```

### Step 4.2: Simplify `RundenListe` and `RundenListItem`

Remove `deleteCandidate`, `onAskDelete`, `onConfirmDelete`, `onCancelDelete` props from `RundenListeProps` and `RundenListItemProps`.

In `RundenListItem`, replace the delete confirmation block with a simple soft-delete button:

```tsx
function RundenListItem({ runde, onOpen, onSoftDelete }: RundenListItemProps) {
  // ... existing code ...
  return (
    <li className="round-row">
      <button className="round-open" onClick={() => onOpen(runde.id)}>
        {/* existing content */}
      </button>
      <button className="danger" onClick={() => onSoftDelete(runde.id)}>Loeschen</button>
    </li>
  );
}
```

Update `RundenListe` to pass `onSoftDelete` instead of delete-candidate props.

### Step 4.3: Update main render

In the main `RundenListe` call, remove `deleteCandidate`, `onAskDelete`, `onConfirmDelete`, `onCancelDelete` and pass `onSoftDelete={softDeleteRunde}`:

```tsx
<RundenListe
  runden={runden}
  preise={preise}
  onOpen={(id) => {
    setEditorRecentSchuetzen(store.listRecentSchuetzen(20));
    setActiveId(id);
    setView("editor");
  }}
  onSoftDelete={softDeleteRunde}
  onPrintDay={(day) => {
    setPrintDay(day);
    setView("day-print");
  }}
  onPayDay={setPaymentDay}
  onPreiseChange={updatePreise}
/>
```

### Step 4.4: Run tests

```bash
npx vitest run src/App.test.tsx
```

Expected: Some existing tests fail because the old inline delete confirmation is gone. Note failures for next task.

### Step 4.5: Commit

```bash
git add src/App.tsx
git commit -m "feat(app): soft-delete rounds from list without inline confirmation"
```

---

## Task 5: App-UI – Papierkorb-Ansicht und Menüeintrag

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

### Step 5.1: Add `"papierkorb"` to View type

```ts
type View = "list" | "editor" | "start-confirm" | "capture" | "print" | "day-print" | "schuetzen" | "rangliste" | "papierkorb";
```

### Step 5.2: Add menu item

In the Einstellungen menu, add:

```tsx
<button
  role="menuitem"
  onClick={() => {
    setShowMainSettings(false);
    setActiveId(null);
    setView("papierkorb");
  }}
>
  Papierkorb
</button>
```

### Step 5.3: Load deleted rounds and render Papierkorb inside the App shell

`store.list()` now filters out deleted rounds, so we need a separate state for them. Change `refreshRunden` to also load deleted rounds:

```ts
const [geloeschteRunden, setGeloeschteRunden] = useState<Runde[]>(() => store.listGeloescht());

function refreshRunden() {
  setRunden(store.list());
  setGeloeschteRunden(store.listGeloescht());
  setSchuetzen(store.listSchuetzen());
  setPreise(store.getPreise());
}
```

Render the Papierkorb inside the main `app-shell` content area, alongside the existing `schuetzen`, `rangliste`, `editor` and `list` branches. Do NOT use an early `return` before the `app-shell` markup, otherwise the topbar and status messages would disappear.

In the main ternary where views are selected (around the existing `view === "schuetzen" ? ... : view === "rangliste" ? ...` chain), add a new branch:

```tsx
) : view === "papierkorb" ? (
  <PapierkorbView
    runden={geloeschteRunden}
    onBack={() => setView("list")}
    onRestore={restoreRunde}
    onPermanentDelete={permanentlyDeleteRunde}
  />
) : (
```

### Step 5.4: Implement `PapierkorbView` component

Add near the bottom of `App.tsx`:

```tsx
interface PapierkorbViewProps {
  runden: Runde[];
  onBack: () => void;
  onRestore: (id: string) => void;
  onPermanentDelete: (id: string) => void;
}

function PapierkorbView({ runden, onBack, onRestore, onPermanentDelete }: PapierkorbViewProps) {
  const [deleteCandidate, setDeleteCandidate] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const groupedRunden = groupRundenByDay(runden);

  function askPermanentDelete(id: string) {
    setDeleteCandidate(id);
    setConfirmText("");
  }

  function cancelPermanentDelete() {
    setDeleteCandidate(null);
    setConfirmText("");
  }

  function confirmPermanentDelete(id: string) {
    onPermanentDelete(id);
    setDeleteCandidate(null);
    setConfirmText("");
  }

  return (
    <section className="panel">
      <div className="section-header">
        <h2>Papierkorb</h2>
        <button onClick={onBack}>Zurück zur Liste</button>
      </div>
      {runden.length === 0 ? (
        <p className="empty-state">Keine geloeschten Runden.</p>
      ) : (
        <div className="round-groups">
          {groupedRunden.map((group) => (
            <section key={group.key} className="round-group">
              <h3>{group.label}</h3>
              <ul className="round-list">
                {group.runden.map((runde) => (
                  <li key={runde.id} className="round-row">
                    <div className="round-open">
                      <strong>{runde.rotte.map((s) => s.name || "Unbenannt").join(", ")}</strong>
                      <span>{formatRundenzeit(runde.rundenzeit)} · {runde.schiessleiter || "Schießleiter offen"}</span>
                    </div>
                    <div className="trash-actions">
                      <button onClick={() => onRestore(runde.id)}>Wiederherstellen</button>
                      <button
                        className="danger"
                        aria-label="Runde endgueltig loeschen"
                        onClick={() => askPermanentDelete(runde.id)}
                      >
                        Endgueltig loeschen
                      </button>
                    </div>
                    {deleteCandidate === runde.id && (
                      <div className="confirm-delete permanent-delete-confirm">
                        <label>
                          Wirklich löschen?
                          <input
                            value={confirmText}
                            onChange={(event) => setConfirmText(event.target.value)}
                            placeholder="Loeschen"
                            aria-label="Zum Bestaetigen Loeschen eingeben"
                          />
                        </label>
                        <button
                          className="danger"
                          aria-label="Runde endgueltig loeschen bestaetigen"
                          disabled={confirmText !== "Loeschen"}
                          onClick={() => confirmPermanentDelete(runde.id)}
                        >
                          Endgueltig loeschen
                        </button>
                        <button onClick={cancelPermanentDelete}>Abbrechen</button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
```

### Step 5.5: Add CSS for trash actions

Add to `src/styles.css`:

```css
.trash-actions {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.permanent-delete-confirm {
  align-items: end;
  display: grid;
  gap: 0.5rem;
  grid-column: 1 / -1;
}

.permanent-delete-confirm label {
  display: grid;
  gap: 0.3rem;
  width: 100%;
}
```

### Step 5.6: Run tests

```bash
npx vitest run src/App.test.tsx
```

Expected: Still some failures from the old delete test.

### Step 5.7: Commit

```bash
git add src/App.tsx src/styles.css
git commit -m "feat(app): add papierkorb view with restore and permanent delete"
```

---

## Task 6: App-Tests anpassen und erweitern

**Files:**
- Modify: `src/App.test.tsx`

### Step 6.1: Update existing tests

1. In the test "keeps secondary actions in the Einstellungen menu", add assertions for the new Papierkorb menu item:

```ts
expect(screen.queryByRole("button", { name: /^papierkorb$/i })).not.toBeInTheDocument();

await user.click(screen.getByRole("button", { name: /^einstellungen$/i }));

expect(screen.getByRole("menuitem", { name: /^papierkorb$/i })).toBeInTheDocument();
```

2. In the test "shows Druckansicht, exports selected day as CSV and deletes a Runde after confirmation", replace the delete assertion:

```ts
const row = screen.getByRole("listitem");
await user.click(within(row).getByRole("button", { name: /loeschen/i }));
expect(screen.getByText(/keine runden/i)).toBeInTheDocument();
```

Remove the old "Wirklich loeschen" click.

### Step 6.2: Add new tests

Add a new test for the Papierkorb flow:

```ts
it("moves a deleted Runde to the Papierkorb and allows restore and permanent delete", async () => {
  const user = userEvent.setup();
  render(<App />);

  await user.click(screen.getByRole("button", { name: /neue runde/i }));
  await user.type(screen.getByLabelText(/schie(?:ß|ss)leiter/i), "Leiter");
  await user.clear(screen.getByLabelText(/name schuetze 1/i));
  await user.type(screen.getByLabelText(/name schuetze 1/i), "Bernd");
  await startRunde(user);
  await user.click(screen.getByRole("button", { name: /runde beenden/i }));
  await user.click(screen.getByRole("button", { name: /zurueck zur liste/i }));

  const row = screen.getByRole("listitem");
  await user.click(within(row).getByRole("button", { name: /loeschen/i }));
  expect(screen.getByText(/keine runden/i)).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: /^einstellungen$/i }));
  await user.click(screen.getByRole("menuitem", { name: /^papierkorb$/i }));
  expect(screen.getByRole("heading", { name: /^papierkorb$/i })).toBeInTheDocument();
  expect(screen.getByText(/bernd/i)).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: /wiederherstellen/i }));
  expect(screen.queryByText(/bernd/i)).not.toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: /zurück zur liste/i }));
  expect(screen.getByText(/bernd/i)).toBeInTheDocument();

  await user.click(within(screen.getByRole("listitem")).getByRole("button", { name: /loeschen/i }));
  await user.click(screen.getByRole("button", { name: /^einstellungen$/i }));
  await user.click(screen.getByRole("menuitem", { name: /^papierkorb$/i }));
  await user.click(screen.getByRole("button", { name: /^runde endgueltig loeschen$/i }));

  const confirmInput = screen.getByLabelText(/zum bestaetigen loeschen eingeben/i);
  await user.type(confirmInput, "Löschen");
  expect(screen.getByRole("button", { name: /endgueltig loeschen/i })).toBeDisabled();

  await user.clear(confirmInput);
  await user.type(confirmInput, "Loeschen");
  await user.click(screen.getByRole("button", { name: /runde endgueltig loeschen bestaetigen/i }));

  expect(screen.getByText(/keine geloeschten runden/i)).toBeInTheDocument();
  expect(screen.queryByText(/bernd/i)).not.toBeInTheDocument();
});
```

### Step 6.3: Run tests

```bash
npx vitest run src/App.test.tsx
```

Expected: PASS (after adjusting selectors if needed).

### Step 6.4: Run full test suite

```bash
npm test
```

Expected: All tests pass.

### Step 6.5: Commit

```bash
git add src/App.test.tsx
git commit -m "test(app): update and add tests for soft-delete and papierkorb"
```

---

## Task 7: Build verification

**Files:**
- None (verification only)

### Step 7.1: Run build

```bash
npm run build
```

Expected: Build succeeds without TypeScript or lint errors.

### Step 7.2: Commit if build succeeds

```bash
git commit --allow-empty -m "build: verify soft-delete feature builds cleanly"
```

---

## Notes for Implementer

- Keep changes minimal. Do not refactor unrelated parts of `App.tsx`.
- The `geloescht` field is optional; existing data and backups without it remain valid.
- The `round-row` CSS class already supports grid layout; the new confirm area can use `grid-column: 1 / -1` as the existing inline confirm delete does.
- `groupRundenByDay` and `sortRundenNewestFirst` helpers already exist in `App.tsx`; reuse them for the Papierkorb view.
