/**
 * RSI profile sync helper.
 *
 * Extracted from POST /api/account/rsi-sync so the same logic can be called
 * after successful bio-key verification or from the sync route itself.
 */

import { fetchRsiProfile, type RsiProfile } from "./rsi";
import { checkGravatar } from "./gravatar";

export interface SyncResult {
  profile: RsiProfile & { fetched_at: string };
  avatarAutoSet: string | null;
  gravatarUrl: string | null;
  verificationInvalidated: boolean;
}

/**
 * Fetch an RSI citizen profile and upsert it into `user_rsi_profile`.
 * Also handles org auto-join, avatar auto-set, and verification invalidation
 * when the handle changes.
 */
export async function syncRsiProfileToDb(
  db: D1Database,
  userId: string,
  userEmail: string,
  handle: string,
): Promise<SyncResult> {
  const profile = await fetchRsiProfile(handle);

  await db
    .prepare(`INSERT INTO user_rsi_profile
        (user_id, handle, display_name, citizen_record, enlisted_at, avatar_url, main_org_slug, orgs_json, fetched_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(user_id) DO UPDATE SET
          handle        = excluded.handle,
          display_name  = excluded.display_name,
          citizen_record = excluded.citizen_record,
          enlisted_at   = excluded.enlisted_at,
          avatar_url    = excluded.avatar_url,
          main_org_slug = excluded.main_org_slug,
          orgs_json     = excluded.orgs_json,
          fetched_at    = excluded.fetched_at`)
    .bind(
      userId,
      profile.handle,
      profile.display_name,
      profile.citizen_record,
      profile.enlisted_at,
      profile.avatar_url,
      profile.main_org_slug,
      JSON.stringify(profile.orgs),
    )
    .run();

  // Auto-join SC Bridge orgs that match the user's RSI org affiliations
  if (profile.orgs.length > 0) {
    const orgJoinStmts = [];
    for (const rsiOrg of profile.orgs) {
      const scbOrg = await db
        .prepare("SELECT id FROM organization WHERE rsiSid = ?")
        .bind(rsiOrg.slug)
        .first<{ id: string }>();
      if (scbOrg) {
        orgJoinStmts.push(
          db.prepare(
            `INSERT OR IGNORE INTO member (id, organizationId, userId, role, createdAt)
             VALUES (?, ?, ?, 'member', datetime('now'))`,
          ).bind(crypto.randomUUID(), scbOrg.id, userId),
        );
      }
    }
    if (orgJoinStmts.length > 0) {
      await db.batch(orgJoinStmts);
      const firstOrgId = (await db
        .prepare("SELECT organizationId FROM member WHERE userId = ? ORDER BY createdAt LIMIT 1")
        .bind(userId)
        .first<{ organizationId: string }>())?.organizationId;
      if (firstOrgId) {
        await db
          .prepare("UPDATE user SET primary_org_id = ? WHERE id = ? AND primary_org_id IS NULL")
          .bind(firstOrgId, userId)
          .run();
      }
    }
  }

  // Check if handle changed and invalidate verification if so
  let verificationInvalidated = false;
  const verifiedRow = await db
    .prepare("SELECT verified_handle FROM user_rsi_profile WHERE user_id = ?")
    .bind(userId)
    .first<{ verified_handle: string | null }>();
  if (verifiedRow?.verified_handle && verifiedRow.verified_handle !== profile.handle) {
    await db
      .prepare("UPDATE user_rsi_profile SET verified_at = NULL, verified_handle = NULL WHERE user_id = ?")
      .bind(userId)
      .run();
    verificationInvalidated = true;
  }

  // After upsert: if user has no avatar, try to auto-set from RSI
  const currentUser = await db
    .prepare("SELECT image, gravatar_opted_out FROM user WHERE id = ?")
    .bind(userId)
    .first<{ image: string | null; gravatar_opted_out: number }>();

  let avatarAutoSet: string | null = null;
  let gravatarUrl: string | null = null;

  if (!currentUser?.image && profile.avatar_url) {
    const gravatar = currentUser?.gravatar_opted_out
      ? null
      : await checkGravatar(userEmail);
    if (!gravatar) {
      await db
        .prepare("UPDATE user SET image = ? WHERE id = ?")
        .bind(profile.avatar_url, userId)
        .run();
      avatarAutoSet = profile.avatar_url;
    } else {
      gravatarUrl = gravatar;
    }
  }

  return {
    profile: { ...profile, fetched_at: new Date().toISOString() },
    avatarAutoSet,
    gravatarUrl,
    verificationInvalidated,
  };
}
