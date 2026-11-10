import Link from "next/link";
import type { ReactNode } from "react";
import { countryPath, type SiteService } from "@/lib/walshken/public-catalog";
import { Icon } from "./brand";

type Crumb = { label: string; href: string };

export function PageHero({ label, title, description, icon, parent, children }: {
  label: string; title: string; description: string; icon: string; parent?: Crumb; children?: ReactNode;
}) {
  return <section className="inner-hero">
    <div className="public-wrap">
      <nav className="public-breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link><Icon name="next" size={14}/>
        {parent && <><Link href={parent.href}>{parent.label}</Link><Icon name="next" size={14}/></>}
        <span aria-current="page">{title}</span>
      </nav>
      <div className="inner-hero-grid">
        <div className="inner-hero-copy">
          <div className="section-kicker"><span/> {label}</div>
          <h1>{title}</h1><p>{description}</p>
          {children && <div className="inner-hero-actions">{children}</div>}
        </div>
        <div className="inner-hero-mark" aria-hidden="true"><span className="inner-orbit"/><span className="inner-orbit inner-orbit-large"/><Icon name={icon} size={54}/></div>
      </div>
    </div>
  </section>;
}

export function ServiceGrid({ services, contactCard = false }: { services: SiteService[]; contactCard?: boolean }) {
  if (!services.length) return <p className="catalog-empty">The service catalog is being updated. <Link className="text-link" href="/contact">Contact Walshken</Link></p>;
  return <div className="service-grid">
    {services.map((service) => <Link className="service-card service-card-link" key={service.id} href={`/services/${encodeURIComponent(service.id)}`}>
      <div className="service-card-top"><span className="icon-tile"><Icon name={service.icon} size={23}/></span>
        <span className="icon-button card-arrow"><Icon name="external" size={18}/></span></div>
      <h3>{service.name}</h3><p>{service.description}</p>
    </Link>)}
    {contactCard && <Link className="service-card service-last" href="/contact">
      <div><div className="section-kicker">HERE TO HELP</div><h3>Have a question?</h3><p>Tell us what you need and we’ll point you to the right division.</p></div>
      <span className="circle-arrow"><Icon name="right" size={19}/></span>
    </Link>}
  </div>;
}

export function CountryLinks({ markets, service }: {
  markets: { code: string; name: string; enabled: boolean }[]; service?: string;
}) {
  return <div className="country-grid">
    {markets.map((market) => <Link href={countryPath(market.code, service)} key={market.code} className="country-card">
      <span className="icon-tile"><Icon name="pin" size={21}/></span><span className="country-card-copy"><strong>{market.name}</strong>
        <small>{market.enabled ? "Check current availability" : "Coming soon"}</small></span><Icon name="right" size={18}/>
    </Link>)}
  </div>;
}

export const serviceTopics: Readonly<Partial<Record<string, readonly string[]>>> = {
  technology: ["Business systems and workflow tools", "Technical support and troubleshooting", "Planning a website or digital project"],
  accounting: ["Bookkeeping and day-to-day records", "Financial reports and reconciliations", "Accounting support for a growing business"],
  travel: ["Personal trips and itineraries", "Business travel planning", "Travel logistics and booking questions"],
  immigration: ["Exploring immigration service options", "Identifying the right team for your inquiry", "Preparing questions for an initial discussion"],
  education: ["Comparing study options", "Exploring academic pathways", "Planning your next education step"],
  taxation: ["Personal or business tax preparation inquiries", "Organizing records for a tax discussion", "Finding the appropriate tax support"],
  paralegal: ["Finding support in your jurisdiction", "Questions about document preparation", "Clarifying what to bring to an initial discussion"],
};
