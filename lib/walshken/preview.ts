import { divisions, homepage } from "./catalog";
import type { ViewData } from "@/components/walshken/workspace-views";

const day = (offset=0) => new Date(Date.now()+offset*86_400_000).toISOString().slice(0,10);
const at = (offset=0,time="16:00:00") => `${day(offset)}T${time}Z`;

export function designPreviewEnabled() {
  return process.env.NODE_ENV === "development" || !process.env.DATABASE_URL || process.env.WALSHKEN_DESIGN_PREVIEW === "1";
}

export function designPreviewData(section:string, employee:boolean):ViewData {
  const viewer = employee?"preview-maya":"preview-avery";
  const people = [
    {id:"preview-avery",name:"Avery Chen",title:"Operations Director",department:"Operations",employee_no:"WK-001",role:"super_admin",status:"Active"},
    {id:"preview-maya",name:"Maya Kapoor",title:"Operations Coordinator",department:"Operations",employee_no:"WK-012",role:"employee",status:"Active"},
    {id:"preview-noah",name:"Noah Wilson",title:"Team Lead",department:"Operations",employee_no:"WK-008",role:"manager",status:"Active"},
  ];
  const tasks = [
    {id:"sample-task-1",title:"Review service catalog updates",description:"Check the approved copy and confirm the launch checklist.",name:"Maya Kapoor",employee_id:"preview-maya",status:"In Progress",priority:"High",due_date:day(1),actual_minutes:45,estimate_minutes:90},
    {id:"sample-task-2",title:"Prepare weekly operations summary",description:"Compile schedule changes and team updates for review.",name:"Maya Kapoor",employee_id:"preview-maya",status:"Waiting for Review",priority:"Normal",due_date:day(3),actual_minutes:70,estimate_minutes:60},
    {id:"sample-task-3",title:"Confirm onboarding schedule",description:"Review the first-week schedule and the orientation materials.",name:"Avery Chen",employee_id:"preview-avery",status:"Not Started",priority:"Normal",due_date:day(5),actual_minutes:0,estimate_minutes:40},
  ];
  const shifts = [
    {id:"sample-shift-1",title:"Operations shift",starts_at:at(1),ends_at:at(1,"23:30:00"),name:"Maya Kapoor",location:"Calgary office"},
    {id:"sample-shift-2",title:"Team coverage",starts_at:at(3),ends_at:at(3,"23:30:00"),name:"Maya Kapoor",location:"Remote"},
  ];
  const alerts = [
    {id:"sample-alert-1",title:"A shift was published",body:"Your upcoming schedule is ready to review.",href:"/staff/shifts",created_at:at(),read_at:null},
    {id:"sample-alert-2",title:"A task was assigned",body:"Review service catalog updates.",href:"/staff/tasks",created_at:at(-1),read_at:at()},
  ];
  const meetings = [{id:"sample-meeting",title:"Operations weekly check-in",starts_at:at(2),ends_at:at(2,"16:30:00"),organizer:"Noah Wilson"}];
  const leave = [{id:"sample-leave",category:"Vacation",starts_on:day(10),ends_on:day(11),name:"Maya Kapoor",employee_id:"preview-maya",status:"Approved"}];
  const holidays = [{id:"sample-holiday",name:"Office planning day",on_date:day(15),jurisdiction:"CA-AB",type:"Company observance"}];
  const projects = [{id:"sample-project",name:"Canada launch",description:"Service catalog, publication and staff readiness.",tasks:3,status:"Active"}];
  const times = [
    {id:"sample-times-1",name:"Maya Kapoor",work_date:day(-1),gross_seconds:28800,unpaid_seconds:1800,paid_seconds:27000,status:"Submitted"},
    {id:"sample-times-2",name:"Maya Kapoor",work_date:day(-2),gross_seconds:28800,unpaid_seconds:1800,paid_seconds:27000,status:"Approved"},
  ];
  const documents = [
    {id:"sample-document-1",name:"Team onboarding guide.pdf",owner:"Maya Kapoor",owner_id:"preview-maya",bytes:214000,created_at:at(-3),downloadable:1},
    {id:"sample-document-2",name:"Launch checklist.xlsx",owner:"Avery Chen",owner_id:"preview-avery",bytes:83000,created_at:at(-1),downloadable:0},
  ];
  if(section==="dashboard") return {tasks,shifts,alerts,drafts:1};
  if(section==="tasks") return {rows:employee?tasks.filter((task)=>task.employee_id===viewer):tasks,projects,staff:people,previewComments:[
    {id:"sample-comment",name:"Noah Wilson",body:"Please include the final checklist with your review.",created_at:at(-1)},
  ]};
  if(section==="projects") return {rows:projects};
  if(section==="calls") return {rows:meetings,staff:people,provider:false};
  if(section==="calendar") return {tasks,shifts,meetings,leave,holidays};
  if(section==="shifts"||section==="scheduling") return {rows:shifts,staff:people};
  if(section==="timesheets"||section==="approvals") return {rows:times,staff:people,corrections:[
    {id:"sample-correction",name:"Maya Kapoor",note:"Missed clock-out at the end of a scheduled shift.",created_at:at(-1),status:"Pending"},
  ]};
  if(section==="attendance") return {rows:[{id:"sample-clock",starts_at:at(-1),ends_at:at(-1,"23:30:00"),time_zone:"America/Edmonton"}],corrections:[]};
  if(section==="leave") return {rows:leave,staff:people};
  if(section==="documents"||section==="document-security") return {rows:documents,staff:people};
  if(section==="directory") return {rows:people};
  if(section==="notifications") return {rows:alerts};
  if(section==="salary") return {rows:[]};
  if(section==="profile") return {row:{
    ...people.find((p)=>p.id===viewer),email:employee?"maya@example.test":"avery@example.test",country:"CA",office:"Calgary office",division:"Operations",
    jurisdiction:"CA-AB",employment_type:"Full-time",hire_date:"2024-02-05",created_at:at(-7),activated_at:at(-5),
    last_login_at:at(),time_zone:"America/Edmonton",expected_hours:40,break_policy:"unpaid",
  },sessions:[{id:"sample-session",created_at:at(),agent:"Example browser session"}]};
  if(section==="employees"||section==="roles")return {rows:people,staff:people,units:[
    {id:"sample-operations",kind:"Department",name:"Operations"},{id:"sample-office",kind:"Office",name:"Calgary office"},
  ]};
  if(section==="departments") return {rows:[{id:"sample-operations",kind:"Department",name:"Operations"},{id:"sample-office",kind:"Office",name:"Calgary office",country:"CA",region:"Alberta",time_zone:"America/Edmonton"}]};
  if(section==="messages")return {rows:[{id:"sample-room",title:"Operations",kind:"Department",created_by:"preview-avery",archived:0,unread:0}],staff:people,
    previewMembers:people,previewMessages:[
      {id:"sample-message-1",name:"Noah Wilson",sender_id:"preview-noah",created_at:at(-1),body:"The launch checklist is ready for review."},
      {id:"sample-message-2",name:"Maya Kapoor",sender_id:"preview-maya",created_at:at(-1,"16:12:00"),body:"Thanks. I’ll add the catalog notes before our check-in.",reply_to:"sample-message-1",reactions:"👍"},
    ]};
  if(section==="payroll")return {staff:people,rows:[{id:"sample-payroll",name:"Maya Kapoor",starts_on:day(-14),ends_on:day(-1),currency:"CAD",
    payable_seconds:270000,gross_cents:225000,status:"Estimate"}],rates:[{id:"sample-rate",name:"Maya Kapoor",kind:"Hourly",currency:"CAD",amount_cents:3000,effective_on:day(-30)}]};
  if(section==="holidays")return {rows:holidays};
  if(section==="audit")return {rows:[{id:"sample-audit",created_at:at(-1),action:"Shift published",entity:"shift",name:"Noah Wilson",target_id:"sample-shift-1"}]};
  if(section==="reports")return {rows:people.map((person,index)=>({...person,clocked_in:index%2,open_tasks:index+1,overdue_tasks:0,pending_timesheets:index%2}))};
  if(section==="website"||section==="countries")return {catalog:{content:homepage,services:[...divisions],markets:[{code:"CA",enabled:1,contact:""}],availability:[]},
    rows:divisions.map((item,index)=>({...item,sort:index+1,archived:0})),availability:[],inquiries:[]};
  if(section==="integrations")return {secureStorage:true,rows:[]};
  return {rows:[]};
}
