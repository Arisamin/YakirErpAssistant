# Cloudflare Pages Deployment & Subdomain DNS Setup Guide

This guide details how to deploy Yakir's HTML POC to **Cloudflare Pages (100% Free Tier)** and configure a dedicated subdomain under his existing domain with zero disruption to his active WordPress/Elementor site.

---

## 1. Why Cloudflare Pages?
- **100% Free Forever:** Unlimited bandwidth, 500 builds/month, and free global CDN distribution.
- **Automated SSL/TLS:** Free HTTPS certificates generated and renewed automatically.
- **Zero Server Maintenance:** Pure serverless static asset delivery with zero server configuration.

---

## 2. Step 1: Deploying the HTML App to Cloudflare Pages

### Option A: Via GitHub Integration (Recommended)
1. Log in to [dash.cloudflare.com](https://dash.cloudflare.com).
2. Navigate to **Workers & Pages** in the left sidebar $\rightarrow$ Click **Create application** $\rightarrow$ Select the **Pages** tab.
3. Click **Connect to Git** and authorize your GitHub account.
4. Select the repository: `Arisamin/YakirErpAssistant`.
5. Configure the deployment settings:
   - **Project Name:** `yakir-erp-assistant` (or your choice).
   - **Production Branch:** `main`.
   - **Framework Preset:** `None` (Static HTML/JS).
   - **Build Command:** *(Leave empty)*.
   - **Build Output Directory:** `/` (or directory containing `index.html`).
6. Click **Save and Deploy**.
7. Cloudflare will build the site and provide a permanent free subdomain:
   `https://yakir-erp-assistant.pages.dev`

### Option B: Direct Folder Upload (Alternative)
1. In Cloudflare Pages, select **Direct Upload**.
2. Drag and drop the folder containing `index.html` and assets.
3. The app is live instantly.

---

## 3. Step 2: Configuring the Custom Subdomain in Cloudflare

1. Inside your Cloudflare Pages dashboard, select your project (`yakir-erp-assistant`).
2. Go to the **Custom domains** tab $\rightarrow$ Click **Set up a custom domain**.
3. Type the desired subdomain address:
   `erp.yakir-company.co.il` (or `invoices.yakir-company.co.il`).
4. Click **Continue**.
5. Cloudflare will display the DNS instructions:
   - Target CNAME: `yakir-erp-assistant.pages.dev`.

---

## 4. Step 3: Adding the CNAME Record at Yakir's Domain Registrar

Log into the DNS control panel where Yakir's domain is managed (e.g., LiveDNS, DomainTheNet, Box.co.il, cPanel, or uPress):

1. Open the **DNS Management / DNS Zone Editor** for Yakir's domain.
2. Add a new DNS record with the following exact parameters:
   - **Record Type:** `CNAME`
   - **Name / Host:** `erp` (do not type the full domain name if the control panel auto-appends it).
   - **Value / Destination / Target:** `yakir-erp-assistant.pages.dev`
   - **TTL:** `3600` (or `Automatic`).
3. Click **Save / Add Record**.

---

## 5. Safety & Isolation Verification

- **WordPress Site Untouched:** Because the CNAME record is applied strictly to the `erp` host, the root domain (`@`) and `www` continue resolving to his existing WordPress/Elementor web server.
- **SSL Activation:** Within 5–15 minutes of DNS propagation, Cloudflare verifies the CNAME and issues an active SSL certificate.
- **Access:** Employees navigate to `https://erp.yakir-company.co.il` to access the tool.
