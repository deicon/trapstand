import { describe, it, expect, beforeEach } from "vitest";
import { markPending, clearPending, isPending } from "./pending";

describe("pending sync", () => {
  beforeEach(() => localStorage.clear());

  it("marks and reads pending state", () => {
    expect(isPending()).toBe(false);
    markPending();
    expect(isPending()).toBe(true);
    clearPending();
    expect(isPending()).toBe(false);
  });
});
