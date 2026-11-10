import Link from "next/link";
import type { ReactNode } from "react";
import { designPreviewEnabled } from "@/lib/walshken/preview";
import { loadCatalog } from "@/lib/walshken/server";
import { Brand, Icon } from "./brand";
import { PublicNav } from "./public-nav";

export async function PublicShell({ children }: { children: ReactNode }) {
  const preview = designPreviewEnabled();
  const { services } = await loadCatalog();

  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="corporate-header"><div className="public-wrap topbar"><Brand/><PublicNav/></div></header>
    <main id="main" tabIndex={-1}>{children}</main>
    <footer className="corporate-footer">
      <div className="public-wrap">
        <div className="footer-cta">
          <div><h2>Have a question for Walshken?</h2><p>Tell us what you need and where you need support.</p></div>
          <Link href="/contact" className="btn btn-white">Contact Walshken <Icon name="right" size={17}/></Link>
        </div>
        <div className="footer-grid">
          <div className="footer-brand"><Brand/><p>Professional services for business and personal plans, organized by country.</p></div>
          <nav aria-label="Explore Walshken"><h3>Explore</h3>
            <Link href="/services">All services</Link><Link href="/countries">Countries and territories</Link>
            <Link href="/about">About Walshken</Link><Link href="/contact">Contact</Link>
          </nav>
          {services.length > 0 && <nav aria-label="Service divisions"><h3>Service divisions</h3>
            {services.map((service) => <Link key={service.id} href={`/services/${encodeURIComponent(service.id)}`}>{service.name}</Link>)}
          </nav>}
          <nav aria-label="Staff access"><h3>Staff access</h3>
            <Link href="/staff" prefetch={false}>Staff sign-in <Icon name="external" size={14}/></Link>
            {preview && <Link href="/preview" prefetch={false}>Design preview <Icon name="external" size={14}/></Link>}
          </nav>
        </div>
        <div className="footer-bottom"><span>© {new Date().getUTCFullYear()} Walshken</span><span>Global professional services</span></div>
      </div>
    </footer>
  </>;
}
