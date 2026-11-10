import { taskStatuses } from "./catalog";
import {
  all, audit, canManage, canPayroll, canSuper, date, datetime, fail, id, integer, json, notify, now, one, pick,
  requireStaff, run, scope, scopedEmployee, stmt, str, type Actor, type Db, type Row,
} from "./server";

export function localDate(iso: string, zone: string) {
  const pieces = new Intl.DateTimeFormat("en-CA", { year:"numeric", month:"2-digit", day:"2-digit", timeZone:zone }).formatToParts(new Date(iso));
  return ["year","month","day"].map((key) => pieces.find((part) => part.type===key)?.value).join("-");
}
export function workSeconds(start: string, end: string) {
  return Math.max(0, Math.floor((Date.parse(end)-Date.parse(start))/1000));
}
export function payable(start: string, end: string, breaks: { starts_at: string; ends_at: string; paid: number }[]) {
  const gross = workSeconds(start,end);
  const unpaid = breaks.filter((row) => !row.paid).reduce((sum,row) => sum+workSeconds(row.starts_at,row.ends_at),0);
  return { gross, unpaid, paid: Math.max(0,gross-unpaid) };
}

export async function timeAction(db: Db, actor: Actor, area: string, action: string, data: Record<string,unknown>) {
  requireStaff(actor);
  if (area === "attendance") {
    if (action === "correction") {
      const target = str(data.attendanceId,"attendance entry",80,false);
      if (target && !await one(db,"SELECT id FROM attendance WHERE id=? AND employee_id=?",target,actor.id)) return fail(404,"Attendance entry unavailable.");
      const correction = id();
      await db.batch([
        stmt(db,"INSERT INTO corrections (id,attendance_id,employee_id,note) VALUES (?,?,?,?)",correction,target||null,actor.id,str(data.note,"correction details",1000)),
        audit(db,actor,"Correction requested","attendance",correction),
      ]);
      return json({ok:true,message:"Correction request submitted."},201);
    }
    const kind = pick(action,["in","out","start-break","end-break"],"attendance action");
    return db.transaction(async (tx) => {
      const active = await one<{ id:string; starts_at:string; time_zone:string }>(tx,
        "SELECT id,starts_at,time_zone FROM attendance WHERE employee_id=? AND ends_at IS NULL FOR UPDATE",actor.id);
      const at = now();
      if (kind === "in") {
        if (active) return fail(409,"You’re already clocked in.");
        const session = id();
        await run(tx,"INSERT INTO attendance (id,org_id,employee_id,starts_at,time_zone) VALUES (?,?,?,?,?)",session,actor.org_id,actor.id,at,actor.time_zone);
        await audit(tx,actor,"Clocked in","attendance",session).run();
        return json({ok:true,message:"You’re clocked in."});
      }
      if (!active) return fail(409,"Clock in to start tracking your time.");
      const pause = await one<{ id:string }>(tx,"SELECT id FROM breaks WHERE attendance_id=? AND ends_at IS NULL",active.id);
      if (kind === "start-break") {
        if (pause) return fail(409,"A break is already running.");
        await run(tx,"INSERT INTO breaks (id,attendance_id,starts_at,paid) VALUES (?,?,?,?)",id(),active.id,at,actor.break_policy==="paid"?1:0);
        await audit(tx,actor,"Break started","attendance",active.id).run();
        return json({ok:true,message:"Break started."});
      }
      if (kind === "end-break") {
        if (!pause) return fail(409,"There is no active break.");
        await run(tx,"UPDATE breaks SET ends_at=? WHERE id=?",at,pause.id);
        await audit(tx,actor,"Break ended","attendance",active.id).run();
        return json({ok:true,message:"Break ended."});
      }
      if (pause) return fail(409,"End your break before clocking out.");
      const breaks = await all<{ starts_at:string; ends_at:string; paid:number }>(tx,"SELECT starts_at,ends_at,paid FROM breaks WHERE attendance_id=?",active.id);
      const totals = payable(active.starts_at,at,breaks);
      await run(tx,"UPDATE attendance SET ends_at=? WHERE id=?",at,active.id);
      await run(tx,`INSERT INTO timesheets (id,attendance_id,org_id,employee_id,work_date,gross_seconds,unpaid_seconds,paid_seconds)
        VALUES (?,?,?,?,?,?,?,?)`,id(),active.id,actor.org_id,actor.id,localDate(active.starts_at,active.time_zone),totals.gross,totals.unpaid,totals.paid);
      await audit(tx,actor,"Clocked out","attendance",active.id).run();
      return json({ok:true,message:"Clocked out. Your draft timesheet is ready."});
    });
  }
  if (area === "timesheets") {
    if (action === "manual") {
      const employee = await scopedEmployee(db,actor,str(data.employee,"employee",80));
      if (!canManage(actor)) return fail(403,"Manual timesheet entry requires a manager.");
      const gross = integer(data.grossMinutes,"gross minutes",1,1440);
      const unpaid = integer(data.unpaidMinutes || "0","unpaid minutes",0,gross);
      const target = id();
      await db.batch([
        stmt(db,`INSERT INTO timesheets (id,org_id,employee_id,work_date,gross_seconds,unpaid_seconds,paid_seconds,status,note)
          VALUES (?,?,?,?,?,?,?,'Submitted',?)`,target,actor.org_id,employee.id,date(data.workDate,"work date"),gross*60,unpaid*60,(gross-unpaid)*60,str(data.note,"reason",600)),
        audit(db,actor,"Manual timesheet created","timesheet",target),
      ]);
      return json({ok:true,message:"Manual timesheet added for review."},201);
    }
    const target = str(data.id,"timesheet",80);
    const record = await one<{ employee_id:string; status:string }>(db,"SELECT employee_id,status FROM timesheets WHERE id=? AND org_id=?",target,actor.org_id);
    if (!record) return fail(404,"Timesheet not found.");
    return db.transaction(async (tx) => {
      if (action === "submit") {
        if (record.employee_id !== actor.id) return fail(404,"Timesheet not found.");
        const result = await run(tx,"UPDATE timesheets SET status='Submitted',reviewer_id=NULL,reviewed_at=NULL WHERE id=? AND status IN ('Draft','Returned')",target);
        if (!result.count) return fail(409,"Only draft or returned timesheets can be submitted.");
        await audit(tx,actor,"Timesheet submitted","timesheet",target).run();
        return json({ok:true,message:"Timesheet submitted."});
      }
      if (action === "review") {
        if (!canManage(actor)) return fail(403,"Review access is required.");
        await scopedEmployee(tx,actor,record.employee_id,false);
        const decision = pick(data.status,["Approved","Returned"],"review decision");
        const result = await run(tx,"UPDATE timesheets SET status=?,reviewer_id=?,reviewed_at=? WHERE id=? AND status='Submitted'",decision,actor.id,now(),target);
        if (!result.count) return fail(409,"This timesheet is no longer pending.");
        await audit(tx,actor,`Timesheet ${decision.toLowerCase()}`,"timesheet",target).run();
        await notify(tx,record.employee_id,`Timesheet ${decision.toLowerCase()}`,"Check your timesheets for the decision.","/staff/timesheets").run();
        return json({ok:true,message:`Timesheet ${decision.toLowerCase()}.`});
      }
      return fail(404,"That timesheet action is unavailable.");
    });
  }
  if (area === "corrections" && action === "review") {
    if (!canManage(actor)) return fail(403,"Review access is required.");
    const target = str(data.id,"correction",80);
    const correction = await one<{employee_id:string}>(db,"SELECT employee_id FROM corrections WHERE id=?",target);
    if (!correction) return fail(404,"Correction request unavailable.");
    await scopedEmployee(db,actor,correction.employee_id,false);
    const status=pick(data.status,["Reviewed","Returned"],"correction decision");
    return db.transaction(async (tx) => {
      if (!(await run(tx,"UPDATE corrections SET status=?,reviewer_id=?,reviewed_at=? WHERE id=? AND status='Pending'",status,actor.id,now(),target)).count) return fail(409,"This correction has already been reviewed.");
      await audit(tx,actor,"Correction reviewed","attendance",target).run();
      await notify(tx,correction.employee_id,"Attendance correction reviewed","Check attendance for the request status.","/staff/attendance").run();
      return json({ok:true,message:"Correction status updated."});
    });
  }
  if (area === "shifts" && action === "add") {
    if (!canManage(actor)) return fail(403,"Scheduling access is required.");
    const staff = await scopedEmployee(db,actor,str(data.employee,"employee",80));
    const start = datetime(data.startsAt,"shift start");
    const end = datetime(data.endsAt,"shift end");
    if (end<=start || workSeconds(start,end)>86400) return fail(400,"Shift end must be within 24 hours after its start.");
    const target = id();
    await db.transaction(async (tx) => {
      await one(tx,"SELECT id FROM employees WHERE id=? FOR UPDATE",staff.id);
      if (await one(tx,"SELECT id FROM shifts WHERE employee_id=? AND starts_at<? AND ends_at>?",staff.id,end,start)) return fail(409,"That employee already has an overlapping shift.");
      await run(tx,"INSERT INTO shifts (id,org_id,employee_id,starts_at,ends_at,title,location,created_by) VALUES (?,?,?,?,?,?,?,?)",
        target,actor.org_id,staff.id,start,end,str(data.title,"shift title",100),str(data.location,"work location",100),actor.id);
      await audit(tx,actor,"Shift published","shift",target).run();
      await notify(tx,staff.id,"Shift scheduled","Your schedule has been updated.","/staff/shifts").run();
    });
    return json({ok:true,message:"Shift published."},201);
  }
  if (area === "leave") {
    if (action === "request") {
      const start = date(data.startsOn,"start date")!;
      const end = date(data.endsOn,"end date")!;
      if (end<start) return fail(400,"End date must be on or after the start date.");
      const target=id();
      await db.batch([
        stmt(db,"INSERT INTO leave_requests (id,org_id,employee_id,category,starts_on,ends_on,note) VALUES (?,?,?,?,?,?,?)",
          target,actor.org_id,actor.id,pick(data.category,["Vacation","Sick leave","Personal leave","Other"],"leave type"),start,end,str(data.note,"note",500,false)),
        audit(db,actor,"Leave requested","leave",target),
      ]);
      return json({ok:true,message:"Leave request submitted."},201);
    }
    if (action === "review") {
      if (!canManage(actor)) return fail(403,"Review access is required.");
      const target=str(data.id,"leave request",80);
      const entry=await one<{employee_id:string}>(db,"SELECT employee_id FROM leave_requests WHERE id=? AND org_id=?",target,actor.org_id);
      if (!entry) return fail(404,"Leave request not found.");
      await scopedEmployee(db,actor,entry.employee_id,false);
      const status=pick(data.status,["Approved","Declined"],"decision");
      return db.transaction(async (tx) => {
        if (!(await run(tx,"UPDATE leave_requests SET status=?,reviewer_id=? WHERE id=? AND status='Pending'",status,actor.id,target)).count) return fail(409,"This request is no longer pending.");
        await audit(tx,actor,`Leave ${status.toLowerCase()}`,"leave",target).run();
        await notify(tx,entry.employee_id,`Leave ${status.toLowerCase()}`,"Your leave request has been reviewed.","/staff/leave").run();
        return json({ok:true,message:`Leave ${status.toLowerCase()}.`});
      });
    }
  }
  return fail(404,"That time or scheduling action is unavailable.");
}

async function visibleTask(db: Db, actor: Actor, target: string) {
  const scoped=scope(actor);
  const row=await one<{id:string;employee_id:string;status:string;assigned_by:string}>(db,`SELECT t.id,t.employee_id,t.status,t.assigned_by FROM tasks t JOIN employees e ON e.id=t.employee_id
    WHERE t.id=? AND t.org_id=? AND ${scoped.sql}`,target,actor.org_id,...scoped.args);
  if (!row) return fail(404,"Task not found in your workspace.");
  return row;
}

export async function workAction(db: Db, actor: Actor, area: string, action: string, data: Record<string,unknown>) {
  requireStaff(actor);
  if (area==="projects" && action==="add") {
    if (!canManage(actor)) return fail(403,"Project management access is required.");
    const target=id();
    await db.batch([
      stmt(db,"INSERT INTO projects (id,org_id,owner_id,department_id,name,description) VALUES (?,?,?,?,?,?)",
        target,actor.org_id,actor.id,actor.department_id,str(data.name,"project name",120),str(data.description,"project description",2000,false)),
      audit(db,actor,"Project created","project",target),
    ]);
    return json({ok:true,message:"Project created."},201);
  }
  if (area==="tasks" && action==="add") {
    if (!canManage(actor)) return fail(403,"Task assignment requires a manager.");
    const employee=await scopedEmployee(db,actor,str(data.employee,"assignee",80));
    const project=str(data.project,"project",80,false);
    if (project && !await one(db,"SELECT id FROM projects WHERE id=? AND org_id=? AND (?=1 OR owner_id=? OR department_id=?)",project,actor.org_id,canSuper(actor)?1:0,actor.id,actor.department_id)) return fail(404,"Project unavailable.");
    const start=date(data.startDate,"start date",false);
    const due=date(data.dueDate,"due date",false);
    if (start&&due&&due<start) return fail(400,"Due date must be on or after the start date.");
    const target=id(), title=str(data.title,"task title",150);
    await db.batch([
      stmt(db,`INSERT INTO tasks (id,org_id,employee_id,assigned_by,project_id,title,description,priority,start_date,due_date,estimate_minutes)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)`,target,actor.org_id,employee.id,actor.id,project||null,title,str(data.description,"task description",3000,false),
        pick(data.priority||"Normal",["Low","Normal","High","Urgent"],"priority"),start,due,integer(data.estimate || "0","estimated minutes",0,100000)),
      audit(db,actor,"Task assigned","task",target),
      notify(db,employee.id,"Task assigned",title,"/staff/tasks"),
    ]);
    return json({ok:true,message:"Task assigned."},201);
  }
  if (area==="tasks" && (action==="status"||action==="comment")) {
    const target=str(data.id,"task",80);
    const task=await visibleTask(db,actor,target);
    if (action==="comment") {
      await run(db,"INSERT INTO task_comments (id,task_id,author_id,body) VALUES (?,?,?,?)",id(),target,actor.id,str(data.body,"comment",1800));
      return json({ok:true,message:"Comment added."},201);
    }
    const status=pick(data.status,taskStatuses,"task status");
    if (["Completed","Cancelled"].includes(status) && !canManage(actor)) return fail(403,"A manager must approve completion or cancellation.");
    if (["Completed","Cancelled"].includes(task.status) && !canManage(actor)) return fail(409,"This task is closed.");
    const actual = data.actual ? integer(data.actual,"actual minutes",0,100000) : null;
    await db.batch([
      stmt(db,"UPDATE tasks SET status=?,actual_minutes=COALESCE(?,actual_minutes),completed_at=? WHERE id=?",status,actual,status==="Completed"?now():null,target),
      audit(db,actor,`Task moved to ${status}`,"task",target),
    ]);
    return json({ok:true,message:"Task updated."});
  }
  if (area==="notifications" && action==="read") {
    await run(db,"UPDATE notifications SET read_at=? WHERE employee_id=? AND read_at IS NULL",now(),actor.id);
    return json({ok:true,message:"Notifications marked as read."});
  }
  return fail(404,"That work action is unavailable.");
}

export async function taskDetails(db: Db, actor: Actor, target: string) {
  await visibleTask(db,actor,target);
  return all(db,`SELECT c.id,c.body,c.created_at,e.name FROM task_comments c JOIN employees e ON e.id=c.author_id WHERE c.task_id=? ORDER BY c.created_at DESC LIMIT 60`,target);
}

export async function payrollAction(db: Db, actor: Actor, action: string, data: Record<string,unknown>) {
  if (!canPayroll(actor)) return fail(403,"Payroll access is required.");
  const employee=await scopedEmployee(db,actor,str(data.employee,"employee",80));
  if (action==="rate") {
    const target=id();
    const currency=str(data.currency || "CAD","currency",3).toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) return fail(400,"Enter a three-letter currency code.");
    await db.batch([
      stmt(db,"INSERT INTO compensation (id,employee_id,kind,amount_cents,currency,effective_on,created_by) VALUES (?,?,?,?,?,?,?)",
        target,employee.id,pick(data.kind,["Hourly","Salaried"],"compensation type"),integer(data.amount,"amount in cents",1,1_000_000_000),
        currency,date(data.effective,"effective date"),actor.id),
      audit(db,actor,"Effective-dated compensation recorded","compensation",target),
    ]);
    return json({ok:true,message:"Compensation rate recorded."},201);
  }
  if (action==="estimate") {
    const start=date(data.startsOn,"period start")!, end=date(data.endsOn,"period end")!;
    if (end<start || workSeconds(start,end)>86400*62) return fail(400,"Choose a pay period of up to 63 days.");
    const approved=await all<{id:string;work_date:string;paid_seconds:number;starts_at:string|null;ends_at:string|null;time_zone:string|null}>(db,
      `SELECT t.id,t.work_date,t.paid_seconds,a.starts_at,a.ends_at,a.time_zone FROM timesheets t LEFT JOIN attendance a ON a.id=t.attendance_id
        WHERE t.employee_id=? AND t.org_id=? AND t.status='Approved' AND t.work_date BETWEEN ? AND ? ORDER BY t.work_date`,employee.id,actor.org_id,start,end);
    if (!approved.length) return fail(409,"There are no approved hours in that period.");
    const rates=await all<{id:string;kind:string;amount_cents:number;currency:string;effective_on:string}>(db,
      "SELECT id,kind,amount_cents,currency,effective_on FROM compensation WHERE employee_id=? AND effective_on<=? ORDER BY effective_on DESC",employee.id,end);
    let numerator=0n,seconds=0,currency="";
    const lineItems:{timesheet:string;rate:string;seconds:number}[]=[];
    for(const row of approved){
      if (row.ends_at && row.time_zone && localDate(row.ends_at,row.time_zone)!==row.work_date) return fail(409,"Overnight records require a payroll review before estimation.");
      const rate=rates.find((value)=>value.effective_on<=row.work_date);
      if(!rate||rate.kind!=="Hourly") return fail(409,"All approved records need an effective hourly rate for this estimator.");
      if(currency&&currency!==rate.currency) return fail(409,"Run separate estimates for different currencies.");
      currency=rate.currency;seconds+=row.paid_seconds;numerator+=BigInt(row.paid_seconds)*BigInt(rate.amount_cents);
      lineItems.push({timesheet:row.id,rate:rate.id,seconds:row.paid_seconds});
    }
    const gross=(numerator+1800n)/3600n;
    if (gross>2147483647n) return fail(409,"This estimate exceeds the supported amount. Review the period and rates.");
    const target=id();
    await db.batch([
      stmt(db,`INSERT INTO payroll (id,org_id,employee_id,starts_on,ends_on,currency,payable_seconds,gross_cents,calculation,created_by)
        VALUES (?,?,?,?,?,?,?,?,?,?)`,target,actor.org_id,employee.id,start,end,currency,seconds,Number(gross),
        JSON.stringify({version:"base-hourly-v1",lineItems,excludes:["overtime","statutory holiday pay","taxes","deductions"]}),actor.id),
      audit(db,actor,"Gross estimate saved","payroll",target),
    ]);
    return json({ok:true,message:"Base gross estimate saved for review."},201);
  }
  return fail(404,"That payroll action is unavailable.");
}

export async function timeRows(db: Db, actor: Actor, section: string) {
  const scopeWhere=scope(actor,"e",section!=="approvals");
  const filter = section==="timesheets" || section==="shifts" || section==="attendance"
    ? {sql:"e.id=?",args:[actor.id]} : scopeWhere;
  let rows: Row[];
  if (section==="shifts"||section==="scheduling") {
    rows=await all(db,`SELECT s.id,s.title,s.starts_at,s.ends_at,s.location,e.name FROM shifts s JOIN employees e ON e.id=s.employee_id
      WHERE s.org_id=? AND s.published=1 AND ${filter.sql} ORDER BY s.starts_at DESC LIMIT 160`,actor.org_id,...filter.args);
  } else if (section==="leave") {
    rows=await all(db,`SELECT l.id,l.category,l.starts_on,l.ends_on,l.status,l.note,l.employee_id,e.name FROM leave_requests l JOIN employees e ON e.id=l.employee_id
      WHERE l.org_id=? AND ${filter.sql} ORDER BY l.created_at DESC LIMIT 150`,actor.org_id,...filter.args);
  } else if (section==="attendance") {
    rows=await all(db,`SELECT a.id,a.starts_at,a.ends_at,a.time_zone,
      (SELECT b.starts_at FROM breaks b WHERE b.attendance_id=a.id AND b.ends_at IS NULL) AS break_started
      FROM attendance a WHERE a.employee_id=? ORDER BY a.starts_at DESC LIMIT 60`,actor.id);
  } else {
    rows=await all(db,`SELECT t.id,t.work_date,t.gross_seconds,t.unpaid_seconds,t.paid_seconds,t.status,t.note,t.reviewed_at,e.name FROM timesheets t
      JOIN employees e ON e.id=t.employee_id WHERE t.org_id=? AND ${filter.sql} ${section==="approvals"?"AND t.status IN ('Submitted','Approved','Returned')":""}
      ORDER BY t.work_date DESC,t.created_at DESC LIMIT 160`,actor.org_id,...filter.args);
  }
  return rows;
}
