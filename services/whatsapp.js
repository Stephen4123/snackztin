const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { usePostgreAuthState } = require('./baileys-pg-auth');
const pino = require('pino');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');

const AUTH_FOLDER = path.join(__dirname, '..', 'auth_info_baileys');

class WhatsAppService {
  constructor() {
    this.sock = null;
    this.currentQR = null;
    this.isConnected = false;
    this.connectedPhone = null;
    this.autoNotifyEnabled = true;
    this.isInitializing = false;
    this.reconnectTimer = null;
    this.pool = null;
    this.authManager = null;
    this.isProcessingQueue = false;
  }

  setPool(pool) {
    this.pool = pool;
    this.ensureMessagesTable().catch(err => {
      console.warn('[WhatsApp Queue] Table verification warning:', err.message);
    });
  }

  async ensureMessagesTable() {
    if (!this.pool) return;
    try {
      const sql = `
        CREATE TABLE IF NOT EXISTS messages (
          id SERIAL PRIMARY KEY,
          recipient VARCHAR(255) NOT NULL,
          message_body TEXT NOT NULL,
          message_type VARCHAR(100) DEFAULT 'general',
          sent BOOLEAN DEFAULT false,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_messages_sent_created ON messages (sent, created_at ASC);
      `;
      await this.pool.query(sql);
      console.log('[WhatsApp Queue] 📋 `messages` table verified in database.');
    } catch (err) {
      console.error('[WhatsApp Queue] Error ensuring `messages` table:', err.message);
    }
  }

  async getStoreSettingsFromDB() {
    if (!this.pool) return { brand_name: 'SnackzTin' };
    try {
      const res = await this.pool.query(
        'SELECT brand_name, whatsapp_number, contact_email, contact_phone, min_free_shipping FROM choco_store_settings WHERE id = 1 LIMIT 1'
      );
      return res.rows[0] || { brand_name: 'SnackzTin' };
    } catch (err) {
      console.warn('[WhatsApp] Could not fetch store_settings:', err.message);
      return { brand_name: 'SnackzTin' };
    }
  }

  async init() {
    if (this.sock && this.isConnected) return;
    if (this.isInitializing) return;
    this.isInitializing = true;

    try {
      if (!fs.existsSync(AUTH_FOLDER)) {
        fs.mkdirSync(AUTH_FOLDER, { recursive: true });
      }

      if (this.sock) {
        try {
          this.sock.ev.removeAllListeners();
          this.sock.end(new Error('Re-initializing WhatsApp client'));
        } catch (_) {}
        this.sock = null;
      }

      let state, saveCreds;
      if (this.pool) {
        console.log('[WhatsApp] 🔐 Using persistent PostgreSQL session store.');
        const auth = await usePostgreAuthState(this.pool, 'choco_default', AUTH_FOLDER);
        this.authManager = auth;
        state = auth.state;
        saveCreds = auth.saveCreds;
      } else {
        const auth = await useMultiFileAuthState(AUTH_FOLDER);
        this.authManager = null;
        state = auth.state;
        saveCreds = auth.saveCreds;
      }

      this.sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ["SnackzTin Admin", "Chrome", "1.0.0"],
        syncFullHistory: false,
        markOnlineOnConnect: true,
        keepAliveIntervalMs: 25000,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000
      });

      this.sock.ev.on('creds.update', saveCreds);

      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            this.currentQR = await qrcode.toDataURL(qr);
            console.log('[WhatsApp] 📱 New QR code generated. Scan in Admin Portal.');
          } catch (err) {
            console.error('[WhatsApp] QR generation error:', err);
          }
        }

        if (connection === 'close') {
          this.isConnected = false;
          this.connectedPhone = null;
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const isLoggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 401;
          const isReplaced = statusCode === DisconnectReason.connectionReplaced || statusCode === 440;
          const shouldReconnect = !isLoggedOut;

          console.log(`[WhatsApp] 🔌 Connection closed (code: ${statusCode}). Reconnect: ${shouldReconnect}, Replaced: ${isReplaced}`);

          if (isLoggedOut) {
            this.currentQR = null;
            if (this.authManager && typeof this.authManager.clearSession === 'function') {
              await this.authManager.clearSession().catch(e => console.warn('Clear session err:', e.message));
            }
            if (fs.existsSync(AUTH_FOLDER)) {
              fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
            }
            this.isInitializing = false;
            return;
          }

          if (isReplaced) {
            console.warn('[WhatsApp] ⚠️ Session was replaced by another connection or browser instance (code: 440). Backing off reconnect for 30s to prevent flapping.');
            if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
            this.reconnectTimer = setTimeout(() => {
              this.isInitializing = false;
              this.init();
            }, 30000);
          } else if (shouldReconnect) {
            if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
            this.reconnectTimer = setTimeout(() => {
              this.isInitializing = false;
              this.init();
            }, 6000);
          } else {
            this.isInitializing = false;
          }
        } else if (connection === 'open') {
          this.isConnected = true;
          this.currentQR = null;
          const userJid = this.sock?.user?.id || '';
          this.connectedPhone = userJid.split(':')[0] || userJid.split('@')[0] || 'Connected';
          console.log(`[WhatsApp] 🚀 WhatsApp Connected successfully! Phone: ${this.connectedPhone}`);
          this.isInitializing = false;

          // Auto-trigger queue processor on connection/reconnection
          this.processQueue().catch(err => {
            console.warn('[WhatsApp Queue] Startup/Reconnect processQueue err:', err.message);
          });
        }
      });
    } catch (err) {
      console.error('[WhatsApp] Init error:', err);
      this.isInitializing = false;
    }
  }

  getStatus() {
    return {
      connected: this.isConnected,
      phone: this.connectedPhone,
      qr: this.currentQR,
      autoNotify: this.autoNotifyEnabled
    };
  }

  formatPhone(raw) {
    if (!raw) return null;
    let digits = String(raw).replace(/[^0-9]/g, '');
    if (digits.length === 10) digits = '91' + digits; // Default India prefix
    if (!digits.endsWith('@s.whatsapp.net')) digits = digits + '@s.whatsapp.net';
    return digits;
  }

  /**
   * Enqueue a WhatsApp message into the `messages` table.
   * If WhatsApp is connected, triggers the FIFO processor immediately.
   * If disconnected, message is safely retained for future retry.
   */
  async enqueueMessage(recipient, messageBody, messageType = 'general') {
    if (!recipient || !messageBody) {
      console.warn('[WhatsApp Queue] Missing recipient or messageBody');
      return { success: false, error: 'Recipient and message body required' };
    }

    try {
      let messageId = null;
      if (this.pool) {
        const res = await this.pool.query(
          `INSERT INTO messages (recipient, message_body, message_type, sent, created_at)
           VALUES ($1, $2, $3, false, NOW())
           RETURNING id, recipient, created_at`,
          [String(recipient).trim(), String(messageBody).trim(), String(messageType).trim()]
        );
        messageId = res.rows[0]?.id;
        console.log(`[WhatsApp Queue] 📥 Message #${messageId} queued for ${recipient} [Type: ${messageType}]. Connected: ${this.isConnected}`);
      } else {
        console.warn('[WhatsApp Queue] No database pool available to queue message.');
      }

      // Check WhatsApp connection state
      if (this.isConnected && this.sock) {
        // Trigger queue processor immediately without awaiting to keep app flow responsive
        this.processQueue().catch(err => {
          console.warn('[WhatsApp Queue] processQueue trigger err:', err.message);
        });
      } else {
        console.log(`[WhatsApp Queue] 💤 WhatsApp is currently disconnected. Message #${messageId || 'pending'} stored safely in DB for retry upon reconnect.`);
      }

      return { success: true, queued: true, messageId, connected: this.isConnected };
    } catch (err) {
      console.error('[WhatsApp Queue] ⚠️ Error enqueueing message:', err.message);
      // Return safe failure response so the main application flow is never disrupted
      return { success: false, queued: false, error: err.message };
    }
  }

  /**
   * Background Queue Processor (Sequential FIFO Sending).
   * Fetches records from `messages` where sent = false ORDER BY created_at ASC.
   * Sends each message with a safe delay (1.5s) to avoid rate-limiting.
   * Marks sent = true and immediately auto-cleans sent rows.
   * If sending fails mid-way, stops the loop and awaits reconnection.
   */
  async processQueue() {
    if (this.isProcessingQueue) {
      console.log('[WhatsApp Queue] Processor already active. Skipping duplicate run.');
      return;
    }
    if (!this.isConnected || !this.sock) {
      console.log('[WhatsApp Queue] WhatsApp client not connected. Queue processor awaiting connection.');
      return;
    }
    if (!this.pool) {
      console.warn('[WhatsApp Queue] Database pool missing, cannot process queue.');
      return;
    }

    this.isProcessingQueue = true;
    console.log('[WhatsApp Queue] ⚙️ Processing queued messages sequentially (FIFO)...');

    try {
      while (this.isConnected && this.sock) {
        // Fetch the oldest unsent message (FIFO)
        const fetchRes = await this.pool.query(
          `SELECT id, recipient, message_body, message_type, created_at
           FROM messages
           WHERE sent = false
           ORDER BY created_at ASC
           LIMIT 1`
        );

        if (!fetchRes.rows || fetchRes.rows.length === 0) {
          console.log('[WhatsApp Queue] 🏁 No more unsent messages. Queue processing complete.');
          break;
        }

        const msg = fetchRes.rows[0];
        console.log(`[WhatsApp Queue] 📤 Dispatching message #${msg.id} to ${msg.recipient}...`);

        const sentSuccess = await this.dispatchRawMessage(msg.recipient, msg.message_body);

        if (sentSuccess) {
          // 1. Mark sent = true
          await this.pool.query('UPDATE messages SET sent = true WHERE id = $1', [msg.id]);
          console.log(`[WhatsApp Queue] ✅ Message #${msg.id} successfully sent and marked sent = true.`);

          // 2. Immediately delete records where sent = true to keep DB lightweight and clean
          await this.pool.query('DELETE FROM messages WHERE sent = true');
          console.log(`[WhatsApp Queue] 🧹 Auto-cleaned sent message records from DB.`);

          // 3. Safe 1.5s delay between sequential messages to avoid rate-limiting/spam flags
          await new Promise(resolve => setTimeout(resolve, 1500));
        } else {
          // Sending failed (e.g. connection lost or socket error)
          console.warn(`[WhatsApp Queue] ⛔ Delivery failed for message #${msg.id}. Halting queue loop. Message retained for reconnection.`);
          // Do not delete, keep sent = false, break loop to wait for reconnection
          break;
        }
      }
    } catch (err) {
      console.error('[WhatsApp Queue] ❌ Error during queue processing:', err.message);
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Low-level socket dispatch method
   */
  async dispatchRawMessage(toPhone, message) {
    if (!this.sock || !this.isConnected) {
      console.warn('[WhatsApp] Cannot dispatch: socket not connected.');
      return false;
    }
    const jid = this.formatPhone(toPhone);
    if (!jid) {
      console.warn('[WhatsApp] Cannot dispatch: Invalid phone number:', toPhone);
      return false;
    }
    try {
      await this.sock.sendMessage(jid, { text: message });
      console.log(`[WhatsApp] ✉️ Direct message delivered to ${jid}`);
      return true;
    } catch (err) {
      console.error(`[WhatsApp] Failed to dispatch to ${jid}:`, err.message);
      return false;
    }
  }

  /**
   * Public send method - redirects to queuing system
   */
  async sendDirectMessage(toPhone, message) {
    const res = await this.enqueueMessage(toPhone, message, 'direct');
    return res.success;
  }

  /**
   * Order Placement Notification
   * Includes product links, removes packaging details, removes 'Artisanal Confections'
   */
  async notifyOrderPlaced(order) {
    const settings = await this.getStoreSettingsFromDB();
    const brand = settings.brand_name || 'SnackzTin';
    const baseUrl = process.env.STORE_URL || process.env.SITE_URL || process.env.APP_URL || process.env.BASE_URL || 'https://snackztin.web.app';
    const custPhone = order.customer?.phone;
    const custName = order.customer?.name || 'Valued Customer';

    let itemsArr = order.items;
    if (typeof itemsArr === 'string') {
      try { itemsArr = JSON.parse(itemsArr); } catch (_) { itemsArr = []; }
    }

    let itemsList = '  • Handcrafted Product Selection';
    if (Array.isArray(itemsArr) && itemsArr.length > 0) {
      itemsList = itemsArr.map(it => {
        const pid = it.id || it.product_id || it.productId;
        const link = pid ? `\n    🔗 Link: ${baseUrl}/product/${pid}` : '';
        return `  • ${it.title} (${it.variant || it.weight || 'Standard'}) x ${it.quantity} - ₹${it.price * it.quantity}${link}`;
      }).join('\n');
    }

    const giftMsg = order.gift_message ? `\n🎁 *Gift Card Note:*\n"${order.gift_message}"\n` : '';

    const customerMsg =
`🍫 *${brand.toUpperCase()} — ORDER CONFIRMED!*
━━━━━━━━━━━━━━━━━━━━━━
Dear *${custName}*, thank you for choosing ${brand}! We have received your order.

📦 *Order ID:* #${order.order_number}
📅 *Status:* Received & In Preparation

🛒 *Your Selection:*
${itemsList}

💰 *Total Amount:* ₹${order.total_amount}
💳 *Payment:* ${order.payment_method || 'WhatsApp Order / COD'}
${giftMsg}
📍 *Delivering To:*
${order.customer?.address || ''}, ${order.customer?.city || ''} - ${order.customer?.pincode || ''}

━━━━━━━━━━━━━━━━━━━━━━
Need help? Reply directly to this chat.
_${brand}_`;

    if (custPhone) {
      await this.enqueueMessage(custPhone, customerMsg, 'order_placed');
    }

    // Also notify Admin if configured
    const adminPhone = settings.whatsapp_number;
    if (adminPhone && adminPhone !== custPhone) {
      const adminMsg =
`🚨 *NEW ORDER ALERT — ${brand.toUpperCase()}*
━━━━━━━━━━━━━━━━━━━━━━
📦 *Order:* #${order.order_number}
👤 *Customer:* ${custName} (${custPhone})
📍 *City:* ${order.customer?.city || 'N/A'} - ${order.customer?.pincode || ''}
${giftMsg}
🛒 *Items:*
${itemsList}

💵 *Total:* ₹${order.total_amount}
Please check the Admin Portal to manage and dispatch this order.`;

      await this.enqueueMessage(adminPhone, adminMsg, 'order_alert');
    }
  }

  /**
   * Order Status Update Notification
   * Includes product links, removes packaging details, removes 'Artisanal Confections'
   */
  async notifyOrderStatus(order, newStatus, customNote = '') {
    const settings = await this.getStoreSettingsFromDB();
    const brand = settings.brand_name || 'SnackzTin';
    const baseUrl = process.env.STORE_URL || process.env.SITE_URL || process.env.APP_URL || process.env.BASE_URL || 'https://snackztin.web.app';
    const custPhone = order.customer?.phone;
    if (!custPhone) return;

    let statusEmoji = '📦';
    let statusDesc = '';

    switch (newStatus.toLowerCase()) {
      case 'confirmed':
        statusEmoji = '✅';
        statusDesc = 'Your order has been confirmed and is being scheduled for production.';
        break;
      case 'packing in cold box':
      case 'preparing':
      case 'processing':
        statusEmoji = '🍫';
        statusDesc = 'Your order is handcrafted, freshly prepared, and packed for safe transit.';
        break;
      case 'shipped':
      case 'dispatched':
        statusEmoji = '🚚';
        statusDesc = 'Your package is out for express delivery!';
        break;
      case 'delivered':
        statusEmoji = '🎉';
        statusDesc = 'Your order has been delivered! We hope you and your loved ones enjoy it.';
        break;
      case 'cancelled':
        statusEmoji = '❌';
        statusDesc = 'Your order has been cancelled. If you have any questions, please let us know.';
        break;
      default:
        statusDesc = `Your order status has been updated to: ${newStatus}`;
    }

    let itemsArr = order.items;
    if (typeof itemsArr === 'string') {
      try { itemsArr = JSON.parse(itemsArr); } catch (_) { itemsArr = []; }
    }

    let itemsSection = '';
    if (Array.isArray(itemsArr) && itemsArr.length > 0) {
      itemsSection = '\n\n🛒 *Products Ordered:*\n' + itemsArr.map(it => {
        const pid = it.id || it.product_id || it.productId;
        const link = pid ? `\n   🔗 Link: ${baseUrl}/product/${pid}` : '';
        return ` • ${it.title} (${it.variant || it.weight || 'Standard'}) x ${it.quantity}${link}`;
      }).join('\n');
    }

    const noteText = customNote ? `\n\n📝 *Note from Store:* ${customNote}` : '';

    const msg =
`${statusEmoji} *${brand.toUpperCase()} — ORDER UPDATE*
━━━━━━━━━━━━━━━━━━━━━━
Hello *${order.customer?.name || 'Customer'}*,

📦 *Order ID:* #${order.order_number}
🔖 *Current Status:* *${newStatus.toUpperCase()}*

${statusDesc}${itemsSection}${noteText}

━━━━━━━━━━━━━━━━━━━━━━
Thank you for shopping with *${brand}*!
_${brand}_`;

    await this.enqueueMessage(custPhone, msg, 'status_update');
  }

  async disconnect() {
    try {
      if (this.sock) {
        await this.sock.logout();
        this.sock.end();
        this.sock = null;
      }
      this.isConnected = false;
      this.currentQR = null;
      this.connectedPhone = null;
      if (this.authManager && typeof this.authManager.clearSession === 'function') {
        await this.authManager.clearSession().catch(() => {});
      }
      if (fs.existsSync(AUTH_FOLDER)) {
        fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
      }
      console.log('[WhatsApp] Disconnected & session cleared.');
    } catch (err) {
      console.error('[WhatsApp] Disconnect error:', err);
    }
  }

  async getQueueStatus() {
    if (!this.pool) return { unsentCount: 0, items: [] };
    try {
      const res = await this.pool.query(
        'SELECT id, recipient, message_type, sent, created_at FROM messages WHERE sent = false ORDER BY created_at ASC'
      );
      return {
        unsentCount: res.rows.length,
        items: res.rows
      };
    } catch (err) {
      return { unsentCount: 0, error: err.message };
    }
  }
}

const instance = new WhatsAppService();
module.exports = instance;
