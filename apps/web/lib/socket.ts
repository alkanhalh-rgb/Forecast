'use client';
import { useEffect } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useSession } from './session';

let socket: Socket | null = null;
let socketFor = '';

function getSocket(url: string): Socket {
  if (!socket || socketFor !== url) {
    socket?.disconnect();
    socket = io(url || undefined, { withCredentials: true, transports: ['websocket', 'polling'] });
    socketFor = url;
  }
  return socket;
}

/** Live crowd updates for a question; the server only joins users who already forecast. */
export function useCrowdLive(questionId: string, enabled: boolean, onCrowd: (c: { total: number; shares: Record<string, number> }) => void) {
  const { socketUrl } = useSession();
  useEffect(() => {
    if (!enabled) return;
    const s = getSocket(socketUrl);
    const handler = (d: { questionId: string; total: number; shares: Record<string, number> }) => {
      if (d.questionId === questionId) onCrowd(d);
    };
    const sub = () => s.emit('subscribe', { questionId });
    s.on('crowd', handler);
    s.on('connect', sub);
    if (s.connected) sub();
    return () => {
      s.off('crowd', handler);
      s.off('connect', sub);
      s.emit('unsubscribe', { questionId });
    };
  }, [questionId, enabled, socketUrl, onCrowd]);
}
