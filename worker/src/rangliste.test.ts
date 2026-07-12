import { describe, it, expect } from "vitest";
import { ranglisteHtml } from "./rangliste";

describe("ranglisteHtml", () => {
  it("returns HTML", () => {
    const html = ranglisteHtml();
    expect(html).toContain("Trapstand Rangliste");
    expect(html).toContain("password-form");
    expect(html).toContain("id=\"ranking-top\"");
    expect(html).toContain("id=\"ranking-average\"");
  });
});
