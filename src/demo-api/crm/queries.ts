import { getCrmDb } from "./db.js";

function quarterRange(year: number, quarter: number) {
  const q = Math.min(4, Math.max(1, quarter));
  const startMonth = (q - 1) * 3; // 0,3,6,9
  const start = `${year}-${String(startMonth + 1).padStart(2, "0")}-01`;
  const endMonth = startMonth + 3;
  // end is exclusive
  const endYear = endMonth >= 12 ? year + 1 : year;
  const endMon = endMonth >= 12 ? endMonth - 12 : endMonth;
  const end = `${endYear}-${String(endMon + 1).padStart(2, "0")}-01`;
  return { start, end };
}

export function salesSummary(userKey: string, year: number, quarter: number) {
  const db = getCrmDb();
  const { start, end } = quarterRange(year, quarter);

  const row = db.prepare(
    `
    SELECT
      COUNT(*) as deals_won,
      COALESCE(SUM(amount_cents), 0) as revenue_cents
    FROM deals
    WHERE user_key = ?
      AND stage = 'won'
      AND close_date >= ?
      AND close_date < ?
    `
  ).get(userKey, start, end) as any;

  return {
    year,
    quarter,
    range: { start, endExclusive: end },
    deals_won: Number(row.deals_won || 0),
    revenue_cents: Number(row.revenue_cents || 0),
  };
}
