import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { divisions, homepage } from "./catalog";
import { type Actor, database, digest, email, fail, id, issueSession, now, one, orgId, run, stmt, str, throttle } from "./server";

const dummySalt = Buffer.from("f9a6d1632d6ddcb3c13f6b75ba49b1ee", "hex");

async function passwordHash(password: string, salt = randomBytes(16)) {
  const hash = await new Promise<Buffer>((resolve,reject) => scrypt(password,salt,64,{N:32768,r:8,p:3,maxmem:67108864},(error,key)=>error?reject(error):resolve(key)));
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}
async function match(password: string, stored?: string) {
  const salt = stored?.split(":")[0];
  const computed = await passwordHash(password, salt ? Buffer.from(salt, "hex") : dummySalt);
  if (!stored) return false;
  const a = Buffer.from(computed);
  const b = Buffer.from(stored);
  return a.length === b.length && timingSafeEqual(a, b);
}
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
    if (!await match(password, actor?.password_hash) || !actor || actor.status !== "Active") return fail(401, "Email or password is incorrect.");
    return issueSession(request, db, actor);
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
      stmt(db, "INSERT INTO organizations (id,name) VALUES (?,?) ON CONFLICT DO NOTHING", orgId, "Walshken"),
      stmt(db, "SELECT id FROM organizations WHERE id=? FOR UPDATE", orgId),
      stmt(db, `INSERT INTO employees (id,org_id,employee_no,name,email,role,title,activated_at)
        SELECT ?,?,?,?,?,'super_admin','Workspace administrator',? WHERE NOT EXISTS (SELECT 1 FROM employees)`,
        employee, orgId, "WK-001", name, mailbox, now()),
      stmt(db, "INSERT INTO credentials (employee_id,password_hash) SELECT id,? FROM employees WHERE id=?", hash, employee),
      stmt(db, "INSERT INTO markets (code,enabled) VALUES ('CA',1) ON CONFLICT DO NOTHING"),
      stmt(db, "INSERT INTO site_content (id,title,description,about) VALUES ('home',?,?,?) ON CONFLICT DO NOTHING", homepage.title, homepage.description, homepage.about),
      ...divisions.map((entry, index) => stmt(db, "INSERT INTO services (id,name,description,icon,sort) VALUES (?,?,?,?,?) ON CONFLICT DO NOTHING", entry.id, entry.name, entry.description, entry.icon, index + 1)),
      stmt(db, "INSERT INTO audit (id,org_id,actor_id,action,entity,target_id) SELECT ?,org_id,id,'Workspace initialized','organization',org_id FROM employees WHERE id=?", id(), employee),
    ]);
    const actor = await one<Actor>(db, "SELECT * FROM employees WHERE id=?", employee);
    if (!actor) return fail(409, "The workspace is already initialized.");
    return issueSession(request, db, actor);
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
  return issueSession(request, db, actor);
}
