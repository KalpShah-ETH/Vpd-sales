# VPD Order System Implementation Plan

## Goal Description
VPD requires a system to streamline orders between a network of 5000+ retailers and 18-20 salesmen representing different pharma companies. We are replacing a chaotic, manual WhatsApp group process with a structured web app.
Salesmen maintain their stock catalogues on their own dashboard. Retailers browse stocks on a clean, mobile-first UI and place orders. The app will:
1. Save the order to the database.
2. Route the retailer to the salesman's personal WhatsApp via a pre-filled `wa.me` message for immediate execution.
3. Authenticate retailers securely and silently using private links with embedded JWT tokens.

---

## User Review Required

> [!IMPORTANT]
> **Database Config**: We are configuring Prisma with **PostgreSQL**. You will need to provide a PostgreSQL database connection string in your `.env` file (`DATABASE_URL`).
> **Secret Key**: A `JWT_SECRET` is needed in `.env` for signing and verifying retailer tokens.
> **No Tailwind CSS**: Following the styling guidelines, we will build a premium vanilla CSS design system in `app/globals.css` with a custom HSL color palette, smooth transitions, and high-performance mobile scaling, completely avoiding Tailwind.

---

## Open Questions

> [!NOTE]
> None at the moment. The requirements are extremely specific and well-defined. I will proceed with the proposed plan, and we can adjust if you have custom design/logic requirements.

---

## Proposed Changes

### Database Layer (Prisma)
We will define the Prisma schema in [schema.prisma](file:///c:/Users/MIS/Desktop/vpd%20order%20system/prisma/schema.prisma) with five models: `Admin`, `Salesman`, `Retailer`, `StockItem`, and `Order`.

#### [NEW] [schema.prisma](file:///c:/Users/MIS/Desktop/vpd%20order%20system/prisma/schema.prisma)
* Models for User Roles:
  * `Admin`: standard login credentials.
  * `Salesman`: name, company name, phone (for WhatsApp routing), username, and password.
  * `Retailer`: shop name, phone, token (unique access), active status.
* Product & Order Models:
  * `StockItem`: name, price, quantity, active/stock status, associated salesman.
  * `Order`: retailer (relation), salesman (relation), stock item (name/price snapshot), quantity, status (`PENDING` or `FULFILLED`), and timestamp.

---

### Project Setup & Configuration
We will initialize a Next.js project with App Router, JavaScript, and NPM, but without default Tailwind configs.

#### [NEW] [package.json](file:///c:/Users/MIS/Desktop/vpd%20order%20system/package.json)
* Setup Next.js, React, Prisma client, JSONWebToken, and cookie helpers.

#### [NEW] [next.config.js](file:///c:/Users/MIS/Desktop/vpd%20order%20system/next.config.js)
* Standard Next.js configuration.

---

### Components & Design System
We will create a responsive, premium CSS-based design system tailored for India's mobile internet conditions (lightweight, rapid rendering, fat-finger-friendly).

#### [NEW] [globals.css](file:///c:/Users/MIS/Desktop/vpd%20order%20system/app/globals.css)
* Custom theme variables: Deep Slate/Indigo palette for dashboard interfaces, Cobalt Blue for call-to-actions, and warning/success states.
* Card layout styles for mobile-first views.
* Touch targets: Minimum 48px height for all actionable elements.

---

### Auth & Middleware
To protect admin, salesman, and retailer routes, we will implement standard cookie-based sessions.

#### [NEW] [middleware.js](file:///c:/Users/MIS/Desktop/vpd%20order%20system/middleware.js)
* Middleware to intercept requests:
  * `/admin/dashboard` requires an active admin session.
  * `/salesman/dashboard` requires an active salesman session.
  * `/browse` requires an active retailer session (set by resolving `/r/[token]`).

---

### API Endpoints (`/app/api/...`)
These endpoints will handle all server-side tasks.

#### [NEW] [admin/login/route.js](file:///c:/Users/MIS/Desktop/vpd%20order%20system/app/api/admin/login/route.js)
* Validates admin credentials, signs session cookie.

#### [NEW] [admin/salesman/route.js](file:///c:/Users/MIS/Desktop/vpd%20order%20system/app/api/admin/salesman/route.js)
* GET: Lists all salesmen.
* POST: Creates a new salesman.
* PUT/DELETE: Edits or deletes salesmen.

#### [NEW] [admin/retailer/route.js](file:///c:/Users/MIS/Desktop/vpd%20order%20system/app/api/admin/retailer/route.js)
* GET: Lists all retailers.
* POST: Allows bulk upload (via JSON/CSV parsing) and single retailer additions. Generates unique tokens/links.

#### [NEW] [salesman/login/route.js](file:///c:/Users/MIS/Desktop/vpd%20order%20system/app/api/salesman/login/route.js)
* Validates salesman credentials, signs session cookie.

#### [NEW] [salesman/stock/route.js](file:///c:/Users/MIS/Desktop/vpd%20order%20system/app/api/salesman/stock/route.js)
* GET: Lists stock for the current logged-in salesman.
* POST/PUT/DELETE: Manages stock items.

#### [NEW] [salesman/orders/route.js](file:///c:/Users/MIS/Desktop/vpd%20order%20system/app/api/salesman/orders/route.js)
* GET: Lists orders received for the logged-in salesman.
* PUT: Marks orders as fulfilled.

#### [NEW] [retailer/browse/route.js](file:///c:/Users/MIS/Desktop/vpd%20order%20system/app/api/retailer/browse/route.js)
* GET: Lists all companies and their stocks for authenticated retailers.

#### [NEW] [retailer/order/route.js](file:///c:/Users/MIS/Desktop/vpd%20order%20system/app/api/retailer/order/route.js)
* POST: Records the order in the database and generates the formatted `wa.me` redirect URL.

---

### UI Pages (`/app/...`)
All pages will be implemented with clean, accessible React components.

#### [NEW] [admin/login/page.jsx](file:///c:/Users/MIS/Desktop/vpd%20order%20system/app/admin/login/page.jsx)
* Admin authentication panel.

#### [NEW] [admin/dashboard/page.jsx](file:///c:/Users/MIS/Desktop/vpd%20order%20system/app/admin/dashboard/page.jsx)
* Tabs for:
  * Salesman management.
  * Retailer CSV/bulk upload.
  * View active orders across the whole system.

#### [NEW] [salesman/login/page.jsx](file:///c:/Users/MIS/Desktop/vpd%20order%20system/app/salesman/login/page.jsx)
* Salesman credentials form.

#### [NEW] [salesman/dashboard/page.jsx](file:///c:/Users/MIS/Desktop/vpd%20order%20system/app/salesman/dashboard/page.jsx)
* Tabs/Panels for:
  * Stock Catalogue (manage items, update prices, change quantities).
  * Orders Feed (list pending/fulfilled orders, mark fulfilled).

#### [NEW] [r/[token]/page.jsx](file:///c:/Users/MIS/Desktop/vpd%20order%20system/app/r/[token]/page.jsx)
* Captures the token, validates it on the server (JWT verification & DB check), sets the retailer cookie, and redirects to `/browse`.

#### [NEW] [browse/page.jsx](file:///c:/Users/MIS/Desktop/vpd%20order%20system/app/browse/page.jsx)
* Dual-state mobile UI:
  * State 1: list of companies (as large, bold cards with initials avatar).
  * State 2 (when company tapped): lists all items for that company.
  * Fully accessible with 48px tap targets, large fonts, and a prominent back button.
  * Stock items display an "ORDER" button. Selecting a quantity and tapping "ORDER" triggers the database write, followed by an immediate redirection to the pre-filled WhatsApp link.

---

## Verification Plan

### Automated Tests
* We will verify the database schema and query structures using Prisma seed scripts and test queries.
* We will run a build command (`npm run build`) to ensure all page structures, client-server bindings, and routes compile cleanly without linting or static analysis errors.

### Manual Verification
* Accessing `/browse` directly to ensure it is correctly blocked for unauthenticated users.
* Simulating the CSV upload of retailers and verifying that the generated tokens/links lead to automatic authentication.
* Tapping the "ORDER" button on a mobile viewport and verifying that the browser opens the correct `wa.me` layout.
* Checking the admin and salesman dashboards to ensure orders are saved correctly in the database in real time.
