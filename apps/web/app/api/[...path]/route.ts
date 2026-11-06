import type { NextRequest } from 'next/server';

/**
 * Runtime proxy to the NestJS API so the browser talks to one origin (cookies stay first-party).
 * In production a reverse proxy can route /api directly to the API service instead.
 */
const API = () => process.env.API_INTERNAL_URL ?? 'http://localhost:4000';
const HOP = new Set(['connection', 'keep-alive', 'transfer-encoding', 'host', 'content-length', 'accept-encoding']);

async function proxy(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const url = `${API()}/api/${path.map(encodeURIComponent).join('/')}${req.nextUrl.search}`;
  const headers = new Headers();
  req.headers.forEach((v, k) => {
    if (!HOP.has(k)) headers.set(k, v);
  });
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) headers.set('x-forwarded-for', fwd);
  const hasBody = !['GET', 'HEAD'].includes(req.method);
  const res = await fetch(url, { method: req.method, headers, body: hasBody ? await req.arrayBuffer() : undefined, redirect: 'manual', cache: 'no-store' });
  const out = new Headers();
  res.headers.forEach((v, k) => {
    if (!HOP.has(k) && k !== 'set-cookie' && k !== 'content-encoding') out.set(k, v);
  });
  for (const c of res.headers.getSetCookie()) out.append('set-cookie', c);
  return new Response(res.body, { status: res.status, headers: out });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const dynamic = 'force-dynamic';
