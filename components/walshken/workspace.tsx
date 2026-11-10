"use client";

import { useCallback, useEffect, useState } from "react";
import { adminNav, roleNames, staffNav, type Role } from "@/lib/walshken/catalog";
import { Brand, Icon } from "./brand";
import { api, Empty, initials, PreviewContext } from "./ui";
import { WorkspaceViews, type ViewData } from "./workspace-views";
import { AdminViews } from "./workspace-admin";

export type Viewer = {id:string;name:string;role:Role;timeZone:string;employeeNo:string};
const links: readonly (readonly [string,string,string])[] = [...staffNav.flatMap<readonly [string,string,string]>((group)=>group.items),...adminNav];
const notes:Record<string,string>={
  dashboard:"Here’s what’s happening in your workspace.",
  messages:"Keep conversations with your authorized teammates in one place.",
  calls:"Schedule private meetings and join authorized rooms.",
  tasks:"Track priorities, progress and review.",
  projects:"See the workstreams you’re part of.",
  calendar:"See shifts, deadlines, meetings and approved leave together.",
  attendance:"Record your working time and breaks.",
  shifts:"View your published work schedule.",
  timesheets:"Review your hours and submit them for approval.",
  salary:"View your own approved payroll records.",
  leave:"Request time off and follow decisions.",
  documents:"Upload and share files with permitted colleagues.",
  directory:"Find teammates in your workspace scope.",
  notifications:"Keep up with assignments, decisions and schedule updates.",
  profile:"Review your employment record and recent sessions.",
  employees:"Manage staff access and onboarding.",
  departments:"Set up divisions, departments and offices.",
  roles:"Control staff access using scoped role assignments.",
  scheduling:"Publish shifts for employees in your scope.",
  approvals:"Review submitted time and attendance corrections.",
  payroll:"Maintain effective-dated rates and prepare base gross estimates.",
  holidays:"Maintain calendar references and company observances.",
  reports:"Review team activity across work, attendance and approvals.",
  "document-security":"Review private documents and revoke access.",
  audit:"Search append-only administrative and access events.",
  website:"Manage the public catalog, homepage and incoming inquiries.",
  countries:"Control markets and publish approved service destinations.",
  integrations:"Add provider credentials as services are ready to connect.",
};
const href=(section:string)=>section==="dashboard"?"/staff":`/staff/${section}`;

export function Workspace({section,allowed,actor,previewData}:{section:string;allowed:readonly string[];actor:Viewer;previewData?:ViewData}){
  const [drawer,setDrawer]=useState(false),[data,setData]=useState<ViewData|null>(previewData??null),[error,setError]=useState(""),[query,setQuery]=useState("");
  const [version,setVersion]=useState(0);
  const refresh=useCallback(()=>setVersion((current)=>current+1),[]);
  const preview=previewData?actor.role==="employee"?"employee":"admin":null;
  const staffHref=(key:string)=>preview?href(key).replace(/^\/staff/,"/preview")+(preview==="employee"?"?role=employee":""):href(key);
  const nav=links.find((item)=>item[0]===section);
  useEffect(()=>{
    if(previewData) return;
    let ignore=false;
    api(`view/${section}${query?`?${query}`:""}`).then((result)=>{if(!ignore){setData(result);setError("");}},
      (reason)=>{if(!ignore)setError(reason instanceof Error?reason.message:"Unable to load workspace.");});
    return ()=>{ignore=true;};
  },[section,version,query,previewData]);
  async function logout(){
    try{await api("session/logout",{});window.location.assign("/staff");}
    catch(e){setError(e instanceof Error?e.message:"Sign out could not be completed.");}
  }
  function menu(items:readonly (readonly [string,string,string])[]){
    return items.filter(([key])=>allowed.includes(key)).map(([key,name,icon])=><a key={key} href={staffHref(key)} aria-current={section===key?"page":undefined}
      className={section===key?"active":""}><Icon name={icon} size={17}/><span>{name}</span></a>);
  }
  return <PreviewContext.Provider value={preview}><div className="workspace">
    <a className="skip-link" href="#staff-main">Skip to workspace content</a>
    {drawer&&<button className="drawer-scrim" type="button" onClick={()=>setDrawer(false)} aria-label="Close workspace menu"/>}
    <aside className={drawer?"staff-sidebar open":"staff-sidebar"}>
      <div className="staff-brand"><Brand href={staffHref("dashboard")} compact/><button type="button" className="icon-button drawer-close" aria-label="Close menu" onClick={()=>setDrawer(false)}><Icon name="close"/></button></div>
      <div className="sidebar-context"><span className="context-icon"><Icon name="building" size={16}/></span><div><strong>Walshken workspace</strong><small>{preview?"Frontend preview":"Staff portal"}</small></div></div>
      <nav className="staff-nav" aria-label="Workspace navigation">
        {staffNav.map((group)=><div key={group.title}><div className="nav-label">{group.title}</div>{menu(group.items)}</div>)}
        {adminNav.some(([key])=>allowed.includes(key))&&<div><div className="nav-label">Administration</div>{menu(adminNav)}</div>}
      </nav>
      <div className="staff-account"><span className="avatar">{initials(actor.name)}</span><div><strong>{actor.name}</strong><small>{roleNames[actor.role]}</small></div>
        {preview?<a href="/" className="icon-button" aria-label="Exit preview"><Icon name="left" size={17}/></a>:<button className="icon-button" aria-label="Sign out" type="button" onClick={logout}><Icon name="logout" size={17}/></button>}</div>
    </aside>
    <div className="workspace-body">
      <header className="workspace-bar"><div><button type="button" className="icon-button staff-menu" aria-label="Open workspace menu" aria-expanded={drawer} onClick={()=>setDrawer(true)}><Icon name="menu"/></button>
        <a href={staffHref("dashboard")}>Workspace</a><Icon name="next" size={14}/><strong>{nav?.[1]??"Overview"}</strong></div>
        <div><a className="corporate-return" href="/">Corporate site <Icon name="external" size={14}/></a>
          <a href={staffHref("notifications")} className="icon-button" aria-label="Notifications"><Icon name="bell" size={18}/></a>
          <a href={staffHref("profile")} className="avatar avatar-small" aria-label="My profile">{initials(actor.name)}</a></div></header>
      <main className="workspace-main" id="staff-main">
        {preview&&<div className="preview-banner"><div><strong>Design preview</strong><span>Sample data and read-only workflows</span></div>
          <nav aria-label="Preview role"><a className={preview==="admin"?"selected":""} href="/preview">Admin view</a><a className={preview==="employee"?"selected":""} href="/preview?role=employee">Employee view</a></nav></div>}
        <div className="workspace-title"><div><span className="section-kicker">{adminNav.some(([key])=>key===section)?"ADMINISTRATION":"WALSHKEN WORKSPACE"}</span>
          <h1>{section==="dashboard"?`Welcome, ${actor.name.split(" ")[0]}`:nav?.[1]}</h1><p>{notes[section]}</p></div>
          {section==="dashboard"&&<span className="workspace-date"><Icon name="calendar" size={15}/>{new Intl.DateTimeFormat("en-CA",{dateStyle:"full",timeZone:actor.timeZone}).format(new Date())}</span>}</div>
        {error&&<p className="workspace-alert" role="alert">{error}</p>}
        {!data&&!error?<Empty title="Loading workspace…" body="Retrieving your latest records." icon="clock"/>:data&&(
          adminNav.some(([key])=>key===section)?<AdminViews section={section} actor={actor} data={data} refresh={refresh} setQuery={setQuery}/>
            :<WorkspaceViews section={section} actor={actor} data={data} refresh={refresh}/>)}
      </main>
    </div>
  </div></PreviewContext.Provider>;
}
