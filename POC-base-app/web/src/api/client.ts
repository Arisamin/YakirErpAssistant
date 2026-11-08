import type { Me, Project, Supplier, SupplierInvoice, InvoiceInput, Customer, Contract, ContractInput, BillingDoc, DocInput, Worker, Workday, OverviewData, CollectionsData, UserRow, RolePerm, FieldSetting, OrgSettings } from '../types';

const API_BASE = (import.meta.env.VITE_API_URL as string) || 'http://localhost:4000/api';

const ACCESS_KEY = 'app_access';
const REFRESH_KEY = 'app_refresh';

export const tokens = {
  get access() {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY);
  },
  set(access: string, refresh?: string) {
    localStorage.setItem(ACCESS_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export class ApiError extends Error {
  status: number;
  mfaRequired?: boolean;
  constructor(status: number, message: string, mfaRequired?: boolean) {
    super(message);
    this.status = status;
    this.mfaRequired = mfaRequired;
  }
}

async function parse(res: Response) {
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new ApiError(res.status, data.error || 'שגיאת שרת', data.mfaRequired);
  }
  return data;
}

async function tryRefresh(): Promise<boolean> {
  const refresh = tokens.refresh;
  if (!refresh) return false;
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: refresh }),
  });
  if (!res.ok) return false;
  const data = await res.json();
  tokens.set(data.accessToken);
  return true;
}

async function apiFetch(path: string, options: RequestInit = {}, retry = true): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (tokens.access) headers.Authorization = `Bearer ${tokens.access}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (res.status === 401 && retry && tokens.refresh) {
    if (await tryRefresh()) return apiFetch(path, options, false);
  }
  return parse(res);
}

export const api = {
  async login(email: string, password: string, token?: string) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, token }),
    });
    // 206 = נדרש קוד אימות דו-שלבי
    if (res.status === 206) throw new ApiError(206, 'נדרש אימות דו-שלבי', true);
    const data = await parse(res);
    tokens.set(data.accessToken, data.refreshToken);
    return data.user;
  },
  me(): Promise<Me> {
    return apiFetch('/auth/me');
  },
  users(): Promise<UserRow[]> {
    return apiFetch('/auth/users');
  },
  createUser(data: { name: string; email: string; password: string; roleKey: string; status: string }): Promise<any> {
    return apiFetch('/auth/users', { method: 'POST', body: JSON.stringify(data) });
  },
  updateUser(id: string, data: { roleKey?: string; status?: string }): Promise<{ ok: boolean }> {
    return apiFetch(`/auth/users/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  roles(): Promise<RolePerm[]> {
    return apiFetch('/auth/roles');
  },
  setPermission(data: { roleKey: string; menuKey: string; view: boolean; write: boolean; del: boolean }): Promise<{ ok: boolean }> {
    return apiFetch('/auth/permissions', { method: 'PUT', body: JSON.stringify(data) });
  },
  setup2fa(): Promise<{ secret: string; otpauth: string }> {
    return apiFetch('/auth/2fa/setup', { method: 'POST' });
  },
  enable2fa(token: string): Promise<{ ok: boolean }> {
    return apiFetch('/auth/2fa/enable', { method: 'POST', body: JSON.stringify({ token }) });
  },
  projects(): Promise<Project[]> {
    return apiFetch('/projects');
  },
  overview(): Promise<OverviewData> {
    return apiFetch('/overview');
  },
  suppliers(): Promise<Supplier[]> {
    return apiFetch('/suppliers');
  },
  expenseTypes(): Promise<string[]> {
    return apiFetch('/expense-types');
  },
  updateSupplier(id: string, data: Partial<{ name: string; taxId: string; hhAccountKey: string; vatRate: number; defaultExpenseType: string; defaultTerms: string; bankCode: string; branchCode: string; bankAccount: string }>): Promise<Supplier> {
    return apiFetch(`/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  createSupplier(data: { name: string; taxId?: string; hhAccountKey?: string; vatRate?: number; defaultTerms?: string }): Promise<Supplier> {
    return apiFetch('/suppliers', { method: 'POST', body: JSON.stringify(data) });
  },
  deleteSupplier(id: string): Promise<void> {
    return apiFetch(`/suppliers/${id}`, { method: 'DELETE' });
  },
  createProject(data: { code: string; name: string; costBudget: number; status?: string }): Promise<Project> {
    return apiFetch('/projects', { method: 'POST', body: JSON.stringify(data) });
  },
  updateProject(id: string, data: Partial<{ code: string; name: string; costBudget: number; status: string }>): Promise<Project> {
    return apiFetch(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  deleteProject(id: string): Promise<void> {
    return apiFetch(`/projects/${id}`, { method: 'DELETE' });
  },
  createCustomer(data: { name: string; taxId?: string }): Promise<Customer> {
    return apiFetch('/customers', { method: 'POST', body: JSON.stringify(data) });
  },
  updateCustomer(id: string, data: Partial<{ name: string; taxId: string }>): Promise<Customer> {
    return apiFetch(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  deleteCustomer(id: string): Promise<void> {
    return apiFetch(`/customers/${id}`, { method: 'DELETE' });
  },
  deleteWorker(id: string): Promise<void> {
    return apiFetch(`/workers/${id}`, { method: 'DELETE' });
  },
  orgSettings(): Promise<OrgSettings> {
    return apiFetch('/org-settings');
  },
  setOrgSettings(data: Partial<OrgSettings>): Promise<OrgSettings> {
    return apiFetch('/org-settings', { method: 'PUT', body: JSON.stringify(data) });
  },
  supplierInvoices(): Promise<SupplierInvoice[]> {
    return apiFetch('/supplier-invoices');
  },
  createSupplierInvoice(data: InvoiceInput): Promise<SupplierInvoice> {
    return apiFetch('/supplier-invoices', { method: 'POST', body: JSON.stringify(data) });
  },
  updateSupplierInvoice(id: string, data: InvoiceInput): Promise<SupplierInvoice> {
    return apiFetch(`/supplier-invoices/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  deleteSupplierInvoice(id: string): Promise<void> {
    return apiFetch(`/supplier-invoices/${id}`, { method: 'DELETE' });
  },
  invoiceFieldSettings(): Promise<FieldSetting[]> {
    return apiFetch('/invoice-field-settings');
  },
  setInvoiceFieldSetting(fieldKey: string, required: boolean): Promise<{ ok: boolean }> {
    return apiFetch('/invoice-field-settings', { method: 'PUT', body: JSON.stringify({ fieldKey, required }) });
  },
  customers(): Promise<Customer[]> {
    return apiFetch('/customers');
  },
  contracts(): Promise<Contract[]> {
    return apiFetch('/contracts');
  },
  createContract(data: ContractInput): Promise<Contract> {
    return apiFetch('/contracts', { method: 'POST', body: JSON.stringify(data) });
  },
  updateContract(id: string, data: ContractInput): Promise<Contract> {
    return apiFetch(`/contracts/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  deleteContract(id: string): Promise<void> {
    return apiFetch(`/contracts/${id}`, { method: 'DELETE' });
  },
  billingDocs(): Promise<BillingDoc[]> {
    return apiFetch('/billing-docs');
  },
  createBillingDoc(data: DocInput): Promise<BillingDoc> {
    return apiFetch('/billing-docs', { method: 'POST', body: JSON.stringify(data) });
  },
  updateBillingDoc(id: string, data: DocInput): Promise<BillingDoc> {
    return apiFetch(`/billing-docs/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  deleteBillingDoc(id: string): Promise<void> {
    return apiFetch(`/billing-docs/${id}`, { method: 'DELETE' });
  },
  workers(): Promise<Worker[]> {
    return apiFetch('/workers');
  },
  createWorker(data: { name: string; role?: string; dailyCost: number }): Promise<Worker> {
    return apiFetch('/workers', { method: 'POST', body: JSON.stringify(data) });
  },
  updateWorker(id: string, data: Partial<{ name: string; role: string; dailyCost: number; active: boolean }>): Promise<Worker> {
    return apiFetch(`/workers/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  workdays(): Promise<Workday[]> {
    return apiFetch('/workdays');
  },
  setWorkday(cell: Workday): Promise<{ ok: boolean }> {
    return apiFetch('/workdays', { method: 'PUT', body: JSON.stringify(cell) });
  },
  importWorkdays(data: { month: string; rows: { name: string; cells: Record<string, number> }[] }): Promise<{ matched: number; created: number }> {
    return apiFetch('/workdays/import', { method: 'POST', body: JSON.stringify(data) });
  },
  collections(): Promise<CollectionsData> {
    return apiFetch('/collections');
  },
  reportProject(projectId: string): Promise<any> {
    return apiFetch(`/reports/project/${projectId}`);
  },
  reportSummary(): Promise<any> {
    return apiFetch('/reports/summary');
  },
  reportAging(): Promise<any> {
    return apiFetch('/reports/aging');
  },
  reportCashflow(): Promise<any> {
    return apiFetch('/reports/cashflow');
  },
  masav(from: string, to: string): Promise<any> {
    return apiFetch(`/payments/masav?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
  },
  hhPending(): Promise<import('../types').HhPending> {
    return apiFetch('/hashavshevet/pending');
  },
  hhExport(): Promise<import('../types').HhExportResult> {
    return apiFetch('/hashavshevet/export', { method: 'POST' });
  },
  hhHistory(): Promise<import('../types').HhBatch[]> {
    return apiFetch('/hashavshevet/history');
  },
  hhUndo(batch: string): Promise<{ ok: boolean; reverted: number }> {
    return apiFetch('/hashavshevet/undo', { method: 'POST', body: JSON.stringify({ batch }) });
  },
  convertSupplierInvoice(id: string): Promise<SupplierInvoice> {
    return apiFetch(`/supplier-invoices/${id}/to-invoice`, { method: 'POST' });
  },
  convertBillingDoc(id: string): Promise<import('../types').BillingDoc> {
    return apiFetch(`/billing-docs/${id}/to-invoice`, { method: 'POST' });
  },
  openPayments(): Promise<import('../types').OpenPayment[]> {
    return apiFetch('/payments/open');
  },
  markPaid(data: { ids: string[]; payDate: string; batchRef?: string }): Promise<{ ok: boolean; marked: number }> {
    return apiFetch('/payments/mark-paid', { method: 'POST', body: JSON.stringify(data) });
  },
  importData(entity: string, rows: any[]): Promise<{ ok: boolean; total: number; created: number; updated: number; skipped: number }> {
    return apiFetch(`/import/${entity}`, { method: 'POST', body: JSON.stringify({ rows }) });
  },
  addCollectionAction(docId: string, data: { actionType: string; actionDate: string; note?: string; nextFollowup?: string }): Promise<{ ok: boolean }> {
    return apiFetch(`/collections/${docId}/actions`, { method: 'POST', body: JSON.stringify(data) });
  },
  logout() {
    tokens.clear();
  },
};
