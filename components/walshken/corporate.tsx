import Link from "next/link";
import { Icon } from "./brand";
import { ServiceExplorer } from "./public-controls";
import { CountryLinks, ServiceGrid } from "./public-content";
import { marketList, type SiteCatalog } from "@/lib/walshken/public-catalog";

export function Corporate({ catalog }: { catalog: SiteCatalog }) {
  const activeMarkets = marketList(catalog).filter((market) => market.enabled).slice(0, 4);

  return <>
    <section id="services" className="home-services" aria-labelledby="home-services-title">
      <div className="public-wrap">
        <div className="home-services-lead">
          <div>
            <p className="section-kicker"><span/> Our service divisions</p>
            <h1 id="home-services-title">{catalog.content.title}</h1>
            <p className="home-services-intro">{catalog.content.description}</p>
          </div>
          <img className="home-service-art" src="/walshken-service-team.png" alt="" width="800" height="533" fetchPriority="high"/>
        </div>
        <ServiceGrid services={catalog.services} heading="h2" contactCard/>
      </div>
    </section>
    <div className="public-wrap home-explorer"><ServiceExplorer services={catalog.services}/></div>
    <section id="countries" className="public-wrap market-wrap">
      <div className="market-band market-global">
        <div className="market-copy">
          <div className="section-kicker"><span/> Local availability</div>
          <h2>Find services in your country.</h2>
          <p>Check which services are available where you need support.</p>
          <Link className="btn btn-white" href="/countries">Explore countries <Icon name="right" size={17}/></Link>
        </div>
        {activeMarkets.length ? <CountryLinks markets={activeMarkets}/> : <div className="market-globe" aria-hidden="true"><Icon name="globe" size={110}/></div>}
      </div>
    </section>
  </>;
}
