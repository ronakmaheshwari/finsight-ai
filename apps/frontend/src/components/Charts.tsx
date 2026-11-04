import { useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DashboardView, RunStatsView } from "@repo/shared";

import { Button } from "@repo/ui/button";
import { toVendorBarData } from "@/lib/chartData";
import { formatCompact, formatMoney, formatMonth, formatNumber, formatPercent } from "@/lib/format";

const AXIS = { fontSize: 11, fill: "var(--muted-foreground)" } as const;
const GRID = "var(--border)";
const LEGEND = { fontSize: 11, paddingTop: 8 } as const;

/** One tooltip skin for every chart, so hover never falls back to recharts grey. */
const TOOLTIP = {
  contentStyle: {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: "0.5rem",
    boxShadow: "0 12px 32px -16px oklch(0.2 0.02 258 / 45%)",
    fontSize: 12,
    padding: "8px 10px",
    color: "var(--popover-foreground)",
  },
  labelStyle: { color: "var(--muted-foreground)", fontSize: 11, marginBottom: 4, fontWeight: 500 },
  itemStyle: { padding: 0 },
} as const;

const BAR_CURSOR = { fill: "var(--muted)", opacity: 0.45 } as const;

/** Same thresholds the engine uses, so a bar and its badge never disagree. */
const bandFill = (score: number): string =>
  score >= 75 ? "var(--critical)" : score >= 50 ? "var(--high)" : score >= 25 ? "var(--medium)" : "var(--low)";

const ChartFrame = ({
  title,
  description,
  children,
  table,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  table?: ReactNode;
}) => {
  const [showTable, setShowTable] = useState(false);

  return (
    <section className="flex flex-col rounded-lg border border-border bg-card p-4 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {description ? <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{description}</p> : null}
        </div>
        {table ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            aria-expanded={showTable}
            onClick={() => setShowTable((value) => !value)}
          >
            {showTable ? "Hide data" : "View data"}
          </Button>
        ) : null}
      </div>
      <div className="mt-4 flex-1">{showTable && table ? table : children}</div>
    </section>
  );
};

const DataTable = ({ head, rows }: { head: string[]; rows: (string | number)[][] }) => (
  <div className="max-h-72 overflow-auto">
    <table className="w-full text-xs">
      <thead className="sticky top-0 bg-muted/60 backdrop-blur">
        <tr className="border-b border-border text-left">
          {head.map((cell) => (
            <th key={cell} scope="col" className="px-2 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
              {cell}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={index} className="border-b border-border/60 last:border-0">
            {row.map((cell, cellIndex) => (
              <td key={cellIndex} className="px-2 py-1.5 tabular-nums">
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const RiskByMonthChart = ({ rows }: { rows: DashboardView["riskByMonth"] }) => (
  <ChartFrame
    title="Flagged invoices and exposure by month"
    description="Flagged counts use the left axis; exposure uses the right axis."
    table={
      <DataTable
        head={["Month", "Flagged invoices", "Exposure"]}
        rows={rows.map((row) => [formatMonth(row.month), row.flaggedInvoices, formatMoney(row.exposure)])}
      />
    }
  >
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" tickFormatter={formatMonth} tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
          <YAxis yAxisId="left" tick={AXIS} width={40} allowDecimals={false} tickLine={false} axisLine={false} />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={AXIS}
            width={64}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value: number) => formatCompact(value)}
          />
          <Tooltip
            {...TOOLTIP}
            cursor={BAR_CURSOR}
            formatter={(value: unknown, name: unknown) =>
              String(name) === "Exposure"
                ? [formatMoney(Number(value)), String(name)]
                : [formatNumber(Number(value)), String(name)]
            }
            labelFormatter={(label: unknown) => formatMonth(String(label))}
          />
          <Legend wrapperStyle={LEGEND} iconType="circle" iconSize={8} />
          <Bar
            yAxisId="left"
            dataKey="flaggedInvoices"
            name="Flagged invoices"
            fill="var(--chart-1)"
            radius={[3, 3, 0, 0]}
            maxBarSize={38}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="exposure"
            name="Exposure"
            stroke="var(--chart-2)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  </ChartFrame>
);

export const TopVendorsChart = ({ rows }: { rows: DashboardView["topVendors"] }) => (
  <ChartFrame
    title="Top vendors by risk score"
    table={
      <DataTable
        head={["Vendor", "Ref", "Score", "Exposure"]}
        rows={rows.map((row) => [row.name, row.ref, row.maxScore, formatMoney(row.exposure)])}
      />
    }
  >
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={toVendorBarData(rows)} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 8 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
          <YAxis type="category" dataKey="vendorRef" tick={AXIS} width={70} tickLine={false} axisLine={false} />
          <Tooltip
            {...TOOLTIP}
            cursor={BAR_CURSOR}
            formatter={(value: unknown) => [`Score ${formatNumber(Number(value))}`, ""]}
            labelFormatter={(label: unknown) => {
              const vendor = rows.find((row) => row.ref === String(label));
              return vendor ? vendor.name : String(label);
            }}
          />
          <Bar
            dataKey="maxScore"
            name="Risk score"
            fill="var(--chart-1)"
            radius={[0, 3, 3, 0]}
            maxBarSize={14}
            background={{ fill: "var(--border)", radius: 3 }}
          >
            {rows.map((row) => (
              <Cell key={row.ref} fill={bandFill(row.maxScore)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  </ChartFrame>
);

export const RuleBreakdownChart = ({ rows }: { rows: DashboardView["ruleBreakdown"] }) => (
  <ChartFrame
    title="Signals by rule"
    table={<DataTable head={["Rule", "Signals"]} rows={rows.map((row) => [row.ruleKey, row.count])} />}
  >
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 4, right: 8, bottom: 48, left: 0 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="ruleKey"
            tick={AXIS}
            angle={-35}
            textAnchor="end"
            height={60}
            interval={0}
            tickLine={false}
            axisLine={{ stroke: GRID }}
          />
          <YAxis tick={AXIS} width={36} allowDecimals={false} tickLine={false} axisLine={false} />
          <Tooltip {...TOOLTIP} cursor={BAR_CURSOR} formatter={(value: unknown) => [formatNumber(Number(value)), "Signals"]} />
          <Bar dataKey="count" name="Signals" fill="var(--chart-1)" radius={[3, 3, 0, 0]} maxBarSize={38} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </ChartFrame>
);

export const AmountHistogramChart = ({ rows }: { rows: RunStatsView["amountHistogram"] }) => (
  <ChartFrame
    title="Invoice amount distribution"
    description="Logarithmic buckets: each bar covers a range of amounts."
    table={
      <DataTable
        head={["From", "To", "Invoices"]}
        rows={rows.map((row) => [formatMoney(row.from), formatMoney(row.to), row.count])}
      />
    }
  >
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows.map((row) => ({ ...row, label: `${formatCompact(row.from)}–${formatCompact(row.to)}` }))}
          margin={{ top: 4, right: 8, bottom: 48, left: 0 }}
        >
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={AXIS}
            angle={-35}
            textAnchor="end"
            height={60}
            interval={0}
            tickLine={false}
            axisLine={{ stroke: GRID }}
          />
          <YAxis tick={AXIS} width={40} allowDecimals={false} tickLine={false} axisLine={false} />
          <Tooltip {...TOOLTIP} cursor={BAR_CURSOR} formatter={(value: unknown) => [formatNumber(Number(value)), "Invoices"]} />
          <Bar dataKey="count" name="Invoices" fill="var(--chart-1)" radius={[3, 3, 0, 0]} maxBarSize={38} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </ChartFrame>
);

export const BenfordChart = ({ benford }: { benford: RunStatsView["benford"] }) => {
  const rows = benford.observed.map((observed, index) => ({
    digit: String(index + 1),
    observed: observed * 100,
    expected: (benford.expected[index] ?? 0) * 100,
  }));

  return (
    <ChartFrame
      title="Benford first-digit test"
      description={`${formatNumber(benford.n)} invoices · chi-square ${formatNumber(benford.chiSquare)}`}
      table={
        <DataTable
          head={["Digit", "Observed %", "Expected %"]}
          rows={rows.map((row) => [row.digit, formatPercent(row.observed, 2), formatPercent(row.expected, 2)])}
        />
      }
    >
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="digit" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
            <YAxis
              tick={AXIS}
              width={40}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value: number) => `${value}%`}
            />
            <Tooltip
              {...TOOLTIP}
              cursor={BAR_CURSOR}
              formatter={(value: unknown, name: unknown) => [formatPercent(Number(value), 2), String(name)]}
            />
            <Legend wrapperStyle={LEGEND} iconType="circle" iconSize={8} />
            <Bar dataKey="observed" name="Observed" fill="var(--chart-1)" radius={[3, 3, 0, 0]} maxBarSize={38} />
            <Line
              type="monotone"
              dataKey="expected"
              name="Expected"
              stroke="var(--chart-2)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
};

export const MonthlyVolumeChart = ({ rows }: { rows: RunStatsView["monthlyVolume"] }) => (
  <ChartFrame
    title="Monthly volume and flagged invoices"
    table={
      <DataTable
        head={["Month", "Invoices", "Amount", "Flagged"]}
        rows={rows.map((row) => [formatMonth(row.month), row.count, formatMoney(row.amount), row.flaggedCount])}
      />
    }
  >
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" tickFormatter={formatMonth} tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
          <YAxis tick={AXIS} width={40} allowDecimals={false} tickLine={false} axisLine={false} />
          <Tooltip {...TOOLTIP} cursor={BAR_CURSOR} labelFormatter={(label: unknown) => formatMonth(String(label))} />
          <Legend wrapperStyle={LEGEND} iconType="circle" iconSize={8} />
          <Bar dataKey="count" name="Invoices" fill="var(--chart-1)" radius={[3, 3, 0, 0]} maxBarSize={38} />
          <Bar dataKey="flaggedCount" name="Flagged" fill="var(--chart-2)" radius={[3, 3, 0, 0]} maxBarSize={38} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  </ChartFrame>
);

export const VendorScatterChart = ({ rows }: { rows: RunStatsView["vendorScatter"] }) => (
  <ChartFrame
    title="Vendors: invoice count against mean amount"
    description="Flagged vendors are highlighted."
    table={
      <DataTable
        head={["Vendor", "Ref", "Invoices", "Mean amount", "Flagged"]}
        rows={rows.map((row) => [
          row.name,
          row.vendorRef,
          row.invoiceCount,
          formatMoney(row.meanAmount),
          row.flagged ? "Yes" : "No",
        ])}
      />
    }
  >
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 16, bottom: 16, left: 8 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
          <XAxis type="number" dataKey="invoiceCount" name="Invoices" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
          <YAxis
            type="number"
            dataKey="meanAmount"
            name="Mean amount"
            tick={AXIS}
            width={70}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value: number) => formatCompact(value)}
          />
          <Tooltip
            {...TOOLTIP}
            cursor={{ strokeDasharray: "3 3", stroke: "var(--border)" }}
            formatter={(value: unknown, name: unknown) =>
              String(name) === "Mean amount"
                ? [formatMoney(Number(value)), String(name)]
                : [formatNumber(Number(value)), String(name)]
            }
            labelFormatter={() => ""}
          />
          <Scatter name="Vendors" data={rows}>
            {rows.map((row) => (
              <Cell key={row.vendorRef} fill={row.flagged ? "var(--chart-2)" : "var(--chart-1)"} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  </ChartFrame>
);
