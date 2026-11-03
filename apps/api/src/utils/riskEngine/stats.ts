export const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);
export const mean = (a: number[]) => (a.length ? sum(a) / a.length : 0);

export function stdev(a: number[]): number {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
}

export const sortedCopy = (a: number[]) => [...a].sort((x, y) => x - y);

export function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

export const BENFORD_EXPECTED: number[] = [0, ...Array.from({ length: 9 }, (_, i) => Math.log10(1 + 1 / (i + 1)))];

export function firstDigit(n: number): number {
  return Number(Math.abs(n).toExponential()[0]);
}

export function benfordChiSquare(amounts: number[]): { chi: number; n: number; observed: number[] } {
  const digits = amounts.filter((a) => a >= 1).map(firstDigit);
  const n = digits.length;
  const counts = new Array(10).fill(0);
  digits.forEach((d) => counts[d]++);
  let chi = 0;
  for (let d = 1; d <= 9; d++) {
    const exp = n * BENFORD_EXPECTED[d]!;
    chi += (counts[d] - exp) ** 2 / exp;
  }
  return { chi, n, observed: counts.slice(1).map((c) => (n ? c / n : 0)) };
}

export const daysBetween = (a: Date, b: Date) => (b.getTime() - a.getTime()) / 86_400_000;
export const isWeekend = (d: Date) => d.getUTCDay() === 0 || d.getUTCDay() === 6;
export const ymd = (d: Date) => d.toISOString().slice(0, 10);

export function isoWeekKey(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export const normText = (s?: string | null) => (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
export const normPhone = (s?: string | null) => (s ?? "").replace(/\D+/g, "").slice(-10);
export const normInvoiceNumber = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

export function groupBy<T, K>(items: T[], key: (t: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const it of items) {
    const k = key(it);
    const arr = m.get(k);
    if (arr) arr.push(it); else m.set(k, [it]);
  }
  return m;
}
