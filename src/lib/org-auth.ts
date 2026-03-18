/**
 * Org membership & authorization helpers.
 * Extracts repeated slug-lookup + membership-check patterns from route handlers.
 */

export interface OrgContext {
  orgId: string;
  role: string;
}

/**
 * Look up an org by slug and verify the user is a member.
 * Returns the org ID and caller's role, or null if not found / not a member.
 */
export async function getOrgMembership(
  db: D1Database,
  slug: string,
  userId: string,
): Promise<OrgContext | null> {
  const org = await db
    .prepare("SELECT id FROM organization WHERE slug = ?")
    .bind(slug)
    .first<{ id: string }>();
  if (!org) return null;

  const membership = await db
    .prepare("SELECT role FROM member WHERE organizationId = ? AND userId = ?")
    .bind(org.id, userId)
    .first<{ role: string }>();
  if (!membership) return null;

  return { orgId: org.id, role: membership.role };
}

/**
 * Check if a user is the creator or an admin/owner of the org.
 */
export function canManageOp(callerRole: string, callerUserId: string, opCreatedBy: string): boolean {
  return callerUserId === opCreatedBy || callerRole === "owner" || callerRole === "admin";
}
