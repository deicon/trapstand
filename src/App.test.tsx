import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { App } from "./App";
import { createRunde } from "./domain/runden";
import { refreshPwa } from "./pwa/refresh";

vi.mock("./pwa/refresh", () => ({
  refreshPwa: vi.fn(() => Promise.resolve())
}));

describe("Trapstand app", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
    localStorage.clear();
    vi.mocked(refreshPwa).mockClear();
  });

  it("creates a Runde, autosaves fields, records Taubenstatus and shows Ergebnis", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /neue runde/i }));
    await user.clear(screen.getByLabelText(/schiessleiter/i));
    await user.type(screen.getByLabelText(/schiessleiter/i), "Dieter");
    await user.clear(screen.getByLabelText(/name schuetze 1/i));
    await user.type(screen.getByLabelText(/name schuetze 1/i), "Anna");
    await user.click(screen.getByRole("checkbox", { name: /anna ist gast/i }));
    await user.click(screen.getByRole("checkbox", { name: /anna hat bezahlt/i }));
    expect(screen.queryByRole("button", { name: /taube 1 als treffer markieren/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /runde starten/i }));
    const table = screen.getByRole("table", { name: /rundenerfassung/i });
    const annaRow = screen.getByRole("row", { name: /anna/i });

    expect(within(table).getByRole("columnheader", { name: "1" })).toBeInTheDocument();
    expect(within(annaRow).getByRole("button", { name: /taube 1 als treffer markieren/i })).toHaveTextContent("-");

    await user.click(within(annaRow).getByRole("button", { name: /taube 1 als treffer markieren/i }));
    expect(within(annaRow).getByRole("button", { name: /taube 1 treffer entfernen/i })).toHaveTextContent("1");

    await user.click(within(annaRow).getByRole("button", { name: /taube 2 als treffer markieren/i }));
    expect(within(annaRow).getByRole("button", { name: /taube 2 treffer entfernen/i })).toHaveTextContent("2");

    await user.click(within(annaRow).getByRole("button", { name: /taube 2 als fehler markieren/i }));
    expect(within(annaRow).getByRole("button", { name: /taube 2 fehler entfernen/i })).toHaveTextContent("1");

    await user.click(within(annaRow).getByRole("button", { name: /taube 2 fehler entfernen/i }));
    expect(within(annaRow).getByRole("button", { name: /taube 2 als treffer markieren/i })).toHaveTextContent("-");

    expect(screen.getByText(/ergebnis: 1/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /runde beenden/i }));
    expect(screen.getByRole("button", { name: /runde starten/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /taube 1 treffer entfernen/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /zurueck zur liste/i }));
    expect(screen.getByText(/anna/i)).toBeInTheDocument();
    expect(screen.queryByText(/entwurf/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /anna/i }));
    expect(screen.getByLabelText(/schiessleiter/i)).toHaveValue("Dieter");
    expect(screen.getByLabelText(/name schuetze 1/i)).toHaveValue("Anna");
    expect(screen.getByRole("checkbox", { name: /anna ist gast/i })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /anna hat bezahlt/i })).toBeChecked();
  });

  it("shows only the scoring table while a Runde is running", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /neue runde/i }));
    await user.clear(screen.getByLabelText(/name schuetze 1/i));
    await user.type(screen.getByLabelText(/name schuetze 1/i), "Anna");
    await user.click(screen.getByRole("button", { name: /schuetze hinzufuegen/i }));
    await user.type(screen.getByLabelText(/name schuetze 2/i), "Bernd");

    await user.click(screen.getByRole("button", { name: /runde starten/i }));

    expect(screen.getByRole("button", { name: /runde beenden/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/schiessleiter/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /schuetze hinzufuegen/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^entfernen$/i })).not.toBeInTheDocument();
    expect(screen.getByRole("row", { name: /anna/i })).toHaveStyle({ height: "50%" });
    expect(screen.getByRole("row", { name: /bernd/i })).toHaveStyle({ height: "50%" });
  });

  it("offers PWA refresh from list and capture views", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /aktualisieren/i }));
    expect(refreshPwa).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: /neue runde/i }));
    await user.click(screen.getByRole("button", { name: /runde starten/i }));
    await user.click(screen.getByRole("button", { name: /aktualisieren/i }));

    expect(refreshPwa).toHaveBeenCalledTimes(2);
  });

  it("exports CSV, shows Druckansicht and deletes a Runde after confirmation", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /neue runde/i }));
    await user.type(screen.getByLabelText(/schiessleiter/i), "Leiter");
    await user.clear(screen.getByLabelText(/name schuetze 1/i));
    await user.type(screen.getByLabelText(/name schuetze 1/i), "Bernd");
    await user.click(screen.getByRole("button", { name: /runde starten/i }));
    const berndRow = screen.getByRole("row", { name: /bernd/i });
    await user.click(within(berndRow).getByRole("button", { name: /taube 1 als treffer markieren/i }));

    await user.click(screen.getByRole("button", { name: /runde beenden/i }));
    await user.click(screen.getByRole("button", { name: /druckansicht/i }));
    expect(screen.getByRole("heading", { name: /druckansicht/i })).toBeInTheDocument();
    expect(screen.getByText(/bernd/i)).toBeInTheDocument();
    expect(screen.getByText(/^zwischenstand 1$/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /editor/i }));

    await user.click(screen.getByRole("button", { name: /csv/i }));
    expect(screen.getByRole("status")).toHaveTextContent(/csv-export vorbereitet/i);

    await user.click(screen.getByRole("button", { name: /zurueck zur liste/i }));
    const row = screen.getByRole("listitem");
    await user.click(within(row).getByRole("button", { name: /loeschen/i }));
    await user.click(screen.getByRole("button", { name: /wirklich loeschen/i }));
    expect(screen.getByText(/keine runden/i)).toBeInTheDocument();
  });

  it("locks Schuetzen add and remove after the first Rundeneintrag", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /neue runde/i }));
    await user.clear(screen.getByLabelText(/name schuetze 1/i));
    await user.type(screen.getByLabelText(/name schuetze 1/i), "Anna");
    await user.click(screen.getByRole("button", { name: /schuetze hinzufuegen/i }));
    expect(screen.getByLabelText(/name schuetze 2/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /runde starten/i }));
    const annaRow = screen.getByRole("row", { name: /anna/i });
    await user.click(within(annaRow).getByRole("button", { name: /taube 1 als treffer markieren/i }));

    await user.click(screen.getByRole("button", { name: /runde beenden/i }));
    expect(screen.getByRole("button", { name: /schuetze hinzufuegen/i })).toBeDisabled();
    expect(screen.getAllByRole("button", { name: /^entfernen$/i })[0]).toBeDisabled();
    expect(screen.queryByText(/rotte gesperrt/i)).not.toBeInTheDocument();
  });

  it("locks and unlocks a finished Runde so Ergebnisse cannot be changed", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /neue runde/i }));
    await user.clear(screen.getByLabelText(/name schuetze 1/i));
    await user.type(screen.getByLabelText(/name schuetze 1/i), "Anna");
    await user.click(screen.getByRole("button", { name: /runde starten/i }));
    let annaRow = screen.getByRole("row", { name: /anna/i });
    await user.click(within(annaRow).getByRole("button", { name: /taube 1 als treffer markieren/i }));

    await user.click(screen.getByRole("button", { name: /runde beenden/i }));
    annaRow = screen.getByRole("row", { name: /anna/i });
    await user.click(screen.getByRole("button", { name: /runde sperren/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/schiessleiter muss gesetzt sein/i);
    expect(screen.getByLabelText(/schiessleiter/i)).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByRole("button", { name: /taube 1 treffer entfernen/i })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(/schiessleiter/i), "Leiter");
    await user.click(screen.getByRole("button", { name: /runde sperren/i }));

    expect(screen.getByRole("heading", { name: /rundenliste/i })).toBeInTheDocument();
    expect(screen.getAllByText(/gesperrt/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/0 gaeste/i)).toBeInTheDocument();
    expect(screen.getByText(/1 unbezahlt/i)).toBeInTheDocument();
    expect(screen.queryByText(/entwurf/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /anna/i }));
    expect(screen.getByLabelText(/rundenzeit/i)).toBeDisabled();
    expect(screen.getByLabelText(/schiessleiter/i)).toBeDisabled();
    expect(screen.getByLabelText(/name schuetze 1/i)).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: /anna ist gast/i })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: /anna hat bezahlt/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /schuetze hinzufuegen/i })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /runde starten/i }));
    expect(within(screen.getByRole("row", { name: /anna/i })).getByRole("button", { name: /taube 1 treffer entfernen/i })).toBeDisabled();
    expect(within(screen.getByRole("row", { name: /anna/i })).getByRole("button", { name: /taube 1 als fehler markieren/i })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /runde beenden/i }));
    await user.click(screen.getByRole("button", { name: /runde entsperren/i }));
    expect(screen.queryByText(/runde gesperrt/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/rundenzeit/i)).not.toBeDisabled();
    expect(screen.getByLabelText(/schiessleiter/i)).not.toBeDisabled();
    expect(screen.getByLabelText(/name schuetze 1/i)).not.toBeDisabled();
    expect(screen.getByRole("checkbox", { name: /anna ist gast/i })).not.toBeDisabled();
    expect(screen.getByRole("checkbox", { name: /anna hat bezahlt/i })).not.toBeDisabled();
    await user.click(screen.getByRole("button", { name: /runde starten/i }));
    expect(screen.getByRole("button", { name: /taube 1 treffer entfernen/i })).not.toBeDisabled();
  });

  it("shows five Tauben at a time with navigation on phone width", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /neue runde/i }));
    await user.click(screen.getByRole("button", { name: /runde starten/i }));

    expect(screen.getByText(/tauben 1-5 von 25/i)).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "1" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "5" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "6" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /naechste tauben/i }));

    expect(screen.getByText(/tauben 6-10 von 25/i)).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "1" })).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "6" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "10" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /taube 6 als treffer markieren/i }));
    expect(screen.getByRole("button", { name: /taube 6 treffer entfernen/i })).toHaveTextContent("1");
  });

  it("switches Druckansicht between Einzelergebnisse and Zusammenfassung", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /neue runde/i }));
    await user.clear(screen.getByLabelText(/name schuetze 1/i));
    await user.type(screen.getByLabelText(/name schuetze 1/i), "Anna");
    await user.click(screen.getByRole("checkbox", { name: /anna ist gast/i }));
    await user.click(screen.getByRole("checkbox", { name: /anna hat bezahlt/i }));
    await user.click(screen.getByRole("button", { name: /runde starten/i }));
    await user.click(screen.getByRole("button", { name: /taube 1 als treffer markieren/i }));
    await user.click(screen.getByRole("button", { name: /runde beenden/i }));

    await user.click(screen.getByRole("button", { name: /druckansicht/i }));
    expect(screen.getByText(/^zwischenstand 1$/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /zusammenfassung/i }));

    expect(screen.queryByText(/^zwischenstand 1$/i)).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /^gast$/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /^ergebnis$/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /^bezahlt$/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /einzelergebnisse/i }));
    expect(screen.getByText(/^zwischenstand 1$/i)).toBeInTheDocument();
  });

  it("groups vergangene Runden by month and year and filters by Monat and Jahr", async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      "trapstand:datenbestand",
      JSON.stringify({
        runden: [
          createRunde({
            id: "mai-2026",
            rundenzeit: "2026-05-07T18:00",
            schiessleiter: "Leiter Mai",
            schuetzenNamen: ["Mai Schuetze"]
          }),
          createRunde({
            id: "april-2026",
            rundenzeit: "2026-04-30T18:00",
            schiessleiter: "Leiter April",
            schuetzenNamen: ["April Schuetze"]
          }),
          createRunde({
            id: "mai-2025",
            rundenzeit: "2025-05-08T18:00",
            schiessleiter: "Leiter Alt",
            schuetzenNamen: ["Alter Schuetze"]
          })
        ]
      })
    );

    render(<App />);

    expect(screen.getByRole("heading", { name: /mai 2026/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /april 2026/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /mai 2025/i })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/jahr/i), "2026");
    expect(screen.getByText(/mai schuetze/i)).toBeInTheDocument();
    expect(screen.getByText(/april schuetze/i)).toBeInTheDocument();
    expect(screen.queryByText(/alter schuetze/i)).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/monat/i), "5");
    expect(screen.getByText(/mai schuetze/i)).toBeInTheDocument();
    expect(screen.queryByText(/april schuetze/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/alter schuetze/i)).not.toBeInTheDocument();
  });

  it("shares JSON Backup as a text file when application/json is not shareable", async () => {
    const user = userEvent.setup();
    const share = vi.fn();
    const canShare = vi.fn((payload: ShareData) => {
      const file = payload.files?.[0];
      return file?.name === "trapstand-backup.json" && file.type === "text/plain";
    });
    Object.defineProperty(navigator, "share", { configurable: true, value: share });
    Object.defineProperty(navigator, "canShare", { configurable: true, value: canShare });

    render(<App />);

    await user.click(screen.getByRole("button", { name: /json backup/i }));

    expect(canShare).toHaveBeenCalled();
    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "trapstand-backup.json",
        files: [expect.objectContaining({ name: "trapstand-backup.json", type: "text/plain" })]
      })
    );
  });

  it("removes status messages after a few seconds", async () => {
    vi.useFakeTimers();
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /csv/i }));

    expect(screen.getByRole("status")).toHaveTextContent(/csv-export vorbereitet/i);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
