import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { App } from "./App";
import { createRunde } from "./domain/runden";
import { refreshPwa } from "./pwa/refresh";

vi.mock("./pwa/refresh", () => ({
  refreshPwa: vi.fn(() => Promise.resolve())
}));

async function startRunde(user: ReturnType<typeof userEvent.setup>) {
  const schiessleiterInput = screen.queryByLabelText(/schie(?:ß|ss)leiter/i);
  if (schiessleiterInput instanceof HTMLInputElement && schiessleiterInput.value.trim().length === 0) {
    await user.type(schiessleiterInput, "Leiter");
  }

  await user.click(screen.getByRole("button", { name: /runde starten/i }));
  await user.click(screen.getByRole("button", { name: /^ok$/i }));
}

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
    await user.clear(screen.getByLabelText(/schie(?:ß|ss)leiter/i));
    await user.type(screen.getByLabelText(/schie(?:ß|ss)leiter/i), "Dieter");
    await user.clear(screen.getByLabelText(/name schuetze 1/i));
    await user.type(screen.getByLabelText(/name schuetze 1/i), "Anna");
    await user.click(screen.getByRole("checkbox", { name: /anna ist gast/i }));
    await user.click(screen.getByRole("checkbox", { name: /anna hat bezahlt/i }));
    expect(screen.queryByRole("button", { name: /taube 1 als treffer markieren/i })).not.toBeInTheDocument();

    await startRunde(user);
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
    expect(screen.getByLabelText(/schie(?:ß|ss)leiter/i)).toHaveValue("Dieter");
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

    await startRunde(user);

    expect(screen.getByRole("button", { name: /runde beenden/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/schie(?:ß|ss)leiter/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /schuetze hinzufuegen/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^entfernen$/i })).not.toBeInTheDocument();
    expect(screen.getByRole("row", { name: /anna/i })).toHaveStyle({ height: "50%" });
    expect(screen.getByRole("row", { name: /bernd/i })).toHaveStyle({ height: "50%" });
  });

  it("requires confirmation before starting a Runde and can cancel back to Schuetzenerfassung", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /neue runde/i }));
    await user.type(screen.getByLabelText(/schie(?:ß|ss)leiter/i), "Leiter");
    await user.click(screen.getByRole("button", { name: /runde starten/i }));

    expect(screen.getByRole("dialog")).toHaveTextContent(/sind alle schuetzen bereit/i);
    expect(screen.queryByRole("table", { name: /rundenerfassung/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /abbrechen/i }));

    expect(screen.getByLabelText(/schie(?:ß|ss)leiter/i)).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await startRunde(user);
    expect(screen.getByRole("table", { name: /rundenerfassung/i })).toBeInTheDocument();
  });

  it("does not start a Runde without Schiessleiter", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /neue runde/i }));
    await user.click(screen.getByRole("button", { name: /runde starten/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(/schie(?:ß|ss)leiter muss gesetzt sein/i);
    expect(screen.getByLabelText(/schie(?:ß|ss)leiter/i)).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("table", { name: /rundenerfassung/i })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(/schie(?:ß|ss)leiter/i), "Leiter");
    await startRunde(user);
    expect(screen.getByRole("table", { name: /rundenerfassung/i })).toBeInTheDocument();
  });

  it("suggests known shooters from the same day and applies their guest status", async () => {
    const user = userEvent.setup();
    const previous = createRunde({
      id: "previous",
      rundenzeit: "2026-05-31T11:00",
      schiessleiter: "Leiter",
      schuetzenNamen: ["Anna", "Bernd"]
    });
    previous.rotte[1].gaststatus = true;
    const otherDay = createRunde({
      id: "other-day",
      rundenzeit: "2026-05-30T11:00",
      schiessleiter: "Leiter",
      schuetzenNamen: ["Claudia"]
    });
    localStorage.setItem("trapstand:datenbestand", JSON.stringify({ runden: [previous, otherDay] }));
    render(<App />);

    await user.click(screen.getByRole("button", { name: /neue runde/i }));
    await user.clear(screen.getByLabelText(/name schuetze 1/i));
    await user.type(screen.getByLabelText(/name schuetze 1/i), "Anna");
    await user.click(screen.getByRole("button", { name: /schuetze hinzufuegen/i }));

    const nameInput = screen.getByLabelText(/name schuetze 2/i);
    const listId = nameInput.getAttribute("list");
    const suggestions = Array.from(document.querySelectorAll(`#${listId} option`)).map((option) => option.getAttribute("value"));
    expect(suggestions).toContain("Bernd");
    expect(suggestions).not.toContain("Anna");
    expect(suggestions).not.toContain("Claudia");

    await user.click(screen.getByRole("button", { name: /bernd · gast/i }));
    expect(nameInput).toHaveValue("Bernd");
    expect(screen.getByRole("checkbox", { name: /bernd ist gast/i })).toBeChecked();

    await user.clear(nameInput);
    await user.type(nameInput, "Bernd");
    expect(screen.getByRole("checkbox", { name: /bernd ist gast/i })).toBeChecked();
  });

  it("suggests known Schiessleiter globally", async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      "trapstand:datenbestand",
      JSON.stringify({
        runden: [
          createRunde({
            id: "heute",
            rundenzeit: "2026-05-31T11:00",
            schiessleiter: "Dieter",
            schuetzenNamen: ["Anna"]
          }),
          createRunde({
            id: "anderer-tag",
            rundenzeit: "2026-05-30T11:00",
            schiessleiter: "Stefan",
            schuetzenNamen: ["Bernd"]
          })
        ]
      })
    );
    render(<App />);

    expect(screen.getByText(/schützenstand/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /neue runde/i }));

    const schiessleiterInput = screen.getByLabelText(/schie(?:ß|ss)leiter/i);
    const listId = schiessleiterInput.getAttribute("list");
    const suggestions = Array.from(document.querySelectorAll(`#${listId} option`)).map((option) => option.getAttribute("value"));
    expect(suggestions).toEqual(["Dieter", "Stefan"]);

    await user.clear(schiessleiterInput);
    await user.click(screen.getByRole("button", { name: /^stefan$/i }));
    expect(schiessleiterInput).toHaveValue("Stefan");
  });

  it("prefills the Schiessleiter from the first Runde of the same day", async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      "trapstand:datenbestand",
      JSON.stringify({
        runden: [
          createRunde({
            id: "zweite",
            rundenzeit: "2026-05-31T19:00",
            schiessleiter: "Stefan",
            schuetzenNamen: ["Anna"]
          }),
          createRunde({
            id: "erste",
            rundenzeit: "2026-05-31T18:00",
            schiessleiter: "Dieter",
            schuetzenNamen: ["Bernd"]
          }),
          createRunde({
            id: "anderer-tag",
            rundenzeit: "2026-05-30T18:00",
            schiessleiter: "Udo",
            schuetzenNamen: ["Claudia"]
          })
        ]
      })
    );
    render(<App />);

    await user.click(screen.getByRole("button", { name: /neue runde/i }));

    expect(screen.getByLabelText(/schie(?:ß|ss)leiter/i)).toHaveValue("Dieter");
  });

  it("records the active shooter with large Treffer and Gefehlt buttons", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /neue runde/i }));
    await user.clear(screen.getByLabelText(/name schuetze 1/i));
    await user.type(screen.getByLabelText(/name schuetze 1/i), "Anna");
    await user.click(screen.getByRole("button", { name: /schuetze hinzufuegen/i }));
    await user.type(screen.getByLabelText(/name schuetze 2/i), "Bernd");

    await startRunde(user);

    expect(within(screen.getByRole("row", { name: /anna/i })).getByRole("group", { name: /^taube 1$/i })).toHaveAttribute("aria-current", "true");

    await user.click(screen.getByRole("button", { name: /^treffer$/i }));

    expect(within(screen.getByRole("row", { name: /anna/i })).getByRole("button", { name: /taube 1 treffer entfernen/i })).toHaveTextContent("1");
    expect(within(screen.getByRole("row", { name: /bernd/i })).getByRole("group", { name: /^taube 1$/i })).toHaveAttribute("aria-current", "true");

    await user.click(screen.getByRole("button", { name: /^gefehlt$/i }));

    expect(within(screen.getByRole("row", { name: /bernd/i })).getByRole("button", { name: /taube 1 fehler entfernen/i })).toHaveTextContent("0");
    expect(within(screen.getByRole("row", { name: /anna/i })).getByRole("group", { name: /^taube 2$/i })).toHaveAttribute("aria-current", "true");
  });

  it("warns when the last Taube begins and asks for safety confirmation after all Tauben are shot", async () => {
    const user = userEvent.setup();
    const runde = createRunde({
      id: "fast-fertig",
      rundenzeit: "2026-05-31T13:15",
      schiessleiter: "Leiter",
      schuetzenNamen: ["Anna"]
    });
    runde.rotte[0].tauben = runde.rotte[0].tauben.map((taube) => (taube.nummer < 25 ? { ...taube, status: "getroffen" } : taube));
    localStorage.setItem("trapstand:datenbestand", JSON.stringify({ runden: [runde] }));
    render(<App />);

    await user.click(screen.getByRole("button", { name: /anna/i }));
    await startRunde(user);

    expect(screen.getByText(/letzte runde beginnt/i)).toBeInTheDocument();
    expect(within(screen.getByRole("row", { name: /anna/i })).getByRole("group", { name: /^taube 25$/i })).toHaveAttribute("aria-current", "true");

    await user.click(screen.getByRole("button", { name: /^treffer$/i }));

    expect(screen.getByRole("dialog")).toHaveTextContent(/sicherheit hergestellt/i);
    expect(screen.getByRole("button", { name: /^treffer$/i })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /^ok$/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^treffer$/i })).toBeDisabled();
    expect(within(screen.getByRole("row", { name: /anna/i })).getByRole("button", { name: /taube 25 treffer entfernen/i })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /runde beenden/i }));
    expect(screen.getByRole("button", { name: /runde entsperren/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/name schuetze 1/i)).toBeDisabled();
    await startRunde(user);
    expect(screen.getByRole("button", { name: /^treffer$/i })).toBeDisabled();
    expect(within(screen.getByRole("row", { name: /anna/i })).getByRole("button", { name: /taube 25 treffer entfernen/i })).toBeDisabled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("offers PWA refresh only from the list view", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /aktualisieren/i }));
    expect(refreshPwa).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: /neue runde/i }));
    expect(screen.queryByRole("button", { name: /aktualisieren/i })).not.toBeInTheDocument();
    await startRunde(user);
    expect(screen.queryByRole("button", { name: /aktualisieren/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /runde beenden/i }));
    await user.click(screen.getByRole("button", { name: /druckansicht/i }));
    expect(screen.queryByRole("button", { name: /aktualisieren/i })).not.toBeInTheDocument();

    expect(refreshPwa).toHaveBeenCalledTimes(1);
  });

  it("exports CSV, shows Druckansicht and deletes a Runde after confirmation", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /neue runde/i }));
    await user.type(screen.getByLabelText(/schie(?:ß|ss)leiter/i), "Leiter");
    await user.clear(screen.getByLabelText(/name schuetze 1/i));
    await user.type(screen.getByLabelText(/name schuetze 1/i), "Bernd");
    await startRunde(user);
    const berndRow = screen.getByRole("row", { name: /bernd/i });
    await user.click(within(berndRow).getByRole("button", { name: /taube 1 als treffer markieren/i }));

    await user.click(screen.getByRole("button", { name: /runde beenden/i }));
    await user.click(screen.getByRole("button", { name: /druckansicht/i }));
    expect(screen.getByRole("heading", { name: /druckansicht/i })).toBeInTheDocument();
    expect(screen.getByText(/bernd/i)).toBeInTheDocument();
    expect(screen.getByText(/^zwischenstand 1$/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /zurueck/i }));

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

    await startRunde(user);
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
    await startRunde(user);
    let annaRow = screen.getByRole("row", { name: /anna/i });
    await user.click(within(annaRow).getByRole("button", { name: /taube 1 als treffer markieren/i }));

    await user.click(screen.getByRole("button", { name: /runde beenden/i }));
    await user.click(screen.getByRole("button", { name: /runde sperren/i }));

    expect(screen.getByRole("heading", { name: /rundenliste/i })).toBeInTheDocument();
    expect(screen.getAllByText(/gesperrt/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/0 gaeste/i)).toBeInTheDocument();
    expect(screen.getByText(/1 unbezahlt/i)).toBeInTheDocument();
    expect(screen.queryByText(/entwurf/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /anna/i }));
    expect(screen.getByLabelText(/rundenzeit/i)).toBeDisabled();
    expect(screen.getByLabelText(/schie(?:ß|ss)leiter/i)).toBeDisabled();
    expect(screen.getByLabelText(/name schuetze 1/i)).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: /anna ist gast/i })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: /anna hat bezahlt/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /schuetze hinzufuegen/i })).toBeDisabled();
    await startRunde(user);
    expect(screen.getByRole("button", { name: /^treffer$/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^gefehlt$/i })).toBeDisabled();
    expect(within(screen.getByRole("row", { name: /anna/i })).getByRole("button", { name: /taube 1 treffer entfernen/i })).toBeDisabled();
    expect(within(screen.getByRole("row", { name: /anna/i })).getByRole("button", { name: /taube 1 als fehler markieren/i })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /runde beenden/i }));
    await user.click(screen.getByRole("button", { name: /runde entsperren/i }));
    expect(screen.queryByText(/runde gesperrt/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/rundenzeit/i)).not.toBeDisabled();
    expect(screen.getByLabelText(/schie(?:ß|ss)leiter/i)).not.toBeDisabled();
    expect(screen.getByLabelText(/name schuetze 1/i)).not.toBeDisabled();
    expect(screen.getByRole("checkbox", { name: /anna ist gast/i })).not.toBeDisabled();
    expect(screen.getByRole("checkbox", { name: /anna hat bezahlt/i })).not.toBeDisabled();
    await startRunde(user);
    expect(screen.getByRole("button", { name: /taube 1 treffer entfernen/i })).not.toBeDisabled();
  });

  it("shows five Tauben at a time with navigation on phone width", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /neue runde/i }));
    await startRunde(user);

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
    await startRunde(user);
    await user.click(screen.getByRole("button", { name: /taube 1 als treffer markieren/i }));
    await user.click(screen.getByRole("button", { name: /runde beenden/i }));

    await user.click(screen.getByRole("button", { name: /druckansicht/i }));
    expect(screen.getByText(/^zwischenstand 1$/i)).toBeInTheDocument();
    expect(screen.getByText(/ort, datum und unterschrift der standaufsicht/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /zusammenfassung/i }));

    expect(screen.queryByText(/^zwischenstand 1$/i)).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /^gast$/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /^ergebnis$/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /^bezahlt$/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /einzelergebnisse/i }));
    expect(screen.getByText(/^zwischenstand 1$/i)).toBeInTheDocument();
  });

  it("filters Runden by day, defaults to today and can show all days newest first", async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      "trapstand:datenbestand",
      JSON.stringify({
        runden: [
          createRunde({
            id: "heute",
            rundenzeit: "2026-05-31T18:00",
            schiessleiter: "Leiter Heute",
            schuetzenNamen: ["Heute Schuetze"]
          }),
          createRunde({
            id: "gestern-spaet",
            rundenzeit: "2026-05-30T20:00",
            schiessleiter: "Leiter Spaet",
            schuetzenNamen: ["Gestern Spaet"]
          }),
          createRunde({
            id: "gestern-frueh",
            rundenzeit: "2026-05-30T18:00",
            schiessleiter: "Leiter Frueh",
            schuetzenNamen: ["Gestern Frueh"]
          })
        ]
      })
    );

    render(<App />);

    expect(screen.getByLabelText(/tag/i)).toHaveValue("2026-05-31");
    expect(screen.getByText(/heute schuetze/i)).toBeInTheDocument();
    expect(screen.queryByText(/gestern spaet/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/gestern frueh/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /tag ausdrucken/i })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/tag/i), "alle");
    expect(screen.queryByRole("button", { name: /tag ausdrucken/i })).not.toBeInTheDocument();
    const rows = screen.getAllByRole("listitem");
    expect(within(rows[0]).getByText(/heute schuetze/i)).toBeInTheDocument();
    expect(within(rows[1]).getByText(/gestern spaet/i)).toBeInTheDocument();
    expect(within(rows[2]).getByText(/gestern frueh/i)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/tag/i), "2026-05-30");
    expect(screen.queryByText(/heute schuetze/i)).not.toBeInTheDocument();
    expect(screen.getByText(/gestern spaet/i)).toBeInTheDocument();
    expect(screen.getByText(/gestern frueh/i)).toBeInTheDocument();
  });

  it("prints all Runden of the selected day", async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      "trapstand:datenbestand",
      JSON.stringify({
        runden: [
          createRunde({
            id: "erste",
            rundenzeit: "2026-05-31T18:00",
            schiessleiter: "Leiter Eins",
            schuetzenNamen: ["Anna"]
          }),
          createRunde({
            id: "zweite",
            rundenzeit: "2026-05-31T20:00",
            schiessleiter: "Leiter Zwei",
            schuetzenNamen: ["Bernd"]
          }),
          createRunde({
            id: "alt",
            rundenzeit: "2026-05-30T18:00",
            schiessleiter: "Leiter Alt",
            schuetzenNamen: ["Claudia"]
          })
        ]
      })
    );

    render(<App />);

    await user.click(screen.getByRole("button", { name: /tag ausdrucken/i }));

    expect(screen.getByRole("heading", { name: /druckansicht/i })).toBeInTheDocument();
    expect(screen.getByText(/leiter eins/i)).toBeInTheDocument();
    expect(screen.getByText(/leiter zwei/i)).toBeInTheDocument();
    expect(screen.queryByText(/leiter alt/i)).not.toBeInTheDocument();
    expect(screen.getByText(/anna/i)).toBeInTheDocument();
    expect(screen.getByText(/bernd/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /zusammenfassung/i }));
    expect(screen.getAllByRole("columnheader", { name: /^gast$/i })).toHaveLength(2);
  });

  it("marks all day rounds for a shooter as paid", async () => {
    const user = userEvent.setup();
    const first = createRunde({
      id: "erste",
      rundenzeit: "2026-05-31T18:00",
      schiessleiter: "Leiter Eins",
      schuetzenNamen: ["Anna", "Bernd"]
    });
    first.rotte[1].gaststatus = true;
    const second = createRunde({
      id: "zweite",
      rundenzeit: "2026-05-31T20:00",
      schiessleiter: "Leiter Zwei",
      schuetzenNamen: ["Bernd"]
    });
    const otherDay = createRunde({
      id: "alt",
      rundenzeit: "2026-05-30T18:00",
      schiessleiter: "Leiter Alt",
      schuetzenNamen: ["Bernd"]
    });
    localStorage.setItem("trapstand:datenbestand", JSON.stringify({ runden: [first, second, otherDay] }));
    render(<App />);

    await user.click(screen.getByRole("button", { name: /^bezahlen$/i }));

    expect(screen.getByRole("dialog")).toHaveTextContent(/bernd/i);
    expect(screen.getByRole("dialog")).toHaveTextContent(/2 runden/i);
    expect(screen.getByRole("dialog")).toHaveTextContent(/gast/i);

    await user.click(screen.getByRole("checkbox", { name: /bernd bezahlt/i }));
    await user.click(screen.getByRole("button", { name: /schliessen/i }));

    await user.click(screen.getByRole("button", { name: /bernd.*2026-05-31 20:00/i }));
    expect(screen.getByRole("checkbox", { name: /bernd hat bezahlt/i })).not.toBeDisabled();
    expect(screen.getByRole("checkbox", { name: /bernd hat bezahlt/i })).toBeChecked();

    await user.click(screen.getByRole("button", { name: /zurueck zur liste/i }));
    await user.selectOptions(screen.getByLabelText(/tag/i), "2026-05-30");
    await user.click(screen.getByRole("button", { name: /bernd/i }));
    expect(screen.getByRole("checkbox", { name: /bernd hat bezahlt/i })).not.toBeChecked();
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
