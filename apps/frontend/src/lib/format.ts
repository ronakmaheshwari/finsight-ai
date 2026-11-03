import { format, parseISO } from "date-fns";

const numberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

/** No currency symbol: the dataset is currency-agnostic (§11.3). */
export const formatNumber = (value: number | null | undefined): string => {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return numberFormatter.format(value);
};

export const formatMoney = formatNumber;

export const formatCompact = (value: number): string =>
  new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value);

export const formatPercent = (value: number, digits = 1): string =>
  `${Number.isFinite(value) ? value.toFixed(digits) : "0"}%`;

export const formatDate = (value: string | Date | null | undefined): string => {
  if (!value) return "—";
  const date = typeof value === "string" ? parseISO(value) : value;
  return Number.isNaN(date.getTime()) ? "—" : format(date, "dd MMM yyyy");
};

export const formatDateTime = (value: string | Date | null | undefined): string => {
  if (!value) return "—";
  const date = typeof value === "string" ? parseISO(value) : value;
  return Number.isNaN(date.getTime()) ? "—" : format(date, "dd MMM yyyy, HH:mm");
};

export const formatMonth = (month: string): string => {
  const date = parseISO(`${month}-01`);
  return Number.isNaN(date.getTime()) ? month : format(date, "MMM yyyy");
};

export const formatDuration = (ms: number | null | undefined): string => {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1000) return `${ms} ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes} min ${seconds % 60} s`;
};

export const formatElapsed = (from: string | null | undefined, now = Date.now()): string => {
  if (!from) return "—";
  const started = parseISO(from).getTime();
  if (Number.isNaN(started)) return "—";
  return formatDuration(Math.max(0, now - started));
};

export const titleCase = (value: string): string =>
  value
    .toLowerCase()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

export const pluralize = (count: number, singular: string, plural = `${singular}s`): string =>
  `${formatNumber(count)} ${count === 1 ? singular : plural}`;
