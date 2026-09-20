import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '../api/client';
import { useAuth } from './AuthContext';

const SocketContext = createContext<Socket | null>(null);

/**
 * Owns a single Socket.io connection for the whole app while the user is
 * authenticated (per docs/API_CONTRACT.md: auth via `socket.handshake.auth.token`).
 * Used by ChatScreen (conversation rooms) and ProfileScreen (live notification badge).
 */
export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!token) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocket(null);
      return;
    }

    const instance = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
    });
    socketRef.current = instance;
    setSocket(instance);

    return () => {
      instance.disconnect();
      socketRef.current = null;
      setSocket(null);
    };
  }, [token]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}

/** Returns the shared socket, or null while not yet connected/authenticated. */
export function useSocket(): Socket | null {
  return useContext(SocketContext);
}
