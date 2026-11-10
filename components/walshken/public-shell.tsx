import Link from "next/link";
import type { ReactNode } from "react";
import { designPreviewEnabled } from "@/lib/walshken/preview";
import { Brand, Icon } from "./brand";
import { PublicNav } from "./public-nav";

export function PublicShell({ children }: { children: ReactNode }) {
  const preview = designPreviewEnabled();
  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="corporate-header"><div className="public-wrap topbar"><Brand/><PublicNav/></div></header>
    <main id="main" tabIndex={-1}>{children}</main>
    <footer className="corporate-footer"><div className="public-wrap footer-inner">
      <Brand/><span>© {new Date().getFullYear()} Walshken</span>
      <nav aria-label="Footer">
        <Link href="/services">Services</Link><Link href="/countries">Countries</Link>
        <Link href="/about">About</Link><Link href="/contact">Contact</Link>
        <Link href={preview ? "/preview" : "/staff"} prefetch={false}>
          {preview ? "Staff preview" : "Staff workspace"} <Icon name="external" size={13}/>
        </Link>
      </nav>
    </div></footer>
  </>;
}
