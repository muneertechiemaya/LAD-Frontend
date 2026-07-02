/**
 * Personal WhatsApp proxy (catch-all)
 * /api/personal-whatsapp/*  →  LAD-WAPA-Comms  /api/personal-whatsapp/*
 *
 * The Settings → Integrations → WhatsApp page (WhatsAppIntegration.tsx) and the
 * personal-WA settings calls (accounts/status, QR, auto-assign, contacts, logout,
 * team workload, bulk-assign) all hit /api/personal-whatsapp/*. Those endpoints
 * live on the WAPA service, which VERIFIES the JWT — so when the browser only
 * sends a cookie we lift it into an Authorization header (same as the media proxy).
 *
 * Without this route the status fetch 404s and the UI shows "Disconnected" even
 * while WAPA holds a live Baileys session.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getWAPAServiceUrl } from '../../whatsapp-conversations/utils/python-proxy';

function extractTenantIdFromJwt(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    return payload.tenantId || payload.tenant_id || payload.organizationId || payload.orgId || null;
  } catch {
    return null;
  }
}

async function proxy(req: NextRequest, pathParts: string[]): Promise<Response> {
  const base = getWAPAServiceUrl().replace(/\/+$/, '');
  const url = new URL(`/api/personal-whatsapp/${pathParts.join('/')}`, base);
  req.nextUrl.searchParams.forEach((value, key) => url.searchParams.set(key, value));

  const headers: Record<string, string> = {
    'Content-Type': req.headers.get('content-type') || 'application/json',
  };

  // Auth: forward the bearer token, or lift it from the cookie (WAPA verifies JWT).
  const authHeader = req.headers.get('authorization');
  const token =
    (authHeader ? authHeader.replace('Bearer ', '') : null) ||
    req.cookies.get('access_token')?.value ||
    req.cookies.get('token')?.value ||
    null;
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    const tenantId = extractTenantIdFromJwt(token);
    if (tenantId) headers['X-Tenant-ID'] = tenantId;
  }
  const directTenant = req.headers.get('x-tenant-id');
  if (directTenant) headers['X-Tenant-ID'] = directTenant;

  const init: RequestInit = { method: req.method, headers };
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    try {
      const body = await req.text();
      if (body) init.body = body;
    } catch {
      /* no body */
    }
  }

  try {
    const resp = await fetch(url.toString(), init);
    const contentType = resp.headers.get('content-type') || 'application/octet-stream';
    const buf = await resp.arrayBuffer();
    return new NextResponse(buf, { status: resp.status, headers: { 'Content-Type': contentType } });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to reach personal WhatsApp service' },
      { status: 502 },
    );
  }
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, ctx: Ctx) { return proxy(req, (await ctx.params).path); }
export async function POST(req: NextRequest, ctx: Ctx) { return proxy(req, (await ctx.params).path); }
export async function PUT(req: NextRequest, ctx: Ctx) { return proxy(req, (await ctx.params).path); }
export async function PATCH(req: NextRequest, ctx: Ctx) { return proxy(req, (await ctx.params).path); }
export async function DELETE(req: NextRequest, ctx: Ctx) { return proxy(req, (await ctx.params).path); }
