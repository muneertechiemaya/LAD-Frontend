/**
 * Admin WhatsApp Accounts Proxy
 * GET  /api/whatsapp-conversations/admin/whatsapp-accounts
 * POST /api/whatsapp-conversations/admin/whatsapp-accounts
 *
 * Routing strategy for GET:
 *   - Call BOTH the Node backend (social_whatsapp_accounts table) AND the Python BNI
 *     service in parallel, then merge the results (deduplicated by slug).
 *   - This ensures tenants whose accounts live in lad_dev.social_whatsapp_accounts
 *     (e.g. Techiemaya) as well as tenants managed by the Python service (BNI, TPF)
 *     all see their accounts correctly.
 *
 * Routing strategy for POST (create):
 *   - Try Python BNI service first (full onboarding flow).
 *   - Fall back to Node backend if BNI returns 4xx/5xx.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getWhatsAppServiceUrl } from '../../utils/python-proxy';
import { getBackendUrl } from '../../../utils/backend';

interface WaAccount {
  id: string;
  slug: string;
  display_name?: string;
  tenant_id?: string;
  status?: string;
  [key: string]: unknown;
}

/** Pull accounts from the Node backend (lad_dev.social_whatsapp_accounts). */
async function fetchNodeAccounts(req: NextRequest): Promise<WaAccount[]> {
  const backendUrl = getBackendUrl();
  const targetUrl = `${backendUrl}/api/whatsapp-conversations/admin/whatsapp-accounts`;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const authHeader = req.headers.get('authorization');
  if (authHeader) headers['Authorization'] = authHeader;
  const tenantId = req.headers.get('x-tenant-id');
  if (tenantId) headers['X-Tenant-ID'] = tenantId;

  try {
    const resp = await fetch(targetUrl, { method: 'GET', headers });
    if (!resp.ok) return [];
    const data = await resp.json();
    if (data?.success && Array.isArray(data.data)) return data.data;
    if (Array.isArray(data?.accounts)) return data.accounts;
    if (Array.isArray(data)) return data;
    return [];
  } catch {
    return [];
  }
}

/** Pull accounts from the Python BNI conversation service.
 *  Uses a direct fetch (not proxyToPythonService) so ECONNREFUSED is swallowed
 *  silently — Python is optional; Node.js accounts are the primary source.
 */
async function fetchPythonAccounts(req: NextRequest, tenantId: string | null): Promise<WaAccount[]> {
  const wabaBase = getWhatsAppServiceUrl();
  if (!wabaBase) return [];

  try {
    const targetUrl = new URL('/admin/whatsapp-accounts', wabaBase);
    if (tenantId) targetUrl.searchParams.set('tenant_id', tenantId);

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const auth = req.headers.get('authorization');
    if (auth) headers['Authorization'] = auth;
    const tid = req.headers.get('x-tenant-id');
    if (tid) headers['X-Tenant-ID'] = tid;

    const resp = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(5000), // don't wait more than 5s for an optional source
    });

    if (!resp.ok) return [];
    const data = await resp.json();
    if (data?.success && Array.isArray(data.data)) return data.data;
    if (Array.isArray(data?.accounts)) return data.accounts;
    if (Array.isArray(data)) return data;
    return [];
  } catch {
    // Python service is optional — silently return empty when it's down
    return [];
  }
}

/** Merge two account lists, deduplicating by slug (Node backend takes precedence). */
function mergeAccounts(nodeAccounts: WaAccount[], pythonAccounts: WaAccount[]): WaAccount[] {
  const seen = new Set<string>();
  const merged: WaAccount[] = [];

  for (const acc of nodeAccounts) {
    const key = acc.slug || acc.id;
    if (key && !seen.has(key)) {
      seen.add(key);
      merged.push(acc);
    }
  }
  for (const acc of pythonAccounts) {
    const key = acc.slug || acc.id;
    if (key && !seen.has(key)) {
      seen.add(key);
      merged.push(acc);
    }
  }
  return merged;
}

async function callNodeBackend(
  req: NextRequest,
  method: string,
  body?: unknown,
): Promise<NextResponse> {
  const backendUrl = getBackendUrl();
  const targetUrl = `${backendUrl}/api/whatsapp-conversations/admin/whatsapp-accounts`;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const authHeader = req.headers.get('authorization');
  if (authHeader) headers['Authorization'] = authHeader;
  const tenantId = req.headers.get('x-tenant-id');
  if (tenantId) headers['X-Tenant-ID'] = tenantId;

  const fetchOptions: RequestInit = { method, headers };
  if (body !== undefined) {
    fetchOptions.body = JSON.stringify(body);
  }

  try {
    const resp = await fetch(targetUrl, fetchOptions);
    const data = await resp.json();
    return NextResponse.json(data, { status: resp.status });
  } catch {
    return NextResponse.json({ success: true, data: [], accounts: [] }, { status: 200 });
  }
}

export async function GET(req: NextRequest) {
  // Resolve the current tenant ID from the request.
  // Try x-tenant-id header first, then fall back to ?tenant_id= query param so
  // that direct admin-tool calls (e.g. curl ?tenant_id=xxx) also work.
  const url = new URL(req.url);
  const tenantId =
    req.headers.get('x-tenant-id') ||
    url.searchParams.get('tenant_id') ||
    null;

  // Skip the Python call entirely when we have no tenant context — there is no
  // point making a round-trip that will just return [] and log a warning.
  const [nodeAccounts, pythonAccountsRaw] = await Promise.all([
    fetchNodeAccounts(req),
    tenantId ? fetchPythonAccounts(req, tenantId) : Promise.resolve([]),
  ]);

  // Secondary client-side guard: only keep accounts that explicitly belong to
  // this tenant. Accounts with no tenant_id are NOT included (they are cross-
  // tenant admin records and must never be surfaced to individual tenants).
  const pythonAccounts = tenantId
    ? pythonAccountsRaw.filter((a) => a.tenant_id === tenantId)
    : [];

  const merged = mergeAccounts(nodeAccounts, pythonAccounts);

  return NextResponse.json(
    { success: true, data: merged, accounts: merged },
    { status: 200 },
  );
}

export async function POST(req: NextRequest) {
  // Create flow is owned exclusively by the Python WABA service — the Node
  // backend has no POST handler for /admin/whatsapp-accounts and its catch-all
  // returns a misleading 404 ("Personal WhatsApp endpoints must be explicitly
  // defined."). Surface real errors from Python instead of swallowing them.
  let parsedBody: unknown;
  try {
    parsedBody = await req.json();
  } catch { /* empty body */ }

  const wabaBase = getWhatsAppServiceUrl();

  // Guard against unconfigured / placeholder / localhost URLs in deployed envs.
  const isUsable =
    !!wabaBase &&
    !wabaBase.includes('REPLACE_PROJECT_NUMBER') &&
    !(process.env.NODE_ENV === 'production' && wabaBase.includes('localhost'));

  if (!isUsable) {
    return NextResponse.json(
      {
        success: false,
        error: 'WABA service not configured',
        message:
          'NEXT_PUBLIC_WHATSAPP_API_URL / WABA_SERVICE_URL is missing or points at a placeholder. Set it on the lad-frontend Cloud Run service.',
      },
      { status: 503 },
    );
  }

  const targetUrl = new URL('/admin/whatsapp-accounts', wabaBase);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const auth = req.headers.get('authorization');
  if (auth) headers['Authorization'] = auth;
  const tid = req.headers.get('x-tenant-id');
  if (tid) headers['X-Tenant-ID'] = tid;

  let bniResp: Response;
  try {
    bniResp = await fetch(targetUrl.toString(), {
      method: 'POST',
      headers,
      body: parsedBody !== undefined ? JSON.stringify(parsedBody) : undefined,
      signal: AbortSignal.timeout(10000),
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: 'WABA service unreachable',
        message: err instanceof Error ? err.message : String(err),
        target: targetUrl.toString(),
      },
      { status: 502 },
    );
  }

  // Pass Python's status and body through unchanged so 4xx validation errors
  // and 5xx server errors surface to the caller with their real meaning.
  const rawBody = await bniResp.text();
  let parsed: unknown;
  try {
    parsed = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    parsed = { success: bniResp.ok, error: 'Non-JSON response from WABA service', body: rawBody };
  }
  return NextResponse.json(parsed, { status: bniResp.status });
}
