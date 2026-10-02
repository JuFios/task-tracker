import { io, type Socket } from 'socket.io-client';
import { api } from './api';
import type { AuthResult } from '../types';
import { useAuthStore, authChannel, forceLogout } from '../stores/auth';

let socket: Socket | null = null;

function socketOrigin(): string {
  const baseURL: string = import.meta.env.VITE_API_URL ?? '/api';
  if (baseURL.startsWith('http')) return new URL(baseURL).origin;
  return window.location.origin;
}

/**
 * Shared socket for the whole SPA. The auth token is read via a callback on
 * every (re)connect, so reconnects after a token rotation keep working.
 *
 * Also handles reconnection after access token expiration by:
 * 1. Listening to auth token updates from other tabs (BroadcastChannel).
 * 2. Proactively triggering a token refresh on connect_error (unauthorized).
 */
export function getSocket(): Socket {
  if (!socket) {
    socket = io(socketOrigin(), {
      auth: (cb) => cb({ token: useAuthStore.getState().accessToken }),
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      // Allow enough attempts to survive a token refresh cycle.
      reconnectionAttempts: 10,
    });

    // When the socket fails to connect with an auth error, attempt a token
    // refresh so the next reconnect attempt carries a valid token.
    socket.on('connect_error', (err) => {
      const message = (err as Error & { message?: string }).message ?? '';
      if (
        message.toLowerCase().includes('unauthorized') ||
        message.toLowerCase().includes('invalid') ||
        message.toLowerCase().includes('missing')
      ) {
        const { refreshToken } = useAuthStore.getState();
        if (refreshToken) {
          // Trigger an API refresh — this will update the store and broadcast
          // TOKEN_UPDATED so the BroadcastChannel handler reconnects the socket.
          void api
            .post<AuthResult>('/auth/refresh', { refreshToken })
            .then(({ data }) => {
              useAuthStore.getState().setAuth(data);
            })
            .catch(() => {
              // Refresh failed — force logout
              forceLogout();
            });
        }
      }
    });

    // Reconnect with new token when it's updated (e.g., after refresh)
    // Avoid double-registering if getSocket is called multiple times.
    authChannel.addEventListener('message', (event) => {
      if (event.data.type === 'TOKEN_UPDATED' && socket) {
        // Reconnect with the new token
        socket.auth = { token: event.data.data.accessToken };
        socket.disconnect().connect();
      } else if (event.data.type === 'LOGOUT' && socket) {
        socket.disconnect();
      }
    });
  }
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
