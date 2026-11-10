import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CountryLinks, PageHero } from "@/components/walshken/public-content";
import { ServiceExplorer } from "@/components/walshken/public-controls";
import { countryPath, findCountry, findService, marketList, type PublicQuery } from "@/lib/walshken/public-catalog";
import { loadCatalog } from "@/lib/walshken/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Countries", description: "Search countries and territories to check Walshken service availability." };

export default async function CountriesPage({ searchParams }: { searchParams: PublicQuery }) {
  const [catalog, query] = await Promise.all([loadCatalog(), searchParams]);
  const country = findCountry(query.country);
  const service = findService(catalog, query.service);
  if (country) redirect(countryPath(country.code, service?.id));
  return <>
    <PageHero label="OUR MARKETS" title="Countries & territories" icon="globe"
      description="Canada is our first launch market. Search by country name or ISO code to see where each service is available."/>
    <div className="public-wrap inner-section">
      <ServiceExplorer services={catalog.services} service={service?.id}/>
      <section className="country-directory" aria-labelledby="markets-heading">
        <div className="section-kicker"><span/> WALSHKEN MARKETS</div><h2 id="markets-heading">Explore our markets</h2>
        <CountryLinks markets={marketList(catalog)} service={service?.id}/>
      </section>
    </div>
  </>;
}
