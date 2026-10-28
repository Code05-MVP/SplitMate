
import { io, type Socket } from 'socket.io-client';

const REALTIME_URL = 'http://localhost:3000/realtime';

export function createRealtimeSocket(accessToken: string): Socket {
  return io(REALTIME_URL, {
    auth: {
      token: accessToken,
    },
    transports: ['websocket'],
    autoConnect: false,
  });
}
