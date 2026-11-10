import {
  all, audit, canManage, canSuper, colleague, datetime, decryptSettings, fail, id, integer, json, notify, now, one,
  pick, requireStaff, run, stmt, str, throttle, type Actor, type Db, type Row,
} from "./server";

function memberIds(value:unknown, max=30) {
  if(!Array.isArray(value)||value.length>max) return fail(400,"Choose permitted participants.");
  return [...new Set(value.map((item)=>str(item,"participant",80)))];
}
async function channel(db:Db, actor:Actor, target:string) {
  const row=await one<{id:string;created_by:string;kind:string;title:string}>(db,`SELECT c.id,c.created_by,c.kind,c.title FROM conversations c
    JOIN conversation_members m ON m.conversation_id=c.id WHERE c.id=? AND c.org_id=? AND m.employee_id=?`,target,actor.org_id,actor.id);
  if(!row) return fail(404,"Conversation not found.");
  return row;
}
export async function messagesFor(db:Db,actor:Actor,target:string,query:string){
  await channel(db,actor,target);
  const q=str(query,"search",100,false);
  const [rows,members]=await Promise.all([
    all(db,`SELECT m.id,CASE WHEN m.deleted_at IS NULL THEN m.body ELSE '' END AS body,m.sender_id,m.reply_to,m.edited_at,m.deleted_at,m.pinned,
      m.created_at,e.name,(SELECT string_agg(r.emoji,' ') FROM message_reactions r WHERE r.message_id=m.id) AS reactions
      FROM messages m JOIN employees e ON e.id=m.sender_id WHERE m.conversation_id=?
      AND (?='' OR (m.deleted_at IS NULL AND strpos(lower(m.body),lower(?))>0)) ORDER BY m.created_at DESC LIMIT 100`,target,q,q),
    all(db,`SELECT e.id,e.name,m.last_read_at FROM conversation_members m JOIN employees e ON e.id=m.employee_id WHERE m.conversation_id=?`,target),
  ]);
  return json({rows:rows.reverse(),members});
}
export async function messageAction(db:Db,actor:Actor,action:string,data:Record<string,unknown>){
  requireStaff(actor);
  if(action==="create"){
    const kind=pick(data.kind,["Direct","Department","Project","Company","Private"],"conversation type");
    const participants=memberIds(data.members).filter((member)=>member!==actor.id);
    if(kind==="Direct"&&participants.length!==1) return fail(400,"Choose one teammate for a direct message.");
    if(kind!=="Direct"&&!canManage(actor)) return fail(403,"Group creation requires a manager.");
    if(!participants.length) return fail(400,"Choose at least one teammate.");
    const people=await Promise.all(participants.map((employee)=>colleague(db,actor,employee)));
    if(kind==="Direct"){
      const exists=await one<{id:string}>(db,`SELECT c.id FROM conversations c JOIN conversation_members a ON a.conversation_id=c.id AND a.employee_id=?
        JOIN conversation_members b ON b.conversation_id=c.id AND b.employee_id=? WHERE c.org_id=? AND c.kind='Direct'`,actor.id,participants[0],actor.org_id);
      if(exists) return json({ok:true,id:exists.id,message:"Conversation opened."});
    }
    const target=id(),title=kind==="Direct"?people[0].name:str(data.title,"channel name",100);
    await db.batch([
      stmt(db,"INSERT INTO conversations (id,org_id,title,kind,created_by) VALUES (?,?,?,?,?)",target,actor.org_id,title,kind,actor.id),
      ...[actor.id,...participants].map((employee)=>stmt(db,"INSERT INTO conversation_members (id,conversation_id,employee_id) VALUES (?,?,?)",id(),target,employee)),
      audit(db,actor,"Conversation created","conversation",target),
    ]);
    return json({ok:true,id:target,message:"Conversation created."},201);
  }
  const target=str(data.conversation,"conversation",80);
  const conversation=await channel(db,actor,target);
  if(action==="send"){
    await throttle(db,`messages:${actor.id}`,40,60_000);
    const reply=str(data.reply,"reply",80,false);
    if(reply&&!await one(db,"SELECT id FROM messages WHERE id=? AND conversation_id=? AND deleted_at IS NULL",reply,target)) return fail(400,"The message you are replying to is unavailable.");
    const message=id(),body=str(data.body,"message",4000);
    await db.batch([
      stmt(db,"INSERT INTO messages (id,conversation_id,sender_id,body,reply_to) VALUES (?,?,?,?,?)",message,target,actor.id,body,reply||null),
      stmt(db,"UPDATE conversation_members SET last_read_at=? WHERE conversation_id=? AND employee_id=?",now(),target,actor.id),
    ]);
    return json({ok:true,id:message},201);
  }
  if(action==="read"||action==="archive"){
    if(action==="read") await run(db,"UPDATE conversation_members SET last_read_at=? WHERE conversation_id=? AND employee_id=?",now(),target,actor.id);
    else await run(db,"UPDATE conversation_members SET archived=? WHERE conversation_id=? AND employee_id=?",data.archived==="1"?1:0,target,actor.id);
    return json({ok:true});
  }
  if(action==="member"){
    if(conversation.kind==="Direct"||(!canSuper(actor)&&conversation.created_by!==actor.id)) return fail(403,"You cannot manage this conversation.");
    const employee=str(data.employee,"employee",80);
    if(employee===conversation.created_by) return fail(400,"The conversation owner must remain a member.");
    if(data.operation==="remove"){
      await db.batch([stmt(db,"DELETE FROM conversation_members WHERE conversation_id=? AND employee_id=?",target,employee),audit(db,actor,"Channel member removed","conversation",target)]);
    }else{
      await colleague(db,actor,employee);
      await db.batch([stmt(db,"INSERT INTO conversation_members (id,conversation_id,employee_id) VALUES (?,?,?) ON CONFLICT DO NOTHING",id(),target,employee),audit(db,actor,"Channel member added","conversation",target)]);
    }
    return json({ok:true,message:"Channel membership updated."});
  }
  const message=str(data.id,"message",80);
  const row=await one<{sender_id:string}>(db,"SELECT sender_id FROM messages WHERE id=? AND conversation_id=? AND deleted_at IS NULL",message,target);
  if(!row) return fail(404,"Message not found.");
  if(action==="reaction"){
    const emoji=pick(data.emoji,["👍","❤️","🎉","✅","👀"],"reaction");
    const present=await one(db,"SELECT id FROM message_reactions WHERE message_id=? AND employee_id=? AND emoji=?",message,actor.id,emoji);
    if(present) await run(db,"DELETE FROM message_reactions WHERE message_id=? AND employee_id=? AND emoji=?",message,actor.id,emoji);
    else await run(db,"INSERT INTO message_reactions (id,message_id,employee_id,emoji) VALUES (?,?,?,?) ON CONFLICT DO NOTHING",id(),message,actor.id,emoji);
    return json({ok:true});
  }
  if(action==="pin"){
    if(conversation.created_by!==actor.id&&!canSuper(actor)) return fail(403,"Only the conversation owner can pin messages.");
    await run(db,"UPDATE messages SET pinned=? WHERE id=?",data.pinned==="1"?1:0,message);
    return json({ok:true});
  }
  if(row.sender_id!==actor.id) return fail(403,"Only the sender can edit or remove this message.");
  if(action==="edit") await run(db,"UPDATE messages SET body=?,edited_at=? WHERE id=?",str(data.body,"message",4000),now(),message);
  else if(action==="delete") await run(db,"UPDATE messages SET body='',deleted_at=? WHERE id=?",now(),message);
  else return fail(404,"Message action unavailable.");
  return json({ok:true});
}

const allowedFiles:Record<string,string>={pdf:"application/pdf",png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",
  webp:"image/webp",docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"};
function fileMatches(ext:string,bytes:Buffer){
  if(ext==="pdf") return bytes.subarray(0,5).toString()==="%PDF-";
  if(ext==="png") return bytes.subarray(0,8).equals(Buffer.from("89504e470d0a1a0a","hex"));
  if(ext==="jpg"||ext==="jpeg") return bytes.subarray(0,3).equals(Buffer.from("ffd8ff","hex"));
  if(ext==="webp") return bytes.subarray(0,4).toString()==="RIFF"&&bytes.subarray(8,12).toString()==="WEBP";
  return bytes.subarray(0,4).equals(Buffer.from("504b0304","hex"));
}
export async function uploadDocument(db:Db,actor:Actor,request:Request){
  requireStaff(actor);
  const max=3*1024*1024;
  if(Number(request.headers.get("content-length")||0)>max+10000) return fail(413,"Choose a file under 3 MB.");
  await throttle(db,`upload:${actor.id}`,12,60_000);
  const data=await request.formData(),file=data.get("file");
  if(!(file instanceof File)||file.size<1||file.size>max) return fail(400,"Choose a supported file under 3 MB.");
  const name=file.name.replace(/[\/\\\u0000-\u001f]/g,"_").slice(0,130);
  const extension=name.split(".").pop()?.toLowerCase()??"";
  const mime=allowedFiles[extension],bytes=Buffer.from(await file.arrayBuffer());
  if(!mime||!fileMatches(extension,bytes)) return fail(400,"Choose a valid PDF, Word, Excel, PNG, JPG or WebP file.");
  const target=id();
  await db.batch([
    stmt(db,"INSERT INTO file_objects (id,content) VALUES (?,?)",target,bytes),
    stmt(db,"INSERT INTO documents (id,org_id,owner_id,name,mime,bytes,storage_key) VALUES (?,?,?,?,?,?,?)",target,actor.org_id,actor.id,name,mime,file.size,target),
    audit(db,actor,"Document uploaded","document",target),
  ]);
  return json({ok:true,message:"Private document uploaded."},201);
}
export async function downloadDocument(db:Db,actor:Actor,target:string,preview=false){
  const row=await one<{name:string;mime:string;content:Uint8Array}>(db,`SELECT d.name,d.mime,f.content FROM documents d JOIN file_objects f ON f.id=d.storage_key
    LEFT JOIN document_grants g ON g.document_id=d.id AND g.employee_id=?
    WHERE d.id=? AND d.org_id=? AND d.revoked_at IS NULL AND (d.owner_id=? OR g.allow_download=1)`,actor.id,target,actor.org_id,actor.id);
  if(!row) return fail(404,"This file is unavailable or download access has not been granted.");
  const inline=preview&&(["application/pdf","image/jpeg","image/png","image/webp"].includes(row.mime));
  await audit(db,actor,inline?"Document preview opened":"Document downloaded","document",target).run();
  return new Response(Uint8Array.from(row.content),{headers:{
    "Content-Type":inline?row.mime:"application/octet-stream",
    "Content-Disposition":`${inline?"inline":"attachment"}; filename*=UTF-8''${encodeURIComponent(row.name).replace(/'/g,"%27")}`,
    "Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"sandbox; default-src 'none'",
  }});
}
export async function documentAction(db:Db,actor:Actor,action:string,data:Record<string,unknown>){
  requireStaff(actor);
  const target=str(data.id,"document",80);
  const entry=await one<{owner_id:string;revoked_at:string|null}>(db,"SELECT owner_id,revoked_at FROM documents WHERE id=? AND org_id=?",target,actor.org_id);
  if(!entry) return fail(404,"Document unavailable.");
  if(entry.owner_id!==actor.id&&!canSuper(actor)) return fail(403,"Only the owner or Super Admin can manage access.");
  if(action==="revoke"){
    await db.batch([stmt(db,"UPDATE documents SET revoked_at=? WHERE id=? AND revoked_at IS NULL",now(),target),audit(db,actor,"Document access revoked","document",target)]);
    return json({ok:true,message:"Document access revoked."});
  }
  if(entry.revoked_at) return fail(409,"This document is revoked.");
  if(action==="share"){
    const employee=await colleague(db,actor,str(data.employee,"teammate",80));
    await db.batch([
      stmt(db,`INSERT INTO document_grants (id,document_id,employee_id,allow_download) VALUES (?,?,?,?)
        ON CONFLICT(document_id,employee_id) DO UPDATE SET allow_download=excluded.allow_download`,id(),target,employee.id,data.download==="1"?1:0),
      audit(db,actor,"Document shared internally","document",target),
      notify(db,employee.id,"Document shared","A colleague shared a file with you.","/staff/documents"),
    ]);
    return json({ok:true,message:"Document shared with the selected teammate."});
  }
  if(action==="unshare"){
    const employee=str(data.employee,"teammate",80);
    await db.batch([stmt(db,"DELETE FROM document_grants WHERE document_id=? AND employee_id=?",target,employee),audit(db,actor,"Document grant removed","document",target)]);
    return json({ok:true,message:"Sharing permission removed."});
  }
  return fail(404,"Document action unavailable.");
}

async function dailyFetch(path:string,apiKey:string,body?:Record<string,unknown>){
  const response=await fetch(`https://api.daily.co/v1/${path}`,{method:body?"POST":"GET",
    headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined,
    cache:"no-store",signal:AbortSignal.timeout(8000)});
  if(!response.ok) return null;
  return await response.json() as {url?:string;token?:string};
}
export async function meetingAction(db:Db,actor:Actor,action:string,data:Record<string,unknown>){
  if(action==="schedule"){
    requireStaff(actor);
    const participants=memberIds(data.members??[]).filter((member)=>member!==actor.id);
    await Promise.all(participants.map((employee)=>colleague(db,actor,employee)));
    const start=datetime(data.startsAt,"meeting start"),end=datetime(data.endsAt,"meeting end");
    if(end<=start||Date.parse(end)-Date.parse(start)>12*3_600_000) return fail(400,"Meeting end must be within 12 hours after its start.");
    const target=id(),title=str(data.title,"meeting title",120);
    await db.batch([
      stmt(db,"INSERT INTO meetings (id,org_id,organizer_id,title,starts_at,ends_at) VALUES (?,?,?,?,?,?)",target,actor.org_id,actor.id,title,start,end),
      ...[actor.id,...participants].map((employee)=>stmt(db,"INSERT INTO meeting_members (id,meeting_id,employee_id) VALUES (?,?,?)",id(),target,employee)),
      ...participants.map((employee)=>notify(db,employee,"Meeting scheduled",title,"/staff/calls")),
      audit(db,actor,"Meeting scheduled","meeting",target),
    ]);
    return json({ok:true,message:"Meeting scheduled."},201);
  }
  if(action!=="join") return fail(404,"Meeting action unavailable.");
  const target=str(data.id,"meeting",80);
  const meeting=await one<{id:string;starts_at:string;ends_at:string;organizer_id:string}>(db,`SELECT m.id,m.starts_at,m.ends_at,m.organizer_id
    FROM meetings m JOIN meeting_members p ON p.meeting_id=m.id WHERE m.id=? AND m.org_id=? AND p.employee_id=?`,target,actor.org_id,actor.id);
  if(!meeting) return fail(404,"Meeting is unavailable.");
  if(Date.now()<Date.parse(meeting.starts_at)-15*60_000||Date.now()>Date.parse(meeting.ends_at)) return fail(409,"You can join from 15 minutes before the meeting starts until it ends.");
  const integration=await one<{configuration:string}>(db,"SELECT configuration FROM integrations WHERE id='daily' AND enabled=1");
  if(!integration) return fail(409,"A Super Admin must enable Daily calling in Integrations.");
  const settings=await decryptSettings("daily",integration.configuration);
  const room=`wk-${meeting.id}`,exp=Math.floor(Date.parse(meeting.ends_at)/1000);
  const existing=await dailyFetch(`rooms/${room}`,settings.apiKey);
  const remote=existing??await dailyFetch("rooms",settings.apiKey,{name:room,privacy:"private",properties:{exp,eject_at_room_exp:true,enable_screenshare:true}});
  const expected=`https://${settings.domain.toLowerCase()}.daily.co/${room}`;
  if(remote?.url!==expected) return fail(502,"Daily could not provision a room for this account.");
  const access=await dailyFetch("meeting-tokens",settings.apiKey,{properties:{room_name:room,user_name:actor.name,user_id:actor.id,exp,eject_at_token_exp:true,is_owner:meeting.organizer_id===actor.id}});
  if(!access?.token) return fail(502,"Daily could not grant meeting access.");
  await audit(db,actor,"Meeting join authorized","meeting",target).run();
  return json({ok:true,url:`${expected}?t=${encodeURIComponent(access.token)}`});
}

export async function teamOptions(db:Db,actor:Actor){
  if(actor.role==="guest") return [];
  return all<Row>(db,`SELECT e.id,e.name,e.title,e.employee_no,u.name AS department FROM employees e LEFT JOIN units u ON u.id=e.department_id
    WHERE e.org_id=? AND e.status='Active' AND e.role<>'guest'
    AND (?=1 OR e.id=? OR (e.department_id IS NOT NULL AND e.department_id=?) OR e.manager_id=? OR e.id=?) ORDER BY e.name LIMIT 200`,
    actor.org_id,canSuper(actor)?1:0,actor.id,actor.department_id,actor.id,actor.manager_id);
}
