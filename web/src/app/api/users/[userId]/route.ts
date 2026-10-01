import { NextRequest } from 'next/server';
import { proxyUsersRequest, userSubPath, type UserIdParams } from '../proxy';

// DELETE /api/users/:userId
export async function DELETE(req: NextRequest, ctx: UserIdParams) {
  return proxyUsersRequest(req, await userSubPath(ctx));
}
