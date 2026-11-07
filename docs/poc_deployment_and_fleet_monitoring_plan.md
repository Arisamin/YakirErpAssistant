# Single-Tenant POC Deployment & Fleet Monitoring Implementation Plan

> **Objective:** Deploy a functional, production-ready Proof of Concept (POC) for Tenant #1 (Etaniv B.Y. Ltd.) and establish a centralized Fleet Monitoring Dashboard designed to connect all future customer tenants.  
> **Cost Model:** 100% Free Tier ($0/month) for the POC phase, with an identified minimal paid path ($14/month) for permanent production without instance sleep.

---

## Table of Contents
1. [Cost & Platform Feasibility Analysis](#1-cost--platform-feasibility-analysis)
2. [Target Architecture & Topography](#2-target-architecture--topography)
3. [Component 1: Tenant #1 Database Setup (PostgreSQL)](#3-component-1-tenant-1-database-setup-postgresql)
4. [Component 2: Tenant #1 Backend API Deployment (Docker on Render)](#4-component-2-tenant-1-backend-api-deployment-docker-on-render)
5. [Component 3: Tenant #1 Frontend PWA Deployment (React + Vite)](#5-component-3-tenant-1-frontend-pwa-deployment-react--vite)
6. [Component 4: Central Multi-Tenant Fleet Monitoring Dashboard](#6-component-4-central-multi-tenant-fleet-monitoring-dashboard)
   - [Method A: BetterStack Uptime Aggregator (Zero-Code / Instant)](#method-a-betterstack-uptime-aggregator-zero-code--instant)
   - [Method B: Standalone Web Fleet Console (Custom Edge Dashboard)](#method-b-standalone-web-fleet-console-custom-edge-dashboard)
7. [Operational Verification & Testing Runbook](#7-operational-verification--testing-runbook)

[Back to Top / Table of Contents](#table-of-contents)

---

## 1. Cost & Platform Feasibility Analysis

### 1. 100% Free Tier Stack ($0 / month)
| Component | Provider / Tier | Limitations / Trade-Offs | Real-World Suitability |
|---|---|---|---|
| **Frontend PWA** | Render Static Site or Cloudflare Pages | Free forever. Unlimited bandwidth. Auto SSL. | 100% Production Ready. |
| **Backend API** | Render Free Web Service | Spins down after 15 min of inactivity. Wakes up in ~50s on first request. | Suitable for POC testing. *Pro-tip: BetterStack pings every 3 min prevent sleep.* |
| **Database** | **Neon.tech** (Serverless Postgres) or Render Free DB | Neon offers 0.5 GB permanent storage, zero expiration. Render Free DB expires after 30 days. | **Neon.tech is strongly recommended** for free permanent POC testing. |
| **Monitoring Dashboard** | **BetterStack** (Free Tier) | Free up to 10 monitors. 3-minute check intervals. Email & mobile push alerts. | 100% Production Ready for fleet of 10 clients. |

### 2. Minimal Paid Option ($14 / month per Tenant)
If zero cold-starts and managed Render database snapshots are required:
- **Render Starter Web Service:** $7/month (Always running, 512 MB RAM, 0.5 CPU).
- **Render Basic Postgres:** $7/month (1 GB RAM, 10 GB storage, automated continuous backups).
- **Total:** **$14/month (~50 ₪/mo)** per active customer tenant.

[Back to Top / Table of Contents](#table-of-contents)

---

## 2. Target Architecture & Topography

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                        YOUR CENTRAL OPS MONITORING DASHBOARD ($0 / Free)                               │
│              (BetterStack Status Console OR Standalone Cloudflare Pages Fleet App)                     │
│                                                                                                        │
│   • Multi-Tenant Fleet Grid:                                                                           │
│     ├── [Tenant 1: Etaniv B.Y. Ltd. 🟢 UP (28ms) | v1.4.2 | DB: Connected | Backup: 12h]              │
│     ├── [Tenant 2: Future Contractor B (Ready to link)]                                                │
│     └── [Tenant 3: Future Contractor C (Ready to link)]                                                │
│   • Alerting Channels: Email, Mobile Push Notification, Telegram Bot                                   │
└───────────────────────────────────────────────────┬────────────────────────────────────────────────────┘
                                                    │
                                  Pings /api/health every 60–180s
                                  (Keeps Free Containers Awake)
                                                    │
                                                    ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    TENANT #1: ETANIV POC DEPLOYMENT                                    │
│                                                                                                        │
│   ┌────────────────────────────────┐                             ┌─────────────────────────────────┐   │
│   │   Frontend Static PWA          │   ──── HTTPS / API ────►    │    Docker Express API           │   │
│   │   (Render Static Site)         │                             │    (Render Free Web Service)    │   │
│   │   • React + TypeScript + Vite  │                             │    • Node 22 + Prisma ORM       │   │
│   │   • etaniv-poc-web.onrender.com│                             │    • etaniv-poc-api.onrender.com│   │
│   └────────────────────────────────┘                             └──────────────┬──────────────────┘   │
│                                                                                 │                      │
│                                                                    DATABASE_URL │                      │
│                                                                    (SSL Mode)   │                      │
│                                                                                 ▼                      │
│                                                                  ┌─────────────────────────────────┐   │
│                                                                  │   PostgreSQL 16 Database        │   │
│                                                                  │   (Neon.tech Free Tier)         │   │
│                                                                  │   • 18 relational tables        │   │
│                                                                  │   • 756 real seeded suppliers   │   │
│                                                                  └─────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

[Back to Top / Table of Contents](#table-of-contents)

---

## 3. Component 1: Tenant #1 Database Setup (PostgreSQL)

To avoid Render's 30-day database deletion on free plans, we use **Neon.tech** (free PostgreSQL 16 hosted in AWS Frankfurt, EU region, matching Render's datacenter):

1. **Sign Up:** Go to [Neon.tech](https://neon.tech) and authenticate with GitHub.
2. **Create Project:**
   - **Project Name:** `etaniv-poc`
   - **Postgres Version:** `16`
   - **Region:** `aws-eu-central-1` (Frankfurt)
3. **Capture Connection String:**
   ```text
   postgresql://etaniv_owner:SECRET_PASS@ep-rough-flower-123456.eu-central-1.aws.neon.tech/etaniv_poc?sslmode=require
   ```

[Back to Top / Table of Contents](#table-of-contents)

---

## 4. Component 2: Tenant #1 Backend API Deployment (Docker on Render)

1. **Create Web Service on Render:**
   - Navigate to [dashboard.render.com](https://dashboard.render.com) → **New +** → **Web Service**.
   - Connect the repository containing `etaniv-app_21`.
   - **Name:** `etaniv-poc-api`
   - **Region:** `Frankfurt (EU)`
   - **Root Directory:** `From Yakir/etaniv-app_21/server` (or `server` in dedicated repo).
   - **Runtime:** `Docker` (Dockerfile Path: `./Dockerfile`).
   - **Plan:** `Free`.
2. **Configure Environment Variables:**
   | Variable Name | Value | Purpose |
   |---|---|---|
   | `DATABASE_URL` | *`postgresql://...neon.tech/etaniv_poc?sslmode=require`* | Neon DB Connection |
   | `JWT_ACCESS_SECRET` | *Random 64-char hex string* | Signs 15-minute access tokens |
   | `JWT_REFRESH_SECRET` | *Random 64-char hex string* | Signs 7-day refresh tokens |
   | `NODE_ENV` | `production` | Enables production optimizations |
   | `ADMIN_EMAIL` | `yakir@etaniv.co.il` | Primary admin username |
   | `ADMIN_NAME` | `יקיר אתניב` | Admin profile name |
   | `ADMIN_PASSWORD` | *Temporary strong password* | Initial login password |
   | `CORS_ORIGINS` | `*` *(temporarily, restricted after step 5)* | Allows browser requests |
3. **Database Migration & Seeding:**
   - Once the service deploys, open the **Shell** tab in Render:
     ```bash
     npx prisma migrate deploy
     node dist/prisma/seed.js
     ```
   - *Verification:* The seed script logs the creation of Yakir's admin account, system roles, 756 real suppliers, and 172 customers.
4. **Health Check Verification:**
   - Open in browser: `https://etaniv-poc-api.onrender.com/api/health`
   - Expected Output: `{"status":"ok","time":"2026-11-07T..."}`.

[Back to Top / Table of Contents](#table-of-contents)

---

## 5. Component 3: Tenant #1 Frontend PWA Deployment (React + Vite)

1. **Create Static Site on Render:**
   - In Render Dashboard → **New +** → **Static Site**.
   - Select the repository.
   - **Name:** `etaniv-poc-web`
   - **Root Directory:** `From Yakir/etaniv-app_21/web` (or `web`).
   - **Build Command:** `npm ci && npm run build`
   - **Publish Directory:** `dist`
2. **Set Build Environment Variable:**
   - `VITE_API_URL`: `https://etaniv-poc-api.onrender.com/api`
3. **Configure SPA Rewrite Routing:**
   - In Static Site → **Redirects/Rewrites**:
   - Add rule: `Source: /*` → `Destination: /index.html` → `Action: Rewrite`.
4. **Lock CORS on API:**
   - Return to `etaniv-poc-api` Environment settings and set:
     `CORS_ORIGINS`: `https://etaniv-poc-web.onrender.com`

[Back to Top / Table of Contents](#table-of-contents)

---

## 6. Component 4: Central Multi-Tenant Fleet Monitoring Dashboard

You will create a central monitoring console capable of tracking all tenants, starting with Tenant #1.

### Method A: BetterStack Uptime Aggregator (Zero-Code / Instant)
1. **Create Free Account:** Sign up at [BetterStack.com](https://betterstack.com).
2. **Add Tenant #1 Monitor:**
   - **URL to monitor:** `https://etaniv-poc-api.onrender.com/api/health`
   - **Monitor Name:** `[Tenant 01] אתניב ב.י בע"מ (Etaniv)`
   - **Interval:** 3 minutes (keeps Render free container warm).
   - **Alert Policy:** Alert immediately when status is not 200.
3. **Create Fleet Public/Private Status Page:**
   - In BetterStack → **Status Pages** → New Status Page.
   - Name: **ERP Fleet Operations Console**.
   - Add Tenant #1.
   - As you deploy Tenant #2 (`Contractor B`) and Tenant #3 (`Contractor C`), simply append their `/api/health` URLs to this same page.

---

### Method B: Standalone Web Fleet Console (Custom Edge Dashboard)
For an internal, branded ops tool, deploy a single static dashboard to Cloudflare Pages:
1. **Fleet Directory Configuration (`tenants.json`):**
   ```json
   [
     {
       "id": "tenant-01",
       "name": "אתניב ב.י בע\"מ",
       "contact": "יקיר",
       "apiUrl": "https://etaniv-poc-api.onrender.com/api/health",
       "webUrl": "https://etaniv-poc-web.onrender.com",
       "tier": "POC (Free)"
     }
   ]
   ```
2. **Behavior:**
   - Loads the tenant registry.
   - Pings each `/api/health` endpoint asynchronously via browser `fetch()`.
   - Displays operational cards (🟢 Healthy / 🔴 Down), latency in milliseconds, and direct links to the customer's web app and Render console.

[Back to Top / Table of Contents](#table-of-contents)

---

## 7. Operational Verification & Testing Runbook

| Step | Test Objective | Action | Expected Pass Criteria |
|---|---|---|---|
| **V-1** | **API Health** | Query `GET /api/health` | Returns HTTP 200 with JSON payload. |
| **V-2** | **DB Connectivity** | Attempt login at frontend with `yakir@etaniv.co.il` | JWT token issued, user enters dashboard. |
| **V-3** | **Data Integrity** | Navigate to "חשבוניות ספקים" (Suppliers) | Dropdown contains 756 real suppliers from seed. |
| **V-4** | **Fleet Ping** | Trigger check from BetterStack | BetterStack reports green status, latency recorded. |
| **V-5** | **Failure Alert** | Temporarily suspend Render API service | BetterStack sends alert notification within 3 minutes. |

[Back to Top / Table of Contents](#table-of-contents)
