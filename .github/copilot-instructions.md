# Copilot Instructions - Yakir Hashavshevet Invoice Automation System

## 1. Developer Accounting Communication Rule
- **Developer Background:** The user and lead developer comes exclusively from software engineering and has **zero background in accounting, bookkeeping, or finance**.
- **Explanation Requirement:**
  1. Whenever any accounting term, rule, or concept is used, **first explain it simply in software/logical engineering terms** (e.g. explain double-entry bookkeeping as balanced dual-ledger balance updates, journal entries as transactional ledger records, etc.).
  2. Always provide its official **Hebrew name in the Israeli accounting world** (e.g., *Journal Entry* -> *פקודת יומן*, *General Ledger Account* -> *כרטיס חשבון / מפתח חשבון*, *Tax Invoice* -> *חשבונית מס*).
  3. Reference and continuously update the project dictionary and guide doc located at `docs/accounting_dictionary.md`.

## 2. Israeli Accounting Domain & Regulatory Context
- **Jurisdiction:** Strictly the State of Israel (רשות המסים, מע"מ, מס הכנסה, ביטוח לאומי).
- **Regulatory Framework:**
  - Standard Israeli VAT laws (מע"מ תשומות - Input VAT, מע"מ עסקאות - Output VAT).
  - The Israeli Invoicing Model (*חוק החשבוניות / מודל הקצאת חשבוניות*) requiring real-time Israeli Tax Authority allocation numbers (*מספר הקצאה*).
  - Withholding tax rules (*ניכוי מס במקור*) and bookkeeping certificate verification (*אישור ניהול ספרים*).
- **Target ERP Platform:** Hashavshevet ERP (חשבשבת חלונות / ERP / H-Connect / Movein format).

## 3. Strict Autopilot Execution Guardrail
- **No Autonomous Code Generation or Package Installations:** Even if 'autopilot' mode is set or activated again in the future, **NO actual code implementation, source file creation, or package/library installations (e.g., npm, pip) are permitted without explicit permission granted directly by the user**.
- **Permitted Autonomous Activities:** When autopilot is active, Copilot is strictly restricted to:
  1. Searching for information online (web search, API docs, regulatory sources).
  2. Writing and maintaining documentation, architecture specs, and user guides in `docs/`.
  3. Taking proactive actions to analyze requirements and gather information.
  4. Answering questions and updating the accounting dictionary.
- **Permission Gate:** Before writing any actual application code or installing any packages, explicitly ask the user for permission and await their explicit consent.

