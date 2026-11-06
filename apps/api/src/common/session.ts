import { jwtVerify, SignJWT } from 'jose';
import { loadConfig } from '../config';

export const SESSION_COOKIE = 'sid';
export const SESSION_DAYS = 30;

const key = () => new TextEncoder().encode(loadConfig().JWT_SECRET);

export async function signSession(userId: string): Promise<string> {
  return new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setSubject(userId).setIssuedAt().setExpirationTime(`${SESSION_DAYS}d`).sign(key());
}

export async function verifySession(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ['HS256'] });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

/** Reads the session from the cookie, or from `Authorization: Bearer` (API clients, tests). */
export function tokenFromRequest(req: { cookies?: Record<string, string>; headers: Record<string, string | string[] | undefined> }): string | null {
  const c = req.cookies?.[SESSION_COOKIE];
  if (c) return c;
  const h = req.headers.authorization;
  if (typeof h === 'string' && h.startsWith('Bearer ')) return h.slice(7);
  return null;
}
