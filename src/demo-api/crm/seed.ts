import { randomUUID, createHash } from "crypto";
import { getCrmDb } from "./db";

// Deterministic-ish RNG from user_key so the dataset is stable per user (nice for demos)
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromUserKey(userKey: string): number {
  const h = createHash("sha256").update(userKey).digest();
  // use first 4 bytes
  return h.readUInt32LE(0);
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function cents(amountDollars: number) {
  return Math.round(amountDollars * 100);
}

function isoDate(d: Date) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function ensureSeeded(userKey: string) {
  const db = getCrmDb();

  const existing = db.prepare(`SELECT user_key FROM users WHERE user_key = ?`).get(userKey);
  if (existing) {
    return { seeded: false, createdDeals: 0 };
  }

  const now = Date.now();
  db.prepare(`INSERT INTO users(user_key, created_at) VALUES (?, ?)`).run(userKey, now);

  const rng = mulberry32(seedFromUserKey(userKey));

  const accounts = ["Acme Co", "Globex", "Initech", "Umbrella", "Stark Industries", "Wayne Enterprises"];
  const stages = ["won", "lost", "open"] as const;

  // Generate deals across 2024–2025 so "Q2 2025" queries work immediately
  const dealCount = 40 + Math.floor(rng() * 40); // 40–79

  const insert = db.prepare(`
    INSERT INTO deals(id, user_key, account, amount_cents, close_date, stage, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const tx = db.transaction(() => {
    for (let i = 0; i < dealCount; i++) {
      const year = rng() < 0.55 ? 2025 : 2024;
      const month = Math.floor(rng() * 12); // 0-11
      const day = 1 + Math.floor(rng() * 28);
      const d = new Date(Date.UTC(year, month, day));

      const stage = pick(rng, Array.from(stages));
      const base = 800 + rng() * 18000; // $800–$18,800
      const amount = stage === "open" ? base * 0.7 : base; // open deals slightly smaller
      const account = pick(rng, accounts);

      insert.run(
        `deal_${randomUUID()}`,
        userKey,
        account,
        cents(amount),
        isoDate(d),
        stage,
        now + i
      );
    }
  });

  tx();

  return { seeded: true, createdDeals: dealCount };
}
