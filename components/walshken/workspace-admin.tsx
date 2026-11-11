"use client";
import { useState, type FormEvent } from "react";
import { inquiryStatuses } from "@/lib/walshken/customer-status";
import { countries, countryName, divisions, providers, roleNames, roles, type Role } from "@/lib/walshken/catalog";
import { Icon } from "./brand";
import type { Viewer } from "./workspace";
import { ActionForm, dateText, Disclosure, Empty, hours, money, options, Panel, Quick, Status, Table, value, type Field, type RecordRow } from "./ui";
import { dateColumn, DocumentView, employeeField, TimeViews, type ViewData } from "./workspace-views";

const field=(name:string,label:string,type="text",required=true):Field=>({name,label,type,required});
const column=(key:string,title:string)=>({key,title});
const status={key:"status",title:"Status",render:(row:RecordRow)=><Status>{row.status}</Status>};
const roleChoices=roles.filter((role)=>role!=="super_admin").map((role)=>[role,roleNames[role]] as const);
const countryChoices=countries.map((c)=>[c.code,c.name] as const);
const roleColumn={key:"role",title:"Role",render:(row:RecordRow)=>roleNames[value(row,"role") as Role]};
const companyTypes=["Full-time","Part-time","Fixed-term","Contractor"];
const switches=[["0","Coming Soon"],["1","Available"]] as const;

function Employees({actor,data,refresh,rolesOnly}:{actor:Viewer;data:ViewData;refresh:()=>void;rolesOnly:boolean}){
  const [selected,setSelected]=useState("");
  const row=data.rows?.find((r)=>r.id===selected);
  return <>
    {rolesOnly&&<Panel title="Role hierarchy" note="Roles are enforced by the server and combined with employee and department scope.">
      <div className="role-grid">{roles.map((role,index)=><div className="person-card" key={role}><span className="icon-tile"><Icon name="shield" size={17}/></span><div><strong>{roleNames[role]}</strong><small>{["Organization-wide settings and permissions","Administration within assigned scope","Compensation and payroll within assigned scope","Assigned staff and operational approvals","Own records and granted collaboration","Explicitly granted resources"][index]}</small></div></div>)}</div>
    </Panel>}
    <Panel title={rolesOnly?"Role assignments":"Employee registry"}>
      {!rolesOnly&&actor.role==="super_admin"&&<Disclosure title="Add an employee"><ActionForm path="employees/add" fields={[
        field("name","Full name"),field("email","Work email","email"),field("employeeNo","Employee ID"),field("title","Position","text",false),
        {name:"role",label:"Staff role",options:roleChoices,value:"employee",required:true},
        ...["Department","Division","Office"].map((kind)=>({name:kind.toLowerCase(),label:kind,options:options((data.units??[]).filter((r)=>r.kind===kind))})),
        {name:"manager",label:"Reporting manager",options:options(data.staff??[])},{name:"country",label:"Country",options:countryChoices,required:true},
        {name:"jurisdiction",label:"Employment jurisdiction",placeholder:"Enter the applicable jurisdiction code",required:true},
        {name:"timeZone",label:"IANA time zone",placeholder:"For example, Europe/London",required:true},
        {name:"employmentType",label:"Employment type",options:companyTypes,value:"Full-time",required:true},
        field("hireDate","Original hire date","date",false),field("contractStart","Contract start date","date",false),field("phone","Contact number","tel",false),
        {name:"expectedHours",label:"Expected weekly hours",type:"number",value:40,min:0,max:80},
        {name:"breakPolicy",label:"Break policy",options:[["unpaid","Unpaid"],["paid","Paid"]],value:"unpaid",required:true},
        field("leaveDays","Annual leave days","number",false),
      ]} submit="Create employee and invite" refresh={refresh}/></Disclosure>}
      <Table rows={data.rows??[]} columns={[column("employee_no","ID"),column("name","Name"),roleColumn,column("department","Department"),dateColumn("hire_date","Original hire date"),status]}
        actions={(employee)=>employee.id!==actor.id&&employee.role!=="super_admin"&&<button type="button" className="btn btn-outline btn-small" onClick={()=>setSelected(value(employee,"id"))}>Manage</button>}/>
    </Panel>
    {row&&<Panel title={value(row,"name")} note={value(row,"email")}>
      <div className="row-actions">
        <Quick path="employees/status" data={{id:row.id,status:row.status==="Active"?"Suspended":"Active"}} refresh={refresh}
          variant={row.status==="Active"?"danger":"outline"}>{row.status==="Active"?"Suspend access":"Reactivate"}</Quick>
      </div>
      {actor.role==="super_admin"&&<>
        <Disclosure title="Assign role"><ActionForm path="employees/role" fields={[{name:"role",label:"Role",options:roleChoices,value:row.role,required:true}]}
          extra={{id:row.id}} submit="Save role" refresh={refresh} reset={false}/></Disclosure>
        <Disclosure title="Issue activation or reset code"><ActionForm path="employees/invite" fields={[]} extra={{id:row.id}} submit="Generate code" refresh={refresh}/></Disclosure>
      </>}
    </Panel>}
  </>;
}

function Website({data,refresh}:{data:ViewData;refresh:()=>void}){
  const [selected,setSelected]=useState("");
  const [selectedInquiry,setSelectedInquiry]=useState("");
  const inquiry=data.inquiries?.find((row)=>row.id===selectedInquiry);
  const item=data.rows?.find((r)=>r.id===selected);
  const current=data.catalog?.content;
  const serviceFields:Field[]=[
    {name:"name",label:"Service name",value:item?.name,required:true},{name:"sort",label:"Display order",type:"number",value:item?.sort??8,min:0,max:1000},
    {name:"icon",label:"Icon",options:[...divisions.map((d)=>[d.icon,d.name] as const),["services","General service"]],value:item?.icon??"services",required:true},
    {name:"description",label:"Description",type:"textarea",value:item?.description,required:true},
  ];
  return <>
    <Panel title="Service catalog" note="Publish each destination under Country availability.">
      <Disclosure title="Add a service"><ActionForm path="website/service" fields={[
        field("name","Service name"),{name:"sort",label:"Display order",type:"number",value:8,min:0,max:1000},
        {name:"icon",label:"Icon",options:[...divisions.map((d)=>[d.icon,d.name] as const),["services","General service"]],value:"services",required:true},
        field("description","Description","textarea"),
      ]} submit="Add service" refresh={refresh}/></Disclosure>
      <Table rows={data.rows??[]} columns={[column("sort","Order"),column("name","Service"),column("description","Description"),
        {key:"archived",title:"Catalog",render:(row)=><Status>{row.archived?"Archived":"Active"}</Status>}]}
        actions={(row)=><><button className="btn btn-outline btn-small" type="button" onClick={()=>setSelected(value(row,"id"))}>Edit</button>
          <Quick path="website/archive" data={{id:row.id,archived:row.archived?"0":"1"}} refresh={refresh}>{row.archived?"Restore":"Archive"}</Quick></>}/>
      {item&&<div className="nested-panel"><h3>Edit {item.name}</h3><ActionForm key={selected} path="website/service" fields={serviceFields} extra={{id:item.id}}
        submit="Save service" refresh={refresh} reset={false}/></div>}
    </Panel>
    {current&&<Panel title="Homepage content"><ActionForm path="website/copy" fields={[
      {name:"title",label:"Hero heading",value:current.title,required:true},{name:"description",label:"Hero introduction",type:"textarea",value:current.description,required:true},
      {name:"about",label:"About Walshken",type:"textarea",value:current.about,required:true},
    ]} submit="Save homepage copy" refresh={refresh} reset={false}/></Panel>}
    <Panel title="Public inquiries and launch interest"><Table rows={data.inquiries??[]} columns={[
      dateColumn("created_at","Received"),column("kind","Type"),column("name","Name"),column("email","Email"),column("country","Country"),column("message","Message"),
      {key:"reference",title:"Reference",render:(row)=>row.customer_request?value(row,"id").slice(0,8).toUpperCase():null},
      {key:"status",title:"Status",render:(row)=>row.customer_request?<Status>{row.status}</Status>:null},
    ]} actions={(row)=>row.customer_request?<button className="btn btn-outline btn-small" type="button"
      onClick={()=>setSelectedInquiry(value(row,"id"))}>Update request</button>:null} empty="No inquiries received"/>
      {inquiry&&<div className="nested-panel"><h3>Update request from {inquiry.name}</h3>
        <ActionForm key={selectedInquiry} path="website/inquiry" fields={[
          {name:"status",label:"Status",options:inquiryStatuses.map((status)=>[status,status] as const),value:inquiry.status,required:true},
          {name:"update",label:"Update visible to the customer",type:"textarea",value:inquiry.customer_update,max:2000},
        ]} extra={{id:selectedInquiry}} submit="Save customer update" refresh={refresh} reset={false}/>
      </div>}
    </Panel>
  </>;
}

function Countries({data,refresh}:{data:ViewData;refresh:()=>void}){
  const [market,setMarket]=useState("CA");
  const existing=data.catalog?.markets.find((item)=>item.code===market);
  const [service,setService]=useState("");
  const availability=data.availability?.find((item)=>item.country===market&&item.service_id===service);
  return <>
    <Panel title="Country settings" note="Active countries can display services once a destination is approved.">
      <label className="select-label">Select country<select value={market} onChange={(event)=>setMarket(event.target.value)}>{countryChoices.map(([code,name])=><option value={code} key={code}>{name}</option>)}</select></label>
      <ActionForm key={market} path="website/market" fields={[
        {name:"enabled",label:"Market status",options:switches,value:existing?.enabled??0,required:true},
        {name:"contact",label:"Public contact details",type:"textarea",value:existing?.contact},
      ]} extra={{country:market}} submit="Save market" refresh={refresh} reset={false}/>
    </Panel>
    <Panel title="Service destinations" note="Each service can use a different link and launch status for each country.">
      <label className="select-label">Select service<select value={service} onChange={(event)=>setService(event.target.value)}><option value="">Choose…</option>
        {(data.rows??[]).filter((row)=>!row.archived).map((row)=><option key={row.id} value={value(row,"id")}>{row.name}</option>)}</select></label>
      {service&&<ActionForm key={`${market}-${service}`} path="website/availability" fields={[
        {name:"destination",label:"HTTPS destination or internal path",value:availability?.destination},
        {name:"enabled",label:"Publication status",options:switches,value:availability?.enabled??0,required:true},
      ]} extra={{country:market,service}} submit="Save availability" refresh={refresh} reset={false}/>}
      <Table rows={(data.availability??[]).map((row)=>({...row,id:`${row.country}-${row.service_id}`,service:data.rows?.find((s)=>s.id===row.service_id)?.name??row.service_id}))} columns={[
        {key:"country",title:"Country",render:(row)=>countryName(value(row,"country"))},column("service","Service"),column("destination","Destination"),
        {key:"enabled",title:"Status",render:(row)=><Status>{row.enabled?"Available":"Coming Soon"}</Status>},
      ]} empty="No destinations configured"/>
    </Panel>
  </>;
}

function Integrations({data,refresh}:{data:ViewData;refresh:()=>void}){
  return <>
    {!data.secureStorage&&<p className="workspace-alert">Set the environment encryption key to enable secure credential storage.</p>}
    <div className="integration-grid">{providers.map((provider)=>{
      const current=data.rows?.find((row)=>row.id===provider.id);
      return <Panel key={provider.id} title={provider.name} note={provider.description} action={<Status>{current?.enabled?"Enabled":current?"Saved":"Setup pending"}</Status>}>
        <div className="integration-label"><Icon name="plug" size={17}/>{provider.category}</div>
        {data.secureStorage&&<Disclosure title={current?"Update credentials":"Add credentials"}>
          <ActionForm path="integrations/save" fields={[
            ...provider.fields.map(([name,label])=>field(name,label,/key|token|sid/i.test(name)?"password":"text")),
            {name:"enabled",label:"Status",options:[["0","Save disabled"],["1","Enable"]],value:current?.enabled??0,required:true},
          ]} extra={{provider:provider.id}} submit="Save credentials" refresh={refresh}/>
        </Disclosure>}
        {Boolean(current?.enabled)&&<Quick path="integrations/disable" data={{provider:provider.id}} refresh={refresh}>Disable</Quick>}
        {provider.id!=="daily"&&<p className="form-note">Credential configuration is available. This provider’s live workflows are pending.</p>}
      </Panel>;
    })}</div>
  </>;
}

function Payroll({data,refresh}:{data:ViewData;refresh:()=>void}){
  return <>
    <Panel title="Payroll estimates" note="Base hourly estimates exclude overtime, holiday pay, tax and deductions. Use approved hours and complete a payroll review before payment.">
      <Disclosure title="Create gross estimate"><ActionForm path="payroll/estimate" fields={[
        employeeField(data.staff??[]),field("startsOn","Period start","date"),field("endsOn","Period end","date"),
      ]} submit="Create base estimate" refresh={refresh}/></Disclosure>
      <Table rows={data.rows??[]} columns={[column("name","Employee"),dateColumn("starts_on","Start"),dateColumn("ends_on","End"),
        {key:"payable_seconds",title:"Payable",render:(row)=>hours(row.payable_seconds)},
        {key:"gross_cents",title:"Estimated gross",render:(row)=>money(row.gross_cents,value(row,"currency"))},status]} empty="No payroll estimates"/>
    </Panel>
    <Panel title="Compensation history">
      <Disclosure title="Record an effective-dated rate"><ActionForm path="payroll/rate" fields={[
        employeeField(data.staff??[]),{name:"kind",label:"Type",options:["Hourly","Salaried"],value:"Hourly",required:true},
        field("amount","Amount in cents","number"),{name:"currency",label:"Currency code",value:"CAD",required:true},field("effective","Effective date","date"),
      ]} submit="Save new rate" refresh={refresh}/></Disclosure>
      <Table rows={data.rates??[]} columns={[column("name","Employee"),column("kind","Type"),dateColumn("effective_on","Effective"),
        {key:"amount_cents",title:"Amount",render:(row)=>money(row.amount_cents,value(row,"currency"))}]}/>
    </Panel>
  </>;
}

export function AdminViews({section,actor,data,refresh,setQuery}:{section:string;actor:Viewer;data:ViewData;refresh:()=>void;setQuery:(query:string)=>void}){
  const rows=data.rows??[];
  if(section==="employees"||section==="roles")return <Employees actor={actor} data={data} refresh={refresh} rolesOnly={section==="roles"}/>;
  if(section==="scheduling"||section==="approvals")return <TimeViews section={section} actor={actor} data={data} refresh={refresh}/>;
  if(section==="document-security")return <DocumentView actor={actor} data={data} refresh={refresh} admin/>;
  if(section==="website")return <Website data={data} refresh={refresh}/>;
  if(section==="countries")return <Countries data={data} refresh={refresh}/>;
  if(section==="integrations")return <Integrations data={data} refresh={refresh}/>;
  if(section==="payroll")return <Payroll data={data} refresh={refresh}/>;
  if(section==="departments")return <Panel title="Organization units">
    <Disclosure title="Add a department, division or office"><ActionForm path="organization/add" fields={[
      {name:"kind",label:"Unit type",options:["Department","Division","Office"],required:true},field("name","Name"),
      {name:"country",label:"Office country",options:countryChoices},{name:"timeZone",label:"Office time zone",placeholder:"For example, Europe/London"},field("region","Province or region","text",false),
    ]} submit="Create unit" refresh={refresh}/></Disclosure>
    <Table rows={rows} columns={[column("name","Name"),column("kind","Type"),column("country","Country"),column("region","Region"),column("time_zone","Time zone")]}/>
  </Panel>;
  if(section==="holidays")return <Panel title="Holiday calendar" note="Calendar entries are references for scheduling. Statutory pay is determined by validated jurisdiction rules.">
    <Disclosure title="Add a holiday"><ActionForm path="holidays/add" fields={[
      field("name","Holiday name"),field("onDate","Holiday date","date"),{name:"jurisdiction",label:"Jurisdiction code",required:true},
      {name:"type",label:"Type",options:["Company observance","Statutory calendar reference"],required:true},
    ]} submit="Add calendar entry" refresh={refresh}/></Disclosure>
    <Table rows={rows} columns={[column("name","Name"),dateColumn("on_date","Date"),column("jurisdiction","Jurisdiction"),column("type","Type")]}/>
  </Panel>;
  if(section==="audit"){
    function filter(event:FormEvent<HTMLFormElement>){event.preventDefault();setQuery(new URLSearchParams([...new FormData(event.currentTarget)].map(([key,val])=>[key,String(val)])).toString());}
    return <Panel title="Activity log">
      <form className="table-filter" onSubmit={filter}><label>Search events<input name="q" placeholder="Action, resource or person"/></label>
        <label>From<input type="date" name="from"/></label><label>Through<input type="date" name="to"/></label><button className="btn btn-blue btn-small">Apply filters</button></form>
      <Table rows={rows} columns={[dateColumn("created_at","Time",true,actor.timeZone),column("name","Actor"),column("action","Action"),column("entity","Resource"),column("target_id","Record")]}/>
    </Panel>;
  }
  if(section==="reports")return <Panel title="Team operations">
    <Table rows={rows} columns={[column("name","Employee"),status,column("clocked_in","Clocked in"),column("open_tasks","Open tasks"),column("overdue_tasks","Overdue"),
      column("pending_timesheets","Pending timesheets")]}/>
  </Panel>;
  return <Empty/>;
}
