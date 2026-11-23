const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const whatsappService = require('./services/whatsapp');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'chocolux-secure-jwt-key-2026-artisanal-chocolates';
const COOKIE_NAME = 'chocolux_auth_token';

// ----------------------------------------------------
// DATABASE POOL
// ----------------------------------------------------
const FALLBACK_DB_URL = Buffer.from(
  'cG9zdGdyZXNxbDovL25lb25kYl9vd25lcjpucGdfcmFRbzJnd2pSNG54QGVwLXByb3VkLWJyb29rLWJlZDM4Zjc5LXBvb2xlci5jLTkudXMtZWFzdC0yLmF3cy5uZW9uLnRlY2gvbmVvbmRiP3NzbG1vZGU9cmVxdWlyZQ==',
  'base64'
).toString('utf8');

const DATABASE_URL = process.env.DATABASE_URL || FALLBACK_DB_URL;

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('[ChocoLux DB] ❌ Connection error:', err.message);
  } else {
    console.log('[ChocoLux DB] ✅ Connected to PostgreSQL database successfully.');
    release();
  }
});

// Pass DB pool to WhatsApp service
whatsappService.setPool(pool);
whatsappService.init().catch(err => console.warn('[WhatsApp] Init warning:', err.message));

// ----------------------------------------------------
// FILE UPLOADS (MULTER)
// ----------------------------------------------------
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname) || '.jpg';
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'choco-' + unique + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// ----------------------------------------------------
// MIDDLEWARES
// ----------------------------------------------------
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(cookieParser());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Serve static assets and uploads
app.use('/uploads', express.static(uploadDir));
app.use(express.static(__dirname));

// ----------------------------------------------------
// AUTH UTILITIES
// ----------------------------------------------------
function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

function verifyPassword(password, hash) {
  if (!password || !hash) return false;
  return bcrypt.compareSync(password, hash);
}

function generateToken(user) {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email, 
      phone: user.phone || '',
      role: user.role || 'customer', 
      name: user.name || user.display_name || 'Customer' 
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

function getAuthCookieOptions(req) {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    maxAge: 30 * 24 * 3600 * 1000,
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps
  };
}

function getUserFromRequest(req) {
  const token = req.cookies[COOKIE_NAME] || (req.headers.authorization && req.headers.authorization.replace('Bearer ', ''));
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (_) {
    return null;
  }
}

function requireAuth(req, res, next) {
  const user = getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }
  req.user = user;
  next();
}

function requireAdminAuth(req, res, next) {
  const user = getUserFromRequest(req);
  if (!user || user.role !== 'admin') {
    return res.status(401).json({ error: 'Unauthorized: Admin privileges required.' });
  }
  req.user = user;
  next();
}

// ----------------------------------------------------
// REST APIS: 1. STORE SETTINGS (DYNAMIC BRANDING)
// ----------------------------------------------------
app.get('/api/settings', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM choco_store_settings WHERE id = 1');
    if (result.rows.length === 0) {
      return res.json({
        id: 1,
        brandName: 'CookLux',
        brand_name: 'CookLux',
        tagline: '',
        logoUrl: '/uploads/choco-1795357882540-491298133.png',
        logo_url: '/uploads/choco-1795357882540-491298133.png',
        whatsappNumber: process.env.WHATSAPP_NUMBER || '918078864233',
        whatsapp_number: process.env.WHATSAPP_NUMBER || '918078864233',
        contactEmail: 'orders@cooklux.com',
        contactPhone: '+91 80788 64233',
        currencySymbol: '₹',
        announcementText: '🍫 Free Insulated Cold-Box Delivery on orders above ₹799 | 100% Pure Cocoa Butter',
        minFreeShipping: 799,
        deliveryCharge: 60
      });
    }

    const row = result.rows[0];
    res.json({
      id: row.id,
      brandName: row.brand_name || 'CookLux',
      brand_name: row.brand_name || 'CookLux',
      tagline: row.tagline || '',
      logoUrl: row.logo_url || '/uploads/choco-1795357882540-491298133.png',
      logo_url: row.logo_url || '/uploads/choco-1795357882540-491298133.png',
      whatsappNumber: row.whatsapp_number || process.env.WHATSAPP_NUMBER || '918078864233',
      whatsapp_number: row.whatsapp_number || process.env.WHATSAPP_NUMBER || '918078864233',
      contactEmail: row.contact_email || 'orders@chocolux.com',
      contact_email: row.contact_email || 'orders@chocolux.com',
      contactPhone: row.contact_phone || '+91 80788 64233',
      contact_phone: row.contact_phone || '+91 80788 64233',
      currencySymbol: row.currency_symbol || '₹',
      currency_symbol: row.currency_symbol || '₹',
      announcementText: row.announcement_text || '🍫 Free Insulated Cold-Box Delivery on orders above ₹799 | 100% Pure Cocoa Butter',
      announcement_text: row.announcement_text || '🍫 Free Insulated Cold-Box Delivery on orders above ₹799 | 100% Pure Cocoa Butter',
      minFreeShipping: Number(row.min_free_shipping) || 799,
      min_free_shipping: Number(row.min_free_shipping) || 799,
      deliveryCharge: Number(row.delivery_charge) || 60,
      delivery_charge: Number(row.delivery_charge) || 60,
      updatedAt: row.updated_at
    });
  } catch (err) {
    console.error('Error fetching settings:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/settings', requireAdminAuth, async (req, res) => {
  try {
    const brandName = req.body.brandName || req.body.brand_name || 'ChocoLux';
    const tagline = req.body.tagline || '';
    const logoUrl = req.body.logoUrl || req.body.logo_url || '';
    const rawPhone = req.body.whatsappNumber || req.body.whatsapp_number || '';
    const cleanedPhone = rawPhone.replace(/[^0-9]/g, '');
    const contactEmail = req.body.contactEmail || req.body.contact_email || '';
    const contactPhone = req.body.contactPhone || req.body.contact_phone || '';
    const announcementText = req.body.announcementText || req.body.announcement_text || '';
    const minFreeShipping = req.body.minFreeShipping || req.body.min_free_shipping || 799;
    const deliveryCharge = req.body.deliveryCharge || req.body.delivery_charge || 60;

    const query = `
      INSERT INTO choco_store_settings (
        id, brand_name, tagline, logo_url, whatsapp_number,
        contact_email, contact_phone, announcement_text, min_free_shipping, delivery_charge, updated_at
      ) VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        brand_name = EXCLUDED.brand_name,
        tagline = EXCLUDED.tagline,
        logo_url = EXCLUDED.logo_url,
        whatsapp_number = EXCLUDED.whatsapp_number,
        contact_email = EXCLUDED.contact_email,
        contact_phone = EXCLUDED.contact_phone,
        announcement_text = EXCLUDED.announcement_text,
        min_free_shipping = EXCLUDED.min_free_shipping,
        delivery_charge = EXCLUDED.delivery_charge,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const result = await pool.query(query, [
      brandName, tagline, logoUrl, cleanedPhone,
      contactEmail, contactPhone, announcementText,
      minFreeShipping, deliveryCharge
    ]);

    res.json({
      success: true,
      message: 'Store settings updated successfully',
      settings: result.rows[0]
    });
  } catch (err) {
    console.error('Error updating settings:', err);
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// REST APIS: 2. AUTHENTICATION (DATABASE DRIVEN)
// ----------------------------------------------------
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, phone, email, password, address, city, state, pincode } = req.body;
    if (!name || !phone || !password) {
      return res.status(400).json({ error: 'Name, phone number, and password are required.' });
    }

    const cleanName = (name || '').trim();
    const cleanPhone = (phone || '').replace(/[^0-9]/g, '');
    const cleanEmail = (email || '').trim().toLowerCase();

    if (cleanPhone.length < 10) {
      return res.status(400).json({ error: 'Please enter a valid 10-digit mobile number.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    // Check if phone or email is already registered
    const existing = await pool.query(
      `SELECT id, email, phone FROM choco_users 
       WHERE (phone = $1 OR (LENGTH($1) >= 10 AND phone LIKE $2))
          OR (email IS NOT NULL AND email <> '' AND LOWER(email) = $3)
       LIMIT 1`,
      [cleanPhone, `%${cleanPhone.slice(-10)}%`, cleanEmail || '']
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this mobile number or email already exists. Please sign in.' });
    }

    const userId = 'usr_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const pwdHash = hashPassword(password);

    const insertResult = await pool.query(
      `INSERT INTO choco_users (
        id, name, display_name, phone, email, password_hash, role,
        address, city, state, pincode, created_at, updated_at
      ) VALUES ($1, $2, $2, $3, $4, $5, 'customer', $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, name, display_name, phone, email, role, address, city, state, pincode, created_at`,
      [
        userId, cleanName, cleanPhone, cleanEmail || null, pwdHash,
        (address || '').trim(), (city || '').trim(), (state || '').trim(), (pincode || '').trim()
      ]
    );

    const user = insertResult.rows[0];
    const token = generateToken(user);
    res.cookie(COOKIE_NAME, token, getAuthCookieOptions(req));

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user.id,
        uid: user.id,
        name: user.name,
        displayName: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        address: user.address,
        city: user.city,
        state: user.state,
        pincode: user.pincode
      }
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, phoneOrEmail, password } = req.body;
    const identifier = (email || phoneOrEmail || '').trim();

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Email or mobile number and password are required.' });
    }

    const cleanInput = identifier.toLowerCase();
    const cleanPhone = identifier.replace(/[^0-9]/g, '');

    const result = await pool.query(
      `SELECT * FROM choco_users 
       WHERE (email IS NOT NULL AND LOWER(email) = $1)
          OR (phone IS NOT NULL AND phone = $2)
          OR (LENGTH($2) >= 10 AND phone LIKE $3)
       LIMIT 1`,
      [cleanInput, cleanPhone, `%${cleanPhone.slice(-10)}%`]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid mobile/email or password.' });
    }

    const user = result.rows[0];
    const valid = verifyPassword(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid mobile/email or password.' });
    }

    const token = generateToken(user);
    res.cookie(COOKIE_NAME, token, getAuthCookieOptions(req));

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        uid: user.id,
        name: user.name || user.display_name,
        displayName: user.name || user.display_name,
        email: user.email,
        phone: user.phone || '',
        role: user.role || 'customer',
        address: user.address || '',
        city: user.city || '',
        state: user.state || '',
        pincode: user.pincode || ''
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', async (req, res) => {
  const userPayload = getUserFromRequest(req);
  if (!userPayload) return res.status(401).json({ authenticated: false, user: null });

  try {
    const dbUser = await pool.query(
      'SELECT id, name, display_name, phone, email, role, address, city, state, pincode FROM choco_users WHERE id = $1',
      [userPayload.id]
    );

    if (dbUser.rows.length === 0) {
      return res.status(401).json({ authenticated: false, user: null });
    }

    const u = dbUser.rows[0];
    res.json({
      authenticated: true,
      user: {
        id: u.id,
        uid: u.id,
        name: u.name || u.display_name,
        displayName: u.name || u.display_name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        address: u.address,
        city: u.city,
        state: u.state,
        pincode: u.pincode
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, getAuthCookieOptions(req));
  res.json({ success: true, message: 'Logged out successfully' });
});

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email, phoneOrEmail } = req.body;
    const identifier = (email || phoneOrEmail || '').trim();
    if (!identifier) return res.status(400).json({ error: 'Email or mobile number is required.' });

    const cleanInput = identifier.toLowerCase();
    const cleanPhone = identifier.replace(/[^0-9]/g, '');

    const result = await pool.query(
      `SELECT id, name, email, phone FROM choco_users 
       WHERE (email IS NOT NULL AND LOWER(email) = $1)
          OR (phone IS NOT NULL AND phone = $2)
          OR (LENGTH($2) >= 10 AND phone LIKE $3)
       LIMIT 1`,
      [cleanInput, cleanPhone, `%${cleanPhone.slice(-10)}%`]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No account found matching this mobile number or email.' });
    }

    const user = result.rows[0];
    const resetToken = crypto.randomBytes(16).toString('hex');
    await pool.query(
      `UPDATE choco_users SET
         reset_token = $1,
         reset_token_expiry = CURRENT_TIMESTAMP + INTERVAL '1 hour',
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [resetToken, user.id]
    );

    res.json({
      success: true,
      message: 'Reset code generated successfully.',
      resetToken
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email, phoneOrEmail, resetToken, newPassword } = req.body;
    const identifier = (email || phoneOrEmail || '').trim();

    if (!identifier || !newPassword) {
      return res.status(400).json({ error: 'Identifier and new password are required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const cleanInput = identifier.toLowerCase();
    const cleanPhone = identifier.replace(/[^0-9]/g, '');

    const userResult = await pool.query(
      `SELECT id FROM choco_users 
       WHERE ((email IS NOT NULL AND LOWER(email) = $1)
          OR (phone IS NOT NULL AND phone = $2)
          OR (LENGTH($2) >= 10 AND phone LIKE $3))
       LIMIT 1`,
      [cleanInput, cleanPhone, `%${cleanPhone.slice(-10)}%`]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found.' });
    }

    const userId = userResult.rows[0].id;
    const pwdHash = hashPassword(newPassword);

    await pool.query(
      `UPDATE choco_users SET
         password_hash = $1,
         reset_token = NULL,
         reset_token_expiry = NULL,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [pwdHash, userId]
    );

    res.json({ success: true, message: 'Password has been updated successfully. You can now sign in.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// REST APIS: 3. CATEGORIES
// ----------------------------------------------------
app.get('/api/categories', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM choco_categories ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/categories', requireAdminAuth, async (req, res) => {
  try {
    const { name, icon, subcategories } = req.body;
    if (!name) return res.status(400).json({ error: 'Category name is required' });
    const id = 'cat_' + Date.now();
    const result = await pool.query(
      `INSERT INTO choco_categories (id, name, icon, subcategories)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, name.trim(), icon || '🍫', JSON.stringify(subcategories || [])]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/categories/:id', requireAdminAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM choco_categories WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Category deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// REST APIS: 4. PRODUCTS (CRUD & RESTOCK)
// ----------------------------------------------------
app.get('/api/products', async (req, res) => {
  try {
    const { category, search, featured, sort } = req.query;
    let query = 'SELECT * FROM choco_products WHERE 1=1';
    const params = [];

    if (category && category !== 'All') {
      params.push(category);
      query += ` AND category = $${params.length}`;
    }

    if (featured === 'true') {
      query += ' AND featured = true';
    }

    if (search && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      query += ` AND (LOWER(title) LIKE $${params.length} OR LOWER(description) LIKE $${params.length} OR LOWER(category) LIKE $${params.length} OR LOWER(cocoa_percentage) LIKE $${params.length})`;
    }

    if (sort === 'price_asc') {
      query += ' ORDER BY price ASC';
    } else if (sort === 'price_desc') {
      query += ' ORDER BY price DESC';
    } else if (sort === 'rating') {
      query += ' ORDER BY rating DESC';
    } else {
      query += ' ORDER BY featured DESC, created_at DESC';
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM choco_products WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/products', requireAdminAuth, async (req, res) => {
  try {
    const {
      title, category, subCategory, cocoaPercentage,
      mrp, price, featured, bestSeller, newArrival,
      dietary, shelfLife, ingredients, description, storageInstructions,
      images, variants
    } = req.body;

    if (!title || !price || !category) {
      return res.status(400).json({ error: 'Title, category, and price are required' });
    }

    const id = 'choco_' + Date.now();
    const query = `
      INSERT INTO choco_products (
        id, title, category, sub_category, cocoa_percentage, mrp, price,
        featured, best_seller, new_arrival, dietary, shelf_life,
        ingredients, description, storage_instructions, images, variants
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17
      ) RETURNING *
    `;

    const result = await pool.query(query, [
      id, title, category, subCategory || '', cocoaPercentage || '70% Cocoa',
      mrp || price, price,
      Boolean(featured), Boolean(bestSeller), Boolean(newArrival),
      dietary || '100% Vegetarian (Eggless)', shelfLife || '6 Months',
      ingredients || '', description || '', storageInstructions || 'Store in a cool, dry place between 15°C - 20°C',
      JSON.stringify(images || []), JSON.stringify(variants || { '100g': 20, '250g': 15 })
    ]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/products/:id', requireAdminAuth, async (req, res) => {
  try {
    const {
      title, category, subCategory, cocoaPercentage,
      mrp, price, featured, bestSeller, newArrival,
      dietary, shelfLife, ingredients, description, storageInstructions,
      images, variants
    } = req.body;

    const query = `
      UPDATE choco_products SET
        title = $1, category = $2, sub_category = $3, cocoa_percentage = $4,
        mrp = $5, price = $6, featured = $7, best_seller = $8, new_arrival = $9,
        dietary = $10, shelf_life = $11, ingredients = $12, description = $13,
        storage_instructions = $14, images = $15, variants = $16, updated_at = CURRENT_TIMESTAMP
      WHERE id = $17
      RETURNING *
    `;

    const result = await pool.query(query, [
      title, category, subCategory, cocoaPercentage,
      mrp, price, Boolean(featured), Boolean(bestSeller), Boolean(newArrival),
      dietary, shelfLife, ingredients, description, storageInstructions,
      JSON.stringify(images || []), JSON.stringify(variants || {}),
      req.params.id
    ]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/products/:id', requireAdminAuth, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM choco_products WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/products/:id/stock', requireAdminAuth, async (req, res) => {
  try {
    const { variantKey, newStock } = req.body;
    const prodRes = await pool.query('SELECT variants FROM choco_products WHERE id = $1', [req.params.id]);
    if (prodRes.rows.length === 0) return res.status(404).json({ error: 'Product not found' });

    const currentVariants = prodRes.rows[0].variants || {};
    currentVariants[variantKey] = Number(newStock) || 0;

    const updateRes = await pool.query(
      'UPDATE choco_products SET variants = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [JSON.stringify(currentVariants), req.params.id]
    );

    res.json(updateRes.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// REST APIS: 5. ORDERS & CHECKOUT (WITH USER ACCOUNT & WHATSAPP DISPATCH)
// ----------------------------------------------------
app.post('/api/orders', async (req, res) => {
  try {
    const { customer, items, subtotal, discount, deliveryCharge, totalAmount, couponCode, giftMessage } = req.body;

    if (!customer || !customer.name || !customer.phone) {
      return res.status(400).json({ error: 'Customer name and phone number are required' });
    }
    if (!items || !items.length) {
      return res.status(400).json({ error: 'Cart cannot be empty' });
    }

    const authUser = getUserFromRequest(req);
    let finalUserUid = authUser ? authUser.id : (req.body.userUid || null);

    // If customer is signed in or phone matches, link order and update saved address
    if (finalUserUid && (customer.address || customer.city || customer.pincode)) {
      try {
        await pool.query(
          `UPDATE choco_users SET
             address = COALESCE(NULLIF($1, ''), address),
             city = COALESCE(NULLIF($2, ''), city),
             state = COALESCE(NULLIF($3, ''), state),
             pincode = COALESCE(NULLIF($4, ''), pincode),
             updated_at = CURRENT_TIMESTAMP
           WHERE id = $5`,
          [customer.address, customer.city, customer.state, customer.pincode, finalUserUid]
        );
      } catch (_) {}
    } else if (!finalUserUid && customer.phone) {
      try {
        const cleanP = customer.phone.replace(/[^0-9]/g, '');
        if (cleanP.length >= 10) {
          const match = await pool.query('SELECT id FROM choco_users WHERE phone LIKE $1 LIMIT 1', [`%${cleanP.slice(-10)}%`]);
          if (match.rows.length > 0) {
            finalUserUid = match.rows[0].id;
          }
        }
      } catch (_) {}
    }

    const orderId = 'ord_' + Date.now();
    const orderNumber = 'CHOC-' + Math.floor(100000 + Math.random() * 900000);

    // Insert Order with user_uid
    const insertQuery = `
      INSERT INTO choco_orders (
        id, order_number, customer, items, subtotal, discount,
        delivery_charge, total_amount, coupon_code, gift_message,
        payment_method, payment_status, order_status, user_uid
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        'WhatsApp Order', 'Pending', 'Pending', $11
      ) RETURNING *
    `;

    const result = await pool.query(insertQuery, [
      orderId, orderNumber,
      JSON.stringify(customer), JSON.stringify(items),
      subtotal || 0, discount || 0, deliveryCharge || 0, totalAmount,
      couponCode || '', giftMessage || '', finalUserUid
    ]);

    const createdOrder = result.rows[0];

    // Deduct stock for ordered variants
    for (const item of items) {
      if (item.id && item.variant) {
        try {
          const p = await pool.query('SELECT variants FROM choco_products WHERE id = $1', [item.id]);
          if (p.rows.length > 0) {
            const vars = p.rows[0].variants || {};
            if (vars[item.variant] !== undefined) {
              vars[item.variant] = Math.max(0, vars[item.variant] - (item.quantity || 1));
              await pool.query('UPDATE choco_products SET variants = $1 WHERE id = $2', [JSON.stringify(vars), item.id]);
            }
          }
        } catch (stockErr) {
          console.warn('Stock update non-fatal error:', stockErr.message);
        }
      }
    }

    // Trigger Automated WhatsApp Notification (if connected)
    whatsappService.notifyOrderPlaced(createdOrder).catch(err => {
      console.warn('[WhatsApp] Automated notification background err:', err.message);
    });

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      order: createdOrder
    });
  } catch (err) {
    console.error('Error creating order:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/orders', requireAuth, async (req, res) => {
  try {
    const { status, search, my } = req.query;
    let query = 'SELECT * FROM choco_orders WHERE 1=1';
    const params = [];

    // Role-based scoping:
    // Administrators can view all orders; customers can ONLY view their own orders!
    if (req.user.role !== 'admin' || my === 'true') {
      params.push(req.user.id);
      let userClause = `user_uid = $${params.length}`;
      if (req.user.phone) {
        const cleanP = req.user.phone.replace(/[^0-9]/g, '');
        if (cleanP.length >= 6) {
          params.push(`%${cleanP.slice(-10)}%`);
          userClause = `(${userClause} OR customer->>'phone' LIKE $${params.length})`;
        }
      }
      query += ` AND ${userClause}`;
    }

    if (status && status !== 'All') {
      params.push(status);
      query += ` AND order_status = $${params.length}`;
    }

    if (search && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      query += ` AND (LOWER(order_number) LIKE $${params.length} OR LOWER(customer->>'name') LIKE $${params.length} OR LOWER(customer->>'phone') LIKE $${params.length})`;
    }

    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/orders/:identifier', async (req, res) => {
  try {
    const id = req.params.identifier;
    const result = await pool.query(
      'SELECT * FROM choco_orders WHERE id = $1 OR order_number = $1 LIMIT 1',
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/orders/:id/status', requireAdminAuth, async (req, res) => {
  try {
    const { status, note } = req.body;
    if (!status) return res.status(400).json({ error: 'Status is required' });

    const updateRes = await pool.query(
      'UPDATE choco_orders SET order_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );

    if (updateRes.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    const order = updateRes.rows[0];

    // Trigger Automated WhatsApp Status Notification
    whatsappService.notifyOrderStatus(order, status, note || '').catch(err => {
      console.warn('[WhatsApp] Status notification background err:', err.message);
    });

    res.json({
      success: true,
      message: `Order status updated to ${status}`,
      order
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// REST APIS: 6. WHATSAPP BAILEYS CLIENT MANAGEMENT
// ----------------------------------------------------
app.get('/api/whatsapp/status', requireAdminAuth, (req, res) => {
  res.json(whatsappService.getStatus());
});

app.post('/api/whatsapp/restart', requireAdminAuth, async (req, res) => {
  try {
    whatsappService.isInitializing = false;
    await whatsappService.init();
    res.json({ success: true, message: 'WhatsApp client reinitialized' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/whatsapp/disconnect', requireAdminAuth, async (req, res) => {
  try {
    await whatsappService.disconnect();
    res.json({ success: true, message: 'WhatsApp logged out and session cleared' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/whatsapp/queue', requireAdminAuth, async (req, res) => {
  try {
    const queue = await whatsappService.getQueueStatus();
    res.json(queue);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/whatsapp/test', requireAdminAuth, async (req, res) => {
  try {
    const { phone, message } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone number is required' });
    const result = await whatsappService.enqueueMessage(
      phone,
      message || '🍫 Greetings from your store! This is a test WhatsApp message from your Admin Portal.',
      'test'
    );
    if (result.success) {
      if (result.connected) {
        res.json({ success: true, message: 'Test message queued and dispatched via WhatsApp' });
      } else {
        res.json({ success: true, message: 'WhatsApp is currently offline. Test message has been queued in database and will be delivered automatically upon reconnection.', queued: true });
      }
    } else {
      res.status(500).json({ success: false, error: result.error || 'Could not queue message' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// REST APIS: 7. IMAGE UPLOAD HANDLER
// ----------------------------------------------------
app.post('/api/upload', requireAdminAuth, upload.array('images', 5), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files were uploaded' });
    }
    const urls = req.files.map(file => `/uploads/${file.filename}`);
    res.json({
      success: true,
      urls,
      url: urls[0] // convenient alias for single image
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// REST APIS: 8. ADMIN DASHBOARD STATS
// ----------------------------------------------------
app.get('/api/admin/stats', requireAdminAuth, async (req, res) => {
  try {
    const revenueRes = await pool.query(
      "SELECT COALESCE(SUM(total_amount), 0) AS total_revenue, COUNT(*) AS total_orders FROM choco_orders WHERE order_status != 'Cancelled'"
    );
    const prodRes = await pool.query('SELECT COUNT(*) AS total_products FROM choco_products');

    // Count low stock variants (< 5)
    const prods = await pool.query('SELECT id, title, variants FROM choco_products');
    let lowStockCount = 0;
    const lowStockItems = [];

    for (const row of prods.rows) {
      const vars = row.variants || {};
      for (const [key, qty] of Object.entries(vars)) {
        if (Number(qty) < 5) {
          lowStockCount++;
          lowStockItems.push({ id: row.id, title: row.title, variant: key, stock: qty });
        }
      }
    }

    const recentOrders = await pool.query('SELECT * FROM choco_orders ORDER BY created_at DESC LIMIT 5');

    res.json({
      revenue: Number(revenueRes.rows[0].total_revenue) || 0,
      totalOrders: Number(revenueRes.rows[0].total_orders) || 0,
      totalProducts: Number(prodRes.rows[0].total_products) || 0,
      lowStockCount,
      lowStockItems: lowStockItems.slice(0, 8),
      recentOrders: recentOrders.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dynamic Open Graph Product Route for WhatsApp & Social Crawlers
app.get('/product/:id', async (req, res) => {
  try {
    const prodId = req.params.id;
    const result = await pool.query('SELECT * FROM choco_products WHERE id = $1', [prodId]);
    if (result.rows.length === 0) {
      return res.sendFile(path.join(__dirname, 'index.html'));
    }
    const product = result.rows[0];
    const settingsRes = await pool.query('SELECT * FROM choco_store_settings WHERE id = 1');
    const brand = settingsRes.rows[0]?.brand_name || 'SnackzTin';

    let html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    const rawImg = (Array.isArray(product.images) && product.images[0]) || '';
    const imgUrl = rawImg.startsWith('http') ? rawImg : `https://snackztin.web.app${rawImg.startsWith('/') ? '' : '/'}${rawImg}`;
    const pageTitle = `${product.title} — ₹${product.price} | ${brand}`;
    const pageDesc = product.description ? product.description.substring(0, 150) : `Order ${product.title} at ₹${product.price} on ${brand}. Fresh handcrafted delivery.`;
    const prodUrl = `https://snackztin.web.app/product/${product.id}`;

    html = html.replace(/<title id="page-title">.*?<\/title>/i, `<title id="page-title">${pageTitle}</title>`);
    html = html.replace(/<meta name="title" content=".*?">/i, `<meta name="title" content="${pageTitle}">`);
    html = html.replace(/<meta name="description" content=".*?">/i, `<meta name="description" content="${pageDesc}">`);
    html = html.replace(/<meta property="og:title" id="og-title" content=".*?">/i, `<meta property="og:title" id="og-title" content="${pageTitle}">`);
    html = html.replace(/<meta property="og:description" id="og-desc" content=".*?">/i, `<meta property="og:description" id="og-desc" content="${pageDesc}">`);
    html = html.replace(/<meta property="og:image" id="og-image" content=".*?">/i, `<meta property="og:image" id="og-image" content="${imgUrl}">`);
    html = html.replace(/<meta property="og:url" content=".*?">/i, `<meta property="og:url" content="${prodUrl}">`);
    html = html.replace(/<meta name="twitter:title" content=".*?">/i, `<meta name="twitter:title" content="${pageTitle}">`);
    html = html.replace(/<meta name="twitter:description" content=".*?">/i, `<meta name="twitter:description" content="${pageDesc}">`);
    html = html.replace(/<meta name="twitter:image" content=".*?">/i, `<meta name="twitter:image" content="${imgUrl}">`);

    res.send(html);
  } catch (err) {
    res.sendFile(path.join(__dirname, 'index.html'));
  }
});

// Fallback route for SPA (Express v5 compatible)
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
  if (req.path.startsWith('/admin')) {
    return res.sendFile(path.join(__dirname, 'admin.html'));
  }
  return res.sendFile(path.join(__dirname, 'index.html'));
});

// ----------------------------------------------------
// START SERVER
// ----------------------------------------------------
const server = app.listen(PORT, () => {
  console.log(`🍫 [ChocoLux Server] Running with passion on http://localhost:${PORT}`);
  console.log(`👑 [Admin Portal]   Available at http://localhost:${PORT}/admin.html`);
});

const cleanup = () => {
  console.log('[Server] Gracefully shutting down...');
  if (whatsappService && whatsappService.sock) {
    try { whatsappService.sock.end(); } catch (_) {}
  }
  server.close(() => {
    process.exit(0);
  });
};

process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);
