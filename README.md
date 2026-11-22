# ChocoLux — Artisanal Handcrafted Chocolates & Luxury Confections

A full-stack, mobile-first, responsive E-commerce web application with **Dynamic Branding**, **Full Admin Portal**, **Direct & Automated WhatsApp Integrations**, and **PostgreSQL (Neon DB) Storage**.

---

## 🌟 Key Features

### 1. Dynamic Branding Everywhere
- **Brand name is completely dynamic**: By default set to **ChocoLux**, but can be changed at any time directly in the **Admin Portal** (`/admin.html` &rarr; Store & Branding Settings).
- Changing the brand name or tagline immediately updates the website navigation, page titles, footer, meta tags, and generated WhatsApp receipts without touching the code!

### 2. Tailored Chocolate Catalog & Storefront (`index.html`)
- **Rich Categories**: Dark Chocolates (70% - 85%), Creamy Hazelnut & Milk Chocolates, Handcrafted Truffles & Bonbons, Nutty Barks & Clusters, Luxury Gift Hampers, and Sugar-Free/Keto Treats.
- **Variant & Weight Inventory**: Per-variant stock tracking (`100g`, `250g`, `500g`, `Box of 6`, `Box of 12`, `Box of 24`).
- **Dietary & Cocoa Badges**: Green vegetarian dot 🟢, Eggless badges, Cocoa percentage indicators, and ingredients disclosure.
- **Insulated Cold-Box Protection**: Highlights thermal bubble wrapping and ice cooling packs ensuring melt-free delivery across India.
- **Interactive Cart & Free Delivery Bar**: Dynamic progress tracking toward free cold-box delivery threshold (orders above ₹799).
- **Personalized Gift Message**: Customers can append custom gift cards ("Happy Birthday!", "With Love").

### 3. Comprehensive WhatsApp Integrations
- **1-Click Direct "Order on WhatsApp"**: Product cards and modal detail pages pre-format instant inquiries with product name, selected weight/variant, and price.
- **Dedicated WhatsApp Checkout Workflow**: Captures customer name, phone, delivery address, calculates total, saves order in PostgreSQL, and launches WhatsApp with a pre-formatted receipt to the store's official WhatsApp number.
- **Automated Baileys WhatsApp Engine**: Admin can scan a QR code inside `admin.html` to link their WhatsApp Web session. When orders are placed or order status is updated (Confirmed ➔ Packing in Cold Box ➔ Shipped ➔ Delivered), automated confirmation and tracking messages are dispatched directly to the customer's WhatsApp chat.

### 4. Admin Management Portal (`admin.html`)
- **1-Click Instant Demo Login**: Test admin features immediately without typing passwords, or log in with `admin@chocolux.com` / `admin123`.
- **Live KPI Analytics Snapshot**: Total revenue (₹), order counts, listed chocolates, and low-stock alerts (< 5 units).
- **Full Products CRUD**: Add, edit, and delete chocolates with multi-image upload (`multer`), cocoa specifications, description, and custom variants JSON.
- **Order Fulfillment & Tracking**: Filter by status, inspect customer delivery addresses and gift notes, update status, and initiate direct WhatsApp chats with customers.
- **Store & Branding Settings**: Live editing of Brand Name, Tagline, WhatsApp ordering number, Support Email, Announcement Bar text, and Free Delivery minimum threshold.

---

## 🛠️ Technology Stack

- **Backend**: Node.js & Express.js (Port `3001`)
- **Database**: PostgreSQL (Neon Serverless PostgreSQL with SSL)
- **WhatsApp Web Engine**: `@whiskeysockets/baileys` + `qrcode` with persistent DB auth keys
- **Frontend**: HTML5, Tailwind CSS, Vanilla JavaScript (ES6+), Font: *Playfair Display* & *Inter*
- **File Uploads**: `multer` storing into `/uploads` with real-time preview

---

## 🚀 How to Run

1. Open PowerShell or Terminal and navigate to the project folder:
   ```bash
   cd "C:\Users\user\Downloads\Choco-Shop"
   ```

2. Seed sample categories, products, and default store settings:
   ```bash
   npm run seed
   ```

3. Start the server:
   ```bash
   npm start
   ```

4. Open in your browser:
   - **Customer Storefront**: [http://localhost:3001](http://localhost:3001)
   - **Admin Portal**: [http://localhost:3001/admin.html](http://localhost:3001/admin.html)
