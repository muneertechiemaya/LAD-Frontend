/**
 * Broadcast Template Stats Proxy — channel-aware.
 *
 * GET /api/whatsapp-conversations/broadcasts/template-stats            → WABA
 * GET /api/whatsapp-conversations/broadcasts/template-stats?channel=personal
 *                                                                      → WAPA
 *
 * Both services return the same shape ({ success, templates: [...] });
 * WAPA additionally sets read_tracked: false (personal WhatsApp has no
 * aggregated read receipts). Used by the Overview Broadcast Performance
 * widget, which merges WABA + WAPA + email rows.
 */
import { NextRequest } from 'next/server';
import { proxyToPythonService, getWABAServiceUrl, getWAPAServiceUrl } from '../../utils/python-proxy';

export async function GET(req: NextRequest) {
  const channel = req.nextUrl.searchParams.get('channel');
  if (channel === 'personal') {
    // WAPA mounts its API under /api/whatsapp-conversations (see server.js).
    return proxyToPythonService(
      req,
      getWAPAServiceUrl(),
      '/api/whatsapp-conversations/broadcasts/template-stats',
    );
  }
  return proxyToPythonService(req, getWABAServiceUrl(), '/api/broadcasts/template-stats');
}
