import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "./brand";
import { PublicNav } from "./public-nav";

export function PublicShell({ children }: { children: ReactNode }) {
  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="corporate-header"><div className="public-wrap topbar"><Brand/><PublicNav/></div></header>
    <main id="main" tabIndex={-1}>{children}</main>
    <footer className="corporate-footer">
      <div className="public-wrap footer-compact">
        <Brand/>
        <nav aria-label="Footer">
          <Link href="/services">Services</Link>
          <Link href="/countries">Countries</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/staff" prefetch={false}>Staff login</Link>
        </nav>
        <small>© {new Date().getUTCFullYear()} Walshken</small>
      </div>
    </footer>
  </>;
}
