import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { recordError, clearConsecutiveErrors, getConsecutiveErrors, hasReachedMaxErrors, nextRetryDelayMs, isBackoffActive } from "./retry";

describe("retry tracking", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("counts consecutive errors", () => {
    expect(getConsecutiveErrors()).toBe(0);
    recordError();
    recordError();
    expect(getConsecutiveErrors()).toBe(2);
    clearConsecutiveErrors();
    expect(getConsecutiveErrors()).toBe(0);
  });

  it("caps delay at 5 minutes", () => {
    expect(nextRetryDelayMs(0)).toBe(1_000);
    expect(nextRetryDelayMs(20)).toBe(5 * 60 * 1_000);
  });

  it("detects max errors", () => {
    for (let i = 0; i < 10; i++) recordError();
    expect(hasReachedMaxErrors()).toBe(true);
  });

  it("respects backoff delay", () => {
    recordError();
    expect(isBackoffActive()).toBe(true);
    vi.advanceTimersByTime(2_000);
    expect(isBackoffActive()).toBe(false);
  });
});
