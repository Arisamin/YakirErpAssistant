# Single-Tenant Fleet Architecture & Centralized Monitoring Roadmap

> **Target Audience:** Engineering & DevOps Lead managing multi-client ERP companion deployments (Etaniv B.Y. Ltd. and future Israeli SMB contractors).  
> **Core Concept:** Providing each client with an isolated, dedicated single-tenant instance (dedicated Render service, dedicated PostgreSQL database, dedicated subdomains) while giving the managing engineer a unified, single-pane-of-glass dashboard to monitor health, performance, security, and updates.

---

## Table of Contents
1. [Executive Summary & Why Single-Tenant?](#1-executive-summary--why-single-tenant)
2. [Fleet Topology & Mental Model](#2-fleet-topology--mental-model)
3. [The Standardized Client Agent Contract (`/api/health`)](#3-the-standardized-client-agent-contract-apihealth)
4. [Central Monitoring Dashboard Options](#4-central-monitoring-dashboard-options)
   - [Option A: Lightweight SaaS Aggregator (Low-Code / Fastest MVP)](#option-a-lightweight-saas-aggregator-low-code--fastest-mvp)
   - [Option B: Custom Internal Ops Portal (Full Control)](#option-b-custom-internal-ops-portal-full-control)
5. [Telemetry, Error APM & Fleet Logs](#5-telemetry-error-apm--fleet-logs)
6. [Automated Fleet Maintenance & Security Patching Pipeline](#6-automated-fleet-maintenance--security-patching-pipeline)
7. [Step-by-Step Implementation Roadmap](#7-step-by-step-implementation-roadmap)

---

## 1. Executive Summary & Why Single-Tenant?

When serving Israeli contractors and construction companies like Yakir:
- **Regulatory & Legal Segregation:** Financial data, tax reports, Hashavshevet account codes, and Masav banking details must never risk cross-tenant pollution. Under Israeli privacy and tax regulations, accidental data leakage between competitors can lead to catastrophic business liabilities.
- **Client Cloud Independence:** Clients often want their data in their own cloud accounts or under their direct corporate ownership (e.g. Yakir’s Microsoft 365 and Render workspace).
- **Zero "Noisy Neighbor" Risk:** A heavy monthly report or bad import batch run by Contractor A never impacts the performance of Contractor B.
- **Challenge:** Managing 5, 20, or 50 single-tenant instances can lead to operational drift. The solution is **strict fleet standardization** and a **centralized observability dashboard**.

[Back to Top / Table of Contents](#table-of-contents)

---

## 2. Fleet Topology & Mental Model

```
 ┌────────────────────────────────────────────────────────────────────────────────────────┐
 │                      YOUR CENTRAL OPS COMMAND DASHBOARD                                │
 │       • Fleet Health Matrix: [Etaniv: 🟢] [Client B: 🟢] [Client C: 🟠 Lag]              │
 │       • Release Status: v1.4.2 (4 instances) | v1.4.1 (1 instance)                      │
 │       • Pending Migrations & Vulnerability Advisories                                  │
 └──────────────────────────────────────────┬─────────────────────────────────────────────┘
                                            │
                        Fleet Telemetry / Ingestion Poller
                                            │
       ┌────────────────────────────────────┼────────────────────────────────────┐
       ▼                                    ▼                                    ▼
┌───────────────────────────────┐ ┌───────────────────────────────┐ ┌───────────────────────────────┐
│     Tenant 1: Etaniv          │ │     Tenant 2: Contractor B    │ │     Tenant 3: Contractor C    │
│  (Render Account A / FFM)     │ │  (Render Account B / FFM)     │ │  (Render Account C / FFM)     │
│  • api.etaniv.co.il           │ │  • erp.contractor-b.co.il     │ │  • app.contractor-c.co.il     │
│  • Dedicated Postgres 16      │ │  • Dedicated Postgres 16      │ │  • Dedicated Postgres 16      │
│  • GET /api/health            │ │  • GET /api/health            │ │  • GET /api/health            │
└───────────────────────────────┘ └───────────────────────────────┘ └───────────────────────────────┘
```

[Back to Top / Table of Contents](#table-of-contents)

---

## 3. The Standardized Client Agent Contract (`/api/health`)

To enable zero-overhead fleet monitoring, every customer backend must implement an identical, unauthenticated (or HMAC-signed) health endpoint that tests all internal dependencies in under 50 milliseconds.

### Standard JSON Health Contract
```http
GET /api/health
```

```json
{
  "status": "healthy",
  "instance": {
    "tenantId": "etaniv",
    "environment": "production",
    "version": "1.4.2",
    "commitSha": "2d628f3",
    "uptimeSeconds": 172800,
    "timestamp": "2026-11-04T14:35:00Z"
  },
  "checks": {
    "database": {
      "status": "up",
      "latencyMs": 8,
      "connectionPool": {
        "active": 3,
        "idle": 7,
        "max": 10
      }
    },
    "storage": {
      "provider": "Cloudflare R2",
      "status": "accessible"
    },
    "backup": {
      "lastCompletedAt": "2026-11-04T02:00:00Z",
      "status": "success",
      "ageHours": 12.5
    }
  }
}
```

- **HTTP Status Codes:**
  - `200 OK`: All sub-checks pass (`status: "healthy"`).
  - `207 Multi-Status` / `200 OK` with degraded flag: Non-critical issue (e.g. backup is 30 hours old).
  - `503 Service Unavailable`: Critical dependency down (database unreachable).

[Back to Top / Table of Contents](#table-of-contents)

---

## 4. Central Monitoring Dashboard Options

### Option A: Lightweight SaaS Aggregator (Low-Code / Fastest MVP)
- **Tooling:** **BetterStack** (formerly Better Uptime) + **Grafana Cloud Free Tier**.
- **How It Works:**
  1. Add each client's `/api/health` URL to BetterStack.
  2. BetterStack pings each instance every 30 or 60 seconds from multiple worldwide locations.
  3. Validates the JSON response asserting `"status": "healthy"`.
  4. Generates an instant, unified **Public or Private Status Dashboard** showing all tenants on a single screen.
  5. Sends instant push notifications via SMS, WhatsApp, or Slack if any tenant goes down.
- **Cost:** Free up to 10 monitors; ~$24/mo for advanced alerting and on-call schedules.
- **Time to Deploy:** 30 minutes.

---

### Option B: Custom Internal Ops Portal (Full Control)
- **Tooling:** Lightweight Next.js or React + Tailwind Admin panel hosted on Cloudflare Pages / Vercel.
- **How It Works:**
  1. **Config-Driven Fleet Directory:** A simple encrypted config/database listing all tenants:
     ```json
     [
       { "id": "etaniv", "name": "אתניב בע\"מ", "url": "https://api.etaniv.co.il", "tier": "standard" },
       { "id": "shaked", "name": "שקד עבודות עפר", "url": "https://api.shaked-erp.co.il", "tier": "premium" }
     ]
     ```
  2. **Cron Poller:** A serverless edge cron job (e.g. Cloudflare Worker or AWS Lambda) pings all URLs every 2 minutes and caches historical results into a small SQLite (Turso) or Redis store.
  3. **Visual Grid:** Renders interactive cards for each tenant:
     - Real-time status badge (🟢 Operational, 🟡 Degraded, 🔴 Down).
     - Running application version vs. latest available version in git.
     - Database connection pool pressure.
     - Last verified 7-year cold backup timestamp.
     - 1-click links to Render console, Sentry logs, and production frontend.

[Back to Top / Table of Contents](#table-of-contents)

---

## 5. Telemetry, Error APM & Fleet Logs

1. **Centralized Sentry Organization:**
   - Single Sentry account with dedicated projects per client:
     - `etaniv-backend` / `etaniv-frontend`
     - `clientb-backend` / `clientb-frontend`
   - Sentry’s Cross-Project Dashboard displays total error volume across the entire fleet in one view.
2. **Log Drains to Datadog / Axiom / BetterStack Logs:**
   - Render supports **Log Drains** (streaming `stdout`/`stderr` over Syslog/HTTPS).
   - Route all customer logs to a single log aggregator (e.g., **Axiom** or **BetterStack Logs**) tagging each log entry with `tenant: etaniv`.
   - You can query logs across all customers simultaneously using queries like: `status:500 OR level:error`.

[Back to Top / Table of Contents](#table-of-contents)

---

## 6. Automated Fleet Maintenance & Security Patching Pipeline

Managing software updates across N independent single-tenant instances is automated using the **Upstream Git Template Pattern**:

```
                       [ Upstream Core Template ]
                   (github.com/YourOrg/erp-core-app)
                                   │
              ┌────────────────────┴────────────────────┐
              ▼                                         ▼
   [ Customer A Fork ]                       [ Customer B Fork ]
(github.com/YourOrg/etaniv-app)           (github.com/YourOrg/clientb-app)
   • Branch: `main`                          • Branch: `main`
   • Render Webhook (Auto-Deploy)            • Render Webhook (Auto-Deploy)
```

1. **Automated Dependency Updates (Dependabot / Renovate):**
   - Configured in the core template to monitor security vulnerabilities (CVEs) across `package.json` dependencies.
2. **Fleet Upgrade Dispatcher (GitHub Actions Workflow):**
   - When a new core release or critical patch is tagged in `erp-core-app` (e.g., `v1.5.0`):
   - A GitHub Actions workflow automatically opens a pull request (or auto-merges for trusted patch releases) into all customer forks (`etaniv-app`, `clientb-app`).
   - Render’s auto-deploy trigger receives the GitHub commit, rebuilds the Docker container, and runs `prisma migrate deploy` automatically.

[Back to Top / Table of Contents](#table-of-contents)

---

## 7. Step-by-Step Implementation Roadmap

| Phase | Milestone | Deliverables & Actions | Timeline |
|---|---|---|---|
| **Phase 1** | **Standardize Health Contract** | • Implement `/api/health` in `server/src/modules/health/health.routes.ts`.<br/>• Include DB latency check, version string, and uptime metrics. | Day 1 |
| **Phase 2** | **Centralized Uptime Monitoring** | • Setup BetterStack or UptimeRobot account.<br/>• Configure 60s probe for `api.etaniv.co.il/api/health`.<br/>• Setup SMS/WhatsApp alerts for downtime. | Day 2 |
| **Phase 3** | **APM & Error Tracking** | • Setup Sentry organization with project `etaniv-prod`.<br/>• Inject `SENTRY_DSN` into Render environment variables.<br/>• Verify error capturing and source maps. | Day 3 |
| **Phase 4** | **Cold Backup Verification** | • Integrate nightly `pg_dump` cron to Cloudflare R2 / AWS S3.<br/>• Add backup status check into `/api/health`. | Day 4 |
| **Phase 5** | **Custom Fleet Portal (When N ≥ 3)** | • Build lightweight Next.js / Cloudflare Pages dashboard.<br/>• Display real-time status matrix across all active contractor clients. | Milestone (3+ Clients) |

[Back to Top / Table of Contents](#table-of-contents)
