import type { DashboardView } from "@repo/shared";

/**
 * Recharts spreads every field of a data row onto the bar shape it renders, so
 * a row key called `ref` lands on `<path ref="V-901">`. React 19 only accepts a
 * function or object ref and throws on anything else. Rename it before it ever
 * reaches the chart.
 */
export const toVendorBarData = (rows: DashboardView["topVendors"]) =>
  rows.map(({ ref, ...row }) => ({ ...row, vendorRef: ref }));
