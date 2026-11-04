import { describe, expect, it } from "vitest";
import type { DashboardView } from "@repo/shared";

import { toVendorBarData } from "./chartData";

const vendor = (overrides: Partial<DashboardView["topVendors"][number]> = {}) => ({
  vendorId: "v1",
  ref: "V-901",
  name: "Northwind Supplies",
  maxScore: 82,
  exposure: 120_000,
  ...overrides,
});

describe("toVendorBarData", () => {
  // Regression: recharts spreads every row field onto the bar shape it renders,
  // so a row key called `ref` became `<path ref="V-901">`. React only accepts a
  // function or object ref and threw, taking the whole dashboard down.
  it("renames the vendor `ref` field so it cannot reach the chart as a React ref", () => {
    const [row] = toVendorBarData([vendor()]);

    expect(row).not.toHaveProperty("ref");
    expect(row).toMatchObject({
      vendorId: "v1",
      vendorRef: "V-901",
      name: "Northwind Supplies",
      maxScore: 82,
      exposure: 120_000,
    });
  });

  it("keeps every other field and the row order intact", () => {
    const rows = toVendorBarData([vendor(), vendor({ vendorId: "v2", ref: "V-902", name: "Contoso" })]);

    expect(rows.map((row) => row.vendorRef)).toEqual(["V-901", "V-902"]);
    expect(rows.map((row) => row.name)).toEqual(["Northwind Supplies", "Contoso"]);
  });
});
