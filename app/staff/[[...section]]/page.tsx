import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { SignIn } from "@/components/walshken/sign-in";
import { Workspace } from "@/components/walshken/workspace";
import { setupAllowed } from "@/lib/walshken/auth";
import { workspaceDatabase } from "@/lib/walshken/database";
import { actorFor, cookieValue, one } from "@/lib/walshken/server";
import { adminNav, staffNav } from "@/lib/walshken/catalog";
import { designPreviewEnabled } from "@/lib/walshken/preview";
import { canOpen } from "@/lib/walshken/views";

export const dynamic = "force-dynamic";
export const metadata = { title: "Staff workspace" };

export default async function Staff({ params }: { params: Promise<{ section?: string[] }> }) {
  const {section:parts}=await params;
  if(parts&&parts.length>1) notFound();
  const section=parts?.[0]??"dashboard";
  const valid = [...staffNav.flatMap((group)=>group.items.map((item)=>item[0])),...adminNav.map((item)=>item[0])];
  if(!valid.includes(section as typeof valid[number])) notFound();
  const db=workspaceDatabase();
  if(!db) return <SignIn ready={false} initial={false} preview={designPreviewEnabled()}/>;
  let actor;
  let initial=false;
  try {
    actor=await actorFor(db,cookieValue((await headers()).get("cookie")));
    if(!actor&&setupAllowed()) initial=!await one(db,"SELECT id FROM employees LIMIT 1");
  } catch (error) {
    console.error("Walshken staff connection failed",error instanceof Error?error.name:"UnknownError");
    return <SignIn ready={false} initial={false} preview={designPreviewEnabled()}/>;
  }
  if(!actor) return <SignIn ready initial={initial}/>;
  if(!canOpen(actor,section)) redirect("/staff");
  const allowed = valid.filter((item)=>canOpen(actor,item));
  return <Workspace section={section} allowed={allowed} actor={{
    id:actor.id,name:actor.name,role:actor.role,timeZone:actor.time_zone,employeeNo:actor.employee_no,
  }}/>;
}
