import { PublicShell } from "@/components/walshken/public-shell";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { publicMetadata } from "@/lib/walshken/seo";
import { Icon } from "@/components/walshken/brand";
import { CountryLinks, PageHero, serviceTopics } from "@/components/walshken/public-content";
import { contactPath, findService, marketList } from "@/lib/walshken/public-catalog";
import { loadCatalog } from "@/lib/walshken/server";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ service: string }> };


export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const item = findService(await loadCatalog(), (await params).service);
  return item ? publicMetadata(`/services/${encodeURIComponent(item.id)}`, item.name, item.description) : { title: "Service unavailable" };
}

export default async function ServicePage({ params }: Props) {
  const catalog = await loadCatalog();
  const item = findService(catalog, (await params).service);
  if (!item) notFound();
  const topics = serviceTopics[item.id];
  const markets = marketList(catalog, item.id);
  return <PublicShell>
    <PageHero label="SERVICE DIVISION" title={item.name} description={item.description} icon={item.icon}
      parent={{ label: "Services", href: "/services" }}>
      <Link className="btn btn-blue" href="#availability">Check availability <Icon name="right" size={17}/></Link>
      <Link className="text-link" href={contactPath(undefined, item.id)}>Ask about this service <Icon name="external" size={16}/></Link>
    </PageHero>
    <div className="public-wrap inner-section service-detail-grid">
      <section className="public-panel" aria-labelledby="service-topics">
        <span className="icon-tile"><Icon name={item.icon} size={23}/></span>
        <h2 id="service-topics">{topics ? "What you can ask about" : "Tell us what you need"}</h2>
        {topics ? <ul className="topic-list">{topics.map((topic) => <li key={topic}><Icon name="tick" size={17}/>{topic}</li>)}</ul>
          : <p>Tell us what you’re looking for and where you need support so your inquiry can reach the right team.</p>}
      </section>
      <section className="public-panel" id="availability" aria-labelledby="service-markets">
        <span className="icon-tile"><Icon name="globe" size={23}/></span>
        <h2 id="service-markets">Availability by country</h2>
        <p>See what’s available where you need support.</p>
        {markets.length > 0 && <CountryLinks markets={markets} service={item.id}/>}
        <Link className="text-link" href={`/countries?service=${encodeURIComponent(item.id)}`}>Search countries <Icon name="right" size={16}/></Link>
      </section>
    </div>
  </PublicShell>;
}
