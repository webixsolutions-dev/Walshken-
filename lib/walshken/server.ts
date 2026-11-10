import { workspaceDatabase, type Db } from "./database";
export type { Db } from "./database";
import type { SiteCatalog } from "@/components/walshken/corporate";
import { countries, divisions, homepage, type Role } from "./catalog";

export class AppError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export type Row = Record<string, string | number | null>;
export type Actor = {
  id: string; org_id: string; auth_id: string | null; email: string; name: string; role: Role; status: string;
  employee_no: string; department_id: string | null; division_id: string | null; manager_id: string | null;
  office_id: string | null; country: string; jurisdiction: string; time_zone: string; break_policy: string;
};
export const orgId = "walshken";
export const sessionCookie = "walshken_session";
export const now = () => new Date().toISOString();
export const id = () => crypto.randomUUID();
export const fail = (status: number, message: string): never => { throw new AppError(status, message); };

export function database() {
  const db = workspaceDatabase();
  if (!db) throw new AppError(503, "The workspace database is awaiting configuration.");
  return db;
}
export const stmt = (db: Db, sql: string, ...args: unknown[]) => db.prepare(sql, args);
export const one = <T = Row>(db: Db, sql: string, ...args: unknown[]) => stmt(db, sql, ...args).first<T>();
export const all = async <T = Row>(db: Db, sql: string, ...args: unknown[]) => (await stmt(db, sql, ...args).all<T>()).results;
export const run = (db: Db, sql: string, ...args: unknown[]) => stmt(db, sql, ...args).run();
export const audit = (db: Db, actor: Actor, action: string, entity: string, target: string | null = null) =>
  stmt(db, "INSERT INTO audit (id,org_id,actor_id,action,entity,target_id) VALUES (?,?,?,?,?,?)", id(), actor.org_id, actor.id, action, entity, target);
export const notify = (db: Db, employee: string, title: string, body: string, href: string) =>
  stmt(db, "INSERT INTO notifications (id,employee_id,title,body,href) VALUES (?,?,?,?,?)", id(), employee, title, body, href);

export function json(data: unknown, status = 200, extra: Record<string,string> = {}) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...extra } });
}
export function handleError(error: unknown) {
  if (error instanceof AppError) return json({ error: error.message }, error.status);
  if (error instanceof Error && /unique constraint|constraint failed|check constraint|foreign key constraint/i.test(error.message)) {
    return json({ error: "That record already exists or its state changed. Refresh and try again." }, 409);
  }
  console.error("Walshken request failed", error instanceof Error ? (process.env.NODE_ENV === "development" ? error.message : error.name) : "UnknownError");
  return json({ error: "The request could not be completed. Please try again." }, 500);
}

export function str(value: unknown, label: string, limit = 120, required = true) {
  if (typeof value !== "string" && value != null) fail(400, `Enter a valid ${label}.`);
  const out = typeof value === "string" ? value.trim() : "";
  if ((!out && required) || out.length > limit) fail(400, `Enter a valid ${label}.`);
  return out;
}
export function pick<T extends string>(value: unknown, choices: readonly T[], label: string): T {
  if (typeof value !== "string" || !choices.includes(value as T)) fail(400, `Choose a valid ${label}.`);
  return value as T;
}
export function integer(value: unknown, label: string, min: number, max: number) {
  const n = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  if (typeof n !== "number" || !Number.isInteger(n) || n < min || n > max) fail(400, `Enter a valid ${label}.`);
  return n as number;
}
export function email(value: unknown) {
  const result = str(value, "email address", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) fail(400, "Enter a valid email address.");
  return result;
}
export function country(value: unknown) {
  const code = str(value, "country", 2).toUpperCase();
  if (!countries.some((item) => item.code === code)) fail(400, "Choose a supported country.");
  return code;
}
export function date(value: unknown, label: string, required = true) {
  const val = str(value, label, 10, required);
  if (!val) return null;
  const parsed = new Date(`${val}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(val) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== val) fail(400, `Enter a valid ${label}.`);
  return val;
}
export function datetime(value: unknown, label: string) {
  const raw = str(value, label, 40);
  const parsed = new Date(raw);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw) || !/(?:Z|[+-]\d{2}:\d{2})$/.test(raw) || !Number.isFinite(parsed.getTime())) fail(400, `Enter a valid ${label} with a time zone.`);
  return parsed.toISOString();
}
export function timeZone(value: unknown) {
  const result = str(value, "time zone", 70);
  try { new Intl.DateTimeFormat("en", { timeZone: result }); } catch { fail(400, "Use a valid IANA time zone, such as America/Edmonton."); }
  return result;
}
export function destination(value: unknown) {
  const raw = str(value, "service destination", 500, false);
  if (!raw) return "";
  if (/^\/(?![\/\\])[a-z0-9]/i.test(raw) && !/[\\\s]/.test(raw)) return raw;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === "https:" && parsed.hostname && !parsed.username && !parsed.password) return parsed.toString();
  } catch { /* Invalid destination */ }
  return fail(400, "Use an HTTPS website or an internal path starting with a single slash.");
}
function requestProtocol(request: Request) {
  if (process.env.VERCEL === "1" || request.headers.get("x-forwarded-proto") === "https") return "https:";
  return new URL(request.url).protocol;
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get("Origin");
  const host = request.headers.get("Host") ?? new URL(request.url).host;
  if (origin !== `${requestProtocol(request)}//${host}` || request.headers.get("Sec-Fetch-Site") === "cross-site") {
    fail(403, "This action must come from Walshken.");
  }
}
export async function payload(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json")) fail(415, "Send JSON for this action.");
  const raw = await request.text();
  if (raw.length > 30_000) fail(413, "This request is too large.");
  let data: unknown;
  try { data = JSON.parse(raw); } catch { fail(400, "The request is invalid."); }
  if (!data || typeof data !== "object" || Array.isArray(data)) fail(400, "The request is invalid.");
  return data as Record<string, unknown>;
}
export async function digest(input: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input)))).map((n) => n.toString(16).padStart(2, "0")).join("");
}
export function cookieValue(header: string | null) {
  return header?.split(/;\s*/).find((item) => item.startsWith(`${sessionCookie}=`))?.slice(sessionCookie.length + 1) ?? "";
}
function sessionSet(request: Request, value: string, maxAge: number) {
  return `${sessionCookie}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Strict${requestProtocol(request) === "https:" ? "; Secure" : ""}`;
}
export async function actorFor(db: Db, token: string): Promise<Actor | null> {
  if (!/^[0-9a-f-]{72}$/.test(token)) return null;
  return one<Actor>(db, `SELECT e.* FROM employees e JOIN sessions s ON s.employee_id=e.id
    WHERE e.status='Active' AND s.id=? AND s.ended_at IS NULL AND s.expires_at>?`, await digest(token), now());
}
export async function currentActor(db: Db, request: Request) {
  return actorFor(db, cookieValue(request.headers.get("cookie")));
}
export async function issueSession(request: Request, db: Db, actor: Actor) {
  const token = id() + id();
  const tokenHash = await digest(token);
  const started = now();
  const expiry = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
  await db.batch([
    stmt(db, "UPDATE employees SET activated_at=COALESCE(activated_at,?), last_login_at=? WHERE id=? AND status='Active'", started, started, actor.id),
    stmt(db, "INSERT INTO sessions (id,employee_id,expires_at,agent) SELECT ?,id,?,? FROM employees WHERE id=? AND status='Active'",
      tokenHash, expiry, (request.headers.get("user-agent") ?? "Browser").slice(0, 240), actor.id),
    stmt(db, "INSERT INTO audit (id,org_id,actor_id,action,entity,target_id) SELECT ?,?,employee_id,'Signed in','session',NULL FROM sessions WHERE id=?", id(), actor.org_id, tokenHash),
  ]);
  if (!await actorFor(db, token)) return fail(403, "This identity does not have active staff access.");
  return json({ ok: true }, 200, { "Set-Cookie": sessionSet(request, token, 43_200) });
}
export async function endSession(request: Request, db: Db, actor: Actor) {
  const tokenHash = await digest(cookieValue(request.headers.get("cookie")));
  await db.batch([stmt(db, "UPDATE sessions SET ended_at=? WHERE id=? AND employee_id=?", now(), tokenHash, actor.id), audit(db, actor, "Signed out", "session")]);
  return json({ ok: true }, 200, { "Set-Cookie": sessionSet(request, "", 0) });
}
export const canSuper = (actor: Actor) => actor.role === "super_admin";
export const canPayroll = (actor: Actor) => actor.role === "super_admin" || actor.role === "hr";
export const canManage = (actor: Actor) => ["super_admin", "admin", "hr", "manager"].includes(actor.role);
export const isStaff = (actor: Actor) => actor.role !== "guest";
export function requireSuper(actor: Actor) { if (!canSuper(actor)) fail(403, "Super Admin access is required."); }
export function requireStaff(actor: Actor) { if (!isStaff(actor)) fail(403, "Staff access is required."); }

export function scope(actor: Actor, alias = "e", includeSelf = true): { sql: string; args: unknown[] } {
  const self = includeSelf ? [`${alias}.id=?`] : [];
  const args: unknown[] = includeSelf ? [actor.id] : [];
  if (canSuper(actor)) return { sql: includeSelf ? "1=1" : `${alias}.id<>?`, args: includeSelf ? [] : [actor.id] };
  if (actor.role === "manager") { self.push(`${alias}.manager_id=?`); args.push(actor.id); }
  if ((actor.role === "admin" || actor.role === "hr") && (actor.department_id || actor.division_id)) {
    const match = [];
    if (actor.department_id) { match.push(`${alias}.department_id=?`); args.push(actor.department_id); }
    if (actor.division_id) { match.push(`${alias}.division_id=?`); args.push(actor.division_id); }
    self.push(`(${match.join(" AND ")})`);
  }
  return { sql: self.length ? `(${self.join(" OR ")})` : "1=0", args };
}
export async function scopedEmployee(db: Db, actor: Actor, target: string, includeSelf = true) {
  const scoped = scope(actor, "e", includeSelf);
  const result = await one<Actor>(db, `SELECT e.* FROM employees e WHERE e.org_id=? AND e.id=? AND ${scoped.sql}`, actor.org_id, target, ...scoped.args);
  if (!result) return fail(404, "Employee not found in your scope.");
  return result;
}
export async function colleague(db: Db, actor: Actor, target: string) {
  requireStaff(actor);
  const result = await one<Actor>(db, `SELECT * FROM employees WHERE id=? AND org_id=? AND status='Active' AND role<>'guest'
    AND (?=1 OR (department_id IS NOT NULL AND department_id=?) OR manager_id=? OR id=?)`,
    target, actor.org_id, canSuper(actor) ? 1 : 0, actor.department_id, actor.id, actor.manager_id);
  if (!result) return fail(404, "That colleague is outside your communication scope.");
  return result;
}
export async function throttle(db: Db, key: string, max: number, windowMs: number) {
  const current = Date.now();
  const hit = await one<{ hits: number }>(db, `INSERT INTO rate_limits (id,hits,expires_at) VALUES (?,1,?)
    ON CONFLICT(id) DO UPDATE SET hits=CASE WHEN rate_limits.expires_at<=? THEN 1 ELSE rate_limits.hits+1 END,
    expires_at=CASE WHEN rate_limits.expires_at<=? THEN excluded.expires_at ELSE rate_limits.expires_at END RETURNING hits`,
    await digest(key), current + windowMs, current, current);
  if (!hit || hit.hits > max) fail(429, "Too many requests. Please wait and try again.");
}

export async function loadCatalog(): Promise<SiteCatalog> {
  const fallback: SiteCatalog = { services: [...divisions], markets: [{ code: "CA", enabled: 1, contact: "" }], availability: [], content: homepage };
  const db = workspaceDatabase();
  if (!db) return fallback;
  try {
    const [catalog, markets, availability, content] = await Promise.all([
      all<SiteCatalog["services"][number]>(db, "SELECT id,name,description,icon FROM services WHERE archived=0 ORDER BY sort,id"),
      all<SiteCatalog["markets"][number]>(db, "SELECT code,enabled,contact FROM markets"),
      all<SiteCatalog["availability"][number]>(db, `SELECT a.country,a.service_id,a.enabled,a.destination FROM availability a
        JOIN services s ON s.id=a.service_id AND s.archived=0 JOIN markets m ON m.code=a.country AND m.enabled=1 WHERE a.enabled=1`),
      one<SiteCatalog["content"]>(db, "SELECT title,description,about FROM site_content WHERE id='home'"),
    ]);
    return { services: content ? catalog : fallback.services, markets: markets.length ? markets : fallback.markets, availability, content: content ?? homepage };
  } catch {
    return fallback;
  }
}

function base64(bytes: Uint8Array) { return btoa(String.fromCharCode(...bytes)); }
function unbase64(value: string) { return Uint8Array.from(atob(value), (character) => character.charCodeAt(0)); }
async function encryptionKey() {
  if (!process.env.WALSHKEN_INTEGRATION_KEY) return fail(503, "Secure integration storage is awaiting environment configuration.");
  const raw = unbase64(process.env.WALSHKEN_INTEGRATION_KEY);
  if (raw.byteLength !== 32) return fail(503, "Secure integration storage is awaiting environment configuration.");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}
export async function encryptSettings(provider: string, settings: Record<string, string>) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: new TextEncoder().encode(provider) },
    await encryptionKey(), new TextEncoder().encode(JSON.stringify(settings)));
  return `${base64(iv)}.${base64(new Uint8Array(ciphertext))}`;
}
export async function decryptSettings(provider: string, value: string) {
  const [iv, ciphertext] = value.split(".");
  const clear = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unbase64(iv), additionalData: new TextEncoder().encode(provider) }, await encryptionKey(), unbase64(ciphertext));
  return JSON.parse(new TextDecoder().decode(clear)) as Record<string, string>;
}
