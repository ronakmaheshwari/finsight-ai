import type { EngineData, EntityType, RiskCase, RiskSignal } from "./types";
import { normPhone, normText } from "./stats";

export interface GraphEdge { fromType: EntityType; fromId: string; toType: EntityType; toId: string; relation: string }
export interface GraphNode { id: string; type: EntityType; label: string; flagged: boolean }

const nid = (type: EntityType, id: string) => `${type}:${id}`;

export function buildGraphEdges(data: EngineData): GraphEdge[] {
  const edges: GraphEdge[] = [];
  const add = (fromType: EntityType, fromId: string | null | undefined, toType: EntityType, toId: string | null | undefined, relation: string) => {
    if (fromId && toId) edges.push({ fromType, fromId, toType, toId, relation });
  };
  const accountKey = new Map(data.bankAccounts.map((b) => [b.id, b.accountNumberHash || b.id]));
  const canonicalAccount = new Map<string, string>(); // first account id seen for a given number
  data.bankAccounts.forEach((b) => { const k = accountKey.get(b.id)!; if (!canonicalAccount.has(k)) canonicalAccount.set(k, b.id); });
  const acct = (id: string | null) => (id ? canonicalAccount.get(accountKey.get(id) ?? id) ?? id : null);

  for (const e of data.employees) add("EMPLOYEE", e.id, "BANK_ACCOUNT", acct(e.bankAccountId), "HAS_ACCOUNT");
  for (const v of data.vendors) {
    add("VENDOR", v.id, "BANK_ACCOUNT", acct(v.bankAccountId), "HAS_ACCOUNT");
    add("VENDOR", v.id, "EMPLOYEE", v.createdById, "CREATED_BY");
  }
  for (const p of data.purchaseOrders) {
    add("PO", p.id, "VENDOR", p.vendorId, "ISSUED_TO");
    add("PO", p.id, "EMPLOYEE", p.approvedById, "APPROVED_BY");
  }
  for (const i of data.invoices) {
    add("INVOICE", i.id, "VENDOR", i.vendorId, "BILLED_BY");
    add("INVOICE", i.id, "PO", i.poId, "FOR_PO");
    add("INVOICE", i.id, "EMPLOYEE", i.approvedById, "APPROVED_BY");
  }
  for (const t of data.transactions) add("TRANSACTION", t.id, "INVOICE", t.invoiceId, "PAYS");

  // derived: shared address / phone between vendors and employees
  const holders = [
    ...data.vendors.map((v) => ({ type: "VENDOR" as const, id: v.id, a: normText(v.address), p: normPhone(v.phone) })),
    ...data.employees.map((e) => ({ type: "EMPLOYEE" as const, id: e.id, a: normText(e.address), p: normPhone(e.phone) })),
  ];
  const seen = new Set<string>();
  const link = (key: "a" | "p", relation: string, min: number) => {
    const m = new Map<string, typeof holders>();
    holders.forEach((h) => { if (h[key].length >= min) (m.get(h[key]) ?? m.set(h[key], []).get(h[key])!).push(h); });
    m.forEach((g) => { for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) {
      const left = g[i]!, right = g[j]!;
      if (left.type === "EMPLOYEE" && right.type === "EMPLOYEE") continue;
      const k = `${relation}|${left.id}|${right.id}`;
      if (!seen.has(k)) { seen.add(k); add(left.type, left.id, right.type, right.id, relation); }
    } });
  };
  link("a", "SHARES_ADDRESS", 8);
  link("p", "SHARES_PHONE", 7);
  return edges;
}

/** Nodes + edges to draw for one case. Invoices are capped so a vendor with 60 invoices stays readable. */
export function caseGraph(
  data: EngineData, edges: GraphEdge[], theCase: RiskCase, signals: RiskSignal[], maxInvoices = 12,
): { nodes: GraphNode[]; edges: { id: string; source: string; target: string; label: string }[] } {
  const mine = signals.filter((s) => theCase.signalIds.includes(s.id));
  const include = new Set<string>();
  theCase.entities.forEach((e) => include.add(nid(e.type, e.id)));
  mine.forEach((s) => s.entities.forEach((e) => include.add(nid(e.type, e.id))));
  [...new Set(mine.flatMap((s) => s.invoiceIds))].slice(0, maxInvoices).forEach((id) => include.add(nid("INVOICE", id)));

  // pull in the PO and approver of each included invoice so the story is connected
  const extra = edges.filter((e) => e.fromType === "INVOICE" && include.has(nid("INVOICE", e.fromId)));
  extra.forEach((e) => include.add(nid(e.toType, e.toId)));

  const label = (type: EntityType, id: string) => {
    if (type === "VENDOR") return data.vendors.find((v) => v.id === id)?.name ?? id;
    if (type === "EMPLOYEE") return data.employees.find((x) => x.id === id)?.name ?? id;
    if (type === "INVOICE") return data.invoices.find((x) => x.id === id)?.ref ?? id;
    if (type === "PO") return data.purchaseOrders.find((x) => x.id === id)?.ref ?? id;
    if (type === "BANK_ACCOUNT") return `Account ${data.bankAccounts.find((x) => x.id === id)?.ref ?? id}`;
    return id;
  };
  const flagged = new Set(mine.flatMap((s) => s.entities.map((e) => nid(e.type, e.id))));
  const nodes: GraphNode[] = [...include].map((k) => {
    const [type, ...rest] = k.split(":"); const id = rest.join(":");
    return { id: k, type: type as EntityType, label: label(type as EntityType, id), flagged: flagged.has(k) };
  });
  const out = edges
    .filter((e) => include.has(nid(e.fromType, e.fromId)) && include.has(nid(e.toType, e.toId)) && e.fromType !== "TRANSACTION" && e.toType !== "TRANSACTION")
    .map((e, i) => ({ id: `e${i}`, source: nid(e.fromType, e.fromId), target: nid(e.toType, e.toId), label: e.relation }));
  return { nodes, edges: out };
}
