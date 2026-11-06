import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { loadConfig } from '../config';

export function hashPhone(e164: string): string {
  return createHmac('sha256', loadConfig().PHONE_PEPPER).update(e164).digest('hex');
}

export function encryptPhone(e164: string): string {
  const key = Buffer.from(loadConfig().PHONE_ENC_KEY, 'hex');
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([c.update(e164, 'utf8'), c.final()]);
  return [iv.toString('base64'), c.getAuthTag().toString('base64'), enc.toString('base64')].join('.');
}

export function decryptPhone(payload: string): string {
  const [iv, tag, enc] = payload.split('.');
  const key = Buffer.from(loadConfig().PHONE_ENC_KEY, 'hex');
  const d = createDecipheriv('aes-256-gcm', key, Buffer.from(iv!, 'base64'));
  d.setAuthTag(Buffer.from(tag!, 'base64'));
  return Buffer.concat([d.update(Buffer.from(enc!, 'base64')), d.final()]).toString('utf8');
}

export function otpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function inviteCode(len = 8): string {
  let s = '';
  for (let i = 0; i < len; i++) s += ALPHABET[randomInt(0, ALPHABET.length)];
  return s;
}
