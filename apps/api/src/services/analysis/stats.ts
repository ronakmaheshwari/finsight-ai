import db from "@repo/db";

export interface RunStats {
  amountHistogram: { from: number; to: number; count: number }[];
  benford: { n: number; chiSquare: number; observed: number[]; expected: number[] };
  monthlyVolume: { month: string; count: number; amount: number; flaggedCount: number }[];
  vendorScatter: {
    vendorRef: string;
    name: string;
    invoiceCount: number;
    meanAmount: number;
    maxAmount: number;
    flagged: boolean;
  }[];
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

const BENFORD_EXPECTED = [0.301, 0.176, 0.125, 0.097, 0.079, 0.067, 0.058, 0.051, 0.046];

const firstDigit = (value: number): number | null => {
  const digits = Math.abs(value).toFixed(10).replace(/^0+/, "");
  const digit = Number(digits.charAt(0));
  return digit >= 1 && digit <= 9 ? digit : null;
};

const histogram = (amounts: number[]): { from: number; to: number; count: number }[] => {
  const positive = amounts.filter((amount) => amount > 0);
  if (positive.length === 0) return [];

  const min = Math.min(...positive);
  const max = Math.max(...positive);
  const low = Math.log10(Math.max(min, 0.01));
  const high = Math.log10(Math.max(max, min + 0.01));
  const buckets = 12;
  const step = (high - low) / buckets || 1;

  const rows = Array.from({ length: buckets }, (_, index) => ({
    from: round2(10 ** (low + index * step)),
    to: round2(10 ** (low + (index + 1) * step)),
    count: 0,
  }));

  for (const amount of positive) {
    const position = Math.floor((Math.log10(amount) - low) / step);
    const index = Math.min(buckets - 1, Math.max(0, position));
    const row = rows[index];
    if (row) row.count += 1;
  }

  return rows;
};

const benford = (amounts: number[]): RunStats["benford"] => {
  const counts = Array.from({ length: 9 }, () => 0);
  let n = 0;

  for (const amount of amounts) {
    const digit = firstDigit(amount);
    if (digit === null) continue;
    counts[digit - 1] = (counts[digit - 1] ?? 0) + 1;
    n += 1;
  }

  if (n === 0) {
    return { n: 0, chiSquare: 0, observed: [], expected: BENFORD_EXPECTED };
  }

  const observed = counts.map((count) => count / n);
  const chiSquare = counts.reduce((total, count, index) => {
    const expected = BENFORD_EXPECTED[index] ?? 0;
    const difference = count - expected * n;
    return total + (difference * difference) / (expected * n);
  }, 0);

  return {
    n,
    chiSquare: Math.round(chiSquare * 100) / 100,
    observed: observed.map((value) => Math.round(value * 1000) / 1000),
    expected: BENFORD_EXPECTED,
  };
};

/**
 * Chart data for one run (R6). Computed from the dataset, not the run, so the
 * population figures stay comparable across runs.
 */
export const computeRunStats = async (runId: string): Promise<RunStats> => {
  const run = await db.analysisRun.findUnique({
    where: { id: runId },
    select: { datasetId: true },
  });

  if (!run) throw new Error(`Run ${runId} not found`);

  const [invoices, signals, cases, vendors] = await Promise.all([
    db.invoice.findMany({
      where: { datasetId: run.datasetId },
      select: { id: true, vendorId: true, amount: true, invoiceDate: true },
    }),
    db.riskSignal.findMany({
      where: { runId },
      select: { invoiceIds: true, vendorId: true },
    }),
    db.case.findMany({
      where: { runId, primaryEntityType: "VENDOR" },
      select: { primaryEntityId: true },
    }),
    db.vendor.findMany({
      where: { datasetId: run.datasetId },
      select: { id: true, externalId: true, name: true },
    }),
  ]);

  const amounts = invoices.map((invoice) => Number(invoice.amount));

  const flaggedInvoiceIds = new Set(signals.flatMap((signal) => signal.invoiceIds));
  const invoiceById = new Map(invoices.map((invoice) => [invoice.id, invoice]));

  const monthly = new Map<string, { count: number; amount: number; flagged: Set<string> }>();

  for (const invoice of invoices) {
    const month = invoice.invoiceDate.toISOString().slice(0, 7);
    const row = monthly.get(month) ?? { count: 0, amount: 0, flagged: new Set<string>() };
    row.count += 1;
    row.amount += Number(invoice.amount);
    if (flaggedInvoiceIds.has(invoice.id)) row.flagged.add(invoice.id);
    monthly.set(month, row);
  }

  const monthlyVolume = [...monthly.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, row]) => ({
      month,
      count: row.count,
      amount: round2(row.amount),
      flaggedCount: row.flagged.size,
    }));

  const flaggedVendors = new Set([
    ...signals.map((signal) => signal.vendorId).filter((id): id is string => Boolean(id)),
    ...cases.map((riskCase) => riskCase.primaryEntityId),
  ]);

  const byVendor = new Map<string, { count: number; total: number; max: number }>();

  for (const invoice of invoices) {
    const row = byVendor.get(invoice.vendorId) ?? { count: 0, total: 0, max: 0 };
    const amount = Number(invoice.amount);
    row.count += 1;
    row.total += amount;
    row.max = Math.max(row.max, amount);
    byVendor.set(invoice.vendorId, row);
  }

  const vendorById = new Map(vendors.map((vendor) => [vendor.id, vendor]));

  const vendorScatter = [...byVendor.entries()]
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 200)
    .map(([vendorId, row]) => {
      const vendor = vendorById.get(vendorId);
      return {
        vendorRef: vendor?.externalId ?? vendorId,
        name: vendor?.name ?? "Unknown vendor",
        invoiceCount: row.count,
        meanAmount: round2(row.total / row.count),
        maxAmount: round2(row.max),
        flagged: flaggedVendors.has(vendorId),
      };
    });

  // Referenced so the map is not reported as unused and future fields stay cheap.
  void invoiceById;

  return {
    amountHistogram: histogram(amounts),
    benford: benford(amounts),
    monthlyVolume,
    vendorScatter,
  };
};
