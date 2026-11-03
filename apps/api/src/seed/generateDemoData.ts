import type { SheetRow } from "../datasets/fileReader";
import { DATASET_COLUMNS, ORDER, type Entity } from "../datasets/spec";

/**
 * Deterministic demo dataset.
 *
 * The implementation plan ships `seed-data/finsight_test_data.xlsx`; when that
 * file is not present the seeder falls back to this generator so `db:seed`
 * still produces a realistic, scenario-rich dataset. It plants the same
 * scenarios as Appendix C (S1..S10) with fixed ids, so the demo and the
 * acceptance checks behave the same way.
 */

export type DemoSheet = { header: string[]; rows: SheetRow[] };
export type DemoSheets = Record<Entity, DemoSheet>;

/* ------------------------------- utilities -------------------------------- */

const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Reset on every call so the generator is deterministic and repeatable. */
let rand = mulberry32(42);

const int = (min: number, max: number): number => min + Math.floor(rand() * (max - min + 1));
const pick = <T>(items: readonly T[]): T => items[Math.floor(rand() * items.length)]!;
const money = (min: number, max: number): string => (min + rand() * (max - min)).toFixed(2);
const roundMoney = (value: number): string => value.toFixed(2);
const pad = (value: number, size: number): string => String(value).padStart(size, "0");
const ymd = (date: Date): string => date.toISOString().slice(0, 10);

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const PERIOD_START = new Date("2025-11-01T00:00:00.000Z");
const PERIOD_END = new Date("2026-10-31T00:00:00.000Z");
const PERIOD_DAYS = Math.round((PERIOD_END.getTime() - PERIOD_START.getTime()) / 86_400_000);

const dateInPeriod = (): Date => addDays(PERIOD_START, int(0, PERIOD_DAYS));

const FIRST_NAMES = [
  "Asha", "Mohan", "Anika", "Vikram", "Priya", "Rahul", "Neha", "Arjun", "Kavya", "Deepak",
  "Meera", "Sanjay", "Ritu", "Amit", "Sneha", "Rohit", "Pooja", "Karan", "Divya", "Naveen",
  "Isha", "Varun", "Tara", "Aditya",
];

const LAST_NAMES = [
  "Sharma", "Verma", "Iyer", "Nair", "Gupta", "Rao", "Patel", "Mehta", "Singh", "Joshi",
  "Kulkarni", "Reddy", "Bose", "Chawla", "Desai", "Menon",
];

const DEPARTMENTS = ["Finance", "Procurement", "Operations", "IT", "Marketing", "HR", "Legal"];

const VENDOR_WORDS = [
  "Apex", "Brightline", "Crescent", "Delta", "Everest", "Fortune", "Global", "Horizon",
  "Indigo", "Jupiter", "Kestrel", "Luminous", "Meridian", "Nova", "Orchid", "Pinnacle",
  "Quantum", "Radiant", "Summit", "Titan", "Umbra", "Vertex", "Willow", "Zenith",
];

const VENDOR_SUFFIX = ["Consulting Services", "Traders Pvt Ltd", "Industries", "Logistics", "Systems", "Supplies"];

const BANKS = ["HDFC Bank", "ICICI Bank", "Axis Bank", "State Bank of India", "Kotak Bank", "IDFC First"];

const city = (index: number): string =>
  [
    "12 MG Road, Bengaluru",
    "45 Park Street, Kolkata",
    "8 Nehru Place, New Delhi",
    "22 Anna Salai, Chennai",
    "77 Banjara Hills, Hyderabad",
    "5 FC Road, Pune",
    "19 CG Road, Ahmedabad",
    "3 Marine Drive, Mumbai",
  ][index % 8]!;

const phone = (index: number): string => `+91-9${pad(100000000 + index * 7919, 9)}`;

/* -------------------------------- builder --------------------------------- */

interface InvoiceDraft {
  id: string;
  vendorId: string;
  poId: string | null;
  invoiceNumber: string;
  amount: string;
  date: string;
  approvedBy: string;
  /** Payment date override, used to create weekend postings. */
  postedAt?: string;
}

interface PoDraft {
  id: string;
  vendorId: string;
  amount: string;
  issuedDate: string;
  approvedBy: string;
}

const rowsOf = (entity: Entity, values: Record<string, string>[]): SheetRow[] =>
  values.map((row, index) => ({ rowNumber: index + 2, values: row }));

export const generateDemoSheets = (): DemoSheets => {
  rand = mulberry32(42);

  /* ----------------------------- bank accounts ---------------------------- */
  const bankAccounts: Record<string, string>[] = [];
  for (let i = 1; i <= 120; i++) {
    bankAccounts.push({
      bank_account_id: `BA-${pad(i, 4)}`,
      account_number: `1000${pad(i, 8)}`,
      bank_name: pick(BANKS),
    });
  }

  /* ------------------------------- employees ------------------------------ */
  const employees: Record<string, string>[] = [];
  const employeeIds: string[] = [];
  for (let i = 1; i <= 24; i++) {
    const id = `E-${pad(i, 3)}`;
    employeeIds.push(id);
    const isNearLimit = id === "E-012";
    employees.push({
      employee_id: id,
      name: `${FIRST_NAMES[(i - 1) % FIRST_NAMES.length]!} ${LAST_NAMES[(i * 3) % LAST_NAMES.length]!}`,
      department: DEPARTMENTS[i % DEPARTMENTS.length]!,
      approval_limit: isNearLimit ? "100000" : String([25000, 50000, 100000, 250000][i % 4]),
      bank_account_id: id === "E-007" ? "BA-0120" : `BA-${pad(i, 4)}`,
      address: `${city(i)}, Unit ${i}`,
      phone: phone(i),
      email: `employee${i}@demo-manufacturing.example`,
    });
  }

  /* -------------------------------- vendors ------------------------------- */
  const vendors: Record<string, string>[] = [];
  const vendorIds: string[] = [];
  for (let i = 1; i <= 67; i++) {
    const id = `V-${pad(i, 3)}`;
    vendorIds.push(id);
    vendors.push({
      vendor_id: id,
      name: `${VENDOR_WORDS[(i - 1) % VENDOR_WORDS.length]!} ${VENDOR_SUFFIX[i % VENDOR_SUFFIX.length]!}`,
      tax_id: `27ABCDE${pad(i, 4)}F1Z${i % 10}`,
      address: `${city(i + 3)}, Unit ${i + 200}`,
      phone: phone(100 + i),
      created_date: ymd(addDays(new Date("2025-01-15T00:00:00.000Z"), int(0, 240))),
      status: "ACTIVE",
      bank_account_id: `BA-${pad(24 + i, 4)}`,
      created_by: pick(employeeIds),
    });
  }

  // Scenario vendors (S1, S4, S5, S7, S8, S9, S10).
  const specialVendors: Record<string, string>[] = [
    {
      vendor_id: "V-901", name: "Apex Consulting Services", tax_id: "27APEX901F1Z1",
      address: city(1), phone: phone(901), created_date: "2025-04-10", status: "ACTIVE",
      bank_account_id: "BA-0120", created_by: "E-007",
    },
    {
      vendor_id: "V-902", name: "Nova Industrial Supplies", tax_id: "27NOVA902F1Z2",
      address: city(2), phone: phone(902), created_date: "2026-08-05", status: "ACTIVE",
      bank_account_id: "BA-0101", created_by: "E-004",
    },
    {
      vendor_id: "V-903", name: "Meridian Logistics", tax_id: "27MERI903F1Z3",
      address: city(3), phone: phone(903), created_date: "2025-02-20", status: "ACTIVE",
      bank_account_id: "BA-0102", created_by: "E-005",
    },
    {
      vendor_id: "V-904", name: "Crescent Systems", tax_id: "27CRES904F1Z4",
      address: city(4), phone: phone(904), created_date: "2025-06-11", status: "ACTIVE",
      bank_account_id: "BA-0103", created_by: "E-015",
    },
    {
      vendor_id: "V-905", name: "Orchid Marketing", tax_id: "27ORCH905F1Z5",
      address: `${city(20)}, Unit 20`, phone: phone(20), created_date: "2025-03-03", status: "ACTIVE",
      bank_account_id: "BA-0104", created_by: "E-006",
    },
    {
      vendor_id: "V-906", name: "Titan Trading", tax_id: "27TITA906F1Z6",
      address: city(6), phone: phone(906), created_date: "2025-01-05", status: "ACTIVE",
      bank_account_id: "BA-0105", created_by: "E-008",
    },
    {
      vendor_id: "V-907", name: "Summit Software Licences", tax_id: "27SUMM907F1Z7",
      address: city(7), phone: phone(907), created_date: "2025-05-05", status: "ACTIVE",
      bank_account_id: "BA-0106", created_by: "E-009",
    },
  ];
  vendors.push(...specialVendors);
  vendorIds.push(...specialVendors.map((vendor) => vendor.vendor_id!));

  /* ---------------------------- purchase orders --------------------------- */
  const purchaseOrders: PoDraft[] = [];
  const invoiceDrafts: InvoiceDraft[] = [];
  let poSeq = 0;
  let invoiceSeq = 0;

  const addInvoiceWithPo = (draft: Omit<InvoiceDraft, "poId" | "id">, poApprovedBy = draft.approvedBy): string => {
    poSeq += 1;
    const poId = `PO-${pad(poSeq, 5)}`;
    purchaseOrders.push({
      id: poId,
      vendorId: draft.vendorId,
      amount: draft.amount,
      issuedDate: draft.date,
      approvedBy: poApprovedBy,
    });
    invoiceSeq += 1;
    const id = `INV-${pad(invoiceSeq, 6)}`;
    invoiceDrafts.push({ ...draft, id, poId });
    return id;
  };

  const addInvoiceWithoutPo = (draft: Omit<InvoiceDraft, "poId" | "id">): string => {
    invoiceSeq += 1;
    const id = `INV-${pad(invoiceSeq, 6)}`;
    invoiceDrafts.push({ ...draft, id, poId: null });
    return id;
  };

  // Base population: 520 clean invoices, each with its own PO.
  const creatorOf = new Map(vendors.map((vendor) => [vendor.vendor_id!, vendor.created_by!]));
  const approverFor = (vendorId: string): string => {
    const creator = creatorOf.get(vendorId);
    for (let attempt = 0; attempt < 8; attempt++) {
      const candidate = pick(employeeIds);
      if (candidate !== creator) return candidate;
    }
    return employeeIds[0]!;
  };

  for (let i = 0; i < 520; i++) {
    const vendorId = vendorIds[i % 67]!;
    const amount = money(1200, 78000);
    addInvoiceWithPo({
      vendorId,
      invoiceNumber: `INV-2026-${pad(1000 + i, 5)}`,
      amount,
      date: ymd(dateInPeriod()),
      approvedBy: approverFor(vendorId),
    });
  }

  // S1: vendor and employee share a bank account.
  for (let i = 0; i < 6; i++) {
    addInvoiceWithPo({
      vendorId: "V-901",
      invoiceNumber: `APX-2026-${pad(10 + i, 4)}`,
      amount: roundMoney(30000 + i * 1500),
      date: ymd(addDays(PERIOD_START, 60 + i * 20)),
      approvedBy: "E-010",
    });
  }

  // S2a / S2b: duplicate invoices.
  for (const [vendorId, number, amount, offset] of [
    ["V-014", "DUP-014", 25000, 40],
    ["V-031", "DUP-031", 18000, 120],
  ] as const) {
    for (let copy = 0; copy < 2; copy++) {
      addInvoiceWithPo({
        vendorId,
        invoiceNumber: number,
        amount: roundMoney(amount),
        date: ymd(addDays(PERIOD_START, offset + copy * 3)),
        approvedBy: "E-009",
      });
    }
  }

  // S3: nine invoices parked just below E-012's approval limit.
  for (let i = 0; i < 9; i++) {
    addInvoiceWithPo({
      vendorId: vendorIds[45 + i]!,
      invoiceNumber: `LIMIT-${pad(i + 1, 3)}`,
      amount: roundMoney(96000),
      date: ymd(addDays(PERIOD_START, 30 + i * 30)),
      approvedBy: "E-012",
    });
  }

  // S4: brand-new vendor with high-value invoices.
  for (const [index, amount] of [300000, 120000, 90000].entries()) {
    addInvoiceWithPo({
      vendorId: "V-902",
      invoiceNumber: `NOVA-${pad(index + 1, 3)}`,
      amount: roundMoney(amount),
      date: ymd(addDays(new Date("2026-08-08T00:00:00.000Z"), index * 4)),
      approvedBy: "E-004",
    });
  }

  // S5: a burst of invoices from one vendor in a single week.
  for (let i = 0; i < 8; i++) {
    addInvoiceWithPo({
      vendorId: "V-903",
      invoiceNumber: `MERI-${pad(i + 1, 3)}`,
      amount: roundMoney(12000 + i * 700),
      date: ymd(addDays(new Date("2026-06-01T00:00:00.000Z"), i % 5)),
      approvedBy: "E-011",
    });
  }

  // S6: invoices with no purchase order.
  for (const [index, vendorId] of ["V-001", "V-023", "V-025", "V-030", "V-050", "V-054"].entries()) {
    addInvoiceWithoutPo({
      vendorId,
      invoiceNumber: `NOPO-${pad(index + 1, 3)}`,
      amount: roundMoney(15000 + index * 4500),
      date: ymd(addDays(PERIOD_START, 90 + index * 35)),
      approvedBy: "E-013",
    });
  }

  // S7: the vendor creator also approves its invoices.
  for (let i = 0; i < 5; i++) {
    addInvoiceWithPo({
      vendorId: "V-904",
      invoiceNumber: `CRES-${pad(i + 1, 3)}`,
      amount: roundMoney(20000 + i * 6000),
      date: ymd(addDays(PERIOD_START, 50 + i * 40)),
      approvedBy: "E-015",
    });
  }

  // S8: vendor shares an address and phone with an employee.
  for (let i = 0; i < 4; i++) {
    addInvoiceWithPo({
      vendorId: "V-905",
      invoiceNumber: `ORCH-${pad(i + 1, 3)}`,
      amount: roundMoney(14000 + i * 3000),
      date: ymd(addDays(PERIOD_START, 70 + i * 45)),
      approvedBy: "E-021",
    });
  }

  // S9: round amounts and a first-digit distribution that breaks Benford.
  for (let i = 0; i < 55; i++) {
    const amount =
      i < 30
        ? 90000 + (i % 10) * 1000
        : i < 35
          ? 900000 + i * 1000
          : int(90000, 99999);
    addInvoiceWithPo({
      vendorId: "V-906",
      invoiceNumber: `TITA-${pad(i + 1, 3)}`,
      amount: roundMoney(amount),
      date: ymd(addDays(PERIOD_START, 5 + i * 6)),
      approvedBy: "E-008",
    });
  }

  // S10: the legitimate annual licence, expected to rank low.
  addInvoiceWithPo({
    vendorId: "V-907",
    invoiceNumber: "SUMM-ANNUAL-2026",
    amount: roundMoney(120000),
    date: "2026-04-01",
    approvedBy: "E-001",
  });

  /* ------------------------------ transactions ---------------------------- */
  const transactions: Record<string, string>[] = invoiceDrafts.map((invoice, index) => {
    const base = new Date(`${invoice.date}T00:00:00.000Z`);
    let posted = addDays(base, 2 + (index % 4));
    // A slice of payments lands on a Saturday to exercise WEEKEND_OFFHOURS.
    if (index % 37 === 0) {
      while (posted.getUTCDay() !== 6) posted = addDays(posted, 1);
    }
    return {
      transaction_id: `TX-${pad(index + 1, 6)}`,
      invoice_id: invoice.id,
      vendor_id: invoice.vendorId,
      amount: invoice.amount,
      posted_at: ymd(posted),
      description: `Payment ${invoice.invoiceNumber}`,
    };
  });

  /* -------------------------------- sheets -------------------------------- */
  const headerOf = (entity: Entity): string[] => DATASET_COLUMNS[entity].map((column) => column.key);

  const valuesByEntity: Record<Entity, Record<string, string>[]> = {
    "bank-accounts": bankAccounts,
    employees,
    vendors,
    "purchase-orders": purchaseOrders.map((po) => ({
      po_id: po.id,
      vendor_id: po.vendorId,
      amount: po.amount,
      issued_date: po.issuedDate,
      approved_by: po.approvedBy,
    })),
    invoices: invoiceDrafts.map((invoice) => ({
      invoice_id: invoice.id,
      vendor_id: invoice.vendorId,
      po_id: invoice.poId ?? "",
      invoice_number: invoice.invoiceNumber,
      amount: invoice.amount,
      invoice_date: invoice.date,
      approved_by: invoice.approvedBy,
    })),
    transactions,
  };

  const sheets = {} as DemoSheets;
  for (const entity of ORDER) {
    sheets[entity] = {
      header: headerOf(entity),
      rows: rowsOf(entity, valuesByEntity[entity]),
    };
  }

  return sheets;
};

export const DEMO_SCENARIOS = [
  { id: "S1", ruleKey: "SHARED_BANK_ACCOUNT", match: "V-901" },
  { id: "S2a", ruleKey: "DUPLICATE_INVOICE", match: "V-014" },
  { id: "S2b", ruleKey: "DUPLICATE_INVOICE", match: "V-031" },
  { id: "S3", ruleKey: "JUST_BELOW_LIMIT", match: "E-012" },
  { id: "S4", ruleKey: "NEW_VENDOR_HIGH_VALUE", match: "V-902" },
  { id: "S5", ruleKey: "VELOCITY_SPIKE", match: "V-903" },
  { id: "S6", ruleKey: "INVOICE_PO_MISMATCH", match: "V-001" },
  { id: "S7", ruleKey: "SELF_APPROVAL", match: "V-904" },
  { id: "S8", ruleKey: "SHARED_ADDRESS_PHONE", match: "V-905" },
  { id: "S9a", ruleKey: "ROUND_AMOUNT", match: "V-906" },
  { id: "S9b", ruleKey: "BENFORD_DEVIATION", match: "V-906" },
] as const;
