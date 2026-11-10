import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/walshken/brand";
import { PageHero, ServiceGrid } from "@/components/walshken/public-content";
import { loadCatalog } from "@/lib/walshken/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Services",
  description: "Explore Walshken’s professional service divisions and check availability in your country.",
};

export default async function ServicesPage() {
  const catalog = await loadCatalog();
  return <>
    <PageHero label="OUR DIVISIONS" title="Professional services" icon="services"
      description="Explore Walshken’s divisions for business, travel, education and more. Choose a service to see where it’s available and how to get in touch.">
      <Link className="btn btn-blue" href="#divisions">Browse divisions <Icon name="right" size={17}/></Link>
      <Link className="text-link" href="/countries">Browse by country <Icon name="external" size={16}/></Link>
    </PageHero>
    <section id="divisions" className="public-wrap inner-section">
      <div className="section-lead"><div><div className="section-kicker"><span/> FIND YOUR DIVISION</div><h2>Start with what you need.</h2></div></div>
      <ServiceGrid services={catalog.services} contactCard/>
    </section>
  </>;
}
