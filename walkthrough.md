# VPD Order System - MVP Walkthrough & Verification Guide

This document walkthrough guides you through the implementation of the VPD Order System and explains how to verify the MVP locally.

---

## 🛠️ System Architecture & Code Base

Here are the key files and helper modules implemented for the VPD Order System:

1. **Database Schema & ORM**:
   - [schema.prisma](file:///c:/Users/MIS/Desktop/vpd%20order%20system/prisma/schema.prisma): Declares the SQLite/PostgreSQL schema structures for `Admin`, `Salesman`, `Retailer`, `StockItem`, and `Order`.
   - [db.js](file:///c:/Users/MIS/Desktop/vpd%20order%20system/lib/db.js): Implements the connection pooling singleton for Prisma Client.
   - [seed.js](file:///c:/Users/MIS/Desktop/vpd%20order%20system/scripts/seed.js): Seeds the default admin credential.

2. **Authentication Utilities**:
   - [auth.js](file:///c:/Users/MIS/Desktop/vpd%20order%20system/lib/auth.js): Provides helper functions to sign JWTs, set secure HTTP-only cookies, and validate session cookies inside Next.js Server Components.

3. **Global Styling**:
   - [globals.css](file:///c:/Users/MIS/Desktop/vpd%20order%20system/app/globals.css): Declares the custom HSL design system, responsive templates, cards, lists, form elements, status badges, and strict 48px+ tap-target touch limits.

4. **API Handlers (`/app/api/...`)**:
   - [Admin Login](file:///c:/Users/MIS/Desktop/vpd%20order%20system/app/api/admin/login/route.js) | [Salesman Login](file:///c:/Users/MIS/Desktop/vpd%20order%20system/app/api/salesman/login/route.js): Credentials validation and session storage.
   - [Salesman CRUD API](file:///c:/Users/MIS/Desktop/vpd%20order%20system/app/api/admin/salesman/route.js): CRUD interface for salesmen.
   - [Retailer CRUD & Link Gen](file:///c:/Users/MIS/Desktop/vpd%20order%20system/app/api/admin/retailer/route.js): Adds retailers, processes CSV bulk uploads, and issues UUID links.
   - [Retailer Auth & Cookie Redirect](file:///c:/Users/MIS/Desktop/vpd%20order%20system/app/api/retailer/auth/route.js): Authenticates tokens, writes secure session cookies, and redirects.
   - [Salesman Catalogue Management](file:///c:/Users/MIS/Desktop/vpd%20order%20system/app/api/salesman/stock/route.js): Add, edit, remove stock quantities and prices.
   - [Salesman Orders Feed](file:///c:/Users/MIS/Desktop/vpd%20order%20system/app/api/salesman/orders/route.js): Fetch received orders and toggle delivery fulfillment.
   - [Retailer Browse API](file:///c:/Users/MIS/Desktop/vpd%20order%20system/app/api/retailer/browse/route.js): Grouped companies and products retrieval.
   - [Retailer Order Save & Routing API](file:///c:/Users/MIS/Desktop/vpd%20order%20system/app/api/retailer/order/route.js): Records orders in the DB, manages inventory levels, and outputs pre-filled `wa.me` links.

5. **UI Pages & Layouts (`/app/...`)**:
   - [Landing Portal](file:///c:/Users/MIS/Desktop/vpd%20order%20system/app/page.js): Dashboard entrance for admins, salesmen, and instructions for retailers.
   - [Admin Dashboard Page](file:///c:/Users/MIS/Desktop/vpd%20order%20system/app/admin/dashboard/page.jsx) & [Admin Dashboard Client](file:///c:/Users/MIS/Desktop/vpd%20order%20system/app/admin/dashboard/AdminDashboardClient.jsx).
   - [Salesman Dashboard Page](file:///c:/Users/MIS/Desktop/vpd%20order%20system/app/salesman/dashboard/page.jsx) & [Salesman Dashboard Client](file:///c:/Users/MIS/Desktop/vpd%20order%20system/app/salesman/dashboard/SalesmanDashboardClient.jsx).
   - [Retailer Link Entry Point](file:///c:/Users/MIS/Desktop/vpd%20order%20system/app/r/[token]/page.jsx): Redirects URL tokens to the Route Handler.
   - [Retailer Browser Page](file:///c:/Users/MIS/Desktop/vpd%20order%20system/app/browse/page.jsx) | [Retailer Browser Client](file:///c:/Users/MIS/Desktop/vpd%20order%20system/app/browse/RetailerBrowseClient.jsx).

---

## 🤖 Automated Integration Tests

A comprehensive integration test suite is located in [scripts/test-suite.js](file:///c:/Users/MIS/Desktop/vpd%20order%20system/scripts/test-suite.js). 

This script tests the entire system end-to-end against the local server:
1. **Admin Login**: Log in with seeded admin credentials.
2. **Salesman Management**: Create, read, update, and delete salesman catalog owners.
3. **Retailer Link Setup**: Create a retailer and verify unique UUID token generation.
4. **Salesman Portal**: Log in as a salesman, populate stock catalog, and read inventories.
5. **Retailer Entry Point**: Navigate the unique token autologin and receive the cookie session.
6. **Order Placement**: Place an order, verify the pre-filled `wa.me` WhatsApp redirect URL format, and verify inventory decrementation.
7. **Order Fulfillment**: Track the order on the salesman dashboard and mark it as fulfilled.
8. **Admin Logs Activity**: Verify that the order is tracked in the system-wide orders feed.
9. **Cleanup**: Automatically delete test salesmen and retailers to keep the database clean.

To run the automated tests, ensure your dev server is running on `http://localhost:3000` and execute:
```bash
node scripts/test-suite.js
```

---

## 🧪 E2E Manual Verification Flow

To test the system locally, run the development server:
```bash
npm run dev
```

And open `http://localhost:3000` in your web browser. Follow these steps to verify the entire system flow:

### 1. Admin setup & CSV load
1. Navigate to the Admin Portal: `http://localhost:3000/admin/login` (or tap the link on the landing page).
2. Log in with the default credentials:
   - **Username**: `admin`
   - **Password**: `admin123`
3. Tap **Add New Salesman** in the "Salesmen" tab:
   - **Full Name**: `Amit Sharma`
   - **Company Name**: `Apex Pharma`
   - **WhatsApp Phone**: `9876543210` (or your personal number to test WhatsApp routing)
   - **Username**: `amit_apex`
   - **Password**: `amit123`
   - Tap **Save Changes**.
4. Go to the "Retailers" tab and tap **Bulk Upload CSV**:
   - Paste the following test CSV rows:
     ```csv
     Vikas Pharmacy, 9112233445
     Wellness Medicos, 9988776655
     ```
   - Tap **Upload & Generate Links**.
5. You will see both retailers added in the list, each showing a unique URL in the format `http://localhost:3000/r/[some-hex-token]`.
6. Copy the private link for **Vikas Pharmacy** using the **Copy** button.

### 2. Salesman populates inventory
1. Open a new private browsing window or logout and navigate to the Salesman Portal: `http://localhost:3000/salesman/login`.
2. Log in with Amit's credentials:
   - **Username**: `amit_apex`
   - **Password**: `amit123`
3. In the "Stock Catalogue" tab, tap **Add Product**:
   - **Product Name**: `Paracetamol 650mg (Box of 100)`
   - **Unit Price**: `120.00`
   - **Stock Quantity**: `150`
   - Tap **Save Product**.
4. Add a second product:
   - **Product Name**: `Amoxicillin 500mg (Box of 50)`
   - **Unit Price**: `350.00`
   - **Stock Quantity**: `20` (just to test out of stock soon).
   - Tap **Save Product**.

### 3. Retailer accesses link & places order
1. Paste the copied retailer private link for **Vikas Pharmacy** into the browser address bar.
2. The page will load, auto-authenticate, and redirect you straight to the `/browse` catalog without requiring a login screen.
3. You will see **Apex Pharma** listed as a large company card. Tap it.
4. The screen displays the products added by Amit.
5. On `Amoxicillin 500mg`, set the quantity selector to `2` and tap the **ORDER 2 UNITS (WhatsApp)** button.
6. The system will:
   - Save the order to the database.
   - Reduce the stock of Amoxicillin from `20` to `18`.
   - Normalise the phone number to `919876543210` and construct a WhatsApp web link.
   - Redirect your browser tab to WhatsApp Web / App with a pre-filled message:
     *`Hello, I am Vikas Pharmacy. I want to order 2 units of Amoxicillin 500mg (Box of 50) from Apex Pharma. Please confirm and deliver.`*
7. Open the browser tab again and go back to the companies page.

### 4. Salesman processes the order
1. Go back to Amit's Salesman Dashboard (`/salesman/dashboard`).
2. Navigate to the **Orders Received** tab.
3. You will see a new pending order from **Vikas Pharmacy** for `2 units` of `Amoxicillin 500mg`, billing amount `₹700.00`, status `⏳ WhatsApp Message Sent`.
4. Tap the **✓ Mark Delivered** button.
5. The order status updates instantly to `✓ Delivered` in the database, and the billing amount updates the salesman's fulfilled billing tally.

### 5. Admin verification
1. Open the Admin Dashboard (`/admin/dashboard`).
2. Go to the **System Orders Feed** tab.
3. You will see the complete record of the order placed by Vikas Pharmacy for Apex Pharma, with total billing, status (`✓ Delivered & Fulfilled`), and timestamp recorded in real time.
4. Try deactivating the retailer **Vikas Pharmacy** in the "Retailers" tab, and try opening their private link again. The link will correctly block them and print a friendly access denied screen.
