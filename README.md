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

1. [**Analysis of Etaniv POC Tool & AI Technical Roadmap**](./docs/etaniv_poc_and_roadmap_analysis.md): **Direct Analysis of Yakir's Artifacts.** Detailed analysis of Yakir's HTML POC (`אתניב`), 43 mocked API endpoints, 6-stage invoice lifecycle, 3-way matching, project cost splitting, Masav bank transfers, and Render.com deployment blueprint.
2. [**System Architecture & Design: Version 2 (Simplified MVP)**](./docs/system_architecture_and_design_v2_simplified.md): Lean architecture, hosting, access control, and Hashavshevet native Excel import engine.
3. [**Cloudflare Pages Deployment & Subdomain DNS Guide**](./docs/cloudflare_deployment_and_dns_guide.md): Step-by-step walkthrough for deploying to Cloudflare Pages (Free Tier) and setting up a dedicated CNAME subdomain with zero disruption to Yakir's WordPress site.
4. [**Auth0 RBAC Integration Guide**](./docs/auth0_rbac_integration_guide.md): Complete architecture and setup for securing Yakir's client-side app with Auth0 SPA SDK and enforcing Role-Based Access Control without a database.
5. [**System Architecture & Workflows (v1)**](./docs/system_architecture_and_workflows.md): High-level hosting block diagrams, 5-level component breakdown, sequence diagrams, and end-to-end purchase-to-ledger workflow.
6. [**System Architecture & Roadmap (v1 & Future)**](./docs/system_architecture_and_roadmap.md): Complete architectural blueprint, Israeli ERP competitive market analysis, RBAC permissions matrix, and future upgrade roadmap (AI Vision, Movein, H-Connect).
7. [**Hashavshevet Internal Architecture**](./docs/hashavshevet_internal_architecture.md): Deep dive into Hashavshevet on-premise MS SQL data locality, 2-phase commit state machine, immutable audit logs, and Movein vs. H-Connect technical trade-offs.
8. [**Yakir Operations & Infrastructure Guide**](./docs/yakir_operations_and_infrastructure.md): Detailed comparison of Yakir's manual "before" workflow vs. automated "after" digital inbox, required cloud accounts, cost calculation (~110–190 ₪/mo), and office hardware.
9. [**Accounting Dictionary for Software Engineers**](./docs/accounting_dictionary.md): Living developer dictionary mapping Israeli accounting concepts and Hebrew terminology directly into software engineering equivalents.

---

## ⚖️ License & Guidelines

All accounting rules, document definitions, and compliance checks adhere to the **Israel Tax Authority Bookkeeping Directives** (*הוראות מס הכנסה בדבר ניהול פנקסי חשבונות*).
