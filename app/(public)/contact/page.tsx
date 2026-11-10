import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/walshken/brand";
import { PageHero } from "@/components/walshken/public-content";
import { InquiryForm } from "@/components/walshken/public-controls";
import { countryPath, findCountry, findService, type PublicQuery } from "@/lib/walshken/public-catalog";
import { loadCatalog } from "@/lib/walshken/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Contact", description: "Get in touch with Walshken and direct your question to the appropriate service division." };

export default async function ContactPage({ searchParams }: { searchParams: PublicQuery }) {
  const [catalog, query] = await Promise.all([loadCatalog(), searchParams]);
  const country = findCountry(query.country)?.code ?? "CA";
  const service = findService(catalog, query.service);
  const market = catalog.markets.find((item) => item.code === country && item.enabled === 1);
  return <>
    <PageHero label="CONTACT WALSHKEN" title="How can we help?" icon="mail"
      description="Tell us what you’re looking for. A few details about the service and your country help direct your inquiry."/>
    <div className="public-wrap inner-section contact-grid">
      <aside className="contact-aside" aria-label="Help with your inquiry">
        <div className="public-panel"><span className="icon-tile"><Icon name="compass" size={22}/></span><h2>Find the right team</h2>
          <p>Choose General inquiry if you’re unsure which division fits. Include where you need help and any relevant timeline.</p>
          <Link className="text-link" href="/services">Browse service divisions <Icon name="right" size={16}/></Link>
        </div>
        <div className="public-panel"><span className="icon-tile"><Icon name="globe" size={22}/></span><h2>Check local availability</h2>
          <p>{market?.contact || "See which services are listed in your country and check for local contact details."}</p>
          <Link className="text-link" href={countryPath(country, service?.id)}>View country availability <Icon name="right" size={16}/></Link>
        </div>
      </aside>
      <section className="contact-form-shell" aria-labelledby="inquiry-heading">
        <div className="section-kicker"><span/> GENERAL INQUIRIES</div><h2 id="inquiry-heading">Send an inquiry</h2>
        <InquiryForm key={`${country}-${service?.id ?? ""}`} country={country} service={service?.id ?? ""} services={catalog.services} enabled={catalog.acceptsInquiries === true}/>
      </section>
    </div>
  </>;
}
