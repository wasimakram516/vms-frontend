import { useSocket as useSocketContext } from '@/contexts/SocketContext';
import { useEffect, useState } from 'react';

/**
 * Registers event handlers on the single authenticated application socket.
 *
 * @param {Record<string, (payload: unknown) => void>} events Event handlers keyed by event name.
 * @returns {{socket: import('socket.io-client').Socket|null, connected: boolean, connectionError: string|null}}
 */
const useSocket = (events = {}) => {
  const { socket, connected } = useSocketContext();
  const [connectionError, setConnectionError] = useState(null);

  useEffect(() => {
    if (!socket) return undefined;

    const handleConnectionError = (error) => {
      setConnectionError(error?.message || 'Realtime connection failed');
    };
    const clearConnectionError = () => setConnectionError(null);

    socket.on('connect', clearConnectionError);
    socket.on('connect_error', handleConnectionError);
    for (const [event, handler] of Object.entries(events)) {
      socket.on(event, handler);
    }

    return () => {
      socket.off('connect', clearConnectionError);
      socket.off('connect_error', handleConnectionError);
      for (const [event, handler] of Object.entries(events)) {
        socket.off(event, handler);
      }
    };
  }, [events, socket]);

  return { socket, connected, connectionError };
};

export default useSocket;
