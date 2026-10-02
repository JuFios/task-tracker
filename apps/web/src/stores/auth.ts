import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthResult, SafeUser } from '../types';

interface AuthState {
  user: SafeUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  setAuth: (result: AuthResult) => void;
  clear: () => void;
}

// Broadcast channel for multi-tab synchronization.
// IMPORTANT: BroadcastChannel delivers messages to all OTHER contexts on the
// same origin — it does NOT deliver back to the sender. So a tab that calls
// postMessage will NOT receive its own message via onmessage.
// The loop bug was caused by believing it could self-loop, but the real issue
// was that setAuth/clear called inside onmessage would re-post the message,
// creating a chain across two actual tabs. Fix: use silent internal setters
// inside the channel handler so they don't broadcast again.
export const authChannel = new BroadcastChannel('task-tracker-auth');

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,

      setAuth: ({ user, accessToken, refreshToken }) => {
        set({ user, accessToken, refreshToken });
        // Notify OTHER tabs (not this one) about the new token
        authChannel.postMessage({
          type: 'TOKEN_UPDATED',
          data: { user, accessToken, refreshToken },
        });
      },

      clear: () => {
        set({ user: null, accessToken: null, refreshToken: null });
        // Notify OTHER tabs about logout
        authChannel.postMessage({ type: 'LOGOUT' });
      },
    }),
    { name: 'task-tracker.auth' }
  )
);

// Listen for auth events from OTHER tabs.
// Use `set` directly (not setAuth/clear) to avoid re-broadcasting.
authChannel.onmessage = (event: MessageEvent<{ type: string; data?: AuthResult }>) => {
  const { type, data } = event.data;
  if (type === 'TOKEN_UPDATED' && data) {
    // Silently update state — do NOT call setAuth() which would re-broadcast
    useAuthStore.setState({
      user: data.user,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    });
  } else if (type === 'LOGOUT') {
    // Silently clear state — do NOT call clear() which would re-broadcast
    useAuthStore.setState({ user: null, accessToken: null, refreshToken: null });
    if (!window.location.pathname.startsWith('/auth')) {
      window.location.assign('/auth/login');
    }
  }
};

export function forceLogout(): void {
  useAuthStore.getState().clear();
  if (!window.location.pathname.startsWith('/auth')) {
    window.location.assign('/auth/login');
  }
}
