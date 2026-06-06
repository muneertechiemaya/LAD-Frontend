/**
 * Template Media Upload Proxy (multipart)
 *   channel=personal → LAD_backend Node.js at /api/whatsapp-conversations/conversations/templates/upload-media
 *   channel=waba     → LAD-WABA-Comms Python at /api/conversations/templates/upload-media
 *
 * proxyToPythonService() forces Content-Type: application/json and reads the body as text,
 * which breaks multipart/form-data. This handler streams the raw body and preserves the
 * multipart Content-Type header (including the boundary) for both channels.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl, getWABAServiceUrl } from '../../../utils/python-proxy';

export const maxDuration = 300;

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

export async function POST(req: NextRequest) {
  const channel = req.nextUrl.searchParams.get('channel') || 'waba';

  let targetUrl: string;
  if (channel === 'personal') {
    targetUrl = new URL(
      '/api/whatsapp-conversations/conversations/templates/upload-media',
      getBackendUrl()
    ).toString();
  } else {
    targetUrl = new URL(
      '/api/conversations/templates/upload-media',
      getWABAServiceUrl()
    ).toString();
  }

  const headers: Record<string, string> = {};

  // Forward auth and extract tenant ID
  const authHeader = req.headers.get('authorization');
  if (authHeader) {
    headers['Authorization'] = authHeader;
    const token = authHeader.replace('Bearer ', '');
    const tenantId = extractTenantIdFromJwt(token);
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

  const contentType = req.headers.get('content-type') || 'application/json';
  headers['Content-Type'] = contentType;

  try {
    const isJson = contentType.includes('application/json');
    const body = isJson ? await req.text() : req.body;

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: body as BodyInit,
      ...(isJson ? {} : { duplex: 'half' } as RequestInit),
    });

    const respContentType = response.headers.get('content-type') || '';
    if (!respContentType.includes('application/json')) {
      const text = await response.text();
      console.error('[templates/upload-media proxy] Non-JSON response:', {
        status: response.status,
        preview: text.substring(0, 200),
        targetUrl,
      });
      return NextResponse.json(
        {
          success: false,
          error: 'Conversation service returned non-JSON response',
          detail: response.status === 404
            ? 'Upload endpoint not found — check WABA_SERVICE_URL / BNI_SERVICE_URL env vars'
            : text.substring(0, 300),
        },
        { status: response.status >= 500 ? 502 : response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[templates/upload-media proxy] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to upload template media' },
      { status: 502 },
    );
  }
}
