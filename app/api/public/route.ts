import { checkOrigin, country, database, email, fail, handleError, id, json, loadCatalog, now, one, payload, pick, run, str, throttle } from "@/lib/walshken/server";

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const db = database();
    const data = await payload(request);
    const kind = pick(data.kind, ["inquiry", "interest"], "request type");
    const mailbox = email(data.email);
    const market = country(data.country);
    const service = str(data.service, "service", 100, false);
    const name = kind === "inquiry" ? str(data.name, "name", 100) : null;
    const message = kind === "inquiry" ? str(data.message, "message", 2000) : null;
    await throttle(db, `public-ip:${request.headers.get("x-vercel-forwarded-for") ?? "local"}`, 20, 300_000);
    await throttle(db, `public-email:${mailbox}`, 5, 300_000);
    if (service && !(await loadCatalog()).services.some((item) => item.id === service)) {
      fail(400, "Choose a listed service.");
    }
    if (kind === "interest" && await one(db, "SELECT id FROM inquiries WHERE kind='interest' AND email=? AND country=? AND service IS NOT DISTINCT FROM ?", mailbox, market, service || null)) return json({ ok: true });
    await run(db, "INSERT INTO inquiries (id,kind,name,email,country,service,message,created_at) VALUES (?,?,?,?,?,?,?,?)",
      id(), kind, name, mailbox, market, service || null, message, now());
    return json({ ok: true }, 201);
  } catch (error) { return handleError(error); }
}
