import type { Metadata } from "next";
import { publicMetadata } from "@/lib/walshken/seo";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/walshken/brand";
import { PageHero } from "@/components/walshken/public-content";
import { InquiryForm } from "@/components/walshken/public-controls";
import { contactPath, countryPath, findCountry, findService, marketList, type PublicQuery } from "@/lib/walshken/public-catalog";
import { loadCatalog } from "@/lib/walshken/server";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ code: string }>; searchParams: PublicQuery };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const country = findCountry((await params).code);
  if (!country) return { title: "Country unavailable" };
  const catalog = await loadCatalog();
  const published = marketList(catalog).some((market) => market.code === country.code && market.enabled);
  return publicMetadata(countryPath(country.code), `Professional services in ${country.name}`,
    `Check Walshken’s service availability and contact options for ${country.name}.`, published);
}

export default async function CountryPage({ params, searchParams }: Props) {
  const country = findCountry((await params).code);
  if (!country) notFound();
  const [catalog, query] = await Promise.all([loadCatalog(), searchParams]);
  const selected = findService(catalog, query.service);
  const market = catalog.markets.find((item) => item.code === country.code);
  const active = market?.enabled === 1;
  const inquiry = contactPath(country.code, selected?.id);
  const services = selected ? [selected] : catalog.services;
  const available = new Map(catalog.availability.filter((row) => row.country === country.code && row.enabled === 1)
    .map((row) => [row.service_id, row.destination]));

  return <>
    <PageHero label={active ? "SERVICE AVAILABILITY" : "COMING SOON"} title={country.name} icon="pin"
      parent={{ label: "Countries", href: "/countries" }}
      description={active ? `See current availability for ${selected?.name ?? "Walshken’s service divisions"} in ${country.name}.`
        : "Walshken services are coming soon to your country. We’re expanding our international network. Please check back regularly for updates."}>
      <Link className="btn btn-outline" href={selected ? `/countries?service=${encodeURIComponent(selected.id)}` : "/countries"}>
        Change country <Icon name="right" size={17}/>
      </Link>
    </PageHero>
    <div className="public-wrap inner-section country-detail">
      {active ? <section className="public-panel" aria-labelledby="availability-heading">
        <div className="section-lead"><div><div className="section-kicker"><span/> CURRENT AVAILABILITY</div>
          <h2 id="availability-heading">{selected?.name ?? "Walshken services"}</h2></div>
          {selected && <Link className="text-link" href={countryPath(country.code)}>View all services <Icon name="right" size={16}/></Link>}
        </div>
        {market.contact && <p className="market-contact"><Icon name="mail" size={19}/><span>{market.contact}</span></p>}
        {services.length === 0 && <p>The service catalog is being updated.</p>}
        <div className="availability-list">
          {services.map((item) => {
            const published = available.has(item.id);
            const destination = available.get(item.id) || contactPath(country.code, item.id);
            return <article className="availability-card" key={item.id}>
              <span className="icon-tile"><Icon name={item.icon} size={21}/></span>
              <div><h3><Link href={`/services/${encodeURIComponent(item.id)}`}>{item.name}</Link></h3><p>{item.description}</p></div>
              <div className="availability-action"><span className={published ? "status-tag good" : "status-tag"}>{published ? "Available" : "Coming Soon"}</span>
                {published && <a className="text-link" href={destination}>Visit service <Icon name="external" size={15}/></a>}</div>
            </article>;
          })}
        </div>
        <Link className="btn btn-blue" href={inquiry}>Ask about availability <Icon name="right" size={17}/></Link>
      </section> : <section className="public-panel launch-panel" aria-labelledby="launch-heading">
        <span className="icon-tile"><Icon name="bell" size={22}/></span>
        <h2 id="launch-heading">Get a launch update</h2>
        <p>{selected ? `Register your interest in ${selected.name} in ${country.name}.` : `Register your interest in Walshken services in ${country.name}.`}</p>
        <InquiryForm key={`${country.code}-${selected?.id ?? ""}`} country={country.code} service={selected?.id ?? ""} services={catalog.services} enabled={catalog.acceptsInquiries === true} notify/>
        <Link className="text-link" href={inquiry}>Send a general inquiry <Icon name="right" size={16}/></Link>
      </section>}
    </div>
  </>;
}
