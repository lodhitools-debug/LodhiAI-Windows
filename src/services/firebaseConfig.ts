/**
 * Lodhi AI — Client Firebase Configuration & Initialization
 * Reads credentials securely from environment variables.
 * Falls back cleanly to local/offline emulator mode when credentials are not yet configured.
 */

export interface FirebaseClientConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  measurementId?: string;
  useEmulator: boolean;
  emulatorHost: string;
}

// Read from Vite environment variables (prefixed with VITE_)
export const firebaseConfig: FirebaseClientConfig = {
  apiKey: (import.meta as any).env?.VITE_FIREBASE_API_KEY || 'demo-lodhi-api-key',
  authDomain: (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN || 'lodhiai-cloud.firebaseapp.com',
  projectId: (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID || 'lodhiai-cloud',
  storageBucket: (import.meta as any).env?.VITE_FIREBASE_STORAGE_BUCKET || 'lodhiai-cloud.appspot.com',
  messagingSenderId: (import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID || '1234567890',
  appId: (import.meta as any).env?.VITE_FIREBASE_APP_ID || '1:1234567890:web:abcdef',
  measurementId: (import.meta as any).env?.VITE_FIREBASE_MEASUREMENT_ID,
  useEmulator: (import.meta as any).env?.VITE_USE_FIREBASE_EMULATOR === 'true',
  emulatorHost: (import.meta as any).env?.VITE_FIREBASE_EMULATOR_HOST || '127.0.0.1',
};

/**
 * Check whether valid production Firebase credentials have been configured
 */
export function isFirebaseConfigured(): boolean {
  return (
    Boolean((import.meta as any).env?.VITE_FIREBASE_API_KEY) &&
    (import.meta as any).env?.VITE_FIREBASE_API_KEY !== 'demo-lodhi-api-key'
  );
}
