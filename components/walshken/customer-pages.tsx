import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { workspaceDatabase } from "@/lib/walshken/database";
import { customerFor, customerToken } from "@/lib/walshken/customer";
import { Icon } from "./brand";
import { CustomerForm } from "./customer-form";

async function pageSession() {
  const db = workspaceDatabase();
  const token = customerToken((await headers()).get("cookie"));
  return { db, customer: db ? await customerFor(db, token) : null };
}

export async function requireCustomerPage() {
  const { db, customer } = await pageSession();
  if (!db || !customer) redirect("/customer/sign-in");
  return { db, customer };
}

export async function CustomerAccess({ mode, changed = false }: { mode: "sign-in" | "sign-up"; changed?: boolean }) {
  const { db, customer } = await pageSession();
  if (customer) redirect("/customer");
  const signup = mode === "sign-up";
  const title = signup ? "Create your account" : "Customer sign in";
  return <section className="customer-access">
    <div className="public-wrap customer-access-grid">
      <div className="customer-access-copy">
        <h1>{title}</h1>
        <p>Send a request to Walshken and follow its progress in one place.</p>
        <img src="/walshken-market-globe.png" alt="" width="640" height="328"/>
      </div>
      <div className="customer-panel">
        {changed && <p className="form-success" role="status">Password updated. Sign in with your new password.</p>}
        {!db && <p className="form-note">Customer access is temporarily unavailable.</p>}
        <CustomerForm action={mode} label={signup ? "Create account" : "Sign in"} to="/customer" enabled={Boolean(db)}>
          {signup && <label>Full name<input name="name" autoComplete="name" maxLength={100} required/></label>}
          <label>Email address<input name="email" type="email" autoComplete="username" maxLength={254} required/></label>
          <label>Password<input name="password" type="password" autoComplete={signup ? "new-password" : "current-password"} minLength={signup ? 12 : undefined} maxLength={160} required/></label>
          {signup && <>
            <label>Confirm password<input name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={160} required/></label>
            <p className="form-note">Use at least 12 characters.</p>
          </>}
        </CustomerForm>
        <p className="customer-switch">
          {signup ? "Already have an account? " : "New to Walshken? "}
          <Link className="text-link" href={signup ? "/customer/sign-in" : "/customer/sign-up"}>{signup ? "Sign in" : "Create an account"}</Link>
        </p>
        {!signup && <Link className="text-link" href="/contact">Need help signing in?</Link>}
      </div>
    </div>
  </section>;
}

const pages = [
  { key: "requests", href: "/customer", label: "My requests", icon: "list" },
  { key: "new", href: "/customer/requests/new", label: "New request", icon: "plus" },
  { key: "profile", href: "/customer/profile", label: "Profile", icon: "user" },
] as const;

export function CustomerDashboard({ current, title, description, children }: {
  current: (typeof pages)[number]["key"]; title: string; description: string; children: ReactNode;
}) {
  return <div className="customer-area">
    <div className="public-wrap customer-area-grid">
      <aside className="customer-sidebar">
        <nav aria-label="Customer account">
          {pages.map(({ key, href, label, icon }) => <Link key={key} href={href} aria-current={key === current ? "page" : undefined}>
            <Icon name={icon} size={17}/>{label}
          </Link>)}
        </nav>
        <CustomerForm action="sign-out" label="Sign out" to="/customer/sign-in" compact/>
      </aside>
      <div className="customer-main">
        <header className="customer-heading"><h1>{title}</h1><p>{description}</p></header>
        {children}
      </div>
    </div>
  </div>;
}
