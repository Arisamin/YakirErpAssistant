# Yakir's Operational Reality & Infrastructure Deployment Guide

This guide details two critical operational facets for the project:
1. **The Human & Operational Reality:** How Yakir's non-tech business operates manually today vs. how the new system will keep workflows dead-simple and familiar.
2. **Infrastructure, Platforms & Cost Breakdown:** Exactly what accounts Yakir must open, monthly SaaS/cloud costs, and physical office assets required.

---

## 1. How Yakir Probably Operates Today (The Manual Reality)

Yakir runs a traditional, non-hitech small business in Israel (e.g., contracting, wholesale trade, technical services, or distribution). His team consists of practical, non-technical people who are comfortable with physical paper, WhatsApp, and their existing Windows desktop routines.

### A. The End-to-End Paper & Hand-off Pipeline

```
[Field Worker / Yossi]
  • Receives crumpled paper tax invoice at supplier checkout.
  • Stuffs it into car glove compartment or wallet.
  • Once a week, dumps a stack of crumpled receipts on Dan's desk.
           │
           ▼
[Office / Operations Manager / Dan]
  • Manually sorts through paper receipts by vendor and date.
  • Checks against physical delivery notes (תעודות משלוח).
  • Stamps each paper with a physical rubber ink stamp ("נבדק ואושר לתשלום").
  • Hands the approved physical stack to Yakir and Sarah.
           │
           ▼
[Yakir & Sarah at the Hashavshevet Terminal]
  • Sit together at the office Windows PC running Hashavshevet ERP.
  • Manually feeding invoices one-by-one into the "תנועות יומן" screen.
  • Searching account cards, calculating VAT, typing reference numbers.
           │
           ▼
[Storage & Archiving]
  • Punches two holes in every paper invoice.
  • Files it into heavy cardboard lever-arch binders (קלסרי דפדפת) on office shelves.
  • By Israeli tax law, Yakir must store these dusty binders for 7 full years!
```

---

### B. Inside Hashavshevet: How Yakir and Sarah Manually Feed Invoices Today

To understand why Yakir is desperate to automate this, look at what happens **on the Hashavshevet screen** for every single invoice:

1. **Opening Hashavshevet (חשבשבת חלונות):**
   - Yakir or Sarah logs into the legacy Hashavshevet Windows desktop client on the office workstation.
   - Navigates through the Hebrew menu: **הנהלת חשבונות -> פקודות יומן (Journal Entries)**.
   - Selects an open working batch: **בחירת מנה (Select Batch)** (e.g., Batch 42).

2. **Step-by-Step Data Entry for Each Invoice:**
   - **Row Type (סוג תנועה):** Types `00` (Standard Journal Entry) using keyboard numpad.
   - **Reference / Invoice # (אסמכתא):** Reads the printed paper and types the external invoice number (e.g. `8841`).
   - **Reference Date (תאריך אסמכתא):** Types 6 digits without slashes (e.g. `251026` for 25/10/2026).
   - **Value / Due Date (תאריך ערך):** Types payment due date (e.g. `301126`).
   - **Debit Account Key (מפתח חשבון חובה - הוצאה):** Must remember or look up the 5-digit expense code (e.g., `40210` for Tools & Equipment). If forgotten, hits `F9` to open a slow lookup search window across hundreds of accounts.
   - **Credit Account Key (מפתח חשבון זכות - ספק):** Must find the supplier's card (e.g., `30082 - טכנו כלים`). 
     - *The New Vendor Bottleneck:* If it is a new supplier, the workflow grinds to a halt! Sarah must pause data entry, open **"הגדרות חשבונות -> פתיחת כרטיס חשבון"**, type the supplier's 9-digit Israeli Tax ID (*ח.פ.*), business name, address, payment terms, and withholding tax rate (*ניכוי מס במקור*), and only then return to the invoice.
   - **Calculating & Splitting the 17% VAT (מע"מ תשומות):**
     - Hashavshevet requires the transaction to balance down to the exact Agora (0.01 ₪).
     - Sarah punches the numbers on her physical desk calculator: Total `1,170.00` / `1.17` = `1,000.00` net, `170.00` VAT.
     - Types `1,000.00` on the expense line, `170.00` to account `20000` (Input VAT), and `1,170.00` to the supplier card.
   - **Description (פרטים):** Types Hebrew text: "רכש מקדחה ופטישון לגבעתיים".
   - **Validating & Saving (Enter / שמירה):** Hashavshevet verifies that $\text{Debit} = \text{Credit}$. If a single digit was mistyped, Hashavshevet beeps with an error: *"פקודה לא מאוזנת!"* (Unbalanced Entry), forcing Sarah to re-calculate and re-check.

3. **Batch Posting (קליטת מנה):**
   - After typing 50 to 100 invoices one-by-one for several hours, Sarah/Yakir runs **קליטת מנה (Post Batch)** to commit them into the General Ledger (*ספר ראשי*).
   - Any typo in a supplier's *ח.פ.* or invoice number isn't discovered until the monthly VAT filing (*דוח מע"מ PCN874*), causing audit headaches and frantic corrections.

---

### C. Core Pain Points in Yakir's Current Setup:
1. **Lost & Illegible Receipts:** Receipts fade in car heat or get lost, causing Yakir to lose thousands of shekels in unclaimed Input VAT (*מע"מ תשומות*).
2. **Extreme Labor Waste (3 People Involved):** Yossi spends time delivering paper, Dan spends hours checking and stamping paper, and Yakir & Sarah spend hours typing into Hashavshevet.
3. **Typo & Regulatory Risk:** If Sarah mistypes an invoice number or vendor ID in Hashavshevet, the Israeli Tax Authority rejects the VAT report (*דוח מע"מ PCN874*).
4. **The Invoicing Law Bottleneck:** Starting 2024–2026, invoices above government thresholds require an official Israeli allocation number (*מספר הקצאה*). Manually verifying and typing this 9-digit/UUID code into Hashavshevet is grueling and error-prone.

---

## 2. How Yakir Expects to Work with the New System (The Frictionless Digital Transition)

Yakir and his employees do **not** want a complicated enterprise system with 50 settings menus. They want something that mirrors their natural, simple habits:

```
+--------------------------------------------------------------------------------+
|              THE SIMPLIFIED USER EXPERIENCE FOR YAKIR'S TEAM                   |
+--------------------------------------------------------------------------------+
| 1. Field Worker (Yossi):                                                       |
|    • Logs into a web page with large buttons.                                  |
|    • Drags & drops the PDF/scanned image into a large box:                     |
|      "גרור חשבונית לכאן" (Drag Invoice Here).                                  |
|    • Types a 3-word note: "מקדחה לפרויקט גבעתיים".                             |
|    • Done! No accounting knowledge required.                                   |
+--------------------------------------------------------------------------------+
| 2. Operations Lead (Dan):                                                      |
|    • Sees a clean list of pending invoices (looks like an email inbox).        |
|    • Clicks an invoice -> Sees the receipt image preview.                      |
|    • Clicks a big green button: "אשר הוצאה" (Approve) or red "דחה" (Reject).  |
|    • Done!                                                                     |
+--------------------------------------------------------------------------------+
| 3. Bookkeeper (Sarah):                                                         |
|    • Opens "אימות חשבונות" (Account Verification).                             |
|    • All fields are ALREADY typed and pre-filled by the AI:                    |
|      - Supplier Name & Tax ID (ח.פ.) verified with green checkmark             |
|      - 17% VAT calculated automatically and checked                            |
|      - Expense Account Key (חשבון הוצאה) pre-selected based on history        |
|    • Sarah simply verifies and clicks "שגר לחשבשבת" (Push to Hashavshevet).   |
+--------------------------------------------------------------------------------+
| 4. Owner / CEO (Yakir):                                                        |
|    • Opens his dashboard on any browser (home or office).                      |
|    • Sees total monthly expenses, pending invoices, and VAT reclaim amounts.   |
|    • Full audit trail with zero paper clutter on his desk.                     |
+--------------------------------------------------------------------------------+
```

---

## 3. Required Accounts, Cloud Platforms & Services

To deploy and run this web platform, Yakir will need to register and open accounts in the following external platforms:

### A. Cloud Hosting & Backend Infrastructure
| Platform | Purpose | Recommended Choice | Estimated Monthly Cost |
|---|---|---|---|
| **Application Hosting** | Hosts the Web Frontend (Next.js/React) and Backend REST API server. | **Render.com** or **DigitalOcean App Platform** *(very simple for non-devops)* | **$7 – $20 / month** (~25 – 75 ₪) |
| **Managed Database** | Relational DB storing users, invoices, mappings, audit trails. | **Supabase** (Managed PostgreSQL) or **Neon.tech** | **$0 – $25 / month** (Free tier covers initial volume) |
| **Encrypted File Storage** | Secure cloud storage for original scanned PDFs & invoice images. | **Cloudflare R2** or **AWS S3** | **$1 – $5 / month** *(Cloudflare R2 has zero data transfer fees)* |
| **Domain & SSL Certificate** | Company web address (e.g., `erp.yakir-biz.co.il`). | **Reuse Yakir's Existing Domain** via Subdomain CNAME record (WordPress site remains 100% untouched). | **0 ₪ (Free)** |

---

### B. AI & Israeli OCR Vision Services
| Platform | Purpose | How It Works & Cost Structure | Estimated Monthly Cost |
|---|---|---|---|
| **OpenAI API** or **Anthropic Claude API** | Multimodal Vision model extracts Hebrew text, tables, VAT amounts, and Israeli tax IDs. | Pay-per-document: ~$0.015 per invoice page processed. | For 500 invoices/month: **~$7.50 – $15 / month** (~30 – 60 ₪) |

---

### C. Hashavshevet (חשבשבת) Integration Options
| Integration Method | Role in System | Licensing Requirement | Extra Cost? |
|---|---|---|---|
| **Option 2: Native Movein Interface (`MOVIN.DOC`)** | **PRIMARY (Phase 1)** | Built into **every copy of Hashavshevet** since 1995. Sarah downloads file and imports with 1 click. | **0 ₪ (100% Free)**. Zero changes to Hashavshevet contract. |
| **Option 1: H-Connect REST API** | **FUTURE UPGRADE (Phase 2)** | Requires Hashavshevet's official API module (`H-Connect`) enabled on Yakir's Hashavshevet license for direct cloud-to-ERP transmission. | Contact Hilan/Hashavshevet sales (one-time or monthly add-on fee). |

---

## 4. Physical Assets & Office Hardware Yakir Must Maintain

Because Yakir operates a non-hitech small business, he does not need expensive servers or IT racks in his office. Here is the minimal physical footprint:

```
+--------------------------------------------------------------------------------+
|                     PHYSICAL ASSETS IN YAKIR'S OFFICE                          |
+---------------------+-----------------------------------+----------------------+
| Hardware Asset      | Specification / Recommendation    | Purpose / Role       |
+---------------------+-----------------------------------+----------------------+
| 1. High-Speed Paper | **Fujitsu ScanSnap iX1600** or    | Employees place a    |
|    Document Scanner | **Brother ADS-2800W**             | stack of 30 paper    |
|    (סורק מסמכים שולחני)| (~1,800 – 2,400 ₪ one-time)    | receipts into feeder |
|                     | Multi-page automatic feeder (ADF) | -> 1 click scans to  |
|                     | Scans double-sided at 40 ppm      | PDF folder.          |
+---------------------+-----------------------------------+----------------------+
| 2. Existing Office  | Standard Windows 10/11 PCs        | Used by Dan, Sarah,  |
|    Workstations     | Running Google Chrome or MS Edge  | and Yossi to access  |
|                     |                                   | the web dashboard.   |
+---------------------+-----------------------------------+----------------------+
| 3. Existing Machine | Yakir's existing Windows PC/Server| The local machine    |
|    Running          | that already has Hashavshevet     | where Hashavshevet   |
|    Hashavshevet     | installed and running.            | receives the batches.|
+---------------------+-----------------------------------+----------------------+
```

---

## 5. Summary of Total Operating Costs

| Item | One-Time Setup Cost | Ongoing Monthly Cost |
|---|---|---|
| **Office High-Speed Scanner** | ~1,800 – 2,200 ₪ (optional if they already have one) | 0 ₪ |
| **Israeli Domain Name (.co.il)** | ~70 ₪ / year | ~6 ₪ / month |
| **Cloud Hosting (Web App + API)** | 0 ₪ | ~$15 / month (~55 ₪) |
| **Database (PostgreSQL)** | 0 ₪ | ~$0 – $15 / month (~0 – 55 ₪) |
| **Cloud Storage (Cloudflare R2)** | 0 ₪ | ~$2 / month (~8 ₪) |
| **AI Vision & Extraction (500 inv/mo)** | 0 ₪ | ~$12 / month (~45 ₪) |
| **TOTAL ONGOING RUNNING COST** | — | **~$30 – $50 / month (110 – 190 ₪ / month)** |

### Bottom Line for Yakir:
For **less than 200 ₪ per month**, Yakir completely eliminates the hours spent by 3 employees on manual sorting, paper binder punching, calculator checking, and manual Hashavshevet typing, while achieving 100% digital compliance.
