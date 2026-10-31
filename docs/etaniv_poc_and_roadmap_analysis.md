# Analysis of Etaniv POC Tool & AI Technical Roadmap

This document analyzes the artifacts provided directly by Yakir in the `From Yakir/` folder:
1. **Interactive Prototype:** `אתניב — מערכת ניהול פרויקטלי (תצוגה חיה).html` (Etaniv Project-Financial Management System).
2. **AI Go-Live Guide & Roadmap:** `Etaniv — Go Live Guide.html` (Deployment blueprint for Render.com).

---

## 1. Part A: Analysis of the HTML POC Tool (`אתניב`)

### 1.1 True Business Purpose of the System
Yakir does not merely need an invoice typing utility to dump records into Hashavshevet. His business—**אתניב ב.י בע"מ (Etaniv B.Y. Ltd. — Water & Environmental Technologies)**—operates as a project-based engineering contractor.

The tool is a comprehensive **Project-Based Cost Accounting System (*תמחיר פרויקטים*)**.
- **Software Analogy:** Hashavshevet is the central cold transactional ledger (the core database). Etaniv's system is the operational application orchestration layer where site managers, engineers, and accountants allocate costs, verify deliveries, and track budgets *before* committing transactions to Hashavshevet.

---

### 1.2 Hidden Workflows Discovered in the POC

From inspecting the 43 mocked API endpoints and data models in the prototype, several critical real-world workflows were uncovered that were not in the initial scope:

#### A. Project & Expense-Type Line Splitting (*פיצול שורות לפי פרויקט וסעיף תקציב*)
- **Accounting Reality:** A single supplier invoice (e.g., from a pipe distributor) often supplies multiple job sites.
- **In the Code:** Each invoice row contains a `lines` array:
  ```json
  [
    { "projectId": "p1", "projectCode": "101", "expenseType": "צנרת", "amount": 90000 },
    { "projectId": "p2", "projectCode": "102", "expenseType": "פלסטיקה", "amount": 36000 }
  ]
  ```
- **Software Analogy:** Splitting a consolidated cloud invoice across multiple microservice budget tags.

#### B. 3-Way Matching (*התאמה משולשת: הזמנת רכש + תעודת משלוח + חשבונית מס*)
- **Accounting Reality:** Internal controls require verifying three independent artifacts before an invoice can be legally approved for payment:
  1. **Purchase Order (*הזמנת רכש*)**: Proves price and terms were authorized in advance.
  2. **Delivery Note (*תעודת משלוח*)**: Proves items were physically received and inspected on site.
  3. **Tax Invoice (*חשבונית מס*)**: Proves the financial claim from the vendor.
- **In the Code:** Invoices enforce `matched: true`, referencing `purchaseOrderNo` and `deliveryNoteNo`. Without 3-way match, payment approval is blocked by `approvalErr()`.
- **Software Analogy:** A 3-way cryptographic handshake or signature verification before committing a transaction.

#### C. Six-Stage Invoice Lifecycle State Machine
Invoices progress through a formal state machine:
$$\text{התקבלה (Received)} \longrightarrow \text{סווגה (Classified)} \longrightarrow \text{אושרה לתשלום (Approved)}$$
$$\longrightarrow \text{נקלטה בהנה"ח (Recorded in Hashavshevet)} \longrightarrow \text{צורפה לתזרים (In Cashflow)} \longrightarrow \text{שולמה (Paid)}$$

#### D. Payment Terms & Israeli "Shotef Plus" Scheduling (*שוטף פלוס*)
- **Accounting Reality:** Standard Israeli commercial payment terms are calculated as end-of-month plus $N$ days (*שוטף+30, שוטף+60, שוטף+90*).
- **In the Code:** `shotef(invoiceDate, days)` computes `payDate`, and `assignRun(dueISO)` slots payments into semi-monthly payment runs on the **15th** and **30th** of each month.
- **Software Analogy:** A scheduled cron job queue that batches outgoing payment tasks.

#### E. Masav Interbank Electronic Clearing (*מס"ב - מרכז סליקה בנקאי*)
- **Accounting Reality:** Masav is the Israeli clearing house used by commercial companies to disburse electronic bank transfers to hundreds of vendors in a single batch.
- **In the Code:** Tracks bank code (*קוד בנק*), branch (*סניף*), and account number (*חשבון*) for all 756 suppliers, and generates `/payments/masav` batch files.
- **Software Analogy:** Bulk payout gateway (like Stripe Payouts or ACH/SEPA file generation).

#### F. Labor Tracking & Customer Contracts (*כוח אדם, חוזים ועיכבון*)
- **Labor Tracking:** Logs daily worker shifts (`/workdays`) and allocates direct labor costs to projects alongside raw materials.
- **Customer Contracts & Retention (*עיכבון*):** Manages project income, client billing, and retention (a 5%–10% warranty escrow withheld by construction clients until project handover).
- **Debt Aging (*גיול חובות*):** Overdue collection buckets (0–30, 31–60, 61–90, 90+ days).

---

### 1.3 Alignment & Gaps with Initial Assumptions

| Feature | Initial Plan | Yakir's POC Reality | Analysis / Gap |
|---|---|---|---|
| **System Scope** | Generic invoice data entry | Full project costing, labor, contracts, and cash flow | **Major expansion:** Yakir needs a comprehensive operational ERP companion for his water engineering business. |
| **Database Need** | We considered dropping the database for a stateless v2 | Heavy relational data: 756 suppliers, 172 customers, projects, contracts, bank details | **Database is mandatory:** Persistent state, relational integrity, and historical cash flow tracking are essential. |
| **Hashavshevet Export** | Simple journal entries | Project-coded expense rows (`projectCode` + `expenseType`) | Entries in Hashavshevet must carry project cost-center codes for profit & loss reporting (*דוח רווח והפסד פרויקטלי*). |

---

## 2. Part B: Analysis of the Roadmap (`Etaniv — Go Live Guide.html`)

### 2.1 Technical Architecture in the Roadmap
The guide outlines a turnkey 3-tier architecture built for **Render.com**:
- **Application Services (defined in `render.yaml`):**
  - `etaniv-web`: React/Vite frontend (Static site on Render - Free tier).
  - `etaniv-api`: Node.js server with **Prisma ORM** (Starter plan: $7/mo).
  - `etaniv-db`: Managed **PostgreSQL** database in Frankfurt, EU (Basic plan: $7/mo with automatic daily backups).
- **Domains & Routing:**
  - `app.etaniv.co.il` $\rightarrow$ CNAME to `etaniv-web.onrender.com`.
  - `api.etaniv.co.il` $\rightarrow$ CNAME to `etaniv-api.onrender.com`.
- **Authentication & RBAC:**
  - **Built-in local auth:** Username/password with **TOTP 2FA** (Google/Microsoft Authenticator) directly in the Node.js API (`/auth/2fa/setup`).
  - Pre-defined roles: `admin` (מנהל מערכת), `finance` (הנהלת חשבונות / כספים), `pm` (מנהל פרויקט), `viewer` (צפייה בלבד).
- **Data Seeding:**
  - Database seed script (`node dist/prisma/seed.js`) automatically pre-loads **756 real suppliers** and **172 real customers** from Hashavshevet.
- **Estimated Operating Cost:**
  - $7 API server + $7 Postgres DB = **~$14/month (~50 ₪/mo)**.

---

### 2.2 Strategic Alignment & Gaps

1. **Hosting Platform Choice (Render.com vs. Cloudflare):**
   - We recently designed a Cloudflare Pages + Auth0 setup.
   - **Yakir's Reality:** Yakir's AI already prepared an infrastructure-as-code file (`render.yaml`) and Prisma backend configured specifically for **Render.com**. Deploying on Render following his guide is virtually zero-friction and maintains complete parity with his code.
2. **Authentication (Built-In vs. Auth0):**
   - External Auth0 is unnecessary. Yakir's code already contains full JWT session management, permission tables, and 2FA QR code generation.
3. **AI Vision Timing:**
   - AI OCR is **not present** in the v1 Go-Live guide. Yakir's priority is getting the core collaborative project portal live so his employees stop working in disconnected spreadsheets. Deferring AI OCR to Phase 2 was the correct decision.

---

## 3. Recommended Path Forward

1. **Adopt the Etaniv Model:** Align all system architecture and data models around the Etaniv Project Management System (`etaniv-app`).
2. **Execute Render.com Deployment:** Use `render.yaml` to deploy `etaniv-api`, `etaniv-db`, and `etaniv-web` to Render at ~$14/month, connected to `app.etaniv.co.il` and `api.etaniv.co.il`.
3. **Integrate AI Ingestion as Phase 2:** Once the live portal is running on Render, add our multimodal AI extraction engine as an automated ingest worker that populates Etaniv's supplier invoice intake queue.
