import { adminNav, staffNav } from "./catalog";
import { teamOptions } from "./collaboration";
import { all, canManage, canPayroll, canSuper, fail, json, loadCatalog, now, one, requireStaff, requireSuper, scope, type Actor, type Db, type Row } from "./server";
import { localDate, timeRows } from "./work";

const known = new Set<string>([...staffNav.flatMap((group)=>group.items.map((item)=>item[0])),...adminNav.map((item)=>item[0])]);
export function canOpen(actor:Actor,section:string){
  if(actor.role==="guest") return ["dashboard","profile","calls","documents","notifications"].includes(section);
  if(["departments","roles","document-security","audit","website","countries","integrations"].includes(section)) return canSuper(actor);
  if(["payroll","holidays"].includes(section)) return canPayroll(actor);
  if(section==="employees") return canManage(actor)&&actor.role!=="manager";
  if(["scheduling","approvals","reports"].includes(section)) return canManage(actor);
  return known.has(section);
}
async function staffChoices(db:Db,actor:Actor){
  const scoped=scope(actor);
  return all(db,`SELECT e.id,e.name,e.role FROM employees e WHERE e.org_id=? AND ${scoped.sql} AND e.status='Active' AND e.role<>'guest' ORDER BY e.name`,actor.org_id,...scoped.args);
}
async function projectRows(db:Db,actor:Actor){
  return all(db,`SELECT p.id,p.name,p.description,p.status,p.created_at,
    (SELECT count(*)::int FROM tasks t WHERE t.project_id=p.id) AS tasks
    FROM projects p WHERE p.org_id=? AND (?=1 OR p.owner_id=? OR (p.department_id IS NOT NULL AND p.department_id=?) OR
    EXISTS (SELECT 1 FROM tasks t WHERE t.project_id=p.id AND t.employee_id=?)) ORDER BY p.created_at DESC LIMIT 100`,
    actor.org_id,canSuper(actor)?1:0,actor.id,actor.department_id,actor.id);
}
async function taskRows(db:Db,actor:Actor,ownOnly=false){
  if(actor.role==="guest") return [];
  const scopeWhere=ownOnly?{sql:"e.id=?",args:[actor.id]}:scope(actor);
  return all(db,`SELECT t.id,t.title,t.description,t.employee_id,t.status,t.priority,t.due_date,t.start_date,t.actual_minutes,t.estimate_minutes,
    t.completed_at,e.name,p.name AS project FROM tasks t JOIN employees e ON e.id=t.employee_id LEFT JOIN projects p ON p.id=t.project_id
    WHERE t.org_id=? AND ${scopeWhere.sql} ORDER BY CASE WHEN t.status IN ('Completed','Cancelled') THEN 1 ELSE 0 END,
    t.due_date ASC NULLS LAST,t.created_at DESC LIMIT 150`,actor.org_id,...scopeWhere.args);
}
async function meetings(db:Db,actor:Actor){
  return all(db,`SELECT m.id,m.title,m.starts_at,m.ends_at,e.name AS organizer FROM meetings m
    JOIN meeting_members p ON p.meeting_id=m.id JOIN employees e ON e.id=m.organizer_id WHERE m.org_id=? AND p.employee_id=?
    ORDER BY m.starts_at DESC LIMIT 100`,actor.org_id,actor.id);
}
async function notifications(db:Db,actor:Actor){
  return all(db,"SELECT id,title,body,href,read_at,created_at FROM notifications WHERE employee_id=? ORDER BY created_at DESC LIMIT 70",actor.id);
}

export async function view(db:Db,actor:Actor,section:string,params:URLSearchParams){
  if(!canOpen(actor,section)) return fail(403,"You do not have access to this section.");
  if(section==="profile") return json({row:await one(db,`SELECT e.employee_no,e.name,e.email,e.title,e.role,e.country,e.jurisdiction,e.time_zone,
    e.hire_date,e.contract_start,e.employment_end,e.employment_type,e.phone,e.expected_hours,e.break_policy,e.leave_days,e.created_at,e.activated_at,e.last_login_at,
    d.name AS department,v.name AS division,o.name AS office,m.name AS manager
    FROM employees e LEFT JOIN units d ON d.id=e.department_id LEFT JOIN units v ON v.id=e.division_id LEFT JOIN units o ON o.id=e.office_id
    LEFT JOIN employees m ON m.id=e.manager_id WHERE e.id=?`,actor.id),
    sessions:await all(db,"SELECT created_at,expires_at,ended_at,agent FROM sessions WHERE employee_id=? ORDER BY created_at DESC LIMIT 15",actor.id)});
  if(section==="dashboard"){
    const [tasks,shiftRows,alerts,active,unsubmitted]=await Promise.all([
      taskRows(db,actor,true),
      actor.role==="guest"?Promise.resolve([]):all(db,"SELECT id,title,starts_at,ends_at,location FROM shifts WHERE employee_id=? AND published=1 AND ends_at>? ORDER BY starts_at LIMIT 5",actor.id,now()),
      notifications(db,actor),
      one(db,`SELECT a.id,a.starts_at,(SELECT b.starts_at FROM breaks b WHERE b.attendance_id=a.id AND b.ends_at IS NULL) AS break_started
        FROM attendance a WHERE a.employee_id=? AND a.ends_at IS NULL`,actor.id),
      one<{count:number}>(db,"SELECT count(*)::int AS count FROM timesheets WHERE employee_id=? AND status IN ('Draft','Returned')",actor.id),
    ]);
    return json({tasks,shifts:shiftRows,alerts,active,drafts:unsubmitted?.count??0});
  }
  if(section==="tasks") return json({rows:await taskRows(db,actor),staff:canManage(actor)?await staffChoices(db,actor):[],projects:await projectRows(db,actor)});
  if(section==="projects") return json({rows:await projectRows(db,actor)});
  if(["attendance","shifts","scheduling","timesheets","approvals","leave"].includes(section)){
    const rows=await timeRows(db,actor,section);
    const scoped=scope(actor,"e",false);
    const corrections=section==="attendance"
      ? await all(db,"SELECT id,note,status,created_at FROM corrections WHERE employee_id=? ORDER BY created_at DESC LIMIT 40",actor.id)
      : section==="approvals"
        ? await all(db,`SELECT c.id,c.note,c.status,c.created_at,e.name FROM corrections c JOIN employees e ON e.id=c.employee_id
          WHERE e.org_id=? AND ${scoped.sql} ORDER BY c.created_at DESC LIMIT 60`,actor.org_id,...scoped.args) : [];
    return json({rows,corrections,staff:canManage(actor)?await staffChoices(db,actor):[]});
  }
  if(section==="calendar"){
    const [tasks,shifts,events,leave,holidays]=await Promise.all([
      taskRows(db,actor,true),timeRows(db,actor,"shifts"),meetings(db,actor),
      all(db,"SELECT id,category,starts_on,ends_on FROM leave_requests WHERE employee_id=? AND status='Approved'",actor.id),
      all(db,"SELECT id,name,on_date,type FROM holidays WHERE org_id=? AND (jurisdiction=? OR jurisdiction=?) ORDER BY on_date",actor.org_id,actor.jurisdiction,actor.country),
    ]);
    return json({tasks,shifts,meetings:events,leave,holidays});
  }
  if(section==="directory") return json({rows:await teamOptions(db,actor)});
  if(section==="notifications") return json({rows:await notifications(db,actor)});
  if(section==="messages") return json({
    rows:await all(db,`SELECT c.id,CASE WHEN c.kind='Direct' THEN COALESCE((SELECT e.name FROM conversation_members n JOIN employees e ON e.id=n.employee_id WHERE n.conversation_id=c.id AND n.employee_id<>? LIMIT 1),c.title)
      ELSE c.title END AS title,c.kind,c.created_by,m.archived,
      (SELECT count(*)::int FROM messages msg WHERE msg.conversation_id=c.id AND msg.sender_id<>? AND msg.deleted_at IS NULL AND (m.last_read_at IS NULL OR msg.created_at>m.last_read_at)) AS unread
      FROM conversations c JOIN conversation_members m ON m.conversation_id=c.id WHERE c.org_id=? AND m.employee_id=? ORDER BY c.created_at DESC`,
      actor.id,actor.id,actor.org_id,actor.id),
    staff:await teamOptions(db,actor),
  });
  if(section==="calls") return json({rows:await meetings(db,actor),staff:await teamOptions(db,actor),
    provider:Boolean(await one(db,"SELECT id FROM integrations WHERE id='daily' AND enabled=1"))});
  if(section==="documents"||section==="document-security"){
    const global=section==="document-security";
    return json({
      rows:await all(db,`SELECT d.id,d.name,d.mime,d.bytes,d.owner_id,d.revoked_at,d.created_at,e.name AS owner,
        CASE WHEN d.owner_id=? OR g.allow_download=1 THEN 1 ELSE 0 END AS downloadable
        FROM documents d JOIN employees e ON e.id=d.owner_id LEFT JOIN document_grants g ON g.document_id=d.id AND g.employee_id=?
        WHERE d.org_id=? AND (?=1 OR (d.revoked_at IS NULL AND (d.owner_id=? OR g.id IS NOT NULL))) ORDER BY d.created_at DESC LIMIT 150`,
        actor.id,actor.id,actor.org_id,global?1:0,actor.id),
      staff:await teamOptions(db,actor),
    });
  }
  if(section==="salary") return json({rows:await all(db,"SELECT id,starts_on,ends_on,currency,payable_seconds,gross_cents,status FROM payroll WHERE org_id=? AND employee_id=? AND status='Approved' ORDER BY ends_on DESC",actor.org_id,actor.id)});
  if(section==="payroll"){
    const scoped=scope(actor);
    return json({staff:await staffChoices(db,actor),
      rows:await all(db,`SELECT p.id,p.starts_on,p.ends_on,p.currency,p.payable_seconds,p.gross_cents,p.status,e.name FROM payroll p
        JOIN employees e ON e.id=p.employee_id WHERE p.org_id=? AND ${scoped.sql} ORDER BY p.created_at DESC LIMIT 100`,actor.org_id,...scoped.args),
      rates:await all(db,`SELECT c.id,c.kind,c.amount_cents,c.currency,c.effective_on,e.name FROM compensation c
        JOIN employees e ON e.id=c.employee_id WHERE e.org_id=? AND ${scoped.sql} ORDER BY c.effective_on DESC LIMIT 100`,actor.org_id,...scoped.args),
    });
  }
  if(section==="holidays") return json({rows:await all(db,"SELECT id,name,on_date,jurisdiction,type FROM holidays WHERE org_id=? ORDER BY on_date DESC LIMIT 150",actor.org_id)});
  if(section==="employees"||section==="roles"){
    const scoped=scope(actor);
    return json({rows:await all(db,`SELECT e.id,e.name,e.employee_no,e.role,e.status,e.title,e.email,e.hire_date,e.activated_at,e.last_login_at,
      e.created_at,u.name AS department FROM employees e LEFT JOIN units u ON u.id=e.department_id
      WHERE e.org_id=? AND ${scoped.sql} ORDER BY e.name LIMIT 250`,actor.org_id,...scoped.args),
      units:canSuper(actor)?await all(db,"SELECT id,kind,name FROM units WHERE org_id=? ORDER BY kind,name",actor.org_id):[],
      staff:canSuper(actor)?await all(db,"SELECT id,name FROM employees WHERE org_id=? AND status='Active' AND role IN ('super_admin','admin','hr','manager') ORDER BY name",actor.org_id):[],
    });
  }
  if(section==="departments") return json({rows:await all(db,"SELECT id,kind,name,country,region,time_zone FROM units WHERE org_id=? ORDER BY kind,name",actor.org_id)});
  if(section==="audit"){
    const query=(params.get("q")??"").trim().slice(0,100);
    const start=params.get("from")??"";
    const end=params.get("to")??"";
    return json({rows:await all(db,`SELECT a.id,a.action,a.entity,a.target_id,a.created_at,e.name FROM audit a LEFT JOIN employees e ON e.id=a.actor_id
      WHERE a.org_id=? AND (?='' OR strpos(lower(a.action),lower(?))>0 OR strpos(lower(a.entity),lower(?))>0 OR strpos(lower(COALESCE(e.name,'')),lower(?))>0)
      AND (?='' OR left(a.created_at,10)>=?) AND (?='' OR left(a.created_at,10)<=?) ORDER BY a.created_at DESC LIMIT 200`,
      actor.org_id,query,query,query,query,start,start,end,end)});
  }
  if(section==="website"||section==="countries"){
    requireSuper(actor);
    return json({catalog:await loadCatalog(),
      rows:await all(db,"SELECT id,name,description,icon,sort,archived FROM services ORDER BY sort,id"),
      availability:await all(db,"SELECT country,service_id,enabled,destination FROM availability ORDER BY country,service_id"),
      inquiries:section==="website"?await all(db,"SELECT id,kind,name,email,country,service,message,created_at,status,customer_update,CASE WHEN customer_id IS NOT NULL THEN 1 ELSE 0 END AS customer_request FROM inquiries ORDER BY created_at DESC LIMIT 120"):[],
    });
  }
  if(section==="integrations") return json({rows:await all(db,"SELECT id,enabled,updated_at FROM integrations ORDER BY id"),secureStorage:Boolean(process.env.WALSHKEN_INTEGRATION_KEY)});
  if(section==="reports"){
    const scoped=scope(actor);
    const today=localDate(now(),actor.time_zone);
    return json({rows:await all(db,`SELECT e.id,e.name,e.status,
      (SELECT count(*)::int FROM attendance a WHERE a.employee_id=e.id AND a.ends_at IS NULL) AS clocked_in,
      (SELECT count(*)::int FROM tasks t WHERE t.employee_id=e.id AND t.status NOT IN ('Completed','Cancelled')) AS open_tasks,
      (SELECT count(*)::int FROM tasks t WHERE t.employee_id=e.id AND t.due_date<? AND t.status NOT IN ('Completed','Cancelled')) AS overdue_tasks,
      (SELECT count(*)::int FROM timesheets t WHERE t.employee_id=e.id AND t.status='Submitted') AS pending_timesheets
      FROM employees e WHERE e.org_id=? AND ${scoped.sql} ORDER BY e.name LIMIT 250`,today,actor.org_id,...scoped.args)});
  }
  return fail(404,"Section unavailable.");
}
