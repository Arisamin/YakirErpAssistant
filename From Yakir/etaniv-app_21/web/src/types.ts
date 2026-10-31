export interface Permission {
  menuKey: string;
  view: boolean;
  write: boolean;
  delete: boolean;
}

export interface Me {
  id: string;
  name: string;
  email: string;
  role: string;
  roleName: string;
  mfaEnabled: boolean;
  permissions: Permission[];
}

export interface Project {
  id: string;
  code: string;
  name: string;
  costBudget: string | number;
  status: string;
}

export interface ProfitRow {
  id: string;
  code: string;
  name: string;
  income: number;
  materials: number;
  labor: number;
  cost: number;
  profit: number;
  margin: number;
  costBudget: number;
  utilization: number;
}

export interface OverviewData {
  projects: ProfitRow[];
  totals: {
    income: number;
    materials: number;
    labor: number;
    cost: number;
    profit: number;
    margin: number;
    costBudget: number;
    utilization: number;
  };
}

export interface Supplier {
  id: string;
  name: string;
  taxId?: string;
  hhAccountKey?: string;
  vatRate?: number;
  defaultExpenseType?: string;
  defaultTerms?: string;
  bankCode?: string;
  branchCode?: string;
  bankAccount?: string;
}

export interface InvoiceLine {
  id?: string;
  projectId: string;
  project?: { code: string; name: string };
  expenseType: string;
  amount: number;
}

export interface SupplierInvoice {
  id: string;
  supplierId: string;
  supplier?: { id: string; name: string };
  invoiceNo: string;
  invoiceDate: string;
  intakeDate: string | null;
  docKind?: 'tax' | 'esek';
  amountBeforeVat: number;
  vatRate?: number;
  vat: number;
  total: number;
  terms: string;
  payDate: string | null;
  approved: boolean;
  recordedHh: boolean;
  inCashflow: boolean;
  paid: boolean;
  actualPayDate: string | null;
  reference?: string;
  purchaseOrderNo?: string;
  deliveryNoteNo?: string;
  matched: boolean;
  notes?: string;
  selfInvoiceNo?: string;
  hhExportedAt?: string | null;
  hhExportBatch?: string | null;
  status: string;
  lines: InvoiceLine[];
}

export interface HhRow {
  supplierKey: string;
  supplierName: string;
  date: string;
  valueDate: string;
  reference: string;
  project: string;
  details: string;
  debit: number;
}
export interface HhPending {
  rows: HhRow[];
  invoiceCount: number;
  lineCount: number;
  total: number;
  missingKey: string[];
}
export interface HhExportResult {
  batch: string;
  rows: HhRow[];
  invoiceCount: number;
  lineCount: number;
  total: number;
}
export interface HhBatch {
  batch: string;
  exportedAt: string | null;
  invoiceCount: number;
  total: number;
}

export interface CashLedgerRow {
  sortDate: string;
  actualDate: string | null;
  valueDate: string | null;
  category: string;
  name: string;
  reference: string;
  description: string;
  project: string;
  status: string;
  expense: number;
  income: number;
  kind: string;
  id: string;
  batchRef?: string | null;
  balance: number;
}
export interface CashflowData {
  opening: number;
  ledger: CashLedgerRow[];
  totals: { income: number; expense: number; net: number; closing: number };
}
export interface OpenPayment {
  id: string;
  supplier: string;
  invoiceNo: string;
  total: number;
  payDate: string | null;
  selfInvoiceNo: string | null;
}

// הגדרת שדה חובה לאישור חשבונית ספק (ניתן לעריכה ע"י מנהל המערכת)
export interface FieldSetting {
  fieldKey: string;
  label: string;
  required: boolean;
}

// הגדרות ארגון — מוסד שולח למס"ב + יתרת פתיחה לתזרים
export interface OrgSettings {
  masavInstitutionCode: string;
  masavSenderName: string;
  openingBalance: number;
}

export interface Customer {
  id: string;
  name: string;
  taxId?: string;
}

export interface Contract {
  id: string;
  code: string;
  customerId: string;
  customer: string;
  projectId: string;
  project?: { code: string; name: string };
  value: number;
  paymentTerms: string;
  retentionPct: number;
  status: string;
  billed: number;
  collected: number;
  retentionHeld: number;
  open: number;
}

export interface ContractInput {
  code: string;
  customerName: string;
  projectId: string;
  value: number;
  paymentTerms: string;
  retentionPct: number;
  status: string;
}

export interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  mfaEnabled: boolean;
  lastLogin: string | null;
}

export interface RolePerm {
  key: string;
  name: string;
  permissions: { menuKey: string; view: boolean; write: boolean; delete: boolean }[];
}

export interface CollectionItem {
  id: string;
  number: string;
  customer: string;
  project: string;
  net: number;
  paid: number;
  open: number;
  dueDate: string | null;
  daysOverdue: number;
  bucket: number;
  bucketLabel: string;
  lastAction: { type: string; date: string; next: string | null } | null;
}

export interface CollectionsData {
  items: CollectionItem[];
  buckets: { k: number; label: string; total: number; count: number }[];
  totalOpen: number;
  overdueTotal: number;
}

export interface Worker {
  id: string;
  name: string;
  role?: string | null;
  dailyCost: number;
  active: boolean;
}

export interface Workday {
  workerId: string;
  projectId: string;
  month: string;
  days: number;
}

export interface Offset {
  id?: string;
  reason: string;
  amount: number;
}

export interface BillingDoc {
  id: string;
  type: string; // עסקה | מס | מס-קבלה
  number: string;
  contractId: string;
  contractCode?: string;
  customer: string;
  projectId?: string;
  project?: { code: string; name: string };
  issueDate: string;
  amountBeforeVat: number;
  vat: number;
  gross: number;
  retentionPct: number;
  retention: number;
  offsets: Offset[];
  offsetsSum: number;
  net: number;
  terms: string;
  dueDate: string | null;
  status: string;
  paidAmount: number;
  open: number;
  recordedHh: boolean;
}

export interface DocInput {
  type: string;
  number: string;
  contractId: string;
  issueDate: string;
  amountBeforeVat: number;
  retentionPct: number;
  terms: string;
  status: string;
  paidAmount: number;
  recordedHh: boolean;
  offsets: { reason: string; amount: number }[];
}

export interface InvoiceInput {
  supplierId: string;
  invoiceNo: string;
  invoiceDate: string;
  intakeDate?: string;
  docKind?: 'tax' | 'esek';
  amountBeforeVat: number;
  vatRate?: number;
  terms: string;
  approved: boolean;
  recordedHh: boolean;
  inCashflow: boolean;
  paid: boolean;
  actualPayDate?: string;
  purchaseOrderNo?: string;
  deliveryNoteNo?: string;
  matched: boolean;
  notes?: string;
  selfInvoiceNo?: string;
  lines: { projectId: string; expenseType: string; amount: number }[];
}

export interface MenuDef {
  key: string;
  label: string;
  path: string;
}

// המודולים בתפריט — הצגתם נשלטת לפי הרשאת הצפייה של המשתמש
export const MENUS: MenuDef[] = [
  { key: 'overview', label: 'סקירת פרויקטים', path: '/' },
  { key: 'suppliers', label: 'חשבוניות ספקים', path: '/suppliers' },
  { key: 'labor', label: 'עבודה ועובדים', path: '/labor' },
  { key: 'contracts', label: 'חוזים ולקוחות', path: '/contracts' },
  { key: 'docs', label: 'חשבוניות ללקוח', path: '/docs' },
  { key: 'collections', label: 'גביית חובות', path: '/collections' },
  { key: 'reports', label: 'דוחות חיתוך', path: '/reports' },
  { key: 'import', label: 'ייבוא נתונים', path: '/import' },
  { key: 'permissions', label: 'ניהול הרשאות', path: '/permissions' },
];
