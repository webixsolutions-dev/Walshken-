import { randomBytes } from "node:crypto";
import { divisions, providers, roles } from "./catalog";
import {
  all, audit, canManage, canPayroll, canSuper, country, date, destination, digest, email, encryptSettings,
  fail, id, integer, json, now, one, pick, requireSuper, run, scopedEmployee, stmt, str, timeZone, type Actor, type Db,
} from "./server";

const types = ["Full-time", "Part-time", "Fixed-term", "Contractor"] as const;

export async function adminAction(db: Db, actor: Actor, area: string, action: string, data: Record<string, unknown>) {
  if (area === "employees") {
    if (!canManage(actor) || actor.role === "manager") return fail(403, "Employee administration access is required.");
    if (action === "add") {
      requireSuper(actor);
      const target = id();
      const role = pick(data.role, roles.filter((role) => role !== "super_admin"), "staff role");
      const department = str(data.department, "department", 80, false);
      const division = str(data.division, "division", 80, false);
      const office = str(data.office, "office", 80, false);
      const manager = str(data.manager, "manager", 80, false);
      for (const [key, kind] of [[department,"Department"],[division,"Division"],[office,"Office"]]) {
        if (key && !await one(db, "SELECT id FROM units WHERE id=? AND org_id=? AND kind=?", key, actor.org_id, kind)) fail(400, `Choose a valid ${kind.toLowerCase()}.`);
      }
      if (manager) {
        const supervisor = await scopedEmployee(db, actor, manager);
        if (!canManage(supervisor) || supervisor.status !== "Active") fail(400, "Choose an active manager.");
      }
      const code = randomBytes(27).toString("base64url");
      await db.batch([
        stmt(db, `INSERT INTO employees
          (id,org_id,employee_no,name,email,role,title,department_id,division_id,office_id,manager_id,country,jurisdiction,time_zone,
          employment_type,hire_date,contract_start,phone,expected_hours,break_policy,leave_days)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, target, actor.org_id, str(data.employeeNo,"employee ID",40),
          str(data.name,"employee name",100), email(data.email), role, str(data.title,"job title",100,false), department || null,
          division || null, office || null, manager || null, country(data.country || "CA"), str(data.jurisdiction || "CA-AB","jurisdiction",30),
          timeZone(data.timeZone || "America/Edmonton"), pick(data.employmentType || "Full-time",types,"employment type"),
          date(data.hireDate,"hire date",false), date(data.contractStart,"contract start date",false), str(data.phone,"phone number",40,false) || null,
          integer(data.expectedHours || "40","expected weekly hours",0,80), pick(data.breakPolicy || "unpaid",["paid","unpaid"],"break policy"),
          data.leaveDays ? integer(data.leaveDays,"leave days",0,365) : null),
        stmt(db, "INSERT INTO invitations (id,employee_id,code_hash,expires_at) VALUES (?,?,?,?)", id(), target, await digest(code), new Date(Date.now() + 48 * 3_600_000).toISOString()),
        audit(db, actor, "Employee created", "employee", target),
      ]);
      return json({ ok: true, code, message: "Employee created. The activation code expires in 48 hours." }, 201);
    }
    const target = str(data.id, "employee", 80);
    const employee = await scopedEmployee(db, actor, target, false);
    if (employee.role === "super_admin") return fail(403, "This administrator is protected.");
    if (action === "status") {
      const status = pick(data.status, ["Active","Suspended"], "account status");
      await db.batch([
        stmt(db, "UPDATE employees SET status=? WHERE id=?", status, target),
        stmt(db, "UPDATE sessions SET ended_at=? WHERE employee_id=? AND ended_at IS NULL AND ?='Suspended'", now(), target, status),
        audit(db, actor, status === "Suspended" ? "Employee suspended" : "Employee reactivated", "employee", target),
      ]);
      return json({ ok: true, message: `Employee ${status.toLowerCase()}.` });
    }
    if (action === "role") {
      requireSuper(actor);
      const role = pick(data.role, roles.filter((item) => item !== "super_admin"), "staff role");
      await db.batch([stmt(db,"UPDATE employees SET role=? WHERE id=?",role,target), audit(db,actor,"Role changed","employee",target)]);
      return json({ ok:true, message:"Staff role updated." });
    }
    if (action === "invite") {
      requireSuper(actor);
      if (employee.status !== "Active") return fail(409, "Reactivate this employee first.");
      const code = randomBytes(27).toString("base64url");
      await db.batch([
        stmt(db,"UPDATE invitations SET consumed_at=? WHERE employee_id=? AND consumed_at IS NULL",now(),target),
        stmt(db,"INSERT INTO invitations (id,employee_id,code_hash,expires_at) VALUES (?,?,?,?)",id(),target,await digest(code),new Date(Date.now()+48*3_600_000).toISOString()),
        audit(db,actor,"Access code issued","employee",target),
      ]);
      return json({ ok: true, code, message: "A new access code is ready. It expires in 48 hours." });
    }
  }
  if (area === "organization" && action === "add") {
    requireSuper(actor);
    const target = id();
    const kind = pick(data.kind, ["Department","Division","Office"], "organization unit type");
    await db.batch([
      stmt(db,"INSERT INTO units (id,org_id,kind,name,country,region,time_zone) VALUES (?,?,?,?,?,?,?)",
        target,actor.org_id,kind,str(data.name,"name",100),kind==="Office"?country(data.country||"CA"):null,
        kind==="Office"?str(data.region,"province or region",80,false):null,kind==="Office"?timeZone(data.timeZone||"America/Edmonton"):null),
      audit(db,actor,"Organization unit created","unit",target),
    ]);
    return json({ ok:true, message:`${kind} added.` },201);
  }
  if (area === "website") {
    requireSuper(actor);
    if (action === "copy") {
      await db.batch([
        stmt(db,`INSERT INTO site_content (id,title,description,about) VALUES ('home',?,?,?)
          ON CONFLICT(id) DO UPDATE SET title=excluded.title,description=excluded.description,about=excluded.about`,
          str(data.title,"homepage title",120),str(data.description,"homepage introduction",350),str(data.about,"about copy",1000)),
        audit(db,actor,"Homepage content updated","website"),
      ]);
      return json({ ok:true, message:"Homepage copy updated." });
    }
    if (action === "service") {
      const target = str(data.id,"service ID",100,false) || id();
      const icon = pick(data.icon, [...divisions.map((item) => item.icon), "services"], "service icon");
      await db.batch([
        stmt(db,`INSERT INTO services (id,name,description,icon,sort) VALUES (?,?,?,?,?)
          ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,icon=excluded.icon,sort=excluded.sort`,
          target,str(data.name,"service name",100),str(data.description,"service description",450),icon,integer(data.sort || "0","display order",0,1000)),
        audit(db,actor,"Service saved","service",target),
      ]);
      return json({ ok:true, message:"Service saved." });
    }
    if (action === "archive") {
      const target = str(data.id,"service",100);
      const archived = data.archived === "1" ? 1 : 0;
      await db.batch([stmt(db,"UPDATE services SET archived=? WHERE id=?",archived,target),audit(db,actor,archived?"Service archived":"Service restored","service",target)]);
      return json({ ok:true, message:archived?"Service archived.":"Service restored." });
    }
    if (action === "market") {
      const code = country(data.country);
      await db.batch([
        stmt(db,`INSERT INTO markets (code,enabled,contact) VALUES (?,?,?)
          ON CONFLICT(code) DO UPDATE SET enabled=excluded.enabled,contact=excluded.contact`,code,data.enabled==="1"?1:0,str(data.contact,"contact information",400,false)),
        audit(db,actor,"Country configuration updated","market",code),
      ]);
      return json({ ok:true, message:"Country settings saved." });
    }
    if (action === "availability") {
      const code = country(data.country);
      const service = str(data.service,"service",100);
      const link = destination(data.destination);
      const enabled = data.enabled === "1" ? 1 : 0;
      if (!await one(db,"SELECT id FROM services WHERE id=? AND archived=0",service)) return fail(404,"Service unavailable.");
      if (!await one(db,"SELECT code FROM markets WHERE code=?",code)) return fail(400,"Save the country settings first.");
      if (enabled && !link) return fail(400,"Set an approved service destination before publishing.");
      await db.batch([
        stmt(db,`INSERT INTO availability (id,country,service_id,enabled,destination) VALUES (?,?,?,?,?)
          ON CONFLICT(country,service_id) DO UPDATE SET enabled=excluded.enabled,destination=excluded.destination`,id(),code,service,enabled,link),
        audit(db,actor,"Service availability updated","service",service),
      ]);
      return json({ ok:true, message:"Service availability saved." });
    }
  }
  if (area === "integrations" && (action === "save" || action === "disable")) {
    requireSuper(actor);
    const provider = providers.find((item) => item.id === data.provider);
    if (!provider) return fail(400,"Choose a listed integration.");
    if (action === "disable") {
      await db.batch([stmt(db,"UPDATE integrations SET enabled=0,updated_at=? WHERE id=?",now(),provider.id),audit(db,actor,"Integration disabled","integration",provider.id)]);
      return json({ ok:true,message:"Integration disabled." });
    }
    const settings: Record<string,string> = {};
    for (const [key, label] of provider.fields) settings[key] = str(data[key],label,400);
    if (provider.id === "daily" && !/^[a-z0-9][a-z0-9-]{1,60}$/i.test(settings.domain)) return fail(400,"Enter the Daily subdomain without .daily.co.");
    const protectedValue = await encryptSettings(provider.id, settings);
    await db.batch([
      stmt(db,`INSERT INTO integrations (id,configuration,enabled,updated_at) VALUES (?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET configuration=excluded.configuration,enabled=excluded.enabled,updated_at=excluded.updated_at`,
        provider.id,protectedValue,data.enabled==="1"?1:0,now()),
      audit(db,actor,"Integration credentials rotated","integration",provider.id),
    ]);
    return json({ ok:true,message:"Integration settings saved securely." });
  }
  if (area === "holidays" && action === "add") {
    if (!canPayroll(actor)) return fail(403,"Payroll access is required.");
    const target=id();
    await db.batch([
      stmt(db,"INSERT INTO holidays (id,org_id,name,on_date,jurisdiction,type) VALUES (?,?,?,?,?,?)",target,actor.org_id,
        str(data.name,"holiday name",100),date(data.onDate,"holiday date"),str(data.jurisdiction,"jurisdiction",30),pick(data.type,["Company observance","Statutory calendar reference"],"holiday type")),
      audit(db,actor,"Holiday recorded","holiday",target),
    ]);
    return json({ok:true,message:"Holiday added to the calendar."},201);
  }
  return fail(404, "That admin action is unavailable.");
}
