import { NextRequest } from 'next/server';
import { proxyUsersRequest } from './proxy';

// GET  /api/users  — list team members
// POST /api/users  — add a team member
export async function GET(req: NextRequest) {
  return proxyUsersRequest(req);
}
export async function POST(req: NextRequest) {
  return proxyUsersRequest(req);
}
