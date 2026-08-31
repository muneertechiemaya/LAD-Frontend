import { safeStorage } from '@lad/shared/storage';

/**
 * Tenant-aware fetch utility.
 *
 * Ensures every request includes:
 *  - Authorization header (from cookie, safeStorage, or localStorage token)
 *  - X-Tenant-Id header (from options.headers, safeStorage/localStorage selectedTenantId or user profile)
 *
 * Use this instead of bare `fetch()` for any call to backend services requiring tenant context.
 */

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;

  // Try cookie first (primary store — LAD uses httpOnly: false cookies)
  const cookies = document.cookie ? document.cookie.split(';') : [];
  for (const cookie of cookies) {
    const [rawName, ...rawValueParts] = cookie.trim().split('=');
    const name = rawName?.trim();
    const value = rawValueParts.join('=');
    if (name === 'token') return decodeURIComponent(value || '');
  }

  // Fallback: safeStorage & localStorage (for backwards compatibility)
  const safeStored = safeStorage.getItem('token');
  if (safeStored) return safeStored;

  const stored = localStorage.getItem('token');
  if (stored) return stored;

  return null;
}

function getEffectiveTenantId(): string | null {
  if (typeof window === 'undefined') return null;
  const safeSelected = safeStorage.getItem('selectedTenantId');
  if (safeSelected && safeSelected !== 'default') return safeSelected;

  const selected = localStorage.getItem('selectedTenantId');
  if (selected && selected !== 'default') return selected;

  // Fallback: extract from cached user profile
  try {
    const raw = safeStorage.getItem('user') || localStorage.getItem('user');
    if (raw) {
      const user = JSON.parse(raw);
      return user?.tenantId || user?.organizationId || (Array.isArray(user?.tenants) && user.tenants.length > 0 ? user.tenants[0]?.id : null);
    }
  } catch { /* ignore */ }
  return null;
}

/**
 * Drop-in replacement for `fetch()` that adds tenant + auth headers.
 */
export async function fetchWithTenant(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const body = options.body;
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  // JSON is only the right default for a string body (or none). Forcing it on
  // a FormData upload sent the multipart bytes with an application/json header,
  // so the server's JSON parser choked on the boundary:
  //   SyntaxError: Unexpected token '-', "------WebK"... is not valid JSON
  const wantsJson = !isFormData && (body === undefined || body === null || typeof body === 'string');

  const headers: Record<string, string> = {
    ...(wantsJson ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers as Record<string, string>),
  };

  // A Content-Type on a FormData request is always wrong, whoever set it: only
  // the browser knows the boundary, and it only adds the header when none is
  // present. Strip it rather than let a caller reintroduce the same bug.
  if (isFormData) {
    for (const k of Object.keys(headers)) {
      if (k.toLowerCase() === 'content-type') delete headers[k];
    }
  }

  const token = getAuthToken();
  if (token && !headers['Authorization'] && !headers['authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const tenantId = getEffectiveTenantId();
  const existingTenantId = headers['X-Tenant-Id'] || headers['X-Tenant-ID'] || headers['x-tenant-id'];
  const finalTenantId = existingTenantId || tenantId;
  if (finalTenantId) {
    headers['X-Tenant-Id'] = finalTenantId;
  }

  return fetch(url, { ...options, headers });
}
