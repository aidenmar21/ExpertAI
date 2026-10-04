import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { dbError, requireRole, RepositoryError, serviceClient } from "./server";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const signature = (value: string) => createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY!).update(`expertai-invite-v1:${value}`).digest("base64url");
export async function createInvite(email: string, role: string) {
  const { db, orgId, role: actorRole } = await requireRole(["owner", "manager"]);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !["manager", "expert", "new_hire"].includes(role) || (actorRole === "manager" && role === "manager")) throw new RepositoryError("invalid invite role/email", 400);
  const nonce = randomBytes(32).toString("base64url");
  const expires = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const value = Buffer.from(JSON.stringify({ nonce, orgId, email: email.toLowerCase(), role, expires })).toString("base64url");
  dbError((await db.from("org_invites").insert({ nonce_hash: hash(nonce), org_id: orgId, email: email.toLowerCase(), role, expires_at: new Date(expires).toISOString() })).error);
  return `${value}.${signature(value)}`;
}
export async function acceptInvite(token: string, user: { id: string; email?: string }) {
  if (token.length > 4096) throw new RepositoryError("invalid invite", 400);
  const [value, sig, extra] = token.split(".");
  const expected = Buffer.from(signature(value ?? ""));
  const supplied = Buffer.from(sig ?? "");
  if (extra || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw new RepositoryError("invalid invite", 400);
  const invite = JSON.parse(Buffer.from(value, "base64url").toString()) as { nonce: string; email: string; expires: number };
  if (invite.expires <= Date.now() || !user.email || invite.email !== user.email.toLowerCase()) throw new RepositoryError("invite expired or belongs to another email", 403);
  const { data, error } = await serviceClient().rpc("accept_invite", { nonce: hash(invite.nonce), uid: user.id, user_email: user.email });
  dbError(error);
  return data as string;
}
