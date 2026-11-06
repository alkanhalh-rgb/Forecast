'use client';
import { createContext, useContext } from 'react';
import useSWR, { type KeyedMutator } from 'swr';
import { ApiError, fetcher } from './api';

export interface Me {
  id: string;
  nickname: string | null;
  city: string | null;
  interests: string[];
  role: 'USER' | 'EDITOR' | 'REVIEWER' | 'ADMIN';
  ageConfirmed: boolean;
  onboarded: boolean;
}

interface SessionValue {
  me: Me | null;
  loading: boolean;
  refresh: KeyedMutator<Me | null>;
  socketUrl: string;
}

const Ctx = createContext<SessionValue | null>(null);

export function SessionProvider({ children, socketUrl }: { children: React.ReactNode; socketUrl: string }) {
  const { data, isLoading, mutate } = useSWR<Me | null>('/me', async (p: string) => {
    try {
      return await fetcher(p);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return null;
      throw e;
    }
  });
  return <Ctx.Provider value={{ me: data ?? null, loading: isLoading, refresh: mutate, socketUrl }}>{children}</Ctx.Provider>;
}

export function useSession() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession outside provider');
  return v;
}

export const isStaff = (me: Me | null) => !!me && ['EDITOR', 'REVIEWER', 'ADMIN'].includes(me.role);
