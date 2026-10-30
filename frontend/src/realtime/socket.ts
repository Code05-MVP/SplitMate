
import { io, type Socket } from 'socket.io-client';

const REALTIME_URL = 'http://localhost:3000/realtime';

export function createRealtimeSocket(
  getAccessToken: () => string | null,
): Socket {
  const socket = io(REALTIME_URL, {
    auth: (callback) => {
      callback({ token: getAccessToken() });
    },
    transports: ['websocket'],
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    randomizationFactor: 0.5,
    timeout: 20000,
  });

  socket.on('connect', () => {
    console.log('[Socket Debug] Connected:', socket.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket Debug] Disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('[Socket Debug] Connection error:', error.message);
  });

  socket.io.on('reconnect_attempt', (attempt) => {
    console.log('[Socket Debug] Reconnection attempt:', attempt);
  });

  socket.io.on('reconnect', (attempt) => {
    console.log('[Socket Debug] Reconnected after attempts:', attempt);
  });

  socket.io.on('reconnect_error', (error) => {
    console.error('[Socket Debug] Reconnection error:', error.message);
  });

  socket.io.on('reconnect_failed', () => {
    console.error('[Socket Debug] Reconnection failed');
  });

  return socket;
}
