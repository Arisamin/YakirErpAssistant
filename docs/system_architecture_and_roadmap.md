# Project Specification & System Architecture: AI Invoice Automation for Hashavshevet (חשבשבת)

---

## 1. Executive Summary & Problem Context

Currently, the business owner (**Yakir**) and three employees spend substantial manual effort taking supplier invoices, reading amounts and line items, classifying expense categories, and manually typing them into **Hashavshevet (חשבשבת ERP)**.

### The Objective
Build a modern, secure, online web platform that:
1. Allows employees and Yakir to upload invoices (PDFs, scanned receipts, image files, email attachments) through a web browser.
2. Uses Multimodal AI / OCR tailored to the **Israeli market** to extract all key financial metadata.
3. Automatically maps vendors, VAT accounts, and expense categories.
4. Provides a multi-role approval workflow (RBAC) where employees upload, managers approve, and bookkeepers verify.
5. Injects the resulting balanced transactions (**פקודות יומן**) directly into Hashavshevet through an automated pipeline.

---

## 2. Deep Dive: Business Artifacts & Documents (Filling the Gaps)

In Israeli business operations, an Accounts Payable (AP) automation tool must handle more than just single standard tax invoices:

| Document Type (סוג מסמך) | Accounting Purpose | How our System Handles It |
|---|---|---|
| **Tax Invoice (חשבונית מס ספק)** | Formal demand for payment from a registered business. Creates the debt to the supplier and the right to claim Input VAT (**מע"מ תשומות**). | **Primary flow:** Extracts Vendor ID (ח.פ.), Invoice #, Date, Pre-VAT Amount, VAT (17%), Total, and Allocation # (**מספר הקצאה**). Generates a balanced Journal Entry (**פקודת יומן מאוזנת**). |
| **Tax Invoice / Receipt (חשבונית מס קבלה)** | Invoice issued when payment was executed immediately (e.g., paid by credit card, cash, or instant bank wire). | Automatically generates **two steps**: (1) The expense and VAT credit, and (2) The immediate payment settlement against the bank/credit card account. |
| **Receipt / Payment Confirmation (קבלה / אישור העברה)** | Proof of money transferred (bank wire, Bit, credit card slip, check). | Links to existing pending invoices to mark them as paid / settled (**התאמת כרטיס ספק**). |
| **Credit Invoice (חשבונית זיכוי ספק)** | Issued when goods are returned, services cancelled, or a discount was retroactively applied. | Creates an inverted journal entry (reduces supplier debt and reduces claimed VAT). |
| **Delivery Note (תעודת משלוח ספק)** | Proof of physical goods arriving at Yakir's warehouse/office before the monthly invoice arrives. | Stored in system for **Matching**: When the consolidated monthly invoice (**חשבונית מרכזת**) arrives, the system verifies invoice quantities against delivery notes. |
| **Petty Cash & Fuel Slips (קבלות קופה קטנה / דלק / חניה)** | Small receipts paid out-of-pocket by employees needing reimbursement. | Employee uploads via web portal; system classifies under Employee Reimbursement (**חו"ז עובדים**) and specific expense codes. |
| **Allocation Number (מספר הקצאה - מודל חשבוניות ישראל)** | Regulatory requirement by the Israel Tax Authority for B2B invoices above legal thresholds. | OCR verifies presence of the 9-digit/UUID allocation number. Flags invoices lacking an allocation number to prevent illegal VAT deductions. |

---

## 3. The Target System: Hashavshevet (חשבשבת ERP) Deep Dive

### What is Hashavshevet?
Hashavshevet is the longest-standing Israeli ERP and accounting package (over 40 years in market, developed by Hashavshevet / Wizcount, now part of Hilan Group). It is widely used by Israeli SMBs and mid-market enterprises.

### Deployment Topologies
1. **On-Premise (Most Common for SMBs):** Runs on a local Windows Server or desktop PC, backed by Microsoft SQL Server (or older c-tree). Clients run a legacy Windows desktop UI.
2. **Hashavshevet Cloud (חשבשבת ענן):** Hosted Windows Virtual Desktop / Web ERP running on Hilan's cloud infrastructure.

### How Data Gets Injected (Integration Options)
Accountants adhere to strict audit rules: **never write raw records directly into permanent ledger tables** without passing Hashavshevet's internal balance and audit validation!

1. **Primary Integration Method: Movein Batch Files (`MOVIN.DOC` & `MOVIN.PRM`)**
   - **Native & Universal:** Built into **100% of Hashavshevet installations** since 1995.
   - **Zero Setup & Zero Cost:** Requires no expensive H-Connect license modules from Hilan and no technician visits.
   - **Workflow:** The system formats verified invoices into `MOVIN.DOC` (data lines) and `MOVIN.PRM` (schema parameters). Sarah clicks *"הורד קובץ"* on the web portal, opens Hashavshevet, and clicks *"ייבוא פקודות יומן מקובץ"*.
   - **Lands in an Open Batch (מנה פתוחה):** Staged safely for final review and posting.

2. **Future Upgrade Path: H-Connect REST API Middleware**
   - Hashavshevet's official REST API gateway (`movein` plugin).
   - Once Yakir validates the core system and wants to eliminate the 1-click file download, he can purchase the H-Connect module from Hashavshevet to enable direct HTTP JSON transmission.
   - Kept on the product roadmap alongside a native mobile app as future enhancements.

3. **The "Open Batch" (מנה פתוחה) Invariant:**
   - In both methods, records strictly land in an **Open Batch (מנה זמנית / פתוחה)** rather than being directly committed to the permanent ledger (**קליטת יומן קבועה**).
   - This gives Sarah and Yakir 100% audit confidence before final posting.

---

## 4. Competitive Analysis: Israeli Landscape & Existing Solutions

### A. Major ERP & Accounting Systems in Israel

| System | Target Audience | Native Cloud? | Native Invoice OCR? | Integration Difficulty |
|---|---|---|---|---|
| **Hashavshevet (חשבשבת)** | SMBs, industrial, retail, wholesale | Hybrid (mostly On-Prem, growing Cloud) | Very limited / relies on 3rd-party add-ons | Medium (via H-Connect or Movein) |
| **Priority ERP (פריוריטי)** | Mid to large enterprises, high-tech | Yes (Priority Cloud / Web) | Has "Priority Scan & Capture" / OCR add-on | High / Powerful REST & OData APIs |
| **SAP Business One (סאפ)** | Mid-market enterprises | Hybrid | Integrates with SAP Concur / DOKKA | Enterprise REST / Service Layer |
| **Rivhit (רווחית)** | Small businesses, retail shops | Desktop & Cloud (Rivhit Online) | Limited / 3rd party OCR | Simple REST API |
| **Morning (חשבונית ירוקה)** | Freelancers, startups, micro-businesses | 100% Cloud SaaS | Has mobile expense scanning for receipts | Great modern REST API |
| **iCount** | Micro & small businesses | 100% Cloud SaaS | Basic mobile receipt upload | REST API |
| **Intuit QuickBooks** | Global SMBs (US / Europe leader) | 100% Cloud SaaS | Built-in receipt capture & bank feed | **Not certified in Israel:** Lacks Israeli Tax Authority approval, no support for PCN874 VAT reports, Form 856 withholding tax, or the Invoicing Law allocation API. |

### B. Third-Party Invoice Automation Tools (What Yakir's system will imitate & surpass)

1. **DOKKA (דוקה):**
   - *The Israeli market benchmark for AP automation.*
   - Connects to Hashavshevet and Priority.
   - Features: Web portal + mobile app, Hebrew OCR with machine learning, automatic extraction of amounts, VAT, Israeli company ID (ח.פ.), and creates batches in Hashavshevet.
   - *Drawback:* Expensive per-document licensing, complex configuration for small companies.
2. **Bisan / AutoDoc / Dext (Receipt Bank):**
   - Tools focused on bookkeepers receiving scanned documents and converting them to Movein / BKMVDATA files.
3. **Why build a custom system for Yakir?**
   - Tailored specifically to his company's 3-employee workflow.
   - Custom approval chains suited to his business hierarchy.
   - Direct integration with his specific Hashavshevet setup without recurring expensive per-page subscription fees.
   - Can incorporate AI (LLM-based reasoning) that learns his specific supplier catalog and expense accounts with higher accuracy than legacy OCR templates.

---

## 5. User Roles, Access & Authorization (RBAC)

To solve Yakir's operational bottleneck (currently involving 3 employees with overlapping, manual work), the platform will implement a fine-grained **Role-Based Access Control (RBAC)** model:

```
+--------------------------------------------------------------------------+
|                        ROLES & PERMISSIONS MATRIX                        |
+-------------------+-----------------+----------------+-------------------+
| Role              | Intended Users  | Capabilities   | Restrictions      |
+-------------------+-----------------+----------------+-------------------+
| 1. Submitter      | Field Workers,  | • Upload files | • Cannot see      |
|    (מעלה מסמכים)  | Secretaries,    | • View own     |   company profits |
|                   | Employees       |   submissions  | • Cannot push     |
|                   |                 | • Edit basic   |   to Hashavshevet |
|                   |                 |   notes        |                   |
+-------------------+-----------------+----------------+-------------------+
| 2. Approver       | Department      | • Review line  | • Cannot change   |
|    (מאשר הוצאה)   | Managers,       |   items/PO     |   accounting chart|
|                   | Operations Lead | • Approve or   |   of accounts     |
|                   |                 |   reject items |                   |
+-------------------+-----------------+----------------+-------------------+
| 3. Bookkeeper     | In-house or     | • Verify VAT   | • System config   |
|    (מנהל/ת חשבונות)| External CPA    | • Map accounts |   managed by Admin|
|                   | (רואה חשבון)    | • Generate &   |                   |
|                   |                 |   export batch |                   |
|                   |                 |   to Hashavshevet              |
+-------------------+-----------------+----------------+-------------------+
| 4. Admin / Owner  | Yakir           | • Full access  | • None            |
|    (מנהל מערכת)   |                 | • User mgmt    |                   |
|                   |                 | • Audit logs   |                   |
|                   |                 | • ERP config   |                   |
+-------------------+-----------------+----------------+-------------------+
```

---

## 6. Target Software Architecture & Implementation Plan

```
                   [Online Desktop Web Portal (Browser)]
                  (Next.js / React + Tailwind CSS + Hebrew RTL)
                                     |
                                     v
                       [API Gateway & Auth Service]
                     (JWT / Role-Based Access Control)
                                     |
                                     v
                       [Document Ingestion & Storage]
                 (Encrypted Object Storage - S3 / Local MinIO)
                                     |
                                     v
             [Asynchronous Processing Queue (BullMQ / Redis)]
                                     |
                                     v
                    [AI / Multimodal Extraction Engine]
         (Hebrew OCR + Vision LLM: Vendor ID, Amounts, VAT, Dates)
                                     |
                                     v
                   [Validation & Accounting Rule Engine]
     (9-digit Tax ID checksum, VAT rate math, Allocation # check,
       Vendor Mapping to Hashavshevet Account Key - מפתח חשבון)
                                     |
                                     v
                 [Verification & Approval Web Dashboard]
               (Side-by-side: Original Document vs. Extracted Data)
                                     |
                                     v
                       [Hashavshevet Movein Engine]
                    (Generates MOVIN.DOC & MOVIN.PRM)
                                     |
                                     v
                    [1-Click Download or Local Drop]
                                     |
                                     v
                       [Hashavshevet ERP Database]
                      (Lands safely in an Open Batch - מנה)
```

### Detailed Component Specifications

#### Component 1: Cloud-Native Web Portal (Online Availability)
- **Frontend:** Next.js (React) with full native **Hebrew RTL (Right-to-Left)** support.
- **Web-Only Architecture:** Simple, intuitive desktop browser portal; no native mobile app required for Phase 1.
- **Side-by-Side Review Screen:** Bookkeepers view the original PDF on the left and extracted structured fields on the right, with instant keyboard shortcuts for rapid confirmation.

#### Component 2: Israeli Multimodal Extraction Engine
- **Extraction Pipeline:**
  1. PDF/Image normalized and converted to high-resolution render.
  2. Document passed to a vision-capable engine (e.g. Claude Vision / GPT-4o / Azure Document Intelligence).
  3. Structured JSON extracted containing:
     - Supplier Name (*שם ספק*)
     - Israeli Tax ID (*ח.פ. / ע.מ.*)
     - Invoice Number (*מספר חשבונית / אסמכתא*)
     - Issue Date (*תאריך אסמכתא*) and Due Date (*תאריך ערך*)
     - Net Amount (*סכום לפני מע"מ*), VAT Amount (*סכום מע"מ*), Total (*סכום כולל מע"מ*)
     - Allocation Number (*מספר הקצאה*) if present.
- **Rule Verification:**
  - Validates $\text{Net} + \text{VAT} = \text{Total}$ within $\pm 0.05$ NIS rounding tolerance.
  - Validates supplier Israeli ID checksum.

#### Component 3: Account Mapping & Memory Engine
- Maintains a mapping table between Supplier Tax ID (ח.פ.) and Yakir's Hashavshevet Account Key (**מפתח חשבון ספק**).
- Learns default expense accounts (**חשבון הוצאה**) based on previous user corrections.

#### Component 4: Hashavshevet Movein Engine (Primary Integration)
- **Core Functionality:** Converts verified batches into Hashavshevet's native `MOVIN.DOC` and `MOVIN.PRM` files.
- **Delivery Mode:** 1-Click web download for Sarah to select inside Hashavshevet's native *"יבוא פקודות יומן"* screen.
- **Benefits:** 0 ₪ license fees, zero external IT setup, 100% compatibility with all Hashavshevet versions.

---

## 7. Future Enhancements & Product Roadmap

The following capabilities are cataloged for future phases once the core web Movein system is operational:
1. **H-Connect REST API Integration:** Direct cloud-to-ERP API connection once Yakir purchases the H-Connect module from Hashavshevet, eliminating the 1-click file download.
2. **Native Mobile App (iOS / Android):** Dedicated field-worker app with live camera document edge detection and receipt scanning on the go.
3. **Automated Supplier Email Parsing:** Dedicated inbox (`invoices@yakir-biz.co.il`) that automatically ingests incoming supplier PDFs.

---

## 8. Next Steps & Implementation Milestones

1. **Step 1:** Establish the data models (Users, Organizations, Documents, LineItems, Accounts, Batches).
2. **Step 2:** Build the document upload & storage pipeline with asynchronous queue.
3. **Step 3:** Implement the Hebrew Multimodal AI extraction prompt & validation parser.
4. **Step 4:** Build the Next.js verification and approval interface with RBAC.
5. **Step 5:** Build the Hashavshevet Movein batch file generator (`MOVIN.DOC` and `MOVIN.PRM`).
