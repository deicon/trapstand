import { describe, it, expect } from "vitest";
import { encryptBackup, decryptBackup } from "./crypto";

describe("crypto", () => {
  it("round-trips a backup string", async () => {
    const password = "ein-sicheres-passwort";
    const plaintext = JSON.stringify({ runden: [], schuetzen: [] });
    const encrypted = await encryptBackup(plaintext, password);
    expect(encrypted.v).toBe(1);
    expect(encrypted.alg).toBe("AES-GCM-256-PBKDF2-SHA256-100k");
    expect(encrypted.encrypted).toBeTruthy();
    expect(encrypted.iv).toBeTruthy();
    expect(encrypted.salt).toBeTruthy();

    const decrypted = await decryptBackup(encrypted, password);
    expect(decrypted).toBe(plaintext);
  });

  it("fails with wrong password", async () => {
    const plaintext = JSON.stringify({ runden: [] });
    const encrypted = await encryptBackup(plaintext, "richtig");
    await expect(decryptBackup(encrypted, "falsch")).rejects.toThrow();
  });
});
