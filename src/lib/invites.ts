import { createHash, randomBytes } from "node:crypto";

/** How long an invite link works: the database's default for `staff_invites.expires_at`. */
export const INVITE_LIFETIME_DAYS = 7;

/** The SHA-256 of a token, as hex: what the database stores and compares (`token_hash`). */
export function hashInviteToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * A new invite link's secret: 32 random bytes, URL-safe. Only its hash is stored, so the link
 * is shown once, to the person who made it, and the database never holds a usable one.
 */
export function createInviteToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashInviteToken(token) };
}

/** Whether an invite can still be used: nobody has used it and it hasn't expired. */
export function isPending(
  invite: { accepted_at: string | null; expires_at: string },
  nowMs = Date.now(),
) {
  return invite.accepted_at === null && Date.parse(invite.expires_at) > nowMs;
}
