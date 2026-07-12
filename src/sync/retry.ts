const COUNT_KEY = "trapstand:sync-consecutive-errors";
const TIMESTAMP_KEY = "trapstand:sync-last-error-at";
const MAX_ERRORS = 10;

export function recordError(): number {
  const count = getConsecutiveErrors() + 1;
  localStorage.setItem(COUNT_KEY, String(count));
  localStorage.setItem(TIMESTAMP_KEY, new Date().toISOString());
  return count;
}

export function clearConsecutiveErrors(): void {
  localStorage.removeItem(COUNT_KEY);
  localStorage.removeItem(TIMESTAMP_KEY);
}

export function getConsecutiveErrors(): number {
  const raw = localStorage.getItem(COUNT_KEY);
  return raw ? Number.parseInt(raw, 10) : 0;
}

export function hasReachedMaxErrors(): boolean {
  return getConsecutiveErrors() >= MAX_ERRORS;
}

export function nextRetryDelayMs(errorCount: number): number {
  const base = 1_000;
  const max = 5 * 60 * 1_000;
  return Math.min(base * 2 ** errorCount, max);
}

export function isBackoffActive(): boolean {
  const count = getConsecutiveErrors();
  if (count === 0) return false;
  const raw = localStorage.getItem(TIMESTAMP_KEY);
  if (!raw) return false;
  const lastError = new Date(raw).getTime();
  const delay = nextRetryDelayMs(count);
  return Date.now() - lastError < delay;
}
