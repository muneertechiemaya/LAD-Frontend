import { NextRequest } from 'next/server';
import { proxyUsersRequest } from '../proxy';

// GET/PUT /api/users/team-privacy — the workspace "Private workspaces" switch.
// Explicit route: without it the request falls into api/users/[userId] with
// userId='team-privacy', which only handles DELETE.
export async function GET(req: NextRequest) {
  return proxyUsersRequest(req, '/team-privacy');
}
export async function PUT(req: NextRequest) {
  return proxyUsersRequest(req, '/team-privacy');
}
