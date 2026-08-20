import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth-request';
import { RequireOwnershipGuard } from '../guards/require-ownership.guard';

export const OWNERSHIP_RESOLVER_KEY = 'ownershipResolver';

/**
 * Resolves the owning user id for the current request's resource. Return
 * null if the resource doesn't exist (-> 404); any other string is
 * compared against the authenticated user (-> 403 on mismatch).
 */
export type OwnershipResolver = (
  request: AuthenticatedRequest,
) => Promise<string | null>;

/**
 * Generic per-route ownership guard for later phases, e.g.:
 *
 *   @RequireOwnership(async (req) => {
 *     const request = await prisma.request.findUnique({
 *       where: { id: req.params.id },
 *       select: { ownerId: true },
 *     });
 *     return request?.ownerId ?? null;
 *   })
 */
export function RequireOwnership(resolver: OwnershipResolver): MethodDecorator {
  return applyDecorators(
    SetMetadata(OWNERSHIP_RESOLVER_KEY, resolver),
    UseGuards(RequireOwnershipGuard),
  );
}
