# YakirErpAssistant

**AI-Powered Invoice Automation & Hashavshevet ERP Integration System**

An automated, web-based digital inbox and accounting assistant designed for Israeli SMBs using **Hashavshevet (חשבשבת ERP)**. It streamlines the manual data entry process of supplier invoices into Hashavshevet's open batch (*מנה פתוחה*).

---

## 📖 System Overview & Architecture

- **Web-Based Digital Inbox:** Multi-role web interface (Submitter, Manager Approver, Bookkeeper) for drag-and-drop document ingestion.
- **Multimodal AI & OCR:** Autonomous extraction of Israeli tax fields (Tax ID / ח.פ., invoice dates, אסמכתא, Net, VAT, Total, and statutory Allocation Numbers / מספר הקצאה).
- **Israeli Tax Compliance:** Validates 9-digit Modulo-10 (Luhn) Tax ID checksums and 17% VAT invariant balance equations.
- **Native Hashavshevet Movein Engine:** Generates pre-formatted `MOVIN.DOC` and `MOVIN.PRM` files for 1-click batch import into Hashavshevet at 0 ₪ additional license costs.

---

## 📚 Documentation Index

Comprehensive technical, operational, and architectural documentation is available in the [`docs/`](./docs) directory:

1. [**System Architecture & Design: Version 2 (Simplified MVP)**](./docs/system_architecture_and_design_v2_simplified.md): **Current Active Architecture.** Zero-database stateless design, online hosting of Yakir's HTML POC, multi-role access control (RBAC), and Hashavshevet native Excel import engine at ~0 ₪/mo running cost.
2. [**System Architecture & Workflows (v1)**](./docs/system_architecture_and_workflows.md): High-level hosting block diagrams, 5-level component breakdown, sequence diagrams, and end-to-end purchase-to-ledger workflow.
3. [**System Architecture & Roadmap (v1 & Future)**](./docs/system_architecture_and_roadmap.md): Complete architectural blueprint, Israeli ERP competitive market analysis, RBAC permissions matrix, and future upgrade roadmap (AI Vision, Movein, H-Connect).
4. [**Hashavshevet Internal Architecture**](./docs/hashavshevet_internal_architecture.md): Deep dive into Hashavshevet on-premise MS SQL data locality, 2-phase commit state machine, immutable audit logs, and Movein vs. H-Connect technical trade-offs.
5. [**Yakir Operations & Infrastructure Guide**](./docs/yakir_operations_and_infrastructure.md): Detailed comparison of Yakir's manual "before" workflow vs. automated "after" digital inbox, required cloud accounts, cost calculation (~110–190 ₪/mo), and office hardware.
6. [**Accounting Dictionary for Software Engineers**](./docs/accounting_dictionary.md): Living developer dictionary mapping Israeli accounting concepts and Hebrew terminology directly into software engineering equivalents.

---

## ⚖️ License & Guidelines

All accounting rules, document definitions, and compliance checks adhere to the **Israel Tax Authority Bookkeeping Directives** (*הוראות מס הכנסה בדבר ניהול פנקסי חשבונות*).
