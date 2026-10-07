/**
 * Shared forwarder for the /api/users/* proxy routes (Team Management).
 *
 * Each route.ts under api/users is a thin wrapper around `proxyUsersRequest`,
 * so token forwarding, backend resolution and tenant scoping live in one place.
 *
 * Tenant scoping goes through resolveAuthorizedTenantId: a client-supplied
 * `x-tenant-id` is honoured only for the super admin, everyone else is pinned
 * to their own token's tenant. The header is never passed through as-is.
 */
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getBackendUrl } from '../utils/backend';
import { resolveAuthorizedTenantId } from '../utils/tenant-scope';

/**
 * Forward `req` to `${backend}/api/users${subPath}` and relay the JSON response.
 *
 * @param subPath  path after /api/users, e.g. '' or `/${userId}/role`
 */
export async function proxyUsersRequest(req: NextRequest, subPath = ''): Promise<NextResponse> {
  const label = `/api/users${subPath}`;
  try {
    const search = req.nextUrl.searchParams.toString();
    const url = `${getBackendUrl()}/api/users${subPath}${search ? `?${search}` : ''}`;

    const token =
      req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
      req.cookies.get('access_token')?.value ||
      req.cookies.get('token')?.value;
    const tenantId = resolveAuthorizedTenantId(req, { logLabel: 'users-proxy' });

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (tenantId) headers['X-Tenant-ID'] = tenantId;

    let body: string | undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'DELETE') {
      body = await req.text();
    }

    const resp = await fetch(url, { method: req.method, headers, body });
    if (resp.status === 204) return new NextResponse(null, { status: 204 });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      logger.error(`[${label}] ${req.method} upstream error`, { status: resp.status });
    }
    return NextResponse.json(data, { status: resp.status });
  } catch (e: any) {
    logger.error(`[${label}] ${req.method} Error`, e);
    return NextResponse.json({ error: 'Internal error', details: e?.message }, { status: 500 });
  }
}

/** Route-param type shared by the api/users/[userId]/* handlers. */
export type UserIdParams = { params: Promise<{ userId: string }> };

/** URL-encode the dynamic segment so a crafted id cannot add path segments. */
export async function userSubPath(ctx: UserIdParams, suffix = ''): Promise<string> {
  const { userId } = await ctx.params;
  return `/${encodeURIComponent(userId)}${suffix}`;
}
