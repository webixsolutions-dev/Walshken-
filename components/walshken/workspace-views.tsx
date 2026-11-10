"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { countryName, roleNames, taskStatuses, type Role } from "@/lib/walshken/catalog";
import { Icon } from "./brand";
import type { SiteCatalog } from "@/lib/walshken/public-catalog";
import type { Viewer } from "./workspace";
import { ActionForm, api, dateText, Disclosure, Empty, hours, initials, money, options, Panel, Quick, Status, Table, usePreview, useWorkspaceHref, value, type Field, type RecordRow } from "./ui";

export type ViewData = {
  rows?:RecordRow[]; row?:RecordRow; staff?:RecordRow[]; projects?:RecordRow[]; shifts?:RecordRow[]; tasks?:RecordRow[];
  alerts?:RecordRow[]; corrections?:RecordRow[]; meetings?:RecordRow[]; leave?:RecordRow[]; holidays?:RecordRow[];
  sessions?:RecordRow[]; units?:RecordRow[]; rates?:RecordRow[]; availability?:RecordRow[]; inquiries?:RecordRow[];
  previewComments?:RecordRow[]; previewMessages?:RecordRow[]; previewMembers?:RecordRow[];
  active?:RecordRow|null; drafts?:number; provider?:boolean; secureStorage?:boolean; catalog?:SiteCatalog;
};
export const manages=(actor:Viewer)=>["super_admin","admin","manager","hr"].includes(actor.role);
export const employeeField=(staff:RecordRow[],name="employee",label="Employee"):Field=>({name,label,options:options(staff),required:true});
const field=(name:string,label:string,type="text",required=true):Field=>({name,label,type,required});
const column=(key:string,title:string)=>({key,title});
const statusColumn={key:"status",title:"Status",render:(row:RecordRow)=><Status>{row.status}</Status>};
export const dateColumn=(key:string,title:string,withTime=false,zone?:string)=>({key,title,render:(row:RecordRow)=>dateText(row[key],withTime,zone)});
const durationColumn=(key:string,title:string)=>({key,title,render:(row:RecordRow)=>hours(row[key])});

function Overview({actor,data,refresh}:{actor:Viewer;data:ViewData;refresh:()=>void}){
  const staffHref=useWorkspaceHref();
  const tasks=(data.tasks??[]).filter((task)=>!["Completed","Cancelled"].includes(value(task,"status")));
  const alerts=(data.alerts??[]).filter((notice)=>!notice.read_at);
  const stats=actor.role==="guest"?[["bell","Unread notifications",alerts.length,"/staff/notifications"]]:
    [["check","Open tasks",tasks.length,"/staff/tasks"],["shift","Upcoming shifts",data.shifts?.length??0,"/staff/shifts"],
      ["list","Draft timesheets",data.drafts??0,"/staff/timesheets"],["bell","Unread notifications",alerts.length,"/staff/notifications"]];
  return <>
    <div className="dashboard-banner"><div><div className="section-kicker"><span/> YOUR WORKDAY</div><h2>{data.active?data.active.break_started?"You’re on a break.":"You’re clocked in.":"Your workday at a glance."}</h2>
      <p>{data.active?"Manage your active shift from attendance.":"Check your tasks, shifts and recent updates."}</p>
      {actor.role!=="guest"&&(data.active?<a href={staffHref("/staff/attendance")} className="btn btn-white btn-small">Open attendance <Icon name="right" size={16}/></a>
        :<Quick path="attendance/in" refresh={refresh} variant="white"><Icon name="clock" size={16}/> Clock in</Quick>)}</div><div className="dashboard-motif" aria-hidden="true"><Icon name="layout" size={98}/></div></div>
    <div className="stats-grid">{stats.map(([icon,label,number,href])=><a className="stat-card" href={staffHref(String(href))} key={label}><span className="icon-tile"><Icon name={String(icon)} size={19}/></span><strong>{number}</strong><span>{label}</span><Icon name="external" className="stat-arrow" size={16}/></a>)}</div>
    <div className="panel-grid">
      {actor.role!=="guest"&&<Panel title="Upcoming tasks" action={<a className="text-link" href={staffHref("/staff/tasks")}>View tasks <Icon name="right" size={15}/></a>}>
        <Table rows={tasks.slice(0,5)} columns={[column("title","Task"),dateColumn("due_date","Due"),statusColumn]} empty="No open tasks"/>
      </Panel>}
      <Panel title="Recent updates" action={<a className="text-link" href={staffHref("/staff/notifications")}>View notifications <Icon name="right" size={15}/></a>}>
        {(data.alerts??[]).length?<div className="notification-list">{(data.alerts??[]).slice(0,5).map((row)=><a href={staffHref(value(row,"href"))} key={value(row,"id")}><span className="icon-tile"><Icon name="bell" size={16}/></span><div><strong>{row.title}</strong><small>{row.body}</small></div><Icon name="next" size={16}/></a>)}</div>
          :<Empty title="You’re all caught up" body="New assignments and decisions will appear here." icon="bell"/>}
      </Panel>
    </div>
  </>;
}

function Tasks({actor,data,refresh}:{actor:Viewer;data:ViewData;refresh:()=>void}){
  const preview=usePreview();
  const [selected,setSelected]=useState(""),[comments,setComments]=useState<RecordRow[]>([]),[error,setError]=useState("");
  const rows=data.rows??[];
  const task=rows.find((row)=>row.id===selected);
  const loadComments=useCallback(()=>{
    if(!selected)return;
    if(preview){setComments(data.previewComments??[]);return;}
    api(`task-comments/${selected}`).then((result)=>{setComments(result.rows);setError("");},(e)=>setError(e.message));
  },[selected,preview,data.previewComments]);
  useEffect(()=>{loadComments();},[loadComments]);
  return <>
    <Panel title="Task list" note={manages(actor)?"Assignments in your scope":"Your assigned work"}>
      {manages(actor)&&<Disclosure title="Assign a task"><ActionForm path="tasks/add" fields={[
        field("title","Task title"),employeeField(data.staff??[],"employee","Assignee"),{name:"project",label:"Project",options:options(data.projects??[])},
        {name:"priority",label:"Priority",options:["Low","Normal","High","Urgent"],value:"Normal",required:true},
        field("startDate","Start date","date",false),field("dueDate","Due date","date",false),field("estimate","Estimated minutes","number",false),field("description","Description","textarea",false),
      ]} submit="Assign task" refresh={refresh}/></Disclosure>}
      <Table rows={rows} columns={[column("title","Task"),column("name","Assignee"),column("priority","Priority"),dateColumn("due_date","Due"),statusColumn]}
        actions={(row)=><button type="button" className="btn btn-outline btn-small" onClick={()=>{setSelected(value(row,"id"));setComments([]);setError("");}}>Open</button>}/>
    </Panel>
    {task&&<Panel title={value(task,"title")} note={value(task,"description")||"Task details"}>
      <ActionForm key={selected} path="tasks/status" fields={[
        {name:"status",label:"Progress",options:manages(actor)?taskStatuses:taskStatuses.filter((s)=>s!=="Completed"&&s!=="Cancelled"),value:task.status,required:true},
        {name:"actual",label:"Actual minutes",type:"number",value:task.actual_minutes,min:0,max:100000},
      ]} extra={{id:selected}} submit="Update progress" refresh={refresh} reset={false}/>
      <h3 className="subheading">Discussion</h3>
      {error&&<p className="form-error">{error}</p>}
      <Table rows={comments} columns={[column("name","Author"),column("body","Comment"),dateColumn("created_at","Posted",true,actor.timeZone)]} empty="No comments yet"/>
      <ActionForm path="tasks/comment" fields={[field("body","Add a comment","textarea")]} extra={{id:selected}} submit="Post comment" refresh={loadComments}/>
    </Panel>}
  </>;
}

function TimeViews({section,actor,data,refresh}:{section:string;actor:Viewer;data:ViewData;refresh:()=>void}){
  const rows=data.rows??[], corrections=data.corrections??[],zone=actor.timeZone;
  if(section==="attendance"){
    const active=rows.find((row)=>!row.ends_at);
    return <>
      <Panel title="Time clock" note="Attendance is tracked separately from sign-in.">
        <div className="clock-panel"><span className="icon-tile"><Icon name={active?.break_started?"coffee":"clock"} size={28}/></span>
          <div><strong>{active?active.break_started?"On break":"Clocked in":"Clocked out"}</strong><small>{active?dateText(active.break_started||active.starts_at,true,zone):"Start when you begin working."}</small></div>
          <div className="clock-actions">{!active?<Quick path="attendance/in" refresh={refresh} variant="blue">Clock in</Quick>
            :active.break_started?<Quick path="attendance/end-break" refresh={refresh} variant="blue">End break</Quick>
              :<><Quick path="attendance/start-break" refresh={refresh}>Start break</Quick><Quick path="attendance/out" refresh={refresh} variant="blue">Clock out</Quick></>}</div>
        </div>
      </Panel>
      <Panel title="Attendance history"><Table rows={rows} columns={[dateColumn("starts_at","Clock in",true,zone),dateColumn("ends_at","Clock out",true,zone),column("time_zone","Recorded time zone")]}/></Panel>
      <Panel title="Correction requests"><Disclosure title="Request a correction"><ActionForm path="attendance/correction" fields={[
        {name:"attendanceId",label:"Attendance entry",options:rows.map((row)=>[value(row,"id"),dateText(row.starts_at,true,zone)] as const)},field("note","What needs correcting?","textarea"),
      ]} submit="Submit correction" refresh={refresh}/></Disclosure><Table rows={corrections} columns={[column("note","Request"),dateColumn("created_at","Requested"),statusColumn]}/></Panel>
    </>;
  }
  if(section==="shifts"||section==="scheduling") return <Panel title={section==="scheduling"?"Published schedules":"My published shifts"}>
    {section==="scheduling"&&<Disclosure title="Publish a shift"><ActionForm path="shifts/add" fields={[
      employeeField(data.staff??[]),field("title","Shift title"),field("location","Location"),field("startsAt","Start in your device time zone","datetime-local"),field("endsAt","End in your device time zone","datetime-local"),
    ]} submit="Publish shift" refresh={refresh}/></Disclosure>}
    <Table rows={rows} columns={[column("title","Shift"),column("name","Employee"),dateColumn("starts_at","Starts",true,zone),dateColumn("ends_at","Ends",true,zone),column("location","Location")]} empty="No shifts published"/>
  </Panel>;
  if(section==="leave") return <Panel title="Leave requests">
    <Disclosure title="Request leave"><ActionForm path="leave/request" fields={[
      {name:"category",label:"Leave type",options:["Vacation","Sick leave","Personal leave","Other"],required:true},field("startsOn","First day","date"),
      field("endsOn","Last day","date"),field("note","Note","textarea",false),
    ]} submit="Request leave" refresh={refresh}/></Disclosure>
    <Table rows={rows} columns={[column("name","Employee"),column("category","Type"),dateColumn("starts_on","From"),dateColumn("ends_on","Through"),statusColumn]}
      actions={manages(actor)?(row)=>row.status==="Pending"&&row.employee_id!==actor.id&&<><Quick path="leave/review" data={{id:row.id,status:"Approved"}} refresh={refresh}>Approve</Quick><Quick path="leave/review" data={{id:row.id,status:"Declined"}} refresh={refresh}>Decline</Quick></>:undefined}/>
  </Panel>;
  const review=section==="approvals";
  return <>
    <Panel title={review?"Timesheet queue":"My timesheets"} note="Payable time excludes unpaid breaks.">
      {review&&<Disclosure title="Add manual entry"><ActionForm path="timesheets/manual" fields={[
        employeeField((data.staff??[]).filter((row)=>row.id!==actor.id)),field("workDate","Work date","date"),field("grossMinutes","Gross minutes","number"),
        field("unpaidMinutes","Unpaid break minutes","number",false),field("note","Reason","textarea"),
      ]} submit="Add for review" refresh={refresh}/></Disclosure>}
      <Table rows={rows} columns={[column("name","Employee"),dateColumn("work_date","Work date"),durationColumn("gross_seconds","Gross"),
        durationColumn("unpaid_seconds","Unpaid break"),durationColumn("paid_seconds","Payable"),statusColumn]} actions={(row)=>review?
          row.status==="Submitted"&&<><Quick path="timesheets/review" data={{id:row.id,status:"Approved"}} refresh={refresh}>Approve</Quick>
            <Quick path="timesheets/review" data={{id:row.id,status:"Returned"}} refresh={refresh}>Return</Quick></>
        :["Draft","Returned"].includes(value(row,"status"))&&<Quick path="timesheets/submit" data={{id:row.id}} refresh={refresh}>Submit</Quick>}/>
    </Panel>
    {review&&<Panel title="Attendance corrections" note="Record your review decision, then enter adjusted hours as a separate manual timesheet when applicable.">
      <Table rows={corrections} columns={[column("name","Employee"),column("note","Request"),statusColumn]} actions={(row)=>row.status==="Pending"&&
        <><Quick path="corrections/review" data={{id:row.id,status:"Reviewed"}} refresh={refresh}>Mark reviewed</Quick>
        <Quick path="corrections/review" data={{id:row.id,status:"Returned"}} refresh={refresh}>Return</Quick></>}/>
    </Panel>}
  </>;
}
export { TimeViews };

function Calendar({data,actor}:{data:ViewData;actor:Viewer}){
  const [view,setView]=useState("Month"),[focus,setFocus]=useState(()=>new Date());
  const [eventType,setEventType]=useState("All events");
  const local=(input:string)=>new Intl.DateTimeFormat("en-CA",{year:"numeric",month:"2-digit",day:"2-digit",timeZone:actor.timeZone}).format(new Date(input));
  const getDay=(day:Date)=>`${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,"0")}-${String(day.getDate()).padStart(2,"0")}`;
  const events=[
    ...(data.shifts??[]).map((r)=>({id:r.id,date:local(value(r,"starts_at")),title:r.title,type:"Shift"})),
    ...(data.tasks??[]).filter((r)=>r.due_date).map((r)=>({id:r.id,date:value(r,"due_date"),title:r.title,type:"Task"})),
    ...(data.meetings??[]).map((r)=>({id:r.id,date:local(value(r,"starts_at")),title:r.title,type:"Meeting"})),
    ...(data.holidays??[]).map((r)=>({id:r.id,date:value(r,"on_date"),title:r.name,type:"Holiday"})),
    ...(data.leave??[]).map((r)=>({id:r.id,date:value(r,"starts_on"),end:value(r,"ends_on"),title:r.category,type:"Leave"})),
  ];
  const first=new Date(focus.getFullYear(),focus.getMonth(),view==="Month"?1:focus.getDate());
  if(view!=="Day") first.setDate(first.getDate()-first.getDay());
  const days=Array.from({length:view==="Month"?42:view==="Week"?7:1},(_,index)=>new Date(first.getFullYear(),first.getMonth(),first.getDate()+index));
  function move(n:number){
    setFocus((current)=>view==="Month"?new Date(current.getFullYear(),current.getMonth()+n,1):new Date(current.getFullYear(),current.getMonth(),current.getDate()+n*(view==="Week"?7:1)));
  }
  return <Panel title="Work calendar" action={<div className="calendar-controls"><button type="button" className="icon-button" aria-label="Previous" onClick={()=>move(-1)}><Icon name="previous" size={17}/></button>
    <button type="button" className="icon-button" aria-label="Next" onClick={()=>move(1)}><Icon name="next" size={17}/></button></div>}>
    <div className="calendar-filter"><strong>{new Intl.DateTimeFormat("en-CA",{month:"long",year:"numeric",...(view==="Day"?{day:"numeric"}:{})}).format(focus)}</strong>
      <label className="sr-only" htmlFor="cal-mode">Calendar view</label><select id="cal-mode" value={view} onChange={(e)=>setView(e.target.value)}>{["Month","Week","Day"].map((label)=><option key={label}>{label}</option>)}</select>
      <label className="sr-only" htmlFor="event-type">Event type</label><select id="event-type" value={eventType} onChange={(e)=>setEventType(e.target.value)}>{["All events","Shift","Task","Meeting","Holiday","Leave"].map((label)=><option key={label}>{label}</option>)}</select></div>
    <div className="calendar-scroll"><div className={view==="Day"?"calendar-grid calendar-day":"calendar-grid"}>
      {view!=="Day"&&["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((day)=><span className="calendar-weekday" key={day}>{day}</span>)}
      {days.map((day)=>{const dayKey=getDay(day);return <div className={day.getMonth()===focus.getMonth()?"calendar-cell":"calendar-cell outside"} key={dayKey}>
        <strong>{day.getDate()}</strong>
        {events.filter((event)=>(event.date===dayKey||("end" in event&&String(event.date)<=dayKey&&String(event.end)>=dayKey))&&(eventType==="All events"||eventType===event.type)).map((event)=>
          <span className="calendar-event" title={`${event.type}: ${event.title}`} key={`${event.type}-${event.id}`}>{event.title}</span>)}
      </div>;})}
    </div></div>
  </Panel>;
}

function Messages({data,actor,refresh}:{data:ViewData;actor:Viewer;refresh:()=>void}){
  const preview=usePreview();
  const [target,setTarget]=useState(preview?value(data.rows?.[0],"id"):""),[rows,setRows]=useState<RecordRow[]>(data.previewMessages??[]),[members,setMembers]=useState<RecordRow[]>(data.previewMembers??[]),
    [search,setSearch]=useState(""),[body,setBody]=useState(""),[error,setError]=useState(""),[reply,setReply]=useState<RecordRow|null>(null),
    [editing,setEditing]=useState<RecordRow|null>(null),[archived,setArchived]=useState(false),[sending,setSending]=useState(false);
  const current=data.rows?.find((row)=>row.id===target);
  const load=useCallback(()=>{
    if(!target)return;
    if(preview){setRows((data.previewMessages??[]).filter((row)=>value(row,"body").toLowerCase().includes(search.toLowerCase())));return;}
    api(`conversation/${target}?q=${encodeURIComponent(search)}`).then((result)=>{setRows(result.rows);setMembers(result.members);setError("");},(e)=>setError(e.message));
  },[target,search,preview,data.previewMessages]);
  useEffect(()=>{load();const timer=setInterval(()=>{if(document.visibilityState==="visible")load();},6000);return()=>clearInterval(timer);},[load]);
  function choose(id:string){
    setTarget(id);setRows([]);setReply(null);setEditing(null);setSearch("");setBody("");setError("");
    if(preview) return;
    api("messages/read",{conversation:id}).then(refresh).catch((e)=>setError(e.message));
  }
  async function send(event:FormEvent){
    event.preventDefault();if(preview||!body.trim())return;setSending(true);
    try{
      await api(editing?"messages/edit":"messages/send",{conversation:target,body,reply:reply?.id,id:editing?.id});
      setBody("");setReply(null);setEditing(null);load();
    }catch(e){setError(e instanceof Error?e.message:"Unable to send.");}
    finally{setSending(false);}
  }
  return <Panel title="Conversations">
    <Disclosure title="Start a conversation"><ActionForm path="messages/create" fields={[
      {name:"kind",label:"Conversation type",options:manages(actor)?["Direct","Department","Project","Company","Private"]:["Direct"],value:"Direct",required:true},
      field("title","Group name","text",false),{name:"members",label:"Participants",options:options((data.staff??[]).filter((r)=>r.id!==actor.id)),multiple:true,required:true},
    ]} submit="Create conversation" refresh={refresh} onDone={(result)=>{if(result.id)choose(result.id);}}/></Disclosure>
    <div className="messaging"><aside className="channel-list"><label className="check-label"><input type="checkbox" checked={archived} onChange={(e)=>setArchived(e.target.checked)}/> Archived</label>
      {(data.rows??[]).filter((row)=>Boolean(row.archived)===archived).map((row)=><button type="button" key={value(row,"id")}
        className={row.id===target?"channel active":"channel"} onClick={()=>choose(value(row,"id"))}><Icon name={row.kind==="Direct"?"message":"hash"} size={16}/>
        <span>{row.title}</span>{Boolean(row.unread)&&<b>{row.unread}</b>}</button>)}</aside>
      <div className="chat-thread">{!current?<Empty title="Open a conversation" body="Select a channel or start a direct message." icon="message"/>:<>
        <div className="chat-top"><div><strong>{current.title}</strong><small>{current.kind} · {members.length} participants</small></div>
          <Quick path="messages/archive" data={{conversation:target,archived:current.archived?"0":"1"}} refresh={refresh}>{current.archived?"Restore":"Archive"}</Quick></div>
        <div className="chat-search"><label className="sr-only" htmlFor="message-search">Search messages</label><input id="message-search" placeholder="Search this conversation" value={search} onChange={(e)=>setSearch(e.target.value)}/></div>
        {(current.created_by===actor.id||actor.role==="super_admin")&&current.kind!=="Direct"&&<Disclosure title="Manage participants">
          <ActionForm path="messages/member" fields={[employeeField(data.staff??[]),{name:"operation",label:"Action",options:[["add","Add"],["remove","Remove"]],required:true}]}
            extra={{conversation:target}} submit="Update participants" refresh={load}/></Disclosure>}
        <div className="chat-history" aria-live="polite">
          {!rows.length&&<Empty title={search?"No matching messages":"No messages yet"} body={search?"Try a different term.":"Start the conversation with a message."} icon="message"/>}
          {rows.map((row)=>{
            const own=row.sender_id===actor.id,removed=Boolean(row.deleted_at);
            const quoted=rows.find((candidate)=>candidate.id===row.reply_to);
            return <article key={value(row,"id")} className={own?"chat-message mine":"chat-message"}><span className="avatar">{initials(value(row,"name"))}</span>
              <div><div className="chat-byline"><strong>{row.name}</strong><small>{dateText(row.created_at,true,actor.timeZone)}</small>{Boolean(row.edited_at)&&<small>edited</small>}{Boolean(row.pinned)&&<Status>Pinned</Status>}</div>
              <div className="message-bubble">{quoted&&!removed&&<small className="chat-quote">Reply to {quoted.name}: {String(quoted.body).slice(0,100)}</small>}
                <p>{removed?"Message removed":row.body}</p></div>
              {!removed&&<div className="chat-actions"><button type="button" onClick={()=>{setReply(row);setEditing(null);}}>Reply</button>
                <Quick path="messages/reaction" data={{conversation:target,id:row.id,emoji:"👍"}} refresh={load}>👍 {row.reactions||""}</Quick>
                {(current.created_by===actor.id||actor.role==="super_admin")&&<Quick path="messages/pin" data={{conversation:target,id:row.id,pinned:row.pinned?"0":"1"}} refresh={load}>{row.pinned?"Unpin":"Pin"}</Quick>}
                {own&&<><button type="button" onClick={()=>{setEditing(row);setReply(null);setBody(value(row,"body"));}}>Edit</button>
                  <Quick path="messages/delete" data={{conversation:target,id:row.id}} refresh={load}>Remove</Quick></>}</div>}
              </div></article>;
          })}
        </div>
        {(reply||editing)&&<div className="chat-quote">{editing?"Editing message":`Replying to ${reply?.name}`} <button type="button" onClick={()=>{setReply(null);setEditing(null);setBody("");}}>Cancel</button></div>}
        <form className="chat-composer" onSubmit={send}><label className="sr-only" htmlFor="compose-message">Message</label><input id="compose-message" value={body} onChange={(e)=>setBody(e.target.value)} placeholder="Write a message…" maxLength={4000}/>
          <button type="submit" className="btn btn-blue" disabled={sending||Boolean(preview)||!body.trim()}><Icon name="send" size={16}/><span>{editing?"Save":"Send"}</span></button></form>
      </>}</div>
    </div>{error&&<p className="form-error" role="alert">{error}</p>}
  </Panel>;
}

export function DocumentView({actor,data,refresh,admin=false}:{actor:Viewer;data:ViewData;refresh:()=>void;admin?:boolean}){
  const preview=usePreview();
  const [share,setShare]=useState("");
  return <Panel title={admin?"Private document registry":"Your documents"} note="Files are available only to authorized staff.">
    {!admin&&actor.role!=="guest"&&<Disclosure title="Upload a document"><ActionForm path="documents/upload" fields={[field("file","PDF, Office document or image, up to 3 MB","file")]} submit="Upload privately" refresh={refresh} file/></Disclosure>}
    <Table rows={data.rows??[]} columns={[column("name","Document"),column("owner","Owner"),
      {key:"bytes",title:"Size",render:(row)=>`${Math.max(1,Math.round(Number(row.bytes)/1024))} KB`},dateColumn("created_at","Uploaded"),
      {key:"revoked_at",title:"Access",render:(row)=><Status>{row.revoked_at?"Revoked":row.downloadable?"Download permitted":"Details only"}</Status>}]}
      actions={(row)=>!row.revoked_at&&<>
        {Boolean(row.downloadable)&&!preview&&<><a className="btn btn-outline btn-small" target="_blank" rel="noreferrer" href={`/api/workspace/files/${row.id}?mode=preview`}>Open</a>
          <a className="btn btn-outline btn-small" href={`/api/workspace/files/${row.id}`}>Download</a></>}
        {(admin||row.owner_id===actor.id)&&<><button className="btn btn-outline btn-small" type="button" onClick={()=>setShare(value(row,"id"))}>Permissions</button>
          <Quick path="documents/revoke" data={{id:row.id}} refresh={refresh} variant="danger">Revoke</Quick></>}
      </>}/>
    {share&&<div className="nested-panel"><h3>Internal document access</h3>
      <ActionForm path="documents/share" fields={[employeeField(data.staff??[]),{name:"download",label:"Permission",options:[["0","Details only"],["1","Open and download"]],required:true}]}
        extra={{id:share}} submit="Grant access" refresh={refresh}/>
      <ActionForm path="documents/unshare" fields={[employeeField(data.staff??[])]} extra={{id:share}} submit="Remove access" refresh={refresh}/>
    </div>}
  </Panel>;
}

export function WorkspaceViews({section,actor,data,refresh}:{section:string;actor:Viewer;data:ViewData;refresh:()=>void}){
  const staffHref=useWorkspaceHref();
  const rows=data.rows??[];
  if(section==="dashboard")return <Overview actor={actor} data={data} refresh={refresh}/>;
  if(section==="tasks")return <Tasks actor={actor} data={data} refresh={refresh}/>;
  if(["attendance","shifts","timesheets","leave"].includes(section))return <TimeViews section={section} actor={actor} data={data} refresh={refresh}/>;
  if(section==="calendar")return <Calendar actor={actor} data={data}/>;
  if(section==="messages")return <Messages actor={actor} data={data} refresh={refresh}/>;
  if(section==="documents")return <DocumentView actor={actor} data={data} refresh={refresh}/>;
  if(section==="projects")return <Panel title="Projects">{manages(actor)&&<Disclosure title="Create project"><ActionForm path="projects/add" fields={[field("name","Project name"),field("description","Description","textarea",false)]} submit="Create project" refresh={refresh}/></Disclosure>}
    <Table rows={rows} columns={[column("name","Project"),column("description","Description"),column("tasks","Tasks"),statusColumn]} empty="No projects assigned"/></Panel>;
  if(section==="calls")return <Panel title="Meetings" note={data.provider?"Daily calling is enabled.":"Daily calling is awaiting configuration. You can schedule meetings now."}>
    {actor.role!=="guest"&&<Disclosure title="Schedule a meeting"><ActionForm path="calls/schedule" fields={[
      field("title","Meeting title"),field("startsAt","Start in your device time zone","datetime-local"),field("endsAt","End in your device time zone","datetime-local"),
      {name:"members",label:"Invite teammates",options:options((data.staff??[]).filter((r)=>r.id!==actor.id)),multiple:true},
    ]} submit="Schedule meeting" refresh={refresh}/></Disclosure>}
    <Table rows={rows} columns={[column("title","Meeting"),dateColumn("starts_at","Starts",true,actor.timeZone),dateColumn("ends_at","Ends",true,actor.timeZone),column("organizer","Organizer")]}
      actions={data.provider?(row)=><Quick path="calls/join" data={{id:row.id}} onDone={(r)=>{if(r.url)window.location.assign(r.url);}}>Join meeting</Quick>:undefined} empty="No meetings scheduled"/>
  </Panel>;
  if(section==="directory")return <Panel title="People in your workspace">
    {rows.length?<div className="people-grid">{rows.map((row)=><div className="person-card" key={value(row,"id")}><span className="avatar">{initials(value(row,"name"))}</span><div><strong>{row.name}</strong><small>{row.title||row.department||"Walshken staff"}</small></div></div>)}</div>:<Empty icon="users" title="No teammates in your scope"/>}
  </Panel>;
  if(section==="notifications")return <Panel title="Recent notifications" action={rows.some((row)=>!row.read_at)&&<Quick path="notifications/read" refresh={refresh}>Mark all as read</Quick>}>
    {rows.length?<div className="notification-list">{rows.map((row)=><a href={staffHref(value(row,"href"))} key={value(row,"id")}><span className="icon-tile"><Icon name="bell" size={16}/></span>
      <div><strong>{row.title}</strong><small>{row.body} · {dateText(row.created_at,true,actor.timeZone)}</small></div>{!row.read_at&&<Status>New</Status>}</a>)}</div>:<Empty icon="bell" title="You’re all caught up"/>}
  </Panel>;
  if(section==="salary")return <Panel title="Approved payroll records" note="Your approved payroll records are private to your account and authorized payroll staff.">
    <Table rows={rows} columns={[dateColumn("starts_on","Period start"),dateColumn("ends_on","Period end"),durationColumn("payable_seconds","Payable hours"),
      {key:"gross_cents",title:"Gross",render:(row)=>money(row.gross_cents,value(row,"currency"))},statusColumn]} empty="No approved records"/>
  </Panel>;
  if(section==="profile"){
    const row=data.row??{};
    const tenure=row.hire_date?Math.max(0,Math.floor((Date.now()-Date.parse(String(row.hire_date)))/86400_000)):null;
    const attributes=[
      ["Work email",row.email],["Employee ID",row.employee_no],["Role",roleNames[value(row,"role") as Role]],["Position",row.title],["Department",row.department],
      ["Division",row.division],["Office",row.office],["Country",row.country==="ZZ"?null:countryName(value(row,"country"))],["Employment jurisdiction",row.jurisdiction],
      ["Manager",row.manager],["Employment type",row.employment_type],["Hire date",dateText(row.hire_date)],["Length of service",tenure===null?null:`${tenure} days`],
      ["Contract start",dateText(row.contract_start)],["Account created",dateText(row.created_at)],["Account activated",dateText(row.activated_at)],
      ["Last sign-in",dateText(row.last_login_at,true,actor.timeZone)],["Work time zone",row.time_zone],["Expected weekly hours",row.expected_hours],["Break policy",row.break_policy],
    ];
    return <><Panel title="Employment details"><div className="profile-summary"><span className="avatar avatar-large">{initials(actor.name)}</span><div><h3>{actor.name}</h3><p>{row.title||roleNames[actor.role]}</p></div></div>
      <dl className="profile-grid">{attributes.map(([name,item])=><div key={name}><dt>{name}</dt><dd>{item??"—"}</dd></div>)}</dl></Panel>
      <Panel title="Change password" note="Saving a new password signs you out on every device.">
        <ActionForm path="session/password" fields={[
          {name:"currentPassword",label:"Current password",type:"password",required:true,max:160,autoComplete:"current-password"},
          {name:"newPassword",label:"New password",type:"password",required:true,min:12,max:160},
          {name:"confirmPassword",label:"Confirm new password",type:"password",required:true,min:12,max:160},
        ]} submit="Update password" onDone={() => window.location.assign("/staff")}/>
      </Panel>
      <Panel title="Recent sessions"><Table rows={data.sessions??[]} columns={[dateColumn("created_at","Started",true,actor.timeZone),dateColumn("ended_at","Ended",true,actor.timeZone),column("agent","Device information")]}/></Panel></>;
  }
  return <Empty/>;
}
