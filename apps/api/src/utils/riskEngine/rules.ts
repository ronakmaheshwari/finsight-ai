import type {
  Category, EngInvoice, EngineData, EngEmployee, EngVendor, EntityRef, Evidence, Params,
  RawSignal, RuleKey, Severity, EngPO,
} from "./types";
import {
  benfordChiSquare, daysBetween, groupBy, isoWeekKey, isWeekend, mean, normInvoiceNumber, normPhone,
  normText, quantile, round2, sortedCopy, stdev, sum, ymd,
} from "./stats";

export interface Ctx {
  data: EngineData;
  vendorById: Map<string, EngVendor>;
  employeeById: Map<string, EngEmployee>;
  poById: Map<string, EngPO>;
  invoiceById: Map<string, EngInvoice>;
  invoicesByVendor: Map<string, EngInvoice[]>;  
  invoicesByPo: Map<string, EngInvoice[]>;
  popAmounts: number[];                    
  holidays: Set<string>;
  vendorLabel: (id: string) => string;          
  employeeLabel: (id: string) => string;
  invRefs: (ids: string[]) => string[];
  vendorTotal: (id: string) => number;
}

export function buildContext(data: EngineData, holidays: string[] = []): Ctx {
  const vendorById = new Map(data.vendors.map((v) => [v.id, v]));
  const employeeById = new Map(data.employees.map((e) => [e.id, e]));
  const poById = new Map(data.purchaseOrders.map((p) => [p.id, p]));
  const invoiceById = new Map(data.invoices.map((i) => [i.id, i]));
  const invoicesByVendor = groupBy(data.invoices, (i) => i.vendorId);
  invoicesByVendor.forEach((l) => l.sort((a, b) => a.invoiceDate.getTime() - b.invoiceDate.getTime()));
  const invoicesByPo = groupBy(data.invoices.filter((i) => i.poId), (i) => i.poId as string);
  const totals = new Map<string, number>();
  invoicesByVendor.forEach((l, k) => totals.set(k, sum(l.map((i) => i.amount))));
  return {
    data, vendorById, employeeById, poById, invoiceById, invoicesByVendor, invoicesByPo,
    popAmounts: sortedCopy(data.invoices.map((i) => i.amount)),
    holidays: new Set(holidays),
    vendorLabel: (id) => { const v = vendorById.get(id); return v ? `${v.ref} (${v.name})` : id; },
    employeeLabel: (id) => { const e = employeeById.get(id); return e ? `${e.ref} (${e.name})` : id; },
    invRefs: (ids) => ids.map((id) => invoiceById.get(id)?.ref ?? id),
    vendorTotal: (id) => totals.get(id) ?? 0,
  };
}

export interface Rule {
  key: RuleKey; category: Category; defaultWeight: number; defaultParams: Params;
  run: (ctx: Ctx, params: Params) => RawSignal[];
}

const V = (id: string): EntityRef => ({ type: "VENDOR", id });
const E = (id: string): EntityRef => ({ type: "EMPLOYEE", id });

function evidence(
  ctx: Ctx, invoiceIds: string[], explanation: string,
  observed: Record<string, unknown>, threshold: Record<string, unknown>, extraIds: string[] = [], extraRefs: string[] = [],
): Evidence {
  return {
    explanation, observed, threshold,
    recordIds: [...invoiceIds, ...extraIds],
    recordRefs: [...ctx.invRefs(invoiceIds), ...extraRefs],
  };
}

const duplicateInvoice: Rule = {
  key: "DUPLICATE_INVOICE", category: "ANOMALY", defaultWeight: 25, defaultParams: { windowDays: 7 },
  run(ctx, p) {
    const { windowDays = 7 } = p;
    const out: RawSignal[] = [];
    const inExact = new Set<string>();

    const byNumber = groupBy(ctx.data.invoices, (i) => `${i.vendorId}|${normInvoiceNumber(i.invoiceNumber)}`);
    byNumber.forEach((group) => {
      if (group.length < 2) return;
      const g = [...group].sort((a, b) => a.invoiceDate.getTime() - b.invoiceDate.getTime());
      g.forEach((i) => inExact.add(i.id));
      const dupes = g.slice(1);
      const ids = g.map((i) => i.id);
      const first = g[0]!;
      const last = g[g.length - 1]!;
      out.push({
        severity: "HIGH",
        title: `Invoice number "${first.invoiceNumber}" billed ${g.length} times by ${ctx.vendorLabel(first.vendorId)}`,
        entityType: "VENDOR", entityId: first.vendorId, entities: [V(first.vendorId)], invoiceIds: ids,
        exposureAmount: round2(sum(dupes.map((i) => i.amount))),
        evidence: evidence(ctx, ids,
          `The same invoice number was recorded ${g.length} times for one vendor, ${Math.round(daysBetween(first.invoiceDate, last.invoiceDate))} days apart.`,
          { invoiceNumber: first.invoiceNumber, amounts: g.map((i) => i.amount), dates: g.map((i) => ymd(i.invoiceDate)) },
          { allowedOccurrences: 1 }),
      });
    });

    ctx.invoicesByVendor.forEach((list, vendorId) => {
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const a = list[i]!, b = list[j]!;
          if (daysBetween(a.invoiceDate, b.invoiceDate) > windowDays) break; // list is date-sorted
          if (Math.abs(a.amount - b.amount) >= 0.005) continue;
          if (inExact.has(a.id) && inExact.has(b.id)) continue; // already reported as an exact duplicate
          out.push({
            severity: "MEDIUM",
            title: `Same amount ${a.amount.toFixed(2)} invoiced twice within ${windowDays} days by ${ctx.vendorLabel(vendorId)}`,
            entityType: "VENDOR", entityId: vendorId, entities: [V(vendorId)], invoiceIds: [a.id, b.id],
            exposureAmount: b.amount,
            evidence: evidence(ctx, [a.id, b.id],
              "Two invoices from the same vendor have an identical amount and were dated within days of each other, under different invoice numbers.",
              { amount: a.amount, invoiceNumbers: [a.invoiceNumber, b.invoiceNumber], dates: [ymd(a.invoiceDate), ymd(b.invoiceDate)] },
              { windowDays }),
          });
        }
      }
    });
    return out;
  },
};

const amountOutlier: Rule = {
  key: "AMOUNT_OUTLIER", category: "ANOMALY", defaultWeight: 15,
  defaultParams: { zScore: 3, minHistory: 5, minRatio: 2, fenceMultiplier: 3 },
  run(ctx, p) {
    const { zScore = 3, minHistory = 5, minRatio = 2, fenceMultiplier = 3 } = p;
    const out: RawSignal[] = [];
    const q1 = quantile(ctx.popAmounts, 0.25), q3 = quantile(ctx.popAmounts, 0.75);
    const fence = q3 + fenceMultiplier * (q3 - q1);

    ctx.invoicesByVendor.forEach((list, vendorId) => {
      list.forEach((inv, idx) => {
        if (list.length >= minHistory) {
          const others = list.filter((_, k) => k !== idx).map((x) => x.amount).filter((a) => a > 0);
          if (inv.amount <= 0 || others.length < 3) return;
          const logs = others.map(Math.log);
          const m = mean(logs), sd = stdev(logs);
          const avg = mean(others);
          const ratio = inv.amount / avg;
          if (sd <= 0 || ratio < minRatio) return;
          const z = (Math.log(inv.amount) - m) / sd;
          if (z < zScore) return;
          out.push({
            severity: ratio >= 3 ? "HIGH" : "MEDIUM",
            title: `Invoice ${inv.ref} is ${ratio.toFixed(1)}x ${ctx.vendorLabel(vendorId)}'s usual amount`,
            entityType: "VENDOR", entityId: vendorId, entities: [V(vendorId)], invoiceIds: [inv.id],
            exposureAmount: inv.amount,
            evidence: evidence(ctx, [inv.id],
              `This invoice is ${ratio.toFixed(1)}x the average of the vendor's other ${others.length} invoices (${round2(avg)}) and is ${z.toFixed(1)} standard deviations out on a log scale.`,
              { amount: inv.amount, zScoreOnLogScale: round2(z), ratioToVendorAverage: round2(ratio) },
              { zScore, minRatio, vendorAverage: round2(avg) }),
          });
        } else if (inv.amount > fence) {
          out.push({
            severity: inv.amount > fence * 2 ? "HIGH" : "MEDIUM",
            title: `Invoice ${inv.ref} (${inv.amount.toFixed(2)}) is far above the normal range for all invoices`,
            entityType: "VENDOR", entityId: vendorId, entities: [V(vendorId)], invoiceIds: [inv.id],
            exposureAmount: inv.amount,
            evidence: evidence(ctx, [inv.id],
              `The vendor has only ${list.length} invoice(s), so the amount was compared with the whole population. It is above the upper fence of ${round2(fence)}.`,
              { amount: inv.amount, vendorInvoiceCount: list.length },
              { upperFence: round2(fence), fenceMultiplier }),
          });
        }
      });
    });
    return out;
  },
};

const justBelowLimit: Rule = {
  key: "JUST_BELOW_LIMIT", category: "CONTROL", defaultWeight: 20,
  defaultParams: { lowerPct: 0.95, minOccurrences: 3 },
  run(ctx, p) {
    const { lowerPct = 0.95, minOccurrences = 3 } = p;
    const out: RawSignal[] = [];
    const byApprover = groupBy(ctx.data.invoices.filter((i) => i.approvedById), (i) => i.approvedById as string);
    byApprover.forEach((list, empId) => {
      const emp = ctx.employeeById.get(empId);
      const limit = emp?.approvalLimit ?? 0;
      if (!emp || limit <= 0) return;
      const near = list.filter((i) => i.amount >= limit * lowerPct && i.amount <= limit);
      if (near.length < minOccurrences) return;
      const severity: Severity = near.length >= 8 ? "CRITICAL" : near.length >= 5 ? "HIGH" : "MEDIUM";
      const ids = near.map((i) => i.id);
      out.push({
        severity,
        title: `${ctx.employeeLabel(empId)} approved ${near.length} invoices just under their ${limit.toLocaleString("en-US")} limit`,
        entityType: "EMPLOYEE", entityId: empId, entities: [E(empId)], invoiceIds: ids,
        exposureAmount: round2(sum(near.map((i) => i.amount))),
        evidence: evidence(ctx, ids,
          `${near.length} approvals fall between ${Math.round(lowerPct * 100)}% and 100% of this approver's limit, which can indicate invoices sized to avoid a higher approval level.`,
          { count: near.length, amountsAsPctOfLimit: near.map((i) => Math.round((i.amount / limit) * 1000) / 10) },
          { approvalLimit: limit, lowerPct, minOccurrences }, [empId], [emp.ref]),
      });
    });
    return out;
  },
};

const isMultiple = (n: number, m: number) => Math.abs(n / m - Math.round(n / m)) < 1e-9;

const roundAmount: Rule = {
  key: "ROUND_AMOUNT", category: "ANOMALY", defaultWeight: 8,
  defaultParams: { multiple: 1000, minInvoices: 10, minShare: 0.5, largeThreshold: 100000 },
  run(ctx, p) {
    const { multiple = 1000, minInvoices = 10, minShare = 0.5, largeThreshold = 100000 } = p;
    const out: RawSignal[] = [];
    ctx.invoicesByVendor.forEach((list, vendorId) => {
      const round = list.filter((i) => isMultiple(i.amount, multiple));
      if (list.length >= minInvoices && round.length / list.length >= minShare) {
        const share = round.length / list.length;
        const ids = round.map((i) => i.id);
        out.push({
          severity: share >= 0.8 ? "HIGH" : "MEDIUM",
          title: `${Math.round(share * 100)}% of ${ctx.vendorLabel(vendorId)}'s invoices are exact multiples of ${multiple}`,
          entityType: "VENDOR", entityId: vendorId, entities: [V(vendorId)], invoiceIds: ids,
          exposureAmount: round2(sum(round.map((i) => i.amount))),
          evidence: evidence(ctx, ids,
            "Genuine invoices rarely land on round numbers this often. Estimated or fabricated amounts often do.",
            { roundInvoices: round.length, totalInvoices: list.length, share: round2(share) },
            { multiple, minShare, minInvoices }),
        });
      }
      for (const inv of list) {
        if (inv.amount >= largeThreshold && isMultiple(inv.amount, multiple)) {
          out.push({
            severity: "LOW",
            title: `Large round-number invoice ${inv.ref} (${inv.amount.toLocaleString("en-US")})`,
            entityType: "VENDOR", entityId: vendorId, entities: [V(vendorId)], invoiceIds: [inv.id],
            exposureAmount: inv.amount,
            evidence: evidence(ctx, [inv.id], "A high-value invoice with no cents is worth checking against the underlying contract or PO.",
              { amount: inv.amount }, { largeThreshold, multiple }),
          });
        }
      }
    });
    return out;
  },
};

const benfordDeviation: Rule = {
  key: "BENFORD_DEVIATION", category: "ANOMALY", defaultWeight: 10,
  defaultParams: { minInvoices: 50, chiSquareCritical: 20.09 }, // df=8, p<0.01
  run(ctx, p) {
    const { minInvoices = 50, chiSquareCritical = 20.09 } = p;
    const out: RawSignal[] = [];
    ctx.invoicesByVendor.forEach((list, vendorId) => {
      if (list.length < minInvoices) return;
      const { chi, n, observed } = benfordChiSquare(list.map((i) => i.amount));
      if (chi <= chiSquareCritical) return;
      const ids = list.map((i) => i.id);
      out.push({
        severity: chi > chiSquareCritical * 2.5 ? "HIGH" : "MEDIUM",
        title: `${ctx.vendorLabel(vendorId)}'s invoice amounts do not follow the expected first-digit pattern`,
        entityType: "VENDOR", entityId: vendorId, entities: [V(vendorId)], invoiceIds: ids,
        exposureAmount: round2(sum(list.map((i) => i.amount))),
        evidence: evidence(ctx, ids,
          `Across ${n} invoices the leading digits differ strongly from Benford's law (chi-square ${chi.toFixed(1)}). This is a screening signal, not proof.`,
          { chiSquare: round2(chi), invoices: n, observedFirstDigitShare: observed.map((x) => round2(x)) },
          { chiSquareCritical, minInvoices }),
      });
    });
    return out;
  },
};

const newVendorHighValue: Rule = {
  key: "NEW_VENDOR_HIGH_VALUE", category: "ANOMALY", defaultWeight: 15,
  defaultParams: { maxAgeDays: 30, percentile: 0.9 },
  run(ctx, p) {
    const { maxAgeDays = 30, percentile = 0.9 } = p;
    const out: RawSignal[] = [];
    const threshold = quantile(ctx.popAmounts, percentile);
    for (const inv of ctx.data.invoices) {
      const v = ctx.vendorById.get(inv.vendorId);
      if (!v) continue;
      const age = daysBetween(v.createdAt, inv.invoiceDate);
      if (age > maxAgeDays || inv.amount <= threshold) continue;
      out.push({
        severity: inv.amount >= threshold * 3 ? "HIGH" : "MEDIUM",
        title: age < 0
          ? `Invoice ${inv.ref} is dated before ${ctx.vendorLabel(v.id)} existed in the vendor master`
          : `High-value invoice ${inv.ref} from ${ctx.vendorLabel(v.id)}, created ${Math.round(age)} days earlier`,
        entityType: "VENDOR", entityId: v.id, entities: [V(v.id)], invoiceIds: [inv.id], exposureAmount: inv.amount,
        evidence: evidence(ctx, [inv.id],
          `The vendor was created ${Math.round(age)} day(s) before this invoice and the amount is above the ${Math.round(percentile * 100)}th percentile of all invoices.`,
          { amount: inv.amount, vendorAgeDays: Math.round(age), vendorCreated: ymd(v.createdAt) },
          { maxAgeDays, amountPercentileValue: round2(threshold) }),
      });
    }
    return out;
  },
};

const velocitySpike: Rule = {
  key: "VELOCITY_SPIKE", category: "ANOMALY", defaultWeight: 12,
  defaultParams: { multiplier: 3, minCount: 4, minBaselineWeeks: 12 },
  run(ctx, p) {
    const { multiplier = 3, minCount = 4, minBaselineWeeks = 12 } = p;
    const out: RawSignal[] = [];
    ctx.invoicesByVendor.forEach((list, vendorId) => {
      if (list.length < minCount) return;
      const weeks = groupBy(list, (i) => isoWeekKey(i.invoiceDate));
      const first = list[0]!;
      const last = list[list.length - 1]!;
      const spanWeeks = Math.max(
        minBaselineWeeks,
        Math.ceil(daysBetween(first.invoiceDate, last.invoiceDate) / 7) + 1,
      );
      weeks.forEach((inWeek, weekKey) => {
        const baseline = (list.length - inWeek.length) / spanWeeks;
        if (inWeek.length < minCount || inWeek.length <= multiplier * baseline) return;
        const ids = inWeek.map((i) => i.id);
        out.push({
          severity: inWeek.length >= minCount * 3 ? "HIGH" : "MEDIUM",
          title: `${inWeek.length} invoices from ${ctx.vendorLabel(vendorId)} in week ${weekKey} (usual: ${baseline.toFixed(1)} per week)`,
          entityType: "VENDOR", entityId: vendorId, entities: [V(vendorId)], invoiceIds: ids,
          exposureAmount: round2(sum(inWeek.map((i) => i.amount))),
          evidence: evidence(ctx, ids,
            `This vendor normally sends about ${baseline.toFixed(1)} invoices a week but sent ${inWeek.length} in ${weekKey}.`,
            { invoicesInWeek: inWeek.length, week: weekKey, baselinePerWeek: round2(baseline) },
            { multiplier, minCount }),
        });
      });
    });
    return out;
  },
};

const invoicePoMismatch: Rule = {
  key: "INVOICE_PO_MISMATCH", category: "CONTROL", defaultWeight: 20,
  defaultParams: { tolerancePct: 0.1, highPct: 0.2 },
  run(ctx, p) {
    const { tolerancePct = 0.1, highPct = 0.2 } = p;
    const out: RawSignal[] = [];
    for (const inv of ctx.data.invoices) {
      if (inv.poId && ctx.poById.has(inv.poId)) continue;
      out.push({
        severity: "MEDIUM",
        title: `Invoice ${inv.ref} from ${ctx.vendorLabel(inv.vendorId)} has no purchase order`,
        entityType: "VENDOR", entityId: inv.vendorId, entities: [V(inv.vendorId)], invoiceIds: [inv.id],
        exposureAmount: inv.amount,
        evidence: evidence(ctx, [inv.id], "The invoice was paid without a matching purchase order, so there is no record that the spend was authorised in advance.",
          { amount: inv.amount, poId: inv.poId }, { requirement: "every invoice has a PO" }),
      });
    }
    ctx.invoicesByPo.forEach((list, poId) => {
      const po = ctx.poById.get(poId);
      if (!po || po.amount <= 0) return;
      const total = sum(list.map((i) => i.amount));
      const over = total / po.amount - 1;
      if (over <= tolerancePct) return;
      const ids = list.map((i) => i.id);
      out.push({
        severity: over > highPct ? "HIGH" : "MEDIUM",
        title: `Invoices on PO ${po.ref} total ${Math.round(over * 100)}% more than the PO (${ctx.vendorLabel(po.vendorId)})`,
        entityType: "VENDOR", entityId: po.vendorId, entities: [V(po.vendorId)], invoiceIds: ids,
        exposureAmount: round2(total - po.amount),
        evidence: evidence(ctx, ids,
          `The PO was for ${po.amount.toLocaleString("en-US")} but ${list.length} invoice(s) totalling ${round2(total).toLocaleString("en-US")} were billed against it.`,
          { poAmount: po.amount, invoicedTotal: round2(total), overPct: Math.round(over * 1000) / 10 },
          { tolerancePct }, [po.id], [po.ref]),
      });
    });
    return out;
  },
};

/* ---------------------------- 9. SELF_APPROVAL ---------------------------- */
// the employee who created a vendor also approves that vendor's invoices (segregation of duties)

const selfApproval: Rule = {
  key: "SELF_APPROVAL", category: "CONTROL", defaultWeight: 25, defaultParams: {},
  run(ctx) {
    const out: RawSignal[] = [];
    ctx.invoicesByVendor.forEach((list, vendorId) => {
      const v = ctx.vendorById.get(vendorId);
      if (!v?.createdById) return;
      const own = list.filter((i) => i.approvedById === v.createdById);
      if (!own.length) return;
      const ids = own.map((i) => i.id);
      out.push({
        severity: "HIGH",
        title: `${ctx.employeeLabel(v.createdById)} created ${ctx.vendorLabel(vendorId)} and approved ${own.length} of its invoices`,
        entityType: "VENDOR", entityId: vendorId, entities: [V(vendorId), E(v.createdById)], invoiceIds: ids,
        exposureAmount: round2(sum(own.map((i) => i.amount))),
        evidence: evidence(ctx, ids,
          "The same person set up the vendor and approved its payments, which removes the independent check between the two steps.",
          { approvedInvoices: own.length, vendorTotalInvoices: list.length },
          { requirement: "vendor creator and invoice approver must differ" }, [v.createdById], [ctx.employeeById.get(v.createdById)?.ref ?? v.createdById]),
      });
    });
    return out;
  },
};

const sharedBankAccount: Rule = {
  key: "SHARED_BANK_ACCOUNT", category: "RELATIONSHIP", defaultWeight: 30, defaultParams: {},
  run(ctx) {
    const out: RawSignal[] = [];
    const keyOfAccount = new Map(ctx.data.bankAccounts.map((b) => [b.id, b.accountNumberHash || b.id]));
    const refOfAccount = new Map(ctx.data.bankAccounts.map((b) => [b.id, b.ref]));
    type Holder = { type: "VENDOR" | "EMPLOYEE"; id: string; accountId: string };
    const holders: Holder[] = [];
    for (const v of ctx.data.vendors) if (v.bankAccountId) holders.push({ type: "VENDOR", id: v.id, accountId: v.bankAccountId });
    for (const e of ctx.data.employees) if (e.bankAccountId) holders.push({ type: "EMPLOYEE", id: e.id, accountId: e.bankAccountId });

    groupBy(holders, (h) => keyOfAccount.get(h.accountId) ?? h.accountId).forEach((group) => {
      if (group.length < 2) return;
      const vendors = group.filter((h) => h.type === "VENDOR"), emps = group.filter((h) => h.type === "EMPLOYEE");
      const severity: Severity = vendors.length && emps.length ? "CRITICAL" : vendors.length >= 2 ? "HIGH" : "MEDIUM";
      const invoiceIds = vendors.flatMap((h) => (ctx.invoicesByVendor.get(h.id) ?? []).map((i) => i.id));
      const names = group.map((h) => (h.type === "VENDOR" ? ctx.vendorLabel(h.id) : ctx.employeeLabel(h.id)));
      const accountId = group[0]!.accountId;
      out.push({
        severity,
        title: vendors.length && emps.length
          ? `${names[0]} shares a bank account with ${names.slice(1).join(", ")}`
          : `${names.join(" and ")} share a bank account`,
        entityType: vendors.length ? "VENDOR" : "EMPLOYEE", entityId: (vendors[0] ?? emps[0])!.id,
        entities: [...group.map((h) => ({ type: h.type, id: h.id }) as EntityRef), { type: "BANK_ACCOUNT", id: accountId }],
        invoiceIds,
        exposureAmount: round2(sum(vendors.map((h) => ctx.vendorTotal(h.id)))),
        evidence: evidence(ctx, invoiceIds,
          vendors.length && emps.length
            ? "A vendor is paid into the same bank account as an employee. This is a classic indicator of a fictitious vendor or a conflict of interest."
            : "Different parties are registered with the same bank account.",
          { holders: names, bankAccount: refOfAccount.get(accountId) ?? accountId },
          { expected: "each bank account belongs to one party" }, group.map((h) => h.id), names),
      });
    });
    return out;
  },
};

const sharedAddressPhone: Rule = {
  key: "SHARED_ADDRESS_PHONE", category: "RELATIONSHIP", defaultWeight: 22, defaultParams: { minAddressLength: 8, minPhoneDigits: 7 },
  run(ctx, p) {
    const { minAddressLength = 8, minPhoneDigits = 7 } = p;
    const out: RawSignal[] = [];
    const addrKey = (a?: string | null) => { const n = normText(a); return n.length >= minAddressLength ? n : ""; };
    const phoneKey = (a?: string | null) => { const n = normPhone(a); return n.length >= minPhoneDigits ? n : ""; };

    const byAddr = new Map<string, { type: "VENDOR" | "EMPLOYEE"; id: string }[]>();
    const byPhone = new Map<string, { type: "VENDOR" | "EMPLOYEE"; id: string }[]>();
    const add = (m: typeof byAddr, k: string, h: { type: "VENDOR" | "EMPLOYEE"; id: string }) => {
      if (!k) return; const l = m.get(k); if (l) l.push(h); else m.set(k, [h]);
    };
    for (const v of ctx.data.vendors) { add(byAddr, addrKey(v.address), { type: "VENDOR", id: v.id }); add(byPhone, phoneKey(v.phone), { type: "VENDOR", id: v.id }); }
    for (const e of ctx.data.employees) { add(byAddr, addrKey(e.address), { type: "EMPLOYEE", id: e.id }); add(byPhone, phoneKey(e.phone), { type: "EMPLOYEE", id: e.id }); }

    for (const v of ctx.data.vendors) {
      const sameAddr = (byAddr.get(addrKey(v.address)) ?? []).filter((h) => h.id !== v.id);
      const samePhone = (byPhone.get(phoneKey(v.phone)) ?? []).filter((h) => h.id !== v.id);
      const empAddr = sameAddr.filter((h) => h.type === "EMPLOYEE"), empPhone = samePhone.filter((h) => h.type === "EMPLOYEE");
      const venAddr = sameAddr.filter((h) => h.type === "VENDOR"), venPhone = samePhone.filter((h) => h.type === "VENDOR");

      const employees = [...new Set([...empAddr, ...empPhone].map((h) => h.id))];
      if (employees.length) {
        const both = empAddr.length > 0 && empPhone.length > 0;
        const ids = (ctx.invoicesByVendor.get(v.id) ?? []).map((i) => i.id);
        out.push({
          severity: both ? "HIGH" : "MEDIUM",
          title: `${ctx.vendorLabel(v.id)} shares its ${both ? "address and phone" : empAddr.length ? "address" : "phone"} with ${employees.map((e) => ctx.employeeLabel(e)).join(", ")}`,
          entityType: "VENDOR", entityId: v.id, entities: [V(v.id), ...employees.map(E)], invoiceIds: ids,
          exposureAmount: round2(ctx.vendorTotal(v.id)),
          evidence: evidence(ctx, ids,
            "A vendor's contact details match an employee's, which can indicate a related party or a fictitious vendor.",
            { sharedAddress: empAddr.length > 0, sharedPhone: empPhone.length > 0, employees: employees.map((e) => ctx.employeeById.get(e)?.ref) },
            { expected: "vendor contact details are independent of staff" }, [v.id, ...employees]),
        });
      }
      // vendor-vendor sharing, reported once (from the lower id) and kept low-key: affiliates are common
      const others = [...new Set([...venAddr, ...venPhone].map((h) => h.id))].filter((id) => id > v.id);
      for (const other of others) {
        const both = venAddr.some((h) => h.id === other) && venPhone.some((h) => h.id === other);
        const ids = [...(ctx.invoicesByVendor.get(v.id) ?? []), ...(ctx.invoicesByVendor.get(other) ?? [])].map((i) => i.id);
        out.push({
          severity: both ? "MEDIUM" : "LOW",
          title: `${ctx.vendorLabel(v.id)} and ${ctx.vendorLabel(other)} share ${both ? "address and phone" : "an address or phone"}`,
          entityType: "VENDOR", entityId: v.id, entities: [V(v.id), V(other)], invoiceIds: ids,
          exposureAmount: round2(ctx.vendorTotal(v.id) + ctx.vendorTotal(other)),
          evidence: evidence(ctx, ids, "Two vendors with the same contact details may be one entity billing twice, or affiliates.",
            { vendors: [v.ref, ctx.vendorById.get(other)?.ref] }, { expected: "distinct contact details" }, [v.id, other]),
        });
      }
    }
    return out;
  },
};

const weekendOffhours: Rule = {
  key: "WEEKEND_OFFHOURS", category: "ANOMALY", defaultWeight: 6, defaultParams: { percentile: 0.9 },
  run(ctx, p) {
    const { percentile = 0.9 } = p;
    const out: RawSignal[] = [];
    const txAmounts = sortedCopy(ctx.data.transactions.map((t) => t.amount));
    const threshold = quantile(txAmounts, percentile);
    const hits = ctx.data.transactions.filter(
      (t) => t.vendorId && t.amount >= threshold && (isWeekend(t.postedAt) || ctx.holidays.has(ymd(t.postedAt))),
    );
    groupBy(hits, (t) => t.vendorId as string).forEach((list, vendorId) => {
      const invIds = list.map((t) => t.invoiceId).filter((x): x is string => !!x);
      out.push({
        severity: list.length >= 3 ? "MEDIUM" : "LOW",
        title: `${list.length} high-value payment(s) to ${ctx.vendorLabel(vendorId)} posted on a weekend or holiday`,
        entityType: "VENDOR", entityId: vendorId, entities: [V(vendorId)], invoiceIds: invIds,
        exposureAmount: round2(sum(list.map((t) => t.amount))),
        evidence: evidence(ctx, invIds, "Large payments posted outside normal working days receive less oversight.",
          { payments: list.map((t) => ({ ref: t.ref, date: ymd(t.postedAt), amount: t.amount })) },
          { amountAtLeast: round2(threshold), percentile }),
      });
    });
    return out;
  },
};

export const RULES: Rule[] = [
  duplicateInvoice, amountOutlier, justBelowLimit, roundAmount, benfordDeviation, newVendorHighValue,
  velocitySpike, invoicePoMismatch, selfApproval, sharedBankAccount, sharedAddressPhone, weekendOffhours,
];