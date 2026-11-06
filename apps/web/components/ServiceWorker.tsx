'use client';
import { useEffect } from 'react';

/** Registers the PWA service worker (offline shell + web push). */
export function ServiceWorker() {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  }, []);
  return null;
}
