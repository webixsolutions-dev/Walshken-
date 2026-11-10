import { PublicShell } from "@/components/walshken/public-shell";
import { publicMetadata } from "@/lib/walshken/seo";
import { redirect } from "next/navigation";
import { CountryLinks, PageHero } from "@/components/walshken/public-content";
import { ServiceExplorer } from "@/components/walshken/public-controls";
import { countryPath, matchCountrySearch, findService, marketList, type PublicQuery } from "@/lib/walshken/public-catalog";
import { loadCatalog } from "@/lib/walshken/server";

export const dynamic = "force-dynamic";
export const metadata = publicMetadata("/countries", "Countries & territories",
  "Search by country name or ISO code to check Walshken service availability and get local launch updates.");

export default async function CountriesPage({ searchParams }: { searchParams: PublicQuery }) {
  const [catalog, query] = await Promise.all([loadCatalog(), searchParams]);
  const country = matchCountrySearch(query.country);
  const service = findService(catalog, query.service);
  if (country) redirect(countryPath(country.code, service?.id));
  const markets = marketList(catalog, service?.id);
  return <PublicShell services={catalog.services}>
    <PageHero label="OUR MARKETS" title="Countries & territories" icon="globe"
      description="Search by country name or ISO code to check services, local contact options, and launch updates."/>
    <div className="public-wrap inner-section">
      <ServiceExplorer services={catalog.services} service={service?.id}/>
      {query.country && <p className="form-error country-search-error" role="status">Choose a country or territory from the search results.</p>}
      <section className="country-directory" aria-labelledby="markets-heading">
        <div className="section-kicker"><span/> WALSHKEN MARKETS</div><h2 id="markets-heading">Explore our markets</h2>
        {markets.length ? <CountryLinks markets={markets} service={service?.id}/>
          : <p className="catalog-empty">Search for your country to check availability or register for launch updates.</p>}
      </section>
    </div>
  </PublicShell>;
}
