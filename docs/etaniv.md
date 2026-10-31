# Etaniv System: Complete POC, Codebase & Roadmap Analysis

> **Quick Reference:** This document analyzes the artifacts provided in `From Yakir/`:
> 1. `אתניב — מערכת ניהול פרויקטלי (תצוגה חיה).html` (Interactive Browser Demo)
> 2. `Etaniv — Go Live Guide.html` (AI Deployment Roadmap for Render.com)
> 3. `etaniv-app_21/` (Complete Production Monorepo: `server/` + `web/` + `render.yaml`)
>
> For full analysis details, see [**docs/etaniv_poc_and_roadmap_analysis.md**](./etaniv_poc_and_roadmap_analysis.md).

---

## 1. Executive Summary: What is the `etaniv-app_21` Code?

The folder `From Yakir/etaniv-app_21` (from `etaniv-app_21.zip`) is the **complete production-grade source code** for **אתניב ב.י בע"מ (Etaniv B.Y. Ltd. — Water & Environmental Technologies)**.

It is structured as a full-stack TypeScript monorepo:
- **`server/` (Backend API):** Node.js + Express + TypeScript + Prisma ORM + PostgreSQL. Includes Dockerfile, JWT auth, TOTP 2FA, and a database seeder (`real-accounts.ts`) with **756 real suppliers** and **172 real customers** from Hashavshevet.
- **`web/` (Frontend PWA):** React + TypeScript + Vite. Hebrew RTL single-page progressive web app containing all 9 operational modules.
- **`render.yaml` (Infrastructure as Code):** Render.com Blueprint provisioning the database (`etaniv-db`), API (`etaniv-api`), and web app (`etaniv-web`).
- **`DEPLOY.md`:** Step-by-step production deployment guide.

---

## 2. Relationship to the Single-File HTML POC

| Aspect | The Single HTML File (`אתניב — ... (תצוגה חיה).html`) | The Source Code Monorepo (`etaniv-app_21`) |
|---|---|---|
| **Nature** | Compiled standalone client demo bundle | Full production source code |
| **Backend & DB** | In-browser mock server (`window.fetch` interceptor) | Real Express REST API + PostgreSQL DB (Prisma ORM) |
| **Authentication** | Simulated static user tokens (`demo`) | Real cryptographic JWTs + TOTP 2FA (Authenticator app) |
| **Purpose** | Immediate zero-install browser testing for Yakir | Production deployment to Render.com and ongoing engineering |

---

## 3. How It Fits Into the Go-Live Plan

`etaniv-app_21` is the exact payload required by **Step 0 & Step 1** of `Etaniv — Go Live Guide.html`:
1. Push `etaniv-app_21` to a private GitHub repository.
2. In Render.com: Click **New → Blueprint** and select the repository.
3. Render automatically provisions:
   - PostgreSQL Database in Frankfurt (`etaniv-db`).
   - Dockerized API container (`etaniv-api`).
   - Globally distributed static PWA (`etaniv-web`).
4. In Render's web shell, execute `node dist/prisma/seed.js` to seed 756 suppliers, 172 customers, roles, and Yakir's admin account.
5. Add DNS CNAMEs for `app.etaniv.co.il` and `api.etaniv.co.il`.
6. Total monthly infrastructure cost: **~$14 / month (~50 ₪/mo)**.

---

---

## 4. Uncovered Real-World Business Workflows

1. **Project Cost Splitting (*תמחיר פרויקטים*):** Invoices are split across specific project codes (`101, 102`) and budget categories (*צנרת, פלסטיקה, חשמל*).
2. **3-Way Matching (*התאמה משולשת*):** Invoices strictly require matching against a Purchase Order (*הזמנת רכש*) and Delivery Note (*תעודת משלוח*) before payment approval.
3. **Israeli Payment Terms (*שוטף פלוס*):** Auto-calculates `payDate` and slots payments into bi-monthly runs (15th & 30th).
4. **Masav Interbank File Generation (*מס"ב*):** Bulk electronic bank transfers directly to supplier bank accounts.
5. **Customer Contracts, Retention (*עיכבון*) & Collections (*גיול חובות*):** Manages project revenue, warranty retentions, and debt aging.

---

## 5. System Architecture Block Diagram (`etaniv-app_21`)

*This diagram illustrates the actual architecture implemented across the code in `etaniv-app_21`, its containerization, hosting platforms, database layer, and external integrations.*

```mermaid
graph LR
    subgraph CLIENT_TIER ["💻 Client Tier (User Devices)"]
        direction TB
        PWA_APP["<b>Etaniv PWA Frontend</b><br/>• React + TypeScript + Vite<br/>• Hebrew RTL UI<br/>• PWA Service Worker<br/>• Host: Chrome / Edge / Mobile"]
        AUTH_APP["<b>Authenticator App</b><br/>• Google / MS Authenticator<br/>• TOTP RFC 6238"]
    end

    subgraph INGRESS_TIER ["🌐 Network & Routing Tier"]
        direction TB
        DNS_ROUTER["<b>DNS Zone (etaniv.co.il)</b><br/>• CNAME: app.etaniv.co.il<br/>• CNAME: api.etaniv.co.il"]
        RENDER_EDGE["<b>Render Global Edge</b><br/>• Automated SSL/TLS (Let's Encrypt)<br/>• CORS Gateway<br/>• Static Asset CDN"]
    end

    subgraph APP_TIER ["⚙️ Backend API Tier (Render Frankfurt - Docker)"]
        direction TB
        EXPRESS_APP["<b>Express Application Server</b><br/>• Node.js + TypeScript Runtime<br/>• Docker Container (server/Dockerfile)"]
        AUTH_MDW["<b>Security & RBAC Middleware</b><br/>• JWT Access & Refresh Engine<br/>• Role Enforcement (admin/finance/pm/viewer)<br/>• Audit Logger"]
        APP_MODULES["<b>14 Business Logic Modules</b><br/>• projects, suppliers, supplierInvoices<br/>• payments (Masav), hashavshevet<br/>• contracts, billingDocs, collections<br/>• labor, overview, reports, settings"]
    end

    subgraph DATA_TIER ["🗄️ Database Tier (Render Frankfurt - Managed)"]
        direction TB
        PRISMA_ORM["<b>Prisma ORM Client</b><br/>• Type-safe query engine<br/>• Migrations & Seed runner"]
        POSTGRES_DB[("<b>PostgreSQL 16 Database</b><br/>• 16 relational models<br/>• 756 pre-seeded suppliers<br/>• 172 pre-seeded customers<br/>• Automated daily backups")]
    end

    subgraph EXTERNAL_TIER ["🏢 External & Banking Systems"]
        direction TB
        HASH_ERP["<b>Hashavshevet ERP Desktop</b><br/>• On-premise Windows client<br/>• 'קליטת פקודות יומן מאקסל'<br/>• Open Batch (מנה פתוחה)"]
        MASAV_SYS["<b>Masav Clearing House (מס''ב)</b><br/>• Israeli interbank transfer network<br/>• Electronic supplier payouts"]
    end

    %% High-level data links
    CLIENT_TIER -->|"1. HTTPS Requests"| INGRESS_TIER
    INGRESS_TIER -->|"2. Static Web Assets"| PWA_APP
    INGRESS_TIER -->|"3. REST API Calls"| EXPRESS_APP
    PWA_APP -.->|"TOTP 6-digit Code"| AUTH_APP
    EXPRESS_APP --> AUTH_MDW
    AUTH_MDW --> APP_MODULES
    APP_MODULES --> PRISMA_ORM
    PRISMA_ORM --> POSTGRES_DB
    APP_MODULES -.->|"Export Excel (.xlsx)"| PWA_APP
    PWA_APP -.->|"Manual File Selection"| HASH_ERP
    APP_MODULES -.->|"Generate Masav File"| PWA_APP
    PWA_APP -.->|"Upload to Bank Portal"| MASAV_SYS
```

---

## 6. End-to-End Sequence Diagrams for All App Flows

Below are comprehensive sequence diagrams covering all core business and operational flows implemented in `etaniv-app_21`.

### Flow 1: Authentication, Session Management & Two-Factor Authentication (2FA)

*Software Analogy:* Multi-factor cryptographic identity verification using time-based one-time passwords (TOTP) and signed JWT tokens with refresh rotation.

```mermaid
sequenceDiagram
    autonumber
    actor User as 👤 Employee / Yakir
    participant Web as 💻 React PWA (web/)
    participant API as ⚙️ Express Server (server/)
    participant Auth as 🛡️ Auth Module & JWT
    participant DB as 🗄️ PostgreSQL (Prisma)
    actor Authenticator as 📱 Google/MS Authenticator

    User->>Web: Enters email & password
    Web->>API: POST /api/auth/login {email, password}
    API->>DB: Query user by email (include Role & Permissions)
    DB-->>API: Returns user record & passwordHash
    API->>API: Verify bcrypt password hash

    alt User has 2FA Enabled (mfaEnabled: true)
        API-->>Web: 200 OK {requiresMfa: true, tempToken}
        User->>Authenticator: Opens app to view 6-digit TOTP code
        Authenticator-->>User: Displays "482910"
        User->>Web: Enters 6-digit code
        Web->>API: POST /api/auth/login/mfa {tempToken, code}
        API->>API: Verify TOTP token with speakeasy against mfaSecret
    end

    API->>Auth: Issue signed JWT Access Token (15m) + Refresh Token (7d)
    API->>DB: Log login event into AuditLog
    API-->>Web: Set httpOnly refreshToken cookie + return accessToken & userProfile
    Web->>Web: Store user & permissions in React AuthContext
    Web-->>User: Renders authorized dashboard views based on role
```

---

### Flow 2: Supplier Invoice Ingestion, Line Splitting & 3-Way Matching Approval

*Software Analogy:* Transaction ingestion and data validation pipeline enforcing a 3-way checksum (Purchase Order + Delivery Note + Invoice) and splitting costs across project tags before allowing state transition to `APPROVED`.
*Hebrew Accounting Terms:*
- **Supplier Invoice:** *חשבונית מס ספק*
- **Purchase Order (PO):** *הזמנת רכש*
- **Delivery Note:** *תעודת משלוח*
- **Project Cost Center:** *סעיף תקציב / סיווג פרויקט*

```mermaid
sequenceDiagram
    autonumber
    actor PM as 👷 Project Manager / Engineer
    actor Finance as 👩‍💼 Finance / Ronit
    participant Web as 💻 React PWA (Suppliers.tsx)
    participant API as ⚙️ Express Server (invoices.routes.ts)
    participant Validator as 🔍 3-Way Match & Rule Engine
    participant DB as 🗄️ PostgreSQL (Prisma)

    %% Step 1: Ingestion & Splitting
    PM->>Web: Clicks "קליטת חשבונית ספק"
    PM->>Web: Selects Supplier (picks from 756 real suppliers)
    Web->>Web: Auto-populates Tax ID, default terms (e.g. שוטף+60), and VAT (18%)
    PM->>Web: Enters invoice #, date, total amount before VAT
    PM->>Web: Splits lines across projects:<br/>- Line 1: Project 101, סעיף: צנרת, 90,000 ₪<br/>- Line 2: Project 102, סעיף: פלסטיקה, 36,000 ₪
    PM->>Web: Enters Purchase Order # (PO-2026-11) and Delivery Note # (DN-984)
    PM->>Web: Clicks "שמור חשבונית"
    Web->>API: POST /api/supplier-invoices
    API->>DB: Create SupplierInvoice + SupplierInvoiceLine records (Status: סווגה)
    DB-->>Web: Invoice created successfully

    %% Step 2: 3-Way Matching & Approval Gate
    Finance->>Web: Opens "חשבוניות ספקים" review list
    Finance->>Web: Reviews PO, Delivery Note, and attached scan
    Finance->>Web: Ticks "הותאם להזמנה ותעודת משלוח (3-Way Match)"
    Finance->>Web: Clicks "אשר לתשלום" (Approve)
    Web->>API: PUT /api/supplier-invoices/:id {approved: true, matched: true}
    API->>Validator: Check approvalErr(body) against fieldSettings
    alt Missing PO or matched == false
        Validator-->>API: Reject: "לא ניתן לאשר חשבונית — חסרה התאמה להזמנת רכש ותעודת משלוח"
        API-->>Web: 400 Bad Request with Hebrew error message
    else All mandatory checks pass
        Validator-->>API: Validated!
        API->>DB: Update invoice (approved: true, approvedById, status: 'אושרה לתשלום')
        API->>DB: Calculate payDate using shotef(invoiceDate, terms)
        DB-->>API: Updated record
        API-->>Web: 200 OK (Status badge changes to green "אושרה לתשלום")
    end
```

---

### Flow 3: Hashavshevet Accounting Export & Batch Synchronization

*Software Analogy:* Atomic batch extraction and format compilation into an Excel spreadsheet, tagging exported records to prevent duplicate submissions (*מניעת כפילות*), ready for consumption by Hashavshevet's staging buffer (*מנה פתוחה*).
*Hebrew Accounting Terms:*
- **Open Batch:** *מנה פתוחה*
- **Account Key in Hashavshevet:** *מפתח חשבון בחשבשבת*
- **Value Date / Payment Due Date:** *תאריך ערך*

```mermaid
sequenceDiagram
    autonumber
    actor Sarah as 👩‍💼 Sarah / Finance Admin
    participant Web as 💻 React PWA (Import.tsx / Suppliers.tsx)
    participant API as ⚙️ Express Server (hashavshevet.routes.ts)
    participant Engine as 📄 Hashavshevet Export Engine
    participant DB as 🗄️ PostgreSQL (Prisma)
    actor HashClient as 🏢 Hashavshevet Windows UI (Office PC)

    Sarah->>Web: Navigates to "ייצוא לחשבשבת"
    Web->>API: GET /api/hashavshevet/pending
    API->>DB: Fetch invoices WHERE approved = true AND hhExportedAt IS NULL
    DB-->>API: Returns list of pending invoices
    API->>Engine: Verify all suppliers have hhAccountKey (*מפתח חשבון*)
    Engine-->>Web: Returns summary: 14 invoices, 22 project lines, Total 412,000 ₪

    Sarah->>Web: Clicks "הפק קובץ אקסל לחשבשבת"
    Web->>API: POST /api/hashavshevet/export
    API->>Engine: Format rows: ספק | תאריך אסמכתא | אסמכתא | פרויקט | פרטים | חובה | תאריך ערך
    API->>DB: ATOMIC UPDATE: stamp hhExportedAt = today, hhExportBatch = 'HH-20261031...', status = 'נקלטה בהנה"ח'
    Engine-->>Web: Delivers formatted Excel workbook (.xlsx)
    Web-->>Sarah: Browser downloads `hashavshevet_batch_HH-20261031.xlsx`

    Sarah->>HashClient: Launches Hashavshevet on Windows desktop PC
    Sarah->>HashClient: Navigates to: הנהלת חשבונות -> קליטת פקודות יומן מאקסל
    Sarah->>HashClient: Selects the downloaded .xlsx file
    HashClient->>HashClient: Validates account keys & balances
    HashClient-->>Sarah: Displays newly populated Open Batch (מנה פתוחה) for review
```

---

### Flow 4: Payment Run Scheduling, Masav Bank File Generation & Reconciliation

*Software Analogy:* Automated scheduling into semi-monthly batch payout runs (15th and 30th) and compiling electronic fund transfer files for the Israeli interbank clearing house (*מס"ב*), followed by PDF payout reconciliation.
*Hebrew Accounting Terms:*
- **Masav:** *מס"ב (מרכז סליקה בנקאי)*
- **Payment Run:** *סבב תשלומים (15 ו-30 לחודש)*
- **Cash Flow Ledger:** *תזרים מזומנים כרונולוגי*

```mermaid
sequenceDiagram
    autonumber
    actor Yakir as 👔 Yakir / Finance Director
    participant Web as 💻 React PWA (Reports.tsx / Cashflow)
    participant API as ⚙️ Express Server (payments.routes.ts)
    participant MasavEngine as 🏦 Masav Formatter (Record Types 1, 2, 5)
    participant DB as 🗄️ PostgreSQL (Prisma)
    actor BankPortal as 🌐 Corporate Bank Portal (Leumi/Hapoalim)

    %% Step 1: Schedule & Cashflow
    Yakir->>Web: Opens "תזרים מזומנים ומועדי תשלום"
    Web->>API: GET /api/reports/cashflow
    API->>DB: Query open invoices grouped by assignRun(payDate) -> 15th or 30th
    DB-->>API: Returns payment schedule + chronological transaction ledger
    Web-->>Yakir: Displays upcoming payment run for 15/11/2026: 28 suppliers, 385,000 ₪

    %% Step 2: Masav File Generation
    Yakir->>Web: Clicks "הפק קובץ מסב לתשלום" for selected date range
    Web->>API: POST /api/payments/masav {startDate, endDate, executionDate}
    API->>DB: Query approved unpaid invoices with supplier bank details
    API->>MasavEngine: Build Masav ASCII text buffer:<br/>- Header (Type 1: Sending institution code, date)<br/>- Transactions (Type 2: Bank, Branch, Account, Amount, Tax ID)<br/>- Footer (Type 5: Record count, Total checksum)
    API->>DB: Create MasavPaymentBatch record
    MasavEngine-->>Web: Delivers structured Masav file (.txt / .msv)
    Web-->>Yakir: Browser downloads `MASAV_20261115.TXT`

    %% Step 3: Bank Payout & Reconciliation
    Yakir->>BankPortal: Logs in with token & uploads MASAV_20261115.TXT
    BankPortal-->>Yakir: Bank processes batch & issues Confirmation PDF
    Yakir->>Web: Opens "עדכון תשלומים ממקבץ"
    Yakir->>Web: Uploads bank transfer PDF / pastes paid invoice numbers
    Web->>API: POST /api/payments/mark-paid {invoiceIds, actualPayDate, batchRef}
    API->>DB: Update invoices (paid: true, actualPayDate, status: 'שולמה')
    API->>DB: Recompute running cashflow balance
    DB-->>Web: Confirmation: 28 invoices marked as paid
    Web-->>Yakir: Running cashflow balance updated automatically
```

---

### Flow 5: Customer Contracts, Progressive Billing, Retention & Collections

*Software Analogy:* Managing incoming accounts receivable (revenue contracts) with milestone billing, warranty escrow tracking (*עיכבון*), and time-bucketed debt aging (*גיול חובות*).
*Hebrew Accounting Terms:*
- **Customer Contract:** *חוזה לקוח*
- **Warranty Retention:** *עיכבון (5%-10% המוחזקים עד תום תקופת הבדק)*
- **Debt Aging:** *גיול חובות (שוטף, 30+, 60+, 90+ יום פיגור)*
- **Transaction Invoice / Proforma:** *חשבון עסקה*

```mermaid
sequenceDiagram
    autonumber
    actor PM as 👷 Project Manager
    actor Client as 🏢 Customer (Municipal Water Corp / Dev)
    participant Web as 💻 React PWA (BillingDocs.tsx / Collections.tsx)
    participant API as ⚙️ Express Server (billingDocs / collections)
    participant DB as 🗄️ PostgreSQL (Prisma)

    %% Step 1: Issuing Milestone Billing with Retention
    PM->>Web: Navigates to "חשבוניות ללקוח" -> "הפק מסמך חיוב"
    PM->>Web: Selects Contract C-26-011 (מתחם מגורים A, ערך חוזה: 3.2M ₪)
    PM->>Web: Enters milestone progress: 200,000 ₪ before VAT
    Web->>Web: Contract stipulates 5% retention (עיכבון)<br/>Auto-calculates: Retention held = 10,000 ₪, Net claim = 190,000 ₪ + 18% VAT
    PM->>Web: Issues as "חשבון עסקה" (Proforma / Payment Request)
    Web->>API: POST /api/billing-docs
    API->>DB: Create BillingDocument & update Contract.billed totals
    DB-->>Web: Document #2026-108 created

    %% Step 2: Conversion to Tax Invoice upon Payment
    Client-->>PM: Confirms milestone inspection & deposits funds
    PM->>Web: Clicks "המר לחשבונית מס"
    Web->>API: POST /api/billing-docs/:id/to-invoice
    API->>DB: Update document type to 'TAX_INVOICE' & mark collected amount
    DB-->>API: Updated contract balances (Billed: 1.4M ₪, Collected: 1.05M ₪, Retention: 70K ₪)

    %% Step 3: Aging & Collections Management
    PM->>Web: Opens "גביית חובות וגיול"
    Web->>API: GET /api/collections
    API->>DB: Query open invoices grouped by overdue buckets (0-30, 31-60, 61-90, 90+)
    DB-->>API: Returns overdue customers & last recorded actions
    Web-->>PM: Displays warning: Client #3 is 63 days overdue (212,400 ₪)
    PM->>Web: Logs collection action: "שיחה טלפונית לסמנכ\"ל כספים - הובטח תשלום עד 20 לחודש"
    Web->>API: POST /api/collections/:id/action
    API->>DB: Save CollectionAction record with follow-up reminder date
```

---

### Flow 6: Labor Tracking & Real-Time Project Profitability Dashboard

*Software Analogy:* Aggregating internal resource metrics (worker hourly/daily cost matrix) and external direct costs (materials) against customer contract revenue to compute real-time gross profit margins.
*Hebrew Accounting Terms:*
- **Project Profitability:** *רווחיות פרויקטלית*
- **Budget Utilization:** *ניצול תקציב עלויות*
- **Daily Work Log:** *יומן עבודה יומי / ימי עבודה*

```mermaid
sequenceDiagram
    autonumber
    actor Foreman as 👷 Site Foreman / Omer
    actor Yakir as 👔 Yakir (CEO)
    participant Web as 💻 React PWA (Labor.tsx / Overview.tsx)
    participant API as ⚙️ Express Server (labor.routes.ts / overview.routes.ts)
    participant DB as 🗄️ PostgreSQL (Prisma)

    %% Step 1: Logging Labor Hours
    Foreman->>Web: Opens "עבודה ועובדים" monthly matrix
    Foreman->>Web: Enters days worked for employee "מוחמד" on Project 101: 22 days
    Web->>API: POST /api/workdays
    API->>DB: Upsert Workday records (workerId × projectId × month)
    DB-->>API: Saved!

    %% Step 2: Real-Time Profitability Computation
    Yakir->>Web: Opens "סקירת פרויקטים ורווחיות" (Overview)
    Web->>API: GET /api/overview
    API->>DB: For each active Project:
    Note over API, DB: 1. SUM(BillingDocs where type='TAX_INVOICE') -> Total Income<br/>2. SUM(SupplierInvoiceLines) -> Materials Cost<br/>3. SUM(Workdays × Worker.dailyCost) -> Direct Labor Cost<br/>4. Cost = Materials + Labor<br/>5. Profit = Income - Cost<br/>6. Margin % = (Profit / Income) × 100<br/>7. Budget Utilization % = (Cost / costBudget) × 100
    DB-->>API: Returns consolidated calculations
    API-->>Web: Delivers JSON metrics for all projects

    Web-->>Yakir: Renders interactive KPI cards & progress bars:
    Note over Web, Yakir: Project 101 (מתחם מגורים A):<br/>• Income: 1,400,000 ₪<br/>• Materials: 354,000 ₪ | Labor: 176,050 ₪<br/>• Total Cost: 530,050 ₪<br/>• Net Profit: 869,950 ₪ (Gross Margin: 62.1%)<br/>• Budget Utilization: 22.1% of 2,400,000 ₪
```

---

## 6. Database Schema & Tables Specification (PostgreSQL / Prisma)

The database schema (`server/prisma/schema.prisma`) comprises **18 relational tables** and **2 enums**, architected around project-centric cost accounting (*תמחיר פרויקטים*). Every financial transaction (supplier expense, labor day, billing doc) connects back to a `Project` for real-time profitability tracking.

### Entity Relationship & Table Summary

| # | Table / Model | Hebrew Accounting Concept | Description & Key Attributes |
|---|---|---|---|
| **1** | `User` | *משתמש מערכת* | System accounts, bcrypt salted password hash (`passwordHash`), status (`UserStatus`), TOTP 2FA secret (`mfaSecret`), and role relation. |
| **2** | `Role` | *תפקיד והרשאה* | Role definitions (`admin`, `finance`, `pm`, `viewer`). |
| **3** | `Permission` | *מטריצת הרשאות* | Granular read/write/delete permissions per navigation menu (`canView`, `canWrite`, `canDelete`). |
| **4** | `Project` | *פרויקט (תמחיר)* | Core job entity with code, name, and total cost budget (`costBudget` Decimal(14,2)). Parent of all revenues and expenses. |
| **5** | `ExpenseType` | *סעיף תקציבי / הוצאה* | Standard expense categories (e.g., חומרים, קבלני משנה, ציוד, הובלות). |
| **6** | `Supplier` | *כרטיס ספק* | Vendor directory (756 real accounts), tax ID (*ח.פ/ע.מ*), Hashavshevet account key (*מפתח חשבון*), VAT rate, payment terms (*שוטף+*), and bank routing for Masav. |
| **7** | `SupplierInvoice` | *חשבונית מס ספק* | Ingested vendor bills with amounts, VAT, 3-way match reconciliation flags (`matched`, `purchaseOrderNo`, `deliveryNoteNo`), Hashavshevet export batch tracking (`hhExportBatch`), and payment status. |
| **8** | `InvoiceLine` | *פיצול שורות לחשבונית* | Multi-project allocation lines splitting a single invoice across multiple projects and expense types. |
| **9** | `Customer` | *כרטיס לקוח* | Client directory (172 real accounts) with contact info, email, phone, and tax registration. |
| **10** | `Contract` | *חוזה לקוח* | Revenue contracts linking a customer to a project, total contract value, payment terms, and warranty retention percentage (*עיכבון*). |
| **11** | `BillingDoc` | *מסמך חיוב ללקוח* | Progressive billing documents issued to clients (`DocType`: חשבון עסקה, חשבונית מס, חשבונית מס-קבלה), tracking retention withheld and aging. |
| **12** | `BillingOffset` | *קיזוזים מתשלום* | Deductions and penalty offsets applied to client billing documents (*קיזוזים מוסכמים*). |
| **13** | `CollectionAction` | *פעולת גבייה וגיול* | Collection event logs (phone call, email, legal letter) with follow-up reminder timestamps. |
| **14** | `Worker` | *עובד / פועל* | Direct labor directory with daily employer cost (*עלות שכר מעביד יומית*). |
| **15** | `Workday` | *יומן ימי עבודה* | Monthly allocated days worked per worker per project. Unique constraint on `[workerId, projectId, month]`. |
| **16** | `FileAsset` | *קובץ ומסמך סרוק* | Scanned invoice PDFs, delivery slips, and contracts with storage key and virus-scan status (`scanned`, `scanResult`). |
| **17** | `InvoiceFieldSetting` | *הגדרות שדות חובה* | Configurable mandatory validation rules for approving supplier invoices (e.g., whether PO or delivery note is mandatory). |
| **18** | `OrgSetting` | *הגדרות חברה ומס"ב* | Singleton system settings: Masav sender code (*קוד מוסד שולח*), company legal name, and cash flow opening balance (*יתרת פתיחה*). |
| **19** | `AuditLog` | *יומן ביקורת אירועים* | Immutable security and compliance log recording user ID, action (`LOGIN`, `CREATE`, `EXPORT`, etc.), entity, IP address, and payload. |

---

### Database Enums

- **`UserStatus`**: `PENDING` (awaiting admin approval) | `APPROVED` (active) | `DISABLED` (deactivated).
- **`DocType`**: `ESEK` (*חשבון עסקה* / Proforma) | `TAX` (*חשבונית מס* / Tax Invoice) | `TAX_RECEIPT` (*חשבונית מס-קבלה* / Tax Invoice & Receipt).

---

## 7. Current Infrastructure, Web Hosting & DNS Management (`etaniv.co.il`)

Analysis of Yakir's deployment documentation combined with live technical network verification reveals the current production domain infrastructure:

### 1. DNS Authority & Management
- **Nameservers:**
  - `ns1.bdm.microsoftonline.com`
  - `ns2.bdm.microsoftonline.com`
  - `ns3.bdm.microsoftonline.com`
  - `ns4.bdm.microsoftonline.com`
- **DNS Host / Management Console:** **Microsoft 365 / Azure DNS (Business Domain Management)**.
- **Operational Reality:** Yakir manages his DNS records directly inside the **Microsoft 365 Admin Center** (tied to the corporate Microsoft 365 / Exchange email accounts such as `yakir@etaniv.co.il`).

### 2. Current Website Hosting
- **Apex & WWW Records:** `etaniv.co.il` / `www.etaniv.co.il` resolves to IP `212.199.178.4` (AS12400 Partner Communications, Petah Tikva, Israel; host `server1.abrahamson.co.il`).
- **Web Stack:** Linux server running **Nginx** reverse proxy and **WordPress** with a custom Elementor theme.

### 3. Subdomain Configuration for Render Deployment
Per `DEPLOY.md` and `Etaniv — Go Live Guide.html`, setting up the ERP system does **not** interrupt or affect the existing WordPress marketing site:
1. Yakir logs into **Microsoft 365 Admin Center** → **Settings** → **Domains** → `etaniv.co.il` → **DNS Records**.
2. Adds two new `CNAME` records:
   - `app` → Render Static Site address (pointing to `etaniv-web.onrender.com`).
   - `api` → Render Web Service address (pointing to `etaniv-api.onrender.com`).
3. Render automatically issues and renews Let's Encrypt SSL/TLS certificates for both subdomains.



