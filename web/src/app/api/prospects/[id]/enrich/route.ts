/**
 * POST /api/prospects/[id]/enrich — Option C on-open enrichment trigger.
 *
 * Resolves tenant_id (DEV_TENANT_OVERRIDE / JWT / cookie — same as the
 * Master-Agent proxy) and forwards to LAD_backend's service-token-guarded
 * enrich endpoint, which does the Unipile profile fetch + emits the
 * enrichment.profile_enriched event to the Master Agent. Best-effort.
 */
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function tenantFromJwt(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const p = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    return p.tenantId || p.tenant_id || p.organizationId || p.orgId || null;
  } catch {
    return null;
  }
}

function resolveTenantId(req: NextRequest): string | null {
  if (process.env.NODE_ENV === 'development' && process.env.DEV_TENANT_OVERRIDE) {
    return process.env.DEV_TENANT_OVERRIDE;
  }
  const header = req.headers.get('x-tenant-id');
  if (header) return header;
  const auth = req.headers.get('authorization');
  if (auth) {
    const t = tenantFromJwt(auth.replace(/^Bearer\s+/i, ''));
    if (t) return t;
  }
  const cookie = req.cookies.get('access_token')?.value || req.cookies.get('token')?.value;
  if (cookie) {
    const t = tenantFromJwt(cookie);
    if (t) return t;
  }
  return null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const tenantId = resolveTenantId(req);
  const token = process.env.LAD_MASTER_AGENT_SERVICE_TOKEN;
  const backend = (process.env.BACKEND_INTERNAL_URL || process.env.BACKEND_URL || '').replace(/\/$/, '');

  if (!tenantId) return NextResponse.json({ error: 'missing_tenant' }, { status: 401 });
  if (!token) return NextResponse.json({ error: 'service_token_missing' }, { status: 503 });
  if (!backend) return NextResponse.json({ error: 'backend_url_missing' }, { status: 503 });

  try {
    const resp = await fetch(
      `${backend}/api/ai-icp-assistant/prospects/${encodeURIComponent(id)}/enrich-profile`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Service-Token': token },
        body: JSON.stringify({ tenant_id: tenantId }),
      },
    );
    const data = await resp.json().catch(() => ({}));
    return NextResponse.json(data, { status: resp.status });
  } catch (e) {
    return NextResponse.json(
      { error: 'enrich_unreachable', detail: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
