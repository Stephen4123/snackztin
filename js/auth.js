/**
 * SnackzTin Customer Authentication Service
 * Pure PostgreSQL backend authentication with secure bcrypt password hashing,
 * HTTP-only cookie sessions + JWT token fallback, persistent login, and customer profile management.
 */

class AuthService {
  constructor() {
    this.currentUser = null;
    this.token = localStorage.getItem('snackztin_token') || null;
    this.authListeners = [];

    // Load persisted local user profile
    const saved = localStorage.getItem('snackztin_user');
    if (saved) {
      try {
        this.currentUser = JSON.parse(saved);
      } catch (e) {
        this.currentUser = null;
      }
    }

    // Check persistent session with backend on startup
    this.checkSession();
  }

  getToken() {
    return this.token || localStorage.getItem('snackztin_token') || null;
  }

  getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  onAuthStateChanged(callback) {
    this.authListeners.push(callback);
    callback(this.currentUser);
    return () => {
      this.authListeners = this.authListeners.filter(cb => cb !== callback);
    };
  }

  _saveAndNotify(user, token) {
    this.currentUser = user;
    if (token !== undefined) {
      this.token = token;
      if (token) {
        localStorage.setItem('snackztin_token', token);
      } else {
        localStorage.removeItem('snackztin_token');
      }
    }

    if (this.currentUser) {
      localStorage.setItem('snackztin_user', JSON.stringify(this.currentUser));
    } else {
      localStorage.removeItem('snackztin_user');
      localStorage.removeItem('snackztin_token');
      this.token = null;
    }

    this.authListeners.forEach(cb => {
      try { cb(this.currentUser); } catch (e) { console.error('Auth listener error:', e); }
    });
  }

  async checkSession() {
    try {
      const url = typeof apiUrl === 'function' ? apiUrl('/api/auth/me') : '/api/auth/me';
      const res = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders(),
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.user) {
          this._saveAndNotify(data.user);
          return data.user;
        }
      }
      if (res.status === 401 && this.currentUser) {
        this._saveAndNotify(null, null);
      }
    } catch (err) {
      console.warn('Session verification error:', err.message);
    }
    return this.currentUser;
  }

  async login(emailOrPhone, password) {
    const cleanInput = (emailOrPhone || '').trim();
    const cleanPassword = (password || '').trim();

    if (!cleanInput || !cleanPassword) {
      return { success: false, error: 'Mobile number or email and password are required.' };
    }

    try {
      const url = typeof apiUrl === 'function' ? apiUrl('/api/auth/login') : '/api/auth/login';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: cleanInput, phoneOrEmail: cleanInput, password: cleanPassword })
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        this._saveAndNotify(data.user, data.token);
        return { success: true, user: data.user, token: data.token };
      } else {
        return { success: false, error: data.error || 'Invalid mobile number/email or password.' };
      }
    } catch (err) {
      console.error('Login network error:', err);
      return { success: false, error: 'Failed to connect to authentication server. Please try again.' };
    }
  }

  async register(userData) {
    if (!userData.name || !userData.phone || !userData.password) {
      return { success: false, error: 'Full name, mobile number, and password are required.' };
    }

    try {
      const url = typeof apiUrl === 'function' ? apiUrl('/api/auth/register') : '/api/auth/register';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(userData)
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        this._saveAndNotify(data.user, data.token);
        return { success: true, user: data.user, token: data.token };
      } else {
        return { success: false, error: data.error || 'Registration failed.' };
      }
    } catch (err) {
      console.error('Registration network error:', err);
      return { success: false, error: 'Failed to connect to registration server. Please try again.' };
    }
  }

  async logout() {
    try {
      const url = typeof apiUrl === 'function' ? apiUrl('/api/auth/logout') : '/api/auth/logout';
      await fetch(url, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        credentials: 'include'
      }).catch(() => {});
    } catch (_) {}

    this._saveAndNotify(null, null);
    return true;
  }

  async forgotPassword(emailOrPhone) {
    try {
      const url = typeof apiUrl === 'function' ? apiUrl('/api/auth/forgot-password') : '/api/auth/forgot-password';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: (emailOrPhone || '').trim(), phoneOrEmail: (emailOrPhone || '').trim() })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        return { success: true, message: data.message, resetToken: data.resetToken };
      } else {
        return { success: false, error: data.error || 'Failed to initiate password reset.' };
      }
    } catch (err) {
      return { success: false, error: 'Network error connecting to reset service.' };
    }
  }

  async resetPassword(payload) {
    try {
      const url = typeof apiUrl === 'function' ? apiUrl('/api/auth/reset-password') : '/api/auth/reset-password';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: payload.emailOrPhone,
          phoneOrEmail: payload.emailOrPhone,
          resetToken: payload.resetToken,
          newPassword: payload.newPassword
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        return { success: true, message: data.message };
      } else {
        return { success: false, error: data.error || 'Failed to reset password.' };
      }
    } catch (err) {
      return { success: false, error: 'Connection error while resetting password.' };
    }
  }

  isAuthenticated() {
    return Boolean(this.currentUser && this.currentUser.id);
  }

  getUser() {
    return this.currentUser;
  }
}

window.authService = new AuthService();
