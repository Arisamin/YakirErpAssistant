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

*This diagram illustrates the physical and conceptual topography of the system. All cloud services run within a **single Render account** in the **Frankfurt (EU)** region.*

```mermaid
graph LR
    subgraph LOCATION_CLIENT ["👤 1. User Physical Endpoints (Desktop / Mobile)"]
        direction TB
        PWA_APP["<b>Etaniv PWA Frontend Client</b><br/>• React + TypeScript + Vite<br/>• Hebrew RTL UI<br/>• Chrome / Edge / Mobile PWA"]
        AUTH_APP["<b>Mobile Authenticator App</b><br/>• Google / Microsoft Authenticator<br/>• TOTP RFC 6238 Generator"]
    end

    subgraph LOCATION_M365 ["☁️ 2. Microsoft 365 Account (Domain & DNS Authority)"]
        direction TB
        DNS_ZONE["<b>Microsoft 365 DNS Manager</b><br/>• Domain: etaniv.co.il<br/>• CNAME app ➔ Render Web<br/>• CNAME api ➔ Render Docker API<br/>• A-Record ➔ WP Marketing Site"]
    end

    subgraph LOCATION_RENDER ["☁️ 3. Render Cloud Platform (Single Account · Frankfurt EU)"]
        direction TB
        
        subgraph RENDER_EDGE_BOX ["🌐 Render Edge Network (Front-Door)"]
            RENDER_ROUTER["<b>Render Ingress & SSL Router</b><br/>• Automated Let's Encrypt TLS<br/>• Global CDN for Static PWA<br/>• CORS & Port Forwarding"]
        end

        subgraph RENDER_SERVICES_BOX ["⚙️ Cloud Services (Internal Private Network)"]
            direction LR
            
            subgraph SERVICE_WEB ["📄 Static Web Service (etaniv-web)"]
                STATIC_FILES["<b>Vite Production Bundle</b><br/>• Static HTML/JS/CSS<br/>• Free Tier Hosting<br/>• app.etaniv.co.il"]
            end

            subgraph SERVICE_API ["🐳 Docker Web Service (etaniv-api)"]
                API_RUNTIME["<b>Node.js / Express Server</b><br/>• Starter Plan ($7/mo)<br/>• 14 Business Modules<br/>• JWT & RBAC Engine<br/>• api.etaniv.co.il"]
            end

            subgraph SERVICE_DB ["🗄️ Managed Database Service (etaniv-db)"]
                DB_ENGINE[("<b>PostgreSQL 16 Engine</b><br/>• Standard Plan ($7/mo)<br/>• 18 Relational Tables<br/>• 756 Real Suppliers<br/>• 172 Real Customers<br/>• Persistent Disk")]
            end
        end

        RENDER_ROUTER -->|"HTTPS /"| STATIC_FILES
        RENDER_ROUTER -->|"HTTPS /api/*"| API_RUNTIME
        API_RUNTIME <-->|"Private WireGuard Network<br/>DATABASE_URL (No Internet Expose)"| DB_ENGINE
    end

    subgraph LOCATION_OFFICE ["🏢 4. Yakir's Office On-Premises (Local Windows PC)"]
        direction TB
        HASH_CLIENT["<b>Hashavshevet ERP Desktop</b><br/>• Native Windows Application<br/>• 'קליטת פקודות יומן מאקסל'<br/>• Reads exported .xlsx files"]
    end

    subgraph LOCATION_BANKING ["🏦 5. Israeli Banking Network (External Clearing)"]
        direction TB
        MASAV_PORTAL["<b>Masav Clearing House (מס''ב)</b><br/>• Bank corporate business portal<br/>• Processes ASCII transfer files"]
    end

    %% High-level data paths between locations
    LOCATION_CLIENT -->|"1. User accesses app.etaniv.co.il / api.etaniv.co.il"| LOCATION_M365
    LOCATION_M365 -->|"2. DNS CNAME resolution"| LOCATION_RENDER
    LOCATION_CLIENT <-->|"3. Authenticated PWA & REST API Traffic"| LOCATION_RENDER
    PWA_APP -.->|"TOTP 6-digit verification"| AUTH_APP
    
    %% Export and integration paths
    SERVICE_API -.->|"Downloads generated .xlsx"| PWA_APP
    PWA_APP -.->|"Upload to desktop app"| HASH_CLIENT
    
    SERVICE_API -.->|"Downloads Masav ASCII file"| PWA_APP
    PWA_APP -.->|"Upload to bank portal"| MASAV_PORTAL
```

---

## 6. End-to-End Sequence Diagrams for All App Flows

Below are comprehensive sequence diagrams covering all core business and operational flows implemented in `etaniv-app_21`.

### Flow 1: Authentication, Session Management & Two-Factor Authentication (2FA)

*Software Analogy:* Multi-factor cryptographic identity verification using time-based one-time passwords (TOTP) and signed JWT tokens with refresh rotation.

```mermaid
sequenceDiagram
    autonumber
    
    box rgb(240, 245, 255) 👤 User Physical Endpoints
        actor User as 👤 Employee / Yakir
        actor Authenticator as 📱 Google/MS Authenticator
    end

    box rgb(245, 245, 245) ☁️ Render Cloud Platform (Frankfurt EU)
        participant Web as 💻 React PWA (web/)
        participant API as ⚙️ Express Server (server/)
        participant Auth as 🛡️ Auth Module & JWT
        participant DB as 🗄️ PostgreSQL (Prisma)
    end

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

    box rgb(240, 245, 255) 👤 User Physical Endpoints
        actor PM as 👷 Project Manager / Engineer
        actor Finance as 👩‍💼 Finance / Ronit
    end

    box rgb(245, 245, 245) ☁️ Render Cloud Platform (Frankfurt EU)
        participant Web as 💻 React PWA (Suppliers.tsx)
        participant API as ⚙️ Express Server (invoices.routes.ts)
        participant Validator as 🔍 3-Way Match & Rule Engine
        participant DB as 🗄️ PostgreSQL (Prisma)
    end

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

    box rgb(240, 245, 255) 👤 User Physical Endpoints
        actor Sarah as 👩‍💼 Sarah / Finance Admin
    end

    box rgb(245, 245, 245) ☁️ Render Cloud Platform (Frankfurt EU)
        participant Web as 💻 React PWA (Import.tsx / Suppliers.tsx)
        participant API as ⚙️ Express Server (hashavshevet.routes.ts)
        participant Engine as 📄 Hashavshevet Export Engine
        participant DB as 🗄️ PostgreSQL (Prisma)
    end

    box rgb(255, 245, 235) 🏢 Yakir's Office On-Premises (Local PC)
        actor HashClient as 🏢 Hashavshevet Windows UI (Office PC)
    end

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

    box rgb(240, 245, 255) 👤 User Physical Endpoints
        actor Yakir as 👔 Yakir / Finance Director
    end

    box rgb(245, 245, 245) ☁️ Render Cloud Platform (Frankfurt EU)
        participant Web as 💻 React PWA (Reports.tsx / Cashflow)
        participant API as ⚙️ Express Server (payments.routes.ts)
        participant MasavEngine as 🏦 Masav Formatter (Record Types 1, 2, 5)
        participant DB as 🗄️ PostgreSQL (Prisma)
    end

    box rgb(235, 245, 235) 🏦 Israeli Banking Network
        actor BankPortal as 🌐 Corporate Bank Portal (Leumi/Hapoalim)
    end

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

    box rgb(240, 245, 255) 👤 User Physical Endpoints
        actor PM as 👷 Project Manager
        actor Client as 🏢 Customer (Municipal Water Corp / Dev)
    end

    box rgb(245, 245, 245) ☁️ Render Cloud Platform (Frankfurt EU)
        participant Web as 💻 React PWA (BillingDocs.tsx / Collections.tsx)
        participant API as ⚙️ Express Server (billingDocs / collections)
        participant DB as 🗄️ PostgreSQL (Prisma)
    end

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

    box rgb(240, 245, 255) 👤 User Physical Endpoints
        actor Foreman as 👷 Site Foreman / Omer
        actor Yakir as 👔 Yakir (CEO)
    end

    box rgb(245, 245, 245) ☁️ Render Cloud Platform (Frankfurt EU)
        participant Web as 💻 React PWA (Labor.tsx / Overview.tsx)
        participant API as ⚙️ Express Server (labor.routes.ts / overview.routes.ts)
        participant DB as 🗄️ PostgreSQL (Prisma)
    end

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

---

## 8. Real-World Architecture Context: How the Current Setup Came to Be

For developers unfamiliar with corporate domain and email administration, here is the real-world sequence of how Yakir's current infrastructure was configured:

```
[ Domain Registrar (e.g., LiveDNS / Box) ]
                     │  (Delegates NS authority)
                     ▼
[ Microsoft 365 / Azure DNS (ns1-4.bdm.microsoftonline.com) ]
        │                                         │
        │ MX, SPF, DKIM, Teams                    │ A Record (etaniv.co.il / www)
        ▼                                         ▼
[ Exchange Online (@etaniv.co.il) ]    [ Israeli VPS (212.199.178.4) ]
                                       [ Nginx + Self-Hosted WordPress ]
```

1. **Domain Registration:**
   Yakir registered the primary domain `etaniv.co.il` via an accredited Israeli domain registrar (e.g., LiveDNS, Box, SPD).
2. **Corporate Email Setup (The Microsoft 365 Step):**
   When setting up corporate Microsoft 365 for business email (`yakir@etaniv.co.il`), Microsoft's onboarding wizard gives two options:
   - *Option A (Automated DNS Delegation):* Point domain nameservers to Microsoft (`ns1-4.bdm.microsoftonline.com`).
   - *Option B (Manual DNS Records):* Keep external DNS and manually insert over 10 MX, SPF, DKIM, and autodiscover records.
   Yakir (or his IT support) chose Option A so Microsoft handles all Exchange email routing and security records automatically.
3. **Self-Hosted WordPress Website:**
   Unlike `WordPress.com` (a closed SaaS platform), Yakir uses **self-hosted WordPress (`WordPress.org`)**, built with Elementor. A web development agency deployed this site onto an independent Linux server in Petah Tikva (`212.199.178.4`, Partner Communications).
4. **Linking Website to Domain:**
   Inside the **Microsoft 365 Admin Center**, an `A` record was added pointing `etaniv.co.il` and `www.etaniv.co.il` to `212.199.178.4`.
5. **Key Takeaway for Etaniv ERP Assistant:**
   - Email and DNS are centrally anchored in Microsoft 365.
   - The WordPress marketing site is isolated on an external server.
   - Creating new subdomains (`app.etaniv.co.il`, `api.etaniv.co.il`) in Microsoft 365 for Render poses **zero risk** of downtime or disruption to either corporate email or the live WordPress website.

---

## 9. Open Issues, Architectural Gaps & Production Vulnerabilities

This section documents critical functional, technical, and regulatory gaps identified in the current `etaniv-app_21` design and implementation that require resolution before or immediately following production go-live:

### 1. Technical & Cloud Infrastructure Gaps

| # | Gap / Vulnerability | Root Cause in Code / Architecture | Production Impact & Risk | Required Resolution |
|---|---|---|---|---|
| **T-1** | **Ephemeral Docker Storage & File Loss** | `FileAsset` model exists in `schema.prisma`, but actual file upload endpoints are unimplemented in Express (`server/src/modules/`). The Docker container filesystem is strictly ephemeral. | If files are uploaded to the local container disk, they are permanently destroyed on every deployment, restart, or container crash. | Connect upload ingestion directly to an external object store (e.g., **Cloudflare R2** / **AWS S3**) via pre-signed URLs, or attach a Render Persistent Disk. |
| **T-2** | **Disaster Recovery & 7-Year Accounting Retention** | Render's managed PostgreSQL automated daily snapshots have a rolling **7-day retention window**. Free tier databases expire and delete after 30 days. | Israeli Tax Ordinance (*הוראות ניהול ספרים*) legally mandates preserving accounting records for at least **7 years**. If catastrophic corruption or silent deletion exceeds 7 days, data is unrecoverable. | Implement an automated daily/weekly cron task running `pg_dump`, encrypting the archive, and streaming it to immutable cold storage (e.g., AWS S3 Glacier / Cloudflare R2). |
| **T-3** | **Observability, APM & Error Alerting** | Errors log only to `stdout` via `pino-http` and `console.error(err)` in `middleware/error.ts`. Audit logging failures in `audit.ts` fail silently. | Production errors require manually checking Render log streams. No proactive notifications (Slack, email, SMS) alert Yakir or developers when API endpoints fail or database connections drop. | Integrate an error monitoring service (e.g., **Sentry**) and configure uptime alerting on `/api/health`. |
| **T-4** | **Unimplemented Automated AI / OCR Extraction** | `etaniv-app_21` currently relies on manual employee data entry for vendor invoices, line splitting, and tax amounts. | The original goal—drastically reducing the time 3 employees spend manually typing invoices—is only partially solved. Manual data entry remains a operational bottleneck. | Implement the multimodal AI extraction pipeline (Hebrew OCR + Vision LLM) to auto-populate invoice fields, perform Luhn checksums, and auto-split VAT. |

---

### 2. Israeli Accounting & Regulatory Compliance Gaps

| # | Gap / Vulnerability | Regulatory Requirement (*חקיקה ותקינה*) | Production Impact & Risk | Required Resolution |
|---|---|---|---|---|
| **A-1** | **Missing Israel Invoicing Clearance (*חוק החשבוניות / מספר הקצאה*)** | Invoices exceeding statutory thresholds (25,000 ₪ in 2024, descending toward 5,000 ₪) require real-time Israel Tax Authority clearance numbers (*מספר הקצאה*). | Without a valid Tax Authority allocation number, Etaniv is **legally barred from deducting Input VAT (*מע"מ תשומות*)**, risking heavy tax authority penalties. | Integrate with the Israel Tax Authority B2B Allocation REST API to validate supplier allocation numbers before invoice approval. |
| **A-2** | **Withholding Tax Verification (*ניכוי מס במקור ואישור ניהול ספרים*)** | Israeli law mandates withholding tax at source from supplier payments unless the supplier possesses a valid exemption certificate (*אישור ניכוי מס במקור*). | Generating bulk bank payouts via Masav without verifying withholding rates creates legal tax liability for Etaniv to pay the withheld tax out-of-pocket. | Connect supplier tax verification to the SHAAM (*שע"ם*) B2B web service to dynamically check and apply current withholding tax percentages. |
| **A-3** | **One-Way Asynchronous Sync with Hashavshevet** | System exports an Excel batch (`.xlsx`) to Hashavshevet's open batch (*מנה פתוחה*), but has no reverse synchronization. | If the bookkeeper modifies, reclassifies, or rejects an invoice inside Hashavshevet desktop, `etaniv-app_21` remains unaware and presents stale or contradictory figures. | Establish a reconciliation import process (or periodic batch status sync) so Hashavshevet transaction statuses reflect back into Etaniv. |
| **A-4** | **Manual Bank Statement Reconciliation (*התאמות בנקים*)** | Electronic payouts are pushed via Masav, but reconciling bank statements back against approved invoices is completely manual. | Reconciling cash flow and verifying whether cheques, direct debits, or transfers actually cleared requires manual human audit. | Add a bank statement parser (supporting Israeli bank Excel / OFX formats) to automate ledger matching (*התאמת תנועות בנק*). |





