---
name: israeli-accounting-domain
description: Rules, standards, and domain conventions for Israeli accounting, taxation, and Hashavshevet ERP integration.
---

# Israeli Accounting Domain Instructions

## Context & Scope
All business logic, document parsing, database models, and validation routines in this project must adhere to the laws, regulations, and established conventions of the **State of Israel**:
- **Israel Tax Authority (רשות המסים בישראל)**
- **Value Added Tax Law (חוק מס ערך מוסף, תשל"ו-1975)**
- **Income Tax Ordinance & Bookkeeping Directives (פקודת מס הכנסה והוראות ניהול ספרים)**
- **The Israeli Invoicing Law (חוק החשבוניות / מודל הקצאת מספרי חשבוניות)**

## Core Principles

### 1. Document Taxonomy (סוגי מסמכים עסקיים)
The system deals with distinct document types recognized under Israeli bookkeeping directives:
- **Tax Invoice (חשבונית מס):** Issued only by Authorized Dealers (*עוסק מורשה*) or Companies (*חברה בע"מ*). Demands payment and enables the buyer to reclaim Input VAT (*מע"מ תשומות*).
- **Tax Invoice / Receipt (חשבונית מס קבלה):** Used when payment is received at the moment the invoice is generated (common for instant cash/credit card payments).
- **Receipt (קבלה):** Proof of payment only (cash, bank transfer, check, credit card). Does not incur VAT liability on its own.
- **Credit Invoice (חשבונית זיכוי):** Reversal or partial refund of a previously issued tax invoice.
- **Transaction / Proforma Invoice (חשבונית עסקה):** A request for payment before tax liability is created (used by service providers or exempt dealers (*עוסק פטור*)).
- **Delivery Note (תעודת משלוח):** Accompanies physical goods; establishes receipt of inventory prior to issuing a consolidated invoice (*חשבונית מרכזת*).
- **Purchase Order (הזמנת רכש):** Internal or external commitment to purchase from a supplier (*ספק*).

### 2. Israeli Tax & Compliance Rules
- **Tax ID Validation (מספר עוסק מורשה / ח.פ. / ת.ז.):** Standard 9-digit Israeli checksum algorithm (Luhn variation).
- **Invoice Allocation Number (מספר הקצאה):** B2B invoices exceeding the government threshold must receive an approval confirmation allocation number from the Israel Tax Authority system.
- **Input VAT Separation (מע"מ תשומות):** Expenses must cleanly differentiate between net amount before VAT (*סכום לפני מע"מ*), VAT amount (*סכום מע"מ*), and total gross amount (*סכום כולל מע"מ*), as well as disallowed/partially allowed VAT (e.g. vehicle expenses, entertainment).
- **Withholding Tax (ניכוי מס במקור):** Business-to-business payments must calculate withholding tax percentages according to the supplier's valid certificate (*אישור ניכוי מס במקור*).

### 3. Hashavshevet ERP Integration Standard
- Every financial document translates into balanced **Journal Entries (פקודות יומן)** or **Inventory Documents (מסמכי שיווק ורכש)**.
- Each entry references an account code (*מפתח חשבון* / *כרטיס חשבון*) representing the supplier (*ספק*), customer (*לקוח*), expense category (*הוצאה*), or VAT account (*מע"מ תשומות*).
- Integrations must use standard Hashavshevet interfaces: **H-Connect REST API**, **Movein batch format (`MOVIN.DOC`/`MOVIN.PRM`)**, or direct SQL staging tables.
