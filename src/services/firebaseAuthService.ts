import { firebaseConfig, isFirebaseConfigured } from './firebaseConfig';

export interface FirebaseUserSession {
  uid: string;
  email: string;
  displayName: string;
  idToken: string;
  refreshToken?: string;
  role: 'owner' | 'developer' | 'viewer';
  plan: 'free' | 'pro' | 'business';
  isAnonymous: boolean;
  tokenExpiresAt: number;
}

export class FirebaseAuthService {
  private currentSession: FirebaseUserSession | null = null;
  private tokenRefreshTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.restoreSessionFromStorage();
  }

  /**
   * Register a new user with Email and Password
   */
  async signUp(params: {
    email: string;
    password: string;
    displayName: string;
  }): Promise<{ success: boolean; session?: FirebaseUserSession; error?: string }> {
    try {
      if (!params.email || !params.email.includes('@')) {
        return { success: false, error: 'Valid email address required' };
      }
      if (!params.password || params.password.length < 8) {
        return { success: false, error: 'Password must be at least 8 characters' };
      }

      // If live Firebase credentials are configured and not running in test mode:
      if (isFirebaseConfigured() && typeof process !== 'undefined' && process.env?.NODE_ENV !== 'test') {
        const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(firebaseConfig.apiKey)}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: params.email.trim().toLowerCase(),
            password: params.password,
            returnSecureToken: true,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          const code = data?.error?.message || 'SIGNUP_FAILED';
          if (code.includes('EMAIL_EXISTS')) {
            return { success: false, error: 'An account with this email address already exists.' };
          }
          if (code.includes('OPERATION_NOT_ALLOWED')) {
            return { success: false, error: 'Email/Password sign-in is not enabled in Firebase Console.' };
          }
          if (code.includes('TOO_MANY_ATTEMPTS_TRY_LATER')) {
            return { success: false, error: 'Too many requests. Please try again later.' };
          }
          return { success: false, error: `Firebase sign-up failed: ${code}` };
        }

        const now = Date.now();
        const expiresInSec = parseInt(data.expiresIn || '3600', 10);
        const session: FirebaseUserSession = {
          uid: data.localId,
          email: params.email.trim().toLowerCase(),
          displayName: params.displayName || params.email.split('@')[0],
          idToken: data.idToken,
          refreshToken: data.refreshToken,
          role: 'developer',
          plan: 'free',
          isAnonymous: false,
          tokenExpiresAt: now + expiresInSec * 1000,
        };

        this.saveSession(session);
        return { success: true, session };
      }

      // Offline / Test environment fallback
      const uid = `usr_${Math.random().toString(36).substring(2, 10)}`;
      const now = Date.now();
      const expiresAt = now + 3600 * 1000;

      const session: FirebaseUserSession = {
        uid,
        email: params.email.toLowerCase(),
        displayName: params.displayName || params.email.split('@')[0],
        idToken: `fb_id_token_${uid}_${now}`,
        role: 'developer',
        plan: 'free',
        isAnonymous: false,
        tokenExpiresAt: expiresAt,
      };

      this.saveSession(session);
      return { success: true, session };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  /**
   * Log in with Email and Password
   */
  async signIn(params: {
    email: string;
    password: string;
  }): Promise<{ success: boolean; session?: FirebaseUserSession; error?: string }> {
    try {
      if (!params.email || !params.password) {
        return { success: false, error: 'Email and password required' };
      }

      if (isFirebaseConfigured() && typeof process !== 'undefined' && process.env?.NODE_ENV !== 'test') {
        const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(firebaseConfig.apiKey)}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: params.email.trim().toLowerCase(),
            password: params.password,
            returnSecureToken: true,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          const code = data?.error?.message || 'SIGNIN_FAILED';
          if (code.includes('EMAIL_NOT_FOUND') || code.includes('INVALID_PASSWORD') || code.includes('INVALID_LOGIN_CREDENTIALS')) {
            return { success: false, error: 'Invalid email or password.' };
          }
          if (code.includes('USER_DISABLED')) {
            return { success: false, error: 'This user account has been disabled by an administrator.' };
          }
          if (code.includes('TOO_MANY_ATTEMPTS_TRY_LATER')) {
            return { success: false, error: 'Access to this account has been temporarily disabled due to many failed login attempts.' };
          }
          return { success: false, error: `Authentication failed: ${code}` };
        }

        const now = Date.now();
        const expiresInSec = parseInt(data.expiresIn || '3600', 10);
        const session: FirebaseUserSession = {
          uid: data.localId,
          email: params.email.trim().toLowerCase(),
          displayName: data.displayName || params.email.split('@')[0],
          idToken: data.idToken,
          refreshToken: data.refreshToken,
          role: 'developer',
          plan: 'free',
          isAnonymous: false,
          tokenExpiresAt: now + expiresInSec * 1000,
        };

        this.saveSession(session);
        return { success: true, session };
      }

      const uid = `usr_${Math.random().toString(36).substring(2, 10)}`;
      const now = Date.now();
      const expiresAt = now + 3600 * 1000;

      const session: FirebaseUserSession = {
        uid,
        email: params.email.toLowerCase(),
        displayName: params.email.split('@')[0],
        idToken: `fb_id_token_${uid}_${now}`,
        role: 'developer',
        plan: 'free',
        isAnonymous: false,
        tokenExpiresAt: expiresAt,
      };

      this.saveSession(session);
      return { success: true, session };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  /**
   * Request Password Reset Email
   */
  async resetPassword(email: string): Promise<{ success: boolean; error?: string }> {
    if (!email || !email.includes('@')) {
      return { success: false, error: 'Valid email address required' };
    }
    if (isFirebaseConfigured() && typeof process !== 'undefined' && process.env?.NODE_ENV !== 'test') {
      try {
        const url = `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${encodeURIComponent(firebaseConfig.apiKey)}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requestType: 'PASSWORD_RESET',
            email: email.trim().toLowerCase(),
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          return { success: false, error: data?.error?.message || 'Failed to send password reset email' };
        }
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    }
    return { success: true };
  }

  /**
   * Log out and invalidate local session
   */
  async signOut(): Promise<void> {
    this.currentSession = null;
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
      this.tokenRefreshTimer = null;
    }
    try {
      sessionStorage.removeItem('lodhi_firebase_session');
    } catch {}
  }

  /**
   * Get current authenticated user session
   */
  getCurrentUser(): FirebaseUserSession | null {
    if (!this.currentSession) return null;
    if (Date.now() > this.currentSession.tokenExpiresAt) {
      // Token expired, needs refresh
      this.refreshIdToken();
    }
    return this.currentSession;
  }

  /**
   * Retrieve active ID Token for Cloud Relay or API requests
   */
  async getIdToken(forceRefresh = false): Promise<string | null> {
    if (!this.currentSession) return null;
    if (forceRefresh || Date.now() > this.currentSession.tokenExpiresAt - 300000) {
      await this.refreshIdToken();
    }
    return this.currentSession?.idToken || null;
  }

  private async refreshIdToken(): Promise<void> {
    if (!this.currentSession) return;
    const now = Date.now();

    if (this.currentSession.refreshToken && isFirebaseConfigured() && typeof process !== 'undefined' && process.env?.NODE_ENV !== 'test') {
      try {
        const url = `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(firebaseConfig.apiKey)}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(this.currentSession.refreshToken)}`,
        });
        if (res.ok) {
          const data = await res.json();
          const expiresInSec = parseInt(data.expires_in || '3600', 10);
          this.currentSession.idToken = data.id_token;
          if (data.refresh_token) {
            this.currentSession.refreshToken = data.refresh_token;
          }
          this.currentSession.tokenExpiresAt = now + expiresInSec * 1000;
          this.saveSession(this.currentSession);
          return;
        }
      } catch {}
    }

    this.currentSession.tokenExpiresAt = now + 3600 * 1000;
    this.currentSession.idToken = `fb_id_token_${this.currentSession.uid}_${now}`;
    this.saveSession(this.currentSession);
  }

  private saveSession(session: FirebaseUserSession): void {
    this.currentSession = session;
    try {
      sessionStorage.setItem('lodhi_firebase_session', JSON.stringify(session));
    } catch {}
  }

  private restoreSessionFromStorage(): void {
    try {
      const stored = sessionStorage.getItem('lodhi_firebase_session');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.uid && parsed.tokenExpiresAt > Date.now()) {
          this.currentSession = parsed;
        }
      }
    } catch {}
  }
}

export const globalFirebaseAuth = new FirebaseAuthService();
