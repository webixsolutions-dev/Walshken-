import { notFound, redirect } from "next/navigation";
import { Workspace } from "@/components/walshken/workspace";
import { adminNav, staffNav } from "@/lib/walshken/catalog";
import { designPreviewData, designPreviewEnabled } from "@/lib/walshken/preview";

export const dynamic = "force-dynamic";
export const metadata = { title:"Staff design preview", robots:{index:false,follow:false} };

export default async function PreviewPage({params,searchParams}:{
  params:Promise<{section?:string[]}>;
  searchParams:Promise<{role?:string}>;
}){
  if(!designPreviewEnabled())notFound();
  const {section:parts}=await params;
  if(parts&&parts.length>1)notFound();
  const section=parts?.[0]??"dashboard";
  const employee=(await searchParams).role==="employee";
  const valid=staffNav.flatMap((group)=>group.items.map((item)=>item[0]));
  const allowed:string[]=employee?[...valid]:[...valid,...adminNav.map(([key])=>key)];
  if(!allowed.includes(section)) redirect(employee?"/preview?role=employee":"/preview");
  const actor=employee
    ? {id:"preview-maya",name:"Maya Kapoor",role:"employee" as const,timeZone:"America/Edmonton",employeeNo:"WK-012"}
    : {id:"preview-avery",name:"Avery Chen",role:"super_admin" as const,timeZone:"America/Edmonton",employeeNo:"WK-001"};
  return <Workspace section={section} allowed={allowed} actor={actor} previewData={designPreviewData(section,employee)}/>;
}
