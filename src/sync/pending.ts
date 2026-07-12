const KEY = "trapstand:sync-pending";

export function markPending(): void {
  localStorage.setItem(KEY, "1");
}

export function clearPending(): void {
  localStorage.removeItem(KEY);
}

export function isPending(): boolean {
  return localStorage.getItem(KEY) === "1";
}
