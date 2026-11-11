import { timingSafeEqual } from "node:crypto";
import { passwordHash, passwordMatches } from "./passwords";
import { divisions, homepage } from "./catalog";
import { type Actor, type Db, audit, database, digest, email, expiredSession, fail, id, issueSession, now, one, orgId, run, stmt, str, throttle } from "./server";

async function codeMatches(input: string, expected: string) {
  const [a,b] = await Promise.all([digest(input),digest(expected)]);
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
export const setupAllowed = () => Boolean(process.env.WALSHKEN_ADMIN_EMAIL && (process.env.WALSHKEN_SETUP_CODE?.length ?? 0) >= 24);

export async function login(request: Request, action: string, data: Record<string, unknown>) {
  const db = database();
  const mailbox = email(data.email);
  const password = data.password;
  if (typeof password !== "string" || !password || password.length > 160) return fail(400,"Enter a valid password.");
  const ip = request.headers.get("x-vercel-forwarded-for") ?? "local";
  await throttle(db, `login-ip:${ip}`, 30, 300_000);
  await throttle(db, `login-email:${mailbox}`, 6, 300_000);
  if (action === "login") {
    const actor = await one<Actor & { password_hash: string }>(db, "SELECT e.*,c.password_hash FROM employees e JOIN credentials c ON c.employee_id=e.id WHERE e.email=?", mailbox);
    if (!await passwordMatches(password, actor?.password_hash) || !actor || actor.status !== "Active") return fail(401, "Email or password is incorrect.");
    return issueSession(request, db, actor, actor.password_hash);
  }

  if (password.length < 12) return fail(400, "Use a password with at least 12 characters.");
  const code = str(data.code, "setup code", 180);
  if (action === "bootstrap") {
    if (!setupAllowed() || mailbox !== process.env.WALSHKEN_ADMIN_EMAIL?.trim().toLowerCase() || !await codeMatches(code, process.env.WALSHKEN_SETUP_CODE!)) {
      return fail(403, "The workspace setup details are incorrect.");
    }
    const employee = id();
    const name = str(data.name, "full name", 100);
    const hash = await passwordHash(password);
    await db.batch([
      stmt(db, "INSERT INTO organizations (id,name,time_zone) VALUES (?,?,?) ON CONFLICT DO NOTHING", orgId, "Walshken", "UTC"),
      stmt(db, "SELECT id FROM organizations WHERE id=? FOR UPDATE", orgId),
      stmt(db, `INSERT INTO employees (id,org_id,employee_no,name,email,role,title,activated_at,country,jurisdiction,time_zone)
        SELECT ?,?,?,?,?,'super_admin','Workspace administrator',?,'ZZ','','UTC' WHERE NOT EXISTS (SELECT 1 FROM employees)`,
        employee, orgId, "WK-001", name, mailbox, now()),
      stmt(db, "INSERT INTO credentials (employee_id,password_hash) SELECT id,? FROM employees WHERE id=?", hash, employee),
      stmt(db, "INSERT INTO site_content (id,title,description,about) VALUES ('home',?,?,?) ON CONFLICT DO NOTHING", homepage.title, homepage.description, homepage.about),
      ...divisions.map((entry, index) => stmt(db, "INSERT INTO services (id,name,description,icon,sort) VALUES (?,?,?,?,?) ON CONFLICT DO NOTHING", entry.id, entry.name, entry.description, entry.icon, index + 1)),
      stmt(db, "INSERT INTO audit (id,org_id,actor_id,action,entity,target_id) SELECT ?,org_id,id,'Workspace initialized','organization',org_id FROM employees WHERE id=?", id(), employee),
    ]);
    const actor = await one<Actor>(db, "SELECT * FROM employees WHERE id=?", employee);
    if (!actor) return fail(409, "The workspace is already initialized.");
    return issueSession(request, db, actor, hash);
  }

  const codeHash = await digest(code);
  const invite = await one<{ id: string; employee_id: string }>(db, `SELECT i.id,i.employee_id FROM invitations i JOIN employees e ON e.id=i.employee_id
    WHERE i.code_hash=? AND i.consumed_at IS NULL AND i.expires_at>? AND e.email=? AND e.status='Active'`, codeHash, now(), mailbox);
  if (!invite) return fail(403, "The invitation is invalid or has expired.");
  const hash = await passwordHash(password);
  const consumed = now();
  await db.transaction(async (tx) => {
    const changed = await run(tx, `UPDATE invitations SET consumed_at=? WHERE id=? AND consumed_at IS NULL AND expires_at>?
      AND EXISTS (SELECT 1 FROM employees WHERE id=? AND status='Active')`, consumed, invite.id, consumed, invite.employee_id);
    if (!changed.count) return fail(409, "This invitation was already used.");
    await run(tx, `INSERT INTO credentials (employee_id,password_hash) VALUES (?,?)
      ON CONFLICT(employee_id) DO UPDATE SET password_hash=excluded.password_hash,updated_at=excluded.updated_at`, invite.employee_id, hash);
    await run(tx, "UPDATE sessions SET ended_at=? WHERE employee_id=? AND ended_at IS NULL", consumed, invite.employee_id);
  });
  const actor = await one<Actor>(db, "SELECT * FROM employees WHERE id=?", invite.employee_id);
  if (!actor) return fail(403, "This account is unavailable.");
  return issueSession(request, db, actor, hash);
}

export async function changePassword(request: Request, db: Db, actor: Actor, data: Record<string, unknown>) {
  const { currentPassword, newPassword, confirmPassword } = data;
  if (typeof currentPassword !== "string" || !currentPassword || currentPassword.length > 160) {
    return fail(400, "Enter your current password.");
  }
  if (typeof newPassword !== "string" || newPassword.length < 12 || newPassword.length > 160) {
    return fail(400, "Use a new password between 12 and 160 characters.");
  }
  if (newPassword !== confirmPassword) return fail(400, "The new passwords must match.");
  if (newPassword === currentPassword) return fail(400, "Choose a different password.");

  await throttle(db, `password-change:${actor.id}`, 6, 300_000);
  const changed = await passwordHash(newPassword);
  await db.transaction(async (tx) => {
    const credential = await one<{ password_hash: string }>(tx, "SELECT password_hash FROM credentials WHERE employee_id=? FOR UPDATE", actor.id);
    if (!credential || !await passwordMatches(currentPassword, credential.password_hash)) return fail(401, "Current password is incorrect.");
    const at = now();
    await run(tx, "UPDATE credentials SET password_hash=?,updated_at=? WHERE employee_id=?", changed, at, actor.id);
    await run(tx, "UPDATE sessions SET ended_at=? WHERE employee_id=? AND ended_at IS NULL", at, actor.id);
    await audit(tx, actor, "Password changed", "credentials", actor.id).run();
  });

  return expiredSession(request);
}
