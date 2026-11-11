import { PublicShell } from "@/components/walshken/public-shell";
import { publicMetadata } from "@/lib/walshken/seo";
import Link from "next/link";
import { Icon } from "@/components/walshken/brand";
import { PageHero } from "@/components/walshken/public-content";
import { InquiryForm } from "@/components/walshken/public-controls";
import { countryPath, findCountry, findService, type PublicQuery } from "@/lib/walshken/public-catalog";
import { loadCatalog } from "@/lib/walshken/server";

export const dynamic = "force-dynamic";
export const metadata = publicMetadata("/contact", "Contact Walshken",
  "Tell Walshken what support you need and where. Choose a service division or send a general inquiry.");

export default async function ContactPage({ searchParams }: { searchParams: PublicQuery }) {
  const [catalog, query] = await Promise.all([loadCatalog(), searchParams]);
  const country = findCountry(query.country)?.code ?? "";
  const service = findService(catalog, query.service);
  const market = catalog.markets.find((item) => item.code === country && item.enabled === 1);
  return <PublicShell>
    <PageHero label="CONTACT WALSHKEN" title="How can we help?" icon="mail"
      description="Tell us what you need and where you need support."
      visual={<aside className="contact-assistant" aria-labelledby="contact-assistant-title">
        <div className="contact-assistant-heading">
          <span className="icon-tile"><Icon name="message" size={21}/></span>
          <h2 id="contact-assistant-title">Walshken Assistant</h2>
        </div>
        <p>Chat support is coming soon. You can send your question to our team today.</p>
        <Link className="text-link" href="#inquiry-heading">Use the contact form <Icon name="right" size={17}/></Link>
      </aside>}/>
    <div className="public-wrap inner-section contact-grid">
      <aside className="contact-aside" aria-label="Help with your inquiry">
        <div className="public-panel"><span className="icon-tile"><Icon name="user" size={22}/></span><h2>Track your requests</h2>
          <p>Send inquiries from your customer account and follow updates from our team.</p>
          <Link className="text-link" href="/customer">Open customer account <Icon name="right" size={16}/></Link>
        </div>
        <div className="public-panel"><span className="icon-tile"><Icon name="globe" size={22}/></span><h2>Check local availability</h2>
          <p>{market?.contact || "See which services are listed in your country and check for local contact details."}</p>
          <Link className="text-link" href={country ? countryPath(country, service?.id) : "/countries"}>View country availability <Icon name="right" size={16}/></Link>
        </div>
      </aside>
      <section className="contact-form-shell" aria-labelledby="inquiry-heading">
        <div className="section-kicker"><span/> GENERAL INQUIRIES</div><h2 id="inquiry-heading">Send an inquiry</h2>
        <InquiryForm key={`${country}-${service?.id ?? ""}`} country={country} service={service?.id ?? ""} services={catalog.services} enabled={catalog.acceptsInquiries === true}/>
      </section>
    </div>
  </PublicShell>;
}
