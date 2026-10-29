# Hashavshevet (חשבשבת ERP) Internal Architecture & Data Flow

This guide explains how Hashavshevet works under the hood from a **Software Engineering & Database Systems** perspective, addressing:
1. What happens internally when an invoice is fed into the system.
2. Whether data stays local or is transmitted externally.
3. The underlying database engine, table schemas, immutability rules, and network topology.

---

## 1. The Short Answer: Is Data Maintained Locally or Transmitted Outside?

### **It is 99% Local and Private.**
- **Local Storage:** When Yakir or Sarah enters an invoice, **it is saved exclusively on the local office PC / server** in an on-premise relational database (Microsoft SQL Server).
- **No Automatic Cloud Sync:** Hashavshevet does **NOT** automatically transmit supplier invoices to the cloud, to Hilan/Hashavshevet servers, or to the Israel Tax Authority.
- **The Only External Transmissions (Periodic / On-Demand):**
  1. **Monthly VAT Filing (דוח מע"מ 874 - PCN874):** Once a month, the bookkeeper runs a wizard in Hashavshevet that queries the database and exports an encrypted text file (`PCN874.TXT`). The bookkeeper logs into the Israel Tax Authority government portal in a web browser and uploads that file manually.
  2. **Annual Withholding Tax Filing (טופס 856):** Exported once a year as a text file for supplier withholding taxes.
  3. **Statutory Tax Audit (מבנה אחיד - BKMVDATA):** If tax inspectors audit Yakir's business (*ביקורת ספרים*), Hashavshevet exports standard `BKMVDATA.TXT` and `INI.TXT` files to a USB drive or upload portal.
  4. **The Real-Time Invoicing Law (חוק החשבוניות / מודל הקצאה):** Since 2024, when checking or issuing high-value invoices (over government limits), Hashavshevet calls the Israel Tax Authority REST API to validate or receive a real-time allocation clearance number (*מספר הקצאה*).

---

## 2. Software Architecture & Database Engine Under the Hood

```
+-----------------------------------------------------------------------------------+
|               HASHAVSHEVET LOCAL ARCHITECTURE (ON-PREMISE OFFICE PC)              |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  [Desktop Client: Win32 Thick UI] <--- (Delphi / C++ Windows Application)         |
|         │                                                                         |
|         ▼ (ODBC / ADO Connection via Local LAN or Named Pipes)                    |
|  [RDBMS Engine: Microsoft SQL Server] (or SQL Server Express)                     |
|         │                                                                         |
|         ├── [STAGING BUFFER]    --> (מנה פתוחה / Unposted Working Batches)        |
|         ├── [PERMANENT LEDGER]  --> (ספר ראשי / Immutable Committed Transactions) |
|         ├── [ACCOUNTS TABLE]    --> (כרטיסי חשבון / Balances & Vendor Metadata)   |
|         └── [AUDIT TRAIL LOG]   --> (יומן ביקורת / Non-resettable Sequential IDs) |
|                                                                                   |
+-----------------------------------------------------------------------------------+
```

### Technical Specs:
- **Client Application:** Windows desktop application (Win32 thick client developed originally in C++/Delphi).
- **Database Engine:**
  - Modern versions (Hashavshevet ERP): **Microsoft SQL Server** (typically SQL Server Express on small office setups, or Standard on dedicated local server).
  - Legacy historical versions: A proprietary ISAM file-based database called `c-tree` (FairCom engine).
- **Network Deployment in Small Businesses:**
  - In Yakir's office, the database typically sits on one PC (e.g. Sarah's PC or a small desktop acting as an internal file/DB server).
  - Other office computers access it over the local Windows network (LAN) via a shared folder or local IP address (`192.168.1.X:1433`).

---

## 3. What Happens Step-by-Step Inside the Software When an Invoice is Entered?

In software terms, Hashavshevet behaves like a **two-phase commit ledger**:

```
[User Input / API Import]
           │
           ▼
[Phase 1: Open Batch Buffer (מנה פתוחה)]
  • Inserted into a temporary staging table
  • Status: Mutable (Can be edited, corrected, deleted)
  • Has NOT yet affected financial reports or balances
           │
           ▼  (User clicks "קליטת מנה" / Post Batch)
[Phase 2: The ACID Commit Transaction (קליטה לספר הראשי)]
  • Atomic move from Staging -> Permanent Ledger
  • Sequential Audit ID assigned (monotonic counter)
  • Status: 100% IMMUTABLE (Strict Israeli Tax Law)
  • Account balances updated:
    - Supplier balance updated (+1,170 ₪)
    - Expense balance updated (+1,000 ₪)
    - Input VAT asset updated (+170 ₪)
```

### Detailed Lifecycle:

#### Phase 1: Staging in the Open Batch (מנה זמנית / Buffer Table)
1. When Yakir or Sarah types the invoice (or when our automated tool injects it), the rows land in a **Staging Buffer (מנה)**.
2. In this stage, the records are **mutable**:
   - The bookkeeper can fix typos, change the expense category key, or delete lines.
   - **Crucial Rule:** The numbers in an open batch **do not affect the official company balances** yet! If Yakir prints a Trial Balance (*מאזן בוחן*) or Profit & Loss statement, unposted batches are excluded or marked as provisional.

#### Phase 2: Invariant & Balance Validation Check
Before Hashavshevet allows committing the batch, its internal engine executes database validation routines:
- **Balanced Transaction Check ($\sum \text{Debit} = \sum \text{Credit}$):** If the invoice lines do not balance to the exact Agora (0.01 ₪), the commit transaction is aborted with an error.
- **Foreign Key Check (קיום כרטיסים):** Verifies that the Supplier Account Key (`30082`) and Expense Key (`40210`) actually exist in the `ACCOUNTS` master table.
- **Fiscal Year Check (שנה פיננסית פתוחה):** Ensures the transaction date belongs to an open accounting period.

#### Phase 3: The Permanent Commit (קליטת מנה / Posting)
When the bookkeeper confirms the batch and clicks **"קליטת מנה"**, Hashavshevet runs an atomic transaction inside SQL Server:
1. **Transfer to Permanent Ledger (ספר ראשי):** Rows are moved into the permanent transaction table (`TRANSACTIONS`).
2. **Immutable Sequential Audit Stamp (מספר תנועה רציף):**
   - Under Israeli Tax Authority Bookkeeping Directives (*הוראות ניהול ספרים*), accounting systems are legally forbidden from deleting, updating, or re-ordering committed transactions.
   - Hashavshevet stamps each transaction with an auto-incrementing, non-reusable counter (*מספר תנועה*).
   - If a transaction was committed by mistake, the database **never deletes it**! Instead, an accountant must issue a compensating reversing transaction (*פקודת ביטול / תיקון*).
3. **Running Balance Mutation (עדכון יתרות):**
   - The master account records in the `ACCOUNTS` table have their running balance columns updated:
     - Supplier Card `30082`: Credit balance increases by 1,170.00 ₪.
     - Expense Card `40210`: Debit balance increases by 1,000.00 ₪.
     - VAT Card `20000`: Debit balance increases by 170.00 ₪.
4. **Audit Trail Record:** Writes to an internal audit log with user ID, machine MAC/IP address, and exact system timestamp.

---

## 4. Why This Architecture Informs Our Solution Design

Understanding Hashavshevet's internal architecture leads directly to our best-practice integration decisions:

| Hashavshevet Architectural Reality | How Our System Integrates Safely |
|---|---|
| **Never write raw SQL directly to `TRANSACTIONS`** | Writing directly to SQL tables bypasses Hashavshevet's balance invariants, sequence generators, and audit triggers, which can corrupt the database or void the company's tax compliance certification! |
| **The "Open Batch" (מנה פתוחה) is the official staging area** | Our automated AI tool pushes all extracted invoices into an **Open Batch** (via H-Connect API or `MOVIN.DOC` text files). This gives Sarah and Yakir full control to review before the permanent commit. |
| **Data is kept locally in the office** | Yakir doesn't need to migrate his whole ERP to the cloud. Our web portal runs in the cloud (or local network), processes the PDFs via AI, and transmits structured batch data to the local Hashavshevet server. |

---

## 5. Is H-Connect Already Up and Ready in Yakir's Environment?

### **Short Answer: Almost Certainly NO (99% Probability).**

In an Israeli low-tech small business where employees are manually typing paper invoices into desktop screens, **H-Connect does not exist out of the box.**

### Why H-Connect is Unlikely to Be Ready:
1. **It is a Paid Add-on Module:** Hashavshevet (Hilan Group) does not bundle H-Connect enabled by default in standard SMB licenses. It requires an explicit license key upgrade.
2. **Requires Server Middleware Setup:** H-Connect is a separate Windows service / IIS daemon. It must be installed, bound to a local HTTP port (e.g. `8080`), configured with Station IDs (*מזהה תחנה*), NetPassport credentials, and tested with external integrations.
3. **No Previous Need:** Because Yakir's business has never integrated an external software with Hashavshevet before, they had zero reason to buy, install, or configure H-Connect.

---

## 6. The Pragmatic Solution: Why `Movein` is the Real-World MVP Champion

Because H-Connect is almost certainly absent, designing the system to depend solely on H-Connect on day 1 would stall the project (waiting for Hashavshevet sales, license fees, and technician visits).

### Comparison: H-Connect vs. Native Movein

| Dimension | Option A: H-Connect REST API | Option B: Native Movein Interface (`MOVIN.DOC`) |
|---|---|---|
| **Already present in Yakir's Hashavshevet?** | ❌ No. Requires purchase & setup. | ✅ **YES (100%).** Built into every Hashavshevet version since 1995. |
| **Additional Hashavshevet License Fee?** | 💸 Yes (thousands of ₪ setup/annual). | 🆓 **0 ₪ (Completely Free).** |
| **IT Technician Required?** | 🔧 Yes (to install and bind ports). | ❌ No. Works natively in the desktop UI. |
| **How it Works in Practice:** | Cloud/agent makes HTTP POST JSON to `localhost:8080`. | System outputs `MOVIN.DOC` + `MOVIN.PRM`. Sarah clicks *"יבוא פקודות יומן מקובץ"*. |
| **Destination inside Hashavshevet:** | Lands in an Open Batch (מנה פתוחה). | Lands in an Open Batch (מנה פתוחה) — **Identical!** |

### Recommended Phased Architecture:
1. **Phase 1 (Day 1 - Zero Cost & Zero Friction): `Movein` Generation.**
   - Our web portal processes invoices and generates standardized `MOVIN.DOC` files.
   - Sarah clicks *"הורד קובץ למחשב"* and selects it in Hashavshevet's native import screen.
   - Immediate value delivered on day one with zero changes to Yakir's Hashavshevet contract.
2. **Phase 2 (Future Polish): `H-Connect` REST API.**
   - Once Yakir sees the automation saving 40+ hours a month, he can choose to purchase the H-Connect module from Hashavshevet to eliminate that single manual file-selection click.

