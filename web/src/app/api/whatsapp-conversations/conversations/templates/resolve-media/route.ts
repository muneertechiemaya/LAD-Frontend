/**
 * Resolve a Meta media upload handle to a download URL.
 * GET /api/whatsapp-conversations/conversations/templates/resolve-media?handle=...&channel=waba
 */
import { NextRequest, NextResponse } from 'next/server';
import { getWABAServiceUrl } from '../../../utils/python-proxy';

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

export async function GET(req: NextRequest) {
  const handle = req.nextUrl.searchParams.get('handle');
  if (!handle) {
    return NextResponse.json({ success: false, error: 'handle is required' }, { status: 400 });
  }

  const wabaUrl = getWABAServiceUrl();
  const url = new URL('/api/conversations/templates/resolve-media', wabaUrl);
  url.searchParams.set('handle', handle);

  const headers: Record<string, string> = {};
  const authHeader = req.headers.get('authorization');
  if (authHeader) {
    headers.Authorization = authHeader;
    const tenantId = extractTenantIdFromJwt(authHeader.replace('Bearer ', ''));
    if (tenantId) headers['X-Tenant-ID'] = tenantId;
  }
  const directTenantId = req.headers.get('x-tenant-id');
  if (directTenantId) headers['X-Tenant-ID'] = directTenantId;
  if (!headers['X-Tenant-ID']) {
    const cookieToken = req.cookies.get('access_token')?.value || req.cookies.get('token')?.value;
    if (cookieToken) {
      const tenantId = extractTenantIdFromJwt(cookieToken);
      if (tenantId) headers['X-Tenant-ID'] = tenantId;
    }
  }

  try {
    const response = await fetch(url.toString(), { headers });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[resolve-media proxy] Error:', error);
    return NextResponse.json({ success: false, url: null, error: 'Failed to resolve media' }, { status: 502 });
  }
}
