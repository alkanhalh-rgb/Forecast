'use client';
import { api } from './api';

function b64ToBytes(b64: string) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function pushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
}

/** Asks for permission and registers this browser for Web Push. */
export async function enablePush(): Promise<boolean> {
  if (!pushSupported()) return false;
  const { key } = await api<{ key: string | null }>('/push/public-key');
  if (!key) return false;
  if ((await Notification.requestPermission()) !== 'granted') return false;
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) });
  await api('/push/subscribe', { body: sub.toJSON() });
  return true;
}
