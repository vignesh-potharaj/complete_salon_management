# SalonPro - Developer & AI Context

This document is designed for AI assistants and developers to quickly understand the structure, architecture, design patterns, and constraints of the **SalonPro Complete Salon Management System**.

---

## 📌 Project Overview
SalonPro is a Progressive Web Application (PWA) built to streamline salon operations (appointments, staff commissions, smart billing, inventory tracking, and client analytics).

* **Frontend Architecture**: Single Page Application (SPA) built with Vanilla HTML5, CSS3, and modern JavaScript (ES6+).
* **Backend Architecture**: RESTful API server built with Node.js, Express.js, and MongoDB (Mongoose ODM).
* **Deployments**: Frontend is deployed to **Vercel** (`cleanUrls: true`); Backend is deployed to **Render**.

---

## 📂 Directory Structure

```text
complete_salon_management/
├── index.html                 # Main App Workspace (SPA containing all modules)
├── landing.html               # Public Marketing & PWA Installation Landing Page
├── login.html                 # Login page with security OTP entry flow
├── register.html              # Registration and Email Verification page
├── api.js                     # Global API helper (fetch wrapper & auth check)
├── script.js                  # Frontend Application Logic (SPA router & rendering)
├── style.css                  # Core design system & layout styling
├── clients.css / dashboard.css / reports.css # Module-specific stylesheets
├── manifest.json              # PWA manifest
├── serviceWorker.js           # PWA offline cache controller
├── vercel.json                # Vercel SPA routing configurations
└── salon-backend/             # Express.js REST API
    ├── server.js              # Server entry point & CORS configuration
    ├── db.js                  # MongoDB connection helper
    ├── emailService.js        # Nodemailer mail transport & fallback logging
    ├── models/                # Mongoose Database Models
    │   ├── User.js            # Salon Owner / Account credentials
    │   ├── Client.js          # CRM details
    │   ├── Appointment.js     # Scheduled visits
    │   ├── Inventory.js       # Product stocks
    │   ├── Staff.js           # Staff members & commission rules
    │   └── Bill.js            # Generated invoices
    ├── routes/                # Express API Route Handlers
    │   └── auth.js, clients.js, appointments.js, etc.
    └── middleware/            # JWT validation and Rate Limiters
```

---

## 💻 Frontend Architecture Patterns

### 1. SPA Section Navigation
Instead of multi-page loading, `index.html` contains all layout containers (e.g. Dashboard, Calendar, Checkout, Reports). Navigation switches visibility by adding/removing the `.section-hidden` class:
* The active view is updated using `showSection(id)` defined in `script.js`.
* State is preserved locally without re-rendering unnecessary DOM structures.

### 2. Authentication & API Requests
* JWT tokens are saved in `localStorage.token`.
* `api.js` provides a global `api(path, options)` wrapper:
  * Automatically injects `Authorization: Bearer <token>`.
  * Triggers an automatic client-side logout (`api.js#logout()`) if the backend returns a `401 Unauthorized` status.

### 3. PWA Installation Flow
* Standard PWA setup uses `serviceWorker.js` to cache key files (`index.html`, `style.css`, `script.js`).
* `landing.html` detects PWA capability via the `beforeinstallprompt` event and shows a **"One-Click Install"** button. If unsupported, it displays a step-by-step PWA fallback guide for iOS and Android.

---

## 🗄️ Database Schemas (Mongoose)

* **User**: `userId` (unique slug), `email`, `name`, `salonName`, `passwordHash`, `isEmailVerified`, `emailVerifyCode`, `resetPasswordCode`.
* **Client**: `name`, `phone`, `email`, `notes`, `salonOwnerId` (links to User).
* **Staff**: `name`, `phone`, `specialty`, `commissionRate` (percentage), `status` (active/inactive), `salonOwnerId`.
* **Inventory**: `name`, `sku`, `stock`, `minStock`, `price`, `supplier`, `salonOwnerId`.
* **Appointment**: `clientName`, `clientPhone`, `staffId` (Ref Staff), `services` (array of service strings), `date`, `time`, `duration`, `status` (scheduled/completed/cancelled), `salonOwnerId`.
* **Bill**: `billNumber`, `clientName`, `clientPhone`, `lineItems` (items, services, price, quantity), `taxAmount`, `discountAmount`, `grandTotal`, `paymentMethod` (cash/card/upi), `staffCommissions` (calculated payouts), `deleted` (boolean flag for VOID status), `salonOwnerId`.

---

## ⚠️ Key Architectural Constraints & Quirks

### 1. Render SMTP Block & Email Fallback
* **Problem**: Render blocks outgoing SMTP ports (25, 465, 587) on free accounts, causing Nodemailer SMTP attempts to hang and timeout after 2 minutes.
* **Workaround (in `emailService.js`)**:
  * SMTP connection and socket timeouts are limited to **4 seconds** (`connectionTimeout: 4000`, `socketTimeout: 4000`).
  * If the connection fails, it catches the error and outputs OTP/reset codes to the server logs:
    `🔑 [FALLBACK LOG] Verification Code for email@domain.com: XXXXXX`
  * This prevents API endpoints from hanging and keeps requests fast.

### 2. APK Distribution Warning
* **Warning**: Direct hosting of self-compiled, unsigned `.apk` files on the website root causes Google Safe Browsing to flag the domain as **"Dangerous / Deceptive Site"**. 
* **Fix**: Do **not** host `app.apk` on the web root. Use the PWA installation buttons in `landing.html` for Android, Windows, and iOS setups.

### 3. Print Settings
* In `script.js`, PDF exports and receipts utilize `html2pdf.bundle.min.js`. The DOM utilizes `@media print` CSS rules to hide control interfaces (`.no-print`) and format clean billing receipts.
