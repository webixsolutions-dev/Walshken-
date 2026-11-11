import { randomBytes } from "node:crypto";
import { passwordHash, passwordMatches } from "./passwords";
import {
  all, cookieValue, country, digest, email, fail, id, json, loadCatalog, now, one, run, sessionSet, str, throttle,
  type Db,
} from "./server";
import type { InquiryStatus } from "./customer-status";

type Customer = { id: string; name: string; email: string };
type Inquiry = {
  id: string; country: string; service: string | null; service_name: string | null; message: string;
  status: InquiryStatus; created_at: string; updated_at: string | null; customer_update: string | null;
};

const customerCookie = "walshken_customer";
const sessionSeconds = 43_200;
const validToken = /^[0-9a-f]{64}$/;
const clientIp = (request: Request) => request.headers.get("x-vercel-forwarded-for") ?? "local";

export function customerToken(header: string | null) {
  return cookieValue(header, customerCookie);
}

export async function customerFor(db: Db, token: string) {
  if (!validToken.test(token)) return null;
  return one<Customer>(db, `SELECT c.id,c.name,c.email FROM customers c JOIN customer_sessions s ON s.customer_id=c.id
    WHERE s.id=? AND s.expires_at>?`, await digest(token), now());
}

function readPassword(value: unknown) {
  if (typeof value !== "string" || !value || value.length > 160) return fail(400, "Enter a valid password.");
  return value;
}

function newPassword(value: unknown, confirmation: unknown) {
  const password = readPassword(value);
  if (password.length < 12) return fail(400, "Use a password of at least 12 characters.");
  if (password !== confirmation) return fail(400, "The passwords must match.");
  return password;
}

async function startSession(db: Db, customerId: string, token: string) {
  await run(db, "DELETE FROM customer_sessions WHERE customer_id=? AND expires_at<=?", customerId, now());
  const expires = new Date(Date.now() + sessionSeconds * 1000).toISOString();
  await run(db, "INSERT INTO customer_sessions (id,customer_id,expires_at) VALUES (?,?,?)", await digest(token), customerId, expires);
}

function sessionResponse(request: Request, token: string, status = 200) {
  return json({ ok: true }, status, { "Set-Cookie": sessionSet(request, token, token ? sessionSeconds : 0, customerCookie) });
}

export async function customerSignUp(request: Request, db: Db, data: Record<string, unknown>) {
  const name = str(data.name, "full name", 100);
  const mailbox = email(data.email);
  const password = newPassword(data.password, data.confirmPassword);
  await throttle(db, `customer-signup-ip:${clientIp(request)}`, 10, 3_600_000);
  await throttle(db, `customer-signup-email:${mailbox}`, 4, 3_600_000);

  const hash = await passwordHash(password);
  const customerId = id();
  const token = randomBytes(32).toString("hex");
  await db.transaction(async (tx) => {
    const result = await run(tx, "INSERT INTO customers (id,name,email,password_hash) VALUES (?,?,?,?) ON CONFLICT (email) DO NOTHING",
      customerId, name, mailbox, hash);
    if (!result.count) return fail(409, "If you already have a customer account, use the sign-in page.");
    await startSession(tx, customerId, token);
  });
  return sessionResponse(request, token, 201);
}

export async function customerSignIn(request: Request, db: Db, data: Record<string, unknown>) {
  const mailbox = email(data.email);
  const password = readPassword(data.password);
  await throttle(db, `customer-login-ip:${clientIp(request)}`, 30, 300_000);
  await throttle(db, `customer-login-email:${mailbox}`, 6, 300_000);
  const account = await one<{ id: string; password_hash: string }>(db, "SELECT id,password_hash FROM customers WHERE email=?", mailbox);
  if (!await passwordMatches(password, account?.password_hash) || !account) return fail(401, "Email or password is incorrect.");

  const token = randomBytes(32).toString("hex");
  await db.transaction(async (tx) => {
    const current = await one<{ password_hash: string }>(tx, "SELECT password_hash FROM customers WHERE id=? FOR UPDATE", account.id);
    if (current?.password_hash !== account.password_hash) return fail(401, "Sign in with your current password.");
    await startSession(tx, account.id, token);
  });
  return sessionResponse(request, token);
}

export async function customerSignOut(request: Request, db: Db, token: string) {
  if (validToken.test(token)) await run(db, "DELETE FROM customer_sessions WHERE id=?", await digest(token));
  return sessionResponse(request, "");
}

export async function customerInquiries(db: Db, customerId: string, page: number) {
  return all<Inquiry>(db, `SELECT i.id,i.country,i.service,s.name AS service_name,i.message,i.status,i.created_at,i.updated_at,i.customer_update
    FROM inquiries i LEFT JOIN services s ON s.id=i.service WHERE i.customer_id=? AND i.kind='inquiry'
    ORDER BY i.created_at DESC,i.id DESC LIMIT 21 OFFSET ?`, customerId, (page - 1) * 20);
}

export async function submitCustomerInquiry(request: Request, db: Db, actor: Customer, data: Record<string, unknown>) {
  const requestId = str(data.requestId, "request reference", 36);
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(requestId)) return fail(400, "Refresh the page and try again.");
  const market = country(data.country);
  const service = str(data.service, "service", 100, false);
  const message = str(data.message, "message", 2000);
  await throttle(db, `customer-inquiry-ip:${clientIp(request)}`, 20, 300_000);
  await throttle(db, `customer-inquiry-account:${actor.id}`, 5, 300_000);
  if (service && !(await loadCatalog()).services.some((item) => item.id === service)) return fail(400, "Choose a listed service.");
  const saved = await run(db, `INSERT INTO inquiries (id,kind,name,email,country,service,message,customer_id,created_at)
    VALUES (?,'inquiry',?,?,?,?,?,?,?) ON CONFLICT (id) DO NOTHING`,
    requestId, actor.name, actor.email, market, service || null, message, actor.id, now());
  if (!saved.count) {
    const existing = await one(db, "SELECT id FROM inquiries WHERE id=? AND customer_id=? AND country=? AND service IS NOT DISTINCT FROM ? AND message=?",
      requestId, actor.id, market, service || null, message);
    if (!existing) return fail(409, "Refresh the page to start a new request.");
  }
  return json({ ok: true }, saved.count ? 201 : 200);
}

export async function changeCustomerProfile(db: Db, actor: Customer, data: Record<string, unknown>) {
  await run(db, "UPDATE customers SET name=? WHERE id=?", str(data.name, "full name", 100), actor.id);
  return json({ ok: true, message: "Profile saved." });
}

export async function changeCustomerPassword(request: Request, db: Db, actor: Customer, token: string, data: Record<string, unknown>) {
  const current = readPassword(data.currentPassword);
  const password = newPassword(data.newPassword, data.confirmPassword);
  if (current === password) return fail(400, "Choose a different password.");
  await throttle(db, `customer-password:${actor.id}`, 6, 300_000);
  const hash = await passwordHash(password);
  await db.transaction(async (tx) => {
    const account = await one<{ password_hash: string }>(tx, "SELECT password_hash FROM customers WHERE id=? FOR UPDATE", actor.id);
    if (!account || !(await customerFor(tx, token))) return fail(401, "Sign in to change your password.");
    if (!await passwordMatches(current, account.password_hash)) return fail(401, "Current password is incorrect.");
    await run(tx, "UPDATE customers SET password_hash=? WHERE id=?", hash, actor.id);
    await run(tx, "DELETE FROM customer_sessions WHERE customer_id=?", actor.id);
  });
  return sessionResponse(request, "");
}
