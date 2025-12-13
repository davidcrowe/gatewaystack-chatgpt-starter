import { createHmac } from "crypto";

const SALT = process.env.PII_SALT || "";

// Non-reversible stable key for a user. Never return the raw key publicly.
export function userKeyFromSubject(subject: string): string {
  if (!SALT) {
    // Fail closed: do NOT proceed without salt (prevents accidental PII storage)
    throw new Error("PII_SALT is not set");
  }
  const h = createHmac("sha256", SALT).update(subject).digest("hex");
  return h; // 64 hex chars
}

// Friendly label that leaks nothing sensitive
export function userLabel(userKey: string): string {
  return `user-${userKey.slice(0, 6)}`;
}
