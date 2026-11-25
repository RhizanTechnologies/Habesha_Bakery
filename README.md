# 🥖 Habesha Bakery ERP (ሐበሻ ዳቦ ቤት ኢንተርፕራይዝ)

> **Enterprise Multi-Branch Bakery Management System** built with **Next.js 16**, **Express.js**, **Prisma ORM**, and **PostgreSQL**. Designed specifically for Ethiopian bakery operations featuring Central Production Hub & Retail Spoke topology, dual Ethiopian/Gregorian calendars, trilingual localization, facial attendance kiosks, and strict real-time auditability.

---

## 📋 Table of Contents
- [Architecture & Topology](#-architecture--topology)
- [Key Features](#-key-features)
  - [1. Central Hub & Retail Spoke Architecture](#1-central-hub--retail-spoke-architecture)
  - [2. Trilingual & Dual-Calendar Localization](#2-trilingual--dual-calendar-localization)
  - [3. Anti-Tamper Attendance & Tardiness Kiosk](#3-anti-tamper-attendance--tardiness-kiosk)
  - [4. Production & Recipe Conversions](#4-production--recipe-conversions)
  - [5. Sales, POS & Cashier Sessions](#5-sales-pos--cashier-sessions)
  - [6. Inter-Branch Logistics & Transfers](#6-inter-branch-logistics--transfers)
  - [7. Financial Management & Payroll](#7-financial-management--payroll)
  - [8. Custom Roles & Privilege Matrix](#8-custom-roles--privilege-matrix)
  - [9. Real-time Audio, Haptic & PWA Notifications](#9-real-time-audio-haptic--pwa-notifications)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
- [Environment Configuration](#-environment-configuration)
- [API & Swagger Documentation](#-api--swagger-documentation)
- [License & Credits](#-license--credits)

---

## 🏛 Architecture & Topology

Habesha Bakery ERP implements a **Hub & Spoke** operational model:

```
                          ┌──────────────────────────────┐
                          │   👑 OWNER & ADMIN PORTAL    │
                          │ Enterprise Oversight & Audit │
                          └──────────────┬───────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 │                                               │
                 ▼                                               ▼
  ┌─────────────────────────────┐                 ┌─────────────────────────────┐
  │   🏭 CENTRAL PRODUCTION HUB │                 │   📍 RETAIL SPOKE BRANCH    │
  │ • Raw Material Depot        │                 │ • Finished Goods POS Sales  │
  │ • Dough Baking & Ovens      │ ── Transfers ──▶│ • Shift Register & Closing  │
  │ • Cake & Sambusa Kitchens   │   (Manifests)   │ • Customer Credit Accounts  │
  │ • Inter-Branch Dispatch     │                 │ • No Raw Baking / No Hub Ops│
  └─────────────────────────────┘                 └─────────────────────────────┘
```

- **Production Hub Branches**: House bulk raw stock (Flour, Sugar, Yeast, Oil), record recipe conversions, track oven batches, and dispatch goods.
- **Retail Spoke Branches**: Dedicated exclusively to customer sales, cashier sessions, and receiving inter-branch transfers. Baking and raw ingredient modules are automatically hidden and blocked when operating in a Retail Spoke context.

---

## ✨ Key Features

### 1. Central Hub & Retail Spoke Architecture
- Dynamic branch switching in the navigation header with visual indicators (`🏭 Hub`, `📍 Spoke`, `🌐 All Branches`).
- Automated route guards and privilege filtering prevent spoke branches from generating mock production runs or accessing hub-only depot inventories.
- Contextual warnings guide users back to active transfer manifests when attempting restricted actions on spoke branches.

### 2. Trilingual & Dual-Calendar Localization
- **Trilingual Parity**: Seamless toggling between **Amharic (አማርኛ)**, **Afaan Oromoo**, and **English** across all forms, tables, badges, modals, and tooltips.
- **Ethiopian Calendar Engine**: Built-in bidirectional converter supporting Ethiopian dates (`YYYY-MM-DD` / Pagume 13th month leap handling) alongside standard Gregorian dates.
- Interactive dual-mode date pickers allow cashiers and accountants to filter reports in Ethiopian fiscal months (`መስከረም` through `ጳጉሜን`).

### 3. Anti-Tamper Attendance & Tardiness Kiosk
- **Facial Capture**: Web camera auto-captures a live anti-tamper facial photo upon 1-tap confirmation or PIN entry.
- **Voice Explanation for Tardiness**: Late staff can record a direct voice note (encoded via 32 kbps Opus for minimal payload size) explaining delays to the Owner and Admin.
- **Owner-Configurable Penalty Tiers**:
  - Customizable check-in time windows for Day Shift (`06:00 - 06:30`) and Night Shift (`21:00 - 21:30`).
  - Tiered tardiness penalty rules (`<= 30 min` vs `> 30 min`) automatically calculated upon check-in.
  - Review dashboard for Owners/Admins to approve or waive penalties with linked payroll deductions.
- **Overnight Shift Crossover**: Correctly anchors 21:00 - 06:00 night shift punches across midnight to the active business shift date.

### 4. Production & Recipe Conversions
- **Batch Tracking**: Flour bag tracking, expected vs actual bread yield, dough conversion rates, and defective bread disposal logs.
- **Station-Specific Kitchen Workflows**: Tailored lightweight interfaces for Bakers, Sambusa workers, and Cake decorators.
- **Product Conversions**: Real-time stock transformation pipelines (e.g., converting unsold bread rolls into breadcrumbs or repurposing baked goods).

### 5. Sales, POS & Cashier Sessions
- **Daily Sessions**: Opening drawer float entry, ongoing POS transactions, cash denomination counting, and closing discrepancy analysis.
- **Multi-Method Payments**: Cash, Commercial Bank of Ethiopia (CBE), Telebirr, and Mobile Banking tracking.
- **Customer Credit Accounts**: Customer ledger tracking, credit purchase limits, outstanding debt tracking, and partial cash settlements.

### 6. Inter-Branch Logistics & Transfers
- **Two-Stage Transfer Manifests**:
  1. Origin branch initiates dispatch (quantity, sender, vehicle/delivery person).
  2. Destination branch verifies physical count, accepts intact items, and logs transit breakage/damage.
- Automatic inventory rebalancing between Hub depots and Spoke retail shelves.

### 7. Financial Management & Payroll
- **Expense Categorization**: Segregation of operational expenditures (OPEX) and capital expenditures (CAPEX).
- **Owner Loan Tracking**: Personal injections and drawings with real-time enterprise net balance calculation.
- **Automated Payroll Engine**: Base salary calculation, attendance penalty deductions, loan repayment installments, overtime adjustments, and payslip generation.

### 8. Custom Roles & Privilege Matrix
- Granular permission matrix across 25+ distinct privileges (`access_production`, `access_stock`, `access_transfers`, `manage_users`, etc.).
- Custom role creator supporting bespoke staffing structures beyond standard predefined roles (`OWNER`, `ADMIN`, `BAKER`, `CASHIER`, `CAKE_WORKER`, `SAMBUSA_WORKER`, `STOCK_KEEPER`).

### 9. Real-time Audio, Haptic & PWA Notifications
- **Web Audio API**: Four custom harmonic chime soundscapes (`Caramel Chime`, `Digital Bell`, `Subtle Pop`, `Urgent Alarm`).
- **Mobile Haptics**: Vibration patterns on supported Android and mobile browsers for critical events (stock alerts, transfer arrivals).
- **Progressive Web App (PWA)**: Installable on Android, iOS, and desktop browsers with Web Push support.

---

## 🛠 Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | [Next.js 16](https://nextjs.org/) (App Router, Turbopack), [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/) |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/), [Lucide React](https://lucide.dev/), [Radix UI](https://www.radix-ui.com/) / Base UI, [Sonner](https://sonner.emilkowal.ski/) |
| **Backend API** | [Node.js](https://nodejs.org/), [Express.js](https://expressjs.com/), [TypeScript](https://www.typescriptlang.org/) |
| **Database & ORM** | [PostgreSQL](https://www.postgresql.org/) (via [Prisma ORM](https://www.prisma.io/)) |
| **State & Cache** | In-memory API request cache, Deduplication, Cross-domain mutation invalidation |
| **Media & Audio** | Native Canvas Biometric Capture, HTML5 MediaRecorder (Opus), Web Audio API Synthesizer |
| **API Docs** | [Swagger / OpenAPI](https://swagger.io/) (`/api-docs`) |

---

## 📁 Project Structure

```
bakery-erp/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # Database schema (Models, Enums, Relations)
│   │   └── seed.ts                # Database seeder (Demo Hub, Spoke, Users, Products)
│   ├── src/
│   │   ├── app.ts                 # Express application configuration & middlewares
│   │   ├── index.ts               # Server entry point (Default: Port 3001)
│   │   ├── middleware/            # Auth, Tenant, and Role guards
│   │   ├── modules/               # Domain modules:
│   │   │   ├── admin/             # Branches, Users, Roles & Privilege Matrix
│   │   │   ├── attendance/        # Facial Attendance, Tardiness Penalties, PINs
│   │   │   ├── auth/              # JWT authentication & session management
│   │   │   ├── catalog/           # Products, Categories, Stock Items
│   │   │   ├── customers/         # Customer profiles & credit ledgers
│   │   │   ├── finance/           # Expenses, Loans, Payroll, Penalties
│   │   │   ├── notifications/     # Notification service & preferences
│   │   │   └── production/        # Batches, Recipes, Conversions
│   │   └── lib/                   # Prisma client, storage, business date utilities
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── app/                   # Next.js App Router pages:
│   │   │   ├── attendance/        # Attendance logs & /attendance/kiosk
│   │   │   ├── branches/          # Hub/Spoke branch configuration
│   │   │   ├── daily-sessions/    # Cashier drawer open/close
│   │   │   ├── my-profile/        # Personal salary & penalty records
│   │   │   ├── payroll/           # Payroll processing, loans, penalties
│   │   │   ├── production/        # Kitchen batches & recipe history
│   │   │   ├── products/          # Catalog & pricing
│   │   │   ├── reports/           # Financial P&L statements
│   │   │   ├── stock/             # Inventory counts & movements
│   │   │   ├── transfers/         # Inter-branch transfer manifests
│   │   │   └── users/             # Staff directory & custom roles
│   │   ├── components/            # UI Components, Modals, Navigation
│   │   │   ├── DashboardLayout.tsx# Categorized collapsible sidebar & header
│   │   │   ├── LanguageSelector.tsx
│   │   │   ├── NotificationBell.tsx
│   │   │   └── NotificationSettingsModal.tsx
│   │   ├── context/               # Auth, Branch, Language, Date contexts
│   │   ├── locales/               # am.ts, om.ts, en.ts localization dictionaries
│   │   └── lib/                   # API client, audio synthesizer, Ethiopian calendar
│   └── package.json
│
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.18+ or v20+
- **PostgreSQL**: Local instance or hosted database (e.g., Supabase / Neon)
- **npm** or **yarn** / **pnpm**

---

### Backend Setup

1. **Navigate to the backend directory**:
   ```bash
   cd backend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   Create a `.env` file in `backend/`:
   ```env
   DATABASE_URL="postgresql://postgres:password@localhost:5432/habesha_bakery?schema=public"
   DIRECT_URL="postgresql://postgres:password@localhost:5432/habesha_bakery?schema=public"
   JWT_SECRET="your-super-secret-jwt-key"
   PORT=3001
   CORS_ORIGIN="http://localhost:3000,http://localhost:3005"
   ```

4. **Initialize database schema & seed initial data**:
   ```bash
   npx prisma db push
   npx prisma db seed
   ```

5. **Start the development server**:
   ```bash
   npm run dev
   ```
   *The backend will be running at [http://localhost:3001](http://localhost:3001).*

---

### Frontend Setup

1. **Navigate to the frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   Create a `.env.local` file in `frontend/`:
   ```env
   NEXT_PUBLIC_API_URL="http://localhost:3001/api"
   ```

4. **Start the development server**:
   ```bash
   npx next dev -p 3005
   ```
   *The application will be accessible at [http://localhost:3005](http://localhost:3005).*

---

## 🔑 Default Credentials (Seed Data)

| Role | Phone Number | Password | Assigned Branch |
| :--- | :--- | :--- | :--- |
| **Owner** | `0912345678` | `password123` | *All Branches (Enterprise Access)* |
| **Admin** | `0910000002` | `password123` | Central Hub Branch |
| **Cashier** | `0920000012` | `password123` | Piassa Retail Spoke Branch |
| **Baker** | `0920000011` | `password123` | Central Hub Branch |

---

## 📖 API & Swagger Documentation

Interactive OpenAPI 3.0 documentation is served directly from the backend server:

- **Swagger UI**: [http://localhost:3001/api-docs](http://localhost:3001/api-docs)
- **OpenAPI JSON Spec**: [http://localhost:3001/api-docs.json](http://localhost:3001/api-docs.json)

---

## 📄 License & Credits

Developed for **Habesha Bakery Enterprise** by **Rhizan Technologies**.  
All rights reserved © 2026.
