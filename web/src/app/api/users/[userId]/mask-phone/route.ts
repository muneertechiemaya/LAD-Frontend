import { NextRequest } from 'next/server';
import { proxyUsersRequest, userSubPath, type UserIdParams } from '../../proxy';

// PUT /api/users/:userId/mask-phone
export async function PUT(req: NextRequest, ctx: UserIdParams) {
  return proxyUsersRequest(req, await userSubPath(ctx, '/mask-phone'));
}
