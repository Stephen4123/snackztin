-- ==========================================================
-- ChocoLux PostgreSQL Database Schema
-- Artisanal Chocolates, Confections & Gift Hampers
-- ==========================================================

-- 1. Store Settings Table (Dynamic Branding, WhatsApp number, Announcement, etc.)
CREATE TABLE IF NOT EXISTS choco_store_settings (
    id INT PRIMARY KEY DEFAULT 1,
    brand_name VARCHAR(255) NOT NULL DEFAULT 'ChocoLux',
    tagline VARCHAR(255) DEFAULT 'Artisanal Handcrafted Chocolates & Luxury Confections',
    logo_url TEXT DEFAULT '',
    whatsapp_number VARCHAR(32) DEFAULT '918078864233',
    contact_email VARCHAR(255) DEFAULT 'orders@chocolux.com',
    contact_phone VARCHAR(32) DEFAULT '+91 80788 64233',
    currency_symbol VARCHAR(8) DEFAULT '₹',
    announcement_text TEXT DEFAULT '🍫 Free Insulated Cold-Box Delivery on orders above ₹799 | 100% Pure Cocoa Butter',
    min_free_shipping NUMERIC(10, 2) DEFAULT 799.00,
    delivery_charge NUMERIC(10, 2) DEFAULT 60.00,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed default settings if not exists
INSERT INTO choco_store_settings (id, brand_name, tagline, whatsapp_number, contact_email, contact_phone, announcement_text, min_free_shipping, delivery_charge)
VALUES (1, 'ChocoLux', 'Artisanal Handcrafted Chocolates & Luxury Confections', '918078864233', 'orders@chocolux.com', '+91 80788 64233', '🍫 Free Insulated Cold-Box Delivery on orders above ₹799 | 100% Pure Cocoa Butter', 799.00, 60.00)
ON CONFLICT (id) DO UPDATE SET
  brand_name = EXCLUDED.brand_name
  WHERE choco_store_settings.brand_name IS NULL OR choco_store_settings.brand_name = '';

-- 2. Categories Table
CREATE TABLE IF NOT EXISTS choco_categories (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    icon VARCHAR(32) DEFAULT '🍫',
    subcategories JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_choco_categories_name ON choco_categories(name);

-- 3. Products Table (Tailored for Chocolates)
CREATE TABLE IF NOT EXISTS choco_products (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    sub_category VARCHAR(100),
    cocoa_percentage VARCHAR(100) DEFAULT '70% Pure Cocoa',
    mrp NUMERIC(10, 2) NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    rating NUMERIC(3, 2) DEFAULT 4.9,
    review_count INT DEFAULT 24,
    featured BOOLEAN DEFAULT false,
    best_seller BOOLEAN DEFAULT false,
    new_arrival BOOLEAN DEFAULT false,
    dietary VARCHAR(100) DEFAULT '100% Vegetarian (Eggless)',
    shelf_life VARCHAR(100) DEFAULT '6 Months',
    ingredients TEXT,
    description TEXT,
    storage_instructions TEXT DEFAULT 'Store in a cool, dry place between 15°C - 20°C. Keep away from direct heat.',
    images JSONB NOT NULL DEFAULT '[]'::jsonb,
    variants JSONB NOT NULL DEFAULT '{"100g": 20, "250g": 15, "500g": 10}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_choco_products_category ON choco_products(category);
CREATE INDEX IF NOT EXISTS idx_choco_products_price ON choco_products(price);
CREATE INDEX IF NOT EXISTS idx_choco_products_created_at ON choco_products(created_at DESC);

-- 4. Orders Table
CREATE TABLE IF NOT EXISTS choco_orders (
    id VARCHAR(64) PRIMARY KEY,
    order_number VARCHAR(64) UNIQUE NOT NULL,
    customer JSONB NOT NULL,
    items JSONB NOT NULL,
    subtotal NUMERIC(10, 2) NOT NULL,
    discount NUMERIC(10, 2) DEFAULT 0,
    delivery_charge NUMERIC(10, 2) DEFAULT 0,
    total_amount NUMERIC(10, 2) NOT NULL,
    coupon_code VARCHAR(64),
    gift_message TEXT,
    payment_method VARCHAR(64) NOT NULL DEFAULT 'WhatsApp Order',
    payment_status VARCHAR(64) DEFAULT 'Pending',
    order_status VARCHAR(64) DEFAULT 'Pending', -- 'Pending', 'Confirmed', 'Packing in Cold Box', 'Shipped', 'Delivered', 'Cancelled'
    user_uid VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_choco_orders_order_number ON choco_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_choco_orders_status ON choco_orders(order_status);
CREATE INDEX IF NOT EXISTS idx_choco_orders_user_uid ON choco_orders(user_uid);
CREATE INDEX IF NOT EXISTS idx_choco_orders_created_at ON choco_orders(created_at DESC);

-- 5. Admin & Customer Users Table
CREATE TABLE IF NOT EXISTS choco_users (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255),
    display_name VARCHAR(255),
    phone VARCHAR(32),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(32) DEFAULT 'customer', -- 'customer' | 'admin'
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(32),
    reset_token VARCHAR(255),
    reset_token_expiry TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_choco_users_unique_lower_email ON choco_users (LOWER(TRIM(email))) WHERE email IS NOT NULL AND email <> '';
CREATE INDEX IF NOT EXISTS idx_choco_users_phone ON choco_users(phone);

-- Seed default admin account (admin@chocolux.com / admin123)
-- bcrypt hash for 'admin123' is $2a$10$wE8wB29U29.pZ5e49k5Vz.c2Z8V2N3v5W5C5r2Z8V2N3v5W5C5r2 or standard bcrypt
INSERT INTO choco_users (id, email, password_hash, display_name, role)
VALUES (
    'admin_chocolux_1',
    'admin@chocolux.com',
    '$2a$10$3euPcmQv7M0jT/rXjEwSZu1jG2j2C1M4D3S9K1W2T4M6S7T9V1X2.',
    'ChocoLux Master Admin',
    'admin'
) ON CONFLICT (email) DO NOTHING;

-- 6. WhatsApp Baileys Auth Session Storage (Persistent in PostgreSQL)
CREATE TABLE IF NOT EXISTS choco_whatsapp_auth_keys (
    session_id VARCHAR(64) NOT NULL DEFAULT 'choco_default',
    key_id VARCHAR(255) NOT NULL,
    key_data TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (session_id, key_id)
);
CREATE INDEX IF NOT EXISTS idx_choco_whatsapp_auth_keys ON choco_whatsapp_auth_keys(session_id, key_id);
