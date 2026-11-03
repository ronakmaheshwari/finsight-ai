import { sha256 } from "../../lib/hash";
import { collectStrings } from "./languageRules";

export type AliasKind = "VENDOR" | "EMPLOYEE" | "BANK_ACCOUNT";

export interface AliasEntry {
  alias: string;
  kind: AliasKind;
  id: string;
  ref: string;
  name: string;
  label: string;
}

export interface MaskContext {
  entries: AliasEntry[];
  replacements: { from: string; to: string }[];
  knownAliases: Set<string>;
  /** Values that must never appear in a masked packet. */
  sensitive: string[];
}

const letters = (index: number): string => {
  let value = index;
  let out = "";
  do {
    out = String.fromCharCode(65 + (value % 26)) + out;
    value = Math.floor(value / 26) - 1;
  } while (value >= 0);
  return out;
};

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const replaceTokens = (text: string, replacements: { from: string; to: string }[]): string => {
  let out = text;

  for (const { from, to } of replacements) {
    if (from.length === 0) continue;
    const pattern = new RegExp(`(?<![\\w-])${escapeRegex(from)}(?![\\w-])`, "gi");
    out = out.replace(pattern, to);
  }

  return out;
};

export const maskValue = <T>(value: T, ctx: MaskContext): T => {
  if (typeof value === "string") return replaceTokens(value, ctx.replacements) as T;
  if (Array.isArray(value)) return value.map((entry) => maskValue(entry, ctx)) as T;
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      out[key] = maskValue(entry, ctx);
    }
    return out as T;
  }
  return value;
};

export const unmaskValue = <T>(value: T, ctx: MaskContext): T => {
  if (typeof value === "string") {
    let out: string = value;
    for (const entry of ctx.entries) {
      const pattern = new RegExp(`(?<![\\w-])${escapeRegex(entry.alias)}(?![\\w-])`, "gi");
      out = out.replace(pattern, entry.label);
    }
    return out as T;
  }
  if (Array.isArray(value)) return value.map((entry) => unmaskValue(entry, ctx)) as T;
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      out[key] = unmaskValue(entry, ctx);
    }
    return out as T;
  }
  return value;
};

export const createAliasContext = (input: {
  vendors: { id: string; ref: string; name: string }[];
  employees: { id: string; ref: string; name: string }[];
  accounts: { id: string; ref: string; name: string }[];
  sensitive: string[];
}): MaskContext => {
  const entries: AliasEntry[] = [];

  [...input.vendors]
    .sort((a, b) => a.id.localeCompare(b.id))
    .forEach((vendor, index) => {
      entries.push({
        alias: `Vendor ${letters(index)}`,
        kind: "VENDOR",
        id: vendor.id,
        ref: vendor.ref,
        name: vendor.name,
        label: `${vendor.ref} (${vendor.name})`,
      });
    });

  [...input.employees]
    .sort((a, b) => a.id.localeCompare(b.id))
    .forEach((employee, index) => {
      entries.push({
        alias: `Employee ${index + 1}`,
        kind: "EMPLOYEE",
        id: employee.id,
        ref: employee.ref,
        name: employee.name,
        label: `${employee.ref} (${employee.name})`,
      });
    });

  [...input.accounts]
    .sort((a, b) => a.id.localeCompare(b.id))
    .forEach((account, index) => {
      entries.push({
        alias: `Account ${index + 1}`,
        kind: "BANK_ACCOUNT",
        id: account.id,
        ref: account.ref,
        name: account.name,
        label: account.name,
      });
    });

  const replacements = entries
    .flatMap((entry) => [
      { from: entry.name, to: entry.alias },
      { from: entry.ref, to: entry.alias },
    ])
    .filter((entry) => entry.from.length > 1)
    .sort((a, b) => b.from.length - a.from.length);

  const sensitive = [
    ...input.sensitive,
    ...entries.map((entry) => entry.name),
    ...entries.map((entry) => entry.ref),
  ].filter((token) => token.length >= 3);

  return {
    entries,
    replacements,
    knownAliases: new Set(entries.map((entry) => entry.alias)),
    sensitive,
  };
};

/** Throws before any network call if a real identifier survived masking. */
export const assertNoLeak = (packet: unknown, ctx: MaskContext): void => {
  const text = JSON.stringify(packet);

  for (const token of ctx.sensitive) {
    const pattern = new RegExp(`(?<![\\w-])${escapeRegex(token)}(?![\\w-])`, "i");
    if (pattern.test(text)) {
      throw new Error("MASKING_LEAK");
    }
  }
};

/** An alias that is not in the mapping means the model invented an entity. */
export const findUnknownAliases = (value: unknown, ctx: MaskContext): string[] => {
  const text = collectStrings(value).join("\n");
  const matches = text.match(/\b(?:Vendor [A-Z]+|Employee \d+|Account \d+)\b/g) ?? [];
  return [...new Set(matches.filter((match) => !ctx.knownAliases.has(match)))];
};

export const packetHash = (maskedPacket: unknown, promptVersion: string, model: string): string => {
  const canonical = JSON.stringify(sortKeys(maskedPacket));
  return sha256(`${canonical}|${promptVersion}|${model}`);
};

const sortKeys = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, sortKeys(entry)]),
    );
  }
  return value;
};
