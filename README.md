# SnackzTin — Artisanal Confections, Snacks & Treats

A full-stack, mobile-first, responsive E-commerce web application with **Dynamic Branding**, **Full Admin Portal with Mobile Drawer**, **PostgreSQL-backed WhatsApp Queue**, and **Continuous Deployment on Firebase & Render**.

- 🌐 **Live Storefront (Firebase)**: [https://snackztin.web.app](https://snackztin.web.app)
- ⚙️ **Live Admin Portal**: [https://snackztin.web.app/admin](https://snackztin.web.app/admin)
- 📦 **GitHub Repository**: [https://github.com/Stephen4123/snackztin](https://github.com/Stephen4123/snackztin)
- 🚀 **Backend Deployment**: Render Blueprint (`render.yaml`)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Stephen4123/snackztin)

---

## 🌟 Key Features

### 1. Dynamic Branding Everywhere
- **Brand name and logo are dynamic**: Change brand name, tagline, announcement banner, and custom brand logo directly in the **Admin Portal** (`/admin` &rarr; Store & Branding Settings).
- Real-time updates reflect across the storefront navbar, footer, cart drawer, checkout modal, tracking, browser favicon, and page titles.

### 2. Modern Product Catalog & Storefront (`index.html`)
- **Product Categories**: Dynamic category pills with custom icons (Chocolates, Barks, Truffles, Snacks & Treats, Gift Boxes).
- **Clean URLs**: Direct product page links at `/product/:id` with instant scrolling, breadcrumbs, high-res gallery, and variant selectors.
- **Stock Urgency & Badges**: Real-time stock counters ("Only 1 left!"), dietary badges (🟢 Veg), cocoa percentage, and discount calculations.
- **Interactive Cart & Free Delivery Progress Bar**: Live progress tracking toward free shipping.
- **Personalized Gift Note**: Add custom gift messages to orders.

### 3. Reliable PostgreSQL WhatsApp Queueing System
- **Offline & Disconnection Resilient**: When WhatsApp client is disconnected, messages are stored in PostgreSQL (`messages` table with `sent = false`).
- **Sequential FIFO Queue Processor**: Background worker sends pending messages with a safe 1.5s delay to prevent rate limits.
- **Auto Reconnection Dispatch**: Reconnection immediately flushes pending messages in exact chronological order.
- **Auto-Cleanup**: Successfully sent messages are marked `sent = true` and purged automatically to keep database lean.
- **Direct WhatsApp Checkout**: Formats orders with clean product links and customer details for 1-click submission.

### 4. Responsive Admin Management Portal (`admin.html`)
- **Mobile-Responsive Drawer Navigation**: Clean hamburger slide-out drawer on smartphones and tablets, fixed sleek sidebar on desktop.
- **1-Click Instant Demo Login**: Test admin features immediately or use registered credentials.
- **Live KPI Analytics Snapshot**: Total revenue (₹), order counts, listed products, and low-stock alerts.
- **Full Products & Categories CRUD**: Manage products, categories, variants, and image uploads.
- **WhatsApp Web Management**: QR code scanner for Baileys session pairing, connection status monitor, and queue health inspector.

---

## 🛠️ Technology Stack

- **Frontend**: HTML5, Tailwind CSS, Vanilla JavaScript (ES6+), Font: *Playfair Display* & *Inter*
- **Hosting**: Firebase Hosting (`https://snackztin.web.app`)
- **Backend**: Node.js & Express.js
- **Database**: PostgreSQL (Neon Serverless PostgreSQL with SSL)
- **WhatsApp Web Engine**: `@whiskeysockets/baileys` with persistent PostgreSQL session auth
- **Backend Cloud**: Render Web Service (`snackztin-backend.onrender.com`)

---

## 🚀 Deployment

### 1. Frontend (Firebase Hosting)
The frontend is deployed to Firebase Hosting site `snackztin` with clean URLs and SPA rewrites:
```bash
firebase deploy --only hosting
```
URL: [https://snackztin.web.app](https://snackztin.web.app)

### 2. Backend (Render)
Click the button below to deploy the backend on Render via Blueprint:

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Stephen4123/snackztin)

Or in the [Render Dashboard](https://dashboard.render.com):
1. Click **New +** &rarr; **Blueprint**.
2. Connect repository **`Stephen4123/snackztin`**.
3. Render automatically provisions the web service using [`render.yaml`](render.yaml).

---

## 💻 Local Development

1. Clone repository:
   ```bash
   git clone https://github.com/Stephen4123/snackztin.git
   cd snackztin
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Seed database:
   ```bash
   npm run seed
   ```

4. Start development server:
   ```bash
   npm start
   ```

5. Access locally:
   - Storefront: `http://localhost:3001`
   - Admin Portal: `http://localhost:3001/admin`
