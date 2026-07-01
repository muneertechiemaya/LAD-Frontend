/**
 * /api/email-comms/contacts
 *   GET → LAD-Email-Comms GET /api/email-broadcast/contacts
 *
 * Query: search? (max 200), limit (1..500, default 100), offset (default 0).
 * Returns { contacts: Contact[], next_offset: number | null }.
 */
import { NextRequest } from 'next/server';
import { proxyToEmailComms } from '../utils/email-proxy';

export async function GET(req: NextRequest): Promise<Response> {
  return proxyToEmailComms(req, '/api/email-broadcast/contacts');
}
