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

1. [**Etaniv Production System Master Guide**](./docs/etaniv.md): **The single source of truth for Yakir's production system.** Complete breakdown of the `etaniv-app_21` monorepo (`server/` + `web/` + `render.yaml`), physical topography block diagram, 6 end-to-end sequence diagrams, 18 database tables (PostgreSQL/Prisma), live domain & DNS infrastructure (Microsoft 365 + WordPress), and Render.com deployment.
2. [**Etaniv POC & AI Technical Roadmap Analysis**](./docs/etaniv_poc_and_roadmap_analysis.md): Deep-dive analysis of the interactive HTML demo (`אתניב`), 43 mocked API endpoints, and real-world contractor workflows: 3-way matching, project cost splitting, Israeli payment terms (שוטף+), Masav (מס"ב) bank transfers, and client retention (עיכבון).
3. [**Etaniv Codebase File Map & Architectural Audit**](./docs/etaniv_codebase_file_map.md): Exhaustive file-by-file mapping of all 73 source and config files in `From Yakir/etaniv-app_21/` with 5-sentence architectural breakdowns covering layers, mechanisms, ERP/Masav interfaces, and security rules.
4. [**Early System Design, Architecture & Operations Archive**](./docs/initial_system_design_archive.md): **Consolidated Historical Archive.** Unifies the early system specifications, component breakdowns (Diagrams 1 & 2), 3-employee manual office workflows, cloud costing estimates, and competitive ERP analysis developed prior to receiving Yakir's source code. Includes an interactive Table of Contents with jump links throughout.
5. [**Hashavshevet Internal Architecture**](./docs/hashavshevet_internal_architecture.md): Deep dive into Hashavshevet on-premise MS SQL data locality, 2-phase commit state machine, immutable audit logs, and Movein vs. H-Connect technical trade-offs.
6. [**Accounting Dictionary for Software Engineers**](./docs/accounting_dictionary.md): Living developer dictionary mapping Israeli accounting concepts and Hebrew terminology directly into software engineering equivalents.
7. [**Single-Tenant Fleet Architecture & Centralized Monitoring Roadmap**](./docs/fleet_management_and_monitoring_roadmap.md): Operational guide and roadmap for managing, monitoring, and patching multi-client ERP instances from a unified ops dashboard.
8. [**Single-Tenant POC Deployment & Fleet Monitoring Plan**](./docs/poc_deployment_and_fleet_monitoring_plan.md): Step-by-step implementation guide for deploying Tenant #1 (Etaniv POC) and establishing a multi-tenant monitoring console using free tiers ($0) with an identified minimal paid path ($14/mo).
9. [**Simplified MVP Architecture (v2)**](./docs/system_architecture_and_design_v2_simplified.md), [**Cloudflare Deployment Guide**](./docs/cloudflare_deployment_and_dns_guide.md) & [**Auth0 RBAC Guide**](./docs/auth0_rbac_integration_guide.md): Specialized guides for alternative lightweight client-side deployments and Auth0 integrations.


---

## ⚖️ License & Guidelines

All accounting rules, document definitions, and compliance checks adhere to the **Israel Tax Authority Bookkeeping Directives** (*הוראות מס הכנסה בדבר ניהול פנקסי חשבונות*).
